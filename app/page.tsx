import Image from "next/image";
import { redirect } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { serviceDb } from "@/lib/jobs/util";
import { tierForWeek } from "@/lib/engine";
import { PhoneSignIn } from "@/components/PhoneSignIn";
import { Facets } from "@/components/ui/Facets";

// The logged-out homepage (ANTE-PLAYER §3.1) — the one surface that gets the full
// treatment (art direction §7): the invitation. Single centred column, per the
// sketch: logo, intro, phone field with inline submit, copyright.

export const dynamic = "force-dynamic";

export default async function Home() {
  const state = await getPlayerState();
  if (state) redirect(routeFor(state));

  // The invitation wears the season's current gem (D-038), the same clock the stakes
  // band keeps: purple through Week 4, then red, teal, gold. Preseason stays purple —
  // the tier Week 1 will open on. Week number is a public fact, not blackout data.
  const { data: season } = await serviceDb()
    .from("seasons")
    .select("current_week, status")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const tier =
    season?.status === "active" && season.current_week ? tierForWeek(season.current_week) : "purple";

  const [heading, body, phoneLabel, phonePlaceholder, phoneCta, codePrompt, verifyCta, resendLabel, optin, errorGeneric, signedInCta, legal, copyright, logoAlt] =
    await Promise.all([
      getContent("home.intro_heading"),
      getContent("home.intro_body"),
      getContent("home.phone_label"),
      getContent("home.phone_placeholder"),
      getContent("home.phone_cta"),
      getContent("home.code_prompt"),
      getContent("home.verify_cta"),
      getContent("home.resend_label"),
      getContent("sms.optin_disclosure"),
      getContent("profile.error_generic"),
      getContent("home.signed_in_cta"),
      getContent("home.legal_line"),
      getContent("home.copyright"),
      getContent("home.logo_alt"),
    ]);

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      {/* The one surface that gets the full faceted treatment (art §7): a cut
          purple plane, then a pool of dark over the middle so the invitation
          reads as a tournament poster rather than a coloured wall. */}
      <Facets
        deep={`var(--color-tier-${tier}-deep)`}
        base={`var(--color-tier-${tier})`}
        bright={`var(--color-tier-${tier}-bright)`}
        seed={23}
        cols={9}
        rows={5}
        className="absolute inset-0 -z-20 h-full w-full"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(74% 58% at 50% 44%, rgba(11,11,13,0.90) 0%, rgba(11,11,13,0.84) 46%, rgba(11,11,13,0.62) 100%)",
        }}
        aria-hidden
      />

      <div className="rise" style={{ animationDelay: "0ms" }}>
        <Image src="/logo.png" alt={logoAlt} width={333} height={213} priority />
      </div>

      <div className="rise flex max-w-xl flex-col items-center gap-4" style={{ animationDelay: "120ms" }}>
        <hr className="gold-rule w-40" />
        <h1 className="text-balance font-[family-name:var(--font-display)] text-4xl font-bold uppercase italic leading-tight tracking-tight text-[color:var(--color-chrome)] sm:text-5xl">
          {heading}
        </h1>
        <hr className="gold-rule w-40" />
        <p className="mx-auto max-w-md leading-relaxed text-[color:var(--color-text-mid)]">{body}</p>
      </div>

      <div className="rise w-full max-w-sm" style={{ animationDelay: "240ms" }}>
        <PhoneSignIn
          copy={{
            phoneLabel,
            phonePlaceholder,
            phoneCta,
            codePrompt,
            verifyCta,
            resendLabel,
            optinDisclosure: optin,
            errorGeneric,
            signedInCta,
          }}
        />
      </div>

      <div className="rise flex flex-col gap-6" style={{ animationDelay: "360ms" }}>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--color-gold)]">{legal}</p>
        <footer className="text-xs text-[color:var(--color-text-low)]">{copyright}</footer>
      </div>
    </main>
  );
}
