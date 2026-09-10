import "server-only";

// The mail catalogue (D-067) — the single honest answer to "what can this app email,
// what makes it send, and does editing the template change anything?"
//
// It exists because the commissioner console's Templates list implied all eight
// notify.* strings were live copy, and most of them are not: the five DESIGNED emails
// render from structured documents in lib/notify/docs.ts and never read
// content_blocks at all. Editing "notify.reveal" there changed nothing that anybody
// ever received. Rather than delete the misleading list, the console now says which
// is which, off this table.

export type BodySource =
  /** Body is a structured document (lib/notify/docs.ts) via emailDoc. The content
   *  block of the same name is a LABEL only — editing it changes no email. */
  | "designed"
  /** Body IS the content block, filled with whitelisted vars via emailPlayer.
   *  Editing it changes what players receive on the next send. */
  | "template"
  /** Subject and body are literals at the call site. */
  | "literal";

export interface MailKind {
  /** Prefix of template_key as written to notification_log. */
  keyPrefix: string;
  label: string;
  /** What causes it to send, in plain words. */
  trigger: string;
  bodySource: BodySource;
  /** The editable content_blocks key, when the body or subject is content-managed. */
  contentKey?: string;
  subject: string;
}

// keyPrefix must match what the SEND actually writes to notification_log, which is
// not always the content key: the backup nag logs "backup-reminder-<date>", not
// "notify.backup_reminder". Verified against the distinct prefixes in production
// rather than assumed — an unmatched prefix renders as a raw key with no label.
export const MAIL_KINDS: MailKind[] = [
  { keyPrefix: "player.application_received", label: "Application received", trigger: "A player finishes onboarding", bodySource: "designed", subject: "ANTE: You're on the List" },
  { keyPrefix: "player.approved", label: "Approved — welcome", trigger: "Commissioner approves an application", bodySource: "designed", subject: "ANTE: You're In" },
  { keyPrefix: "notify.slate_open", label: "Week opens", trigger: "slate.open job, Tuesday morning", bodySource: "designed", subject: "ANTE: Week {n} Is Open" },
  { keyPrefix: "player.ticket", label: "Ticket locked", trigger: "A player submits a ticket", bodySource: "designed", subject: "ANTE: Your Week {n} Ticket" },
  { keyPrefix: "notify.reminder", label: "Reminder — not yet in", trigger: "notify.reminders job, Wed 6pm ET, unsubmitted only", bodySource: "template", contentKey: "notify.reminder", subject: "ANTE: The Room Can See Your Name for Week {n}" },
  { keyPrefix: "notify.final_call", label: "Final call — not yet in", trigger: "notify.reminders job, Thu 9am ET, unsubmitted only", bodySource: "template", contentKey: "notify.final_call", subject: "ANTE: Final Call for Week {n}" },
  { keyPrefix: "player.nudge", label: "Manual nudge", trigger: "Commissioner presses Nudge on the roster", bodySource: "literal", subject: "ANTE: The Room Is Waiting on You" },
  { keyPrefix: "player.folded", label: "Auto-folded", trigger: "Deadline passes with no ticket", bodySource: "designed", subject: "ANTE: You Were Folded for Week {n}" },
  { keyPrefix: "notify.reveal", label: "The board is open", trigger: "The reveal fires — last ticket in, or Thursday noon", bodySource: "designed", subject: "ANTE: The Week {n} Board Is Open" },
  { keyPrefix: "notify.mention", label: "Mentioned in Table Talk", trigger: "Another player @mentions them", bodySource: "template", contentKey: "notify.mention", subject: "ANTE: {author} Mentioned You at the Table" },
  { keyPrefix: "notify.support_new", label: "Support — new message", trigger: "A player writes to the commissioner", bodySource: "template", contentKey: "notify.support_new", subject: "ANTE: New Message From {player}" },
  { keyPrefix: "notify.support_reply", label: "Support — reply", trigger: "Commissioner answers a support message", bodySource: "template", contentKey: "notify.support_reply", subject: "ANTE: The Commissioner Answered" },
  { keyPrefix: "backup-reminder", label: "Backup due (commissioner only)", trigger: "backup.reminder job, daily, until the file is confirmed", bodySource: "template", contentKey: "notify.backup_reminder", subject: "ANTE: Your League Backup Is Due" },
];

/** Content keys the console lists as editable templates but which reach NO email —
 *  the body is a designed document. Kept visible, labelled, rather than deleted. */
export const DEAD_TEMPLATE_KEYS = new Set(["notify.slate_open", "notify.reveal", "notify.settled", "notify.pot", "notify.correction", "notify.nudge"]);

export interface ScheduledJob {
  /** job_runs.job_key — how the run history is matched. */
  jobKey: string;
  /** cron.schedule name, from the migration that declares it. */
  cronName: string;
  expr: string;
  whenET: string;
  what: string;
  /** Does a normal run of this job send email to players? */
  sends: boolean;
}

/** Mirrors the pg_cron entries declared in migrations 0006, 0010, 0011 and 0017.
 *  Kept as a declaration rather than read from cron.job because PostgREST cannot see
 *  the cron schema — so treat a disagreement between this list and a migration as a
 *  bug in this list. Last-run times on the page come from job_runs, which is live. */
export const SCHEDULED_JOBS: ScheduledJob[] = [
  { jobKey: "slate.open", cronName: "ante-slate-open", expr: "0 10,11 * * 2", whenET: "Tuesday 6:00am", what: "Opens the week, posts antes, mails the board", sends: true },
  { jobKey: "notify.reminders", cronName: "ante-reminders", expr: "0 13,14,22,23 * * 3,4", whenET: "Wed 6:00pm and Thu 9:00am", what: "Reminder and final call — unsubmitted players only", sends: true },
  { jobKey: "reveal.deadline", cronName: "ante-reveal-deadline", expr: "0,5 16,17 * * 4", whenET: "Thursday 12:00pm and 12:05pm", what: "Auto-folds, reveals, mails the open board", sends: true },
  { jobKey: "reveal.check", cronName: "ante-reveal-check", expr: "*/2 * * * 2-4", whenET: "Every 2 min, Tue–Thu", what: "Reveals early once the last ticket is in", sends: true },
  { jobKey: "backup.reminder", cronName: "ante-backup-reminder", expr: "0 13 * * *", whenET: "Daily 9:00am", what: "Nags the commissioner for a backup — nobody else", sends: true },
  { jobKey: "scores.sync", cronName: "ante-scores-sync", expr: "*/5 * * * *", whenET: "Every 5 min", what: "Pulls scores; settles when the week is final", sends: false },
  { jobKey: "feeds.sync", cronName: "ante-feeds-sync", expr: "*/15 * * * *", whenET: "Every 15 min", what: "Pulls news for the ticker", sends: false },
  { jobKey: "schedule.refetch", cronName: "ante-schedule-refetch", expr: "30 8 * * *", whenET: "Daily 4:30am", what: "Re-reads the NFL schedule", sends: false },
];
