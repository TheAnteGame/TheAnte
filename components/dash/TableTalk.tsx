import { DateTime } from "luxon";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { ET } from "@/lib/time";
import { ChatComposer } from "./ChatComposer";
import { buildHandles, segmentBody } from "@/lib/chat/mentions";

// Table Talk (ANTE-PLAYER §7): a real chat panel. System messages are distinct and
// carry weight — they are the only place the commissioner's authority is visible.
// Hidden messages render as tombstones, never gaps (ADMIN §4.3).

export async function TableTalk({ playerId }: { playerId: string }) {
  const db = createUserClient();

  const [{ data: messages }, { data: me }, { data: mine }, heading, placeholder, liveLabel, mutedNotice, tombstone] = await Promise.all([
    db
      .from("chat_messages")
      .select("id, player_id, body, is_system, hidden_at, hidden_reason, created_at")
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
  ]);

  const { data: roster } = await db.from("players").select("id, first_name, last_name").eq("status", "approved");
  const handles = buildHandles(
    (roster ?? []).map((p) => ({ id: p.id, firstName: p.first_name, lastName: p.last_name })),
  );

  const authorIds = [...new Set((messages ?? []).map((m) => m.player_id).filter(Boolean))] as string[];
  const { data: authors } = authorIds.length
    ? await db.from("players").select("id, first_name, last_name").in("id", authorIds)
    : { data: [] };
  const nameOf = (id: string | null) => {
    if (!id) return "";
    const a = (authors ?? []).find((x) => x.id === id);
    return a ? `${a.first_name ?? ""} ${(a.last_name ?? "").slice(0, 1)}.`.trim() : "—";
  };

  const muted = !!me?.is_muted && (!me.muted_until || new Date(me.muted_until) > new Date());
  const mutedText = mutedNotice.replace(
    "{expiry}",
    me?.muted_until ? DateTime.fromISO(me.muted_until).setZone(ET).toFormat("ccc h:mma 'ET'") : "lifted",
  );

  return (
    <section aria-label={heading} className="panel flex min-h-0 flex-col">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {heading}
      </h2>
      <ul className="flex max-h-[32rem] min-h-[9rem] flex-col-reverse gap-2 overflow-y-auto px-4 py-3">
        {(messages ?? []).map((m) => (
          <li key={m.id} className="text-sm">
            {m.hidden_at ? (
              <span className="italic text-[color:var(--color-text-low)]">{tombstone}</span>
            ) : m.is_system ? (
              <span className="text-[color:var(--color-gold)]">{m.body}</span>
            ) : (
              <>
                <span className="mr-2 font-semibold text-[color:var(--color-text-hi)]">{nameOf(m.player_id)}</span>
                <span className="mr-2 text-[10px] text-[color:var(--color-text-low)]">
                  {DateTime.fromISO(m.created_at).setZone(ET).toFormat("ccc h:mma")}
                </span>
                <span className="break-words text-[color:var(--color-text-mid)]">
                  {segmentBody(m.body, handles).map((seg, i) =>
                    seg.mention ? (
                      <span key={i} className="font-semibold text-[color:var(--color-gold)]">
                        {seg.text}
                      </span>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {muted ? (
        <p className="border-t border-[color:var(--color-border)] px-4 py-3 text-sm text-[color:var(--color-gold)]">{mutedText}</p>
      ) : (
        <ChatComposer
          placeholder={placeholder}
          liveLabel={liveLabel}
          showLive={(mine ?? []).length === 0}
          handles={handles}
        />
      )}
    </section>
  );
}
