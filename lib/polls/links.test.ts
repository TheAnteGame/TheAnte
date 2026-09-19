import { beforeAll, describe, expect, it } from "vitest";
import { verifyVote, voteLink, voteSignature } from "./links";

beforeAll(() => {
  process.env.CRON_SECRET = "test-secret";
});

describe("signed vote links", () => {
  const poll = "11111111-1111-4111-8111-111111111111";
  const me = "22222222-2222-4222-8222-222222222222";

  it("builds a link that names the poll, the player, the option and a signature", () => {
    const u = new URL(voteLink(poll, me, 1));
    expect(u.pathname).toBe("/api/poll/vote");
    expect(u.searchParams.get("p")).toBe(poll);
    expect(u.searchParams.get("u")).toBe(me);
    expect(u.searchParams.get("o")).toBe("1");
    expect(verifyVote(poll, me, 1, u.searchParams.get("s")!)).toBe(true);
  });

  it("refuses a link altered to another option, player, or poll", () => {
    const s = voteSignature(poll, me, 1);
    expect(verifyVote(poll, me, 2, s)).toBe(false);
    expect(verifyVote(poll, "33333333-3333-4333-8333-333333333333", 1, s)).toBe(false);
    expect(verifyVote("44444444-4444-4444-8444-444444444444", me, 1, s)).toBe(false);
    expect(verifyVote(poll, me, 1, s.slice(0, -1) + "0")).toBe(false);
  });
});
