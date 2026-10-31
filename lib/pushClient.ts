// Browser side of phone notifications (D-120), shared by the profile toggle and the
// quiet renewal that runs on every signed-in page. No React, no server imports.

/** Remembers that this device was switched on, so a lost subscription is quietly
 *  re-made instead of silently ending. Per device, which is what push is. */
export const PUSH_FLAG = "ante.push";

export type PushSupport = "supported" | "ios-install" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iOS exposes PushManager only to a home-screen install, so ask for that first.
  if (ios && !standalone) return "ios-install";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "supported";
  return "unsupported";
}

export async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function subscribe(reg: ServiceWorkerRegistration, publicKey: string): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function readFlag(): boolean {
  try {
    return localStorage.getItem(PUSH_FLAG) === "on";
  } catch {
    return false;
  }
}

export function writeFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(PUSH_FLAG, "on");
    else localStorage.removeItem(PUSH_FLAG);
  } catch {
    // Private mode or storage blocked: renewal just won't run on this device.
  }
}
