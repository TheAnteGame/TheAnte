// Unread count for the Table Talk dock (D-086), pure. A message is unread when it
// landed after the player last had the room open and somebody else wrote it. Never
// having opened the dock counts everything — a new player should see the room is
// alive. The caller passes whatever page of messages it already loaded, so the count
// is capped by that page; `cap` says so in the badge ("50+").

export type ChatPosition = "corner" | "bar" | "side";

export function countUnread(
  messages: Array<{ player_id: string | null; created_at: string; hidden_at?: string | null }>,
  readAt: string | null,
  meId: string,
): number {
  const since = readAt ? new Date(readAt).getTime() : 0;
  return messages.filter((m) => m.player_id !== meId && !m.hidden_at && new Date(m.created_at).getTime() > since).length;
}

export function unreadBadge(count: number, cap: number): string | null {
  if (count <= 0) return null;
  return count >= cap ? `${cap}+` : String(count);
}
