import { authenticateFinancialRequest } from '../_lib/financialAuth.js';

/**
 * /api/financial/transactions
 * CRUD Transaksi Keuangan:
 * GET: Ambil daftar transaksi
 * POST: Simpan / perbarui transaksi (wajib seimbang debit & kredit)
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

        return res.status(200).json({ success: true, transaction: data });
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true, transactions: data || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Gagal mengambil data transaksi.' });
    }
  }

  // 2. POST: Simpan / Upsert Transaksi
  if (method === 'POST') {
    const auth = await authenticateFinancialRequest(req, res, { requireAuthority: true });
    if (!auth) return;

    const { supabase, dbUser } = auth;
    const t = req.body;

    if (!t || !t.id || !t.refNumber || !t.date || !Array.isArray(t.lines)) {
      return res.status(400).json({
        success: false,
        error: 'Data transaksi tidak lengkap: id, date, refNumber, dan lines wajib diisi.'
      });
    }

    const totalDebit = Number(t.totalDebit) || 0;
    const totalCredit = Number(t.totalCredit) || 0;

    if (totalDebit <= 0 || totalCredit <= 0 || Math.abs(totalDebit - totalCredit) !== 0) {
      return res.status(400).json({
        success: false,
        error: 'Transaksi tidak seimbang atau bernilai 0. Total debit harus sama dengan total kredit.'
      });
    }

    try {
      const row = {
        id: String(t.id),
        date: String(t.date).slice(0, 10),
        ref_number: String(t.refNumber),
        type: String(t.type || 'general'),
        description: String(t.description || ''),
        lines: t.lines,
        total_debit: totalDebit,
        total_credit: totalCredit,
        partner: String(t.partner || '-'),
        created_at: t.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase.from('transactions').upsert(row, { onConflict: 'id' });
      if (upsertErr) throw new Error(upsertErr.message);

      // Audit Log
      await supabase.from('activity_logs').insert({
        id: `log-tx-${Date.now()}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Posting Transaksi',
        detail: `Menyimpan transaksi ${row.ref_number}: Rp ${totalDebit.toLocaleString('id-ID')} (${row.description})`
      });

      return res.status(200).json({ success: true, message: 'Transaksi berhasil disimpan.', id: row.id });
    } catch (err: any) {
      console.error('[PostTxError]', err?.message);
      return res.status(500).json({ success: false, error: 'Gagal menyimpan transaksi ke database.' });
    }
  }

  // 3. DELETE: Hapus Transaksi Berdasarkan ID
  if (method === 'DELETE') {
    const auth = await authenticateFinancialRequest(req, res, { requireAuthority: true });
    if (!auth) return;

    const { supabase, dbUser } = auth;
    const { id, all } = req.query;

    if (all === 'true') {
      // STRICT SECURITY: Penghapusan massal lewat endpoint API publik DITOLAK
      return res.status(403).json({
        success: false,
        error: 'Operasi penghapusan massal seluruh transaksi diblokir demi keamanan data keuangan.'
      });
    }

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Parameter ID transaksi wajib disertakan.' });
    }

    try {
      const { error: delErr } = await supabase.from('transactions').delete().eq('id', id);
      if (delErr) throw new Error(delErr.message);

      // Audit Log
      await supabase.from('activity_logs').insert({
        id: `log-txdel-${Date.now()}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Hapus Transaksi',
        detail: `Menghapus transaksi ID ${id}`
      });

      return res.status(200).json({ success: true, message: `Transaksi ${id} berhasil dihapus.` });
    } catch (err: any) {
      console.error('[DelTxError]', err?.message);
      return res.status(500).json({ success: false, error: 'Gagal menghapus transaksi dari database.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
