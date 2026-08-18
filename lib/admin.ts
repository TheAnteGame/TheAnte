import "server-only";
import { auth } from "@clerk/nextjs/server";
import { serviceDb } from "@/lib/jobs/util";
import type { SupabaseClient } from "@supabase/supabase-js";

// One seat (ANTE-ADMIN §2). Middleware is not authorization: every admin page and
// every mutating action calls this itself. Non-commissioners get null — pages
// render 404, never 403, to avoid advertising the route.

export interface CommissionerContext {
  playerId: string;
  db: SupabaseClient; // service role — permitted only past this check (ANTE-TECH §4.3)
}

export async function getCommissioner(): Promise<CommissionerContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = serviceDb();
  const { data: me } = await db.from("players").select("id, status").eq("clerk_user_id", userId).maybeSingle();
  if (!me || me.status !== "approved") return null;

  const { data: seat } = await db.from("commissioner").select("player_id").maybeSingle();
  if (!seat || seat.player_id !== me.id) return null;

  return { playerId: me.id, db };
}

export async function writeAudit(
  ctx: CommissionerContext,
  action: string,
  entityType: string,
  entityId: string,
  reason: string,
  opts?: { before?: unknown; after?: unknown; isPublic?: boolean; publicLine?: string },
): Promise<void> {
  await ctx.db.from("audit_log").insert({
    actor_player_id: ctx.playerId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    reason,
    before: opts?.before ?? null,
    after: opts?.after ?? null,
    public: opts?.isPublic ?? false,
  });
  // Every correction is public (§13): mirrored to Table Talk automatically.
  if (opts?.isPublic && opts.publicLine) {
    await ctx.db.from("chat_messages").insert({ player_id: null, body: opts.publicLine, is_system: true });
  }
}
