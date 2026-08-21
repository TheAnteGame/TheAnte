import { NextResponse } from "next/server";
import { getCommissioner } from "@/lib/admin";
import { buildSnapshot } from "@/lib/backup/snapshot";

// The off-platform copy (D-015). Everything else in the backup system lives in the
// same database it is protecting; this is the one route that gets the league record
// out of it and onto the commissioner's own disk.
//
// 404 rather than 403 for a non-commissioner, matching every other admin surface
// (ANTE-ADMIN §2) — the route's existence is not advertised.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getCommissioner();
  if (!ctx) return new NextResponse(null, { status: 404 });

  const id = new URL(req.url).searchParams.get("id");

  let body: string;
  let stamp: string;
  if (id) {
    const { data, error } = await ctx.db
      .from("league_snapshots")
      .select("created_at, payload")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return new NextResponse(null, { status: 404 });
    body = JSON.stringify(data.payload, null, 2);
    stamp = String(data.created_at).slice(0, 19).replace(/[:T]/g, "-");
  } else {
    body = JSON.stringify(await buildSnapshot(ctx.db, "manual download"), null, 2);
    stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  }

  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="ante-league-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
