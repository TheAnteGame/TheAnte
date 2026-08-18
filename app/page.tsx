import Image from "next/image";
import { redirect } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { PhoneSignIn } from "@/components/PhoneSignIn";

// The logged-out homepage (ANTE-PLAYER §3.1) — the one surface that gets the full
// treatment (art direction §7): the invitation. Single centred column, per the
// sketch: logo, intro, phone field with inline submit, copyright.

export const dynamic = "force-dynamic";

export default async function Home() {
  const state = await getPlayerState();
  if (state) redirect(routeFor(state));

  const [heading, body, phoneLabel, phonePlaceholder, phoneCta, codePrompt, verifyCta, resendLabel, optin, errorGeneric, legal, copyright, logoAlt] =
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
      getContent("home.legal_line"),
      getContent("home.copyright"),
      getContent("home.logo_alt"),
    ]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="rise" style={{ animationDelay: "0ms" }}>
        <Image src="/logo.png" alt={logoAlt} width={333} height={213} priority />
      </div>

      <div className="rise flex flex-col gap-3" style={{ animationDelay: "120ms" }}>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide text-[color:var(--color-chrome)]">
          {heading}
        </h1>
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
          }}
        />
      </div>

      <div className="rise flex flex-col gap-6" style={{ animationDelay: "360ms" }}>
        <p className="text-sm tracking-wide text-[color:var(--color-gold)]">{legal}</p>
        <footer className="text-xs text-[color:var(--color-text-low)]">{copyright}</footer>
      </div>
    </main>
  );
}
