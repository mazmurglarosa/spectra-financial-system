-- =========================================================================
-- SPECTRA FINANCIAL SYSTEM (SIKEU2)
-- MIGRATION 005: CREATE RATE LIMITS TABLE FOR CENTRALIZED VERCEL SERVERLESS
-- STATUS: UNEXECUTED (KHUSUS STAGING / PERSIAPAN PRA-PRODUKSI)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kunci hak akses: Hanya service_role yang berhak membaca dan menulis rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

-- Indeks untuk efisiensi pembersihan reset_at
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits(reset_at);
