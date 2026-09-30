'use client'

import { useAuthSession } from '@/lib/useAuthSession'
import styles from './cart.module.css'

export default function CartPage() {
  const { loading } = useAuthSession()

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p>Loading your cart...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Central Perk Cafe</div>
        <h1>Your Cart</h1>
        <p className={styles.intro}>
          Nothing here yet -- once ordering opens up, items you add from the menu will show up on this page.
        </p>

        <div className={styles.placeholder}>
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={styles.placeholderIcon}>
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="18" cy="20" r="1.4" />
            <path d="M2.5 3h2.2l2.4 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6l1.5-7.6H6.1" />
          </svg>
          <p>Your cart is empty</p>
          <span>Add items from the menu to see them here.</span>
        </div>
      </div>
    </div>
  )
}
