"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/db/supabase";

// The news box's source picker (D-099). Empty string means "every source that
// covers my team", the default. The value is re-checked here against the same set
// the box offers — enabled, and carrying THIS player's team — so a hand-made request
// cannot pin somebody to a disabled feed or to a league-wide desk, which would quietly
// change the box's subject from their team to the league.

export async function setNewsSource(sourceId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  const db = createUserClient();

  let next: string | null = null;
  if (sourceId) {
    const { data: me } = await db.from("players").select("favorite_team").eq("clerk_user_id", userId).maybeSingle();
    if (!me?.favorite_team) return;
    const { data: ok } = await db
      .from("feed_sources")
      .select("id")
      .eq("id", sourceId)
      .eq("enabled", true)
      .eq("team_code", me.favorite_team)
      .maybeSingle();
    if (!ok) return;
    next = sourceId;
  }
  await db.from("players").update({ news_source_id: next }).eq("clerk_user_id", userId);
  revalidatePath("/dashboard");
}
