"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChipStack, PokerChip } from "@/components/chip/PokerChip";

// The how-to-play gate's tutorial, rebuilt to the owner's 2026-08-22 wireframes after
// user testing found the old five-step overlay flow confusing. Eight self-contained
// cards now: title / subtitle / description on the left, a step-specific visual on the
// right (stacked, text first, below 640px), a chip step marker on the card's top edge.
// Only Step 1 is interactive — the same press-to-raise ladder as the real slip (D-009),
// and Next stays locked until a chip lands, because a tutorial that teaches the one
// control the product lives on should make you use it once.
//
// Every sample here is fabricated and rendered from consts — no server reads until the
// final accept. Fake names never collide with the roster because there is no roster
// read at all.

export interface StepCopy {
  title: string;
  sub: string;
  body: string;
}

export interface HowToPlayCopy {
  stepLabel: string;
  nextCta: string;
  backCta: string;
  skipCta: string;
  acceptCta: string;
  steps: StepCopy[]; // exactly 8, in play order
  sampleNote: string;
  exCrowdTitle: string;
  exCrowdLine: string;
  exCrowdResult: string;
  exDogTitle: string;
  exDogLine: string;
  exDogResult: string;
  potTotalLabel: string;
  yourStackLabel: string;
  winnerLabel: string;
  championNote: string;
  feltNote: string;
  shoveTitle: string;
  shoveBody: string;
  foldTitle: string;
  foldBody: string;
  learnMoreLabel: string;
  linkRules: string;
  linkGuide: string;
  atLabel: string;
}

interface Props {
  copy: HowToPlayCopy;
  acceptAction: { (): Promise<void> };
}

type Side = "away" | "home";

// ── Sample data (rendered via {expr}, never literal JSX text) ──────────────────
const MOCK_GAMES = [
  { id: "m1", away: "BUF", home: "KC", spread: 2.5, kickoff: "Sun 4:25pm" },
  { id: "m2", away: "DAL", home: "PHI", spread: -3, kickoff: "Sun 8:20pm" },
  { id: "m3", away: "SF", home: "SEA", spread: 1, kickoff: "Mon 8:15pm" },
];
const RUNGS = [10, 20, 30, 40, 50];

// Step 2 — the reveal sample: who backed what, chips shown, per the wireframe.
const REVEAL_SAMPLE = [
  { away: "BUF", home: "KC", awayBackers: [["Frank M.", 30], ["Dee O.", 10]], homeBackers: [["Rosa P.", 50], ["Sam W.", 20], ["Nina V.", 10]] },
  { away: "DAL", home: "PHI", awayBackers: [["Sam W.", 40]], homeBackers: [["Frank M.", 20], ["Dee O.", 30]] },
  { away: "SF", home: "SEA", awayBackers: [["Nina V.", 20], ["Rosa P.", 10]], homeBackers: [["Curt D.", 10]] },
] as const;

// Step 5 — final stacks after Week 18. The spread of outcomes is the message.
const LEADERBOARD_SAMPLE = [
  { name: "Rosa P.", stack: 812 },
  { name: "Frank M.", stack: 655 },
  { name: "Sam W.", stack: 590 },
  { name: "Dee O.", stack: 505 },
  { name: "Nina V.", stack: 341 },
  { name: "Curt D.", stack: 122 },
] as const;

// Step 6 — a stack falling toward the felt and stopping at 1, never 0.
const FELT_SLIDE = [500, 180, 45, 1] as const;

export function HowToPlayTutorial({ copy, acceptAction }: Props) {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<Map<string, { side: Side; chips: number }>>(new Map());
  const [chipBump, setChipBump] = useState<string | null>(null);
  // Subscribed, not set-in-effect: the OS setting can change mid-session, and the
  // store form gives SSR a stable false without a cascading first render.
  const reducedMotion = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const total = copy.steps.length;
  const current = copy.steps[step];
  const isFirst = step === 0;
  const isLast = step === total - 1;
  // Step 1 teaches the press-to-raise control; it is not done until a chip lands.
  const canAdvance = step !== 0 || picks.size > 0;

  /** Same ladder as the real slip (D-009): press to back, press again to raise, one
   *  past the top clears — and the ✕ beside the chips clears it directly (D-042). */
  const pressSide = (gameId: string, side: Side) => {
    setPicks((cur) => {
      const next = new Map(cur);
      const p = next.get(gameId);
      if (!p || p.side !== side) {
        next.set(gameId, { side, chips: RUNGS[0] });
        return next;
      }
      const up = RUNGS.find((r) => r > p.chips);
      if (up === undefined) next.delete(gameId);
      else next.set(gameId, { side, chips: up });
      return next;
    });
    if (!reducedMotion) {
      setChipBump(gameId);
      window.setTimeout(() => setChipBump(null), 250);
    }
  };

  /** The cancel beside the chips, same as the real slip (D-042). The tutorial has to
   *  teach the board that exists, not the one that existed before the ✕. */
  const clearSide = (gameId: string) => {
    setPicks((cur) => {
      if (!cur.has(gameId)) return cur;
      const next = new Map(cur);
      next.delete(gameId);
      return next;
    });
  };

  const anim = (cls: string) => (reducedMotion ? "" : cls);
  const focusCls =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-chrome)] focus-visible:outline-offset-2";
  const noteCls = "text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]";

  // ── Step visuals ─────────────────────────────────────────────────────────────

  const mockBoard = (
    <ul className="flex flex-col">
      {MOCK_GAMES.map((g) => {
        const pick = picks.get(g.id);
        const rung = pick ? RUNGS.findIndex((r) => r >= pick.chips) + 1 : 0;
        const spreadFor = (side: Side) => {
          if (g.spread === 0) return "PK";
          const fav: Side = g.spread > 0 ? "home" : "away";
          const mag = Math.abs(g.spread);
          return side === fav ? `−${mag}` : `+${mag}`;
        };
        const sideBtn = (side: Side, team: string) => {
          const active = pick?.side === side;
          return (
            <div
              role="button"
              tabIndex={0}
              onClick={() => pressSide(g.id, side)}
              onKeyDown={(e) => {
                // The cancel inside owns its own Enter/Space — otherwise clearing a
                // pick would raise it again on the way past.
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pressSide(g.id, side);
                }
              }}
              aria-pressed={active}
              className={`flex cursor-default select-none flex-col items-center justify-center gap-2 px-3 py-3 text-center font-[family-name:var(--font-display)] text-sm font-semibold transition ${focusCls} ${
                active ? "chamfer chrome-face border border-[color:var(--color-chrome)]" : "chamfer team-tile text-[color:var(--color-text-hi)]"
              }`}
            >
              <span className="leading-tight">{team}</span>
              <span
                className={`nums text-[12px] font-normal ${active ? "text-[color:var(--color-canvas)]/55" : "text-[color:var(--color-text-low)]"}`}
              >
                {spreadFor(side)}
              </span>
              {active && (
                <span className="flex items-center gap-2">
                  <ChipStack tone="purple" total={pick!.chips} count={rung} size={38} animated={!reducedMotion && chipBump === g.id} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSide(g.id);
                    }}
                    aria-label={`${team} — take the bet back.`}
                    className={`shrink-0 cursor-pointer text-[color:var(--color-canvas)]/40 transition-colors hover:text-[color:var(--color-canvas)]/75 ${focusCls}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
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
              )}
            </div>
          );
        };
        return (
          <li key={g.id} className="border-b border-[color:var(--color-border)] py-3 last:border-b-0">
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
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
  );

  const revealSample = (
    <div className="flex flex-col">
      {REVEAL_SAMPLE.map((g) => {
        const col = (team: string, backers: ReadonlyArray<readonly [string, number]>) => (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-[family-name:var(--font-display)] text-sm font-bold text-[color:var(--color-text-hi)]">{team}</span>
            {backers.map(([name, chips]) => (
              <span key={name} className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="truncate text-[color:var(--color-text-mid)]">{name}</span>
                <span className="nums text-[color:var(--color-text-low)]">{chips}</span>
              </span>
            ))}
          </div>
        );
        return (
          <div key={g.away} className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-b border-[color:var(--color-border)] py-3 last:border-b-0">
            {col(g.away, g.awayBackers)}
            <span className="self-center text-[12px] uppercase tracking-[0.2em] text-[color:var(--color-text-low)]">{copy.atLabel}</span>
            {col(g.home, g.homeBackers)}
          </div>
        );
      })}
    </div>
  );

  const payoutExamples = (
    <div className="flex flex-col gap-4">
      {(
        [
          { title: copy.exCrowdTitle, line: copy.exCrowdLine, result: copy.exCrowdResult, hot: false },
          { title: copy.exDogTitle, line: copy.exDogLine, result: copy.exDogResult, hot: true },
        ] as const
      ).map((ex) => (
        <div key={ex.title} className={`chamfer border p-4 ${ex.hot ? "border-[color:var(--color-gold)] bg-[color:var(--color-surface-2)]" : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]"}`}>
          <p className={`text-sm font-bold uppercase tracking-wide ${ex.hot ? "text-[color:var(--color-gold)]" : "text-[color:var(--color-text-hi)]"}`}>
            {ex.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{ex.line}</p>
          <p className={`nums mt-2 text-sm font-semibold ${ex.hot ? "text-[color:var(--color-win)]" : "text-[color:var(--color-text-hi)]"}`}>{ex.result}</p>
        </div>
      ))}
    </div>
  );

  const potFlow = (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="chamfer flex items-center gap-3 border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-5 py-3">
        <PokerChip tone="gold" size={34} />
        <div className="flex flex-col">
          <span className="nums text-xl font-semibold text-[color:var(--color-text-hi)]">90</span>
          <span className={noteCls}>{copy.potTotalLabel}</span>
        </div>
      </div>
      <span aria-hidden className="text-xl leading-none text-[color:var(--color-gold)]">
        ▼
      </span>
      <div className="chamfer flex items-center gap-3 border border-[color:var(--color-gold)] bg-[color:var(--color-surface-2)] px-5 py-3">
        <PokerChip tone="purple" size={34} />
        <div className="flex flex-col">
          <span className="nums text-xl font-semibold text-[color:var(--color-gold)]">590</span>
          <span className={noteCls}>{copy.yourStackLabel}</span>
        </div>
      </div>
    </div>
  );

  const leaderboardSample = (
    <div className="flex flex-col">
      {LEADERBOARD_SAMPLE.map((row, i) => (
        <div
          key={row.name}
          className={`flex items-baseline gap-3 border-b border-[color:var(--color-border)] px-2 py-2 text-sm last:border-b-0 ${i === 0 ? "bg-[color:var(--color-surface-2)]" : ""}`}
        >
          <span className="nums w-6 shrink-0 text-[color:var(--color-text-low)]">{i + 1}</span>
          <span className={i === 0 ? "font-semibold text-[color:var(--color-gold)]" : "text-[color:var(--color-text-hi)]"}>{row.name}</span>
          {i === 0 && (
            <span className="text-[11px] uppercase tracking-wider text-[color:var(--color-gold)]">{copy.winnerLabel}</span>
          )}
          <span className={`nums ml-auto font-semibold ${i === 0 ? "text-[color:var(--color-gold)]" : "text-[color:var(--color-text-mid)]"}`}>
            {row.stack}
          </span>
        </div>
      ))}
      <p className={`px-2 pt-3 ${noteCls}`}>{copy.championNote}</p>
    </div>
  );

  const feltVisual = (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex items-end justify-center gap-6">
        {FELT_SLIDE.map((v, i) => (
          <div key={v} className="flex flex-col items-center gap-1.5">
            <ChipStack tone={i === FELT_SLIDE.length - 1 ? "gold" : "purple"} total={v} count={Math.max(1, 4 - i)} size={34} />
            <span className="nums text-[12px] text-[color:var(--color-text-mid)]">{v}</span>
          </div>
        ))}
      </div>
      <p className="max-w-xs text-center text-sm leading-relaxed text-[color:var(--color-text-mid)]">{copy.feltNote}</p>
    </div>
  );

  const playsSample = (
    <div className="flex flex-col gap-4">
      {(
        [
          { title: copy.shoveTitle, body: copy.shoveBody },
          { title: copy.foldTitle, body: copy.foldBody },
        ] as const
      ).map((box) => (
        <div key={box.title} className="chamfer border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-gold)]">{box.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{box.body}</p>
        </div>
      ))}
    </div>
  );

  const learnMore = (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-text-hi)]">{copy.learnMoreLabel}</p>
      {/* New tab: mid-gate, navigating away would lose tutorial progress. /rules is
          public; /guide needs only a session, not the gate, so both work from here. */}
      <a href="/rules" target="_blank" rel="noreferrer" className="chamfer team-tile px-4 py-3 text-sm font-semibold text-[color:var(--color-text-hi)]">
        {copy.linkRules}
      </a>
      <a href="/guide" target="_blank" rel="noreferrer" className="chamfer team-tile px-4 py-3 text-sm font-semibold text-[color:var(--color-text-hi)]">
        {copy.linkGuide}
      </a>
    </div>
  );

  const visuals = useMemo(
    () => [mockBoard, revealSample, payoutExamples, potFlow, leaderboardSample, feltVisual, playsSample, learnMore],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picks, chipBump, reducedMotion, copy],
  );

  // Steps 1, 2 and 5 render fabricated players/games; the note keeps them honest.
  const showSampleNote = step === 1 || step === 4;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-1" aria-hidden>
        {copy.steps.map((s, i) => (
          // Index key on purpose: titles are commissioner-editable content, and two
          // steps given the same title would otherwise collide as React keys.
          <span key={i} className={`h-1 w-6 chamfer ${i <= step ? "bg-[color:var(--color-gold)]" : "bg-[color:var(--color-surface-3)]"}`} />
        ))}
      </div>
      <p className="text-center text-xs text-[color:var(--color-text-low)]">
        {copy.stepLabel.replace("{step}", String(step + 1)).replace("{total}", String(total))}
      </p>

      {/* The card. The chip step marker sits ON the top edge (wireframe): it is a
          sibling of the chamfered box, not a child — the clip-path would slice it. */}
      <div className="relative mt-3">
        <div
          key={step}
          className={`chamfer border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] p-5 pt-7 sm:p-7 ${anim("callout-in")}`}
        >
          <div className="grid gap-6 sm:grid-cols-[2fr_3fr] sm:gap-8">
            <div className="flex flex-col gap-1">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase leading-tight tracking-wide text-[color:var(--color-gold)]">
                {current.title}
              </h2>
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold uppercase tracking-wide text-[color:var(--color-chrome)]">
                {current.sub}
              </p>
              <p className="mt-3 text-base leading-relaxed text-[color:var(--color-text-hi)]">{current.body}</p>
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              {visuals[step]}
              {showSampleNote && <p className={`pt-3 text-center ${noteCls}`}>{copy.sampleNote}</p>}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <PokerChip tone="gold" size={38} value={step + 1} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={isFirst}
          className={`chamfer px-4 py-2 text-sm font-semibold text-[color:var(--color-text-mid)] hover:text-[color:var(--color-text-hi)] disabled:invisible ${focusCls}`}
        >
          {copy.backCta}
        </button>

        {!isLast && (
          <button
            type="button"
            onClick={() => setStep(total - 1)}
            className={`chamfer px-4 py-2 text-xs uppercase tracking-wider text-[color:var(--color-text-low)] hover:text-[color:var(--color-text-mid)] ${focusCls}`}
          >
            {copy.skipCta}
          </button>
        )}

        {isLast ? (
          <form action={acceptAction}>
            <button type="submit" className={`chamfer chrome-face px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide ${focusCls}`}>
              {copy.acceptCta}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => canAdvance && setStep((s) => Math.min(total - 1, s + 1))}
            disabled={!canAdvance}
            className={`chamfer chrome-face px-6 py-2.5 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide ${focusCls}`}
          >
            {copy.nextCta}
          </button>
        )}
      </div>
    </div>
  );
}
