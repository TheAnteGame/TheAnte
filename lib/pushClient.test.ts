import { afterEach, describe, expect, it, vi } from "vitest";
import { pushSupport } from "./pushClient";

// The profile toggle cannot be driven here without a Clerk session or a phone, so
// the decision it opens on — which of the three things to show — is checked alone.
function device(ua: string, opts: { standalone?: boolean; push?: boolean; touch?: number } = {}) {
  const win: Record<string, unknown> = {
    matchMedia: () => ({ matches: opts.standalone === true }),
  };
  if (opts.push !== false) {
    win.PushManager = function PushManager() {};
    win.Notification = function Notification() {};
  }
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", {
    userAgent: ua,
    maxTouchPoints: opts.touch ?? 0,
    ...(opts.push !== false ? { serviceWorker: {} } : {}),
  });
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

afterEach(() => vi.unstubAllGlobals());

describe("pushSupport (D-120)", () => {
  it("asks an iPhone in Safari to add the home-screen icon first", () => {
    device(IPHONE, { push: false });
    expect(pushSupport()).toBe("ios-install");
  });

  it("lets an iPhone opened from the home screen switch on", () => {
    device(IPHONE, { standalone: true });
    expect(pushSupport()).toBe("supported");
  });

  it("knows an iPad that calls itself a Mac", () => {
    device(IPAD_DESKTOP, { touch: 5, push: false });
    expect(pushSupport()).toBe("ios-install");
  });

  it("lets Android switch on straight from the browser", () => {
    device(ANDROID);
    expect(pushSupport()).toBe("supported");
  });

  it("says so when a browser has no push at all", () => {
    device(ANDROID, { push: false });
    expect(pushSupport()).toBe("unsupported");
  });
});
