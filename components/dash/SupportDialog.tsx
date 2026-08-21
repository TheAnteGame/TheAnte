"use client";

import { useEffect, useRef, useState } from "react";
import { submitSupportMessage } from "@/app/actions/support";

// The support box used to be a mailto: link into a domain with no inbox. The message
// now stays on the platform: we already know who is asking, so the only field is the
// message itself, and the confirmation says plainly where the answer will arrive.

export interface SupportCopy {
  cta: string;
  title: string;
  intro: string;
  placeholder: string;
  submitCta: string;
  cancelCta: string;
  sentTitle: string;
  sentBody: string;
  closeCta: string;
  errorGeneric: string;
}

export function SupportDialog({ copy }: { copy: SupportCopy }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && !sent) areaRef.current?.focus();
  }, [open, sent]);

  const close = () => {
    setOpen(false);
    setSent(false);
    setError("");
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async (fd: FormData) => {
    setBusy(true);
    setError("");
    const result = await submitSupportMessage(fd);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? copy.errorGeneric);
      return;
    }
    setSent(true);
  };

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="chamfer chrome-face mt-3 px-4 py-2 text-sm font-semibold uppercase tracking-wide"
      >
        {copy.cta}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={sent ? copy.sentTitle : copy.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="panel chamfer w-full max-w-lg p-6">
            {sent ? (
              <>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">
                  {copy.sentTitle}
                </h2>
                <p className="mt-3 leading-relaxed text-[color:var(--color-text-mid)]">{copy.sentBody}</p>
                <button
                  type="button"
                  onClick={close}
                  className="chamfer chrome-face mt-5 px-5 py-2 text-sm font-semibold uppercase tracking-wide"
                >
                  {copy.closeCta}
                </button>
              </>
            ) : (
              <form action={submit}>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">
                  {copy.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{copy.intro}</p>
                <textarea
                  ref={areaRef}
                  name="body"
                  required
                  maxLength={4000}
                  rows={7}
                  placeholder={copy.placeholder}
                  className="mt-4 w-full resize-y bg-[color:var(--color-surface-2)] px-3 py-2 leading-relaxed text-[color:var(--color-text-hi)] outline-none placeholder:text-[color:var(--color-text-low)] focus:outline-2 focus:outline-[color:var(--color-chrome)]"
                />
                {error && (
                  <p role="alert" className="mt-2 text-sm text-[color:var(--color-loss)]">
                    {error}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="chamfer chrome-face px-5 py-2 text-sm font-semibold uppercase tracking-wide"
                  >
                    {busy ? "…" : copy.submitCta}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="text-sm text-[color:var(--color-text-low)] underline-offset-4 hover:underline"
                  >
                    {copy.cancelCta}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
