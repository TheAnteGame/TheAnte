-- 0001 — Core tables. ANTE-PLAYER.md §9 owns the player tables; ANTE-ADMIN.md §3 the
-- admin tables. Chips are integers, always (ANTE-TECH §4.4). Timestamps are timestamptz;
-- all deadline logic computes in America/New_York at the application layer (§4.5).

-- ── Roster ─────────────────────────────────────────────────────────────────────
create table teams (
  code text primary key,          -- nflverse abbreviation; controlled vocabulary
  city text not null,
  name text not null
);

create table players (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,      -- auth.jwt()->>'sub' — Clerk id, TEXT, not a uuid
  phone text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'deactivated')),
  first_name text,
  last_name text,
  email text,
  favorite_team text references teams(code),
  profile_complete boolean not null default false,
  is_muted boolean not null default false,
  muted_until timestamptz,
  sms_opt_in boolean not null default true,
  shove_used_week int,            -- written by the reveal job, never the submit handler
  applied_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references players(id),
  joined_at timestamptz,
  deactivated_at timestamptz,
  deactivation_reason text,
  deactivation_evidence text,     -- the quotable thing the player actually said (§13)
  notes text                      -- commissioner-private
);
comment on column players.status is
  'Single source of truth for roster state. is_active := (status = ''approved''). Pending players hold no chips and see nothing.';

create table commissioner (
  id boolean primary key default true check (id), -- single row
  player_id uuid not null references players(id)
);

-- ── Season structure ───────────────────────────────────────────────────────────
create table seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  status text not null default 'preseason' check (status in ('preseason', 'active', 'complete')),
  current_week int,
  week1_lock_at timestamptz       -- roster lock / admission close (§1)
);

create table weeks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id),
  number int not null check (number between 1 and 18),
  ante int not null,
  phase text not null default 'open' check (phase in ('open', 'revealed', 'settled')),
  opens_at timestamptz not null,
  deadline_at timestamptz not null,
  median_snapshot int,            -- slate open, pre-ante, felt+deactivated excluded (§14)
  places_tier_snapshot int,       -- written by slate.open, never recomputed (§7)
  active_count_snapshot int,
  revealed_at timestamptz,        -- the blackout ends when this is set; RLS keys on it
  settled_at timestamptz,
  pot_before bigint,
  pot_swept bigint,
  pot_awarded bigint,
  marker bigint not null default 0,
  unique (season_id, number)
);

create table games (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks(id),
  external_id text not null unique, -- nflverse game_id, e.g. 2026_01_KC_BAL
  espn_id text,
  away_team text not null references teams(code),
  home_team text not null references teams(code),
  spread_frozen numeric(4,1),     -- display context only; never consulted at settlement
  kickoff_at timestamptz not null,
  on_slate boolean not null default true, -- false: kicks before Thursday noon (§3)
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'final', 'cancelled', 'postponed')),
  away_score int,
  home_score int,
  settled boolean not null default false,
  void_reason text check (void_reason in ('kicked_pre_deadline', 'cancelled', 'postponed'))
);

-- ── Tickets and bets — immutable once submitted (guards in 0002) ───────────────
create table tickets (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks(id),
  player_id uuid not null references players(id),
  submitted_at timestamptz not null default now(),
  is_fold boolean not null default false,
  is_shove boolean not null default false,
  total_chips bigint not null default 0,
  committed_stake bigint,         -- shove: pre-ante stack, fixed at submission (§8.7)
  pending_refund bigint,          -- shove: the ante, posted to the ledger at the reveal
  unique (week_id, player_id)
);

create table bets (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id),
  game_id uuid not null references games(id),
  side text not null check (side in ('away', 'home')),
  chips bigint not null check (chips > 0),
  multiplier numeric(4,2),        -- settlement output; the only mutable columns
  result text check (result in ('won', 'lost', 'returned', 'void')),
  payout bigint,
  unique (ticket_id, game_id)     -- cannot bet both sides (§3)
);

-- ── The ledger — append-only; stacks are SUM(amount) projections ───────────────
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id), -- NULL = the Pot's own account (§9 felt floor)
  week_id uuid references weeks(id),
  kind text not null check (kind in (
    'buy_in', 'ante', 'ante_refund', 'ante_recharge', 'bet_stake', 'bet_return',
    'bet_payout', 'sweep', 'pot_award', 'correction', 'reversal', 'marker',
    'felt_floor', 'season_close'
  )),
  amount bigint not null,         -- integer chips, signed
  reason text not null check (length(trim(reason)) > 0),
  reversal_of uuid references ledger_entries(id),
  idempotency_key text,
  created_at timestamptz not null default now()
);
-- A retried cron must not ante the league twice (ANTE-TECH §4.1): DB constraint, not app check.
create unique index ledger_idempotency on ledger_entries (week_id, idempotency_key, player_id)
  nulls not distinct where idempotency_key is not null;
create index ledger_player on ledger_entries (player_id);
create index ledger_week on ledger_entries (week_id);

create table pot_awards (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks(id),
  player_id uuid not null references players(id),
  place int not null check (place between 1 and 5),
  amount bigint not null,
  unique (week_id, place, player_id)
);

create table mark_votes (
  id uuid primary key default gen_random_uuid(),
  voter_player_id uuid not null references players(id) unique, -- one vote each (§12)
  nominee_player_id uuid not null references players(id),
  created_at timestamptz not null default now()
);

-- ── Chat ───────────────────────────────────────────────────────────────────────
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id),  -- NULL = system message
  body text not null check (length(body) between 1 and 2000),
  is_system boolean not null default false,
  hidden_at timestamptz,          -- soft delete only; renders as a tombstone
  hidden_by uuid references players(id),
  hidden_reason text,
  created_at timestamptz not null default now()
);
create index chat_created on chat_messages (created_at desc);

-- ── Admin-owned tables (ANTE-ADMIN §3) ─────────────────────────────────────────
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_player_id uuid references players(id),
  action text not null,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  reason text not null check (length(trim(reason)) > 0),
  public boolean not null default false,
  created_at timestamptz not null default now()
);

create table content_blocks (
  key text primary key,
  value text,
  kind text not null default 'text' check (kind in ('text', 'richtext', 'markdown', 'url', 'email', 'image')),
  label text,
  group_name text,
  help text,
  max_length int,
  updated_at timestamptz not null default now(),
  updated_by uuid references players(id)
);

create table content_revisions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value text,
  created_at timestamptz not null default now(),
  created_by uuid references players(id)
);

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references players(id)
);

create table feed_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('league_ticker', 'team_news')),
  name text not null,
  url text not null,
  team_code text references teams(code),
  enabled boolean not null default true,
  priority int not null default 0,
  last_fetched_at timestamptz,
  last_status text,
  last_error text
);

create table feed_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references feed_sources(id),
  external_id text not null unique,
  title text not null,
  url text,
  published_at timestamptz,
  team_code text references teams(code),
  hidden boolean not null default false,
  fetched_at timestamptz not null default now()
);

create table ticker_items (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('feed', 'manual', 'system')),
  system_key text,
  feed_item_id uuid references feed_items(id),
  text text not null check (length(text) <= 140),
  url text,
  pinned boolean not null default false,
  priority int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  hidden boolean not null default false,
  created_by uuid references players(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id),
  kind text not null check (kind in ('mute', 'unmute')),
  reason text not null check (length(trim(reason)) > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references players(id)
);

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id),
  channel text not null check (channel in ('sms', 'email')),
  template_key text not null,
  body text,
  provider_message_id text,
  status text not null,
  error text,
  sent_at timestamptz not null default now()
);

create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  detail jsonb
);
create index job_runs_key on job_runs (job_key, started_at desc);
