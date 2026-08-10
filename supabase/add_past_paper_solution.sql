-- ============================================================
-- ReasoningWizard — Past-paper solution PDFs
-- Run this in the Supabase SQL Editor.
-- ============================================================
-- Adds two nullable columns so a solution PDF can be attached to
-- each past paper:
--   solution_file_url  → public URL shown as the "Solution" button
--   solution_file_path → storage object key (for replace/delete cleanup)
--
-- No new RLS or storage policies are needed:
--   • The existing "Write admins can update past papers" UPDATE policy
--     already lets admins set these columns.
--   • Solution PDFs reuse the existing public 'past_papers' storage
--     bucket (uploaded under a solutions/ prefix), whose policies key
--     only on bucket_id, so admin upload + public read already work.
-- ------------------------------------------------------------

ALTER TABLE public.past_papers
  ADD COLUMN IF NOT EXISTS solution_file_url  TEXT,
  ADD COLUMN IF NOT EXISTS solution_file_path TEXT;
