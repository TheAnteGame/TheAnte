// How long one lap of the crawl takes (D-101, D-126).
//
// The commissioner's setting is a SPEED: how long a line takes to cross the rail
// on a computer. The animation, though, moves the track by one full copy of the item
// set, so the lap has to be scaled by how wide that set is — otherwise the same
// setting means a different pixels-per-second on every rail. It did: two short posts
// crawled at 60 px/s on "fastest" while a busy rail sprinted at 373 px/s on the same
// number, which is why the slider felt like it did nothing.
//
// The speed is measured against the DESKTOP rail, not the one on screen (D-126). It
// used to be the rail on screen, so a phone (~340px) crawled at under a third of a
// computer's pixels per second: "faster on desktop and extremely slow on mobile".
// Text moves at one speed everywhere; a phone simply sees less of it at once.

/** The minimum lap; a sub-second animation reads as a flicker, not a crawl. */
const FLOOR_SECONDS = 2;

/** The rail the setting is defined on: the dashboard's full width on a computer
 *  (max-w-6xl less its padding). */
export const REFERENCE_RAIL_PX = 1152;

export function lapSeconds(settingSeconds: number, copyWidth: number): number {
  if (!Number.isFinite(settingSeconds) || settingSeconds <= 0) return FLOOR_SECONDS;
  if (!Number.isFinite(copyWidth) || copyWidth <= 0) return Math.max(FLOOR_SECONDS, settingSeconds);
  return Math.max(FLOOR_SECONDS, (settingSeconds * copyWidth) / REFERENCE_RAIL_PX);
}
