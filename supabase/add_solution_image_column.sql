-- Add solution_image column to questions table to store image URLs for solutions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution_image TEXT DEFAULT '';
