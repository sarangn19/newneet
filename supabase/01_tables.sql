-- ═══════════════════════════════════════════════════════
-- STEP 1: Run this first — Tables + RLS + Trigger
-- ═══════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- profiles
create table if not exists public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  name         text        not null default 'Student',
  avatar       text        not null default '🧑‍🎓',
  level        integer     not null default 1,
  xp           integer     not null default 0,
  xp_to_next   integer     not null default 500,
  streak       integer     not null default 0,
  coins        integer     not null default 0,
  rank         text        not null default 'Bronze',
  last_active  date,
  created_at   timestamptz not null default now()
);

-- user_stats
create table if not exists public.user_stats (
  id                  uuid    primary key default uuid_generate_v4(),
  user_id             uuid    not null unique references public.profiles(id) on delete cascade,
  total_questions     integer not null default 0,
  correct             integer not null default 0,
  time_spent          integer not null default 0,
  battles_won         integer not null default 0,
  battles_played      integer not null default 0,
  physics_progress    integer not null default 0,
  chemistry_progress  integer not null default 0,
  biology_progress    integer not null default 0,
  updated_at          timestamptz not null default now()
);

-- completed_modules
create table if not exists public.completed_modules (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  module_id    text        not null,
  completed_at timestamptz not null default now(),
  unique(user_id, module_id)
);

-- battle_history
create table if not exists public.battle_history (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  opponent_name text        not null,
  my_score      integer     not null default 0,
  opp_score     integer     not null default 0,
  won           boolean     not null default false,
  xp_earned     integer     not null default 0,
  played_at     timestamptz not null default now()
);

-- mcq_attempts
create table if not exists public.mcq_attempts (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  question_id  integer     not null,
  subject      text        not null,
  chapter      text        not null,
  correct      boolean     not null,
  attempted_at timestamptz not null default now()
);

-- RLS
alter table public.profiles          enable row level security;
alter table public.user_stats        enable row level security;
alter table public.completed_modules enable row level security;
alter table public.battle_history    enable row level security;
alter table public.mcq_attempts      enable row level security;

drop policy if exists "profiles_own"          on public.profiles;
drop policy if exists "user_stats_own"        on public.user_stats;
drop policy if exists "completed_modules_own" on public.completed_modules;
drop policy if exists "battle_history_own"    on public.battle_history;
drop policy if exists "mcq_attempts_own"      on public.mcq_attempts;

create policy "profiles_own"          on public.profiles          for all using (auth.uid() = id);
create policy "user_stats_own"        on public.user_stats        for all using (auth.uid() = user_id);
create policy "completed_modules_own" on public.completed_modules for all using (auth.uid() = user_id);
create policy "battle_history_own"    on public.battle_history    for all using (auth.uid() = user_id);
create policy "mcq_attempts_own"      on public.mcq_attempts      for all using (auth.uid() = user_id);

-- Trigger: auto-create profile + stats row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
