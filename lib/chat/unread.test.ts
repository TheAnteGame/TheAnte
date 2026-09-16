import { describe, expect, it } from "vitest";
import { countUnread, unreadBadge } from "./unread";

const m = (who: string, at: string, hidden = false) => ({ player_id: who, created_at: at, hidden_at: hidden ? at : null });

describe("countUnread", () => {
  it("counts only other people's messages after the read mark", () => {
    const msgs = [m("a", "2026-09-16T10:00:00Z"), m("b", "2026-09-16T11:00:00Z"), m("me", "2026-09-16T12:00:00Z"), m("a", "2026-09-16T13:00:00Z")];
    expect(countUnread(msgs, "2026-09-16T10:30:00Z", "me")).toBe(2);
  });
  it("counts everything by others when the dock was never opened", () => {
    expect(countUnread([m("a", "2026-09-16T10:00:00Z"), m("me", "2026-09-16T11:00:00Z")], null, "me")).toBe(1);
  });
  it("ignores hidden messages", () => {
    expect(countUnread([m("a", "2026-09-16T10:00:00Z", true)], null, "me")).toBe(0);
  });
});

describe("unreadBadge", () => {
  it("is empty at zero, a number below the cap, and capped at the page size", () => {
    expect(unreadBadge(0, 50)).toBeNull();
    expect(unreadBadge(3, 50)).toBe("3");
    expect(unreadBadge(50, 50)).toBe("50+");
  });
});
