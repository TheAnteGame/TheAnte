"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** RSC polling: refresh the server-rendered tree on an interval; back off when the
 *  tab is hidden (ANTE-PLAYER §11). During the blackout only the waiting-on list
 *  can change server-side, so a refresh cannot make any other number move. */
export function PollRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = (ms: number) => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => router.refresh(), ms);
    };
    const onVisibility = () => start(document.hidden ? Math.max(intervalMs, 60000) : intervalMs);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);
  return null;
}
