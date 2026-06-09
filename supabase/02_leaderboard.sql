-- ═══════════════════════════════════════════════════════
-- STEP 2: Run this AFTER step 1 succeeds — Leaderboard view
-- ═══════════════════════════════════════════════════════

drop view if exists public.leaderboard;

create view public.leaderboard as
select
  p.id,
  p.name,
  p.avatar,
  p.level,
  p.xp,
  p.rank,
  coalesce(s.battles_won, 0) as battles_won,
  row_number() over (order by p.xp desc) as position
from public.profiles p
left join public.user_stats s on s.user_id = p.id
order by p.xp desc
limit 100;

grant select on public.leaderboard to anon, authenticated;
