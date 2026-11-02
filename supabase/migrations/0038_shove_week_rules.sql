-- 0038 — The shove becomes the trailing player's move (rulebook 1.7, D-128).
--
-- From Week 9:
--   1. Only a stack at or under 70% of the slate-open median may shove. Both figures
--      are the pre-ante snapshot (week_players.stack_pre_ante, weeks.median_snapshot).
--   2. One shove per week, league-wide. The first one submitted stands; anyone who
--      tries after it is told, honestly, that someone already shoved this week.
--   3. (Settlement, not here: a shover can't win that week's Pot.)
-- Weeks 1–8 keep the old rules — nothing below fires before Week 9.
--
-- Safe to re-run: every statement is create-or-replace.

-- ── ante.week_shove_taken — has anybody shoved this week? ───────────────────────
-- SECURITY DEFINER because RLS hides every other ticket until the reveal (0003), and
-- this question has to look at them. It answers ONE bit — someone has, or nobody has —
-- and only to a player who could shove right now (card held, slate open, under the
-- line). That is exactly what they would learn by pressing submit, which the owner
-- chose over a silent failure (D-128). It never says who, which game, or how much.
create or replace function ante.week_shove_taken(p_week_id uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := ante.me();
  v_week weeks%rowtype;
  v_snap week_players%rowtype;
  v_card int;
begin
  select * into v_week from weeks where id = p_week_id;
  if not found or v_week.phase <> 'open' then
    raise exception 'ANTE: the slate is not open';
  end if;
  select * into v_snap from week_players where week_id = p_week_id and player_id = v_me;
  if not found then
    raise exception 'ANTE: not dealt into this week';
  end if;
  select shove_used_week into v_card from players where id = v_me;
  if v_card is not null
     or v_snap.stack_pre_ante * 10 > coalesce(v_week.median_snapshot, 0) * 7 then
    raise exception 'ANTE: only a player who can shove may ask';
  end if;
  return exists (select 1 from tickets where week_id = p_week_id and is_shove);
end $$;

revoke all on function ante.week_shove_taken(uuid) from public, anon;
grant execute on function ante.week_shove_taken(uuid) to authenticated;

-- ── submit_ticket — 0007's function, with the Week 9 shove rules ────────────────
create or replace function submit_ticket(p_week_id uuid, p_is_shove boolean, p_bets jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_me uuid;
  v_week weeks%rowtype;
  v_snap week_players%rowtype;
  v_shove_used int;
  v_ticket_id uuid;
  v_bet jsonb;
  v_game games%rowtype;
  v_total bigint := 0;
  v_count int := 0;
  v_chips bigint;
  v_min_games int;
  v_committed bigint;
  v_refund bigint;
begin
  v_me := ante.me();
  if v_me is null or not ante.is_approved() then
    raise exception 'ANTE: only approved players may submit (§3.1)';
  end if;

  select * into v_week from weeks where id = p_week_id;
  if not found or v_week.phase <> 'open' or now() < v_week.opens_at or now() >= v_week.deadline_at then
    raise exception 'ANTE: the slate is not open. Thursday noon is the wall (§3).';
  end if;

  select * into v_snap from week_players where week_id = p_week_id and player_id = v_me;
  if not found then
    raise exception 'ANTE: no slate-open snapshot for this player — slate.open has not run';
  end if;

  if p_is_shove then
    select shove_used_week into v_shove_used from players where id = v_me;
    if v_shove_used is not null then
      raise exception 'ANTE: the shove card is spent — once per season (§8)';
    end if;
    if jsonb_array_length(p_bets) <> 1 then
      raise exception 'ANTE: a shove is one game, one side, the whole stack — no other bets (§8)';
    end if;
    -- D-128: from Week 9 the shove is for trailing stacks only.
    if v_week.number >= 9
       and v_snap.stack_pre_ante * 10 > coalesce(v_week.median_snapshot, 0) * 7 then
      raise exception 'ANTE: the shove is for trailing stacks — % or less this week, 70%% of the median (§8)',
        (coalesce(v_week.median_snapshot, 0) * 7) / 10;
    end if;
    -- D-128: one shove per week. The lock makes "first one submitted" exact: a second
    -- shover waits here until the first commits, then sees it.
    if v_week.number >= 9 then
      perform pg_advisory_xact_lock(hashtext('ante.shove:' || p_week_id::text));
      if ante.week_shove_taken(p_week_id) then
        raise exception 'ANTE: someone already shoved this week — one shove per week (§8). Your shove is still yours for another week.';
      end if;
    end if;
    -- The stake is the pre-ante stack, fixed at submission (§8.7). A felt shover
    -- paid no ante, so nothing is refunded (§14).
    v_committed := v_snap.stack_pre_ante;
    v_refund := case when v_snap.felt then 0 else v_week.ante end;
    if v_committed < 1 then
      raise exception 'ANTE: nothing to shove';
    end if;
  end if;

  -- ── Pass 1: validate every bet and total the ticket ──────────────────────────
  for v_bet in select * from jsonb_array_elements(p_bets) loop
    select * into v_game from games where id = (v_bet->>'game_id')::uuid;
    if not found or v_game.week_id <> p_week_id then
      raise exception 'ANTE: bet references a game outside this slate';
    end if;
    if not v_game.on_slate then
      raise exception 'ANTE: % is off the slate — it kicks before the deadline (§3)', v_game.external_id;
    end if;
    if v_game.kickoff_at <= now() then
      raise exception 'ANTE: % has already kicked off (§3)', v_game.external_id;
    end if;
    if v_bet->>'side' not in ('away', 'home') then
      raise exception 'ANTE: pick a side';
    end if;

    v_chips := (v_bet->>'chips')::bigint;
    if p_is_shove then
      if v_chips <> v_committed then
        raise exception 'ANTE: a shove commits the entire pre-ante stack: % (§8.7)', v_committed;
      end if;
    elsif v_snap.felt then
      if v_chips < 1 then
        raise exception 'ANTE: minimum 1 chip';
      end if;
    else
      if v_chips < 10 or v_chips > 50 or v_chips % 10 <> 0 then
        raise exception 'ANTE: bets are 10–50 chips in multiples of 10 (§3)';
      end if;
    end if;
    v_total := v_total + v_chips;
    v_count := v_count + 1;
  end loop;

  if not p_is_shove then
    if v_snap.felt then
      if v_count < 1 then
        raise exception 'ANTE: bet something — you are not eliminated (§9)';
      end if;
      if v_total > v_snap.house_limit then
        raise exception 'ANTE: the felt limit is your whole stack: % (§9)', v_snap.house_limit;
      end if;
    else
      -- Short stack rule (§4): if the limit won't cover five bets, play what it covers.
      v_min_games := least(5, greatest(1, (v_snap.house_limit / 10)::int));
      if v_count < v_min_games then
        raise exception 'ANTE: at least % games (§3, §4 short stack rule)', v_min_games;
      end if;
      if v_total > v_snap.house_limit then
        raise exception 'ANTE: over the house limit of % — the app never lets you overspend (§4)', v_snap.house_limit;
      end if;
    end if;
  end if;

  -- ── Pass 2: write the ticket and its bets, atomically, already locked ────────
  insert into tickets (week_id, player_id, is_fold, is_shove, total_chips, committed_stake, pending_refund)
  values (p_week_id, v_me, false, p_is_shove, v_total,
          case when p_is_shove then v_committed else null end,
          case when p_is_shove then v_refund else null end)
  returning id into v_ticket_id;

  for v_bet in select * from jsonb_array_elements(p_bets) loop
    insert into bets (ticket_id, game_id, side, chips)
    values (v_ticket_id, (v_bet->>'game_id')::uuid, v_bet->>'side', (v_bet->>'chips')::bigint);
  end loop;

  return v_ticket_id;
end $$;

grant execute on function submit_ticket(uuid, boolean, jsonb) to authenticated;
