import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState } from "@/lib/player";
import { getTeamNames } from "@/lib/teams";
import { playerDials, type ProfileTicket } from "@/lib/stats/player";
import { PlayerSwitcher } from "@/components/player/PlayerSwitcher";

// One player's season (D-104). Reachable from any name on the site, because the
// rulebook makes every past ticket public (§11) and the room should be able to see
// how the leader actually bets rather than guess at it.
//
// REVEALED WEEKS ONLY, and that includes your own profile. RLS already refuses
// another player's unrevealed ticket (tickets_blackout) but it lets you read your
// OWN at any time — so a page anyone can link to would otherwise show the author
// their live ticket on a surface other people visit. One rule, so there is no path
// by which an open ticket reaches a profile.

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

type Game = { away_team: string; home_team: string };
type BetRow = {
  chips: number;
  side: string;
  multiplier: number | null;
  result: string | null;
  payout: number | null;
  games: Game | Game[] | null;
};
type TicketRow = { id: string; week_id: string; is_fold: boolean; is_shove: boolean; bets: BetRow[] | null };

export default async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const state = await getPlayerState();
  if (!state?.player) redirect("/");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const db = createUserClient();
  const [
    { data: who },
    { data: allStandings },
    { data: weekRows },
    teamNames,
    logoAlt,
    backCta,
    emptyMsg,
    rankLabel,
    chipsLabel,
    potsLabel,
    dialsHeading,
    widthLabel,
    weightLabel,
    priceLabel,
    recordLabel,
    weeksHeading,
    weekLabel,
    foldedLabel,
    shovedLabel,
    noneYet,
    switchLabel,
  ] = await Promise.all([
    db.from("players").select("id, first_name, last_name, favorite_team").eq("id", id).maybeSingle(),
    // The whole table in one read: this player's own figures, and the roster the
    // switcher offers. Ordered by rank so the dropdown reads as the standings.
    db.from("standings").select("player_id, first_name, last_name, rank, stack, pots_won").order("rank"),
    db.from("weeks").select("id, number").not("revealed_at", "is", null).order("number", { ascending: false }),
    getTeamNames(),
    getContent("home.logo_alt"),
    getContent("player.back_cta"),
    getContent("player.empty"),
    getContent("dash.header_rank_label"),
    getContent("dash.header_chips_label"),
    getContent("player.pots_label"),
    getContent("player.dials_heading"),
    getContent("player.width_label"),
    getContent("player.weight_label"),
    getContent("player.price_label"),
    getContent("player.record_label"),
    getContent("player.weeks_heading"),
    getContent("player.week_label"),
    getContent("player.folded_label"),
    getContent("player.shoved_label"),
    getContent("player.none_yet"),
    getContent("player.switch_label"),
  ]);
  if (!who) notFound();

  type StandingRow = { player_id: string; first_name: string | null; last_name: string | null; rank: number; stack: number; pots_won: number };
  const standings = (allStandings ?? []) as StandingRow[];
  const standing = standings.find((r) => r.player_id === id) ?? null;
  const roster = standings.map((r) => ({
    id: r.player_id,
    label: `${r.rank} \u00b7 ${`${r.first_name ?? ""} ${(r.last_name ?? "").slice(0, 1)}`.trim()}${r.last_name ? "." : ""}`,
  }));

  const weeks = (weekRows ?? []) as Array<{ id: string; number: number }>;
  const weekNumber = new Map(weeks.map((w) => [w.id, w.number]));
  const revealedIds = weeks.map((w) => w.id);

  const [{ data: ticketRows }, { data: ledger }] = await Promise.all([
    revealedIds.length
      ? db
          .from("tickets")
          .select("id, week_id, is_fold, is_shove, bets(chips, side, multiplier, result, payout, games(away_team, home_team))")
          .eq("player_id", id)
          .in("week_id", revealedIds)
      : Promise.resolve({ data: [] as TicketRow[] }),
    revealedIds.length
      ? db.from("ledger_entries").select("week_id, amount").eq("player_id", id).in("week_id", revealedIds)
      : Promise.resolve({ data: [] as Array<{ week_id: string | null; amount: number }> }),
  ]);

  const gainByWeek = new Map<number, number>();
  for (const e of (ledger ?? []) as Array<{ week_id: string | null; amount: number }>) {
    const n = e.week_id ? weekNumber.get(e.week_id) : undefined;
    if (n !== undefined) gainByWeek.set(n, (gainByWeek.get(n) ?? 0) + e.amount);
  }

  const tickets = (ticketRows ?? []) as TicketRow[];
  const byWeek = new Map(tickets.map((t) => [weekNumber.get(t.week_id) ?? 0, t]));
  const dials = playerDials(
    tickets.map<ProfileTicket>((t) => ({
      week: weekNumber.get(t.week_id) ?? 0,
      isFold: t.is_fold,
      isShove: t.is_shove,
      bets: (t.bets ?? []).map((b) => ({ chips: b.chips, multiplier: b.multiplier, result: b.result, payout: b.payout })),
    })),
  );

  const one = (v: Game | Game[] | null): Game | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const fullName = `${who.first_name ?? ""} ${who.last_name ?? ""}`.trim() || "—";
  const team = who.favorite_team ? (teamNames.get(who.favorite_team) ?? who.favorite_team) : null;
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const widest = Math.max(1, ...[...gainByWeek.values()].map((v) => Math.abs(v)));

  const dialCells: Array<[string, string]> = [
    [widthLabel, dials.avgGames === null ? "—" : String(dials.avgGames)],
    [weightLabel, dials.avgChips === null ? "—" : String(dials.avgChips)],
    [priceLabel, dials.avgMultiplier === null ? "—" : `${dials.avgMultiplier.toFixed(2)}×`],
    [recordLabel, `${dials.betsWon}–${dials.betsLost}`],
  ];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6">
        <header className="rail flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/dashboard" className="shrink-0">
            <Logo alt={logoAlt} width={104} height={66} className="h-auto w-[83px] sm:w-[104px]" priority />
          </Link>
          <Link href="/dashboard" className="text-sm text-[color:var(--color-text-mid)] underline-offset-4 hover:text-[color:var(--color-text-hi)] hover:underline">
            {backCta}
          </Link>
        </header>
      </div>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase italic tracking-tight text-[color:var(--color-heading)] sm:text-4xl">
              {fullName}
            </h1>
            {roster.length > 1 && <PlayerSwitcher label={switchLabel} current={id} players={roster} />}
          </div>
          <hr className="gold-rule w-40" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[color:var(--color-text-mid)]">
            {team && <span>{team}</span>}
            <span>
              {rankLabel} <span className="nums font-semibold text-[color:var(--color-text-hi)]">{standing?.rank ?? "—"}</span>
            </span>
            <span>
              <span className="nums font-semibold text-[color:var(--color-stack)]">{standing?.stack ?? "—"}</span> {chipsLabel}
            </span>
            <span>
              {potsLabel} <span className="nums font-semibold text-[color:var(--color-text-hi)]">{standing?.pots_won ?? 0}</span>
            </span>
          </div>
        </div>

        <section aria-label={dialsHeading} className="panel">
          <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
            {dialsHeading}
          </h2>
          <dl className="grid grid-cols-2 gap-px bg-[color:var(--color-border)] sm:grid-cols-4">
            {dialCells.map(([label, value]) => (
              <div key={label} className="bg-[color:var(--color-surface-1)] px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-low)]">{label}</dt>
                <dd className="nums mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--color-text-hi)]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label={weeksHeading} className="panel">
          <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
            {weeksHeading}
          </h2>
          {weeks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-[color:var(--color-text-mid)]">{emptyMsg}</p>
          ) : (
            <ul>
              {weeks.map((w) => {
                const t = byWeek.get(w.number);
                const gain = gainByWeek.get(w.number) ?? 0;
                const bets = (t?.bets ?? []).slice().sort((a, b) => b.chips - a.chips);
                return (
                  <li key={w.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-baseline gap-3 px-4 py-3 text-sm hover:bg-[color:var(--color-surface-2)] [&::-webkit-details-marker]:hidden">
                        <span aria-hidden className="shrink-0 text-[color:var(--color-gold)] transition-transform group-open:rotate-90">
                          &#9656;
                        </span>
                        <span className="font-semibold text-[color:var(--color-text-hi)]">
                          {weekLabel} {w.number}
                        </span>
                        {t?.is_fold && <span className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-low)]">{foldedLabel}</span>}
                        {t?.is_shove && <span className="text-[11px] uppercase tracking-wider text-[color:var(--color-gold)]">{shovedLabel}</span>}
                        <span className={`nums ml-auto font-semibold ${gain >= 0 ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
                          {signed(gain)}
                        </span>
                        <span aria-hidden className="hidden h-1.5 w-24 shrink-0 bg-[color:var(--color-surface-3)] sm:block">
                          <span
                            className={`block h-full ${gain >= 0 ? "bg-[color:var(--color-win)]" : "bg-[color:var(--color-loss)]"}`}
                            style={{ width: `${Math.round((Math.abs(gain) / widest) * 100)}%` }}
                          />
                        </span>
                      </summary>
                      {bets.length === 0 ? (
                        <p className="px-4 pb-4 pl-10 text-sm text-[color:var(--color-text-low)]">{noneYet}</p>
                      ) : (
                        <ul className="px-4 pb-4 pl-10">
                          {bets.map((b, i) => {
                            const g = one(b.games);
                            const backed = b.side === "away" ? g?.away_team : g?.home_team;
                            const against = b.side === "away" ? g?.home_team : g?.away_team;
                            return (
                              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[color:var(--color-border)] py-1.5 text-sm last:border-b-0">
                                <span className="font-semibold text-[color:var(--color-text-hi)]">{backed ?? "—"}</span>
                                <span className="text-xs text-[color:var(--color-text-low)]">{against ?? ""}</span>
                                <span className="nums ml-auto text-[color:var(--color-text-mid)]">{b.chips}</span>
                                <span className="nums w-14 text-right text-[color:var(--color-text-low)]">
                                  {b.multiplier === null ? "—" : `${Number(b.multiplier).toFixed(2)}×`}
                                </span>
                                <span
                                  className={`nums w-16 text-right font-semibold ${
                                    b.result === "won"
                                      ? "text-[color:var(--color-win)]"
                                      : b.result === "lost"
                                        ? "text-[color:var(--color-loss)]"
                                        : "text-[color:var(--color-text-low)]"
                                  }`}
                                >
                                  {b.result === "won" ? signed(b.payout ?? 0) : b.result === "lost" ? signed(-b.chips) : "0"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
