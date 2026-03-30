-- ============================================================
-- ReasoningWizard — Download Logs Migration
-- Run this in the Supabase SQL Editor
-- Replaces the increment_download_count RPC approach
-- ============================================================

-- 1. Download logs table (insert-only for anyone, read-only for admins)
CREATE TABLE IF NOT EXISTS public.download_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,   -- 'past_paper' | 'worksheet'
  resource_id   UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_download_logs_resource ON public.download_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_created_at ON public.download_logs (created_at DESC);

ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can log a download
DROP POLICY IF EXISTS "Anyone can log downloads" ON public.download_logs;
CREATE POLICY "Anyone can log downloads"
ON public.download_logs
FOR INSERT
TO public
WITH CHECK (true);

-- Only admins can read download logs
DROP POLICY IF EXISTS "Admins can read download logs" ON public.download_logs;
CREATE POLICY "Admins can read download logs"
ON public.download_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- 2. Drop old RPC if it exists (cleanup)
DROP FUNCTION IF EXISTS public.increment_download_count(TEXT, UUID);

-- 3. Remove old download_count columns if they exist (optional cleanup)
-- Uncomment if you want to remove them:
-- ALTER TABLE public.past_papers DROP COLUMN IF EXISTS download_count;
-- ALTER TABLE public.daily_worksheets DROP COLUMN IF EXISTS download_count;
