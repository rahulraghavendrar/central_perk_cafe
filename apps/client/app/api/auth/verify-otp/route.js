import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createResetToken } from '@/lib/authTokens'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawEmail = body.email
    const rawCode = body.code

    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 }
      )
    }

    if (!rawCode || typeof rawCode !== 'string') {
      return NextResponse.json(
        { error: '6-digit OTP code is required.' },
        { status: 400 }
      )
    }

    const email = rawEmail.trim().toLowerCase()
    const code = rawCode.trim()

    // Look for matching, unexpired, unused reset code
    const nowIso = new Date().toISOString()
    const { data: record, error: lookupError } = await supabaseAdmin
      .from('password_reset_codes')
      .select('id, expires_at, used')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lookupError) {
      console.error('Error looking up reset code:', lookupError)
      return NextResponse.json(
        { error: 'Failed to verify code. Please try again.' },
        { status: 500 }
      )
    }

    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please double-check or request a new code.' },
        { status: 400 }
      )
    }

    // Mark code as used
    const { error: updateError } = await supabaseAdmin
      .from('password_reset_codes')
      .update({ used: true })
      .eq('id', record.id)

    if (updateError) {
      console.error('Error marking code as used:', updateError)
    }

    // Generate signed reset verification token valid for 15 minutes
    const resetToken = createResetToken(email, 15)

    return NextResponse.json({
      success: true,
      message: 'Code verified successfully.',
      resetToken,
    })
  } catch (error) {
    console.error('Error in verify-otp API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred during verification.' },
      { status: 500 }
    )
  }
}
