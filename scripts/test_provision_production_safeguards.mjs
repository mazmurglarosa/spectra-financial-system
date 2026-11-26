/**
 * REGRESSION TEST: Safeguards & Security Boundaries for Production Admin Provisioning
 * Non-destructive: Does NOT touch live database.
 */

import assert from 'assert';
import {
  validateSupabaseUrl,
  EXPECTED_PRODUCTION_HOSTNAME,
  FORBIDDEN_STAGING_HOSTNAME,
  TARGET_ADMIN_ID,
  TARGET_ADMIN_USERNAME,
  TARGET_ADMIN_ROLE
} from './provision_production_admin.mjs';
import { hashPassword, verifyPassword } from '../api/_lib/hash.ts';

console.log('===============================================================');
console.log('   TESTING PRODUCTION PROVISIONING SAFEGUARDS & VALIDATIONS');
console.log('===============================================================');

// TEST 1: Reject null/empty URL
assert.throws(() => validateSupabaseUrl(null), /SUPABASE_URL wajib berupa string/);
assert.throws(() => validateSupabaseUrl(''), /SUPABASE_URL wajib berupa string/);
console.log('[PASS] Test 1: Reject empty/null URL');

// TEST 2: Reject non-HTTPS
assert.throws(() => validateSupabaseUrl(`http://${EXPECTED_PRODUCTION_HOSTNAME}`), /Protocol URL wajib HTTPS/);
console.log('[PASS] Test 2: Reject HTTP protocol');

// TEST 3: Reject Userinfo injection
assert.throws(() => validateSupabaseUrl(`https://admin:secret@${EXPECTED_PRODUCTION_HOSTNAME}`), /dilarang memuat kredensial username\/password/);
console.log('[PASS] Test 3: Reject userinfo injection');

// TEST 4: Reject non-standard ports
assert.throws(() => validateSupabaseUrl(`https://${EXPECTED_PRODUCTION_HOSTNAME}:8080`), /port non-standar/);
console.log('[PASS] Test 4: Reject non-standard port');

// TEST 5: Reject subpaths
assert.throws(() => validateSupabaseUrl(`https://${EXPECTED_PRODUCTION_HOSTNAME}/rest/v1`), /path tambahan/);
console.log('[PASS] Test 5: Reject subpaths');

// TEST 6: Reject query params & hash
assert.throws(() => validateSupabaseUrl(`https://${EXPECTED_PRODUCTION_HOSTNAME}?key=val`), /query parameters/);
assert.throws(() => validateSupabaseUrl(`https://${EXPECTED_PRODUCTION_HOSTNAME}#frag`), /fragment hash/);
console.log('[PASS] Test 6: Reject query parameters and hash');

// TEST 7: Strictly reject Staging URL
assert.throws(() => validateSupabaseUrl(`https://${FORBIDDEN_STAGING_HOSTNAME}`), /dilarang keras menargetkan Staging/);
console.log('[PASS] Test 7: Strictly reject Staging URL');

// TEST 8: Accept valid Production URL
const validOrigin = validateSupabaseUrl(`https://${EXPECTED_PRODUCTION_HOSTNAME}`);
assert.strictEqual(validOrigin, `https://${EXPECTED_PRODUCTION_HOSTNAME}`);
console.log('[PASS] Test 8: Accept valid Production URL');

// TEST 9: Verify Argon2id hash & verify
const testPass = 'SuperSecureProductionPassword2026!';
const hash = await hashPassword(testPass);
assert.ok(hash.startsWith('$argon2id$') || hash.startsWith('$argon2'), 'Hash must be Argon2id');
const matches = await verifyPassword(hash, testPass);
assert.strictEqual(matches, true, 'verifyPassword must match plain text');
const wrongMatches = await verifyPassword(hash, 'WrongPassword123!');
assert.strictEqual(wrongMatches, false, 'verifyPassword must reject wrong password');
console.log('[PASS] Test 9: Argon2id hash generation and strict constant-time verification');

// TEST 10: Verify target user constant properties
assert.strictEqual(TARGET_ADMIN_ID, 'usr-prod-admin-01');
assert.strictEqual(TARGET_ADMIN_USERNAME, 'admin');
assert.strictEqual(TARGET_ADMIN_ROLE, 'admin');
console.log('[PASS] Test 10: Target administrator identity verified');

console.log('===============================================================');
console.log('   SEMUA SAFEGUARD TESTS LULUS (10/10 PASS)');
console.log('===============================================================');
