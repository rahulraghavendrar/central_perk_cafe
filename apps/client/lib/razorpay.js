import Razorpay from 'razorpay'
import crypto from 'crypto'

// Server-only: RAZORPAY_KEY_SECRET must never reach the client bundle.
// NEXT_PUBLIC_RAZORPAY_KEY_ID is the one piece of this pair that's safe to
// expose -- Razorpay's key id is meant to be public, only the secret is
// sensitive (same split as the Supabase anon key vs service role key).
export function getRazorpayClient() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })
}

// Mirrors the signature Razorpay's own checkout handler hands back:
// HMAC-SHA256 of "<order_id>|<payment_id>" using the key secret. This is
// the real boundary -- the same "never trust the client, verify on the
// server" rule this app already applies to ready-time validation. A
// request whose signature doesn't match is either a failed/incomplete
// payment or a tampered request, and either way must not create an order.
export function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  // Constant-time comparison -- a plain `===` on the hex strings would
  // leak timing information about how many leading characters matched.
  const expectedBuffer = Buffer.from(expectedSignature)
  const actualBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== actualBuffer.length) return false

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}
