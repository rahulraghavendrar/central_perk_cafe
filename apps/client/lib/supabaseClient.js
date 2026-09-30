import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    'Warning: Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to apps/client/.env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Creates a fresh, stateless Supabase client (anon key) for a one-off
 * server-side credential check, e.g. verifying a login password inside
 * an API route. Deliberately NOT the shared `supabase` singleton above:
 * that singleton's auth state persists between calls, and Next.js's
 * server reuses the same module instance across requests -- so calling
 * signInWithPassword() on it from a route handler would leak one
 * request's signed-in identity into other, unrelated concurrent
 * requests on the same server process. A fresh client per call avoids
 * that entirely (see the same reasoning for why supabaseAdmin is never
 * used for this either, in app/api/auth/login/route.js).
 */
export function createAuthCheckClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}