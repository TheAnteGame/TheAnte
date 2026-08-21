// @mentions in Table Talk (D-019).
//
// Handles are derived, never stored: a player's first name if that is unique in the
// league, otherwise first name plus last initial. The same function builds them for
// the composer's picker, for highlighting a posted message, and for deciding who gets
// emailed — one source, so what you clicked, what you see, and who is told can never
// disagree.
//
// Names are public (rulebook §11 — the blackout covers picks, not people), so nothing
// here can leak a pick.

export interface Mentionable {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export interface Handle {
  id: string;
  /** The text after "@", without the "@". Letters and digits only. */
  handle: string;
  /** How the player is shown elsewhere in the app, e.g. "Robert T." */
  display: string;
}

const clean = (s: string | null) => (s ?? "").replace(/[^A-Za-z0-9]/g, "");

/** One handle per player, disambiguated only where a first name repeats. */
export function buildHandles(roster: Mentionable[]): Handle[] {
  const firstCounts = new Map<string, number>();
  for (const p of roster) {
    const first = clean(p.firstName).toLowerCase();
    if (first) firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
  }

  const used = new Set<string>();
  const out: Handle[] = [];
  for (const p of roster) {
    const first = clean(p.firstName);
    if (!first) continue;
    const lastInitial = clean(p.lastName).slice(0, 1);
    let handle = (firstCounts.get(first.toLowerCase()) ?? 0) > 1 ? `${first}${lastInitial}` : first;
    // A collision even after the initial (two Robert T's) falls back to a numbered suffix,
    // so every player always has exactly one handle that resolves to them alone.
    let n = 2;
    while (used.has(handle.toLowerCase())) handle = `${first}${lastInitial}${n++}`;
    used.add(handle.toLowerCase());
    out.push({
      id: p.id,
      handle,
      display: `${p.firstName ?? ""} ${lastInitial ? `${lastInitial}.` : ""}`.trim(),
    });
  }
  return out.sort((a, b) => a.handle.localeCompare(b.handle));
}

/** Matches "@name". Longest handles are tested first so "@RobertT" wins over "@Robert". */
export const MENTION_PATTERN = /@([A-Za-z0-9]{1,40})/g;

/** Player ids mentioned in a body, de-duplicated, in the order they appear. */
export function findMentioned(body: string, handles: Handle[]): string[] {
  const byHandle = new Map(handles.map((h) => [h.handle.toLowerCase(), h.id]));
  const sorted = [...handles].sort((a, b) => b.handle.length - a.handle.length);
  const found: string[] = [];

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const token = match[1].toLowerCase();
    // Exact handle first; otherwise the longest handle this token starts with, which
    // lets "@Robert," and "@Roberts thing" resolve without needing punctuation rules.
    let id = byHandle.get(token);
    if (!id) {
      const prefix = sorted.find((h) => token.startsWith(h.handle.toLowerCase()));
      id = prefix?.id;
    }
    if (id && !found.includes(id)) found.push(id);
  }
  return found;
}

/** Splits a body into plain text and resolved mentions, for rendering. */
export function segmentBody(body: string, handles: Handle[]): Array<{ text: string; mention: boolean }> {
  const known = new Set(handles.map((h) => h.handle.toLowerCase()));
  const out: Array<{ text: string; mention: boolean }> = [];
  let last = 0;
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const token = match[1];
    const start = match.index ?? 0;
    // Only highlight a token that is exactly somebody's handle — an email address or a
    // stray "@" should read as ordinary text.
    if (!known.has(token.toLowerCase())) continue;
    if (start > last) out.push({ text: body.slice(last, start), mention: false });
    out.push({ text: `@${token}`, mention: true });
    last = start + match[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), mention: false });
  return out;
}

/** A mail storm is not engagement. */
export const MAX_MENTIONS_PER_MESSAGE = 5;
