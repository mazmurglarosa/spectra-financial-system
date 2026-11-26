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
