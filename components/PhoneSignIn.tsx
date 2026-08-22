"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ensurePlayer } from "@/app/actions/player";

// Phone OTP, no passwords anywhere (ANTE-TECH §3.2). The code entry replaces the
// phone field in place — no navigation (ANTE-PLAYER §3.1, per the sketch). Uses
// Clerk v7's namespaced flow API: signIn.phoneCode.* / signUp.verifications.*.
// All copy arrives as props so every string still resolves through content blocks.

interface Copy {
  phoneLabel: string;
  phonePlaceholder: string;
  phoneCta: string;
  codePrompt: string;
  verifyCta: string;
  resendLabel: string;
  optinDisclosure: string;
  errorGeneric: string;
}

/** E.164 with US default (§3.1): 10 digits → +1, 11 with leading 1 → +, else as given. */
export function toE164(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function PhoneSignIn({ copy }: { copy: Copy }) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === "code") codeRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  if (!signIn || !signUp) return null;

  const sendCode = async () => {
    setBusy(true);
    setError("");
    const phoneNumber = toE164(phone);

    // Existing player first; an unknown phone becomes an application (§3.1).
    const attempt = await signIn.phoneCode.sendCode({ phoneNumber });
    if (!attempt.error) {
      setMode("signin");
      setStage("code");
      setResendIn(30);
      setBusy(false);
      return;
    }

    const created = await signUp.create({ phoneNumber });
    if (!created.error) {
      const sent = await signUp.verifications.sendPhoneCode();
      if (!sent.error) {
        setMode("signup");
        setStage("code");
        setResendIn(30);
        setBusy(false);
        return;
      }
    }
    setError(created.error?.message ?? copy.errorGeneric);
    setBusy(false);
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    const result =
      mode === "signin"
        ? await signIn.phoneCode.verifyCode({ code })
        : await signUp.verifications.verifyPhoneCode({ code });
    if (result.error) {
      setError(copy.errorGeneric);
      setBusy(false);
      return;
    }
    const finalized = mode === "signin" ? await signIn.finalize() : await signUp.finalize();
    if (finalized.error) {
      setError(copy.errorGeneric);
      setBusy(false);
      return;
    }
    const dest = await ensurePlayer();
    router.push(dest);
  };

  const resend = async () => {
    if (resendIn > 0) return;
    setResendIn(30);
    if (mode === "signin") await signIn.phoneCode.sendCode({ phoneNumber: toE164(phone) });
    else await signUp.verifications.sendPhoneCode();
  };

  if (stage === "code") {
    return (
      <form
        className="flex w-full max-w-sm flex-col items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <p className="text-sm text-[color:var(--color-text-mid)]">{copy.codePrompt}</p>
        {/* Same rule as the phone field below — the six-digit box needs an edge too. */}
        <div className="chamfer flex w-full border border-[color:var(--color-text-low)] bg-[color:var(--color-surface-2)] focus-within:outline-2 focus-within:outline-[color:var(--color-chrome)]">
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={copy.codePrompt}
            className="nums w-full bg-transparent px-4 py-3 text-center text-2xl tracking-[0.5em] text-[color:var(--color-text-hi)] outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="chamfer m-1 chrome-face px-4 font-[family-name:var(--font-display)] font-semibold text-[color:var(--color-canvas)]"
          >
            {copy.verifyCta}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={resendIn > 0}
          className="text-xs text-[color:var(--color-text-low)] underline-offset-4 hover:underline disabled:no-underline"
        >
          {resendIn > 0 ? `${copy.resendLabel} (${resendIn})` : copy.resendLabel}
        </button>
        {error && (
          <p role="alert" className="text-sm text-[color:var(--color-loss)]">
            — {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void sendCode();
      }}
    >
      <label htmlFor="phone" className="sr-only">
        {copy.phoneLabel}
      </label>
      {/* The field carried no border at all — just a fill a shade off the canvas, which
          on a dim monitor left the primary action on the homepage with no edge to find.
          A neutral-grey rule at 7.5:1 on this surface gives it one. */}
      <div className="chamfer flex w-full border border-[color:var(--color-text-low)] bg-[color:var(--color-surface-2)] focus-within:outline-2 focus-within:outline-[color:var(--color-chrome)]">
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={copy.phonePlaceholder}
          className="nums w-full bg-transparent px-4 py-3 text-lg text-[color:var(--color-text-hi)] outline-none placeholder:text-[color:var(--color-text-low)]"
        />
        <button
          type="submit"
          disabled={busy || phone.replace(/\D/g, "").length < 10}
          aria-label={copy.phoneCta}
          className="chamfer m-1 chrome-face px-4 font-[family-name:var(--font-display)] font-semibold text-[color:var(--color-canvas)]"
        >
          →
        </button>
      </div>
      {/* Clerk's bot protection mounts its Smart CAPTCHA here in custom flows;
          without this element it falls back noisily to the invisible widget. */}
      <div id="clerk-captcha" />
      <p className="max-w-xs text-center text-xs leading-relaxed text-[color:var(--color-text-low)]">
        {copy.optinDisclosure}
      </p>
      {error && (
        <p role="alert" className="text-sm text-[color:var(--color-loss)]">
          — {error}
        </p>
      )}
    </form>
  );
}
