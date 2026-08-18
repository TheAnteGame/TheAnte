import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ANTE_TIERS, LIMIT_DIVISOR, MAX_BET, MIN_BET, MIN_GAMES, MIN_PLAYERS, PAYOUT_CAP, PAYOUT_FLOOR, POT_PLACES, ROUNDING_STEP } from "@/lib/engine";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { activateSeason, handoffCommissioner } from "../actions";
import { Section, Stat, inputCls } from "@/components/admin/ui";

// Settings (ANTE-ADMIN §4.8). Rule constants render read-only with the lock — they
// ship with the code and §13 locks them while a season is active. The rulebook
// version is a deploy, not a setting.

export const dynamic = "force-dynamic";

export default async function Settings() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;

  const [{ data: season }, { count: approvedCount }, { data: roster }] = await Promise.all([
    db.from("seasons").select("*").order("year", { ascending: false }).limit(1).maybeSingle(),
    db.from("players").select("id", { count: "exact", head: true }).eq("status", "approved"),
    db.from("players").select("id, first_name, last_name").eq("status", "approved"),
  ]);

  const providers: Array<[string, boolean]> = [
    ["Supabase", !!process.env.SUPABASE_SERVICE_ROLE_KEY],
    ["Clerk", !!process.env.CLERK_SECRET_KEY],
    ["Resend", !!process.env.RESEND_API_KEY],
    ["Twilio (deferred, D-001)", false],
  ];

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Settings</h1>

      <Section title="Season">
        <div className="flex flex-wrap items-end gap-8">
          <Stat label="Year" value={season?.year ?? "—"} />
          <Stat label="Status" value={season?.status ?? "—"} accent={season?.status === "active" ? "gold" : undefined} />
          <Stat label="Approved players" value={`${approvedCount ?? 0} / ${MIN_PLAYERS} to start`} />
          <Stat
            label="Week 1 lock"
            value={season?.week1_lock_at ? DateTime.fromISO(season.week1_lock_at).setZone(ET).toFormat("ccc LLL d, h:mma 'ET'") : "—"}
          />
          {season?.status === "preseason" && (
            <AdminForm
              action={activateSeason}
              submitLabel="Activate season"
              confirmText={`Move the 2026 season to ACTIVE? Requires ${MIN_PLAYERS}+ approved players. Once active, every rule constant locks until the offseason (§13).`}
              inline
            />
          )}
        </div>
        <p className="mt-3 text-xs text-[color:var(--color-text-low)]">
          Rulebook v1.1 — rendered from the deployed file. Changing it is a deploy, not a setting (§13).
        </p>
      </Section>

      <Section title="Rule constants — locked while the season is active (§13) 🔒">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Ante tiers" value={ANTE_TIERS.map((t) => t.ante).join(" / ")} />
          <Stat label="Limit divisor" value={LIMIT_DIVISOR} />
          <Stat label="Rounding step" value={ROUNDING_STEP} />
          <Stat label="Min games" value={MIN_GAMES} />
          <Stat label="Bet range" value={`${MIN_BET}–${MAX_BET}`} />
          <Stat label="Payout floor" value={`${(PAYOUT_FLOOR.num / PAYOUT_FLOOR.den).toFixed(2)}×`} />
          <Stat label="Payout cap" value={`${(PAYOUT_CAP.num / PAYOUT_CAP.den).toFixed(2)}×`} />
          <Stat label="Pot places" value={POT_PLACES.map((p) => p.split.length).join("/")} />
        </div>
        <p className="mt-3 text-xs text-[color:var(--color-text-low)]">
          The 2.50× cap is the one number you&apos;ll be tempted to change. Touch it once, in the offseason (§14).
        </p>
      </Section>

      <Section title="Providers">
        <ul className="space-y-1 text-sm">
          {providers.map(([name, ok]) => (
            <li key={name}>
              <span className={ok ? "text-[color:var(--color-win)]" : "text-[color:var(--color-text-low)]"}>{ok ? "●" : "○"}</span>{" "}
              {name}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Danger zone">
        <p className="mb-2 text-sm text-[color:var(--color-text-mid)]">
          Hand off the commissioner seat. Effective immediately; you become an ordinary player (§13).
        </p>
        <AdminForm
          action={handoffCommissioner}
          submitLabel="Hand off"
          danger
          confirmText="Hand off the commissioner seat? Effective immediately."
          inline
        >
          <select name="playerId" className={inputCls} aria-label="New commissioner">
            {(roster ?? [])
              .filter((p) => p.id !== ctx.playerId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
          </select>
          <input name="typedName" placeholder="type their full name exactly" required className={`${inputCls} w-56`} aria-label="Confirm name" />
        </AdminForm>
      </Section>
    </div>
  );
}
