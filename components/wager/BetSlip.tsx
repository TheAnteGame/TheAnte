"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitWager } from "@/app/actions/wager";
import { tierForWeek } from "@/lib/engine";
import { ChipStack, PokerChip } from "@/components/chip/PokerChip";

// The most-used surface in the product, built for a phone on a Wednesday night
// (ANTE-PLAYER §11). Every rule here is advisory UX — the database re-validates all
// of it in submit_ticket. Two teaching moments get real space, not tooltips: the
// spread never settles anything, and which side of the house limit is binding.

export interface SlipGame {
  id: string;
  away: string;
  home: string;
  spread: number | null;
  kickoff: string;
  kickedOff: boolean;
}

export interface SlipCopy {
  heading: string;
  anteLabel: string;
  limitLabel: string;
  committedLabel: string;
  remainingLabel: string;
  gamesLabel: string;
  submitCta: string;
  confirmTitle: string;
  confirmBody: string;
  confirmCta: string;
  cancelCta: string;
  shoveModeCta: string;
  shoveWarning: string;
  shoveCommitNote: string;
  shoveDarkNote: string;
  shoveSpentLabel: string;
  spreadNote: string;
  feltNotice: string;
  cappedRoom: string;
  cappedStack: string;
  minGamesNote: string;
  totalLabel: string;
  errorGeneric: string;
}

interface Props {
  weekId: string;
  weekNumber: number;
  ante: number;
  deadlineLabel: string;
  games: SlipGame[];
  snapshot: { stackPreAnte: number; felt: boolean; houseLimit: number };
  medianSnapshot: number;
  shoveUsedWeek: number | null;
  copy: SlipCopy;
}

type Side = "away" | "home";

export function BetSlip({ weekId, weekNumber, ante, deadlineLabel, games, snapshot, medianSnapshot, shoveUsedWeek, copy }: Props) {
  const router = useRouter();
  const { felt, houseLimit, stackPreAnte } = snapshot;
  const chipTone = tierForWeek(weekNumber);
  const step = felt ? 1 : 10;
  const minChips = felt ? 1 : 10;
  const maxChips = felt ? houseLimit : 50;
  const minGames = felt ? 1 : Math.min(5, Math.max(1, Math.floor(houseLimit / 10)));

  const [picks, setPicks] = useState<Map<string, { side: Side; chips: number }>>(new Map());
  const [shoveMode, setShoveMode] = useState(false);
  const [shovePick, setShovePick] = useState<{ gameId: string; side: Side } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [shoveWord, setShoveWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [bumpedGame, setBumpedGame] = useState<string | null>(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const committed = useMemo(() => [...picks.values()].reduce((s, p) => s + p.chips, 0), [picks]);
  const remaining = houseLimit - committed;
  // §4 — which side binds: your own post-ante stack, or the pre-ante league median.
  const cappedBy = stackPreAnte - (felt ? 0 : ante) <= medianSnapshot ? copy.cappedStack : copy.cappedRoom;

  const pickSide = (gameId: string, side: Side) => {
    setError("");
    if (shoveMode) {
      setShovePick((cur) => (cur?.gameId === gameId && cur.side === side ? null : { gameId, side }));
      return;
    }
    setPicks((cur) => {
      const next = new Map(cur);
      const existing = next.get(gameId);
      if (existing?.side === side) next.delete(gameId);
      else next.set(gameId, { side, chips: Math.min(minChips, maxChips) || minChips });
      return next;
    });
  };

  const bump = (gameId: string, delta: number) => {
    setPicks((cur) => {
      const next = new Map(cur);
      const p = next.get(gameId);
      if (!p) return cur;
      const room = houseLimit - ([...next.values()].reduce((s, x) => s + x.chips, 0) - p.chips);
      const chips = Math.max(minChips, Math.min(p.chips + delta * step, maxChips, room));
      next.set(gameId, { ...p, chips });
      return next;
    });
    if (!reducedMotion) {
      setBumpedGame(gameId);
      window.setTimeout(() => setBumpedGame(null), 250);
    }
  };

  const canSubmit = shoveMode
    ? shovePick !== null
    : picks.size >= minGames && committed > 0 && committed <= houseLimit;

  const submit = async () => {
    setBusy(true);
    setError("");
    const bets = shoveMode
      ? [{ gameId: shovePick!.gameId, side: shovePick!.side, chips: stackPreAnte }]
      : [...picks.entries()].map(([gameId, p]) => ({ gameId, side: p.side, chips: p.chips }));
    const result = await submitWager({ weekId, isShove: shoveMode, bets });
    if (!result.ok) {
      setError(result.error ?? copy.errorGeneric);
      setBusy(false);
      setConfirming(false);
      setShoveWord("");
      return;
    }
    router.refresh();
  };

  const stat = (label: string, value: string, accent?: boolean) => (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-low)]">{label}</span>
      <span className={`nums text-sm font-semibold ${accent ? "text-[color:var(--color-gold)]" : "text-[color:var(--color-text-hi)]"}`}>
        {value}
      </span>
    </div>
  );

  return (
    <section aria-label={copy.heading} className="border border-[color:var(--color-border)]">
      {/* Header strip — always visible while scrolling (§5.2) */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] px-4 py-3 [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.025)_0_1px,transparent_1px_6px)]">
        <span className="font-[family-name:var(--font-display)] font-bold uppercase text-[color:var(--color-chrome)]">
          Wk {weekNumber}
        </span>
        {stat(copy.anteLabel, felt ? "—" : String(ante))}
        <div className="group relative">
          {stat(copy.limitLabel, String(houseLimit))}
          <span className="pointer-events-none absolute left-0 top-full z-20 hidden whitespace-nowrap bg-[color:var(--color-surface-3)] px-2 py-1 text-xs text-[color:var(--color-text-mid)] group-hover:block">
            {cappedBy}
          </span>
        </div>
        {stat(copy.committedLabel, String(shoveMode ? (shovePick ? stackPreAnte : 0) : committed))}
        {!shoveMode && stat(copy.remainingLabel, String(remaining))}
        {!shoveMode && stat(copy.gamesLabel, `${picks.size} / ${minGames}`)}
        <span className="ml-auto text-xs text-[color:var(--color-text-low)]">{deadlineLabel}</span>
      </div>

      {felt && (
        <p className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-2 text-sm text-[color:var(--color-gold)]">
          {copy.feltNotice}
        </p>
      )}

      {shoveMode && (
        <div className="border-b border-[color:var(--color-gold-dim)] bg-[color:var(--color-surface-2)] px-4 py-3 text-sm">
          <p className="text-[color:var(--color-gold)]">{copy.shoveWarning}</p>
          <p className="mt-1 text-[color:var(--color-text-mid)]">
            {copy.shoveCommitNote.replace("{stake}", String(stackPreAnte)).replace("{ante}", String(felt ? 0 : ante))}
          </p>
          <p className="mt-1 text-[color:var(--color-text-low)]">{copy.shoveDarkNote}</p>
        </div>
      )}

      {/* The slate — off-slate games are absent, not greyed out (§5.2) */}
      <ul>
        {games
          .filter((g) => !g.kickedOff)
          .map((g) => {
            const pick = shoveMode
              ? shovePick?.gameId === g.id
                ? { side: shovePick.side, chips: stackPreAnte }
                : undefined
              : picks.get(g.id);
            const sideBtn = (side: Side, team: string) => (
              <button
                type="button"
                onClick={() => pickSide(g.id, side)}
                aria-pressed={pick?.side === side}
                className={`chamfer px-3 py-2 font-[family-name:var(--font-display)] text-sm font-semibold ${
                  pick?.side === side
                    ? "bg-[color:var(--color-chrome)] text-[color:var(--color-canvas)]"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-hi)] hover:bg-[color:var(--color-surface-3)]"
                }`}
              >
                {team}
              </button>
            );
            return (
              <li
                key={g.id}
                className="flex flex-wrap items-center gap-3 border-b border-[color:var(--color-border)] px-4 py-3 last:border-b-0"
              >
                <span className="nums w-20 shrink-0 text-xs text-[color:var(--color-text-low)]">{g.kickoff}</span>
                <div className="flex items-center gap-2">
                  {sideBtn("away", g.away)}
                  <span className="text-xs text-[color:var(--color-text-low)]">@</span>
                  {sideBtn("home", g.home)}
                </div>
                {g.spread !== null && (
                  <span title={copy.spreadNote} className="nums text-xs text-[color:var(--color-text-low)]">
                    {g.spread > 0 ? `${g.home} −${g.spread}` : g.spread < 0 ? `${g.away} −${-g.spread}` : "PK"}
                  </span>
                )}
                {!shoveMode && pick && (
                  <div className="ml-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => bump(g.id, -1)}
                      aria-label={`take back ${step}`}
                      className="relative shrink-0 opacity-70 transition hover:opacity-100"
                    >
                      <PokerChip tone="chrome" size={28} />
                      <span className="absolute inset-0 flex items-center justify-center font-bold text-[color:var(--color-canvas)]">−</span>
                    </button>
                    <ChipStack tone={chipTone} total={pick.chips} size={32} animated={!reducedMotion && bumpedGame === g.id} />
                    <button
                      type="button"
                      onClick={() => bump(g.id, 1)}
                      aria-label={`push in ${step} more`}
                      className="relative shrink-0 transition hover:brightness-110"
                    >
                      <PokerChip tone={chipTone} size={28} />
                      <span className="absolute inset-0 flex items-center justify-center font-bold text-white">+</span>
                    </button>
                  </div>
                )}
                {shoveMode && pick && (
                  <span className="nums ml-auto font-semibold text-[color:var(--color-gold)]">{stackPreAnte}</span>
                )}
              </li>
            );
          })}
      </ul>

      <p className="border-t border-[color:var(--color-border)] px-4 py-2 text-xs text-[color:var(--color-text-low)]">
        {copy.spreadNote}
      </p>

      <div className="flex items-center gap-3 border-t border-[color:var(--color-border)] px-4 py-3">
        <button
          type="button"
          disabled={!canSubmit || busy}
          onClick={() => setConfirming(true)}
          className="chamfer bg-[color:var(--color-chrome)] px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide text-[color:var(--color-canvas)] disabled:opacity-40"
        >
          {copy.submitCta}
        </button>
        {shoveUsedWeek === null ? (
          <button
            type="button"
            onClick={() => {
              setShoveMode((m) => !m);
              setShovePick(null);
              setError("");
            }}
            aria-pressed={shoveMode}
            className={`chamfer px-4 py-3 text-sm font-semibold uppercase tracking-wide ${
              shoveMode
                ? "bg-[color:var(--color-gold)] text-[color:var(--color-canvas)]"
                : "border border-[color:var(--color-gold-dim)] text-[color:var(--color-gold)]"
            }`}
          >
            {copy.shoveModeCta}
          </button>
        ) : (
          <span className="text-xs text-[color:var(--color-text-low)]">
            {copy.shoveSpentLabel.replace("{week}", String(shoveUsedWeek))}
          </span>
        )}
        {!shoveMode && picks.size < minGames && (
          <span className="text-xs text-[color:var(--color-text-low)]">
            {copy.minGamesNote.replace("{min}", String(minGames))}
          </span>
        )}
        {error && (
          <span role="alert" className="text-sm text-[color:var(--color-loss)]">
            — {error}
          </span>
        )}
      </div>

      {/* Confirmation — the commitment moment (§5.2): list everything, say it's final. */}
      {confirming && (
        <div role="dialog" aria-modal="true" aria-label={copy.confirmTitle} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="chamfer w-full max-w-md bg-[color:var(--color-surface-1)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">
              {copy.confirmTitle}
            </h2>
            <ul className="my-4 max-h-48 overflow-y-auto text-sm">
              {(shoveMode
                ? [{ gameId: shovePick!.gameId, side: shovePick!.side, chips: stackPreAnte }]
                : [...picks.entries()].map(([gameId, p]) => ({ gameId, ...p }))
              ).map((b) => {
                const g = games.find((x) => x.id === b.gameId)!;
                return (
                  <li key={b.gameId} className="flex justify-between border-b border-[color:var(--color-border)] py-1">
                    <span>
                      {b.side === "away" ? g.away : g.home} <span className="text-[color:var(--color-text-low)]">({g.away} @ {g.home})</span>
                    </span>
                    <span className="nums font-semibold">{b.chips}</span>
                  </li>
                );
              })}
              <li className="flex justify-between py-1 font-semibold">
                <span>{copy.totalLabel}</span>
                <span className="nums">{shoveMode ? stackPreAnte : committed}</span>
              </li>
            </ul>
            <p className="text-sm text-[color:var(--color-text-mid)]">{shoveMode ? copy.shoveWarning : copy.confirmBody}</p>
            {shoveMode && (
              <input
                value={shoveWord}
                onChange={(e) => setShoveWord(e.target.value.toUpperCase())}
                placeholder="SHOVE"
                aria-label="Type SHOVE to confirm"
                className="chamfer mt-3 w-full bg-[color:var(--color-surface-2)] px-4 py-2 text-center font-[family-name:var(--font-display)] font-bold tracking-widest text-[color:var(--color-gold)] outline-none"
              />
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setShoveWord("");
                }}
                className="px-4 py-2 text-sm text-[color:var(--color-text-mid)]"
              >
                {copy.cancelCta}
              </button>
              <button
                type="button"
                disabled={busy || (shoveMode && shoveWord !== "SHOVE")}
                onClick={() => void submit()}
                className="chamfer bg-[color:var(--color-chrome)] px-5 py-2 font-[family-name:var(--font-display)] font-semibold uppercase text-[color:var(--color-canvas)] disabled:opacity-40"
              >
                {copy.confirmCta}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
