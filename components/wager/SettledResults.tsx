import { createUserClient } from "@/lib/db/supabase";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { getContent } from "@/lib/content/getContent";

// The Settled state (ANTE-PLAYER §5.5): per-bet outcome, the multiplier applied,
// chips returned and profit, the weekly net delta INCLUDING the ante (§14), the
// pot result, and the new stack and rank. Plain where numbers live.

export async function SettledResults({
  week,
  playerId,
  dbOverride,
}: {
  week: { id: string; number: number; pot_awarded: number | null; marker: number };
  playerId: string;
  /** LOCAL PREVIEW ONLY — dev harness injects a service client. Never set in app code. */
  dbOverride?: ReturnType<typeof createUserClient>;
}) {
  const db = dbOverride ?? createUserClient();

  const [{ data: myTicket }, { data: entries }, { data: awards }, { data: standing }] = await Promise.all([
    db
      .from("tickets")
      .select("id, is_fold, is_shove")
      .eq("week_id", week.id)
      .eq("player_id", playerId)
      .maybeSingle(),
    fetchAllRows<{ player_id: string | null; amount: number }>((f, t) =>
      db.from("ledger_entries").select("player_id, amount").eq("week_id", week.id).order("id").range(f, t),
    ).then((rows) => ({ data: rows })),
    db.from("pot_awards").select("player_id, place, amount").eq("week_id", week.id),
    db.from("standings").select("stack, rank").eq("player_id", playerId).maybeSingle(),
  ]);

  const potDelta = (awards ?? [])
    .filter((a) => a.player_id === playerId)
    .reduce((s, a) => s + a.amount, 0);
  const myDelta =
    (entries ?? []).filter((e) => e.player_id === playerId).reduce((s, e) => s + e.amount, 0) - potDelta;

  interface BetRow {
    id: string;
    side: string;
    chips: number;
    multiplier: number | null;
    result: string | null;
    payout: number | null;
    games: { away_team: string; home_team: string } | null;
  }
  let bets: BetRow[] = [];
  if (myTicket) {
    const { data } = await db
      .from("bets")
      .select("id, side, chips, multiplier, result, payout, games(away_team, home_team)")
      .eq("ticket_id", myTicket.id);
    bets = (data as unknown as BetRow[]) ?? [];
  }

  let potWinners: string[] = [];
  if ((awards ?? []).length > 0) {
    const { data: winners } = await db
      .from("players")
      .select("id, first_name, last_name")
      .in("id", (awards ?? []).map((a) => a.player_id));
    potWinners = (awards ?? []).map((a) => {
      const w = winners?.find((x) => x.id === a.player_id);
      const name = `${w?.first_name ?? "?"} ${(w?.last_name ?? "").slice(0, 1)}.`.trim();
      return `${name} +${a.amount}`;
    });
  }

  const [heading, deltaLabel, potLabel, potNone, potMarker, stackLabel, rankLabel, wonLabel, lostLabel, returnedLabel] =
    await Promise.all([
      getContent("settled.heading", { week: week.number }),
      getContent("settled.delta_label"),
      getContent("settled.pot_label"),
      getContent("settled.pot_none"),
      getContent("settled.pot_marker", { marker: week.marker }),
      getContent("settled.stack_label"),
      getContent("settled.rank_label"),
      getContent("settled.won_label"),
      getContent("settled.lost_label"),
      getContent("settled.returned_label"),
    ]);

  const resultLabel = (r: string | null) => (r === "won" ? wonLabel : r === "lost" ? lostLabel : returnedLabel);
  const resultClass = (r: string | null) =>
    r === "won"
      ? "text-[color:var(--color-win)]"
      : r === "lost"
        ? "text-[color:var(--color-loss)]"
        : "text-[color:var(--color-text-mid)]";
  const resultSign = (r: string | null) => (r === "won" ? "▲" : r === "lost" ? "▼" : "•");

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {heading}
      </h2>

      {bets.length > 0 && (
        <ul>
          {bets.map((b) => {
            const team = b.side === "away" ? b.games?.away_team : b.games?.home_team;
            const label = b.games ? `${b.games.away_team} @ ${b.games.home_team}` : "";
            return (
              <li key={b.id} className="flex items-baseline gap-3 border-b border-[color:var(--color-border)] px-4 py-2 text-sm">
                {/* Won and lost differ by more than hue: sign + label + color (art §3.3) */}
                <span className={`w-16 shrink-0 font-semibold ${resultClass(b.result)}`}>
                  {resultSign(b.result)} {resultLabel(b.result)}
                </span>
                <span className="text-[color:var(--color-text-hi)]">
                  {team} <span className="text-[color:var(--color-text-low)]">({label})</span>
                </span>
                <span className="nums ml-auto text-[color:var(--color-text-mid)]">
                  {b.chips}
                  {b.multiplier !== null && b.result !== "returned" && (
                    <span className="text-[color:var(--color-text-low)]"> @ {Number(b.multiplier).toFixed(2)}×</span>
                  )}
                  {b.result === "won" && b.payout !== null && (
                    <span className="ml-2 font-semibold text-[color:var(--color-win)]">+{b.payout}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-4 border-b border-[color:var(--color-border)] px-4 py-4 sm:grid-cols-4">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{deltaLabel}</p>
          <p className={`nums text-xl font-semibold ${myDelta >= 0 ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
            {myDelta >= 0 ? `+${myDelta}` : `−${-myDelta}`}
          </p>
        </div>
        {potDelta > 0 && (
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{potLabel}</p>
            <p className="nums text-xl font-semibold text-[color:var(--color-gold)]">+{potDelta}</p>
          </div>
        )}
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{stackLabel}</p>
          <p className="nums text-xl font-semibold text-[color:var(--color-text-hi)]">{standing?.stack ?? "—"}</p>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{rankLabel}</p>
          <p className="nums text-xl font-semibold text-[color:var(--color-text-hi)]">{standing?.rank ?? "—"}</p>
        </div>
      </div>

      <p className="px-4 py-3 text-sm">
        {week.marker > 0 ? (
          <span className="text-[color:var(--color-gold)]">{potMarker}</span>
        ) : potWinners.length > 0 ? (
          <span className="text-[color:var(--color-text-mid)]">
            {potLabel}: <span className="text-[color:var(--color-gold)]">{potWinners.join(", ")}</span>
          </span>
        ) : (
          <span className="text-[color:var(--color-text-mid)]">{potNone}</span>
        )}
      </p>
    </section>
  );
}
