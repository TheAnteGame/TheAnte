import { redirect } from "next/navigation";
import { ensurePlayer } from "@/app/actions/player";

// Landing point right after phone verification: creates the pending application
// (idempotent — the unique constraint absorbs repeats) and routes per §3.1.

export const dynamic = "force-dynamic";

export default async function Join() {
  const dest = await ensurePlayer();
  redirect(dest);
}
