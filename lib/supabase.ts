import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Lesson = {
  id: string;
  title: string;
  outline: string;
  content: string;
  status: 'generating' | 'generated' | 'error';
  error_message: string | null;
  created_at: string;
};
