'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from './signup.module.css'

const initialForm = {
  name: '',
  email: '',
  password: '',
  phoneNumber: '',
}

function getRollNumber(email) {
  const normalizedEmail = email.trim().toLowerCase()
  const emailParts = normalizedEmail.match(/^([^@\s]+)@(snuchennai\.edu\.in|ssn\.edu\.in)$/)

  if (!emailParts) {
    return null
  }

  const requiredDigits = emailParts[2] === 'snuchennai.edu.in' ? 8 : 7
  const rollNumberMatch = emailParts[1].match(new RegExp(`(\\d{${requiredDigits}})$`))

  return rollNumberMatch ? rollNumberMatch[1] : null
}

function validateForm(form) {
  const errors = {}

  if (!form.name.trim()) {
    errors.name = 'Please enter your name.'
  }

  if (!form.email.trim()) {
    errors.email = 'Please enter your college email.'
  } else if (!getRollNumber(form.email)) {
    errors.email = 'Use a valid SNU or SSN college email with a roll number at the end.'
  }

  if (!form.password) {
    errors.password = 'Please create a password.'
  }

  if (!form.phoneNumber.trim()) {
    errors.phoneNumber = 'Please enter your phone number.'
  } else {
    const phoneDigits = form.phoneNumber.replace(/\D/g, '')
    if (!/^[+()\-\s\d]+$/.test(form.phoneNumber) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.phoneNumber = 'Please enter a valid phone number.'
    }
  }

  return errors
}

function getSignupErrorMessage(error, isProfileError = false) {
  if (isProfileError) {
    if (error?.code === '23505' && String(error?.message || '').toLowerCase().includes('roll_number')) {
      return 'That college roll number is already registered.'
    }

    return 'Your account was created, but we could not save your profile. Please contact support.'
  }

  const message = error?.message?.toLowerCase() || ''

  if (message.includes('invalid login credentials')) {
    return 'The email or password could not be verified. Please check your details and try again.'
  }

  // Surface the real reason (e.g. "Password should be at least 6 characters")
  // instead of always falling back to a generic message.
  return error?.message || 'We could not create your account. Please try again.'
}

function hasSignupMetadata(user) {
  const metadata = user.user_metadata || {}

  return Boolean(
    typeof metadata.name === 'string' &&
    metadata.name.trim() &&
    typeof metadata.roll_number === 'string' &&
    metadata.roll_number &&
    typeof metadata.phone_number === 'string' &&
    metadata.phone_number.trim()
  )
}

async function createProfileForUser(user) {
  const metadata = user.user_metadata || {}
  const profile = {
    id: user.id,
    roll_number: metadata.roll_number,
    name: metadata.name,
    email: user.email,
    phone_number: metadata.phone_number,
  }

  if (!profile.roll_number || !profile.name || !profile.email || !profile.phone_number) {
    return { error: { isProfileError: true } }
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileLookupError) {
    return { error: Object.assign(profileLookupError, { isProfileError: true }) }
  }

  if (existingProfile) {
    return { error: null }
  }

  const { error: profileError } = await supabase.from('profiles').insert(profile)
  return {
    error: profileError
      ? Object.assign(profileError, { isProfileError: true })
      : null,
  }
}

export default function SignupPage() {
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const profileSyncInFlight = useRef(new Set())

  useEffect(() => {
    let isMounted = true

    async function syncProfile(user) {
      if (!hasSignupMetadata(user) || profileSyncInFlight.current.has(user.id)) {
        return
      }

      profileSyncInFlight.current.add(user.id)
      const { error } = await createProfileForUser(user)
      profileSyncInFlight.current.delete(user.id)

      if (isMounted && error) {
        setFormError(getSignupErrorMessage(error, true))
      }
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (isMounted) {
          setFormError('We could not verify your email session. Please try again.')
        }
        return
      }

      if (data.session?.user) {
        void syncProfile(data.session.user)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        window.setTimeout(() => void syncProfile(session.user), 0)
      }
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    setFieldErrors((currentErrors) => ({ ...currentErrors, [name]: '' }))
    setFormError('')
    setSuccessMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const validationErrors = validateForm(form)
    setFieldErrors(validationErrors)
    setFormError('')
    setSuccessMessage('')

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const email = form.email.trim().toLowerCase()

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email,
          password: form.password,
          phoneNumber: form.phoneNumber.trim(),
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (result.code === 'user_exists') {
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password: form.password,
          })

          if (loginError) {
            throw loginError
          }

          setForm(initialForm)
          setSuccessMessage('Account already exists. You have been logged in.')
          return
        }

        throw Object.assign(new Error(result.error || 'We could not create your account. Please try again.'), {
          code: result.code,
        })
      }

      setForm(initialForm)
      setSuccessMessage('Your account has been created. Check your college email and click the verification link.')
    } catch (error) {
      setFormError(getSignupErrorMessage(error, error?.isProfileError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="signup-title">
        <p className={styles.eyebrow}>Central Perk Cafe</p>
        <h1 id="signup-title">Create your account</h1>
        <p className={styles.intro}>Use your SNU Chennai identity to get started.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
            {fieldErrors.name && <p id="name-error" className={styles.fieldError}>{fieldErrors.name}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="email">College email ID</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && <p id="email-error" className={styles.fieldError}>{fieldErrors.email}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && <p id="password-error" className={styles.fieldError}>{fieldErrors.password}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="phoneNumber">Phone number</label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              value={form.phoneNumber}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.phoneNumber)}
              aria-describedby={fieldErrors.phoneNumber ? 'phone-number-error' : undefined}
            />
            {fieldErrors.phoneNumber && <p id="phone-number-error" className={styles.fieldError}>{fieldErrors.phoneNumber}</p>}
          </div>

          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          {successMessage && <p className={styles.successMessage} role="status">{successMessage}</p>}

          <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className={styles.loginPrompt}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  )
}
