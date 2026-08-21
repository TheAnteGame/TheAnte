import { getContent } from "@/lib/content/getContent";
import { SupportDialog, type SupportCopy } from "./SupportDialog";

// "Support box provides email" — the sketch's own note. It used to hand the player a
// mailto: link; the domain has no inbox, so those messages went nowhere. The desk is
// now in-app and the commissioner answers from the console (D-012).

export async function SupportBox() {
  const [heading, body, cta, title, intro, placeholder, submitCta, cancelCta, sentTitle, sentBody, closeCta, errorGeneric] =
    await Promise.all([
      getContent("dash.support.heading"),
      getContent("dash.support.body"),
      getContent("dash.support.cta"),
      getContent("dash.support.dialog_title"),
      getContent("dash.support.dialog_intro"),
      getContent("dash.support.placeholder"),
      getContent("dash.support.submit_cta"),
      getContent("dash.support.cancel_cta"),
      getContent("dash.support.sent_title"),
      getContent("dash.support.sent_body"),
      getContent("dash.support.close_cta"),
      getContent("profile.error_generic"),
    ]);

  const copy: SupportCopy = {
    cta,
    title,
    intro,
    placeholder,
    submitCta,
    cancelCta,
    sentTitle,
    sentBody,
    closeCta,
    errorGeneric,
  };

  return (
    <section aria-label={heading} className="panel p-4">
      <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase text-[color:var(--color-chrome)]">
        {heading}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--color-text-mid)]">{body}</p>
      <SupportDialog copy={copy} />
    </section>
  );
}
