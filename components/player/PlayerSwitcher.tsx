"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Jump to another player's season without going back to the dashboard first (D-105).
// Ordered by rank, because the question this answers is almost always "how is the
// person above me betting" — and the rank is carried in the label so the list reads
// as the standings rather than as an address book.

export function PlayerSwitcher({
  label,
  current,
  players,
}: {
  label: string;
  current: string;
  players: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex shrink-0 items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          if (next && next !== current) start(() => router.push(`/player/${next}`));
        }}
        className="chamfer max-w-[13rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-1.5 text-sm text-[color:var(--color-text-hi)] outline-none focus:outline-2 focus:outline-[color:var(--color-chrome)] disabled:opacity-50"
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
