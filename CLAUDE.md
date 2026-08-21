@AGENTS.md

# Ante

## Session start

**Read `roadmap.md` first** — it holds the current build status, the phase checklist, and
cold-session bootstrap steps. Update its Current Status block whenever meaningful work lands.

## Project targets — use these, don't guess

- **GitHub repo:** https://github.com/TheAnteGame/TheAnte (remote `origin`)
- **Vercel:** team `toler` (`team_4andjL2cqSyemQW9djJBNeW2`), project `ante-game` (`prj_jgRdoSHYTcHEtiZEYrqUckAULYL2`)
- **Supabase:** org "The ANTE Game Org" (`vsfymkwprzjbzdvxyvqr`), project **"TheAnte"** (`vyhxslqddjyyrgbmaedn`, us-west-2). This is the only project in the org and the one to use — always pass this project_id. Created fresh 2026-08-17; schema starts empty.
- **Clerk:** project "The Ante" (`app_3HosXHrAzzGhRnBa3MKOlOB0qL4`) — phone OTP only, no passwords.

When a connector shows multiple teams/orgs/projects, only act on the ones listed above. If a task seems to require a different target, stop and confirm with the user first.

## The spec set — read before building anything

The product is fully specified in `docs/build spec/`. Authority order:
`ANTE-RULEBOOK.md` (the game, final authority) → `ANTE-PLAYER.md` (player app + canonical
settlement engine) → `ANTE-ADMIN.md` (commissioner console) → `ANTE-ART-DIRECTION.md` →
`ANTE-TECH.md` (stack/infra). Post-spec decisions live in `docs/DECISIONS.md` and win over
the specs where they conflict (currently: D-001 phone OTP + email-only notifications with
a stubbed SMS channel; D-005 nflverse + ESPN, no Odds API; D-006 Google Fonts only).

Two invariants are architecture, not features — never weaken them: the pre-reveal
blackout is enforced by Supabase RLS (no ledger writes, no public figure moves between
ante posting and `revealed_at`), and chips are exactly conserved via an append-only
ledger (stacks are SUM projections; conservation asserts after every settlement).

## Before releasing anything that touches chips

If a change reaches **settlement, the reveal, the ledger, `lib/engine/`, or a migration**,
run the season torture test before calling the work done:

```
supabase start          # local stack; Docker must be running
npm run torture:reset   # db reset + the full run, ~6 seconds
```

It plays a complete 18-week, 25-player season against a real Supabase stack — real RLS,
real jobs — and asserts chip conservation, the blackout, and that a re-settlement with
identical inputs changes nothing. Green prints `SEASON CLEAN`.

**This is not optional and not covered by anything else.** D-023 was found by it and by
nothing else: a commissioner correction silently moved ~8,000 chips out of the Pot while
`npm test`, `npm run build` and total-conservation checks all stayed green, because the Pot
absorbed the leak and the books still balanced. Unit tests cannot see that class of bug.

A `PostToolUse` hook in `.claude/settings.json` raises this automatically when one of those
files is edited. If the run fails, say so with the output — a failure here is a real defect,
never a flaky test.
