import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';
import {
  mapAccountToDb,
  mapTransactionToDb,
  mapContactToDb,
  mapCompanySettingsToDb,
  computeTransactionFingerprint
} from '../../_lib/accountingMapper.js';
import { validateTransactionStrict } from '../../_lib/transactionValidator.js';

/**
 * POST /api/financial/sync-push
 * Mengunggah data pembukuan massal ke Supabase cloud melalui backend service role.
 * Wajib: Sesi aktif, CSRF valid, dan memiliki hak akses / otoritas keuangan.
 *
 * Menerapkan:
 * 1. Validasi Pre-flight Penuh: Seluruh accounts, contacts, settings, dan transactions divalidasi
 *    terlebih dahulu di memori sebelum menyentuh database. Jika ada 1 yang cacat, seluruh batch DITOLAK (HTTP 400).
 * 2. Eksekusi Atomik All-or-Nothing via PostgreSQL RPC (`sync_push_atomic`).
 *    Kegagalan pada salah satu tahap akan me-rollback seluruh operasi tanpa meninggalkan data parsial.
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
    // =========================================================================
    // TAHAP 1: PRE-FLIGHT VALIDATION (SEBELUM MENYENTUH DATABASE)
    // =========================================================================

    // 1. Validasi Accounts
    const validatedAccountRows: any[] = [];
    const payloadAccountCodes = new Set<string>();

    if (Array.isArray(payload.accounts) && payload.accounts.length > 0) {
      for (let i = 0; i < payload.accounts.length; i++) {
        const acc = payload.accounts[i];
        if (!acc || typeof acc !== 'object') {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Akun #${i + 1} tidak valid atau bukan objek.`
          });
        }
        const id = String(acc.id || '').trim();
        const code = String(acc.code || '').trim();
        const name = String(acc.name || '').trim();
        const pos = String(acc.pos || 'Nrc');
        const sn = String(acc.sn || 'Db');

        if (!id || !code || !name) {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Akun #${i + 1} (${code || 'tanpa kode'}) wajib memiliki id, code, dan name.`
          });
        }

        if (pos !== 'Nrc' && pos !== 'Lr') {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Akun #${i + 1} (${code}) memiliki pos tidak valid: "${pos}". Wajib "Nrc" atau "Lr".`
          });
        }

        if (sn !== 'Db' && sn !== 'Kr') {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Akun #${i + 1} (${code}) memiliki saldo normal (sn) tidak valid: "${sn}". Wajib "Db" atau "Kr".`
          });
        }

        const debetAwal = Number(acc.debetAwal ?? acc.initialDebit ?? 0);
        const kreditAwal = Number(acc.kreditAwal ?? acc.initialCredit ?? 0);
        if (!Number.isFinite(debetAwal) || isNaN(debetAwal) || debetAwal < 0) {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Akun #${i + 1} (${code}) debetAwal tidak valid.`
          });
        }
        if (!Number.isFinite(kreditAwal) || isNaN(kreditAwal) || kreditAwal < 0) {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Akun #${i + 1} (${code}) kreditAwal tidak valid.`
          });
        }

        payloadAccountCodes.add(code);
        payloadAccountCodes.add(id);
        validatedAccountRows.push(mapAccountToDb(acc));
      }
    }

    // 2. Validasi Contacts
    const validatedContactRows: any[] = [];
    if (Array.isArray(payload.contacts) && payload.contacts.length > 0) {
      for (let i = 0; i < payload.contacts.length; i++) {
        const con = payload.contacts[i];
        if (!con || typeof con !== 'object') {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Kontak #${i + 1} tidak valid.`
          });
        }
        const id = String(con.id || '').trim();
        const name = String(con.name || '').trim();
        const typeRaw = String(con.type || '').trim().toLowerCase();

        if (!id || !name) {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Kontak #${i + 1} wajib memiliki id dan name.`
          });
        }

        if (typeRaw !== 'customer' && typeRaw !== 'vendor') {
          return res.status(400).json({
            success: false,
            error: `Batch ditolak: Kontak #${i + 1} (${name}) memiliki tipe tidak valid: "${con.type}". Wajib "customer" atau "vendor".`
          });
        }

        validatedContactRows.push(mapContactToDb(con));
      }
    }

    // 3. Validasi Settings
    let validatedSettingsRow: any = null;
    if (payload.settings && typeof payload.settings === 'object' && Object.keys(payload.settings).length > 0) {
      const s = payload.settings;
      const companyName = String(s.companyName || s.company_name || '').trim();
      const fiscalYear = Number(s.fiscalYear ?? s.fiscal_year);

      if (!companyName) {
        return res.status(400).json({
          success: false,
          error: 'Batch ditolak: Pengaturan perusahaan (settings) wajib memiliki nama perusahaan (companyName).'
        });
      }

      if (!Number.isInteger(fiscalYear) || fiscalYear < 1970 || fiscalYear > 2100) {
        return res.status(400).json({
          success: false,
          error: `Batch ditolak: Tahun fiskal (fiscalYear) tidak valid: ${fiscalYear}.`
        });
      }

      validatedSettingsRow = mapCompanySettingsToDb(s);
    }

    // 4. Validasi Transactions
    const validatedTxRows: any[] = [];
    if (Array.isArray(payload.transactions)) {
      if (payload.transactions.length === 0) {
        // STRICT SECURITY: Array kosong TIDAK BOLEH menghapus seluruh data transaksi!
        console.info('[SyncPush] Array transaksi kosong diabaikan demi melindungi integritas data.');
      } else {
        // Ambil daftar akun terdaftar di DB untuk pengecekan referensial fail-closed
        const { data: dbAccounts, error: accErr } = await supabase.from('accounts').select('code, id');
        if (accErr) {
          return res.status(500).json({
            success: false,
            error: `Gagal memverifikasi daftar akun untuk validasi transaksi: ${accErr.message} (Fail-Closed).`
          });
        }

        const validCodes = new Set([
          ...(dbAccounts || []).flatMap(a => [String(a.code).trim(), String(a.id).trim()]),
          ...Array.from(payloadAccountCodes)
        ]);

        for (let i = 0; i < payload.transactions.length; i++) {
          const rawTx = payload.transactions[i];
          const validation = await validateTransactionStrict(rawTx, supabase, {
            checkAccountExistence: true,
            existingAccountCodes: validCodes
          });

          if (!validation.isValid || !validation.sanitizedTransaction) {
            return res.status(400).json({
              success: false,
              error: `Batch transaksi ditolak pada item #${i + 1} (${rawTx?.refNumber || 'tanpa no'}): ${validation.error}`
            });
          }

          validatedTxRows.push(mapTransactionToDb(validation.sanitizedTransaction));
        }

        // Pengecekan Idempotensi Pre-flight Berbasis Canonical Fingerprint
        if (validatedTxRows.length > 0) {
          const txIds = validatedTxRows.map((r: any) => r.id);
          const { data: existingTxs, error: existErr } = await supabase
            .from('transactions')
            .select('*')
            .in('id', txIds);

          if (existErr) {
            return res.status(500).json({
              success: false,
              error: `Gagal memverifikasi keunikan transaksi: ${existErr.message}`
            });
          }

          if (existingTxs && existingTxs.length > 0) {
            const existingMap = new Map(existingTxs.map((t: any) => [String(t.id), t]));
            const isExplicitUpdate = payload?.isUpdate === true || req.body?.isUpdate === true || req.query?.isUpdate === 'true';

            for (const incomingRow of validatedTxRows) {
              const existing = existingMap.get(String(incomingRow.id));
              if (existing) {
                const existingFp = computeTransactionFingerprint(existing);
                const incomingFp = computeTransactionFingerprint(incomingRow);
                if (existingFp !== incomingFp && !isExplicitUpdate) {
                  return res.status(409).json({
                    success: false,
                    error: `Konflik idempotensi batch: Transaksi ID "${incomingRow.id}" (${incomingRow.ref_number}) sudah ada di database dengan rincian material berbeda (fingerprint mismatch). Gunakan parameter isUpdate=true jika bermaksud memperbarui data.`
                  });
                }
              }
            }
          }
        }
      }
    }

    // =========================================================================
    // TAHAP 2: EKSEKUSI DATABASE ATOMIK (ALL-OR-NOTHING VIA RPC)
    // =========================================================================

    const isExplicitUpdate = payload?.isUpdate === true || req.body?.isUpdate === true || req.query?.isUpdate === 'true';

    const { data: rpcResult, error: rpcError } = await supabase.rpc('sync_push_atomic', {
      p_accounts: validatedAccountRows.length > 0 ? validatedAccountRows : null,
      p_transactions: validatedTxRows.length > 0 ? validatedTxRows : null,
      p_contacts: validatedContactRows.length > 0 ? validatedContactRows : null,
      p_settings: validatedSettingsRow ? validatedSettingsRow : null,
      p_is_authorized_update: isExplicitUpdate
    });

    if (rpcError) {
      console.error('[SyncPushAtomicError]', rpcError.message);
      if (rpcError.code === '23505' || rpcError.message.includes('Konflik Idempotensi')) {
        return res.status(409).json({
          success: false,
          error: rpcError.message
        });
      }
      return res.status(500).json({
        success: false,
        error: `Operasi sinkronisasi atomik gagal dieksekusi dan di-rollback penuh: ${rpcError.message}`
      });
    }

    const counts = {
      accounts: validatedAccountRows.length,
      transactions: validatedTxRows.length,
      contacts: validatedContactRows.length,
      settings: !!validatedSettingsRow
    };

    // 5. Catat Audit Log
    try {
      await supabase.from('activity_logs').insert({
        id: `log-sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Sinkronisasi Cloud Atomik',
        detail: `Berhasil sinkronisasi atomik: ${counts.accounts} akun, ${counts.transactions} transaksi, ${counts.contacts} kontak`
      });
    } catch (logErr) {
      console.warn('[SyncPush] Pencatatan activity log gagal:', logErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Sinkronisasi data pembukuan ke cloud berhasil diproses secara atomik (All-or-Nothing).',
      syncedAt: new Date().toISOString(),
      counts,
      rpcResult
    });
  } catch (err: any) {
    console.error('[SyncPushError]', err?.message);
    return res.status(500).json({
      success: false,
      error: `Gagal memproses sinkronisasi pembukuan: ${err.message}`
    });
  }
}
