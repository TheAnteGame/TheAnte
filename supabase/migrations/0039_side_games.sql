-- 0039 — Side-game accounts and kinds (D-131 rules, D-132 settlement door).
--
-- ANTE Play decides who won a side game; Ante books the chips. Two things need a
-- home that is neither a player nor the Pot: the house (which may go negative) and
-- each game's pool (where a tie remainder waits for next week). Booking them as
-- owner-less rows would fold them into the Pot — every Pot reader treats
-- player_id IS NULL as the Pot — which is the D-023 class of leak only the torture
-- test can see. So they get their own column.
--
--   account  null for every existing row and every Pot row. A row with an account
--            belongs to that side account and must have no player.
--   The Pot is now: player_id IS NULL AND account IS NULL.
--
-- New kinds: play_entry (10 into a pool), play_payout (pool → winner), play_house
-- (anything the house pays or takes, and the Week 18 sweep of a pool).
--
-- The ledger stays append-only: adding a column does not touch ledger_append_only.
-- Safe to re-run. Apply BEFORE the console's "Post side-game results" is used, then
-- prove it with `npm run schema:check` (it reads both check lists below).

alter table ledger_entries add column if not exists account text;

alter table ledger_entries drop constraint if exists ledger_entries_account_check;
alter table ledger_entries add constraint ledger_entries_account_check
  check (account in ('play_house', 'play_pool_bingo', 'play_pool_crunch'));

alter table ledger_entries drop constraint if exists ledger_entries_kind_check;
alter table ledger_entries add constraint ledger_entries_kind_check
  check (kind in (
    'buy_in', 'ante', 'ante_refund', 'ante_recharge', 'bet_stake', 'bet_return',
    'bet_payout', 'sweep', 'pot_award', 'correction', 'reversal', 'marker',
    'felt_floor', 'season_close', 'removal', 'fold_penalty',
    'play_entry', 'play_payout', 'play_house'
  ));

-- A side account is never a player's row as well.
alter table ledger_entries drop constraint if exists ledger_entries_account_owner;
alter table ledger_entries add constraint ledger_entries_account_owner
  check ((account is null) or (player_id is null));

comment on column ledger_entries.account is
  'Side-game account (D-132): play_house, play_pool_bingo, play_pool_crunch. Null = a player row, or the Pot when player_id is also null.';
