// Placeholder order-status logic, until the admin side exists to set this
// for real. Nothing ever moves an order to 'Collected' yet (that will be
// the admin-side QR scan) -- what this computes is only the display status
// shown to the student in the meantime: 'Preparing' while the kitchen
// would realistically still be working on it, 'Completed' once that
// window has passed. This is NEVER written back to the stored order
// document; it's recomputed fresh every time an order is read, so it's
// always correct for "now" without needing a background job to update it.

// ASAP orders have no readyTime to measure against, so they use the same
// ~10 minute lead time the ready-time picker already treats as the
// earliest realistic pickup (see PREP_BUFFER_MINUTES in the Cart page).
const ASAP_COMPLETE_BUFFER_MINUTES = 10

export function getEffectiveStatus(order, now = new Date()) {
  if (order.status === 'Collected') return 'Collected'

  const completesAt = order.readyTime
    ? new Date(order.readyTime)
    : new Date(
        new Date(order.createdAt).getTime() +
          ASAP_COMPLETE_BUFFER_MINUTES * 60 * 1000
      )

  return now.getTime() >= completesAt.getTime() ? 'Completed' : 'Preparing'
}
