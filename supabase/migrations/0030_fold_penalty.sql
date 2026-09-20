-- 0030 — The fold penalty (D-096, rulebook v1.4, league vote).
--
-- A fold now costs the ante and 50 chips more, both into the Pot, from Week 3.
-- The chips move at settlement as their own ledger kind, so the books say what
-- happened rather than hiding it in a second "ante". This migration only widens
-- the kind list — npm run schema:check cannot see it; verify by hand:
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'ledger_entries_kind_check';

alter table ledger_entries drop constraint if exists ledger_entries_kind_check;
alter table ledger_entries add constraint ledger_entries_kind_check
  check (kind in (
    'buy_in', 'ante', 'ante_refund', 'ante_recharge', 'bet_stake', 'bet_return',
    'bet_payout', 'sweep', 'pot_award', 'correction', 'reversal', 'marker',
    'felt_floor', 'season_close', 'removal', 'fold_penalty'
  ));
