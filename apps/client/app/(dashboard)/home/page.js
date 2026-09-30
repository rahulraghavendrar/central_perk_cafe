'use client'

import { useAuthSession } from '@/lib/useAuthSession'
import styles from './home.module.css'

export default function HomePage() {
  const { user, profile, loading, logout } = useAuthSession()

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

        <div className={styles.comingSoon}>
          <span className={styles.comingSoonDot} />
          The menu, search, and filters land here next.
        </div>

        <div className={styles.actions}>
          <button onClick={logout} className={styles.logoutButton}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
