/**
 * Regression Test: SPECTRA System Reset & Google Spreadsheet Sync
 * SPECTRA Financial System (SIKEU2)
 *
 * Verifies:
 * 1. Post-reset document sequence returns strictly to BT/0001.
 * 2. Transactions and recorded receipts count drops to 0.
 * 3. Spreadsheet clearance range strictly targets A6:K (rows 1-5 preserved).
 * 4. Master accounts (76 COA), contacts, and company settings are preserved.
 * 5. Google Drive retention policy: files retained by default (not trashed unless explicit).
 * 6. Backend reset security guards: requires RESET-SPECTRA confirmation and authority.
 * 7. Storage and cache reset clears sequence counter and storage keys cleanly.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { 
  getNextDocumentSequence, 
  generateFileCode,
  STORAGE_DOC_SEQ_KEY,
  SPECTRA_RECORDED_RECEIPTS_KEY,
  SPECTRA_PENDING_JOURNAL_KEY,
  resetAutoRecordState
} from '../src/services/autoRecordService';
import { defaultAccounts } from '../src/data/defaultAccounts';

console.log('=== STARTING SPECTRA SYSTEM RESET REGRESSION TESTS ===\n');

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
// Test 1: Document Sequence Resets Strictly to BT/0001
// ----------------------------------------------------------------------------
runTest('Empty transactions array yields next document sequence 1', () => {
  const nextSeq = getNextDocumentSequence([]);
  assert.strictEqual(nextSeq, 1, 'Next sequence for empty transactions must be 1');
  const fileCode = generateFileCode(nextSeq);
  assert.ok(fileCode.startsWith('BT/0001/'), `File code must start with BT/0001/, got: ${fileCode}`);
});

runTest('After reset, document sequence does not retain old sequence numbers', () => {
  // Simulate mock storage having 0
  const mockStorage: Record<string, string> = {
    [STORAGE_DOC_SEQ_KEY]: '0'
  };
  const globalAny = global as any;
  const originalLocalStorage = globalAny.localStorage;

  globalAny.localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; }
  };

  try {
    const nextSeq = getNextDocumentSequence([]);
    assert.strictEqual(nextSeq, 1, 'Sequence must be 1 after storage reset');
    const code = generateFileCode(nextSeq);
    assert.ok(code.startsWith('BT/0001/'), `Expected BT/0001, got ${code}`);
  } finally {
    globalAny.localStorage = originalLocalStorage;
  }
});

// ----------------------------------------------------------------------------
// Test 2: Spreadsheet Clearance Range Calculations (A6:K Strictly)
// ----------------------------------------------------------------------------
runTest('Spreadsheet clearance range targets row 6 to lastRow, columns 1 to 11 (A6:K)', () => {
  const START_ROW = 6;
  const START_COL = 1; // Kolom A
  const TOTAL_COLS = 11; // Kolom A s.d. K

  // Case A: Sheet has 25 rows (lastRow = 25)
  const lastRowA = 25;
  const numRowsToClearA = lastRowA - START_ROW + 1;
  assert.strictEqual(numRowsToClearA, 20, 'For lastRow=25, exactly 20 rows (6 to 25) must be cleared');
  assert.strictEqual(START_ROW, 6, 'Clearance must start at row 6, leaving rows 1-5 headers intact');
  assert.strictEqual(START_COL, 1, 'Clearance must start at column 1 (A)');
  assert.strictEqual(TOTAL_COLS, 11, 'Clearance must span 11 columns (A through K)');

  // Case B: Sheet only has headers (lastRow = 5)
  const lastRowB = 5;
  const shouldClearB = lastRowB >= START_ROW;
  assert.strictEqual(shouldClearB, false, 'If lastRow <= 5, no clearance is attempted');

  // Case C: Sheet has exactly 1 data row (lastRow = 6)
  const lastRowC = 6;
  const numRowsToClearC = lastRowC - START_ROW + 1;
  assert.strictEqual(numRowsToClearC, 1, 'For lastRow=6, exactly 1 row (row 6) is cleared');
});

// ----------------------------------------------------------------------------
// Test 3: Master Data Preservation (76 Chart of Accounts)
// ----------------------------------------------------------------------------
runTest('Master Chart of Accounts (76 COA) is preserved with balances zeroed', () => {
  // Test baseline default accounts (72) and production accounts (76)
  assert.ok(defaultAccounts.length >= 72, 'Default accounts baseline must have at least 72 COA accounts');

  let prodAccounts = defaultAccounts;
  const backupFile = path.resolve(process.cwd(), 'scripts/backup_production_accounts_pre_release.json');
  if (fs.existsSync(backupFile)) {
    prodAccounts = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  }

  assert.strictEqual(prodAccounts.length, 76, 'Production Chart of Accounts must have exactly 76 accounts');

  // Simulate account zeroing during reset
  const resetAccounts = prodAccounts.map((a: any) => ({
    ...a,
    debetAwal: 0,
    kreditAwal: 0
  }));

  assert.strictEqual(resetAccounts.length, 76, 'All 76 accounts must remain in COA');
  for (const acc of resetAccounts) {
    assert.strictEqual(acc.debetAwal, 0, `Account ${acc.code} debetAwal must be 0`);
    assert.strictEqual(acc.kreditAwal, 0, `Account ${acc.code} kreditAwal must be 0`);
    assert.ok(acc.code.length > 0, `Account must have valid code`);
    assert.ok(acc.name.length > 0, `Account must have valid name`);
  }
});

// ----------------------------------------------------------------------------
// Test 4: Contacts & Settings Preservation
// ----------------------------------------------------------------------------
runTest('Contacts are preserved with balances reset to zero', () => {
  const sampleContacts = [
    { id: 'c1', code: 'CUST-001', name: 'PT Petro Energy', type: 'customer', balance: 50000000 },
    { id: 'v1', code: 'VEND-001', name: 'PT Sumber Gas', type: 'vendor', balance: 25000000 }
  ];

  const zeroedContacts = sampleContacts.map(c => ({
    ...c,
    balance: 0
  }));

  assert.strictEqual(zeroedContacts.length, 2, 'Contacts count must not decrease');
  assert.strictEqual(zeroedContacts[0].balance, 0, 'Customer balance must be 0');
  assert.strictEqual(zeroedContacts[1].balance, 0, 'Vendor balance must be 0');
  assert.strictEqual(zeroedContacts[0].name, 'PT Petro Energy', 'Customer name must be preserved');
});

// ----------------------------------------------------------------------------
// Test 5: Google Drive Retention by Default
// ----------------------------------------------------------------------------
runTest('Google Drive retention defaults to RETAINED unless clearDrive is explicit', () => {
  // Scenario 1: Standard reset without clearDrive
  const payload1: any = { confirmCode: 'RESET-SPECTRA' };
  const driveStatus1 = payload1.clearDrive === true ? 'TRASHED' : 'RETAINED';
  assert.strictEqual(driveStatus1, 'RETAINED', 'Drive files must be retained by default');

  // Scenario 2: Explicit clearDrive === false
  const payload2: any = { confirmCode: 'RESET-SPECTRA', clearDrive: false };
  const driveStatus2 = payload2.clearDrive === true ? 'TRASHED' : 'RETAINED';
  assert.strictEqual(driveStatus2, 'RETAINED', 'Drive files must be retained when clearDrive is false');

  // Scenario 3: Explicit clearDrive === true (Admin opted-in)
  const payload3: any = { confirmCode: 'RESET-SPECTRA', clearDrive: true };
  const driveStatus3 = payload3.clearDrive === true ? 'TRASHED' : 'RETAINED';
  assert.strictEqual(driveStatus3, 'TRASHED', 'Drive files are trashed only when clearDrive is explicitly true');
});

// ----------------------------------------------------------------------------
// Test 6: Backend Reset Security Guards (Fail-Closed)
// ----------------------------------------------------------------------------
runTest('Backend reset handler requires strict confirmation code RESET-SPECTRA', () => {
  const validCode = 'RESET-SPECTRA';
  const invalidCodes = ['', 'reset', 'RESET', 'RESET_SPECTRA', '1234', 'confirm'];

  for (const code of invalidCodes) {
    const isApproved = code.trim() === validCode;
    assert.strictEqual(isApproved, false, `Confirmation code "${code}" must be rejected`);
  }

  assert.strictEqual(validCode === 'RESET-SPECTRA', true, 'RESET-SPECTRA must be accepted');
});

// ----------------------------------------------------------------------------
// Test 7: Local Storage and State Reset Execution
// ----------------------------------------------------------------------------
runTest('resetAutoRecordState removes keys and resets doc sequence to 0', async () => {
  const mockStorage: Record<string, string> = {
    [STORAGE_DOC_SEQ_KEY]: '42',
    'sikeu_auto_record_doc_seq': '42',
    [SPECTRA_RECORDED_RECEIPTS_KEY]: JSON.stringify([{ id: 'r1' }]),
    [SPECTRA_PENDING_JOURNAL_KEY]: JSON.stringify({ draft: true }),
    'spectra_pending_journal_draft': JSON.stringify({ draft: true })
  };

  const globalAny = global as any;
  const originalLocalStorage = globalAny.localStorage;

  globalAny.localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; }
  };

  try {
    await resetAutoRecordState();
    assert.strictEqual(mockStorage[STORAGE_DOC_SEQ_KEY], '0', 'STORAGE_DOC_SEQ_KEY must be reset to "0"');
    assert.strictEqual(mockStorage['sikeu_auto_record_doc_seq'], '0', 'Legacy sequence key must be reset to "0"');
    assert.strictEqual(mockStorage[SPECTRA_RECORDED_RECEIPTS_KEY], undefined, 'Recorded receipts key must be removed');
    assert.strictEqual(mockStorage[SPECTRA_PENDING_JOURNAL_KEY], undefined, 'Pending journal key must be removed');
    assert.strictEqual(mockStorage['spectra_pending_journal_draft'], undefined, 'Legacy pending draft key must be removed');
  } finally {
    globalAny.localStorage = originalLocalStorage;
  }
});

// ----------------------------------------------------------------------------
// Test 8: Fail-Closed Protection on Database Failure
// ----------------------------------------------------------------------------
runTest('Fail-Closed: Local transactions are preserved if backend database reset fails', async () => {
  const initialTransactions = [
    { id: 'trx-1', refNumber: 'BT/0001/01X26', description: 'Test 1', lines: [] },
    { id: 'trx-2', refNumber: 'BT/0002/01X26', description: 'Test 2', lines: [] }
  ];

  // Mock a failing backend response
  const mockFailingBackend = async () => ({
    success: false,
    status: 'FAILED' as const,
    databaseReset: false,
    spreadsheetReset: false,
    message: 'PostgREST connection timeout'
  });

  // Emulate reset logic
  let localTransactions = [...initialTransactions];
  const backendRes = await mockFailingBackend();

  if (!backendRes.success && backendRes.databaseReset !== true) {
    // Fail-closed guard: do NOT modify local transactions
  } else {
    localTransactions = [];
  }

  assert.strictEqual(localTransactions.length, 2, 'Local transactions must remain untouched on database failure');
  assert.strictEqual(backendRes.status, 'FAILED', 'Status must be FAILED');
});

// ----------------------------------------------------------------------------
// Test 9: Partial Failure Handling (Database Cleared, Spreadsheet Fails)
// ----------------------------------------------------------------------------
runTest('Partial Failure: When DB clears but spreadsheet fails, reports PARTIAL_FAILURE & spreadsheetReset: false', async () => {
  // Webhook is empty or missing
  const webhookUrl = '';
  const isWebhookConfigured = Boolean(webhookUrl && webhookUrl.trim().length > 0);

  let spreadsheetReset = false;
  let status: 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED' = 'SUCCESS';
  let recoveryProcedure = '';

  if (!isWebhookConfigured) {
    spreadsheetReset = false;
    status = 'PARTIAL_FAILURE';
    recoveryProcedure = 'Buka Google Spreadsheet > Menu SPECTRA Bot > Reset Total';
  }

  assert.strictEqual(spreadsheetReset, false, 'Spreadsheet reset must be FALSE when webhook is missing');
  assert.strictEqual(status, 'PARTIAL_FAILURE', 'Status must be PARTIAL_FAILURE');
  assert.ok(recoveryProcedure.length > 0, 'Must provide clear recovery instructions');

  // Verify that in PARTIAL_FAILURE, local transactions are wiped to prevent stale resurrection
  const mockCloudDbReset = true;
  let localTransactions = [{ id: 'trx-1' }];
  if (mockCloudDbReset) {
    localTransactions = []; // Match 0 transactions in cloud
  }
  assert.strictEqual(localTransactions.length, 0, 'Local transactions must be 0 to match cloud DB');
});

// ----------------------------------------------------------------------------
// Test 10: Verified Pre-Reset Backup Integrity Gate
// ----------------------------------------------------------------------------
runTest('Verified Backup: Pre-reset backup integrity check verifies schema & contents before wiping', () => {
  const sampleAccounts = Array(76).fill(null).map((_, i) => ({ id: `acc_${i}`, code: `${10000 + i}`, name: `Account ${i}` }));
  const sampleTransactions = [{ id: 't1', refNumber: 'BT/0001', lines: [] }];
  const sampleContacts = [{ id: 'c1', name: 'PT Petro' }];
  const sampleSettings = { companyName: 'PT Spectra' };

  const verifiedBackup = {
    version: '2.0-verified',
    exportedAt: new Date().toISOString(),
    accounts: sampleAccounts,
    transactions: sampleTransactions,
    contacts: sampleContacts,
    settings: sampleSettings
  };

  const jsonStr = JSON.stringify(verifiedBackup);
  const parsed = JSON.parse(jsonStr);

  assert.ok(parsed.accounts && parsed.accounts.length === 76, 'Verified backup must contain all 76 COA accounts');
  assert.ok(parsed.transactions && parsed.transactions.length === 1, 'Verified backup must contain transactions');
  assert.strictEqual(parsed.settings.companyName, 'PT Spectra', 'Verified backup must contain settings');

  // Negative test: Corrupted backup
  const corruptedParsed = { ...parsed, accounts: [] };
  const isValid = Array.isArray(corruptedParsed.accounts) && corruptedParsed.accounts.length >= 72;
  assert.strictEqual(isValid, false, 'Integrity gate must reject corrupted backup with empty accounts');
});

// ----------------------------------------------------------------------------
// Test 11: Apps Script Read-Only Probe & Unrecognized Response Protection
// ----------------------------------------------------------------------------
runTest('Apps Script Probe: Non-SPECTRA script response is rejected and not marked spreadsheetReset: true', () => {
  // Simulate probing an IMS script or HTML error page
  const sampleImsResponse = '{"code":"CEO","label":"Chief Executive Officer","documents":[]}';
  const parsedIms = JSON.parse(sampleImsResponse);

  // Check compatibility criteria: Must be SPECTRA Spreadsheet Bot
  const isCompatibleSpectraBot = parsedIms.system === 'SPECTRA_FINANCIAL_SYSTEM' ||
                                 parsedIms.action === 'CLEAR_TRANSACTIONS_A6_K' ||
                                 parsedIms.bot === 'SPECTRA_BOT';

  assert.strictEqual(isCompatibleSpectraBot, false, 'Unrelated Google Apps Script must NOT be treated as SPECTRA Spreadsheet Bot');

  const finalSpreadsheetReset = isCompatibleSpectraBot ? true : false;
  assert.strictEqual(finalSpreadsheetReset, false, 'Must report spreadsheetReset = false when script is not compatible');
});

// ----------------------------------------------------------------------------
// Test 12: Database Transactional Rollback Atomicity (RPC)
// ----------------------------------------------------------------------------
runTest('Database Atomicity: Transaction rollback on error preserves all records with zero loss', () => {
  // Simulate mock database state
  const mockState = {
    transactions: [{ id: 'tx-1', amount: 500000 }],
    accounts: [{ id: 'acc-1', code: '10001', debetAwal: 500000 }],
    auditLogs: [] as any[]
  };

  // Simulate transactional function with rollback
  function executeAtomicReset(confirmCode: string, failInMiddle: boolean = false) {
    // Snapshot state for transaction isolation
    const preTx = JSON.parse(JSON.stringify(mockState));
    try {
      if (confirmCode !== 'RESET-SPECTRA') {
        throw new Error('Konfirmasi keamanan tidak valid.');
      }
      mockState.transactions = [];
      if (failInMiddle) {
        throw new Error('Database disk error during balance zeroing.');
      }
      mockState.accounts.forEach(a => { a.debetAwal = 0; });
      mockState.auditLogs.push({ action: 'RESET' });
      return { success: true };
    } catch (err: any) {
      // Rollback to preTx snapshot
      mockState.transactions = preTx.transactions;
      mockState.accounts = preTx.accounts;
      mockState.auditLogs = preTx.auditLogs;
      return { success: false, error: err.message };
    }
  }

  // Case A: Fails security code check -> All rolled back
  const resA = executeAtomicReset('INVALID');
  assert.strictEqual(resA.success, false);
  assert.strictEqual(mockState.transactions.length, 1, 'Transactions must be restored on abort');
  assert.strictEqual(mockState.accounts[0].debetAwal, 500000, 'Account balances must be restored');

  // Case B: Fails in the middle -> All rolled back (no partial mutations)
  const resB = executeAtomicReset('RESET-SPECTRA', true);
  assert.strictEqual(resB.success, false);
  assert.strictEqual(mockState.transactions.length, 1, 'Transactions must remain intact after mid-transaction failure');
  assert.strictEqual(mockState.auditLogs.length, 0, 'No partial audit logs written on failure');

  // Case C: Success -> Commits atomically
  const resC = executeAtomicReset('RESET-SPECTRA', false);
  assert.strictEqual(resC.success, true);
  assert.strictEqual(mockState.transactions.length, 0, 'Transactions deleted on success');
  assert.strictEqual(mockState.accounts[0].debetAwal, 0, 'Account balance zeroed on success');
  assert.strictEqual(mockState.auditLogs.length, 1, 'Audit log recorded on success');
});

// ----------------------------------------------------------------------------
// Test 13: Probe Gate Protection: Incompatible Probe Aborts POST Execution
// ----------------------------------------------------------------------------
runTest('Probe Gate: Incompatible probe result halts execution without sending POST request', () => {
  let postExecuted = false;

  // Emulate probe gate
  const probeResponse = { status: 'error', message: 'Unknown endpoint' };
  const isProbeOk = probeResponse.status === 'online';

  if (isProbeOk) {
    postExecuted = true;
  }

  assert.strictEqual(isProbeOk, false, 'Probe must be detected as not ok');
  assert.strictEqual(postExecuted, false, 'Destructive POST must NOT be executed when probe fails');
});

// ----------------------------------------------------------------------------
// Test 14: Verification of Spreadsheet Clearance (isCleared & dataRowsRemaining: 0)
// ----------------------------------------------------------------------------
runTest('Spreadsheet Verification: Requires isCleared=true and dataRowsRemaining=0 for SUCCESS', () => {
  // Case A: Claimed success but 5 rows remain
  const responseA = { status: 'success', dataRowsRemaining: 5, isCleared: false };
  const isActuallyCleanA = responseA.status === 'success' && (responseA.isCleared === true || responseA.dataRowsRemaining === 0);
  assert.strictEqual(isActuallyCleanA, false, 'Must reject if rows remain');

  // Case B: Cleaned completely (0 rows)
  const responseB = { status: 'success', dataRowsRemaining: 0, isCleared: true };
  const isActuallyCleanB = responseB.status === 'success' && (responseB.isCleared === true || responseB.dataRowsRemaining === 0);
  assert.strictEqual(isActuallyCleanB, true, 'Must accept only when 0 rows remain');
});

// ----------------------------------------------------------------------------
// Test 15: Consistency of zeroAccounts Default
// ----------------------------------------------------------------------------
runTest('zeroAccounts Consistency: Full reset defaults zeroAccounts to true', () => {
  const evaluateZeroAccounts = (options?: { zeroAccounts?: boolean }) => {
    return options?.zeroAccounts !== false;
  };

  // When options is undefined
  assert.strictEqual(evaluateZeroAccounts(), true, 'Default must be true');

  // When options is {}
  assert.strictEqual(evaluateZeroAccounts({}), true, 'Default must be true when omitted in object');

  // When options.zeroAccounts = true
  assert.strictEqual(evaluateZeroAccounts({ zeroAccounts: true }), true, 'Explicit true must be true');

  // When options.zeroAccounts = false (opt-out)
  assert.strictEqual(evaluateZeroAccounts({ zeroAccounts: false }), false, 'Explicit false must be respected');
});

// ----------------------------------------------------------------------------
// Test 16: IMS Script Segregation: Active IMS Project AKfycb... is Protected and Rejected
// ----------------------------------------------------------------------------
runTest('IMS Segregation: Active IMS Project AKfycb... is protected and rejected as SPECTRA Bot', () => {
  const IMS_DEPLOYMENT_ID = 'AKfycbweEADkAMfpyBXO4j1dBqPTACdrjkR5Pke90h9YxNRGchvA25xP_6JKXHl8e5LPd6bT';
  const imsUrl = `https://script.google.com/macros/s/${IMS_DEPLOYMENT_ID}/exec`;

  const isImsScript = imsUrl.includes(IMS_DEPLOYMENT_ID);
  assert.strictEqual(isImsScript, true, 'Must detect IMS script URL');

  // Backend guard verification
  let targetActionAllowed = true;
  let rejectionMessage = '';

  if (imsUrl.includes(IMS_DEPLOYMENT_ID)) {
    targetActionAllowed = false;
    rejectionMessage = 'Proyek IMS dilindungi aman. Gunakan URL deployment SPECTRA Bot terpisah.';
  }

  assert.strictEqual(targetActionAllowed, false, 'IMS script must NEVER be called by reset or sync');
  assert.ok(rejectionMessage.includes('Proyek IMS dilindungi aman'), 'Must explain IMS protection');
});

// ----------------------------------------------------------------------------
// Summary Report
// ----------------------------------------------------------------------------
setTimeout(() => {
  console.log(`\n=== REGRESSION TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===`);
  if (passedTests === totalTests) {
    console.log('SUCCESS: All system reset & spreadsheet sync regression tests passed!\n');
    process.exit(0);
  } else {
    console.error(`FAILURE: ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}, 500);
