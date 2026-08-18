import "server-only";
import { cache } from "react";
import { createAnonServerClient } from "@/lib/db/supabase";
import { contentDefaults } from "./defaults";

// Every user-visible string resolves through here (ANTE-ADMIN §4.4). content_blocks is
// public-readable; the seeded default guarantees a missing or unreachable row never
// renders an empty page. The one surface exempt from this system is /rules, which
// renders the versioned rulebook file from the repo.

const loadAll = cache(async (): Promise<Record<string, string>> => {
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase.from("content_blocks").select("key, value");
    if (error || !data) return {};
    return Object.fromEntries(data.filter((r) => r.value != null).map((r) => [r.key, r.value as string]));
  } catch {
    return {};
  }
});

export async function getContent(key: string, vars?: Record<string, string | number>): Promise<string> {
  const rows = await loadAll();
  let value = rows[key] ?? contentDefaults[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) value = value.replaceAll(`{${k}}`, String(v));
  }
  return value;
}
