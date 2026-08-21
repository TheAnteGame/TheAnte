import { getContent } from "@/lib/content/getContent";

// The one genuinely authored surface (ADMIN §4.6): the commissioner's announcement
// slot — heading, optional image and body, optional call to action.
//
// The image is a plain <img>, deliberately, not next/image. The URL is whatever the
// commissioner pastes, and next/image refuses any hostname that is not allowlisted in
// next.config.ts — which threw a RUNTIME ERROR that took the whole dashboard down for
// every player over one bad promo URL (D-018). Allowlisting `**` would fix the crash
// but turn the deployment into an open image proxy for anyone who can call
// /_next/image. One banner, capped at 160px tall, is not worth either.

/** Only ever render a URL we can parse and that speaks http(s). */
function safeImageUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function PromoBox() {
  const [heading, body, ctaLabel, ctaUrl, imageUrl] = await Promise.all([
    getContent("promo.heading"),
    getContent("promo.body"),
    getContent("promo.cta_label"),
    getContent("promo.cta_url"),
    getContent("promo.image_url"),
  ]);

  if (!heading.trim()) return null;

  const image = safeImageUrl(imageUrl);
  const cta = safeImageUrl(ctaUrl);

  return (
    <section aria-label={heading} className="panel chamfer">
      <div className="flex flex-col gap-2 p-4">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary commissioner-supplied host; see note above
          <img
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="max-h-40 w-full bg-[color:var(--color-surface-2)] object-cover"
          />
        )}
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold uppercase text-[color:var(--color-chrome)]">
          {heading}
        </h2>
        {body.trim() && <p className="text-sm text-[color:var(--color-text-mid)]">{body}</p>}
        {ctaLabel.trim() && cta && (
          <a
            href={cta}
            target="_blank"
            rel="noreferrer"
            className="chamfer chrome-face mt-1 inline-block self-start px-4 py-2 text-sm font-semibold uppercase"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </section>
  );
}
