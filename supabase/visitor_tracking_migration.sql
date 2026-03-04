-- ============================================================
-- ReasoningWizard — Visitor Tracking Migration
-- Run this in the Supabase SQL Editor AFTER the admin migration
-- ============================================================

-- 1. Create site_visitors table for tracking visitor data
CREATE TABLE IF NOT EXISTS site_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL DEFAULT '',
  visitor_fingerprint TEXT DEFAULT '',

  -- Page & Referral
  page_url TEXT NOT NULL DEFAULT '',
  referrer_url TEXT DEFAULT '',

  -- UTM Campaign Tracking
  utm_source TEXT DEFAULT '',
  utm_medium TEXT DEFAULT '',
  utm_campaign TEXT DEFAULT '',
  utm_term TEXT DEFAULT '',
  utm_content TEXT DEFAULT '',

  -- Geo / Network
  ip_address TEXT DEFAULT '',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  region TEXT DEFAULT '',

  -- Device / Browser
  browser TEXT DEFAULT '',
  browser_version TEXT DEFAULT '',
  os TEXT DEFAULT '',
  device_type TEXT DEFAULT 'desktop',  -- desktop, mobile, tablet
  screen_resolution TEXT DEFAULT '',
  language TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',

  -- User association
  is_logged_in BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT DEFAULT '',

  -- Consent
  cookie_consent TEXT DEFAULT 'none',  -- 'all', 'essential', 'none'

  -- Timestamps
  visited_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_visitors_visited_at ON site_visitors(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_session ON site_visitors(session_id);
CREATE INDEX IF NOT EXISTS idx_visitors_fingerprint ON site_visitors(visitor_fingerprint);
CREATE INDEX IF NOT EXISTS idx_visitors_page_url ON site_visitors(page_url);
CREATE INDEX IF NOT EXISTS idx_visitors_user_id ON site_visitors(user_id);

-- 3. Enable RLS
ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Anyone (including anonymous) can INSERT visitor records
CREATE POLICY "Anyone can insert visitor records" ON site_visitors
  FOR INSERT
  WITH CHECK (true);

-- Only admins can SELECT (view) visitor data
CREATE POLICY "Admins can view visitor data" ON site_visitors
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- No UPDATE or DELETE allowed (data integrity for analytics)
-- (No policies created = no access for update/delete)
