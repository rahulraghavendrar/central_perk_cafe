'use client'

import { useState } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'
import { useCart } from '@/app/components/CartContext'
import styles from './cart.module.css'

export default function CartPage() {
  const { user, profile, loading } = useAuthSession()
  const [parcel, setParcel] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')

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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place order')
      }

      setOrderMessage(
        `Order confirmed! Your Order ID is ${data.orderId}`
      )

      clearCart()
      setParcel(false)
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
            <p className={styles.subtitle}>
              Add items from the menu to see them here.
            </p>

            {orderMessage && (
              <p
                style={{
                  marginTop: '12px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#2e7d32',
                  fontSize: '18px',
                }}
              >
                {orderMessage}
              </p>
            )}

            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🛒</div>
              <h2>Your cart is empty</h2>
              <p>Add items from the menu to see them here.</p>
            </div>
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
                <p style={{ marginTop: '12px', textAlign: 'center' }}>
                  {orderMessage}
                </p>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}