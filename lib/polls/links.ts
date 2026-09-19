import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Vote-from-email (D-095). Each button in the poll email carries a link that names
// the poll, the option and the player, signed with the cron secret — so a tap counts
// without a sign-in, and a link can only ever cast THAT vote for THAT player. The
// vote route re-checks that the poll is still open, so an old link cannot vote late.

const SITE = "https://theantegame.com";

function secret(): string {
  const s = process.env.CRON_SECRET;
  if (!s) throw new Error("CRON_SECRET is not set");
  return s;
}

export function voteSignature(pollId: string, playerId: string, option: number): string {
  return createHmac("sha256", secret()).update(`poll-vote:${pollId}:${playerId}:${option}`).digest("hex").slice(0, 32);
}

export function voteLink(pollId: string, playerId: string, option: number): string {
  const q = new URLSearchParams({ p: pollId, u: playerId, o: String(option), s: voteSignature(pollId, playerId, option) });
  return `${SITE}/api/poll/vote?${q}`;
}

export function verifyVote(pollId: string, playerId: string, option: number, sig: string): boolean {
  const want = voteSignature(pollId, playerId, option);
  if (sig.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
