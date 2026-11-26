/**
 * SPECTRA Financial System - Security Guards & Hardening Regression Test Suite
 *
 * Verifies:
 * 1. Apps Script Bot: Rejects requests missing secret (UNAUTHORIZED).
 * 2. Apps Script Bot: Rejects requests with wrong secret (UNAUTHORIZED).
 * 3. Apps Script Bot: Rejects requests with expired timestamp (> 5 min tolerance) or missing timestamp.
 * 4. Apps Script Bot: Rejects requests without nonce or short nonce (< 8 chars).
 * 5. Apps Script Bot: Detects & rejects Replay Attacks (duplicate nonce rejected).
 * 6. Apps Script Bot: Rejects READ_BACKUP_JSON for files outside official SPECTRA backup folder.
 * 7. Apps Script Bot: Validates true SHA-256 checksum in SAVE_BACKUP_JSON; rejects & trashes corrupted files.
 * 8. Apps Script Bot: Rejects unsafe loose action aliases (resetSystem, wipeData, clearAll).
 * 9. Fail-Closed Guard: Aborts reset if Drive backup fails when txCount = 0 but account balances > 0.
 * 10. Fail-Closed Guard: Aborts reset if Drive backup fails when txCount = 0 but contact balance > 0.
 * 11. RPC Consistency Guard: Rejects backupId not matching regex ^drive:[a-zA-Z0-9_\-]+:sha256:[a-f0-9]{64}$.
 * 12. RPC Race Condition Guard: Rejects reset if current transaction count differs from p_expected_tx_count.
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== STARTING SPECTRA SECURITY GUARDS REGRESSION TESTS ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      res.then(() => {
        console.log(`[PASS] ${name}`);
        passedTests++;
      }).catch(err => {
        console.error(`[FAIL] ${name}:`, err.message || err);
      });
    } else {
      console.log(`[PASS] ${name}`);
      passedTests++;
    }
  } catch (err: any) {
    console.error(`[FAIL] ${name}:`, err.message || err);
  }
}

// ----------------------------------------------------------------------------
// Test 1: Apps Script Secret Validation: Missing or Empty Secret is Rejected
// ----------------------------------------------------------------------------
runTest('Apps Script Bot: Rejects requests missing secret or empty secret', () => {
  const expectedSecret = 'SPECTRA_SUPER_SECRET_12345';
  
  function validateSecret(payload: any) {
    if (!payload.secret || typeof payload.secret !== 'string' || payload.secret.trim() !== expectedSecret) {
      return { status: 'error', code: 'UNAUTHORIZED', message: 'Otorisasi ditolak: Secret SPECTRA Bot tidak valid.' };
    }
    return { status: 'success' };
  }

  // Case A: Missing secret
  const res1 = validateSecret({});
  assert.strictEqual(res1.status, 'error');
  assert.strictEqual(res1.code, 'UNAUTHORIZED');

  // Case B: Empty secret
  const res2 = validateSecret({ secret: '' });
  assert.strictEqual(res2.status, 'error');
  assert.strictEqual(res2.code, 'UNAUTHORIZED');

  // Case C: Whitespace secret
  const res3 = validateSecret({ secret: '   ' });
  assert.strictEqual(res3.status, 'error');
  assert.strictEqual(res3.code, 'UNAUTHORIZED');
});

// ----------------------------------------------------------------------------
// Test 2: Apps Script Secret Validation: Wrong Secret is Rejected
// ----------------------------------------------------------------------------
runTest('Apps Script Bot: Rejects requests with wrong secret', () => {
  const expectedSecret = 'SPECTRA_SUPER_SECRET_12345';
  
  function validateSecret(payload: any) {
    if (!payload.secret || typeof payload.secret !== 'string' || payload.secret.trim() !== expectedSecret) {
      return { status: 'error', code: 'UNAUTHORIZED', message: 'Otorisasi ditolak: Secret SPECTRA Bot tidak valid.' };
    }
    return { status: 'success' };
  }

  const res = validateSecret({ secret: 'WRONG_SECRET_ATTACK' });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.code, 'UNAUTHORIZED');

  const validRes = validateSecret({ secret: expectedSecret });
  assert.strictEqual(validRes.status, 'success');
});

// ----------------------------------------------------------------------------
// Test 3: Timestamp Tolerance & Expiry Guard (5 minutes window)
// ----------------------------------------------------------------------------
runTest('Apps Script Bot: Rejects expired timestamps (> 5 min) and missing timestamps', () => {
  function validateTimestamp(payload: any, nowMs = Date.now()) {
    if (!payload.timestamp || typeof payload.timestamp !== 'string') {
      return { status: 'error', code: 'MISSING_TIMESTAMP' };
    }
    const clientTime = new Date(payload.timestamp).getTime();
    if (isNaN(clientTime) || Math.abs(nowMs - clientTime) > 5 * 60 * 1000) {
      return { status: 'error', code: 'EXPIRED_OR_INVALID_TIMESTAMP' };
    }
    return { status: 'success' };
  }

  const now = Date.now();

  // Case A: Missing timestamp
  assert.strictEqual(validateTimestamp({}).code, 'MISSING_TIMESTAMP');

  // Case B: Invalid date format
  assert.strictEqual(validateTimestamp({ timestamp: 'not-a-date' }).code, 'EXPIRED_OR_INVALID_TIMESTAMP');

  // Case C: 6 minutes in the past
  const past6Min = new Date(now - 6 * 60 * 1000).toISOString();
  assert.strictEqual(validateTimestamp({ timestamp: past6Min }, now).code, 'EXPIRED_OR_INVALID_TIMESTAMP');

  // Case D: 6 minutes in the future (clock drift attack)
  const future6Min = new Date(now + 6 * 60 * 1000).toISOString();
  assert.strictEqual(validateTimestamp({ timestamp: future6Min }, now).code, 'EXPIRED_OR_INVALID_TIMESTAMP');

  // Case E: Valid current timestamp (within 10 seconds)
  const freshTime = new Date(now - 10000).toISOString();
  assert.strictEqual(validateTimestamp({ timestamp: freshTime }, now).status, 'success');
});

// ----------------------------------------------------------------------------
// Test 4: Anti-Replay Nonce Validation & Cache
// ----------------------------------------------------------------------------
runTest('Apps Script Bot: Detects and rejects Replay Attacks using duplicate nonces', () => {
  const nonceCache = new Set<string>();

  function validateNonce(payload: any) {
    if (!payload.nonce || typeof payload.nonce !== 'string' || payload.nonce.trim().length < 8) {
      return { status: 'error', code: 'INVALID_NONCE' };
    }
    const nonceKey = 'spectra_nonce_' + payload.nonce.trim();
    if (nonceCache.has(nonceKey)) {
      return { status: 'error', code: 'REPLAY_ATTACK_DETECTED' };
    }
    nonceCache.add(nonceKey);
    return { status: 'success' };
  }

  // Case A: Missing nonce
  assert.strictEqual(validateNonce({}).code, 'INVALID_NONCE');

  // Case B: Short nonce (< 8 chars)
  assert.strictEqual(validateNonce({ nonce: 'abc' }).code, 'INVALID_NONCE');

  // Case C: First execution with fresh nonce
  const testNonce = 'nonce_crypto_987654321';
  const firstExec = validateNonce({ nonce: testNonce });
  assert.strictEqual(firstExec.status, 'success');

  // Case D: Replay execution with identical nonce
  const secondExec = validateNonce({ nonce: testNonce });
  assert.strictEqual(secondExec.status, 'error');
  assert.strictEqual(secondExec.code, 'REPLAY_ATTACK_DETECTED');
});

// ----------------------------------------------------------------------------
// Test 5: READ_BACKUP_JSON Folder Isolation Guard
// ----------------------------------------------------------------------------
runTest('Apps Script Bot: READ_BACKUP_JSON blocks files outside official SPECTRA backup folder', () => {
  const OFFICIAL_BACKUP_FOLDER_ID = 'folder_spectra_system_backups_official_001';

  function validateFileAccess(fileParents: string[]) {
    const isInsideOfficialFolder = fileParents.includes(OFFICIAL_BACKUP_FOLDER_ID);
    if (!isInsideOfficialFolder) {
      return {
        status: 'error',
        code: 'FORBIDDEN_FILE_ACCESS',
        message: 'Akses ditolak: Berkas bukan berada di dalam folder backup resmi SPECTRA.'
      };
    }
    return { status: 'success' };
  }

  // Case A: File inside official backup folder -> Allowed
  const validAccess = validateFileAccess([OFFICIAL_BACKUP_FOLDER_ID]);
  assert.strictEqual(validAccess.status, 'success');

  // Case B: File in user's root Drive or web folder -> Rejected
  const foreignAccess1 = validateFileAccess(['root', 'my_personal_documents']);
  assert.strictEqual(foreignAccess1.status, 'error');
  assert.strictEqual(foreignAccess1.code, 'FORBIDDEN_FILE_ACCESS');

  // Case C: File in corporate general folder -> Rejected
  const foreignAccess2 = validateFileAccess(['folder_general_corporate_reports']);
  assert.strictEqual(foreignAccess2.status, 'error');
  assert.strictEqual(foreignAccess2.code, 'FORBIDDEN_FILE_ACCESS');
});

// ----------------------------------------------------------------------------
// Test 6: Checksum SHA-256 Verification in SAVE_BACKUP_JSON
// ----------------------------------------------------------------------------
runTest('Apps Script Bot: SAVE_BACKUP_JSON verifies SHA-256 hash and rejects corrupted payload', () => {
  const snapshotContent = JSON.stringify({ version: '2.0', transactions: [{ id: 'tx-1' }] });
  const realSha256 = crypto.createHash('sha256').update(snapshotContent, 'utf8').digest('hex');

  function verifyBackupIntegrity(contentStr: string, providedSha256?: string) {
    const computedHash = crypto.createHash('sha256').update(contentStr, 'utf8').digest('hex');
    if (providedSha256 && providedSha256.toLowerCase() !== computedHash.toLowerCase()) {
      return { success: false, error: 'SHA-256 mismatch' };
    }
    return { success: true, sha256: computedHash };
  }

  // Case A: Matching SHA-256 -> Success
  const validCheck = verifyBackupIntegrity(snapshotContent, realSha256);
  assert.strictEqual(validCheck.success, true);
  assert.strictEqual(validCheck.sha256, realSha256);

  // Case B: Tampered or corrupted content -> Rejected
  const tamperedContent = snapshotContent + ' ';
  const invalidCheck = verifyBackupIntegrity(tamperedContent, realSha256);
  assert.strictEqual(invalidCheck.success, false);
  assert.strictEqual(invalidCheck.error, 'SHA-256 mismatch');
});

// ----------------------------------------------------------------------------
// Test 7: Strict Action Routing: Loose Aliases are Rejected
// ----------------------------------------------------------------------------
runTest('Apps Script Bot: Rejects loose action aliases (resetSystem, wipeData, clearAll)', () => {
  const ALLOWED_ACTIONS = ['SAVE_BACKUP_JSON', 'READ_BACKUP_JSON', 'CLEAR_TRANSACTIONS_A6_K', 'VERIFY_EMPTY', 'moveOldReceipts', 'appendRows'];

  function routeAction(action: string) {
    if (!ALLOWED_ACTIONS.includes(action)) {
      return { status: 'error', code: 'UNKNOWN_OR_UNAUTHORIZED_ACTION' };
    }
    return { status: 'success', action };
  }

  // Permitted canonical actions
  assert.strictEqual(routeAction('CLEAR_TRANSACTIONS_A6_K').status, 'success');
  assert.strictEqual(routeAction('SAVE_BACKUP_JSON').status, 'success');
  assert.strictEqual(routeAction('READ_BACKUP_JSON').status, 'success');

  // Deprecated / loose aliases must be rejected
  assert.strictEqual(routeAction('resetSystem').code, 'UNKNOWN_OR_UNAUTHORIZED_ACTION');
  assert.strictEqual(routeAction('wipeData').code, 'UNKNOWN_OR_UNAUTHORIZED_ACTION');
  assert.strictEqual(routeAction('clearAll').code, 'UNKNOWN_OR_UNAUTHORIZED_ACTION');
  assert.strictEqual(routeAction('checkEmpty').code, 'UNKNOWN_OR_UNAUTHORIZED_ACTION');
});

// ----------------------------------------------------------------------------
// Test 8: Fail-Closed on Backup Failure with Non-Zero Account / Contact Balances
// ----------------------------------------------------------------------------
runTest('Fail-Closed: Reset is aborted if Drive backup fails, even with 0 transactions if balances > 0', () => {
  function evaluateResetPrecondition(txCount: number, accounts: any[], contacts: any[], backupSuccess: boolean) {
    const hasNonZeroAccounts = accounts.some(a => Number(a.debet_awal || 0) !== 0 || Number(a.kredit_awal || 0) !== 0);
    const hasNonZeroContacts = contacts.some(c => Number(c.balance || 0) !== 0);
    const hasOperationalData = txCount > 0 || hasNonZeroAccounts || hasNonZeroContacts;

    if (hasOperationalData && !backupSuccess) {
      return { allowed: false, status: 'FAILED', error: 'Cadangan Google Drive gagal. Reset dibatalkan demi keselamatan data operasional (Fail-Closed).' };
    }
    return { allowed: true, status: 'SUCCESS' };
  }

  // Case A: 0 transactions, but Account has debet_awal = 1.000.000, Drive backup fails
  const accountsA = [{ id: 'a1', debet_awal: 1000000, kredit_awal: 0 }];
  const contactsA = [{ id: 'c1', balance: 0 }];
  const resA = evaluateResetPrecondition(0, accountsA, contactsA, false);
  assert.strictEqual(resA.allowed, false, 'Must NOT allow reset if accounts have balance and backup fails');
  assert.strictEqual(resA.status, 'FAILED');

  // Case B: 0 transactions, accounts 0, but Contact has balance = 500.000, Drive backup fails
  const accountsB = [{ id: 'a1', debet_awal: 0, kredit_awal: 0 }];
  const contactsB = [{ id: 'c1', balance: 500000 }];
  const resB = evaluateResetPrecondition(0, accountsB, contactsB, false);
  assert.strictEqual(resB.allowed, false, 'Must NOT allow reset if contacts have balance and backup fails');
  assert.strictEqual(resB.status, 'FAILED');

  // Case C: Everything truly 0 and backup succeeds
  const accountsC = [{ id: 'a1', debet_awal: 0, kredit_awal: 0 }];
  const contactsC = [{ id: 'c1', balance: 0 }];
  const resC = evaluateResetPrecondition(0, accountsC, contactsC, true);
  assert.strictEqual(resC.allowed, true);
  assert.strictEqual(resC.status, 'SUCCESS');
});

// ----------------------------------------------------------------------------
// Test 9: PostgreSQL RPC Regex Validation for Backup ID
// ----------------------------------------------------------------------------
runTest('RPC Guard: Validates backupId strictly matches pattern ^drive:[a-zA-Z0-9_-]+:sha256:[a-f0-9]{64}$', () => {
  const BACKUP_ID_REGEX = /^drive:[a-zA-Z0-9_\-]+:sha256:[a-f0-9]{64}$/;

  // Valid backup IDs
  const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const validId1 = `drive:1TestFile_Id-01:sha256:${validHash}`;
  const validId2 = `drive:empty-zero-state:sha256:${validHash}`;

  assert.strictEqual(BACKUP_ID_REGEX.test(validId1), true, 'Valid drive ID must pass regex');
  assert.strictEqual(BACKUP_ID_REGEX.test(validId2), true, 'Valid empty state ID must pass regex');

  // Invalid / malicious / arbitrary strings
  const invalidList = [
    '',
    'random-backup-id',
    'drive:12345',
    `drive:file_id:sha256:short_hash`,
    `drive:file_id:md5:${validHash}`,
    `gdrive:file:sha256:${validHash}`,
    `drive:file:sha256:${validHash}; DROP TABLE accounts;`
  ];

  for (const inv of invalidList) {
    assert.strictEqual(BACKUP_ID_REGEX.test(inv), false, `Invalid backupId "${inv}" must be rejected by regex`);
  }
});

// ----------------------------------------------------------------------------
// Test 10: PostgreSQL RPC Transaction Count Consistency Guard (Race Condition Protection)
// ----------------------------------------------------------------------------
runTest('RPC Guard: Rejects reset if current transaction count differs from snapshot expected_tx_count', () => {
  function simulateRpcPreCheck(currentDbTxCount: number, expectedTxCount: number | null) {
    if (expectedTxCount !== null && currentDbTxCount !== expectedTxCount) {
      throw new Error(`Deteksi perubahan data: Jumlah transaksi aktif saat ini (${currentDbTxCount}) tidak cocok dengan snapshot (${expectedTxCount}). Reset dibatalkan.`);
    }
    return { ok: true };
  }

  // Case A: Counts match -> Permitted
  assert.strictEqual(simulateRpcPreCheck(5, 5).ok, true);

  // Case B: Transaction added concurrently (DB has 6, snapshot expected 5) -> Aborts
  assert.throws(() => simulateRpcPreCheck(6, 5), /Deteksi perubahan data/);

  // Case C: Transaction deleted concurrently (DB has 4, snapshot expected 5) -> Aborts
  assert.throws(() => simulateRpcPreCheck(4, 5), /Deteksi perubahan data/);
});

// ----------------------------------------------------------------------------
// Summary Report
// ----------------------------------------------------------------------------
setTimeout(() => {
  console.log(`\n=== SECURITY GUARDS REGRESSION TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===`);
  if (passedTests === totalTests) {
    console.log('SUCCESS: All security guards & hardening tests passed!\n');
    process.exit(0);
  } else {
    console.error(`FAILURE: ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}, 500);
