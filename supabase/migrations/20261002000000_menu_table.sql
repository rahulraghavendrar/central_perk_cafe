-- Menu table for Central Perk Cafe
create table if not exists public.menu (
  id uuid primary key default gen_random_uuid(),
  dish_name text not null,
  price numeric(10, 2) not null,
  sub_category text not null,
  is_veg boolean not null default true,
  image_url text,
  toppings jsonb default '[]'::jsonb,
  extras jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.menu enable row level security;

-- Drop policy if exists and create select policy for read access
drop policy if exists "Allow public read access to menu" on public.menu;
create policy "Allow public read access to menu"
  on public.menu for select
  using (true);

-- Grant read access to client roles
grant usage on schema public to anon, authenticated, service_role;
grant select on table public.menu to anon, authenticated;
grant all on table public.menu to service_role;
