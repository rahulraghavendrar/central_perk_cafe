import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'

export async function POST(request) {
  try {
    const body = await request.json()

    const {
      studentId,
      items,
      total,
      parcel,
    } = body

    if (!studentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }

    const client = await clientPromise

    const db = client.db(
      process.env.MONGODB_DB_NAME || 'central_perk_cafe'
    )

    const orderId = `CP-${new ObjectId().toString()}`

    const order = {
      orderId,
      studentId,
      items,
      total: Number(total || 0),
      parcel: Boolean(parcel),
      paymentStatus: 'Successful',
      createdAt: new Date(),
    }

    const result = await db
      .collection('orders')
      .insertOne(order)

    return NextResponse.json(
      {
        success: true,
        orderId: orderId,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Order creation failed:', error)

    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}