import { DateTime } from "luxon";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { getTeamNames } from "@/lib/teams";
import { ET } from "@/lib/time";
import { ChatComposer } from "./ChatComposer";
import { ChatHelp } from "./ChatHelp";
import { PlayerTip } from "../ui/PlayerTip";
import { buildHandles, segmentBody } from "@/lib/chat/mentions";
import { leaderFrom } from "@/lib/ticker/leader";
import { ChatTag, type TagTone } from "./ChatTag";
import { loadProjection, withProjection } from "@/lib/stats/standings";

// Table Talk (ANTE-PLAYER §7): a real chat panel. System messages are distinct and
// carry weight — they are the only place the commissioner's authority is visible.
// Hidden messages render as tombstones, never gaps (ADMIN §4.3).

export async function TableTalk({
  playerId,
  dbOverride,
}: {
  playerId: string;
  /** LOCAL PREVIEW ONLY — dev harness injects its own client. Never set in app code. */
  dbOverride?: ReturnType<typeof createUserClient>;
}) {
  const db = dbOverride ?? createUserClient();

  const [{ data: messages }, { data: me }, { data: mine }, heading, placeholder, liveLabel, mutedNotice, tombstone, helpAria, helpTitle, helpMentions, helpEmoji, emojiAria, tagCommish, tagLeader, todayLabel, yesterdayLabel] = await Promise.all([
    // Player conversation ONLY (D-039). Nothing writes system messages any more, and
    // this filter also retires the ones already posted — the room never shows them
    // again without a migration. The rows stay in the table; they are simply not this
    // panel's business.
    db
      .from("chat_messages")
      .select("id, player_id, body, is_system, hidden_at, hidden_reason, created_at")
      .eq("is_system", false)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("players").select("is_muted, muted_until").eq("id", playerId).maybeSingle(),
    // Has this player ever said anything? One row is enough to know.
    db.from("chat_messages").select("id").eq("player_id", playerId).limit(1),
    getContent("dash.tabletalk.heading"),
    getContent("dash.tabletalk.placeholder"),
    getContent("dash.tabletalk.live_label"),
    getContent("dash.tabletalk.muted_notice"),
    getContent("dash.tabletalk.tombstone"),
    getContent("dash.tabletalk.help_aria"),
    getContent("dash.tabletalk.help_title"),
    getContent("dash.tabletalk.help_mentions"),
    getContent("dash.tabletalk.help_emoji"),
    getContent("dash.tabletalk.emoji_aria"),
    getContent("dash.tabletalk.tag_commish"),
    getContent("dash.tabletalk.tag_leader"),
    getContent("dash.tabletalk.today"),
    getContent("dash.tabletalk.yesterday"),
  ]);

  // Who wears a tag (D-066). Both reads go through the PLAYER client like everything
  // else here — the commissioner seat became readable to approved players in
  // migration 0023 rather than being fetched with the service role, which §4.3
  // forbids on a player surface.
  const [{ data: roster }, { data: seat }, { data: rawStandings }, proj] = await Promise.all([
    db.from("players").select("id, first_name, last_name").eq("status", "approved"),
    db.from("commissioner").select("player_id").maybeSingle(),
    db.from("standings").select("player_id, first_name, last_name, stack, status"),
    // Without this the green tag can land on a player who simply folded (D-073).
    loadProjection(db),
  ]);
  const standings = withProjection(rawStandings ?? [], proj);

  // Only a player CLEAR of the field gets the green tag. On a level board — which is
  // the whole of Week 1, every stack at 500 minus the ante — leaderFrom returns
  // "tied" and nobody is tagged. Tagging thirteen co-leaders would say nothing, and
  // crowning whichever row sorted first is the exact bug leaderFrom exists to stop.
  const leader = leaderFrom(standings);
  const leaderId = leader.kind === "leader" ? leader.playerId : null;

  const tagsFor = (playerId: string | null): { tone: TagTone; label: string }[] => {
    if (!playerId) return [];
    const out: { tone: TagTone; label: string }[] = [];
    if (seat?.player_id === playerId) out.push({ tone: "house", label: tagCommish });
    if (leaderId === playerId) out.push({ tone: "leader", label: tagLeader });
    return out;
  };
  const handles = buildHandles(
    (roster ?? []).map((p) => ({ id: p.id, firstName: p.first_name, lastName: p.last_name })),
  );

  const authorIds = [...new Set((messages ?? []).map((m) => m.player_id).filter(Boolean))] as string[];
  const [{ data: authors }, teamNames] = await Promise.all([
    authorIds.length
      ? db.from("players").select("id, first_name, last_name, favorite_team").in("id", authorIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; favorite_team: string | null }[] }),
    getTeamNames(),
  ]);
  const authorOf = (id: string | null) => (id ? (authors ?? []).find((x) => x.id === id) : undefined);
  const nameOf = (id: string | null) => {
    const a = authorOf(id);
    return a ? `${a.first_name ?? ""} ${(a.last_name ?? "").slice(0, 1)}.`.trim() : id ? "—" : "";
  };

  // Reading aids (D-074). The room was a wall of text: a repeated name and timestamp
  // on every line, no marker when the day changed, and announcements indistinguishable
  // from chatter.
  //
  // The list renders flex-col-reverse over a newest-first array, so index i sits
  // visually ABOVE index i-1 and BELOW index i+1. "The previous message" as a reader
  // sees it is therefore messages[i + 1] — the older one. Content inside an <li>
  // still flows normally, which is why a day divider can be placed at the top of a
  // message's own <li> and appear above it.
  const list = messages ?? [];
  const dayOf = (iso: string) => DateTime.fromISO(iso).setZone(ET).startOf("day");

  const dayLabel = (iso: string) => {
    const d = dayOf(iso);
    const today = DateTime.now().setZone(ET).startOf("day");
    const days = today.diff(d, "days").days;
    if (days === 0) return todayLabel;
    if (days === 1) return yesterdayLabel;
    return d.toFormat(days < 7 ? "cccc" : "cccc, LLL d");
  };

  /** Does list[i] continue the message before it, as a reader sees the order? */
  const groupedAt = list.map((m, i) => {
    const older = list[i + 1];
    if (!older || m.is_system || older.is_system || m.hidden_at || older.hidden_at) return false;
    if (older.player_id !== m.player_id) return false;
    if (!dayOf(m.created_at).equals(dayOf(older.created_at))) return false;
    // Fifteen minutes keeps a genuine follow-up attached and lets a reply hours later
    // stand on its own.
    return DateTime.fromISO(m.created_at).diff(DateTime.fromISO(older.created_at), "minutes").minutes <= 15;
  });

  /** An announcement is a short ALL-CAPS label and a colon, e.g. "APP UPDATE: ...".
   *  A convention anyone can type rather than a new control, and it degrades to plain
   *  text when nobody uses it. Bounded hard so ordinary shouting is not swept up. */
  const announcement = (body: string): { label: string; rest: string } | null => {
    const m = body.match(/^([A-Z][A-Z0-9 ]{2,23}):\s+([\s\S]*)$/);
    return m ? { label: m[1], rest: m[2] } : null;
  };

  const muted = !!me?.is_muted && (!me.muted_until || new Date(me.muted_until) > new Date());
  const mutedText = mutedNotice.replace(
    "{expiry}",
    me?.muted_until ? DateTime.fromISO(me.muted_until).setZone(ET).toFormat("ccc h:mma 'ET'") : "lifted",
  );

  return (
    <section aria-label={heading} className="panel flex min-h-0 flex-col">
      <div className="panel-head flex items-center justify-between px-4 py-3">
        <h2 className="font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
          {heading}
        </h2>
        <ChatHelp ariaLabel={helpAria} title={helpTitle} mentionsLine={helpMentions} emojiLine={helpEmoji} />
      </div>
      <ul className="chat-list flex max-h-[32rem] min-h-[9rem] flex-col-reverse overflow-y-auto px-4 py-2">
        {list.map((m, i) => {
          const older = list[i + 1];
          const newDay = !older || !dayOf(m.created_at).equals(dayOf(older.created_at));
          const grouped = groupedAt[i];
          // The separator is a background on the BOTTOM edge of the DOM-later item,
          // which col-reverse puts HIGHER on screen. So the rule that would sit
          // between this message and the one continuing it belongs to THIS li, and
          // must be suppressed here — not on the grouped message below it.
          const continued = i > 0 && groupedAt[i - 1];
          const ann = !m.hidden_at && !m.is_system ? announcement(m.body) : null;
          return (
          <li
            key={m.id}
            className={`text-sm ${grouped ? "pb-2 pt-0" : "py-2"} ${continued ? "chat-continued" : ""}`}
          >
            {newDay && (
              <div className="mb-2 flex items-center gap-3 pt-1 first:pt-0">
                <span className="h-px flex-1 bg-[color:var(--color-border)] opacity-40" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-low)]">
                  {dayLabel(m.created_at)}
                </span>
                <span className="h-px flex-1 bg-[color:var(--color-border)] opacity-40" />
              </div>
            )}
            {m.hidden_at ? (
              <span className="italic text-[color:var(--color-text-low)]">{tombstone}</span>
            ) : m.is_system ? (
              <span className="text-[color:var(--color-gold)]">{m.body}</span>
            ) : (
              <>
                {!grouped &&
                  (() => {
                    const a = authorOf(m.player_id);
                    const fullName = a ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "—" : nameOf(m.player_id);
                    const team = a?.favorite_team ? (teamNames.get(a.favorite_team) ?? null) : null;
                    return (
                      <PlayerTip fullName={fullName} team={team}>
                        <span className="mr-2 font-semibold text-[color:var(--color-text-hi)]">{nameOf(m.player_id)}</span>
                      </PlayerTip>
                    );
                  })()}
                {!grouped &&
                  tagsFor(m.player_id).map((t) => (
                    <ChatTag key={t.tone} tone={t.tone}>
                      {t.label}
                    </ChatTag>
                  ))}
                {/* The day is on the divider above, so the line only needs the clock.
                    A grouped message keeps its time — that is the whole point of the
                    grouping, to leave the timeline readable without the name. */}
                <span className="mr-2 text-[12px] text-[color:var(--color-text-low)]">
                  {DateTime.fromISO(m.created_at).setZone(ET).toFormat("h:mma")}
                </span>
                {ann ? (
                  // An announcement is doing a different job from chatter, so it gets
                  // its own frame: a gold rule and a quieter ground, with the label as
                  // an eyebrow rather than shouting inline mid-sentence.
                  <span className="mt-1.5 block border-l-2 border-[color:var(--color-gold-dim)] bg-[color:var(--color-surface-2)] py-1.5 pl-3 pr-2">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-gold)]">
                      {ann.label}
                    </span>
                    <span className="mt-0.5 block break-words text-[color:var(--color-text-mid)]">
                      {segmentBody(ann.rest, handles).map((seg, j) =>
                        seg.mention ? (
                          <span key={j} className="font-semibold text-[color:var(--color-gold)]">
                            {seg.text}
                          </span>
                        ) : (
                          <span key={j}>{seg.text}</span>
                        ),
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="break-words text-[color:var(--color-text-mid)]">
                    {segmentBody(m.body, handles).map((seg, j) =>
                      seg.mention ? (
                        <span key={j} className="font-semibold text-[color:var(--color-gold)]">
                          {seg.text}
                        </span>
                      ) : (
                        <span key={j}>{seg.text}</span>
                      ),
                    )}
                  </span>
                )}
              </>
            )}
          </li>
          );
        })}
      </ul>
      {muted ? (
        <p className="border-t border-[color:var(--color-border)] px-4 py-3 text-sm text-[color:var(--color-gold)]">{mutedText}</p>
      ) : (
        <ChatComposer
          placeholder={placeholder}
          liveLabel={liveLabel}
          showLive={(mine ?? []).length === 0}
          handles={handles}
          emojiAria={emojiAria}
        />
      )}
    </section>
  );
}
