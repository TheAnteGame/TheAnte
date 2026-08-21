import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { gatherLeagueStats } from "@/lib/stats/gather";
import { RevealBoard } from "@/components/wager/RevealBoard";

// The results page (D-022). The reveal's table is 15 games wide and never fitted the
// dashboard's 62% column, so it lives here at full width — and the whole sequence,
// interstitial and shove beat included, plays here in one uninterrupted moment rather
// than being split across two pages.

export const dynamic = "force-dynamic";

export default async function WeekResults({ params }: { params: Promise<{ week: string }> }) {
  const state = await getPlayerState();
  if (!state?.player) redirect("/");
  if (routeFor(state) !== "/dashboard") redirect(routeFor(state));

  const { week: weekParam } = await params;
  const db = createUserClient();

  const [logoAlt, backCta, heading, emptyMsg, stats] = await Promise.all([
    getContent("home.logo_alt"),
    getContent("results.back_cta"),
    getContent("results.heading"),
    getContent("results.empty"),
    gatherLeagueStats(db),
  ]);

  const requested = Number(weekParam);
  const week = stats.weeks.find((w) => w.number === requested) ?? null;

  const chrome = (body: React.ReactNode) => (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <header className="rail flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/dashboard" className="shrink-0">
            <Image src="/logo.png" alt={logoAlt} width={104} height={66} className="h-auto w-[83px] sm:w-[104px]" priority />
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {stats.weeks
              .slice()
              .reverse()
              .map((w) => (
                <Link
                  key={w.id}
                  href={`/results/${w.number}`}
                  aria-current={w.number === requested ? "page" : undefined}
                  className={`chamfer px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                    w.number === requested
                      ? "bg-[color:var(--color-chrome)] text-[color:var(--color-canvas)]"
                      : "text-[color:var(--color-text-mid)] hover:bg-[color:var(--color-surface-2)]"
                  }`}
                >
                  Wk {w.number}
                </Link>
              ))}
            <Link
              href="/dashboard"
              className="text-sm text-[color:var(--color-text-mid)] underline-offset-4 hover:text-[color:var(--color-text-hi)] hover:underline"
            >
              {backCta}
            </Link>
          </div>
        </header>
      </div>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">{body}</main>
    </div>
  );

  if (!week) {
    return chrome(
      <section className="panel p-8 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase text-[color:var(--color-chrome)]">
          {heading}
        </h1>
        <p className="mt-3 text-[color:var(--color-text-mid)]">{emptyMsg}</p>
      </section>,
    );
  }

  const season = stats.tendencies
    .filter((t) => t.decided > 0 || t.folds > 0)
    .map((t) => ({
      playerId: t.playerId,
      name: stats.nameOf(t.playerId),
      isMe: t.playerId === state.player!.id,
      won: t.won,
      lost: t.lost,
      winPct: t.winPct,
      chalkShare: t.chalkShare,
      bigPriceWins: t.bigPriceWins,
      avgMultiplier: t.avgMultiplier,
      folds: t.folds,
      bestWeek: t.bestWeek,
      favourite: t.favourite,
    }))
    .sort((a, b) => b.won - a.won);

  return chrome(
    <RevealBoard
      week={{ id: week.id, number: week.number, revealed_at: null }}
      playerId={state.player.id}
      season={season.length > 0 ? season : undefined}
    />,
  );
}
