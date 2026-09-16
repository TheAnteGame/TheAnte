import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ChatDock } from "@/components/dash/ChatDock";

// The dock cannot be driven in a browser here without a Clerk session, so its first
// paint is checked the way the server produces it (D-086): closed, with the count.
vi.mock("@/app/actions/chat", () => ({ markChatRead: vi.fn() }));

const props = {
  unread: 3,
  badge: "3",
  label: "League Chat",
  newLabel: "3 new",
  openAria: "Open league chat",
  closeAria: "Close league chat",
  help: <span>?</span>,
  children: <div>room</div>,
};

describe("ChatDock first paint", () => {
  it("corner: closed strip with the label, the count, and the glow", () => {
    const html = renderToString(<ChatDock position="corner" {...props} />);
    expect(html).toContain("League Chat");
    expect(html).toContain("3 new");
    expect(html).toContain("dock-lit");
    expect(html).toContain("sm:w-[360px]");
    // .dock, never .panel: .panel pins position relative and un-fixes the dock.
    expect(html).toContain(" dock ");
    expect(html).not.toContain(" panel ");
    expect(html).not.toContain("room");
  });

  it("bar: full-width strip, no corner sizing", () => {
    const html = renderToString(<ChatDock position="bar" {...props} />);
    expect(html).toContain("inset-x-0 bottom-0");
    expect(html).not.toContain("sm:w-[360px]");
  });

  it("side: a right-edge tab carrying the count", () => {
    const html = renderToString(<ChatDock position="side" {...props} />);
    expect(html).toContain("writing-mode:vertical-rl");
    expect(html).toContain("right-0");
    expect(html).toContain(">3<");
  });

  it("stays quiet with nothing unread", () => {
    const html = renderToString(<ChatDock position="corner" {...props} unread={0} badge={null} newLabel="" />);
    expect(html).not.toContain("dock-lit");
    expect(html).not.toContain("new");
  });
});
