"use client";

import { useMemo, useState } from "react";

// The leaderboard: sortable, dense, plain — eleven columns of real data, no facets,
// no decoration (ANTE-PLAYER §6, art §7). Tabular numerals hold the columns still.

export interface LbRow {
  playerId: string;
  name: string;
  status: string; // 'approved' | 'deactivated'
  stack: number;
  delta: number | null;
  won: number;
  lost: number;
  winPct: number | null;
  pots: number;
  folds: number;
  avgMult: number | null;
  shoveUsedWeek: number | null;
  felt: boolean;
  isMe: boolean;
}

export interface LbCopy {
  heading: string;
  empty: string;
  rank: string;
  player: string;
  stack: string;
  delta: string;
  won: string;
  lost: string;
  winPct: string;
  pots: string;
  folds: string;
  avgMult: string;
  shove: string;
  shoveHeld: string;
  feltBadge: string;
  outBadge: string;
}

type SortKey = "stack" | "delta" | "won" | "lost" | "winPct" | "pots" | "folds" | "avgMult";

export function LeaderboardTable({ rows, copy }: { rows: LbRow[]; copy: LbCopy }) {
  const [sortKey, setSortKey] = useState<SortKey>("stack");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const val = (r: LbRow) => {
      const v = r[sortKey];
      return v === null ? -Infinity : v;
    };
    return [...rows].sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)));
  }, [rows, sortKey, desc]);

  const header = (key: SortKey | null, label: string, align = "text-right") => (
    <th className={`${align} px-2 py-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-text-low)]`}>
      {key ? (
        <button
          type="button"
          onClick={() => {
            if (sortKey === key) setDesc((d) => !d);
            else {
              setSortKey(key);
              setDesc(true);
            }
          }}
          aria-label={`Sort by ${label}`}
          className={`underline-offset-4 hover:underline ${sortKey === key ? "text-[color:var(--color-text-hi)]" : ""}`}
        >
          {label}
          {sortKey === key ? (desc ? " ↓" : " ↑") : ""}
        </button>
      ) : (
        label
      )}
    </th>
  );

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[color:var(--color-text-mid)]">{copy.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-border)]">
            {header(null, copy.rank, "text-left")}
            {header(null, copy.player, "text-left")}
            {header("stack", copy.stack)}
            {header("delta", copy.delta)}
            {header("won", copy.won)}
            {header("lost", copy.lost)}
            {header("winPct", copy.winPct)}
            {header("pots", copy.pots)}
            {header("folds", copy.folds)}
            {header("avgMult", copy.avgMult)}
            {header(null, copy.shove)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const out = r.status === "deactivated";
            return (
              <tr
                key={r.playerId}
                className={`border-b border-[color:var(--color-border)] last:border-b-0 ${
                  out ? "opacity-40" : ""
                } ${r.isMe ? "bg-[color:var(--color-surface-1)]" : ""}`}
              >
                <td className="nums px-2 py-2 text-left text-[color:var(--color-text-low)]">{i + 1}</td>
                <td className="px-2 py-2 text-left">
                  <span className="font-medium text-[color:var(--color-text-hi)]">{r.name}</span>
                  {r.felt && (
                    <span className="ml-2 border border-[color:var(--color-gold-dim)] px-1 text-[9px] uppercase tracking-wider text-[color:var(--color-gold)]">
                      {copy.feltBadge}
                    </span>
                  )}
                  {out && (
                    <span className="ml-2 text-[9px] uppercase tracking-wider text-[color:var(--color-text-low)]">
                      {copy.outBadge}
                    </span>
                  )}
                </td>
                <td className="nums px-2 py-2 text-right font-semibold text-[color:var(--color-text-hi)]">{r.stack}</td>
                <td className={`nums px-2 py-2 text-right ${r.delta === null ? "text-[color:var(--color-text-low)]" : r.delta >= 0 ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
                  {r.delta === null ? "—" : r.delta >= 0 ? `+${r.delta}` : `−${-r.delta}`}
                </td>
                <td className="nums px-2 py-2 text-right">{r.won}</td>
                <td className="nums px-2 py-2 text-right">{r.lost}</td>
                <td className="nums px-2 py-2 text-right">{r.winPct === null ? "—" : `${r.winPct}%`}</td>
                <td className="nums px-2 py-2 text-right">{r.pots}</td>
                <td className="nums px-2 py-2 text-right">{r.folds}</td>
                <td className="nums px-2 py-2 text-right">{r.avgMult === null ? "—" : r.avgMult.toFixed(2)}</td>
                <td className="nums px-2 py-2 text-right text-[color:var(--color-text-mid)]">
                  {r.shoveUsedWeek === null ? copy.shoveHeld : `Wk ${r.shoveUsedWeek}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
