import { DateTime } from "luxon";

// The league keeps Mountain time (D-089): every deadline, slate open, reminder and
// on-screen clock computes in America/Denver via the tz database — never offset
// arithmetic; the season crosses the November DST change in Week 10 (ANTE-TECH §4.5).
// The NFL's own feed reports kickoffs in Eastern, so that one parse stays in
// America/New_York; a kickoff is an instant, and the zone it was written in is the
// feed's business, not the league's.
export const LEAGUE_TZ = "America/Denver";
export const NFL_TZ = "America/New_York";

export function nowLeague(): DateTime {
  return DateTime.now().setZone(LEAGUE_TZ);
}

/** The weekly anchors (§3, §14): slate opens Tuesday 6:00am MT; deadline Thursday
 *  12:00 noon MT. Derived from the week's FIRST kickoff: its ISO calendar week's
 *  Tuesday. First games are Wednesday or Thursday, never Monday, so the ISO week of
 *  the first kickoff always contains the right Tuesday. */
export function weekAnchors(firstKickoff: Date): { opensAt: Date; deadlineAt: Date } {
  const kick = DateTime.fromJSDate(firstKickoff).setZone(LEAGUE_TZ);
  const tuesday = kick.set({ weekday: 2, hour: 6, minute: 0, second: 0, millisecond: 0 });
  const thursday = tuesday.plus({ days: 2 }).set({ hour: 12 });
  return { opensAt: tuesday.toJSDate(), deadlineAt: thursday.toJSDate() };
}

/** Build a kickoff instant from nflverse's gameday (YYYY-MM-DD) + gametime (HH:mm, Eastern). */
export function kickoffFromNflverse(gameday: string, gametime: string): Date {
  const dt = DateTime.fromISO(`${gameday}T${gametime || "13:00"}`, { zone: NFL_TZ });
  if (!dt.isValid) throw new Error(`Bad kickoff: ${gameday} ${gametime}`);
  return dt.toJSDate();
}
