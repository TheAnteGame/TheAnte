// The Ante's service worker (D-120). It does one job: receive a league notification
// and open the right page when it is tapped. No offline cache, no fetch handler —
// every page still comes from the network exactly as before.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let msg;
  try {
    msg = event.data.json();
  } catch {
    msg = { title: "ANTE", body: event.data.text(), url: "/dashboard" };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "ANTE", {
      body: msg.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: msg.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      // Reuse an open Ante window rather than stacking a new one per tap.
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of open) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
