import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendSignupConfirmationEmail } from '@/lib/mailer'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function getRollNumber(email) {
  const normalizedEmail = email.trim().toLowerCase()
  const emailParts = normalizedEmail.match(/^([^@\s]+)@(snuchennai\.edu\.in|ssn\.edu\.in)$/)
  if (!emailParts) return null
  const requiredDigits = emailParts[2] === 'snuchennai.edu.in' ? 8 : 7
  const rollNumberMatch = emailParts[1].match(new RegExp(`(\\d{${requiredDigits}})$`))
  return rollNumberMatch ? rollNumberMatch[1] : null
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : ''

    if (!name || !email || !password || !phoneNumber) {
      return NextResponse.json({ error: 'All fields are required.', code: 'invalid_input' }, { status: 400 })
    }

    const rollNumber = getRollNumber(email)
    if (!rollNumber) {
      return NextResponse.json(
        { error: 'Use a valid SNU or SSN college email with a roll number at the end.', code: 'invalid_email' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password should be at least 6 characters.', code: 'weak_password' },
        { status: 400 }
      )
    }

    const metadata = { name, roll_number: rollNumber, phone_number: phoneNumber }

    // generateLink creates the auth user (like signUp would) and hands back
    // Supabase's own real confirmation link, WITHOUT Supabase emailing it —
    // that's the part we take over below via our own Gmail mailboxes.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: metadata,
        redirectTo: `${SITE_URL}/signup`,
      },
    })

    if (error) {
      const message = error.message?.toLowerCase() || ''
      if (
        message.includes('already registered') ||
        message.includes('already exists') ||
        error.code === 'email_exists'
      ) {
        return NextResponse.json({ error: 'Account already exists.', code: 'user_exists' }, { status: 409 })
      }
      console.error('generateLink error:', error)
      return NextResponse.json(
        { error: 'We could not create your account. Please try again.', code: 'signup_failed' },
        { status: 500 }
      )
    }

    const actionLink = data?.properties?.action_link
    if (!actionLink) {
      console.error('generateLink returned no action_link:', data)
      return NextResponse.json(
        { error: 'We could not create your account. Please try again.', code: 'signup_failed' },
        { status: 500 }
      )
    }

    await sendSignupConfirmationEmail(email, actionLink, name)

    return NextResponse.json({ success: true, status: 'created' })
  } catch (error) {
    console.error('Error in signup API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred while creating your account.', code: 'signup_failed' },
      { status: 500 }
    )
  }
}
