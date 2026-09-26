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
      .select('id, email')
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
