-- ============================================================
-- ReasoningWizard — Scope coupons to a product area
-- Run this in the Supabase SQL Editor.
-- ============================================================
-- Adds an `applies_to` column so a coupon can be limited to a
-- specific purchase flow:
--   'all'         → valid everywhere (default; backwards compatible)
--   'test_papers' → only test paper / bundle purchases
--   'dashboard'   → only daily worksheet (dashboard access) purchases
-- ------------------------------------------------------------

ALTER TABLE public.coupon_codes
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'all';

-- Re-statable CHECK constraint.
ALTER TABLE public.coupon_codes
  DROP CONSTRAINT IF EXISTS coupon_codes_applies_to_check;

ALTER TABLE public.coupon_codes
  ADD CONSTRAINT coupon_codes_applies_to_check
  CHECK (applies_to IN ('all', 'test_papers', 'dashboard'));
