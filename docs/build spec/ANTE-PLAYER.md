# ANTE — Player App (Build Spec)

**Audience:** an AI coding agent building this from scratch.
**Companion document:** `ANTE-ADMIN.md` — commissioner console.
**Source of truth for rules:** `ANTE-RULEBOOK.md`, **v1.1**. This document is the *implementation* of that rulebook and owns the **canonical settlement engine** (§8 below). Where they disagree, the rulebook wins — and every §-reference below points at the rulebook unless it says otherwise.

**Stack:** Next.js App Router · Supabase (Postgres, RLS, Storage) · Clerk (phone OTP) · Twilio (SMS) · Resend (email) · Vercel. Chat and reveal use **polling**, not websockets.

**Shape of the league:** single league, 8+ players, NFL Weeks 1–18, one commissioner who plays under identical rules.

---

## 1. The two properties everything else serves

Build order should follow from these, because getting them wrong is unrecoverable and getting them late is expensive.

**The blackout is absolute.** Before the reveal, no player — commissioner included — can learn anything about anyone's picks. Not a count, not a percentage, not a hint in a payload the UI happens not to render. Ticket data must be unreachable at the API layer pre-reveal, enforced by RLS policy, not by a component that declines to display it. The only pre-reveal public fact is **who has not submitted** (§6).

**Chips are conserved exactly.** The league holds `500 × players` on the first Sunday and the same number on the last (§5). Every stack is a projection of an append-only ledger. Nothing writes a stack directly. Rounding remainders go to the Pot rather than evaporating (§14). A conservation assertion runs after every settlement and fails loudly.

---

## 1.5 Rulings

Rulebook v1.1 closed a set of questions that earlier drafts of this spec had to answer on its own. **Those answers are now in the rulebook and are quoted here only so the engine's reasoning is legible next to the code.** Anything in this section that contradicts `ANTE-RULEBOOK.md` is a bug in this section.

**Bets settle straight-up.** The winner of the game wins the bet. **The point spread is displayed as context and never touches settlement** — it is frozen at slate open (§14) so the record shows what information the room had, not because it decides anything. There is no such thing as a push; the only returns are NFL ties, cancellations, postponements, and games rescheduled to kick before the deadline (§10).

**The house limit uses your post-ante stack** (§4, "Which stack, measured when"). The median is the slate-open snapshot taken *before* antes. Your own stack is what you hold *after* your ante has come out. Different moments on purpose — measuring pre-ante would break §4's promise that the worst week costs you a third. Comment this in the code; it reads like an inconsistency and is not one.

**The reveal waits only on active players.** §6 fires the reveal when the last ticket lands. A deactivated player never submits, so counting them stalls every reveal to Thursday noon forever. The trigger counts approved, non-deactivated players.

**Felt players bet outside the normal bet rules** (§9). A 1-chip stack fails every constraint in §3, which cannot be what "bet what you have, on whatever you want" means. On the felt the step, the minimum, and the five-game floor all lift. See §8.8.

**The pot's places-paid tier is snapshotted at slate open** (§7, "League size means"). Felt players count; deactivated players don't. A mid-week deactivation must not change the prize structure after tickets are locked.

**A shove refunds its own ante** (§8, §14). The ante job runs at slate open, before anybody has submitted, so the exemption cannot be applied at deduction time. It is applied as a compensating entry when the shove ticket lands: `ante_refund` against the Pot, and the shove commits the pre-ante stack. If the shove's game is later voided, the refund is reversed at settlement and the ante stands.

**A shove is dark until the reveal** (§8, §6). Earlier drafts of this spec announced shoves "the moment the slate locks." That leaked a pick into the blackout window and is now wrong at every layer: no shove is visible — not the fact of it, not the player, not the game — until `revealed_at` is set.

**And no ledger entry posts during the blackout at all** (§6). This is the stronger form of the same rule and it is the one that is easy to violate by accident. The only chips that move between slate open and the reveal are the antes, and they all move at once on Tuesday before anybody has submitted. Everything a ticket implies — a shove's ante refund above all — is **computed at submission, stored on the ticket, and posted to the ledger atomically at the reveal.**

The reason is a side channel, not a principle: if a shove's ante refund hit the Pot when the ticket landed, the public Pot figure would drop by exactly one ante at a moment nothing else was moving, and any player watching it would know somebody had shoved. That is a pick, leaked through a number. **Treat every public figure as part of the blackout surface**, not just the ticket views.

**The felt's floor chip is debited from the Pot** (§9). `felt_floor` entries credit the player and debit the Pot's own ledger account, which is why the conservation assertion in §8.12 needs no exception for them.

**Re-settlement replays chips, never picks** (§13). A cascade may leave an already-locked ticket exceeding a third of its owner's corrected stack. The ticket stands as submitted, the chips settle, and the §9 floor absorbs the overdraft. There is no code path that scales, trims, or voids a locked ticket.

---

## 2. Routes

| Route | Auth | Purpose |
|---|---|---|
| `/` | public | Logged-out homepage, phone login |
| `/onboarding` | authed, incomplete profile | Profile capture |
| `/dashboard` | authed, complete profile | The main screen |
| `/profile` | authed | Edit own profile |
| `/rules` | public | Rendered rulebook — see below |
| `/standings` | authed | Full leaderboard + season stats |
| `/week/[n]` | authed | Any past week's full tickets |
| `/season` | authed | Season awards, final standings, The Mark ballot (§8.11) |
| `/admin/*` | commissioner | See `ANTE-ADMIN.md` |

Middleware redirects: unauthenticated → `/`; authenticated with `profile_complete = false` → `/onboarding`; complete → `/dashboard`.

**`/rules` is the one page that does not read from `content_blocks`.** The rulebook is a versioned markdown file in the repo, rendered to HTML at build time, displayed with its version string and a frozen-for-the-season note. It is deliberately outside the content editor: §13 forbids changing a rule mid-season, and a CMS-editable rulebook is exactly that hole with a nicer interface. Only `rules.intro` — the framing paragraph above the rendered document — is a content block. Changing the rulebook requires a deploy, which leaves a commit.

**"Public" in §11 means public to the league.** Past tickets, ledgers, and standings are visible to every approved player and are never redacted between players; they are not served to logged-out visitors. `/week/[n]` and `/standings` stay authed.

---

## 3. Auth and onboarding

Matches the *Homepage* sketch exactly.

### 3.1 Logged-out homepage (`/`)

Single centred column, vertically stacked:

1. **Logo** (`home.logo_alt`)
2. **Intro text** — heading + body (`home.intro_heading`, `home.intro_body`)
3. **Phone field** with inline submit arrow (`home.phone_label`, `home.phone_placeholder`, `home.phone_cta`)
4. **Copyright line** (`home.copyright`)

**No password anywhere in the product.** Clerk phone OTP only, per the sketch annotation. Flow: enter phone → Clerk sends code → six-digit code entry replaces the phone field in place (no navigation) → verified → if the player has no profile row, create one and route to `/onboarding`; otherwise `/dashboard`.

Requirements: E.164 normalisation with US default; `tel` inputmode and `one-time-code` autocomplete so iOS autofills the SMS; resend-code link after 30s; rate limit code requests per phone; SMS opt-in disclosure (`sms.optin_disclosure`) shown before the first send.

**Admission (§1, §13).** Signup is open until the Week 1 deadline, but **every applicant requires commissioner approval**. This is an enumerated commissioner power and it is preseason-only — the approve/reject routes must hard-reject once the Week 1 deadline has passed, not merely hide their buttons. A verified phone with no player record creates a row with `status = 'pending'` and lands on a waiting page (`home.pending_message`). Pending players see nothing else — no dashboard, no standings, no chat — and hold no chips. On approval the commissioner's action creates the 500-chip buy-in entry and the player is routed to `/onboarding` on next load; an SMS fires telling them they're in. On rejection the record is marked `rejected` and the phone can reapply only if the commissioner clears it.

**Roster lock.** At the Week 1 deadline, signup closes: pending applications are auto-rejected, and a verified phone with no player record lands on a closed-roster page. *Everybody starts at 500 on the same Thursday or not at all.*

**Season start gate.** The season cannot move from `preseason` to `active` with fewer than **8 approved players** (§1). This is a hard block in the transition, not a warning.

### 3.2 Profile capture (`/onboarding`)

Per the sketch's second panel: logo, intro text, then four fields and a continue button.

- First name (required)
- Last name (required)
- Email (required, validated — used by Resend for receipts and support)
- **Favorite team** (required) — a select over the seeded 32-team table, never free text, because it drives the Fav Team News box
- Continue / submit (`profile.submit_label`)

On submit: set `profile_complete = true`, credit the starting **500 chips** as the player's first ledger entry with reason `buy-in`, and route to `/dashboard`.

Editing later: `/profile`, reachable by clicking the player name in the dashboard header, per the sketch annotation *"click to edit profile."* Phone changes go through Clerk's verification flow. Name changes post nothing publicly — but past tickets remain attributed to the same player ID.

---

## 4. Dashboard layout

From the *Dashboard* sketch. Desktop-first, two-column body under a full-width header and ticker.

```
┌───────────────────────────────────────────────────────────┐
│ [logo]                        [player name] Rank · Chips  │
│                                              [logout]     │
├───────────────────────────────────────────────────────────┤
│ ≈≈≈  league news ticker (scrolling)  ≈≈≈                  │
├────────────────────────────────┬──────────────────────────┤
│                                │                          │
│   WAGER TABLE / AREA           │   TABLE TALK             │
│   (conditional — see 5.1)      │   (league chat)          │
│                                │                          │
├────────────────────────────────┤──────────────────────────┤
│                                │   NEWS                   │
│   LEADERBOARD                  │   (fav team, 5s fade)    │
│   interactive, sortable        ├──────────────────────────┤
│   with stats                   │   PROMO                  │
│                                ├──────────────────────────┤
│                                │   SUPPORT                │
└────────────────────────────────┴──────────────────────────┘
```

Left column ~62%, right ~38%. Below 900px: single column, order — header, ticker, wager, table talk, leaderboard, news, promo, support. The wager area outranks chat on mobile because it is time-sensitive.

**Header:** logo (links to `/dashboard`), player name (links to `/profile`), current rank and chip count, logout. Rank and chips are always public (§11 — the blackout covers picks, not chip counts).

**Ticker:** horizontal marquee reading from a single `ticker_items` table that blends three sources — automated NFL headlines (`feed`), commissioner-written items (`manual`), and app-generated league facts (`system`: deadline countdown, waiting-on count, current Pot, marker, leader). The player app does not know or care which is which beyond optional styling; it renders the ordered list the query returns. Ordering, scheduling, and source rules live in `ANTE-ADMIN.md` §4.5.

Items with a `url` are click-through; items without are plain text. Pauses on hover, respects `prefers-reduced-motion` by falling back to a static rotating item, and the rail does not render at all when `ticker.enabled` is off or the eligible list is empty.

**The `waiting_on` system item is inside the blackout.** It carries names only — never picks, never counts of picks — and stops emitting the moment the reveal fires (§6). It reads from the same narrow view as the wager area's waiting-on list, not from `tickets`.

---

## 5. The wager area

The sketch's own annotations define its lifecycle:
- appears only when betting is open and not completed
- disappears once the wager is made for the week
- once the reveal happens for the league, it shows here

So it is one slot with five states.

### 5.1 States

| State | Condition | Renders |
|---|---|---|
| **Open** | Slate open, player has not submitted | Full bet slip |
| **Submitted** | Player submitted, reveal not fired | Locked ticket summary + waiting-on list |
| **Revealed** | Reveal fired | Every player's full ticket, all multipliers |
| **Settled** | Week settled | Results — per-bet outcome, weekly delta, pot outcome |
| **Closed** | No open slate | Countdown to Tuesday 6:00am ET |

### 5.2 Bet slip (Open state)

Header strip, always visible while scrolling: **ante paid this week**, **house limit**, **chips committed**, **chips remaining**, **games selected / 5 minimum**, and whether the shove card is still held.

Game list — one row per slate game: kickoff time (ET), away/home with the frozen spread, two selectable side buttons, and a chip stepper appearing once a side is picked. **The spread is context, not a settlement input** — label it so nobody assumes they're betting a cover. A tooltip on the spread saying so is worth the space; this is the single most likely misunderstanding in the product.

Client-side rules, all re-validated server-side on submit:

- Bets in **multiples of 10** (§3)
- **Minimum 10, maximum 50 chips per game**
- **At least 5 games** — except on the felt (§9) or when the house limit won't cover five bets (§4 short stack rule), where the minimum drops to what the limit affords
- **Cannot bet both sides** of the same game
- **Total ≤ house limit** — the stepper hard-stops; the app never lets a player overspend
- Games kicking before Thursday 12:00 ET are **not on the slate at all** (§3) — not greyed out, absent
- Any game that has already kicked off is removed live if the page is open across a kickoff

**On the felt, three of those lift** (§9, §1.5): the multiple-of-10 step becomes 1, the 10-chip minimum becomes 1, and the five-game minimum disappears. The limit becomes the player's entire stack. A player holding 3 chips can put 1 chip on each of three games, or all 3 on one. The slip must switch to this mode automatically and say why — *you're on the felt: bet what you have, on whatever you want.*

**House limit display:** show the number, and on hover/tap show which side is binding — *"capped by the room"* or *"capped by your stack"* (§4). This is a teaching moment the rulebook cares about; make it visible.

**The shove** (§8): available once per season, presented as a distinct mode, not a chip amount. Selecting it clears the slip, allows exactly one side on one game, and states plainly that it commits the entire stack, pays **even money regardless of the room**, owes no ante this week, and permits no other bets. Confirmation requires typing the word `SHOVE`. Once spent, the affordance is replaced by the date and game it was spent on.

Two things the slip must say out loud, because both are counterintuitive:

- **The stack it commits is your pre-ante stack.** The ante already came out at slate open; the shove refunds it (§8). Show both numbers — *"you'll push 420, including the 30 ante coming back."* This is the player's own ticket, so showing it to them leaks nothing; the refund itself doesn't post to the ledger or move the public Pot until the reveal (§8.3).
- **Nobody will know until the reveal.** A shove is a pick and lives under the same blackout as every other pick (§6). The UI must not imply an announcement at lock. If the player wants the room to know early, they can type it in Table Talk themselves, which §14 notes is traditional and usually a mistake.

**Submit** is irreversible and the UI must say so before the click, not after (§14 "Changing your mind"). Confirmation modal lists every bet, the total, and the sentence that submission cannot be undone by the player or the commissioner. On success the slip is replaced by the Submitted state and the ticket is immutable at the database level.

### 5.3 Submitted state

The player's own ticket, read-only, and the **waiting-on list**: *"9 of 12 in — waiting on Terry, Marlene, Dave."* Names only, no picks, no counts of anything else (§6). This list is public to every player and is deliberately a little rude; the copy is a content block so its tone can be tuned.

### 5.4 Revealed state

Fires the instant the last ticket lands, or Thursday noon, whichever comes first (§6). Everything opens at once: every player's full ticket — side, chip amount, folds, shoves — plus the computed multiplier on every side of every game.

Layout: game-by-game accordion. Each game shows both sides, the head count on each, the multiplier each side will pay, and the players with their chip amounts. A player-by-player toggle presents the same data pivoted by person. **Shoves surface here and nowhere earlier** (§8) — they get a distinct treatment, they count in the head count, and they moved everyone else's multiplier (§14). The reveal is the first moment any player, commissioner included, learns a shove happened.

Since polling drives this, the reveal should feel like an event: poll every 15s for `week.phase`, and when it flips to `revealed` show a full-width interstitial before the tickets render.

### 5.5 Settled state

Per-bet outcome (won/lost/returned), the multiplier applied, chips returned and profit, the weekly net delta **including the ante** (§14 "Largest chip gain"), the pot result, and the new stack and rank.

---

## 6. Leaderboard

Interactive, sortable, with stats — per the sketch annotation.

Default sort: stack descending. Sortable on every column. Columns:

`rank · player · stack · Δ this week · bets won · bets lost · win % · pots won · weeks folded · avg multiplier · shove card`

Inline detail expansion per player showing their season chart and their last five tickets. Felt players are marked with a distinct badge (§9). Deactivated players remain listed with their final stack and a muted styling — nobody gets removed (§14).

Everything here is public, always (§11).

---

## 7. Right column

**Table Talk (league chat).** Poll every 5s for new messages; page backwards on scroll. Messages: author, timestamp, body, 2000-char cap. System messages are rendered distinctly and are posted automatically by the app for: reveal fired, shove announced, pot awarded, commissioner corrections with reason and chips (§13 — every correction posts here automatically), deactivations, mutes/unmutes when that setting is on. A muted player sees the composer replaced by `dash.tabletalk.muted_notice` with the reason and expiry, and can still read and still bet.

**News.** The player's favorite team's headlines, cross-fading one item every **5000ms** (`news.rotate_ms`), matching the sketch. Pauses on hover. Falls back to league-wide items when a team has none.

**Promo.** Hero-like box for a feature, event, or product. Content, image, and CTA come from the admin promo editor. Collapses or shows fallback copy when disabled.

**Support.** Renders `dash.support.heading`, `dash.support.body`, and a mailto with `dash.support.email` — per the sketch note, *support box provides email*. Sending goes through the player's own mail client; Resend handles anything the site sends outbound.

---

## 8. THE SETTLEMENT ENGINE — canonical

Pure functions in `lib/engine/`, no I/O, exhaustively unit-tested against the rulebook's worked examples. Everything below is normative.

### 8.1 Weekly order of operations (§14)

1. **Tuesday 6:00am ET** — slate opens; spreads frozen as shown; **the median is measured now, before antes**; the **pot places tier is snapshotted** from the active player count
2. Ante deducted from every eligible stack → Pot; **house limits computed from post-ante stacks**
3. Players submit blind; **each ticket locks on submission and no ledger entry is written** (§6). A shove ticket stores its committed stake and pending ante refund on the ticket row; neither posts yet
4. Reveal fires when the last **active** player's ticket lands, or Thursday 12:00pm ET, whichever comes first; non-submitters are folded. **Every deferred entry posts here, atomically** — this is where a shove's `ante_refund` finally hits the Pot
5. Table talk
6. Games play; bets settle **straight-up** (§1.5)
7. Unpaid remainder swept into the Pot
8. Pot awarded; standings update

Steps 1 and 2 must be idempotent. Key both on `(week_id, job_key)` with a unique constraint — a cron that fires twice must not ante the league twice, and there is no clean way to detect that after the fact.

### 8.2 The median (§14)

- Measured at slate open, **before antes come out**
- **Players on the felt are excluded**
- Deactivated players are excluded
- **Round down to the nearest 10, always** — average the middle two first when the count is even. Odd counts round too; do not special-case them
- Public

### 8.3 The ante (§2)

| Weeks | Ante |
|---|---|
| 1–4 | 10 |
| 5–9 | 15 |
| 10–14 | 20 |
| 15–18 | 30 |

Everyone pays — players, folders, and people who forgot. **Exactly two exceptions** (§2): a player who shoves that week, and a player whose stack is below one full ante. Every ante goes into the Pot.

**The felt exemption is evaluated once, at slate open, against that week's ante, before any ante is deducted** (§9). It is a single snapshot that drives three things for the whole week: the exemption itself, exclusion from the median (§8.2), and the relaxed bet rules (§8.8). Do not re-evaluate it mid-week — a player at 55 with a 30 ante counts in the median at 55, pays, and lands on the felt at 25.

**The shove exemption cannot be evaluated at deduction time**, because the ante job runs at slate open and nobody has submitted yet. It is therefore a compensating entry — **and it posts at the reveal, never at submission** (§6):

```
on shove submit   → NO ledger write. Store on the ticket:
                      tickets.committed_stake   = stackAtSubmit + ante
                      tickets.pending_refund    = ante
on reveal         → ledger: ante_refund,   +ante to player, −ante from Pot
on shove voided   → ledger: ante_recharge, −ante from player, +ante to Pot  (§8.7)
```

All three carry the week's idempotency key. **Posting the refund at submission is a blackout violation**, not an optimisation: it drops the public Pot by exactly one ante at a moment nothing else is moving, which tells the room a shove happened. The stake is fixed at submission and is what the player is committed to; only the chips wait.

### 8.4 House limit (§4)

```
limit = floorTo10( min(ownStackAfterAnte, leagueMedianBeforeAntes) / 3 )
```

**The two inputs are measured at different moments and that is intentional** (§4, "Which stack, measured when"). The median is the slate-open snapshot taken before any ante moves. Your own stack is what you hold after your ante has come out. Measuring your stack pre-ante would let a short stack bet more than a third of what it actually holds, breaking §4's core promise that the worst week costs you a third.

If the limit won't cover five bets, the player plays as many as it covers. A shove ignores the limit entirely. **On the felt, the limit is the entire stack** and the bet-size rules lift (§8.8).

### 8.5 Payout (§5)

```
with    = players on your side of THAT game
against = players on the other side of THAT game
raw     = against / with
payout  = clamp(raw, 0.25, 2.50)
if against == 0 → payout = 1.00
```

Head count includes **only players who bet that game**. Folders and skippers are invisible to the math. **`with` counts the player themselves**, which is why it can never be zero (§5). Shovers **do** count in the head count and therefore move everyone else's price (§14). A shove itself always pays exactly **1.00×**, never a multiplier.

Settlement per bet — **the winner of the game wins the bet; the spread is never consulted** (§1.5):
- **Win** → stake returned **plus** `floor(stake × payout)` profit
- **Lose** → stake gone in full, regardless of what it would have paid
- **Tie / cancelled / postponed past settlement** → stake returned, counts as neither a win nor a loss for tiebreakers (§10, §11)
- **Rescheduled to kick before the deadline** → **void, stake returned** (§10). §3 forbids betting a game that has already started, so a schedule change underneath a locked ticket takes the bet off rather than settling it. `games.void_reason = 'kicked_pre_deadline'`
- **Relocated game** → settles normally; a venue change is not a void
- **There is no push.** Because settlement ignores the spread, the only returns are the four above.

**Rounding:** every payout floors to a whole chip; the remainder joins the Pot (§14). This is what keeps conservation exact.

### 8.6 Sweep and Pot (§5, §7)

After all bets settle, any chips the table did not pay out are swept into the Pot.

**Award:** to whoever gained the most chips that week, where gain = **net stack change for the week including the ante, before the Pot is awarded** (§14).

Places paid, from `active_player_count` **snapshotted at slate open** into `weeks.places_tier_snapshot` (§7) — never recomputed at award time, so a mid-week deactivation cannot change the prize structure after tickets are locked.

```
active_player_count = players where status = 'approved'
                      -- felt players ARE counted; they are still competing
                      -- deactivated, pending, and rejected are NOT
```

| Players | Places | Split |
|---|---|---|
| 8–15 | 1 | 100 |
| 16–23 | 2 | 67 / 33 |
| 24–31 | 3 | 50 / 33 / 17 |
| 32–39 | 4 | 40 / 30 / 20 / 10 |
| 40+ | 5 | 33 / 27 / 20 / 13 / 7 |

Rules of the Pot (§7):
- **Must have submitted a live ticket to be eligible** — folders are out
- **A ticket whose bets all returned still counts.** Eligibility is `ticket exists AND NOT is_fold`, never `at least one bet settled` — a player whose only two games got cancelled did not fold
- Shovers are eligible
- If everyone lost chips, it pays by who **lost the least**
- If **every** player folded, nothing is awarded and the whole Pot rolls forward
- **Each place's share floors to a whole chip; every leftover chip rolls into next week's Pot.** This applies to the percentage split itself, not only to ties — a 240 Pot at 67/33 pays 160 and 79, and 1 rolls
- Ties for a place split that place's share evenly, rounding down; odd chips roll forward

**The marker (§7):** when the table owes more than it took in and the Pot cannot cover it, the Pot goes negative and carries. Next week's antes pay the marker down first; only the remainder is awarded. If the marker swallows the whole Pot, nobody wins one that week and the app announces it in Table Talk.

### 8.7 The shove (§8)

Once per season. One game, one side. Ignores the house limit. No other bets. Always 1.00×. Counts in the head count. Win → stack doubles. Lose → the felt. A felt player may shove their last chip if they still hold the card.

**The stake is the pre-ante stack**, fixed at submission: `committed_stake = stackAtSubmit + ante`. It is stored on the ticket and is what settles, regardless of anything that happens afterwards.

**It is not announced early, and it does not move a single chip early.** No system message, no ticker item, no chat post, no field in any pre-reveal payload — and **no ledger entry**. A shove is a pick, it is dark until `revealed_at`, and the ante refund posts with everything else at the reveal (§6, §8, §8.3). A Pot figure that dips by one ante mid-blackout is the same leak wearing a different hat. The one legal early disclosure is the player typing it into Table Talk themselves.

**If the shove's game isn't played** — cancelled, postponed past settlement, or rescheduled before the deadline — **the chips come back and so does the shove card** (§14). It didn't happen, so the ante is charged again at settlement via `ante_recharge`, and `players.shove_used_week` is cleared. Ordering at settlement: return stake → recharge ante → clear card. If the recharge would take the stack below one full ante, the player lands on the felt normally and the §8.8 floor applies.

### 8.8 The felt (§9)

A stack can never go below **1 chip** — not from a shove, not from an ante, not from the worst Sunday of a life. **That chip is debited from the Pot**, not created: a `felt_floor` entry credits the player and debits the Pot's own ledger account (§9). The Pot already absorbs rounding remainders and already tolerates going negative as a marker, so the mechanism exists and the conservation assertion in §8.12 holds without an exception.

**Felt status is evaluated once per week, at slate open, against that week's ante, pre-ante** (§9, §8.3). The tiers rise, so the same 25-chip stack is felt in Week 15 and not in Week 10. While a stack is below one full ante:

- no ante is owed
- no five-game minimum
- **bet-size rules lift**: minimum bet 1 chip, step of 1 rather than 10, no 50-chip ceiling relevance, and the house limit is the entire stack. Without this the felt is unplayable — a 1-chip stack fails every possible ticket under §3's minimums, which cannot be what §9 intends when it says *bet what you have, on whatever you want*
- **not eliminated** — nobody is ever eliminated
- excluded from the median
- still counted as one head in any game's head count, exactly like everyone else (§5 counts players, not chips)

The exemption ends the moment the stack can cover an ante again. The felt is a mercy, not a hiding place.

### 8.9 Winning and tiebreakers (§11)

Biggest stack after Week 18, **among players who are not deactivated** (§11). A deactivated player keeps their stack and their standings row but is ineligible for the championship and for every season award — they stopped paying the ante, and the ante is the clock. Render them in the final table with their stack and an *out* marker rather than dropping them.

Ties broken in order:

1. Most winning bets across the season — a winning shove counts as one; returns and voids count as neither
2. Most Pots won
3. Fewest weeks folded, auto-folds included
4. High card — one draw, publicly, no re-draws

**High card needs a real mechanism**, or it is just the commissioner texting a number and being believed. Implementation: before the draw, the app commits a SHA-256 hash of a random seed and posts it to Table Talk. The commissioner then triggers the draw; the app reveals the seed, derives each tied player's card deterministically from `seed + player_id`, and posts the result with the seed so anyone can verify the hash. One draw, recorded in `audit_log`, no re-run route exists.

### 8.10 Season close

Week 18 settles like any other week, with two additions the rulebook implies but doesn't spell out:

- **The Week 18 Pot is awarded before final standings are computed.** It can decide the championship — a 240-chip Gold-tier Pot is most of a starting stack (§7), and §7's promise that nobody is mathematically out until the final game depends on it landing before the title is called.
- **A marker outstanding at season end cannot roll forward** — there is no next week. It is written off against the Pot's own ledger account and recorded as a closing entry, and the conservation assertion accounts for it. This is rare (§7 puts markers at roughly one week in fifty-seven) but a season that ends on one must not simply fail to close.

Season transitions to `complete`, awards are computed (§8.11), all tickets remain permanently viewable (§11), and no further writes are accepted against that season.

### 8.11 Awards (§12)

Computed at season end and surfaced on a season page: The Iron Stack, The Chalk Eater, Contrarian of the Year, Best Week, Worst Shove, The Straus, The Straggler, The Mark.

Deactivated players are ineligible for all of them (§11).

Data requirements worth noting now rather than discovering in January:

- **The Straggler** needs submission *order* per week, so record `submitted_at` and rank it. **A week with no submission ranks last** (§12) — an auto-fold is the latest anyone can be, and a player who never submits is the Straggler by default. Sort nulls last, deliberately.
- **The Chalk Eater** is chip-weighted, not bet-weighted — share of chips placed on sides that paid under 1×.
- **Contrarian of the Year** counts winning bets at 2.00× or higher. **Shoves are excluded**: a shove pays exactly 1.00× and can never qualify (§12).
- **The Mark** needs a small voting UI open only to players who finished on the felt. Any player nominable, one vote each, opens at season close, runs seven days, plurality wins, **a tie means co-winners**, and no quorum is required (§12).

### 8.12 Invariants — assert after every settlement

```
sum(all stacks) + pot == 500 × count(players with a buy_in entry)
every stack >= 1
no ticket mutated after submitted_at
every ledger entry has a non-empty reason
pot >= 0 OR an explicit marker record exists
every felt_floor credit has a matching Pot debit
every ante_refund has a shove ticket in the same week
no ledger entry exists with created_at between the week's
    ante posting and its revealed_at
```

The first line counts **players who actually bought in** — approved players holding a `buy_in` entry — not everyone who ever created a row. Pending and rejected applicants hold no chips (§3.1) and must not appear in the multiplier, or the assertion fails the first time somebody applies and is turned down.

Any failure halts settlement, alerts the commissioner, and leaves the week unsettled rather than writing bad state.

---

## 9. Data model

```
players            id, clerk_user_id, phone, status, first_name, last_name,
                   email, favorite_team, profile_complete,
                   is_muted, muted_until, sms_opt_in, shove_used_week,
                   applied_at, approved_at, approved_by, joined_at
                   -- status: 'pending' | 'approved' | 'rejected' | 'deactivated'
                   --   is the single source of truth for roster state.
                   --   There is no is_active column: it was a second way to
                   --   say the same thing and the two would drift. Where the
                   --   old name is convenient, expose it as a generated
                   --   column or view: is_active := (status = 'approved')
                   -- pending players hold no chips and see nothing

seasons            id, year, status, current_week

weeks              id, season_id, number, ante, phase, opens_at, deadline_at,
                   median_snapshot, places_tier_snapshot, active_count_snapshot,
                   revealed_at, settled_at, pot_before,
                   pot_swept, pot_awarded, marker
                   -- places_tier_snapshot and active_count_snapshot are
                   --   written by slate.open and never recomputed (§7)

games              id, week_id, external_id, away_team, home_team, spread_frozen,
                   kickoff_at, on_slate, status, away_score, home_score,
                   settled, void_reason

tickets            id, week_id, player_id, submitted_at, is_fold, is_shove,
                   total_chips, committed_stake, pending_refund
                   -- immutable after submitted_at (DB trigger)
                   -- committed_stake / pending_refund exist so a shove can
                   --   be fully determined at submission while posting
                   --   nothing to the ledger until the reveal (§6, §8.3)

bets               id, ticket_id, game_id, side, chips, multiplier,
                   result, payout
                   -- immutable after parent ticket locks

ledger_entries     id, player_id null, week_id, kind, amount, reason,
                   reversal_of, idempotency_key, created_at
                   -- append-only; stacks are SUM(amount) over this table
                   -- player_id null = the Pot's own account, so the Pot
                   --   is inside the conservation assertion, not beside it
                   -- kind: buy_in | ante | ante_refund | ante_recharge |
                   --       bet_stake | bet_return | bet_payout | sweep |
                   --       pot_award | correction | reversal | marker |
                   --       felt_floor | season_close
                   -- ante_refund  : shove submitted, ante back out of Pot (§8)
                   -- ante_recharge: shove voided, ante back into Pot (§14)
                   -- felt_floor   : the §9 floor chip, debited from the Pot

pot_awards         id, week_id, player_id, place, amount
                   -- ADMIN §3 refers to this table; it is pot_awards,
                   --   not "pots"

mark_votes         id, voter_player_id, nominee_player_id, created_at
                   -- The Mark (§12); one row per voter, unique on voter

chat_messages      id, player_id, body, is_system, created_at

standings          materialised view: player, stack, rank, weekly deltas, stats
                   -- also exposes active_player_count for the current week,
                   --   defined as count(status = 'approved'): felt players
                   --   counted, deactivated players not (§7)

ticker_items       defined in ANTE-ADMIN.md §3. Player app reads only:
                   text, url, source, ordered and filtered server-side.
```

**RLS is the blackout.** `tickets` and `bets` are readable only when the parent week's `revealed_at IS NOT NULL`, or when `player_id = auth player` (your own ticket). This policy applies to the commissioner identically. `submitted_at IS NOT NULL` per player is exposed through a narrow view for the waiting-on list — that view returns names and a boolean and nothing else.

---

## 10. Edge cases the rulebook already decided

| Situation | Behaviour |
|---|---|
| Player misses Thursday noon | Auto-folded, ante still owed, no reopening (§3) |
| Injury news after the reveal | Nothing reopens, no appeal (§14) |
| Game cancelled | Chips returned; shove card returned if it was a shove (§10, §14) |
| Game postponed past settlement | Chips returned |
| Game relocated | Settles normally |
| NFL tie | Chips returned, neither win nor loss |
| Overtime | Just football |
| Player stops playing entirely | Auto-folds weekly, keeps paying antes, stays in standings (§14) |
| League drops below 8 mid-season | Season continues; no minimum to stay alive (§1) |
| Nobody bets the other side of a game | Settles at 1.00× (§5) |
| Playoffs | Not on any slate; season ends at Week 18 (§14) |
| Everyone folds a week | Pot rolls forward entirely (§7) |
| Player deactivated mid-week | Their already-submitted ticket settles normally; deactivation takes effect at the next slate open |
| Deactivated player never submits | Reveal does not wait on them (§13) |
| Player goes quiet but never quits | **Not deactivatable.** Auto-folds, keeps paying antes, stays eligible for everything (§13, §14) |
| Deactivated player has the biggest stack | Keeps the chips, keeps the standings row, **cannot win the season or any award** (§11) |
| Game rescheduled to kick before the deadline | Void, chips returned; shove card returned if it was a shove (§10) |
| Shove's game voided | Chips returned, card returned, **ante recharged** at settlement (§14) |
| Anything at all submitted during the blackout | **No ledger entry, no public number moves** until the reveal (§6) |
| Re-settlement leaves a later ticket over its limit | Ticket stands as submitted; chips settle; the §9 floor absorbs it (§13) |
| Player's whole ticket was returned games | Still Pot-eligible — submitting is not folding (§7) |
| Ante would take a stack below zero | Stack floors at 1 chip and the player is on the felt (§9) |
| Stack exactly equals the ante | Ante is paid, player lands on the felt |
| Marker outstanding at season end | Written off at close, not rolled (§8.10) |
| Tied for the championship | Tiebreakers in order, high card last, with a committed seed (§8.9) |
| Player applies after Week 1 lock | Closed-roster page; no pending record created |
| Season would start below 8 players | Transition to `active` is blocked (§1) |

---

## 11. Non-functional

- **Timezone:** all logic in `America/New_York`; display in the player's local zone with an ET label on every deadline. DST is handled by the tz database, never by offset arithmetic.
- **Polling:** `week.phase` every 15s; chat every 5s; ticker and news on their cache TTL. Back off to 60s when the tab is hidden.
- **Accessibility:** keyboard-operable bet slip, focus management on the confirm modal, `prefers-reduced-motion` honoured by ticker and news fade, contrast on the chip steppers.
- **Mobile:** the bet slip must be genuinely usable one-handed on a phone — that is where most tickets will actually be submitted, on a Wednesday night, badly.
- **No cash, ever.** Chips have no cash value (§1, Fine Print). No payment surface, no purchase, no cash-out. Keep it that way; it is what keeps this a pool and not a sportsbook.
- **The rulebook ships with the code.** `ANTE-RULEBOOK.md` lives in the repo, renders at `/rules` with its version string, and is not reachable from the content editor. Changing it requires a deploy. §13 forbids mid-season rule changes, and the only way to make that structurally true is to put the rules somewhere the commissioner cannot reach at 11pm in Week 12.

---

## 12. Suggested build order

1. Auth, profile, content-block plumbing
2. Schema + RLS + the ticket-immutability trigger + ledger projection
3. Engine as pure functions with a full unit test suite against §8
4. Sports feed ingest, slate open job, ante deduction
5. Bet slip and submission
6. Reveal job and reveal UI
7. Settlement, sweep, pot, standings
8. Leaderboard, Table Talk, news, ticker, promo, support
9. Admin console (`ANTE-ADMIN.md`)
10. SMS notifications
11. Awards and season close

Steps 2 and 3 are the ones worth over-engineering. Everything else is recoverable.
