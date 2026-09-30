'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './device-confirm.module.css'

function DeviceConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('idle') // idle | loading | acknowledged | error
  const [errorMessage, setErrorMessage] = useState('')

  async function respond(answer) {
    if (!token) {
      setStatus('error')
      setErrorMessage('This confirmation link is missing its token. Please use the link from your email again.')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/auth/device-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answer }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setErrorMessage(data.error || 'Something went wrong. Please try again.')
        return
      }

      if (data.status === 'secure_account' && data.resetToken) {
        // Straight to "set a new password" -- deliberately skips the
        // forgot-password cooldown, since this is a real security
        // response, not a routine reset request.
        router.push(`/login?resetToken=${encodeURIComponent(data.resetToken)}&secure=1`)
        return
      }

      setStatus('acknowledged')
    } catch (err) {
      setStatus('error')
      setErrorMessage('Network error. Please try again.')
    }
  }

  if (status === 'acknowledged') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Central Perk Cafe</div>
          <h1>Thanks for confirming</h1>
          <p className={styles.intro}>Good to know it was you. No action needed on your account.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Central Perk Cafe</div>
        <h1>Was this you?</h1>
        <p className={styles.intro}>
          We noticed a sign-in on your account from a device we hadn&apos;t seen before. Let us know if this was you.
        </p>

        {errorMessage && <div className={styles.formError}>{errorMessage}</div>}

        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.yesButton}
            disabled={status === 'loading'}
            onClick={() => respond('yes')}
          >
            Yes, this was me
          </button>
          <button
            type="button"
            className={styles.noButton}
            disabled={status === 'loading'}
            onClick={() => respond('no')}
          >
            No, secure my account
          </button>
        </div>

        <p className={styles.footnote}>
          Choosing &quot;No&quot; takes you straight to setting a new password, right now.
        </p>
      </div>
    </div>
  )
}

export default function DeviceConfirmPage() {
  return (
    <Suspense fallback={null}>
      <DeviceConfirmContent />
    </Suspense>
  )
}
