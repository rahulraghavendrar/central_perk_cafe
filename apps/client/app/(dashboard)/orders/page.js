'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthSession } from '@/lib/useAuthSession'
import styles from './orders.module.css'

const POLL_INTERVAL_MS = 15000

function formatReadyTime(iso) {
  if (!iso) return 'As soon as possible'
  return `Ready by ${new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

function formatCreatedAt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function itemLineTotal(item) {
  const extrasTotal = (item.extras || []).reduce(
    (total, extra) =>
      total + Number(typeof extra === 'object' ? extra.price || 0 : 0),
    0
  )
  return (Number(item.price || 0) + extrasTotal) * (item.quantity || 0)
}

function countItems(order) {
  return (order.items || []).reduce(
    (total, item) => total + (item.quantity || 0),
    0
  )
}

// Wrapped in Suspense because useSearchParams() (reading the ?active=
// deep link from the tracker) requires it during prerendering.
export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageContent />
    </Suspense>
  )
}

function OrdersPageContent() {
  const searchParams = useSearchParams()
  const deepLinkOrderId = searchParams.get('active')
  const { profile, loading: authLoading } = useAuthSession()

  // /api/orders/mine only ever returns LIVE (still-preparing) orders --
  // once one's prep window passes it simply stops coming back, and it
  // falls out of this list on its own. Order history (completed/collected
  // orders) belongs on a future Account page, not here.
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [loading, setLoading] = useState(true)

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
        if (!active) return

        const fetchedOrders = data.orders || []
        setOrders(fetchedOrders)

        // Pick a tab the first time orders load: the one the tracker
        // linked to, if it's still live, otherwise the most recent.
        setSelectedOrderId((current) => {
          if (current && fetchedOrders.some((o) => o.orderId === current)) {
            return current
          }

          if (
            deepLinkOrderId &&
            fetchedOrders.some((o) => o.orderId === deepLinkOrderId)
          ) {
            return deepLinkOrderId
          }

          return fetchedOrders[0]?.orderId || null
        })
      } catch (error) {
        console.error('Fetching orders failed:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchOrders()

    const interval = setInterval(fetchOrders, POLL_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [profile, deepLinkOrderId])

  if (authLoading || loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p>Loading your orders...</p>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>CENTRAL PERK CAFE</p>
          <h1>No live orders</h1>
          <p className={styles.intro}>
            You don&apos;t have any orders in progress right now.
          </p>
          <Link href="/home" className={styles.browseButton}>
            Browse the Menu
          </Link>
        </div>
      </div>
    )
  }

  const selectedOrder =
    orders.find((order) => order.orderId === selectedOrderId) || orders[0]
  const otherOrders = orders.filter(
    (order) => order.orderId !== selectedOrder.orderId
  )
  const itemCount = countItems(selectedOrder)

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>CENTRAL PERK CAFE</p>
          <h1>Your Order</h1>

          <div className={styles.statusBlock}>
            <div className={styles.orderNumber}>
              {selectedOrder.orderNumberDisplay || `#${selectedOrder.orderNumber ?? ''}`}
            </div>

            <span className={styles.statusBadge}>Preparing</span>

            <p className={styles.readyLabel}>
              {formatReadyTime(selectedOrder.readyTime)}
            </p>

            {selectedOrder.createdAt && (
              <p className={styles.placedAt}>
                Placed {formatCreatedAt(selectedOrder.createdAt)}
              </p>
            )}
          </div>

          {selectedOrder.qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedOrder.qrCode}
              alt={`QR code for order ${selectedOrder.orderNumberDisplay}`}
              className={styles.qrCode}
            />
          )}

          <p className={styles.sectionLabel}>
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </p>

          <div className={styles.itemList}>
            {(selectedOrder.items || []).map((item, index) => (
              <div key={item.id || index} className={styles.itemRow}>
                <div className={styles.itemInfo}>
                  <h2>{item.name || item.dish_name}</h2>

                  {item.toppings?.length > 0 && (
                    <p>Toppings: {item.toppings.join(', ')}</p>
                  )}

                  {item.extras?.length > 0 && (
                    <p>
                      Extras:{' '}
                      {item.extras
                        .map((extra) =>
                          typeof extra === 'string'
                            ? extra
                            : `${extra.name} (+₹${Number(extra.price || 0).toFixed(2)})`
                        )
                        .join(', ')}
                    </p>
                  )}

                  <p className={styles.itemUnitPrice}>
                    ₹{(itemLineTotal(item) / (item.quantity || 1)).toFixed(2)} each
                  </p>
                </div>

                <div className={styles.itemRight}>
                  <span className={styles.itemQuantity}>x{item.quantity}</span>
                  <span className={styles.itemLineTotal}>
                    ₹{itemLineTotal(item).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.summary}>
            <div>
              <span>Parcel</span>
              <strong>{selectedOrder.parcel ? 'Yes (+₹5.00)' : 'No'}</strong>
            </div>

            <div className={styles.totalRow}>
              <span>Total</span>
              <strong>₹{Number(selectedOrder.total || 0).toFixed(2)}</strong>
            </div>
          </div>

          <p className={styles.orderIdLine}>Order ID: {selectedOrder.orderId}</p>

          <Link href="/home" className={styles.browseButton}>
            Order Something Else
          </Link>
        </div>

        {otherOrders.length > 0 && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCurrent}>
              <span className={styles.sidebarCurrentLabel}>Viewing</span>
              <span className={styles.sidebarCurrentNumber}>
                {selectedOrder.orderNumberDisplay || `#${selectedOrder.orderNumber ?? ''}`}
              </span>
            </div>

            <p className={styles.sidebarHeading}>Track other live orders</p>

            <div className={styles.sidebarButtons}>
              {otherOrders.map((order) => (
                <button
                  key={order.orderId}
                  type="button"
                  className={styles.sidebarButton}
                  onClick={() => setSelectedOrderId(order.orderId)}
                >
                  <span className={styles.sidebarButtonNumber}>
                    {order.orderNumberDisplay || `#${order.orderNumber ?? ''}`}
                  </span>
                  <span className={styles.sidebarButtonMeta}>
                    {countItems(order)} item{countItems(order) === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
