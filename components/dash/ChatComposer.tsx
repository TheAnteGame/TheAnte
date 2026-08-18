"use client";

import { useRef, useState } from "react";
import { postChatMessage } from "@/app/actions/chat";

export function ChatComposer({ placeholder }: { placeholder: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        setError("");
        const result = await postChatMessage(fd);
        if (!result.ok && result.error) setError(result.error);
        else formRef.current?.reset();
      }}
      className="flex gap-2 border-t border-[color:var(--color-border)] p-3"
    >
      <input
        name="body"
        maxLength={2000}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-text-hi)] outline-none placeholder:text-[color:var(--color-text-low)] focus:outline-2 focus:outline-[color:var(--color-chrome)]"
      />
      <button
        type="submit"
        className="chamfer bg-[color:var(--color-chrome)] px-4 text-sm font-semibold text-[color:var(--color-canvas)]"
      >
        →
      </button>
      {error && (
        <p role="alert" className="text-xs text-[color:var(--color-loss)]">
          {error}
        </p>
      )}
    </form>
  );
}
