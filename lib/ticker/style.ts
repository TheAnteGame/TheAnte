// Ticker presentation, shared by the rail and the commissioner's controls so the
// two can never drift. Colours are a closed set drawn from the token system —
// the rail is still part of the product, not a free-form canvas (art §3.2).

export const TICKER_COLORS: Array<{ value: string; label: string; css: string }> = [
  { value: "gold", label: "Gold (the house)", css: "var(--color-gold)" },
  { value: "chrome", label: "Chrome", css: "var(--color-chrome)" },
  { value: "text-hi", label: "Plain white", css: "var(--color-text-hi)" },
  { value: "text-mid", label: "Plain grey", css: "var(--color-text-mid)" },
  { value: "purple", label: "Purple", css: "var(--color-tier-purple-bright)" },
  { value: "red", label: "Red", css: "var(--color-tier-red-bright)" },
  { value: "teal", label: "Teal", css: "var(--color-tier-teal-bright)" },
  { value: "amber", label: "Amber", css: "var(--color-tier-gold-bright)" },
];

export const DEFAULT_ACCENT = "gold";
export const DEFAULT_TEXT = "text-mid";

/** Seconds for one full pass. Lower is faster. */
export const DEFAULT_SPEED = 40;
export const MIN_SPEED = 15;
export const MAX_SPEED = 180;

export function colorCss(value: string | undefined, fallback: string): string {
  return (TICKER_COLORS.find((c) => c.value === value) ?? TICKER_COLORS.find((c) => c.value === fallback)!).css;
}

export function clampSpeed(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(n)));
}
