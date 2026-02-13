-- Add solution column to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution TEXT DEFAULT '';
