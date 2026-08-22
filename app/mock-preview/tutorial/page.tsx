import { notFound } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { HowToPlayTutorial, type StepCopy } from "@/components/howtoplay/HowToPlayTutorial";

// LOCAL PREVIEW HARNESS — never ships (404s in production). Renders the tutorial
// outside the Clerk gate so its eight cards can be looked at and tweaked. The accept
// action is a no-op here; the real gate wires acceptHowToPlay.

export const dynamic = "force-dynamic";

export default async function TutorialPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const steps: StepCopy[] = await Promise.all(
    Array.from({ length: 8 }, async (_, i) => ({
      title: await getContent(`howto.s${i + 1}_title`),
      sub: await getContent(`howto.s${i + 1}_sub`),
      body: await getContent(`howto.s${i + 1}_body`),
    })),
  );
  const keys = [
    "howto.step_label", "howto.next_cta", "howto.back_cta", "howto.skip_cta", "howto.accept_cta",
    "howto.viz_sample_note", "howto.ex_crowd_title", "howto.ex_crowd_line", "howto.ex_crowd_result",
    "howto.ex_dog_title", "howto.ex_dog_line", "howto.ex_dog_result", "howto.viz_pot_total",
    "howto.viz_your_stack", "howto.viz_winner", "howto.viz_champion_note", "howto.viz_felt_note",
    "howto.shove_title", "howto.shove_body", "howto.fold_title", "howto.fold_body",
    "howto.learn_more", "howto.link_rules", "howto.link_guide", "dash.wager.at_label",
  ] as const;
  const [stepLabel, nextCta, backCta, skipCta, acceptCta, sampleNote, exCrowdTitle, exCrowdLine, exCrowdResult, exDogTitle, exDogLine, exDogResult, potTotalLabel, yourStackLabel, winnerLabel, championNote, feltNote, shoveTitle, shoveBody, foldTitle, foldBody, learnMoreLabel, linkRules, linkGuide, atLabel] =
    await Promise.all(keys.map((k) => getContent(k)));

  async function noop() {
    "use server";
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <HowToPlayTutorial
        acceptAction={noop}
        copy={{ stepLabel, nextCta, backCta, skipCta, acceptCta, steps, sampleNote, exCrowdTitle, exCrowdLine, exCrowdResult, exDogTitle, exDogLine, exDogResult, potTotalLabel, yourStackLabel, winnerLabel, championNote, feltNote, shoveTitle, shoveBody, foldTitle, foldBody, learnMoreLabel, linkRules, linkGuide, atLabel }}
      />
    </main>
  );
}
