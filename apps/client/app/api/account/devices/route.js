import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Read-only view onto the trusted_devices table the login flow already
// writes to (see apps/client/app/api/auth/login/route.js and
// verify-device/route.js) -- a device lands here once its 6-digit email
// code has been confirmed. Nothing new is tracked for this; it's just
// the first place that table's contents are surfaced to the student
// themselves instead of only being used internally for "is this device
// already trusted" checks.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('trusted_devices')
      .select('id, user_agent, last_seen_at')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false })

    if (error) {
      console.error('Error fetching trusted devices:', error)
      return NextResponse.json(
        { error: 'Failed to fetch devices.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ devices: data || [] })
  } catch (error) {
    console.error('Error in account/devices API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred fetching devices.' },
      { status: 500 }
    )
  }
}
