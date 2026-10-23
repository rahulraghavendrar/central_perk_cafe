// Extracts the roll number from a college email and validates its length
// against the issuing domain (SNU Chennai: 8 digits, SSN: 7 digits).
//
// The digit-count check must use a negative lookbehind -- `\d{8}$` alone
// also matches the *last 8 digits of a longer run* (e.g. a 9-digit
// number like "234234452" still matches "34234452$"), silently accepting
// an invalid roll number length. `(?<!\d)\d{8}$` requires the character
// right before the match to not be a digit, so the run has to be
// *exactly* that many digits long.
export function getRollNumber(email) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  const emailParts = normalizedEmail.match(/^([^@\s]+)@(snuchennai\.edu\.in|ssn\.edu\.in)$/)

  if (!emailParts) {
    return null
  }

  const requiredDigits = emailParts[2] === 'snuchennai.edu.in' ? 8 : 7
  const rollNumberMatch = emailParts[1].match(
    new RegExp(`(?<!\\d)(\\d{${requiredDigits}})$`)
  )

  return rollNumberMatch ? rollNumberMatch[1] : null
}
