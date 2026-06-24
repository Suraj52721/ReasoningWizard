-- ============================================================
-- ReasoningWizard — Complete Database Setup & Utility Queries
-- This file consolidates all queries for database management.
-- Run sections as needed in the Supabase SQL Editor.
-- ============================================================


-- ████████████████████████████████████████████████████████████
-- SECTION 1: CREATE site_visitors TABLE
-- ████████████████████████████████████████████████████████████

CREATE TABLE IF NOT EXISTS site_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL DEFAULT '',
  visitor_fingerprint TEXT DEFAULT '',
  page_url TEXT NOT NULL DEFAULT '',
  referrer_url TEXT DEFAULT '',
  utm_source TEXT DEFAULT '',
  utm_medium TEXT DEFAULT '',
  utm_campaign TEXT DEFAULT '',
  utm_term TEXT DEFAULT '',
  utm_content TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  region TEXT DEFAULT '',
  browser TEXT DEFAULT '',
  browser_version TEXT DEFAULT '',
  os TEXT DEFAULT '',
  device_type TEXT DEFAULT 'desktop',
  screen_resolution TEXT DEFAULT '',
  language TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  is_logged_in BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT DEFAULT '',
  cookie_consent TEXT DEFAULT 'none',
  visited_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitors_visited_at ON site_visitors(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_session ON site_visitors(session_id);
CREATE INDEX IF NOT EXISTS idx_visitors_fingerprint ON site_visitors(visitor_fingerprint);
CREATE INDEX IF NOT EXISTS idx_visitors_page_url ON site_visitors(page_url);
CREATE INDEX IF NOT EXISTS idx_visitors_user_id ON site_visitors(user_id);

ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert visitor records" ON site_visitors
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view visitor data" ON site_visitors
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));


-- ████████████████████████████████████████████████████████████
-- SECTION 2: ADD admin_role COLUMN TO profiles
-- ████████████████████████████████████████████████████████████

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT NULL;

-- Backfill existing admins
UPDATE profiles SET admin_role = 'super_admin' WHERE is_admin = true AND admin_role IS NULL;

-- Helper function for write-admin checks
CREATE OR REPLACE FUNCTION public.is_write_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = true 
    AND (admin_role IS NULL OR admin_role = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ████████████████████████████████████████████████████████████
-- SECTION 3: ADMIN MANAGEMENT QUERIES (run manually)
-- ████████████████████████████████████████████████████████████

-- ▸ Make a user a SUPER ADMIN (full access):
-- UPDATE profiles SET is_admin = true, admin_role = 'super_admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- ▸ Make a user a READ-ONLY ADMIN (can view everything, cannot edit):
-- UPDATE profiles SET is_admin = true, admin_role = 'read_only_admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'viewer@example.com');

-- ▸ Revoke admin access entirely:
-- UPDATE profiles SET is_admin = false, admin_role = NULL
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');


-- ████████████████████████████████████████████████████████████
-- SECTION 4: ANALYTICS / REPORTING QUERIES
-- ████████████████████████████████████████████████████████████

-- ▸ Total visitors count:
-- SELECT COUNT(*) AS total_visits FROM site_visitors;

-- ▸ Unique visitors (by fingerprint):
-- SELECT COUNT(DISTINCT visitor_fingerprint) AS unique_visitors FROM site_visitors WHERE visitor_fingerprint != '';

-- ▸ Visitors today:
-- SELECT COUNT(*) AS today_visits FROM site_visitors WHERE visited_at >= CURRENT_DATE;

-- ▸ Logged-in vs anonymous:
-- SELECT is_logged_in, COUNT(*) AS cnt FROM site_visitors GROUP BY is_logged_in;

-- ▸ Top referrers:
-- SELECT referrer_url, COUNT(*) AS cnt FROM site_visitors WHERE referrer_url != '' GROUP BY referrer_url ORDER BY cnt DESC LIMIT 10;

-- ▸ Top browsers:
-- SELECT browser, COUNT(*) AS cnt FROM site_visitors GROUP BY browser ORDER BY cnt DESC LIMIT 10;

-- ▸ Top pages:
-- SELECT page_url, COUNT(*) AS cnt FROM site_visitors GROUP BY page_url ORDER BY cnt DESC LIMIT 10;

-- ▸ Traffic by device type:
-- SELECT device_type, COUNT(*) AS cnt FROM site_visitors GROUP BY device_type ORDER BY cnt DESC;

-- ▸ Traffic by country:
-- SELECT country, COUNT(*) AS cnt FROM site_visitors WHERE country != '' GROUP BY country ORDER BY cnt DESC LIMIT 15;

-- ▸ UTM campaign performance:
-- SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS cnt
-- FROM site_visitors WHERE utm_source != ''
-- GROUP BY utm_source, utm_medium, utm_campaign ORDER BY cnt DESC;

-- ▸ Daily visitor trend (last 30 days):
-- SELECT DATE(visited_at) AS visit_date, COUNT(*) AS daily_visits
-- FROM site_visitors WHERE visited_at >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY visit_date ORDER BY visit_date;

-- ▸ View all admin users:
-- SELECT p.display_name, p.is_admin, p.admin_role, u.email
-- FROM profiles p JOIN auth.users u ON u.id = p.id
-- WHERE p.is_admin = true ORDER BY p.admin_role;
