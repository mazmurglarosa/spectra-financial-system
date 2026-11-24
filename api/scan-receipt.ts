import { verifySessionToken, parseCookies } from "./_lib/auth.js";
import { checkRateLimitCentralized, getClientIp } from "./_lib/rateLimit.js";
import { getSupabaseServerClient } from "./_lib/supabaseServer.js";
import {
  sanitizeCurrencyAmount,
  runTwoWayDeterministicVerification,
  ExtractedItem,
  RealOcrExtractionResult
} from "./_lib/ocrSanitizer.js";

// Batas ukuran payload: 10MB (base64 string max ~13.5MB chars)
const MAX_BASE64_LENGTH = 10 * 1024 * 1024 * 1.37;
const GROQ_TIMEOUT_MS = 15000;

/**
 * Validasi magic bytes & format gambar (JPEG, PNG, WEBP)
 */
function detectAndValidateImageFormat(base64Data: string): { valid: boolean; mime: string; cleanBase64: string } {
  let cleanBase64 = base64Data.trim();
  let declaredMime: string | null = null;

  // Cek jika memiliki prefix Data URI
  const dataUriMatch = cleanBase64.match(/^data:(image\/(jpeg|png|webp|jpg));base64,(.+)$/i);
  if (dataUriMatch) {
    declaredMime = dataUriMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : dataUriMatch[1].toLowerCase();
    cleanBase64 = dataUriMatch[3].trim();
  }

  try {
    const sampleBuffer = Buffer.from(cleanBase64.slice(0, 32), 'base64');
    if (sampleBuffer.length < 4) {
      return { valid: false, mime: '', cleanBase64: '' };
    }

    // JPEG: FF D8 FF
    if (sampleBuffer[0] === 0xff && sampleBuffer[1] === 0xd8 && sampleBuffer[2] === 0xff) {
      return { valid: true, mime: 'image/jpeg', cleanBase64 };
    }

    // PNG: 89 50 4E 47
    if (sampleBuffer[0] === 0x89 && sampleBuffer[1] === 0x50 && sampleBuffer[2] === 0x4e && sampleBuffer[3] === 0x47) {
      return { valid: true, mime: 'image/png', cleanBase64 };
    }

    // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
    if (sampleBuffer.length >= 12 &&
        sampleBuffer[0] === 0x52 && sampleBuffer[1] === 0x49 && sampleBuffer[2] === 0x46 && sampleBuffer[3] === 0x46 &&
        sampleBuffer[8] === 0x57 && sampleBuffer[9] === 0x45 && sampleBuffer[10] === 0x42 && sampleBuffer[11] === 0x50) {
      return { valid: true, mime: 'image/webp', cleanBase64 };
    }

    // Jika memiliki declaredMime yang valid dan lolos dekode buffer
    if (declaredMime && ['image/jpeg', 'image/png', 'image/webp'].includes(declaredMime)) {
      return { valid: true, mime: declaredMime, cleanBase64 };
    }

    return { valid: false, mime: '', cleanBase64: '' };
  } catch (err) {
    return { valid: false, mime: '', cleanBase64: '' };
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Hanya POST yang didukung.' });
  }

  // 1. Verifikasi Autentikasi Sesi Server
  const cookies = parseCookies(req.headers?.cookie);
  const authHeader = req.headers?.authorization;
  const token = cookies['spectra_session'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Autentikasi diperlukan untuk mengakses layanan pemindaian struk.' });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.' });
  }

  // 2. Verifikasi Status Pengguna di Database (Wajib 'active')
  try {
    const supabase = getSupabaseServerClient();
    const { data: users, error: dbError } = await supabase
      .from('system_users')
      .select('id, status, session_version')
      .eq('id', session.sub)
      .limit(1);

    const currentUser = users && users.length > 0 ? users[0] : null;

    if (!currentUser || currentUser.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Akun Anda tidak aktif atau akses telah dinonaktifkan oleh Administrator.'
      });
    }

    if (currentUser.session_version && currentUser.session_version > session.sessionVersion) {
      return res.status(401).json({
        success: false,
        error: 'Sesi Anda telah kedaluwarsa karena perubahan kredensial. Harap login kembali.'
      });
    }
  } catch (err: any) {
    console.error('[Scan Receipt DB Auth Check Error]:', err);
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        success: false,
        error: 'Layanan verifikasi akun basis data tidak dapat dijangkau. Permintaan ditolak demi keamanan.'
      });
    }
    // Jika di development lokal dan Supabase sementara belum aktif, lanjut verifikasi HMAC
  }

  // 3. Rate Limiting Terpusat Per Pengguna (Maksimal 10 request per menit per user)
  const supabase = getSupabaseServerClient();
  const rateLimitKey = `scan_${session.sub}`;
  const rateLimit = await checkRateLimitCentralized(rateLimitKey, 10, 60 * 1000, supabase);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Batas frekuensi pemindaian tercapai (maks 10 struk/menit). Harap tunggu beberapa detik sebelum memindai kembali.'
    });
  }

  // 4. Validasi Payload & Gambar
  const body = req.body || {};
  const rawImage = String(body.image || '').trim();
  const posCode = String(body.posCode || 'A').trim();
  const userDescription = String(body.userDescription || '').trim();

  if (!rawImage) {
    return res.status(400).json({ success: false, error: 'Gambar struk (base64) wajib disertakan.' });
  }

  if (rawImage.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ success: false, error: 'Ukuran file gambar melebihi batas maksimum 10MB.' });
  }

  const { valid, mime, cleanBase64 } = detectAndValidateImageFormat(rawImage);
  if (!valid) {
    return res.status(400).json({
      success: false,
      error: 'Format gambar tidak didukung. Harap unggah berkas bertipe JPEG, PNG, atau WEBP.'
    });
  }

  // 5. Cek Ketersediaan Kredensial Groq API Key
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({
      success: false,
      errorCode: 'GROQ_API_KEY_MISSING',
      error: 'Konfigurasi GROQ_API_KEY belum tersedia di environment server Vercel. Sistem dapat beralih ke OCR Offline Tesseract.js.'
    });
  }

  // Model Vision Candidates dengan Fallback Otomatis & Konfigurasi Fleksibel
  // Catatan: Model deprecated llama-3.2-11b-vision-preview & llama-3.2-90b-vision-preview telah DIHAPUS PERMANEN (dihentikan Groq per 14 April 2025).
  const envConfiguredModels = process.env.GROQ_VISION_MODELS
    ? process.env.GROQ_VISION_MODELS.split(',').map(m => m.trim()).filter(Boolean)
    : [];

  const singleEnvModel = process.env.GROQ_VISION_MODEL?.trim();

  // Model Vision didukung dokumentasi resmi Groq saat ini
  const defaultVisionCandidates = ['qwen/qwen3.8-27b'];

  let candidateModels = Array.from(new Set([
    ...envConfiguredModels,
    ...(singleEnvModel ? [singleEnvModel] : []),
    ...defaultVisionCandidates
  ])).filter(Boolean);

  // Verifikasi Ketersediaan Model Vision via endpoint resmi /openai/v1/models di server-side
  try {
    const modelCheckController = new AbortController();
    const modelCheckTimeout = setTimeout(() => modelCheckController.abort(), 4000);
    const modelsResp = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      signal: modelCheckController.signal
    });
    clearTimeout(modelCheckTimeout);

    if (modelsResp.ok) {
      const modelsData: any = await modelsResp.json();
      const availableModels: string[] = Array.isArray(modelsData.data)
        ? modelsData.data.map((m: any) => String(m.id || '').trim()).filter(Boolean)
        : [];

      if (availableModels.length > 0) {
        // Filter: Model vision yang didukung (BUKAN model text-only seperti llama-3.3-70b-versatile atau mixtral)
        const activeVisionModels = availableModels.filter(id => {
          const lower = id.toLowerCase();
          // Cek apakah model adalah vision-capable dan bukan text-only
          const isTextOnly = lower.includes('versatile') || lower.includes('distill') || lower.includes('instruct') && !lower.includes('vision') && !lower.includes('vl');
          const isVision = lower.includes('vision') || lower.includes('qwen') || lower.includes('vl') || lower.includes('multimodal');
          return isVision && !isTextOnly;
        });

        // Jika model kandidat yang kita inginkan aktif di akun pengguna, prioritaskan
        const verifiedCandidates = candidateModels.filter(m => availableModels.includes(m));
        if (verifiedCandidates.length > 0) {
          candidateModels = verifiedCandidates;
        } else if (activeVisionModels.length > 0) {
          // Gunakan vision model aktif pertama yang tersedia di akun
          candidateModels = activeVisionModels;
        }
      }
    }
  } catch (checkErr: any) {
    // Jika pengecekan model timeout/gagal, tetap lanjutkan dengan kandidat terkonfigurasi
    console.warn('[Groq Model Discovery Warning]: Menggunakan daftar model fallback statis:', checkErr?.message);
  }

  const dataUri = `data:${mime};base64,${cleanBase64}`;

  // 6. Buat Prompt Terstruktur untuk Model Vision
  const systemPrompt = `Anda adalah spesialis OCR/HTR akuntansi enterprise pada SPECTRA Financial System.
Tugas Anda adalah membaca gambar bukti transaksi keuangan Indonesia (struk belanja kasir, nota thermal, faktur resmi, nota tulis tangan/HTR, atau bukti transfer mobile banking BCA/Mandiri/BRI/BNI) secara presisi tinggi.

PANDUAN EKSTRAKSI ANGKA INDONESIA:
1. Pemisah ribuan di Indonesia menggunakan tanda titik (contoh: 50.000) atau koma jika format internasional.
2. Nominal bukti transfer sering menyertakan sen .00 (contoh: 2.500.000,00 atau 2,500,000.00). JANGAN menganggap dua nol desimal sebagai angka ratusan ribu!
3. Tulisan tangan sering menggunakan notasi '10,-' (artinya 10.000 jika dalam konteks ribuan) atau '10k' / '10rb'.
4. Pisahkan subtotal, pajak (PB1/PPN), diskon, biaya kirim (ongkir), total bayar, dan kembalian secara terpisah.
5. DILARANG membuat nominal fiktif. Jika teks angka buram/hilang, beri confidence rendah (20-40) dan gunakan angka tertera apa adanya.

WAJIB MENGEMBALIKAN HANYA JSON DENGAN STRUKTUR BERIKUT:
{
  "detected_type": "nota_pembelian" | "transfer_bank" | "faktur" | "struk_thermal" | "lainnya",
  "seller_or_recipient": "Nama Toko / Penerima / Rekanan",
  "transaction_date": "YYYY-MM-DD",
  "subtotal": 0,
  "tax_amount": 0,
  "discount_amount": 0,
  "shipping_fee": 0,
  "declared_grand_total": 0,
  "payment_amount": 0,
  "change_amount": 0,
  "extracted_items": [
    {
      "name": "Nama barang atau jasa",
      "quantity": 1,
      "unit": "pcs",
      "unit_price": 50000,
      "total_price": 50000,
      "confidence": 85,
      "is_tax_or_fee": false,
      "tax_or_fee_type": null
    }
  ]
}`;

  const userPrompt = `Analisis berkas transaksi berikut (Konteks POS: ${posCode}, Catatan User: ${userDescription || '-'}).
Ekstrak semua baris item barang/jasa beserta subtotal, pajak, diskon, dan grand total secara presisi dan kembalikan dalam format JSON.`;

  // 7. Panggil Groq Vision API dengan Fallback Antar Model dan Timeout 15s
  let lastError: { errorCode: string; message: string; status?: number } | null = null;
  let parsed: any = null;
  let usedModel = candidateModels[0] || 'qwen/qwen3.8-27b';

  for (const modelToTry of candidateModels) {
    usedModel = modelToTry;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToTry,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                {
                  type: 'image_url',
                  image_url: { url: dataUri }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 2048
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutTimer);

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        console.warn(`[Groq API Model ${modelToTry} Error]:`, groqResponse.status, errText);

        if (groqResponse.status === 401) {
          return res.status(500).json({
            success: false,
            errorCode: 'GROQ_AUTH_ERROR',
            error: 'Autentikasi ke Groq Vision API gagal. Kunci GROQ_API_KEY tidak valid.'
          });
        }

        if (groqResponse.status === 429) {
          return res.status(429).json({
            success: false,
            errorCode: 'GROQ_RATE_LIMIT',
            error: 'Groq API sedang melayani beban puncak (rate limited). Silakan coba lagi beberapa saat atau beralih ke OCR Offline.'
          });
        }

        if (groqResponse.status === 404 || groqResponse.status === 503) {
          lastError = {
            errorCode: 'GROQ_MODEL_UNAVAILABLE',
            status: groqResponse.status,
            message: `Model ${modelToTry} tidak tersedia (${groqResponse.status}): ${errText.slice(0, 120)}`
          };
          continue;
        }

        lastError = {
          errorCode: 'GROQ_SERVER_ERROR',
          status: groqResponse.status,
          message: `Groq mengembalikan status ${groqResponse.status}: ${errText.slice(0, 120)}`
        };
        continue;
      }

      const completion: any = await groqResponse.json();
      const contentText = completion.choices?.[0]?.message?.content || '{}';

      try {
        parsed = JSON.parse(contentText);
        break; // Berhasil mendapatkan dan mem-parse JSON
      } catch (parseErr) {
        console.error('[Groq JSON Parse Error]: Raw content was:', contentText);
        lastError = {
          errorCode: 'GROQ_INVALID_JSON',
          message: `Output dari model ${modelToTry} bukan format JSON akuntansi yang valid.`
        };
        continue;
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutTimer);
      if (fetchErr.name === 'AbortError') {
        lastError = {
          errorCode: 'GROQ_TIMEOUT',
          message: `Permintaan ke model ${modelToTry} melampaui batas waktu ${GROQ_TIMEOUT_MS / 1000} detik.`
        };
      } else {
        lastError = {
          errorCode: 'GROQ_NETWORK_ERROR',
          message: `Gagal menghubungi Groq API (${fetchErr.message})`
        };
      }
      console.warn(`[Groq Fetch Error with ${modelToTry}]:`, fetchErr.message);
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return res.status(502).json({
      success: false,
      errorCode: lastError?.errorCode || 'GROQ_ALL_MODELS_FAILED',
      error: `Layanan Groq Vision API tidak dapat menyelesaikan pemindaian (${lastError?.message || 'semua model kandidat gagal'}). Sistem dapat beralih ke OCR Offline Tesseract.js.`
    });
  }

  // 8. Normalisasi extracted_items (tangani null, object, atau tipe salah)
  let rawItems: any[] = [];
  if (Array.isArray(parsed.extracted_items)) {
    rawItems = parsed.extracted_items;
  } else if (parsed.extracted_items && typeof parsed.extracted_items === 'object') {
    rawItems = Object.values(parsed.extracted_items);
  } else if (Array.isArray(parsed.items)) {
    rawItems = parsed.items;
  } else if (parsed.items && typeof parsed.items === 'object') {
    rawItems = Object.values(parsed.items);
  }

  const items: ExtractedItem[] = rawItems.filter(Boolean).map((it: any, idx: number) => {
    const itemName = String(it.name || it.item_name || `Item ${idx + 1}`).trim();
    const sanitizedTotal = sanitizeCurrencyAmount(it.total_price ?? it.total ?? it.subtotal, itemName);
    const sanitizedUnit = it.unit_price !== null && it.unit_price !== undefined
      ? sanitizeCurrencyAmount(it.unit_price, itemName)
      : null;

    // Jangan berikan confidence tinggi palsu jika model tidak menyertakan confidence
    let conf = 50;
    if (it.confidence !== null && it.confidence !== undefined && !isNaN(Number(it.confidence))) {
      conf = Math.max(10, Math.min(100, Math.round(Number(it.confidence))));
    } else if (sanitizedTotal > 0 && itemName.length > 2) {
      conf = 75; // Nilai wajar moderat untuk item lengkap
    }

    return {
      id: `it-groq-${Date.now()}-${idx}`,
      name: itemName,
      unitPrice: sanitizedUnit,
      quantity: it.quantity !== null && it.quantity !== undefined && !isNaN(Number(it.quantity)) ? Number(it.quantity) : null,
      unit: String(it.unit || 'pcs').trim(),
      totalPrice: sanitizedTotal,
      confidence: conf,
      isTaxOrFee: Boolean(it.is_tax_or_fee),
      taxOrFeeType: it.tax_or_fee_type || undefined
    };
  });

  const declaredGrand = sanitizeCurrencyAmount(
    parsed.declared_grand_total ?? parsed.grand_total ?? parsed.total_amount ?? parsed.total,
    userDescription
  );

  // 9. Jalankan Verifikasi Deterministik Dua Arah (Horizontal & Vertikal)
  const verification = runTwoWayDeterministicVerification(items, declaredGrand);

    const extractionResult: RealOcrExtractionResult = {
      detectedType: parsed.detected_type || 'nota_pembelian',
      sellerOrRecipient: parsed.seller_or_recipient || userDescription || 'Toko / Rekanan',
      transactionDate: parsed.transaction_date,
      extractedItems: verification.verifiedItems,
      declaredGrandTotal: verification.grandTotal,
      calculatedSum: verification.calculatedSum,
      mathDiscrepancy: verification.mathDiscrepancy,
      discrepancyMessage: verification.discrepancyMessage,
      sourceEngine: 'groq_vision',
      rawResponse: parsed
    };

  // 10. Kembalikan Hasil Ekstraksi Bersih ke Frontend
  // PERINGATAN INTEGRITAS: Endpoint ini TIDAK boleh otomatis menyimpan transaksi ke database!
  return res.status(200).json({
    success: true,
    usedModel,
    data: {
      ...extractionResult,
      usedModel
    }
  });
}
