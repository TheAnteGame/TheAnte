# ANTE — Art Direction

**Version 0.4 — directional brief, not a spec**
Sources: `Ante_Logo_Colored_Black.png`, `ANTE-RULEBOOK.md` (v1.1), `ANTE-PLAYER.md`, `ANTE-ADMIN.md`

This document sets direction and guardrails. It deliberately stops short of component specs,
exact type scales, and motion timings — those are design and build decisions.

**Authority runs rulebook → build specs → this document.** Where this document and the build
specs disagree on behavior, the specs win; where the specs and the rulebook disagree, the
rulebook wins. Bare `§` references below point at the rulebook unless a filename is given.

---

## 1. The mark and the product

### 1.1 The mark, described

A heavy angular italic wordmark reading **ANTE**, rendered in brushed chrome — a dark
graphite-to-silver gradient with sharp beveled facets cut into the letterforms and thin white
keylines separating them from the ground. The letters carry roughly a 12° slant and are cut
through with hard 45° slashes, giving them a machined, stamped-metal quality rather than a
drawn one.

Behind the wordmark sits a broken circular ring built from **four low-poly faceted gemstone
arcs**, one in each diagonal quadrant: violet upper-left, red-orange upper-right, teal
lower-right, amber-gold lower-left. Each arc is cut into flat triangular planes with hard
gradient breaks between them, lit consistently from the upper left. Inside the gem ring runs a
**thin gold circle** over a dark inner bezel.

The composite reads simultaneously as a poker chip, a roulette or fortune wheel, a
championship medallion, and an esports emblem — which is exactly the right ambiguity for a
product that is a serious competition played entirely for pride.

**Three materials.** This is the most useful way to describe the mark, because the product's
entire color system falls out of it:

| Material | What it is | What it means |
|---|---|---|
| **Chrome** | The wordmark — steel, faceted, hueless | The thing itself. Permanent, machined, neutral. |
| **Gold** | The thin bezel ring | The house. Structural, quiet, always present. |
| **Gems** | The four faceted quadrants | The stakes. The only thing that changes. |

**Five attributes to carry into everything**

1. **Faceted, not smooth.** Flat planes with hard-edged breaks. Fixed light source, upper
   left. No soft glows, no blur, no glassmorphism.
2. **Chiseled and sheared.** 45° cuts, ~12° slant, chamfered corners. Never rounded.
3. **Quadrant logic.** Four colors at compass points — a system, not a gradient. Never blend
   them into a rainbow.
4. **The bezel.** The gold-edged ring is the most ownable shape in the identity and should
   recur as a functional device, not as decoration.
5. **Built for a dark field.** White keylines are structural — they hold dark forms off dark
   grounds.

**Adjectives:** competitive · precision-cut · faceted · tournament-grade · engineered ·
medallion · deadpan

**Not:** cozy · pastel · hand-drawn · corporate-fintech · retro-Vegas neon · casual-flat ·
mascot-driven

### 1.2 What the product is

A private season-long NFL chip pool for 8–40 friends. Everyone starts with 500 chips, bets
blind each week, and gets paid based on how few people agreed with them. Chips have no cash
value and there is no payment surface anywhere in the product.

**So the reference is a poker night, not a sportsbook.** DraftKings and FanDuel are the wrong
mental model — they optimize for conversion and volume against strangers. ANTE optimizes for
a room of people who know each other, argue in the group chat, and will remember a bad shove
for years. Design for that room.

Three things follow from this, and they should drive the visual decisions:

**The reveal is the product's peak moment.** Everyone submits blind; the instant the last
ticket lands, every ticket in the league opens at once. This is the emotional payoff, and it
deserves the most design attention in the product — more than the bet slip, more than
settlement.

**Nothing precedes it.** Shoves included — a shove is a pick, and it stays dark like every
other pick until the reveal fires (§6, §8). Which means the biggest single event in the game
arrives as a surprise inside the reveal rather than as its own earlier moment. Design the
reveal to be able to carry that.

**Commitment is irreversible.** A submitted ticket cannot be changed by the player or the
commissioner. The interface has to *feel* like a commitment before the click, not warn about
it after.

**The league is public and a little rude.** Standings, past tickets, the waiting-on list, the
awards — nearly everything is visible to everybody, on purpose. The design should support
needling rather than smoothing it over.

---

## 2. Tone

The rulebook has a real voice — dry, deadpan, poker-adjacent, occasionally funny, never
zany. *"The house does not offer odds on desperation."* The interface should sound and look
like the same author wrote it.

Three phrases hold the target, and each one has a failure mode worth naming.

### Legacy, without corny

It should feel like a competition that has been run this way for forty years and will be run
this way for forty more — an institution, not an app launched last spring.

**Legacy comes from behavior and structure, not from vintage decoration.** What earns it here:
the mark used consistently as a seal, in the same place, at the same size, every time. The
permanent public record — every ticket from every week, viewable forever, nothing ever
deleted. Awards with fixed names that accrue meaning by repetition. Gold hairlines used
sparingly enough to mean something. A rulebook typeset like a rulebook. Numbers set with the
discipline of a scoreboard.

**Corny is decoration doing the work instead:** distressed paper and grain overlays, sepia,
blackletter, laurel wreaths, an "Est. 2026" roundel, felt-green and mahogany skeuomorphism,
whiskey-brand pastiche, faux-letterpress. Anything that *performs* age rather than earning it.
If an element would look at home on a novelty cigar box, cut it.

### Streamlined like a sportsbook, without being one

Steal the **mechanics**: fast scanning, tabular figures, dense sortable rows, one-tap side
selection, a persistent running slip, a phase always visible at a glance.

Reject the **semiotics**: odds-boost badges, urgency countdowns styled as pressure, promo
confetti, "BET NOW" energy, pulsing live-action treatments, anything green-and-cash-shaped.
There is no money here and the interface should never imply otherwise.

The distinction in one line: *borrow the ergonomics, refuse the appetite.*

### Tight, fun, easy

**Tight** — compact by default. No cavernous hero padding, no oceans of whitespace between
label and value. More information per screen than feels fashionable. The dashboard should look
like it respects the reader's time.

**Fun** — carried by copy and by a few well-placed theatrical moments, not by ornament. The
reveal, the shove, the pot award, the waiting-on list. The rulebook is already funny; let it
through instead of writing generic product copy over it.

**Easy** — the week's phase, your stack, and the one action available should be obvious in
under two seconds. One primary action per screen. Never make someone hunt for what to do next.

### Where to be loud, where to be silent

Be theatrical at the reveal, the shove, and the pot award. Be completely plain everywhere a
number lives — the leaderboard, settlement, the ledger, admin. The restraint in the dense
areas is what makes the loud moments land.

**As of D-007**, the stakes band, the wager area (bet slip), and the how-to-play tutorial
join the reveal/shove/pot-award as a second, deliberate loud zone — chip and felt texture,
gold-accent glow, and playful micro-motion are now in scope there. The dense surfaces named
above (leaderboard, settlement, the ledger, admin) are unaffected.

---

## 3. Color

### 3.0 Three materials, three roles

The logo is built from three materials, and the palette inherits that structure directly.
Two of the three never change; only one moves.

| Material | In the logo | In the product | Changes? |
|---|---|---|---|
| **Chrome** | The wordmark — steel, near-white, no hue | The interface: primary buttons, selected sides, active nav, your own row, the shove | Never |
| **Gold** | The thin bezel ring | The house: hairlines, system messages, commissioner corrections, the Pot, the felt badge | Never |
| **Gems** | The four faceted quadrants | The stakes: the season's current ante tier | Four times a season |

This is the resolved answer to how far tier color should reach. **The tier does not repaint the
app** — the leaderboard, chat, settlement tables, and all state language look identical in Week 2
and Week 17. But the tier gets more than a decorative accent: it owns one large, contiguous,
faceted **stakes band** across the top of the dashboard, carrying the week, ante, Pot, house
limit, deadline, and the ring.

One big plane rather than scattered accents. It reads as a season change without destabilizing
the product.

**The only two places tier color appears:**

1. **The stakes band** (and its equivalent on other surfaces — the reveal interstitial, week
   pages, the admin week control header)
2. **Week history markers** — small tier-colored edges on past-week entries, so the shape of
   the season is legible at a glance

Everything else is chrome, gold, and neutrals. If a designer is reaching for tier color outside
those two places, the answer is chrome.

**Chrome, not a colored accent, is the interactive color.** It's hueless, so it never collides
with whichever tier is active, and it's the strongest possible signal on a near-black field.
Primary actions are near-white with dark text.

### 3.1 The four gems are a season clock

The logo's four gem quadrants already have meaning assigned by the rulebook — the ante tiers:

| Weeks | Ante | Tier | Quadrant |
|---|---|---|---|
| 1–4 | 10 | **Purple** | upper left |
| 5–9 | 15 | **Red** | upper right |
| 10–14 | 20 | **Teal** | lower right |
| 15–18 | 30 | **Gold** | lower left |

This is the single best idea available. Within the stakes band, the current tier is the
dominant color — the faceted background plane, the band's top edge, the lit ring quadrants,
the tier label. The band should visibly change temperature across the season, from cool purple
in September to hot gold in December, and the ante cost should be legible from color alone
before anyone reads a number.

The ring in the band shows all four quadrants at once: elapsed tiers lit and dimmed, the
current tier lit at full strength, future tiers dark. The season's progress is always visible.

Approximate anchors, sampled from the mark. Treat as starting points, not law — expect them
to need lightening for text and small UI on a dark field.

| Tier | Deep | Base | Bright |
|---|---|---|---|
| Purple | `#2E1856` | `#4C2A8E` | `#8B5FD6` |
| Red | `#8C1410` | `#D62B1F` | `#F04E2A` |
| Teal | `#063E3C` | `#0E6B66` | `#17A79E` |
| Gold | `#7A4409` | `#C97A18` | `#E8C766` |

### 3.2 Everything below the band lives on neutrals

Because the gems are spoken for by the season, game states cannot also be color-coded to them
without collision. Build the functional palette out of a near-black neutral ramp — a canvas,
two or three surface levels, a border, and three text weights — and express state through
**contrast, weight, and iconography** rather than hue.

Where a state genuinely needs emphasis, reach for **chrome** (interface) or **gold** (house)
before introducing any new hue. The only exception is the win/loss pair, which needs a muted
green and a muted red that read as data rather than as brand color — and even those must carry
a sign or arrow alongside.

Total palette: chrome, gold, four tier gems, a neutral ramp, and two muted data colors. Nothing
else.

### 3.3 States that need visual identity

These are the states the product actually has. Each needs to be distinguishable at a glance;
how is a design decision.

| State | Design intent |
|---|---|
| **Chalk** (with the crowd, pays under 1×) | Crowded, safe, unremarkable — visually quiet |
| **Split** (room is even, ~1×) | Neutral, balanced |
| **Fade** (with the minority, pays over 1×) | Exposed, high-variance, the interesting one |
| **Folded** | Absent, receded, slightly shameful |
| **The felt** (1 chip, not eliminated) | Stripped down but dignified — a badge, not a gravestone |
| **The shove** (all-in, once a season) | The loudest thing in the product, full stop |
| **Blackout** (pre-reveal) | Withheld, sealed, deliberately opaque — and completely still (§9) |
| **Won / Lost / Returned** | Won and lost must differ by more than hue |
| **Deactivated** (quit the league, §13) | Present but out — stack and standings row intact, ineligible for the title and every award. Muted, greyed, marked *out*. Not deleted, not dramatized |
| **The marker** (Pot carrying a negative, §7) | The house is into the Pot for a week. Rare, worth a real banner in admin and a plain line in the ticker. Notable, not alarming |

Two notes worth honoring:

- **Never encode outcome in color alone.** Sign, icon, or label alongside. Roughly one in
  twelve of any league will have trouble with a red/green pair.
- **Losses recede, wins arrive.** The felt exists so nobody gets deleted; treat elimination-
  adjacent states with restraint rather than drama. The rulebook's posture is mercy.

---

## 4. Typography

Three roles.

**Display** — headings, the reveal, the shove, week and tier markers. Wide or extended, heavy,
italic-capable, angular. It should rhyme with the wordmark without imitating it. Candidates:
Monument Extended or Druk Wide if there's budget; Archivo Expanded or Chakra Petch if not.
Use it sparingly — it's loud and tires fast.

**Body & UI** — labels, chat, rules, forms. A clean neutral grotesque. Inter, Geist, or
similar. Never italic; the slant belongs to display and the logo.

**Numerals** — chips, multipliers, stacks, limits, counts. **Must be tabular lining figures.**
This is the one typographic rule that isn't negotiable: chip counts and multipliers sit in
sortable columns and update live, and proportional figures make them jitter. A mono face or
`font-variant-numeric: tabular-nums` both work.

Two conventions worth setting early: multipliers always carry the `×` and two decimals
(`2.50×`, `0.67×`), and chip deltas always carry an explicit sign (`+90`, `−40`, using a true
minus).

The rulebook itself is beautifully typeset — the block quotes, the tables, the aside voice.
`/rules` should be a genuinely well-set reading experience, not a dumped markdown file. It's
also the best place in the product to let display type breathe.

It carries a **version string and a frozen-for-the-season note** (`ANTE-RULEBOOK.md` is a
versioned file rendered from the repo, not editable content — §13 forbids mid-season rule
changes). Set that stamp like a colophon rather than a disclaimer: small, gold hairline,
bottom of the page. It's a legacy cue that costs nothing and is actually true.

---

## 5. Shape and texture

**Chamfer, don't round.** The wordmark is cut at 45°. Angled corners and hard diagonal
divisions belong here; pill shapes and heavy radii don't. Establish one chamfer treatment and
apply it consistently to the elements that matter — primary actions, featured cards — while
leaving ordinary rows and inputs plain.

**Facets are flat planes, lit from the upper left.** When you use the gem treatment, it's
irregular triangular planes with hard edges between them, each plane a flat fill. No soft
glows, no blur, no glassmorphism. Keep the light direction consistent everywhere.

**Facets are for moments, not surfaces.** The logo is maximalist; the app is a dense data
tool with a chat panel. Reserve gem treatment for: the logged-out homepage, the reveal
interstitial, the shove, pot awards, season awards, empty states, and the promo box. Keep it
away from anything with a number in it — bet slips, leaderboards, settlement tables, chat.

If the ratio isn't roughly 90% quiet neutral to 10% faceted, it's wrong.

---

## 6. Signature: the ring

The gold-bezeled ring is the most ownable shape in the identity. Make it functional rather
than decorative, and use it in a small number of places consistently:

- **Season progress** — its permanent home is the stakes band. Four quadrants for four ante
  tiers; elapsed tiers lit and dimmed, current tier at full strength, future tiers dark. This
  is the one place the gold bezel always appears at full weight.
- **The waiting-on state** — a seat filled per submitted ticket, one arc per player, so the
  room visibly closes as the reveal approaches. **This is the only thing in the entire product
  that is allowed to move during the blackout** (§6, §9 below). That exclusivity is a gift:
  it's the one live signal on the page, so it carries all the tension by itself.
- **Countdowns** — Tuesday 6am open, Thursday noon deadline
- **Loading** — segments rotating, then locking into the logo position

One shape doing a few jobs consistently reads as authored. The same shape doing twenty jobs
reads as a screensaver.

---

## 7. Surfaces

Layout structure is already fixed by `ANTE-PLAYER.md` §4. This is intent, not layout.

**Homepage.** One centered column: logo, intro, phone field, copyright. The only place in the
product that gets the full faceted treatment. It's the invitation — make it look like a
tournament poster.

**Dashboard.** Header, ticker, then two columns — wager area and leaderboard on the left,
Table Talk / news / promo / support on the right. Collapses to single column below 900px with
the wager area promoted above chat. The ticker is a persistent horizontal rail blending NFL
headlines, commissioner posts, and league facts; it should feel like a broadcast crawl.

**The stakes band** sits between the ticker and the two-column body: a faceted, tier-colored,
full-width plane holding the ring, week number, tier label, ante, Pot, house limit, deadline,
and the primary action. It is the only large colored surface in the product and the only thing
that changes with the season. On mobile it stays full-width and stacks; it should not be the
first thing cut for space.

**The wager area** is one slot with five states — open, submitted, revealed, settled, closed.
Each should be visually distinct enough that the week's phase is obvious at a glance from
across a room.

**The bet slip.** The most-used surface, mostly on a phone on a Wednesday night. Persistent
header strip: ante, house limit, committed, remaining, games selected, shove card. Primary
controls in the thumb zone. Two teaching moments deserve real design attention rather than
tooltip afterthoughts — that the **spread is context and never settles anything**, and which
side of the **house limit** is binding ("capped by the room" vs. "capped by your stack").

Felt mode is a genuinely different mode — minimums lift, step becomes 1, limit becomes the
whole stack — and it should look and say so.

**The reveal.** Spend the budget here. A full-width interstitial when the phase flips, then
every ticket in the league at once, game-by-game with head counts and multipliers, pivotable
by player. This should feel like cards turning over.

**A shove, if there was one, breaks here for the first time.** Nobody in the league knew —
not the commissioner — so it lands as a genuine surprise rather than as the confirmation of
something already announced (§6, §8). It also moved everyone else's multiplier, which means
the reveal has to show both facts at once: the shove itself, and the prices it bent. Give it
its own beat inside the sequence rather than a badge on a row.

**The leaderboard.** Sortable, dense, plain. Eleven columns of real data. No facets, no
decoration — this is where restraint pays for the theatrics elsewhere.

One column has a behavioral catch worth knowing at design time: **the shove-card indicator
flips from held to spent at the reveal, not at submission** (`ANTE-PLAYER.md` §6). Whatever
treatment it gets must be static through the blackout — no transition, no "pending" state, no
half-lit card. A card that dims when somebody submits announces a shove to anyone with the
leaderboard open, which is the same leak as announcing it.

**Table Talk.** A real chat panel that reads as part of the product, not an embedded widget.
System messages (reveal fired, pot awarded, commissioner corrections, deactivations, mutes)
are distinct from player messages and carry weight — the correction posts are a trust
mechanism, and they are the only place the commissioner's authority is visible at all.

There is **no shove-announced system message**; shoves live inside the reveal (§6, §8). A
player is free to brag in the chat before submitting, which the rulebook notes is traditional
and usually a mistake — that's a player message, styled like any other, and the design should
not give it special treatment.

**Admin console.** Same visual language, persistent left nav, but calmer and denser. The ops
dashboard is an "is anything on fire" page: current week, submission tracker, pot, median,
places tier, cron health, alerts. It should read as instrumentation. Destructive and
irreversible actions (force reveal, re-settlement, deactivation) need visual weight
proportional to their consequences.

**The commissioner sees no more than anyone else before the reveal**, and the console should
look like it knows that. The submission tracker shows names, never picks; there is no shove
indicator, no pot-moved-early figure, no privileged panel waiting to be built later. Design
the pre-reveal admin screens as deliberately thin — the absence is the feature (§13).

**Deactivation is the one action that needs friction, not just weight.** It requires a
quotable statement that the player actually quit (§13) — silence is never grounds — so the
form has two required fields, and the confirmation states plainly that the player forfeits
the championship and every award. Treat it like an exit interview, not a delete button.

---

## 8. Motion

Motion should mark **state changes and commitment**, not decorate. The product's rhythm is
weekly, not real-time — there is no live in-game action here, and animation should not
pretend otherwise.

Worth animating: the reveal (the one place to be genuinely theatrical, and where the shove
breaks), submission confirmation, pot award, the ring filling as the room closes, the ticker
crawl, the news cross-fade.

There is no separate "shove announcement" moment to animate — it was removed from the
product, because it happened inside the blackout. The shove's animation budget belongs to the
reveal sequence.

**As of D-007**, also worth animating: idle motion on the stakes band (shine sweep, gold
pulse on the Pot), the bet slip's chip steppers, and the how-to-play tutorial's step
transitions and callouts.

Not worth animating: settlement tables, the leaderboard, chat, anything in admin. That
boundary is unchanged by D-007.

Keep it short everywhere except the reveal. Honor `prefers-reduced-motion` throughout —
the specs call this out for the ticker and news fade specifically. And nothing celebratory
should fire on a loss or on reaching the felt.

---

## 9. Constraints the design has to live with

Pulled from the build specs; these will bite if discovered late.

- **Every string is editable — with one exception.** No copy is hardcoded; everything
  resolves through content blocks the commissioner can rewrite, so components must tolerate
  significant length variance in every label, heading, and body block. Don't design to a
  specific string. **The rulebook is the exception**: it ships with the code and renders from
  a versioned file, so `/rules` is the one surface whose copy can actually be designed to.
- **No cash surface, ever.** No prices, no purchase, no deposit, no cash-out. Nothing in the
  visual language should imply real money — this is what keeps it a pool.
- **The blackout is absolute, and it is bigger than the ticket views.** The build rule is:
  *between the ante posting and the reveal, no public figure changes and no ledger entry is
  written.* The only pre-reveal state change in the entire system is a name leaving the
  waiting-on list. Every number on screen — the Pot, the leader, every stack, every rank,
  every delta, the shove-card indicator, the ticker — **sits perfectly still from Tuesday
  morning until the room opens.**

  For design this is a hard constraint with two edges. Nothing may animate, poll-update,
  transition, or show a "pending" affordance during the window, because a number that twitches
  when somebody submits is a pick told slowly. And nothing may render a placeholder implying
  hidden pick data exists on the page — no blurred rows, no locked-card graphics, no "3 picks
  hidden" counters. The blackout should read as *sealed*, not as *obscured*: there is nothing
  behind the frosted glass, because there is no frosted glass.

  The upside is that the stillness is itself a design material. When every other number is
  frozen, the waiting-on ring filling one arc at a time is the only living thing on the
  screen, and it does not have to compete for attention.
- **Accessibility is specified, not optional.** Keyboard-operable bet slip, focus management
  on the confirm modal, reduced-motion support, adequate contrast on the chip steppers.
- **Mobile bet slip must work one-handed.** That's where most tickets actually get submitted.
- **Desktop-first dashboard**, single column below 900px.
- **Nothing is ever deleted.** Not players, not tickets, not chat messages, not ledger
  entries. Hidden chat renders as a tombstone rather than a gap; departed players keep their
  row. The design needs a vocabulary for *present but inactive* — muted, greyed, marked — and
  should never reach for removal, because removal doesn't exist in this product.

---

## 10. Do / Don't

| Do | Don't |
|---|---|
| Earn legacy through consistency and permanence | Perform legacy with grain, sepia, or wreaths |
| Borrow sportsbook ergonomics | Borrow sportsbook appetite |
| Stay tight — more per screen than feels fashionable | Pad it out with cavernous hero space |
| Confine tier color to the band and history markers | Let the tier repaint the app |
| Use chrome for every interactive element | Color primary buttons with the tier |
| Reserve gold for the house — system, Pot, corrections | Use gold decoratively |
| Give the tier one large plane | Scatter tier accents across the UI |
| Keep the dense surfaces neutral and plain | Put facets behind numbers |
| Chamfer and cut at 45° | Reach for pills and heavy radii |
| Use tabular figures everywhere numbers live | Let chip columns jitter on update |
| Make the reveal a genuine event | Animate settlement tables |
| Design the felt as a badge | Design elimination — nobody is eliminated |
| Pair color states with an icon or sign | Encode win/loss in hue alone |
| Let the rulebook's voice into the interface | Write generic product copy over it |
| Keep every number frozen through the blackout | Animate, poll, or "pend" anything pre-reveal |
| Let the reveal carry the shove | Build a separate shove-announcement moment |
| Read the blackout as sealed | Render blurred rows or locked-card placeholders |
| Give departed players a muted row | Design a delete state — nothing is ever deleted |
