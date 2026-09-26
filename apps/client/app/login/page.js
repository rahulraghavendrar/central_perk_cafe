'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()

  // Views: 'LOGIN' | 'RESET_REQUEST' | 'RESET_OTP' | 'RESET_PASSWORD'
  const [currentView, setCurrentView] = useState('LOGIN')

  // Login form state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginErrors, setLoginErrors] = useState({})

  // Reset flow state
  const [resetEmail, setResetEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [resetToken, setResetToken] = useState('')

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successBanner, setSuccessBanner] = useState('')

  // ---------------------------------------------------------------------------
  // View Switchers & Helpers
  // ---------------------------------------------------------------------------
  function goToLogin(successMsg = '') {
    setCurrentView('LOGIN')
    setErrorMessage('')
    setSuccessBanner(successMsg)
    setOtpCode('')
    setPasswordForm({ newPassword: '', confirmPassword: '' })
    setResetToken('')
  }

  function startForgotPassword() {
    setErrorMessage('')
    setSuccessBanner('')
    setResetEmail(loginForm.email || '')
    setCurrentView('RESET_REQUEST')
  }

  // ---------------------------------------------------------------------------
  // Screen 0: Login Handler
  // ---------------------------------------------------------------------------
  async function handleLoginSubmit(e) {
    e.preventDefault()
    setErrorMessage('')
    setSuccessBanner('')

    const errors = {}
    if (!loginForm.email.trim()) {
      errors.email = 'Please enter your college email.'
    }
    if (!loginForm.password) {
      errors.password = 'Please enter your password.'
    }

    if (Object.keys(errors).length > 0) {
      setLoginErrors(errors)
      return
    }

    setLoginErrors({})
    setIsLoading(true)

    try {
      const email = loginForm.email.trim().toLowerCase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginForm.password,
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          setErrorMessage('Wrong password or invalid credentials.')
        } else if (msg.includes('email not confirmed')) {
          setErrorMessage('Please confirm your email address before logging in.')
        } else {
          setErrorMessage(error.message || 'Failed to log in. Please try again.')
        }
        return
      }

      if (data?.session) {
        router.push('/home')
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred while logging in.')
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Screen 1: Request Password Reset Handler
  // ---------------------------------------------------------------------------
  async function handleRequestOtpSubmit(e) {
    e.preventDefault()
    setErrorMessage('')

    const email = resetEmail.trim().toLowerCase()
    if (!email) {
      setErrorMessage('Please enter your registered college email.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error || 'Could not send verification code.')
        return
      }

      setCurrentView('RESET_OTP')
    } catch (err) {
      setErrorMessage('Network error. Failed to dispatch reset code.')
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Screen 2: Verify OTP Handler
  // ---------------------------------------------------------------------------
  async function handleVerifyOtpSubmit(e) {
    e.preventDefault()
    setErrorMessage('')

    const code = otpCode.trim()
    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the 6-digit code sent to your email.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          code,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid or expired code.')
        return
      }

      setResetToken(data.resetToken)
      setCurrentView('RESET_PASSWORD')
    } catch (err) {
      setErrorMessage('Network error verifying code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Screen 3: New Password Submission Handler
  // ---------------------------------------------------------------------------
  async function handleResetPasswordSubmit(e) {
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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken,
          newPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to update password.')
        return
      }

      // Success: return to login view with success banner
      goToLogin('Your password has been successfully updated! Please log in.')
    } catch (err) {
      setErrorMessage('Network error while resetting password.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Central Perk Cafe</div>

        {/* ---------------------------------------------------------------- */}
        {/* VIEW 0: LOGIN VIEW (DEFAULT)                                     */}
        {/* ---------------------------------------------------------------- */}
        {currentView === 'LOGIN' && (
          <>
            <h1>Welcome Back</h1>
            <p className={styles.intro}>Log in to order from the cafe counter.</p>

            {successBanner && (
              <div className={styles.bannerSuccess}>
                <span>✓</span>
                <div>{successBanner}</div>
              </div>
            )}

            {errorMessage && <div className={styles.formError}>{errorMessage}</div>}

            <form onSubmit={handleLoginSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="login-email">College Email</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="e.g. name23010111@snuchennai.edu.in"
                  value={loginForm.email}
                  onChange={(e) => {
                    setLoginForm({ ...loginForm, email: e.target.value })
                    setLoginErrors({ ...loginErrors, email: '' })
                    setErrorMessage('')
                  }}
                  aria-invalid={Boolean(loginErrors.email)}
                />
                {loginErrors.email && (
                  <span className={styles.fieldError}>{loginErrors.email}</span>
                )}
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    onClick={startForgotPassword}
                    className={styles.textLink}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => {
                    setLoginForm({ ...loginForm, password: e.target.value })
                    setLoginErrors({ ...loginErrors, password: '' })
                    setErrorMessage('')
                  }}
                  aria-invalid={Boolean(loginErrors.password)}
                />
                {loginErrors.password && (
                  <span className={styles.fieldError}>{loginErrors.password}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={styles.submitButton}
              >
                {isLoading ? 'Logging in...' : 'Log in'}
              </button>
            </form>

            <div className={styles.switchAuth}>
              Don&apos;t have an account?
              <Link href="/signup">Create one here</Link>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* VIEW 1: FORGOT PASSWORD - REQUEST RESET                          */}
        {/* ---------------------------------------------------------------- */}
        {currentView === 'RESET_REQUEST' && (
          <>
            <h1>Reset Password</h1>
            <p className={styles.intro}>
              Enter your registered college email and we&apos;ll send you a 6-digit verification code.
            </p>

            {errorMessage && <div className={styles.formError}>{errorMessage}</div>}

            <form onSubmit={handleRequestOtpSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="reset-email">Registered College Email</label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="e.g. name23010111@snuchennai.edu.in"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value)
                    setErrorMessage('')
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={styles.submitButton}
              >
                {isLoading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>

            <div className={styles.backRow}>
              <button
                type="button"
                onClick={() => goToLogin()}
                className={styles.textLink}
              >
                ← Back to Log In
              </button>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* VIEW 2: FORGOT PASSWORD - ENTER OTP                              */}
        {/* ---------------------------------------------------------------- */}
        {currentView === 'RESET_OTP' && (
          <>
            <h1>Enter Verification Code</h1>
            <p className={styles.intro}>
              We sent a 6-digit code to <strong>{resetEmail}</strong>. Please enter it below.
            </p>

            {errorMessage && <div className={styles.formError}>{errorMessage}</div>}

            <form onSubmit={handleVerifyOtpSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="otp-input">6-Digit Code</label>
                <input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="123456"
                  className={styles.otpInput}
                  value={otpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    setOtpCode(val)
                    setErrorMessage('')
                  }}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className={styles.submitButton}
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className={styles.secondaryActions}>
                <button
                  type="button"
                  onClick={handleRequestOtpSubmit}
                  disabled={isLoading}
                  className={styles.textLink}
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('RESET_REQUEST')}
                  className={styles.textLink}
                >
                  Change email
                </button>
              </div>
            </form>

            <div className={styles.backRow}>
              <button
                type="button"
                onClick={() => goToLogin()}
                className={styles.textLink}
              >
                ← Cancel and Back to Log In
              </button>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* VIEW 3: FORGOT PASSWORD - SET NEW PASSWORD                       */}
        {/* ---------------------------------------------------------------- */}
        {currentView === 'RESET_PASSWORD' && (
          <>
            <h1>Create New Password</h1>
            <p className={styles.intro}>
              Enter a secure new password for <strong>{resetEmail}</strong>.
            </p>

            {errorMessage && <div className={styles.formError}>{errorMessage}</div>}

            <form onSubmit={handleResetPasswordSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={passwordForm.newPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    setErrorMessage('')
                  }}
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="confirm-password">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    setErrorMessage('')
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={styles.submitButton}
              >
                {isLoading ? 'Updating Password...' : 'Update Password & Log In'}
              </button>
            </form>

            <div className={styles.backRow}>
              <button
                type="button"
                onClick={() => goToLogin()}
                className={styles.textLink}
              >
                ← Cancel and Back to Log In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
