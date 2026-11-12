import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Block, EmailDoc } from "./render";

// "From the table" (D-134): the closing section of every league email, replacing "Why I
// built this". One real moment from the latest settled week, told as a two-line story —
// a long shot that paid, the Pot winner, or the side the whole room piled onto that
// lost. Picked at random among the moments that exist, then held for ten minutes so one
// send (a broadcast loops over every player) tells everyone the same story.
//
// Only post-reveal, post-settlement facts: nothing here can leak a pick before the
// reveal (the blackout), because it reads settled weeks only.

export interface Story {
  title: string;
  paras: string[];
}

interface Named {
  first_name: string | null;
  last_name: string | null;
}
const nameOf = (p: Named | null | undefined) => {
  const f = (p?.first_name ?? "").trim() || "Someone";
  const l = (p?.last_name ?? "").trim();
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

export async function buildStory(db: SupabaseClient, pick: () => number = Math.random): Promise<Story | null> {
  const { data: week } = await db
    .from("weeks")
    .select("id, number")
    .not("settled_at", "is", null)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!week) return null;

  const { data: teamRows } = await db.from("teams").select("code, name");
  const team = new Map((teamRows ?? []).map((t: any) => [t.code, t.name as string]));
  const teamName = (code: string) => team.get(code) ?? code;

  const { data: bets } = await db
    .from("bets")
    .select("chips, multiplier, payout, side, result, game_id, tickets!inner(week_id, player_id, players(first_name, last_name)), games(away_team, home_team)")
    .eq("tickets.week_id", week.id);

  const stories: Story[] = [];
  const title = `From the table · Week ${week.number}`;
  const rows = (bets ?? []) as any[];

  // 1. The long shot: the biggest multiplier that won.
  const won = rows.filter((b) => b.result === "won" && b.multiplier != null).sort((a, b) => Number(b.multiplier) - Number(a.multiplier));
  if (won.length && Number(won[0].multiplier) >= 1.5) {
    const b = won[0];
    const g = one(b.games);
    const t = one(b.tickets);
    const side = g ? teamName(b.side === "home" ? g.home_team : g.away_team) : "an underdog";
    stories.push({
      title,
      paras: [
        `${nameOf(one(t?.players))} put ${b.chips} chips on the ${side} when almost nobody else would.`,
        `It paid ${Number(b.multiplier).toFixed(2)}× — ${b.payout ?? 0} chips of winnings. Fortune favors the lonely.`,
      ],
    });
  }

  // 2. The Pot.
  const { data: pot } = await db
    .from("pot_awards")
    .select("amount, players(first_name, last_name)")
    .eq("week_id", week.id)
    .eq("place", 1)
    .limit(1)
    .maybeSingle();
  if (pot) {
    stories.push({
      title,
      paras: [
        `${nameOf(one((pot as any).players))} had the best week at the table and took the Week ${week.number} Pot: ${(pot as any).amount} chips.`,
        "Every week the Pot goes to whoever gains the most. Yours could be next.",
      ],
    });
  }

  // 3. The crowd got it wrong: the most-backed side that lost.
  const groups = new Map<string, { n: number; lost: boolean; code: string }>();
  for (const b of rows) {
    if (b.result !== "won" && b.result !== "lost") continue;
    const g = one(b.games);
    if (!g) continue;
    const key = `${b.game_id}:${b.side}`;
    const code = b.side === "home" ? g.home_team : g.away_team;
    const cur = groups.get(key) ?? { n: 0, lost: b.result === "lost", code };
    cur.n += 1;
    groups.set(key, cur);
  }
  const players = new Set(rows.map((b) => one(b.tickets)?.player_id)).size;
  const crowd = [...groups.values()].filter((g) => g.lost).sort((a, b) => b.n - a.n)[0];
  if (crowd && crowd.n >= 3) {
    stories.push({
      title,
      paras: [
        `${crowd.n} of ${players} players piled onto the ${teamName(crowd.code)} in Week ${week.number}.`,
        `The ${teamName(crowd.code)} lost. Following the crowd costs chips here — the lonely side pays.`,
      ],
    });
  }

  if (!stories.length) return null;
  return stories[Math.floor(pick() * stories.length) % stories.length];
}

let cached: { at: number; story: Story | null } | null = null;
const HOLD_MS = 10 * 60 * 1000;

/** The story for emails going out now — the same one for every player in a send. */
export async function weeklyStory(db: SupabaseClient): Promise<Story | null> {
  if (cached && Date.now() - cached.at < HOLD_MS) return cached.story;
  let story: Story | null = null;
  try {
    story = await buildStory(db);
  } catch {
    story = null; // a story is a nicety; it never stops an email
  }
  cached = { at: Date.now(), story };
  return story;
}

/** Fill the "From the table" slot, or drop it when there's no story to tell. */
export function fillStory(doc: EmailDoc, story: Story | null): EmailDoc {
  const blocks: Block[] = [];
  for (const b of doc.blocks) {
    if (b.kind === "story" && b.paras.length === 0) {
      if (story) blocks.push({ kind: "story", title: story.title, paras: story.paras });
    } else blocks.push(b);
  }
  return { ...doc, blocks };
}
