'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Navbar.module.css'

const TABS = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/cart', label: 'Cart', icon: 'cart' },
  { href: '/account', label: 'Account', icon: 'account' },
]

function TabIcon({ icon }) {
  if (icon === 'cart') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2.5 3h2.2l2.4 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6l1.5-7.6H6.1" />
      </svg>
    )
  }

  if (icon === 'account') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.8 20c1.3-3.6 4.1-5.4 7.2-5.4s5.9 1.8 7.2 5.4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.2V20a.8.8 0 0 0 .8.8H10v-5.4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v5.4h3.7a.8.8 0 0 0 .8-.8V9.2" />
    </svg>
  )
}

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className={styles.navbar}>
      <Link href="/home" className={styles.brand}>
        <span className={styles.brandMark}>CP</span>
        <span className={styles.brandName}>Central Perk Cafe</span>
      </Link>

      <div className={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              aria-current={isActive ? 'page' : undefined}
            >
              <TabIcon icon={tab.icon} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
