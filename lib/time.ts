import { DateTime } from "luxon";

// Every deadline computes in America/New_York via the tz database — never offset
// arithmetic; the season crosses the November DST change in Week 10 (ANTE-TECH §4.5).
export const ET = "America/New_York";

export function nowET(): DateTime {
  return DateTime.now().setZone(ET);
}

/** The weekly anchors (§3, §14): slate opens Tuesday 6:00am ET; deadline Thursday
 *  12:00 noon ET. Derived from the week's FIRST kickoff: its ISO calendar week's
 *  Tuesday. First games are Wednesday or Thursday, never Monday, so the ISO week of
 *  the first kickoff always contains the right Tuesday. */
export function weekAnchors(firstKickoff: Date): { opensAt: Date; deadlineAt: Date } {
  const kick = DateTime.fromJSDate(firstKickoff).setZone(ET);
  const tuesday = kick.set({ weekday: 2, hour: 6, minute: 0, second: 0, millisecond: 0 });
  const thursday = tuesday.plus({ days: 2 }).set({ hour: 12 });
  return { opensAt: tuesday.toJSDate(), deadlineAt: thursday.toJSDate() };
}

/** Build a kickoff instant from nflverse's gameday (YYYY-MM-DD) + gametime (HH:mm, ET). */
export function kickoffFromNflverse(gameday: string, gametime: string): Date {
  const dt = DateTime.fromISO(`${gameday}T${gametime || "13:00"}`, { zone: ET });
  if (!dt.isValid) throw new Error(`Bad kickoff: ${gameday} ${gametime}`);
  return dt.toJSDate();
}
