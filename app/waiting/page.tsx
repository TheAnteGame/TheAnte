import { redirect } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { GatePage } from "@/components/GatePage";

// Pending players see this and nothing else — no dashboard, no standings, no chat,
// no chips (ANTE-PLAYER §3.1).

export const dynamic = "force-dynamic";

export default async function Waiting() {
  const state = await getPlayerState();
  if (!state) redirect("/");
  const dest = routeFor(state);
  if (dest !== "/waiting") redirect(dest);

  const [message, logoAlt, signOut] = await Promise.all([
    getContent("home.pending_message"),
    getContent("home.logo_alt"),
    getContent("dash.logout_label"),
  ]);
  return <GatePage message={message} logoAlt={logoAlt} signOutLabel={signOut} />;
}
