'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthSession } from '@/lib/useAuthSession'
import {
  formatReadyTime,
  itemLineTotal,
  countItems,
} from '@/lib/orderFormat'
import { describeUserAgent } from '@/lib/userAgent'
import styles from './account.module.css'

const STATUS_LABELS = {
  Preparing: 'Preparing',
  Completed: 'Completed',
  Collected: 'Collected',
}

const STATUS_CLASS = {
  Preparing: '',
  Completed: 'statusCompleted',
  Collected: 'statusCollected',
}

const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'profile', label: 'Profile' },
]

export default function AccountPage() {
  const { user, profile, loading, logout } = useAuthSession()
  const [activeTab, setActiveTab] = useState('orders')

  // --- Order history (every order this student has ever placed) ---
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  useEffect(() => {
    if (!profile?.roll_number) return

    let active = true

    async function fetchHistory() {
      try {
        const response = await fetch(
          `/api/orders/history?studentId=${encodeURIComponent(profile.roll_number)}`
        )

        if (!response.ok) return

        const data = await response.json()
        if (!active) return

        setOrders(data.orders || [])
      } catch (error) {
        console.error('Fetching order history failed:', error)
      } finally {
        if (active) setOrdersLoading(false)
      }
    }

    fetchHistory()

    return () => {
      active = false
    }
  }, [profile])

  // --- Trusted devices (surfaced from the login flow's own tracking --
  // see apps/client/app/api/auth/login/route.js) ---
  const [devices, setDevices] = useState([])
  const [devicesLoading, setDevicesLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return

    let active = true

    async function fetchDevices() {
      try {
        const response = await fetch(
          `/api/account/devices?userId=${encodeURIComponent(profile.id)}`
        )

        if (!response.ok) return

        const data = await response.json()
        if (!active) return

        setDevices(data.devices || [])
      } catch (error) {
        console.error('Fetching devices failed:', error)
      } finally {
        if (active) setDevicesLoading(false)
      }
    }

    fetchDevices()

    return () => {
      active = false
    }
  }, [profile])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <p>Loading your account...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.header}>
          <div className={styles.headerName}>{profile?.name || 'My Account'}</div>
          <div className={styles.headerMeta}>
            {profile?.phone_number && <span>{profile.phone_number}</span>}
            {profile?.phone_number && user?.email && (
              <span className={styles.headerDot}>&middot;</span>
            )}
            {user?.email && <span>{user.email}</span>}
          </div>
        </div>

        <div className={styles.body}>
          <aside className={styles.sidebar}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.sidebarItem} ${
                  activeTab === tab.key ? styles.sidebarItemActive : ''
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}

            <button onClick={logout} className={styles.logoutButton}>
              Log Out
            </button>
          </aside>

          <div className={styles.content}>
            {activeTab === 'orders' ? (
              <OrdersTab
                orders={orders}
                loading={ordersLoading}
                expandedOrderId={expandedOrderId}
                setExpandedOrderId={setExpandedOrderId}
              />
            ) : (
              <ProfileTab
                user={user}
                profile={profile}
                devices={devices}
                devicesLoading={devicesLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function OrdersTab({ orders, loading, expandedOrderId, setExpandedOrderId }) {
  return (
    <div>
      <h2 className={styles.contentHeading}>Past Orders</h2>

      {loading ? (
        <p className={styles.intro}>Loading your orders...</p>
      ) : orders.length === 0 ? (
        <p className={styles.intro}>No orders yet.</p>
      ) : (
        <div className={styles.historyList}>
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.orderId
            const itemCount = countItems(order)

            return (
              <div key={order.orderId} className={styles.historyItem}>
                <button
                  type="button"
                  className={styles.historyRow}
                  onClick={() =>
                    setExpandedOrderId(isExpanded ? null : order.orderId)
                  }
                >
                  <span className={styles.historyNumber}>
                    {order.orderNumberDisplay || `#${order.orderNumber ?? ''}`}
                  </span>

                  <span className={styles.historyMeta}>
                    {new Date(order.createdAt).toLocaleString([], {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    &middot; {itemCount} item{itemCount === 1 ? '' : 's'}
                  </span>

                  <span
                    className={`${styles.historyStatus} ${
                      styles[STATUS_CLASS[order.effectiveStatus]] || ''
                    }`}
                  >
                    {STATUS_LABELS[order.effectiveStatus] || order.effectiveStatus}
                  </span>

                  <span className={styles.historyTotal}>
                    ₹{Number(order.total || 0).toFixed(2)}
                  </span>

                  <span className={styles.historyChevron}>
                    {isExpanded ? '−' : '+'}
                  </span>
                </button>

                {isExpanded && (
                  <div className={styles.historyDetails}>
                    <p className={styles.historyReady}>
                      {formatReadyTime(order.readyTime)}
                    </p>

                    <div className={styles.historyItemList}>
                      {(order.items || []).map((item, index) => (
                        <div key={item.id || index} className={styles.historyItemRow}>
                          <span>
                            {item.name || item.dish_name} x{item.quantity}
                          </span>
                          <span>₹{itemLineTotal(item).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className={styles.historySummary}>
                      <span>Parcel</span>
                      <strong>{order.parcel ? 'Yes (+₹5.00)' : 'No'}</strong>
                    </div>

                    <p className={styles.historyOrderId}>Order ID: {order.orderId}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProfileTab({ user, profile, devices, devicesLoading }) {
  return (
    <div>
      <h2 className={styles.contentHeading}>Profile</h2>

      <div className={styles.profileList}>
        <div className={styles.profileRow}>
          <div className={styles.profileText}>
            <span className={styles.profileLabel}>Email</span>
            <span className={styles.profileValue}>{user?.email}</span>
          </div>
        </div>

        {profile?.name && (
          <div className={styles.profileRow}>
            <div className={styles.profileText}>
              <span className={styles.profileLabel}>Name</span>
              <span className={styles.profileValue}>{profile.name}</span>
            </div>
          </div>
        )}

        {profile?.roll_number && (
          <div className={styles.profileRow}>
            <div className={styles.profileText}>
              <span className={styles.profileLabel}>Roll Number</span>
              <span className={styles.profileValue}>{profile.roll_number}</span>
            </div>
          </div>
        )}

        <div className={styles.profileRow}>
          <div className={styles.profileText}>
            <span className={styles.profileLabel}>Phone Number</span>
            <span className={styles.profileValue}>
              {profile?.phone_number || 'Not set'}
            </span>
          </div>
          <Link href="/account/phone" className={styles.editLink}>
            Edit
          </Link>
        </div>

        <div className={styles.profileRow}>
          <div className={styles.profileText}>
            <span className={styles.profileLabel}>Password</span>
            <span className={styles.profileValue}>&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
          </div>
          <Link href="/account/password" className={styles.editLink}>
            Edit
          </Link>
        </div>
      </div>

      <h2 className={styles.contentHeading}>Devices Logged In</h2>

      {devicesLoading ? (
        <p className={styles.intro}>Loading devices...</p>
      ) : devices.length === 0 ? (
        <p className={styles.intro}>No devices on file yet.</p>
      ) : (
        <div className={styles.deviceList}>
          {devices.map((device) => (
            <div key={device.id} className={styles.deviceRow}>
              <span className={styles.deviceName}>
                {describeUserAgent(device.user_agent)}
              </span>
              <span className={styles.deviceMeta}>
                Last active{' '}
                {new Date(device.last_seen_at).toLocaleString([], {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
