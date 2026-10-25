-- ============================================================
-- ReasoningWizard — Paid past-paper solutions
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Price of the solution PDF for each past paper (pence). Default £0.99.
ALTER TABLE public.past_papers
  ADD COLUMN IF NOT EXISTS solution_price_pence INT NOT NULL DEFAULT 99;

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

CREATE INDEX IF NOT EXISTS idx_past_paper_purchases_user ON public.past_paper_purchases (user_id, status);
CREATE INDEX IF NOT EXISTS idx_past_paper_purchases_order ON public.past_paper_purchases (razorpay_order_id);

ALTER TABLE public.past_paper_purchases ENABLE ROW LEVEL SECURITY;

-- Inserts/updates happen only via edge functions (service role).
DROP POLICY IF EXISTS "Users read own past_paper_purchases" ON public.past_paper_purchases;
CREATE POLICY "Users read own past_paper_purchases"
  ON public.past_paper_purchases FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all past_paper_purchases" ON public.past_paper_purchases;
CREATE POLICY "Admins read all past_paper_purchases"
  ON public.past_paper_purchases FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
