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

export default async function HowToPlay({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const state = await getPlayerState();
  if (!state) redirect("/");
  const dest = routeFor(state);
  if (dest !== "/how-to-play") redirect(dest);

  const { error } = await searchParams;

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
    introTitle,
    introBody,
    anteTitle,
    anteBody,
    pickTitle,
    pickBody,
    chipsTitle,
    chipsBody,
    limitTitle,
    limitBody,
    spreadNote,
    deadlineTitle,
    deadlineBody,
    blackoutTitle,
    blackoutBody,
    revealTitle,
    revealBody,
    shoveTitle,
    shoveBody,
    settlementTitle,
    settlementBody,
    readyTitle,
    readyBody,
    anteLabel,
    limitLabel,
    deadlineLabel,
    potLabel,
    shoveCta,
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
    getContent("howto.intro_title"),
    getContent("howto.intro_body"),
    getContent("howto.ante_title"),
    getContent("howto.ante_body"),
    getContent("howto.pick_title"),
    getContent("howto.pick_body"),
    getContent("howto.chips_title"),
    getContent("howto.chips_body"),
    getContent("howto.limit_title"),
    getContent("howto.limit_body"),
    getContent("howto.spread_note"),
    getContent("howto.deadline_title"),
    getContent("howto.deadline_body"),
    getContent("howto.blackout_title"),
    getContent("howto.blackout_body"),
    getContent("howto.reveal_title"),
    getContent("howto.reveal_body"),
    getContent("howto.shove_title"),
    getContent("howto.shove_body"),
    getContent("howto.settlement_title"),
    getContent("howto.settlement_body"),
    getContent("howto.ready_title"),
    getContent("howto.ready_body"),
    getContent("band.ante_label"),
    getContent("dash.wager.limit_label"),
    getContent("band.deadline_label"),
    getContent("band.pot_label"),
    getContent("dash.wager.shove_mode_cta"),
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
            introTitle,
            introBody,
            anteTitle,
            anteBody,
            pickTitle,
            pickBody,
            chipsTitle,
            chipsBody,
            limitTitle,
            limitBody,
            spreadNote,
            deadlineTitle,
            deadlineBody,
            blackoutTitle,
            blackoutBody,
            revealTitle,
            revealBody,
            shoveTitle,
            shoveBody,
            settlementTitle,
            settlementBody,
            readyTitle,
            readyBody,
            anteLabel,
            limitLabel,
            deadlineLabel,
            potLabel,
            shoveCta,
          }}
        />
      </main>
    </div>
  );
}
