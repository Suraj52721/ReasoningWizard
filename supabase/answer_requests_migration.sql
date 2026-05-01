-- ============================================================
-- ReasoningWizard — Answer Requests Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Answer requests table
CREATE TABLE IF NOT EXISTS public.answer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES public.past_papers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  user_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paper_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_answer_requests_paper ON public.answer_requests (paper_id);
CREATE INDEX IF NOT EXISTS idx_answer_requests_user ON public.answer_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_answer_requests_created ON public.answer_requests (created_at DESC);

ALTER TABLE public.answer_requests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert their own request
DROP POLICY IF EXISTS "Users can insert own answer requests" ON public.answer_requests;
CREATE POLICY "Users can insert own answer requests"
ON public.answer_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can read their own requests (to show "already requested" state)
DROP POLICY IF EXISTS "Users can read own answer requests" ON public.answer_requests;
CREATE POLICY "Users can read own answer requests"
ON public.answer_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can read all requests
DROP POLICY IF EXISTS "Admins can read all answer requests" ON public.answer_requests;
CREATE POLICY "Admins can read all answer requests"
ON public.answer_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
);

-- Admins can delete requests (optional cleanup)
DROP POLICY IF EXISTS "Admins can delete answer requests" ON public.answer_requests;
CREATE POLICY "Admins can delete answer requests"
ON public.answer_requests
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
);
