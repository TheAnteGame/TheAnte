import { DateTime } from "luxon";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { ET } from "@/lib/time";
import { BetSlip, type SlipCopy } from "./BetSlip";
import { PollRefresh } from "./PollRefresh";
import { PotMath } from "./PotMath";
import { SettledResults } from "./SettledResults";
import Link from "next/link";

// The wager area: one slot, five states (ANTE-PLAYER §5.1). This phase renders
// Closed / Open / Submitted; Revealed and Settled get their real treatments in
// Phases 7–8. All reads run as the user — the blackout RLS is the data boundary.

/** Every state of this slot wears the same section title, so the game board reads
 *  as a named surface like Table Talk rather than an unlabelled slab. */
function Titled({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {heading}
      </h2>
      <div className="p-6">{children}</div>
    </section>
  );
}

export async function WagerArea({
  playerId,
  dbOverride,
}: {
  playerId: string;
  /** LOCAL PREVIEW ONLY — dev harness injects its own client. Never set in app code. */
  dbOverride?: ReturnType<typeof createUserClient>;
}) {
  const db = dbOverride ?? createUserClient();

  const { data: week } = await db
    .from("weeks")
    .select("id, number, ante, phase, opens_at, deadline_at, revealed_at, median_snapshot, pot_awarded, marker")
    .in("phase", ["open", "revealed", "settled"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const heading = await getContent("dash.wager.heading");

  if (!week) {
    const closed = await getContent("dash.wager.closed_message");
    return (
      <Titled heading={heading}>
        <p className="text-[color:var(--color-text-mid)]">{closed}</p>
      </Titled>
    );
  }

  if (week.phase === "revealed") {
    // The board is 15 games wide and never fitted this 62% column. The card is the
    // moment; the sequence and the table play full-width on /results (D-022).
    const [title, body, cta] = await Promise.all([
      getContent("dash.wager.revealed_title"),
      getContent("dash.wager.revealed_body"),
      getContent("dash.wager.revealed_cta"),
    ]);
    return (
      <Titled heading={heading}>
        <div className="flex flex-col items-start gap-3">
          <h3 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase italic leading-none tracking-tight text-[color:var(--color-gold)] sm:text-4xl">
            {title}
          </h3>
          <p className="max-w-md leading-relaxed text-[color:var(--color-text-mid)]">{body}</p>
          <Link
            href={`/results/${week.number}`}
            className="chamfer chrome-face mt-1 px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide"
          >
            {cta}
          </Link>
        </div>
      </Titled>
    );
  }

  if (week.phase === "settled") {
    // Your result first, then how the Pot was decided — the second answers the question
    // the first always provokes ("how did they win it?").
    return (
      <div className="flex flex-col gap-4">
        <SettledResults week={week} playerId={playerId} dbOverride={dbOverride} />
        <PotMath week={week} playerId={playerId} dbOverride={dbOverride} />
      </div>
    );
  }

  // Open week: has this player already submitted?
  const { data: myTicket } = await db
    .from("tickets")
    .select("id, is_shove, total_chips, committed_stake")
    .eq("week_id", week.id)
    .eq("player_id", playerId)
    .maybeSingle();

  if (myTicket) {
    const [submittedMessage, waitingLabel] = await Promise.all([
      getContent("dash.wager.submitted_message"),
      getContent("dash.wager.waiting_on_label"),
    ]);
    const { data: waiting } = await db.from("waiting_on").select("first_name, last_name, submitted");
    const out = (waiting ?? []).filter((w) => !w.submitted);
    const inCount = (waiting ?? []).length - out.length;
    return (
      <Titled heading={heading}>
        {/* The waiting-on list is the ONE thing allowed to move during the blackout (§6). */}
        <PollRefresh intervalMs={15000} />
        <p className="text-[color:var(--color-text-hi)]">{submittedMessage}</p>
        <p className="mt-4 text-sm text-[color:var(--color-text-mid)]">
          {inCount} of {(waiting ?? []).length} in — {waitingLabel}{" "}
          <span className="text-[color:var(--color-gold)]">
            {out.map((w) => `${w.first_name ?? ""} ${(w.last_name ?? "").slice(0, 1)}.`.trim()).join(", ") || "—"}
          </span>
        </p>
      </Titled>
    );
  }

  // The slip. Snapshot + slate, all as the user.
  const [{ data: snap }, { data: games }, { data: me }] = await Promise.all([
    db.from("week_players").select("stack_pre_ante, felt, house_limit").eq("week_id", week.id).eq("player_id", playerId).maybeSingle(),
    db
      .from("games")
      .select("id, away_team, home_team, spread_frozen, away_moneyline, home_moneyline, kickoff_at, on_slate")
      .eq("week_id", week.id)
      .eq("on_slate", true)
      .order("kickoff_at"),
    db.from("players").select("shove_used_week").eq("id", playerId).maybeSingle(),
  ]);

  if (!snap || !games || games.length === 0) {
    const closed = await getContent("dash.wager.closed_message");
    return (
      <Titled heading={heading}>
        <p className="text-[color:var(--color-text-mid)]">{closed}</p>
      </Titled>
    );
  }

  const copy: SlipCopy = Object.fromEntries(
    await Promise.all(
      (
        [
          ["heading", "dash.wager.heading"],
          ["limitLabel", "dash.wager.limit_label"],
          ["committedLabel", "dash.wager.committed_label"],
          ["remainingLabel", "dash.wager.remaining_label"],
          ["gamesLabel", "dash.wager.games_label"],
          ["submitCta", "dash.wager.submit_cta"],
          ["confirmTitle", "dash.wager.confirm_title"],
          ["confirmBody", "dash.wager.confirm_body"],
          ["confirmCta", "dash.wager.confirm_cta"],
          ["cancelCta", "dash.wager.cancel_cta"],
          ["shoveModeCta", "dash.wager.shove_mode_cta"],
          ["shoveWarning", "dash.wager.shove_warning"],
          ["shoveCommitNote", "dash.wager.shove_commit_note"],
          ["shoveDarkNote", "dash.wager.shove_dark_note"],
          ["shoveSpentLabel", "dash.wager.shove_spent_label"],
          ["spreadNote", "dash.wager.spread_note"],
          ["raiseHint", "dash.wager.raise_hint"],
          ["atLabel", "dash.wager.at_label"],
          ["submitTooltip", "dash.wager.submit_tooltip"],
          ["shoveTooltip", "dash.wager.shove_tooltip"],
          ["shoveArmTitle", "dash.wager.shove_arm_title"],
          ["shoveArmBody", "dash.wager.shove_arm_body"],
          ["shoveArmNote", "dash.wager.shove_arm_note"],
          ["shoveArmCta", "dash.wager.shove_arm_cta"],
          ["feltNotice", "dash.wager.felt_notice"],
          ["cappedRoom", "dash.wager.capped_room"],
          ["cappedStack", "dash.wager.capped_stack"],
          ["minGamesNote", "dash.wager.min_games_note"],
          ["minGamesNoteOne", "dash.wager.min_games_note_one"],
          ["totalLabel", "dash.wager.total_label"],
          ["errorGeneric", "profile.error_generic"],
        ] as const
      ).map(async ([k, key]) => [k, await getContent(key)] as const),
    ),
  ) as unknown as SlipCopy;

  return (
    <BetSlip
      weekId={week.id}
      weekNumber={week.number}
      ante={week.ante}
      games={games.map((g) => ({
        id: g.id,
        away: g.away_team,
        home: g.home_team,
        spread: g.spread_frozen,
        awayMoneyline: g.away_moneyline,
        homeMoneyline: g.home_moneyline,
        kickoff: DateTime.fromISO(g.kickoff_at).setZone(ET).toFormat("ccc h:mma"),
        kickedOff: new Date(g.kickoff_at) <= new Date(),
      }))}
      snapshot={{ stackPreAnte: snap.stack_pre_ante, felt: snap.felt, houseLimit: snap.house_limit }}
      medianSnapshot={week.median_snapshot ?? 0}
      shoveUsedWeek={me?.shove_used_week ?? null}
      copy={copy}
    />
  );
}
