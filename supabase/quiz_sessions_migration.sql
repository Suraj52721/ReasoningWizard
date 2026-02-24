-- ============================================================
-- Quiz Sessions — server-side pause/resume state
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Stores in-progress quiz state so users can pause and resume
-- from any device at any time.
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  answers JSONB DEFAULT '{}',
  time_left_seconds INT NOT NULL,
  current_question INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quiz_id)
);

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read, write, and delete their own sessions
CREATE POLICY "Users can manage own quiz sessions"
  ON quiz_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
