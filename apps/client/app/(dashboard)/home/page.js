'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthSession } from '@/lib/useAuthSession'
import { supabase } from '@/lib/supabaseClient'
import MenuCategory from '@/app/components/MenuCategory'
import styles from './home.module.css'

const CATEGORIES_ORDER = [
  'Beverages',
  'Omelettes & Eggs',
  'Rolls, Momos & Other Savouries',
  'Sandwiches',
  'Fries',
  'Desserts'
]

function getCategoryKey(dish) {
  const cat = (dish.sub_category || dish.category || '').toLowerCase()
  const name = (dish.dish_name || dish.name || '').toLowerCase()

  if (cat.includes('beverage') || cat.includes('coffee') || cat.includes('tea') || cat.includes('shake') || cat.includes('drink') || cat.includes('beverages')) {
    return 'Beverages'
  }
  if (cat.includes('omelette') || cat.includes('egg')) {
    return 'Omelettes & Eggs'
  }
  if (cat.includes('roll') || cat.includes('momo') || cat.includes('savour') || cat.includes('savouries') || cat.includes('snack')) {
    return 'Rolls, Momos & Other Savouries'
  }
  if (cat.includes('sandwich')) {
    return 'Sandwiches'
  }
  if (cat.includes('fries') || cat.includes('fry')) {
    return 'Fries'
  }
  if (cat.includes('dessert') || cat.includes('waffle') || cat.includes('pancake') || cat.includes('brownie') || cat.includes('sweet') || cat.includes('desserts')) {
    return 'Desserts'
  }

  // Name fallbacks
  if (name.includes('waffle') || name.includes('pancake') || name.includes('brownie') || name.includes('dessert')) return 'Desserts'
  if (name.includes('coffee') || name.includes('tea') || name.includes('shake') || name.includes('beverage') || name.includes('latte') || name.includes('cappuccino')) return 'Beverages'
  if (name.includes('omelette') || name.includes('egg')) return 'Omelettes & Eggs'
  if (name.includes('momo') || name.includes('roll')) return 'Rolls, Momos & Other Savouries'
  if (name.includes('sandwich')) return 'Sandwiches'
  if (name.includes('fries') || name.includes('fry')) return 'Fries'

  return dish.sub_category || dish.category || 'Rolls, Momos & Other Savouries'
}

export default function HomePage() {
  const { user, profile, loading: authLoading } = useAuthSession()

  // Menu data state
  const [menuItems, setMenuItems] = useState([])
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [menuError, setMenuError] = useState(null)

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'veg' | 'non-veg'

  // Interaction states (quantity, toppings, extras)
  const [quantities, setQuantities] = useState({})
  const [selectedToppings, setSelectedToppings] = useState({})
  const [selectedExtras, setSelectedExtras] = useState({})

  // Fetch Menu from Supabase
  const fetchMenu = useCallback(async () => {
    setLoadingMenu(true)
    setMenuError(null)

    try {
      const { data, error } = await supabase
        .from('menu')
        .select('*')

      if (error) {
        console.error('Error fetching menu from Supabase:', error.message || error.code || JSON.stringify(error))
        setMenuError('Unable to load menu. Please try again.')
      } else {
        setMenuItems(data || [])
      }
    } catch (err) {
      console.error('Unexpected error fetching menu:', err.message || JSON.stringify(err))
      setMenuError('Unable to load menu. Please try again.')
    } finally {
      setLoadingMenu(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadMenuData() {
      try {
        const { data, error } = await supabase
          .from('menu')
          .select('*')

        if (ignore) return

        if (error) {
          console.error('Error fetching menu from Supabase:', error.message || error.code || JSON.stringify(error))
          setMenuError('Unable to load menu. Please try again.')
        } else {
          setMenuItems(data || [])
        }
      } catch (err) {
        if (ignore) return
        console.error('Unexpected error fetching menu:', err.message || JSON.stringify(err))
        setMenuError('Unable to load menu. Please try again.')
      } finally {
        if (!ignore) {
          setLoadingMenu(false)
        }
      }
    }

    loadMenuData()

    return () => {
      ignore = true
    }
  }, [])

  // Interaction handlers
  const handleQuantityChange = (dishId, newQty) => {
    setQuantities(prev => ({
      ...prev,
      [dishId]: Math.max(0, newQty)
    }))
  }

  const handleToppingToggle = (dishId, toppingName) => {
    setSelectedToppings(prev => {
      const current = prev[dishId] || []
      const updated = current.includes(toppingName)
        ? current.filter(t => t !== toppingName)
        : [...current, toppingName]
      return { ...prev, [dishId]: updated }
    })
  }

  const handleExtraToggle = (dishId, extraName) => {
    setSelectedExtras(prev => {
      const current = prev[dishId] || []
      const updated = current.includes(extraName)
        ? current.filter(e => e !== extraName)
        : [...current, extraName]
      return { ...prev, [dishId]: updated }
    })
  }

  // Authentication Loading State
  if (authLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.mainContent}>
          <div className={styles.loadingContainer}>
            <svg className={styles.stateIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <h2 className={styles.stateTitle}>Loading Central Perk Cafe...</h2>
          </div>
        </div>
      </div>
    )
  }

  // Filter and search menu items
  const filteredDishes = menuItems.filter(dish => {
    const isVeg = dish.is_veg !== undefined
      ? Boolean(dish.is_veg)
      : (dish.veg !== undefined ? Boolean(dish.veg) : true)

    if (filter === 'veg' && !isVeg) return false
    if (filter === 'non-veg' && isVeg) return false

    if (searchTerm.trim()) {
      const dishName = (dish.dish_name || dish.name || '').toLowerCase()
      if (!dishName.includes(searchTerm.toLowerCase().trim())) {
        return false
      }
    }

    return true
  })

  // Group filtered dishes into categories
  const groupedCategories = {}
  filteredDishes.forEach(dish => {
    const key = getCategoryKey(dish)
    if (!groupedCategories[key]) {
      groupedCategories[key] = []
    }
    groupedCategories[key].push(dish)
  })

  // Get final ordered category list
  const activeCategoryKeys = [
    ...CATEGORIES_ORDER.filter(cat => groupedCategories[cat] && groupedCategories[cat].length > 0),
    ...Object.keys(groupedCategories).filter(cat => !CATEGORIES_ORDER.includes(cat) && groupedCategories[cat].length > 0)
  ]

  const userName = profile?.name || user?.email?.split('@')[0] || 'Friend'

  return (
    <div className={styles.page}>
      {/* Central Perk Banner */}
      <header className={styles.banner}>
        <div className={styles.bannerContainer}>
          <div className={styles.logoBadge}>
            <svg className={styles.logoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="2" x2="6" y2="4" />
              <line x1="10" y1="2" x2="10" y2="4" />
              <line x1="14" y1="2" x2="14" y2="4" />
            </svg>
            <span className={styles.logoText}>Central Perk Cafe</span>
          </div>

          <h1 className={styles.bannerTitle}>Central Perk Menu</h1>
          <p className={styles.bannerSubtitle}>
            Welcome, {userName}! Explore our freshly prepared beverages, egg delicacies, savouries, sandwiches, fries, and desserts.
          </p>
        </div>
      </header>

      {/* Controls Card (Search + Filter) */}
      <div className={styles.controlsContainer}>
        <div className={styles.controlsCard}>
          <div className={styles.searchRow}>
            <div className={styles.searchInputWrapper}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search dishes (e.g. chicken, momos, coffee)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={styles.searchButton}
              onClick={() => {}}
            >
              Search
            </button>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Filter:</span>
              <button
                type="button"
                className={`${styles.filterPill} ${filter === 'all' ? styles.filterPillActive : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${filter === 'veg' ? styles.filterPillActive : ''}`}
                onClick={() => setFilter('veg')}
              >
                <span className={styles.vegDotSmall} />
                Veg
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${filter === 'non-veg' ? styles.filterPillActive : ''}`}
                onClick={() => setFilter('non-veg')}
              >
                <span className={styles.nonVegDotSmall} />
                Non-Veg
              </button>
            </div>

            {searchTerm.trim() && (
              <div className={styles.searchResultNotice}>
                Results for <strong>&quot;{searchTerm}&quot;</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* Loading Menu State */}
        {loadingMenu && (
          <div className={styles.loadingContainer}>
            <svg className={styles.stateIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
            </svg>
            <h2 className={styles.stateTitle}>Loading menu...</h2>
            <p className={styles.stateText}>Fetching delicious items directly from Central Perk Supabase database.</p>
          </div>
        )}

        {/* Error State */}
        {!loadingMenu && menuError && (
          <div className={styles.errorContainer}>
            <svg className={`${styles.stateIcon} ${styles.errorIcon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2 className={styles.stateTitle}>Unable to load menu. Please try again.</h2>
            <p className={styles.stateText}>{menuError}</p>
            <button type="button" className={styles.retryButton} onClick={fetchMenu}>
              Retry Loading Menu
            </button>
          </div>
        )}

        {/* Empty Database State */}
        {!loadingMenu && !menuError && menuItems.length === 0 && (
          <div className={styles.emptyContainer}>
            <svg className={styles.stateIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
            </svg>
            <h2 className={styles.stateTitle}>No menu items available.</h2>
            <p className={styles.stateText}>The menu database is currently empty.</p>
          </div>
        )}

        {/* No Filter/Search Results State */}
        {!loadingMenu && !menuError && menuItems.length > 0 && activeCategoryKeys.length === 0 && (
          <div className={styles.emptyContainer}>
            <svg className={styles.stateIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h2 className={styles.stateTitle}>No dishes found</h2>
            <p className={styles.stateText}>
              No items match your search for &quot;{searchTerm}&quot; with filter &quot;{filter}&quot;. Try adjusting your filters or search terms.
            </p>
          </div>
        )}

        {/* Menu Categories List */}
        {!loadingMenu && !menuError && activeCategoryKeys.length > 0 && (
          <div>
            {activeCategoryKeys.map(catKey => (
              <MenuCategory
                key={catKey}
                title={catKey}
                dishes={groupedCategories[catKey]}
                quantities={quantities}
                onQuantityChange={handleQuantityChange}
                selectedToppings={selectedToppings}
                onToppingToggle={handleToppingToggle}
                selectedExtras={selectedExtras}
                onExtraToggle={handleExtraToggle}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
