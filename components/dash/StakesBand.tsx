import { DateTime } from "luxon";
import { createUserClient } from "@/lib/db/supabase";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { getContent } from "@/lib/content/getContent";
import { ANTE_TIERS, tierForWeek } from "@/lib/engine";
import { ET } from "@/lib/time";
import { PokerChip } from "@/components/chip/PokerChip";
import { Facets } from "@/components/ui/Facets";
import { Tip } from "@/components/ui/Tip";

// The stakes band (art §3, §7): the ONE large colored surface in the product, and
// the only thing that changes with the season. Faceted plane in the current tier,
// carrying the ring, week, tier, ante, Pot, limit, and deadline. Everything on it
// is blackout-still: the Pot and limits are fixed from Tuesday to the reveal.
//
// D-008: the plane is cut from real facets rather than a striped gradient, and
// every figure sits in a milled tray so white type clears 4.5:1 over any tier.

const TIER_VARS: Record<string, { deep: string; base: string; bright: string; labelKey: string }> = {
  purple: { deep: "var(--color-tier-purple-deep)", base: "var(--color-tier-purple)", bright: "var(--color-tier-purple-bright)", labelKey: "band.tier_purple" },
  red: { deep: "var(--color-tier-red-deep)", base: "var(--color-tier-red)", bright: "var(--color-tier-red-bright)", labelKey: "band.tier_red" },
  teal: { deep: "var(--color-tier-teal-deep)", base: "var(--color-tier-teal)", bright: "var(--color-tier-teal-bright)", labelKey: "band.tier_teal" },
  gold: { deep: "var(--color-tier-gold-deep)", base: "var(--color-tier-gold)", bright: "var(--color-tier-gold-bright)", labelKey: "band.tier_gold" },
};

// A flat directional veil: it protects type over any tier without softening the
// gem, and it runs with the same upper-left light as everything else.
const SCRIM = "linear-gradient(102deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.26) 46%, rgba(0,0,0,0.44) 100%)";

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
    <svg viewBox="0 0 50 50" className="h-16 w-16 shrink-0" aria-hidden>
      <defs>
        {/* The bezel is turned metal: brightest where the light lands, upper left. */}
        <linearGradient id="ante-ring-bezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-tier-gold-bright)" />
          <stop offset="45%" stopColor="var(--color-gold)" />
          <stop offset="100%" stopColor="var(--color-gold-dim)" />
        </linearGradient>
      </defs>
      {/* Seat the ring in the plane rather than floating it on top. */}
      <circle cx="25" cy="25" r="19.5" fill="#000" fillOpacity="0.34" />
      <circle cx="25" cy="25" r="16" fill="none" stroke="url(#ante-ring-bezel)" strokeWidth="1.75" />
      <circle cx="25" cy="25" r="13.6" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
      {tiers.map((t) => {
        const state = order[t] < order[currentTier] ? "elapsed" : t === currentTier ? "current" : "future";
        return (
          <path
            key={t}
            d={arcs[t]}
            fill="none"
            stroke={state === "future" ? "#fff" : TIER_VARS[t].bright}
            strokeOpacity={state === "elapsed" ? 0.55 : state === "future" ? 0.15 : 1}
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
    .select("id, number, ante, phase, deadline_at, median_snapshot")
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
        className="band-in chamfer-lg relative isolate flex items-center gap-5 overflow-hidden px-6 py-5"
        style={{
          borderTop: "2px solid var(--color-tier-purple-bright)",
          boxShadow: "0 26px 60px -30px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.14)",
        }}
      >
        <Facets
          deep="var(--color-tier-purple-deep)"
          base="var(--color-tier-purple)"
          bright="var(--color-tier-purple-bright)"
          seed={3}
          className="absolute inset-0 -z-10 h-full w-full"
        />
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: SCRIM }} aria-hidden />
        <div className="shine-sweep pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.14)_50%,transparent_60%)]" aria-hidden />
        <SeasonRing weekNumber={1} />
        <p className="text-sm leading-relaxed text-white">{message}</p>
      </div>
    );
  }

  const [{ data: pot }, { data: snap }] = await Promise.all([
    fetchAllRows<{ amount: number; player_id: string | null }>((f, t) =>
      db.from("ledger_entries").select("amount, player_id").is("player_id", null).order("id").range(f, t),
    ).then((rows) => ({ data: rows })),
    // stack_pre_ante joins the read purely so the limit tooltip can say WHICH cap is
    // binding — the bet slip already works this out; the band never said it out loud.
    db
      .from("week_players")
      .select("house_limit, stack_pre_ante")
      .eq("week_id", week.id)
      .eq("player_id", playerId)
      .maybeSingle(),
  ]);
  const potBalance = (pot ?? []).reduce((s, e) => s + e.amount, 0);

  const tier = tierForWeek(week.number);
  const v = TIER_VARS[tier];
  const deadline = DateTime.fromISO(week.deadline_at).setZone(ET);

  // §4 — which side of the limit binds. Same test the slip uses, said plainly.
  const median = week.median_snapshot ?? 0;
  const ownAfterAnte = (snap?.stack_pre_ante ?? 0) - week.ante;
  const cappedByStack = ownAfterAnte <= median;

  // "in 6 days" / "tomorrow" / "in 3 hours" — rendered on the server, so it is
  // accurate to the request rather than to a stale build.
  const countdown = deadline.toRelative({ base: DateTime.now().setZone(ET) }) ?? "";
  const tierRange = ANTE_TIERS.find((t) => t.tier === tier)?.weeks ?? [1, 4];

  const tierLabel = await getContent(v.labelKey);

  const [
    weekLabel, anteLabel, potLabel, limitLabel, deadlineLabel,
    anteTip, potTip, limitTipRaw, cappedCopy, deadlineTip, ringTip,
  ] = await Promise.all([
    getContent("band.week_label"),
    getContent("band.ante_label"),
    getContent("band.pot_label"),
    getContent("band.limit_label"),
    getContent("band.deadline_label"),
    getContent("band.ante_tip"),
    getContent("band.pot_tip"),
    getContent("band.limit_tip"),
    cappedByStack
      ? getContent("band.limit_capped_stack", { stack: ownAfterAnte })
      : getContent("band.limit_capped_room", { median }),
    getContent(week.number === 1 ? "band.deadline_tip_first" : "band.deadline_tip", {
      deadline: deadline.toFormat("cccc, LLLL d 'at' h:mma 'ET'"),
      countdown,
    }),
    getContent("band.ring_tip", {
      week: week.number,
      tier: tierLabel,
      range: `${tierRange[0]}\u2013${tierRange[1]}`,
    }),
  ]);
  const limitTip = limitTipRaw.replace("{capped}", cappedCopy);

  // Every figure sits in a tray milled into the plane — the tray is what makes a
  // number readable over a gem, and what makes the band read as machined.
  // Spans, not divs: each tray is now wrapped in a <button> so a tap can open its
  // tooltip, and a button may not legally contain flow content.
  const stat = (label: string, value: string) => (
    <span className="well chamfer block px-3.5 py-2">
      <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-white/70">{label}</span>
      <span className="nums block font-[family-name:var(--font-display)] text-xl font-bold leading-tight text-white">{value}</span>
    </span>
  );

  return (
    <div
      // Scrolls away with the page (D-054). It used to pin to the top on desktop, but
      // the week, the ante, the Pot and the deadline are the frame you read once on
      // arrival, not figures you consult mid-scroll — the bet slip's running tally is
      // the thing worth keeping in view, and it still sticks on its own.
      className="band-in relative isolate z-30 flex flex-wrap items-center gap-x-6 gap-y-4 px-6 py-5"
    >
      {/* Every painted layer lives in here, and the chamfer clip lives with it (D-045).
          It used to sit on the band itself — and a clip-path clips EVERY descendant
          unconditionally, which no z-index or fixed positioning escapes. A tooltip
          drawn inside the band was therefore impossible. The band is ~90px tall, so
          there was nowhere inside to put one either. Same pixels, one layer down. */}
      <div
        className="chamfer-lg pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        style={{
          borderTop: `2px solid ${v.bright}`,
          boxShadow: "0 26px 60px -30px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.16)",
        }}
        aria-hidden
      >
        <Facets deep={v.deep} base={v.base} bright={v.bright} seed={week.number * 17 + 3} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0" style={{ background: SCRIM }} />
        <div className="shine-sweep absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.15)_50%,transparent_60%)]" />
      </div>

      <Tip text={ringTip} label={`${weekLabel} ${week.number}, ${tierLabel}`}>
        <SeasonRing weekNumber={week.number} />
      </Tip>

      <div className="flex flex-col">
        <span
          className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase italic leading-none tracking-tight text-white"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}
        >
          {weekLabel} {week.number}
        </span>
        <span
          className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: v.bright, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
        >
          {tierLabel}
        </span>
      </div>

      <Tip text={anteTip} label={anteLabel}>
        {stat(anteLabel, String(week.ante))}
      </Tip>

      {/* The Pot is the house's money, so it is the one thing here wearing gold. */}
      <Tip text={potTip} label={potLabel}>
        <span className="well well-gold chamfer flex items-center gap-3 px-3.5 py-2">
          <PokerChip tone="gold" size={30} className="gold-pulse shrink-0" />
          <span className="flex flex-col">
            <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-white/70">{potLabel}</span>
            <span
              className="nums block font-[family-name:var(--font-display)] text-xl font-bold leading-tight"
              style={{ color: "var(--color-tier-gold-bright)" }}
            >
              {potBalance}
            </span>
          </span>
        </span>
      </Tip>

      {snap && (
        <Tip text={limitTip} label={limitLabel}>
          {stat(limitLabel, String(snap.house_limit))}
        </Tip>
      )}

      {/* Hangs from its right edge: this tray sits at the margin, and a left-hung
          tooltip would run off the screen on a phone. */}
      <span className="ml-auto">
        <Tip text={deadlineTip} label={deadlineLabel} align="right">
          {stat(deadlineLabel, deadline.toFormat("ccc h:mma 'ET'"))}
        </Tip>
      </span>
    </div>
  );
}
