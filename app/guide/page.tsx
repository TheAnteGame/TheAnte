import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState } from "@/lib/player";

// The written how-to-play. The interactive tutorial at /how-to-play is the gate every
// player walks through once; this is the page you come back to when you just want to
// look something up. Plain language on purpose — the rulebook at /rules is the formal
// version and stays the authority where the two ever differ.

export const dynamic = "force-dynamic";

const SECTIONS = ["start", "ante", "pick", "lock", "limit", "blackout", "payout", "flow", "strategy", "pot", "shove", "felt", "win"] as const;

export default async function Guide() {
  const state = await getPlayerState();
  if (!state) redirect("/");

  const [logoAlt, heading, intro, backCta, tutorialCta, rulesCta, rulesNote, ...sectionCopy] = await Promise.all([
    getContent("home.logo_alt"),
    getContent("guide.heading"),
    getContent("guide.intro"),
    getContent("guide.back_cta"),
    getContent("guide.tutorial_cta"),
    getContent("guide.rules_cta"),
    getContent("guide.rules_note"),
    ...SECTIONS.flatMap((k) => [getContent(`guide.${k}_title`), getContent(`guide.${k}_body`)]),
  ]);

  const sections = SECTIONS.map((key, i) => ({
    key,
    title: sectionCopy[i * 2],
    body: sectionCopy[i * 2 + 1],
  }));

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6">
        <header className="rail flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/dashboard" className="shrink-0">
            <Image src="/logo.png" alt={logoAlt} width={104} height={66} className="h-auto w-[83px] sm:w-[104px]" priority />
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
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase italic tracking-tight text-[color:var(--color-chrome)] sm:text-4xl">
            {heading}
          </h1>
          <hr className="gold-rule w-40" />
          <p className="max-w-[68ch] text-lg leading-relaxed text-[color:var(--color-text-mid)]">{intro}</p>
        </div>

        <div className="flex flex-col gap-4">
          {sections.map((s) => (
            <section key={s.key} className="panel">
              <h2 className="panel-head px-5 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
                {s.title}
              </h2>
              <div className="max-w-[68ch] px-5 py-4 leading-relaxed text-[color:var(--color-text-mid)]">
                {s.body.split("\n\n").map((para, i) => (
                  <p key={i} className={i > 0 ? "mt-3" : undefined}>
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6">
          <p className="text-sm text-[color:var(--color-text-low)]">{rulesNote}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/how-to-play?replay=1"
              className="chamfer chrome-face px-5 py-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide"
            >
              {tutorialCta}
            </Link>
            <Link
              href="/rules"
              className="chamfer border border-[color:var(--color-gold-dim)] px-5 py-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[color:var(--color-gold)] hover:border-[color:var(--color-gold)] hover:bg-[color:var(--color-surface-2)]"
            >
              {rulesCta}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
