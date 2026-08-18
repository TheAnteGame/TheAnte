-- 0003 — RLS. The blackout is enforced HERE, not in application code (ANTE-TECH §1).
-- The requesting user is identified by auth.jwt()->>'sub' — a Clerk user id, TEXT,
-- via Clerk's native third-party integration. Never auth.uid() (ANTE-TECH §3.2).
--
-- The policy in words (ANTE-TECH §4.2): tickets and bets are readable ONLY when the
-- parent week's revealed_at IS NOT NULL, or when the row belongs to the requesting
-- player. This applies to the commissioner identically — there is no admin bypass.

-- ── Identity helpers ───────────────────────────────────────────────────────────
-- SECURITY DEFINER is confined to identity lookup, the one standard legitimate use.
-- Anything else written DEFINER needs review as careful as the policies themselves
-- (ANTE-TECH §4.2).
create schema if not exists ante;

create or replace function ante.me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from players where clerk_user_id = (auth.jwt()->>'sub')
$$;

create or replace function ante.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from players
    where clerk_user_id = (auth.jwt()->>'sub') and status = 'approved'
  )
$$;

revoke all on function ante.me() from anon;
revoke all on function ante.is_approved() from anon;
grant usage on schema ante to authenticated;
grant execute on function ante.me() to authenticated;
grant execute on function ante.is_approved() to authenticated;

-- ── Enable RLS on every table (ANTE-TECH §2: no exceptions) ────────────────────
alter table teams enable row level security;
alter table players enable row level security;
alter table commissioner enable row level security;
alter table seasons enable row level security;
alter table weeks enable row level security;
alter table games enable row level security;
alter table tickets enable row level security;
alter table bets enable row level security;
alter table ledger_entries enable row level security;
alter table pot_awards enable row level security;
alter table mark_votes enable row level security;
alter table chat_messages enable row level security;
alter table audit_log enable row level security;
alter table content_blocks enable row level security;
alter table content_revisions enable row level security;
alter table app_settings enable row level security;
alter table feed_sources enable row level security;
alter table feed_items enable row level security;
alter table ticker_items enable row level security;
alter table moderation_actions enable row level security;
alter table notification_log enable row level security;
alter table job_runs enable row level security;

-- ── THE BLACKOUT ───────────────────────────────────────────────────────────────
create policy tickets_blackout on tickets for select to authenticated
  using (
    player_id = ante.me()
    or (
      ante.is_approved()
      and exists (select 1 from weeks w where w.id = tickets.week_id and w.revealed_at is not null)
    )
  );

create policy bets_blackout on bets for select to authenticated
  using (
    exists (
      select 1 from tickets t
      where t.id = bets.ticket_id
        and (
          t.player_id = ante.me()
          or (
            ante.is_approved()
            and exists (select 1 from weeks w where w.id = t.week_id and w.revealed_at is not null)
          )
        )
    )
  );

-- Submission happens as the user, through RLS (service-role ticket writes are not
-- permitted — ANTE-TECH §4.3). A ticket row exists only once submitted; bet rows can
-- only arrive in the same transaction (guard in 0002). Full slip validation is the
-- submit RPC's job (Phase 6); these policies hold the perimeter.
create policy tickets_submit on tickets for insert to authenticated
  with check (
    player_id = ante.me()
    and ante.is_approved()
    and is_fold = false
    and exists (
      select 1 from weeks w
      where w.id = week_id and w.phase = 'open'
        and now() >= w.opens_at and now() < w.deadline_at
    )
  );

create policy bets_submit on bets for insert to authenticated
  with check (
    exists (
      select 1 from tickets t
      join weeks w on w.id = t.week_id
      where t.id = ticket_id and t.player_id = ante.me()
        and w.phase = 'open' and now() < w.deadline_at
    )
  );

-- ── Roster ─────────────────────────────────────────────────────────────────────
-- Own row always readable (pending applicants see their waiting state and nothing
-- else); the league is public to the league (§11).
create policy players_read on players for select to authenticated
  using (clerk_user_id = (auth.jwt()->>'sub') or ante.is_approved());

-- A verified phone with no player record creates its own pending row (ANTE-PLAYER §3.1).
create policy players_apply on players for insert to authenticated
  with check (clerk_user_id = (auth.jwt()->>'sub') and status = 'pending');

-- Profile self-edit; the guard trigger below confines which columns can change.
create policy players_self_update on players for update to authenticated
  using (clerk_user_id = (auth.jwt()->>'sub'))
  with check (clerk_user_id = (auth.jwt()->>'sub'));

create or replace function guard_players_self_update() returns trigger
language plpgsql as $$
begin
  -- The service role (admin server actions, cron) may write game/roster state;
  -- an authenticated player may only touch their own profile fields.
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    if new.status is distinct from old.status
       or new.clerk_user_id is distinct from old.clerk_user_id
       or new.phone is distinct from old.phone            -- phone changes are a Clerk flow
       or new.is_muted is distinct from old.is_muted
       or new.muted_until is distinct from old.muted_until
       or new.shove_used_week is distinct from old.shove_used_week
       or new.applied_at is distinct from old.applied_at
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.joined_at is distinct from old.joined_at
       or new.deactivated_at is distinct from old.deactivated_at
       or new.deactivation_reason is distinct from old.deactivation_reason
       or new.deactivation_evidence is distinct from old.deactivation_evidence
       or new.notes is distinct from old.notes then
      raise exception 'ANTE: players may edit only their own profile fields.';
    end if;
  end if;
  return new;
end $$;

create trigger players_self_update_guard
  before update on players
  for each row execute function guard_players_self_update();

-- ── League-public reads (approved players only — §11 "public to the league") ───
create policy seasons_read on seasons for select to authenticated using (ante.is_approved());
create policy weeks_read on weeks for select to authenticated using (ante.is_approved());
create policy games_read on games for select to authenticated using (ante.is_approved());
create policy ledger_read on ledger_entries for select to authenticated using (ante.is_approved());
create policy pot_awards_read on pot_awards for select to authenticated using (ante.is_approved());
create policy chat_read on chat_messages for select to authenticated using (ante.is_approved());
create policy ticker_read on ticker_items for select to authenticated
  using (ante.is_approved() and hidden = false);
create policy feed_items_read on feed_items for select to authenticated
  using (ante.is_approved() and hidden = false);
create policy mark_votes_read on mark_votes for select to authenticated using (ante.is_approved());

-- Chat posting: approved, unmuted, as yourself, player messages only.
create policy chat_post on chat_messages for insert to authenticated
  with check (
    player_id = ante.me()
    and ante.is_approved()
    and is_system = false
    and hidden_at is null and hidden_by is null and hidden_reason is null
    and not exists (
      select 1 from players p
      where p.id = ante.me()
        and (p.is_muted and (p.muted_until is null or p.muted_until > now()))
    )
  );

-- The Mark: one vote each; felt-eligibility and the seven-day window are enforced
-- by the season-close server action (§12) — the unique constraint holds the rest.
create policy mark_vote on mark_votes for insert to authenticated
  with check (voter_player_id = ante.me() and ante.is_approved());

-- ── Public reads (logged-out homepage) ─────────────────────────────────────────
create policy teams_read on teams for select to anon, authenticated using (true);
create policy content_read on content_blocks for select to anon, authenticated using (true);

-- Everything else — audit_log, content_revisions, app_settings, feed_sources,
-- moderation_actions, notification_log, job_runs, commissioner — has RLS enabled and
-- NO policies: unreachable to every user client. Admin server actions reach them with
-- the service role after re-checking the commissioner (ANTE-ADMIN §2), and the 0002
-- triggers still bind that role.

-- ── The waiting-on view (ANTE-PLAYER §9) ───────────────────────────────────────
-- The ONE pre-reveal public fact: names and a submitted boolean, nothing else (§6).
-- Deliberately its own view, owner-rights on purpose, never derived from tickets
-- with a column mask. Approved requesters only; emits nothing once revealed.
create view waiting_on with (security_barrier) as
  select p.first_name, p.last_name, (t.id is not null) as submitted
  from weeks w
  join players p on p.status = 'approved'
  left join tickets t on t.week_id = w.id and t.player_id = p.id
  where w.phase = 'open' and w.revealed_at is null
    and (select ante.is_approved());

grant select on waiting_on to authenticated;

-- ── Standings (ANTE-PLAYER §9) ─────────────────────────────────────────────────
-- Stacks are SUM projections of the ledger — nothing writes a stack. Bet statistics
-- draw ONLY from revealed weeks, so this view moves nothing during the blackout.
create view standings with (security_barrier) as
  with stacks as (
    select p.id as player_id,
           coalesce(sum(l.amount), 0) as stack
    from players p
    left join ledger_entries l on l.player_id = p.id
    where p.status in ('approved', 'deactivated')
    group by p.id
  ),
  bet_stats as (
    select t.player_id,
           count(*) filter (where b.result = 'won') as bets_won,
           count(*) filter (where b.result = 'lost') as bets_lost,
           avg(b.multiplier) filter (where b.result in ('won', 'lost')) as avg_multiplier
    from bets b
    join tickets t on t.id = b.ticket_id
    join weeks w on w.id = t.week_id
    where w.revealed_at is not null
    group by t.player_id
  ),
  fold_stats as (
    select t.player_id, count(*) filter (where t.is_fold) as weeks_folded
    from tickets t
    join weeks w on w.id = t.week_id
    where w.revealed_at is not null
    group by t.player_id
  ),
  pots as (
    select player_id, count(*) as pots_won from pot_awards group by player_id
  )
  select p.id as player_id,
         p.first_name, p.last_name, p.favorite_team,
         p.status,
         s.stack,
         rank() over (order by s.stack desc) as rank,
         coalesce(bs.bets_won, 0) as bets_won,
         coalesce(bs.bets_lost, 0) as bets_lost,
         round(bs.avg_multiplier, 2) as avg_multiplier,
         coalesce(f.weeks_folded, 0) as weeks_folded,
         coalesce(pw.pots_won, 0) as pots_won,
         p.shove_used_week
  from players p
  join stacks s on s.player_id = p.id
  left join bet_stats bs on bs.player_id = p.id
  left join fold_stats f on f.player_id = p.id
  left join pots pw on pw.player_id = p.id
  where (select ante.is_approved());

grant select on standings to authenticated;

-- Roster arithmetic used by slate.open and the pot tier (§7): felt players counted,
-- deactivated / pending / rejected not.
create view active_player_count with (security_barrier) as
  select count(*)::int as active_player_count
  from players where status = 'approved'
  and (select ante.is_approved());

grant select on active_player_count to authenticated;
