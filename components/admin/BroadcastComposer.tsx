"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/app/admin/actions";

// The compose form for a one-off league email (D-088). Everything the commissioner
// types goes through the same envelope as every other email; the preview on the
// right is the real HTML rendering, not a mock, so what is seen is what is sent.

interface Labels {
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  whenNow: string;
  whenLater: string;
  sendAt: string;
  preview: string;
  test: string;
  submitNow: string;
  submitLater: string;
}

export function BroadcastComposer({
  create,
  preview,
  test,
  inputCls,
  labels,
  playerCount,
}: {
  create: (fd: FormData) => Promise<ActionResult>;
  preview: (fd: FormData) => Promise<ActionResult & { html?: string }>;
  test: (fd: FormData) => Promise<ActionResult>;
  inputCls: string;
  labels: Labels;
  playerCount: number;
}) {
  const [when, setWhen] = useState<"now" | "later">("now");
  const [createState, createAction, creating] = useActionState<ActionResult | null, FormData>(async (_p, fd) => create(fd), null);
  const [previewState, previewAction, previewing] = useActionState<(ActionResult & { html?: string }) | null, FormData>(
    async (_p, fd) => preview(fd),
    null,
  );
  const [testState, testAction, testing] = useActionState<ActionResult | null, FormData>(async (_p, fd) => test(fd), null);

  const confirm = (e: React.FormEvent<HTMLFormElement>) => {
    const msg =
      when === "now"
        ? `Send this to all ${playerCount} approved players right now?`
        : `Queue this for the time chosen, to all approved players at that moment?`;
    if (!window.confirm(msg)) e.preventDefault();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <form action={createAction} onSubmit={confirm} className="flex flex-col gap-3" id="broadcast-form">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">{labels.subject}</span>
          <input name="subject" required maxLength={120} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">{labels.headline}</span>
          <input name="headline" maxLength={80} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">{labels.body}</span>
          <textarea name="body" required rows={10} maxLength={6000} className={`${inputCls} leading-relaxed`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">{labels.ctaLabel}</span>
            <input name="ctaLabel" maxLength={40} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">{labels.ctaHref}</span>
            <input name="ctaHref" type="url" placeholder="https://theantegame.com/dashboard" className={inputCls} />
          </label>
        </div>

        <fieldset className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="when" value="now" checked={when === "now"} onChange={() => setWhen("now")} />
            {labels.whenNow}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="when" value="later" checked={when === "later"} onChange={() => setWhen("later")} />
            {labels.whenLater}
          </label>
          {when === "later" && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">{labels.sendAt}</span>
              <input name="sendAt" type="datetime-local" required className={inputCls} />
            </label>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={creating}
            className="chamfer btn-chrome px-4 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-40"
          >
            {creating ? "…" : when === "now" ? labels.submitNow : labels.submitLater}
          </button>
          <button
            type="submit"
            formAction={previewAction}
            formNoValidate
            disabled={previewing}
            onClick={(e) => e.stopPropagation()}
            className="chamfer border border-[color:var(--color-border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-40"
          >
            {previewing ? "…" : labels.preview}
          </button>
          <button
            type="submit"
            formAction={testAction}
            disabled={testing}
            className="chamfer border border-[color:var(--color-gold-dim)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-gold)] disabled:opacity-40"
          >
            {testing ? "…" : labels.test}
          </button>
          {createState && !createState.ok && <p role="alert" className="text-xs text-[color:var(--color-loss)]">— {createState.error}</p>}
          {createState?.ok && <p className="text-xs text-[color:var(--color-win)]">✓</p>}
          {testState && !testState.ok && <p role="alert" className="text-xs text-[color:var(--color-loss)]">— {testState.error}</p>}
          {testState?.ok && <p className="text-xs text-[color:var(--color-win)]">✓ test sent</p>}
          {previewState && !previewState.ok && <p role="alert" className="text-xs text-[color:var(--color-loss)]">— {previewState.error}</p>}
        </div>
      </form>

      <div className="min-h-[24rem] border border-[color:var(--color-border)] bg-[#0b0b0d]">
        {previewState?.html ? (
          <iframe title="Email preview" srcDoc={previewState.html} sandbox="" className="h-[40rem] w-full" />
        ) : (
          <p className="p-4 text-sm text-[color:var(--color-text-low)]">The rendered email appears here after Preview.</p>
        )}
      </div>
    </div>
  );
}
