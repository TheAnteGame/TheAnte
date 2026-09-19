import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/jobs/util";
import { verifyVote } from "@/lib/polls/links";
import { phaseOf } from "@/lib/polls/tally";

// A tap on a poll button in the email (D-095). Public route: the signature is the
// authorisation — it names one poll, one player and one option and nothing else.
// The poll must still be open and the player still approved. Then on to the
// dashboard, where the card shows the tally.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const pollId = q.get("p") ?? "";
  const playerId = q.get("u") ?? "";
  const option = Number(q.get("o"));
  const sig = q.get("s") ?? "";
  const home = new URL("/dashboard", req.url);

  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(pollId) || !uuid.test(playerId) || !Number.isInteger(option) || option < 0 || !verifyVote(pollId, playerId, option, sig)) {
    home.searchParams.set("poll", "bad-link");
    return NextResponse.redirect(home);
  }

  const db = serviceDb();
  const [{ data: poll }, { data: player }] = await Promise.all([
    db.from("polls").select("id, options, opens_at, closes_at, closed_at").eq("id", pollId).maybeSingle(),
    db.from("players").select("id, status").eq("id", playerId).maybeSingle(),
  ]);
  if (!poll || !player || player.status !== "approved" || option >= (poll.options as string[]).length) {
    home.searchParams.set("poll", "bad-link");
    return NextResponse.redirect(home);
  }
  if (phaseOf(poll) !== "open") {
    home.searchParams.set("poll", "closed");
    return NextResponse.redirect(home);
  }
  await db.from("poll_votes").upsert(
    { poll_id: pollId, player_id: playerId, option_index: option, via: "email", voted_at: new Date().toISOString() },
    { onConflict: "poll_id,player_id" },
  );
  home.searchParams.set("poll", "voted");
  return NextResponse.redirect(home);
}
