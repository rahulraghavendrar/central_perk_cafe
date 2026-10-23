import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import QRCode from 'qrcode'
import clientPromise from '@/lib/mongodb'
import { verifyPaymentSignature } from '@/lib/razorpay'

// The cafe is physically in India, so the daily order-number counter
// always resets at midnight India time -- not whatever time zone the
// server process happens to be running in (matters once this is deployed
// somewhere that isn't already IST, e.g. a US-based host).
function getIstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// Atomically claims the next order number for today. findOneAndUpdate with
// $inc + upsert is a single atomic Mongo operation, so two orders placed at
// the same instant still get distinct, gapless numbers -- no read-then-write
// race condition.
async function getNextOrderNumber(db, dayKey) {
  const counter = await db.collection('order_counters').findOneAndUpdate(
    { _id: dayKey },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  )

  return counter.seq
}

export async function POST(request) {
  try {
    const body = await request.json()

    const {
      studentId,
      items,
      total,
      parcel,
      readyTime,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
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

    // This is the real payment boundary -- never the client asserting
    // "payment succeeded". A request missing any of these three fields,
    // or whose signature doesn't verify against RAZORPAY_KEY_SECRET, is
    // rejected before anything touches the database: no order number
    // claimed, no document inserted. Only a verified signature ever
    // results in paymentStatus: 'Successful'.
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: 'Payment details are missing.' },
        { status: 400 }
      )
    }

    const paymentVerified = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    )

    if (!paymentVerified) {
      return NextResponse.json(
        { error: 'Payment verification failed.' },
        { status: 400 }
      )
    }

    // Ready time is optional (omitted/null means "as soon as possible").
    // When one is given, it must be validated against THIS SERVER'S clock --
    // never the client's -- since a browser's system clock can be wrong or
    // deliberately spoofed. This is the real security boundary; any check
    // the cart page does client-side is just a UX nicety on top of this.
    let readyTimeValue = null

    if (readyTime !== null && readyTime !== undefined) {
      const parsedReadyTime = new Date(readyTime)
      const now = new Date()
      const maxReadyTime = new Date(now.getTime() + 12 * 60 * 60 * 1000)

      if (Number.isNaN(parsedReadyTime.getTime())) {
        return NextResponse.json(
          { error: 'Ready time is not a valid date.' },
          { status: 400 }
        )
      }

      if (parsedReadyTime.getTime() <= now.getTime()) {
        return NextResponse.json(
          { error: 'Ready time must be in the future.' },
          { status: 400 }
        )
      }

      if (parsedReadyTime.getTime() > maxReadyTime.getTime()) {
        return NextResponse.json(
          { error: 'Ready time is too far in the future.' },
          { status: 400 }
        )
      }

      readyTimeValue = parsedReadyTime
    }

    const client = await clientPromise

    const db = client.db(
      process.env.MONGODB_DB_NAME || 'central_perk_cafe'
    )

    const orderId = `CP-${new ObjectId().toString()}`

    // orderId (above) is the real, globally-unique database key -- it's
    // what a QR scan resolves to. orderNumber is purely a human-facing
    // display label: short, resets every day, so it reads the way a real
    // cafe calls out "Order 7!" instead of a 24-character Mongo id.
    const dayKey = getIstDateKey()
    const orderNumber = await getNextOrderNumber(db, dayKey)
    const orderNumberDisplay = `#${orderNumber}`

    // The QR encodes the real orderId (not the daily-reset display number,
    // which isn't unique across days) so a future admin-side scan always
    // resolves to exactly one order, today or any other day. QR generation
    // is a nicety, not the order itself -- if it ever fails for some reason,
    // the order still goes through, it just comes back without a QR image.
    let qrCode = null
    try {
      qrCode = await QRCode.toDataURL(orderId, { margin: 1, width: 240 })
    } catch (qrError) {
      console.error('QR code generation failed:', qrError)
    }

    const order = {
      orderId,
      orderNumber,
      orderNumberDisplay,
      dayKey,
      studentId,
      items,
      total: Number(total || 0),
      parcel: Boolean(parcel),
      readyTime: readyTimeValue,
      qrCode,
      paymentStatus: 'Successful',
      razorpayOrderId,
      razorpayPaymentId,
      // Order lifecycle: 'Preparing' -> 'Ready for Pickup' -> 'Collected'.
      // Every order starts at 'Preparing' -- only the admin side (not built
      // yet) will ever move it further along. The order tracker and order
      // page poll this field so they pick up admin updates automatically
      // once that exists.
      status: 'Preparing',
      createdAt: new Date(),
    }

    const result = await db
      .collection('orders')
      .insertOne(order)

    return NextResponse.json(
      {
        success: true,
        orderId,
        orderNumber,
        orderNumberDisplay,
        qrCode,
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