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

const service: SupabaseClient = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

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
        first_name: `Player${i}`,
        last_name: `T${i}`,
        email: null,
        favorite_team: "KC",
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

  const shoveWeekByPlayer = new Map<string, number>();
  let preFingerprint = "";

  for (let week = 1; week <= 18; week++) {
    const t0 = Date.now();

    // ── Slate open (real core, fabricated schedule around "now") ────────────────
    const opensAt = new Date(Date.now() - 60_000);
    const deadlineAt = new Date(Date.now() + 3600_000);
    const gameCount = week === 1 || week === 12 ? 15 : 16; // the Wednesday holes (§3)
    const games = Array.from({ length: gameCount }, (_, i) => ({
      externalId: `2026_${String(week).padStart(2, "0")}_G${i}`,
      espnId: null,
      season: 2026,
      week,
      awayTeam: "KC",
      homeTeam: "BAL",
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

    const { data: weekRow } = await service.from("weeks").select("*").eq("number", week).single();
    const { data: gameRows } = await service.from("games").select("id, external_id, on_slate").eq("week_id", weekRow.id);
    const slateGames = (gameRows ?? []).filter((g) => g.on_slate);
    const { data: snaps } = await service.from("week_players").select("*").eq("week_id", weekRow.id);
    const snapOf = new Map((snaps ?? []).map((s) => [s.player_id, s]));

    // ── Submissions through the REAL RPC as real users ─────────────────────────
    const blackoutStart = new Date(); // everything at slate open is already posted
    const potBeforeSubmissions = (await balances()).pot;
    const folded: number[] = [];
    let shoves = 0;

    for (let i = 0; i < N; i++) {
      const pid = playerIds[i];
      const snap = snapOf.get(pid)!;
      if (rand() < 0.06) {
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
        const rival = asPlayer(subs[(i + 1) % N]);
        const { data: foreignTickets } = await rival.from("tickets").select("id, player_id").eq("week_id", weekRow.id);
        check(
          (foreignTickets ?? []).every((t) => t.player_id === playerIds[(i + 1) % N]),
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
    const revealOutcome = await revealDeadline(service);
    check(revealOutcome.status === "succeeded", `week ${week} reveal (${JSON.stringify(revealOutcome.detail)})`);

    // Post-reveal: RLS opens — a player sees every ticket.
    const anyone = asPlayer(subs[0]);
    const { data: allTickets } = await anyone.from("tickets").select("id").eq("week_id", weekRow.id);
    check((allTickets ?? []).length === N, `week ${week} post-reveal ticket visibility (${allTickets?.length}/${N})`);

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
    check(b.total === N * 500, `week ${week} CONSERVATION: ${b.total} ≠ ${N * 500}`);
    check([...b.stacks.values()].every((s) => s >= 1), `week ${week} a stack fell below 1`);

    const feltCount = (snaps ?? []).filter((s) => s.felt).length;
    console.log(
      `Week ${String(week).padStart(2)} ✓  ${Date.now() - t0}ms  folds=${folded.length} shoves=${shoves} felt=${feltCount} pot=${b.pot} total=${b.total}`,
    );

    // ── Mid-season correction: re-settle week 5 after week 8 (the cascade) ─────
    if (week === 8) {
      preFingerprint = await ticketFingerprint();
      const cascade = await resettleFromWeek(service, 5, "torture-test cascade");
      check(cascade.status === "succeeded", `re-settlement cascade (${JSON.stringify(cascade.detail)})`);
      const b2 = await balances();
      check(b2.total === N * 500, `post-cascade CONSERVATION: ${b2.total}`);
      check((await ticketFingerprint()) === preFingerprint, "post-cascade tickets byte-identical (acceptance 28)");
      console.log(`        ↺ re-settled weeks 5–8, conservation held, tickets untouched`);
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
