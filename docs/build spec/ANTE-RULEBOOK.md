# ANTE
### The complete rules

*Version 1.1 — frozen for the 2026 season. This text is versioned alongside the code and is not editable from the admin console; §13 forbids changing a rule mid-season, and that has to be true of the rules themselves.*

ANTE is a season-long NFL pool where you bet chips instead of making picks. Everyone starts with 500. Each week you spread chips across the games you like but what you get paid depends on how many people agreed with you. Take the side everyone took and you barely get paid. Take the side almost nobody took and you get paid double. Nobody sees a single pick until every player is locked in, so every week you're guessing what your friends are about to do. Biggest stack on the last Sunday wins.

**What a player actually does**

Tuesday morning — The new slate opens. Your weekly ante comes out automatically (10 chips early in the season, 30 by the end). It goes into the Pot.

Sometime before Thursday noon — You look at the games and put chips down. At least 5 games, 10 to 50 chips each. The app tells you your limit; you can't overspend it.

You hit submit — That's it. Locked. No edits, not by you, not by anyone.

The reveal — The second the last person submits, every ticket in the league opens at once. Everyone sees everything: who took what, how much, who folded, who shoved. If somebody's dragging their feet, the whole league can see their name sitting there.

Wednesday through Saturday — Days of arguing about it. The Thursday nighter kicks a few hours after the deadline; the rest of the board sits there in the open all week.

Sunday and Monday — Games play out. Win a bet, you get paid based on how alone you were. Lose it, the chips are gone.

Monday night — Chips settle. Whoever gained the most that week takes the Pot. New slate opens Tuesday.

*Numbers below are tuned from 2,500 simulated seasons per configuration.*

---

## 1. THE SETUP

**Everyone starts with 500 chips.** No chip has cash value. Everybody begins dead even.

The season runs **NFL Weeks 1 through 18.** Biggest stack after Week 18 wins.

**Minimum 8 players.** Below that the room is too small for pick distributions to mean anything and the season is pure noise. Twelve to twenty is the sweet spot. Thirty works fine.

**The roster locks at the Week 1 deadline.** Everybody starts at 500 on the same Thursday or not at all — a Week 4 arrival with a full stack walks into a league whose median has already moved. If people drop out later the league carries on; there's no minimum to stay alive, only to start.

---

## 2. THE ANTE

Every week, before anything else, **the ante comes out of your stack.** Everyone pays it — players, folders, and people who forgot.

**There are exactly two exceptions:** a player who shoves that week (§8), and a player whose stack is below one full ante (§9). Nobody else is exempt, for any reason, ever.

| Weeks | Ante | Tier |
|---|---|---|
| 1–4 | 10 chips | Purple |
| 5–9 | 15 chips | Red |
| 10–14 | 20 chips | Teal |
| 15–18 | 30 chips | Gold |

Over a full season the ante takes **335 chips** — two-thirds of a starting stack. This is the clock. It is why nobody can win by hiding.

**Every ante goes into the Pot.** The ante is not a tax. It funds the weekly prize. See §7.

---

## 3. PLACING BETS

Each week you get the full NFL slate. Pick sides, put chips on them.

- **Bets are in multiples of 10 chips.** Minimum 10 per game, maximum 50.
- **You must bet at least 5 games.** More is fine.
- **You cannot bet both sides of a game.**
- **The slate is every game that week** — Thursday, Saturday, Sunday, Monday, international, all of it — **except any game that kicks off before the deadline.**
- **The deadline is Thursday, 12:00 noon ET.** Every week. All season. No exceptions.

The NFL occasionally schedules a game before Thursday noon. The 2026 season has two: the Wednesday opener in Week 1, and a Wednesday game the night before Thanksgiving in Week 12. Those games simply aren't on the slate — a 15-game week instead of 16, and the five-game minimum never notices. **You can never bet a game that has already started.**

### Submitting is a commitment

**The moment you submit, your ticket is locked.** You cannot change it, and neither can the Commissioner. Take all week to decide if you want — but pushing your chips in is an act, not a draft.

**Submit nothing by Thursday noon and you are folded** (§6), and you still owe the ante. No reopening, no "my phone died."

The slate opens **Tuesday at 6:00am ET**, which gives you two days and six hours. Thursday noon lands before Friday's final injury designations, so you're betting on Wednesday's practice report like everyone else. That's deliberate: this is a game about reading the room, not out-researching it.

---

## 4. THE HOUSE LIMIT

> ### Your weekly limit is one-third of the smaller of:
> ### your own stack, or the league's median stack.

Rounded down to the nearest 10. It does two jobs at once.

**If you're below the median**, you're capped by your own stack. **You cannot bust in a single week** — the worst possible Sunday costs you a third. You bleed, you don't die.

**If you're above the median**, you're capped by the room. A big stack cannot bet proportionally bigger, win proportionally bigger, and snowball out of reach. You can't buy a bigger seat than the table.

**Which stack, measured when.** The median is the league's, snapshotted the moment the slate opens, *before* antes come out (§14). Your own stack is what you hold *after* your ante has come out. Two different moments, deliberately: measuring your own stack before the ante would let a short stack risk more than a third of what it actually holds, and the entire promise of this section is that it cannot.

Example, in a league whose median stack is 480:

| Your stack (after ante) | Limited by | House limit | Bets available |
|---|---|---|---|
| 1,400 | the room | 160 | 16 |
| 700 | the room | 160 | 16 |
| 480 | either | 160 | 16 |
| 300 | your stack | 100 | 10 |
| 150 | your stack | 50 | 5 |

The cap rises on its own as the whole league grows, so late-season weeks have more action, not less.

**Short stack rule:** if your limit won't cover five bets, play as many as it covers. The five-game minimum never traps you.

### Why it's capped

Earlier drafts used a flat one-quarter of your own stack. Simulation showed it quietly compounding: a leader bet more, won more, bet more again. The Week 10 leader took the title 43.7% of the time, and the winner finished an average of 970 chips clear of the field. Capping at the median dropped the leader's edge to **40.4%** and the winning margin to **754** — while *raising* the skilled player's median finish from 442 to **528**. Fewer runaway seasons, more reward for being right.

---

## 5. HOW BETS PAY

This is the engine of the whole game. One line of arithmetic:

> ### Your payout = players against you ÷ players with you
> Never less than **0.25×**. Never more than **2.50×**.
> **If nobody took the other side, it settles at even money (1×).**

**You count yourself.** "With you" always includes you, so the bottom of that fraction is never zero. Alone on a side against four is 4 ÷ 1.

That's the entire rule, and it needs no table. It works identically whether three people bet a game or thirty.

### Count only the people who bet *that* game

The head count is taken from the players who actually took a side on that game. Everyone who skipped it — folded, or just didn't like the matchup — is invisible to the math.

This matters, because **nobody bets every game.** The minimum is five out of a fifteen-game slate, so most games draw well under the full league. In an eight-player league the typical game sees about five bettors. In a forty-player league, about twenty-one.

**Do the division on whatever showed up.**

| The game drew | You're one of | Against you | Pays |
|---|---|---|---|
| 5 bettors | 1 | 4 | 2.50× *(capped from 4.0)* |
| 5 bettors | 3 | 2 | 0.67× |
| 9 bettors | 3 | 6 | 2.00× |
| 9 bettors | 6 | 3 | 0.50× |
| 22 bettors | 7 | 15 | 2.14× |
| 22 bettors | 15 | 7 | 0.47× |

*Illustrations, not rules. The rule is the division.*

Two consequences worth knowing before your first ticket:

**Small pools swing hard.** Being one of two people on a side happens constantly, and it pays the maximum. **The obscure game nobody else could be bothered with is frequently the best price on the board.**

**The cap and floor bind about a fifth of the time** — verified from eight players up to forty, where the rate barely moves. If you're way out on a limb, you're getting 2.50× and not a chip more. If you're deep in the crowd, 0.25× and not a chip less.

Payouts are **profit on top of your returned chips.** Bet 30 at 2.5× and win → 30 back plus 75. Bet 30 at 0.5× and win → 30 back plus 15.

**A losing bet loses the full amount no matter what it would have paid.** The popular side isn't safer. It just pays less.

### The three words

Chalk, split, and fade are what you call your situation, not separate rules:

- **CHALK** — you're with the majority. Pays under 1×.
- **SPLIT** — the room is roughly even. Pays about 1×.
- **FADE** — you're with the minority. Pays over 1×.

### Why it's built this way

Earlier drafts used three fixed payouts — 0.5× / 1× / 2× by rough bands. Simulation killed it. Nearly half of all sides landed in the middle band, which paid **even money whether your side's real chance was 36% or 64%.** Taking an underdog lost 27 chips per 100 wagered. The contrarian finished dead last.

Dividing against-by-with fixes it automatically. If the room is systematically wrong about something, that side systematically pays more, without anyone setting a number by hand.

### Small leagues

The formula scales on its own — no adjustment needed. Just don't run it under 8 players.

### The house keeps nothing

> **At the end of each week, any chips the table didn't pay out are swept into the Pot.**

Because payouts are set by head count while people bet different amounts, the two sides of a game rarely balance to the chip. Rather than letting the difference evaporate, it goes into the Pot and gets handed to a player.

This makes ANTE **exactly zero-sum.** The league holds 500 chips per player on the first Sunday and the same number on the last. Every chip that leaves your stack ends up in somebody else's — through a payout or through the Pot — with a name attached to it.

It also means **the median player finishes below 500, and that is correct.** About 43% of players end above their buy-in. The mean is exactly 500; the median is lower because a few big stacks pull the average up. A player finishing at 2,000 is holding chips that came from four players who finished at 300. Nothing was lost. It moved.

---

## 6. THE BLACKOUT — what you see, and when

**Before the reveal, you see nothing about anybody's picks.** No sides. No chip amounts. No percentages. No fold status. Not even a running count of who took what.

Exactly one thing is public before the reveal, and it is not a pick: the list of names who haven't submitted yet. See *Waiting on you, Terry*, below.

**And nothing else moves.** Not a stack, not the Pot, not a number on any screen. Submitting a ticket has **zero visible effect on anything** until the reveal — because a number that twitches when somebody submits is a pick, told slowly. The only chips that move during the blackout are the antes, and those all move at once on Tuesday morning before anyone has done anything.

This is what closes the last door. Hiding the picks isn't enough if the room can be read off the scoreboard.

You are betting blind on the room. What you have is the point spread and your personal knowledge of these specific human beings. You know who takes the prime-time favorite every single week. That's the read, and it's the entire skill of the game.

### The reveal fires the instant the last ticket lands

Not at the deadline — **the moment every player is in.** Once all tickets are committed, nobody can act on what they see, so there's no reason to sit on it.

If everyone submits by Tuesday night, the room opens Tuesday night. If three people drag their feet, it opens Thursday at noon when they're auto-folded. **Whichever comes first.**

**When it opens, everything opens at once.** Every player's full ticket — who took what side, how many chips, who folded, who shoved — and the payout multiplier on every side.

### Waiting on you, Terry

Before the reveal, one thing *is* public: **who hasn't submitted yet.** Not their picks — just the names. Nine of twelve in, waiting on three.

That's the whole point of revealing early. The reveal is a party and the stragglers are holding it up, and everybody knows exactly who they are. Expect Tuesday-afternoon harassment. That's the design working.

**Then you get the rest of the week.** Reveal on Tuesday or Wednesday, the bulk of the board on Sunday — every ticket in the league visible the entire time, nothing changeable by anyone. Four days to stew about the 50 chips your brother-in-law put on the Jets.

Full tickets, not just percentages. Anyone can verify the math, so nobody suspects the house. And "Marlene put 50 on the Jets" is the raw material for the whole week of table talk.

The blackout also kills the late-submitter advantage. Nobody gets to see the room and then act on it.

---

## 7. THE POT — the weekly prize

Every ante paid that week goes into the Pot. **The Pot goes to whoever gained the most chips that week** — and in a bigger room, to the runners-up as well.

| Weeks | Ante | Pot @ 8 | Pot @ 12 | Pot @ 20 |
|---|---|---|---|---|
| 1–4 | 10 | 80 | 120 | 200 |
| 5–9 | 15 | 120 | 180 | 300 |
| 10–14 | 20 | 160 | 240 | 400 |
| 15–18 | 30 | **240** | **360** | **600** |

*Full-table figures. A real Pot usually runs a little under them, because shovers and players on the felt don't ante (§8, §9).*

By Week 18 a single Pot is worth most of a starting stack. **Nobody is mathematically out of this until the final game of the year.**

### How many places it pays: one for every 8 players

**League size means** everyone who bought in and hasn't been deactivated (§13), **counted the moment the slate opens and fixed there for the week.** Players on the felt count — they are still in this, and they are exactly who the extra places exist for. A deactivation mid-week never changes the prize structure after tickets are already locked.

| League size | Places paid | Split |
|---|---|---|
| 8–15 | 1 | winner takes all |
| 16–23 | 2 | 67 / 33 |
| 24–31 | 3 | 50 / 33 / 17 |
| 32–39 | 4 | 40 / 30 / 20 / 10 |
| 40+ | 5 | 33 / 27 / 20 / 13 / 7 |

A winner-take-all Pot works fine in a small room. In a big one it turns into a lottery — the Pot grows with the league but still lands on one person, so most players just bleed antes all season and never see a chip come back. Simulation put **30% of a forty-player league on the felt** under winner-take-all. Paying one place per eight players brings that to **18.8%**, in line with a twelve-player league, and leaves small leagues completely unchanged.

The weighting stays steep on purpose. Spreading the Pot evenly across the top three stops rewarding the big week at all — tested, and the skilled player's edge dropped *below* chance in a large league.

### Rules of the Pot

- **You must have submitted a live ticket to be eligible.** Folders are out. This is the real cost of folding.
- **A ticket whose games all got returned still counts.** You submitted; the schedule didn't cooperate. Cancellation isn't folding.
- If everyone lost chips that week, it pays out by who **lost the least.**
- **If every single player folded, nothing is awarded and the whole Pot rolls into next week.** Two quiet weeks in a row makes the third one enormous.
- **Every share rounds down to a whole chip and the leftovers roll into next week's Pot.** A 240-chip Pot paying 67/33 hands out 160 and 79; the last chip rolls.
- Ties for a place split that place's share evenly, rounding down. Odd chips roll into next week.
- Shovers are eligible.

### The marker

Some weeks the table pays out more than it took in — the underdogs come through and the winners are owed more than the losers put up. It happens roughly two weeks in five, usually by a few dozen chips.

The Pot covers it. And when the Pot can't cover it, **the Pot goes negative and carries as a marker.** Next week's antes pay the marker down first, and only what's left over is awarded. If the marker swallows the whole Pot, **nobody wins one that week** — it's announced, and it becomes a story.

That's rare — about one week in fifty-seven — and it has never exceeded a few hundred chips in simulation. It exists so the promise in §5 stays literally true: no chip is ever created, and none is ever destroyed. The table is simply into the Pot for a week.

### How the Pot connects to the multipliers

The multipliers control how violently your stack can move in a week. The Pot goes to whoever moved it most. **So the multipliers are how you win Pots.**

A player who only ever takes the popular side is stuck near the 0.25× floor. They will still be alive in Week 18. They will not have won a single Pot all season. Simulation confirms it: the Chalk Eater has the lowest bust rate in the league *and* one of the lowest win rates.

The multipliers create the variance. The Pot is the prize that variance competes for.

---

## 8. THE SHOVE

**Once per season, you may go all in.** One game, your entire stack.

- Declared like any other bet, locked at the same deadline, **and revealed with everything else.** A shove is a pick, and picks are dark until the reveal (§6). Telling the whole chat you're about to do it is legal, traditional, and usually a mistake.
- It ignores the house limit. That's the point.
- **You pay no ante the week you shove.** Nothing left to ante with. The ante has already come out by the time anybody submits (§14), so it is **refunded back out of the Pot — at the reveal, with everything else.** The amount you push in is locked when you submit and is the stack you held before the ante; the chips simply don't visibly move until the room opens. Nothing about the Pot may twitch while the blackout is on (§6). Win and you double the pre-ante stack.
- **No other bets that week.** The shove is the whole ticket.
- **A shove always pays even money — 1×.** No multiplier, ever.

That last rule is balance, not flavor. If shoves paid the fade multiplier, everyone would shove a 2.5× in Week 1. The house does not offer odds on desperation.

**Win and you double.** 400 becomes 800.

**Lose and you're on the felt.**

---

## 9. THE FELT

**Your stack can never go below 1 chip.** Not from a shove, not from the ante, not from the worst Sunday of your life.

**That last chip comes out of the Pot.** It isn't conjured. It is drawn from the Pot's own account — the same account that absorbs rounding remainders and carries markers (§7) — so even mercy is paid for by somebody. Nothing is created here either.

Lose a shove — or have the ante take the last of what you've got — and you land on **the felt** with one chip.

**"Below one full ante" is measured once a week**, at slate open, against that week's ante, before any ante comes out. The tiers rise, so a 25-chip stack is on the felt in Week 15 and is not on the felt in Week 10. While your stack is below one full ante:

- **You pay no ante.** The bleeding stops.
- **No five-game minimum.** Bet what you have, on whatever you want.
- **You are not eliminated.** Nobody in this league is ever eliminated.

Across simulated seasons, about **2 of 12 players** reach the felt. You are not realistically coming back from there, and that's fine — this rule exists so nobody gets deleted in Week 9 and spends the rest of the fall watching. Every so often somebody on the felt catches a 2.5×, stacks it, and becomes the only thing anyone talks about for a month.

Poker calls this a chip and a chair. Jack Straus won the 1982 World Series from exactly here. It has been done.

---

## 10. SETTLEMENT

- **Ties.** An NFL tie returns your chips. No win, no loss.
- **Cancelled games, or games postponed past the week's settlement.** Chips returned.
- **Relocated games settle normally.** A game moved for weather, fire, or anything else is still a game that got played. The venue changed; the result didn't. Your bet stands.
- **A game rescheduled to kick before the deadline is void. Chips returned.** §3 is absolute — you can never bet a game that has already started — so if the schedule moves underneath a locked ticket, the bet comes off rather than settling.
- **Overtime is just football.** The final score is the final score.
- Stacks update once, after the final game of the week has gone final.

---

## 11. WINNING

**Biggest stack after Week 18**, among the players still in the league at the end of it.

**A deactivated player (§13) keeps their chips and their line in the standings, but cannot win the season and cannot take a season award.** They stopped paying the ante. The ante is the clock, and nobody gets to win by stepping off it.

Tiebreakers, in order:

1. Most winning bets across the season — a winning shove counts as one; bets returned from ties, cancellations, and voids count as neither
2. Most Pots won
3. Fewest weeks folded, auto-folds included
4. High card. One draw, publicly, no re-draws.

**Everything except live tickets is public, always.** Every stack, every past ticket, every chip that has ever moved and why. The blackout covers the current week's picks and nothing else.

---

## 12. SEASON AWARDS

Cost nothing. Carry more weight than they should.

| Award | Goes to |
|---|---|
| **The Iron Stack** | Never folded a single week — and forgetting counts as folding |
| **The Chalk Eater** | Highest share of chips on sides paying under 1×. Not a compliment. |
| **Contrarian of the Year** | Most winning bets at 2×+. A shove pays 1× and never qualifies. |
| **Best Week** | Largest single-week gain |
| **Worst Shove** | Self-explanatory. Trophy travels. |
| **The Straus** | Reached the felt and climbed back above 500 |
| **The Straggler** | Last to submit the most weeks. Held up the reveal all season. **Never submitting counts as last** — an auto-fold is the latest anybody can possibly be. |
| **The Mark** | Voted by everyone who finished on the felt. One vote each, any player nominable, seven days from season close, plurality takes it, and a tie means co-winners. |

Deactivated players are not eligible for any of these (§11).

---

## 13. THE COMMISSIONER

Somebody runs the league. The rules are deliberately specific about what that means, because the fastest way to poison a pool is a commissioner with unclear powers.

### What the Commissioner can do

- **Correct bad game data.** A wrong score, a game marked final that wasn't, a status the feed got wrong. Fix it and re-settle the week.
- **Re-run settlement** on a week that settled wrong. This includes **forcing a reveal the clock should already have fired** — after Thursday noon, never one second before, and only when the automation failed.
- **Admit the league.** Before the season starts, approve or reject the people applying to play. This power is preseason-only and dies at the Week 1 deadline along with the roster (§1). Somebody has to constitute the table; nobody gets to reshape it once the cards are out.
- **Deactivate a player who has affirmatively quit.** Not a player who has merely gone quiet — see below.
- **Moderate Table Talk.** Mute a player from the chat, or hide a message. Both are announced, both are logged, neither is ever a deletion, and **neither ever touches a player's ability to bet.** A muted player still gets a full ticket, a full stack, and a full share of everything else.
- **Hand off the job** to somebody else.

### Deactivation is not for silence

**Deactivating a player requires that they have said they're done** — a text, an email, a "take me off the list," something the Commissioner can quote in the reason field. Silence is not consent to be removed, and §14 already says precisely what happens to a player who simply stops: they auto-fold, they keep paying antes, they stay in the standings.

This is not bureaucracy. A deactivated player leaves the median, and the median sets everyone's house limit. A Commissioner who could deactivate a quiet-but-solvent big stack could move every limit in the league without touching a single ticket. So they can't.

### What the Commissioner cannot do — ever

- **Touch a submitted ticket.** Not their own, not anybody's, not for injuries, not for a typo, not because someone begged. This is absolute.
- **Move a deadline** once the season has started.
- **Adjust a stack quietly.** Every correction writes a visible entry with a reason attached.
- **Change a rule mid-season.** Rule changes happen in the offseason or they don't happen. The text of this document is versioned and frozen for the season along with the numbers in it.
- **Un-ring a locked ticket by re-settling.** Re-settlement replays the chips, never the picks. If a correction lowers your stack back in Week 6, your already-locked Week 7 ticket stands exactly as submitted — even if it now exceeds a third of the corrected stack. You bet in good faith against the numbers the league was showing you. The floor in §9 absorbs whatever that costs.

### Every correction is public

Any adjustment posts to Table Talk automatically, with the reason and the chips involved. A visible fix builds trust. A silent one destroys it the first time somebody notices — and somebody always notices.

**The Commissioner plays in the league like everyone else, under exactly the same rules, and cannot see a single ticket before the reveal.** Whatever runs this thing has to enforce that, not merely promise it.

---

## 14. RULINGS — the things that will otherwise start an argument

Every one of these came up while stress-testing. None is exciting. All of them are the reason nobody has to text the Commissioner at 11pm.

### Order of operations, every week

1. **Tuesday, 6:00am ET.** The new slate opens and the point spreads are frozen as shown. **The median is measured now**, before anything moves.
2. The ante comes out of every stack and goes into the Pot. Stacks below one full ante skip it (§9).
3. Players submit, blind. **Each ticket locks on submission, and nothing visible changes** — no stack, no Pot, no count (§6).
4. **The reveal fires when the last ticket lands, or Thursday noon ET — whichever comes first.** Anyone who hasn't submitted is folded. Everything that was waiting posts at once, including any shove's ante refund (§8).
5. Everyone stares at everyone else's tickets for the next few days.
6. Games are played. Bets settle.
7. Whatever the table didn't pay out is swept into the Pot.
8. The Pot is awarded. Standings update. Back to step 1.

### The median

- Measured **at the moment the slate opens**, before antes come out.
- **Players on the felt are excluded.** A dead stack doesn't get to set the table — and including them shrinks everyone's limit exactly when the season should be opening up. Excluding them adds about 13% more action in the final month.
- **Rounded down to the nearest 10, always.** Average the middle two first if the player count is even.
- The median is public. Standings always are — the blackout covers picks, not chip counts.

### Rounding

**Every payout rounds down to a whole chip. The remainder goes into the Pot.**

A 0.71× payout on 30 chips is 21.3 → you get 21, and 0.3 joins the Pot. This is not pedantry: it's what keeps the league's chip count exactly conserved. Nothing is ever destroyed, only reassigned.

### "Largest chip gain" — defined

Your gain is **the net change in your stack for the week, ante included, before the Pot is awarded.**

So if you ante 20, win 90 on bets and lose 40, your gain is +30. You can win the Pot on a week where you're down, as long as everyone else is down more.

### Shoves

- **A shover counts in the head count** for whichever side they took, and therefore moves everyone else's multiplier. Their whole stack lands on one game and the room feels it.
- **If a shove's game isn't played** — cancelled, postponed past the week, or moved before the deadline — the chips come back **and so does the shove card.** It didn't happen. And because it didn't happen, **the refunded ante is charged again at settlement.** The exemption in §8 exists only because a shover has nothing left to ante with, and now they do.
- A shove is revealed with everything else. Announcing it early in the chat is legal, traditional, and usually a mistake.
- A player on the felt may shove their last chip if they still hold the card. It is legal, it is pointless, and it will be commemorated.

### Coming back from the felt

The ante skips you only while your stack is **below one full ante.** The moment you can cover it, you're paying it again like everyone else. There's no permanent exemption — the felt is a mercy, not a hiding place.

### Changing your mind

**You can't.** A submitted ticket is locked — not by you, not by the Commissioner, not for injuries, weather, or regret.

This isn't strictness for its own sake. If tickets stayed editable, the reveal couldn't fire until the deadline, and the league would lose its three days of table talk. The commitment is what buys the reveal.

Take as long as you want before you submit. Thursday noon is the wall.

### Sitting on your ticket

There is no strategic advantage to submitting late — nobody sees anything until everyone is in, so waiting buys you no information at all. All it does is hold up the reveal for eleven other people, who can see your name on the waiting list the whole time.

The only real risk of waiting is missing Thursday noon entirely and eating an auto-fold.

### Injuries after the reveal

**Nothing reopens.** A quarterback ruled out on Friday afternoon is simply part of the week. Every ticket in the league was committed under the same information, and the news hits whoever it hits.

This will cost somebody a Pot at least once this season. It is not a bug and there is no appeal.

### Season boundaries

The season is **Weeks 1 through 18.** Playoff games do not count, do not settle, and are not on any slate. The championship is decided by the last regular-season stack, and it is decided before anyone knows the playoff seeding.

### Players who disappear

Nobody gets removed for going quiet. A player who stops submitting is folded automatically every week and keeps paying antes into other people's Pots until they land on the felt. They stay in the standings and remain eligible for the tiebreaker they will not need.

**Deactivation is a different thing and requires them to say so** (§13). A player who has actually quit stops anteing, drops out of the median, and keeps their chips — but forfeits the championship and every season award (§11). A player who has merely gone dark keeps all three, and keeps paying.

### A word about collusion

The multiplier is set by **head count, not chips**, so a 10-chip bet moves the price exactly as much as a 50-chip bet. In principle a group could coordinate to pile onto a side and crush someone's payout.

In practice it doesn't work: to move the price they'd all have to take the bad price themselves. It costs the conspirators more than the target. Left alone deliberately.

### The one number you'll be tempted to change

**The 2.50× cap.** Raise it and contrarians get stronger, the league runs hotter, and more people reach the felt. Lower it and the popular side becomes viable, which is the one thing this game is built to prevent. If you touch anything after season one, touch this — and touch it once, in the offseason.


---

## APPENDIX — what the simulation found

2,500 seasons per configuration, 12 players, eight behavioral archetypes.

| Archetype | Win rate | Median finish |
|---|---|---|
| Sharp — takes dogs on near-pick'ems the room over-favors | **14.0%** | **528** |
| Maniac — few games, maximum chips | 13.0% | 446 |
| Fader — contrarian for its own sake | 10.0% | 390 |
| Chalk Eater — always the popular side | 7.0% | 474 |
| Coin Flipper | 6.0% | 390 |
| Homer | 6.0% | 379 |
| Balanced | 6.0% | 410 |
| The Folder | **1.0%** | 299 |

Chance is 8.3% per seat. The Sharp is the only archetype whose median finish beats the 500 it started with. The Maniac wins outright nearly as often — concentrated aggression wins tournaments — but ends a typical season 80 chips behind. Both are viable, which is the point: the person who wants to think and the person who wants to shove both have a real path.

**Final stack distribution** (all players, all seasons):

| p25 | median | p75 | p90 | p99 | max |
|---|---|---|---|---|---|
| 171 | 419 | 743 | 1,094 | 1,800 | 2,681 |

- **Mean final stack: 501.** League drift +0.2% — chips are conserved exactly.
- **42.8%** of players finish above their 500 buy-in
- **2.1 of 12 players** end on the felt
- **4.6 lead changes** per season

### How decided is it at midseason?

| | Wk 10 leader wins | Wk 14 leader wins |
|---|---|---|
| **ANTE** | **40.4%** | 51.4% |
| A classic confidence pool | 46.3% | 62.5% |
| Theoretical floor* | 33.6% | 45.0% |

\* Twelve *identical* players with zero skill difference. In any game where score accumulates, having more chips in Week 10 means having more chips in Week 18 — that floor cannot be removed without a playoff or a reset.

ANTE runs about four points above the floor and nine points more open at midseason than the pool it replaces.

### Does it hold at any league size?

Tested from 8 players to 40, final ruleset:

| Players | Bettors per game | Hits the 2.5× cap | Hits the 0.25 floor | Skill vs chance | Wk 10 leader wins |
|---|---|---|---|---|---|
| 8 | 4.8 | 18% | 10% | 1.26× | 47% |
| 12 | 7.6 | 22% | 11% | 1.55× | 37% |
| 20 | 11.6 | 21% | 10% | 1.59× | 37% |
| 28 | 15.5 | 20% | 9% | 1.35× | 36% |
| 40 | 21.0 | 18% | 7% | 1.17× | 30% |

**Mean final stack is exactly 500 at every size** — conservation holds regardless of scale. The cap and floor bind at nearly the same rate whether a game drew five bettors or twenty-two, so the payout rule needs no adjustment for league size. Skill beats chance everywhere, and larger leagues are *less* decided at midseason, not more.

The only thing that needed scaling was the Pot, which is why it now pays one place per eight players.

---

## THE FINE PRINT

Chips carry no cash value, no emotional value, and no value recognized by any court in this or any adjacent jurisdiction. The house limit exists to protect you from yourself and will not be lifted on request, on appeal, or on the grounds that you have a really good feeling about this one. A shove pays even money regardless of who else was on it; the house does not offer odds on desperation. Management reserves the right to invent rules retroactively and to deny having done so. Ties, pushes, and acts of weather are settled by the Commissioner, who is not licensed, bonded, or especially interested. Complaints must be submitted in writing, notarized, and set on fire. By placing a chip you acknowledge that your father-in-law will finish above you and that no reason will be given.