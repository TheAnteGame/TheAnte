"use client";

import { useEffect, useState } from "react";

/** Settle past this much scroll; open up again only back at the very top. The gap is
 *  wider than the 32px the bar gives back on a computer: with one threshold, the
 *  shrink pulled the page up under it, which unstuck it, which grew it — a flicker. */
const SETTLE_AT = 48;
const OPEN_AT = 4;

/** The sticky shell of the dashboard bar (D-125). Transparent on the table at the top
 *  of the page; frosted once anything has scrolled under it (globals.css .dash-bar). */
export function DashBar({ children }: { children: React.ReactNode }) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const check = () => setStuck((was) => (was ? window.scrollY > OPEN_AT : window.scrollY > SETTLE_AT));
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return (
    <header data-stuck={stuck} className="dash-bar sticky top-0 z-40">
      {children}
    </header>
  );
}
