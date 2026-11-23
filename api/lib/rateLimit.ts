import { SupabaseClient } from '@supabase/supabase-js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Pembersihan rutin in-memory setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Rate Limiter in-memory synchronous (tier 1 fast cache)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs
    };
    memoryStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: newEntry.resetAt
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt
  };
}

/**
 * Centralized Rate Limiter untuk Vercel Serverless Multi-Instance
 * Berjalan terpusat menggunakan Supabase tabel `rate_limits` jika tersedia;
 * otomatis fallback ke in-memory jika tabel belum siap atau koneksi terputus.
 */
export async function checkRateLimitCentralized(
  key: string,
  limit: number,
  windowMs: number,
  supabase?: SupabaseClient | any
): Promise<{ allowed: boolean; remaining: number; resetAt: number; error?: string }> {
  const now = Date.now();
  const isPublicEnv = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');

  if (supabase) {
    try {
      const { data: record, error: fetchErr } = await supabase
        .from('rate_limits')
        .select('key, count, reset_at')
        .eq('key', key)
        .limit(1)
        .maybeSingle();

      if (!fetchErr) {
        if (!record || now > Number(record.reset_at)) {
          const resetAt = now + windowMs;
          const { error: upsertErr } = await supabase.from('rate_limits').upsert({
            key,
            count: 1,
            reset_at: resetAt,
            updated_at: new Date().toISOString()
          });
          if (upsertErr && isPublicEnv) {
            return {
              allowed: false,
              remaining: 0,
              resetAt: now + 60000,
              error: 'Centralized rate limit storage write failed. Request blocked for security.'
            };
          }
          return { allowed: true, remaining: limit - 1, resetAt };
        }

        if (Number(record.count) >= limit) {
          return { allowed: false, remaining: 0, resetAt: Number(record.reset_at) };
        }

        const newCount = Number(record.count) + 1;
        const { error: updateErr } = await supabase
          .from('rate_limits')
          .update({
            count: newCount,
            updated_at: new Date().toISOString()
          })
          .eq('key', key);

        if (updateErr && isPublicEnv) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Number(record.reset_at),
            error: 'Centralized rate limit storage update failed. Request blocked for security.'
          };
        }

        return {
          allowed: true,
          remaining: limit - newCount,
          resetAt: Number(record.reset_at)
        };
      } else {
        // Query error to rate_limits table (misal table belum ada atau koneksi gagal)
        if (isPublicEnv) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: now + 60000,
            error: 'Centralized rate limit table unreachable or query failed. Request blocked for security.'
          };
        }
      }
    } catch (err: any) {
      if (isPublicEnv) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + 60000,
          error: `Centralized rate limit check exception: ${err?.message || 'unknown'}. Request blocked for security.`
        };
      }
    }
  } else if (isPublicEnv) {
    // Pada environment Vercel / Production, tidak boleh ada request lolos jika Supabase client tidak tersedia
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + 60000,
      error: 'Centralized rate limit client missing in public environment. Request blocked for security.'
    };
  }

  // Fallback in-memory hanya untuk local development
  return checkRateLimit(key, limit, windowMs);
}

/**
 * Mengambil client IP dari Vercel/Node request headers
 */
export function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) {
    return String(realIp).trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}
