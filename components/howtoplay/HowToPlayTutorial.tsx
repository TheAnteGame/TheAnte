"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChipStack, PokerChip } from "@/components/chip/PokerChip";

// The how-to-play gate's interactive tutorial: a harmless mock game board (fake games,
// no server calls until the final accept) with a guided click-through and pointer
// callouts. This is a confirmed "loud zone" alongside the stakes band and the real
// bet slip (D-007) — texture, glow, and micro-motion are in scope here.
// Below 640px the floating pointer becomes a sticky bottom sheet (one-handed mobile).
//
// Five steps, not ten (D-016). The middle step is the one that was missing: how you
// get paid, and therefore why hunting the unpopular side is the entire game. The mock
// board mirrors the real one — press a team to raise — because a tutorial that teaches
// a control the product no longer has is worse than no tutorial.

export interface HowToPlayCopy {
  stepLabel: string;
  nextCta: string;
  backCta: string;
  skipCta: string;
  acceptCta: string;
  tableTitle: string;
  tableBody: string;
  betTitle: string;
  betBody: string;
  edgeTitle: string;
  edgeBody: string;
  revealTitle: string;
  revealBody: string;
  potTitle: string;
  potBody: string;
  readyTitle: string;
  readyBody: string;
  anteLabel: string;
  limitLabel: string;
  potLabel: string;
  atLabel: string;
}

interface Props {
  copy: HowToPlayCopy;
  acceptAction: { (): Promise<void> };
}

type Side = "away" | "home";
type TargetKey = "pick" | "pot";

interface Step {
  id: string;
  title: string;
  body: string;
  target: TargetKey | null;
  requireClick?: boolean;
  showRevealCard?: boolean;
}

const MOCK_GAMES = [
  { id: "m1", away: "BUF", home: "KC", spread: 2.5, awayMl: 115, homeMl: -135, kickoff: "Sun 4:25pm" },
  { id: "m2", away: "DAL", home: "PHI", spread: -3, awayMl: -155, homeMl: 130, kickoff: "Sun 8:20pm" },
  { id: "m3", away: "SF", home: "SEA", spread: 1, awayMl: -105, homeMl: -115, kickoff: "Mon 8:15pm" },
];

const RUNGS = [10, 20, 30, 40, 50];
const MOCK_ANTE = 10;
const MOCK_LIMIT = 160;
const MOCK_POT = 80;

function Callout({
  title,
  body,
  animated,
  stepNum,
}: {
  title: string;
  body: string;
  animated: boolean;
  stepNum: number;
}) {
  // `chamfer` is a clip-path, and a clip-path clips absolutely positioned children
  // too — which is what was slicing the step chip against the border. The chip is a
  // sibling of the clipped box, not a child of it.
  return (
    <div className="relative w-72 max-w-[calc(100vw-2rem)]">
      <div
        className={`chamfer border-2 border-[color:var(--color-gold)] bg-[color:var(--color-surface-2)] p-4 pt-5 shadow-[0_8px_28px_rgba(0,0,0,0.55)] ${
          animated ? "callout-in" : ""
        }`}
      >
        <p className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-gold)]">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-text-hi)]">{body}</p>
      </div>
      <div className="pointer-events-none absolute -left-3 -top-3 z-10">
        <PokerChip tone="gold" size={30} value={stepNum} />
      </div>
    </div>
  );
}

export function HowToPlayTutorial({ copy, acceptAction }: Props) {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<Map<string, { side: Side; chips: number }>>(new Map());
  const [chipBump, setChipBump] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [calloutStyle, setCalloutStyle] = useState<{ top?: number; bottom?: number; left: number } | null>(
    null,
  );
  const [spotlightRect, setSpotlightRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);
  const potRef = useRef<HTMLDivElement>(null);

  const targets: Record<TargetKey, RefObject<HTMLElement | null>> = { pick: pickRef, pot: potRef };

  const STEPS: Step[] = useMemo(
    () => [
      { id: "table", title: copy.tableTitle, body: copy.tableBody, target: null },
      { id: "bet", title: copy.betTitle, body: copy.betBody, target: "pick", requireClick: true },
      { id: "edge", title: copy.edgeTitle, body: copy.edgeBody, target: null },
      { id: "reveal", title: copy.revealTitle, body: copy.revealBody, target: null, showRevealCard: true },
      { id: "pot", title: copy.potTitle, body: copy.potBody, target: "pot" },
    ],
    [copy],
  );

  const total = STEPS.length;
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === total - 1;
  const canAdvance = !current.requireClick || picks.size > 0;

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const mq = window.matchMedia("(max-width: 639px)");
    setIsPhone(mq.matches);
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    if (!current.target || !rootRef.current) {
      setCalloutStyle(null);
      setSpotlightRect(null);
      return;
    }
    const measure = () => {
      const root = rootRef.current;
      const targetEl = targets[current.target!].current;
      if (!root || !targetEl) {
        setCalloutStyle(null);
        setSpotlightRect(null);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const pad = 6;
      setSpotlightRect({
        top: targetRect.top - rootRect.top - pad,
        left: targetRect.left - rootRect.left - pad,
        width: targetRect.width + pad * 2,
        height: targetRect.height + pad * 2,
      });
      if (isPhone) {
        setCalloutStyle(null);
        return;
      }
      const calloutWidth = 288;
      const placeAbove = window.innerHeight - targetRect.bottom < 180;
      const targetMidX = targetRect.left - rootRect.left + targetRect.width / 2;
      const maxLeft = Math.max(8, rootRect.width - calloutWidth - 8);
      const left = Math.max(8, Math.min(targetMidX - calloutWidth / 2, maxLeft));
      setCalloutStyle(
        placeAbove
          ? { bottom: rootRect.height - (targetRect.top - rootRect.top) + 10, left }
          : { top: targetRect.bottom - rootRect.top + 10, left },
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isPhone, current.target, picks]);

  /** Same ladder as the real slip (D-009): press to back, press again to raise, one past the top clears. */
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

  const anim = (cls: string) => (reducedMotion ? "" : cls);
  const focusCls =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-chrome)] focus-visible:outline-offset-2";

  const stat = (
    ref: RefObject<HTMLDivElement | null> | undefined,
    label: string,
    value: string,
    glow?: boolean,
  ) => (
    <div ref={ref} className="flex flex-col">
      <span className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{label}</span>
      <span
        className={`nums text-sm font-semibold text-[color:var(--color-text-hi)] ${glow ? anim("gold-pulse") : ""}`}
      >
        {value}
      </span>
    </div>
  );

  const committed = [...picks.values()].reduce((sum, p) => sum + p.chips, 0);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-4">
      <div className="flex items-center justify-center gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={`h-1 w-6 chamfer ${i <= step ? "bg-[color:var(--color-gold)]" : "bg-[color:var(--color-surface-3)]"}`}
          />
        ))}
      </div>
      <p className="text-center text-xs text-[color:var(--color-text-low)]">
        {copy.stepLabel.replace("{step}", String(step + 1)).replace("{total}", String(total))}
      </p>

      {!current.target && (
        <div className="relative">
          <div
            className={`chamfer border-2 border-[color:var(--color-gold)] bg-[color:var(--color-surface-1)] px-6 py-10 text-center shadow-[0_0_32px_rgba(201,162,75,0.18)] ${anim("callout-in")}`}
          >
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide text-[color:var(--color-gold)]">
              {current.title}
            </p>
            <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-[color:var(--color-text-hi)]">
              {current.body}
            </p>
            {current.showRevealCard && (
              <div
                className={`mx-auto mt-5 max-w-sm border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-left ${anim("card-in")}`}
              >
                <p className="mb-2 text-[12px] uppercase tracking-widest text-[color:var(--color-text-low)]">
                  {MOCK_GAMES[0].away} at {MOCK_GAMES[0].home}
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-[color:var(--color-text-hi)]">
                    {MOCK_GAMES[0].away}
                  </span>
                  <span className="nums text-sm text-[color:var(--color-text-mid)]">
                    2 players · pays{" "}
                    <span className="font-semibold text-[color:var(--color-chrome)]">2.5x</span>
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-[color:var(--color-text-hi)]">
                    {MOCK_GAMES[0].home}
                  </span>
                  <span className="nums text-sm text-[color:var(--color-text-mid)]">
                    6 players · pays{" "}
                    <span className="font-semibold text-[color:var(--color-chrome)]">0.33x</span>
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
            <PokerChip tone="gold" size={38} value={step + 1} />
          </div>
        </div>
      )}

      <section aria-label={copy.betTitle} className="panel">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 panel-head px-4 py-3">
          <span className="font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
            Wk 1
          </span>
          {stat(undefined, copy.anteLabel, String(MOCK_ANTE))}
          {stat(undefined, copy.limitLabel, `${committed} / ${MOCK_LIMIT}`)}
          {stat(potRef, copy.potLabel, String(MOCK_POT), current.id === "pot")}
        </div>

        <ul>
          {MOCK_GAMES.map((g, i) => {
            const pick = picks.get(g.id);
            const rung = pick ? RUNGS.findIndex((r) => r >= pick.chips) + 1 : 0;
            const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);
            const spreadFor = (side: Side) => {
              if (g.spread === 0) return "PK";
              const fav: Side = g.spread > 0 ? "home" : "away";
              const mag = Math.abs(g.spread);
              return side === fav ? `−${mag}` : `+${mag}`;
            };

            const sideBtn = (side: Side, team: string) => {
              const active = pick?.side === side;
              return (
                <button
                  type="button"
                  onClick={() => pressSide(g.id, side)}
                  aria-pressed={active}
                  className={`chamfer flex flex-col items-center justify-center gap-2 px-3 py-3 text-center font-[family-name:var(--font-display)] text-sm font-semibold transition ${focusCls} ${
                    active
                      ? "chrome-face border border-[color:var(--color-chrome)]"
                      : "border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-[color:var(--color-text-hi)] hover:border-[color:var(--color-chrome-dim)] hover:bg-[color:var(--color-surface-3)]"
                  }`}
                >
                  <span className="leading-tight">{team}</span>
                  <span
                    className={`nums flex items-center gap-1.5 text-[12px] font-normal ${
                      active ? "text-[color:var(--color-canvas)]/55" : "text-[color:var(--color-text-low)]"
                    }`}
                  >
                    <span>{spreadFor(side)}</span>
                    <span aria-hidden>·</span>
                    <span>{signed(side === "away" ? g.awayMl : g.homeMl)}</span>
                  </span>
                  {active && (
                    <>
                      <ChipStack
                        tone="purple"
                        total={pick!.chips}
                        count={rung}
                        size={40}
                        animated={!reducedMotion && chipBump === g.id}
                      />
                      <span className="flex gap-1" aria-hidden>
                        {RUNGS.map((_, r) => (
                          <span
                            key={r}
                            className={`h-1 w-3 ${r < rung ? "bg-[color:var(--color-canvas)]" : "bg-[color:var(--color-canvas)]/25"}`}
                          />
                        ))}
                      </span>
                    </>
                  )}
                </button>
              );
            };

            return (
              <li
                key={g.id}
                className="border-b border-[color:var(--color-border)] px-4 py-3 last:border-b-0"
              >
                <div
                  ref={i === 0 ? pickRef : undefined}
                  className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4"
                >
                  {sideBtn("away", g.away)}
                  <div className="flex flex-col items-center justify-center gap-0.5 px-1 text-center">
                    <span className="nums text-[12px] text-[color:var(--color-text-low)]">{g.kickoff}</span>
                    <span className="text-[12px] uppercase tracking-[0.2em] text-[color:var(--color-text-low)]">
                      {copy.atLabel}
                    </span>
                  </div>
                  {sideBtn("home", g.home)}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {current.target && spotlightRect && (
        <div
          className="pointer-events-none absolute z-[15] chamfer"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            boxShadow:
              "0 0 0 2000px rgba(4,4,6,0.74), 0 0 0 2px var(--color-gold), 0 0 18px 2px var(--color-gold)",
          }}
        />
      )}

      {!isPhone && current.target && calloutStyle && (
        <div
          className="absolute z-20"
          style={{ top: calloutStyle.top, bottom: calloutStyle.bottom, left: calloutStyle.left }}
        >
          <Callout title={current.title} body={current.body} animated={!reducedMotion} stepNum={step + 1} />
        </div>
      )}
      {isPhone && current.target && (
        <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6">
          <Callout title={current.title} body={current.body} animated={!reducedMotion} stepNum={step + 1} />
        </div>
      )}

      {isLast && (
        <div
          className={`chamfer border border-[color:var(--color-gold-dim)] bg-[color:var(--color-surface-2)] px-6 py-6 text-center ${anim("callout-in")}`}
        >
          <p className="font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-gold)]">
            {copy.readyTitle}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[color:var(--color-text-hi)]">{copy.readyBody}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={isFirst}
          className={`px-4 py-2 text-sm text-[color:var(--color-text-mid)] disabled:opacity-30 ${focusCls}`}
        >
          {copy.backCta}
        </button>
        {!isLast && (
          <button
            type="button"
            onClick={() => setStep(total - 1)}
            className={`px-4 py-2 text-xs uppercase tracking-wide text-[color:var(--color-text-low)] ${focusCls}`}
          >
            {copy.skipCta}
          </button>
        )}
        {isLast ? (
          <form action={acceptAction}>
            <button
              type="submit"
              className={`chamfer chrome-face px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide ${focusCls}`}
            >
              {copy.acceptCta}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => canAdvance && setStep((s) => Math.min(s + 1, total - 1))}
            disabled={!canAdvance}
            className={`chamfer chrome-face px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide ${focusCls}`}
          >
            {copy.nextCta}
          </button>
        )}
      </div>
    </div>
  );
}
