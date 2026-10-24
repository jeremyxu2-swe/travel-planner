import { createClient } from '@supabase/supabase-js';

// Set these in .env.local (see README). Without them the app runs in
// "this browser only" mode, exactly as before.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
