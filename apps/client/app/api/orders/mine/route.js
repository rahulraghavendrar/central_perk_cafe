import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { getEffectiveStatus } from '@/lib/orderStatus'

// This endpoint is intentionally scoped to LIVE orders only -- anything
// still 'Preparing' per lib/orderStatus.js's placeholder timing. An order
// that's already 'Completed' (time passed, still not actually picked up)
// or 'Collected' (future admin QR scan) is deliberately left out: this
// page is "what should I be tracking right now", not order history. A
// later Account / order-history feature will need its own broader query
// that doesn't filter any of this out.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db(
      process.env.MONGODB_DB_NAME || 'central_perk_cafe'
    )

    const orders = await db
      .collection('orders')
      .find({ studentId, status: { $ne: 'Collected' } })
      .sort({ createdAt: -1 })
      .toArray()

    const now = new Date()
    const liveOrders = orders.filter(
      (order) => getEffectiveStatus(order, now) === 'Preparing'
    )

    return NextResponse.json({ orders: liveOrders })
  } catch (error) {
    console.error('Fetching orders failed:', error)

    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
