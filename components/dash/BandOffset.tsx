"use client";

import { useEffect } from "react";

// The stakes band sticks to the top on desktop and the bet slip's tally bar sticks
// directly beneath it. The band's height changes with content and viewport, so it is
// measured rather than guessed — a hardcoded offset leaves a gap or an overlap the
// moment a tier label or the deadline wraps.

export function BandOffset() {
  useEffect(() => {
    const band = document.querySelector<HTMLElement>("[data-stakes-band]");
    if (!band) return;
    const set = () => document.documentElement.style.setProperty("--band-h", `${band.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(band);
    return () => ro.disconnect();
  }, []);
  return null;
}
