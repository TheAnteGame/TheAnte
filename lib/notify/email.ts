import "server-only";
import { Resend } from "resend";
import type { NotifyResult } from "./index";

// Resend carries every league notification season one (DECISIONS.md D-001) plus the
// surfaces it was always specced for: weekly recap, receipts, support (ANTE-TECH §3.3).
// Template rendering + notification_log writes land in Phase 11; this is the transport.

export async function sendEmail(
  templateKey: string,
  to: string,
  vars: Record<string, string | number>,
): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { status: "failed", error: "RESEND_API_KEY / RESEND_FROM_EMAIL not set" };

  const resend = new Resend(apiKey);
  const subject = String(vars.subject ?? `ANTE: ${templateKey}`);
  const body = String(vars.body ?? "");
  // html is optional. When a caller supplies it, BOTH parts go out in one message and
  // the client picks: rich clients render the HTML, plain-text clients fall back to
  // the text part rather than to nothing (D-056). Callers that never learned about
  // HTML keep working unchanged, text-only.
  const html = typeof vars.html === "string" && vars.html.length > 0 ? vars.html : undefined;
  try {
    const { data, error } = await resend.emails.send(
      html ? { from, to, subject, text: body, html } : { from, to, subject, text: body },
    );
    if (error) return { status: "failed", error: error.message };
    return { status: "sent", providerMessageId: data?.id };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
