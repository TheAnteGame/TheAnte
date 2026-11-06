"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How often a page re-renders while someone is looking at it (D-129). Each refresh
 *  re-reads the season from Supabase, so this is the app's whole data bill: at five
 *  seconds, a handful of open tabs blew the Free plan's monthly egress on 2026-11-05.
 *  Scores only sync every five minutes, so a minute loses nothing on game day. */
export const PAGE_REFRESH_MS = 60_000;

/** RSC polling: refresh the server-rendered tree on an interval while the tab is
 *  visible, and not at all while it is hidden — coming back refreshes at once, so a
 *  returning player never reads a stale board (ANTE-PLAYER §11). During the blackout
 *  only the waiting-on list can change server-side, so a refresh cannot make any other
 *  number move. */
export function PollRefresh({ intervalMs = PAGE_REFRESH_MS }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      stop();
      if (document.hidden) return;
      timer = setInterval(() => router.refresh(), intervalMs);
    };
    const onReturn = () => {
      if (!document.hidden) router.refresh();
      onVisibility();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [router, intervalMs]);
  return null;
}
