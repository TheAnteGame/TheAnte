"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/db/supabase";

// The news box's source picker (D-099). Empty string means "all sources for my
// team", which is the default and what most players will leave it on. The value is
// checked against the sources this player is actually offered, so the form cannot
// pin them to a feed the console never enabled.

export async function setNewsSource(sourceId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  const db = createUserClient();

  let next: string | null = null;
  if (sourceId) {
    const { data: me } = await db.from("players").select("favorite_team").eq("clerk_user_id", userId).maybeSingle();
    const { data: ok } = await db
      .from("feed_sources")
      .select("id")
      .eq("id", sourceId)
      .eq("enabled", true)
      .or(`kind.eq.league_ticker,team_code.eq.${me?.favorite_team ?? "__none__"}`)
      .maybeSingle();
    if (!ok) return;
    next = sourceId;
  }
  await db.from("players").update({ news_source_id: next }).eq("clerk_user_id", userId);
  revalidatePath("/dashboard");
}
