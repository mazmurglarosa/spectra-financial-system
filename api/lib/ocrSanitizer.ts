/**
 * Utilitas Sanitasi Mata Uang & Verifikasi Deterministik Dua Arah
 * Khusus Bukti Transaksi, Struk Thermal, Nota Tulis Tangan, & Bukti Transfer Bank Indonesia.
 * 
 * ATURAN INTEGRITAS AKUNTANSI SPECTRA:
 * 1. DILARANG mengoreksi nominal OCR secara diam-diam (silent mutation).
 * 2. Selalu kembalikan nilai terbaca apa adanya.
 * 3. Jika ditemukan kejanggalan matematis atau indikasi inflasi sen (.00),
 *    tandai `hasDiscrepancy: true` dan berikan pesan saran (suggestion) yang eksplisit
 *    pada `discrepancyNote` agar pengguna dapat memvalidasi manual di Tabel Koreksi Tahap 2.
 */

export interface ExtractedItem {
  id: string;
  name: string;
  unitPrice: number | null;
  quantity: number | null;
  unit?: string;
  totalPrice: number;
  confidence: number;
  isTaxOrFee?: boolean;
  taxOrFeeType?: 'PB1' | 'PPN' | 'SERVICE' | 'ONGKIR' | 'OTHER' | 'BI_FAST' | 'ADMIN_BANK';
  hasDiscrepancy?: boolean;
  discrepancyNote?: string;
  suggestedCorrection?: {
    unitPrice?: number;
    quantity?: number;
    totalPrice?: number;
    reason: string;
  };
}

export interface RealOcrExtractionResult {
  detectedType: 'transfer_bank' | 'nota_pembelian' | 'faktur' | 'struk_thermal' | 'lainnya';
  sellerOrRecipient: string;
  transactionDate?: string;
  extractedItems: ExtractedItem[];
  declaredGrandTotal: number;
  calculatedSum: number;
  mathDiscrepancy: boolean;
  discrepancyMessage?: string;
  sourceEngine: 'groq_vision' | 'gemini_vision' | 'tesseract_ocr' | 'smart_parser';
  rawResponse?: any;
}

/**
 * Parsing teks nominal mata uang Indonesia (angka, ribuan, k/rb, sen .00 / ,00)
 */
export function parseIndonesianCurrency(text: string | number, isLikelyThousands = false): number {
  if (typeof text === 'number') {
    if (isNaN(text)) return 0;
    return Math.round(text);
  }
  if (!text) return 0;

  let cleaned = String(text).trim();
  cleaned = cleaned.replace(/^(?:idr|rp\.?)\s*/i, '').trim();

  const lower = cleaned.toLowerCase();

  if (lower.endsWith('rb') || lower.endsWith('k') || lower.includes('ribu')) {
    const numPart = lower.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(numPart);
    if (!isNaN(val)) return Math.round(val * 1000);
  }

  if (lower.endsWith('jt') || lower.includes('juta')) {
    const numPart = lower.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(numPart);
    if (!isNaN(val)) return Math.round(val * 1000000);
  }

  cleaned = cleaned.replace(/[,.]-$/, '').trim();

  if (lower.includes(',-') || lower.includes('.-')) {
    const base = lower.replace(/[^\d]/g, '');
    const num = parseInt(base, 10);
    if (!isNaN(num)) {
      if (isLikelyThousands && num < 1000) {
        return num * 1000;
      }
      return num;
    }
  }

  // Tangani sen perbankan (.00 atau ,00)
  const decimalMatch = cleaned.match(/[.,](\d{1,2})$/);
  if (decimalMatch) {
    const decimalDigits = decimalMatch[1];
    const integerPartStr = cleaned.slice(0, cleaned.length - decimalMatch[0].length);
    const intDigitsOnly = integerPartStr.replace(/[^\d]/g, '');
    const intVal = parseInt(intDigitsOnly, 10) || 0;
    const decVal = parseFloat(`0.${decimalDigits}`) || 0;
    const finalVal = Math.round(intVal + decVal);
    if (isLikelyThousands && finalVal < 1000) {
      return finalVal * 1000;
    }
    return finalVal;
  }

  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  const parsed = parseInt(digitsOnly, 10);
  if (isNaN(parsed)) return 0;

  if (isLikelyThousands && parsed < 1000) {
    return parsed * 1000;
  }

  return parsed;
}

/**
 * Sanitasi nominal angka tanpa mengubah nilai secara diam-diam.
 * Mengembalikan nilai hasil parsing murni.
 */
export function sanitizeCurrencyAmount(val: number | string | null | undefined, _itemName = ''): number {
  if (val === null || val === undefined) return 0;
  return parseIndonesianCurrency(val);
}

/**
 * Verifikasi Formal Dua Arah (Uji Horizontal & Uji Vertikal):
 * 
 * 1. Uji Horizontal: Harga Satuan x Kuantitas == Total
 *    Jika tidak cocok: JANGAN ubah nilai secara diam-diam!
 *    Tetap gunakan nilai tertera, tandai `hasDiscrepancy: true`,
 *    dan sediakan saran nilai koreksi pada `discrepancyNote` & `suggestedCorrection`.
 * 
 * 2. Uji Vertikal: Sum(Baris Item) == Declared Grand Total
 *    Jika tidak cocok: set `mathDiscrepancy: true` dan kembalikan pesan peringatan.
 */
export function runTwoWayDeterministicVerification(
  items: ExtractedItem[],
  declaredGrandTotal?: number
): {
  verifiedItems: ExtractedItem[];
  grandTotal: number;
  calculatedSum: number;
  mathDiscrepancy: boolean;
  discrepancyMessage?: string;
} {
  const verifiedItems: ExtractedItem[] = items.map(item => {
    const { unitPrice, quantity, totalPrice, confidence } = item;
    const lowerName = item.name.toLowerCase();

    // Deteksi indikasi inflasi sen (.00) pada biaya admin / transfer bank (misal Rp 250.000 untuk BI-FAST)
    if (lowerName.includes('bi-fast') || lowerName.includes('admin bank') || lowerName.includes('transfer fee')) {
      if (totalPrice === 250000 || totalPrice === 650000) {
        const suggested = totalPrice === 250000 ? 2500 : 6500;
        return {
          ...item,
          confidence: Math.min(confidence, 65),
          hasDiscrepancy: true,
          discrepancyNote: `Nominal tertera Rp ${totalPrice.toLocaleString('id-ID')} dicurigai terinflasi dari sen (.00). Saran nilai: Rp ${suggested.toLocaleString('id-ID')}`,
          suggestedCorrection: {
            totalPrice: suggested,
            reason: 'Kemungkinan inflasi sen (.00) pada bukti transfer bank.'
          }
        };
      }
    }

    // 1. Uji Horizontal: Harga Satuan x Kuantitas = Total
    if (unitPrice !== null && quantity !== null && unitPrice > 0 && quantity > 0) {
      const expectedTotal = unitPrice * quantity;

      if (totalPrice > 0 && Math.abs(expectedTotal - totalPrice) > 1) {
        let suggestionText = '';
        let suggestedCorr: ExtractedItem['suggestedCorrection'] = undefined;

        if (totalPrice % unitPrice === 0) {
          const solvedQty = Math.round(totalPrice / unitPrice);
          suggestionText = `Saran kuantitas: ${solvedQty}`;
          suggestedCorr = { quantity: solvedQty, reason: `Total ${totalPrice.toLocaleString('id-ID')} / ${unitPrice.toLocaleString('id-ID')} = ${solvedQty}` };
        } else if (totalPrice % quantity === 0) {
          const solvedPrice = Math.round(totalPrice / quantity);
          suggestionText = `Saran harga satuan: Rp ${solvedPrice.toLocaleString('id-ID')}`;
          suggestedCorr = { unitPrice: solvedPrice, reason: `Total ${totalPrice.toLocaleString('id-ID')} / ${quantity} = ${solvedPrice.toLocaleString('id-ID')}` };
        } else {
          suggestionText = `Saran total: Rp ${expectedTotal.toLocaleString('id-ID')}`;
          suggestedCorr = { totalPrice: expectedTotal, reason: `Kuantitas ${quantity} x ${unitPrice.toLocaleString('id-ID')} = ${expectedTotal.toLocaleString('id-ID')}` };
        }

        // PERINGATAN INTEGRITAS: Pertahankan nilai asli terbaca, jangan ubah diam-diam!
        return {
          ...item,
          unitPrice,
          quantity,
          totalPrice,
          confidence: Math.min(confidence, 68),
          hasDiscrepancy: true,
          discrepancyNote: `Perkalian tidak cocok: ${unitPrice.toLocaleString('id-ID')} x ${quantity} = ${expectedTotal.toLocaleString('id-ID')} (tertera ${totalPrice.toLocaleString('id-ID')}). [${suggestionText}]`,
          suggestedCorrection: suggestedCorr
        };
      }

      // Jika totalPrice terbaca 0, lengkapi dengan expectedTotal
      if (totalPrice === 0) {
        return {
          ...item,
          totalPrice: expectedTotal,
          hasDiscrepancy: false
        };
      }
    } else if (totalPrice > 0 && quantity !== null && quantity > 0 && (unitPrice === null || unitPrice === 0)) {
      // Pulihkan unitPrice yang hilang tanpa kontradiksi
      return {
        ...item,
        unitPrice: Math.round(totalPrice / quantity),
        hasDiscrepancy: false
      };
    }

    return {
      ...item,
      hasDiscrepancy: false
    };
  });

  // 2. Uji Vertikal: Sum(Item) = Grand Total
  const calculatedSum = verifiedItems.reduce((sum, it) => sum + it.totalPrice, 0);
  const targetGrandTotal = declaredGrandTotal && declaredGrandTotal > 0 ? declaredGrandTotal : calculatedSum;

  let mathDiscrepancy = false;
  let discrepancyMessage: string | undefined = undefined;

  if (targetGrandTotal > 0 && calculatedSum > 0 && Math.abs(targetGrandTotal - calculatedSum) > 1) {
    mathDiscrepancy = true;
    discrepancyMessage = `Terdapat selisih matematis: Total tercantum pada dokumen (Rp ${targetGrandTotal.toLocaleString('id-ID')}) berbeda dengan penjumlahan rincian baris (Rp ${calculatedSum.toLocaleString('id-ID')}).`;
  }

  return {
    verifiedItems,
    grandTotal: targetGrandTotal,
    calculatedSum,
    mathDiscrepancy,
    discrepancyMessage
  };
}
