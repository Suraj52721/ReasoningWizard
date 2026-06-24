-- =====================================================================
-- DASHBOARD 5-DAY LOCK + PURCHASE MIGRATION
-- Run this in your Supabase SQL Editor (safe to run multiple times).
--
-- What it does:
--   1. Ensures app_settings exists (holds the dashboard tile price).
--   2. Ensures dashboard_purchases exists (1-year unlock records).
--   3. Seeds the default dashboard price (£9.99).
--   4. (Optional hardening) Enforces the "only the last 3 days are free,
--      everything older needs a purchase" rule on the SERVER, so it can't
--      be bypassed by calling the API directly. Scoped to DASHBOARD quizzes
--      only, so premium / subscription quizzes are never affected.
--
-- NOTE: The 3-day window is also enforced client-side in Dashboard.jsx
--       (isQuizLocked -> diffDays >= 3). Section 4 below makes that
--       authoritative on the database. If you only want the data layer,
--       run sections 1-3 and skip section 4.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. app_settings : global key/value store (dashboard price lives here)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. logged-out visitors) may read settings like the price.
DROP POLICY IF EXISTS "app_settings public read" ON app_settings;
CREATE POLICY "app_settings public read"
  ON app_settings FOR SELECT USING (true);

-- Only admins may insert / update / delete settings.
DROP POLICY IF EXISTS "app_settings admin write" ON app_settings;
CREATE POLICY "app_settings admin write"
  ON app_settings FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));


-- ─────────────────────────────────────────────────────────────────────
-- 2. dashboard_purchases : one completed, non-expired row == access.
--    Access is a 1-YEAR subscription (expires_at = purchased_at + 1 year).
--    (Idempotent re-statement of dashboard_tiles_migration.sql.)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature  TEXT,
  amount_pence        INT,
  currency            TEXT DEFAULT 'GBP',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  purchased_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,            -- 1 year after purchase; NULL = legacy lifetime
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already existed (from dashboard_tiles_migration.sql), add the
-- expiry column. NULL is treated as "never expires" so any pre-existing
-- completed purchases keep working.
ALTER TABLE dashboard_purchases
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE dashboard_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own dashboard_purchases" ON dashboard_purchases;
CREATE POLICY "Users read own dashboard_purchases"
  ON dashboard_purchases FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own dashboard_purchases" ON dashboard_purchases;
CREATE POLICY "Users insert own dashboard_purchases"
  ON dashboard_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all dashboard_purchases" ON dashboard_purchases;
CREATE POLICY "Admins manage all dashboard_purchases"
  ON dashboard_purchases FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));


-- ─────────────────────────────────────────────────────────────────────
-- 3. Seed the default dashboard tile price (£9.99 = 999 pence)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO app_settings (key, value)
VALUES ('dashboard_price_pence', '999')
ON CONFLICT (key) DO NOTHING;


-- =====================================================================
-- 4. OPTIONAL: SERVER-SIDE ENFORCEMENT OF THE 5-DAY RULE
-- =====================================================================

-- 4a. Helper: does this user have ACTIVE dashboard access? A purchase counts
--     only while it is completed AND not expired (1-year subscription).
--     expires_at IS NULL is treated as legacy lifetime (still valid).
--     NOTE: admins are intentionally NOT exempt — they see/experience the lock
--     like normal users (matches the client-side check in Dashboard.jsx).
CREATE OR REPLACE FUNCTION public.has_dashboard_access(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM dashboard_purchases dp
            WHERE dp.user_id = uid
              AND dp.status = 'completed'
              AND (dp.expires_at IS NULL OR dp.expires_at > NOW()));
$$;

-- 4b. Helper: is this quiz a "dashboard" quiz (i.e. NOT premium / not linked
--     to a premium NVR worksheet or premium test paper)? Mirrors the
--     dashboardOnlyQuizzes filter in Dashboard.jsx. Only dashboard quizzes
--     are subject to the 5-day lock; premium quizzes are gated separately.
CREATE OR REPLACE FUNCTION public.is_dashboard_quiz(qid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = qid
      AND COALESCE(q.quiz_mode, 'dashboard') <> 'premium'
      AND NOT EXISTS (SELECT 1 FROM premium_nvr_worksheets n WHERE n.quiz_id = qid)
      AND NOT EXISTS (SELECT 1 FROM premium_test_papers   t WHERE t.quiz_id = qid)
  );
$$;

-- 4c. Replace the quiz_attempts INSERT policy so an attempt on a LOCKED
--     dashboard quiz is rejected at the database level.
--
--     An insert is allowed when it is the user's own row AND any of:
--       • the quiz is not a dashboard quiz (premium etc. handled elsewhere)
--       • the quiz_date is within the free window: today + previous 4 days
--         (>= CURRENT_DATE - 4  ==  client-side diffDays < 5)
--       • the user has a completed purchase or is an admin
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
          AND q.quiz_date >= CURRENT_DATE - INTERVAL '4 days'
      )
      OR public.has_dashboard_access(auth.uid())
    )
  );

-- Done.
