# ANTE — Commissioner Console (Admin Spec)

**Audience:** an AI coding agent building this from scratch.
**Companion document:** `ANTE-PLAYER.md` — owns the player-facing app **and the canonical settlement engine**. This document never redefines game math. Where a rule is involved, it cites the rulebook section and defers to the engine.
**Source of truth for rules:** `ANTE-RULEBOOK.md`, **v1.1**. If this spec and the rulebook disagree, the rulebook wins and the discrepancy is a bug in this spec. Every §-reference below points at the rulebook unless it says otherwise.

---

## 0. Confirmed decisions

| Decision | Answer |
|---|---|
| Scope | **Single league.** One commissioner (the owner). No league creation, no tenancy, no invite-a-commissioner flow. |
| Game data | **Fully automatic** from a sports data API. Commissioner corrects, never authors. |
| News ticker | **Hybrid.** Three sources in one rail: automatic feed items, commissioner-authored manual items, and system-generated league items. |
| Fav Team News box | **Fully automatic** from a news feed, filtered by each player's favorite team. No curation beyond hiding an item. |
| Player removal | **Deactivate only.** No hard delete, ever (§14 "Players who disappear"). |
| Stack | Next.js (App Router) · Supabase (Postgres + Storage) · Clerk (phone OTP) · Resend (email) · Vercel |
| Chat/reveal liveness | **Polling**, not websockets |
| Player nudges | **SMS** |
| Bet settlement | **Straight-up winner.** The spread is displayed as context and never touches settlement. No pushes. |
| House limit timing | Median from the pre-ante slate-open snapshot; **own stack measured post-ante** (§4) |
| Roster admission | **Open signup until the Week 1 lock, commissioner approves each applicant.** An enumerated §13 power, preseason-only |
| Shove visibility | **Dark until the reveal.** A shove is a pick (§6, §8). No pre-reveal announcement anywhere — not chat, not ticker, not admin |
| Blackout scope | **Nothing moves during the blackout.** No ledger entry is written between the ante posting and the reveal, so no public figure — stack, Pot, or count — can twitch when somebody submits (§6) |
| Shove and the ante | Computed at submission, stored on the ticket, **posted to the ledger at the reveal**; recharged at settlement if the game is voided (§8, §14) |
| Deactivation | Only for a player who has **affirmatively quit** (§13). Going quiet is never grounds |
| Deactivated players | Keep their stack and standings row; **ineligible for the championship and every award** (§11) |
| Pot places tier | Snapshotted at slate open from `active_player_count`; felt players counted, deactivated not (§7) |
| Chat moderation | Mute and hide are enumerated §13 powers. Public, logged, never a deletion, **never touches betting** |

### Two gaps the build must close

1. **Resend sends email, not SMS.** SMS requires a separate provider — spec assumes **Twilio Programmable Messaging**. Resend handles the support inbox and any email receipts. Both are behind one `Notifier` interface so the SMS vendor is swappable.
2. **The ticker is a blended rail, not a feed reader.** Everything that scrolls across the top of the dashboard is a `ticker_items` row, and every row carries a `source` discriminator. Feed ingest writes `source = 'feed'`. The commissioner writes `source = 'manual'`. The app writes `source = 'system'` for league events it generates on its own — deadline countdown, current pot, waiting-on count, reveal fired, pot awarded, marker outstanding. One table, one render path, one sort. Do not build three separate ticker mechanisms.

   *(Assumption worth confirming: "a couple things static from the system" is read here as **auto-generated league facts**, listed in §4.5.3. If you meant fixed house copy — a tagline, a rules reminder — that is simply a manual item with `pinned = true` and no expiry, which the same schema already covers.)*

---

## 1. The non-negotiables (build these as constraints, not as UI copy)

Rulebook §13 defines the commissioner's powers as a closed set. These are enforced at the **database and API layer**, not merely hidden in the interface. An admin route that can do anything outside this list is a defect.

**Permitted (the whole list, per §13):**
- Correct bad game data (wrong score, false final, bad status) and re-settle the affected week
- Re-run settlement on a week that settled wrong — including **forcing a reveal the clock should already have fired**, after Thursday noon and never before
- **Admit the league**: approve or reject applicants. Preseason-only; the routes hard-reject after the Week 1 deadline
- **Deactivate a player who has affirmatively quit** — see §4.3, and note that silence is explicitly not grounds
- **Moderate Table Talk**: mute a player from chat, hide a message. Both public, both logged, neither a deletion, and **neither ever affects betting**
- Hand off the commissioner role

**Forbidden — enforce in code:**
- **Touching a submitted ticket.** `tickets` and `bets` rows are immutable after `submitted_at` is set. Enforce with a Postgres trigger raising an exception on UPDATE/DELETE of any locked ticket, regardless of role. There is no admin route that writes to these tables. Not for injuries, not for typos, not for the commissioner's own ticket.
- **Moving a deadline mid-season.** Deadline config is writable only while `season.status = 'preseason'`.
- **Adjusting a stack quietly.** Stacks are never directly writable. They are a projection of `ledger_entries`. Every correction is an appended ledger entry with a `reason` string that is `NOT NULL` and non-empty, and it mirrors to Table Talk automatically (§13 "Every correction is public").
- **Changing a rule mid-season.** All rule constants (ante tiers, cap, floor, limit divisor, minimums) are writable only while `status = 'preseason'`. The 2.50× cap in particular gets a confirmation dialog quoting §14: touch it once, in the offseason.
- **Seeing any ticket before the reveal.** The commissioner plays under the same blackout. The admin ticket views read from the same view as players and return nothing pre-reveal. Test this explicitly — it is the single most important trust property in the product. **This includes shoves:** a shove is a pick, it is dark until `revealed_at`, and there is no admin surface that reveals one early (§6, §8).
- **Deactivating a player who has merely gone quiet.** §13 permits deactivation only for a player who has said they are done. The reason field must carry the quotable evidence, and the roster UI must state this at the point of action — a deactivation drops the player out of the median, and the median sets every house limit in the league.
- **Editing a locked ticket by way of re-settlement.** Re-settlement replays chips, never picks (§13). If a cascade leaves a later ticket over its recomputed limit, the ticket stands and the §9 floor absorbs it. No code path scales, trims, or voids a submitted ticket.
- **Editing the rulebook.** `ANTE-RULEBOOK.md` ships with the code and renders at `/rules`. It is not in `content_blocks` and has no admin route. Changing a rule requires a deploy, which leaves a commit (§13).

**Implementation note.** Use a Supabase service-role client only inside server actions that have passed a commissioner check; never expose it to the client bundle. Row-level security still applies to ticket visibility for the commissioner's *own* player identity — the commissioner is a player first.

---

## 2. Access control

- One row in `commissioner` holding a `player_id`. That is the only admin.
- Gate `/admin/*` in middleware: Clerk session → `player_id` → matches `commissioner.player_id`, else 404 (not 403 — do not advertise the route's existence).
- Every mutating admin server action re-checks. Middleware is not authorization.
- **Handoff** (§13): commissioner selects an active player, confirms by typing that player's full name, writes an `audit_log` entry and a Table Talk system post. Effective immediately; the outgoing commissioner remains an ordinary player.
- No secondary admins, no read-only admins, no support role. One seat.

---

## 3. Admin-owned schema

The player doc owns `players`, `weeks`, `games`, `tickets`, `bets`, `ledger_entries`, `pot_awards`, `mark_votes`, `standings`. This document adds:

Two definitions this document leans on, both owned by `ANTE-PLAYER.md` §9:

```
active_player_count = count(players where status = 'approved')
                      -- felt players counted; deactivated, pending,
                      --   rejected not (§7)
is_active           = (status = 'approved')
                      -- derived, not a stored column: one source of truth
                      --   for roster state and nothing to drift against
```

```
audit_log
  id, actor_player_id, action, entity_type, entity_id,
  before jsonb, after jsonb, reason text NOT NULL,
  public boolean, created_at
  -- append-only; no UPDATE, no DELETE, DB-enforced

content_blocks
  key text PRIMARY KEY,        -- e.g. 'home.intro'
  value text,
  kind text,                   -- 'text' | 'richtext' | 'markdown' | 'url' | 'email' | 'image'
  label text,                  -- human name in the editor
  group_name text,             -- editor section
  help text,                   -- what/where it appears
  max_length int,
  updated_at, updated_by

content_revisions
  id, key, value, created_at, created_by
  -- every save writes one; restore = write a new revision

app_settings
  key text PRIMARY KEY, value jsonb, updated_at, updated_by

feed_sources
  id, kind,                    -- 'league_ticker' | 'team_news'
  name, url, team_code null,   -- null for league-wide
  enabled boolean, priority int,
  last_fetched_at, last_status, last_error

feed_items
  id, source_id, external_id UNIQUE, title, url,
  published_at, team_code, hidden boolean DEFAULT false,
  fetched_at
  -- raw ingest for the Fav Team News box; league-wide items
  -- are projected into ticker_items with source='feed'

ticker_items
  id,
  source text NOT NULL,        -- 'feed' | 'manual' | 'system'
  system_key text null,        -- e.g. 'deadline' | 'pot' | 'waiting_on'
  feed_item_id null,           -- set when source='feed'
  text text NOT NULL,          -- <=140 chars, rendered as-is
  url text null,               -- optional click-through
  pinned boolean DEFAULT false,
  priority int DEFAULT 0,
  starts_at null, ends_at null,
  hidden boolean DEFAULT false,
  created_by, created_at, updated_at

moderation_actions
  id, player_id, kind,         -- 'mute' | 'unmute'
  reason text NOT NULL, expires_at null, created_at, created_by

notification_log
  id, player_id, channel,      -- 'sms' | 'email'
  template_key, body, provider_message_id,
  status, error, sent_at

job_runs
  id, job_key, started_at, finished_at, status, detail jsonb
```

`players` gains admin-relevant columns: `applied_at`, `approved_at`, `approved_by`, `deactivated_at`, `deactivation_reason`, `deactivation_evidence` (the quotable thing the player actually said, §13), `is_muted`, `muted_until`, `sms_opt_in`, `notes` (commissioner-private). `status` is the authoritative roster state and is defined in the player doc.

`chat_messages` gains `hidden_at`, `hidden_by`, `hidden_reason` — soft delete only, no hard delete route.

---

## 4. Console layout

Route `/admin`, persistent left nav, same visual language as the player app so it doesn't feel like a different product.

| Route | Purpose |
|---|---|
| `/admin` | Ops dashboard — the "is anything on fire" page |
| `/admin/week` | Week control — slate, reveal, settlement, pot |
| `/admin/players` | The CRM |
| `/admin/content` | The content editor |
| `/admin/feeds` | News sources, ticker config |
| `/admin/promo` | Promotional hero box |
| `/admin/notifications` | SMS templates and schedule |
| `/admin/settings` | Season config, rule constants, support email |
| `/admin/audit` | Immutable log of everything |

### 4.1 Ops dashboard

Above the fold, no scrolling required:

- **Current week card** — week number, phase (`open` / `locked` / `revealed` / `settled`), ante tier and amount, countdown to Thursday 12:00 ET.
- **Submission tracker** — `9 of 12 in`, with the three outstanding names and a one-tap "nudge" per player (fires the straggler SMS). **Names only — never picks.** This is the same data players see (§6 "Waiting on you, Terry"); the commissioner gets no extra visibility, only the send button.
- **Pot** — current value, and if negative, a loud marker banner (§7 "The marker") with the amount owed and which week incurred it.
- **Median** — the value snapshotted at slate open, the number of felt players excluded from it, and the timestamp of the snapshot.
- **Places tier** — the places-paid tier snapshotted at slate open with the `active_player_count` it came from (§7), so it is obvious the prize structure is fixed for the week and cannot move under a locked ticket.
- **Health strip** — last successful run of each cron job with age; red past threshold. Sports feed, news feed, reveal check, settlement, SMS queue.
- **Alerts** — unsettled finished games, games with no result 6+ hours past scheduled end, feed errors, SMS failures, players with no valid phone.

### 4.2 Week control (`/admin/week`)

A week selector plus a phase-driven panel. Actions available are a function of phase; everything else is visibly disabled with the reason shown.

**Slate.** Table of ingested games: kickoff (ET), teams, frozen spread, live status, score, settlement state. Games kicking before Thursday 12:00 ET are shown struck through and labelled *off-slate* (§3 — the 2026 Week 1 Wednesday opener and the Week 12 Wednesday game). Slate size is displayed so a 15-game week is visibly intentional rather than a bug.

**Manual overrides — the only game-data writes permitted:**
- Correct a final score
- Mark a game cancelled or postponed-past-settlement → chips returned (§10)
- Mark a game **rescheduled to kick before the deadline** → void, chips returned (§10). This is the one that catches a league by surprise: a game moved *earlier* under already-locked tickets comes off the board entirely, because §3 forbids betting a game that has started. The panel flags any slate game whose kickoff has moved to before Thursday noon and prompts for the void
- Un-mark a false final
- Force re-fetch a single game from the provider

Each requires a reason, writes `audit_log`, and flags the week as needing re-settlement.

**Reveal.** Read-only status. The reveal fires automatically when the last ticket lands or at Thursday noon, whichever comes first (§6). There is a **Force reveal** button, permitted under §13 as settlement-job recovery; it is disabled unless the deadline has passed and the automated job failed, and it demands a typed reason. It cannot fire early — the phase guard rejects it — because an early reveal would hand every un-submitted player the room.

**Shoves do not appear on this panel before the reveal.** Not as a count, not as a flag, not as "one shove pending." The commissioner learns about a shove at the same instant everyone else does (§6, §8).

**Nor does the Pot move.** The Pot figure on the ops dashboard is the same figure players see, and it must not change between the ante posting and the reveal — a shove's ante refund is stored on the ticket and posts at the reveal precisely so that number sits still (§6). If the ops Pot ever dips mid-blackout, that is a leak, not a display bug.

**Settlement.** Shows a preview before committing: per-game head counts, computed multipliers, per-player deltas, sweep to pot, pot award and split, resulting stacks. The commissioner reads this and clicks commit. Settlement is idempotent and keyed by `(week_id, run_number)`.

**Re-settlement** (§13): pick a week, state a reason, run. The engine reverses the prior run's ledger entries with explicit `reversal` entries — it never deletes them — then replays. Weeks after the re-settled one are recomputed in order, because the median, the house limit, and pot eligibility all cascade. The diff is shown before commit: every player's before/after stack. On commit, one system post to Table Talk summarising the correction and the chips involved.

**Locked tickets are inputs to the replay, never outputs of it.** A cascade can leave a later ticket committing more than a third of its owner's corrected stack. That ticket stands exactly as submitted — the player bet in good faith against the numbers the app was showing — the chips settle at face value, and the §9 floor absorbs any overdraft. The preview must surface these as a distinct list, *"3 tickets now exceed their recomputed limit and will settle as submitted,"* so the commissioner isn't surprised by a stack landing on the felt. There is no scale-down, no trim, and no void: §13 makes this absolute.

**Pot panel.** Contributions this week (net of any shove ante refunds, which post at the reveal and not before, §8), sweep amount, **places paid from the slate-open snapshot rather than the current count** (§7), winners with splits, every share floored to a whole chip with the leftovers rolled forward, ties handled by even split rounding down with odd chips rolled. Eligibility is *submitted and did not fold* — a player whose games all got returned is still in (§7). If nobody was eligible because everyone folded, the panel says so and shows the rollover.

### 4.3 Players CRM (`/admin/players`)

Two tabs: **Roster** and **Applications**.

#### Applications tab (preseason only)

Anyone who verifies a phone before the Week 1 deadline lands here as `pending`, holding no chips and seeing nothing of the league. Row: phone, applied-at, and whatever profile they've filled. Actions:

- **Approve** — creates the 500-chip buy-in ledger entry, sets `status = 'approved'`, fires the welcome SMS. This is the moment a player exists.
- **Reject** — marks `rejected`; that phone cannot reapply unless cleared here.
- **Bulk approve** for the opening rush.

A counter shows approved players against the **8-player minimum** (§1), and the season cannot be moved to `active` below it. At the Week 1 deadline the tab freezes: all remaining pending records auto-reject and the tab becomes read-only history. **The approve and reject routes reject at the API layer after that timestamp**, not merely in the UI — §13 makes admission a preseason-only power and it should be impossible to exercise afterwards.

#### Roster tab

Table, sortable and filterable, one row per player:

`name · phone · email · favorite team · stack · rank · weeks folded · pots won · shove card (held/spent) · felt? · muted? · active? · last seen · last submitted`

Row click opens a detail drawer:

- **Profile** — first name, last name, email, favorite team. Editable by the commissioner (these are contact/profile fields, not game state). Phone is Clerk-owned; changing it is a Clerk operation initiated by the player, not an admin write.
- **Season history** — every past ticket (public per §11), every ledger entry with reasons, pots won, awards on track.
- **Chat activity** — recent Table Talk messages, message count, rate over last 24h. Mute/unmute from here.
- **Commissioner notes** — private free text. Never rendered player-side.
- **Deactivate / reactivate.**

**Mute** (chat moderation only): reason required, duration picker (1h / 24h / 7d / until manually lifted). A muted player can read Table Talk and can still bet — muting never touches game participation. Attempting to post shows the mute reason and expiry. `app_settings.mute_visible_to_league` (default **on**) posts a short system line to Table Talk when a mute begins and ends. Default on because §13's whole posture is that visible enforcement builds trust and silent enforcement destroys it; a player silently unable to speak will assume the app is broken.

**Message moderation.** Muting stops the next message; it does nothing about the one already posted. So Table Talk also supports per-message **hide** from the chat view itself (commissioner-only affordance on hover) and from the player's detail drawer. Hiding is a soft delete: the row stays, `hidden_at` and `hidden_reason` are set, players see a tombstone line rather than a silent gap, and an `audit_log` entry is written. There is no hard delete of chat, for the same reason there is no hard delete of players — the record of what happened is the thing that makes the commissioner's authority trustworthy.

**Deactivate** (§13, §14). **This is only for a player who has affirmatively quit.** A player who has simply gone quiet is not deactivatable — §14 already describes what happens to them, and it is not this: they auto-fold, they keep paying antes, and they stay eligible for everything. The dialog says so in those words, and the form requires two separate fields:

- `deactivation_reason` — the commissioner's rationale
- `deactivation_evidence` — **the quotable thing the player actually said.** Required, non-empty, and shown in the audit log and the Table Talk post

This is not ceremony. A deactivated player leaves the median, and the median sets every house limit in the league, so an unchecked deactivate button is a lever on everyone's bet sizing. Make the friction visible.

Confirmation dialog states exactly what happens —
- stops paying antes from the next slate open
- excluded from the median
- excluded from `active_player_count`, which changes the pot's places-paid tier **from the next slate open, never for the current week**
- **remains in standings with their stack intact**
- **becomes ineligible for the championship and for every season award** (§11) — state this plainly; it is the consequence a player is most likely to argue about later
- cannot submit tickets
- reversible

Reason and evidence required. Audit entry. Table Talk system post.

**Timing.** Deactivation takes effect at the **next slate open**. A ticket already submitted for the current week settles normally — those chips are committed and §5's conservation depends on them settling. The places-paid tier does not change for the current week either; it was snapshotted at slate open. What changes immediately is the **reveal trigger**: the app stops waiting on them from that moment, which is the whole point of deactivating someone who has left.

**No delete.** The UI contains no delete affordance and the API contains no delete route. If a player demands data erasure, that is an out-of-band manual process; document it in the repo README rather than building a button that violates §5's conservation guarantee mid-season. If the season has not started (`preseason`) a player may be removed outright, since no chips have moved — that is the only exception, and it disappears the moment Week 1 locks (§1 "The roster locks at the Week 1 deadline").

**Roster guard:** if deactivations would drop active players below 8, warn prominently and quote §1 — the league may continue below 8 (there is no minimum to stay alive, only to start), but the commissioner should know the distributions are getting noisy.

### 4.4 Content editor (`/admin/content`)

This is the "edit every string on the site easily" requirement. **No copy is hardcoded in components.** Every user-visible string resolves through `getContent(key)` against `content_blocks`, with a seeded default in a repo file so a missing row can never render an empty page.

**One exception, and it is deliberate: the rulebook.** `ANTE-RULEBOOK.md` is a versioned file in the repo rendered at `/rules`; it has no `content_blocks` rows and no admin route. §13 forbids changing a rule mid-season, and a CMS-editable rulebook would be exactly that hole with a nicer interface. Only `rules.intro` — the framing paragraph above the rendered document — is editable. The CI check in acceptance test 8 must whitelist the rules renderer rather than flagging it.

Editor UX: grouped accordion by page, one field per block, inline `label` and `help` text describing exactly where it appears, character counter against `max_length`, dirty-state indicator, Save all / Discard. Rich text blocks use a minimal editor — bold, italic, link, lists. Nothing more.

- **Preview** — link opens the affected page with `?preview_content=1`, rendering unsaved draft values from session.
- **Revision history** — per key, list of prior values with timestamps, one-click restore (which writes a new revision rather than rewinding).
- **Search** — filter blocks by key or by current text, so "where does that sentence live" takes seconds.

Seed keys, at minimum:

```
home.logo_alt                    home.intro_heading
home.intro_body                  home.phone_label
home.phone_placeholder           home.phone_cta
home.code_prompt                 home.legal_line
home.copyright

profile.heading                  profile.intro_body
profile.first_name_label         profile.last_name_label
profile.email_label              profile.favorite_team_label
profile.submit_label             profile.error_generic

dash.header_rank_label           dash.header_chips_label
dash.logout_label
dash.wager.heading               dash.wager.closed_message
dash.wager.submitted_message     dash.wager.blackout_notice
dash.wager.waiting_on_label      dash.wager.confirm_title
dash.wager.confirm_body          dash.wager.shove_warning
dash.leaderboard.heading         dash.leaderboard.empty
dash.tabletalk.heading           dash.tabletalk.placeholder
dash.tabletalk.muted_notice
dash.news.heading                dash.news.empty
dash.promo.fallback_heading
dash.support.heading             dash.support.body
dash.support.email

rules.intro                      awards.intro
sms.optin_disclosure
error.404                        error.500
empty.no_games                   empty.no_news
```

Support email lives here (`dash.support.email`) so the support box is content-managed, per the sketch's *"support box provides email."*

### 4.5 Feeds & ticker (`/admin/feeds`)

Three tabs: **Ticker**, **Sources**, **Settings**.

#### 4.5.1 Ticker tab — the blended rail

One table showing every `ticker_items` row currently eligible to render, in exactly the order players will see it, with a live preview strip above it running at the real scroll speed. Columns:

`⋮⋮ (drag) · source badge · text · pinned · window · status · actions`

Source badges are visually distinct — manual, feed, system — so it's obvious at a glance which items you wrote and which arrived on their own.

**Compose a manual item.** Text (140-char limit with counter), optional click-through URL, pin toggle, optional start/end datetime for scheduling, priority. Save publishes immediately unless a future `starts_at` is set. Edit and delete are available on manual items only.

**Feed items** are read-only here: hide, pin, or adjust priority, but never edit the text. Editing a headline you didn't write is how a ticker becomes a liability.

**System items** are read-only and each can be individually switched off. You cannot author them; you can decide you don't want them.

**Ordering.** The render list is computed, not hand-maintained:

```
eligible = ticker_items where hidden = false
           and (starts_at is null or starts_at <= now)
           and (ends_at   is null or ends_at   >  now)

sort by: pinned desc,
         priority desc,
         source rank (manual > system > feed),
         published/created desc

take ticker.max_items
```

Drag-to-reorder writes `priority`, so manual arrangement and automatic ranking use the same field rather than fighting each other. A "reset order" button clears manual priorities back to zero.

**Guardrail:** if the eligible list is empty, the ticker rail does not render at all rather than scrolling blank space.

#### 4.5.2 Sources tab

Two source lists — **league ticker** and **team news** — each row: name, URL, enabled toggle, priority, last fetch time, last status, error detail, and a "test fetch" button showing the raw items returned.

League-ticker sources project their ingested items into `ticker_items` with `source = 'feed'` on each sync; items that disappear from the upstream feed are soft-deleted rather than removed, so a pinned feed item doesn't vanish mid-week.

Team-news sources feed only the Fav Team News box and are filtered per player by `favorite_team`, which is why that field is a controlled vocabulary — 32 NFL team codes in a seeded `teams` table, never free text.

**Item hide:** the recent-items table lists everything ingested; each has a hide toggle setting `feed_items.hidden`. Hidden items never render anywhere.

**Blocklist:** domains and keyword patterns, applied at ingest.

#### 4.5.3 System items

Generated by the app, refreshed on the same cadence as the phase poller. Each is individually toggleable in `app_settings`:

| `system_key` | Renders roughly | Live when |
|---|---|---|
| `deadline` | *Thursday noon ET — 1 day, 4 hours* | Slate open |
| `waiting_on` | *9 of 12 in — waiting on Terry, Marlene, Dave* | Slate open, pre-reveal |
| `pot` | *This week's Pot: 240 chips* | Always |
| `marker` | *The Pot is carrying a 60-chip marker* | Marker outstanding |
| `reveal` | *The room is open — every ticket is live* | 6h after reveal fires |
| `pot_awarded` | *Marlene takes the Pot: +240* | 24h after settlement |
| `ante_tier` | *Gold tier — the ante is 30* | First 48h of a new tier |
| `leader` | *Dave leads with 1,410* | Always |

These are league facts, so they respect the blackout the same as everything else: `waiting_on` carries names only, never picks or counts of picks (§6). Wording for each is a content block, so the phrasing is yours.

#### 4.5.4 Settings tab

`app_settings` controls:
- `ticker.enabled` — kill switch. Off = the rail does not render at all.
- `ticker.scroll_duration_ms`
- `ticker.max_items`
- `ticker.system_items` — per-key on/off map
- `news.rotate_ms` — default **5000**, matching the sketch note *"fades news items in every 5 sec"*
- `news.items_per_team`
- `feeds.cache_ttl_minutes`

Fav Team News is filtered by each player's `favorite_team`, which makes `favorite_team` a controlled vocabulary — 32 NFL team codes in a seeded `teams` table, never free text.

### 4.6 Promo box (`/admin/promo`)

The one genuinely authored surface. Fields: heading, body, image upload (Supabase Storage), CTA label, CTA URL, enabled, optional start/end datetime. Live preview at the real box dimensions. When disabled or expired, the dashboard renders `dash.promo.fallback_heading` or collapses the box — commissioner's choice via a setting.

### 4.7 Notifications (`/admin/notifications`)

Per-event toggle + editable SMS template with variable chips. Keep every message under 160 characters; show the counter.

| Event | Default timing | Variables |
|---|---|---|
| Slate open | Tue 6:05am ET | `{week}` `{ante}` `{limit}` |
| Reminder | Wed 6:00pm ET, unsubmitted only | `{week}` `{hours_left}` |
| Final call | Thu 9:00am ET, unsubmitted only | `{week}` |
| Manual nudge | On demand from ops dashboard | `{name}` `{week}` |
| Reveal fired | Immediate | `{week}` |
| Settled | After final game | `{week}` `{delta}` `{stack}` `{rank}` |
| Pot awarded | With settlement | `{winner}` `{amount}` |
| Commissioner correction | On re-settlement | `{week}` `{reason}` |

Rules: quiet hours 10pm–8am ET (queue, don't drop); per-player opt-out honoured (`sms_opt_in`); STOP handled by the provider webhook writing back to `sms_opt_in`; every send logged to `notification_log` with provider ID and status; a failed send surfaces on the ops dashboard rather than failing silently. Opt-in disclosure text is a content block and must be shown at signup.

### 4.8 Settings (`/admin/settings`)

- **Season** — year, current week, status (`preseason` / `active` / `complete`), Week 1 lock timestamp, and the **rulebook version string** currently deployed, displayed read-only with the note that changing it is a deploy, not a setting (§13)
- **Rule constants** — ante tiers, limit divisor (3), rounding step (10), min games (5), min/max per bet (10/50), payout cap (2.50), payout floor (0.25), min players (8), pot places table. **All locked once `status = 'active'`.** Rendered read-only with a lock icon and a link to §13.
- **Deadline** — Thursday 12:00 ET, slate open Tuesday 6:00 ET. Locked while active.
- **Providers** — sports API key status, news API key status, Twilio status, Resend status. Show connection health, never the secret.
- **Danger zone** — commissioner handoff; season reset (preseason only, requires typing the season year).

### 4.9 Audit (`/admin/audit`)

Reverse-chronological, filterable by action type, entity, and date. Shows actor, action, before/after JSON diff, reason, and whether it was mirrored publicly. Export to CSV. No delete, no edit — the table is append-only at the database level, and that constraint is the point. A commissioner who can edit the audit log has no audit log.

### 4.10 Season close (`/admin/season-close`)

Available only once Week 18 has settled.

- **Final standings preview** with every tiebreaker resolved and shown, so it is obvious *why* the order is what it is.
- **High card** — if a tie survives to tiebreaker 4 (§11), this is where it is drawn. The tool commits a seed hash to Table Talk, waits for the commissioner to trigger, then reveals the seed and the derived cards. One draw. The button disappears afterward and there is no re-run route, because §11 says no re-draws and a UI that can do it anyway is an invitation.
- **Marker write-off** — if the Pot is carrying a marker at close, it cannot roll (there is no next week). The panel shows the amount, requires acknowledgement, and writes a `season_close` ledger entry against the Pot's account so the conservation assertion still passes.
- **Awards** — computed list with the underlying numbers shown for each, plus opening The Mark's vote to players who finished on the felt (one vote each, seven days, plurality, ties are co-winners, §12). **Deactivated players are excluded from every award and from the championship** (§11); the preview shows them with their stack and an *out* marker so the exclusion is visible rather than mysterious.
- **Lock season** — sets `status = 'complete'`. All tickets and ledgers remain permanently readable (§11); no further writes are accepted.


---

## 5. Scheduled jobs

Vercel Cron, each writing a `job_runs` row. All times ET; handle DST by scheduling in `America/New_York`.

| Job | Schedule | Does |
|---|---|---|
| `slate.open` | Tue 6:00am | Freeze spreads, **snapshot the median before antes** (§14), **snapshot the places-paid tier and `active_player_count`** (§7), evaluate felt status against this week's ante pre-ante (§9), create week, deduct antes into pot, compute post-ante house limits, open submissions, queue SMS |
| `reveal.check` | Every minute, Tue 6am → Thu noon | Fire reveal the moment the last **active** player's ticket lands |
| `reveal.deadline` | Thu 12:00pm | Auto-fold non-submitters, fire reveal if not already fired |
| `scores.sync` | Every 5 min during game windows | Pull statuses and finals |
| `settle.week` | Triggered when all week's games are final | Settle bets, **recharge the ante on any voided shove** (§14), sweep remainder to pot, award pot from the snapshotted tier, apply felt-floor debits against the Pot (§9), update standings |
| `feeds.sync` | Every 15 min | Ingest news items, apply blocklist |
| `sms.queue` | Every minute | Drain queue, respect quiet hours |

`slate.open` and `settle.week` are the two jobs whose failure is invisible to players until it's very visible. Both alert on the ops dashboard and send the commissioner an SMS on failure.

---

## 6. Operational hygiene

A season's ledger is not reconstructible from memory. Treat it accordingly.

**Idempotency.** Every job that moves chips carries an `idempotency_key` unique on `(week_id, job_key)`, enforced by a database constraint rather than an application check. The failure this prevents — a retried cron anteing the entire league twice in Week 15 — is silent, expensive, and nearly impossible to unwind cleanly once tickets have been submitted against the wrong stacks.

**Backups.** Supabase point-in-time recovery on, retention at least through the season plus one month. Additionally, a weekly export of `ledger_entries`, `tickets`, and `bets` to Storage after settlement — the ledger is the league, and the ability to rebuild every stack from it is worth more than any other artifact in the system.

**Monitoring.** Sentry on both server and client. Alert the commissioner by SMS on: a failed `slate.open`, a failed `settle.week`, a conservation-assertion failure, and any settlement that halts. These four are the only pages worth waking up for; everything else can wait for the ops dashboard.

**Conservation assertion.** Runs after every settlement and after every re-settlement. On failure it halts, leaves the week unsettled rather than writing bad state, and alerts. Do not make this warn-only "temporarily."

**Rate limits.** OTP requests per phone, chat posts per player per minute, and admin mutation endpoints. Chat spam is the realistic abuse case in a twelve-person league, and mute is the wrong tool for a runaway client loop.

---

## 7. Acceptance tests

The build is not done until these pass:

1. Commissioner cannot read any ticket, including their own opponents', before the reveal — asserted at the API layer, not the UI.
2. Every write path to `tickets` and `bets` post-submission raises a database exception, including with a service-role client.
3. Every stack change in the system has a corresponding `ledger_entries` row with a non-empty reason.
4. Re-settling Week 6 correctly cascades through Week 18 and produces a reversal entry for every original entry.
5. Rule constants reject writes while the season is active.
6. Deactivating a player removes them from the median and from `active_player_count`, and leaves their stack and standings row intact.
7. A muted player can still submit a ticket.
8. Every string rendered anywhere in the player app resolves from `content_blocks` — grep the components for string literals in JSX as a CI check.
9. Force-reveal is rejected before Thursday noon.
10. Hiding a feed item removes it from both the ticker and the news box within one poll cycle.
11. A manual ticker item published with a future `starts_at` does not render until that time, and disappears at `ends_at` without intervention.
12. Feed and system ticker items are not editable through any API route — only hide, pin, and priority.
13. The `waiting_on` system item never emits pick data, and emits nothing at all once the reveal has fired.
14. A pending applicant can reach no route but the waiting page, and holds no ledger entries.
15. The season cannot transition to `active` with fewer than 8 approved players.
16. Running `slate.open` twice for the same week deducts exactly one ante per player.
17. Deactivating a player who has not submitted causes the reveal to fire immediately if all other active players are in.
18. A player on the felt with 3 chips can successfully submit a 1-chip bet on a single game.
19. The house limit for a player whose stack is 90 in a 30-ante week is computed from 60, not 90.
20. A settled bet's outcome matches the game winner regardless of the frozen spread.
21. High card can be drawn exactly once, and the committed hash matches the revealed seed.
22. A hidden chat message renders as a tombstone, not a gap, and the row still exists.
23. **No API response before `revealed_at` contains any trace of a shove** — not the fact, not the player, not the game — including admin routes and the ticker payload (§6, §8).
24. **Submitting a shove writes no ledger entry**, stores a committed stake equal to the pre-ante stack, and **leaves the Pot figure unchanged**. The `ante_refund` posts only when `revealed_at` is set (§6, §8).
24a. **No ledger entry of any kind exists** with a timestamp between a week's ante posting and its `revealed_at` — asserted over a full simulated season including shove, fold, and felt weeks. This is the leak-proofing test: run it by diffing every public figure before and after each submission and asserting nothing moved.
25. **Voiding a shove's game returns the chips, returns the shove card, and recharges the ante** into the Pot at settlement (§14).
26. **A felt-floor chip is debited from the Pot's ledger account**, and the conservation assertion passes across a season containing at least one busted shove (§9).
27. **Deactivation is rejected without non-empty evidence**, and a deactivated player is excluded from final standings ranking and from every award while retaining their stack and standings row (§11).
28. **Re-settling an early week leaves later locked tickets byte-identical**, settles them at face value even where they now exceed the recomputed limit, and floors any resulting stack at 1 (§13, §9).
29. **The places-paid tier used at award time equals `weeks.places_tier_snapshot`**, even after a mid-week deactivation changes `active_player_count` (§7).
30. **A player whose every bet was returned is Pot-eligible**; a player who submitted nothing is not (§7).
31. **The approve and reject endpoints reject after the Week 1 lock timestamp**, at the API layer (§13).
32. **No route can write to the rulebook**, and `/rules` renders the deployed file with its version string (§13).
33. **Felt status is computed once at slate open against that week's ante, pre-ante** — a 25-chip stack is felt in Week 15 and is not felt in Week 10 (§9).
34. **Median rounds down to the nearest 10 for odd player counts as well as even** (§14).
35. **A pot split's floored remainder rolls into next week's Pot** rather than being handed to first place (§7).
