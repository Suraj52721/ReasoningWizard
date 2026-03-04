-- ============================================================
-- ReasoningWizard — Admin Roles Migration
-- Run this in the Supabase SQL Editor AFTER the admin migration
-- Adds read-only admin support
-- ============================================================

-- 1. Add admin_role column to profiles
-- Values: 'super_admin', 'read_only_admin', or NULL (defaults to super_admin behavior if is_admin = true)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT NULL;

-- 2. Update existing admins to have explicit super_admin role
UPDATE profiles SET admin_role = 'super_admin' WHERE is_admin = true AND admin_role IS NULL;

-- 3. Create a function to check if user is a write-capable admin
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

-- ============================================================
-- HELPER QUERIES (run manually as needed)
-- ============================================================

-- Grant read-only admin access to a user by email:
-- UPDATE profiles SET is_admin = true, admin_role = 'read_only_admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'readonly@example.com');

-- Grant super admin access to a user by email:
-- UPDATE profiles SET is_admin = true, admin_role = 'super_admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');

-- Revoke admin access:
-- UPDATE profiles SET is_admin = false, admin_role = NULL
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- View all admins:
-- SELECT p.id, p.display_name, p.is_admin, p.admin_role, u.email
-- FROM profiles p
-- JOIN auth.users u ON u.id = p.id
-- WHERE p.is_admin = true;
