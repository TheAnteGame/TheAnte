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
import { DashBar } from "@/components/dash/DashBar";

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
    profileLabel,
    accountAria,
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
    getContent("dash.profile_label"),
    getContent("dash.account_aria"),
    getCommissioner(),
  ]);

  return (
    <div className="min-h-screen">
      <PollRefresh intervalMs={5000} />
      {/* The bar (D-125): one row, sticky, in the same column as everything else so
          it still reads as part of the table rather than browser chrome. It only
          frosts once the page scrolls under it (DashBar). */}
      <DashBar>
        <div className="dash-row rail mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-gold)]"
          >
            <Logo alt={logoAlt} width={156} height={99} priority className="dash-logo h-10 w-auto" />
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {/* The player's standing — the one figure they always want — as the milled
                plate it has always been, just smaller and in line. */}
            <div className="well chamfer flex shrink-0 items-baseline gap-1.5 px-2.5 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-mid)] sm:text-[12px] sm:tracking-[0.18em]">
                {rankLabel}
              </span>
              <span className="nums font-[family-name:var(--font-display)] text-[13px] font-bold text-[color:var(--color-text-hi)] sm:text-sm">
                {standing?.rank ?? "\u2014"}
              </span>
              <span aria-hidden className="text-[color:var(--color-border)]">
                /
              </span>
              <span className="nums font-[family-name:var(--font-display)] text-[13px] font-bold text-[color:var(--color-stack)] sm:text-sm">
                {standing?.stack ?? "\u2014"}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-mid)] sm:text-[12px] sm:tracking-[0.18em]">
                {chipsLabel}
              </span>
            </div>
            <HeaderMenu
              name={state.player!.firstName ?? "\u2014"}
              standing={`${rankLabel} ${standing?.rank ?? "\u2014"} \u00b7 ${standing?.stack ?? "\u2014"} ${chipsLabel}`}
              helpLabel={helpLabel}
              profileLabel={profileLabel}
              menuAria={menuAria}
              accountAria={accountAria}
              help={[
                { href: "/guide", label: guideLabel },
                { href: "/how-to-play?replay=1", label: tutorialLabel },
                { href: "/faq", label: faqLabel },
              ]}
              commissioner={commissioner ? { href: "/admin", label: commissionerLabel } : null}
              logoutLabel={logoutLabel}
            />
          </div>
        </div>
      </DashBar>
      <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
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
