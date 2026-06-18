-- =====================================================================
-- SECURITY HARDENING — gate locked quiz QUESTIONS (#1) and WORKSHEETS (#4)
-- Run in Supabase SQL Editor (idempotent). Depends on helpers created in
-- dashboard_5day_lock_migration.sql: is_dashboard_quiz(), has_dashboard_access()
-- and is_admin_user() from security_hardening_pii_attempts.sql.
-- =====================================================================

-- ───────────────────── #1. questions: gate locked quiz content ─────────────────────
-- A question is readable only when its parent quiz is accessible:
--   • not a dashboard quiz (premium etc. — gated elsewhere), OR
--   • within the free 5-day window (today + previous 4 days), OR
--   • the caller has active dashboard access.
-- Admins can always read (for the Admin editor).
DROP POLICY IF EXISTS "Anyone can read questions" ON questions;
DROP POLICY IF EXISTS "Read questions for accessible quizzes" ON questions;
DROP POLICY IF EXISTS "Admins read all questions" ON questions;

CREATE POLICY "Read questions for accessible quizzes"
  ON questions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = questions.quiz_id
        AND (
          NOT public.is_dashboard_quiz(q.id)
          OR q.quiz_date >= CURRENT_DATE - INTERVAL '4 days'
          OR public.has_dashboard_access(auth.uid())
        )
    )
  );

CREATE POLICY "Admins read all questions"
  ON questions FOR SELECT USING (public.is_admin_user(auth.uid()));

-- ───────────────────── #4. daily_worksheets: 5 recent public, rest locked ───────────
-- Lock the base table down to admins; everyone else reads through a view that
-- exposes metadata for every worksheet but only reveals file_url for the recent
-- 5-day window (or to users with active access). Locked rows return file_url = NULL
-- and is_locked = true so the UI can render a "purchase to unlock" tile without
-- ever receiving the file URL.
DROP POLICY IF EXISTS "Anyone can read daily worksheets" ON daily_worksheets;
DROP POLICY IF EXISTS "Admins read daily worksheets" ON daily_worksheets;

CREATE POLICY "Admins read daily worksheets"
  ON daily_worksheets FOR SELECT USING (public.is_admin_user(auth.uid()));

CREATE OR REPLACE VIEW public.public_daily_worksheets AS
  SELECT
    id, title, subject, worksheet_date, file_name, quiz_id, created_at,
    CASE
      WHEN worksheet_date >= CURRENT_DATE - INTERVAL '4 days'
           OR public.has_dashboard_access(auth.uid())
      THEN file_url
      ELSE NULL
    END AS file_url,
    NOT (
      worksheet_date >= CURRENT_DATE - INTERVAL '4 days'
      OR public.has_dashboard_access(auth.uid())
    ) AS is_locked
  FROM public.daily_worksheets;

GRANT SELECT ON public.public_daily_worksheets TO anon, authenticated;
