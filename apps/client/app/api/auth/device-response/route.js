import { NextResponse } from 'next/server'
import { verifyDeviceResponseToken, createResetToken } from '@/lib/authTokens'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { token, answer } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'This confirmation link is invalid or missing.' }, { status: 400 })
    }

    if (answer !== 'yes' && answer !== 'no') {
      return NextResponse.json({ error: 'Invalid response.' }, { status: 400 })
    }

    const tokenResult = verifyDeviceResponseToken(token)
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'This confirmation link has expired. If you still have concerns about your account, use "Forgot password" to secure it.' },
        { status: 401 }
      )
    }

    if (answer === 'yes') {
      return NextResponse.json({ status: 'acknowledged' })
    }

    // "No, this wasn't me" -- mint a password-reset token directly and
    // send them straight to setting a new password. This deliberately
    // does NOT go through forgot-password's 24h cooldown check at all
    // (different code path) -- a real security event overrides that
    // protection instead of being blocked by it.
    const resetToken = createResetToken(tokenResult.email, 15)

    return NextResponse.json({
      status: 'secure_account',
      resetToken,
      email: tokenResult.email,
    })
  } catch (error) {
    console.error('Error in device-response API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
