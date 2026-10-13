import { supabase } from '@/lib/supabaseClient'

// A signed-in user has everything needed to create their 'profiles' row
// once their auth metadata (set at signup time) has name, roll_number, and
// phone_number on it.
export function hasSignupMetadata(user) {
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

// Creates this user's 'profiles' row from their auth metadata if it doesn't
// exist yet. Safe to call repeatedly -- it checks first and no-ops if the
// row is already there.
//
// This is shared (not just called from the signup page) so that ANY page
// the user lands on after confirming their email can self-heal a missing
// profile row -- not only someone who happens to land back on /signup
// right after clicking the confirmation link. An account whose profile
// never got created that way (an old redirect that got interrupted, a
// direct login, etc.) would otherwise be permanently stuck: no roll
// number, no name, every page that reads `profile` quietly broken.
export async function createProfileForUser(user) {
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
