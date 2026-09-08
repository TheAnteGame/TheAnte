import { cache } from "react";
import { createAnonServerClient } from "@/lib/db/supabase";

// Team display names for player tooltips (favorite_team) and profile selects.
// `teams` is a public 32-row controlled vocabulary (0004_seed_teams.sql) — one
// query per request via React cache(), never per player rendered.
export const getTeamNames = cache(async (): Promise<Map<string, string>> => {
  const { data } = await createAnonServerClient().from("teams").select("code, city, name");
  return new Map((data ?? []).map((t) => [t.code as string, `${t.city} ${t.name}`]));
});
