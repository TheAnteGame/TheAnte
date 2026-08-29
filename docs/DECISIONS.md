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

## D-026 — Contrast and type raised to a measured standard (2026-08-21)

**The owner reported dim text and undefined borders, and named the real standard: an
eighty-year-old is playing, and if he can use it everyone can.** Every symptom mapped to a
measurable failure, so this was fixed to numbers rather than to taste:

| | Was | Now | Floor |
|---|---|---|---|
| `text-low` — footnotes, instructions, tooltips, timestamps | 3.36:1 | **5.83:1** | 4.5:1 |
| `text-mid` — body copy and chat | 7.87:1 | **9.99:1** | 4.5:1 |
| `--color-border` — every panel edge | 1.38:1 | **3.02:1** | 3:1 (WCAG 1.4.11) |
| `loss` — your own red delta | 3.89:1 | **4.51:1** | 4.5:1 |
| `gold-dim` — shove button, commissioner badge | 4.12:1 | **4.55:1** | 4.5:1 |

The old border sat at **a third** of what WCAG asks of a UI boundary, which is exactly why
areas read as having no definition. Unselected team buttons were at **1.08:1** against
their own panel — effectively invisible — and now carry a real 3:1 border, with the
selected side given a matching edge so the two differ only in fill.

**The whole secondary ramp moved up rather than just clearing the minimum.** 4.5:1 is a
floor, not a comfort target, and a legal pass on an unknown screen is not the brief.

**Type floor raised 10–11px → 12px in 47 places.** Contrast does not rescue 10px
uppercase tracked-out text; for the reader this is aimed at, size mattered as much.

No hue was added and no token was invented — the palette is the same three materials, just
legible. This *increases* compliance with the art direction's "state is contrast + weight,
not hue" rather than bending it.

## D-027 — Head-to-head records, and why not head-to-head betting (2026-08-21)

**Asked to explore player-versus-player side bets after the reveal. Recommended against
it, and the owner agreed.** Four reasons, in order of weight:

1. **It routes around the house limit.** §4 is load-bearing — the rulebook records that a
   flat one-quarter rule *"quietly compounded"* in simulation until the median cap fixed
   it. An uncapped peer market re-opens that hole: the leader takes unlimited action off
   whoever is willing.
2. **It distorts the Pot.** The Pot pays the biggest weekly *stack gain* (§7, §14). Side
   winnings would count toward it, so a Pot could be won on side action rather than on
   reading the room — when §7 says outright that *"the multipliers are how you win Pots."*
3. **It opens a chip-transfer channel.** Today the only way chips move between players is
   the settlement engine, which is what makes the ledger trustworthy and conservation
   meaningful. Two friends could dump a stack for a championship run and nothing could
   distinguish it from a genuine bet.
4. **It turns a pool into a book.** §9's "no cash surface, ever" is about what the product
   *is*. Named individuals taking action against each other is a different thing.

**Built instead: `headToHead` — the rivalry without the market.** Who out-gained who, week
by week, computed from data already held, shown as a fourth view on the results page beside
By game / By player / By season. Only weeks both players actually played are scored, so a
late joiner is not judged on weeks they could not enter. Five tests, including that the
record is symmetric — one player's win is the other's loss.

---

## D-028 — Chunk every season-growing `.in()` filter (2026-08-22)

PostgREST carries `in.(...)` filters in the request line; ~215 UUIDs crosses the
~8KB limit and returns HTTP 414 — which a 25-player league reaches in Week 9,
taking down `/results/[week]` and the dashboard's League Stats box. Any id list
whose length grows with the season must go through `chunk()` in `lib/db/fetchAll.ts`
(150 per request). Week-scoped lists are fine unchunked.

## D-029 — The Pot shows its working (2026-08-22)

"How did Frank win the week?" is answered on-screen: `lib/stats/potMath.ts`
re-derives the §7 award ordering (tested against `settleWeek` itself, never against
hand-written expectations) and `PotMath.tsx` renders the whole room ranked by week
gain, ante included. Award amounts are always read from `pot_awards`, never
re-derived — the panel cannot contradict the ledger. Settlement records
`weeks.pot_before` (the Pot's balance at award time) for the "The Pot held N" line.

## D-030 — Contrast is measured on the surface it sits on (2026-08-22)

D-026 measured tokens against the canvas, but the small type lives on panels
2.3× lighter. Re-measured on the worst real ground: `text-low` → 6.40:1,
`text-mid` → 9.97:1, `border` → 3.38:1 (it was below WCAG 1.4.11's 3:1 on
panels). Interactive team tiles carry a brighter rule than the system border
*because* they are pressable, with a light-not-hue hover suppressed on touch.

## D-031 — A tie is not a leader (2026-08-22)

`standings` ranks with `rank()`, so a level room makes EVERY player rank 1, and
the ticker's `limit(1)` crowned whichever row the planner returned. `leaderFrom`
(`lib/ticker/leader.ts`) puts a name on the rail only when one player is clear of
the field; ties are announced as ties. The torture test asserts the rail's claim
against the ledger every week.

## D-032 — Tutorial is eight owner-authored cards (2026-08-22)

User testing found the five-step overlay flow confusing. Rebuilt to the owner's
wireframes: eight self-contained cards, copy verbatim (two agreed accuracy fixes:
"every few weeks", "gains the most chips"), interactive press-to-raise board on
step 1 with Next locked until a chip lands. All copy under `howto.s{1-8}_*` keys.

## D-033 — Table Talk affordances are disclosed, not added (2026-08-22)

@mentions (D-019) and native emoji already worked; nothing told players. A `?`
popover in the panel header explains both, an eight-emoji strip sits by the send
button, and messages get hairline dividers. No new message semantics.

## D-034 — The roster locks at the Week 1 deadline, not at slate open (2026-08-22)

`admitToOpenWeek` (extracted to `lib/jobs/admit.ts` so the torture test exercises
the real path) deals every approval and reactivation into the currently open week:
same ante, limit from the frozen median. Approved after the deadline means next
week's player — no snapshot, no ante, no phantom fold: the reveal's waiting list,
the auto-folds, and the `waiting_on` view (migration 0018) all scope to dealt-in
players. Proven in the torture season with a mid-week joiner (conservation exact
through 25→26→27 players) and a post-deadline joiner.

## D-035 — Week 1 opens on the commissioner's command (2026-08-22)

The owner's call, twice over: (a) `slateOpenEarly` + an admin "Open the week now"
button open the next week's window immediately — the Thursday deadline does not
move; (b) while admission is open (`week1_lock_at` null/future), `revealCheck`
holds §6's last-ticket reveal so ONLY the deadline reveals — otherwise a growing
roster's first N submitters would open the room early and lock every later joiner
out. (c) §1's eight-player floor on season activation is now a recommendation in
the confirm dialog, not a gate — the first approved player can bet Week 1.

## D-036 — Post-review hardening before launch (2026-08-22)

From the pre-launch code review: `/rules` now exists (the tutorial linked to it;
rendered from the repo's rulebook markdown, traced into the Vercel bundle);
reveal-gating reads throw on error instead of silently emptying the waiting list
(a transient DB error could have revealed the room early); `/mock-preview` gets a
segment-level production 404 so a future harness page cannot ship service-role
reads; the torture test's leader assertion calls the real `leaderFrom` (the first
version was vacuously true). Deferred, tracked: admitToOpenWeek's felt-edge
branches, canReveal's global-count wedge, PotMath's gain map after re-settlement.

## D-037 — The rulebook is a surface, not a file (2026-08-23)

/rules renders the versioned rulebook in sections split on its own ## headings,
with a menu that rides the scroll (sticky rail wide, jump list on phones). The
tutorial's Gamebook link and a new Rule Book button at the bottom of /guide both
land there. On the dashboard, a "Quick answers" panel under the leaderboard takes
the ten questions the room actually asks — payouts, the ante, the Pot, the shove,
the felt — as an expandable Q&A in the rulebook's voice (faq.* content keys),
every answer deferring to /rules as the authority.

## D-038 — Table Talk is for the room, not the machine (2026-08-23)

Three automated announcements retired: season activated, week board opened, and
"X has a seat" on every approval. They were audited events being mirrored into a
small panel, crowding out the conversation the panel exists for and telling nobody
anything the standings did not already show. All three still write to the audit
log — they are simply no longer announced. Kept public per §13: commissioner
corrections, deactivations with their evidence, mutes, season close, handoff.

Message dividers became long dashes (`.chat-list > li + li`, a repeating-linear
gradient rather than a border, so the dash length is ours). A solid hairline read
as a table grid; conversation wants a softer separator. In `flex-col-reverse` the
rule sits on the BOTTOM edge of the DOM-later item — that is what lands it between
two messages and leaves the newest one clean against the composer.

The homepage gem got its light back: the dark veil over the facets was heaviest at
the perimeter (0.97), hiding the cut exactly where no type needed protecting. It
now holds the centre for legibility (0.90) and opens toward the edges (0.62). The
invitation also wears the season's current tier — purple, red, teal, gold on the
§2 week ranges, the same clock the stakes band keeps — so the front door changes
with the season. Preseason shows purple, the tier Week 1 opens on.

## D-039 — League Chat is player conversation only (2026-08-23)

Owner's call, stated three times and now absolute: **no system messages in League
Chat, ever.** Not corrections, not deactivations, not mutes, not the reveal, not
settlements, not the high-card draw. Removed at the source rather than filtered at
the edges — `postSystemMessage` is deleted outright, `writeAudit` no longer mirrors
`publicLine`, and the season-close draw's two direct inserts are gone. Nothing in
the codebase writes `is_system: true` any more; `grep` is the test.

TableTalk additionally reads `is_system = false`, which retires the messages already
posted without touching the append-only table — the rows stay, the room stops
showing them.

§13's "every correction is public" is now served by the audit log and the results
surfaces, which is where the working already lives: /results shows the Pot's math
week by week, and the ledger keeps every reversal beside its original. This
supersedes D-038, which retired three announcements and kept the rest.

Verified: a full torture season (reveals, settlements, pot awards, a correction
cascade, two mid-season admissions) ends with `system_msgs = 0`.

## D-040 — The commitment row, and a gate before the shove (2026-08-23)

The slip's footer put "Push your chips in" and "The shove" side by side, both in
gold. Two problems: the shove read as a co-equal first choice, and the "pick at
least 5 games" instruction floated after the shove instead of beside the button it
describes. Now the action and its own instruction sit together at the left, and the
shove is pushed to the right margin — a rare, separate decision, and visually so.

Colour carries the state: the submit is GOLD while the slip is short (the button
you are working toward), and becomes the chrome face the moment it is legal. The
shove is neutral grey, outlined at rest and filled when armed. No gold on the once-
a-season button.

Pressing "The shove" now opens an explainer gate — what a shove costs, that there
is one per season, and that arming commits nothing — before shove mode engages.
The type-SHOVE confirmation still guards the commit itself, so an irreversible
once-a-season move takes two deliberate steps.

Chat dividers got their own grey (#5c5c64), two shades under --color-border. The
border token stays at the WCAG 1.4.11 3:1 floor because it draws real UI
boundaries; a separator between two chat messages is not one.

## D-041 — The deadweight rule, and a commissioner who can fix a typo (2026-08-26)

Beta reality: a couple of players will accept a seat, mean well, and never bet.
Rulebook v1.1 had exactly one answer for that — nothing. §14 said a player who goes
quiet auto-folds forever and keeps paying antes, and §13 said silence is never
grounds for removal. Correct for a league of friends who all showed up; wrong for a
first season where a dead seat holds chips nobody can win and quietly makes an
eight-player table smaller than the numbers claim.

**The rule.** Three straight weeks with no ticket and the commissioner MAY remove
the seat. The whole stack is then split evenly across every remaining APPROVED
player. Submitting anything resets the count — including a fold you chose, because
turning up and betting nothing is turning up. Rulebook is v1.2; the change landed in
the preseason, before the Week 1 deadline, which §13 makes the last legitimate
moment a rule can move.

**Even split, not the Pot.** The Pot was the first proposal and it was wrong: one
player taking a +400 lump in a game where stacks sit near 500 and limits are
median÷3 is a far bigger distortion than spreading it thin. Chips are whole, so the
share is floored and the leftover — always fewer chips than there are players — goes
to the Pot. Odd chips already live there (§9's felt floor is paid out of it).

**Why removal is a transfer and never a delete.** The ledger is append-only and
conservation reads `stacks + pot === 500 × buy-ins`. Deleting a player's rows drops
their buy-in (500) but also drops whatever they won FROM other players — chips those
players' stacks still show. The books break by exactly the amount the player was up
or down. So the stack moves out and every row stays.

**Two gates in code, not just prose.** §13's anti-abuse logic still applies: a
commissioner who could remove a quiet-but-solvent big stack could move every house
limit in the league. So the three-week count is computed and enforced server-side —
the button does not appear below the threshold and the action refuses anyway — and
removal is blocked while a week is mid-blackout, because redistribution moves every
stack and §6 says no stack moves between the ante and the reveal.

`assertInvariants` gained the one legitimate way to reach zero. It reads the removed
set off the ledger itself (a `removal` debit) rather than plumbing roster status into
the engine, and does not waive the §9 floor so much as replace it with something
stricter: a removed seat must be EXACTLY empty. Half-drained is a redistribution bug
and now halts settlement. The split arithmetic lives in `lib/engine/removal.ts` so
the console cannot drift from it — the torture test drives the same function.

The torture season now carries a seat that never submits, removes it at week 12, and
asserts conservation across the removal, the emptied seat, that every recipient
gained exactly the share and nobody twice, that only the odd chips reached the Pot,
that the player vanishes from the standings view, and that a repeated removal is
rejected by the idempotency index rather than paying the room twice.

**Edit.** The console can now fix a first name, a last name, an email or a favourite
team — audited, not announced, because §13's "every correction is public" is about
chips, not spelling. Phone is deliberately absent: it is the Clerk login identity,
and editing it here would change who gets the mail without changing who can sign in.

## D-042 — The way out of a bet is drawn, not remembered (2026-08-26)

Clearing a stake meant pressing the same team tile until the ladder wrapped past its
top rung — five presses at 50 chips. The instruction sat one line above the board and
players still asked how to undo a pick, which is the tell that an affordance is a
rule you have to read rather than a thing you can see.

A soft grey ✕ now rides at the right edge of the chip fan on a backed tile, moving
out as the stack grows so it stays where the chips just landed. One press clears the
pick and the tile returns to rest. The ladder still wraps, for anyone who learned it.

The tile had to stop being a `<button>` element — a button cannot legally contain
another button — so it is a `div` with `role="button"`, `tabIndex` and Enter/Space
handling. Same ARIA semantics, same focus outline, plus `cursor-default select-none`
so it does not pick up a div's text I-beam. The tile's key handler ignores events
originating inside the ✕, or Enter on the cancel would clear the bet AND raise it on
the way past.

Grey is `--color-canvas` at 40% (75% hovered). The selected tile is a near-white
chrome face, so a literally light-grey ✕ would have vanished into it; the soft-dark
reading of "quiet grey" is what that background actually needs.

## D-043 — A gate that blocks the checks behind it is worse than no gate (2026-08-26)

Three findings, one root cause: the pipeline could not see anything.

**CI had been failing for three commits and nobody knew what it was failing on.**
`npm run lint` errored on React 19's new compiler rules, and because GitHub Actions
stops a job at the first failed step, `npm test` and the content-grep were **skipped**
— 140 unit tests silently not running since D-038. The alarm was unplugged and the
red light was on for the wrong reason.

Both offending rules fire on code that is correct and has no better form.
`set-state-in-effect` catches the SSR-safe hydration read: a component cannot know
`matchMedia("prefers-reduced-motion")`, `sessionStorage`, or a measured width during
render without breaking the server render, so it reads in an effect and sets state
once. That is the cascading render the rule describes, and it is also the only way to
do it — NewsFader, TickerMarquee, RevealExperience and BetSlip all rely on it.
`purity` catches `Date.now()` inside a *server* component. Both are now **warnings**:
still reported on new code, no longer able to hide the tests. Rewriting four
player-facing components to satisfy a linter days before invites is how you cause the
bug you were trying to prevent. Unit tests and content-grep additionally run with
`if: always()`, so a style complaint can never again be the reason nobody found out
the engine broke.

**The torture test now runs in CI.** CLAUDE.md calls it not optional and says D-023
was found by it and by nothing else — and it ran only by hand, on one laptop. A new
job brings up a real Supabase stack and plays the full 18-week season on every push.
It doubles as a from-scratch proof that the migration chain still builds a working
database.

**Schema drift has a checker** (`npm run schema:check`). D-041 shipped to production
against a database where migration 0019 had never been applied: Vercel deploys code,
migrations are applied by hand, and nothing compared them. Harmless that time only
because the surface it powers is unreachable until Week 4. The script parses every
migration for the columns it declares and asks the target's PostgREST endpoint for
each one — a column PostgREST cannot select is a column that is not there. Proven in
both directions on first run: production reported exactly `players.removed_at,
removal_reason` missing and nothing else across 25 tables; the local stack, which has
0019, reported in sync. It is wired into CI dormant, activating when a
`SCHEMA_CHECK_KEY` repo secret is added.

## D-044 — "Push your chips in" was the shove's language (2026-08-26)

Owner catch, from reading the board the way a new player would. The submit button
said **"Push your chips in"** — which in poker means going all-in — while the button
beside it was literally called **"The shove."** D-040 had already separated the two by
position and colour, on the theory that the shove read as a co-equal first choice. It
did not go far enough: the words themselves were the problem. The safe, every-week
action was wearing the once-a-season action's vocabulary.

Now **"Submit your ticket"**, and the confirmation title matches. "Ticket" is the word
the product already speaks — 32 times in the rulebook, 14 in the content defaults, and
in the surrounding copy on this very screen: *"Your ticket is in. Locked."*,
*"Submitting locks this ticket."* The button was the odd one out.

Not "lineup", which was the first suggestion: that is fantasy-football vocabulary for
choosing players, and ANTE opens by distinguishing itself from exactly that — *"you bet
chips instead of making picks."* Borrowing the word would import the wrong mental model
to fix a smaller one.

"Push" survives only where it is accurate: the shove's own commit note, *"You'll push
{stake}."*

## D-045 — The band explains itself (2026-08-26)

The stakes band showed four numbers and defined none of them. Owner requirement: a
player who has done the tutorial and read /rules should still never have to leave the
board to find out what a figure means. Tooltips now hang off the ring, the ante, the
Pot, the limit and the deadline.

**The clip-path had to move first.** The band carried `chamfer-lg` — a `clip-path` —
plus `overflow-hidden`, and a clip-path clips every descendant unconditionally: no
`z-index`, no `position: fixed`, nothing escapes it. At ~90px tall there was nowhere
inside to put a tooltip either. So every painted layer (facets, scrim, shine sweep)
moved into one absolutely-positioned decoration div that now carries the clip, the
border and the shadow, while the content sits in an unclipped parent. Verified
side by side against the old structure: identical chamfer, colour and top border;
tooltip sliced off in the old, whole in the new.

**Trigger is a `<button>`, on purpose.** A phone has no hover, so a hover-only tooltip
is invisible to most of the league. `group-hover` OR `group-focus-within` — the pair
the bet slip already uses — means a tap opens it. That forced the trays from `div` to
`span`: a button may not legally contain flow content.

**The limit tooltip says which cap is binding.** The slip already worked this out and
the band never said it out loud; §4's real question is "one third of WHAT", so the
answer names your own stack or the league's middle stack, with the number.

**The Pot tooltip deliberately states no arithmetic.** The obvious copy was
"{players} × {ante}", and it would already be wrong in production: `active_count_snapshot`
is frozen at slate open (§7), but late admissions (D-020) keep paying antes into the
Pot afterwards. Week 1 currently reads a snapshot of 1 against a Pot of 40. The tooltip
describes what the Pot is and points at the Pot panel, which does show its working
(D-029).

Deadline copy takes a distinct first-week form naming the date, the countdown, and that
the roster locks at the same moment (§1, D-046).

## D-046 — The roster lock had no hand to set it (2026-08-26)

§1 and §13 say admission "is preseason-only and dies at the Week 1 deadline along with
the roster." `seasons.week1_lock_at` has existed since migration 0001 to hold that
moment. **Nothing ever wrote it** — 25 references across the codebase, all reads, plus
one comment in `reset-season.sql` telling the operator to do it by hand. So
`admissionOpen` returned true forever, Approve and Reject stayed live all season, and a
published rule was simply not in force. Production was running that way.

slate.open now records the lock when Week 1 opens — the moment the deadline first
exists — and never overwrites one already set. Migration 0020 backfills any season
already past that point from Week 1's own deadline, which is the value the job would
have written.

The torture season no longer seeds `week1_lock_at`, so the write itself is under test:
it asserts the lock is set, that it equals Week 1's deadline, and that a repeated slate
open does not move it. Confirmed non-vacuous by removing the fix and watching the run
report 2 FAILURES, then restoring it for SEASON CLEAN.

## D-047 — Clerk had the phone; the roster never asked for it (2026-08-26)

Owner question, from reading the admin roster: how did three players get in without
giving a phone number? They didn't. Production Clerk reports
`phone_number: used_for_first_factor=true, required=true, verifications=['phone_code']`,
and `email_address` is not an enabled attribute at all — phone OTP is the only door and
it is mandatory (D-001). All five had verified a number.

**`players.phone` was simply never written.** Not by a server action, a migration, or a
script: `ensurePlayer` inserted `clerk_user_id` and `status`, `saveProfile` wrote name,
email and team, and nothing anywhere called Clerk for the number — no `clerkClient`, no
`currentUser`. The column existed since 0001 and the admin Contact cell rendered it, so
the roster showed blanks for everyone whose number had not been typed in by hand. Same
shape of bug as D-046: a column with no hand to fill it.

Now: new players get the verified number at creation, and existing ones are healed
lazily the next time they load any page (`getPlayerState`, the universal chokepoint).
The heal runs once — after the write the branch is never taken again — and is wrapped
so an unreachable Clerk can never break a render; the worst case is the blank cell that
was already there.

**The security model is unchanged, and that was checked rather than assumed.** Probed
against the real policies on a live stack: an authenticated user inserting their own
pending row WITH a phone is accepted (`players_apply` constrains only `clerk_user_id`
and `status`), and that same user trying to change the phone afterwards is BLOCKED by
`guard_players_self_update` — "phone changes are a Clerk flow" — with the stored value
unmoved. So the number can be written once, from what Clerk already verified, and never
edited by the player. The lazy heal uses the service role for the same reason: it
copies a verified value, it does not accept one from anybody.

**A correction worth recording.** The first check ran against `.env.local`, which holds
`sk_test_` — the DEVELOPMENT Clerk instance. It returned nine users, six with no phone
and an email instead, which read as "email sign-up is enabled, contradicting D-001." It
is not; those were dev accounts on a differently configured instance. Production was
confirmed from Clerk's public environment endpoint on clerk.theantegame.com. Any future
check of live auth config must not use `.env.local`.

## D-048 — The margin, not the deadline (2026-08-26)

Owner asked to guarantee players fifteen minutes before the first game of each week.
Reviewed first, at his instruction, for over-correction — and most of this was already
true. §3 says the slate is every game "except any game that kicks off before the
deadline," and "you can never bet a game that has already started." Week 1 bears it
out: the Wednesday opener is off-slate at −940 minutes, and the first bettable game
kicks **+515 minutes** after the wall. Players have eight and a half hours, not fifteen
minutes.

**The deadline did not move, and should not.** Making it float to fifteen minutes
before the first kickoff would contradict "The deadline is Thursday, 12:00 noon ET.
Every week. All season. No exceptions." — stated in bold in §3 — and would break the
"two days and six hours" promise, the Tuesday→Thursday rhythm, the Wed 6pm / Thu 9am
reminder crons, the tutorial, the FAQ, and the band. All to fix something that is not
happening.

**One real gap, one line.** The slate test was `kickoff >= deadline`, so a game kicking
at exactly noon Thursday would have been bettable with zero margin. The NFL has never
scheduled a Thursday noon kickoff, so it is theoretical — but the rulebook's promise
deserves to hold by margin rather than by a single second.
`SLATE_MARGIN_MINUTES = 15` now decides what counts as on-slate; a game inside the
margin drops off exactly the way the Wednesday openers already do. It is a rail, not a
rule change: zero real games move, and the deadline is untouched.

Week 1's slate is already frozen, and `on_slate` is written once at slate open — so
this changes nothing about the live week. It takes effect from Week 2 onward.

The torture season plants a game five minutes after the deadline in every week and
asserts it never reaches the slate, and that the slate is exactly one game short as a
result. Proven non-vacuous: reverting the margin reports two failures per week.


## D-049 — The tutorial teaches the board that exists (2026-08-26)

D-042 put a ✕ beside the chips on the real slip and left the tutorial's practice
board on the old control. A player learned "press five times to clear," then met a
board with a visible cancel — the tutorial teaching a version of the game that no
longer shipped.

The practice tile now carries the same ✕, and needed the same structural change for
the same reason: a `<button>` cannot contain a `<button>`, so the tile is a `div` with
`role="button"`, `tabIndex` and Enter/Space, and its key handler ignores events from
inside the cancel. Verified in the local tutorial harness — three presses to 30, ✕
clears it, `aria-pressed` back to false, tile back to its rest state, and the press did
not bubble through to raise.

The slip's own instruction was stale in the same way: `raise_hint` described only the
press-past-the-top wrap. It now leads with the ✕, which is the control a player can
actually see, and keeps the wrap as the alternative for anyone who learned it first.

Step 1's body copy is untouched — it is owner-authored (D-032), and it says "select a
team here to stack chips," which is still exactly true. The whole point of D-042 was
that the way out should be visible rather than described.

## D-050 — Run the functions next to the database (2026-08-29)

The site was slow and, worse, unreliable: a quarter of homepage requests never
returned at all. Cause was a split that had been there since the first deploy —
functions ran in **iad1 (Washington DC)** on Vercel's default, while Supabase sits in
**us-west-2 (Oregon)**. Every query was a transcontinental round trip, and the
homepage makes three in sequence (`getPlayerState`, the seasons read, content) before
it can render.

Diagnosed by comparison rather than inference. Same host, same network, same minute:

| Route | Path | Result |
|---|---|---|
| `/rules` | CDN hit — no function, no database | 20/20 ok, median 120ms, **0 hangs** |
| `/` | function + three cross-country queries | 15/20 ok, median 621ms, **5 hangs** |

That control matters: it proves the network path and the CDN were healthy, and puts
the fault squarely inside function execution. The hangs appeared in the runtime log
with no status code and no error — a function that never returned, not one that
failed. The Supabase client sets no request timeout, so a stalled connection waits
until the platform kills it, which is exactly the shape observed.

`vercel.json` now pins `regions: ["pdx1"]` — Vercel's us-west-2, the same region as
the database. Supabase is the only latency-sensitive dependency; Clerk, Resend and
the sports feeds are external either way.

Measured after, 60 consecutive requests:

| | before (iad1) | after (pdx1) |
|---|---|---|
| succeeded | 15/20 | **60/60** |
| median | 621ms | **228ms** |
| p90 | 1.101s | **262ms** |
| max | 5.530s | **397ms** |
| hangs | 5 (25%) | **0** |

The hangs were a symptom of the distance, not a separate defect. Worth noting the
measurement was taken from one location on the west coast; an east-coast player pays
one extra edge-to-function hop but saves three database round trips, so the trade is
still strongly positive. If that ever needs revisiting, the honest fix is fewer
sequential queries, not a second region.

Left alone deliberately: the Supabase client still has no request timeout. Colocation
makes a stall far less likely but not impossible, and a timeout is the belt to this
change's braces — a separate, non-urgent piece of work.

## D-051 — Fetching the leaderboard once instead of twice (2026-08-29)

The dashboard mounts `<Leaderboard>` twice — once inside `hidden min-[900px]:block`
for the wide layout, once inside `min-[900px]:hidden` for the narrow one — and CSS
hides whichever does not apply. Both still render on the server, and the component
fetches its own data, so every dashboard load ran the standings query, the week query,
the `week_players` snapshot **and a paged scan of the whole week's ledger** twice, for
a copy nobody ever sees.

Invisible today at 21 ledger rows. Not invisible by Week 18 with a full roster, on a
board that polls every five seconds. This is a growth problem more than a speed one,
which is why it was worth doing when the other two tiers of query work were not: after
D-050 colocated compute with the database, shaving the remaining waterfall buys perhaps
30–50ms, and was deferred to the offseason on the owner's call.

The fetch is now wrapped in React's `cache()`. **No cache key**, and that is
deliberate: nothing inside the memo is per-player — the standings, the week, the
deltas and the felt badges are the same league-wide table every approved player sees.
The one personal value, `isMe`, is derived from the prop outside the memo. An earlier
draft keyed on `playerId` as belt-and-braces; it earned an unused-argument warning and,
on inspection, defended nothing.

Proven rather than assumed, with a throwaway route mounting the component twice the way
the dashboard does, and a `console.log` inside the loader:

- with `cache()`, one page load, two mounts → **1 execution**
- without it, same page → **2 executions**
- with `cache()`, **two** page loads, four mounts → **2 executions**

That last line is the one that matters for safety: the memo dedupes *within* a request
and is discarded at the end of it. It never persists across requests, so it cannot
serve one player's read to another — the property to care about, since these reads go
through `createUserClient()` under RLS. The change is `select()` throughout and adds no
write of any kind; it cannot alter a chip.
