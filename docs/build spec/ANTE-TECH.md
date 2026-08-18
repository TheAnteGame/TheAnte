# ANTE — Technical Specification

**Version 1.0**
**Audience:** an AI coding agent building this from scratch, and whoever reviews its work.

**Document set and authority.** Five documents, and the order matters:

| Document | Owns |
|---|---|
| `ANTE-RULEBOOK.md` (v1.1) | The game. Final authority on every rule |
| `ANTE-PLAYER.md` | The player app **and the canonical settlement engine** |
| `ANTE-ADMIN.md` | The commissioner console |
| `ante-art-direction.md` (v0.4) | Visual direction and guardrails |
| **`ANTE-TECH.md`** (this) | Stack, infrastructure, integration, environments, testing |

Authority runs **rulebook → build specs → art direction → this document.** This document
never redefines game math, never overrides a spec behavior, and never softens a rule. Where it
appears to, that is a bug in this document. Bare `§` references point at the rulebook.

**What this document is for.** Choosing the boring things once, so nobody re-litigates them in
week three: which library, which provider, which pattern, which environment. It stops short of
component APIs, file layout below the top level, and anything the specs already own.

**What it deliberately leaves open.** Component structure, CSS approach beyond the
constraints in §6, test file organization, and every provider marked *swappable* in §3. Those
are reversible. The things below marked **load-bearing** are not, and they are called out.

---

## 1. Shape of the system

One Next.js application on Vercel, one Postgres database on Supabase, five external services.
No microservices, no queues beyond a database table, no separate backend. A twelve-person
league does not need distributed anything, and every additional moving part is a thing that
can be down on a Thursday morning.

```
                        ┌──────────────────────────┐
   Clerk (phone OTP) ──▶│                          │
                        │   Next.js (App Router)   │
   Sports data API ────▶│   on Vercel              │──▶ Supabase Postgres
   News feeds      ────▶│                          │    · RLS = the blackout
                        │   · RSC + server actions │    · triggers = immutability
   Twilio (SMS)   ◀─────│   · Vercel Cron          │    · ledger = the league
   Resend (email) ◀─────│   · lib/engine (pure)    │
                        └──────────────────────────┘
                                    │
                              Supabase Storage
                              (promo images only)
```

**Three architectural facts that everything else serves**, restated from the specs because
they constrain technology choice more than anything else does:

1. **The blackout is enforced by RLS, not by application code** (`ANTE-PLAYER.md` §1). This
   makes the database the security boundary, which means the data-access layer must go
   *through* RLS as the requesting user, not around it. It is the single biggest constraint on
   the choices in §4.
2. **Chips are a ledger, never a column.** Stacks are `SUM(amount)` over an append-only table.
   Nothing writes a stack. This rules out any ORM pattern that encourages mutable balance
   fields.
3. **The engine is pure.** `lib/engine/` has no I/O, no database access, no clock. It takes
   plain data and returns plain data, so it can be exhaustively tested against the rulebook's
   worked examples without a database at all.

---

## 2. Runtime stack

| Layer | Choice | Load-bearing? |
|---|---|---|
| Framework | **Next.js, App Router**, TypeScript strict | Yes |
| Hosting | **Vercel** — production + preview deploys, Vercel Cron | Yes |
| Database | **Supabase Postgres** with RLS enabled on every table | Yes |
| Repository | **GitHub** utilizing platforms branching and more where needed | Yes |
| Auth | **Clerk**, phone OTP only, no passwords anywhere | Yes |
| File storage | **Supabase Storage** — promo images, weekly ledger exports | No |
| SMS | **Twilio Programmable Messaging** | No — swappable behind `Notifier` |
| Email | **Resend** — reminders, receipts, support inbox | No — swappable behind `Notifier` |
| Sports schedule + spreads | **nflverse `games.csv`** — free, no key (§3.1) | Yes |
| Live scores + status | **ESPN public scoreboard endpoints** (§3.1) | Yes |
| Paid fallback | **SportsDataIO** behind the same adapter (§3.1) | No |
| News feeds | RSS/Atom ingest, provider-agnostic | No |
| Errors | **Sentry**, server and client | No |
| Scheduling | **Vercel Cron** | No |

**Deliberately absent, and why**, because "why don't we have X" will come up:

- **No Redis.** Rate limiting, job locks, and idempotency all live in Postgres with unique
  constraints. At this scale that is simpler and one fewer thing to be down.
- **No websockets.** Both specs mandate polling. A dozen people checking a page is not a
  realtime problem, and polling degrades gracefully in a way sockets don't.
- **No queue.** `sms_queue` is a table drained by a cron. That is a queue, and it is enough.
- **No state manager.** Server Components plus a polling hook covers it.
- **No payment provider, ever.** There is no cash surface in this product (§ Fine Print, and
  `ANTE-PLAYER.md` §11). Adding one is not a feature request, it is a category change.

### 2.1 Libraries

| Purpose | Choice | Note |
|---|---|---|
| Schema + migrations | **Drizzle** | Migrations as SQL files in the repo, reviewable |
| Runtime data access | **`@supabase/supabase-js`** | Goes through RLS as the user — see §4.2 |
| Validation | **Zod** | Every server action input and every external API response |
| Dates + timezone | **Luxon** or `date-fns-tz` | `America/New_York` everywhere; never offset math |
| Styling | **Tailwind** | With the constraints in §6 |
| Polling | **TanStack Query** | Or a hand-rolled hook; either is fine |
| Unit tests | **Vitest** | The engine suite lives here |
| E2E tests | **Playwright** | The blackout tests live here — see §8 |
| Lint / format | ESLint + Prettier, `strict: true` | CI-enforced |

**Drizzle for migrations, supabase-js for reads, and the reason is RLS.** Drizzle owns the
schema, the triggers, and the policies as versioned SQL. But an ORM connecting with a pooled
service credential bypasses RLS entirely, which would silently turn the blackout off. Runtime
reads go through `supabase-js` carrying the user's Clerk token. Service-role access is
confined to the places §4.3 permits.

---

## 3. External services

### 3.1 Sports data — decided

**The NFL has no public developer API.** Its official real-time data partner is Sportradar,
which is enterprise-priced and sold through sales contact. Everything usable at this scale is
either a paid reseller (SportsDataIO, MySportsFeeds) or a community source. So the honest
framing is not "use the official feed" — it's "pick the most durable free source and keep a
paid escape hatch behind an adapter."

**The decision: nflverse for schedule and spreads, ESPN for live scores.**

#### Primary — nflverse `games.csv`

Lee Sharpe's dataset, maintained under the `nflverse` project and republished automatically
via GitHub Actions. Plain CSV over HTTPS, no key, no rate limit, no account:

```
https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv
```

It carries, per game, exactly the four things this product needs:

| Need | Column |
|---|---|
| Stable game identifier | `game_id` — e.g. `2026_01_KC_BAL`. Human-readable and stable for the season |
| Kickoff | `gameday`, `weekday`, `gametime` — enough to build a `timestamptz` in ET |
| Teams | `away_team`, `home_team` — standard nflverse abbreviations |
| Spread | `spread_line` — home-favored positive, away-favored negative |
| Result | `away_score`, `home_score`, `result`, `overtime` |
| **Cross-reference** | **`espn`** — the ESPN game id for the same game |

That last column is the reason this configuration works. My earlier advice was to buy a single
vendor precisely to avoid maintaining an identifier mapping between a schedule source and a
score source — **nflverse ships that mapping as a column**, so the risk I was pricing has
already been paid by someone else and is maintained upstream.

**`game_id` is the canonical `games.external_id`.** Everything else joins to it.

#### Live layer — ESPN scoreboard

nflverse republishes on a GitHub Actions cadence, not in real time, which is fine for spreads
and finals but too slow for `scores.sync` running every 5 minutes during game windows
(`ANTE-ADMIN.md` §5). ESPN's public endpoints cover that:

```
https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=N
```

Joined to our rows through the `espn` column. **ESPN is used only for live status and score**
— never for spreads, never for the canonical ID, and never as the sole record of a final.

#### Why this split, stated plainly

- **Spreads are cosmetic.** §1.5 is explicit: the spread is displayed as context and never
  touches settlement. A late or missing spread degrades to "no line shown." A wrong score
  halts settlement. So the slow, high-quality source owns spreads and the fast, unofficial
  source owns scores — the failure modes land where they hurt least.
- **The schedule must be re-fetchable daily**, not just at slate open. Flex scheduling moves
  kickoffs, and §10 voids any game rescheduled to kick before the deadline. Re-fetch the
  schedule nightly and diff kickoff times; a game that moved earlier under locked tickets must
  raise an alert on the ops dashboard, not be discovered on Sunday.
- **Both sources are unofficial and can break.** That is the accepted risk, and it is
  mitigated three ways: the adapter (below), the paid fallback, and the fact that
  `ANTE-ADMIN.md` §4.2 already gives the commissioner a manual override for every game-data
  field. A human backstop already exists in the design; this just means it might get used.

#### The adapter — load-bearing

`lib/sports/` exposes exactly three functions returning internal types:

```ts
getSchedule(season, week)     → GameRow[]      // nflverse
getSpreads(season, week)      → SpreadRow[]    // nflverse, frozen at slate open
getGameStatus(externalIds)    → StatusRow[]    // ESPN, joined via espn id
```

No provider shape reaches the rest of the app. **This is what makes the fallback cheap:**
if nflverse goes stale in Week 9 or ESPN changes its payload, swapping to SportsDataIO is a
new file in `lib/sports/` rather than a refactor. Build the adapter before the first ingest,
not after.

**Store every raw response** in `job_runs.detail`. When a game settles wrong in Week 9, the
argument is about what the feed actually said, and memory will not settle it.

#### Paid fallback, if it comes to that

**SportsDataIO** — schedule, scores, and odds under one vendor and one ID space, with a free
trial tier. Keep it as a documented, unimplemented option: a named fallback that nobody has
written is still worth more than an unnamed one, because the decision is already made when the
bad Thursday arrives. Sportradar is the tier above and is overkill for twelve people.

#### One free win worth taking

**Seed the 32-team table from nflverse's own abbreviations.** `favorite_team` is a controlled
vocabulary (`ANTE-ADMIN.md` §4.5.2), and using the same codes the game feed uses means team
matching is an equality check forever rather than a normalization function that breaks on
`LAR` vs `LA` vs `STL` in the one week nobody is watching.

### 3.2 Clerk — phone OTP, and the Supabase handshake

**Load-bearing, and easy to get wrong.** Use Clerk's **native third-party auth integration**
with Supabase, not the JWT-template approach — that was deprecated on 1 April 2025 and only
unofficially supported since. Register the Clerk domain under Supabase's Third-Party Auth,
and confirm Clerk session tokens carry `"role": "authenticated"`.

**The consequence for every RLS policy:** the user identifier arriving in Postgres is
`auth.jwt()->>'sub'`, which is a **Clerk user ID and a `text` value** — not `auth.uid()`, not a
UUID. `players.clerk_user_id` is therefore `text`, indexed and unique, and every policy joins
through it. Getting this wrong doesn't fail loudly; it fails by matching nothing, or by
matching everything. Write the policy tests first (§8).

Configuration: phone OTP only, no password strategy enabled at all. E.164 with US default,
rate-limited code requests per phone, `one-time-code` autocomplete so iOS autofills. Phone
changes are a Clerk flow initiated by the player, never an admin write.

### 3.3 Twilio and Resend behind one interface

Both specs already require this. `lib/notify/` exposes `send(channel, template, to, vars)`
and nothing else; Twilio and Resend are implementations. Every send writes `notification_log`
with the provider message ID and status.

**SMS** carries the time-sensitive league events in `ANTE-ADMIN.md` §4.7 — slate open,
reminder, final call, nudge, reveal, settled, pot. Under 160 characters, quiet hours
22:00–08:00 ET (queue, never drop), `sms_opt_in` honored, STOP handled by provider webhook
writing back to the column.

**Email** carries what SMS shouldn't: the weekly recap, season close, receipts, and the
support inbox. Resend does not send SMS — that gap is already flagged in `ANTE-ADMIN.md` §0
and this is the resolution.

**One rule that overrides both:** no notification body may contain pre-reveal pick data. Not a
count, not a hint, not "3 shoves pending." Templates are content-managed and therefore
editable by the commissioner, so the **send path validates the rendered body against the
blackout**, not just the template author's intent (§7).

---

## 4. Data layer

### 4.1 Schema ownership

`ANTE-PLAYER.md` §9 and `ANTE-ADMIN.md` §3 own the tables. This document adds no tables and
changes no columns. What it adds is how they're enforced:

**Postgres does the enforcing, not the application.** Four mechanisms, all of which survive a
bug in the app:

| Rule | Mechanism |
|---|---|
| Ticket immutability (§13) | Trigger raising an exception on UPDATE/DELETE of a locked ticket — **including for the service role** |
| The blackout (§6) | RLS policies on `tickets` and `bets`, keyed to `weeks.revealed_at` |
| Append-only ledger and audit | Triggers rejecting UPDATE and DELETE outright |
| Idempotency (§ jobs) | `UNIQUE (week_id, job_key)` on `ledger_entries.idempotency_key` |

The last one is worth its own sentence: a retried cron that antes the league twice in Week 15
is silent, expensive, and nearly impossible to unwind once tickets have been submitted against
the wrong stacks. A database constraint prevents it. An application check does not.

### 4.2 How the blackout is actually written

The policy on `tickets` and `bets`, in words, so the SQL is reviewable against intent:

> Readable **only** when the parent week's `revealed_at IS NOT NULL`, **or** when the row
> belongs to the requesting player.

Three things follow that are easy to miss:

- **It applies to the commissioner identically.** There is no admin bypass, no `OR is_admin`
  clause. The commissioner is a player first (`ANTE-ADMIN.md` §1).
- **The waiting-on list needs its own narrow view** exposing name and a submitted boolean and
  *nothing else*. Do not derive it by selecting from `tickets` with a column mask; a mask is a
  code change away from leaking.
- **`SECURITY DEFINER` functions bypass RLS.** Any helper written that way needs review as
  carefully as the policy itself, because it is the standard way this class of protection gets
  quietly turned off.

### 4.3 Where service-role access is permitted

Only inside server actions and cron jobs that have already passed a commissioner or system
check, and never in the client bundle. The permitted uses are: settlement writes, cron jobs,
and admin corrections. **Ticket reads are not on that list** — an admin route reading tickets
with the service role would defeat the entire design, and acceptance test 1 exists to catch it.

### 4.4 Numbers

**Chips are integers. Always.** `bigint` or `integer` columns, integer arithmetic, no floats
anywhere near the ledger. Multipliers are the only fractional values in the system; compute
them as a rational or a `numeric`, apply with `floor`, and store the applied multiplier for
the record. §14's rounding rule — floor every payout, remainder to the Pot — is what keeps
conservation exact, and a float would break it invisibly over eighteen weeks.

### 4.5 Time

Every deadline, slate open, and phase transition computes in `America/New_York` via the tz
database. **Never offset arithmetic** — the season crosses the November DST change in Week 10,
and a hardcoded `-05:00` puts a deadline an hour wrong for half the season. Store timestamps
as `timestamptz`; display in the player's local zone with an ET label on every deadline.

---

## 5. Application structure

```
app/                    routes per ANTE-PLAYER.md §2
lib/
  engine/               pure functions — no I/O, no clock, no imports from anywhere below
  sports/               provider adapter (§3.1)
  notify/               Twilio + Resend behind one interface (§3.3)
  db/                   Drizzle schema, migrations, policies, triggers
  content/              getContent(key) + seeded defaults
components/
supabase/migrations/    SQL, reviewable, one concern per file
tests/
  engine/               Vitest, against the rulebook's worked examples
  blackout/             Playwright, the tests that matter most (§8)
```

**`lib/engine/` imports nothing.** Not the database, not the clock, not Next. If it needs the
current time it receives it as an argument. This is what makes a 2,500-season simulation
possible as a test, and it is why the engine is step 3 of the build order rather than
something extracted later.

**Server Actions for every mutation**, each re-checking authorization. Middleware gates
`/admin/*` but middleware is not authorization — `ANTE-ADMIN.md` §2 is explicit and it is
right. `/admin/*` returns **404, not 403**, to avoid advertising the route.

---

## 6. Frontend constraints

The art direction owns look. This owns the technical constraints that follow from it:

- **Chamfer, not radius** (art direction §5). Angled corners come from `clip-path`, which
  means the treatment must be tested against focus rings and overflow early — clipped focus
  indicators are an accessibility regression that is painful to discover late.
- **Tabular numerals are non-negotiable.** `font-variant-numeric: tabular-nums` on every
  surface holding chips, multipliers, or counts. Sortable columns that jitter on update are
  the specific failure being prevented.
- **Nothing may animate or poll-update during the blackout.** The polling hook must know the
  week phase and hold every public figure still from ante posting to `revealed_at`. The
  waiting-on ring is the sole exception (§7).
- **`prefers-reduced-motion` throughout**, with the ticker and news fade called out
  explicitly by both specs.
- **Every string resolves through `getContent(key)`** with a seeded repo default, so a missing
  row never renders an empty page. Components must tolerate large length variance. **The one
  exception is `/rules`**, rendered from the versioned repo file, which is also the only
  surface whose copy can be designed to.
- **Fonts via `next/font`**, self-hosted. Confirm display-face licensing before building
  around it — Monument Extended and Druk Wide are commercial.

---

## 7. The blackout as an engineering requirement

Every other section defers to the specs. This one restates the rule, because it is the
property most likely to be broken by a well-intentioned change and it is not recoverable once
a season is underway.

> **Between the ante posting and `revealed_at`, no public figure changes and no ledger entry
> is written.** The only pre-reveal state change in the entire system is a name leaving the
> waiting-on list.

**What this means in code**, since "don't leak picks" is not specific enough to defend:

- **No ledger writes during the window.** A shove's ante refund is computed at submission,
  stored on the ticket as `committed_stake` and `pending_refund`, and posted by the reveal job
  (`ANTE-PLAYER.md` §8.3).
- **No derived value may move.** Pot, leader, every stack, every rank, every delta, the
  shove-card indicator, the ticker payload, the ops dashboard.
- **`players.shove_used_week` is written by the reveal job**, never the submit handler.
- **No pre-reveal payload may contain ticket data**, including fields the UI happens not to
  render. Test at the API layer, not the component.
- **Nothing renders as obscured.** No blurred rows, no locked-card placeholders, no "3 picks
  hidden" counters. Sealed, not frosted.

**The design rule for anything new:** the question is never "does this show picks." It is
**"can this move during the blackout."** If yes, defer it to the reveal.

---

## 8. Testing

Two suites carry real weight. Everything else is ordinary.

### 8.1 Engine suite (Vitest)

`lib/engine/` is pure, so it tests exhaustively and fast. Cover every worked example in the
rulebook — the §4 house-limit table, the §5 payout table, the §7 pot splits, the §14 rounding
example — plus the boundary cases the specs enumerate: cap and floor binding, `against == 0`
settling at 1.00×, a stack landing exactly on the ante, felt bet rules, a voided shove.

**Then run a simulated season.** The rulebook's appendix was produced from 2,500 simulated
seasons; the engine should be able to run one on demand. Assert after every simulated week:
`sum(stacks) + pot == 500 × buy-ins`, `every stack >= 1`, and mean final stack ≈ 500. A
conservation bug that only appears in Week 14 will not be found by unit tests alone.

### 8.2 Blackout suite (Playwright)

These are the tests that justify the product's central claim, and they run against a real
database with real policies.

1. **Commissioner cannot read any ticket pre-reveal**, asserted at the API layer with a real
   session, not by checking that the UI doesn't render it.
2. **Every write path to a locked ticket raises**, including with a service-role client.
3. **The surface diff test.** Snapshot every public figure — Pot, marker, all stacks, ranks,
   deltas, shove-card indicators, ticker payload, ops dashboard — immediately before and after
   each submission in a week containing a shove. **The only permitted difference is a name
   leaving the waiting-on list.** This is the generalized test, and it is the one that catches
   the next leak nobody anticipated.
4. **No notification body contains pick data**, rendered templates included.

`ANTE-ADMIN.md` §7 holds the full acceptance list; these four are the ones to write first,
before there is a product to test them against.

---

## 9. Environments and operations

**Three environments.** Production, Vercel preview per PR, and local. Preview branches point
at a **separate Supabase project** seeded with a fake twelve-player league at a mid-season
week — not at production, where a stray cron would ante the real league.

**Seed data is a build artifact, not a fixture.** A script that produces a realistic league
mid-season — stacks spread, one player on the felt, one shove spent, six settled weeks — is
worth building early. Most of this product cannot be evaluated on an empty database, and
"looks right in Week 1" is not evidence.

**Secrets** live in Vercel environment variables per environment. The service-role key is
server-only and must never appear in a `NEXT_PUBLIC_` name. Rotating the Supabase JWT secret
is not routine here — with third-party auth it is disruptive.

**Cron** per `ANTE-ADMIN.md` §5. `slate.open` and `settle.week` are the two whose failure is
invisible to players until it is very visible; both alert on the ops dashboard and SMS the
commissioner on failure.

**Backups.** Supabase PITR on, retention through the season plus one month, **plus** a weekly
export of `ledger_entries`, `tickets`, and `bets` to Storage after settlement. The ledger is
the league; the ability to rebuild every stack from it is worth more than anything else in the
system.

**Monitoring.** Sentry on both runtimes. Four alerts are worth waking up for and no others:
failed `slate.open`, failed `settle.week`, conservation-assertion failure, halted settlement.

---

## 10. Development workflow

**Repo:** single, GitHub. Trunk-based with short-lived branches; a twelve-person pool does not
need release trains. CI on every PR: typecheck, lint, engine suite, blackout suite, and the
content-block grep from `ANTE-ADMIN.md` §7 test 8, whitelisting the rules renderer.

**Graphify** for AI-assisted development. It builds a queryable knowledge graph of the repo so
a coding agent traverses structure instead of re-reading files each session. **It is a
development tool, not a runtime dependency** — nothing ships with it and nothing depends on it
at request time. It earns its place here specifically because this project is five documents
of interlocking rules plus code that must honor all of them: the recurring failure mode is an
agent that fixes a rule in one file and misses its three dependents, which is exactly the
relationship a graph makes visible. Run it over the specs and the source together, not the
source alone.

**Build order** is `ANTE-PLAYER.md` §12 and it should be followed literally. Steps 2 and 3 —
schema with RLS, triggers, and ledger projection; then the engine as pure functions with a
full test suite — are worth over-engineering. Everything after them is recoverable.

---

## 11. Open decisions

Tracked rather than guessed. One was blocking and is now resolved; the rest are deferred on
purpose.

| # | Decision | Blocking | Status |
|---|---|---|---|
| 1 | **Sports data provider** (§3.1) | Was blocking | **Decided.** nflverse for schedule + spreads, ESPN for live scores, joined on nflverse's `espn` column. SportsDataIO documented as the paid fallback |
| 2 | **Display typeface licensing** (§6) | Before design build | Open. Confirm budget for Monument Extended / Druk Wide, else Archivo Expanded or Chakra Petch |
| 3 | **News feed source** for the ticker and fav-team box | No — ships after core | Leaning plain RSS per team; no vendor needed |
| 4 | Analytics | No | Vercel Analytics if anything. Not needed for twelve people |
| 5 | Weekly email recap design | No | After Week 1 ships |

**Verify #1 against the live 2026 season before Week 1.** Both sources are community-run.
Pull a full week in preseason, confirm `spread_line` is populated ahead of Tuesday 6:00am ET,
confirm the `espn` column joins cleanly for every game, and confirm the two Wednesday games
the rulebook calls out (§3 — the Week 1 opener and the Week 12 Thanksgiving-eve game) come
through with correct kickoff times. If any of those fail, that is the moment to spend money,
not Week 3.

**Not open, and not to be reopened mid-season:** rule constants, the deadline, the payout cap
and floor, and the rulebook text itself. All four are locked by §13 while a season is active,
and the application enforces that by refusing writes while `season.status = 'active'`.
