import { DateTime } from "luxon";
import { createUserClient } from "@/lib/db/supabase";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { getContent } from "@/lib/content/getContent";
import { tierForWeek } from "@/lib/engine";
import { ET } from "@/lib/time";

// The stakes band (art §3, §7): the ONE large colored surface in the product, and
// the only thing that changes with the season. Faceted plane in the current tier,
// carrying the ring, week, tier, ante, Pot, limit, and deadline. Everything on it
// is blackout-still: the Pot and limits are fixed from Tuesday to the reveal.

const TIER_VARS: Record<string, { deep: string; base: string; bright: string; labelKey: string }> = {
  purple: { deep: "var(--color-tier-purple-deep)", base: "var(--color-tier-purple)", bright: "var(--color-tier-purple-bright)", labelKey: "band.tier_purple" },
  red: { deep: "var(--color-tier-red-deep)", base: "var(--color-tier-red)", bright: "var(--color-tier-red-bright)", labelKey: "band.tier_red" },
  teal: { deep: "var(--color-tier-teal-deep)", base: "var(--color-tier-teal)", bright: "var(--color-tier-teal-bright)", labelKey: "band.tier_teal" },
  gold: { deep: "var(--color-tier-gold-deep)", base: "var(--color-tier-gold)", bright: "var(--color-tier-gold-bright)", labelKey: "band.tier_gold" },
};

/** The season ring (art §6): four quadrants for four tiers — elapsed lit and dimmed,
 *  current at full strength, future dark. Gold bezel at full weight, here only. */
function SeasonRing({ weekNumber }: { weekNumber: number }) {
  const currentTier = tierForWeek(weekNumber);
  const tiers = ["purple", "red", "teal", "gold"] as const;
  // Quadrant arcs (upper-left, upper-right, lower-right, lower-left), 6px gaps.
  const arcs: Record<(typeof tiers)[number], string> = {
    purple: "M 24.9 6.2 A 22 22 0 0 0 6.2 24.9",
    red: "M 43.8 24.9 A 22 22 0 0 0 25.1 6.2",
    teal: "M 25.1 43.8 A 22 22 0 0 0 43.8 25.1",
    gold: "M 6.2 25.1 A 22 22 0 0 0 24.9 43.8",
  };
  const order = { purple: 0, red: 1, teal: 2, gold: 3 };
  return (
    <svg viewBox="0 0 50 50" className="h-14 w-14 shrink-0" aria-hidden>
      <circle cx="25" cy="25" r="16" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" />
      {tiers.map((t) => {
        const state = order[t] < order[currentTier] ? "elapsed" : t === currentTier ? "current" : "future";
        return (
          <path
            key={t}
            d={arcs[t]}
            fill="none"
            stroke={state === "future" ? "var(--color-surface-3)" : TIER_VARS[t].bright}
            strokeOpacity={state === "elapsed" ? 0.35 : 1}
            strokeWidth="5"
          />
        );
      })}
    </svg>
  );
}

export async function StakesBand({ playerId }: { playerId: string }) {
  const db = createUserClient();

  const { data: week } = await db
    .from("weeks")
    .select("id, number, ante, phase, deadline_at")
    .in("phase", ["open", "revealed", "settled"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!week) {
    const { data: season } = await db
      .from("seasons")
      .select("week1_lock_at")
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lock = season?.week1_lock_at
      ? DateTime.fromISO(season.week1_lock_at).setZone(ET).toFormat("cccc, LLL d 'at' h:mma 'ET'")
      : "—";
    const message = await getContent("band.preseason_message", { lock });
    return (
      <div
        className="band-in chamfer relative flex items-center gap-4 overflow-hidden px-5 py-4"
        style={{
          background: `linear-gradient(120deg, var(--color-tier-purple-deep), var(--color-surface-1) 70%), repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 6px)`,
        }}
      >
        <div className="shine-sweep pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.12)_50%,transparent_60%)]" aria-hidden />
        <SeasonRing weekNumber={1} />
        <p className="text-sm text-[color:var(--color-text-hi)]">{message}</p>
      </div>
    );
  }

  const [{ data: pot }, { data: snap }] = await Promise.all([
    fetchAllRows<{ amount: number; player_id: string | null }>((f, t) =>
      db.from("ledger_entries").select("amount, player_id").is("player_id", null).order("id").range(f, t),
    ).then((rows) => ({ data: rows })),
    db.from("week_players").select("house_limit").eq("week_id", week.id).eq("player_id", playerId).maybeSingle(),
  ]);
  const potBalance = (pot ?? []).reduce((s, e) => s + e.amount, 0);

  const tier = tierForWeek(week.number);
  const v = TIER_VARS[tier];
  const [weekLabel, tierLabel, anteLabel, potLabel, limitLabel, deadlineLabel] = await Promise.all([
    getContent("band.week_label"),
    getContent(v.labelKey),
    getContent("band.ante_label"),
    getContent("band.pot_label"),
    getContent("band.limit_label"),
    getContent("band.deadline_label"),
  ]);

  const deadline = DateTime.fromISO(week.deadline_at).setZone(ET);
  const stat = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
      <span className="nums font-[family-name:var(--font-display)] text-lg font-bold text-white">{value}</span>
    </div>
  );

  return (
    <div
      className="band-in chamfer relative flex flex-wrap items-center gap-x-8 gap-y-3 overflow-hidden px-5 py-4"
      style={{
        background: `linear-gradient(120deg, ${v.deep} 0%, ${v.base} 45%, ${v.deep} 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 6px)`,
        borderTop: `2px solid ${v.bright}`,
      }}
    >
      <div className="shine-sweep pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.14)_50%,transparent_60%)]" aria-hidden />
      <SeasonRing weekNumber={week.number} />
      <div className="flex flex-col">
        <span className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase italic text-white">
          {weekLabel} {week.number}
        </span>
        <span className="text-[11px] uppercase tracking-widest" style={{ color: v.bright }}>
          {tierLabel}
        </span>
      </div>
      {stat(anteLabel, String(week.ante))}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-white/50">{potLabel}</span>
        <span className="gold-pulse nums font-[family-name:var(--font-display)] text-lg font-bold" style={{ color: "var(--color-gold)" }}>
          {potBalance}
        </span>
      </div>
      {snap && stat(limitLabel, String(snap.house_limit))}
      <div className="ml-auto">{stat(deadlineLabel, deadline.toFormat("ccc h:mma 'ET'"))}</div>
    </div>
  );
}
