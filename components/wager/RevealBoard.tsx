import { DateTime } from "luxon";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { multiplierFor, formatMultiplier } from "@/lib/engine";
import { ET } from "@/lib/time";
import { RevealExperience, type RevealData } from "./RevealExperience";

// Server assembly of the revealed board (ANTE-PLAYER §5.4). Every read here runs as
// the requesting user: these rows are only reachable because revealed_at is set —
// the same RLS that sealed them all week is what now serves them.

export async function RevealBoard({
  week,
  playerId,
}: {
  week: { id: string; number: number; revealed_at: string | null };
  playerId: string;
}) {
  const db = createUserClient();

  const [{ data: tickets }, { data: games }, { data: players }] = await Promise.all([
    db
      .from("tickets")
      .select("id, player_id, is_fold, is_shove, total_chips, committed_stake")
      .eq("week_id", week.id),
    db
      .from("games")
      .select("id, away_team, home_team, spread_frozen, kickoff_at, on_slate")
      .eq("week_id", week.id)
      .eq("on_slate", true)
      .order("kickoff_at"),
    db.from("players").select("id, first_name, last_name").in("status", ["approved", "deactivated"]),
  ]);

  const { data: bets } = await db
    .from("bets")
    .select("ticket_id, game_id, side, chips")
    .in("ticket_id", (tickets ?? []).map((t) => t.id));

  const nameOf = (id: string) => {
    const p = (players ?? []).find((x) => x.id === id);
    return p ? `${p.first_name ?? ""} ${(p.last_name ?? "").slice(0, 1)}.`.trim() || "—" : "—";
  };
  const ticketById = new Map((tickets ?? []).map((t) => [t.id, t]));

  // Per-game sides: entries, head counts, multipliers (§5 — heads, not chips).
  const gameData: RevealData["games"] = (games ?? []).map((g) => {
    const entries = (bets ?? [])
      .filter((b) => b.game_id === g.id)
      .map((b) => {
        const t = ticketById.get(b.ticket_id)!;
        return {
          playerId: t.player_id,
          name: nameOf(t.player_id),
          chips: b.chips,
          side: b.side as "away" | "home",
          isShove: t.is_shove,
        };
      });
    const away = entries.filter((e) => e.side === "away");
    const home = entries.filter((e) => e.side === "home");
    const price = (withCount: number, againstCount: number) =>
      withCount === 0 ? null : formatMultiplier(multiplierFor(withCount, againstCount));
    return {
      id: g.id,
      away: g.away_team,
      home: g.home_team,
      spread: g.spread_frozen,
      kickoff: DateTime.fromISO(g.kickoff_at).setZone(ET).toFormat("ccc h:mma"),
      sides: {
        away: { count: away.length, pays: price(away.length, home.length), entries: away },
        home: { count: home.length, pays: price(home.length, away.length), entries: home },
      },
    };
  });

  const gameLabel = new Map(gameData.map((g) => [g.id, `${g.away} @ ${g.home}`]));
  const playerData: RevealData["players"] = (tickets ?? [])
    .map((t) => ({
      playerId: t.player_id,
      name: nameOf(t.player_id),
      isFold: t.is_fold,
      isShove: t.is_shove,
      totalChips: t.is_shove ? (t.committed_stake ?? 0) : t.total_chips,
      isMe: t.player_id === playerId,
      bets: (bets ?? [])
        .filter((b) => b.ticket_id === t.id)
        .map((b) => {
          const g = gameData.find((x) => x.id === b.game_id)!;
          return {
            label: gameLabel.get(b.game_id) ?? "",
            team: b.side === "away" ? g.away : g.home,
            chips: b.chips,
            // §8 — a shove always pays even money, no multiplier, ever. The crowd price
            // on that side is what everyone ELSE collects: the shover moved it (§14) but
            // does not ride it. settleWeek already pays 1× here; showing the side's
            // multiplier told the room a 490 shove paid 2.5× when it pays 490.
            pays: t.is_shove
              ? formatMultiplier({ num: 1, den: 1 })
              : g.sides[b.side as "away" | "home"].pays,
          };
        }),
    }))
    .sort((a, b) => (a.isShove === b.isShove ? a.name.localeCompare(b.name) : a.isShove ? -1 : 1));

  const shoves = playerData
    .filter((p) => p.isShove)
    .map((p) => ({ name: p.name, stake: p.totalChips, team: p.bets[0]?.team ?? "—" }));

  const copyEntries = await Promise.all(
    (
      [
        ["interstitialTitle", "reveal.interstitial_title"],
        ["interstitialSub", "reveal.interstitial_sub"],
        ["enterCta", "reveal.enter_cta"],
        ["shoveBeatTitle", "reveal.shove_beat_title"],
        ["shoveBeatBody", "reveal.shove_beat_body"],
        ["byGameLabel", "reveal.by_game_label"],
        ["byPlayerLabel", "reveal.by_player_label"],
        ["foldedLabel", "reveal.folded_label"],
        ["shoveLabel", "reveal.shove_label"],
        ["paysLabel", "reveal.pays_label"],
        ["nobodyLabel", "reveal.nobody_label"],
        ["youLabel", "reveal.you_label"],
      ] as const
    ).map(async ([k, key]) => [k, await getContent(key)] as const),
  );

  const data: RevealData = {
    weekNumber: week.number,
    games: gameData,
    players: playerData,
    shoves,
    copy: Object.fromEntries(copyEntries) as unknown as RevealData["copy"],
  };

  return <RevealExperience data={data} />;
}
