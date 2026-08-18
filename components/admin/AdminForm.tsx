"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/admin/actions";

// One form wrapper for every console mutation: dispatches the server action,
// surfaces its error inline, never navigates. Destructive actions pass `confirm`
// to get a native confirm() — visual weight proportional to consequences (art §7).

export function AdminForm({
  action,
  children,
  submitLabel,
  confirmText,
  danger,
  inline,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children?: React.ReactNode;
  submitLabel: string;
  confirmText?: string;
  danger?: boolean;
  inline?: boolean;
}) {
  const [state, dispatch, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => action(fd),
    null,
  );

  return (
    <form
      action={dispatch}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={inline ? "inline-flex flex-wrap items-center gap-2" : "flex flex-col gap-2"}
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className={`chamfer px-3 py-1.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-40 ${
          danger
            ? "border border-[color:var(--color-loss)] text-[color:var(--color-loss)]"
            : "bg-[color:var(--color-chrome)] text-[color:var(--color-canvas)]"
        }`}
      >
        {pending ? "…" : submitLabel}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-[color:var(--color-loss)]">
          — {state.error}
        </p>
      )}
      {state?.ok && <p className="text-xs text-[color:var(--color-win)]">✓</p>}
    </form>
  );
}
