-- =====================================================================
-- PREMIUM CONTENT MIGRATION  (GBP / UK)
-- Run this entire script in your Supabase SQL Editor
-- =====================================================================

-- 1. Premium NVR Worksheets (yearly subscription-based)
CREATE TABLE IF NOT EXISTS premium_nvr_worksheets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  topic         TEXT,
  difficulty    TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')) DEFAULT 'Medium',
  worksheet_date DATE,
  file_name     TEXT,
  file_path     TEXT UNIQUE,
  file_url      TEXT,
  quiz_id       UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  is_free       BOOLEAN DEFAULT false,
  sort_order    INT DEFAULT 0,
  download_count INT DEFAULT 0,
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Premium Test Papers (supports both bundle & per-paper purchase)
CREATE TABLE IF NOT EXISTS premium_test_papers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  subject       TEXT NOT NULL CHECK (subject IN ('11+ Maths', '11+ NVR', '11+ English')),
  school_name   TEXT,
  year          INT,
  file_name     TEXT,
  file_path     TEXT UNIQUE,
  file_url      TEXT,
  quiz_id       UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  is_free       BOOLEAN DEFAULT false,
  price_pence   INT DEFAULT 299,    -- £2.99 per paper (in pence); 0 = part of bundle only
  sort_order    INT DEFAULT 0,
  download_count INT DEFAULT 0,
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Test Paper Subject Bundles (buy all papers in a subject at a discount)
CREATE TABLE IF NOT EXISTS test_paper_bundles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL CHECK (subject IN ('11+ Maths', '11+ NVR', '11+ English')),
  description   TEXT,
  price_pence   INT NOT NULL DEFAULT 2900,   -- £29 per bundle (in pence)
  currency      TEXT DEFAULT 'GBP',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. NVR Yearly Subscriptions
CREATE TABLE IF NOT EXISTS nvr_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature  TEXT,
  plan                TEXT DEFAULT 'yearly',
  amount_pence        INT,    -- in pence (GBP)
  currency            TEXT DEFAULT 'GBP',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  started_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bundle Purchases (buy entire subject bundle)
CREATE TABLE IF NOT EXISTS test_paper_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle_id           UUID NOT NULL REFERENCES test_paper_bundles(id),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature  TEXT,
  amount_pence        INT,
  currency            TEXT DEFAULT 'GBP',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  purchased_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Individual Paper Purchases (buy a single paper)
CREATE TABLE IF NOT EXISTS paper_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id            UUID NOT NULL REFERENCES premium_test_papers(id),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  amount_pence        INT,
  currency            TEXT DEFAULT 'GBP',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  purchased_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE premium_nvr_worksheets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_test_papers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_paper_bundles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nvr_subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_paper_purchases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_purchases          ENABLE ROW LEVEL SECURITY;

-- premium_nvr_worksheets
CREATE POLICY "Public read premium_nvr_worksheets"
  ON premium_nvr_worksheets FOR SELECT USING (true);
CREATE POLICY "Admins manage premium_nvr_worksheets"
  ON premium_nvr_worksheets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- premium_test_papers
CREATE POLICY "Public read premium_test_papers"
  ON premium_test_papers FOR SELECT USING (true);
CREATE POLICY "Admins manage premium_test_papers"
  ON premium_test_papers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- test_paper_bundles
CREATE POLICY "Public read bundles"
  ON test_paper_bundles FOR SELECT USING (true);
CREATE POLICY "Admins manage bundles"
  ON test_paper_bundles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- nvr_subscriptions
CREATE POLICY "Users read own nvr_subscriptions"
  ON nvr_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own nvr_subscriptions"
  ON nvr_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all nvr_subscriptions"
  ON nvr_subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- test_paper_purchases (bundle)
CREATE POLICY "Users read own test_paper_purchases"
  ON test_paper_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own test_paper_purchases"
  ON test_paper_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all test_paper_purchases"
  ON test_paper_purchases FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- paper_purchases (individual)
CREATE POLICY "Users read own paper_purchases"
  ON paper_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own paper_purchases"
  ON paper_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all paper_purchases"
  ON paper_purchases FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- =====================================================================
-- SEED DEFAULT BUNDLES (GBP)
-- =====================================================================

INSERT INTO test_paper_bundles (name, subject, description, price_pence, currency)
VALUES
  ('11+ Maths Complete Bundle',   '11+ Maths',   'All 11+ Maths exam papers with step-by-step solutions and quizzes. Best value.',    2900, 'GBP'),
  ('11+ NVR Complete Bundle',     '11+ NVR',     'All 11+ Non-Verbal Reasoning papers with solutions and interactive quizzes.',        2900, 'GBP'),
  ('11+ English Complete Bundle', '11+ English', 'All 11+ English papers: comprehension, grammar and vocabulary with full solutions.', 2900, 'GBP')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- STORAGE BUCKETS  (create in Supabase Dashboard → Storage)
--   1. "premium_nvr_worksheets"  — public bucket
--   2. "premium_test_papers"     — public bucket
-- =====================================================================
