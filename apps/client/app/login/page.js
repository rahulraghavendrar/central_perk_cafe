'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import styles from './login.module.css'

// Best-effort, display-only decode of the email inside a signed reset
// token. Never trusted for anything security-relevant -- reset-password
// re-verifies the token's signature server-side regardless. Browser-safe
// base64url decode (no Buffer, which isn't available client-side).
function decodeTokenEmailForDisplay(token) {
  try {
    const [encodedPayload] = token.split('.')
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(escape(atob(padded)))
    const payload = JSON.parse(json)
    return payload.email || ''
  } catch {
    return ''
  }
}

// Landing here from a device-confirm "No, secure my account" click --
// the URL carries a ready-to-use reset token, so we skip straight to
// RESET_PASSWORD without going through forgot-password's cooldown check
// at all (this is a different entry point entirely). Computed directly
// from searchParams (a pure read, safe to call during render) rather
// than via a mount effect, so there's no extra setState-after-mount
// render pass.
function getSecureFlowInit(searchParams) {
  const tokenFromUrl = searchParams.get('resetToken')
  const isSecureFlow = searchParams.get('secure') === '1'

  if (tokenFromUrl && isSecureFlow) {
    return {
      view: 'RESET_PASSWORD',
      resetToken: tokenFromUrl,
      resetEmail: decodeTokenEmailForDisplay(tokenFromUrl),
      securityNotice: true,
    }
  }

  return { view: 'LOGIN', resetToken: '', resetEmail: '', securityNotice: false }
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const secureFlowInit = getSecureFlowInit(searchParams)

  // Views: 'LOGIN' | 'DEVICE_VERIFY' | 'RESET_REQUEST' | 'RESET_OTP' | 'RESET_PASSWORD'
  const [currentView, setCurrentView] = useState(secureFlowInit.view)

  // Login form state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginErrors, setLoginErrors] = useState({})

  // New-device verification state (separate token from the password-reset
  // flow -- this one carries the already-authenticated pending session,
  // see lib/authTokens.js createPendingLoginToken).
  const [verifyToken, setVerifyToken] = useState('')

  // Reset flow state
  const [resetEmail, setResetEmail] = useState(secureFlowInit.resetEmail)
  const [otpCode, setOtpCode] = useState('')
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [resetToken, setResetToken] = useState(secureFlowInit.resetToken)

  // Set when we land on RESET_PASSWORD via a "No, secure my account"
  // click from a device alert email, rather than the normal
  // forgot-password flow -- shown as an extra banner explaining why.
  const [securityNotice, setSecurityNotice] = useState(secureFlowInit.securityNotice)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successBanner, setSuccessBanner] = useState('')

  // Password-reset cooldown state: set when the server says "try again
  // later" (24h after a real password change). cooldownUntil is a Date
  // or null; nowTick just forces a re-render every second so the
  // countdown display stays live. Starts at 0 rather than Date.now() --
  // it's only ever read while cooldownUntil is set, and cooldownUntil is
  // never set without also setting nowTick to a real timestamp right
  // alongside it (see handleRequestOtpSubmit and the ticking effect
  // below), so 0 as a placeholder has no visible effect.
  const [cooldownUntil, setCooldownUntil] = useState(null)
  const [nowTick, setNowTick] = useState(0)

  useEffect(() => {
    if (!cooldownUntil) return undefined

    const interval = setInterval(() => {
      if (Date.now() >= cooldownUntil.getTime()) {
        setCooldownUntil(null)
        clearInterval(interval)
        return
      }
      setNowTick(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [cooldownUntil])

  const cooldownRemainingMs = cooldownUntil
    ? Math.max(0, cooldownUntil.getTime() - nowTick)
    : 0

  function formatCooldown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

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
    setVerifyToken('')
    setSecurityNotice(false)
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

      // Login goes through our own /api/auth/login route rather than
      // calling supabase.auth.signInWithPassword() directly, so the
      // server can check the device cookie and gate the session behind
      // a 6-digit code for a device it doesn't recognize yet.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: loginForm.password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to log in. Please try again.')
        return
      }

      if (data.status === 'device_verification_required') {
        setVerifyToken(data.verifyToken)
        setOtpCode('')
        setCurrentView('DEVICE_VERIFY')
        return
      }

      if (data.status === 'ok' && data.session) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (setSessionError) {
          setErrorMessage(setSessionError.message || 'Logged in, but could not start your session. Please try again.')
          return
        }

        router.push('/home')
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred while logging in.')
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Screen 0b: New Device Verification Handler
  // ---------------------------------------------------------------------------
  async function handleVerifyDeviceSubmit(e) {
    e.preventDefault()
    setErrorMessage('')

    const code = otpCode.trim()
    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the 6-digit code sent to your email.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/verify-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifyToken, code }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid or expired code.')
        return
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })

      if (setSessionError) {
        setErrorMessage(setSessionError.message || 'Verified, but could not start your session. Please try again.')
        return
      }

      router.push('/home')
    } catch (err) {
      setErrorMessage('Network error verifying this device. Please try again.')
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
        if (data.code === 'cooldown_active' && data.retryAt) {
          setCooldownUntil(new Date(data.retryAt))
          setNowTick(Date.now())
        }
        setErrorMessage(data.error || 'Could not send verification code.')
        return
      }

      setCooldownUntil(null)
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
        {/* VIEW 0b: NEW DEVICE VERIFICATION (2FA)                           */}
        {/* ---------------------------------------------------------------- */}
        {currentView === 'DEVICE_VERIFY' && (
          <>
            <h1>Verify This Device</h1>
            <p className={styles.intro}>
              We don&apos;t recognize this device yet. We sent a 6-digit code to your email — enter it below to finish logging in.
            </p>

            {errorMessage && <div className={styles.formError}>{errorMessage}</div>}

            <form onSubmit={handleVerifyDeviceSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="device-otp-input">6-Digit Code</label>
                <input
                  id="device-otp-input"
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
                {isLoading ? 'Verifying...' : 'Verify & Log In'}
              </button>

              <div className={styles.secondaryActions}>
                <button
                  type="button"
                  onClick={handleLoginSubmit}
                  disabled={isLoading}
                  className={styles.textLink}
                >
                  Resend code
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
        {/* VIEW 1: FORGOT PASSWORD - REQUEST RESET                          */}
        {/* ---------------------------------------------------------------- */}
        {currentView === 'RESET_REQUEST' && (
          <>
            <h1>Reset Password</h1>
            <p className={styles.intro}>
              Enter your registered college email and we&apos;ll send you a 6-digit verification code.
            </p>

            {errorMessage && <div className={styles.formError}>{errorMessage}</div>}

            {cooldownUntil && cooldownRemainingMs > 0 && (
              <div className={styles.formError}>
                You recently changed your password. You can request a new reset code in{' '}
                <strong>{formatCooldown(cooldownRemainingMs)}</strong>.
              </div>
            )}

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
                disabled={isLoading || (cooldownUntil && cooldownRemainingMs > 0)}
                className={styles.submitButton}
              >
                {isLoading
                  ? 'Sending Code...'
                  : cooldownUntil && cooldownRemainingMs > 0
                    ? `Try again in ${formatCooldown(cooldownRemainingMs)}`
                    : 'Send Verification Code'}
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

            {securityNotice && (
              <div className={styles.bannerWarning}>
                For your security, please set a new password now — you told us a recent sign-in to this account wasn&apos;t you.
              </div>
            )}

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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
