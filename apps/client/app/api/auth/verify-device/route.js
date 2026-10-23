import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyPendingLoginToken, createDeviceResponseToken } from '@/lib/authTokens'
import { sendDeviceVerificationFailedEmail, sendNewDeviceLoginEmail } from '@/lib/mailer'

const DEVICE_COOKIE_NAME = 'cp_device'
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400 // ~400 days -- browsers cap cookie lifetime around there anyway

function buildConfirmLink(userId, email) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const token = createDeviceResponseToken({ userId, email })
  return `${siteUrl}/device-confirm?token=${encodeURIComponent(token)}`
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawCode = body.code
    const verifyToken = body.verifyToken

    if (!verifyToken || typeof verifyToken !== 'string') {
      return NextResponse.json({ error: 'Verification session is required.' }, { status: 400 })
    }

    if (!rawCode || typeof rawCode !== 'string') {
      return NextResponse.json({ error: '6-digit code is required.' }, { status: 400 })
    }

    const code = rawCode.trim()

    const tokenResult = verifyPendingLoginToken(verifyToken)
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Verification session expired. Please log in again.' },
        { status: 401 }
      )
    }

    const { userId, email, deviceToken, session } = tokenResult

    const nowIso = new Date().toISOString()
    const { data: record, error: lookupError } = await supabaseAdmin
      .from('device_verification_codes')
      .select('id')
      .eq('email', email)
      .eq('code', code)
      .eq('device_token', deviceToken)
      .eq('used', false)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lookupError) {
      console.error('Error looking up device verification code:', lookupError)
      return NextResponse.json({ error: 'Failed to verify code. Please try again.' }, { status: 500 })
    }

    if (!record) {
      // Wrong code on an otherwise-correct password + pending login --
      // this is the one case that sends the "device failed to verify"
      // alert. A wrong password on its own never reaches this route.
      try {
        await sendDeviceVerificationFailedEmail(email, buildConfirmLink(userId, email))
      } catch (mailError) {
        console.error('Failed to send device-verification-failed alert:', mailError)
      }

      return NextResponse.json(
        { error: 'Invalid or expired code. Please double-check or request a new code.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('device_verification_codes')
      .update({ used: true })
      .eq('id', record.id)

    if (updateError) {
      console.error('Error marking device code as used:', updateError)
    }

    // Mark this device trusted going forward.
    const { error: upsertError } = await supabaseAdmin
      .from('trusted_devices')
      .upsert(
        {
          user_id: userId,
          device_token: deviceToken,
          user_agent: request.headers.get('user-agent') || null,
          last_seen_at: nowIso,
        },
        { onConflict: 'user_id,device_token' }
      )

    if (upsertError) {
      console.error('Error marking device as trusted:', upsertError)
    }

    // New device successfully verified -- send the "new sign-in" alert.
    try {
      await sendNewDeviceLoginEmail(email, buildConfirmLink(userId, email))
    } catch (mailError) {
      console.error('Failed to send new-device-login alert:', mailError)
    }

    const response = NextResponse.json({
      status: 'ok',
      session,
    })

    response.cookies.set(DEVICE_COOKIE_NAME, deviceToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: DEVICE_COOKIE_MAX_AGE,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error in verify-device API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred while verifying this device.' },
      { status: 500 }
    )
  }
}
