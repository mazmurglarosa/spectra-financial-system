import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STAGING_PROJECT_REF = 'xaafjvmdjdlfqdrljjlr';
const PRODUCTION_PROJECT_REF = 'drsqwxkkcfqvooqzoyvm';

let serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (serverClient) {
    return serverClient;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  // Wajib Service Role Key — HAPUS fallback ke VITE_SUPABASE_ANON_KEY demi keamanan RLS
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();

  const isVercel = Boolean(process.env.VERCEL);
  const vercelEnv = process.env.VERCEL_ENV || ''; // 'production', 'preview', or 'development'
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF || '';

  // 1. Validasi Keberadaan Kredensial (Fail-Closed)
  if (!supabaseUrl) {
    throw new Error('[SECURITY FATAL] SUPABASE_URL tidak didefinisikan pada backend serverless.');
  }
  if (!serviceRoleKey) {
    throw new Error('[SECURITY FATAL] SUPABASE_SERVICE_ROLE_KEY wajib didefinisikan. Backend menolak fallback ke anon key.');
  }

  // 2. Isolasi Environment: Pastikan Preview HANYA mengakses Staging
  const isPreview = isVercel && (vercelEnv === 'preview' || gitBranch === 'feature/secure-auth-groq');
  if (isPreview) {
    if (supabaseUrl.includes(PRODUCTION_PROJECT_REF)) {
      throw new Error(
        `[CRITICAL ISOLATION BLOCKED] Vercel Preview (${gitBranch}) dilarang keras terhubung ke Supabase Production (${PRODUCTION_PROJECT_REF}). Eksekusi backend dihentikan.`
      );
    }
  }

  // Inisialisasi Supabase Server Client dengan Service Role
  serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return serverClient;
}

export function setMockSupabaseClient(mock: any): void {
  serverClient = mock;
}

export interface DbUserRecord {
  id: string;
  username: string;
  password?: string;
  password_hash?: string;
  full_name: string;
  position: string;
  role: 'admin' | 'user';
  is_authority: boolean;
  status: 'active' | 'pending' | 'suspended';
  registered_at: string;
  session_version?: number;
  failed_login_attempts?: number;
  locked_until?: string | null;
  last_login_at?: string | null;
}
