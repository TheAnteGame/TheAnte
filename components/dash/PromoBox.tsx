import Image from "next/image";
import { getContent } from "@/lib/content/getContent";

// The one genuinely authored surface (ADMIN §4.6). Content-managed; collapses to
// the fallback heading when nothing is published.

export async function PromoBox() {
  const [heading, body, ctaLabel, ctaUrl, imageUrl, fallback] = await Promise.all([
    getContent("promo.heading"),
    getContent("promo.body"),
    getContent("promo.cta_label"),
    getContent("promo.cta_url"),
    getContent("promo.image_url"),
    getContent("dash.promo.fallback_heading"),
  ]);

  const active = heading.trim().length > 0;

  return (
    <section aria-label={active ? heading : fallback} className="chamfer border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)]">
      {active ? (
        <div className="flex flex-col gap-2 p-4">
          {imageUrl.trim() && (
            <Image src={imageUrl} alt="" width={640} height={240} className="max-h-40 w-full object-cover" />
          )}
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold uppercase text-[color:var(--color-chrome)]">
            {heading}
          </h2>
          {body.trim() && <p className="text-sm text-[color:var(--color-text-mid)]">{body}</p>}
          {ctaLabel.trim() && ctaUrl.trim() && (
            <a
              href={ctaUrl}
              className="chamfer mt-1 inline-block self-start bg-[color:var(--color-chrome)] px-4 py-2 text-sm font-semibold uppercase text-[color:var(--color-canvas)]"
            >
              {ctaLabel}
            </a>
          )}
        </div>
      ) : (
        <p className="p-4 text-center font-[family-name:var(--font-display)] font-bold uppercase tracking-widest text-[color:var(--color-text-low)]">
          {fallback}
        </p>
      )}
    </section>
  );
}
