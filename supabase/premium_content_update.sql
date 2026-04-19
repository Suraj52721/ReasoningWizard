-- ============================================================
-- ReasoningWizard - Premium Content Update
-- Run this in the Supabase SQL Editor
-- This script is idempotent and safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Quiz table compatibility columns
-- ------------------------------------------------------------
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS negative_marking BOOLEAN DEFAULT false;

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(3,2) DEFAULT 0.25;

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS quiz_mode TEXT DEFAULT 'dashboard';

UPDATE public.quizzes
SET quiz_mode = 'premium'
WHERE id IN (
  SELECT quiz_id FROM public.premium_nvr_worksheets WHERE quiz_id IS NOT NULL
  UNION
  SELECT quiz_id FROM public.premium_test_papers WHERE quiz_id IS NOT NULL
);

UPDATE public.quizzes
SET quiz_mode = 'dashboard'
WHERE quiz_mode IS NULL;

-- ------------------------------------------------------------
-- 2. Premium NVR worksheets
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.premium_nvr_worksheets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  topic          TEXT,
  difficulty     TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')) DEFAULT 'Medium',
  worksheet_date DATE,
  file_name      TEXT,
  file_path      TEXT UNIQUE,
  file_url       TEXT,
  quiz_id        UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  is_free        BOOLEAN DEFAULT false,
  sort_order     INT DEFAULT 0,
  download_count INT DEFAULT 0,
  uploaded_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS topic TEXT;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS difficulty TEXT;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS worksheet_date DATE;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS file_name TEXT;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS file_path TEXT UNIQUE;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS file_url TEXT;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS download_count INT DEFAULT 0;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.premium_nvr_worksheets
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_premium_nvr_worksheets_quiz_id
  ON public.premium_nvr_worksheets (quiz_id);

CREATE INDEX IF NOT EXISTS idx_premium_nvr_worksheets_sort_order
  ON public.premium_nvr_worksheets (sort_order);

-- ------------------------------------------------------------
-- 3. Premium test papers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.premium_test_papers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  subject        TEXT NOT NULL CHECK (subject IN ('11+ Maths', '11+ NVR', '11+ English')),
  school_name    TEXT,
  year           INT,
  file_name      TEXT,
  file_path      TEXT UNIQUE,
  file_url       TEXT,
  quiz_id        UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  is_free        BOOLEAN DEFAULT false,
  price_pence    INT DEFAULT 299,
  sort_order     INT DEFAULT 0,
  download_count INT DEFAULT 0,
  uploaded_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS school_name TEXT;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS year INT;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS file_name TEXT;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS file_path TEXT UNIQUE;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS file_url TEXT;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS price_pence INT DEFAULT 299;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS download_count INT DEFAULT 0;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.premium_test_papers
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_premium_test_papers_subject
  ON public.premium_test_papers (subject);

CREATE INDEX IF NOT EXISTS idx_premium_test_papers_quiz_id
  ON public.premium_test_papers (quiz_id);

CREATE INDEX IF NOT EXISTS idx_premium_test_papers_sort_order
  ON public.premium_test_papers (sort_order);

-- ------------------------------------------------------------
-- 4. Test paper bundles
--    This keeps the app and DB aligned on price_pence.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'test_paper_bundles'
      AND column_name = 'price_paise'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'test_paper_bundles'
      AND column_name = 'price_pence'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_paper_bundles RENAME COLUMN price_paise TO price_pence';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.test_paper_bundles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  subject      TEXT NOT NULL CHECK (subject IN ('11+ Maths', '11+ NVR', '11+ English')),
  description   TEXT,
  price_pence  INT NOT NULL DEFAULT 2900,
  currency     TEXT DEFAULT 'GBP',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.test_paper_bundles
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.test_paper_bundles
  ADD COLUMN IF NOT EXISTS price_pence INT NOT NULL DEFAULT 2900;

ALTER TABLE public.test_paper_bundles
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GBP';

ALTER TABLE public.test_paper_bundles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.test_paper_bundles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.test_paper_bundles
SET price_pence = COALESCE(price_pence, 2900)
WHERE price_pence IS NULL;

-- ------------------------------------------------------------
-- 5. Purchase/subscription tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nvr_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature  TEXT,
  plan                TEXT DEFAULT 'yearly',
  amount_pence        INT,
  currency            TEXT DEFAULT 'GBP',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  started_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.test_paper_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle_id           UUID NOT NULL REFERENCES public.test_paper_bundles(id),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature  TEXT,
  amount_pence        INT,
  currency            TEXT DEFAULT 'GBP',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  purchased_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.paper_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id            UUID NOT NULL REFERENCES public.premium_test_papers(id),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  amount_pence        INT,
  currency            TEXT DEFAULT 'GBP',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  purchased_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.paper_purchases
  DROP CONSTRAINT IF EXISTS paper_purchases_razorpay_payment_id_key;

CREATE INDEX IF NOT EXISTS idx_paper_purchases_payment_id
  ON public.paper_purchases (razorpay_payment_id);

-- ------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------
ALTER TABLE public.premium_nvr_worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_test_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_paper_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nvr_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_paper_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read premium_nvr_worksheets" ON public.premium_nvr_worksheets;
DROP POLICY IF EXISTS "Admins manage premium_nvr_worksheets" ON public.premium_nvr_worksheets;
CREATE POLICY "Public read premium_nvr_worksheets"
  ON public.premium_nvr_worksheets FOR SELECT USING (true);
CREATE POLICY "Write admins manage premium_nvr_worksheets"
  ON public.premium_nvr_worksheets FOR ALL
  USING (public.is_write_admin())
  WITH CHECK (public.is_write_admin());

DROP POLICY IF EXISTS "Public read premium_test_papers" ON public.premium_test_papers;
DROP POLICY IF EXISTS "Admins manage premium_test_papers" ON public.premium_test_papers;
CREATE POLICY "Public read premium_test_papers"
  ON public.premium_test_papers FOR SELECT USING (true);
CREATE POLICY "Write admins manage premium_test_papers"
  ON public.premium_test_papers FOR ALL
  USING (public.is_write_admin())
  WITH CHECK (public.is_write_admin());

DROP POLICY IF EXISTS "Public read bundles" ON public.test_paper_bundles;
DROP POLICY IF EXISTS "Admins manage bundles" ON public.test_paper_bundles;
CREATE POLICY "Public read bundles"
  ON public.test_paper_bundles FOR SELECT USING (true);
CREATE POLICY "Write admins manage bundles"
  ON public.test_paper_bundles FOR ALL
  USING (public.is_write_admin())
  WITH CHECK (public.is_write_admin());

DROP POLICY IF EXISTS "Users read own nvr_subscriptions" ON public.nvr_subscriptions;
DROP POLICY IF EXISTS "Users insert own nvr_subscriptions" ON public.nvr_subscriptions;
DROP POLICY IF EXISTS "Admins manage all nvr_subscriptions" ON public.nvr_subscriptions;
CREATE POLICY "Users read own nvr_subscriptions"
  ON public.nvr_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own nvr_subscriptions"
  ON public.nvr_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Write admins manage all nvr_subscriptions"
  ON public.nvr_subscriptions FOR ALL
  USING (public.is_write_admin())
  WITH CHECK (public.is_write_admin());

DROP POLICY IF EXISTS "Users read own test_paper_purchases" ON public.test_paper_purchases;
DROP POLICY IF EXISTS "Users insert own test_paper_purchases" ON public.test_paper_purchases;
DROP POLICY IF EXISTS "Admins manage all test_paper_purchases" ON public.test_paper_purchases;
CREATE POLICY "Users read own test_paper_purchases"
  ON public.test_paper_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own test_paper_purchases"
  ON public.test_paper_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Write admins manage all test_paper_purchases"
  ON public.test_paper_purchases FOR ALL
  USING (public.is_write_admin())
  WITH CHECK (public.is_write_admin());

DROP POLICY IF EXISTS "Users read own paper_purchases" ON public.paper_purchases;
DROP POLICY IF EXISTS "Users insert own paper_purchases" ON public.paper_purchases;
DROP POLICY IF EXISTS "Admins manage all paper_purchases" ON public.paper_purchases;
CREATE POLICY "Users read own paper_purchases"
  ON public.paper_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own paper_purchases"
  ON public.paper_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Write admins manage all paper_purchases"
  ON public.paper_purchases FOR ALL
  USING (public.is_write_admin())
  WITH CHECK (public.is_write_admin());

-- ------------------------------------------------------------
-- 7. Storage buckets and policies
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('premium_nvr_worksheets', 'premium_nvr_worksheets', true),
  ('premium_test_papers', 'premium_test_papers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view premium NVR PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Write admins can upload premium NVR PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Write admins can update premium NVR PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Write admins can delete premium NVR PDFs" ON storage.objects;

CREATE POLICY "Anyone can view premium NVR PDFs"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'premium_nvr_worksheets');

CREATE POLICY "Write admins can upload premium NVR PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'premium_nvr_worksheets'
    AND public.is_write_admin()
  );

CREATE POLICY "Write admins can update premium NVR PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'premium_nvr_worksheets'
    AND public.is_write_admin()
  );

CREATE POLICY "Write admins can delete premium NVR PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'premium_nvr_worksheets'
    AND public.is_write_admin()
  );

DROP POLICY IF EXISTS "Anyone can view premium test paper PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Write admins can upload premium test paper PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Write admins can update premium test paper PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Write admins can delete premium test paper PDFs" ON storage.objects;

CREATE POLICY "Anyone can view premium test paper PDFs"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'premium_test_papers');

CREATE POLICY "Write admins can upload premium test paper PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'premium_test_papers'
    AND public.is_write_admin()
  );

CREATE POLICY "Write admins can update premium test paper PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'premium_test_papers'
    AND public.is_write_admin()
  );

CREATE POLICY "Write admins can delete premium test paper PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'premium_test_papers'
    AND public.is_write_admin()
  );

-- ------------------------------------------------------------
-- 8. Seed bundles if missing
-- ------------------------------------------------------------
INSERT INTO public.test_paper_bundles (name, subject, description, price_pence, currency)
VALUES
  ('11+ Maths Complete Bundle', '11+ Maths', 'All 11+ Maths exam papers with step-by-step solutions and quizzes. Best value.', 2900, 'GBP'),
  ('11+ NVR Complete Bundle', '11+ NVR', 'All 11+ Non-Verbal Reasoning papers with solutions and interactive quizzes.', 2900, 'GBP'),
  ('11+ English Complete Bundle', '11+ English', 'All 11+ English papers: comprehension, grammar and vocabulary with full solutions.', 2900, 'GBP')
ON CONFLICT DO NOTHING;
