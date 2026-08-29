"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitWager } from "@/app/actions/wager";
import { tierForWeek } from "@/lib/engine";
import { ChipStack } from "@/components/chip/PokerChip";

// The most-used surface in the product, built for a phone on a Wednesday night
// (ANTE-PLAYER §11). Every rule here is advisory UX — the database re-validates all
// of it in submit_ticket. Two teaching moments get real space, not tooltips: the
// spread never settles anything, and which side of the house limit is binding.

export interface SlipGame {
  id: string;
  away: string;
  home: string;
  spread: number | null;
  awayMoneyline: number | null;
  homeMoneyline: number | null;
  kickoff: string;
  kickedOff: boolean;
}

export interface SlipCopy {
  heading: string;
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
  raiseHint: string;
  atLabel: string;
  submitTooltip: string;
  shoveTooltip: string;
  shoveArmTitle: string;
  shoveArmBody: string;
  shoveArmNote: string;
  shoveArmCta: string;
  feltNotice: string;
  cappedRoom: string;
  cappedStack: string;
  minGamesNote: string;
  minGamesNoteOne: string;
  totalLabel: string;
  errorGeneric: string;
}

interface Props {
  weekId: string;
  weekNumber: number;
  ante: number;
  games: SlipGame[];
  snapshot: { stackPreAnte: number; felt: boolean; houseLimit: number };
  medianSnapshot: number;
  shoveUsedWeek: number | null;
  copy: SlipCopy;
}

type Side = "away" | "home";

export function BetSlip({ weekId, weekNumber, ante, games, snapshot, medianSnapshot, shoveUsedWeek, copy }: Props) {
  const router = useRouter();
  const { felt, houseLimit, stackPreAnte } = snapshot;
  const chipTone = tierForWeek(weekNumber);
  const step = felt ? 1 : 10;
  const minChips = felt ? 1 : 10;
  const maxChips = felt ? houseLimit : 50;
  // The stake ladder. Off the felt that is exactly 10/20/30/40/50; on the felt it
  // spans the whole stack in the same five rungs, still in whole chips. Clicking a
  // side walks up the ladder and one more click past the top takes the bet back.
  const rungs = useMemo(() => {
    const count = Math.min(5, Math.max(1, Math.floor((maxChips - minChips) / step) + 1));
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const raw = count === 1 ? minChips : minChips + ((maxChips - minChips) * i) / (count - 1);
      const snapped = Math.min(maxChips, Math.max(minChips, Math.round(raw / step) * step));
      if (!out.includes(snapped)) out.push(snapped);
    }
    return out;
  }, [minChips, maxChips, step]);
  const minGames = felt ? 1 : Math.min(5, Math.max(1, Math.floor(houseLimit / 10)));

  const [picks, setPicks] = useState<Map<string, { side: Side; chips: number }>>(new Map());
  const [shoveMode, setShoveMode] = useState(false);
  const [shovePick, setShovePick] = useState<{ gameId: string; side: Side } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [shoveWord, setShoveWord] = useState("");
  const [arming, setArming] = useState(false);
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
      const p = next.get(gameId);
      const roomFor = houseLimit - ([...next.values()].reduce((s, x) => s + x.chips, 0) - (p?.chips ?? 0));

      // Backing the other side of a game you already have starts the ladder over.
      if (!p || p.side !== side) {
        const opening = Math.min(rungs[0], roomFor);
        if (opening < rungs[0]) return cur;
        next.set(gameId, { side, chips: opening });
        return next;
      }

      const nextRung = rungs.find((r) => r > p.chips);
      // Top of the ladder, or no room left to raise: the next click takes it back.
      if (nextRung === undefined || Math.min(nextRung, roomFor) <= p.chips) {
        next.delete(gameId);
        return next;
      }
      next.set(gameId, { side, chips: Math.min(nextRung, roomFor) });
      return next;
    });
    if (!reducedMotion) {
      setBumpedGame(gameId);
      window.setTimeout(() => setBumpedGame(null), 250);
    }
  };

  // Taking a bet back, directly. The ladder still wraps to nothing at the top; this
  // is the same exit without having to know that.
  const clearPick = (gameId: string) => {
    setError("");
    setPicks((cur) => {
      if (!cur.has(gameId)) return cur;
      const next = new Map(cur);
      next.delete(gameId);
      return next;
    });
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

  const withTip = (text: string, control: React.ReactNode) => (
    <span className="group relative inline-flex">
      {control}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] px-3 py-2 text-xs leading-relaxed text-[color:var(--color-text-mid)] shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );

  const stat = (label: string, value: string, accent?: boolean) => (
    <div className="flex flex-col">
      <span className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{label}</span>
      <span className={`nums text-sm font-semibold ${accent ? "text-[color:var(--color-gold)]" : "text-[color:var(--color-text-hi)]"}`}>
        {value}
      </span>
    </div>
  );

  return (
    <section aria-label={copy.heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {copy.heading}
      </h2>
      {/* The running tally (§5.2). Ante, limit and deadline live on the stakes band
          above, so this bar carries only what changes as you bet — and it is the one
          thing worth keeping in view, so it alone sticks (D-054). It used to sit under
          the band at a measured offset; the band no longer pins, so it goes to the top
          on its own. */}
      <div className="sticky top-0 z-20 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <div className="group relative">
            <div className="flex flex-col">
              <span className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">
                {copy.committedLabel}
              </span>
              <span className="nums text-sm font-semibold text-[color:var(--color-text-hi)]">
                {shoveMode ? (shovePick ? stackPreAnte : 0) : committed}
                <span className="text-[color:var(--color-text-low)]"> / {houseLimit}</span>
              </span>
            </div>
            <span className="pointer-events-none absolute left-0 top-full z-30 hidden whitespace-nowrap border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] px-2 py-1 text-xs text-[color:var(--color-text-mid)] group-hover:block">
              {copy.limitLabel} — {cappedBy}
            </span>
          </div>
          {!shoveMode && stat(copy.remainingLabel, String(remaining), remaining === 0)}
          {!shoveMode && stat(copy.gamesLabel, `${picks.size} / ${minGames}`)}
        </div>
        {/* How full the table is, at a glance, without reading a number. */}
        {!shoveMode && (
          <div className="h-1 w-full bg-[color:var(--color-surface-3)]" aria-hidden>
            <div
              className="h-full bg-[color:var(--color-chrome)] transition-[width] duration-200"
              style={{ width: `${houseLimit > 0 ? Math.min(100, (committed / houseLimit) * 100) : 0}%` }}
            />
          </div>
        )}
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

      {!shoveMode && (
        <p className="px-4 pt-3 text-xs text-[color:var(--color-text-low)]">
          {copy.raiseHint.replace("{max}", String(rungs[rungs.length - 1]))}
        </p>
      )}

      {/* The slate — off-slate games are absent, not greyed out (§5.2). The game sits
          in the middle and the two sides face each other across it, so backing a team
          is one press on the team itself rather than a stepper parked off to the side. */}
      <ul>
        {games
          .filter((g) => !g.kickedOff)
          .map((g) => {
            const pick = shoveMode
              ? shovePick?.gameId === g.id
                ? { side: shovePick.side, chips: stackPreAnte }
                : undefined
              : picks.get(g.id);
            const rung = pick ? rungs.findIndex((r) => r >= pick.chips) + 1 : 0;
            // Positive spread = home favoured by that many (ANTE-TECH §3.1). Both
            // numbers are frozen sportsbook context: neither settles anything here.
            const signed = (n: number) => (n < 0 ? `\u2212${Math.abs(n)}` : `+${n}`);
            const spreadFor = (side: Side) => {
              if (g.spread === null) return null;
              if (g.spread === 0) return "PK";
              const favourite: Side = g.spread > 0 ? "home" : "away";
              const magnitude = Math.abs(g.spread);
              return side === favourite ? `\u2212${magnitude}` : `+${magnitude}`;
            };
            const moneyFor = (side: Side) => {
              const n = side === "away" ? g.awayMoneyline : g.homeMoneyline;
              return n === null || n === 0 ? null : signed(n);
            };

            const sideBtn = (side: Side, team: string) => {
              const active = pick?.side === side;
              const label = shoveMode
                ? team
                : active
                  ? `${team} — ${pick!.chips} in. Press to ${rung >= rungs.length ? "take it back" : `raise to ${rungs[rung]}`}.`
                  : `${team} — press to back for ${rungs[0]}.`;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => pickSide(g.id, side)}
                  onKeyDown={(e) => {
                    // The cancel inside is a control of its own: its Enter/Space is
                    // its own, not another raise on the way past.
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pickSide(g.id, side);
                    }
                  }}
                  aria-pressed={active}
                  aria-label={label}
                  className={`chamfer flex cursor-default select-none flex-col items-center justify-center gap-2 px-3 py-3 text-center font-[family-name:var(--font-display)] text-sm font-semibold transition ${
                    active
                      ? "chrome-face border border-[color:var(--color-chrome)]"
                      : "team-tile text-[color:var(--color-text-hi)]"
                  }`}
                >
                  <span className="leading-tight">{team}</span>
                  {(spreadFor(side) || moneyFor(side)) && (
                    <span
                      title={copy.spreadNote}
                      className={`nums flex items-center gap-1.5 text-[12px] font-normal ${
                        active ? "text-[color:var(--color-canvas)]/55" : "text-[color:var(--color-text-low)]"
                      }`}
                    >
                      {spreadFor(side) && <span>{spreadFor(side)}</span>}
                      {spreadFor(side) && moneyFor(side) && <span aria-hidden>·</span>}
                      {moneyFor(side) && <span>{moneyFor(side)}</span>}
                    </span>
                  )}
                  {active && !shoveMode && (
                    <>
                      {/* Five presses to clear is a rule you have to read; a cancel next
                          to the stack is one you can see. It rides right as the fan
                          grows, so it stays where the chips just landed. */}
                      <span className="flex items-center gap-2">
                        <ChipStack
                          tone={chipTone}
                          total={pick!.chips}
                          count={rung}
                          size={44}
                          animated={!reducedMotion && bumpedGame === g.id}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearPick(g.id);
                          }}
                          aria-label={`${team} \u2014 take the bet back.`}
                          className="shrink-0 cursor-pointer text-[color:var(--color-canvas)]/40 transition-colors hover:text-[color:var(--color-canvas)]/75"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                            <circle cx="10" cy="10" r="8.2" stroke="currentColor" strokeWidth="1.3" />
                            <path
                              d="M7.4 7.4 L12.6 12.6 M12.6 7.4 L7.4 12.6"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </span>
                      {/* Five rungs, drawn: the reset stops being a surprise. */}
                      <span className="flex gap-1" aria-hidden>
                        {rungs.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1 w-3 ${i < rung ? "bg-[color:var(--color-canvas)]" : "bg-[color:var(--color-canvas)]/25"}`}
                          />
                        ))}
                      </span>
                    </>
                  )}
                  {active && shoveMode && (
                    <span className="nums text-[color:var(--color-gold)]">{stackPreAnte}</span>
                  )}
                </div>
              );
            };

            return (
              <li key={g.id} className="border-b border-[color:var(--color-border)] px-4 py-3 last:border-b-0">
                <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4">
                  {sideBtn("away", g.away)}
                  <div className="flex flex-col items-center justify-center gap-0.5 px-1 text-center">
                    <span className="nums text-[12px] text-[color:var(--color-text-low)]">{g.kickoff}</span>
                    <span className="text-[12px] uppercase tracking-[0.2em] text-[color:var(--color-text-low)]">{copy.atLabel}</span>
                  </div>
                  {sideBtn("home", g.home)}
                </div>
              </li>
            );
          })}
      </ul>

      <p className="border-t border-[color:var(--color-border)] px-4 py-2 text-xs text-[color:var(--color-text-low)]">
        {copy.spreadNote}
      </p>

      {/* The commitment row (D-040): the action and its own instruction sit together on
          the left; the shove is a rare, separate decision and lives out at the right
          margin so it never reads as step one. Gold marks the button you are working
          toward; it becomes the chrome face the moment the slip is legal. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[color:var(--color-border)] px-4 py-3">
        {withTip(
          copy.submitTooltip,
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={() => setConfirming(true)}
            className={`chamfer px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide ${
              canSubmit
                ? "chrome-face text-[color:var(--color-canvas)]"
                : "bg-[color:var(--color-gold)] text-[color:var(--color-canvas)] opacity-90"
            }`}
          >
            {copy.submitCta}
          </button>,
        )}
        {!shoveMode && picks.size < minGames && (
          <span className="text-xs text-[color:var(--color-text-low)]">
            {minGames === 1 ? copy.minGamesNoteOne : copy.minGamesNote.replace("{min}", String(minGames))}
          </span>
        )}
        {error && (
          <span role="alert" className="text-sm text-[color:var(--color-loss)]">
            — {error}
          </span>
        )}

        <div className="ml-auto">
          {shoveUsedWeek === null ? (
            withTip(
              copy.shoveTooltip,
              <button
                type="button"
                onClick={() => {
                  if (shoveMode) {
                    setShoveMode(false);
                    setShovePick(null);
                    setError("");
                  } else {
                    setArming(true);
                  }
                }}
                aria-pressed={shoveMode}
                className={`chamfer px-4 py-3 text-sm font-semibold uppercase tracking-wide ${
                  shoveMode
                    ? "bg-[color:var(--color-chrome-dim)] text-[color:var(--color-canvas)]"
                    : "border border-[color:var(--color-text-low)] text-[color:var(--color-text-mid)] hover:border-[color:var(--color-chrome)] hover:text-[color:var(--color-text-hi)]"
                }`}
              >
                {copy.shoveModeCta}
              </button>,
            )
          ) : (
            <span className="text-xs text-[color:var(--color-text-low)]">
              {copy.shoveSpentLabel.replace("{week}", String(shoveUsedWeek))}
            </span>
          )}
        </div>
      </div>

      {/* Arming gate (D-040). Pressing "The shove" used to switch the board straight
          into shove mode with no explanation. This says what a shove costs and that
          there is exactly one — and is explicit that arming commits nothing. */}
      {arming && (
        <div role="dialog" aria-modal="true" aria-label={copy.shoveArmTitle} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="chamfer w-full max-w-md border-2 border-[color:var(--color-gold)] bg-[color:var(--color-surface-1)] p-6">
            <h3 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-wide text-[color:var(--color-gold)]">
              {copy.shoveArmTitle}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-hi)]">{copy.shoveArmBody}</p>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-low)]">{copy.shoveArmNote}</p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setArming(false)}
                className="chamfer px-4 py-2 text-sm font-semibold text-[color:var(--color-text-mid)] hover:text-[color:var(--color-text-hi)]"
              >
                {copy.cancelCta}
              </button>
              <button
                type="button"
                onClick={() => {
                  setArming(false);
                  setShoveMode(true);
                  setShovePick(null);
                  setError("");
                }}
                className="chamfer chrome-face px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[color:var(--color-canvas)]"
              >
                {copy.shoveArmCta}
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="chamfer chrome-face px-5 py-2 font-[family-name:var(--font-display)] font-semibold uppercase text-[color:var(--color-canvas)]"
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
