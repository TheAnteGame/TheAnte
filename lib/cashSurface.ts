// "No cash surface, ever" is a rule about the whole product, not just our own screens
// (rulebook §9): no prices, no purchase, no deposit, no cash-out, and nothing in the
// visual language that implies real money — that is what keeps ANTE a pool rather than
// a book. Wire feeds carry sportsbook marketing, so it is refused at ingest and reaches
// neither the ticker nor the news box (D-025).
//
// Deliberately narrow. "odds" and "spread" are ordinary football words and the bet slip
// shows both, so matching on them would eat real coverage.

const CASH_SURFACE = [
  /promo code/i,
  /bonus bets?\b/i,
  /free bets?\b/i,
  /sign[- ]?up bonus/i,
  /sportsbook/i,
  /betting (promo|offer|site)/i,
  /\b(draftkings|fanduel|betmgm|caesars sportsbook|bet365|espn bet)\b/i,
  /\bwager (now|today)\b/i,
  // Tout content rather than advertising, but it is still telling players where to put
  // real money. "odds", "spread", "lines" and "picks" stay OUT of this list — they are
  // ordinary football words and the slip itself shows a spread and a moneyline.
  /best bets?\b/i,
  /\bparlay/i,
];

export function isCashSurface(title: string): boolean {
  return CASH_SURFACE.some((re) => re.test(title));
}
