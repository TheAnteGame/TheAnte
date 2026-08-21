"use server";

import { revalidatePath } from "next/cache";
import { getCommissioner, writeAudit } from "@/lib/admin";
import { send } from "@/lib/notify";
import { revealDeadline } from "@/lib/jobs/reveal";
import { settleCurrentWeek } from "@/lib/jobs/settle";
import { serviceDb } from "@/lib/jobs/util";
import { TICKER_COLORS, clampSpeed } from "@/lib/ticker/style";
import { emailPlayer } from "@/lib/notify/templates";
import { getContent } from "@/lib/content/getContent";
import { takeSnapshot } from "@/lib/backup/snapshot";
import { houseLimit, isFelt } from "@/lib/engine";
import { fetchAllRows } from "@/lib/db/fetchAll";

// Every mutating admin action re-checks the commissioner (ANTE-ADMIN §2), writes
// audit_log, and mirrors public corrections to Table Talk (§13). The closed set of
// §13 powers, nothing else — there is deliberately no action here that touches a
// ticket or a stack directly.

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const fail = (error: string): ActionResult => ({ ok: false, error });

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

// ── Roster: admission (§13 — preseason-only, enforced at the API layer) ────────

async function admissionOpen(db: ReturnType<typeof serviceDb>): Promise<boolean> {
  const { data: season } = await db
    .from("seasons")
    .select("week1_lock_at")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !season?.week1_lock_at || new Date(season.week1_lock_at) > new Date();
}

export async function approvePlayer(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  if (!(await admissionOpen(ctx.db))) return fail("Admission is a preseason power. The roster is locked (§13).");

  const playerId = str(fd, "playerId");
  const { data: p } = await ctx.db.from("players").select("id, status, first_name, last_name, email").eq("id", playerId).maybeSingle();
  if (!p || p.status !== "pending") return fail("Not a pending applicant");

  const { error } = await ctx.db
    .from("players")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: ctx.playerId, joined_at: new Date().toISOString() })
    .eq("id", playerId);
  if (error) return fail(error.message);

  // This is the moment a player exists: the 500-chip buy-in (ANTE-ADMIN §4.3).
  const { error: buyinErr } = await ctx.db.from("ledger_entries").insert({
    player_id: playerId,
    kind: "buy_in",
    amount: 500,
    reason: "Buy-in — 2026 season",
    idempotency_key: "buy-in",
  });
  if (buyinErr && !buyinErr.message.includes("duplicate key")) return fail(buyinErr.message);

  // A player admitted after the slate opened still plays that week — the roster locks
  // at the WEEK 1 DEADLINE, not at slate open (rulebook §1). Without this they hold a
  // stack but have no week_players row, and their game board reads as closed while
  // everyone else bets (D-020).
  await admitToOpenWeek(ctx, playerId);

  await writeAudit(ctx, "player.approve", "player", playerId, "Application approved; buy-in credited", {
    isPublic: true,
    publicLine: `${p.first_name ?? "A new player"} ${(p.last_name ?? "").slice(0, 1)}. has a seat. 500 chips, dead even with everybody.`,
  });
  if (p.email) {
    await send("email", "player.approved", p.email, {
      subject: "ANTE — you're in",
      body: "The Commissioner approved your seat. 500 chips, same as everyone. The room opens at theantegame.com.",
    });
  }
  revalidatePath("/admin/players");
  return { ok: true };
}

/** Give a late-admitted player the same week snapshot and the same ante everyone else
 *  already paid. The week's median, active count and places tier stay exactly as they
 *  were snapshotted at slate open — those are fixed for the week (§7). */
async function admitToOpenWeek(ctx: NonNullable<Awaited<ReturnType<typeof getCommissioner>>>, playerId: string) {
  const { data: week } = await ctx.db
    .from("weeks")
    .select("id, number, ante, median_snapshot, deadline_at")
    .eq("phase", "open")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!week) return;
  // Past the deadline there is nothing to join: the reveal is next, and charging an
  // ante for a week they could never have bet would be taking chips for nothing.
  if (new Date(week.deadline_at) <= new Date()) return;

  const entries = await fetchAllRows<{ amount: number }>((f, t) =>
    ctx.db.from("ledger_entries").select("amount").eq("player_id", playerId).order("id").range(f, t),
  );
  const stackPreAnte = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  const ante = week.ante;
  const felt = isFelt(stackPreAnte, ante);

  if (!felt) {
    // Player side keys on open:ante so a later slate.open retry cannot ante them twice.
    // The Pot side needs its OWN key: slate.open writes one aggregated pot row per week
    // under open:ante:pot, and reusing that key here would be rejected as a duplicate —
    // charging the player while the Pot went uncredited, breaking conservation.
    const { error } = await ctx.db.from("ledger_entries").insert([
      {
        player_id: playerId,
        week_id: week.id,
        kind: "ante",
        amount: -ante,
        reason: `Week ${week.number} ante`,
        idempotency_key: "open:ante",
      },
      {
        player_id: null,
        week_id: week.id,
        kind: "ante",
        amount: ante,
        reason: `Week ${week.number} — Pot side of ante (admitted after slate open)`,
        idempotency_key: `admit:ante:pot:${playerId}`,
      },
    ]);
    if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
  }

  await ctx.db.from("week_players").upsert(
    {
      week_id: week.id,
      player_id: playerId,
      stack_pre_ante: stackPreAnte,
      felt,
      house_limit: felt ? stackPreAnte : houseLimit(stackPreAnte - ante, week.median_snapshot ?? stackPreAnte - ante),
    },
    { onConflict: "week_id,player_id" },
  );
}

export async function rejectPlayer(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  if (!(await admissionOpen(ctx.db))) return fail("Admission is a preseason power. The roster is locked (§13).");

  const playerId = str(fd, "playerId");
  const { error } = await ctx.db.from("players").update({ status: "rejected" }).eq("id", playerId).eq("status", "pending");
  if (error) return fail(error.message);
  await writeAudit(ctx, "player.reject", "player", playerId, str(fd, "reason") || "Application rejected");
  revalidatePath("/admin/players");
  return { ok: true };
}

// ── Roster: moderation (§13 — mute never touches betting) ──────────────────────

export async function mutePlayer(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const playerId = str(fd, "playerId");
  const reason = str(fd, "reason");
  if (!reason) return fail("Mute requires a reason");
  const hours = Number(str(fd, "hours") || "24");
  const until = hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null;

  const { error } = await ctx.db.from("players").update({ is_muted: true, muted_until: until }).eq("id", playerId);
  if (error) return fail(error.message);
  await ctx.db.from("moderation_actions").insert({ player_id: playerId, kind: "mute", reason, expires_at: until, created_by: ctx.playerId });

  const { data: p } = await ctx.db.from("players").select("first_name, last_name").eq("id", playerId).maybeSingle();
  await writeAudit(ctx, "player.mute", "player", playerId, reason, {
    isPublic: true,
    publicLine: `${p?.first_name ?? "A player"} ${(p?.last_name ?? "").slice(0, 1)}. is muted${until ? ` until ${new Date(until).toLocaleString("en-US", { timeZone: "America/New_York" })} ET` : ""}. They can still bet — muting never touches the game.`,
  });
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function unmutePlayer(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const playerId = str(fd, "playerId");
  const { error } = await ctx.db.from("players").update({ is_muted: false, muted_until: null }).eq("id", playerId);
  if (error) return fail(error.message);
  await ctx.db.from("moderation_actions").insert({ player_id: playerId, kind: "unmute", reason: "Mute lifted", created_by: ctx.playerId });
  await writeAudit(ctx, "player.unmute", "player", playerId, "Mute lifted", { isPublic: true, publicLine: "A mute was lifted." });
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function hideChatMessage(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const messageId = str(fd, "messageId");
  const reason = str(fd, "reason");
  if (!reason) return fail("Hiding requires a reason");
  const { error } = await ctx.db
    .from("chat_messages")
    .update({ hidden_at: new Date().toISOString(), hidden_by: ctx.playerId, hidden_reason: reason })
    .eq("id", messageId);
  if (error) return fail(error.message);
  await writeAudit(ctx, "chat.hide", "chat_message", messageId, reason);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Roster: deactivation (§13 — only for a player who has affirmatively quit) ──

export async function deactivatePlayer(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const playerId = str(fd, "playerId");
  const reason = str(fd, "reason");
  const evidence = str(fd, "evidence");
  // Acceptance test 27: rejected without non-empty evidence. Silence is never grounds.
  if (!reason || !evidence) return fail("Deactivation requires a reason AND the quotable thing the player actually said (§13).");

  const { data: p } = await ctx.db.from("players").select("first_name, last_name, status").eq("id", playerId).maybeSingle();
  if (!p || p.status !== "approved") return fail("Not an active player");

  const { error } = await ctx.db
    .from("players")
    .update({ status: "deactivated", deactivated_at: new Date().toISOString(), deactivation_reason: reason, deactivation_evidence: evidence })
    .eq("id", playerId);
  if (error) return fail(error.message);

  await writeAudit(ctx, "player.deactivate", "player", playerId, reason, {
    after: { evidence },
    isPublic: true,
    publicLine: `${p.first_name ?? "A player"} ${(p.last_name ?? "").slice(0, 1)}. has left the league: "${evidence}". Their stack and their line in the standings stay. Nobody is ever deleted.`,
  });
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function reactivatePlayer(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const playerId = str(fd, "playerId");
  const { error } = await ctx.db
    .from("players")
    .update({ status: "approved", deactivated_at: null, deactivation_reason: null, deactivation_evidence: null })
    .eq("id", playerId)
    .eq("status", "deactivated");
  if (error) return fail(error.message);

  // Same gap as a late approval: back in the league mid-week means back in THIS week,
  // or the board stays shut until the next slate opens (D-020).
  await admitToOpenWeek(ctx, playerId);

  await writeAudit(ctx, "player.reactivate", "player", playerId, "Reactivated", {
    isPublic: true,
    publicLine: "A player is back in the league.",
  });
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function savePlayerNotes(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const { error } = await ctx.db.from("players").update({ notes: str(fd, "notes") }).eq("id", str(fd, "playerId"));
  if (error) return fail(error.message);
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function nudgePlayer(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const playerId = str(fd, "playerId");
  const { data: p } = await ctx.db.from("players").select("email, first_name").eq("id", playerId).maybeSingle();
  if (!p?.email) return fail("No email on file");
  const result = await send("email", "player.nudge", p.email, {
    subject: "ANTE — the room is waiting on you",
    body: `${p.first_name ?? "Hey"} — every submitted player can see your name on the waiting list. Thursday noon is the wall. theantegame.com`,
  });
  await ctx.db.from("notification_log").insert({
    player_id: playerId,
    channel: "email",
    template_key: "player.nudge",
    status: result.status,
    provider_message_id: result.providerMessageId ?? null,
    error: result.error ?? null,
  });
  return result.status === "sent" ? { ok: true } : fail(result.error ?? "Send failed");
}

// ── Week control (§4.2 — the only game-data writes permitted) ──────────────────

export async function correctGame(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const gameId = str(fd, "gameId");
  const reason = str(fd, "reason");
  if (!reason) return fail("Every correction requires a reason (§13)");

  const op = str(fd, "op");
  const { data: before } = await ctx.db.from("games").select("*").eq("id", gameId).maybeSingle();
  if (!before) return fail("No such game");

  let update: Record<string, unknown>;
  switch (op) {
    case "score": {
      const away = Number(str(fd, "awayScore"));
      const home = Number(str(fd, "homeScore"));
      if (!Number.isInteger(away) || !Number.isInteger(home)) return fail("Scores must be integers");
      update = { away_score: away, home_score: home, status: "final" };
      break;
    }
    case "cancel":
      update = { status: "cancelled", void_reason: "cancelled" };
      break;
    case "postpone":
      update = { status: "postponed", void_reason: "postponed" };
      break;
    case "void_pre_deadline":
      update = { void_reason: "kicked_pre_deadline" };
      break;
    case "unfinal":
      update = { status: "in_progress", settled: false };
      break;
    default:
      return fail("Unknown operation");
  }

  const { error } = await ctx.db.from("games").update(update).eq("id", gameId);
  if (error) return fail(error.message);
  await writeAudit(ctx, `game.${op}`, "game", before.external_id, reason, {
    before: { status: before.status, away: before.away_score, home: before.home_score, void: before.void_reason },
    after: update,
    isPublic: true,
    publicLine: `Commissioner correction on ${before.external_id}: ${reason}`,
  });
  revalidatePath("/admin/week");
  return { ok: true };
}

/** §13: permitted as settlement-job recovery — after the deadline, never before.
 *  The phase guard is in the job itself; acceptance test 9 covers the early case. */
export async function forceReveal(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const reason = str(fd, "reason");
  if (!reason) return fail("Force reveal demands a typed reason (§4.2)");

  const { data: week } = await ctx.db
    .from("weeks")
    .select("id, number, deadline_at, phase")
    .eq("phase", "open")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!week) return fail("No open week");
  await takeSnapshot(ctx.db, `before force reveal of week ${week.number}`, ctx.playerId);
  if (new Date() < new Date(week.deadline_at)) {
    return fail("The reveal cannot fire before Thursday noon — an early reveal hands every un-submitted player the room (§4.2).");
  }

  const outcome = await revealDeadline(ctx.db);
  await writeAudit(ctx, "week.force_reveal", "week", String(week.number), reason, { after: outcome as unknown });
  revalidatePath("/admin/week");
  return outcome.status === "failed" ? fail("Reveal job failed — see job runs") : { ok: true };
}

export async function resettle(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const weekNumber = Number(str(fd, "weekNumber"));
  const reason = str(fd, "reason");
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 18) return fail("Week 1–18");
  if (!reason) return fail("Re-settlement requires a reason (§13)");

  await takeSnapshot(ctx.db, `before resettle from week ${weekNumber}`, ctx.playerId);
  const { resettleFromWeek } = await import("@/lib/jobs/resettle");
  const outcome = await resettleFromWeek(ctx.db, weekNumber, reason);
  await writeAudit(ctx, "week.resettle", "week", String(weekNumber), reason, { after: outcome as unknown });
  revalidatePath("/admin/week");
  return outcome.status === "failed" ? fail(`Cascade halted — see job detail`) : { ok: true };
}

export async function runSettlement(): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  await takeSnapshot(ctx.db, "before manual settlement", ctx.playerId);
  const outcome = await settleCurrentWeek(ctx.db);
  await writeAudit(ctx, "week.settle", "week", "current", `Manual settlement run: ${outcome.status}`);
  revalidatePath("/admin/week");
  return outcome.status === "failed" ? fail("Settlement failed or halted — see job runs") : { ok: true };
}

// ── Content (§4.4) ─────────────────────────────────────────────────────────────

export async function saveContent(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const key = str(fd, "key");
  const value = String(fd.get("value") ?? "");
  if (!key) return fail("No key");
  // Only rules.intro is editable in the rules.* namespace — the rulebook ships
  // with the code (§13, acceptance test 32).
  if (key.startsWith("rules.") && key !== "rules.intro") {
    return fail("The rulebook is not editable. Changing a rule requires a deploy (§13).");
  }

  const { error } = await ctx.db
    .from("content_blocks")
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: ctx.playerId }, { onConflict: "key" });
  if (error) return fail(error.message);
  await ctx.db.from("content_revisions").insert({ key, value, created_by: ctx.playerId });
  revalidatePath("/admin/content");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function resetContent(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const key = str(fd, "key");
  const { error } = await ctx.db.from("content_blocks").delete().eq("key", key);
  if (error) return fail(error.message);
  await ctx.db.from("content_revisions").insert({ key, value: null, created_by: ctx.playerId });
  revalidatePath("/admin/content");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Feeds & ticker (§4.5) ──────────────────────────────────────────────────────

export async function composeTickerItem(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const text = str(fd, "text");
  if (!text || text.length > 140) return fail("1–140 characters");
  const { error } = await ctx.db.from("ticker_items").insert({
    source: "manual",
    text,
    url: str(fd, "url") || null,
    pinned: fd.get("pinned") === "on",
    priority: Number(str(fd, "priority") || "0"),
    starts_at: str(fd, "startsAt") || null,
    ends_at: str(fd, "endsAt") || null,
    created_by: ctx.playerId,
  });
  if (error) return fail(error.message);
  revalidatePath("/admin/feeds");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Rail presentation and which system lines run (ADMIN §4.5). app_settings has no
 *  write policy by design — it is service-role only, past the commissioner check. */
export async function saveTickerSettings(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");

  const speed = clampSpeed(Number(str(fd, "speedSeconds")));
  const accent = str(fd, "accentColor");
  const text = str(fd, "textColor");
  const known = new Set(TICKER_COLORS.map((c) => c.value));
  if (!known.has(accent) || !known.has(text)) return fail("Unknown colour");

  const maxItems = Number(str(fd, "maxItems"));
  if (!Number.isFinite(maxItems) || maxItems < 1 || maxItems > 40) return fail("Show between 1 and 40 items");

  // Unchecked boxes are absent from FormData, so the list of system lines is the
  // authority for which keys exist and every one is written explicitly.
  const systemKeys = ["deadline", "waiting_on", "pot", "marker", "reveal", "leader"];
  const systemItems = Object.fromEntries(systemKeys.map((k) => [k, fd.get(`sys.${k}`) === "on"]));

  const rows = [
    { key: "ticker.enabled", value: fd.get("enabled") === "on" },
    { key: "ticker.speed_seconds", value: speed },
    { key: "ticker.accent_color", value: accent },
    { key: "ticker.text_color", value: text },
    { key: "ticker.max_items", value: maxItems },
    { key: "ticker.system_items", value: systemItems },
  ].map((r) => ({ ...r, updated_at: new Date().toISOString(), updated_by: ctx.playerId }));

  const { error } = await ctx.db.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) return fail(error.message);
  revalidatePath("/admin/ticker");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function hideTickerItem(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const { error } = await ctx.db.from("ticker_items").update({ hidden: true }).eq("id", str(fd, "itemId"));
  if (error) return fail(error.message);
  revalidatePath("/admin/feeds");
  revalidatePath("/admin/ticker");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Answer a support ticket (D-012). The reply leaves by email — the player was told
 *  it would — and the ticket is marked answered rather than removed (§14). */
export async function replySupportMessage(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const id = str(fd, "messageId");
  const reply = str(fd, "reply");
  if (!id) return fail("No message");
  if (!reply) return fail("Write a reply first");
  if (reply.length > 4000) return fail("4000 characters is the cap");

  const { data: msg } = await ctx.db
    .from("support_messages")
    .select("id, body, status, player_id, players(id, email)")
    .eq("id", id)
    .maybeSingle();
  if (!msg) return fail("That message is gone");

  const player = (Array.isArray(msg.players) ? msg.players[0] : msg.players) as { id: string; email: string | null } | null;
  if (!player?.email) return fail("That player has no email on file, so a reply cannot reach them.");

  const subject = await getContent("notify.support_reply_subject");
  await emailPlayer(
    ctx.db,
    player,
    "notify.support_reply",
    subject,
    { original: msg.body, reply },
    undefined,
    { allowFreeText: true },
  );

  const { error } = await ctx.db
    .from("support_messages")
    .update({ reply, status: "answered", answered_at: new Date().toISOString(), answered_by: ctx.playerId })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/support");
  return { ok: true };
}

/** Stops the daily nag until the next one is due (D-017). Confirming is the whole
 *  mechanism: the app cannot see the commissioner's disk, only their word for it. */
export async function confirmBackupDownload(): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const { error } = await ctx.db.from("app_settings").upsert(
    {
      key: "backup.last_confirmed_at",
      value: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: ctx.playerId,
    },
    { onConflict: "key" },
  );
  if (error) return fail(error.message);
  revalidatePath("/admin/backup");
  return { ok: true };
}

/** Take a snapshot on demand — before a deploy, or before anything hand-edited. */
export async function takeSnapshotNow(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const label = str(fd, "reason") || "manual snapshot";
  const { id, error } = await takeSnapshot(ctx.db, label, ctx.playerId);
  if (!id) return fail(error ?? "Snapshot failed");
  revalidatePath("/admin/backup");
  return { ok: true };
}

export async function saveFeedSource(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const url = str(fd, "url");
  const name = str(fd, "name");
  const kind = str(fd, "kind");
  if (!url || !name || !["league_ticker", "team_news"].includes(kind)) return fail("Name, URL, and kind required");
  const { error } = await ctx.db.from("feed_sources").insert({
    kind,
    name,
    url,
    team_code: str(fd, "teamCode") || null,
    priority: Number(str(fd, "priority") || "0"),
  });
  if (error) return fail(error.message);
  revalidatePath("/admin/feeds");
  return { ok: true };
}

export async function toggleFeedSource(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const { data: s } = await ctx.db.from("feed_sources").select("enabled").eq("id", str(fd, "sourceId")).maybeSingle();
  if (!s) return fail("No such source");
  const { error } = await ctx.db.from("feed_sources").update({ enabled: !s.enabled }).eq("id", str(fd, "sourceId"));
  if (error) return fail(error.message);
  revalidatePath("/admin/feeds");
  return { ok: true };
}

export async function hideFeedItem(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const { error } = await ctx.db.from("feed_items").update({ hidden: true }).eq("id", str(fd, "itemId"));
  if (error) return fail(error.message);
  revalidatePath("/admin/feeds");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Settings (§4.8) ────────────────────────────────────────────────────────────

/** The season cannot move to active below 8 approved players (§1, acceptance 15). */
export async function activateSeason(): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const { count } = await ctx.db.from("players").select("id", { count: "exact", head: true }).eq("status", "approved");
  if ((count ?? 0) < 8) {
    return fail(`The season needs 8 approved players to start — the room has ${count ?? 0} (§1). Below that, pick distributions are pure noise.`);
  }
  const { error } = await ctx.db.from("seasons").update({ status: "active" }).eq("status", "preseason");
  if (error) return fail(error.message);
  await writeAudit(ctx, "season.activate", "season", "2026", "Season moved to active", {
    isPublic: true,
    publicLine: "The 2026 season is live. The first slate opens Tuesday 6:00am ET. Good luck — most of you will need it.",
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

// ── Season close (§8.10, ADMIN §4.10) ──────────────────────────────────────────

/** High card (§8.9): commit a SHA-256 of a random seed to Table Talk, derive each
 *  tied player's card from seed+id, reveal both. One draw, ever — no re-run route
 *  exists (acceptance 21). */
export async function drawHighCard(): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");

  const { data: prior } = await ctx.db.from("audit_log").select("id").eq("action", "season.high_card").limit(1);
  if (prior && prior.length > 0) return fail("The high card has been drawn. One draw, publicly, no re-draws (§11).");

  const { gatherSeasonData } = await import("@/lib/season");
  const { championshipOrder } = await import("@/lib/engine/awards");
  const { createHash, randomUUID } = await import("node:crypto");

  const season = await gatherSeasonData(ctx.db);
  if (!season.allSettled) return fail("Week 18 has not settled");
  const order = championshipOrder(season.standings.filter((s) => s.eligible));
  const top = order[0];
  const tied = order.filter(
    (s) =>
      s.stack === top.stack &&
      s.winningBets === top.winningBets &&
      s.potsWon === top.potsWon &&
      s.weeksFolded === top.weeksFolded,
  );
  if (tied.length < 2) return fail("No tie survives the tiebreakers — no card to draw");

  const seed = randomUUID();
  const commitment = createHash("sha256").update(seed).digest("hex");
  await ctx.db.from("chat_messages").insert({
    player_id: null,
    is_system: true,
    body: `High card, committed: sha256 = ${commitment}. The seed follows with the draw — check the math yourself.`,
  });

  const cards = tied.map((s) => {
    const h = createHash("sha256").update(`${seed}:${s.playerId}`).digest();
    const rank = (h.readUInt32BE(0) % 13) + 2; // 2..14
    return { playerId: s.playerId, rank };
  });
  cards.sort((a, b) => b.rank - a.rank);
  const rankName = (r: number) => (r === 14 ? "Ace" : r === 13 ? "King" : r === 12 ? "Queen" : r === 11 ? "Jack" : String(r));
  const lines = cards.map((c) => `${season.names.get(c.playerId)}: ${rankName(c.rank)}`).join(" · ");
  await ctx.db.from("chat_messages").insert({
    player_id: null,
    is_system: true,
    body: `The draw — seed ${seed}: ${lines}. ${season.names.get(cards[0].playerId)} takes it. No re-draws.`,
  });

  await writeAudit(ctx, "season.high_card", "season", "2026", `seed=${seed} commitment=${commitment}`, {
    after: cards as unknown,
  });
  revalidatePath("/admin/season-close");
  return { ok: true };
}

export async function closeSeason(): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");

  await takeSnapshot(ctx.db, "before season close", ctx.playerId);
  const { gatherSeasonData } = await import("@/lib/season");
  const { computeAwards, championshipOrder, finishedOnFelt } = await import("@/lib/engine/awards");
  const season = await gatherSeasonData(ctx.db);
  if (!season.allSettled) return fail("Week 18 has not settled — the season closes after the last stack moves");

  // A marker outstanding at season end cannot roll — write it off against the
  // Pot's own account so conservation still closes (§8.10).
  if (season.latestMarker > 0) {
    const { error } = await ctx.db.from("ledger_entries").insert({
      player_id: null,
      kind: "season_close",
      amount: season.latestMarker,
      reason: `Season close — marker write-off of ${season.latestMarker} (§8.10)`,
      idempotency_key: "season-close-writeoff",
    });
    if (error && !error.message.includes("duplicate key")) return fail(error.message);
  }

  const awards = computeAwards(season.awardsInput);
  const order = championshipOrder(season.standings);
  const voters = season.awardsInput.players
    .filter((p) => p.status === "approved" && finishedOnFelt(p.finalStack))
    .map((p) => p.id);

  const closes = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
  const rows = [
    { key: "season.awards", value: awards as unknown },
    { key: "season.final_order", value: order.map((s) => s.playerId) as unknown },
    { key: "mark.voters", value: voters as unknown },
    { key: "mark.closes_at", value: closes as unknown },
  ];
  for (const r of rows) {
    await ctx.db.from("app_settings").upsert({ key: r.key, value: r.value, updated_by: ctx.playerId }, { onConflict: "key" });
  }

  const { error } = await ctx.db.from("seasons").update({ status: "complete" }).eq("status", "active");
  if (error) return fail(error.message);

  const champ = order.find((s) => s.eligible);
  await writeAudit(ctx, "season.close", "season", "2026", "Season closed; awards computed; The Mark opens for 7 days", {
    isPublic: true,
    publicLine: `The 2026 season is closed. ${champ ? `${season.names.get(champ.playerId)} takes it with ${champ.stack}.` : ""} Awards are up at /season. Felt finishers: The Mark's ballot is open for seven days. Every ticket stays readable forever.`,
  });
  revalidatePath("/season");
  return { ok: true };
}

export async function handoffCommissioner(fd: FormData): Promise<ActionResult> {
  const ctx = await getCommissioner();
  if (!ctx) return fail("No seat");
  const playerId = str(fd, "playerId");
  const typedName = str(fd, "typedName");
  const { data: p } = await ctx.db.from("players").select("first_name, last_name, status").eq("id", playerId).maybeSingle();
  if (!p || p.status !== "approved") return fail("Handoff requires an active player");
  const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  if (typedName !== fullName) return fail(`Type the player's full name exactly: "${fullName}"`);

  const { error } = await ctx.db.from("commissioner").update({ player_id: playerId }).eq("id", true);
  if (error) return fail(error.message);
  await writeAudit(ctx, "commissioner.handoff", "player", playerId, `Handed off to ${fullName}`, {
    isPublic: true,
    publicLine: `${fullName} is the Commissioner now. The outgoing one is just a player again — same rules, same blackout, same odds of finishing behind their father-in-law.`,
  });
  revalidatePath("/admin");
  return { ok: true };
}
