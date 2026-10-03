'use client'

import { useState } from 'react'
import styles from './DishCard.module.css'

export default function DishCard({
  dish,
  quantity = 0,
  onQuantityChange,
  selectedToppings = [],
  onToppingToggle,
  selectedExtras = [],
  onExtraToggle
}) {
  const [imgError, setImgError] = useState(false)

  // Normalize dish fields safely
  const dishName = typeof dish.dish_name === 'string'
    ? dish.dish_name
    : (typeof dish.name === 'string' ? dish.name : 'Unnamed Dish')

  const basePrice = typeof dish.price === 'number' ? dish.price : parseFloat(dish.price || 0)

  const isVeg = dish.is_veg !== undefined
    ? Boolean(dish.is_veg)
    : (dish.veg !== undefined ? Boolean(dish.veg) : true)

  const imageUrl = typeof dish.image_url === 'string'
    ? dish.image_url
    : (typeof dish.image === 'string' ? dish.image : '')

  const subCategoryRaw = dish.sub_category || dish.category || ''
  const subCategory = typeof subCategoryRaw === 'object' && subCategoryRaw !== null
    ? (subCategoryRaw.name || subCategoryRaw.title || '')
    : String(subCategoryRaw || '')

  // Normalize toppings array safely
  let toppingsList = []
  if (Array.isArray(dish.toppings)) {
    toppingsList = dish.toppings
  } else if (typeof dish.toppings === 'string' && dish.toppings.trim()) {
    try {
      toppingsList = JSON.parse(dish.toppings)
    } catch {
      toppingsList = dish.toppings.split(',').map(s => s.trim())
    }
  }

  // Normalize extras array safely
  let extrasList = []
  if (Array.isArray(dish.extras)) {
    extrasList = dish.extras
  } else if (typeof dish.extras === 'string' && dish.extras.trim()) {
    try {
      extrasList = JSON.parse(dish.extras)
    } catch {
      extrasList = []
    }
  }

  // Calculate extra cost for selected extras
  const extrasCost = selectedExtras.reduce((sum, extraName) => {
    const foundExtra = extrasList.find(e => {
      const eName = typeof e === 'string' ? e : (e && typeof e === 'object' ? e.name : '')
      return eName === extraName
    })
    if (foundExtra && typeof foundExtra === 'object' && foundExtra.price) {
      return sum + Number(foundExtra.price)
    }
    return sum
  }, 0)

  const totalPrice = basePrice + extrasCost

  const handleMinus = () => {
    if (quantity > 0 && onQuantityChange) {
      onQuantityChange(quantity - 1)
    }
  }

  const handlePlus = () => {
    if (onQuantityChange) {
      onQuantityChange(quantity + 1)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.imageWrapper}>
        {/* Veg / Non-Veg Badge */}
        <div className={styles.vegBadge} title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}>
          {isVeg ? (
            <div className={styles.vegIcon}>
              <div className={styles.vegDot} />
            </div>
          ) : (
            <div className={styles.nonVegIcon}>
              <div className={styles.nonVegDot} />
            </div>
          )}
        </div>

        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={dishName}
            className={styles.image}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.placeholder}>
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
            <span>Central Perk Treat</span>
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{dishName}</h3>
          <div className={styles.priceContainer}>
            <span className={styles.price}>Rs.{totalPrice}</span>
            {extrasCost > 0 && (
              <span className={styles.basePrice}>Base: Rs.{basePrice}</span>
            )}
          </div>
        </div>

        {subCategory && (
          <span className={styles.categoryTag}>{subCategory}</span>
        )}

        {/* Free Toppings Section */}
        {toppingsList.length > 0 && (
          <div className={styles.optionsContainer}>
            <div className={styles.sectionTitle}>Free Toppings:</div>
            <div className={styles.toppingsList}>
              {toppingsList.map((topping, idx) => {
                const toppingName = typeof topping === 'string'
                  ? topping
                  : (topping && typeof topping === 'object' ? (topping.name || topping.title || String(topping)) : String(topping))

                if (!toppingName) return null
                const isSelected = selectedToppings.includes(toppingName)

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`${styles.toppingPill} ${isSelected ? styles.toppingPillActive : ''}`}
                    onClick={() => onToppingToggle && onToppingToggle(toppingName)}
                  >
                    <span>{toppingName}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Paid Extras Section */}
        {extrasList.length > 0 && (
          <div className={styles.optionsContainer}>
            <div className={styles.sectionTitle}>Paid Extras:</div>
            <div className={styles.extrasList}>
              {extrasList.map((extra, idx) => {
                const name = typeof extra === 'string'
                  ? extra
                  : (extra && typeof extra === 'object' ? (extra.name || extra.title || '') : String(extra))
                const extraPrice = typeof extra === 'object' && extra !== null && extra.price !== undefined ? extra.price : null
                if (!name) return null
                const isSelected = selectedExtras.includes(name)

                return (
                  <label key={idx} className={styles.extraCheckbox}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onExtraToggle && onExtraToggle(name)}
                    />
                    <span>{name}</span>
                    {extraPrice !== null && (
                      <span className={styles.extraPrice}>+Rs.{extraPrice}</span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <span className={styles.quantityLabel}>Quantity</span>
          <div className={styles.quantityControls}>
            <button
              type="button"
              className={styles.quantityBtn}
              onClick={handleMinus}
              disabled={quantity <= 0}
              aria-label="Decrease quantity"
            >
              -
            </button>
            <span className={styles.quantityValue}>{quantity}</span>
            <button
              type="button"
              className={styles.quantityBtn}
              onClick={handlePlus}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
