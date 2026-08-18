-- 0007 — Per-week player snapshot + the submission RPC.
--
-- week_players is written once by slate.open and never recomputed: felt status is
-- "evaluated once, at slate open, against that week's ante, pre-ante" (§9, §8.3),
-- and the house limit is fixed by the same moment's numbers (§4). The bet slip
-- header, the felt-mode switch, and submit validation all read this one row.
-- Stacks and limits are public to the league (§11) — no blackout data lives here.

create table week_players (
  week_id uuid not null references weeks(id),
  player_id uuid not null references players(id),
  stack_pre_ante bigint not null,
  felt boolean not null default false,
  house_limit bigint not null,
  primary key (week_id, player_id)
);

alter table week_players enable row level security;
create policy week_players_read on week_players for select to authenticated
  using (ante.is_approved());

-- ── submit_ticket — submission is one atomic act (§3: "an act, not a draft") ────
-- SECURITY INVOKER: runs as the requesting player, under RLS. The INSERT policies
-- (tickets_submit / bets_submit) and the same-transaction bets guard still apply;
-- this function adds the slip rules the perimeter cannot express. Tickets are
-- immutable from birth, so everything is validated and totalled BEFORE the ticket
-- row is written.
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
