import type { ReactNode } from "react";
import { Tip } from "./Tip";

// Hover or tap any player's name, anywhere on the site, to see who they are: full
// name and favorite NFL team. Reuses the band's tooltip primitive (D-045) rather
// than a second hover mechanism — same hover-or-focus pair, same viewport-safe tray.
export function PlayerTip({
  fullName,
  team,
  children,
}: {
  fullName: string;
  /** Resolved display name, e.g. "Kansas City Chiefs" — or null if unset/unknown. */
  team: string | null;
  children: ReactNode;
}) {
  const text = team ? `${fullName} — fan of the ${team}` : fullName;
  return (
    <Tip text={text} label={fullName}>
      {children}
    </Tip>
  );
}
