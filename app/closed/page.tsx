import { redirect } from "next/navigation";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { GatePage } from "@/components/GatePage";

// The closed-roster page (§1): rejected applicants and post-lock arrivals land here.

export const dynamic = "force-dynamic";

export default async function Closed() {
  const state = await getPlayerState();
  if (!state) redirect("/");
  const dest = routeFor(state);
  if (dest !== "/closed") redirect(dest);

  const [message, logoAlt, signOut] = await Promise.all([
    getContent("home.closed_message"),
    getContent("home.logo_alt"),
    getContent("dash.logout_label"),
  ]);
  return <GatePage message={message} logoAlt={logoAlt} signOutLabel={signOut} />;
}
