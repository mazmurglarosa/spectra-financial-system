import { authenticateFinancialRequest } from '../_lib/financialAuth.js';
import {
  mapAccountToDb,
  mapTransactionToDb,
  mapContactToDb,
  mapCompanySettingsToDb
} from '../_lib/accountingMapper.js';
import { validateTransactionStrict } from '../_lib/transactionValidator.js';

/**
 * POST /api/financial/sync-push
 * Mengunggah data pembukuan massal ke Supabase cloud melalui backend service role.
 * Wajib: Sesi aktif, CSRF valid, dan memiliki hak akses / otoritas keuangan.
 *
 * Menerapkan:
 * 1. Validasi transaksi terpusat untuk SETIAP transaksi yang dikirim (tidak boleh bypass).
 * 2. Pemetaan skema riil database PostgreSQL (tipe numerik, enum pos/sn, contact type, bigint timestamps).
 * 3. Proteksi mutlak anti-wipe (array kosong tidak menghapus data).
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
      const accountRows = payload.accounts.map(mapAccountToDb);

      const { error: accErr } = await supabase
        .from('accounts')
        .upsert(accountRows, { onConflict: 'id' });

      if (accErr) throw new Error(`Accounts upsert failed: ${accErr.message}`);
      counts.accounts = accountRows.length;
    }

    // 2. Upsert Transactions
    if (Array.isArray(payload.transactions)) {
      if (payload.transactions.length === 0) {
        // STRICT SECURITY: Array kosong TIDAK BOLEH menghapus seluruh data transaksi!
        console.info('[SyncPush] Array transaksi kosong diabaikan demi melindungi integritas data.');
      } else {
        // Fetch existing account codes for validation
        const { data: dbAccounts } = await supabase.from('accounts').select('code, id');
        const validCodes = new Set((dbAccounts || []).flatMap(a => [String(a.code).trim(), String(a.id).trim()]));

        const sanitizedTxRows: any[] = [];

        // Validasi ketat setiap transaksi individual
        for (let i = 0; i < payload.transactions.length; i++) {
          const rawTx = payload.transactions[i];
          const validation = await validateTransactionStrict(rawTx, supabase, {
            existingAccountCodes: validCodes
          });

          if (!validation.isValid || !validation.sanitizedTransaction) {
            return res.status(400).json({
              success: false,
              error: `Batch transaksi ditolak pada item #${i + 1} (${rawTx?.refNumber || 'tanpa no'}): ${validation.error}`
            });
          }

          sanitizedTxRows.push(mapTransactionToDb(validation.sanitizedTransaction));
        }

        const { error: txErr } = await supabase
          .from('transactions')
          .upsert(sanitizedTxRows, { onConflict: 'id' });

        if (txErr) throw new Error(`Transactions upsert failed: ${txErr.message}`);
        counts.transactions = sanitizedTxRows.length;
      }
    }

    // 3. Upsert Contacts
    if (Array.isArray(payload.contacts) && payload.contacts.length > 0) {
      const contactRows = payload.contacts.map(mapContactToDb);

      const { error: conErr } = await supabase
        .from('contacts')
        .upsert(contactRows, { onConflict: 'id' });

      if (conErr) throw new Error(`Contacts upsert failed: ${conErr.message}`);
      counts.contacts = contactRows.length;
    }

    // 4. Upsert Company Settings
    if (payload.settings && typeof payload.settings === 'object') {
      const settingsRow = mapCompanySettingsToDb(payload.settings);

      const { error: setErr } = await supabase
        .from('company_settings')
        .upsert(settingsRow, { onConflict: 'id' });

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
      error: `Gagal memperbarui data pembukuan ke cloud server: ${err.message}`
    });
  }
}
