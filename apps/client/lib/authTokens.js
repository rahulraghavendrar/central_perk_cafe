import crypto from 'crypto'

const SECRET = process.env.AUTH_RESET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-fallback-secret'

/**
 * Creates a signed verification token for an authenticated OTP verification.
 * Valid for 15 minutes to allow the user to complete password entry.
 */
export function createResetToken(email, expiresInMinutes = 15) {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ email, expiresAt })).toString('base64url')
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64url')

  return `${payload}.${signature}`
}

/**
 * Verifies the signed verification token.
 * Returns { valid: boolean, email?: string, error?: string }
 */
export function verifyResetToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Reset token is required.' }
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid reset token format.' }
  }

  const [payload, signature] = parts
  const expectedSignature = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64url')

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false, error: 'Invalid reset token signature.' }
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    if (!data.email || !data.expiresAt) {
      return { valid: false, error: 'Corrupt reset token payload.' }
    }

    if (Date.now() > data.expiresAt) {
      return { valid: false, error: 'Reset session has expired. Please request a new code.' }
    }

    return { valid: true, email: data.email }
  } catch {
    return { valid: false, error: 'Malformed reset token.' }
  }
}
