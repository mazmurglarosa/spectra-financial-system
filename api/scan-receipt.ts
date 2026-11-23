import { verifySessionToken, parseCookies } from './lib/auth';
import { checkRateLimitCentralized, getClientIp } from './lib/rateLimit';
import { getSupabaseServerClient } from './lib/supabaseServer';
import {
  sanitizeCurrencyAmount,
  runTwoWayDeterministicVerification,
  ExtractedItem,
  RealOcrExtractionResult
} from './lib/ocrSanitizer';

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
      error: 'Konfigurasi GROQ_API_KEY belum tersedia di environment server Vercel.'
    });
  }

  const groqModel = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
  const dataUri = `data:${mime};base64,${cleanBase64}`;

  // 6. Buat Prompt Terstruktur untuk Model Vision
  const systemPrompt = `Anda adalah spesialis OCR/HTR akuntansi enterprise pada SPECTRA Financial System.
Tugas Anda adalah membaca gambar bukti transaksi keuangan Indonesia (struk belanja kasir, nota thermal, faktur resmi, nota tulis tangan/HTR, atau bukti transfer mobile banking BCA/Mandiri/BRI/BNI) secara presisi tinggi.

PANDUAN EKSTRAKSI ANGKA INDONESIA:
1. Pemisah ribuan di Indonesia menggunakan tanda titik (contoh: 50.000) atau koma jika format internasional.
2. Nominal bukti transfer sering menyertakan sen .00 (contoh: 2.500.000,00 atau 2,500,000.00). JANGAN menganggap dua nol desimal sebagai angka ratusan ribu!
3. Tulisan tangan sering menggunakan notasi '10,-' (artinya 10.000 jika dalam konteks ribuan) atau '10k' / '10rb'.
4. Pisahkan pajak (PB1/PPN), biaya kirim (ongkir), atau biaya transfer bank (BI-FAST / admin bank) sebagai baris item dengan tanda is_tax_or_fee: true.

WAJIB MENGEMBALIKAN HANYA JSON DENGAN STRUKTUR BERIKUT:
{
  "detected_type": "nota_pembelian" | "transfer_bank" | "faktur" | "struk_thermal" | "lainnya",
  "seller_or_recipient": "Nama Toko / Penerima / Rekanan",
  "transaction_date": "YYYY-MM-DD",
  "declared_grand_total": 0,
  "extracted_items": [
    {
      "name": "Nama barang atau jasa",
      "quantity": 1,
      "unit": "pcs",
      "unit_price": 50000,
      "total_price": 50000,
      "confidence": 95,
      "is_tax_or_fee": false,
      "tax_or_fee_type": null
    }
  ]
}`;

  const userPrompt = `Analisis berkas transaksi berikut (Konteks POS: ${posCode}, Catatan User: ${userDescription || '-'}).
Ekstrak semua baris item barang/jasa beserta harganya secara akurat dan kembalikan dalam format JSON.`;

  // 7. Panggil Groq Vision API dengan Timeout 15s
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
        model: groqModel,
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
      console.error('[Groq API Error Status]:', groqResponse.status, errText);

      if (groqResponse.status === 401) {
        return res.status(500).json({
          success: false,
          error: 'Autentikasi ke Groq Vision API gagal. Kunci GROQ_API_KEY tidak valid.'
        });
      }

      if (groqResponse.status === 404) {
        return res.status(502).json({
          success: false,
          error: 'Model Groq Vision yang diminta tidak ditemukan atau telah dinonaktifkan oleh provider. Pastikan model yang digunakan aktif (default: qwen/qwen3.8-27b).'
        });
      }

      if (groqResponse.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'Groq API sedang melayani beban puncak (rate limited). Silakan coba lagi beberapa saat.'
        });
      }

      return res.status(502).json({
        success: false,
        error: `Layanan Groq Vision API mengembalikan status kesalahan (${groqResponse.status}).`
      });
    }

    const completion: any = await groqResponse.json();
    const contentText = completion.choices?.[0]?.message?.content || '{}';

    let parsed: any = {};
    try {
      parsed = JSON.parse(contentText);
    } catch (parseErr) {
      console.error('[Groq JSON Parse Error]: Raw content was:', contentText);
      return res.status(502).json({
        success: false,
        error: 'Hasil dari model Vision tidak dapat diuraikan sebagai format JSON yang valid.'
      });
    }

    // 8. Sanitasi & Normalisasi Data Transaksi
    const items: ExtractedItem[] = (parsed.extracted_items || []).map((it: any, idx: number) => {
      const itemName = String(it.name || `Item ${idx + 1}`).trim();
      const sanitizedTotal = sanitizeCurrencyAmount(it.total_price, itemName);
      const sanitizedUnit = it.unit_price !== null && it.unit_price !== undefined
        ? sanitizeCurrencyAmount(it.unit_price, itemName)
        : null;

      return {
        id: `it-groq-${Date.now()}-${idx}`,
        name: itemName,
        unitPrice: sanitizedUnit,
        quantity: it.quantity !== null && it.quantity !== undefined ? Number(it.quantity) : null,
        unit: String(it.unit || '').trim(),
        totalPrice: sanitizedTotal,
        confidence: Number(it.confidence) || 92,
        isTaxOrFee: Boolean(it.is_tax_or_fee),
        taxOrFeeType: it.tax_or_fee_type || undefined
      };
    });

    const declaredGrand = sanitizeCurrencyAmount(parsed.declared_grand_total, userDescription);

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
      data: extractionResult
    });

  } catch (err: any) {
    clearTimeout(timeoutTimer);
    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: `Waktu pemrosesan Groq Vision melebihi batas waktu maksimal (${GROQ_TIMEOUT_MS / 1000} detik). Silakan coba lagi.`
      });
    }

    console.error('[API Scan Receipt Execution Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan sistem internal saat memproses pemindaian dokumen.'
    });
  }
}
