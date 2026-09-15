import Link from "next/link";
import { Logo } from "@/components/Logo";
import { redirect } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState } from "@/lib/player";
import { RuleBookQA } from "@/components/dash/RuleBookQA";

// The FAQ (D-083). The ten quick answers used to sit under the dashboard leaderboard
// (D-037); the owner moved them here to unclutter the board. Same panel, same
// content keys, its own page — third of the three links in the dashboard header
// beside How to Play and Tutorial. Signed-in only, like /guide.

export const dynamic = "force-dynamic";

export default async function Faq() {
  const state = await getPlayerState();
  if (!state) redirect("/");

  const [logoAlt, heading, intro, backCta, guideCta, tutorialCta] = await Promise.all([
    getContent("home.logo_alt"),
    getContent("faq.page_heading"),
    getContent("faq.page_intro"),
    getContent("faq.back_cta"),
    getContent("dash.guide_link_label"),
    getContent("dash.tutorial_link_label"),
  ]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6">
        <header className="rail flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/dashboard" className="shrink-0">
            <Logo alt={logoAlt} width={104} height={66} className="h-auto w-[83px] sm:w-[104px]" priority />
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-[color:var(--color-text-mid)] underline-offset-4 hover:text-[color:var(--color-text-hi)] hover:underline"
          >
            {backCta}
          </Link>
        </header>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase italic tracking-tight text-[color:var(--color-heading)] sm:text-4xl">
            {heading}
          </h1>
          <hr className="gold-rule w-40" />
          <p className="max-w-[68ch] text-lg leading-relaxed text-[color:var(--color-text-mid)]">{intro}</p>
        </div>

        <RuleBookQA />

        <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--color-border)] pt-6">
          <Link
            href="/guide"
            className="chamfer chrome-face px-5 py-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide"
          >
            {guideCta}
          </Link>
          <Link
            href="/how-to-play?replay=1"
            className="chamfer border border-[color:var(--color-gold-dim)] px-5 py-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[color:var(--color-gold)] hover:border-[color:var(--color-gold)] hover:bg-[color:var(--color-surface-2)]"
          >
            {tutorialCta}
          </Link>
        </div>
      </main>
    </div>
  );
}
