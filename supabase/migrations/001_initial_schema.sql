-- 001_initial_schema.sql
-- Run this first in Supabase SQL Editor
-- Creates all tables with proper types, indexes, and Row Level Security

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type plan_type as enum ('free', 'pro', 'enterprise');
create type sub_status as enum ('active', 'expired', 'failed', 'cancelled');
create type trend_dir  as enum ('up', 'down', 'flat');
create type action_type as enum ('sell', 'hold', 'buy', 'alert');

-- ============================================================
-- USERS
-- ============================================================
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  phone           text,
  full_name       text,
  plan            plan_type not null default 'free',
  plan_expires_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create user row when someone signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table public.subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,
  plan         plan_type not null,
  amount_kes   integer not null,
  mpesa_code   text,          -- M-Pesa confirmation code e.g. "QHX4K9..."
  stripe_id    text,          -- Stripe payment intent id if paid by card
  status       sub_status not null default 'active',
  paid_at      timestamptz not null default now(),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create index idx_subscriptions_user on public.subscriptions(user_id);
create index idx_subscriptions_status on public.subscriptions(status);

-- ============================================================
-- PRICES  (populated by Edge Function every 6 hours)
-- ============================================================
create table public.prices (
  id           uuid primary key default uuid_generate_v4(),
  commodity    text not null,
  location     text not null,
  market_type  text,                   -- 'wholesale' | 'retail' | 'farm gate'
  price_kes    numeric(10,2) not null,
  price_usd    numeric(10,4),
  trend        trend_dir default 'flat',
  action       action_type default 'hold',
  source       text,                   -- 'KAMIS' | 'FEWS NET' | 'World Bank' | etc
  benchmark_kes numeric(10,2),         -- global benchmark converted to KES
  is_below_threshold boolean generated always as (price_kes < benchmark_kes * 0.80) stored,
  fetched_at   timestamptz not null default now()
);

-- Unique constraint: one price per commodity+location per fetch cycle
create unique index idx_prices_latest on public.prices(commodity, location, fetched_at);
create index idx_prices_commodity on public.prices(commodity);
create index idx_prices_fetched   on public.prices(fetched_at desc);

-- ============================================================
-- LIVESTOCK PRICES
-- ============================================================
create table public.livestock_prices (
  id           uuid primary key default uuid_generate_v4(),
  animal       text not null,
  location     text not null,
  price_kes_kg text not null,          -- stored as range e.g. "320-336"
  price_usd    numeric(10,2),
  trend        trend_dir default 'flat',
  action       action_type default 'hold',
  source       text,
  fetched_at   timestamptz not null default now()
);

create index idx_livestock_fetched on public.livestock_prices(fetched_at desc);

-- ============================================================
-- FOREX CACHE  (updated by Edge Function)
-- ============================================================
create table public.forex_cache (
  id          text primary key,        -- always 'latest'
  usd_kes     numeric(10,4),
  eur_kes     numeric(10,4),
  gbp_kes     numeric(10,4),
  usd_ugx     numeric(10,2),
  usd_tzs     numeric(10,2),
  usd_etb     numeric(10,4),
  usd_sos     numeric(10,2),
  kes_sos     numeric(10,4),
  source      text,
  fetched_at  timestamptz not null default now()
);

-- Seed with initial values so frontend always has something
insert into public.forex_cache (id, usd_kes, eur_kes, gbp_kes, usd_ugx, usd_tzs, usd_etb, usd_sos, kes_sos, source, fetched_at)
values ('latest', 129.40, 140.22, 165.80, 3710, 2615, 57.85, 571, 4.41, 'seed', now());

-- ============================================================
-- ALERTS LOG  (exploitation events)
-- ============================================================
create table public.alerts_log (
  id              uuid primary key default uuid_generate_v4(),
  commodity       text not null,
  location        text not null,
  local_price     numeric(10,2) not null,
  benchmark_price numeric(10,2) not null,
  gap_percent     numeric(5,2) not null,
  sms_sent        boolean default false,
  sms_recipients  integer default 0,
  created_at      timestamptz not null default now()
);

create index idx_alerts_created on public.alerts_log(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY — critical: users only see their own data
-- ============================================================

-- Users table
alter table public.users enable row level security;
create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

-- Subscriptions
alter table public.subscriptions enable row level security;
create policy "Users can read own subscriptions"
  on public.subscriptions for select using (auth.uid() = user_id);

-- Prices — public read (everyone can see market prices)
alter table public.prices enable row level security;
create policy "Anyone can read prices"
  on public.prices for select using (true);
create policy "Only service role can insert prices"
  on public.prices for insert with check (false); -- Edge Function uses service_role key

-- Livestock — public read
alter table public.livestock_prices enable row level security;
create policy "Anyone can read livestock"
  on public.livestock_prices for select using (true);

-- Forex — public read
alter table public.forex_cache enable row level security;
create policy "Anyone can read forex"
  on public.forex_cache for select using (true);

-- Alerts log — public read
alter table public.alerts_log enable row level security;
create policy "Anyone can read alerts"
  on public.alerts_log for select using (true);
