'use client'

import DishCard from './DishCard'
import styles from './MenuCategory.module.css'

export default function MenuCategory({
  title,
  dishes,
  quantities,
  onQuantityChange,
  selectedToppings,
  onToppingToggle,
  selectedExtras,
  onExtraToggle
}) {
  if (!dishes || dishes.length === 0) return null

  // Special sub-grouping for Desserts if title === 'Desserts'
  const isDesserts = title === 'Desserts'
  const subCategoriesOrder = ['Waffles', 'Mini Pancakes', 'Brownie']

  // Check if dishes have sub_categories matching Desserts subcategories
  let subGroups = null
  if (isDesserts) {
    const grouped = {}
    const remaining = []

    dishes.forEach(dish => {
      const sub = dish.sub_category || dish.category || ''
      const matchedSub = subCategoriesOrder.find(s => sub.toLowerCase().includes(s.toLowerCase()))
      if (matchedSub) {
        if (!grouped[matchedSub]) grouped[matchedSub] = []
        grouped[matchedSub].push(dish)
      } else {
        remaining.push(dish)
      }
    })

    if (Object.keys(grouped).length > 0) {
      subGroups = { grouped, remaining }
    }
  }

  return (
    <section className={styles.categorySection}>
      <div className={styles.categoryHeader}>
        <h2 className={styles.categoryTitle}>{title}</h2>
        <span className={styles.itemCountBadge}>{dishes.length} {dishes.length === 1 ? 'item' : 'items'}</span>
      </div>

      {subGroups ? (
        <>
          {subCategoriesOrder.map(subName => {
            const list = subGroups.grouped[subName]
            if (!list || list.length === 0) return null
            return (
              <div key={subName} className={styles.subGroup}>
                <h3 className={styles.subTitle}>
                  <span className={styles.subTitleDot} />
                  {subName}
                </h3>
                <div className={styles.grid}>
                  {list.map(dish => (
                    <DishCard
                      key={dish.id || dish.dish_name}
                      dish={dish}
                      quantity={quantities[dish.id] || 0}
                      onQuantityChange={(q) => onQuantityChange(dish.id, q)}
                      selectedToppings={selectedToppings[dish.id] || []}
                      onToppingToggle={(t) => onToppingToggle(dish.id, t)}
                      selectedExtras={selectedExtras[dish.id] || []}
                      onExtraToggle={(e) => onExtraToggle(dish.id, e)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {subGroups.remaining.length > 0 && (
            <div className={styles.subGroup}>
              <h3 className={styles.subTitle}>
                <span className={styles.subTitleDot} />
                Other Desserts
              </h3>
              <div className={styles.grid}>
                {subGroups.remaining.map(dish => (
                  <DishCard
                    key={dish.id || dish.dish_name}
                    dish={dish}
                    quantity={quantities[dish.id] || 0}
                    onQuantityChange={(q) => onQuantityChange(dish.id, q)}
                    selectedToppings={selectedToppings[dish.id] || []}
                    onToppingToggle={(t) => onToppingToggle(dish.id, t)}
                    selectedExtras={selectedExtras[dish.id] || []}
                    onExtraToggle={(e) => onExtraToggle(dish.id, e)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.grid}>
          {dishes.map(dish => (
            <DishCard
              key={dish.id || dish.dish_name}
              dish={dish}
              quantity={quantities[dish.id] || 0}
              onQuantityChange={(q) => onQuantityChange(dish.id, q)}
              selectedToppings={selectedToppings[dish.id] || []}
              onToppingToggle={(t) => onToppingToggle(dish.id, t)}
              selectedExtras={selectedExtras[dish.id] || []}
              onExtraToggle={(e) => onExtraToggle(dish.id, e)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
