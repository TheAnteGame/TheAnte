import Link from "next/link";
import { Logo } from "@/components/Logo";
import { redirect } from "next/navigation";
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
import { PlayStyleCard } from "@/components/dash/PlayStyleCard";
import { PollRefresh } from "@/components/wager/PollRefresh";
import { HeaderMenu } from "@/components/dash/HeaderMenu";

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
    faqLabel,
    helpLabel,
    menuAria,
    commissioner,
  ] = await Promise.all([
    getContent("dash.header_rank_label"),
    getContent("dash.header_chips_label"),
    getContent("dash.logout_label"),
    getContent("home.logo_alt"),
    getContent("dash.commissioner_link_label"),
    getContent("dash.guide_link_label"),
    getContent("dash.tutorial_link_label"),
    getContent("dash.faq_link_label"),
    getContent("dash.help_label"),
    getContent("dash.menu_aria"),
    getCommissioner(),
  ]);

  return (
    <div className="min-h-screen">
      <PollRefresh intervalMs={5000} />
      {/* The masthead sits in the same column as everything else, so the rail and
          the ticker read as plates on the table rather than a browser chrome bar. */}
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        {/* No top padding (D-055): the wrapper above already supplies pt-5, so the
            header's own 12px only pushed the masthead further down the page. Bottom
            padding stays, or the logo sits on the ticker. */}
        <header className="rail flex items-start justify-between gap-4 px-6 pb-3 pt-0">
          {/* D-124: logo with the rank box under it on the left; everything else lives
              in HeaderMenu — a stack on a computer, one menu on a phone. */}
          <div className="flex flex-col items-start gap-2">
            <Link href="/dashboard" className="shrink-0">
              <Logo alt={logoAlt} width={104} height={66} priority className="h-auto w-[83px] sm:w-[104px]" />
            </Link>
            <div className="well chamfer flex items-baseline gap-2 px-3 py-1.5">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-mid)]">
                {rankLabel}
              </span>
              <span className="nums font-[family-name:var(--font-display)] text-sm font-bold text-[color:var(--color-text-hi)]">
                {standing?.rank ?? "\u2014"}
              </span>
              <span aria-hidden className="text-[color:var(--color-border)]">
                /
              </span>
              <span className="nums font-[family-name:var(--font-display)] text-sm font-bold text-[color:var(--color-stack)]">
                {standing?.stack ?? "\u2014"}
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-mid)]">
                {chipsLabel}
              </span>
            </div>
          </div>
          <HeaderMenu
            name={state.player!.firstName ?? "\u2014"}
            helpLabel={helpLabel}
            menuAria={menuAria}
            help={[
              { href: "/guide", label: guideLabel },
              { href: "/how-to-play?replay=1", label: tutorialLabel },
              { href: "/faq", label: faqLabel },
            ]}
            commissioner={commissioner ? { href: "/admin", label: commissionerLabel } : null}
            logoutLabel={logoutLabel}
          />
        </header>

        <Ticker />
      </div>

      {/* Bottom padding keeps the docked chat strip off the last panel. */}
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <StakesBand playerId={playerId} />

        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[62fr_38fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <WagerArea playerId={playerId} />
            <div className="hidden min-[900px]:block">
              <Leaderboard playerId={playerId} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {/* Table Talk is no longer in this column — it is the dock at the foot of
                the page (D-086). Mobile order: wager, leaderboard, news, promo, support. */}
            <div className="min-[900px]:hidden">
              <Leaderboard playerId={playerId} />
            </div>
            {/* Owner's order: the promo rides with the chat at the top, and simply is
                not rendered when no heading is set, so nothing collapses to a gap.
                This puts promo above news, where ANTE-PLAYER §4 had news first. */}
            {/* Your play style takes the top of the column (D-113); League Stats moves
                below the promo rather than going away. */}
            <PlayStyleCard playerId={playerId} />
            <PromoBox />
            <LeagueStats />
            <NewsBox playerId={playerId} />
            <SupportBox />
          </div>
        </div>
      </main>

      <TableTalk playerId={playerId} chatPosition={state.player!.chatPosition} />
    </div>
  );
}
