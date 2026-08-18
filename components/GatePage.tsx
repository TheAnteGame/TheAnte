import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";

/** Shared shell for the waiting / closed pages: logo, one message, a quiet exit. */
export function GatePage({ message, logoAlt, signOutLabel }: { message: string; logoAlt: string; signOutLabel: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <Image src="/logo.png" alt={logoAlt} width={222} height={142} priority />
      <p className="max-w-md leading-relaxed text-[color:var(--color-text-mid)]">{message}</p>
      <SignOutButton>
        <button className="text-xs text-[color:var(--color-text-low)] underline-offset-4 hover:underline">
          {signOutLabel}
        </button>
      </SignOutButton>
    </main>
  );
}
