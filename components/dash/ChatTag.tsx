import type { ReactNode } from "react";

// Table Talk name tags (D-066). Small cut labels beside a name in the chat — who is
// the commissioner, who is out in front — so the room reads as a room with roles in
// it rather than a flat log.
//
// Deliberately the SAME treatment the felt badge already uses in the leaderboard
// (1px border, 9px uppercase, wide tracking, no fill): the app should have one badge
// idiom, not two. Chamfered, never a pill — art §5 and the §494 "reject" list are
// explicit that pills and heavy radii are not this product's language.
//
// Tones carry their own token pair so light mode is not an afterthought (the D-063
// lesson): gold on a light panel is 2.3:1, which is why each tone darkens there
// rather than inheriting the dark-mode hue.

export type TagTone = "house" | "leader";

const TONE: Record<TagTone, string> = {
  // Gold is reserved for the house — hairlines, system messages, commissioner
  // corrections, the Pot, the felt badge (art §167). The commissioner belongs to it.
  house: "border-[color:var(--color-tag-house-bd)] text-[color:var(--color-tag-house-fg)]",
  // Win-green, the existing "up" half of the muted data pair.
  leader: "border-[color:var(--color-tag-leader-bd)] text-[color:var(--color-tag-leader-fg)]",
};

export function ChatTag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return (
    <span
      className={`chamfer-xs mr-1.5 inline-block border px-1 align-[0.09em] text-[9px] font-semibold uppercase leading-[1.5] tracking-[0.12em] ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
