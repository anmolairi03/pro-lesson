/*
  # Create lessons table for digital lesson generator

  1. New Tables
    - `lessons`
      - `id` (uuid, primary key) - Unique identifier for each lesson
      - `title` (text) - Lesson title extracted from outline
      - `outline` (text) - User-provided lesson outline/prompt
      - `content` (text) - AI-generated TypeScript lesson content
      - `status` (text) - Generation status: 'generating' or 'generated'
      - `created_at` (timestamptz) - Timestamp of lesson creation
      - `error_message` (text, nullable) - Error details if generation fails
      
  2. Security
    - Enable RLS on `lessons` table
    - Add policy for public read access (no auth required)
    - Add policy for public insert access (no auth required)
    - Add policy for public update access (no auth required)
    
  3. Indexes
    - Index on created_at for efficient sorting
    - Index on status for filtering
*/

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  outline text NOT NULL,
  content text DEFAULT '',
  status text NOT NULL DEFAULT 'generating',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Public read policy (anyone can view lessons)
CREATE POLICY "Anyone can read lessons"
  ON lessons
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public insert policy (anyone can create lessons)
CREATE POLICY "Anyone can create lessons"
  ON lessons
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Public update policy (anyone can update lessons - needed for status updates)
CREATE POLICY "Anyone can update lessons"
  ON lessons
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON lessons(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);