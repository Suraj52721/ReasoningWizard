-- ============================================================
-- ReasoningWizard — Downloads & Question Reports Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add download_count to past_papers
ALTER TABLE public.past_papers
  ADD COLUMN IF NOT EXISTS download_count INT NOT NULL DEFAULT 0;

-- 2. Add download_count to daily_worksheets
ALTER TABLE public.daily_worksheets
  ADD COLUMN IF NOT EXISTS download_count INT NOT NULL DEFAULT 0;

-- 3. RPC to safely increment download count (SECURITY DEFINER so anon can call it)
CREATE OR REPLACE FUNCTION public.increment_download_count(p_table TEXT, p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_table = 'past_papers' THEN
    UPDATE public.past_papers SET download_count = download_count + 1 WHERE id = p_id;
  ELSIF p_table = 'daily_worksheets' THEN
    UPDATE public.daily_worksheets SET download_count = download_count + 1 WHERE id = p_id;
  END IF;
END;
$$;

-- Allow anon and authenticated users to call it
GRANT EXECUTE ON FUNCTION public.increment_download_count(TEXT, UUID) TO anon, authenticated;

-- 4. Question reports table
CREATE TABLE IF NOT EXISTS public.question_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  quiz_id      UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  reporter_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL,
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_reports_status     ON public.question_reports (status);
CREATE INDEX IF NOT EXISTS idx_question_reports_question   ON public.question_reports (question_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_created_at ON public.question_reports (created_at DESC);

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can submit a report
DROP POLICY IF EXISTS "Anyone can submit question reports" ON public.question_reports;
CREATE POLICY "Anyone can submit question reports"
ON public.question_reports
FOR INSERT
TO public
WITH CHECK (true);

-- Only admins can read reports
DROP POLICY IF EXISTS "Admins can read question reports" ON public.question_reports;
CREATE POLICY "Admins can read question reports"
ON public.question_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Only admins can update report status
DROP POLICY IF EXISTS "Admins can update question reports" ON public.question_reports;
CREATE POLICY "Admins can update question reports"
ON public.question_reports
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);
