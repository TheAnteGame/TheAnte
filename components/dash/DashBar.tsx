"use client";

import { useEffect, useState } from "react";

/** The sticky shell of the dashboard bar (D-125). Transparent on the table at the top
 *  of the page; frosted once anything has scrolled under it (globals.css .dash-bar). */
export function DashBar({ children }: { children: React.ReactNode }) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const check = () => setStuck(window.scrollY > 4);
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
