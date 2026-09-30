'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// Shared session guard for pages behind the navbar (Home, Cart, Account).
// Redirects to /login if there is no session, otherwise loads the caller's
// profile row alongside the auth user.
export function useAuthSession() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      if (!active) return
      setUser(session.user)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!active) return
      if (prof) setProfile(prof)
      setLoading(false)
    }

    loadUser()

    return () => {
      active = false
    }
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return { user, profile, loading, logout }
}
