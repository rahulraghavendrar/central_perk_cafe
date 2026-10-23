import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPasswordResetEmail } from '@/lib/mailer'

function isValidCollegeEmail(email) {
  const normalizedEmail = email.trim().toLowerCase()
  const emailParts = normalizedEmail.match(/^([^@\s]+)@(snuchennai\.edu\.in|ssn\.edu\.in)$/)
  if (!emailParts) return false
  const requiredDigits = emailParts[2] === 'snuchennai.edu.in' ? 8 : 7
  const rollNumberMatch = emailParts[1].match(new RegExp(`(\\d{${requiredDigits}})$`))
  return Boolean(rollNumberMatch)
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawEmail = body.email

    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json(
        { error: 'College email is required.' },
        { status: 400 }
      )
    }

    const email = rawEmail.trim().toLowerCase()

    if (!isValidCollegeEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid SNU or SSN college email address.' },
        { status: 400 }
      )
    }

    // Verify account exists in profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, password_changed_at')
      .eq('email', email)
      .maybeSingle()

    if (profileError) {
      console.error('Error querying profile:', profileError)
      return NextResponse.json(
        { error: 'Database error verifying account.' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'No account found with this college email. Please sign up first.' },
        { status: 404 }
      )
    }

    // Enforce a 24h cooldown after a real password change so the reset
    // flow can't be used to spam OTPs or repeatedly reset the same
    // account right after it was just changed.
    const PASSWORD_RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000
    if (profile.password_changed_at) {
      const changedAtMs = new Date(profile.password_changed_at).getTime()
      const nextAllowedAtMs = changedAtMs + PASSWORD_RESET_COOLDOWN_MS

      if (Date.now() < nextAllowedAtMs) {
        return NextResponse.json(
          {
            error: 'You recently changed your password. Please wait before requesting another reset.',
            code: 'cooldown_active',
            retryAt: new Date(nextAllowedAtMs).toISOString(),
          },
          { status: 429 }
        )
      }
    }

    // Invalidate any earlier unused codes for this email (e.g. from a
    // previous request or a "Resend code" click) so only the code we're
    // about to send can be used -- otherwise an older, already-sent code
    // stays valid in parallel until it separately expires.
    const { error: invalidateError } = await supabaseAdmin
      .from('password_reset_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false)

    if (invalidateError) {
      console.error('Error invalidating previous reset codes:', invalidateError)
    }

    // Generate secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Store in password_reset_codes table
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_codes')
      .insert({
        email,
        code: otpCode,
        expires_at: expiresAt,
        used: false,
      })

    if (insertError) {
      console.error('Error inserting reset code:', insertError)
      return NextResponse.json(
        { error: 'Could not generate reset code. Please try again.' },
        { status: 500 }
      )
    }

    // Send OTP via Nodemailer failover
    await sendPasswordResetEmail(email, otpCode)

    return NextResponse.json({
      success: true,
      message: 'A 6-digit reset code has been sent to your email.',
    })
  } catch (error) {
    console.error('Error in forgot-password API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred while sending the reset code.' },
      { status: 500 }
    )
  }
}
