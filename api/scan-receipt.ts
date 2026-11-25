import { verifySessionToken, parseCookies } from "./_lib/auth.js";
import { checkRateLimitCentralized, getClientIp } from "./_lib/rateLimit.js";
import { getSupabaseServerClient } from "./_lib/supabaseServer.js";
import { handleCorsAndSecurity } from "./_lib/routerHelper.js";
import {
  sanitizeCurrencyAmount,
  runTwoWayDeterministicVerification,
  ExtractedItem,
  BankTransferDetails,
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
  // Centralized CORS & Security Policy (Preflight, Mutation Origin Guard, Centralized Headers)
  if (!handleCorsAndSecurity(req, res, ['POST', 'OPTIONS'])) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
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
Tugas Anda adalah membaca gambar bukti transaksi keuangan Indonesia (struk belanja kasir, nota thermal, faktur resmi, nota tulis tangan/HTR, atau bukti transfer mobile banking BCA/Mandiri/BRI/BNI/flip/BI-FAST) secara presisi tinggi.

PANDUAN EKSTRAKSI ANGKA INDONESIA:
1. Pemisah ribuan di Indonesia menggunakan tanda titik (contoh: 50.000) atau koma jika format internasional.
2. Nominal bukti transfer sering menyertakan sen .00 (contoh: 2.500.000,00 atau 2,500,000.00). JANGAN menganggap dua nol desimal sebagai angka ratusan ribu!
3. Tulisan tangan sering menggunakan notasi '10,-' (artinya 10.000 jika dalam konteks ribuan) atau '10k' / '10rb'.
4. Pisahkan subtotal, pajak (PB1/PPN), diskon, biaya kirim (ongkir), total bayar, dan kembalian secara terpisah.
5. DILARANG membuat nominal fiktif. Jika teks angka buram/hilang, beri confidence rendah (20-40) dan gunakan angka tertera apa adanya.

PANDUAN KHUSUS BUKTI TRANSFER BANK (BCA, Mandiri, BRI, BNI, BI-FAST, flip, dll):
1. Identifikasi secara terpisah antara:
   - "transfer_amount": Nominal uang yang dikirimkan ke penerima (contoh: Rp 2.850.000 untuk transaksi Brevet Pajak CPTT).
   - "bank_admin_fee": Biaya transaksi/administrasi bank/BI-FAST yang tertera (contoh: Rp 2.500 atau Rp 6.500).
   - "fee_type": 'BI_FAST' jika tertulis BI-FAST, 'ADMIN_BANK' jika biaya transfer bank umum, 'FREE' jika tertera Rp 0 / Gratis / Bebas Biaya, atau 'NONE' jika bukan transfer bank.
   - "fee_text_evidence": Kutipan teks persis dari struk yang membuktikan biaya (contoh: "Biaya Transaksi: Rp 2.500" atau "Biaya Admin: Rp 0 (Bebas Biaya)").
   - "total_debited_amount": Total dana terdebit dari rekening pengirim (transfer_amount + bank_admin_fee, contoh: Rp 2.852.500).
2. DILARANG KERAS MENGARANG BIAYA (ANTI-FABRICATION):
   - DILARANG mengasumsikan/menebak biaya (misal mengisi 2500 atau 6500) semata-mata karena ada tulisan 'BI-FAST' atau 'Transfer'.
   - Jika bukti transfer menyebutkan BI-FAST atau Transfer namun nominal biaya tidak tertulis, terpotong, atau buram:
     Isi "bank_admin_fee": 0, "has_unconfirmed_fee": true, dan "unconfirmed_fee_note": "Biaya transfer/BI-FAST terindikasi pada struk namun nominal tidak terbaca jelas."
   - Jika biaya jelas tertera Rp 0, 0,00, Gratis, atau Bebas Biaya:
     Isi "bank_admin_fee": 0, "fee_type": "FREE", "fee_text_evidence": "Gratis/Rp 0", "has_unconfirmed_fee": false.
3. Struktur Baris Item & Anti-Double-Count:
   - Untuk transfer bank, "extracted_items" HARUS memuat:
     a) Item pokok transaksi (nama jasa/barang/keperluan transfer, contoh "Brevet Pajak CPTT - PT Piranha") dengan unit_price & total_price = transfer_amount (contoh 2.850.000), is_tax_or_fee: false.
     b) Item biaya bank (jika bank_admin_fee > 0): nama "Biaya Transfer BI-FAST" atau "Biaya Administrasi Bank" dengan total_price = bank_admin_fee (contoh 2.500), is_tax_or_fee: true, tax_or_fee_type: "BI_FAST" atau "ADMIN_BANK".
   - "declared_grand_total" = total_debited_amount (contoh 2.852.500).
   - JANGAN menjumlahkan biaya bank dua kali ke dalam item pokok!

WAJIB MENGEMBALIKAN HANYA JSON DENGAN STRUKTUR BERIKUT:
{
  "detected_type": "nota_pembelian" | "transfer_bank" | "faktur" | "struk_thermal" | "lainnya",
  "seller_or_recipient": "Nama Toko / Penerima / Rekanan",
  "transaction_date": "YYYY-MM-DD",
  "subtotal": 0,
  "tax_amount": 0,
  "discount_amount": 0,
  "shipping_fee": 0,
  "bank_transfer_details": {
    "transfer_amount": 0,
    "bank_admin_fee": 0,
    "fee_type": "BI_FAST" | "ADMIN_BANK" | "FREE" | "NONE",
    "fee_text_evidence": "",
    "total_debited_amount": 0,
    "has_unconfirmed_fee": false,
    "unconfirmed_fee_note": ""
  },
  "declared_grand_total": 0,
  "payment_amount": 0,
  "change_amount": 0,
  "extracted_items": [
    {
      "name": "Nama barang atau jasa",
      "quantity": 1,
      "unit": "transaksi",
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

  // 8. Normalisasi extracted_items & Bank Transfer Details
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

  // Ekstrak bank_transfer_details jika dokumen adalah transfer bank atau field tersedia
  let bankDetails: BankTransferDetails | undefined = undefined;
  const rawBtd = parsed.bank_transfer_details;
  const isTransferBankType = parsed.detected_type === 'transfer_bank' || Boolean(rawBtd);

  if (rawBtd && typeof rawBtd === 'object') {
    const transferAmt = sanitizeCurrencyAmount(rawBtd.transfer_amount, 'Transfer Amount');
    const adminFee = sanitizeCurrencyAmount(rawBtd.bank_admin_fee, 'Bank Admin Fee');
    let totalDebited = sanitizeCurrencyAmount(rawBtd.total_debited_amount, 'Total Debited');
    if (totalDebited === 0 && transferAmt > 0) {
      totalDebited = transferAmt + adminFee;
    }
    const hasUnconfirmed = Boolean(rawBtd.has_unconfirmed_fee);
    const feeType = rawBtd.fee_type === 'BI_FAST' ? 'BI_FAST'
      : rawBtd.fee_type === 'ADMIN_BANK' ? 'ADMIN_BANK'
      : rawBtd.fee_type === 'FREE' ? 'FREE'
      : 'NONE';

    bankDetails = {
      transferAmount: transferAmt,
      bankAdminFee: adminFee,
      feeType,
      feeTextEvidence: String(rawBtd.fee_text_evidence || '').trim(),
      totalDebitedAmount: totalDebited,
      hasUnconfirmedFee: hasUnconfirmed,
      unconfirmedFeeNote: rawBtd.unconfirmed_fee_note ? String(rawBtd.unconfirmed_fee_note).trim() : undefined
    };
  }

  const items: ExtractedItem[] = rawItems.filter(Boolean).map((it: any, idx: number) => {
    const itemName = String(it.name || it.item_name || `Item ${idx + 1}`).trim();
    const sanitizedTotal = sanitizeCurrencyAmount(it.total_price ?? it.total ?? it.subtotal, itemName);
    const sanitizedUnit = it.unit_price !== null && it.unit_price !== undefined
      ? sanitizeCurrencyAmount(it.unit_price, itemName)
      : null;

    let conf = 50;
    if (it.confidence !== null && it.confidence !== undefined && !isNaN(Number(it.confidence))) {
      conf = Math.max(10, Math.min(100, Math.round(Number(it.confidence))));
    } else if (sanitizedTotal > 0 && itemName.length > 2) {
      conf = 75; // Nilai wajar moderat untuk item lengkap
    }

    const lowerName = itemName.toLowerCase();
    const isBankFee = lowerName.includes('bi-fast') || lowerName.includes('bi fast') ||
                      lowerName.includes('admin bank') || lowerName.includes('administrasi bank') ||
                      (lowerName.includes('biaya') && (lowerName.includes('transfer') || lowerName.includes('admin')));
    const isFeeOrTax = Boolean(it.is_tax_or_fee) || isBankFee;

    let resolvedFeeType = it.tax_or_fee_type;
    if (isBankFee && !resolvedFeeType) {
      resolvedFeeType = (lowerName.includes('bi-fast') || lowerName.includes('bi fast')) ? 'BI_FAST' : 'ADMIN_BANK';
    }

    return {
      id: `it-groq-${Date.now()}-${idx}`,
      name: itemName,
      unitPrice: sanitizedUnit,
      quantity: it.quantity !== null && it.quantity !== undefined && !isNaN(Number(it.quantity)) ? Number(it.quantity) : null,
      unit: String(it.unit || (isFeeOrTax ? '' : 'transaksi')).trim(),
      totalPrice: sanitizedTotal,
      confidence: conf,
      isTaxOrFee: isFeeOrTax,
      taxOrFeeType: resolvedFeeType || undefined
    };
  });

  // Jika bankDetails memiliki biaya admin > 0 dan belum muncul di items, tambahkan sebagai baris terpisah
  if (bankDetails && bankDetails.bankAdminFee > 0) {
    const feeAlreadyInItems = items.some(it =>
      it.taxOrFeeType === 'BI_FAST' ||
      it.taxOrFeeType === 'ADMIN_BANK' ||
      it.name.toLowerCase().includes('bi-fast') ||
      it.name.toLowerCase().includes('admin bank') ||
      it.name.toLowerCase().includes('biaya transfer')
    );

    if (!feeAlreadyInItems) {
      items.push({
        id: `it-groq-fee-${Date.now()}`,
        name: bankDetails.feeType === 'BI_FAST' ? 'Biaya Transfer BI-FAST' : 'Biaya Administrasi Bank',
        unitPrice: null,
        quantity: null,
        unit: '',
        totalPrice: bankDetails.bankAdminFee,
        confidence: 95,
        isTaxOrFee: true,
        taxOrFeeType: bankDetails.feeType === 'BI_FAST' ? 'BI_FAST' : 'ADMIN_BANK'
      });
    }

    // Perlindungan Anti-Double-Count:
    // Jika hanya terdapat 1 item pokok non-fee dan nominalnya sama dengan totalDebitedAmount,
    // turunkan nominal item pokok ke transferAmount agar biaya tidak terhitung dua kali.
    const nonFeeItems = items.filter(it => !it.isTaxOrFee && it.taxOrFeeType !== 'BI_FAST' && it.taxOrFeeType !== 'ADMIN_BANK');
    if (nonFeeItems.length === 1 && bankDetails.transferAmount > 0) {
      const mainIt = nonFeeItems[0];
      if (mainIt.totalPrice === bankDetails.totalDebitedAmount) {
        mainIt.totalPrice = bankDetails.transferAmount;
        if (mainIt.unitPrice === bankDetails.totalDebitedAmount) {
          mainIt.unitPrice = bankDetails.transferAmount;
        }
      }
    }
  }

  let declaredGrand = sanitizeCurrencyAmount(
    parsed.declared_grand_total ?? parsed.grand_total ?? parsed.total_amount ?? parsed.total,
    userDescription
  );

  // Jika bukti transfer bank, declared grand total yang mewakili pengeluaran kas adalah total dana terdebit
  if (bankDetails && bankDetails.totalDebitedAmount > 0 && (declaredGrand === 0 || declaredGrand === bankDetails.transferAmount)) {
    declaredGrand = bankDetails.totalDebitedAmount;
  }

  // 9. Jalankan Verifikasi Deterministik Dua Arah (Horizontal & Vertikal)
  const verification = runTwoWayDeterministicVerification(items, declaredGrand);

  const extractionResult: RealOcrExtractionResult = {
    detectedType: parsed.detected_type || (isTransferBankType ? 'transfer_bank' : 'nota_pembelian'),
    sellerOrRecipient: parsed.seller_or_recipient || userDescription || 'Toko / Rekanan',
    transactionDate: parsed.transaction_date,
    extractedItems: verification.verifiedItems,
    declaredGrandTotal: verification.grandTotal,
    calculatedSum: verification.calculatedSum,
    mathDiscrepancy: verification.mathDiscrepancy,
    discrepancyMessage: verification.discrepancyMessage,
    sourceEngine: 'groq_vision',
    rawResponse: parsed,
    bankTransferDetails: bankDetails,
    hasUnconfirmedFee: bankDetails?.hasUnconfirmedFee,
    unconfirmedFeeNote: bankDetails?.unconfirmedFeeNote
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
