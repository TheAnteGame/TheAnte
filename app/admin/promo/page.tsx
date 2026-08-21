import { getCommissioner } from "@/lib/admin";
import { contentDefaults } from "@/lib/content/defaults";
import { AdminForm } from "@/components/admin/AdminForm";
import { saveContent } from "../actions";
import { Section, inputCls } from "@/components/admin/ui";
import { PromoBox } from "@/components/dash/PromoBox";

// The promo box (ANTE-ADMIN §4.6) — the one genuinely authored surface. Clearing
// the heading collapses the box to its fallback on the dashboard.

export const dynamic = "force-dynamic";

const FIELDS: Array<[string, string]> = [
  ["promo.heading", "Heading (empty = box collapses to fallback)"],
  ["promo.body", "Body"],
  ["promo.image_url", "Image URL (optional)"],
  ["promo.cta_label", "CTA label"],
  ["promo.cta_url", "CTA URL"],
];

export default async function Promo() {
  const ctx = (await getCommissioner())!;
  const { data: overrides } = await ctx.db.from("content_blocks").select("key, value").like("key", "promo.%");
  const overrideMap = new Map((overrides ?? []).map((r) => [r.key, r.value]));

  const heading = (overrideMap.get("promo.heading") ?? contentDefaults["promo.heading"] ?? "").trim();
  const imageUrl = (overrideMap.get("promo.image_url") ?? contentDefaults["promo.image_url"] ?? "").trim();
  const imageOk = (() => {
    if (!imageUrl) return true;
    try {
      const u = new URL(imageUrl);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  })();

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Promo</h1>
      <Section title="The hero box">
        <div className="flex flex-col gap-4">
          {FIELDS.map(([key, label]) => (
            <div key={key}>
              <p className="mb-1 text-xs text-[color:var(--color-text-low)]">{label}</p>
              <AdminForm action={saveContent} submitLabel="Save" inline>
                <input type="hidden" name="key" value={key} />
                <input name="value" defaultValue={overrideMap.get(key) ?? contentDefaults[key] ?? ""} className={`${inputCls} w-full max-w-xl`} aria-label={label} />
              </AdminForm>
            </div>
          ))}
        </div>
      </Section>

      {/* The real component, not a mock — what players get, before they get it. */}
      <Section title="What players will see">
        {imageUrl && !imageOk && (
          <p className="mb-3 text-xs text-[color:var(--color-loss)]">
            That image URL is not a usable web address, so the image will be skipped. It needs to start with https://
          </p>
        )}
        {!heading && (
          <p className="mb-3 text-xs text-[color:var(--color-text-low)]">
            No heading set, so the box does not appear on the dashboard at all.
          </p>
        )}
        <div className="max-w-sm">
          <PromoBox />
        </div>
      </Section>
    </div>
  );
}
