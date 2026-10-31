import { describe, expect, it } from "vitest";
import { pushBody, pushFromDoc, pushPath, pushTitle } from "./push";
import { pollEmail, templateDoc } from "./docs";

describe("push message from an email (D-120)", () => {
  it("drops the ANTE: prefix the notification already wears", () => {
    expect(pushTitle("ANTE: Week 9 Is Open")).toBe("Week 9 Is Open");
    expect(pushTitle("ANTE: ")).toBe("ANTE");
  });

  it("turns site links into paths and sends anything else to the dashboard", () => {
    expect(pushPath("https://theantegame.com/dashboard")).toBe("/dashboard");
    expect(pushPath("https://theantegame.com")).toBe("/dashboard");
    expect(pushPath("/season")).toBe("/season");
    expect(pushPath("https://example.com/phish")).toBe("/dashboard");
    expect(pushPath(undefined)).toBe("/dashboard");
  });

  it("fits a lock screen", () => {
    const body = pushBody("word ".repeat(100));
    expect(body.length).toBeLessThanOrEqual(178);
    expect(body.endsWith("…")).toBe(true);
    expect(pushBody("  two\n lines ")).toBe("two lines");
  });

  it("never lands a tap on a poll's one-tap vote link", () => {
    const doc = pollEmail({
      kind: "open",
      firstName: "Sam",
      question: "Move the deadline?",
      options: [
        { label: "Yes", href: "https://theantegame.com/api/poll/vote?t=yes" },
        { label: "No", href: "https://theantegame.com/api/poll/vote?t=no" },
      ],
      closes: "Friday",
    });
    expect(pushFromDoc("ANTE: League Poll", doc).url).toBe("/dashboard");
  });

  it("uses the email's own preview line as the body", () => {
    const doc = templateDoc({ eyebrow: "ANTE", headline: "Final call", body: "Six hours to the wall." });
    const msg = pushFromDoc("ANTE: Final Call for Week 9", doc);
    expect(msg).toEqual({ title: "Final Call for Week 9", body: "Six hours to the wall.", url: "/dashboard" });
  });
});
