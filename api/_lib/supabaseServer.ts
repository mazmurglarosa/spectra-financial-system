import { createClient, SupabaseClient } from '@supabase/supabase-js';

const isPublicEnv = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
               process.env.SUPABASE_SERVICE_KEY || 
               process.env.VITE_SUPABASE_ANON_KEY;

let serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (serverClient) {
    return serverClient;
  }

  // DI LINGKUNGAN VERCEL / PRODUCTION: Wajib mendefinisikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
  if (isPublicEnv) {
    if (!rawUrl) {
      throw new Error('[CRITICAL SECURITY] SUPABASE_URL tidak didefinisikan pada environment Vercel. Koneksi dicegah.');
    }
    if (!rawKey) {
      throw new Error('[CRITICAL SECURITY] SUPABASE_SERVICE_ROLE_KEY tidak didefinisikan pada environment Vercel.');
    }
  }

  const supabaseUrl = rawUrl || '';
  const supabaseKey = rawKey || '';

  serverClient = createClient(supabaseUrl, supabaseKey, {
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
}

