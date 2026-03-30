-- ============================================================
-- ReasoningWizard — Past Year Papers Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Past papers table
CREATE TABLE IF NOT EXISTS public.past_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  year INT,
  subject TEXT NOT NULL DEFAULT 'General',
  difficulty TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_past_papers_subject ON public.past_papers (subject);
CREATE INDEX IF NOT EXISTS idx_past_papers_difficulty ON public.past_papers (difficulty);
CREATE INDEX IF NOT EXISTS idx_past_papers_year ON public.past_papers (year DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_past_papers_created_at ON public.past_papers (created_at DESC);

ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read past papers" ON public.past_papers;
CREATE POLICY "Anyone can read past papers"
ON public.past_papers
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Write admins can insert past papers" ON public.past_papers;
CREATE POLICY "Write admins can insert past papers"
ON public.past_papers
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

DROP POLICY IF EXISTS "Write admins can update past papers" ON public.past_papers;
CREATE POLICY "Write admins can update past papers"
ON public.past_papers
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

DROP POLICY IF EXISTS "Write admins can delete past papers" ON public.past_papers;
CREATE POLICY "Write admins can delete past papers"
ON public.past_papers
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

-- 2. Storage bucket for past paper PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('past_papers', 'past_papers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view past paper PDFs" ON storage.objects;
CREATE POLICY "Anyone can view past paper PDFs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'past_papers');

DROP POLICY IF EXISTS "Write admins can upload past paper PDFs" ON storage.objects;
CREATE POLICY "Write admins can upload past paper PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'past_papers'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND (admin_role IS NULL OR admin_role = 'super_admin')
  )
);

DROP POLICY IF EXISTS "Write admins can delete past paper PDFs" ON storage.objects;
CREATE POLICY "Write admins can delete past paper PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'past_papers'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND (admin_role IS NULL OR admin_role = 'super_admin')
  )
);
