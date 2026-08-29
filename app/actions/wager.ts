"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient } from "@/lib/db/supabase";
import { serviceDb } from "@/lib/jobs/util";
import { revealCheck } from "@/lib/jobs/reveal";
import { emailDoc } from "@/lib/notify/templates";
import { ticket as ticketEmail } from "@/lib/notify/docs";
import { DateTime } from "luxon";
import { ET } from "@/lib/time";

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

  // The receipt (D-056). Sent BEFORE the reveal check, because that call may fire the
  // reveal and this email must describe the ticket as submitted, not as revealed.
  //
  // Blackout safety: every read below is filtered to THIS player's own ticket for THIS
  // week, so the only picks that can reach the message are the ones they just typed.
  // Nothing here can see another player's slip, which is the property that matters
  // while the room is dark (ANTE-TECH §7).
  try {
    await sendTicketReceipt(userId, parsed.data.weekId);
  } catch {
    // A receipt is a courtesy. It must never turn a good submission into an error.
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

/** The player's own ticket, read back from the database and mailed to them as a
 *  receipt. Reads are scoped to one player and one week throughout — see the note at
 *  the call site. */
async function sendTicketReceipt(clerkUserId: string, weekId: string): Promise<void> {
  const svc = serviceDb();

  const { data: me } = await svc
    .from("players")
    .select("id, email, first_name")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (!me?.email) return;

  const [{ data: week }, { data: t }] = await Promise.all([
    svc.from("weeks").select("number, deadline_at").eq("id", weekId).maybeSingle(),
    svc
      .from("tickets")
      .select("id, is_shove, total_chips")
      .eq("week_id", weekId)
      .eq("player_id", me.id)
      .maybeSingle(),
  ]);
  if (!week || !t) return;

  const { data: bets } = await svc
    .from("bets")
    .select("side, chips, games(away_team, home_team)")
    .eq("ticket_id", t.id);

  type Row = { side: string; chips: number; games: { away_team: string; home_team: string } | { away_team: string; home_team: string }[] | null };
  const rows = ((bets ?? []) as Row[]).map((b) => {
    const g = Array.isArray(b.games) ? b.games[0] : b.games;
    const away = g?.away_team ?? "?";
    const home = g?.home_team ?? "?";
    return { team: b.side === "away" ? away : home, matchup: `${away} @ ${home}`, chips: b.chips };
  });
  if (rows.length === 0) return;

  await emailDoc(
    svc,
    { id: me.id, email: me.email },
    "player.ticket",
    `ANTE: your Week ${week.number} ticket`,
    ticketEmail({
      firstName: me.first_name ?? "Hello",
      week: week.number,
      folded: false,
      isShove: t.is_shove,
      bets: rows,
      total: t.total_chips ?? rows.reduce((s, r) => s + r.chips, 0),
      deadline: DateTime.fromISO(week.deadline_at).setZone(ET).toFormat("cccc h:mma 'ET'"),
    }),
    `player.ticket:w${week.number}:${me.id}`,
  );
}
