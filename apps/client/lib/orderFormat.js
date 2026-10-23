// Shared display-formatting helpers for anything that renders an order --
// today that's the live /orders tracker page and the Account page's order
// history. Kept here instead of duplicated in both so a formatting tweak
// (e.g. date format) only has to happen once.

export function formatReadyTime(iso) {
  if (!iso) return 'As soon as possible'
  return `Ready by ${new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

export function formatCreatedAt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function itemLineTotal(item) {
  const extrasTotal = (item.extras || []).reduce(
    (total, extra) =>
      total + Number(typeof extra === 'object' ? extra.price || 0 : 0),
    0
  )
  return (Number(item.price || 0) + extrasTotal) * (item.quantity || 0)
}

export function countItems(order) {
  return (order.items || []).reduce(
    (total, item) => total + (item.quantity || 0),
    0
  )
}
