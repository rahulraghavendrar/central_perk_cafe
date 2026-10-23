import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createAuthCheckClient } from '@/lib/supabaseClient'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendDeviceVerificationEmail } from '@/lib/mailer'
import { createPendingLoginToken } from '@/lib/authTokens'

const DEVICE_COOKIE_NAME = 'cp_device'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawEmail = body.email
    const password = body.password

    if (!rawEmail || typeof rawEmail !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const email = rawEmail.trim().toLowerCase()

    // Verify credentials with a fresh, stateless anon-key client -- NOT
    // supabaseAdmin (calling signInWithPassword on the service-role
    // client would switch ITS identity over to the logged-in user for
    // every query after it on that same instance, silently downgrading
    // the privileged trusted_devices/device_verification_codes writes
    // below from service_role to a regular authenticated user, which
    // has no grants on those tables), and NOT the shared browser
    // `supabase` singleton either (Next.js reuses that same module
    // instance across requests server-side, so its auth state would
    // leak between different users' concurrent login requests). A
    // fresh client scoped to just this request avoids both problems.
    const authClient = createAuthCheckClient()
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData?.session || !signInData?.user) {
      const msg = signInError?.message?.toLowerCase() || ''
      if (msg.includes('email not confirmed')) {
        return NextResponse.json(
          { error: 'Please confirm your email address before logging in.' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: signInError?.message || 'Wrong password or invalid credentials.' },
        { status: 401 }
      )
    }

    const { user, session } = signInData
    const sessionTokens = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }

    // Recognized device? Check the device cookie against trusted_devices.
    const existingDeviceToken = request.cookies.get(DEVICE_COOKIE_NAME)?.value

    if (existingDeviceToken) {
      const { data: trustedRow } = await supabaseAdmin
        .from('trusted_devices')
        .select('id')
        .eq('user_id', user.id)
        .eq('device_token', existingDeviceToken)
        .maybeSingle()

      if (trustedRow) {
        await supabaseAdmin
          .from('trusted_devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', trustedRow.id)

        return NextResponse.json({
          status: 'ok',
          session: sessionTokens,
        })
      }
    }

    // Unrecognized device -- hold the session behind a 6-digit code
    // instead of handing it back right away.
    const deviceToken = existingDeviceToken || crypto.randomBytes(32).toString('hex')

    // Invalidate any earlier unused codes for this email+device (e.g. a
    // retried login) so only the code we're about to send can be used.
    const { error: invalidateError } = await supabaseAdmin
      .from('device_verification_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('device_token', deviceToken)
      .eq('used', false)

    if (invalidateError) {
      console.error('Error invalidating previous device codes:', invalidateError)
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: insertError } = await supabaseAdmin
      .from('device_verification_codes')
      .insert({
        email,
        code: otpCode,
        device_token: deviceToken,
        expires_at: expiresAt,
        used: false,
      })

    if (insertError) {
      console.error('Error inserting device verification code:', insertError)
      return NextResponse.json(
        { error: 'Could not start device verification. Please try again.' },
        { status: 500 }
      )
    }

    await sendDeviceVerificationEmail(email, otpCode)

    const verifyToken = createPendingLoginToken({
      userId: user.id,
      email,
      deviceToken,
      session: sessionTokens,
    })

    return NextResponse.json({
      status: 'device_verification_required',
      verifyToken,
      email,
    })
  } catch (error) {
    console.error('Error in login API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred while logging in.' },
      { status: 500 }
    )
  }
}
