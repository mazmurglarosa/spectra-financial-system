import { authenticateFinancialRequest } from '../_lib/financialAuth.js';
import { mapDbTransactionToTransaction, mapTransactionToDb } from '../_lib/accountingMapper.js';
import { validateTransactionStrict } from '../_lib/transactionValidator.js';

/**
 * /api/financial/transactions
 * CRUD Transaksi Keuangan:
 * GET: Ambil daftar transaksi (mendukung filter query ?id=...)
 * POST: Simpan / perbarui transaksi (wajib seimbang debit & kredit, akun valid)
 * DELETE: Hapus transaksi berdasarkan ID (wajib otorisasi keuangan)
 */
export default async function handler(req: any, res: any) {
  const method = req.method?.toUpperCase();

  // 1. GET: Ambil Transaksi
  if (method === 'GET') {
    const auth = await authenticateFinancialRequest(req, res);
    if (!auth) return;

    const { supabase } = auth;
    const { id } = req.query;

    try {
      if (id && typeof id === 'string') {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan.' });

        return res.status(200).json({ success: true, transaction: mapDbTransactionToTransaction(data) });
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw new Error(error.message);

      const transactions = (data || []).map(mapDbTransactionToTransaction);
      return res.status(200).json({ success: true, transactions });
    } catch (err: any) {
      console.error('[GetTransactionsError]', err?.message);
      return res.status(500).json({ success: false, error: 'Gagal mengambil data transaksi.' });
    }
  }

  // 2. POST: Simpan / Upsert Transaksi
  if (method === 'POST') {
    const auth = await authenticateFinancialRequest(req, res, { requireAuthority: true });
    if (!auth) return;

    const { supabase, dbUser } = auth;
    const rawTx = req.body;

    // VALIDASI TERPUSAT: Struktur, Akun, Nilai Finite/Positif, Keseimbangan SAK
    const validation = await validateTransactionStrict(rawTx, supabase, { checkAccountExistence: true });
    if (!validation.isValid || !validation.sanitizedTransaction) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Validasi transaksi gagal.'
      });
    }

    const sanitizedTx = validation.sanitizedTransaction;

    try {
      const dbRow = mapTransactionToDb(sanitizedTx);

      // Verifikasi Idempotency & Mencegah Overwrite Siluman
      const { data: existingTx, error: checkErr } = await supabase
        .from('transactions')
        .select('id, ref_number, total_debit, total_credit, lines')
        .eq('id', dbRow.id)
        .maybeSingle();

      if (checkErr) {
        throw new Error(`Gagal memverifikasi keunikan transaksi: ${checkErr.message}`);
      }

      if (existingTx) {
        // Cek apakah ini retry yang identik (safe idempotent retry)
        const isIdentical =
          existingTx.ref_number === dbRow.ref_number &&
          Math.abs(Number(existingTx.total_debit) - Number(dbRow.total_debit)) < 0.001 &&
          Math.abs(Number(existingTx.total_credit) - Number(dbRow.total_credit)) < 0.001;

        if (isIdentical) {
          return res.status(200).json({
            success: true,
            message: `Transaksi ${dbRow.ref_number} telah tersimpan sebelumnya (Idempotent OK).`,
            transaction: sanitizedTx,
            isIdempotentRetry: true
          });
        }

        // Jika rincian berbeda dan bukan update eksplisit, tolak demi mencegah mutasi tidak sah
        const isExplicitUpdate = req.body?.isUpdate === true || req.query?.isUpdate === 'true';
        if (!isExplicitUpdate) {
          return res.status(409).json({
            success: false,
            error: `Konflik idempotensi: Transaksi dengan ID "${dbRow.id}" sudah ada di database dengan rincian berbeda. Gunakan parameter pembaruan terotorisasi (isUpdate) jika ingin mengubah data.`
          });
        }
      }

      const { error: upsertErr } = await supabase
        .from('transactions')
        .upsert(dbRow, { onConflict: 'id' });

      if (upsertErr) throw new Error(upsertErr.message);

      // Audit Log
      await supabase.from('activity_logs').insert({
        id: `log-tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Posting Transaksi',
        detail: `Menyimpan transaksi ${dbRow.ref_number}: Rp ${sanitizedTx.totalDebit.toLocaleString('id-ID')} (${dbRow.description})`
      });

      return res.status(200).json({
        success: true,
        message: `Transaksi ${dbRow.ref_number} berhasil disimpan secara seimbang.`,
        transaction: sanitizedTx
      });
    } catch (err: any) {
      console.error('[PostTransactionError]', err?.message);
      return res.status(500).json({ success: false, error: `Gagal menyimpan transaksi ke database: ${err.message}` });
    }
  }

  // 3. DELETE: Hapus Transaksi Berdasarkan ID
  if (method === 'DELETE') {
    const auth = await authenticateFinancialRequest(req, res, { requireAuthority: true });
    if (!auth) return;

    const { supabase, dbUser } = auth;
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Parameter ID transaksi wajib disertakan.' });
    }

    try {
      const { error: delErr } = await supabase.from('transactions').delete().eq('id', id);
      if (delErr) throw new Error(delErr.message);

      // Audit Log
      await supabase.from('activity_logs').insert({
        id: `log-del-tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Penghapusan Transaksi',
        detail: `Menghapus transaksi ID: ${id}`
      });

      return res.status(200).json({ success: true, message: `Transaksi ${id} berhasil dihapus.` });
    } catch (err: any) {
      console.error('[DelTransactionError]', err?.message);
      return res.status(500).json({ success: false, error: 'Gagal menghapus transaksi dari database.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
