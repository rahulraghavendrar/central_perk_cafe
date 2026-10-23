import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Same phone validation the signup page already applies client-side
// (apps/client/app/signup/page.js) -- kept here too since this is a
// server boundary and the client's own check is only a UX nicety.
function isValidPhoneNumber(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  const digits = value.replace(/\D/g, '')
  return /^[+()\-\s\d]+$/.test(value) && digits.length >= 7 && digits.length <= 15
}

// Writes go through supabaseAdmin (service role), not the anon client,
// matching how every other privileged write in this app (trusted_devices,
// password_reset_codes, profiles.password_changed_at) is already done
// server-side rather than trusting client-side RLS alone.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { userId, phoneNumber } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required.' },
        { status: 400 }
      )
    }

    const trimmedPhone = typeof phoneNumber === 'string' ? phoneNumber.trim() : ''

    if (!isValidPhoneNumber(trimmedPhone)) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number.' },
        { status: 400 }
      )
    }

    const { data: profile, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (lookupError) {
      console.error('Error looking up profile for phone update:', lookupError)
      return NextResponse.json(
        { error: 'Database error updating phone number.' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Account not found.' },
        { status: 404 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ phone_number: trimmedPhone })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating phone number:', updateError)
      return NextResponse.json(
        { error: 'Failed to update phone number.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      phoneNumber: trimmedPhone,
    })
  } catch (error) {
    console.error('Error in account/phone API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred updating your phone number.' },
      { status: 500 }
    )
  }
}
