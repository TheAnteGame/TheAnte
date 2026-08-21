"use client";

import { useState } from "react";
import { MAX_SPEED, MIN_SPEED } from "@/lib/ticker/style";

// The slider reads out in seconds-per-pass and in plain words, because "40" means
// nothing on its own — the commissioner is choosing a reading pace, not a number.

export function TickerSpeed({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial);
  const word = value <= 25 ? "Fast" : value <= 55 ? "Steady" : value <= 100 ? "Relaxed" : "Slow";
  return (
    <label className="flex max-w-xl flex-col gap-2">
      <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">
        Crawl speed — one full pass takes {value}s ({word})
      </span>
      <input
        type="range"
        name="speedSeconds"
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={5}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-[color:var(--color-gold)]"
      />
      <span className="flex justify-between text-[12px] text-[color:var(--color-text-low)]">
        <span>Faster ({MIN_SPEED}s)</span>
        <span>Slower ({MAX_SPEED}s)</span>
      </span>
    </label>
  );
}
