import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canReveal, revealEntries } from "@/lib/engine";
import type { EngineTicket } from "@/lib/engine";
import { emailDoc } from "@/lib/notify/templates";
import { reveal as revealDoc, ticket as ticketDoc } from "@/lib/notify/docs";
import { type JobOutcome } from "./util";

// The reveal fires the instant the last ACTIVE player's ticket lands, or Thursday
// noon — whichever comes first (§6, ANTE-PLAYER §1.5: deactivated players never
// stall it). Every deferred entry posts here, atomically: bet stakes and any shove's
// ante refund. This is also the one place players.shove_used_week is written.

interface OpenWeek {
  id: string;
  number: number;
  deadline_at: string;
}

async function currentOpenWeek(db: SupabaseClient): Promise<OpenWeek | null> {
  const { data } = await db
    .from("weeks")
    .select("id, number, deadline_at")
    .eq("phase", "open")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function revealCheck(db: SupabaseClient): Promise<JobOutcome> {
  const week = await currentOpenWeek(db);
  if (!week) return { status: "skipped", detail: { reason: "no open week" } };

  // D-035: while admission is OPEN the roster can still grow, and §6's "last ticket
  // lands" trigger would fire the moment everyone *currently* approved is in —
  // revealing the room days early and locking every later joiner out of the week.
  // So while the roster is forming, only the deadline reveals; the instant-reveal
  // resumes for good once week1_lock_at passes. Weeks 2–18 are unaffected: the
  // lock is always in the past by then.
  const { data: season } = await db
    .from("seasons")
    .select("week1_lock_at")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!season?.week1_lock_at || new Date(season.week1_lock_at) > new Date()) {
    return { status: "skipped", detail: { reason: "roster still forming — the deadline reveals (D-035)" } };
  }

  // "In this week" means dealt in — has a slate-open (or late-admit, D-020) snapshot.
  // A player approved between the deadline and the reveal has no snapshot: they are
  // next week's player, not someone the room waits on or folds (D-034).
  // Errors THROW here rather than falling through: a transient failure on any of
  // these reads used to yield null data, an empty waiting list, and an early reveal
  // with unsubmitted players still sealed — an irreversible blackout break. A thrown
  // error just means the 2-minute cron tries again.
  const [activeR, dealtR, ticketsR] = await Promise.all([
    db.from("players").select("id").eq("status", "approved"),
    db.from("week_players").select("player_id").eq("week_id", week.id),
    db.from("tickets").select("player_id").eq("week_id", week.id),
  ]);
  for (const r of [activeR, dealtR, ticketsR]) {
    if (r.error) throw new Error(`reveal-check read failed: ${r.error.message}`);
  }
  const dealtIn = new Set((dealtR.data ?? []).map((d) => d.player_id));
  const submitted = new Set((ticketsR.data ?? []).map((t) => t.player_id));
  const waiting = (activeR.data ?? []).filter((p) => dealtIn.has(p.id) && !submitted.has(p.id));

  // An empty room is not a unanimous one (D-034): with nobody dealt in there is no
  // "last ticket" to land, so the instant-reveal path never fires. Only the deadline
  // completes such a week.
  if (dealtIn.size === 0) {
    return { status: "skipped", detail: { reason: "nobody dealt in — the deadline handles this week" } };
  }
  if (waiting.length > 0) {
    return { status: "skipped", detail: { reason: `waiting on ${waiting.length}` } };
  }
  return fireReveal(db, week);
}

export async function revealDeadline(db: SupabaseClient): Promise<JobOutcome> {
  const week = await currentOpenWeek(db);
  if (!week) return { status: "skipped", detail: { reason: "no open week" } };
  if (new Date() < new Date(week.deadline_at)) {
    return { status: "skipped", detail: { reason: "deadline not reached" } };
  }

  // Auto-fold everyone who missed Thursday noon. Submit nothing and you are folded,
  // and you still owe the ante — no reopening, no "my phone died" (§3). Scoped to
  // dealt-in players: a fold on someone who was never in the week would dodge the
  // ante the fold rule exists to collect, and stain their record with it (D-034).
  const [activeR, dealtR, ticketsR] = await Promise.all([
    db.from("players").select("id").eq("status", "approved"),
    db.from("week_players").select("player_id").eq("week_id", week.id),
    db.from("tickets").select("player_id").eq("week_id", week.id),
  ]);
  for (const r of [activeR, dealtR, ticketsR]) {
    if (r.error) throw new Error(`reveal-deadline read failed: ${r.error.message}`);
  }
  const dealtIn = new Set((dealtR.data ?? []).map((d) => d.player_id));
  const submitted = new Set((ticketsR.data ?? []).map((t) => t.player_id));
  const folds = (activeR.data ?? [])
    .filter((p) => dealtIn.has(p.id) && !submitted.has(p.id))
    .map((p) => ({ week_id: week.id, player_id: p.id, is_fold: true, total_chips: 0 }));

  if (folds.length > 0) {
    const { error } = await db.from("tickets").insert(folds);
    if (error && !error.message.includes("duplicate key")) throw new Error(`auto-fold failed: ${error.message}`);
  }

  return fireReveal(db, week, folds.length);
}

async function fireReveal(db: SupabaseClient, week: OpenWeek, autoFolded = 0): Promise<JobOutcome> {
  const { data: ticketRows, error: tErr } = await db
    .from("tickets")
    .select("id, player_id, is_fold, is_shove, committed_stake, pending_refund")
    .eq("week_id", week.id);
  if (tErr) throw new Error(`tickets read failed: ${tErr.message}`);

  // Both callers converge here. The bar is the WEEK's room, not the global roster
  // (review D-036: gating on league-wide approved players wedged a week — and with
  // it the season — when the roster changed after submissions; a deactivated
  // player's submitted ticket still deserves its reveal).
  const { count: dealtInCount } = await db
    .from("week_players")
    .select("player_id", { count: "exact", head: true })
    .eq("week_id", week.id);
  const ready = canReveal({ dealtIn: dealtInCount ?? 0, tickets: (ticketRows ?? []).length });
  if (!ready.ok) return { status: "skipped", detail: { reason: ready.reason, week: week.number } };

  const { data: betRows, error: bErr } = await db
    .from("bets")
    .select("ticket_id, game_id, side, chips")
    .in("ticket_id", (ticketRows ?? []).map((t) => t.id));
  if (bErr) throw new Error(`bets read failed: ${bErr.message}`);

  const betsByTicket = new Map<string, Array<{ gameId: string; side: "away" | "home"; chips: number }>>();
  for (const b of betRows ?? []) {
    const list = betsByTicket.get(b.ticket_id) ?? [];
    list.push({ gameId: b.game_id, side: b.side as "away" | "home", chips: b.chips });
    betsByTicket.set(b.ticket_id, list);
  }

  const engineTickets: EngineTicket[] = (ticketRows ?? []).map((t) => ({
    playerId: t.player_id,
    isFold: t.is_fold,
    isShove: t.is_shove,
    bets: betsByTicket.get(t.id) ?? [],
    committedStake: t.committed_stake,
    pendingRefund: t.pending_refund,
  }));

  // Atomic: stakes + shove refunds in one insert, idempotency-keyed.
  const entries = revealEntries(engineTickets, week.number);
  const rows: Array<Record<string, unknown>> = [];
  const potTotals = new Map<string, number>();
  const perPlayerSeq = new Map<string, number>();
  for (const e of entries) {
    if (e.account === null) {
      potTotals.set(e.kind, (potTotals.get(e.kind) ?? 0) + e.amount);
    } else {
      const seqKey = `${e.account}:${e.kind}`;
      const seq = (perPlayerSeq.get(seqKey) ?? 0) + 1;
      perPlayerSeq.set(seqKey, seq);
      rows.push({
        player_id: e.account,
        week_id: week.id,
        kind: e.kind,
        amount: e.amount,
        reason: e.reason,
        idempotency_key: `reveal:${e.kind}:${seq}`,
      });
    }
  }
  for (const [kind, amount] of potTotals) {
    rows.push({
      player_id: null,
      week_id: week.id,
      kind,
      amount,
      reason: `Week ${week.number} — Pot side of ${kind} at reveal`,
      idempotency_key: `reveal:${kind}:pot`,
    });
  }
  if (rows.length > 0) {
    const { error } = await db.from("ledger_entries").insert(rows);
    if (error && !error.message.includes("duplicate key")) throw new Error(`reveal posting failed: ${error.message}`);
  }

  // shove_used_week is written by the reveal job, never the submit handler (§7).
  for (const t of ticketRows ?? []) {
    if (t.is_shove) {
      await db.from("players").update({ shove_used_week: week.number }).eq("id", t.player_id);
    }
  }

  const { error: wErr } = await db
    .from("weeks")
    .update({ phase: "revealed", revealed_at: new Date().toISOString() })
    .eq("id", week.id)
    .eq("phase", "open"); // guard against a concurrent fire
  if (wErr) throw new Error(`reveal phase flip failed: ${wErr.message}`);

  // Mail can never undo a reveal. The phase flip above is already committed, and a
  // Resend outage or a malformed row must not turn a good reveal into a failed job.
  try {
    await sendRevealMail(db, week.id, week.number);
  } catch (e) {
    console.error(`reveal mail failed for week ${week.number}:`, e);
  }

  return {
    status: "succeeded",
    detail: { week: week.number, tickets: ticketRows?.length ?? 0, autoFolded },
  };
}

/** The reveal mail (D-056): a fold notice to anyone who was auto-folded, and the
 *  per-game board to everybody.
 *
 *  BLACKOUT GUARD. This function refuses to send anything unless the week's
 *  revealed_at is actually set in the database. It is the only email in the system
 *  that carries other players' picks, so it does not trust its caller's ordering —
 *  re-order the reveal job tomorrow and this still cannot leak a ticket early
 *  (ANTE-TECH §7). */
async function sendRevealMail(db: SupabaseClient, weekId: string, weekNumber: number): Promise<void> {
  const { data: w } = await db.from("weeks").select("revealed_at").eq("id", weekId).maybeSingle();
  if (!w?.revealed_at) {
    // Never throw: a settled week must not be undone by a mail failure. Loud, though.
    console.error(`reveal mail refused: week ${weekNumber} has no revealed_at`);
    return;
  }

  const [{ data: players }, { data: tickets }, { data: games }] = await Promise.all([
    db.from("players").select("id, email, first_name, last_name").eq("status", "approved"),
    db.from("tickets").select("id, player_id, is_fold").eq("week_id", weekId),
    db.from("games").select("id, away_team, home_team, kickoff_at").eq("week_id", weekId).eq("on_slate", true).order("kickoff_at"),
  ]);

  const nameOf = new Map(
    (players ?? []).map((p) => [p.id, `${p.first_name ?? "?"} ${(p.last_name ?? "").slice(0, 1)}.`.trim()]),
  );
  const ticketIds = (tickets ?? []).map((t) => t.id);
  const playerOfTicket = new Map((tickets ?? []).map((t) => [t.id, t.player_id]));

  const { data: bets } = ticketIds.length
    ? await db.from("bets").select("ticket_id, game_id, side").in("ticket_id", ticketIds)
    : { data: [] as Array<{ ticket_id: string; game_id: string; side: string }> };

  // Head counts only. Chip weights stay on the board, on purpose.
  const backers = new Map<string, string[]>();
  for (const b of bets ?? []) {
    const nm = nameOf.get(playerOfTicket.get(b.ticket_id) ?? "");
    if (!nm) continue;
    const key = `${b.game_id}:${b.side}`;
    backers.set(key, [...(backers.get(key) ?? []), nm]);
  }

  const rows = (games ?? []).map((g) => ({
    matchup: `${g.away_team} @ ${g.home_team}`,
    away: g.away_team,
    home: g.home_team,
    awayBackers: (backers.get(`${g.id}:away`) ?? []).sort().join(", "),
    homeBackers: (backers.get(`${g.id}:home`) ?? []).sort().join(", "),
  }));

  const foldedIds = (tickets ?? []).filter((t) => t.is_fold).map((t) => t.player_id);
  const foldedNames = foldedIds.map((id) => nameOf.get(id)).filter(Boolean) as string[];
  const foldedLine =
    foldedNames.length === 0
      ? ""
      : `${foldedNames.sort().join(", ")} ${foldedNames.length === 1 ? "was" : "were"} folded automatically.`;

  const deadlineLabel = "Thursday 12:00pm ET";

  for (const p of players ?? []) {
    if (!p.email) continue;
    const first = p.first_name ?? "Hello";

    // Their own outcome first, using the same template a submitted ticket gets.
    if (foldedIds.includes(p.id)) {
      await emailDoc(
        db,
        p,
        "player.folded",
        `ANTE: you were folded for Week ${weekNumber}`,
        ticketDoc({ firstName: first, week: weekNumber, folded: true, isShove: false, bets: [], total: 0, deadline: deadlineLabel }),
        `player.folded:w${weekNumber}:${p.id}`,
      );
    }

    await emailDoc(
      db,
      p,
      "notify.reveal",
      `ANTE: the Week ${weekNumber} board is open`,
      revealDoc({ firstName: first, week: weekNumber, games: rows, folded: foldedLine }),
      `notify.reveal:w${weekNumber}:${p.id}`,
    );
  }
}
