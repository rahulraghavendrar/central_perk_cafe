'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import styles from './home.module.css'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (prof) {
        setProfile(prof)
      }
      setLoading(false)
    }

    loadUser()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p>Loading Central Perk Cafe...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Central Perk Cafe</div>
        <h1>Welcome, {profile?.name || user?.email?.split('@')[0] || 'Friend'}!</h1>
        <p className={styles.intro}>
          You are logged in with college email: <strong>{user?.email}</strong>
        </p>

        {profile && (
          <div className={styles.details}>
            <div className={styles.detailRow}>
              <span>Roll Number:</span> <strong>{profile.roll_number}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Phone:</span> <strong>{profile.phone_number}</strong>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
