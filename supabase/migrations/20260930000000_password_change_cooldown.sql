-- Tracks the last time a user's password was actually changed (via
-- reset-password), so forgot-password can enforce a 24h cooldown before
-- another reset OTP can be requested for the same account.
alter table public.profiles
  add column if not exists password_changed_at timestamptz;

comment on column public.profiles.password_changed_at is
  'Last time this user''s password was changed via the forgot-password reset flow. Null means never reset. Used to enforce a 24h cooldown between resets.';
