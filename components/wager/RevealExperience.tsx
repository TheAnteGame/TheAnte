"use client";

import { useEffect, useMemo, useState } from "react";

// The reveal is the product's peak moment — spend the budget here (art §7).
// Sequence: full-width interstitial → the shove beat, if the week has one (nobody
// knew, commissioner included — it breaks HERE) → the board, cards turning over.
// Plays once per week per device; prefers-reduced-motion collapses it to a cut.

export interface RevealData {
  weekNumber: number;
  games: Array<{
    id: string;
    away: string;
    home: string;
    spread: number | null;
    kickoff: string;
    sides: Record<
      "away" | "home",
      {
        count: number;
        pays: string | null;
        entries: Array<{ playerId: string; name: string; chips: number; isShove: boolean }>;
      }
    >;
  }>;
  players: Array<{
    playerId: string;
    name: string;
    isFold: boolean;
    isShove: boolean;
    totalChips: number;
    isMe: boolean;
    bets: Array<{ label: string; team: string; chips: number; pays: string | null }>;
  }>;
  shoves: Array<{ name: string; stake: number; team: string }>;
  copy: {
    interstitialTitle: string;
    interstitialSub: string;
    enterCta: string;
    shoveBeatTitle: string;
    shoveBeatBody: string;
    byGameLabel: string;
    byPlayerLabel: string;
    foldedLabel: string;
    shoveLabel: string;
    paysLabel: string;
    nobodyLabel: string;
    youLabel: string;
  };
}

type Act = "interstitial" | "shove" | "board";

export function RevealExperience({ data }: { data: RevealData }) {
  const { copy } = data;
  const seenKey = `ante-reveal-seen-w${data.weekNumber}`;
  const [act, setAct] = useState<Act | null>(null);
  const [view, setView] = useState<"game" | "player">("game");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = sessionStorage.getItem(seenKey) === "1";
    setAct(seen || reduced ? "board" : "interstitial");
  }, [seenKey]);

  const advance = () => {
    if (act === "interstitial" && data.shoves.length > 0) setAct("shove");
    else {
      sessionStorage.setItem(seenKey, "1");
      setAct("board");
    }
  };

  const shoveLine = useMemo(() => {
    const s = data.shoves[0];
    if (!s) return "";
    return copy.shoveBeatBody
      .replace("{name}", s.name)
      .replace("{stake}", String(s.stake))
      .replace("{team}", s.team);
  }, [data.shoves, copy.shoveBeatBody]);

  if (act === null) return null;

  if (act === "interstitial") {
    return (
      <button type="button" onClick={advance} className="reveal-stage chamfer block w-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] px-6 py-20 text-center">
        <p className="font-[family-name:var(--font-display)] text-4xl font-bold uppercase italic tracking-wide text-[color:var(--color-chrome)]">
          {copy.interstitialTitle}
        </p>
        <p className="mt-3 text-[color:var(--color-text-mid)]">{copy.interstitialSub}</p>
        <p className="mt-8 inline-block bg-[color:var(--color-chrome)] px-5 py-2 font-[family-name:var(--font-display)] font-semibold uppercase text-[color:var(--color-canvas)]">
          {copy.enterCta}
        </p>
      </button>
    );
  }

  if (act === "shove") {
    return (
      <button type="button" onClick={advance} className="reveal-stage chamfer block w-full border border-[color:var(--color-gold-dim)] bg-[color:var(--color-surface-1)] px-6 py-20 text-center">
        <p className="font-[family-name:var(--font-display)] text-4xl font-bold uppercase italic tracking-wide text-[color:var(--color-gold)]">
          {copy.shoveBeatTitle}
        </p>
        <p className="mx-auto mt-4 max-w-md text-lg text-[color:var(--color-text-hi)]">{shoveLine}</p>
        {data.shoves.length > 1 && (
          <p className="mt-2 text-sm text-[color:var(--color-gold)]">
            {data.shoves.slice(1).map((s) => `${s.name}: ${s.stake} on ${s.team}`).join(" · ")}
          </p>
        )}
      </button>
    );
  }

  return (
    <section className="border border-[color:var(--color-border)]">
      <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] px-4 py-3">
        <span className="font-[family-name:var(--font-display)] font-bold uppercase text-[color:var(--color-chrome)]">
          Wk {data.weekNumber}
        </span>
        <div className="ml-auto flex gap-1" role="tablist">
          {(
            [
              ["game", copy.byGameLabel],
              ["player", copy.byPlayerLabel],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`chamfer px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                view === v
                  ? "bg-[color:var(--color-chrome)] text-[color:var(--color-canvas)]"
                  : "text-[color:var(--color-text-mid)] hover:bg-[color:var(--color-surface-2)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "game" ? (
        <ul>
          {data.games.map((g, i) => (
            <li key={g.id} className="card-in border-b border-[color:var(--color-border)] px-4 py-3 last:border-b-0" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="mb-2 flex items-baseline gap-3">
                <span className="nums text-xs text-[color:var(--color-text-low)]">{g.kickoff}</span>
                <span className="font-[family-name:var(--font-display)] font-semibold text-[color:var(--color-text-hi)]">
                  {g.away} @ {g.home}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["away", "home"] as const).map((sideKey) => {
                  const side = g.sides[sideKey];
                  const team = sideKey === "away" ? g.away : g.home;
                  return (
                    <div key={sideKey} className="bg-[color:var(--color-surface-1)] p-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-[color:var(--color-text-hi)]">{team}</span>
                        <span className="nums text-sm text-[color:var(--color-text-mid)]">
                          {side.count > 0 && side.pays ? (
                            <>
                              {side.count} · {copy.paysLabel}{" "}
                              <span className="font-semibold text-[color:var(--color-chrome)]">{side.pays}</span>
                            </>
                          ) : (
                            copy.nobodyLabel
                          )}
                        </span>
                      </div>
                      {side.entries.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {side.entries.map((e) => (
                            <li key={e.playerId} className="flex justify-between text-sm">
                              <span className={e.isShove ? "font-semibold text-[color:var(--color-gold)]" : "text-[color:var(--color-text-mid)]"}>
                                {e.name}
                                {e.isShove && <span className="ml-1 text-[10px] uppercase">{copy.shoveLabel}</span>}
                              </span>
                              <span className="nums text-[color:var(--color-text-hi)]">{e.chips}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul>
          {data.players.map((p, i) => (
            <li key={p.playerId} className="card-in border-b border-[color:var(--color-border)] px-4 py-3 last:border-b-0" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-baseline gap-3">
                <span className={`font-[family-name:var(--font-display)] font-semibold ${p.isShove ? "text-[color:var(--color-gold)]" : "text-[color:var(--color-text-hi)]"}`}>
                  {p.name}
                  {p.isMe && <span className="ml-1 text-[10px] uppercase text-[color:var(--color-text-low)]">{copy.youLabel}</span>}
                </span>
                {p.isFold ? (
                  <span className="text-xs uppercase tracking-wide text-[color:var(--color-text-low)]">{copy.foldedLabel}</span>
                ) : p.isShove ? (
                  <span className="text-xs uppercase tracking-wide text-[color:var(--color-gold)]">{copy.shoveLabel}</span>
                ) : null}
                {!p.isFold && <span className="nums ml-auto text-sm text-[color:var(--color-text-mid)]">{p.totalChips}</span>}
              </div>
              {p.bets.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {p.bets.map((b, j) => (
                    <li key={j} className="flex justify-between text-sm">
                      <span className="text-[color:var(--color-text-mid)]">
                        {b.team} <span className="text-[color:var(--color-text-low)]">({b.label})</span>
                      </span>
                      <span className="nums text-[color:var(--color-text-hi)]">
                        {b.chips}
                        {b.pays && <span className="ml-2 text-[color:var(--color-text-low)]">{b.pays}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
