-- 1. password_reset_codes table
create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code varchar(6) not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_codes_email 
  on public.password_reset_codes(email);

create index if not exists idx_password_reset_codes_lookup 
  on public.password_reset_codes(email, code, used);

-- Enable RLS (only service role should read/write reset codes)
alter table public.password_reset_codes enable row level security;


-- 2. mail_log table for quota tracking & failover
create table if not exists public.mail_log (
  id uuid primary key default gen_random_uuid(),
  mailbox text not null,
  date date not null default current_date,
  sent_count integer not null default 0,
  constraint mail_log_mailbox_date_unique unique (mailbox, date)
);

-- Enable RLS (managed server-side via service role)
alter table public.mail_log enable row level security;

-- 3. Grants for service_role and client roles
grant usage on schema public to anon, authenticated, service_role;
grant all on table public.profiles to service_role;
grant all on table public.password_reset_codes to service_role;
grant all on table public.mail_log to service_role;
grant select, insert, update on table public.profiles to authenticated;

