"use client";

import { useTransition } from "react";
import { setNewsSource } from "@/app/actions/news";

// The little menu under the news box (D-099). A plain select that saves on change —
// no Save button for a one-field preference nobody wants to confirm.

export function NewsSourcePicker({
  label,
  allLabel,
  current,
  sources,
}: {
  label: string;
  allLabel: string;
  current: string | null;
  sources: Array<{ id: string; name: string }>;
}) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 border-t border-[color:var(--color-border)] px-4 py-2.5 text-[12px]">
      <span className="uppercase tracking-[0.14em] text-[color:var(--color-text-low)]">{label}</span>
      <select
        defaultValue={current ?? ""}
        disabled={pending}
        onChange={(e) => start(() => setNewsSource(e.target.value))}
        className="min-w-0 flex-1 border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 py-1 text-[12px] text-[color:var(--color-text-hi)] outline-none focus:outline-2 focus:outline-[color:var(--color-chrome)] disabled:opacity-50"
      >
        <option value="">{allLabel}</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
