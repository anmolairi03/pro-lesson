/*
  # Add DELETE policy for lessons table
  
  1. Security
    - Add policy to allow deletion of lessons
*/

CREATE POLICY "Anyone can delete lessons"
  ON lessons FOR DELETE
  USING (true);