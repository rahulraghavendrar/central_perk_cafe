import crypto from 'crypto'

const SECRET = process.env.AUTH_RESET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-fallback-secret'

/**
 * Generic signed-token helpers. Payload is base64url JSON + an HMAC-SHA256
 * signature -- readable by anyone holding the token (it's signed, not
 * encrypted), but tamper-proof and expiring. Used for the password-reset
 * flow and the device-recognition flow below, so both share one
 * implementation instead of duplicating the HMAC logic.
 */
export function createSignedToken(payload, expiresInMinutes) {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000
  const fullPayload = { ...payload, expiresAt }
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(encodedPayload)
    .digest('base64url')

  return `${encodedPayload}.${signature}`
}

export function verifySignedToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required.' }
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token format.' }
  }

  const [encodedPayload, signature] = parts
  const expectedSignature = crypto
    .createHmac('sha256', SECRET)
    .update(encodedPayload)
    .digest('base64url')

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false, error: 'Invalid token signature.' }
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'))
    if (!payload.expiresAt) {
      return { valid: false, error: 'Corrupt token payload.' }
    }

    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'This link or session has expired.' }
    }

    return { valid: true, payload }
  } catch {
    return { valid: false, error: 'Malformed token.' }
  }
}

/**
 * Creates a signed verification token for an authenticated OTP verification.
 * Valid for 15 minutes to allow the user to complete password entry.
 */
export function createResetToken(email, expiresInMinutes = 15) {
  return createSignedToken({ email }, expiresInMinutes)
}

/**
 * Verifies the signed verification token.
 * Returns { valid: boolean, email?: string, error?: string }
 */
export function verifyResetToken(token) {
  const result = verifySignedToken(token)
  if (!result.valid) {
    return { valid: false, error: result.error }
  }
  if (!result.payload.email) {
    return { valid: false, error: 'Corrupt reset token payload.' }
  }
  return { valid: true, email: result.payload.email }
}

/**
 * Pending-login token: issued once a password check succeeds but the
 * device hasn't been verified yet. Carries the real Supabase session
 * tokens so verify-device can hand them to the client once the 6-digit
 * code is confirmed, without asking for the password a second time.
 * Short-lived (10 min) since it's effectively a bearer credential for
 * that pending login.
 */
export function createPendingLoginToken({ userId, email, deviceToken, session }) {
  return createSignedToken(
    { purpose: 'device_login_pending', userId, email, deviceToken, session },
    10
  )
}

export function verifyPendingLoginToken(token) {
  const result = verifySignedToken(token)
  if (!result.valid) {
    return { valid: false, error: result.error }
  }
  if (result.payload.purpose !== 'device_login_pending' || !result.payload.userId || !result.payload.session) {
    return { valid: false, error: 'Invalid login session token.' }
  }
  return { valid: true, ...result.payload }
}

/**
 * "Was this you?" token embedded in the device-alert emails. Long-lived
 * (24h) since someone may not check email right away, and clicking
 * "No" is what lets them secure the account without re-authenticating
 * first (they're proving identity by having access to the inbox the
 * link was sent to).
 */
export function createDeviceResponseToken({ userId, email }) {
  return createSignedToken({ purpose: 'device_response', userId, email }, 24 * 60)
}

export function verifyDeviceResponseToken(token) {
  const result = verifySignedToken(token)
  if (!result.valid) {
    return { valid: false, error: result.error }
  }
  if (result.payload.purpose !== 'device_response' || !result.payload.email) {
    return { valid: false, error: 'Invalid confirmation link.' }
  }
  return { valid: true, ...result.payload }
}
