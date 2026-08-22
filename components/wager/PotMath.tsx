import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/db/supabase";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { getContent } from "@/lib/content/getContent";
import { potBreakdown } from "@/lib/stats/potMath";

// "How did Frank win the week?" (§7/§14). The settled panel named the winner and the
// amount; this shows the working. Every number here is re-derived from the ledger the
// settlement already wrote — see lib/stats/potMath.ts — so it cannot disagree with the
// chips that actually moved.
//
// It renders the WHOLE room, not just the places paid, because the answer to "why
// didn't I win" is the row above yours, and because seeing a fold sitting at −ante is
// the clearest statement of what folding costs.

export async function PotMath({
  week,
  playerId,
  dbOverride,
}: {
  week: { id: string; number: number; pot_awarded: number | null };
  playerId: string;
  /** LOCAL PREVIEW ONLY — dev harness injects its own client. Never set in app code. */
  dbOverride?: SupabaseClient;
}) {
  const db = dbOverride ?? createUserClient();

  // Scoped to this week: the ledger is the whole season and only one week is on screen.
  const [{ data: weekRow }, { data: tickets }, entries, { data: players }, { data: potAwards }] = await Promise.all([
    db
      .from("weeks")
      .select("id, number, active_count_snapshot, marker, pot_before, pot_awarded")
      .eq("id", week.id)
      .maybeSingle(),
    db.from("tickets").select("player_id, is_fold").eq("week_id", week.id),
    fetchAllRows<{ player_id: string | null; kind: string; amount: number }>((f, t) =>
      db.from("ledger_entries").select("player_id, kind, amount").eq("week_id", week.id).order("id").range(f, t),
    ),
    db.from("players").select("id, first_name, last_name").in("status", ["approved", "deactivated"]),
    db.from("pot_awards").select("player_id, place, amount").eq("week_id", week.id),
  ]);

  if ((tickets ?? []).length === 0) return null;

  // §14 — a week's gain is the net change to a stack INCLUDING the ante and BEFORE the
  // Pot. The pot_award rows are exactly what must be excluded.
  const gain = new Map<string, number>();
  for (const e of entries) {
    if (e.player_id === null) continue;
    if (e.kind === "pot_award") continue;
    gain.set(e.player_id, (gain.get(e.player_id) ?? 0) + Number(e.amount));
  }

  const marker = Number(weekRow?.marker ?? 0);

  // The pool is the Pot's balance at award time, which settlement now records. It is NOT
  // recoverable from this week's rows alone — the Pot carries across weeks (§7), so
  // this week's pot rows are missing every prior week's rollover. For a week settled before
  // pot_before was written we can only recover it when the Pot went under (pool =
  // −marker, since nothing is awarded from a negative Pot); otherwise the pool line is
  // withheld. A number that cannot be derived is not worth guessing at on the one screen
  // whose whole job is showing the working.
  const pool: number | null =
    weekRow?.pot_before != null ? Number(weekRow.pot_before) : marker > 0 ? -marker : null;

  const foldedBy = new Map((tickets ?? []).map((t) => [t.player_id, t.is_fold]));
  const breakdown = potBreakdown({
    entries: [...gain.entries()].map(([id, g]) => ({
      playerId: id,
      gain: g,
      eligible: foldedBy.get(id) === false,
    })),
    pool: pool ?? 0,
    // Settlement uses potSplitForCount(active_count_snapshot) — the head count frozen at
    // slate open (§7), NOT the number of tickets. A deactivation mid-week makes those
    // differ, and the displayed split has to be the one the chips were actually paid on.
    activeCount: weekRow?.active_count_snapshot ?? (tickets ?? []).length,
  });

  // What each player TOOK is read from pot_awards — the rows settlement actually wrote.
  // potBreakdown supplies the ordering and the reason; it never supplies the amounts, so
  // this panel cannot contradict the ledger even if the two ever drift apart.
  const paidBy = new Map<string, { place: number; amount: number }>();
  for (const a of potAwards ?? []) {
    const prev = paidBy.get(a.player_id);
    paidBy.set(a.player_id, { place: a.place, amount: (prev?.amount ?? 0) + Number(a.amount) });
  }
  const standings = breakdown.standings.map((s) => {
    const real = paidBy.get(s.playerId);
    return { ...s, award: real?.amount ?? 0, place: real?.place ?? s.place };
  });
  const awardedShown = standings.reduce((n, s) => n + s.award, 0);

  const nameOf = (id: string) => {
    const p = (players ?? []).find((x) => x.id === id);
    return p ? `${p.first_name ?? ""} ${(p.last_name ?? "").slice(0, 1)}.`.trim() || "—" : "—";
  };

  const places = new Set(standings.filter((s) => s.award > 0).map((s) => s.place)).size;
  const rosterCount = weekRow?.active_count_snapshot ?? (tickets ?? []).length;

  const [heading, rule, placesLine, poolLine, paidLine, rolledLine, rolledAll, markerLine, gainLabel, tookLabel, foldedLabel, splitNote, youLabel, roomLabel] =
    await Promise.all([
      getContent("potmath.heading", { week: week.number }),
      getContent("potmath.rule"),
      // Don't claim places were "paid" on a week where the Pot paid nothing (§7 marker).
      places === 0
        ? getContent("potmath.places_unpaid", {
            players: rosterCount,
            split: breakdown.split.map((p) => `${p}%`).join(" / "),
          })
        : places === 1
          ? getContent("potmath.one_place", { players: rosterCount })
          : getContent("potmath.places", {
              players: rosterCount,
              places,
              split: breakdown.split.map((p) => `${p}%`).join(" / "),
            }),
      getContent("potmath.pool", { pool: pool ?? 0 }),
      getContent("potmath.paid", { awarded: awardedShown }),
      getContent("potmath.rolled", { rolled: (pool ?? 0) - awardedShown }),
      getContent("potmath.rolled_all"),
      getContent("potmath.marker", { marker }),
      getContent("potmath.gain_label"),
      getContent("potmath.took_label"),
      getContent("potmath.folded_label"),
      getContent("potmath.split_note"),
      getContent("potmath.you"),
      getContent("potmath.room_label"),
    ]);

  // Correct English ordinals all the way down the room — a 25-seat league renders
  // 21st/22nd/23rd, not "21th".
  const ord = (n: number) => {
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
    const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
    return `${n}${suffix}`;
  };

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {heading}
      </h2>

      <p className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm text-[color:var(--color-text-mid)]">
        {rule}
      </p>

      <div className="flex items-baseline gap-3 border-b border-[color:var(--color-border)] px-4 py-2">
        <span className="w-10 shrink-0" />
        <span className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{roomLabel}</span>
        <span className="nums ml-auto flex shrink-0 items-baseline gap-4 text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">
          <span className="w-16 text-right">{gainLabel}</span>
          <span className="w-24 text-right">{tookLabel}</span>
        </span>
      </div>

      <ul>
        {standings.map((s) => {
          const isMe = s.playerId === playerId;
          const paid = s.award > 0;
          return (
            <li
              key={s.playerId}
              className={`flex items-baseline gap-3 border-b border-[color:var(--color-border)] px-4 py-2 text-sm ${
                isMe ? "bg-[color:var(--color-surface-2)]" : ""
              }`}
            >
              <span
                className={`nums w-10 shrink-0 font-semibold ${
                  paid ? "text-[color:var(--color-gold)]" : "text-[color:var(--color-text-low)]"
                }`}
              >
                {s.place !== null ? ord(s.place) : "—"}
              </span>

              <span className={isMe ? "font-semibold text-[color:var(--color-text-hi)]" : "text-[color:var(--color-text-hi)]"}>
                {nameOf(s.playerId)}
                {isMe && <span className="ml-2 text-[12px] uppercase tracking-wider text-[color:var(--color-gold)]">{youLabel}</span>}
                {!s.eligible && (
                  <span className="ml-2 text-[12px] text-[color:var(--color-text-low)]">{foldedLabel}</span>
                )}
                {s.sharedBy > 1 && s.award > 0 && (
                  <span className="ml-2 text-[12px] text-[color:var(--color-text-low)]">
                    {splitNote.replaceAll("{place}", String(s.place)).replaceAll("{ways}", String(s.sharedBy))}
                  </span>
                )}
              </span>

              <span className="nums ml-auto flex shrink-0 items-baseline gap-4">
                <span
                  className={`w-16 text-right font-semibold ${
                    s.gain >= 0 ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"
                  }`}
                >
                  {s.gain >= 0 ? `+${s.gain}` : `−${-s.gain}`}
                </span>
                <span className="w-24 text-right font-semibold text-[color:var(--color-gold)]">
                  {paid ? `+${s.award}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="px-4 py-3 text-sm text-[color:var(--color-text-mid)]">
        {placesLine}{" "}
        {awardedShown === 0 ? (
          marker > 0 ? (
            <span className="text-[color:var(--color-gold)]">{markerLine}</span>
          ) : (
            <span className="text-[color:var(--color-gold)]">{rolledAll}</span>
          )
        ) : (
          <>
            {pool !== null && `${poolLine} `}
            {paidLine}{" "}
            {pool !== null && pool - awardedShown > 0 && (
              <span className="text-[color:var(--color-gold)]">{rolledLine}</span>
            )}
          </>
        )}
      </p>
    </section>
  );
}
