import { createHmac } from "node:crypto";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/supabase";
import { TableTalk } from "@/components/dash/TableTalk";

// LOCAL PREVIEW HARNESS — never ships (404s in production). Renders Table Talk against
// the local torture stack through a signed player JWT, RLS included.

export const dynamic = "force-dynamic";

function asPlayer(sub: string) {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const secret = process.env.SUPABASE_LOCAL_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${head}.${body}.${sig}` } },
  });
}

export default async function TableTalkPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const svc = createServiceClient();
  const { data: me } = await svc
    .from("players")
    .select("id, clerk_user_id")
    .eq("status", "approved")
    .order("first_name")
    .limit(1)
    .maybeSingle();
  if (!me?.clerk_user_id) notFound();

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <TableTalk playerId={me.id} dbOverride={asPlayer(me.clerk_user_id)} />
    </main>
  );
}
