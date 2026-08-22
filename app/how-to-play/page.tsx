import Image from "next/image";
import { redirect } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { acceptHowToPlay } from "@/app/actions/player";
import { HowToPlayTutorial, type StepCopy } from "@/components/howtoplay/HowToPlayTutorial";

// The how-to-play gate (inserted between profile completion and the dashboard): a
// mandatory click-through tutorial — eight cards to the owner's 2026-08-22 wireframes.
// Every string here is content-managed like the rest of the player app — see
// lib/content/defaults.ts's howto.* keys.

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

  const steps: StepCopy[] = await Promise.all(
    Array.from({ length: 8 }, async (_, i) => ({
      title: await getContent(`howto.s${i + 1}_title`),
      sub: await getContent(`howto.s${i + 1}_sub`),
      body: await getContent(`howto.s${i + 1}_body`),
    })),
  );

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
    sampleNote,
    exCrowdTitle,
    exCrowdLine,
    exCrowdResult,
    exDogTitle,
    exDogLine,
    exDogResult,
    potTotalLabel,
    yourStackLabel,
    winnerLabel,
    championNote,
    feltNote,
    shoveTitle,
    shoveBody,
    foldTitle,
    foldBody,
    learnMoreLabel,
    linkRules,
    linkGuide,
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
    getContent("howto.viz_sample_note"),
    getContent("howto.ex_crowd_title"),
    getContent("howto.ex_crowd_line"),
    getContent("howto.ex_crowd_result"),
    getContent("howto.ex_dog_title"),
    getContent("howto.ex_dog_line"),
    getContent("howto.ex_dog_result"),
    getContent("howto.viz_pot_total"),
    getContent("howto.viz_your_stack"),
    getContent("howto.viz_winner"),
    getContent("howto.viz_champion_note"),
    getContent("howto.viz_felt_note"),
    getContent("howto.shove_title"),
    getContent("howto.shove_body"),
    getContent("howto.fold_title"),
    getContent("howto.fold_body"),
    getContent("howto.learn_more"),
    getContent("howto.link_rules"),
    getContent("howto.link_guide"),
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
            steps,
            sampleNote,
            exCrowdTitle,
            exCrowdLine,
            exCrowdResult,
            exDogTitle,
            exDogLine,
            exDogResult,
            potTotalLabel,
            yourStackLabel,
            winnerLabel,
            championNote,
            feltNote,
            shoveTitle,
            shoveBody,
            foldTitle,
            foldBody,
            learnMoreLabel,
            linkRules,
            linkGuide,
            atLabel,
          }}
        />
      </main>
    </div>
  );
}
