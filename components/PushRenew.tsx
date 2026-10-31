"use client";

import { useEffect } from "react";
import { savePushSubscription } from "@/app/actions/push";
import { pushSupport, readFlag, registration, subscribe } from "@/lib/pushClient";

const LAST_RENEWED = "ante.push.renewed";
const DAY = 24 * 60 * 60 * 1000;

/** Keeps a switched-on device switched on (D-120). Push services quietly expire
 *  subscriptions — iPhones most of all, after an update or a long gap — and nothing
 *  tells the server. So once a day, on any signed-in page, a device that was turned
 *  on re-states its subscription, re-making it if the browser dropped it. Never asks
 *  for permission: with permission gone it does nothing, and the profile says why. */
export function PushRenew({ publicKey }: { publicKey: string }) {
  useEffect(() => {
    (async () => {
      try {
        if (!readFlag() || pushSupport() !== "supported" || Notification.permission !== "granted") return;
        const last = Number(localStorage.getItem(LAST_RENEWED) ?? 0);
        if (Date.now() - last < DAY) return;
        const sub = await subscribe(await registration(), publicKey);
        const saved = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (saved.ok) localStorage.setItem(LAST_RENEWED, String(Date.now()));
      } catch {
        // Next page load tries again. Email is unaffected either way.
      }
    })();
  }, [publicKey]);
  return null;
}
