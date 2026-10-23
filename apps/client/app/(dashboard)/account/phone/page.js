'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthSession } from '@/lib/useAuthSession'
import pageStyles from '../account.module.css'
import styles from './phone.module.css'

// Same phone validation the signup page already applies
// (apps/client/app/signup/page.js) -- kept in sync so a number good
// enough to sign up with is also good enough to update to here.
function isValidPhoneNumber(value) {
  if (!value.trim()) return false
  const digits = value.replace(/\D/g, '')
  return /^[+()\-\s\d]+$/.test(value) && digits.length >= 7 && digits.length <= 15
}

export default function UpdatePhonePage() {
  const { profile, loading } = useAuthSession()

  const [phoneNumber, setPhoneNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMessage('')

    const trimmed = phoneNumber.trim()

    if (!isValidPhoneNumber(trimmed)) {
      setErrorMessage('Please enter a valid phone number.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/account/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, phoneNumber: trimmed }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to update phone number.')
        return
      }

      setDone(true)
    } catch (error) {
      console.error('Updating phone number failed:', error)
      setErrorMessage('Network error while updating your phone number.')
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

        {done ? (
          <>
            <h1>Phone Number Updated</h1>
            <p className={styles.intro}>
              Your phone number has been changed successfully.
            </p>

            <Link href="/account" className={styles.primaryButton}>
              Back to Account
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1>Update Phone Number</h1>

            <p className={styles.intro}>
              Current number on file:{' '}
              <strong>{profile?.phone_number || 'Not set'}</strong>
            </p>

            {errorMessage && <p className={styles.errorNotice}>{errorMessage}</p>}

            <input
              type="tel"
              className={styles.input}
              placeholder="New phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Phone Number'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
