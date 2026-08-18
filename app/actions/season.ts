"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/db/supabase";
import { getPlayerState } from "@/lib/player";
import { serviceDb } from "@/lib/jobs/util";

// The Mark (§12): voted by everyone who finished on the felt. One vote each (the
// unique constraint holds it), any player nominable, seven days from season close,
// plurality takes it, a tie means co-winners, no quorum.

export interface VoteResult {
  ok: boolean;
  error?: string;
}

/** Plain-form wrapper — the ballot UI needs no error surface beyond the refresh. */
export async function voteMarkForm(fd: FormData): Promise<void> {
  await voteMark(fd);
}

export async function voteMark(fd: FormData): Promise<VoteResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in" };
  const state = await getPlayerState();
  if (!state?.player) return { ok: false, error: "No seat" };

  const nominee = String(fd.get("nominee") ?? "");
  if (!nominee) return { ok: false, error: "Pick somebody" };

  // Eligibility and window are league facts set at close — checked server-side.
  const svc = serviceDb();
  const { data: settings } = await svc.from("app_settings").select("key, value").in("key", ["mark.voters", "mark.closes_at"]);
  const map = new Map((settings ?? []).map((r) => [r.key, r.value]));
  const voters = (map.get("mark.voters") as string[] | undefined) ?? [];
  const closesAt = map.get("mark.closes_at") as string | undefined;
  if (!closesAt) return { ok: false, error: "The ballot isn't open" };
  if (new Date(closesAt) < new Date()) return { ok: false, error: "The ballot closed" };
  if (!voters.includes(state.player.id)) return { ok: false, error: "The Mark is voted only by players who finished on the felt (§12)" };

  const db = createUserClient();
  const { error } = await db.from("mark_votes").insert({ voter_player_id: state.player.id, nominee_player_id: nominee });
  if (error) {
    return { ok: false, error: error.message.includes("duplicate") ? "One vote each. Yours is cast." : "That didn't take" };
  }
  revalidatePath("/season");
  return { ok: true };
}
