# ANTE

A season-long NFL chip pool. Everyone starts with 500. Nobody sees a pick until
everyone is locked in. Biggest stack on the last Sunday wins.

**[theantegame.com](https://theantegame.com)**

The complete rules live in [docs/build spec/ANTE-RULEBOOK.md](docs/build%20spec/ANTE-RULEBOOK.md) —
versioned with the code and frozen for the season, which is exactly why they're in the repo.

## The two invariants

- **The blackout is absolute.** Between ante posting and the reveal, no pick is
  reachable at the API layer — enforced by Postgres row-level security, not UI.
- **Chips are exactly conserved.** Stacks are SUM projections over an append-only
  ledger. A conservation assertion runs after every settlement and halts loudly.

## Stack

Next.js App Router · Supabase (Postgres + RLS) · Clerk (phone OTP) · Resend · Vercel.
Jobs are scheduled by pg_cron calling `/api/jobs/*`; the settlement engine is pure
TypeScript in `lib/engine/`, tested against every worked example in the rulebook plus
a full-season torture test (`scripts/season-torture.mts`).

Chips have no cash value. None. Ever.
