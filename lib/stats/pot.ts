import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { POT_PAYS_ANTES_FROM_WEEK, weeklyPotFor } from "@/lib/engine/constants";

// What "the Pot" actually is, in one place (D-070).
//
// The Pot's ledger account (player_id IS NULL) does two jobs. It holds the Pot — the
// antes, the sweep, whatever rolled over — and it is ALSO the counterparty that holds
// every player's stake between the reveal and settlement. Chips cannot vanish, so
// when stakes leave stacks at the reveal they have to land somewhere, and this is
// where. At settlement the winners' stakes and profits are paid back out of it and
// whatever the table did not pay back stays, which is the sweep (§5).
//
// Summing the whole account therefore reads correctly all week and then lies from the
// reveal until settlement. On 2026-09-10 the band showed a Pot of 1430 when the Pot
// was 150: 15 antes plus 1280 of other people's stakes sitting in escrow.
//
// Nothing about the ledger or the award was wrong — settleWeek takes the raw balance
// and debits every return and payout before awarding, so it has always awarded antes
// plus sweep. This is the number PLAYERS are shown, and only that.

interface PotRow {
  kind: string;
  amount: number;
  week_id: string | null;
}

async function potRows(db: SupabaseClient): Promise<PotRow[]> {
  return fetchAllRows<PotRow>((from, to) =>
    db.from("ledger_entries").select("kind, amount, week_id").is("player_id", null).order("id").range(from, to),
  );
}

/** Weeks whose bets are still live — their stakes are escrow, not Pot. */
async function unsettledWeekIds(db: SupabaseClient): Promise<Set<string>> {
  const { data } = await db.from("weeks").select("id, settled_at");
  return new Set((data ?? []).filter((w) => !w.settled_at).map((w) => w.id as string));
}

/** The Pot as a player should see it: the account, less stakes still in escrow.
 *
 *  Deliberately keys on settled_at rather than on the phase: once a week settles, the
 *  losers' stakes ARE the Pot (that is the sweep) and must be counted, while the
 *  winners' have already been paid back out. Subtracting bet_stake unconditionally
 *  would erase the sweep and under-report the Pot for the rest of the season. */
export async function potBalance(db: SupabaseClient): Promise<number> {
  const [rows, open] = await Promise.all([potRows(db), unsettledWeekIds(db)]);
  return rows.reduce(
    (sum, e) => sum + (e.kind === "bet_stake" && e.week_id && open.has(e.week_id) ? 0 : e.amount),
    0,
  );
}

/** The Pot players are shown for a week (D-130). From Week 9 the Pot is that week's
 *  antes plus whatever the table keeps, and any debt the account carries is the
 *  commissioner's business, not the room's — so a negative balance never reaches a
 *  player. Before settlement that is the week's net antes (or the balance, if a roll
 *  makes it bigger: what settlement will pay at least); once settled, what it paid.
 *  Earlier weeks keep the account balance, exactly as they were shown at the time.
 *  The commissioner console keeps reading `potBalance`. */
export async function potShown(
  db: SupabaseClient,
  week: { id: string; number: number; settled_at: string | null; pot_before: number | null },
): Promise<number> {
  if (week.number < POT_PAYS_ANTES_FROM_WEEK) return potBalance(db);
  if (week.settled_at) return Math.max(0, Number(week.pot_before ?? 0));
  const [rows, open] = await Promise.all([potRows(db), unsettledWeekIds(db)]);
  let balance = 0;
  let antes = 0;
  for (const e of rows) {
    if (!(e.kind === "bet_stake" && e.week_id && open.has(e.week_id))) balance += e.amount;
    if (e.week_id === week.id && ANTE_KINDS.has(e.kind)) antes += e.amount;
  }
  return Math.max(0, weeklyPotFor({ antes, swept: 0, balance }));
}

/** The Pot side of an ante: charged at slate open, refunded to a shover at the reveal,
 *  charged again if the shove's game was voided. Their sum is the week's net antes. */
const ANTE_KINDS = new Set(["ante", "ante_refund", "ante_recharge"]);

/** Chips staked across the league in one week, straight off the ledger so it can
 *  never disagree with what actually left the stacks. Zero before the reveal, which
 *  is the only correct answer then: §6 forbids showing a chip or a count while the
 *  blackout is up, and an aggregate stake IS a count of what the room committed. */
export async function wageredInWeek(db: SupabaseClient, weekId: string): Promise<number> {
  const rows = await potRows(db);
  return rows
    .filter((e) => e.kind === "bet_stake" && e.week_id === weekId)
    .reduce((sum, e) => sum + e.amount, 0);
}
