-- ============================================================
-- ReasoningWizard — Admin Migration
-- Run this in the Supabase SQL Editor AFTER the initial schema
-- ============================================================

-- 1. Add is_admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Add negative marking columns to quizzes
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS negative_marking BOOLEAN DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(3,2) DEFAULT 0.25;

-- 3. Add optional image_url to questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

-- 4. Storage for Quiz Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quiz_images', 'quiz_images', true) 
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Admins can upload quiz images" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'quiz_images' AND (SELECT is_admin FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Anyone can view quiz images" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'quiz_images');

-- 5. RLS policies for admin write access on quizzes
CREATE POLICY "Admins can insert quizzes" ON quizzes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update quizzes" ON quizzes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete quizzes" ON quizzes FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- 4. RLS policies for admin write access on questions
CREATE POLICY "Admins can insert questions" ON questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update questions" ON questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete questions" ON questions FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- 5. Mark yourself as admin (replace YOUR_EMAIL with your actual email)
-- UPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL');
