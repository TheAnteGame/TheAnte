import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { getPlayerState, routeFor } from "@/lib/player";
import { voteMarkForm } from "@/app/actions/season";

// /season (ANTE-PLAYER §2, §8.11): awards, final standings, The Mark's ballot.
// Cost nothing. Carry more weight than they should.

export const dynamic = "force-dynamic";

const AWARD_NAMES: Record<string, string> = {
  iron_stack: "The Iron Stack",
  chalk_eater: "The Chalk Eater",
  contrarian: "Contrarian of the Year",
  best_week: "Best Week",
  worst_shove: "Worst Shove",
  straus: "The Straus",
  straggler: "The Straggler",
};

export default async function Season() {
  const state = await getPlayerState();
  if (!state) redirect("/");
  if (routeFor(state) !== "/dashboard") redirect(routeFor(state));

  const db = createUserClient();
  const [{ data: settings }, { data: players }, { data: votes }, intro, logoAlt, standingsHeading, awardsHeading, unclaimed, markLabel, markOpen, notClosed, markVoteHeading, markVoteBody, castCta, outBadge] = await Promise.all([
    db.from("app_settings").select("key, value").in("key", ["season.awards", "season.final_order", "mark.voters", "mark.closes_at"]),
    db.from("players").select("id, first_name, last_name, status").in("status", ["approved", "deactivated"]),
    db.from("mark_votes").select("voter_player_id, nominee_player_id"),
    getContent("awards.intro"),
    getContent("home.logo_alt"),
    getContent("season.standings_heading"),
    getContent("season.awards_heading"),
    getContent("season.unclaimed"),
    getContent("season.mark_label"),
    getContent("season.mark_open"),
    getContent("season.not_closed"),
    getContent("season.mark_vote_heading"),
    getContent("season.mark_vote_body"),
    getContent("season.cast_cta"),
    getContent("lb.out_badge"),
  ]);

  const map = new Map((settings ?? []).map((r) => [r.key, r.value]));
  const awards = (map.get("season.awards") ?? null) as Record<string, { playerIds: string[]; detail: string }> | null;
  const finalOrder = (map.get("season.final_order") ?? []) as string[];
  const voters = (map.get("mark.voters") ?? []) as string[];
  const closesAt = map.get("mark.closes_at") as string | undefined;

  const nameOf = (id: string) => {
    const p = (players ?? []).find((x) => x.id === id);
    return p ? `${p.first_name ?? ""} ${(p.last_name ?? "").slice(0, 1)}.`.trim() : "—";
  };

  const ballotOpen = !!closesAt && new Date(closesAt) > new Date();
  const iVoted = (votes ?? []).some((v) => v.voter_player_id === state.player!.id);
  const canVote = ballotOpen && voters.includes(state.player!.id) && !iVoted;

  // Plurality, ties are co-winners (§12) — tallied live once the window closes.
  let markWinners: string[] = [];
  if (closesAt && !ballotOpen && (votes ?? []).length > 0) {
    const tally = new Map<string, number>();
    for (const v of votes ?? []) tally.set(v.nominee_player_id, (tally.get(v.nominee_player_id) ?? 0) + 1);
    const top = Math.max(...tally.values());
    markWinners = [...tally.entries()].filter(([, n]) => n === top).map(([id]) => id);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
      <Link href="/dashboard" className="self-center">
        <Image src="/logo.png" alt={logoAlt} width={166} height={106} priority />
      </Link>
      <p className="text-center text-[color:var(--color-text-mid)]">{intro}</p>

      {finalOrder.length > 0 && (
        <section className="panel p-4">
          <h2 className="mb-2 font-[family-name:var(--font-display)] font-bold uppercase text-[color:var(--color-chrome)]">{standingsHeading}</h2>
          <ol className="space-y-1 text-sm">
            {finalOrder.map((id, i) => {
              const p = (players ?? []).find((x) => x.id === id);
              const out = p?.status === "deactivated";
              return (
                <li key={id} className={out ? "opacity-40" : ""}>
                  <span className="nums mr-2 text-[color:var(--color-text-low)]">{i + 1}.</span>
                  <span className={i === 0 && !out ? "font-semibold text-[color:var(--color-gold)]" : "text-[color:var(--color-text-hi)]"}>
                    {nameOf(id)}
                  </span>
                  {out && <span className="ml-2 text-[12px] uppercase text-[color:var(--color-text-low)]">{outBadge}</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="panel p-4">
        <h2 className="mb-2 font-[family-name:var(--font-display)] font-bold uppercase text-[color:var(--color-chrome)]">{awardsHeading}</h2>
        {awards ? (
          <ul className="space-y-1 text-sm">
            {Object.entries(AWARD_NAMES).map(([key, name]) => {
              const a = awards[key];
              return (
                <li key={key}>
                  <span className="text-[color:var(--color-gold)]">{name}:</span>{" "}
                  {a ? (
                    <span className="text-[color:var(--color-text-hi)]">
                      {a.playerIds.map(nameOf).join(", ")} <span className="text-[color:var(--color-text-low)]">— {a.detail}</span>
                    </span>
                  ) : (
                    <span className="text-[color:var(--color-text-low)]">{unclaimed}</span>
                  )}
                </li>
              );
            })}
            <li>
              <span className="text-[color:var(--color-gold)]">{markLabel}:</span>{" "}
              {markWinners.length > 0 ? (
                <span className="text-[color:var(--color-text-hi)]">{markWinners.map(nameOf).join(" & ")}</span>
              ) : ballotOpen ? (
                <span className="text-[color:var(--color-text-low)]">{markOpen}</span>
              ) : (
                <span className="text-[color:var(--color-text-low)]">—</span>
              )}
            </li>
          </ul>
        ) : (
          <p className="text-sm text-[color:var(--color-text-mid)]">{notClosed}</p>
        )}
      </section>

      {canVote && (
        <section className="border border-[color:var(--color-gold-dim)] p-4">
          <h2 className="mb-2 font-[family-name:var(--font-display)] font-bold uppercase text-[color:var(--color-gold)]">{markVoteHeading}</h2>
          <p className="mb-3 text-sm text-[color:var(--color-text-mid)]">
            {markVoteBody}
          </p>
          <form action={voteMarkForm} className="flex gap-2">
            <select name="nominee" required className="bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-text-hi)]" aria-label="Nominee">
              {(players ?? [])
                .filter((p) => p.id !== state.player!.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
            </select>
            <button type="submit" className="chamfer bg-[color:var(--color-gold)] px-4 py-2 text-sm font-semibold uppercase text-[color:var(--color-canvas)]">
              {castCta}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
