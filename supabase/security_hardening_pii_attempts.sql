-- =====================================================================
-- SECURITY HARDENING — profiles PII + quiz_attempts answers
-- Run in Supabase SQL Editor (idempotent).
--
-- Before: profiles and quiz_attempts were world-readable (USING true), so
-- anyone with the anon key could read every user's phone/is_admin and every
-- user's quiz answers/scores.
--
-- After: base tables are readable only by the owner (or an admin). Public
-- leaderboards read through column-limited views that expose only safe,
-- non-sensitive fields (no phone, no is_admin, no answers).
-- =====================================================================

-- Admin check that bypasses RLS — prevents infinite recursion when used inside
-- a policy ON the profiles table.
CREATE OR REPLACE FUNCTION public.is_admin_user(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = uid AND is_admin = true);
$$;

-- ───────────────────────── profiles ─────────────────────────
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;

CREATE POLICY "Users view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles"
  ON profiles FOR SELECT USING (public.is_admin_user(auth.uid()));

-- Safe public projection for leaderboards (no phone, no is_admin).
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, display_name, avatar_url FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ──────────────────────── quiz_attempts ─────────────────────
DROP POLICY IF EXISTS "Users can read all attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Users read own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Admins read all attempts" ON quiz_attempts;

CREATE POLICY "Users read own attempts"
  ON quiz_attempts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all attempts"
  ON quiz_attempts FOR SELECT USING (public.is_admin_user(auth.uid()));

-- Safe public projection for leaderboards/stats — excludes the `answers` JSONB.
CREATE OR REPLACE VIEW public.public_quiz_attempts AS
  SELECT id, user_id, quiz_id, score, total_questions, time_taken_seconds, completed_at
  FROM public.quiz_attempts;

GRANT SELECT ON public.public_quiz_attempts TO anon, authenticated;
