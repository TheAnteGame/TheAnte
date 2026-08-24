import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// TEMPORARY diagnostic (review D-036 aftermath): reports what the SERVER sees during
// the Clerk production cutover. Reveals nothing sensitive — key prefixes only (live
// vs test mode), cookie NAMES (not values), and whether auth() resolves a user for
// the caller's own request. Delete after the cutover is verified.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let userId: string | null = null;
  let authError: string | null = null;
  try {
    ({ userId } = await auth());
  } catch (e) {
    authError = e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120);
  }
  const cookieNames = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter(Boolean);
  return NextResponse.json({
    secretKeyPrefix: (process.env.CLERK_SECRET_KEY ?? "MISSING").slice(0, 8),
    publishableKeyPrefix: (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "MISSING").slice(0, 8),
    hasSessionCookie: cookieNames.includes("__session"),
    hasClientCookie: cookieNames.some((n) => n.startsWith("__client")),
    clerkCookieNames: cookieNames.filter((n) => n.includes("clerk") || n.startsWith("__")),
    userId: userId ? `present (${userId.slice(0, 8)}…)` : null,
    authError,
  });
}
