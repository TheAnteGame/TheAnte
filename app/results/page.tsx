import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/db/supabase";
import { getPlayerState, routeFor } from "@/lib/player";

// /results with no week goes to the most recent REVEALED week — never the current one.
// During the blackout the live week has no results, and landing on an empty page every
// Tuesday to Thursday would make the header link look broken (D-022).

export const dynamic = "force-dynamic";

export default async function Results() {
  const state = await getPlayerState();
  if (!state) redirect("/");
  if (routeFor(state) !== "/dashboard") redirect(routeFor(state));

  const db = createUserClient();
  const { data: week } = await db
    .from("weeks")
    .select("number")
    .not("revealed_at", "is", null)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  redirect(week ? `/results/${week.number}` : "/results/none");
}
