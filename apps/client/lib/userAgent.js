// Best-effort, display-only parsing of a browser User-Agent string into
// something a student can recognize at a glance ("Chrome on Windows"
// rather than the raw UA string). Not used for anything security-related
// -- device trust itself is the device_token cookie + email OTP already
// handled by the login flow (see app/api/auth/login/route.js), this is
// purely cosmetic labeling for the Account page's device list.
export function describeUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return 'Unknown device'

  let browser = 'A browser'
  if (/edg\//i.test(userAgent)) browser = 'Edge'
  else if (/opr\/|opera/i.test(userAgent)) browser = 'Opera'
  else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome'
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox'
  else if (/safari/i.test(userAgent)) browser = 'Safari'

  let os = 'an unknown device'
  if (/iphone/i.test(userAgent)) os = 'iPhone'
  else if (/ipad/i.test(userAgent)) os = 'iPad'
  else if (/android/i.test(userAgent)) os = 'Android'
  else if (/mac os x|macintosh/i.test(userAgent)) os = 'Mac'
  else if (/windows/i.test(userAgent)) os = 'Windows'
  else if (/linux/i.test(userAgent)) os = 'Linux'

  return `${browser} on ${os}`
}
