'use client'

import { useAuthSession } from '@/lib/useAuthSession'
import styles from './account.module.css'

export default function AccountPage() {
  const { user, profile, loading, logout } = useAuthSession()

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p>Loading your account...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Central Perk Cafe</div>
        <h1>Account</h1>
        <p className={styles.intro}>
          Profile editing, order history, and saved details land here later. For now, here&apos;s what we have on file.
        </p>

        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span>Email:</span> <strong>{user?.email}</strong>
          </div>
          {profile?.name && (
            <div className={styles.detailRow}>
              <span>Name:</span> <strong>{profile.name}</strong>
            </div>
          )}
          {profile?.roll_number && (
            <div className={styles.detailRow}>
              <span>Roll Number:</span> <strong>{profile.roll_number}</strong>
            </div>
          )}
          {profile?.phone_number && (
            <div className={styles.detailRow}>
              <span>Phone:</span> <strong>{profile.phone_number}</strong>
            </div>
          )}
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
