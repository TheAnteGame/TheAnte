import "server-only";
import type { EmailDoc } from "./render";

// The five league emails, each described once as blocks and rendered to HTML and
// plain text by lib/notify/render.ts (D-056). Everything a player is told about the
// game lives here, in one file, so the voice stays consistent and the plain-text
// fallback can never say something different from the HTML.

const SITE = "https://theantegame.com";

const WHY = {
  kind: "signoff" as const,
  name: "Robert Toler",
  role: "Commissioner",
  paras: [
    "Three reasons, honestly. I wanted to learn to actually build software in an age where AI has changed what one person can make on their own, and Ante is what that turned into. I'm also always looking for new ways to earn as I get older, and this is one of those swings.",
    "But the real reason is the third one: I wanted something to play with my friends that isn't the same survivor pool everyone is already bored of. This is a beta season, so it will have rough edges. Tell me about them. There's a chat room on the dashboard and I read every word of it.",
  ],
};

const HOW_IT_WORKS = [
  "Every week you back at least five games, stacking more chips on the teams you feel strongest about.",
  "Nobody sees a single pick until everyone is locked in, and then the whole board opens at once.",
  "Your payout is set by the room and not by the bookmaker: the fewer players on your side, the more a win pays.",
  "Every week costs an ante, every ante goes into the Pot, and whoever <em style=\"color:#f2f2f4;font-style:normal;font-weight:700;\">gains</em> the most chips that week takes it.",
  "Biggest stack after Week 18 is champion, and you can never be knocked out, because your last chip is protected.",
];

/** 1. Application received. Sent when the profile is complete and they are pending. */
export function applicationReceived(v: { firstName: string }): EmailDoc {
  return {
    preheader: "You're on the list. I approve every player by hand, usually within the hour.",
    eyebrow: "Application received",
    headline: "You're on the list",
    blocks: [
      { kind: "lead", text: `${v.firstName}, got it. Your seat is requested and sitting with me.` },
      {
        kind: "note",
        title: "Why there's a wait at all",
        text: "This is a beta season. I'm running it small and by invitation to find out whether the game actually holds up over eighteen weeks before it goes anywhere near the public, which means I approve every player by hand. It is usually within the hour, and always the same day.",
      },
      { kind: "para", text: "You'll get a second email the moment you're in, with everything you need to play. Nothing is required from you until then." },
      {
        kind: "note",
        title: "There is still room",
        text: "The table seats twenty and it isn't full. If you know someone who would enjoy this more than another survivor pool, send them to theantegame.com. The roster locks at the Week 1 deadline and that's the end of it.",
      },
      { kind: "cta", label: "See the rulebook", href: `${SITE}/rules`, sub: "The complete rules are public, and worth a skim while you wait." },
      WHY,
    ],
  };
}

/** 2. Approved. The welcome. */
export function approved(v: { firstName: string; phone: string | null }): EmailDoc {
  return {
    preheader: "Your seat is confirmed. 500 chips, same as everyone. Here is how it works.",
    eyebrow: "Welcome to the league",
    headline: "You're in",
    blocks: [
      {
        kind: "lead",
        text: `${v.firstName}, your seat is confirmed and <strong style="color:#f2f2f4;">500 chips</strong> are on the table in front of you, the same 500 everyone else starts with. No money changes hands, ever. The chips are the whole game.`,
      },
      { kind: "para", text: "Here is the entire thing, in five sentences." },
      { kind: "steps", items: HOW_IT_WORKS },
      {
        kind: "cta",
        label: "Take your seat",
        href: SITE,
        sub: v.phone
          ? `Sign in with ${v.phone}, the same number you signed up with. The full rulebook is always in the top-right of the site.`
          : "Sign in with the same phone number you signed up with. The full rulebook is always in the top-right of the site.",
      },
      WHY,
    ],
  };
}

/** 3. Ticket confirmation, and its twin: the auto-fold notice. One email, two outcomes. */
export function ticket(v: {
  firstName: string;
  week: number;
  folded: boolean;
  bets: Array<{ team: string; matchup: string; chips: number }>;
  total: number;
  isShove: boolean;
  deadline: string;
}): EmailDoc {
  if (v.folded) {
    return {
      preheader: `You were folded for Week ${v.week}. The ante still came out.`,
      eyebrow: `Week ${v.week}`,
      headline: "You folded",
      blocks: [
        { kind: "lead", text: `${v.firstName}, the Week ${v.week} deadline passed without a ticket from you, so you were folded automatically.` },
        {
          kind: "note",
          title: "What that means",
          text: "You still paid this week's ante, and a fold can never win the Pot. Nothing else happens: you keep your chips, you keep your place in the standings, and you're dealt into next week like everyone else.",
        },
        { kind: "para", text: "Miss three weeks running with no ticket at all and I'm allowed to remove the seat and split the chips across everyone still playing. Submitting anything, even a deliberate fold, resets that count to zero." },
        { kind: "cta", label: "Get in next week", href: SITE, sub: "The new slate opens Tuesday at 6:00am ET." },
      ],
    };
  }
  return {
    preheader: `Ticket locked for Week ${v.week}: ${v.total} chips across ${v.bets.length} games.`,
    eyebrow: `Week ${v.week}: ticket locked`,
    headline: "That's your ticket",
    blocks: [
      {
        kind: "lead",
        text: `${v.firstName}, your Week ${v.week} ticket is in and locked. Keep this email: it is your own record of exactly what you submitted${v.isShove ? ", and this one was a shove" : ""}.`,
      },
      {
        kind: "table",
        caption: "What you backed",
        head: ["Team", "Game", "Chips"],
        rows: v.bets.map((b) => [`<strong style="color:#f2f2f4;">${b.team}</strong>`, b.matchup, String(b.chips)]),
      },
      { kind: "stats", items: [{ label: "Games", value: String(v.bets.length) }, { label: "Chips committed", value: String(v.total) }] },
      {
        kind: "note",
        title: "It cannot be changed",
        text: `Not by you, not by me, not for injuries or weather or regret. The reveal fires the moment the last player submits, or at ${v.deadline}, whichever comes first, and then everybody sees everything at once.`,
      },
      { kind: "cta", label: "Back to the board", href: `${SITE}/dashboard`, sub: "If anything above is wrong, tell me at the table before the reveal." },
    ],
  };
}

/** 4. The reveal. Per-game splits, no chip counts: the numbers are on the site. */
export function reveal(v: {
  firstName: string;
  week: number;
  games: Array<{ matchup: string; away: string; home: string; awayBackers: string; homeBackers: string }>;
  folded: string;
}): EmailDoc {
  return {
    preheader: `Week ${v.week} is open. Every ticket in the league is live.`,
    eyebrow: `Week ${v.week}: the reveal`,
    headline: "The board is open",
    blocks: [
      { kind: "lead", text: `${v.firstName}, everyone is locked in, so every Week ${v.week} ticket just opened at once. Here is who went where.` },
      {
        kind: "table",
        caption: "Who took what",
        head: ["Game", "Side", "Backed by"],
        rows: v.games.flatMap((g) => [
          [`<strong style="color:#f2f2f4;">${g.matchup}</strong>`, g.away, g.awayBackers || "Nobody"],
          ["", g.home, g.homeBackers || "Nobody"],
        ]),
      },
      ...(v.folded ? [{ kind: "note" as const, title: "Folded this week", text: v.folded }] : []),
      {
        kind: "cta",
        label: "See the full board",
        href: `${SITE}/dashboard`,
        sub: "This is only who went where. The chip weights, the multipliers each side is getting, and what every ticket stands to win are all on the board, and that is the part worth arguing about.",
      },
    ],
  };
}

/** 5. Tuesday morning: last week settled, and the new week is open. */
export function weekOpen(v: {
  firstName: string;
  week: number;
  ante: number;
  limit: number;
  deadline: string;
  prevWeek: number | null;
  delta: string;
  stack: number;
  rank: string;
  potWinner: string;
  potAmount: number;
  leaders: Array<{ rank: string; name: string; stack: string; delta: string }>;
}): EmailDoc {
  const blocks: EmailDoc["blocks"] = [];
  if (v.prevWeek !== null) {
    blocks.push({ kind: "lead", text: `${v.firstName}, Week ${v.prevWeek} is settled and Week ${v.week} is open. Here is where things stand.` });
    blocks.push({ kind: "stats", items: [{ label: `Week ${v.prevWeek}`, value: v.delta }, { label: "Your stack", value: String(v.stack) }, { label: "Rank", value: v.rank }] });
    if (v.potWinner) {
      blocks.push({
        kind: "note",
        title: `Week ${v.prevWeek} Pot`,
        text: `<strong style="color:#f2f2f4;">${v.potWinner}</strong> gained the most chips and takes <strong style="color:#c9a24b;">+${v.potAmount}</strong>. The Pot goes to the biggest weekly gain, not the biggest stack, which is why nobody is ever out of it.`,
      });
    }
    blocks.push({ kind: "table", caption: "The table", head: ["#", "Player", "Stack", "Week"], rows: v.leaders.map((l) => [l.rank, l.name, l.stack, l.delta]) });
  } else {
    blocks.push({ kind: "lead", text: `${v.firstName}, Week ${v.week} is open and the board is live.` });
  }
  blocks.push({ kind: "rule" });
  blocks.push({ kind: "stats", items: [{ label: `Week ${v.week} ante`, value: String(v.ante) }, { label: "Your limit", value: String(v.limit) }] });
  blocks.push({
    kind: "note",
    title: "The wall",
    text: `Your ticket has to be in by <strong style="color:#f2f2f4;">${v.deadline}</strong>. Miss it and you're folded automatically. You still pay the ante, and a fold can never win the Pot.`,
  });
  blocks.push({ kind: "cta", label: "Place your bets", href: `${SITE}/dashboard`, sub: "At least five games, and the board tells you your limit as you go." });
  return {
    preheader: `Week ${v.week} is open. Ante ${v.ante}, your limit is ${v.limit}, deadline ${v.deadline}.`,
    eyebrow: v.prevWeek !== null ? `Week ${v.prevWeek} settled` : "The season begins",
    headline: `Week ${v.week} is open`,
    blocks,
  };
}
