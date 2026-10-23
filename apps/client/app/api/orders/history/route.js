import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { getEffectiveStatus } from '@/lib/orderStatus'

// Unlike /api/orders/mine (deliberately live-orders-only), this is the
// "broader query" that route's own comment already called for: every
// order a student has ever placed, Preparing/Completed/Collected alike,
// for the Account page's order-history list. Each order gets its
// `effectiveStatus` computed fresh at read time -- same placeholder logic
// the live tracker uses -- rather than trusting the stored `status` field,
// which currently only ever says 'Preparing' until the admin side exists.
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
      .find({ studentId })
      .sort({ createdAt: -1 })
      .toArray()

    const now = new Date()
    const ordersWithStatus = orders.map((order) => ({
      ...order,
      effectiveStatus: getEffectiveStatus(order, now),
    }))

    return NextResponse.json({ orders: ordersWithStatus })
  } catch (error) {
    console.error('Fetching order history failed:', error)

    return NextResponse.json(
      { error: 'Failed to fetch order history' },
      { status: 500 }
    )
  }
}
