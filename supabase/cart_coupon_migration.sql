-- ============================================================
-- ReasoningWizard — Cart & Coupon Codes Migration
-- Run this in the Supabase SQL Editor
-- This script is idempotent and safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Coupon Codes Table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupon_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  INT NOT NULL DEFAULT 0,   -- percentage (0-100) or pence amount
  max_uses        INT DEFAULT NULL,          -- NULL = unlimited uses
  current_uses    INT DEFAULT 0,
  min_cart_pence  INT DEFAULT 0,             -- minimum cart value to apply coupon
  expires_at      TIMESTAMPTZ DEFAULT NULL,  -- NULL = never expires
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (idempotent)
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'percentage';
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS discount_value INT NOT NULL DEFAULT 0;
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS max_uses INT DEFAULT NULL;
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS current_uses INT DEFAULT 0;
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS min_cart_pence INT DEFAULT 0;
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON public.coupon_codes (code);

-- ────────────────────────────────────────────────────────────
-- 2. RLS Policies
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can read coupons (for code validation at checkout)
DROP POLICY IF EXISTS "Public read coupon_codes" ON public.coupon_codes;
CREATE POLICY "Public read coupon_codes"
  ON public.coupon_codes FOR SELECT USING (true);

-- Only write-admins can manage coupons
DROP POLICY IF EXISTS "Write admins manage coupon_codes" ON public.coupon_codes;
CREATE POLICY "Write admins manage coupon_codes"
  ON public.coupon_codes FOR ALL
  USING (public.is_write_admin())
  WITH CHECK (public.is_write_admin());

-- ────────────────────────────────────────────────────────────
-- 3. Chat Messages Table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL CHECK (sender IN ('user', 'admin')),
  message         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages (user_id, created_at);

-- RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read & insert their own messages
DROP POLICY IF EXISTS "Users manage own chat" ON public.chat_messages;
CREATE POLICY "Users manage own chat"
  ON public.chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND sender = 'user');

-- Admins can read and insert for any user
DROP POLICY IF EXISTS "Admins manage all chat" ON public.chat_messages;
CREATE POLICY "Admins manage all chat"
  ON public.chat_messages FOR ALL
  USING (public.is_write_admin())
  WITH CHECK (public.is_write_admin());

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
