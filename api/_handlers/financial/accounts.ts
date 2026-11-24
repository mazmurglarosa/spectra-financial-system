import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';
import { mapDbAccountToAccount, mapAccountToDb } from '../../_lib/accountingMapper.js';

/**
 * /api/financial/accounts
 * CRUD Akun (Chart of Accounts):
 * GET: Ambil daftar akun
 * POST: Simpan / perbarui akun (mendukung single atau array)
 * DELETE: Hapus akun berdasarkan ID (wajib role admin)
 */
export default async function handler(req: any, res: any) {
  const method = req.method?.toUpperCase();

  // 1. GET: Ambil Akun
  if (method === 'GET') {
    const auth = await authenticateFinancialRequest(req, res);
    if (!auth) return;

    const { supabase } = auth;
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('code', { ascending: true });

      if (error) throw new Error(error.message);

      const accounts = (data || []).map(mapDbAccountToAccount);
      return res.status(200).json({ success: true, accounts });
    } catch (err: any) {
      console.error('[GetAccountsError]', err?.message);
      return res.status(500).json({ success: false, error: 'Gagal mengambil data akun.' });
    }
  }

  // 2. POST: Simpan / Upsert Akun
  if (method === 'POST') {
    const auth = await authenticateFinancialRequest(req, res, { requireAuthority: true });
    if (!auth) return;

    const { supabase, dbUser } = auth;
    const body = req.body;

    const accountsInput = Array.isArray(body) ? body : (body.accounts ? body.accounts : [body]);
    if (accountsInput.length === 0) {
      return res.status(400).json({ success: false, error: 'Data akun tidak boleh kosong.' });
    }

    try {
      const rows = accountsInput.map(mapAccountToDb);

      const { error: upsertErr } = await supabase.from('accounts').upsert(rows, { onConflict: 'id' });
      if (upsertErr) throw new Error(upsertErr.message);

      // Audit Log
      await supabase.from('activity_logs').insert({
        id: `log-acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Perubahan Akun',
        detail: `Menyimpan ${rows.length} akun (misal: ${rows[0].code} - ${rows[0].name})`
      });

      return res.status(200).json({
        success: true,
        message: `Berhasil menyimpan ${rows.length} akun.`,
        accounts: rows.map(mapDbAccountToAccount)
      });
    } catch (err: any) {
      console.error('[PostAccError]', err?.message);
      return res.status(500).json({ success: false, error: `Gagal menyimpan akun: ${err.message}` });
    }
  }

  // 3. DELETE: Hapus Akun Berdasarkan ID
  if (method === 'DELETE') {
    const auth = await authenticateFinancialRequest(req, res, { requireAdmin: true });
    if (!auth) return;

    const { supabase, dbUser } = auth;
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Parameter ID akun wajib disertakan.' });
    }

    try {
      const { error: delErr } = await supabase.from('accounts').delete().eq('id', id);
      if (delErr) throw new Error(delErr.message);

      // Audit Log
      await supabase.from('activity_logs').insert({
        id: `log-del-acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Penghapusan Akun',
        detail: `Menghapus akun ID: ${id}`
      });

      return res.status(200).json({ success: true, message: `Akun ${id} berhasil dihapus.` });
    } catch (err: any) {
      console.error('[DelAccError]', err?.message);
      return res.status(500).json({ success: false, error: 'Gagal menghapus akun dari database.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
