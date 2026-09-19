"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { serviceDb } from "@/lib/jobs/util";
import { getPlayerState } from "@/lib/player";
import { phaseOf } from "@/lib/polls/tally";

// Voting from the card in Table Talk (D-095). One row per player per poll,
// changeable until the poll closes. The service client writes; the player's
// identity comes from the session, never the form.

export async function castVote(pollId: string, option: number): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in" };
  const state = await getPlayerState();
  if (!state?.player || state.player.status !== "approved") return { ok: false, error: "No seat" };
  const db = serviceDb();
  const { data: poll } = await db.from("polls").select("id, options, opens_at, closes_at, closed_at").eq("id", pollId).maybeSingle();
  if (!poll) return { ok: false, error: "No such poll" };
  if (!Number.isInteger(option) || option < 0 || option >= (poll.options as string[]).length) return { ok: false, error: "Bad option" };
  if (phaseOf(poll) !== "open") return { ok: false, error: "This poll is closed" };
  const { error } = await db
    .from("poll_votes")
    .upsert({ poll_id: pollId, player_id: state.player.id, option_index: option, via: "site", voted_at: new Date().toISOString() }, { onConflict: "poll_id,player_id" });
  if (error) return { ok: false, error: "That didn't take" };
  revalidatePath("/dashboard");
  return { ok: true };
}
