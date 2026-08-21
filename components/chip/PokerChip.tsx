// A real casino chip, rendered in the three ANTE materials (art §3.0): gold for
// the house (the ante, the Pot), the current week's gem tier for a player's own
// stake. No new hues — every chip tone already exists in the token system.
//
// D-008: the chip is a physical object, not a pictogram. Clay body, moulded edge
// spots, a recessed inlay, and one specular arc from the upper left — the same
// light direction every other surface uses (art §5).

export type ChipTone = "purple" | "red" | "teal" | "gold" | "chrome";

const TONE_VARS: Record<ChipTone, { face: string; rim: string; edge: string; text: string }> = {
  purple: { face: "var(--color-tier-purple)", rim: "var(--color-tier-purple-deep)", edge: "var(--color-tier-purple-bright)", text: "#fff" },
  red: { face: "var(--color-tier-red)", rim: "var(--color-tier-red-deep)", edge: "var(--color-tier-red-bright)", text: "#fff" },
  teal: { face: "var(--color-tier-teal)", rim: "var(--color-tier-teal-deep)", edge: "var(--color-tier-teal-bright)", text: "#fff" },
  gold: { face: "var(--color-tier-gold)", rim: "var(--color-tier-gold-deep)", edge: "var(--color-tier-gold-bright)", text: "var(--color-canvas)" },
  chrome: { face: "var(--color-surface-3)", rim: "var(--color-border)", edge: "var(--color-chrome)", text: "var(--color-chrome)" },
};

interface ChipProps {
  tone: ChipTone;
  size?: number;
  value?: string | number;
  className?: string;
}

/** One physical chip — moulded edge spots, a rim, a recessed inlay, a value. */
export function PokerChip({ tone, size = 40, value, className }: ChipProps) {
  const v = TONE_VARS[tone];
  // Gradient ids are keyed by tone, not by instance: two chips of the same tone
  // are the same object, so a shared definition is correct rather than a collision.
  const clay = `ante-chip-clay-${tone}`;
  const inlay = `ante-chip-inlay-${tone}`;

  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden>
      <defs>
        {/* Light from the upper left, on every chip, matching every other surface. */}
        <radialGradient id={clay} cx="33%" cy="27%" r="78%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.30" />
          <stop offset="46%" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
        </radialGradient>
        <radialGradient id={inlay} cx="35%" cy="28%" r="82%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.34" />
        </radialGradient>
      </defs>

      {/* The chip sits on the felt and casts down-right. */}
      <ellipse cx="24.4" cy="27.4" rx="21.7" ry="21.7" fill="#000" opacity="0.62" />

      {/* Clay body */}
      <circle cx="24" cy="24" r="22" fill={v.rim} />
      {/* Moulded edge spots — eight inserts around the rim, the classic tell. */}
      <circle
        cx="24"
        cy="24"
        r="19.4"
        fill="none"
        stroke={v.edge}
        strokeWidth="5.6"
        strokeDasharray="7.6 7.6"
        strokeDashoffset="3.8"
      />
      {/* Spots are moulded in, so their inner edge sits in shadow. */}
      <circle
        cx="24"
        cy="24"
        r="17.2"
        fill="none"
        stroke="#000"
        strokeOpacity="0.4"
        strokeWidth="1.3"
      />

      {/* Recessed inlay — the printed centre, set below the clay. */}
      <circle cx="24" cy="24" r="15" fill={v.face} />
      <circle cx="24" cy="24" r="15" fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="13.9" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="0.9" />
      <circle cx="24" cy="24" r="11.4" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="0.7" />

      {/* Volume: one pass of directional light over the whole chip. */}
      <circle cx="24" cy="24" r="22" fill={`url(#${clay})`} />
      <circle cx="24" cy="24" r="15" fill={`url(#${inlay})`} />

      {/* The specular arc — upper left, hard-stopped, no bloom (art §5). */}
      <path
        d="M 8.5 15.5 A 18 18 0 0 1 32.5 8.6"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.34"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="21.3" fill="none" stroke="#000" strokeOpacity="0.6" strokeWidth="1.4" />

      {value !== undefined && (
        <text
          x="24"
          y="28.9"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fontFamily="var(--font-display)"
          fill={v.text}
          style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
        >
          {value}
        </text>
      )}
    </svg>
  );
}

/** A short stack: 1-3 chips peeking beneath a face chip carrying the total. Reads
 *  as "chips on the felt," not a literal chip-for-chip count (that gets noisy fast). */
export function ChipStack({
  tone,
  total,
  size = 40,
  animated,
  count,
}: {
  tone: ChipTone;
  total: number;
  size?: number;
  animated?: boolean;
  /** Chips to draw. The slip passes the rung, so five presses show five chips. */
  count?: number;
}) {
  const chips = Math.max(1, count ?? (total <= 0 ? 1 : total < 20 ? 1 : total < 50 ? 3 : 4));
  const behind = chips - 1;
  const peekOffset = Math.round(size * 0.22);
  const height = size + behind * peekOffset;
  // A real stack is mostly hidden chip: overlap hard, show the lit edge of each.
  const overlap = Math.round(size * 0.62);

  return (
    <>
      {/* A phone has height to spare in a narrow button, so the chips stack up. */}
      <div className="relative sm:hidden" style={{ width: size, height }}>
        {Array.from({ length: behind }).map((_, i) => (
          <div key={i} className="absolute left-0" style={{ top: (i + 1) * peekOffset }}>
            <PokerChip tone={tone} size={size} />
          </div>
        ))}
        <div className="absolute left-0 top-0">
          <PokerChip tone={tone} size={size} value={total} className={animated ? "chip-drop" : ""} />
        </div>
      </div>

      {/* Wider than a phone, the row has width instead — so they fan across it,
          overlapping the way chips actually sit when they are pushed forward. */}
      <div className="hidden items-center sm:flex">
        {Array.from({ length: behind }).map((_, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : -overlap }}>
            <PokerChip tone={tone} size={size} />
          </div>
        ))}
        <div style={{ marginLeft: behind === 0 ? 0 : -overlap }}>
          <PokerChip tone={tone} size={size} value={total} className={animated ? "chip-drop" : ""} />
        </div>
      </div>
    </>
  );
}
