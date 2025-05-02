import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create a more robust Supabase client with better error handling
let supabase: SupabaseClient;

// Only initialize the client on the client side
if (typeof window !== 'undefined') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (supabaseUrl && supabaseAnonKey) {
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log('Supabase client initialized successfully');
    } catch (error) {
      console.error('Error initializing Supabase client:', error);
      // Provide a dummy client that won't crash the app
      supabase = createDummyClient();
    }
  } else {
    console.error('Supabase credentials not available. URL:', supabaseUrl ? 'Set' : 'Not set', 'Key:', supabaseAnonKey ? 'Set' : 'Not set');
    // Provide a dummy client that won't crash the app
    supabase = createDummyClient();
  }
} else {
  // Server-side - provide a dummy client
  supabase = createDummyClient();
}

// Create a dummy client that won't crash the app
function createDummyClient(): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: null, error: { message: 'Dummy client used' } })
        }),
        eq: () => Promise.resolve({ data: null, error: { message: 'Dummy client used' } }),
        in: () => Promise.resolve({ data: null, error: { message: 'Dummy client used' } }),
        limit: () => Promise.resolve({ data: null, error: { message: 'Dummy client used' } })
      }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Dummy client used' } }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: { message: 'Dummy client used' } })
      }),
      delete: () => ({
        in: () => Promise.resolve({ data: null, error: { message: 'Dummy client used' } }),
        eq: () => Promise.resolve({ data: null, error: { message: 'Dummy client used' } })
      })
    }),
    // Add other required methods as needed
  } as unknown as SupabaseClient;
}

export { supabase };
