import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { getCommissioner } from "@/lib/admin";
import { WagerArea } from "@/components/wager/WagerArea";
import { Leaderboard } from "@/components/Leaderboard";
import { StakesBand } from "@/components/dash/StakesBand";
import { Ticker } from "@/components/dash/Ticker";
import { TableTalk } from "@/components/dash/TableTalk";
import { NewsBox } from "@/components/dash/NewsBox";
import { PromoBox } from "@/components/dash/PromoBox";
import { SupportBox } from "@/components/dash/SupportBox";
import { LeagueStats } from "@/components/dash/LeagueStats";
import { PollRefresh } from "@/components/wager/PollRefresh";

// The dashboard (ANTE-PLAYER §4): header, ticker, stakes band, then two columns —
// wager area + leaderboard left (~62%), Table Talk / news / promo / support right.
// Below 900px: single column with the wager area promoted above chat (it is
// time-sensitive). Chat drives the 5s poll cadence (§11); the tab backs off hidden.

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const state = await getPlayerState();
  if (!state) redirect("/");
  const dest = routeFor(state);
  if (dest !== "/dashboard") redirect(dest);
  const playerId = state.player!.id;

  const db = createUserClient();
  const { data: standing } = await db
    .from("standings")
    .select("rank, stack")
    .eq("player_id", playerId)
    .maybeSingle();

  const [
    rankLabel,
    chipsLabel,
    logoutLabel,
    logoAlt,
    commissionerLabel,
    guideLabel,
    tutorialLabel,
    commissioner,
  ] = await Promise.all([
    getContent("dash.header_rank_label"),
    getContent("dash.header_chips_label"),
    getContent("dash.logout_label"),
    getContent("home.logo_alt"),
    getContent("dash.commissioner_link_label"),
    getContent("dash.guide_link_label"),
    getContent("dash.tutorial_link_label"),
    getCommissioner(),
  ]);

  return (
    <div className="min-h-screen">
      <PollRefresh intervalMs={5000} />
      {/* The masthead sits in the same column as everything else, so the rail and
          the ticker read as plates on the table rather than a browser chrome bar. */}
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <header className="rail flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/dashboard" className="shrink-0">
            <Image
              src="/logo.png"
              alt={logoAlt}
              width={104}
              height={66}
              priority
              className="h-auto w-[83px] sm:w-[104px]"
            />
          </Link>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <Link
                href="/guide"
                className="text-[color:var(--color-text-low)] hover:text-[color:var(--color-gold)]"
              >
                {guideLabel}
              </Link>
              <span aria-hidden className="text-[color:var(--color-border)]">
                ·
              </span>
              <Link
                href="/how-to-play?replay=1"
                className="text-[color:var(--color-text-low)] hover:text-[color:var(--color-gold)]"
              >
                {tutorialLabel}
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
              <Link
                href="/profile"
                className="text-sm font-medium text-[color:var(--color-text-hi)] underline-offset-4 hover:underline"
              >
                {state.player!.firstName ?? "\u2014"}
              </Link>
              <div className="well chamfer flex items-baseline gap-2 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-low)]">
                  {rankLabel}
                </span>
                <span className="nums font-[family-name:var(--font-display)] text-sm font-bold text-[color:var(--color-text-hi)]">
                  {standing?.rank ?? "\u2014"}
                </span>
                <span aria-hidden className="text-[color:var(--color-border)]">
                  /
                </span>
                <span className="nums font-[family-name:var(--font-display)] text-sm font-bold text-[color:var(--color-gold)]">
                  {standing?.stack ?? "\u2014"}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-low)]">
                  {chipsLabel}
                </span>
              </div>
              {commissioner && (
                <Link
                  href="/admin"
                  className="chamfer border border-[color:var(--color-gold-dim)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-gold)] hover:bg-[color:var(--color-surface-2)]"
                >
                  {commissionerLabel}
                </Link>
              )}
              <SignOutButton>
                <button className="text-xs text-[color:var(--color-text-low)] underline-offset-4 hover:underline hover:text-[color:var(--color-text-mid)]">
                  {logoutLabel}
                </button>
              </SignOutButton>
            </div>
          </div>
        </header>

        <Ticker />
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <StakesBand playerId={playerId} />

        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[62fr_38fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <WagerArea playerId={playerId} />
            <div className="hidden min-[900px]:block">
              <Leaderboard playerId={playerId} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <TableTalk playerId={playerId} />
            {/* Mobile order (§4): wager, table talk, leaderboard, news, promo, support. */}
            <div className="min-[900px]:hidden">
              <Leaderboard playerId={playerId} />
            </div>
            <LeagueStats />
            <NewsBox playerId={playerId} />
            <PromoBox />
            <SupportBox />
          </div>
        </div>
      </main>
    </div>
  );
}
