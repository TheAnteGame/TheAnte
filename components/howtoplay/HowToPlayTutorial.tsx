"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChipStack, PokerChip } from "@/components/chip/PokerChip";

// The how-to-play gate's interactive tutorial: a harmless mock bet slip (fake games,
// no server calls until the final accept) with a guided click-through and pointer
// callouts. This is the second confirmed "loud zone" alongside the stakes band and
// the real bet slip (D-007) — texture, glow, and micro-motion are in scope here.
// Below 640px the floating pointer becomes a sticky bottom sheet (one-handed mobile).

export interface HowToPlayCopy {
  stepLabel: string;
  nextCta: string;
  backCta: string;
  skipCta: string;
  acceptCta: string;
  introTitle: string;
  introBody: string;
  anteTitle: string;
  anteBody: string;
  pickTitle: string;
  pickBody: string;
  chipsTitle: string;
  chipsBody: string;
  limitTitle: string;
  limitBody: string;
  spreadNote: string;
  deadlineTitle: string;
  deadlineBody: string;
  blackoutTitle: string;
  blackoutBody: string;
  revealTitle: string;
  revealBody: string;
  shoveTitle: string;
  shoveBody: string;
  settlementTitle: string;
  settlementBody: string;
  readyTitle: string;
  readyBody: string;
  anteLabel: string;
  limitLabel: string;
  deadlineLabel: string;
  potLabel: string;
  shoveCta: string;
}

interface Props {
  copy: HowToPlayCopy;
  acceptAction: { (): Promise<void> };
}

type Side = "away" | "home";
type TargetKey = "ante" | "pick" | "chips" | "limit" | "deadline" | "shove" | "pot";

interface Step {
  id: string;
  title: string;
  body: string;
  target: TargetKey | null;
  requireClick?: boolean;
  showRevealCard?: boolean;
}

const MOCK_GAMES = [
  { id: "m1", away: "BUF", home: "KC", spread: 2.5, kickoff: "Sun 4:25pm" },
  { id: "m2", away: "DAL", home: "PHI", spread: -3, kickoff: "Sun 8:20pm" },
  { id: "m3", away: "SF", home: "SEA", spread: 1, kickoff: "Mon 8:15pm" },
];

const MOCK_ANTE = 20;
const MOCK_LIMIT = 120;
const MOCK_POT = 640;

function Callout({ title, body, animated, stepNum }: { title: string; body: string; animated: boolean; stepNum: number }) {
  return (
    <div
      className={`chamfer relative w-72 max-w-[calc(100vw-2rem)] border-2 border-[color:var(--color-gold)] bg-[color:var(--color-surface-2)] p-4 pt-5 shadow-[0_8px_28px_rgba(0,0,0,0.55)] ${
        animated ? "callout-in" : ""
      }`}
    >
      <div className="absolute -left-3 -top-3">
        <PokerChip tone="gold" size={30} value={stepNum} />
      </div>
      <p className="text-sm font-bold uppercase tracking-wide text-[color:var(--color-gold)]">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-text-hi)]">{body}</p>
    </div>
  );
}

export function HowToPlayTutorial({ copy, acceptAction }: Props) {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<Map<string, { side: Side; chips: number }>>(new Map());
  const [shoveMode, setShoveMode] = useState(false);
  const [chipBump, setChipBump] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [calloutStyle, setCalloutStyle] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const anteRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const limitRef = useRef<HTMLDivElement>(null);
  const deadlineRef = useRef<HTMLDivElement>(null);
  const shoveRef = useRef<HTMLButtonElement>(null);
  const potRef = useRef<HTMLDivElement>(null);

  const targets: Record<TargetKey, RefObject<HTMLElement | null>> = {
    ante: anteRef,
    pick: pickRef,
    chips: chipsRef,
    limit: limitRef,
    deadline: deadlineRef,
    shove: shoveRef,
    pot: potRef,
  };

  const STEPS: Step[] = useMemo(
    () => [
      { id: "intro", title: copy.introTitle, body: copy.introBody, target: null },
      { id: "ante", title: copy.anteTitle, body: copy.anteBody, target: "ante" },
      { id: "pick", title: copy.pickTitle, body: copy.pickBody, target: "pick", requireClick: true },
      { id: "chips", title: copy.chipsTitle, body: copy.chipsBody, target: "chips" },
      { id: "limit", title: copy.limitTitle, body: `${copy.limitBody} ${copy.spreadNote}`, target: "limit" },
      { id: "deadline", title: copy.deadlineTitle, body: copy.deadlineBody, target: "deadline" },
      { id: "blackout", title: copy.blackoutTitle, body: copy.blackoutBody, target: null },
      { id: "reveal", title: copy.revealTitle, body: copy.revealBody, target: null, showRevealCard: true },
      { id: "shove", title: copy.shoveTitle, body: copy.shoveBody, target: "shove" },
      { id: "settlement", title: copy.settlementTitle, body: copy.settlementBody, target: "pot" },
    ],
    [copy],
  );

  const total = STEPS.length;
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === total - 1;
  const hasPick = picks.has("m1");
  const canAdvance = !current.requireClick || hasPick;

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
  }, [step, isPhone, current.target]);

  const pickSide = (gameId: string, side: Side) => {
    setPicks((cur) => {
      const next = new Map(cur);
      const existing = next.get(gameId);
      if (existing?.side === side) next.delete(gameId);
      else next.set(gameId, { side, chips: 20 });
      return next;
    });
  };

  const bump = (gameId: string, delta: number) => {
    setPicks((cur) => {
      const next = new Map(cur);
      const p = next.get(gameId);
      if (!p) return cur;
      next.set(gameId, { ...p, chips: Math.max(10, Math.min(p.chips + delta * 10, MOCK_LIMIT)) });
      return next;
    });
    if (!reducedMotion) {
      setChipBump(true);
      window.setTimeout(() => setChipBump(false), 250);
    }
  };

  const anim = (cls: string) => (reducedMotion ? "" : cls);
  const focusCls =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-chrome)] focus-visible:outline-offset-2";

  const stat = (ref: RefObject<HTMLDivElement | null>, label: string, value: string, glow?: boolean) => (
    <div ref={ref} className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-low)]">{label}</span>
      <span className={`nums text-sm font-semibold text-[color:var(--color-text-hi)] ${glow ? anim("gold-pulse") : ""}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div ref={rootRef} className="relative flex flex-col gap-4">
      <div className="flex items-center justify-center gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s.id} className={`h-1 w-6 chamfer ${i <= step ? "bg-[color:var(--color-gold)]" : "bg-[color:var(--color-surface-3)]"}`} />
        ))}
      </div>
      <p className="text-center text-xs text-[color:var(--color-text-low)]">
        {copy.stepLabel.replace("{step}", String(step + 1)).replace("{total}", String(total))}
      </p>

      {!current.target && (
        <div
          className={`chamfer relative border-2 border-[color:var(--color-gold)] bg-[color:var(--color-surface-1)] px-6 py-10 text-center shadow-[0_0_32px_rgba(201,162,75,0.18)] ${anim("callout-in")}`}
        >
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <PokerChip tone="gold" size={38} value={step + 1} />
          </div>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide text-[color:var(--color-gold)]">{current.title}</p>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[color:var(--color-text-hi)]">{current.body}</p>
          {current.showRevealCard && (
            <div className={`mx-auto mt-4 max-w-sm border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-left ${anim("card-in")}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[color:var(--color-text-hi)]">{MOCK_GAMES[0].away}</span>
                <span className="nums text-sm text-[color:var(--color-text-mid)]">
                  {3} · pays <span className="font-semibold text-[color:var(--color-chrome)]">{"1.6x"}</span>
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[color:var(--color-text-hi)]">{MOCK_GAMES[0].home}</span>
                <span className="nums text-sm text-[color:var(--color-text-mid)]">
                  {5} · pays <span className="font-semibold text-[color:var(--color-chrome)]">{"1.3x"}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <section aria-label={copy.pickTitle} className="border border-[color:var(--color-border)]">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] px-4 py-3 [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_6px)]">
          <span className="font-[family-name:var(--font-display)] font-bold uppercase text-[color:var(--color-chrome)]">Wk {1}</span>
          {stat(anteRef, copy.anteLabel, String(MOCK_ANTE))}
          {stat(limitRef, copy.limitLabel, String(MOCK_LIMIT))}
          {stat(deadlineRef, copy.deadlineLabel, "Thu 12:00pm ET")}
          {stat(potRef, copy.potLabel, String(MOCK_POT), current.id === "settlement")}
          <button
            ref={shoveRef}
            type="button"
            onClick={() => setShoveMode((m) => !m)}
            aria-pressed={shoveMode}
            className={`chamfer ml-auto px-4 py-2 text-xs font-semibold uppercase tracking-wide ${focusCls} ${
              shoveMode
                ? "bg-[color:var(--color-gold)] text-[color:var(--color-canvas)]"
                : "border border-[color:var(--color-gold-dim)] text-[color:var(--color-gold)]"
            } ${current.id === "shove" ? anim("gold-pulse") : ""}`}
          >
            {copy.shoveCta}
          </button>
        </div>

        <ul>
          {MOCK_GAMES.map((g, i) => {
            const pick = picks.get(g.id);
            const sideBtn = (side: Side, team: string) => (
              <button
                type="button"
                onClick={() => pickSide(g.id, side)}
                aria-pressed={pick?.side === side}
                className={`chamfer px-3 py-2 font-[family-name:var(--font-display)] text-sm font-semibold ${focusCls} ${
                  pick?.side === side
                    ? "bg-[color:var(--color-chrome)] text-[color:var(--color-canvas)]"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-hi)] hover:bg-[color:var(--color-surface-3)]"
                }`}
              >
                {team}
              </button>
            );
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-3 border-b border-[color:var(--color-border)] px-4 py-3 last:border-b-0">
                <span className="nums w-20 shrink-0 text-xs text-[color:var(--color-text-low)]">{g.kickoff}</span>
                <div ref={i === 0 ? pickRef : undefined} className="flex items-center gap-2">
                  {sideBtn("away", g.away)}
                  <span className="text-xs text-[color:var(--color-text-low)]">@</span>
                  {sideBtn("home", g.home)}
                </div>
                <span className="nums text-xs text-[color:var(--color-text-low)]">
                  {g.spread > 0 ? `${g.home} −${g.spread}` : g.spread < 0 ? `${g.away} −${-g.spread}` : "PK"}
                </span>
                {pick && (
                  <div ref={i === 0 ? chipsRef : undefined} className="ml-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => bump(g.id, -1)}
                      aria-label="take back chips"
                      className={`relative shrink-0 opacity-70 transition hover:opacity-100 ${focusCls}`}
                    >
                      <PokerChip tone="chrome" size={30} />
                      <span className="absolute inset-0 flex items-center justify-center font-bold text-[color:var(--color-canvas)]">−</span>
                    </button>
                    <ChipStack tone="purple" total={pick.chips} size={34} animated={i === 0 && !reducedMotion && chipBump} />
                    <button
                      type="button"
                      onClick={() => bump(g.id, 1)}
                      aria-label="toss in more chips"
                      className={`relative shrink-0 transition hover:brightness-110 ${focusCls}`}
                    >
                      <PokerChip tone="purple" size={30} />
                      <span className="absolute inset-0 flex items-center justify-center font-bold text-white">+</span>
                    </button>
                  </div>
                )}
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
            boxShadow: "0 0 0 2000px rgba(4,4,6,0.74), 0 0 0 2px var(--color-gold), 0 0 18px 2px var(--color-gold)",
          }}
        />
      )}

      {!isPhone && current.target && calloutStyle && (
        <div className="absolute z-20" style={{ top: calloutStyle.top, bottom: calloutStyle.bottom, left: calloutStyle.left }}>
          <Callout title={current.title} body={current.body} animated={!reducedMotion} stepNum={step + 1} />
        </div>
      )}
      {isPhone && current.target && (
        <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6">
          <Callout title={current.title} body={current.body} animated={!reducedMotion} stepNum={step + 1} />
        </div>
      )}

      {isLast && (
        <div className={`chamfer border border-[color:var(--color-gold-dim)] bg-[color:var(--color-surface-2)] px-6 py-6 text-center ${anim("callout-in")}`}>
          <p className="font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-gold)]">{copy.readyTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-[color:var(--color-text-hi)]">{copy.readyBody}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={isFirst} className={`px-4 py-2 text-sm text-[color:var(--color-text-mid)] disabled:opacity-30 ${focusCls}`}>
          {copy.backCta}
        </button>
        {!isLast && (
          <button type="button" onClick={() => setStep(total - 1)} className={`px-4 py-2 text-xs uppercase tracking-wide text-[color:var(--color-text-low)] ${focusCls}`}>
            {copy.skipCta}
          </button>
        )}
        {isLast ? (
          <form action={acceptAction}>
            <button
              type="submit"
              className={`chamfer bg-[color:var(--color-chrome)] px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide text-[color:var(--color-canvas)] ${focusCls}`}
            >
              {copy.acceptCta}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => canAdvance && setStep((s) => Math.min(s + 1, total - 1))}
            disabled={!canAdvance}
            className={`chamfer bg-[color:var(--color-chrome)] px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide text-[color:var(--color-canvas)] disabled:opacity-40 ${focusCls}`}
          >
            {copy.nextCta}
          </button>
        )}
      </div>
    </div>
  );
}
