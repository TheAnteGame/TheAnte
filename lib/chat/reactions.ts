// Reactions on Table Talk messages (D-123). Five, one per player per message:
// picking another swaps it, picking yours again takes it off. Stored by kind, not by
// the emoji itself, so the database's allowed-value list stays plain text.

export const REACTIONS = [
  { kind: "like", emoji: "👍" },
  { kind: "love", emoji: "❤️" },
  { kind: "laugh", emoji: "😂" },
  { kind: "fire", emoji: "🔥" },
  { kind: "dislike", emoji: "👎" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];

export const isReactionKind = (k: unknown): k is ReactionKind => REACTIONS.some((r) => r.kind === k);

/** The author hears about it once, when this many OTHER players have reacted. */
export const NOTIFY_AT = 3;

export interface ReactionChip {
  kind: ReactionKind;
  emoji: string;
  count: number;
  /** Display names, for "who reacted". */
  names: string[];
}

export interface MessageReactions {
  chips: ReactionChip[];
  mine: ReactionKind | null;
}

/** One message's reactions, in the fixed order of REACTIONS, empty kinds left out. */
export function summarize(
  rows: Array<{ player_id: string; kind: string }>,
  me: string,
  nameOf: (playerId: string) => string,
): MessageReactions {
  const chips: ReactionChip[] = [];
  for (const r of REACTIONS) {
    const who = rows.filter((x) => x.kind === r.kind);
    if (who.length > 0) chips.push({ kind: r.kind, emoji: r.emoji, count: who.length, names: who.map((x) => nameOf(x.player_id)) });
  }
  const mine = rows.find((x) => x.player_id === me)?.kind;
  return { chips, mine: isReactionKind(mine) ? mine : null };
}

/** The same summary after this player picks `kind` (null = take theirs off), for the
 *  instant on-screen answer while the server catches up. */
export function applyPick(current: MessageReactions, kind: ReactionKind | null, myName: string): MessageReactions {
  const without = (names: string[]) => {
    const i = names.indexOf(myName);
    return i < 0 ? names : [...names.slice(0, i), ...names.slice(i + 1)];
  };
  let chips = current.chips
    .map((c) => (c.kind === current.mine ? { ...c, count: c.count - 1, names: without(c.names) } : c))
    .filter((c) => c.count > 0);
  if (kind) {
    if (chips.some((c) => c.kind === kind)) {
      chips = chips.map((c) => (c.kind === kind ? { ...c, count: c.count + 1, names: [...c.names, myName] } : c));
    } else {
      const r = REACTIONS.find((x) => x.kind === kind)!;
      chips.push({ kind, emoji: r.emoji, count: 1, names: [myName] });
      chips.sort((a, b) => REACTIONS.findIndex((x) => x.kind === a.kind) - REACTIONS.findIndex((x) => x.kind === b.kind));
    }
  }
  return { chips, mine: kind };
}

/** The author's line in the email and push: "😂 2 · 🔥 1". */
export function reactionLine(rows: Array<{ kind: string }>): string {
  return REACTIONS.map((r) => ({ r, n: rows.filter((x) => x.kind === r.kind).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.r.emoji} ${x.n}`)
    .join(" · ");
}
