import { DateTime } from "luxon";
import { LEAGUE_TZ } from "@/lib/time";

// Quiet hours for phone notifications (D-121). Owner's call: nothing buzzes a phone
// between 10pm and 9am league time. Email is untouched — an inbox does not wake
// anyone — so only the push waits, and it waits rather than being dropped: a
// mention at 11pm is still worth seeing at 9am.

export const QUIET_FROM = 22;
export const QUIET_UNTIL = 9;

/** When a push asked for at `now` may go out, or null for "now". `notBeforeHour`
 *  pushes a morning release later still (the week-open push waits for 10am); it never
 *  pulls one earlier than the end of quiet hours. */
export function pushReleaseAt(now: DateTime, notBeforeHour: number = QUIET_UNTIL): Date | null {
  const local = now.setZone(LEAGUE_TZ);
  const morning = Math.max(QUIET_UNTIL, notBeforeHour);
  const at = (day: DateTime) => day.set({ hour: morning, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  if (local.hour >= QUIET_FROM) return at(local.plus({ days: 1 }));
  if (local.hour < morning) return at(local);
  return null;
}
