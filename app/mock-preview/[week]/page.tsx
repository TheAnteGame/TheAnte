import { createHmac } from "node:crypto";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/supabase";
import { gatherLeagueStats } from "@/lib/stats/gather";
import { RevealBoard } from "@/components/wager/RevealBoard";
import { PotMath } from "@/components/wager/PotMath";
import { WagerArea } from "@/components/wager/WagerArea";
import { SettledResults } from "@/components/wager/SettledResults";

// LOCAL PREVIEW HARNESS — never ships. Renders the real reveal and settled
// components against the local torture-season data, with no Clerk session, so the
// two moments can be looked at and tweaked. 404s outside development.
//
//   /mock-preview/1            → week 1, the pot winner's seat
//   /mock-preview/1?seat=last  → the same week from the worst finisher's seat

export const dynamic = "force-dynamic";

// Read as the player, not as the service role: the standings view and every RLS
// policy gate on ante.is_approved(), which reads the JWT. A service client sees zero
// rows there, so the screens would render with an empty stack and rank. Signing the
// local stack's own JWT is what makes this preview show what a player actually sees.
function asPlayer(sub: string) {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const secret = process.env.SUPABASE_LOCAL_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", secret)
    .update(`${head}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${head}.${body}.${sig}` } },
  });
}

export default async function MockPreview({
  params,
  searchParams,
}: {
  params: Promise<{ week: string }>;
  searchParams: Promise<{ seat?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { week: weekParam } = await params;
  const { seat } = await searchParams;
  const db = createServiceClient();
  const number = Number(weekParam);

  const { data: week } = await db
    .from("weeks")
    .select("id, number, phase, pot_awarded, marker")
    .eq("number", number)
    .maybeSingle();
  if (!week) notFound();

  // Pick the seat: the pot winner by default, so the screen shows a real win.
  const { data: awards } = await db
    .from("pot_awards")
    .select("player_id, place, amount")
    .eq("week_id", week.id)
    .order("place");

  const { data: entries } = await db
    .from("ledger_entries")
    .select("player_id, amount")
    .eq("week_id", week.id)
    .not("player_id", "is", null);

  const potBy = new Map<string, number>();
  for (const a of awards ?? []) potBy.set(a.player_id, (potBy.get(a.player_id) ?? 0) + a.amount);
  const gain = new Map<string, number>();
  for (const e of entries ?? []) gain.set(e.player_id!, (gain.get(e.player_id!) ?? 0) + e.amount);
  for (const [id, p] of potBy) gain.set(id, (gain.get(id) ?? 0) - p);

  const ranked = [...gain.entries()].sort((a, b) => b[1] - a[1]);
  const playerId =
    seat === "last" ? ranked[ranked.length - 1]?.[0] : (awards?.[0]?.player_id ?? ranked[0]?.[0]);
  if (!playerId) notFound();

  const { data: me } = await db.from("players").select("clerk_user_id").eq("id", playerId).single();
  const asMe = asPlayer(me!.clerk_user_id!);

  const stats = await gatherLeagueStats(asMe);
  const season = stats.tendencies
    .filter((t) => t.decided > 0 || t.folds > 0)
    .map((t) => ({
      playerId: t.playerId,
      name: stats.nameOf(t.playerId),
      isMe: t.playerId === playerId,
      won: t.won,
      lost: t.lost,
      winPct: t.winPct,
      chalkShare: t.chalkShare,
      bigPriceWins: t.bigPriceWins,
      avgMultiplier: t.avgMultiplier,
      folds: t.folds,
      bestWeek: t.bestWeek,
      favourite: t.favourite,
    }))
    .sort((a, b) => b.won - a.won);
  const h2h = stats.h2hFor(playerId).map((r) => ({ ...r, name: stats.nameOf(r.opponentId) }));

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-low)]">
          local preview — week {week.number} · {week.phase} · seat: {stats.nameOf(playerId)}
        </p>

        <section id="board" className="flex flex-col gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
            0 — The betting board
          </h1>
          {/* Only renders as a board while a week is genuinely open — leave the DB there
              with TORTURE_STOP_AFTER_OPEN=1. Otherwise it shows that week's real state. */}
          <WagerArea playerId={playerId} dbOverride={asMe} />
        </section>

        <section id="reveal" className="flex flex-col gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
            1 — The reveal
          </h1>
          <RevealBoard
            week={{ id: week.id, number: week.number, revealed_at: null }}
            playerId={playerId}
            season={season.length > 0 ? season : undefined}
            h2h={h2h.length > 0 ? h2h : undefined}
            dbOverride={asMe}
          />
        </section>

        <section id="settled" className="flex flex-col gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
            2 — After the week, settled
          </h1>
          <SettledResults
            week={{ id: week.id, number: week.number, pot_awarded: week.pot_awarded, marker: week.marker }}
            playerId={playerId}
            dbOverride={asMe}
          />
        </section>

        <section id="potmath" className="flex flex-col gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
            3 — How the Pot was won
          </h1>
          <PotMath
            week={{ id: week.id, number: week.number, pot_awarded: week.pot_awarded }}
            playerId={playerId}
            dbOverride={asMe}
          />
        </section>
      </div>
    </div>
  );
}
