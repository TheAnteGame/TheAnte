// A real casino chip, rendered in the three ANTE materials (art §3.0): gold for
// the house (the ante, the Pot), the current week's gem tier for a player's own
// stake. No new hues — every chip tone already exists in the token system.

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

/** One physical chip — edge notches, a rim, a face, a value. */
export function PokerChip({ tone, size = 40, value, className }: ChipProps) {
  const v = TONE_VARS[tone];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill={v.rim} />
      <circle cx="20" cy="20" r="18.5" fill="none" stroke={v.edge} strokeWidth="5" strokeDasharray="4.2 4.6" />
      <circle cx="20" cy="20" r="14.5" fill={v.face} stroke={v.edge} strokeWidth="1" />
      <circle cx="20" cy="20" r="11" fill="none" stroke={v.rim} strokeOpacity="0.5" strokeWidth="1" />
      {value !== undefined && (
        <text
          x="20"
          y="24.5"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fontFamily="var(--font-display)"
          fill={v.text}
        >
          {value}
        </text>
      )}
    </svg>
  );
}

/** A short stack: 1-3 chips peeking beneath a face chip carrying the total. Reads
 *  as "chips on the felt," not a literal chip-for-chip count (that gets noisy fast). */
export function ChipStack({ tone, total, size = 40, animated }: { tone: ChipTone; total: number; size?: number; animated?: boolean }) {
  const peekCount = total <= 0 ? 0 : total < 20 ? 1 : total < 50 ? 2 : 3;
  const peekOffset = Math.round(size * 0.16);
  const height = size + peekCount * peekOffset;
  return (
    <div className="relative" style={{ width: size, height }}>
      {Array.from({ length: peekCount }).map((_, i) => (
        <div key={i} className="absolute left-0" style={{ top: (i + 1) * peekOffset }}>
          <PokerChip tone={tone} size={size} />
        </div>
      ))}
      <div className="absolute left-0 top-0">
        <PokerChip tone={tone} size={size} value={total} className={animated ? "chip-drop" : ""} />
      </div>
    </div>
  );
}
