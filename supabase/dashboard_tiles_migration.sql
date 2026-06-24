-- =====================================================================
-- DASHBOARD TILES PREMIUM MIGRATION
-- Run this in your Supabase SQL Editor
-- =====================================================================

-- 1. Create Dashboard Purchases table (Lifetime unlock)
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
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add Row Level Security
ALTER TABLE dashboard_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dashboard_purchases"
  ON dashboard_purchases FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dashboard_purchases"
  ON dashboard_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all dashboard_purchases"
  ON dashboard_purchases FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- 3. Set a default price for dashboard access if not already set (e.g. £9.99)
INSERT INTO app_settings (key, value)
VALUES ('dashboard_price_pence', '999')
ON CONFLICT (key) DO NOTHING;
