"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { chatPulse } from "@/app/actions/chat";

/** How often the room is checked for something new (D-129). */
const CHAT_PULSE_MS = 10_000;

/** Keeps Table Talk live without re-reading the season every few seconds (D-129). The
 *  page itself refreshes once a minute; this asks only for the room's fingerprint and
 *  refreshes the page early when a message, reaction or vote has landed. Quiet while
 *  the tab is hidden — PollRefresh refreshes on the way back anyway. */
export function ChatPulse() {
  const router = useRouter();
  useEffect(() => {
    let last: string | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;
    const tick = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const next = await chatPulse();
        if (next !== null && last !== null && next !== last) router.refresh();
        if (next !== null) last = next;
      } catch {
        // A missed check costs at most one interval; the minute refresh still runs.
      } finally {
        inFlight = false;
      }
    };
    const onVisibility = () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (document.hidden) return;
      void tick();
      timer = setInterval(() => void tick(), CHAT_PULSE_MS);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);
  return null;
}
