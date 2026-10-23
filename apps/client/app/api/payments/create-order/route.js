import { NextResponse } from 'next/server'
import { getRazorpayClient } from '@/lib/razorpay'

// Step 1 of checkout: before Razorpay's widget can open, it needs an
// "order" created on Razorpay's side (their Orders API, unrelated to this
// app's own MongoDB `orders` collection). The id this returns is what
// Checkout uses, and later what /api/orders verifies the payment
// signature against.
//
// Note: like the rest of this app today, this trusts the client-supplied
// `total` rather than recomputing it from a server-side menu/price list --
// that gap already exists in /api/orders and isn't something this change
// is scoped to close. Worth hardening later, not a blocker now.
export async function POST(request) {
  try {
    const { total } = await request.json()
    const amount = Number(total)

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'A valid order total is required' },
        { status: 400 }
      )
    }

    const razorpay = getRazorpayClient()

    // Amount is in paise -- Razorpay's smallest currency unit for INR.
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `cp_${Date.now()}`,
    })

    return NextResponse.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    })
  } catch (error) {
    console.error('Razorpay order creation failed:', error)

    return NextResponse.json(
      { error: 'Failed to start payment' },
      { status: 500 }
    )
  }
}
