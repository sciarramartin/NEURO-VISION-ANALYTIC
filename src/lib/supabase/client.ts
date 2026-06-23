import { createClient } from '@supabase/supabase-js';

// Fallback placeholders prevent Next.js compilation crashes during static page generation.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase URL or Anon Key is missing in env files. Running database client in offline/placeholder mode.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
