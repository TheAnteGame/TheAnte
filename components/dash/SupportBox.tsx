import { getContent } from "@/lib/content/getContent";

// "Support box provides email" — the sketch's own note. Sending goes through the
// player's mail client (ANTE-PLAYER §7).

export async function SupportBox() {
  const [heading, body, email] = await Promise.all([
    getContent("dash.support.heading"),
    getContent("dash.support.body"),
    getContent("dash.support.email"),
  ]);

  return (
    <section aria-label={heading} className="border border-[color:var(--color-border)] p-4">
      <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase text-[color:var(--color-chrome)]">
        {heading}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--color-text-mid)]">{body}</p>
      <a href={`mailto:${email}`} className="mt-2 inline-block text-sm text-[color:var(--color-gold)] underline-offset-4 hover:underline">
        {email}
      </a>
    </section>
  );
}
