// FAV / DOG on the bet slip (D-112). The spread and moneyline were shown as numbers,
// and players read them two wrong ways: as a line they had to beat (ANTE settles
// straight-up — §5 — the spread never touches a chip), or as signs they could not
// decode (which of −3 and +3 is the favourite?). The slip now says only who the
// books favour. Pure, so it is tested on every case and the tutorial shares it.

export type Lean = "FAV" | "DOG" | "EVEN";
export type Side = "away" | "home";

/** Who the sportsbooks favour, per side, or null when the slate has no odds yet.
 *  The spread decides (positive = home favoured by that many, ANTE-TECH §3.1); a
 *  zero or missing spread falls back to the moneyline (the lower number is the
 *  favourite); a true coin-flip on both is EVEN. */
export function leanFor(
  spread: number | null,
  awayMoneyline: number | null = null,
  homeMoneyline: number | null = null,
): Record<Side, Lean> | null {
  const by = (fav: Side | null): Record<Side, Lean> =>
    fav === null ? { away: "EVEN", home: "EVEN" } : fav === "home" ? { away: "DOG", home: "FAV" } : { away: "FAV", home: "DOG" };

  if (spread !== null && spread !== 0) return by(spread > 0 ? "home" : "away");

  const haveMoney = awayMoneyline !== null && homeMoneyline !== null && awayMoneyline !== 0 && homeMoneyline !== 0;
  if (haveMoney) {
    if (awayMoneyline === homeMoneyline) return by(null);
    return by(awayMoneyline < homeMoneyline ? "away" : "home");
  }
  // A published spread of exactly 0 is a pick'em even without a moneyline.
  if (spread === 0) return by(null);
  return null;
}
