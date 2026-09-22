import type { ReactNode } from "react";
import { Tip } from "./Tip";

// Every player name on the site is a door to their season (D-104). Clicking or
// tapping the name goes straight there; on a pointer device a hover tray still names
// them and their team first. Deliberately NOT a two-step card-then-link: the profile
// carries everything the tray says and more, so a phone tap is better spent arriving
// than opening a card it would have to close again.
//
// Without an id — a few places do not have one to hand — it stays the old identity
// tray, tap-to-toggle as before (D-090).
export function PlayerTip({
  fullName,
  team,
  playerId,
  children,
}: {
  fullName: string;
  /** Resolved display name, e.g. "Kansas City Chiefs" — or null if unset/unknown. */
  team: string | null;
  /** Omit where the id is not to hand; the card then just names them. */
  playerId?: string | null;
  children: ReactNode;
}) {
  const text = team ? `${fullName} — fan of the ${team}` : fullName;
  return (
    <Tip text={text} label={fullName} marker="underline" href={playerId ? `/player/${playerId}` : undefined}>
      {children}
    </Tip>
  );
}
