import Image from "next/image";
import { redirect } from "next/navigation";
import { createAnonServerClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { ProfileForm } from "@/components/ProfileForm";

// Profile capture (ANTE-PLAYER §3.2), per the sketch's second panel: logo, intro,
// four fields, continue. No chips move here — the 500-chip buy-in is created by
// the commissioner's approval (§3.1), not by onboarding.

export const dynamic = "force-dynamic";

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const state = await getPlayerState();
  if (!state) redirect("/");
  const dest = routeFor(state);
  if (dest !== "/onboarding") redirect(dest);

  const { data: teams } = await createAnonServerClient()
    .from("teams")
    .select("code, city, name")
    .order("city");

  const [heading, intro, firstNameLabel, lastNameLabel, emailLabel, favoriteTeamLabel, submitLabel, errorGeneric, logoAlt] =
    await Promise.all([
      getContent("profile.heading"),
      getContent("profile.intro_body"),
      getContent("profile.first_name_label"),
      getContent("profile.last_name_label"),
      getContent("profile.email_label"),
      getContent("profile.favorite_team_label"),
      getContent("profile.submit_label"),
      getContent("profile.error_generic"),
      getContent("home.logo_alt"),
    ]);

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <Image src="/logo.png" alt={logoAlt} width={222} height={142} priority />
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide text-[color:var(--color-chrome)]">
          {heading}
        </h1>
        <p className="text-[color:var(--color-text-mid)]">{intro}</p>
      </div>
      <ProfileForm
        teams={teams ?? []}
        copy={{ firstNameLabel, lastNameLabel, emailLabel, favoriteTeamLabel, submitLabel, errorGeneric }}
        showError={error === "1"}
      />
    </main>
  );
}
