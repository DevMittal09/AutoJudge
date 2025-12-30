import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// This creates a Supabase client for "client-side" components
// (like your signup and login forms)
export const createClient = () =>
  createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  })

