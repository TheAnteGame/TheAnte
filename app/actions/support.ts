"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/db/supabase";
import { serviceDb } from "@/lib/jobs/util";
import { getPlayerState } from "@/lib/player";
import { emailPlayer } from "@/lib/notify/templates";
import { getContent } from "@/lib/content/getContent";

// Support stays on the platform (D-012). The player opens a ticket as themselves —
// the insert policy is the boundary — and the commissioner is emailed that one is
// waiting. The reply goes back out by email from the console.

export interface SupportResult {
  ok: boolean;
  error?: string;
}

export async function submitSupportMessage(formData: FormData): Promise<SupportResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in" };

  const body = String(formData.get("body") ?? "").trim();
  if (body.length === 0) return { ok: false, error: "Write something first." };
  if (body.length > 4000) return { ok: false, error: "4000 characters is the cap." };

  const state = await getPlayerState();
  if (!state?.player) return { ok: false, error: "No seat" };

  const db = createUserClient();
  const { error } = await db.from("support_messages").insert({ player_id: state.player.id, body });
  if (error) return { ok: false, error: "That didn't send." };

  // Tell the commissioner a ticket is waiting. Best-effort: a failed notification
  // must never lose the player's message, which is already safely stored.
  try {
    const svc = serviceDb();
    const { data: seat } = await svc.from("commissioner").select("player_id").maybeSingle();
    if (seat?.player_id) {
      const { data: commish } = await svc.from("players").select("id, email").eq("id", seat.player_id).maybeSingle();
      if (commish?.email) {
        const subject = await getContent("notify.support_new_subject");
        await emailPlayer(
          svc,
          commish,
          "notify.support_new",
          subject,
          {
            player: `${state.player.firstName ?? ""}`.trim() || "A player",
            message: body,
          },
          undefined,
          { allowFreeText: true },
        );
      }
    }
  } catch {
    // Swallowed on purpose — the ticket is stored and visible in the console.
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/support");
  return { ok: true };
}
