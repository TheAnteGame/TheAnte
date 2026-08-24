import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Auth gate only — authorization lives in the RLS policies and in every server
// action's own re-check (ANTE-ADMIN §2: middleware is not authorization).
// /api/jobs/* carries its own CRON_SECRET auth and stays out of Clerk's way.

const isPublic = createRouteMatcher(["/", "/rules(.*)", "/api/jobs(.*)", "/api/debug-auth"]); // debug-auth: TEMPORARY, delete with the route

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    const { userId } = await auth();
    if (!userId) return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
