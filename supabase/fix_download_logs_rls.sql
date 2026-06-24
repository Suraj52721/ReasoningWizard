-- ============================================================
-- ReasoningWizard — Fix Download Logs RLS
-- Run this in the Supabase SQL Editor if downloads show 0
-- ============================================================

-- 1. Ensure download_logs table exists
CREATE TABLE IF NOT EXISTS public.download_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,   -- 'past_paper' | 'worksheet'
  resource_id   UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_download_logs_resource ON public.download_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_created_at ON public.download_logs (created_at DESC);

ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;

-- 2. Allow anyone to insert download logs
DROP POLICY IF EXISTS "Anyone can log downloads" ON public.download_logs;
CREATE POLICY "Anyone can log downloads"
ON public.download_logs
FOR INSERT
TO public
WITH CHECK (true);

-- 3. Allow ALL admins to read (both super_admin and read_only_admin)
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

-- 4. Create trigger to keep download_count columns in sync with new log inserts
CREATE OR REPLACE FUNCTION public.sync_download_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.resource_type = 'past_paper' THEN
    UPDATE public.past_papers
    SET download_count = COALESCE(download_count, 0) + 1
    WHERE id = NEW.resource_id;
  ELSIF NEW.resource_type = 'worksheet' THEN
    UPDATE public.daily_worksheets
    SET download_count = COALESCE(download_count, 0) + 1
    WHERE id = NEW.resource_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_download_count ON public.download_logs;
CREATE TRIGGER trg_sync_download_count
AFTER INSERT ON public.download_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_download_count();
