import "server-only";
import type { NotifyResult } from "./index";

// ── SMS is DEFERRED for season one — DECISIONS.md D-001 ─────────────────────────
// A2P 10DLC registration could not clear before the season. This stub keeps the
// channel's shape so enabling SMS later is a flip, not a rebuild:
//   1. Register the A2P 10DLC brand + campaign in Twilio
//   2. Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_MESSAGING_SERVICE_SID
//   3. Replace this stub with the Twilio Programmable Messaging call
//   4. Flip the per-event channel toggles in /admin/notifications
// Quiet hours (22:00–08:00 ET, queue never drop), sms_opt_in, and the STOP webhook
// are specced in ANTE-ADMIN §4.7 and must be honored by the real implementation.

export async function sendSms(
  templateKey: string,
  _to: string,
  _vars: Record<string, string | number>,
): Promise<NotifyResult> {
  console.warn(`[notify] SMS channel disabled (D-001); dropped template=${templateKey}`);
  return { status: "channel_disabled" };
}
