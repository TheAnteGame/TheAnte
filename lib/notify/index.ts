import "server-only";
import { sendEmail } from "./email";
import { sendSms } from "./sms";

// One interface, swappable providers (ANTE-TECH §3.3). Every send — attempted,
// delivered, or disabled — writes notification_log with provider id and status.
//
// One rule that overrides everything here: no notification body may contain
// pre-reveal pick data. Not a count, not a hint. Templates are commissioner-editable,
// so the send path itself must refuse a body that violates the blackout, not trust
// the template author (ANTE-TECH §3.3, §7). Enforcement lands with the template
// renderer in Phase 11.

export type NotifyChannel = "sms" | "email";

export interface NotifyResult {
  status: "sent" | "queued" | "channel_disabled" | "opted_out" | "failed";
  providerMessageId?: string;
  error?: string;
}

export interface Notifier {
  send(channel: NotifyChannel, templateKey: string, to: string, vars: Record<string, string | number>): Promise<NotifyResult>;
}

export async function send(
  channel: NotifyChannel,
  templateKey: string,
  to: string,
  vars: Record<string, string | number>,
): Promise<NotifyResult> {
  return channel === "email" ? sendEmail(templateKey, to, vars) : sendSms(templateKey, to, vars);
}
