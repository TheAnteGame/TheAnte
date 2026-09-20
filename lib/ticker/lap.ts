// How long one lap of the crawl takes (D-101).
//
// The commissioner's setting is a SPEED: how long a line takes to cross the rail.
// The animation, though, moves the track by one full copy of the item set, so the
// lap has to be scaled by how wide that set is — otherwise the same setting means a
// different pixels-per-second on every rail. It did: two short posts crawled at
// 60 px/s on "fastest" while a busy rail sprinted at 373 px/s on the same number,
// which is why the slider felt like it did nothing.

/** The minimum lap; a sub-second animation reads as a flicker, not a crawl. */
const FLOOR_SECONDS = 2;

export function lapSeconds(settingSeconds: number, copyWidth: number, railWidth: number): number {
  if (!Number.isFinite(settingSeconds) || settingSeconds <= 0) return FLOOR_SECONDS;
  if (!Number.isFinite(copyWidth) || !Number.isFinite(railWidth) || copyWidth <= 0 || railWidth <= 0) {
    return Math.max(FLOOR_SECONDS, settingSeconds);
  }
  return Math.max(FLOOR_SECONDS, (settingSeconds * copyWidth) / railWidth);
}
