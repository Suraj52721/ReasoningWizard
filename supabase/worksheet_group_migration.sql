-- =====================================================================
-- NEW / OLD WORKSHEET SPLIT MIGRATION
-- Run this in your Supabase SQL Editor (safe to run multiple times).
--
-- Replaces the old "last 4/5 days are free" date-window rule with a
-- permanent, explicit split:
--   • quizzes.worksheet_group = 'new'  -> free for every signed-in user
--   • quizzes.worksheet_group = 'old'  -> requires the existing 1-year
--                                          dashboard_purchases bundle
--
-- Everything that exists the first time this runs becomes 'old' (the paid
-- catalogue); everything created afterwards defaults to 'new' and is free.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. quizzes.worksheet_group
--    The backfill runs ONLY on the first execution (guarded by the
--    column's existence), so re-running this file never drags newly
--    created worksheets back into the paid bundle.
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'quizzes'
      AND column_name  = 'worksheet_group'
  ) THEN
    ALTER TABLE public.quizzes
      ADD COLUMN worksheet_group TEXT NOT NULL DEFAULT 'new';

    -- Snapshot: the entire existing catalogue is the "old" bundle.
    UPDATE public.quizzes SET worksheet_group = 'old';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_worksheet_group_check'
  ) THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_worksheet_group_check
      CHECK (worksheet_group IN ('new', 'old'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quizzes_worksheet_group
  ON public.quizzes (worksheet_group);


-- ─────────────────────────────────────────────────────────────────────
-- 2. public_daily_worksheets: gate file_url by worksheet_group, not date.
--    Supersedes the 4-day window from security_gate_questions_worksheets.sql.
--    Worksheets with no linked quiz (quiz_id IS NULL) fall back to 'old'
--    (conservative — matches "everything pre-existing is old").
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.public_daily_worksheets AS
  SELECT
    dw.id, dw.title, dw.subject, dw.worksheet_date, dw.file_name, dw.quiz_id, dw.created_at,
    CASE
      WHEN COALESCE(q.worksheet_group, 'old') = 'new'
           OR public.has_dashboard_access(auth.uid())
      THEN dw.file_url
      ELSE NULL
    END AS file_url,
    NOT (
      COALESCE(q.worksheet_group, 'old') = 'new'
      OR public.has_dashboard_access(auth.uid())
    ) AS is_locked
  FROM public.daily_worksheets dw
  LEFT JOIN public.quizzes q ON q.id = dw.quiz_id;

GRANT SELECT ON public.public_daily_worksheets TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 3. questions: gate locked quiz content by worksheet_group, not date.
--    Supersedes the 4-day window from security_gate_questions_worksheets.sql.
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Read questions for accessible quizzes" ON questions;
CREATE POLICY "Read questions for accessible quizzes"
  ON questions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = questions.quiz_id
        AND (
          NOT public.is_dashboard_quiz(q.id)
          OR COALESCE(q.worksheet_group, 'new') = 'new'
          OR public.has_dashboard_access(auth.uid())
        )
    )
  );


-- ─────────────────────────────────────────────────────────────────────
-- 4. quiz_attempts: server-side enforcement by worksheet_group, not date.
--    Supersedes section 4c of dashboard_5day_lock_migration.sql.
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own attempts" ON quiz_attempts;
CREATE POLICY "Users can insert own attempts"
  ON quiz_attempts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      NOT public.is_dashboard_quiz(quiz_id)
      OR EXISTS (
        SELECT 1 FROM quizzes q
        WHERE q.id = quiz_id
          AND COALESCE(q.worksheet_group, 'new') = 'new'
      )
      OR public.has_dashboard_access(auth.uid())
    )
  );

-- Done.
