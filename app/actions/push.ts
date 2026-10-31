"use server";

import { z } from "zod";
import { getPlayerState } from "@/lib/player";
import { serviceDb } from "@/lib/jobs/util";
import { getContent } from "@/lib/content/getContent";
import { deliver, pushConfigured } from "@/lib/notify/push";

// The profile toggle's three moves (D-120). push_subscriptions has no RLS policies,
// so every write here is the service role — after re-checking who is signed in,
// because middleware is not authorization (ANTE-ADMIN §2). A player can only ever
// add, renew or remove rows under their own id.

const SubscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

async function me(): Promise<string | null> {
  const state = await getPlayerState();
  return state?.player?.id ?? null;
}

/** Turn on, or renew on app open. Upserts on the endpoint: the device is the key. */
export async function savePushSubscription(sub: unknown, userAgent: string): Promise<{ ok: boolean }> {
  const playerId = await me();
  const parsed = SubscriptionSchema.safeParse(sub);
  if (!playerId || !parsed.success) return { ok: false };

  const { error } = await serviceDb()
    .from("push_subscriptions")
    .upsert(
      {
        player_id: playerId,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: userAgent.slice(0, 300),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const playerId = await me();
  if (!playerId) return { ok: false };
  const { error } = await serviceDb()
    .from("push_subscriptions")
    .delete()
    .eq("player_id", playerId)
    .eq("endpoint", endpoint);
  return { ok: !error };
}

/** The proof it works, sent the moment it is switched on, to that device only. */
export async function sendTestPush(endpoint: string): Promise<{ ok: boolean }> {
  const playerId = await me();
  if (!playerId || !pushConfigured()) return { ok: false };
  const db = serviceDb();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("player_id", playerId)
    .eq("endpoint", endpoint);
  if (!subs || subs.length === 0) return { ok: false };

  const [title, body] = await Promise.all([getContent("profile.push_test_title"), getContent("profile.push_test_body")]);
  const result = await deliver(db, subs, { title, body, url: "/dashboard" });
  await db.from("notification_log").insert({
    player_id: playerId,
    channel: "push",
    template_key: "push.test",
    body: `${title} — ${body}`,
    status: result.sent > 0 ? "sent" : "failed",
    error: result.errors.length > 0 ? result.errors.join("; ").slice(0, 500) : null,
  });
  return { ok: result.sent > 0 };
}
