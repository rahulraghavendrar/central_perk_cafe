-- Devices previously verified for a given account, so a login from the
-- same browser again can skip the 2FA step. "Device" here really means
-- "browser holding a specific cookie we issued" -- there is no true
-- hardware device ID available to a website.
create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint trusted_devices_user_token_unique unique (user_id, device_token)
);

create index if not exists idx_trusted_devices_user_id
  on public.trusted_devices(user_id);

alter table public.trusted_devices enable row level security;

-- One-time 6-digit codes used to verify a new device at login time.
-- Kept separate from password_reset_codes, which is for forgot-password
-- -- these serve different flows and shouldn't share a table.
create table if not exists public.device_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code varchar(6) not null,
  device_token text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_verification_codes_lookup
  on public.device_verification_codes(email, code, used);

alter table public.device_verification_codes enable row level security;

grant all on table public.trusted_devices to service_role;
grant all on table public.device_verification_codes to service_role;
