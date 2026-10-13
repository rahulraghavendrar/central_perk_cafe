'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthSession } from '@/lib/useAuthSession'
import styles from './OrderTracker.module.css'

const POLL_INTERVAL_MS = 20000

// Floating bottom-right widget shown on every dashboard page (Home, Cart,
// Account) whenever the signed-in student has at least one live order.
// /api/orders/mine is already scoped to live ('Preparing') orders only, so
// nothing needs filtering here -- once an order's prep window passes (see
// lib/orderStatus.js) it simply stops coming back from that endpoint, and
// the widget disappears on its own without ever having tracked that it
// should "forget" a specific order.
//
// It polls on an interval so it eventually reflects an admin-side pickup
// (once that exists) without the student refreshing, and it also listens
// for a same-tab 'order-placed' event so a freshly confirmed order appears
// immediately instead of waiting for the next poll. The fetch function is
// defined inline inside the effect (same pattern as useAuthSession's
// loadUser), not pulled out via useCallback -- a useCallback here doesn't
// survive the React Compiler's memoization check cleanly against a
// drilled dependency like profile?.roll_number.
export default function OrderTracker() {
  const router = useRouter()
  const { profile } = useAuthSession()
  const [liveOrders, setLiveOrders] = useState([])

  useEffect(() => {
    if (!profile?.roll_number) return

    let active = true

    async function fetchOrders() {
      try {
        const response = await fetch(
          `/api/orders/mine?studentId=${encodeURIComponent(profile.roll_number)}`
        )

        if (!response.ok) return

        const data = await response.json()
        if (active) setLiveOrders(data.orders || [])
      } catch (error) {
        console.error('Fetching orders failed:', error)
      }
    }

    fetchOrders()

    const interval = setInterval(fetchOrders, POLL_INTERVAL_MS)
    window.addEventListener('order-placed', fetchOrders)

    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('order-placed', fetchOrders)
    }
  }, [profile])

  if (liveOrders.length === 0) return null

  const latest = liveOrders[0]
  const itemCount = (latest.items || []).reduce(
    (total, item) => total + (item.quantity || 0),
    0
  )
  const moreCount = liveOrders.length - 1

  return (
    <button
      type="button"
      className={styles.tracker}
      onClick={() => router.push(`/orders?active=${latest.orderId}`)}
    >
      <span className={styles.trackerNumber}>
        {latest.orderNumberDisplay || `#${latest.orderNumber ?? ''}`}
      </span>

      <span className={styles.trackerDetails}>
        <span className={styles.trackerStatus}>Preparing</span>
        <span className={styles.trackerMeta}>
          {itemCount} item{itemCount === 1 ? '' : 's'}
          {moreCount > 0 && ` · +${moreCount} more`}
        </span>
      </span>
    </button>
  )
}
