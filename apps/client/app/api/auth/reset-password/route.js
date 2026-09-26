import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyResetToken } from '@/lib/authTokens'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { resetToken, newPassword } = body

    if (!resetToken || typeof resetToken !== 'string') {
      return NextResponse.json(
        { error: 'Verification token is required.' },
        { status: 400 }
      )
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      )
    }

    // Verify cryptographic token
    const tokenResult = verifyResetToken(resetToken)
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired reset session. Please request a new code.' },
        { status: 401 }
      )
    }

    const email = tokenResult.email

    // Resolve userId from profiles table (id in profiles maps to auth.users.id)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    let userId = profile?.id

    // Fallback: If not in profiles, query auth.users directly via admin
    if (!userId) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers()
      if (!userError && userData?.users) {
        const found = userData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        )
        if (found) {
          userId = found.id
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User account could not be found to update password.' },
        { status: 404 }
      )
    }

    // Update user's password using Supabase Admin SDK
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Error updating password via Supabase Admin:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in.',
    })
  } catch (error) {
    console.error('Error in reset-password API:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred while resetting the password.' },
      { status: 500 }
    )
  }
}
