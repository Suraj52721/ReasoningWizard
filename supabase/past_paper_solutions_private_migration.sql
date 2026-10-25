-- ============================================================
-- ReasoningWizard — Private solution PDFs, coupons & bundle discount
-- Run AFTER past_paper_solution_purchase_migration.sql.
-- ============================================================

-- 1. Private bucket for solution PDFs (no public URLs).
INSERT INTO storage.buckets (id, name, public)
VALUES ('past_paper_solutions', 'past_paper_solutions', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Only write-admins touch this bucket directly. Buyers get short-lived signed
-- URLs from the get-past-paper-solution edge function (service role).
DROP POLICY IF EXISTS "Admins read past paper solutions" ON storage.objects;
CREATE POLICY "Admins read past paper solutions" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'past_paper_solutions' AND EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins upload past paper solutions" ON storage.objects;
CREATE POLICY "Admins upload past paper solutions" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'past_paper_solutions' AND EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND is_admin = true AND (admin_role IS NULL OR admin_role = 'super_admin')));

DROP POLICY IF EXISTS "Admins delete past paper solutions" ON storage.objects;
CREATE POLICY "Admins delete past paper solutions" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'past_paper_solutions' AND EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND is_admin = true AND (admin_role IS NULL OR admin_role = 'super_admin')));

-- 2. Coupons can be scoped to past-paper solutions.
ALTER TABLE public.coupon_codes DROP CONSTRAINT IF EXISTS coupon_codes_applies_to_check;
ALTER TABLE public.coupon_codes ADD CONSTRAINT coupon_codes_applies_to_check
  CHECK (applies_to IN ('all', 'test_papers', 'dashboard', 'past_papers'));

-- Safety net: ensure the purchases table exists even if the first migration
-- wasn't run (the full definition lives in past_paper_solution_purchase_migration.sql).
ALTER TABLE public.past_papers ADD COLUMN IF NOT EXISTS solution_price_pence INT NOT NULL DEFAULT 99;
CREATE TABLE IF NOT EXISTS public.past_paper_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id            UUID NOT NULL REFERENCES public.past_papers(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  amount_pence        INT,
  currency            TEXT DEFAULT 'GBP',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  purchased_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.past_paper_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own past_paper_purchases" ON public.past_paper_purchases;
CREATE POLICY "Users read own past_paper_purchases"
  ON public.past_paper_purchases FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all past_paper_purchases" ON public.past_paper_purchases;
CREATE POLICY "Admins read all past_paper_purchases"
  ON public.past_paper_purchases FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

ALTER TABLE public.past_paper_purchases ADD COLUMN IF NOT EXISTS coupon_code TEXT;

-- 3. Bundle discount (% off when 2+ solutions are bought together). Default 0.
INSERT INTO public.app_settings (key, value)
VALUES ('past_paper_bundle_discount_pct', '0')
ON CONFLICT (key) DO NOTHING;
