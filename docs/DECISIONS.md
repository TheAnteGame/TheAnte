# ANTE — Decisions Log

Referenced by `.env.example` and the build specs in `docs/build spec/`. Where a decision
here postdates and contradicts a spec, this file wins; everything else defers to the
authority chain (rulebook → build specs → art direction → tech spec).

## D-001 — Auth and notification channels (2026-08-17, supersedes earlier draft)

**Login: Clerk phone OTP.** As specced in ANTE-TECH §3.2 — phone number, six-digit code,
no passwords anywhere. Clerk sends its own OTP SMS; this does not require Twilio.

**Notifications and marketing: email via Resend, season one.** All league events in
ANTE-ADMIN §4.7 (slate open, reminder, final call, nudge, reveal, settled, pot awarded,
correction) send as email, not SMS.

**Twilio SMS: deferred, placeholder required.** There is no time to clear A2P 10DLC
registration before the 2026 season starts. SMS may come later if signups justify it.
The build must keep the door open at zero cost:

- `lib/notify/` exposes the `Notifier` interface with `channel: 'sms' | 'email'` exactly
  as specced. The email implementation is real (Resend); the SMS implementation is a stub
  that logs to `notification_log` with status `'channel_disabled'` and sends nothing.
- Every §4.7 event keeps its per-event channel setting in admin, with SMS options visible
  but disabled and labelled "SMS pending carrier approval."
- `sms_opt_in`, quiet hours, and the STOP-webhook column stay in the schema unused.
- The Twilio env vars stay in `.env.example`, commented out, with this decision referenced.

**Reminder for later:** enabling SMS = register A2P 10DLC brand + campaign in Twilio,
add the three TWILIO_ env vars, replace the stub in `lib/notify/sms.ts`, flip the admin
channel toggles. Nothing else should need to change.

## D-005 — Sports data (2026-08-17, resolves .env.example vs ANTE-TECH §3.1)

**nflverse `games.csv` for schedule + frozen spreads; ESPN public scoreboard for live
status and finals** — exactly as ANTE-TECH §3.1 decided, joined on nflverse's `espn`
column. Chosen over the ESPN + The Odds API split on the owner's criterion of "most
consistent, least likely to break or deny access": nflverse and ESPN need no API key and
have no quota to be denied against; The Odds API's free tier is quota-limited, which is
a denial-of-access risk on the one field (the spread) that is cosmetic anyway.

`ODDS_API_KEY` is removed from `.env.example`. SportsDataIO remains the documented,
unimplemented paid fallback behind the `lib/sports/` adapter.

## D-006 — Display typography (2026-08-17, closes ANTE-TECH open decision #2)

**Google Fonts only, self-hosted via `next/font`. No commercial license.**
Direction per art direction §4: an angular, wide, heavy display face that rhymes with the
chiseled wordmark — Chakra Petch and Archivo (expanded widths) are the named candidates;
final pairing chosen during the design build. Body stays a neutral grotesque; all numerals
tabular lining figures.

## D-007 — A second "loud zone": stakes band, wager area, and how-to-play (2026-08-18)

**Amendment to ANTE-ART-DIRECTION.md §2/§8/§10.** The art direction's original rule —
motion and tier-color intensity confined to the reveal, everything else restrained — is
confirmed amended by the owner. The stakes band, the wager/bet-slip area, and the new
how-to-play tutorial (`app/how-to-play`) are now a second, deliberate "loud zone": richer
chip/felt texture, glow, gold-accent motion, and playful micro-animation are in scope
there. Every dense data surface — the leaderboard, the ledger, settlement tables, and all
of `/admin` — stays exactly as restrained as §7/§10 already specify; this amendment does
not touch them.

## D-008 — Material and light: the table under the interface (2026-08-21)

**Amendment to ANTE-ART-DIRECTION.md §5/§7.** The owner's call: the player interface
read as a dark admin panel rather than a card room. The cause was not the palette or the
layout — both stay exactly as specified — but that the app had quietly opted out of its
own art direction. Facets were a 45° striped gradient, chrome was a text colour rather
than a material, the canvas was a flat void, panels were 1px outlines, and nothing on
screen honoured the "lit from the upper left" rule §5 already required. This decision
adds **material and light**; it adds no hue, no font, and no layout.

- **The table.** The canvas carries a photographic felt ground and one fixed pool of
  house light. Both layers are fixed, so the table stays put while the page scrolls.
- **Panels are milled plates.** `.panel` / `.panel-head` replace the hairline outlines:
  a lit top-left edge, a shadow cast down and right, and a gold hairline closing each
  heading strip. Neutral throughout — this is the 90% quiet §5 asks for.
- **Chrome is a material.** `.chrome-face` renders primary actions as polished steel
  with a hard highlight-to-shadow break, per §3.0's "chrome for every interactive
  element." Disabled reads as an unmilled blank, not a faded button.
- **Real facets.** `components/ui/Facets.tsx` cuts the irregular triangular flat planes
  §5 actually specifies, quantised to five tones and shaded from a single upper-left
  light. Used only where §5 permits: the stakes band and the homepage.
- **Figures sit in trays.** `.well` recesses every number on a tier plane, which is what
  keeps small white labels above 4.5:1 over any of the four gems. The Pot's tray is
  rimmed in gold — the house's own material, on the rim rather than the fill, because a
  gold fill lifts the plate and drops the 10px label below the contrast floor.
- **The chip is a physical object.** Clay body, moulded edge spots, a recessed inlay and
  one specular arc, at the same light angle as everything else.
- **Browser surfaces are themed** — selection, caret, focus ring, scrollbars.

**Two generated textures ship** in `public/tex/` (felt, brushed metal), each used under
12% opacity as grain rather than imagery; the design is fully legible if neither loads.
A third (gold leaf) was generated and discarded because no contrast-safe use survived.

**What is explicitly unchanged.** The layout (`ANTE-PLAYER.md` §4), every content block,
the token palette, the blackout constraints in §9, and the restraint boundary from D-007:
the leaderboard, settlement tables, the ledger and all of `/admin` get the shared neutral
plate and nothing else — no facets, no tier colour, no motion.

## D-009 — The stake ladder replaces the chip steppers (2026-08-21)

**Amends ANTE-PLAYER §5.2 and the stepper reference in D-007/ANTE-ART-DIRECTION §8.**
The owner's call: the +/− chip steppers were both ugly and confusing — a control parked
off to the side of the row, operating on a pick made somewhere else.

**The slate now centres the game and faces the two sides across it.** Backing a team is
one press on the team itself. Each further press raises the stake one rung; one press
past the top takes the bet back off the table. There is no separate stepper, and the
chips sit on the side you backed, which is where a player would actually push them.

- **The ladder is the existing rules, drawn.** Off the felt that is exactly 10/20/30/40/50
  — the `step`/`maxChips` rules already in force, which happen to give precisely five
  rungs and a sixth press that clears. On the felt (`step` 1, limit = whole stack) the
  same five rungs are derived across the player's range in whole chips, ending exactly on
  the limit; a one-chip stack collapses to a single rung. No staking rule changed, and
  `submit_ticket` re-validates everything regardless.
- **Raising is capped by the room.** A rung that would breach the house limit clamps to
  what is left; if there is nothing left to raise, the next press clears the bet.
- **Five rungs are drawn as pips** on the backed side, so the reset is visible before it
  happens rather than being a surprise.
- **Chips are larger (44px) and better defined** — the chip's cast shadow was a centred
  halo that washed out the chip beneath it in a stack, so a stack read as one smudge.
- `dash.wager.raise_hint` is a new content block, commissioner-editable like every other
  string, carrying the top-of-ladder figure as `{max}`.

**Also in this pass:** the dashboard masthead (rail + ticker) is constrained to the same
`max-w-6xl` column as the rest of the page instead of running full-bleed; the logo is 25%
larger on desktop only; and the ticker no longer pauses under the cursor.

## D-010 — News sources, the Game Board, and the how-to-play split (2026-08-21)

**1. The news feed had no sources.** `feeds.sync` (ANTE-ADMIN §5), the ticker projection
and the Fav Team News box all shipped complete and correct, but `feed_sources` was empty,
so every player's news box rendered the "quiet day" empty state permanently. Migration
`0013` seeds it: one first-party club RSS feed per team (32) plus two league wires for the
ticker (ESPN, CBS Sports). Keyless and quota-free, on D-005's criterion — least likely to
break or deny access. **Google News RSS was rejected**: its feed terms limit use to
personal, non-commercial reading, which this is not. First sync ingested 722 items with
zero source errors and all 32 teams covered; `ante-feeds-sync` re-runs every 15 minutes.

**2. The wager slot is the Game Board.** It now carries a real section title like Table
Talk instead of opening on an unlabelled stats strip, and the strip is subordinate to it.
`dash.wager.heading` changes from "This week" to "Game Board". **"The Felt" was rejected
as the name** — in the rulebook being *on the felt* means broke (§9), so naming the whole
surface that would collide with a real game state.

**3. Point spreads moved under the team names.** Each side now carries its own line
(`−3.5` / `+3.5`) so the favourite is readable without parsing a sentence; the centre
column no longer repeats it. Positive `spread_frozen` = home favoured (ANTE-TECH §3.1).

**4. Chips fan out where there is room.** The stack stays vertical on a phone, where a
narrow button has height to spare, and lays out horizontally from `sm` up, where the row
has width instead.

**5. The two commitment controls explain themselves.** "Push your chips in" and "The
shove" carry hover/focus tooltips (`dash.wager.submit_tooltip`, `dash.wager.shove_tooltip`).

**6. How-to-play is now two things.** `/how-to-play` remains the mandatory interactive
gate. `/guide` is new: the written version, plain language, every string content-managed
under `guide.*`, with the rulebook still named as the authority where they differ. Both are
reachable from two small links above the account row in the dashboard header, and the
tutorial replays via `/how-to-play?replay=1` — allowed only for a player whose route is
already `/dashboard`, so nobody mid-onboarding can skip their real gate.

**7. The empty promo slot renders nothing.** It used to fall back to the wordmark in a
chamfered panel, which read as a stray button with no explanation. ADMIN §4.6's fallback
heading is dropped; the commissioner manages the slot from the console, so it never needed
a placeholder on the player's dashboard.

**8. The masthead is transparent.** `.rail` has no plate of its own — the table shows
through, and one gold hairline separates the masthead from the page.

## D-011 — A ticker console, a legible content editor, and the news source line (2026-08-21)

**1. The ticker gets its own console page.** `/admin/ticker` now owns the rail: an
on/off switch, a **crawl-speed slider** (`ticker.speed_seconds`, 15–180s per pass, default
40 — the CSS animation duration is now a variable), **two colour choices**
(`ticker.accent_color` for generated league facts, `ticker.text_color` for posts and
headlines), the cap on lines shown, the six generated-line toggles shown with the sentence
each will actually produce, a composer, and the live list of lines with a Remove control.

**Colours are a closed set** drawn from the token palette, not a free-form picker: the rail
is still part of the product (art §3.2). **Remove hides rather than deletes** — nothing in
this product is ever deleted (rulebook §14), so a pulled line stays in the record.
`app_settings` has no write policy by design, so the action writes service-role, past the
commissioner check (ANTE-TECH §4.3).

**2. The content editor is readable.** It was a wall of one-line fields labelled only by
code key. It now carries a **jump menu**, every namespace is titled in plain English with a
line saying which screen it belongs to (`lib/content/groups.ts` — e.g. `band` is "Stakes
band: the big coloured bar across the top of the dashboard"), and the fields are
**full-width, multi-line and resizable**, sized to their content. The keys themselves are
untouched: they are how the code finds a string.

**3. Fav Team News carries its source.** The box is a **fixed three headline lines tall**,
so the right column stops resizing every rotation, and the source name now travels with
each item from `feed_sources` and renders under the headline as a link that opens in a new
tab (`dash.news.source_label`).

**4. Chips match the rung.** The stack draws one chip per press — five presses, five chips
— instead of deriving a count from the amount, which topped out at four. Overlap increased
so a stack reads as chips rather than one shape.

**5. Point spreads stay point spreads.** Raised as a question: `−3.5` is not the `+180 /
−200` most people picture. Those are American moneyline odds, which state a payout. **ANTE
never pays by odds** — rulebook §5 pays *players against you ÷ players with you*, capped
0.25×–2.50×, and bets settle straight-up. Printing a moneyline would advertise a payout the
game does not offer, and the real multiplier cannot be shown pre-reveal because pick
distribution is blackout-protected (§6). The spread is the only legitimate pre-reveal
signal, so it stays, unchanged, pending the owner's call.

**6. Found: `support@theantegame.com` cannot receive mail.** The domain has **no MX
records** — outbound is fully configured (Resend SPF + DKIM on `send.theantegame.com`) but
nothing accepts inbound, so anything a player sends to the support address bounces. There is
also no `_dmarc` record. Not fixed here: it needs a mailbox or forwarder plus DNS, which is
the owner's to set up.

## D-012 — Support moves in-app; the stakes band sticks (2026-08-21)

**1. The support desk is on the platform.** The mailto: link pointed at a domain with
no MX records, so every message a player sent bounced (D-011 §6). Replaced end to end:

- The player presses **Message the desk** and gets a dialog with one field. We already
  know who is asking, so there is no name or email to fill in.
- The confirmation states plainly that **the reply arrives by email**, at the owner's
  instruction — a player should never have to check back to find out if they were answered.
- The ticket lands in `support_messages` (migration `0014`), inserted as the player under
  an RLS policy that lets them write and read only their own.
- The commissioner is **emailed that a message is waiting**, via the existing Resend
  notifier. That send is best-effort and wrapped: a failed notification must never lose a
  message that is already stored.
- **`/admin/support`** lists tickets, open ones first, and the reply goes back out by
  email — the only path that keeps the promise the confirmation made. Answered tickets
  stay on the page; nothing is ever deleted (§14).
- `dash.support.email` is removed rather than left dead in the content console.

**One change to the notifier.** `emailPlayer` refuses a body containing `{`, on the
assumption an unfilled brace means a broken template. A support ticket is free text a
player wrote and may legitimately contain braces, so an opt-in `allowFreeText` checks the
*template's* placeholders instead of scanning the filled body. Nothing else uses it, and
the blackout fence is unaffected — support carries no pick data in either direction.

**2. The stakes band sticks on desktop.** From 900px up the band pins to the top of the
viewport and the page scrolls under it. The bet slip's header strip becomes a **running
tally** — `Committed / limit`, Remaining, Games, and a fill bar — and pins directly beneath
it. The ante, house limit and deadline were showing in both places; they now live only on
the band, which is what makes the second bar short enough to stack.

**The offset is measured, not guessed.** `BandOffset` reads the band's height into
`--band-h` with a `ResizeObserver`; a hardcoded value opens a gap or an overlap the moment
a tier label or the deadline wraps. Below 900px neither element sticks — the band is above
the slip anyway, so a phone loses nothing and gains its screen back.

## D-013 — Table Talk sizing, a live-chat tell, and homepage weight (2026-08-21)

**1. Table Talk grows, then scrolls.** The panel was capped at 384px whatever the
traffic. It now runs `min-h 144px` to `max-h 512px` — roughly a dozen messages before the
scrollbar appears — so a quiet room still reads as a panel and a busy one keeps its history
reachable without taking the column.

**2. The composer announces itself.** Players were not registering that the room is live.
The field now carries a gold label ("Chat with the league" — `dash.tabletalk.live_label`),
a pulsing light, and a shine crossing the field every 4.5s. **This amends
ANTE-ART-DIRECTION §8**, which lists chat under "not worth animating": the owner's call is
that a live room has to look live. The rest of Table Talk stays still — this is two small
loops on one control, not motion on the message list.

The shine sits in its own clipping layer rather than on a wrapper around the input; clipping
the input would cut off its focus outline. Both animations stop under `prefers-reduced-motion`.

**3. Homepage weight, measured rather than guessed.** Server time was never the problem —
dev and production both answer in ~110–170ms. The page was simply heavy:

- **Chakra Petch shipped weight 500 on every page and nothing used it.** Only 600 and 700
  appear in the codebase. Dropping it removes a font file from every route.
- **The facet field was 120 paths at one decimal place** — 12.4KB of a 46.6KB homepage. The
  field renders with `preserveAspectRatio="none"`, so a tenth of a viewBox unit is invisible:
  coordinates are now integers, and the homepage uses larger planes (9×5 rather than 11×7),
  which suits a poster better anyway.

Result: **HTML 46.6KB → 30.3KB (−35%)**, one fewer font file, load event **319ms** with
DOM ready at 260ms on a production build. The remaining cost is Clerk's own script and its
two API calls, which the sign-in genuinely needs.

**Note for the owner:** the perceived slowness was not the dev server — it measures the
same. It was page weight and third-party auth, and the first of those is now fixed.

## D-014 — Moneyline alongside the spread; the live tell is first-run only (2026-08-21)

**1. Both numbers, from a real source.** The owner's call, after D-011 §5 raised the
distinction: each side now shows its **frozen point spread and its frozen American
moneyline** (`−3.5 · −180`). The moneylines are **ingested from nflverse's own
`away_moneyline` / `home_moneyline` columns** (migration `0015`), frozen at slate open
exactly like the spread. Nothing is derived: a game without a published moneyline shows
its spread alone rather than a converted guess.

**They remain context and nothing else.** ANTE pays by the room's split (rulebook §5),
never by odds, so `dash.wager.spread_note` was rewritten to say so in as many words:
"Neither one pays here: bets settle straight-up, and what you win is set by how the room
split." Displaying a moneyline without that sentence would advertise a payout the game
does not offer.

The already-open Week 1 was backfilled from nflverse (16/16 games); every future week gets
them at slate open.

**2. The live-chat tell is a first-run tell.** The gold label, the pulsing light and the
shine (D-013) now show only to a player who has **never posted**. One message and the
composer goes quiet permanently — the point was to teach that the room is live, and it
stops being information the moment it has been learned.

**3. The guide answers "who wins the Pot".** The owner predicted this would be the main
point of confusion, and it is a fair one: the ante pool and the bet-to-bet chip movement
are two separate flows. `/guide` gains a section — *"Your bets and the Pot are two
different things"* — and the Pot section now states who wins it, that folding forfeits it,
that the ante counts inside your weekly gain, and that a full-league fold rolls the Pot.

## D-015 — Backups, on a database that had none (2026-08-21)

**The finding first.** The Supabase org is on the **free plan**: no automated backups,
no point-in-time recovery, and projects pause after inactivity. An 18-week season whose
central invariant is that chips are exactly conserved and nothing is ever deleted was
running with no floor underneath it. **Upgrading to Pro ($25/mo, daily backups with 7-day
retention, PITR available as an add-on) is the single highest-value change available and
is the owner's to make** — everything below is what the application can do regardless.

**Two jobs, deliberately not conflated.** Conflating them is how people end up believing
they have a backup when they do not:

- **Snapshots** (`league_snapshots`, migration `0016`) live in the same database they
  protect. They defend against a **bad write** — a settlement that came out wrong — and
  one is taken automatically before every operation that can rewrite chips: manual
  settlement, re-settlement, a forced reveal, and season close. Plus on demand, with a
  typed reason. Only the 20 most recent are kept.
- **The download** (`/admin/backup/download`) is a single timestamped JSON file on the
  commissioner's own disk. It is the **only** thing that protects against losing the
  project, and the console says so in those words.

**What is in the file.** Twenty-two tables: roster, season, weeks, games, tickets, bets,
the ledger, pot awards, chat, moderation, support, audit, notifications, content and its
revisions, settings, feed sources and ticker. **`feed_items` and `job_runs` are excluded** —
743 and 3,024 rows respectively, both of which refill or regrow on their own and would
bloat the file without protecting anything. The whole league record is currently a few
hundred KB and will stay small.

**Self-checking.** Every snapshot records the ledger's chip total, so a file can be
verified against the conservation invariant rather than trusted.

**No wholesale restore, on purpose.** For the likeliest failure — a settlement that came
out wrong — restore is the wrong instrument: the ledger is append-only and `resettle`
plus a public correction (§13) is the designed path, which preserves the record of what
happened. A bespoke importer over a live schema with foreign keys is where new data-loss
bugs get made, and overwriting would erase the audit trail that "nothing is ever deleted"
rests on. Catastrophic loss is what the downloaded file and (once on Pro) Supabase's own
restore are for.

**A pre-flight caught a real bug:** `week_players` has a composite key and no `id` column,
so its paged read would have sheared. Sort keys are now per-table and composite where the
table is.

## D-016 — The tutorial is five steps, and it teaches the strategy (2026-08-21)

**Ten steps was too many, and one of them was wrong.** The gate tutorial still drove a
`+ / −` chip stepper — a control D-009 removed from the real bet slip. A tutorial that
teaches a control the product no longer has is worse than no tutorial, so the mock board
now mirrors the real one exactly: press a team to back it, press again to raise, one press
past the top clears.

**The new five:**

1. **Everyone starts even** — 500 chips, the ante, biggest stack on the last Sunday.
2. **Press a team to back it** — they actually do it; the step will not advance until they have.
3. **Here is the real game** — the step that was missing. Payout is *players against you ÷
   players with you*: back the crowd and win almost nothing, be alone and right and take
   2.5×. So hunt the game where the room is wrong, not the safe pick.
4. **Nobody sees a thing until everyone is in** — the blackout, then the reveal, with a
   sample card showing 2 players at 2.5× against 6 at 0.33× so the arithmetic lands.
5. **The Pot goes to the biggest week** — all the antes, to whoever gained the most.

The house limit, the Thursday deadline, the shove and settlement mechanics move to
`/guide`, which is linked from the dashboard header and can be read at leisure. Twenty-one
now-orphaned `howto.*` content keys were deleted rather than left dead in the console.

**`/guide` gained a strategy section too** — *"How to actually win"* — covering the same
ground at more length, plus the earlier *"Your bets and the Pot are two different things"*.
Between them the two surfaces now answer the question the owner predicted would be the
league's main point of confusion: the ante pool and bet-to-bet chip movement are two
separate flows, and the multipliers are how you win the first one.

## D-017 — Staying on the free plan, deliberately (2026-08-21)

**The owner declined Supabase Pro for now**, reasonably: eight players, week zero, and
$25/mo is a real cost against a league that may not gel. Revisit around week 2–3 if it
does. That decision makes the downloaded file the *only* copy of the league that survives
losing the project, so the app now treats taking one as an operational duty rather than
an option.

**A backup nobody remembers to take is not a backup.** `backup.reminder` (cron `0017`,
daily at 13:00 UTC) emails the commissioner every day from the moment a download is
overdue until they press **"I've got the file"** on the backups page, which stamps
`backup.last_confirmed_at` and stops the nag until the next one is due
(`backup.remind_after_days`, default 7). Confirming is the whole mechanism: the app
cannot see the commissioner's disk, only their word for it — and the page says so.

**Restore is a command-line tool, not a button.** `npm run db:restore -- <file> --confirm`
(`scripts/restore.mts`). It is for a **fresh, empty database** — a new Supabase project, or
one whose schema has just been rebuilt from `supabase/migrations/`. Guards, in order:
refuses without `--confirm`; refuses if the target already holds players unless `--force`;
loads parents before children; relinks `players.approved_by` in a second pass because it
points back at players; drops `ticker_items.feed_item_id` when the headline is not in the
file (headlines are excluded because they re-ingest themselves); and finally **verifies the
restored ledger against the chip total recorded in the file**, failing loudly on a
mismatch. A dry run prints what it would do and writes nothing.

**It is still not the tool for a bad reveal.** Re-settling from the console corrects the
numbers *and* keeps the record of what happened; a restore would erase it.

**Validated end to end against the live database**, not just typechecked: all 22 tables
read cleanly (including `week_players`, whose composite key had no `id` column), a real
file was produced, the dry run parsed it, and the guard correctly refused to overwrite
8 live players. The file's chip total came out at exactly 4,000 — 8 players × 500 — so
the conservation invariant checks out.

**Also fixed: the tutorial's step chips were being sliced.** `chamfer` is a `clip-path`,
and a clip-path clips absolutely positioned children too, so both numbered chips were cut
against their own border. They are now siblings of the clipped box rather than children of
it. Verified in the DOM: zero clipping ancestors.

### D-017 amendment — file verification and the download cadence (2026-08-21)

**`--verify` proves a file with no database involved.** `npm run db:restore -- <file>
--verify` checks that every expected table is present, that the ledger rows sum to the
chip total recorded in the file, and that no row points at a parent missing from the same
file. Confirmed against a deliberately corrupted copy: it caught the dropped table, the
480-chip ledger shortfall, and the orphaned chat row. Run it on a fresh download and the
copy is proven rather than assumed.

**Cadence: twice a week**, and the backups page now says so rather than leaving it to
judgement. Thursday after the reveal fires — the week's tickets are locked and cannot be
reconstructed from anything else — and Tuesday morning after settlement, before the new
slate opens. `backup.remind_after_days` set to **3** to match; a weekly threshold would
never notice a missed reveal-day download.

**Known gap, stated plainly:** the restore's write path has been dry-run and guard-tested
but never run to completion against a real empty database. Until it has, it is a tested
design and an untested execution.

## D-018 — One promo URL could take the dashboard down (2026-08-21)

**Found in use, not in review.** Setting a promo image threw a runtime error that
crashed the entire dashboard — not a broken image, the whole page, for every player:

> Invalid src prop … hostname "bransonrestaurants.com" is not configured under images
> in your `next.config.js`

`next/image` refuses any remote hostname not allowlisted in `next.config.ts`. The promo
image URL is whatever the commissioner pastes, so **no allowlist can ever be right** —
and the failure mode was a hard crash rather than a missing picture.

**Fixed by dropping `next/image` for this one element.** The promo image is now a plain
`<img>`. Allowlisting `**` would have stopped the crash but turned the deployment into an
open image proxy: anyone able to call `/_next/image?url=…` could push arbitrary remote
fetches through the server. A single banner capped at 160px tall does not justify that,
and does not need the optimizer.

**And it can no longer crash at all.** The URL is parsed before it is rendered; anything
that is not http(s) is skipped and the rest of the box still shows. Verified both ways
against the live content: the real URL renders an `<img>`, and a deliberately malformed
value produced HTTP 200, zero runtime errors, no `<img>`, and the heading and body intact.
The CTA link is validated the same way and now carries `target="_blank" rel="noreferrer"`.

**The console shows the box before players do.** `/admin/promo` renders the real
`PromoBox` underneath the form as a live preview, warns when the image URL is unusable,
and says plainly when an empty heading means the box will not appear at all.

### D-018 amendment — /rules is not built (2026-08-21)

Production smoke test after the first push caught a live 404: `/guide` carried a
"Read the full rulebook" button pointing at `/rules`, and **that route does not exist**.
It is listed in `proxy.ts`'s public matcher and the content console explains its absence
("it renders from the versioned repo file"), but the page was never built — the rulebook
still lives only at `docs/build spec/ANTE-RULEBOOK.md`.

The link is removed rather than left pointing at nothing, along with its now-orphaned
`guide.rules_cta` key. **Building `/rules` remains outstanding**: it needs the rulebook
rendered from a versioned file, which means a markdown renderer this project does not yet
depend on. `rules.intro` (the one editable line, guarded in `saveContent`) is already
reserved for it.

## D-019 — @mentions, a cleared table, and a restore that could not restore bets (2026-08-21)

**1. The restore drill found a real, silent hole.** A scratch Supabase project
(`TheAnte-Staging`, free tier) was stood up to run the restore for real rather than in
theory. The `0002` guards fire for the service role too — deliberately (ANTE-TECH §4.1) —
and one of them, **`bets_with_ticket_only`, requires a bet to be inserted in the same
transaction as its ticket**. A restore writes tickets, commits, then writes bets, so
**every bet row would have been rejected**. Production holds zero bets today, so the tool
would have looked healthy right up until the first real week and then failed exactly when
it was needed.

**Fixed by loading through Postgres directly** instead of the REST API. The restore now
runs as **one transaction** with `session_replication_role = replica` — the standard way
to load a dump: triggers and FK checks stand down for the load and are back at COMMIT.
It all lands or none of it does, and a chip-total mismatch rolls the whole thing back.
Confirmed on the scratch project in three steps: the guard rejected the bet, the same
insert succeeded under `replica`, and the guard rejected it again after commit.

This is the difference between a tested design and a tested execution, and it is why the
drill was worth doing before Week 1 rather than during it.

**2. Table Talk cleared of pre-season test chatter.** Twelve junk messages removed;
the one real system announcement kept. `chat_messages` carries the same append-only guard,
so this needed the same deliberate stand-down — **and the guard was verified back on
afterwards** by attempting a delete and being refused. Hiding was rejected as the
mechanism: hidden messages render as tombstones, and twelve "message removed" lines is a
worse first impression than the test data was.

**3. @mentions (`lib/chat/mentions.ts`).** Typing `@` in the composer opens the roster;
picking a name inserts a handle; the posted message highlights it; and the player named
gets an email. Handles are **derived, never stored** — first name where it is unique,
first name plus last initial where it is not — by one function shared between the picker,
the renderer and the notifier, so what you clicked, what you see, and who is told cannot
disagree. Capped at five per message: a mail storm is not engagement. Names are public
(§11 — the blackout covers picks, not people), so nothing here can leak a pick.
Fourteen unit tests cover the handle collisions, prefix matching, punctuation, and
round-tripping a body through the renderer.

**4. Promo cleaned.** The owner's real heading and body kept verbatim; the test
restaurant image and the placeholder "CTA Label" cleared.

## D-020 — A player who joins after the slate opens could not play (2026-08-21)

**Reported from a real signup.** A player admitted after Week 1's slate opened saw
"The slate opens Tuesday at 6:00am ET" on the Game Board while everyone else was betting,
and sat in the standings on 500 chips at Δ+0 while the rest showed 490 at −10.

**Two things were missing, not one.** `approvePlayer` credits the 500-chip buy-in and
stops there. `slate.open` is what writes a player's `week_players` row — their felt status
and house limit for the week — and posts their ante. A player approved *after* slate open
therefore had no snapshot, and `WagerArea` treats a missing snapshot as "closed".

**This contradicted the rulebook, not just the UX.** §1: *"The roster locks at the Week 1
deadline."* `admissionOpen` already implements that correctly — approvals are allowed right
up to `week1_lock_at` — so admitting someone mid-week is legitimate and they are meant to
play that week. The gap was that nothing then admitted them *to the week*.

`approvePlayer` and `reactivatePlayer` now call `admitToOpenWeek`, which posts the ante and
writes the snapshot using the engine's own `houseLimit` and `isFelt` rather than
re-deriving the rule. The week's median, active count and places tier are **left exactly as
snapshotted at slate open** — those are fixed for the week (§7). Past the deadline it does
nothing: charging an ante for a week they could never have bet would take chips for nothing.

**The Pot side needed its own idempotency key.** `slate.open` writes one aggregated Pot row
per week under `open:ante:pot`. Reusing that key for a late admission would have been
rejected by the unique index as a duplicate — **charging the player while the Pot went
uncredited, breaking chip conservation**. Late admissions use
`admit:ante:pot:<playerId>`; the player side keeps `open:ante`, so a later `slate.open`
retry still cannot ante them twice.

**Backfilled the affected player.** Conservation verified across the change: league total
4,500 before and after, Pot 80 → 90, the player 500 → 490, house limit 160 matching every
peer, and all nine approved players now hold a Week 1 snapshot.

## D-021 — The reveal told the room a shove paid the fade price (2026-08-21)

**Found by previewing the reveal before the league sees it**, which is exactly what the
preview was for. Driving the real `RevealExperience` with a realistic Week 1 — the actual
15-game slate, the actual nine players, one shove, one fold — put a 490-chip shove on the
board at **2.50×**.

**§8 is unambiguous: a shove always pays even money — 1×, no multiplier, ever.** The shove
beat directly above it even said "even money" in the same breath, so the screen contradicted
itself.

**The chips were never at risk.** `settleWeek` has always paid a shove `{num: 1, den: 1}`,
and `tests/engine/settle.test.ts` covers it explicitly — *"a winning shove doubles the
pre-ante stack at exactly 1× — never the fade price."* This was `RevealBoard` assembling
the by-player view from the crowd price on that side, which is correct for everyone else
and wrong for the shover: they **move** the price (§14) but do not ride it.

Left alone it would have shown a 490 shove as paying 1,225 on the product's most dramatic
screen, for the days between the reveal and settlement — and then paid 490. That is the
precise kind of argument the rulebook exists to prevent.

**The by-game view was already right** and needs no change: the side price is what the
other players collect, and the shover's entry is already marked in gold with the SHOVE
label.

**A note on the preview harness.** It reproduces `RevealBoard`'s assembly rather than
importing it (that assembly lives inside a server component that queries the database), so
it carried its own copy of the same bug and had to be fixed in both places. The harness is
**deliberately never committed**: it renders fabricated tickets against real player names,
which on a public URL would read as leaked picks.

## D-022 — Results page, live season tendencies, and League Stats (2026-08-21)

**1. The reveal moved out of the 62% column.** The board is fifteen games wide with two
sides and every player's chips; it never fitted beside Table Talk. The Game Board slot now
shows the ambush — a gold **"The room is open"** card — and the whole sequence, interstitial
and shove beat included, plays at full width on **`/results/[week]`**. The card, not the
page, is the moment; splitting one beat across two pages would have cost the drama that §7
says to spend the budget on.

**2. Results is a header link, and it never lands empty.** It resolves to the most recent
**revealed** week, never the current one — during the blackout the live week has no results,
and a link that dead-ends every Tuesday to Thursday reads as broken.

**3. Season tendencies reuse the awards, they do not invent statistics.** The owner asked
for insight into who bets what and how consistently. `lib/engine/awards.ts` already computes
exactly that, because the **season awards** (§12) are built on it: the Chalk Eater's share
of chips on the popular side, the Contrarian's wins at 2.00× or better, best week, folds.
Those are now computed live from Week 1 (`lib/stats/league.ts`) and shown as a **By season**
view beside By game and By player.

Surfacing the awards rather than inventing metrics means a player sees all season exactly
what they are being judged on at the end of it, in the rulebook's own vocabulary. The
table answers the question the game actually turns on: who fades the room and who rides it.

**4. League Stats sits between Table Talk and Your Team.** Four figures: biggest week, best
price cashed, coldest take, hot hand.

**Two constraints shaped it.** It reads **settled weeks only**, so it sits perfectly still
between the ante and the reveal (§6) — the same rule the standings view follows. And the
unflattering stat is aimed at the **matchup, not a player**: the owner suggested a weekly
"biggest loser", but §9 is deliberate that nobody is eliminated and the felt is a badge, so
a named weekly loser is the one thing on this dashboard that could make somebody quit.
"Coldest take" names the team the most people lost on, which is funnier and costs nobody.

**A note on a latent trap.** `RevealBoard` builds its copy object through
`Object.fromEntries(...) as unknown as RevealData["copy"]`. That cast means a missing content
key type-checks and then renders `undefined` on the page — adding the season labels was
silently incomplete until caught by hand. The list is now the only guard and is commented
as such.

## D-023 — A commissioner correction silently drained the Pot (2026-08-21)

**Found by running the season torture test**, which had never been run: it needs a local
Supabase stack and Docker was not up. With Docker running and the images cached it takes
**5.7 seconds** — 25 players, 18 weeks, real RLS, real jobs.

**It passed, and it was hiding a serious bug.** The test re-settles weeks 5–8 **with no
data changed** — no corrected score, no edited game — and asserted only that total chips
were conserved. Total conservation held at 12,500 throughout. The Pot went from **−367 to
−8,773**, and ten of twenty-five stacks moved, on a replay that should have changed
nothing. The Pot absorbing the difference is exactly why the total still balanced and the
suite stayed green.

Left in, any use of the commissioner's correction power (§13) would have moved thousands
of chips out of the Pot. The Pot funds the weekly prize, so the practical effect is
**nobody wins a Pot for the rest of the season** — while every screen still reconciles.

**Two causes, both about replaying history against the present.**

1. **Ordering.** Re-settlement reversed *every* week's settlement up front and only then
   replayed. Reversing weeks 6–8 returned their swept chips to the Pot before week 5
   replayed, so week 5 awarded a Pot holding three later weeks' money: −3,842 became
   −11,783. Reversing and replaying now interleave, one week at a time, in order.

2. **Scope.** `stacksByPlayer` sums the whole ledger, so a replayed week read stacks and a
   Pot balance from weeks that had not happened yet. It now takes an optional `asOfWeek`
   and settlement passes the week being settled. Forward settlement is unaffected — later
   weeks do not exist — but a replay now sees exactly the state it saw the first time.

**The assertion that was missing is now in the test:** a re-settlement with identical
inputs must leave the Pot and every stack untouched. Total conservation alone cannot see
this class of bug.

**Result:** `pot −367 → −367, 0 stacks moved`, and the simulated season ends at **pot = 1**
rather than **−5,995**. That also brings the marker back in line with §7's own description
— "a few dozen chips, never exceeded a few hundred in simulation" — where it had been
sitting thousands underwater from week 9 on.

## D-024 — The torture test is enforced, not remembered (2026-08-21)

D-023 was found by a test that had never been run, and a rule that lives only in a chat
transcript is a rule that will be forgotten. Three layers, deliberately overlapping:

1. **`npm run torture` / `npm run torture:reset`** — the incantation
   (`tsx --conditions=react-server scripts/season-torture.mts`) is now a script, so nobody
   has to remember it.
2. **`CLAUDE.md`** — states the rule and, more importantly, *why*: `npm test`,
   `npm run build` and total-conservation checks all stayed green through D-023, because
   the Pot absorbed the leak and the books still balanced. Unit tests cannot see that class
   of bug, so "the suite is green" is not evidence here.
3. **A `PostToolUse` hook in `.claude/settings.json`** — fires on `Write|Edit|MultiEdit`
   and, when the path is under `lib/engine/`, one of `lib/jobs/{settle,resettle,reveal,
   slateOpen,util}.ts`, or `supabase/migrations/`, injects the instruction into the model's
   context and shows the owner a one-line notice. Silent for every other file.

The hook is committed to the project settings rather than local settings on purpose: the
rule belongs to the repository, not to one machine.

**Verified, not assumed.** The command was pipe-tested against both a matching and a
non-matching payload, the stored JSON was validated with `jq -e`, and the hook was proven
to fire end to end by editing `lib/jobs/util.ts` behind a sentinel — the instruction
appeared in context and the sentinel file was written. The probe edit and the sentinel were
then removed; `lib/jobs/util.ts` is byte-identical to HEAD.

`util.ts` is in the watch list because `stacksByPlayer` lives there — the second half of
D-023's fix — even though the file's name suggests nothing about chips.

**Also:** the local reveal preview (`app/reveal-preview/`) is deleted. It had served its
purpose, and it rendered fabricated tickets against real player names, which is not
something to leave lying in a working tree.

## D-025 — The ticker stops carrying the wires, and sportsbook content is refused (2026-08-21)

**The owner saw unwanted content on the rail and asked for it to stop.** `feeds.sync` was
projecting every `league_ticker` headline straight into `ticker_items` (ADMIN §4.5.2), so
whatever ESPN and CBS published went live unread.

**It was worse than clutter.** Of the first 58 auto-added lines, **eight were sportsbook
marketing** — "Use DraftKings promo code to get $150 in bonus bets" scrolling across a
product whose entire position is that chips have no cash value, none ever. Rulebook §9 is
categorical: *no cash surface, ever… nothing in the visual language should imply real
money — this is what keeps it a pool.* An ad for real-money betting on the dashboard is
the sharpest possible violation of that.

**Three changes, smallest first:**

1. **Auto-projection is now opt-in and off.** `ticker.auto_feed` defaults to false, with a
   toggle on `/admin/ticker` that says why. The §4.5.2 capability still exists; it is just
   no longer the default, because a wire feed is not curated.
2. **Cash-surface content is refused at ingest** (`lib/cashSurface.ts`), so it reaches
   neither the ticker nor the news box. Deliberately narrow: **"odds", "spread", "lines"
   and "picks" are NOT matched** — they are ordinary football words and the bet slip shows
   a spread and a moneyline itself. 12 tests cover both directions.
3. **CBS Sports' NFL wire is disabled.** Seven of its twenty-nine items were betting
   content against ESPN's one of twenty-six — a source problem, not a regex problem, and
   escalating patterns to chase it would eventually eat real coverage. The 32 first-party
   club feeds carry none of it.

**State:** rail clear (0 visible ticker items), 7 ingested items hidden, nothing deleted —
all 60 ticker rows and 785 feed items remain (§14). The rail still shows the league's own
generated facts: deadline, Pot, leader, waiting-on.

**Latent exposure that was worth checking rather than assuming:** league items only reach
the news box for a player with no favourite team, and there are currently none — so nobody
had actually seen this in "Your Team". The filter closes it for the first player who joins
without picking a team.
