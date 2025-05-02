import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use a dynamic import approach to ensure this only runs on the client side
let supabase: SupabaseClient;

// Only initialize the client on the client side
if (typeof window !== 'undefined') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    console.error('Supabase credentials not available');
    // Provide a dummy client that does nothing
    supabase = {} as SupabaseClient;
  }
} else {
  // Server-side - provide a dummy client
  supabase = {} as SupabaseClient;
}

export { supabase };
