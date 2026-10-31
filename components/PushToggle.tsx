"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush, setEmailNotifications } from "@/app/actions/push";
import { pushSupport, registration, subscribe, writeFlag } from "@/lib/pushClient";

interface Copy {
  label: string;
  help: string;
  on: string;
  off: string;
  turnOff: string;
  working: string;
  iosSteps: string;
  blocked: string;
  unsupported: string;
  failed: string;
  emailLabel: string;
  emailOffWarning: string;
}

type View = "loading" | "off" | "on" | "working" | "blocked" | "ios-install" | "unsupported";

/** Phone notifications for THIS device (D-120). Acts on tap, outside the profile
 *  form: the browser's own Allow prompt has to come straight from the tap, and a
 *  device is switched on or off by itself, not saved with a name change.
 *
 *  With the phone on, email can go off (D-122). That one is per player, not per
 *  device, and the server turns it back on when the player's last device goes. */
export function PushToggle({ copy, publicKey, emailOn: initialEmailOn }: { copy: Copy; publicKey: string; emailOn: boolean }) {
  const [view, setView] = useState<View>("loading");
  const [failed, setFailed] = useState(false);
  const [emailOn, setEmailOn] = useState(initialEmailOn);
  const [savingEmail, setSavingEmail] = useState(false);

  async function toggleEmail(on: boolean) {
    setFailed(false);
    setSavingEmail(true);
    const result = await setEmailNotifications(on).catch(() => ({ ok: false, emailOn }));
    setEmailOn(result.emailOn);
    if (!result.ok) setFailed(true);
    setSavingEmail(false);
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const support = pushSupport();
      if (support !== "supported") return live && setView(support);
      if (Notification.permission === "denied") return live && setView("blocked");
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        if (live) setView(sub && Notification.permission === "granted" ? "on" : "off");
      } catch {
        if (live) setView("unsupported");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  async function turnOn() {
    setFailed(false);
    // First, before any other await: iOS only shows the prompt from a direct tap.
    const permission = await Notification.requestPermission();
    if (permission === "denied") return setView("blocked");
    if (permission !== "granted") return;
    setView("working");
    try {
      const reg = await registration();
      const sub = await subscribe(reg, publicKey);
      const saved = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!saved.ok) throw new Error("save");
      writeFlag(true);
      setView("on");
      await sendTestPush(sub.endpoint);
    } catch {
      setFailed(true);
      setView("off");
    }
  }

  async function turnOff() {
    setFailed(false);
    setView("working");
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const removed = await removePushSubscription(sub.endpoint);
        if (removed.emailBackOn) setEmailOn(true);
        await sub.unsubscribe();
      }
      writeFlag(false);
      setView("off");
    } catch {
      setFailed(true);
      setView("on");
    }
  }

  const button =
    "chamfer border border-[color:var(--color-border)] px-4 py-2 text-sm text-[color:var(--color-text-hi)] " +
    "hover:border-[color:var(--color-chrome)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-chrome)] disabled:opacity-60";

  return (
    <section className="flex w-full max-w-sm flex-col gap-1 text-left" aria-live="polite">
      <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-mid)]">{copy.label}</h2>
      <p className="mb-1 text-xs leading-relaxed text-[color:var(--color-text-low)]">{copy.help}</p>
      {view === "off" && (
        <button type="button" onClick={turnOn} className={button}>
          {copy.off}
        </button>
      )}
      {view === "working" && (
        <button type="button" disabled className={button}>
          {copy.working}
        </button>
      )}
      {view === "on" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[color:var(--color-text-hi)]">{copy.on}</p>
          <button type="button" onClick={turnOff} className={button}>
            {copy.turnOff}
          </button>
        </div>
      )}
      {/* Shown while this phone is on — and whenever email is off, so it can always
          be turned back on from any device. */}
      {(view === "on" || !emailOn) && view !== "loading" && (
        <div className="mt-2 flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm text-[color:var(--color-text-hi)]">
            <input
              type="checkbox"
              checked={emailOn}
              disabled={savingEmail}
              onChange={(e) => toggleEmail(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--color-chrome)]"
            />
            {copy.emailLabel}
          </label>
          {!emailOn && (
            <p role="status" className="text-xs leading-relaxed text-[color:var(--color-loss)]">
              {copy.emailOffWarning}
            </p>
          )}
        </div>
      )}
      {view === "ios-install" && <p className="text-sm leading-relaxed text-[color:var(--color-text-hi)]">{copy.iosSteps}</p>}
      {view === "blocked" && <p className="text-sm leading-relaxed text-[color:var(--color-text-hi)]">{copy.blocked}</p>}
      {view === "unsupported" && <p className="text-sm leading-relaxed text-[color:var(--color-text-mid)]">{copy.unsupported}</p>}
      {failed && (
        <p role="alert" className="text-sm text-[color:var(--color-loss)]">
          — {copy.failed}
        </p>
      )}
    </section>
  );
}
