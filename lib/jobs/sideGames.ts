import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  assertInvariants,
  InvariantViolation,
  planSideGameWeek,
  sideGameKeyPrefix,
  sideRowToEngine,
  SideGameError,
  SIDE_GAMES,
  SIDE_GAME_NAMES,
  SIDE_GAMES_LAST_WEEK,
  type SideAccount,
  type SideGame,
  type SideGamePlan,
  type SideGameRow,
} from "@/lib/engine";
import { fullLedgerForEngine, sideAccountBalances, stacksByPlayer } from "./util";

// The side-game settlement door (D-132). ANTE Play decides who won and publishes it
// read-only; this reads that result, works out every chip with the pure engine
// (lib/engine/sideGames.ts), and writes the whole week in ONE insert with Ante's own
// key. The console's "Post side-game results" button and the season torture test
// both come through postSideGames — the torture test hands it results objects
// directly instead of fetching them over HTTP.

// ── The results contract (ANTE Play GET /api/results?season=&week=) ──────────────
const ResultsSchema = z.object({
  season: z.number().int(),
  week: z.number().int().min(1).max(SIDE_GAMES_LAST_WEEK),
  closed: z.boolean(),
  final: z.boolean(),
  games: z.array(
    z.object({
      game: z.enum(["bingo", "crunch"]),
      entrants: z.array(z.object({ ante_player_id: z.string().min(1), display_name: z.string().optional().nullable() })),
      order: z.array(z.array(z.string().min(1))),
      solo_won: z.boolean().nullable().optional(),
    }),
  ),
});
export type PlayResults = z.infer<typeof ResultsSchema>;

export function parsePlayResults(raw: unknown): PlayResults {
  const r = ResultsSchema.safeParse(raw);
  if (!r.success) throw new SideGameError(`ANTE Play's results are not in the agreed shape: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  return r.data;
}

export function playResultsUrl(): string | null {
  const u = process.env.ANTE_PLAY_RESULTS_URL?.trim();
  return u ? u.replace(/\/+$/, "") : null;
}

/** Fetch one week's results from ANTE Play. Never cached: the button re-fetches. */
export async function fetchPlayResults(season: number, week: number): Promise<PlayResults> {
  const base = playResultsUrl();
  if (!base) throw new SideGameError("ANTE_PLAY_RESULTS_URL is not set.");
  const res = await fetch(`${base}/api/results?season=${season}&week=${week}`, { cache: "no-store" });
  if (!res.ok) throw new SideGameError(`ANTE Play answered HTTP ${res.status} for Week ${week}.`);
  return parsePlayResults(await res.json());
}

// ── Preview: everything the commissioner sees before a chip moves ────────────────
export interface SideGamePreviewGame {
  game: SideGame;
  name: string;
  posted: boolean;
  plan: SideGamePlan | null;
}

export interface SideGamePreview {
  season: number;
  week: number;
  weekId: string | null;
  /** Why it cannot post right now. Empty = the button may post. */
  blockers: string[];
  games: SideGamePreviewGame[];
  /** Player names for the preview (Ante's roster first, ANTE Play's name as fallback). */
  names: Record<string, string>;
  before: Record<SideAccount, number>;
  after: Record<SideAccount, number>;
  /** The rows the button would write, in one insert. */
  rows: SideGameRow[];
}

export async function previewSideGames(db: SupabaseClient, results: PlayResults): Promise<SideGamePreview> {
  const blockers: string[] = [];
  const week = results.week;
  if (!results.closed) blockers.push(`ANTE Play says Week ${week}'s entries are not closed yet.`);
  if (!results.final) blockers.push(`ANTE Play says Week ${week}'s games are not all finished yet (final=false). Nothing posts until they are.`);

  const { data: season } = await db.from("seasons").select("id, year").eq("year", results.season).maybeSingle();
  if (!season) blockers.push(`No ${results.season} season in Ante.`);
  const { data: weekRow } = season
    ? await db.from("weeks").select("id, number, settled_at").eq("season_id", season.id).eq("number", week).maybeSingle()
    : { data: null };
  if (season && !weekRow) blockers.push(`Ante has no Week ${week} yet.`);
  if (weekRow && !weekRow.settled_at) {
    blockers.push(`Ante has not settled Week ${week} yet. Side games post only after the week's own settlement (D-132).`);
  }

  // Never mid-blackout: no stack moves between the ante and the reveal (§6).
  const { data: blackout } = await db.from("weeks").select("number").eq("phase", "open").is("revealed_at", null).limit(1).maybeSingle();
  if (blackout) {
    blockers.push(`Week ${blackout.number} is mid-blackout. Side-game chips move every entrant's stack — wait for the reveal (§6).`);
  }

  // Rollover runs forward in week order: posting an earlier week after a later one
  // would hand the later week's pool to the earlier week's winners.
  if (season) {
    const { data: later } = await db.from("weeks").select("id, number").eq("season_id", season.id).gt("number", week);
    const laterIds = (later ?? []).map((w) => w.id);
    if (laterIds.length > 0) {
      const { data: laterPlay } = await db
        .from("ledger_entries")
        .select("week_id")
        .in("week_id", laterIds)
        .like("idempotency_key", "play:%")
        .limit(1);
      if ((laterPlay ?? []).length > 0) {
        const n = (later ?? []).find((w) => w.id === laterPlay![0].week_id)?.number;
        blockers.push(`Week ${n}'s side games are already posted. Weeks post in order — Week ${week} can't go in behind it.`);
      }
    }
  }

  // Already posted, detected by the rows' own idempotency keys.
  const postedGames = new Set<SideGame>();
  if (weekRow) {
    const { data: keys } = await db
      .from("ledger_entries")
      .select("idempotency_key")
      .eq("week_id", weekRow.id)
      .like("idempotency_key", "play:%");
    for (const g of SIDE_GAMES) {
      const prefix = `${sideGameKeyPrefix(g, week)}:`;
      if ((keys ?? []).some((k) => (k.idempotency_key ?? "").startsWith(prefix))) postedGames.add(g);
    }
  }

  const [stacksAll, before] = await Promise.all([stacksByPlayer(db), sideAccountBalances(db)]);
  stacksAll.delete("__pot__");

  let plans: SideGamePlan[] = [];
  try {
    plans = planSideGameWeek({
      week,
      games: results.games.map((g) => ({
        game: g.game,
        entrants: g.entrants.map((e) => e.ante_player_id),
        order: g.order,
        soloWon: g.solo_won ?? null,
      })),
      pools: before,
      stacks: stacksAll,
      skip: postedGames,
    });
  } catch (e) {
    if (!(e instanceof SideGameError)) throw e;
    blockers.push(e.message);
  }

  const rows = plans.flatMap((p) => p.rows);
  const after = { ...before };
  for (const r of rows) if (r.account) after[r.account] += r.amount;

  // Names: Ante's own roster, ANTE Play's display name when Ante has no such player.
  const ids = new Set(results.games.flatMap((g) => g.entrants.map((e) => e.ante_player_id)));
  const names: Record<string, string> = {};
  for (const g of results.games) for (const e of g.entrants) names[e.ante_player_id] = e.display_name ?? e.ante_player_id.slice(0, 8);
  if (ids.size > 0) {
    const { data: ps } = await db.from("players").select("id, first_name, last_name").in("id", [...ids]);
    for (const p of ps ?? []) names[p.id] = `${p.first_name ?? ""} ${(p.last_name ?? "").slice(0, 1)}${p.last_name ? "." : ""}`.trim();
  }

  const games: SideGamePreviewGame[] = SIDE_GAMES.map((g) => ({
    game: g,
    name: SIDE_GAME_NAMES[g],
    posted: postedGames.has(g),
    plan: plans.find((p) => p.game === g) ?? null,
  }));

  return { season: results.season, week, weekId: weekRow?.id ?? null, blockers, games, names, before, after, rows };
}

// ── Post: one insert, then the conservation assertion over the whole ledger ──────
export interface SideGamePostOutcome {
  status: "succeeded" | "skipped" | "failed";
  message: string;
  preview: SideGamePreview;
}

export async function postSideGames(db: SupabaseClient, results: PlayResults): Promise<SideGamePostOutcome> {
  const preview = await previewSideGames(db, results);
  const week = results.week;
  if (preview.blockers.length > 0) return { status: "failed", message: preview.blockers.join(" "), preview };
  if (!preview.weekId) return { status: "failed", message: `No Week ${week} in Ante.`, preview };

  const unposted = preview.games.filter((g) => !g.posted);
  if (preview.rows.length === 0) {
    const allPosted = unposted.length === 0;
    return {
      status: "skipped",
      message: allPosted ? `Week ${week}'s side games are already posted.` : `Week ${week}: nothing to post — no eligible entrants and no pool to sweep.`,
      preview,
    };
  }

  // Gate: the whole ledger plus the would-be rows must balance BEFORE anything is
  // written (§8.12 posture — the same check settlement runs).
  const ledger = await fullLedgerForEngine(db);
  try {
    assertInvariants([...ledger, ...preview.rows.map(sideRowToEngine)]);
  } catch (e) {
    if (e instanceof InvariantViolation) return { status: "failed", message: `Refused before writing: ${e.message}`, preview };
    throw e;
  }

  // ONE insert: every row of every unposted game lands, or none does. A repeat post
  // collides on ledger_idempotency (week_id, idempotency_key, player_id).
  const { error } = await db.from("ledger_entries").insert(
    preview.rows.map((r) => ({
      player_id: r.playerId,
      account: r.account,
      week_id: preview.weekId,
      kind: r.kind,
      amount: r.amount,
      reason: r.reason,
      idempotency_key: r.idempotencyKey,
    })),
  );
  if (error) {
    if (error.message.includes("duplicate key")) {
      return { status: "skipped", message: `Week ${week}'s side games were already posted (the ledger refused a repeat). Nothing changed.`, preview };
    }
    return { status: "failed", message: `Side-game posting failed: ${error.message}`, preview };
  }

  // Report: conservation over the full ledger as it now stands.
  try {
    const b = assertInvariants(await fullLedgerForEngine(db));
    return {
      status: "succeeded",
      message: `Posted ${preview.rows.length} rows for Week ${week} (${unposted.map((g) => g.name).join(", ")}). Conservation holds: house ${b.sides.play_house}, Bingo pool ${b.sides.play_pool_bingo}, Crunch Time pool ${b.sides.play_pool_crunch}.`,
      preview,
    };
  } catch (e) {
    if (e instanceof InvariantViolation) {
      return { status: "failed", message: `Posted, but the conservation check now FAILS: ${e.message}`, preview };
    }
    throw e;
  }
}
