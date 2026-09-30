'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './page.module.css'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function redirect() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      router.replace(session ? '/home' : '/login')
    }

    redirect()

    return () => {
      active = false
    }
  }, [router])

  return (
    <div className={styles.page}>
      <p>Loading Central Perk Cafe...</p>
    </div>
  )
}
