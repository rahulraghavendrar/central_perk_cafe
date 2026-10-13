'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuthSession } from '@/lib/useAuthSession'
import { useCart } from '@/app/components/CartContext'
import styles from './cart.module.css'

// Earliest a student can choose as a ready time -- now plus a 10 minute
// prep buffer. Recomputed periodically (see the interval above) so it stays
// accurate if the cart tab is left open for a while.
const PREP_BUFFER_MINUTES = 10

function getMinReadyTime() {
  const d = new Date(Date.now() + PREP_BUFFER_MINUTES * 60 * 1000)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// Turns an "HH:MM" string (today, in the browser's local time) into an
// absolute ISO timestamp to send to the server.
function buildReadyTimestamp(timeString) {
  if (!timeString) return null
  const [hours, minutes] = timeString.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

function formatReadyTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function CartPage() {
  const { user, profile, loading } = useAuthSession()
  const [parcel, setParcel] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')

  // Ready time: 'asap' or 'scheduled'. When scheduled, readyTime holds an
  // "HH:MM" string from the <input type="time">. The server is the real
  // guard against a past time (it uses its own clock, never the browser's),
  // this min/validation here is just so the user gets instant feedback.
  const [readyMode, setReadyMode] = useState('asap')
  const [readyTime, setReadyTime] = useState('')
  const [minReadyTime, setMinReadyTime] = useState(() => getMinReadyTime())

  // Set once an order is confirmed: the short daily order number, the QR
  // code, and the real order ID, shown on a confirmation card in place of
  // the plain empty-cart state. This page has no way to add a new item
  // without navigating to /home first (only inc/dec/remove of lines
  // already in the cart), and that navigation unmounts this component --
  // so there's no in-place path back to a non-empty cart that would need
  // this cleared manually; a fresh visit to /cart always starts at null.
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setMinReadyTime(getMinReadyTime())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const {
    cartItems,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    subtotal,
    clearCart,
  } = useCart()

  const parcelCharge = parcel ? 5 : 0
  const total = subtotal + parcelCharge

  const handleConfirmOrder = async () => {
    if (!profile?.roll_number) {
      setOrderMessage('Unable to find your roll number.')
      return
    }

    if (cartItems.length === 0) {
      setOrderMessage('Your cart is empty.')
      return
    }

    let readyTimestamp = null

    if (readyMode === 'scheduled') {
      if (!readyTime) {
        setOrderMessage('Please choose a ready time, or switch to ASAP.')
        return
      }

      readyTimestamp = buildReadyTimestamp(readyTime)

      if (!readyTimestamp || new Date(readyTimestamp).getTime() <= Date.now()) {
        setOrderMessage(
          'That ready time has already passed -- please pick a later time.'
        )
        return
      }
    }

    setConfirming(true)
    setOrderMessage('')

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: profile.roll_number,
          items: cartItems,
          total,
          parcel,
          readyTime: readyTimestamp,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place order')
      }

      const readyLabel = readyTimestamp
        ? `Ready by ${formatReadyTime(readyTimestamp)}`
        : 'Ready as soon as possible'

      setConfirmedOrder({
        orderId: data.orderId,
        orderNumberDisplay: data.orderNumberDisplay || `#${data.orderNumber ?? ''}`,
        readyLabel,
      })

      // Lets the floating order tracker (mounted once in the dashboard
      // layout, so it has no direct line to this page's state) refresh
      // immediately instead of waiting for its next poll.
      window.dispatchEvent(new CustomEvent('order-placed'))

      clearCart()
      setParcel(false)
      setReadyMode('asap')
      setReadyTime('')
    } catch (error) {
      console.error('Order confirmation failed:', error)
      setOrderMessage(
        error.message || 'Failed to confirm order. Please try again.'
      )
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>CENTRAL PERK CAFE</p>

        <h1>Your Cart</h1>

        {cartItems.length === 0 ? (
          <>
            {confirmedOrder ? (
              <div className={styles.confirmation}>
                <p className={styles.confirmationEyebrow}>Order confirmed</p>

                <div className={styles.orderNumber}>
                  {confirmedOrder.orderNumberDisplay}
                </div>

                <p className={styles.confirmationReady}>
                  {confirmedOrder.readyLabel}
                </p>

                <p className={styles.confirmationHint}>
                  Track your order&apos;s status and show the QR code at the
                  counter from the order page.
                </p>

                <div className={styles.confirmationActions}>
                  <Link
                    href={`/orders?active=${confirmedOrder.orderId}`}
                    className={styles.browseButton}
                  >
                    Track Your Order
                  </Link>

                  <Link
                    href="/home"
                    className={styles.secondaryButton}
                  >
                    Order Something Else
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {orderMessage && (
                  <p className={styles.orderMessageNotice}>{orderMessage}</p>
                )}

                <div className={styles.empty}>
                  <svg
                    className={styles.emptyIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="20" r="1.4" />
                    <circle cx="18" cy="20" r="1.4" />
                    <path d="M2.5 3h2l2.2 11.6a2 2 0 0 0 2 1.65h8.26a2 2 0 0 0 1.97-1.64L20.5 7.5H6.1" />
                  </svg>
                  <h2>Your cart is empty</h2>
                  <p>Add items from the menu to see them here.</p>
                  <Link href="/home" className={styles.browseButton}>
                    Browse the Menu
                  </Link>
                </div>
              </>
            )}
          </>
        ) : (
            <>
            <p className={styles.subtitle}>
              Review your items before placing your order.
            </p>

            <div className={styles.cartList}>
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className={styles.cartItem}
                >
                  <div className={styles.itemInfo}>
                    <h2>{item.name || item.dish_name}</h2>

                    <p>
                      Base: ₹{Number(item.price || 0).toFixed(2)}
                    </p>

                    {item.toppings?.length > 0 && (
                      <p>
                        Toppings: {item.toppings.join(', ')}
                      </p>
                    )}

                    {item.extras?.length > 0 && (
                      <p>
                        Extras:{' '}
                        {item.extras
                          .map((extra) => {
                            if (typeof extra === 'string') {
                              return extra
                            }

                            return `${extra.name} (+₹${Number(
                              extra.price || 0
                            ).toFixed(2)})`
                          })
                          .join(', ')}
                      </p>
                    )}
                  </div>

                  <div className={styles.quantityControls}>
                    <button
                      onClick={() => decreaseQuantity(item.id)}
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() => increaseQuantity(item.id)}
                    >
                      +
                    </button>
                  </div>

                  <div className={styles.itemTotal}>
                    ₹
                    {(
                      (
                        Number(item.price || 0) +
                        (item.extras || []).reduce(
                          (extraTotal, extra) =>
                            extraTotal +
                            Number(
                              typeof extra === 'object'
                                ? extra.price || 0
                                : 0
                            ),
                          0
                        )
                      ) * item.quantity
                    ).toFixed(2)}
                  </div>

                  <button
                    className={styles.removeButton}
                    onClick={() => removeFromCart(item.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.summary}>
              <div>
                <span>Subtotal</span>
                <strong>₹{subtotal.toFixed(2)}</strong>
              </div>

              <label className={styles.parcelOption}>
                <span>
                  <strong>Parcel</strong>
                  <small>Add ₹5 packing charge</small>
                </span>

                <input
                  type="checkbox"
                  checked={parcel}
                  onChange={(e) => setParcel(e.target.checked)}
                />
              </label>

              <div className={styles.parcelRow}>
                <span>Parcel Charge</span>
                <strong>₹{parcelCharge.toFixed(2)}</strong>
              </div>

              <div className={styles.readySection}>
                <div className={styles.readyLabel}>
                  <strong>Ready Time</strong>
                  <small>When should this be ready for pickup?</small>
                </div>

                <div className={styles.readyToggle}>
                  <button
                    type="button"
                    className={`${styles.readyToggleButton} ${
                      readyMode === 'asap' ? styles.readyToggleButtonActive : ''
                    }`}
                    onClick={() => setReadyMode('asap')}
                  >
                    ASAP
                  </button>

                  <button
                    type="button"
                    className={`${styles.readyToggleButton} ${
                      readyMode === 'scheduled'
                        ? styles.readyToggleButtonActive
                        : ''
                    }`}
                    onClick={() => {
                      setReadyMode('scheduled')
                      setReadyTime((current) => current || minReadyTime)
                    }}
                  >
                    Schedule a time
                  </button>
                </div>

                <div
                  className={`${styles.readyPanel} ${
                    readyMode === 'scheduled' ? styles.readyPanelOpen : ''
                  }`}
                >
                  <div className={styles.readyPanelInner}>
                    <input
                      type="time"
                      className={styles.timeInput}
                      value={readyTime}
                      min={minReadyTime}
                      onChange={(e) => setReadyTime(e.target.value)}
                    />
                    <small className={styles.readyHint}>
                      Earliest pickup: {formatReadyTime(
                        buildReadyTimestamp(minReadyTime)
                      )}
                    </small>
                  </div>
                </div>
              </div>

              <div className={styles.totalRow}>
                <span>Total</span>
                <strong>₹{total.toFixed(2)}</strong>
              </div>

              <button
                className={styles.confirmButton}
                onClick={handleConfirmOrder}
                disabled={confirming}
              >
                {confirming ? 'Confirming...' : 'Confirm Order'}
              </button>

              {orderMessage && (
                <p className={styles.orderMessageNotice}>{orderMessage}</p>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}