import { defineConfig } from "drizzle-kit";

// Drizzle owns the schema as reviewable SQL under supabase/migrations (ANTE-TECH §2.1).
// Migrations are applied through the Supabase connector or `supabase db push`, never at
// runtime; runtime reads go through supabase-js as the requesting user so RLS applies.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
  },
});
