import { saveProfile } from "@/app/actions/player";

interface Team {
  code: string;
  city: string;
  name: string;
}

interface Copy {
  firstNameLabel: string;
  lastNameLabel: string;
  emailLabel: string;
  favoriteTeamLabel: string;
  submitLabel: string;
  errorGeneric: string;
}

interface Prefill {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  favoriteTeam?: string | null;
}

const fieldClass =
  "chamfer w-full bg-[color:var(--color-surface-2)] px-4 py-3 text-[color:var(--color-text-hi)] outline-none " +
  "placeholder:text-[color:var(--color-text-low)] focus:outline focus:outline-2 focus:outline-[color:var(--color-chrome)]";

/** Profile capture (ANTE-PLAYER §3.2): four fields and a continue button. Favorite
 *  team is a select over the seeded 32-team table, never free text — it drives the
 *  Fav Team News box. Plain form + server action; no client state needed. */
export function ProfileForm({ teams, copy, prefill, showError }: { teams: Team[]; copy: Copy; prefill?: Prefill; showError?: boolean }) {
  return (
    <form action={saveProfile} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-left">
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-mid)]">{copy.firstNameLabel}</span>
        <input name="firstName" required maxLength={50} defaultValue={prefill?.firstName ?? ""} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-left">
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-mid)]">{copy.lastNameLabel}</span>
        <input name="lastName" required maxLength={50} defaultValue={prefill?.lastName ?? ""} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-left">
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-mid)]">{copy.emailLabel}</span>
        <input name="email" type="email" required maxLength={200} defaultValue={prefill?.email ?? ""} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-left">
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-mid)]">{copy.favoriteTeamLabel}</span>
        <div className="relative">
          <select
            name="favoriteTeam"
            required
            defaultValue={prefill?.favoriteTeam ?? ""}
            className={`${fieldClass} appearance-none pr-10`}
          >
            <option value="" disabled>
              —
            </option>
            {teams.map((t) => (
              <option key={t.code} value={t.code}>
                {t.city} {t.name}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--color-text-low)]">
            ▾
          </span>
        </div>
      </label>
      {showError && (
        <p role="alert" className="text-sm text-[color:var(--color-loss)]">
          — {copy.errorGeneric}
        </p>
      )}
      <button
        type="submit"
        className="chamfer mt-2 bg-[color:var(--color-chrome)] px-6 py-3 font-[family-name:var(--font-display)] font-semibold uppercase tracking-wide text-[color:var(--color-canvas)]"
      >
        {copy.submitLabel}
      </button>
    </form>
  );
}
