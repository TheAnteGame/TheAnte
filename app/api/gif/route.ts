import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPlayerState } from "@/lib/player";

// GIF search for Table Talk (D-094), proxied so the provider key never reaches a
// browser and so only an approved player can search. GIPHY v1 (the owner set the
// account up there); rating capped at pg-13. Results are the small preview for the
// picker and the full GIF link that goes into the message.

export const dynamic = "force-dynamic";

interface GiphyResult {
  id: string;
  images: Record<string, { url?: string }>;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse(null, { status: 401 });
  const state = await getPlayerState();
  if (!state?.player || state.player.status !== "approved") return new NextResponse(null, { status: 403 });

  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ error: "gif search is not configured" }, { status: 503 });

  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const params = new URLSearchParams({ api_key: key, limit: "24", rating: "pg-13", bundle: "messaging_non_clips" });
  if (q) params.set("q", q);
  const endpoint = q ? "search" : "trending";
  const res = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params}`, { next: { revalidate: 60 } });
  if (!res.ok) return NextResponse.json({ error: "gif search failed" }, { status: 502 });
  const data = (await res.json()) as { data?: GiphyResult[] };
  const gifs = (data.data ?? [])
    .map((r) => ({
      id: r.id,
      preview: r.images.fixed_width_small?.url ?? r.images.fixed_height_small?.url ?? r.images.fixed_height?.url,
      url: r.images.fixed_height?.url ?? r.images.original?.url,
    }))
    .filter((g) => g.preview && g.url);
  return NextResponse.json({ gifs });
}
