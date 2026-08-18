import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { WagerArea } from "@/components/wager/WagerArea";
import { Leaderboard } from "@/components/Leaderboard";
import { StakesBand } from "@/components/dash/StakesBand";
import { Ticker } from "@/components/dash/Ticker";
import { TableTalk } from "@/components/dash/TableTalk";
import { NewsBox } from "@/components/dash/NewsBox";
import { PromoBox } from "@/components/dash/PromoBox";
import { SupportBox } from "@/components/dash/SupportBox";
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

  const [rankLabel, chipsLabel, logoutLabel, logoAlt] = await Promise.all([
    getContent("dash.header_rank_label"),
    getContent("dash.header_chips_label"),
    getContent("dash.logout_label"),
    getContent("home.logo_alt"),
  ]);

  return (
    <div className="min-h-screen">
      <PollRefresh intervalMs={5000} />
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-6 py-3">
        <Link href="/dashboard">
          <Image src="/logo.png" alt={logoAlt} width={83} height={53} priority />
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/profile" className="text-sm text-[color:var(--color-text-hi)] underline-offset-4 hover:underline">
            {state.player!.firstName ?? "—"}
          </Link>
          <div className="nums text-sm text-[color:var(--color-text-mid)]">
            {rankLabel} {standing?.rank ?? "—"} · {standing?.stack ?? "—"} {chipsLabel}
          </div>
          <SignOutButton>
            <button className="text-xs text-[color:var(--color-text-low)] underline-offset-4 hover:underline">
              {logoutLabel}
            </button>
          </SignOutButton>
        </div>
      </header>

      <Ticker />

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
            <NewsBox playerId={playerId} />
            <PromoBox />
            <SupportBox />
          </div>
        </div>
      </main>
    </div>
  );
}
