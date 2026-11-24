import { authenticateFinancialRequest } from '../_lib/financialAuth.js';

/**
 * POST /api/financial/sync-push
 * Mengunggah data pembukuan massal ke Supabase cloud melalui backend service role.
 * Wajib: Sesi aktif, CSRF valid, dan memiliki hak akses / otoritas keuangan.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const auth = await authenticateFinancialRequest(req, res, {
    requireAuthority: true // Wajib memiliki hak otorisasi keuangan atau admin
  });
  if (!auth) return;

  const { supabase, dbUser } = auth;
  const payload = req.body || {};

  try {
    const counts = {
      accounts: 0,
      transactions: 0,
      contacts: 0,
      settings: false
    };

    // 1. Upsert Accounts
    if (Array.isArray(payload.accounts) && payload.accounts.length > 0) {
      const rows = payload.accounts.map((a: any) => ({
        id: String(a.id || a.code),
        code: String(a.code || '').trim(),
        name: String(a.name || '').trim(),
        category: String(a.category || ''),
        normal_balance: a.normalBalance === 'Kredit' ? 'Kredit' : 'Debit',
        report_type: a.reportType === 'Laba Rugi' ? 'Laba Rugi' : 'Neraca',
        initial_debit: Number(a.initialDebit) || 0,
        initial_credit: Number(a.initialCredit) || 0,
        current_debit: Number(a.currentDebit) || 0,
        current_credit: Number(a.currentCredit) || 0,
        balance: Number(a.balance) || 0,
        is_system: Boolean(a.isSystem),
        description: a.description || ''
      }));

      const { error: accErr } = await supabase.from('accounts').upsert(rows, { onConflict: 'id' });
      if (accErr) throw new Error(`Accounts upsert failed: ${accErr.message}`);
      counts.accounts = rows.length;
    }

    // 2. Upsert Transactions
    if (Array.isArray(payload.transactions)) {
      if (payload.transactions.length === 0) {
        // STRICT SECURITY: Array kosong TIDAK BOLEH menghapus seluruh data transaksi!
        console.info('[SyncPush] Array transaksi kosong diabaikan demi melindungi integritas data.');
      } else {
        const txRows = payload.transactions.map((t: any) => ({
          id: String(t.id),
          date: String(t.date || '').slice(0, 10),
          ref_number: String(t.refNumber || ''),
          type: String(t.type || 'general'),
          description: String(t.description || ''),
          lines: Array.isArray(t.lines) ? t.lines : [],
          total_debit: Number(t.totalDebit) || 0,
          total_credit: Number(t.totalCredit) || 0,
          partner: String(t.partner || '-'),
          created_at: t.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: txErr } = await supabase.from('transactions').upsert(txRows, { onConflict: 'id' });
        if (txErr) throw new Error(`Transactions upsert failed: ${txErr.message}`);
        counts.transactions = txRows.length;
      }
    }

    // 3. Upsert Contacts
    if (Array.isArray(payload.contacts) && payload.contacts.length > 0) {
      const contactRows = payload.contacts.map((c: any) => ({
        id: String(c.id || c.code),
        code: String(c.code || '').trim(),
        name: String(c.name || '').trim(),
        type: String(c.type || 'Customer'),
        phone: String(c.phone || ''),
        balance: Number(c.balance) || 0
      }));

      const { error: conErr } = await supabase.from('contacts').upsert(contactRows, { onConflict: 'id' });
      if (conErr) throw new Error(`Contacts upsert failed: ${conErr.message}`);
      counts.contacts = contactRows.length;
    }

    // 4. Upsert Company Settings
    if (payload.settings && typeof payload.settings === 'object') {
      const s = payload.settings;
      const { error: setErr } = await supabase.from('company_settings').upsert({
        id: 'primary',
        company_name: String(s.companyName || ''),
        business_type: String(s.businessType || ''),
        fiscal_period: String(s.fiscalPeriod || ''),
        fiscal_year: String(s.fiscalYear || ''),
        currency: String(s.currency || 'IDR'),
        tax_rate_percent: Number(s.taxRatePercent) || 11,
        address: String(s.address || ''),
        phone: String(s.phone || ''),
        email: String(s.email || ''),
        director_name: String(s.directorName || ''),
        director_title: String(s.directorTitle || 'Direktur Utama'),
        accountant_name: String(s.accountantName || ''),
        accountant_title: String(s.accountantTitle || 'Direktur Keuangan'),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (setErr) throw new Error(`Settings upsert failed: ${setErr.message}`);
      counts.settings = true;
    }

    // 5. Catat Audit Log
    try {
      await supabase.from('activity_logs').insert({
        id: `log-sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Sinkronisasi Cloud Terautentikasi',
        detail: `Berhasil sinkronisasi cloud: ${counts.accounts} akun, ${counts.transactions} transaksi, ${counts.contacts} kontak`
      });
    } catch (logErr) {
      console.warn('[SyncPush] Pencatatan activity log gagal:', logErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Sinkronisasi data pembukuan ke cloud berhasil diproses secara aman.',
      syncedAt: new Date().toISOString(),
      counts
    });
  } catch (err: any) {
    console.error('[SyncPushError]', err?.message);
    return res.status(500).json({
      success: false,
      error: 'Gagal memperbarui data pembukuan ke cloud server.'
    });
  }
}
