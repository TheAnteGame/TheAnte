import Image from "next/image";
import { redirect } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { acceptHowToPlay } from "@/app/actions/player";
import { HowToPlayTutorial } from "@/components/howtoplay/HowToPlayTutorial";

// The how-to-play gate (inserted between profile completion and the dashboard): a
// mandatory, interactive click-through tutorial. Every string here is content-managed
// like the rest of the player app — see lib/content/defaults.ts's howto.* keys.

export const dynamic = "force-dynamic";

export default async function HowToPlay({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; replay?: string }>;
}) {
  const state = await getPlayerState();
  if (!state) redirect("/");
  const { error, replay } = await searchParams;

  // ?replay=1 lets a player who is already through the gate run it again from the
  // dashboard. Only from /dashboard: everyone still mid-onboarding keeps their route.
  const dest = routeFor(state);
  const replaying = replay === "1" && dest === "/dashboard";
  if (dest !== "/how-to-play" && !replaying) redirect(dest);

  const [
    logoAlt,
    heading,
    intro,
    stepLabel,
    nextCta,
    backCta,
    skipCta,
    acceptCta,
    errorGeneric,
    tableTitle,
    tableBody,
    betTitle,
    betBody,
    edgeTitle,
    edgeBody,
    revealTitle,
    revealBody,
    potTitle,
    potBody,
    readyTitle,
    readyBody,
    anteLabel,
    limitLabel,
    potLabel,
    atLabel,
  ] = await Promise.all([
    getContent("home.logo_alt"),
    getContent("howto.heading"),
    getContent("howto.intro"),
    getContent("howto.step_label"),
    getContent("howto.next_cta"),
    getContent("howto.back_cta"),
    getContent("howto.skip_cta"),
    getContent("howto.accept_cta"),
    getContent("howto.error_generic"),
    getContent("howto.table_title"),
    getContent("howto.table_body"),
    getContent("howto.bet_title"),
    getContent("howto.bet_body"),
    getContent("howto.edge_title"),
    getContent("howto.edge_body"),
    getContent("howto.reveal_title"),
    getContent("howto.reveal_body"),
    getContent("howto.pot_title"),
    getContent("howto.pot_body"),
    getContent("howto.ready_title"),
    getContent("howto.ready_body"),
    getContent("band.ante_label"),
    getContent("dash.wager.limit_label"),
    getContent("band.pot_label"),
    getContent("dash.wager.at_label"),
  ]);

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt={logoAlt} width={140} height={90} priority />
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide text-[color:var(--color-chrome)]">
            {heading}
          </h1>
          <p className="text-[color:var(--color-text-mid)]">{intro}</p>
          {error === "1" && (
            <p role="alert" className="text-sm text-[color:var(--color-loss)]">
              {errorGeneric}
            </p>
          )}
        </div>

        <HowToPlayTutorial
          acceptAction={acceptHowToPlay}
          copy={{
            stepLabel,
            nextCta,
            backCta,
            skipCta,
            acceptCta,
            tableTitle,
            tableBody,
            betTitle,
            betBody,
            edgeTitle,
            edgeBody,
            revealTitle,
            revealBody,
            potTitle,
            potBody,
            readyTitle,
            readyBody,
            anteLabel,
            limitLabel,
            potLabel,
            atLabel,
          }}
        />
      </main>
    </div>
  );
}
