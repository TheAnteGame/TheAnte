/**
 * THE SEASON TORTURE TEST
 *
 * Runs a complete 18-week, 25-player season against a REAL local Supabase stack:
 * the actual migrations, triggers, RLS policies, submit_ticket RPC, and job code —
 * not the pure engine. This is the answer to "what breaks in Week 11 with 25
 * people playing": it breaks here first, or it doesn't exist.
 *
 * What it exercises and asserts, every week:
 *   - slate.open core: antes, felt evaluation, snapshots (real DB writes)
 *   - submissions through the submit_ticket RPC as 25 REAL authenticated users
 *     (JWTs signed with the local stack's secret — full RLS, full validation)
 *   - THE BLACKOUT, probed as a rival player after submissions: no foreign
 *     tickets or bets visible, and no public figure (pot, stacks) moved
 *   - no ledger entry timestamps inside the blackout window (acceptance 24a)
 *   - auto-fold + reveal via the real revealDeadline job
 *   - post-reveal: all tickets visible to a player (RLS opens)
 *   - scores + settlement via the real settle job (conservation asserts inside)
 *   - SQL conservation after every week: sum(stacks)+pot == 500×25, stacks ≥ 1
 *   - shoves (incl. voided-shove ante recharge + card return), ties, cancelled
 *     games, felt players betting 1-chip slips, the 3-place pot tier (24–31)
 *   - a mid-season RE-SETTLEMENT CASCADE (week 5, run after week 8) with
 *     tickets asserted byte-identical before and after (acceptance 28)
 *
 * Usage:  supabase start   (local stack; migrations auto-apply)
 *         npx tsx --conditions=react-server scripts/season-torture.mts
 */

import { execSync } from "node:child_process";
import { createHmac, createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Local stack wiring ───────────────────────────────────────────────────────────
const status = execSync("supabase status -o env", { encoding: "utf8" });
const env = Object.fromEntries(
  status
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2]]),
);
const API_URL = env.API_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = env.ANON_KEY!;
const SERVICE_KEY = env.SERVICE_ROLE_KEY!;
const JWT_SECRET = env.JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";

process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
delete process.env.RESEND_API_KEY; // email transport off; sends log as failed, harmlessly

const { openWeekCore } = await import("../lib/jobs/slateOpen");
const { revealDeadline, revealCheck } = await import("../lib/jobs/reveal");
const { settleCurrentWeek } = await import("../lib/jobs/settle");
const { resettleFromWeek } = await import("../lib/jobs/resettle");
const { admitToOpenWeek } = await import("../lib/jobs/admit");
const { houseLimit } = await import("../lib/engine/core");
const { computeRemoval } = await import("../lib/engine/removal");
const { assertInvariants } = await import("../lib/engine/invariants");
type EngineRow = Parameters<typeof assertInvariants>[0][number];
const { leaderFrom } = await import("../lib/ticker/leader");

const service: SupabaseClient = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

// The real 32, as seeded by migration 0004 — used to build varied weekly matchups.
const NFL_TEAMS = [
  "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND",
  "JAX","KC","LA","LAC","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF",
  "TB","TEN","WAS",
];

// Ordinary names, so a reveal board reads like a real room rather than Player0 T.
// Purely cosmetic — nothing in the engine or the asserts touches these.
const TEST_NAMES: Array<[string, string]> = [
  ["Frank","Mullen"],["Dee","Okafor"],["Hal","Brennan"],["Rosa","Petrakis"],["Sam","Whitlock"],
  ["Nina","Vasquez"],["Curt","Delaney"],["Ada","Fenwick"],["Marv","Sorensen"],["Pia","Nakamura"],
  ["Gus","Ferraro"],["Ivy","Castellan"],["Ray","Hollins"],["Tess","Aguirre"],["Otto","Brandt"],
  ["Jo","Ellsworth"],["Vic","Ramirez"],["Lena","Pruitt"],["Cal","Whitfield"],["Bea","Tanaka"],
  ["Moe","Kirkland"],["Ines","Duarte"],["Walt","Considine"],["Ruth","Ellery"],["Ned","Salvatore"],
];

// ── Deterministic chaos ──────────────────────────────────────────────────────────
let seedState = 20260817;
const rand = () => {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 2 ** 32;
};

// ── Real player JWTs — the RLS boundary is exercised for real ────────────────────
function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function signJwt(sub: string): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64url(
    Buffer.from(
      JSON.stringify({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 }),
    ),
  );
  const sig = b64url(createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}
function asPlayer(sub: string): SupabaseClient {
  return createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${signJwt(sub)}` } },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
let failures = 0;
function check(cond: boolean, label: string): void {
  if (!cond) {
    failures++;
    console.error(`  ✕ FAIL: ${label}`);
  }
}

async function balances(): Promise<{ stacks: Map<string, number>; pot: number; total: number }> {
  const data: Array<{ player_id: string | null; amount: number }> = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await service.from("ledger_entries").select("player_id, amount").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    data.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  const stacks = new Map<string, number>();
  let pot = 0;
  for (const e of data ?? []) {
    if (e.player_id === null) pot += e.amount;
    else stacks.set(e.player_id, (stacks.get(e.player_id) ?? 0) + e.amount);
  }
  const total = [...stacks.values()].reduce((a, b) => a + b, 0) + pot;
  return { stacks, pot, total };
}

/** The whole ledger in engine shape — what assertInvariants is designed to eat. */
async function fetchAllLedger(): Promise<EngineRow[]> {
  const out: EngineRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await service
      .from("ledger_entries").select("player_id, kind, amount, reason").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(
      ...(page ?? []).map((e) => ({
        account: e.player_id,
        kind: e.kind as EngineRow["kind"],
        amount: e.amount,
        reason: e.reason,
      })),
    );
    if (!page || page.length < 1000) break;
  }
  return out;
}

async function ticketFingerprint(): Promise<string> {
  const { data: tickets } = await service
    .from("tickets")
    .select("id, week_id, player_id, is_fold, is_shove, total_chips, committed_stake, pending_refund")
    .order("id");
  const { data: bets } = await service.from("bets").select("ticket_id, game_id, side, chips").order("ticket_id").order("game_id");
  return createHash("sha256").update(JSON.stringify({ tickets, bets })).digest("hex");
}

// ── The run ─────────────────────────────────────────────────────────────────────
const N = 25;
const START = Date.now();

async function main() {
  console.log(`ANTE season torture test — ${N} players, 18 weeks, real stack at ${API_URL}\n`);

  // Local stack only, and a fresh one: run `supabase db reset` first.
  if (!API_URL.includes("127.0.0.1") && !API_URL.includes("localhost")) {
    throw new Error("Refusing to run against a non-local database.");
  }
  const { count: existing } = await service.from("players").select("id", { count: "exact", head: true });
  if ((existing ?? 0) > 0) {
    throw new Error("Database is not fresh. Run `supabase db reset` first — the ledger is append-only by design.");
  }

  // Seed: season + 25 approved players with buy-ins.
  await service.from("seasons").insert({ year: 2026, status: "active", week1_lock_at: new Date(Date.now() - 3600_000).toISOString() });
  const playerIds: string[] = [];
  const subs: string[] = [];
  for (let i = 0; i < N; i++) {
    const sub = `test_user_${i}`;
    const { data, error } = await service
      .from("players")
      .insert({
        clerk_user_id: sub,
        status: "approved",
        first_name: TEST_NAMES[i % TEST_NAMES.length][0],
        last_name: TEST_NAMES[i % TEST_NAMES.length][1],
        email: null,
        favorite_team: NFL_TEAMS[i % NFL_TEAMS.length],
        profile_complete: true,
        joined_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`seed player failed: ${error.message}`);
    playerIds.push(data.id);
    subs.push(sub);
    await service.from("ledger_entries").insert({
      player_id: data.id,
      kind: "buy_in",
      amount: 500,
      reason: "Buy-in — torture season",
      idempotency_key: "buy-in",
    });
  }
  const { data: seasonRow } = await service.from("seasons").select("*").eq("year", 2026).single();
  console.log(`Seeded ${N} players. Conservation baseline: ${(await balances()).total} (expect ${N * 500}).\n`);

  // D-034: mid-season admissions. Creates the player exactly as approvePlayer does —
  // approved row, 500 buy-in — then the caller decides whether admitToOpenWeek deals
  // them into the current week. Pushed onto the roster so conservation and the
  // submission loop track them from that moment on.
  async function approveLatecomer(first: string, last: string, sub: string): Promise<string> {
    const { data, error } = await service
      .from("players")
      .insert({
        clerk_user_id: sub,
        status: "approved",
        first_name: first,
        last_name: last,
        email: null,
        favorite_team: NFL_TEAMS[(playerIds.length * 7) % NFL_TEAMS.length],
        profile_complete: true,
        joined_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`latecomer seed failed: ${error.message}`);
    await service.from("ledger_entries").insert({
      player_id: data.id,
      kind: "buy_in",
      amount: 500,
      reason: "Buy-in — torture latecomer",
      idempotency_key: "buy-in",
    });
    return data.id;
  }

  const shoveWeekByPlayer = new Map<string, number>();
  let preFingerprint = "";

  // ── The deadweight seat (D-041, §14) ──────────────────────────────────────────
  // One player never submits anything, all season. By week 12 they are far past the
  // three-week threshold, and the removal below is exercised against a stack that has
  // been ante'd down for eleven weeks — not a tidy 500 that would divide evenly and
  // hide the remainder path entirely.
  const deadweightIdx = N - 1;
  const deadweightId = playerIds[deadweightIdx];
  const removedIds = new Set<string>();

  for (let week = 1; week <= 18; week++) {
    const t0 = Date.now();

    // ── Slate open (real core, fabricated schedule around "now") ────────────────
    const opensAt = new Date(Date.now() - 60_000);
    const deadlineAt = new Date(Date.now() + 3600_000);
    const gameCount = week === 1 || week === 12 ? 15 : 16; // the Wednesday holes (§3)
    // Real, varied matchups: every team plays once a week, pairings rotate by week
    // (the circle method). One team code for the whole league made every reveal row
    // read "KC @ BAL", which hides side-labelling bugs and makes the board unreadable.
    const rotate = (w: number): Array<[string, string]> => {
      const fixed = NFL_TEAMS[0];
      const ring = NFL_TEAMS.slice(1);
      const off = (w - 1) % ring.length;
      const r = [...ring.slice(off), ...ring.slice(0, off)];
      const pairs: Array<[string, string]> = [[fixed, r[0]]];
      for (let i = 1; i < NFL_TEAMS.length / 2; i++) pairs.push([r[i], r[ring.length - i]]);
      return w % 2 === 0 ? pairs.map(([a, b]) => [b, a] as [string, string]) : pairs;
    };
    const pairs = rotate(week);
    const games = Array.from({ length: gameCount }, (_, i) => ({
      externalId: `2026_${String(week).padStart(2, "0")}_G${i}`,
      espnId: null,
      season: 2026,
      week,
      awayTeam: pairs[i % pairs.length][0],
      homeTeam: pairs[i % pairs.length][1],
      kickoffAt: new Date(deadlineAt.getTime() + (i + 1) * 60_000),
    }));
    const open = await openWeekCore(
      service,
      seasonRow,
      week,
      { games, spreads: games.map((g) => ({ externalId: g.externalId, spreadLine: 3.5, awayMoneyline: 150, homeMoneyline: -180 })), finals: new Map(), raw: [] },
      { opensAt, deadlineAt },
    );
    check(open.status === "succeeded", `week ${week} slate open (${JSON.stringify(open.detail)})`);

    // Double-fire: a retried cron must not ante the league twice (acceptance 16).
    const before = await balances();
    const rerun = await openWeekCore(
      service,
      seasonRow,
      week,
      { games, spreads: [], finals: new Map(), raw: [] },
      { opensAt, deadlineAt },
    );
    check(rerun.status === "skipped", `week ${week} double slate-open skipped`);
    check((await balances()).total === before.total, `week ${week} double-open moved no chips`);

    // Stop here on request, leaving a genuine OPEN week on the board: antes posted, a
    // real slate, no tickets. That is the one league state the full run never leaves
    // behind, and it is the only way to look at the betting board (BetSlip) at all.
    if (process.env.TORTURE_STOP_AFTER_OPEN === String(week)) {
      const b0 = await balances();
      console.log(
        `\nStopped after week ${week} slate open — board is OPEN, ${N} players anted, stacks at ${
          [...b0.stacks.values()][0]
        }, pot ${b0.pot}.`,
      );
      console.log(failures === 0 ? "✅ OPEN BOARD READY" : `✕ ${failures} failure(s)`);
      process.exit(failures === 0 ? 0 : 1);
    }

    const { data: weekRow } = await service.from("weeks").select("*").eq("number", week).single();
    const { data: gameRows } = await service.from("games").select("id, external_id, on_slate").eq("week_id", weekRow.id);
    const slateGames = (gameRows ?? []).filter((g) => g.on_slate);
    // ── D-034 A: approved MID-WEEK, pre-deadline → dealt into THIS week ────────
    // Runs before the snapshot read and before the blackout window opens, exactly
    // where a real approval lands: the ante is part of the week's opening batch.
    if (week === 4) {
      const wesId = await approveLatecomer("Wes", "Latimer", "test_late_wes");
      await admitToOpenWeek(service, wesId);
      const { data: wesSnap } = await service
        .from("week_players").select("*").eq("week_id", weekRow.id).eq("player_id", wesId).maybeSingle();
      check(!!wesSnap, `week ${week} latecomer has a week_players snapshot`);
      const expectedLimit = houseLimit(500 - weekRow.ante, weekRow.median_snapshot);
      check(
        Number(wesSnap?.house_limit) === expectedLimit,
        `week ${week} latecomer limit ${wesSnap?.house_limit} ≠ ${expectedLimit} (frozen median §4)`,
      );
      check(wesSnap?.felt === false, `week ${week} latecomer wrongly felt`);
      const { data: wesAnte } = await service
        .from("ledger_entries").select("amount").eq("player_id", wesId).eq("week_id", weekRow.id).eq("kind", "ante");
      check(
        (wesAnte ?? []).length === 1 && Number(wesAnte![0].amount) === -weekRow.ante,
        `week ${week} latecomer ante wrong: ${JSON.stringify(wesAnte)}`,
      );
      // Double-admit must be a no-op — an approval retry cannot ante them twice.
      await admitToOpenWeek(service, wesId);
      const { data: anteTwice } = await service
        .from("ledger_entries").select("id").eq("player_id", wesId).eq("kind", "ante").eq("week_id", weekRow.id);
      check((anteTwice ?? []).length === 1, `week ${week} double-admit posted a second ante`);
      playerIds.push(wesId);
      subs.push("test_late_wes");
      console.log(`        ➕ mid-week admit: Wes L. dealt into week ${week}, ante paid, limit ${wesSnap?.house_limit}`);
    }

    const { data: snaps } = await service.from("week_players").select("*").eq("week_id", weekRow.id);
    const snapOf = new Map((snaps ?? []).map((s) => [s.player_id, s]));

    // ── Submissions through the REAL RPC as real users ─────────────────────────
    const blackoutStart = new Date(); // everything at slate open is already posted
    const potBeforeSubmissions = (await balances()).pot;
    const folded: number[] = [];
    let shoves = 0;

    for (let i = 0; i < playerIds.length; i++) {
      const pid = playerIds[i];
      // A removed seat has no week_players row at all — slate open skips it — so this
      // must come before the snapshot read, not after.
      if (removedIds.has(pid)) continue;
      const snap = snapOf.get(pid)!;
      // rand() is consumed either way: the deadweight seat must not shift the
      // deterministic chaos sequence for everyone else.
      const unlucky = rand() < 0.06;
      if (unlucky || pid === deadweightId) {
        folded.push(i);
        continue; // never submits — the deadline job folds them
      }
      const me = asPlayer(subs[i]);

      const wantShove = !shoveWeekByPlayer.has(pid) && rand() < 0.05 && snap.stack_pre_ante >= 1;
      let bets: Array<{ game_id: string; side: string; chips: number }>;
      let isShove = false;

      if (wantShove) {
        isShove = true;
        bets = [
          {
            game_id: slateGames[Math.floor(rand() * slateGames.length)].id,
            side: rand() < 0.5 ? "away" : "home",
            chips: snap.stack_pre_ante,
          },
        ];
      } else if (snap.felt) {
        const chips = Math.max(1, Math.floor(rand() * Number(snap.house_limit)));
        bets = [{ game_id: slateGames[0].id, side: rand() < 0.5 ? "away" : "home", chips }];
      } else {
        const limit = Number(snap.house_limit);
        const minGames = Math.min(5, Math.max(1, Math.floor(limit / 10)));
        const targetGames = Math.min(minGames + Math.floor(rand() * 3), Math.floor(limit / 10));
        bets = [];
        let committed = 0;
        // Distinct games per slip — the DB's one-bet-per-game constraint is not a suggestion.
        const gameOrder = slateGames.map((_, idx) => idx).sort(() => rand() - 0.5);
        for (let g = 0; g < Math.max(targetGames, 0); g++) {
          // Reserve 10 chips per still-required game so the slip always clears the
          // §3/§4 minimum — the same arithmetic the real UI enforces.
          const stillNeeded = Math.max(0, minGames - bets.length - 1);
          const room = limit - committed - 10 * stillNeeded;
          if (room < 10) break;
          const chips = Math.min(10 * (1 + Math.floor(rand() * 5)), 50, 10 * Math.floor(room / 10));
          bets.push({ game_id: slateGames[gameOrder[g]].id, side: rand() < 0.5 ? "away" : "home", chips });
          committed += chips;
        }
        if (bets.length === 0) {
          folded.push(i);
          continue;
        }
      }

      const { error } = await me.rpc("submit_ticket", { p_week_id: weekRow.id, p_is_shove: isShove, p_bets: bets });
      check(!error, `week ${week} submit by player ${i}${isShove ? " (SHOVE)" : ""}: ${error?.message ?? ""}`);
      if (!error && isShove) {
        shoves++;
        shoveWeekByPlayer.set(pid, week);
      }

      // ── Blackout probes (sampled): a rival sees nothing, and nothing moved ───
      if (i % 9 === 0) {
        const rival = asPlayer(subs[(i + 1) % playerIds.length]);
        const { data: foreignTickets } = await rival.from("tickets").select("id, player_id").eq("week_id", weekRow.id);
        check(
          (foreignTickets ?? []).every((t) => t.player_id === playerIds[(i + 1) % playerIds.length]),
          `week ${week} BLACKOUT: rival saw a foreign ticket after player ${i} submitted`,
        );
        const nowPot = (await balances()).pot;
        check(nowPot === potBeforeSubmissions, `week ${week} BLACKOUT: the Pot moved during submissions (${potBeforeSubmissions} → ${nowPot})`);
      }
    }

    // Acceptance 24a: no ledger entry lands between the ante batch and the reveal.
    const revealStart = new Date();
    const { count: midWindow } = await service
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("week_id", weekRow.id)
      .gt("created_at", blackoutStart.toISOString())
      .lt("created_at", revealStart.toISOString());
    check((midWindow ?? 0) === 0, `week ${week} no ledger writes during the blackout (found ${midWindow})`);

    // ── Deadline: auto-fold + reveal (real job; deadline flipped to the past) ───
    await service.from("weeks").update({ deadline_at: new Date(Date.now() - 1000).toISOString() }).eq("id", weekRow.id);

    // ── D-034 B: approved AFTER the deadline → next week's player, full stop ────
    // No snapshot, no ante, and — the part the reveal must get right — no phantom
    // auto-fold and no stalled reveal waiting on someone who cannot submit.
    let postDeadlineId: string | null = null;
    if (week === 10) {
      postDeadlineId = await approveLatecomer("Nora", "Quist", "test_late_nora");
      await admitToOpenWeek(service, postDeadlineId);
      const { data: noraSnap } = await service
        .from("week_players").select("player_id").eq("week_id", weekRow.id).eq("player_id", postDeadlineId);
      check((noraSnap ?? []).length === 0, `week ${week} post-deadline admit created a snapshot`);
      const { data: noraLedger } = await service
        .from("ledger_entries").select("id").eq("player_id", postDeadlineId).eq("kind", "ante");
      check((noraLedger ?? []).length === 0, `week ${week} post-deadline admit charged an ante`);
      playerIds.push(postDeadlineId);
      subs.push("test_late_nora");
      console.log(`        ➕ post-deadline admit: Nora Q. holds 500, joins at week ${week + 1}`);
    }

    const revealOutcome = await revealDeadline(service);
    check(revealOutcome.status === "succeeded", `week ${week} reveal (${JSON.stringify(revealOutcome.detail)})`);

    if (postDeadlineId) {
      const { data: phantom } = await service
        .from("tickets").select("id").eq("week_id", weekRow.id).eq("player_id", postDeadlineId);
      check((phantom ?? []).length === 0, `week ${week} post-deadline joiner was phantom-folded`);
    }

    // Post-reveal: RLS opens — a player sees every ticket.
    const anyone = asPlayer(subs[0]);
    const { data: allTickets } = await anyone.from("tickets").select("id").eq("week_id", weekRow.id);
    check((allTickets ?? []).length === (snaps ?? []).length, `week ${week} post-reveal ticket visibility (${allTickets?.length}/${(snaps ?? []).length})`);

    // ── Scores + settlement (real job; conservation asserts inside) ────────────
    for (const g of slateGames) {
      const r = rand();
      if (r < 0.015) {
        await service.from("games").update({ status: "cancelled", void_reason: "cancelled" }).eq("id", g.id);
      } else if (r < 0.035) {
        await service.from("games").update({ status: "final", away_score: 20, home_score: 20 }).eq("id", g.id);
      } else {
        const away = 10 + Math.floor(rand() * 30);
        let home = 10 + Math.floor(rand() * 30);
        if (home === away) home++;
        await service.from("games").update({ status: "final", away_score: away, home_score: home }).eq("id", g.id);
      }
    }
    const settle = await settleCurrentWeek(service);
    check(settle.status === "succeeded", `week ${week} settlement (${JSON.stringify(settle.detail)})`);

    // Voided shoves give the card back — mirror the returned card in our tracker.
    const returned = (settle.detail as { returnedShoves?: number })?.returnedShoves ?? 0;
    if (returned > 0) {
      const { data: cardHolders } = await service.from("players").select("id").is("shove_used_week", null);
      for (const p of cardHolders ?? []) shoveWeekByPlayer.delete(p.id);
    }

    // ── Weekly conservation, straight SQL truth ────────────────────────────────
    const b = await balances();
    check(b.total === playerIds.length * 500, `week ${week} CONSERVATION: ${b.total} ≠ ${playerIds.length * 500}`);
    check(
      [...b.stacks.entries()].every(([id, s]) => (removedIds.has(id) ? s === 0 : s >= 1)),
      `week ${week} a stack fell below 1 (or a removed seat is not exactly empty)`,
    );

    // ── The number the player actually READS ───────────────────────────────────
    // Conservation can hold while the screen still lies: every chip figure in the app
    // comes from the standings view, not from this script's sum. Assert the view agrees
    // with the ledger for every player, every week — a stale or mis-joined view would
    // show a wrong stack on the dashboard with the books perfectly balanced.
    // Read it the way the app does: through RLS, as a player. The service role fails
    // ante.is_approved() and would silently get zero rows — which is itself worth
    // asserting, since a silently empty standings view renders an em-dash, not an error.
    const { data: standingRows } = await asPlayer(subs[0])
      .from("standings")
      .select("player_id, first_name, last_name, stack, rank, status");
    const viewRows = standingRows ?? [];
    check(viewRows.length > 0, `week ${week} standings view returned nothing`);
    for (const r of viewRows) {
      const truth = b.stacks.get(r.player_id) ?? 0;
      check(
        Number(r.stack) === truth,
        `week ${week} STANDINGS DRIFT for ${r.player_id}: view ${r.stack} ≠ ledger ${truth}`,
      );
    }
    // And the rail's claim about who leads must be the REAL rail code's claim,
    // checked against the ledger. (The first version of this assert re-derived the
    // leader inline with the same predicate it then tested — vacuously true on every
    // input. Review D-036 replaced it with the actual leaderFrom call.)
    const live = viewRows.filter((r) => r.status === "approved");
    const topStack = Math.max(...live.map((r) => Number(r.stack)));
    const atTopCount = live.filter((r) => Number(r.stack) === topStack).length;
    const rail = leaderFrom(viewRows);
    if (atTopCount === 1) {
      check(
        rail.kind === "leader" && rail.stack === topStack,
        `week ${week} rail says ${JSON.stringify(rail)} but the ledger has one leader at ${topStack}`,
      );
    } else {
      check(
        rail.kind === "tied" && rail.stack === topStack && rail.count === atTopCount,
        `week ${week} rail says ${JSON.stringify(rail)} but the ledger has ${atTopCount} tied at ${topStack}`,
      );
    }

    const feltCount = (snaps ?? []).filter((s) => s.felt).length;
    console.log(
      `Week ${String(week).padStart(2)} ✓  ${Date.now() - t0}ms  folds=${folded.length} shoves=${shoves} felt=${feltCount} pot=${b.pot} total=${b.total}`,
    );

    // ── The deadweight rule, end to end (D-041, §14) ──────────────────────────
    // Runs at week 12 — after the week has settled and revealed, which is the only
    // moment §6 allows a removal, and long past the three-week threshold.
    if (week === 12) {
      const bBefore = await balances();
      const deadStack = bBefore.stacks.get(deadweightId) ?? 0;

      // The rule's own gate, computed the way the console computes it: consecutive
      // most-recent revealed weeks with an auto-fold on the books.
      const { data: revealedWeeks } = await service
        .from("weeks").select("id, number").not("revealed_at", "is", null).order("number", { ascending: false });
      const { data: dwTickets } = await service
        .from("tickets").select("week_id, is_fold").eq("player_id", deadweightId);
      const dwByWeek = new Map((dwTickets ?? []).map((t) => [t.week_id, t.is_fold]));
      let missed = 0;
      for (const w of revealedWeeks ?? []) {
        if (dwByWeek.get(w.id) !== true) break;
        missed++;
      }
      check(missed >= 3, `deadweight seat missed only ${missed} straight weeks, expected ≥ 3`);

      const recipients = (
        await service.from("players").select("id").eq("status", "approved").neq("id", deadweightId)
      ).data!.map((r) => r.id);

      const plan = computeRemoval({
        playerId: deadweightId,
        stack: deadStack,
        recipientIds: recipients,
        who: "Deadweight D.",
      });

      const { error: remErr } = await service.from("ledger_entries").insert(
        plan.entries.map((e) => ({
          player_id: e.account,
          kind: e.kind,
          amount: e.amount,
          reason: e.reason,
          idempotency_key: `removal:${deadweightId}:${e.account ?? "pot"}`,
        })),
      );
      check(!remErr, `removal ledger insert failed: ${remErr?.message}`);
      await service
        .from("players")
        .update({ status: "removed", removed_at: new Date().toISOString(), removal_reason: "torture: deadweight" })
        .eq("id", deadweightId);
      removedIds.add(deadweightId);

      const bAfter = await balances();

      // 1 — nothing created, nothing destroyed. A removal is a transfer (§5).
      check(bAfter.total === bBefore.total, `removal CONSERVATION: ${bBefore.total} → ${bAfter.total}`);
      // 2 — the seat is exactly empty, not merely small.
      check((bAfter.stacks.get(deadweightId) ?? -1) === 0, `removed seat holds ${bAfter.stacks.get(deadweightId)}, expected 0`);
      // 3 — every remaining player gained exactly the share, nobody gained twice.
      const wrong = recipients.filter(
        (id) => (bAfter.stacks.get(id) ?? 0) - (bBefore.stacks.get(id) ?? 0) !== plan.share,
      );
      check(wrong.length === 0, `${wrong.length} recipients did not gain exactly ${plan.share}`);
      // 4 — the odd chips went to the Pot, and only the odd chips.
      check(bAfter.pot - bBefore.pot === plan.remainder, `Pot moved ${bAfter.pot - bBefore.pot}, expected remainder ${plan.remainder}`);
      check(plan.remainder < recipients.length, `remainder ${plan.remainder} is not smaller than the field (${recipients.length})`);
      // 5 — the engine's own assertion accepts the zeroed seat, and would reject a
      //     half-drained one. This is the new invariants.ts branch under real data.
      const allRows = await fetchAllLedger();
      assertInvariants(allRows);
      // 6 — the player is gone from the surface players actually read.
      const { data: stand } = await asPlayer(subs[0]).from("standings").select("player_id");
      check(
        !(stand ?? []).some((r) => r.player_id === deadweightId),
        "removed player is still visible in the standings view",
      );
      // 7 — a re-run must not pay anybody twice.
      const { error: dupErr } = await service.from("ledger_entries").insert(
        plan.entries.map((e) => ({
          player_id: e.account,
          kind: e.kind,
          amount: e.amount,
          reason: e.reason,
          idempotency_key: `removal:${deadweightId}:${e.account ?? "pot"}`,
        })),
      );
      check(!!dupErr, "a repeated removal was NOT rejected by the idempotency index");
      check((await balances()).total === bBefore.total, "repeated removal moved chips");

      console.log(
        `        ✂ removed deadweight seat after ${missed} missed weeks: ${deadStack} chips → ${plan.share} each to ${recipients.length} players, ${plan.remainder} to the Pot`,
      );
    }

    // ── Mid-season correction: re-settle week 5 after week 8 (the cascade) ─────
    if (week === 8) {
      preFingerprint = await ticketFingerprint();
      const b1 = await balances();
      const cascade = await resettleFromWeek(service, 5, "torture-test cascade");
      check(cascade.status === "succeeded", `re-settlement cascade (${JSON.stringify(cascade.detail)})`);
      const b2 = await balances();
      check(b2.total === playerIds.length * 500, `post-cascade CONSERVATION: ${b2.total}`);
      check((await ticketFingerprint()) === preFingerprint, "post-cascade tickets byte-identical (acceptance 28)");
      // Nothing changed — no corrected score, no edited game. Replaying identical
      // inputs must land on identical numbers, so every stack and the Pot must be
      // exactly where they were. Total conservation alone cannot see this: the Pot
      // absorbs any leak and the total still balances.
      check(b2.pot === b1.pot, `post-cascade POT UNCHANGED on a no-op re-settle: ${b1.pot} → ${b2.pot}`);
      const moved = [...b1.stacks.entries()].filter(([id, v]) => b2.stacks.get(id) !== v);
      check(moved.length === 0, `post-cascade STACKS UNCHANGED on a no-op re-settle: ${moved.length} moved`);
      console.log(`        ↺ re-settled weeks 5–8, pot ${b1.pot} → ${b2.pot}, ${moved.length} stacks moved`);
    }
  }

  const b = await balances();
  console.log(`\nFinal: total=${b.total} pot=${b.pot} min_stack=${Math.min(...b.stacks.values())} max_stack=${Math.max(...b.stacks.values())}`);
  console.log(`${failures === 0 ? "✅ SEASON CLEAN" : `❌ ${failures} FAILURES`} — ${((Date.now() - START) / 1000).toFixed(1)}s`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("TORTURE TEST CRASHED:", e);
  process.exit(1);
});
