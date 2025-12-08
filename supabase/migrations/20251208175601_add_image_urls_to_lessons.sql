/*
  # Add image URLs to lessons

  1. Changes
    - Add `image_urls` column to `lessons` table to store relevant image URLs for each lesson
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE lessons ADD COLUMN image_urls text[] DEFAULT '{}';
  END IF;
END $$;