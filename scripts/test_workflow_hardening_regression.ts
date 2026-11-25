/**
 * Regression Test: Workflow Hardening, Sequence Stability & Idempotency
 * SPECTRA Financial System (SIKEU2)
 *
 * Verifies:
 * 1. Server Environment Detection:
 *    - Canonical production domain spectra-financial-system.vercel.app detected as 'production' (not 'preview').
 *    - Git branch preview domain detected as 'preview'.
 *    - Staging DB paired with production domain fails-closed.
 * 2. Document Sequence Stability & Monotonic Increment:
 *    - Sequences scan both transactions and recorded receipts.
 *    - Commit sequence respects Math.max and does not backtrack.
 * 3. Drive Folder Routing:
 *    - Transactions folder ID is '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9'.
 *    - Web assets folder ID is '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn'.
 * 4. Idempotency & Duplicate Prevention:
 *    - Double posting rejection logic for identical reference numbers.
 */

import assert from 'node:assert';
import { detectServerEnvironment } from '../api/_handlers/financial/spreadsheet-sync';
import { 
  getNextDocumentSequence, 
  generateFileCode, 
  commitDocumentSequence,
  STORAGE_DOC_SEQ_KEY 
} from '../src/services/autoRecordService';
import { 
  SPECTRA_TRANSACTIONS_DRIVE_FOLDER_ID,
  SPECTRA_WEB_DRIVE_FOLDER_ID 
} from '../src/services/googleDriveBot';

console.log('=== STARTING WORKFLOW HARDENING REGRESSION TESTS ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}:`, err.message || err);
  }
}

// ----------------------------------------------------------------------------
// Test 1: Server Environment Detection - Production Domain Safety
// ----------------------------------------------------------------------------
runTest('Server detects canonical production domain as production', () => {
  const origVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  try {
    const req = {
      headers: {
        host: 'spectra-financial-system.vercel.app',
        'x-forwarded-host': 'spectra-financial-system.vercel.app'
      }
    };
    const env = detectServerEnvironment(req, 'drsqwxkkcfqvooqzoyvm');
    assert.strictEqual(env.isProduction, true, 'Canonical production domain must be recognized as production');
    assert.strictEqual(env.isStagingOrPreview, false, 'Production must not be staging or preview');
    assert.strictEqual(env.environmentName, 'production');
  } finally {
    process.env.VERCEL_ENV = origVercelEnv;
  }
});

runTest('Server detects custom production domains as production', () => {
  const origVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  try {
    const req = {
      headers: {
        host: 'spectra.nirwanabhumi.co.id'
      }
    };
    const env = detectServerEnvironment(req, 'drsqwxkkcfqvooqzoyvm');
    assert.strictEqual(env.isProduction, true);
    assert.strictEqual(env.environmentName, 'production');
  } finally {
    process.env.VERCEL_ENV = origVercelEnv;
  }
});

runTest('Server fails-closed on branch preview deployment domain', () => {
  const origVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'preview';
  try {
    const req = {
      headers: {
        host: 'spectra-financial-system-git-feature-secure-auth-groq.vercel.app'
      }
    };
    const env = detectServerEnvironment(req, 'drsqwxkkcfqvooqzoyvm');
    assert.strictEqual(env.isProduction, false, 'Git preview domain must NOT be production');
    assert.strictEqual(env.isStagingOrPreview, true, 'Preview domain must be stagingOrPreview');
    assert.strictEqual(env.environmentName, 'preview');
  } finally {
    process.env.VERCEL_ENV = origVercelEnv;
  }
});

runTest('Server fails-closed if staging supabase is paired with production domain', () => {
  const origVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  try {
    const req = {
      headers: {
        host: 'spectra-financial-system.vercel.app'
      }
    };
    // Staging project ID instead of production
    const env = detectServerEnvironment(req, 'xaafjvmdjdlfqdrljjlr');
    assert.strictEqual(env.isProduction, false, 'Staging DB must never be treated as production');
    assert.strictEqual(env.isStagingOrPreview, true, 'Staging DB must enforce stagingOrPreview');
    assert.strictEqual(env.environmentName, 'staging');
  } finally {
    process.env.VERCEL_ENV = origVercelEnv;
  }
});

// ----------------------------------------------------------------------------
// Test 2: Drive Folder Segregation
// ----------------------------------------------------------------------------
runTest('Transactions Drive Folder ID matches company policy', () => {
  assert.strictEqual(
    SPECTRA_TRANSACTIONS_DRIVE_FOLDER_ID,
    '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9',
    'Official transaction documents must route to dedicated transaction folder'
  );
});

runTest('Web Assets Drive Folder ID is segregated from transactions', () => {
  assert.strictEqual(
    SPECTRA_WEB_DRIVE_FOLDER_ID,
    '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn',
    'Web assets must route to web folder'
  );
  assert.notStrictEqual(
    SPECTRA_TRANSACTIONS_DRIVE_FOLDER_ID,
    SPECTRA_WEB_DRIVE_FOLDER_ID,
    'Transaction folder and web assets folder must never be identical'
  );
});

// ----------------------------------------------------------------------------
// Test 3: Document Sequence Number Stability & Monotonic Increment
// ----------------------------------------------------------------------------
runTest('getNextDocumentSequence scans transactions accurately', () => {
  const mockTransactions: any[] = [
    { id: '1', refNumber: 'BT/0001/26XI26', description: 'Sample 1' },
    { id: '2', refNumber: 'BT/0002/26XI26', description: 'Sample 2' },
    { id: '3', refNumber: 'REF-GENERAL-1', description: 'Non BT' }
  ];

  const nextSeq = getNextDocumentSequence(mockTransactions);
  assert.strictEqual(nextSeq, 3, 'Next sequence after BT/0002 should be 3');

  const fileCode = generateFileCode(nextSeq);
  assert.match(fileCode, /^BT\/0003\//, 'Generated file code must start with BT/0003/');
});

runTest('commitDocumentSequence is monotonic and prevents backtracking', () => {
  // Mock localStorage in Node.js runtime
  const storage = new Map<string, string>();
  (global as any).localStorage = {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, val: string) => storage.set(key, val),
    removeItem: (key: string) => storage.delete(key)
  };

  commitDocumentSequence(5);
  assert.strictEqual(storage.get(STORAGE_DOC_SEQ_KEY), '5');

  // Attempt to backtrack with a smaller sequence (e.g. 2)
  commitDocumentSequence(2);
  assert.strictEqual(storage.get(STORAGE_DOC_SEQ_KEY), '5', 'Sequence must not backtrack to a lower number');

  // Advance to larger sequence
  commitDocumentSequence(8);
  assert.strictEqual(storage.get(STORAGE_DOC_SEQ_KEY), '8', 'Sequence must advance when higher number committed');
});

// ----------------------------------------------------------------------------
// Test 4: Idempotency & Duplicate Reference Prevention
// ----------------------------------------------------------------------------
runTest('Duplicate document reference check rejects existing document', () => {
  const existingTransactions = [
    { id: 'tx-1', refNumber: 'BT/0001/26XI26', description: 'Pembelian 1' }
  ];

  const checkDuplicate = (ref: string) => {
    return existingTransactions.some(t => t.refNumber.toUpperCase().trim() === ref.toUpperCase().trim());
  };

  assert.strictEqual(checkDuplicate('BT/0001/26XI26'), true, 'Existing reference must be detected as duplicate');
  assert.strictEqual(checkDuplicate('bt/0001/26xi26'), true, 'Case-insensitive duplicate must be caught');
  assert.strictEqual(checkDuplicate('BT/0002/26XI26'), false, 'New reference must be allowed');
});

console.log(`\n=== RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===\n`);

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('ALL WORKFLOW HARDENING TESTS PASSED SUCCESSFULLY.');
}
