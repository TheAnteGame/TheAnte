import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPlayerState } from "@/lib/player";

// GIF search for Table Talk (D-094), proxied so the provider key never reaches a
// browser and so only an approved player can search. Tenor v2; the provider's own
// content filter is on. Results are the small preview for the picker and the full
// GIF link that goes into the message.

export const dynamic = "force-dynamic";

interface TenorResult {
  id: string;
  media_formats: Record<string, { url: string; dims: [number, number] }>;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse(null, { status: 401 });
  const state = await getPlayerState();
  if (!state?.player || state.player.status !== "approved") return new NextResponse(null, { status: 403 });

  const key = process.env.TENOR_API_KEY;
  if (!key) return NextResponse.json({ error: "gif search is not configured" }, { status: 503 });

  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const params = new URLSearchParams({
    key,
    client_key: "ante",
    limit: "24",
    contentfilter: "medium",
    media_filter: "tinygif,gif",
  });
  if (q) params.set("q", q);
  const endpoint = q ? "search" : "featured";
  const res = await fetch(`https://tenor.googleapis.com/v2/${endpoint}?${params}`, { next: { revalidate: 60 } });
  if (!res.ok) return NextResponse.json({ error: "gif search failed" }, { status: 502 });
  const data = (await res.json()) as { results?: TenorResult[] };
  const gifs = (data.results ?? [])
    .map((r) => ({
      id: r.id,
      preview: r.media_formats.tinygif?.url ?? r.media_formats.gif?.url,
      url: r.media_formats.gif?.url ?? r.media_formats.tinygif?.url,
    }))
    .filter((g) => g.preview && g.url);
  return NextResponse.json({ gifs });
}
