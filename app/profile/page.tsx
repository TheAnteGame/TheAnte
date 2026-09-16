import Link from "next/link";
import { Logo } from "@/components/Logo";
import { redirect } from "next/navigation";
import { createAnonServerClient, createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState } from "@/lib/player";
import { ProfileForm } from "@/components/ProfileForm";

// Edit own profile (ANTE-PLAYER §3.2). Phone changes go through Clerk's own flow,
// never an admin write. Name changes post nothing publicly.

export const dynamic = "force-dynamic";

export default async function Profile({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const state = await getPlayerState();
  if (!state || !state.player) redirect("/");
  if (!state.player.profileComplete) redirect("/onboarding");

  const db = createUserClient();
  const { data: me } = await db
    .from("players")
    .select("first_name, last_name, email, favorite_team, theme_preference, chat_position")
    .eq("id", state.player.id)
    .maybeSingle();

  const { data: teams } = await createAnonServerClient().from("teams").select("code, city, name").order("city");

  const [
    heading,
    firstNameLabel,
    lastNameLabel,
    emailLabel,
    favoriteTeamLabel,
    themeLabel,
    themeAutoLabel,
    themeLightLabel,
    themeDarkLabel,
    themeHelp,
    chatLabel,
    chatHelp,
    chatCornerLabel,
    chatBarLabel,
    chatSideLabel,
    submitLabel,
    errorGeneric,
    logoAlt,
  ] = await Promise.all([
    getContent("profile.heading"),
    getContent("profile.first_name_label"),
    getContent("profile.last_name_label"),
    getContent("profile.email_label"),
    getContent("profile.favorite_team_label"),
    getContent("profile.theme_label"),
    getContent("profile.theme_auto"),
    getContent("profile.theme_light"),
    getContent("profile.theme_dark"),
    getContent("profile.theme_help"),
    getContent("profile.chat_label"),
    getContent("profile.chat_help"),
    getContent("profile.chat_corner"),
    getContent("profile.chat_bar"),
    getContent("profile.chat_side"),
    getContent("profile.submit_label"),
    getContent("profile.error_generic"),
    getContent("home.logo_alt"),
  ]);

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <Link href="/dashboard">
        <Logo alt={logoAlt} width={166} height={106} priority />
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide text-[color:var(--color-heading)]">
        {heading}
      </h1>
      <ProfileForm
        teams={teams ?? []}
        copy={{
          firstNameLabel,
          lastNameLabel,
          emailLabel,
          favoriteTeamLabel,
          themeLabel,
          themeAutoLabel,
          themeLightLabel,
          themeDarkLabel,
          themeHelp,
          chatLabel,
          chatHelp,
          chatCornerLabel,
          chatBarLabel,
          chatSideLabel,
          submitLabel,
          errorGeneric,
        }}
        prefill={{
          firstName: me?.first_name,
          lastName: me?.last_name,
          email: me?.email,
          favoriteTeam: me?.favorite_team,
          themePreference: me?.theme_preference as "auto" | "light" | "dark" | null | undefined,
          chatPosition: me?.chat_position as "corner" | "bar" | "side" | null | undefined,
        }}
        showError={error === "1"}
      />
    </main>
  );
}
