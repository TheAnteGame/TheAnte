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
