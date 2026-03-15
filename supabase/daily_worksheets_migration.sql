-- ============================================================
-- ReasoningWizard — Daily Worksheets Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Daily worksheets table
CREATE TABLE IF NOT EXISTS public.daily_worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General',
  worksheet_date DATE NOT NULL DEFAULT CURRENT_DATE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Run this if the table already exists:
ALTER TABLE public.daily_worksheets ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_daily_worksheets_date ON public.daily_worksheets (worksheet_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_worksheets_created_at ON public.daily_worksheets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_worksheets_quiz_id ON public.daily_worksheets (quiz_id);

ALTER TABLE public.daily_worksheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read daily worksheets" ON public.daily_worksheets;
CREATE POLICY "Anyone can read daily worksheets"
ON public.daily_worksheets
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Write admins can insert daily worksheets" ON public.daily_worksheets;
CREATE POLICY "Write admins can insert daily worksheets"
ON public.daily_worksheets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND (admin_role IS NULL OR admin_role = 'super_admin')
  )
);

DROP POLICY IF EXISTS "Write admins can update daily worksheets" ON public.daily_worksheets;
CREATE POLICY "Write admins can update daily worksheets"
ON public.daily_worksheets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND (admin_role IS NULL OR admin_role = 'super_admin')
  )
);

DROP POLICY IF EXISTS "Write admins can delete daily worksheets" ON public.daily_worksheets;
CREATE POLICY "Write admins can delete daily worksheets"
ON public.daily_worksheets
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND (admin_role IS NULL OR admin_role = 'super_admin')
  )
);

-- 2. Storage bucket for worksheet PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily_worksheets', 'daily_worksheets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view worksheet PDFs" ON storage.objects;
CREATE POLICY "Anyone can view worksheet PDFs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'daily_worksheets');

DROP POLICY IF EXISTS "Write admins can upload worksheet PDFs" ON storage.objects;
CREATE POLICY "Write admins can upload worksheet PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'daily_worksheets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND (admin_role IS NULL OR admin_role = 'super_admin')
  )
);

DROP POLICY IF EXISTS "Write admins can update worksheet PDFs" ON storage.objects;
CREATE POLICY "Write admins can update worksheet PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'daily_worksheets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND (admin_role IS NULL OR admin_role = 'super_admin')
  )
);

DROP POLICY IF EXISTS "Write admins can delete worksheet PDFs" ON storage.objects;
CREATE POLICY "Write admins can delete worksheet PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'daily_worksheets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND (admin_role IS NULL OR admin_role = 'super_admin')
  )
);
