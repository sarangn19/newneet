-- ═══════════════════════════════════════════════════════════════
-- NEET Prep — Migration (works WITH your existing tables)
-- Paste into SQL Editor → Run
-- Only adds missing pieces, never drops existing tables
-- ═══════════════════════════════════════════════════════════════

-- ── 1. RLS on existing tables ────────────────────────────────────
alter table public.users             enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.battle_history    enable row level security;
alter table public.battle_matches    enable row level security;
alter table public.badges            enable row level security;
alter table public.matchmaking_queue enable row level security;

-- ── 2. Drop old policies if they exist, then recreate ────────────
do $$ begin
  drop policy if exists "users_own"              on public.users;
  drop policy if exists "lesson_progress_own"    on public.lesson_progress;
  drop policy if exists "battle_history_own"     on public.battle_history;
  drop policy if exists "battle_matches_own"     on public.battle_matches;
  drop policy if exists "badges_own"             on public.badges;
  drop policy if exists "matchmaking_queue_own"  on public.matchmaking_queue;
  drop policy if exists "users_read_leaderboard" on public.users;
end $$;

-- Users: own row read/write + anyone can read for leaderboard
create policy "users_own"
  on public.users for all
  using (auth.uid() = id);

create policy "users_read_leaderboard"
  on public.users for select
  using (true);

-- Lesson progress: own rows
create policy "lesson_progress_own"
  on public.lesson_progress for all
  using (auth.uid() = user_id);

-- Battle history: players in the match can read
create policy "battle_history_own"
  on public.battle_history for all
  using (auth.uid() = player1_id or auth.uid() = player2_id);

-- Battle matches: players in the match
create policy "battle_matches_own"
  on public.battle_matches for all
  using (auth.uid() = player1_id or auth.uid() = player2_id);

-- Badges: own rows
create policy "badges_own"
  on public.badges for all
  using (auth.uid() = user_id);

-- Matchmaking queue: own row
create policy "matchmaking_queue_own"
  on public.matchmaking_queue for all
  using (auth.uid() = user_id);

-- ── 3. Leaderboard view (uses existing `users` table) ────────────
drop view if exists public.leaderboard;

create view public.leaderboard as
select
  id,
  name,
  avatar,
  level,
  tokens  as xp,
  gems    as coins,
  streak,
  row_number() over (order by tokens desc, level desc) as position
from public.users
where status = 'active'
order by tokens desc, level desc
limit 100;

grant select on public.leaderboard to anon, authenticated;

-- ── 4. Auto-insert into users on signup ──────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id, email, name, avatar, role, status,
    level, streak, tokens, gems, completed_lessons,
    last_active, created_at, updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    '🧑‍🎓',
    'student',
    'active',
    1, 0, 0, 0, 0,
    current_date,
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
