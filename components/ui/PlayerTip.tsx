import Link from "next/link";
import type { ReactNode } from "react";

// Every player name on the site is a door to their season (D-104). Clicking or
// tapping the name goes straight there.
//
// The hover tray that used to name them and their team is gone (D-135): it repeated
// the name already on screen, was large enough on desktop to cover the rows around
// it, and the profile one click away carries the full name and team anyway. `team`
// is still accepted so the call sites stay put if the tray ever comes back.
//
// Without an id — a few places do not have one to hand — the name renders as plain
// text: with no tray and no destination there is nothing to interact with.
export function PlayerTip({
  fullName,
  playerId,
  children,
}: {
  fullName: string;
  /** Resolved display name, e.g. "Kansas City Chiefs" — or null if unset/unknown. Currently unused. */
  team: string | null;
  /** Omit where the id is not to hand; the name then renders as plain text. */
  playerId?: string | null;
  children: ReactNode;
}) {
  if (!playerId) return <span className="inline-flex">{children}</span>;
  return (
    <span className="inline-flex">
      <Link
        href={`/player/${playerId}`}
        aria-label={fullName}
        className="relative rounded-none text-left underline decoration-dotted decoration-[color:var(--color-text-low)] underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-chrome)]"
      >
        {children}
      </Link>
    </span>
  );
}
