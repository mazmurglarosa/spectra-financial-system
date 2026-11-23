import { hash, verify, Algorithm } from '@node-rs/argon2';
import crypto from 'crypto';

/**
 * Hash password menggunakan algoritma Argon2id (standar OWASP terkini)
 * Dilengkapi fallback aman ke Node.js crypto.scrypt jika native binding tidak tersedia.
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText || typeof plainText !== 'string' || plainText.length < 6) {
    throw new Error('Password minimal harus 6 karakter');
  }

  try {
    return await hash(plainText, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19456, // 19 MiB
      timeCost: 2,
      parallelism: 1
    });
  } catch (err) {
    console.warn('[Hash] Fallback ke crypto.scrypt karena runtime environment:', err);
    // Fallback crypto.scrypt
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(plainText, salt, 64);
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }
}

/**
 * Verifikasi password terhadap hash yang tersimpan secara waktu konstan
 */
export async function verifyPassword(storedHash: string, plainText: string): Promise<boolean> {
  if (!storedHash || !plainText) return false;

  try {
    if (storedHash.startsWith('$argon2id$') || storedHash.startsWith('$argon2')) {
      return await verify(storedHash, plainText);
    }

    if (storedHash.startsWith('scrypt$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 3) return false;
      const salt = parts[1];
      const originalKey = Buffer.from(parts[2], 'hex');
      const derivedKey = crypto.scryptSync(plainText, salt, 64);
      return crypto.timingSafeEqual(originalKey, derivedKey);
    }
  } catch (err) {
    console.error('[Hash] Gagal memverifikasi password:', err);
  }

  return false;
}

