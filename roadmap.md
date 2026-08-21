# ANTE — Build Roadmap & Session State

**Purpose:** the single place any session — human or cold-started agent — looks to learn
where the build stands and what comes next. Update the **Current Status** block and the
checkboxes every time meaningful work lands. Keep entries terse; detail lives in the specs.

---

## Current Status

> **2026-08-21 (thirteenth pass):** **The reveal misreported shove payouts (D-021).** Previewing
> the reveal against a realistic Week 1 put a 490-chip shove on the board at **2.50×** when
> §8 says a shove always pays even money — the shove beat directly above it even said "even
> money". Chips were never at risk: `settleWeek` has always paid 1× and it is unit-tested;
> this was `RevealBoard` reusing the crowd price for the shover, who *moves* that price (§14)
> but does not ride it. Fixed and pushed. The by-game view was already correct.
>
> A local-only reveal preview exists at `app/reveal-preview/` (uncommitted, never shipped —
> it renders fabricated tickets against real names, which on a public URL would read as
> leaked picks). Visit `localhost:33333/reveal-preview` while signed in; delete the folder
> when done.

> **2026-08-21 (twelfth pass):** **Late joiners could not play (D-020).** A real signup after
> Week 1's slate opened saw a locked Game Board and sat at 500/Δ+0 while everyone else was at
> 490/−10. `approvePlayer` credits the buy-in but only `slate.open` writes the `week_players`
> snapshot and posts the ante, and `WagerArea` reads a missing snapshot as "closed" — yet §1
> allows admission right up to the Week 1 deadline, so they are meant to play. Approval and
> reactivation now call `admitToOpenWeek`, using the engine's own `houseLimit`/`isFelt`; the
> week's median, active count and places tier stay fixed (§7), and it no-ops past the
> deadline. The Pot side needed its own idempotency key — reusing `open:ante:pot` would have
> been swallowed as a duplicate and broken conservation. Affected player backfilled:
> **total 4,500 before and after, Pot 80→90, player 500→490, limit 160**, 9/9 snapshots.

> **2026-08-21 (eleventh pass):** @mentions, chat cleared, and **the restore drill found a
> real hole** (**D-019**). A scratch Supabase project (`TheAnte-Staging`, free) was used to
> run the restore for real: the `0002` guard `bets_with_ticket_only` requires a bet to be
> inserted in the same transaction as its ticket, so **every bet row would have been
> rejected** — invisible today (zero bets) and catastrophic from Week 1 onward. The restore
> now loads through Postgres directly as ONE transaction under
> `session_replication_role = replica`, rolling back on a chip-total mismatch; verified in
> three steps on the scratch project, including that the guard returns after COMMIT.
> **Needs `--db-url` now** (Supabase → Settings → Database → connection string).
> Table Talk cleared of 12 test messages (system announcement kept; append-only guard
> verified back on afterwards). @mentions ship with a composer picker, highlighted
> rendering, and an email to the person named — handles derived by one shared function,
> capped at 5 per message, 14 new unit tests. Promo image + placeholder CTA cleared.
> Typecheck/build/content-grep green, **83 tests** (was 69), lint at the 6 pre-existing.

> **2026-08-21 — PUSHED TO PRODUCTION.** Commit `6a4edfe` (D-008 … D-018) is live at
> https://theantegame.com. Verified after deploy: `/` 200 at 31KB, `/tex/*` 200,
> `/guide` 307 (correct redirect when signed out), `/api/jobs/*` 401 (correctly gated),
> 17 migrations applied and matching the 17 files.
>
> **Smoke test caught a live 404:** `/guide` linked to `/rules`, which has never been
> built — the rulebook still lives only in `docs/build spec/`. Link removed and pushed as a
> follow-up. **Building `/rules` is outstanding** and needs a markdown renderer.
>
> Still open: (a) the restore write path has never been run to completion against a real
> empty database; (b) `promo.cta_label` is still the placeholder "CTA Label"; (c) Supabase
> stays on the free plan by choice — the downloaded backup is the only off-platform copy.

> **2026-08-21 (tenth pass):** **Dashboard-crashing bug fixed (D-018).** Saving a promo
> image threw `Invalid src prop … hostname not configured` and took the whole dashboard
> down for every player. `next/image` requires remote hosts to be allowlisted, and the
> promo URL is arbitrary commissioner input, so no allowlist can be right; allowlisting
> `**` would have turned the deploy into an open image proxy. The promo image is now a
> plain `<img>`, the URL is parsed before render (non-http(s) is skipped, box still shows),
> and the CTA link is validated the same way. `/admin/promo` now renders the real PromoBox
> as a live preview with a warning for an unusable image URL. Verified against live content
> both ways: real URL renders, malformed value returns HTTP 200 with zero runtime errors.
> Typecheck/tests(69)/build/content-grep green; lint at the 6 pre-existing errors.

> **2026-08-21 (ninth pass, cont.):** Added `--verify` to the restore script — proves a
> backup file offline (tables present, ledger sums to the recorded chip total, no orphaned
> rows); confirmed against a deliberately corrupted copy. Download cadence set to twice
> weekly (Thursday post-reveal, Tuesday post-settlement) with `backup.remind_after_days` = 3,
> and the guidance written onto the backups page. **Open gap: the restore write path has
> never been run to completion against a real empty database** — dry run and guards are
> tested, the actual load is not.

> **2026-08-21 (ninth pass):** Free-plan backup discipline + restore + chip clipping fix
> (**D-017**). Owner declined Supabase Pro for now (revisit ~week 2–3), so the downloaded
> file is the only off-platform copy. Added a **daily reminder email** (`backup.reminder`,
> cron `0017`, 13:00 UTC) that nags until the commissioner presses "I've got the file" on
> `/admin/backup`, which stamps `backup.last_confirmed_at`. Added **`npm run db:restore`**
> (`scripts/restore.mts`) — a guarded CLI restore for a FRESH database: dry run by default,
> refuses a populated target without `--force`, loads parents before children, relinks
> `players.approved_by`, nulls dangling `ticker_items.feed_item_id`, and verifies the ledger
> against the file's chip total. Re-settlement remains the right tool for a bad reveal.
> **Validated live:** all 22 tables read, real file produced, dry run parsed it, guard
> refused to overwrite 8 live players, chip total exactly 4,000 (8 × 500). Fixed the tutorial
> step chips being sliced by `chamfer`'s clip-path (chips are now siblings of the clipped box).
> Typecheck/tests(69)/build/content-grep green; lint back to the 6 pre-existing errors after
> removing a dead variable of my own. Not yet pushed to `main`.

> **2026-08-21 (eighth pass):** Backups (**D-015**) + tutorial rebuild (**D-016**).
>
> **Backups.** Found: the Supabase org is on the **free plan — no automated backups, no
> point-in-time recovery**, projects pause on inactivity. Built two clearly separated things:
> in-database `league_snapshots` (migration `0016`) taken automatically before settlement,
> re-settlement, forced reveal and season close, plus on demand — these protect against a bad
> write; and `/admin/backup/download`, a timestamped JSON of 22 tables that is the only thing
> protecting against losing the project. `feed_items` and `job_runs` excluded (regenerate /
> regrow). Each snapshot records the ledger chip total so a file is self-checking. No wholesale
> restore by design — `resettle` + a public correction is the right tool for a bad settlement
> and preserves the audit trail. A schema pre-flight caught that `week_players` has a composite
> key and no `id`, which would have sheared its paged read. **Owner action: Supabase Pro
> ($25/mo) is the single highest-value change and is not something the app can do for itself.**
>
> **Tutorial.** Cut 10 steps to 5, and fixed real drift — it was still teaching the `+/−`
> stepper that D-009 deleted. The mock board now mirrors the live one (press to raise). New
> middle step teaches the actual strategy: payout is players-against ÷ players-with, so hunt
> the unpopular side. 21 orphaned `howto.*` keys deleted. `/guide` gained "How to actually win".
> Typecheck/tests(69)/build/content-grep green; lint unchanged at 6 pre-existing errors.
> Not yet pushed to `main`.

> **2026-08-21 (seventh pass):** Moneylines + first-run chat tell (**D-014**). Each side of
> a game now shows its frozen spread and frozen American moneyline (`−3.5 · −180`), ingested
> from nflverse's own `away_moneyline`/`home_moneyline` (migration `0015`, applied; Week 1
> backfilled 16/16). No derived odds — a game without a published moneyline shows the spread
> alone. `dash.wager.spread_note` rewritten to state plainly that neither number pays: ANTE
> settles straight-up and the payout comes from the room's split (§5). The live-chat tell now
> shows only to players who have never posted; one message and it is off for good. `/guide`
> gained a "Your bets and the Pot are two different things" section, and the Pot section now
> says who wins it, that folding forfeits it, and that a full-league fold rolls it forward.
> Typecheck/tests(69)/build/content-grep green; lint unchanged at 6 pre-existing errors.
>
> **Confirmed working by the owner:** the in-app support desk — message sent, commissioner
> email received. **Still unverified:** the reply-to-player leg, and the admin pages.
> Not yet pushed to `main`.

> **2026-08-21 (sixth pass):** Table Talk, live-chat tell, homepage weight (**D-013**),
> plus a clean-up sweep. Chat panel now sizes 144px–512px (about a dozen messages) before
> scrolling. The composer carries a gold "Chat with the league" label, a pulsing light and a
> 4.5s shine — an amendment to art §8, which had chat under "not worth animating"; the
> message list itself stays still and both loops honour reduced-motion. Homepage: dropped the
> unused Chakra Petch 500 weight and shrank the facet field (integer coordinates, 9×5 on the
> homepage) — **HTML 46.6KB → 30.3KB, load event 319ms** on a production build, comfortably
> under the 1s target. Server time was never the issue (dev and prod both ~110–170ms); the
> remaining cost is Clerk's script plus its two API calls, which sign-in needs.
>
> **Sweep:** no temporary routes, `proxy.ts` unmodified, no TODO/FIXME/console.log in
> app/components/lib, no dead exports (`CONTENT_GROUPS` un-exported), typecheck/tests(69)/
> build/content-grep green, lint unchanged at the 6 pre-existing errors. `.claude/launch.json`
> gained an `ante-prod` entry for production-build measurement.
>
> **Still open for the owner:** (a) point spreads vs moneyline — unchanged pending a decision;
> (b) `support@theantegame.com` still has no MX, but the support desk no longer depends on it
> (D-012); (c) the live support send/reply round trip and every admin page remain unverified —
> they need sessions the agent cannot create. Not yet pushed to `main`.

> **2026-08-21 (fifth pass):** In-app support desk + sticky game board (**D-012**).
> The mailto: support link is gone (the domain has no MX, so those messages bounced):
> players now press **Message the desk**, get a one-field dialog, and the confirmation says
> the reply comes by email. Tickets land in `support_messages` (migration `0014`, applied),
> the commissioner is emailed that one is waiting, and `/admin/support` lists them with a
> reply that emails the player back. Answered tickets stay — nothing is deleted.
> `emailPlayer` gained an `allowFreeText` option so a player's braces are not mistaken for
> a broken template. On desktop (≥900px) the stakes band now sticks to the top and the slip's
> strip became a running tally (`Committed / limit`, Remaining, Games, fill bar) pinned
> directly beneath it, with the offset measured via `ResizeObserver` into `--band-h`; ante,
> limit and deadline were de-duplicated off the strip and live only on the band.
> Typecheck/tests(69)/build/content-grep green; lint unchanged at 6 pre-existing errors.
> Verified: sticky offset exact (band 103px → tally pinned at 103px, zero gap), tally and
> fill bar correct, support dialog opens focused with the right copy. **Not verified: the
> live send/reply round trip and every admin page — both need sessions the agent cannot
> create.** Not yet pushed to `main`.

> **2026-08-21 (fourth pass):** Commissioner-console usability + player fixes (**D-011**).
> New `/admin/ticker` page owns the rail: on/off, crawl-speed slider (15–180s per pass),
> two colour choices from the token palette, item cap, the six generated-line toggles shown
> with their actual wording, a composer, and the live line list with Remove (which hides —
> nothing is ever deleted). Content editor rebuilt: jump menu, plain-English titles for every
> namespace via `lib/content/groups.ts`, and full-width multi-line fields. Fav Team News is a
> fixed three lines tall and now shows the story's source as a new-tab link. Chips draw one
> per rung (five presses = five chips). Typecheck/tests(69)/build/content-grep green; lint
> unchanged at 6 pre-existing errors.
>
> **Two open items for the owner.** (a) Point spreads vs moneyline: `−3.5` is a spread, not
> `+180/−200` odds; ANTE pays by crowd split (rulebook §5), never by odds, so a moneyline
> would advertise a payout that does not exist — left unchanged pending a decision.
> (b) **`support@theantegame.com` cannot receive mail** — `theantegame.com` has no MX
> records (sending via Resend is fine; inbound is not configured), so the support link
> bounces. Needs a mailbox/forwarder plus DNS.
>
> Admin pages this pass were **not** visually verified — they require a commissioner session
> the agent cannot create. Not yet pushed to `main`.

> **2026-08-21 (third pass):** Owner review round (**D-010**). **News is live** — the
> feeds pipeline was complete but `feed_sources` was empty, so migration `0013` seeds 32
> first-party club RSS feeds plus ESPN and CBS league wires (applied to production; first
> sync 722 items, 0 errors, all 32 teams covered, cron re-runs every 15 min). The wager
> slot is now the titled **Game Board** ("The Felt" rejected — it means broke in rulebook
> §9). Point spreads moved under each team name so the favourite is obvious. Chips stay
> vertical on a phone and fan horizontally from `sm` up. Submit and shove carry tooltips.
> New `/guide` page — the written, plain-language how-to-play, all copy under `guide.*`;
> `/how-to-play` stays the interactive gate and replays via `?replay=1` (only for players
> already routed to `/dashboard`). Two small links added above the account row. Empty promo
> slot now renders nothing instead of a wordmark that looked like a button. Masthead rail is
> transparent. Typecheck/tests(69)/build/content-grep green; lint unchanged at 6 pre-existing
> errors. Verified via harness (real `BetSlip`, guide page) — **the signed-in dashboard has
> still not been walked with live data.** Not yet pushed to `main`.

> **2026-08-21 (later):** Bet-slip usability pass (**D-009**) plus masthead adjustments.
> The +/− chip steppers are gone: the slate now centres each game with the two teams facing
> across it, and backing a team is one press on the team — each further press raises the
> stake a rung, one press past the top clears the bet. Off the felt the ladder is exactly
> 10/20/30/40/50 (the existing `step`/`maxChips` rules, which already gave five rungs);
> on the felt it is derived across the player's stack in whole chips. Raises clamp to the
> remaining house limit. Five rungs are drawn as pips so the reset is not a surprise. Chips
> are larger (44px) and the cast shadow was fixed so a stack reads as discrete chips.
> `dash.wager.raise_hint` added to `lib/content/defaults.ts` (commissioner-editable).
> Masthead (rail + ticker) constrained to the `max-w-6xl` column; logo +25% on desktop only;
> ticker no longer pauses on hover. Verified by rendering the real `BetSlip` with static
> props behind a temporary route (removed afterwards, `proxy.ts` restored): ladder climb,
> six-press reset, side switching, felt mode, desktop + mobile. Typecheck/tests(69)/build
> green; lint unchanged at the same 6 pre-existing errors. **Still not seen with live data
> behind a real Clerk session.** Not yet pushed to `main`.

> **2026-08-21:** Casino-material pass on the player interface (**D-008**). The layout,
> palette, copy and blackout rules are untouched; what changed is material and light. The
> canvas now carries a felt ground and one fixed pool of house light; panels became milled
> plates (`.panel` / `.panel-head`) instead of 1px outlines; primary actions became
> polished steel (`.chrome-face`); the stakes band's striped-gradient stand-in was replaced
> with real cut facets (`components/ui/Facets.tsx`) per art §5; every figure on a tier plane
> sits in a recessed tray (`.well`, Pot rimmed in gold) which is what holds small labels
> above 4.5:1 on all four gems; the poker chip became a physical object; browser surfaces
> (selection, caret, focus ring, scrollbars) are themed. Two generated textures ship in
> `public/tex/` (felt, brushed metal), used as sub-12% grain — the design is fully legible
> if neither loads. Restraint boundary from D-007 is intact: leaderboard, settlement, ledger
> and all of `/admin` get the shared neutral plate and nothing else. Typecheck/tests(69)/build
> green; lint unchanged at the same 6 pre-existing errors. Verified in-browser at desktop and
> mobile via a temporary preview route, since `/dashboard` needs a Clerk phone OTP session —
> that route and its `proxy.ts` allowance were removed afterwards. **The signed-in dashboard
> and bet slip have not been seen rendered with live data.** Not yet pushed to `main`.

> **2026-08-18 (later):** Added the how-to-play gate — an interactive, click-through
> tutorial (`app/how-to-play`, `components/howtoplay/HowToPlayTutorial.tsx`) inserted
> between profile completion and `/dashboard` for `approved` players (migration 0012:
> `players.how_to_play_accepted_at`, applied live; `lib/playerRouting.ts` now holds the
> pure `routeFor` table, unit-tested in `lib/player.test.ts`). All ~30 `howto.*` strings
> are content-managed. Also recorded **D-007**: the stakes band, wager area, and
> how-to-play are now a confirmed second "loud zone" (texture/glow/motion), amending
> `ANTE-ART-DIRECTION.md` — dense surfaces (leaderboard/ledger/settlement/admin) are
> unchanged. Typecheck/lint*/tests/content-grep/build all green (*lint has pre-existing,
> unrelated repo-wide failures from a `react-hooks` rule bump — not introduced by this
> work). Not yet run locally: the Supabase torture test (needs Docker, wasn't running).
> Not yet pushed to `main` — confirm with the owner before deploying.

> **🟢 LIVE IN PRODUCTION at https://theantegame.com (2026-08-18).** All 12
> phases complete. Deployed from TheAnteGame/TheAnte@main (git identity:
> TheAnteGame — the CLI's old rztoler login was replaced; both remain in gh
> keyring, TheAnteGame active). Verified live: homepage 200, cron endpoints
> 401/200 correctly, auth gates redirect, Resend domain VERIFIED (DKIM+SPF),
> env vars in Vercel prod+preview. Launch-day fix: the Vercel project predated
> the code, so framework preset was null — vercel.json now pins "nextjs"
> (dynamic routes 404'd without it).
> **What remains is human:** recruit 8+ players, approve them in /admin/players,
> press Activate season (in /admin/settings) before the Week 1 slate opens
> Tue Sep 8, 6:00am ET. Roster locks Thu Sep 10, noon ET.
> Known small gap: /rules page not yet built (route is public in proxy; needs
> the rulebook-markdown renderer) — post-launch item.
> Torture test recipe: `supabase start && supabase db reset` then
> `npx tsx --conditions=react-server scripts/season-torture.mts`. (1) Clerk↔Supabase third-party
> integration in both dashboards, (2) owner signup at localhost:3000, then agent
> runs commissioner bootstrap — these unlock end-to-end testing of everything
> from Phase 5 on. Vercel env mirror + first push still pending (owner said:
> don't push yet). pg_cron schedules live; Vault cron_secret verified; 2026
> season row created (preseason, lock 2026-09-10 noon ET).
> **Last updated:** 2026-08-17 (evening)
> **Done so far:** infra wired; Next.js 16 scaffold with content plumbing (51 engine
> tests green, typecheck + build green); full schema/RLS/triggers/seeds LIVE on
> Supabase (5 migrations applied, guards smoke-tested, advisors clean); pure
> settlement engine complete incl. full-season simulation asserting conservation
> weekly.
> **Blocked on (owner):** the 5 `PASTE_ME` keys in `.env.local`; same vars must be
> set in Vercel BEFORE the first push (the build prerenders via Supabase env). Not
> blocking Phase 4.
> **Not yet done, deliberately:** repo has NO commits (owner confirms before first
> push — it deploys to theantegame.com); RLS behavioral tests land with the
> Playwright blackout suite (needs Clerk JWTs, Phase 6+); generated DB types vendor
> in at Phase 4–5 via the Supabase connector; submit_ticket RPC (DB-side slip
> validation) lands with Phase 6.

## Cold-session bootstrap

1. Read `CLAUDE.md` (targets + invariants), `docs/DECISIONS.md` (post-spec decisions),
   then this file.
2. The full product spec is `docs/build spec/` — authority order:
   RULEBOOK → PLAYER → ADMIN → ART-DIRECTION → TECH. Read what the current phase needs.
3. Verify tooling: Supabase connector → org "The ANTE Game Org", project `vyhxslqddjyyrgbmaedn`
   (apply migrations through it). Vercel connector → team `toler`, project `ante-game`
   (GitHub `TheAnteGame/TheAnte` connected; push to main = production deploy to
   theantegame.com). Clerk connector = SDK docs only; keys come from the dashboard.
4. UI phases must load these skills before writing UI: `/frontend-design`,
   `/ui-ux-pro-max`, `/ui-styling`, `/design` (owner instruction, 2026-08-17).
5. The two invariants that are never weakened: RLS-enforced blackout; exact chip
   conservation over an append-only ledger. If a change touches either, stop and re-read
   `ANTE-TECH.md` §7 and `ANTE-PLAYER.md` §8.12 first.

---

## Phase 0 — Infrastructure & decisions ✅ (2026-08-17)

- [x] Domain theantegame.com bought, on Vercel nameservers, assigned to `ante-game`, SSL live
- [x] GitHub repo `TheAnteGame/TheAnte` created and connected to Vercel (auto-deploy armed)
- [x] Local repo linked (`.vercel/project.json`)
- [x] Supabase project `TheAnte` created (us-west-2), connector scoped, schema empty
- [x] Clerk application "The Ante" created (`app_3HosXHrAzzGhRnBa3MKOlOB0qL4`)
- [x] Decisions D-001 (phone OTP + email-only notifications, SMS stubbed), D-005
      (nflverse + ESPN), D-006 (Google Fonts) → `docs/DECISIONS.md`
- [x] `.env.example` updated; `.env.local` templated with `CRON_SECRET` generated
- [ ] **Owner:** paste 5 keys into `.env.local`; mirror to Vercel env for prod/preview
- [ ] **Owner:** enable phone OTP as the only auth strategy in Clerk
- [ ] **Owner (later, at Phase 5):** register Clerk as third-party auth provider in
      Supabase dashboard (exact steps will be provided at that point)
- [ ] **Owner (later, at Phase 10):** create Resend API key; agent wires
      theantegame.com DNS records via Vercel

## Phase 1 — Scaffold & plumbing

Next.js App Router + TypeScript strict + Tailwind; repo layout per `ANTE-TECH.md` §5
(`app/`, `lib/engine|sports|notify|db|content`, `components/`, `supabase/migrations/`,
`tests/engine|blackout`). Tooling: Drizzle, supabase-js, Zod, Luxon, TanStack Query,
Vitest, Playwright, ESLint + Prettier. `getContent(key)` with seeded repo defaults.
First commit + push gate: **confirm with owner before first push** (it goes live).

- [x] App scaffold (Next 16, strict TS, Tailwind v4), fonts via next/font (D-006)
- [x] Directory layout + lint/format/CI workflow (content-grep lands Phase 6)
- [x] Content-block plumbing (`lib/content/`) with seeded defaults
- [x] Local build green (placeholder page) — Vercel env mirror pending owner keys

## Phase 2 — Schema, RLS, triggers, ledger ⚠️ over-engineer deliberately

All tables per `ANTE-PLAYER.md` §9 + `ANTE-ADMIN.md` §3, as reviewable SQL migrations.
The blackout policy (readable only when `revealed_at IS NOT NULL` or own row — no admin
bypass), ticket-immutability trigger (raises for service role too), append-only
ledger/audit triggers, `(week_id, job_key)` idempotency constraints, waiting-on narrow
view, standings materialized view, seeded 32-team table (nflverse codes), Clerk `sub` as
`text` in policies (`auth.jwt()->>'sub'`, native third-party integration — never
`auth.uid()`).

- [x] 5 SQL migrations applied to Supabase (`supabase/migrations/`): tables, guards,
      RLS + views, team seed, advisor hardening
- [x] Blackout RLS live (no admin bypass; `ante.me()`/`ante.is_approved()` identity fns)
- [x] Immutability + append-only triggers, smoke-tested against live DB (all raise)
- [x] 32 teams seeded (nflverse codes); content defaults live in repo fallback
- [ ] Commissioner row + season row — created when the owner signs up (Phase 5)
- [ ] RLS behavioral tests — with the Playwright blackout suite (needs Clerk JWTs)

## Phase 3 — Settlement engine (pure) ⚠️ over-engineer deliberately

`lib/engine/` — no I/O, no clock, no imports from below. Everything in
`ANTE-PLAYER.md` §8: median, ante tiers, house limit, payout clamp, sweep, pot
places/splits/marker, shove lifecycle, felt rules, tiebreakers, invariants (§8.12).

- [x] Engine complete in `lib/engine/`: constants, median/limit/payout core,
      slateOpen, reveal (deferred-entry posting), settleWeek (sweep/pot/marker/felt),
      invariants — pure, exact integer/rational math, no floats near chips
- [x] 51 Vitest tests green: every rulebook worked example + boundaries
- [x] Full-season simulation ×5 seeds: conservation asserted after every week
- [x] Invariant assertion module (`assertInvariants`) ready for the settlement job

## Phase 4 — Sports ingest & weekly jobs

`lib/sports/` adapter (D-005: nflverse `games.csv` schedule+spreads; ESPN scoreboard
live; joined on the `espn` column; raw responses stored in `job_runs.detail`).
Cron jobs per `ANTE-ADMIN.md` §5, all idempotent, all writing `job_runs`.

- [x] Adapter: `lib/sports/` — nflverse (own CSV parser, schedule + spreads + finals)
      and ESPN (live status/scores), joined on the `espn` column, raw rows preserved
- [x] `lib/time.ts` — ET anchors via Luxon (Tue 6am open / Thu noon deadline from the
      week's first kickoff), DST-proof (tested across the Nov change)
- [x] All six jobs in `lib/jobs/` + `/api/jobs/*` routes (CRON_SECRET-gated) +
      `vercel.json` crons (UTC entries with internal ET guards): slate.open (atomic
      idempotent antes, felt, snapshots), reveal.check/deadline (auto-fold, atomic
      deferred-entry posting, shove cards), scores.sync (auto-triggers settlement),
      settle.week (asserts conservation BEFORE writing; halts loud), schedule.refetch
      (kickoff-moved commissioner alert per §10)
- [x] Preseason data validation PASSED live (2026): spreads populated, espn join clean,
      Wk 1 Wed opener (NE@SEA 9/9) + Wk 12 Wed game (GB@LA 11/25) present, 272 REG games
- [x] Jobs smoke-tested against the live DB (graceful no-season skip, job_runs written)
- [x] 57 tests green (engine + CSV + time anchors)

## Phase 5 — Auth & onboarding

Clerk phone OTP (D-001), Supabase third-party handshake, middleware, admission flow
(pending → approve/reject, preseason-only at API layer), roster lock, 8-player gate,
onboarding form, 500-chip buy-in entry. Per `ANTE-PLAYER.md` §3.

- [x] `proxy.ts` (Next 16 middleware) with Clerk; /api/jobs excluded (own auth)
- [x] Homepage phone OTP (Clerk v7 future API: phoneCode/verifications), in-place
      code entry, E.164 US default, 30s resend, one-time-code autocomplete
- [x] `/join` (pending application via RLS players_apply), `/waiting`, `/closed`,
      `/onboarding` + `/profile` (self-edit under RLS), `/dashboard` stub proving
      the auth→RLS→standings pipeline; routing table in `lib/player.ts`
- [x] Homepage verified in browser, desktop + mobile
- [x] **Owner:** Clerk↔Supabase integration done (domain
      destined-deer-68.clerk.accounts.dev registered); phone-only strategy on
- [x] **Owner:** first real signup completed end-to-end (phone OTP → application →
      onboarding → waiting page) — the full auth→RLS pipeline works live
- [x] Commissioner bootstrap run 2026-08-17: owner approved, 500-chip buy_in
      posted (the league's first ledger entry), commissioner seat filled,
      audit-logged. Required migration 0008 (self-update guard now permits
      adminstrative/no-JWT and service-role writes; players still confined to
      profile fields). Interim admissions until Phase 10: bootstrap SQL + audit.
- [x] Fixes from owner testing: favorite-team select sized to match inputs;
      clerk-captcha mount element added (kills the Smart CAPTCHA console error)

## Phase 6 — Bet slip & submission ✅ code complete (2026-08-17)

- [x] Migration 0007: `week_players` snapshot (felt + house limit fixed at slate
      open, written by the job) + `submit_ticket` RPC — SECURITY INVOKER, runs under
      RLS, validates every slip rule in Postgres (steps, min games w/ short-stack
      rule, limit, felt mode, shove = pre-ante stack + refund bookkeeping),
      validate-then-insert because tickets are immutable from birth
- [x] Wager area (Closed / Open / Submitted states; Revealed/Settled placeholders
      until Phases 7–8), all strings via content blocks
- [x] Bet slip: sticky header strip, side buttons + steppers, spread-as-context,
      felt mode, shove mode (typed SHOVE, pre-ante stake note, dark-until-reveal
      note), irreversibility confirm modal — verified interactively in browser
- [x] Event-driven reveal: submitWager fires revealCheck inline after the last
      ticket lands; pg_cron poll is the fallback
- [x] Waiting-on list from the narrow view + 15s RSC poll (the one moving thing)
- [ ] End-to-end submit test — needs the owner signup + commissioner bootstrap
      (see Phase 5 owner items), then a test slate

## Phase 7 — Reveal ✅ code complete (2026-08-17)

- [x] Reveal job already live from Phase 4 (atomic deferred-entry posting, event-
      driven trigger from Phase 6); this phase built the experience
- [x] Three-act sequence, verified in browser: interstitial ("The room is open") →
      shove beat (gold, breaks here for the first time, names the bent prices) →
      the board with cards-turning-over stagger. Plays once per week per device
      (sessionStorage); prefers-reduced-motion cuts straight to the board
- [x] By-game view: both sides, head counts, prices from the engine's exact
      rational math (shove heads bend prices; empty side shows even money);
      shovers gold-flagged inline
- [x] By-player pivot: shoves sort first, "you" marker, folders receded
- [x] All reads as the user — the same RLS that sealed the rows serves them
- [ ] End-to-end with real data — same gate as Phases 5–6 (owner signup + bootstrap)

## Phase 8 — Settlement UI & leaderboard ✅ code complete (2026-08-17)

(The settle.week job itself — sweep, pot, marker, conservation halt — shipped in
Phase 4; this phase made outcomes visible.)

- [x] Settled state in the wager area (§5.5): per-bet outcome with sign + label +
      color (never hue alone), applied multiplier, profit, weekly delta including
      the ante, pot result (winners / roll / marker), new stack + rank
- [x] Leaderboard (§6): 11 columns, click-to-sort, felt badge, deactivated rows
      muted + "out", own row highlighted, tabular numerals — verified in browser
- [x] Weekly delta wiring is blackout-safe by construction (ledger-only)
- [x] Wager area now covers all five states: Closed / Open / Submitted / Revealed
      / Settled
- [ ] Live end-to-end settlement — will be exercised by the seed/test slate in
      Phase 12 (or the first real week)

## Phase 9 — Dashboard surfaces ✅ code complete (2026-08-17)

- [x] Two-column layout per the wireframe (62/38, single column under 900px with
      the spec's exact mobile order: wager → chat → leaderboard → news → promo →
      support)
- [x] Stakes band: the one big tier-colored plane (gradient facet, tier top edge),
      season ring SVG (elapsed dimmed / current bright / future dark, gold bezel),
      week + tier + ante + Pot + your limit + deadline; preseason variant with the
      Week 1 lock date
- [x] Ticker: blended rail (stored manual/feed rows + system items computed at
      render per ADMIN §4.5.3, worded by content blocks, ordered pinned→priority→
      source-rank→recency), CSS crawl with hover pause, reduced-motion static
      rotation, empty rail renders nothing; waiting_on stops at reveal
- [x] Table Talk: 50-message panel, system messages gold, tombstones for hidden,
      composer via RLS (mute enforced by policy + muted notice with expiry), 5s
      poll cadence with hidden-tab backoff
- [x] Fav-team news fader (5s crossfade, hover pause, league-wide fallback),
      promo box (content-managed, collapses to fallback), support box (mailto)
- [x] Migration 0009: app_settings readable by approved players
- [ ] Owner visual pass on the live dashboard (signed-in view)

## Phase 10 — Admin console ✅ code complete (2026-08-17)

- [x] Gate: one seat, 404 not 403, every action re-checks (`lib/admin.ts`); all
      mutations audit-logged, public corrections mirror to Table Talk (§13)
- [x] Ops: current week card, submission tracker via the PLAYER-facing waiting_on
      view (names only — no privileged pre-reveal panel exists) + email nudge,
      Pot + marker banner, job health strip, alerts
- [x] Week control: slate table (off-slate struck through), the five permitted
      game-data overrides (score / cancel / postpone / void-pre-deadline /
      un-final) each demanding a public reason, force reveal (hard-blocked before
      the deadline), manual settlement run
- [x] Players CRM: applications tab (approve = buy-in moment + welcome email,
      reject; hard-locked at the API layer after Week 1 lock), roster table,
      mute/unmute (never touches betting), deactivate with the two-field friction
      (evidence required — acceptance 27), reactivate, private notes
- [x] Content editor: every default key grouped + searchable, save-with-revision,
      restore-to-default, rules.* namespace blocked (only rules.intro editable)
- [x] Feeds & ticker: manual item composer (pin/priority/window), hide-only for
      feed items, source CRUD with health, RSS/Atom ingest (`lib/feeds.ts` +
      feeds.sync job + pg_cron every 15m — migration 0010)
- [x] Notifications: all 8 event templates editable (content-managed), SMS
      visibly deferred per D-001; sends wire up in Phase 11
- [x] Settings: season card with the 8-player activation gate (acceptance 15),
      rule constants read-only + locked, provider health, commissioner handoff
      with typed-name confirmation
- [x] Audit: append-only viewer with filter
- [ ] Deferred to Phase 11/12: re-settlement cascade + diff UI, season-close
      tooling (high card, marker write-off, awards), scheduled notification sends,
      audit CSV export

## Phase 11 — Notifications, re-settlement, awards, season close ✅ (2026-08-17)

- [x] Template rendering (`lib/notify/templates.ts`): content-managed notify.* keys,
      whitelist vars (blackout by construction), unfilled-variable sends fail loud,
      per-(player, week) dedupe via notification_log
- [x] Sends wired into the season's rhythm: slate.open (per-player limits), reveal,
      settled (per-player deltas + pot), plus reminder Wed 6pm / final call Thu 9am
      ET for unsubmitted players (new notify.reminders job + pg_cron 0011)
- [x] Re-settlement cascade (`lib/jobs/resettle.ts`): reverses every settlement
      entry with visible reversal rows (never deletes), replays the target week and
      all later weeks in order with run-scoped idempotency keys; posts publicly;
      console form on the Week page (acceptance 4/28 groundwork)
- [x] Awards engine (`lib/engine/awards.ts`, pure, 7 new tests — 64 total): all
      seven computed awards per §12's exact definitions + championship tiebreaker
      order (§11) + The Mark electorate rule
- [x] Season close console (/admin/season-close): standings with tiebreakers shown,
      awards preview, one-shot high card (SHA-256 commit → reveal in Table Talk,
      re-draw refused — acceptance 21), marker write-off (§8.10), season lock
- [x] /season player page: final standings with out markers, awards, The Mark
      ballot (felt finishers, 7-day window, plurality with co-winners)

## Phase 12 — Acceptance & launch (IN PROGRESS)

- [x] **The season torture test** (`scripts/season-torture.mts`): a full 18-week,
      25-player season against a REAL local Supabase stack — actual migrations,
      triggers, RLS (players are real signed JWTs), submit_ticket RPC, and job
      code. Per week: double-fired slate.open (must not double-ante), submissions
      with folds/shoves/felt slips, blackout probes as rival players (no foreign
      tickets, Pot frozen), no-ledger-writes-in-window check (AT 24a), real
      auto-fold + reveal, post-reveal visibility, scores with ties/cancellations,
      real settlement, SQL conservation (sum+pot == 12,500, stacks ≥ 1). Plus a
      mid-season re-settlement cascade with tickets asserted byte-identical
      (AT 28). Run: `supabase start && supabase db reset`, then
      `npx tsx --conditions=react-server scripts/season-torture.mts`
- [x] slateOpen refactored: `openWeekCore` seam (identical writes; feed + anchors
      injectable) so the test can march 18 weeks in minutes
- [x] Acceptance test 8 live in CI: `scripts/content-grep.mjs` + allowlist —
      found and fixed 10 hardcoded strings on first run
- [x] **TORTURE TEST GREEN** (2026-08-18): 18 weeks × 25 players, zero failures,
      5.7s. It caught ONE REAL PRODUCTION BUG before going green: PostgREST's
      1,000-row default cap silently truncated every unpaginated ledger read —
      settlement would have computed wrong stacks around Week 14 of a 25-player
      season (exactly the owner's fear). Fixed with `lib/db/fetchAll.ts` paging,
      applied to all nine JS-side ledger readers (settle, resettle, util,
      leaderboard, settled results, stakes band, ticker, admin ops, admin players,
      season data). The standings SQL view was never affected (sums in-database).
- [x] Rules-dynamics observation for the owner (not a bug): a big-stack winning
      shove drains the Pot into a large multi-week marker (§7 permits this —
      "the Pot goes negative and carries"). With 25 aggressive simulated shovers
      the marker ran −5,995 late-season and weekly Pots stopped paying. Real
      humans shove more carefully, but worth knowing the rulebook allows it.
- [ ] Remaining launch items: Resend API key + theantegame.com DNS, Vercel env
      mirror, cron URLs already point at production, first commit + push (owner
      confirms), smoke the deployed site, activate season when 8+ approved

- [ ] All 35 acceptance tests in `ANTE-ADMIN.md` §7 pass (blackout suite against real DB)
- [ ] Blackout surface-diff test green across a simulated shove week
- [ ] Seed script produces a realistic mid-season league (TECH §9) for preview env
- [ ] Preview Supabase project for PR branches (TECH §9) — decide when needed
- [ ] Sentry, Supabase PITR + weekly ledger export, four SMS/email alarms
- [ ] Production env vars, cron schedules, go-live on theantegame.com
- [x] Cron plan RESOLVED (owner confirmed Hobby, 2026-08-17): all five schedules
      live in Supabase pg_cron (migration 0006), vercel.json removed. The reveal is
      additionally event-driven from Phase 6 (fired by the last submission).
- [ ] **Owner:** create Vault secret `cron_secret` in Supabase dashboard (Project
      Settings → Vault) with the exact value of CRON_SECRET from `.env.local` —
      cron calls 401 until it exists. Then also set CRON_SECRET in Vercel env.
