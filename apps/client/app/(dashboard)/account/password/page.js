'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthSession } from '@/lib/useAuthSession'
import pageStyles from '../account.module.css'
import styles from './password.module.css'

// Reuses the exact same forgot-password -> verify-otp -> reset-password
// endpoints the login page's "Forgot password" flow already uses (see
// apps/client/app/login/page.js and the three routes under
// app/api/auth/). Changing your password while already logged in still
// goes through a fresh email OTP rather than trusting the current
// session alone -- the same "never trust the client, re-verify" pattern
// the rest of this app follows. The only difference from the login
// page's version is that the email is already known (the signed-in
// user's own), so there's no email-entry step.
export default function UpdatePasswordPage() {
  const { user, loading } = useAuthSession()

  // 'REQUEST' -> 'OTP' -> 'NEW_PASSWORD' -> 'DONE'
  const [view, setView] = useState('REQUEST')
  const [otpCode, setOtpCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSendCode() {
    if (!user?.email) return

    setErrorMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'Could not send verification code.')
        return
      }

      setView('OTP')
    } catch (error) {
      console.error('Sending password-change code failed:', error)
      setErrorMessage('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setErrorMessage('')

    const code = otpCode.trim()

    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the 6-digit code sent to your email.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'Invalid or expired code.')
        return
      }

      setResetToken(data.resetToken)
      setView('NEW_PASSWORD')
    } catch (error) {
      console.error('Verifying password-change code failed:', error)
      setErrorMessage('Network error verifying code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    setErrorMessage('')

    const { newPassword, confirmPassword } = passwordForm

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-type.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to update password.')
        return
      }

      setView('DONE')
    } catch (error) {
      console.error('Updating password failed:', error)
      setErrorMessage('Network error while updating password.')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={pageStyles.page}>
        <div className={styles.card}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={pageStyles.page}>
      <div className={styles.card}>
        <Link href="/account" className={styles.backLink}>
          &larr; Back to Account
        </Link>

        <p className={styles.eyebrow}>Central Perk Cafe</p>

        {view === 'REQUEST' && (
          <>
            <h1>Change Password</h1>
            <p className={styles.intro}>
              We&apos;ll email a 6-digit verification code to{' '}
              <strong>{user?.email}</strong> before you can set a new password.
            </p>

            {errorMessage && <p className={styles.errorNotice}>{errorMessage}</p>}

            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSendCode}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </>
        )}

        {view === 'OTP' && (
          <form onSubmit={handleVerifyCode}>
            <h1>Enter Code</h1>
            <p className={styles.intro}>
              Enter the 6-digit code sent to <strong>{user?.email}</strong>.
            </p>

            {errorMessage && <p className={styles.errorNotice}>{errorMessage}</p>}

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={styles.input}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
            />

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleSendCode}
              disabled={isLoading}
            >
              Resend Code
            </button>
          </form>
        )}

        {view === 'NEW_PASSWORD' && (
          <form onSubmit={handleSetPassword}>
            <h1>Set New Password</h1>

            {errorMessage && <p className={styles.errorNotice}>{errorMessage}</p>}

            <input
              type="password"
              className={styles.input}
              placeholder="New password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
              }
            />

            <input
              type="password"
              className={styles.input}
              placeholder="Confirm new password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
              }
            />

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        {view === 'DONE' && (
          <>
            <h1>Password Updated</h1>
            <p className={styles.intro}>
              Your password has been changed successfully.
            </p>

            <Link href="/account" className={styles.primaryButton}>
              Back to Account
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
