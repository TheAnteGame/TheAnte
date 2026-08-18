"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient } from "@/lib/db/supabase";
import { serviceDb } from "@/lib/jobs/util";
import { revealCheck } from "@/lib/jobs/reveal";

// Submission runs as the player through the submit_ticket RPC — every slip rule is
// re-validated inside Postgres under RLS (0007). If this ticket was the last one in,
// the reveal fires HERE, in the same request: the reveal is event-driven, and the
// pg_cron poll is only the fallback (§6).

const BetSchema = z.object({
  gameId: z.string().uuid(),
  side: z.enum(["away", "home"]),
  chips: z.number().int().positive(),
});

const SubmitSchema = z.object({
  weekId: z.string().uuid(),
  isShove: z.boolean(),
  bets: z.array(BetSchema).min(1).max(20),
});

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

export async function submitWager(input: unknown): Promise<SubmitResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That slip doesn't parse. Try again." };

  const db = createUserClient();
  const { error } = await db.rpc("submit_ticket", {
    p_week_id: parsed.data.weekId,
    p_is_shove: parsed.data.isShove,
    p_bets: parsed.data.bets.map((b) => ({ game_id: b.gameId, side: b.side, chips: b.chips })),
  });

  if (error) {
    // Postgres raises carry the rulebook's own words — surface them.
    return { ok: false, error: error.message.replace(/^ANTE:\s*/, "") };
  }

  // The last ticket landing IS the reveal trigger (§6). System check, service role.
  try {
    await revealCheck(serviceDb());
  } catch {
    // The fallback poll will catch it within two minutes; submission itself succeeded.
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
