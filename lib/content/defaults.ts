// Seeded defaults for every content block (ANTE-ADMIN §4.4).
// A missing content_blocks row must never render an empty page: getContent falls back
// here. These strings are also the seed data for the content_blocks table.
// The rulebook's voice is the target register — dry, deadpan, never zany.

export const contentDefaults: Record<string, string> = {
  // Homepage
  "home.logo_alt": "ANTE",
  "home.intro_heading": "The room is forming.",
  "home.intro_body":
    "A season-long NFL chip pool. Everyone starts with 500. Nobody sees a pick until everyone is locked in. Biggest stack on the last Sunday wins.",
  "home.phone_label": "Phone number",
  "home.phone_placeholder": "Enter phone number",
  "home.phone_cta": "Send code",
  "home.code_prompt": "Enter the six-digit code we texted you.",
  "home.legal_line": "Chips have no cash value. None. Ever.",
  "home.copyright": "© 2026 The Ante Game",
  "home.pending_message":
    "You're on the list. The Commissioner reviews every application before Week 1. You'll get a text when you're in.",
  "home.closed_message":
    "The roster locked at the Week 1 deadline. Everybody starts at 500 on the same Thursday or not at all. There's always next season.",
  "home.verify_cta": "Verify",
  "home.resend_label": "Send a new code",
  "home.signed_in_cta": "You're already in \u2014 take me to my seat",

  // Onboarding / profile
  "profile.heading": "Take your seat",
  "profile.intro_body": "Four questions and you're in the room.",
  "profile.first_name_label": "First name",
  "profile.last_name_label": "Last name",
  "profile.email_label": "Email",
  "profile.favorite_team_label": "Favorite team",
  "profile.submit_label": "Continue",
  "profile.error_generic": "That didn't take. Try again.",

  // How-to-play tutorial (gate between profile complete and dashboard)
  "howto.heading": "How this works",
  "howto.intro": "Eight steps, two minutes, no chips move. Then you're in the room.",
  "howto.step_label": "Step {step} of {total}",
  "howto.next_cta": "Next",
  "howto.back_cta": "Back",
  "howto.skip_cta": "Skip to the end",
  "howto.accept_cta": "I've got it — take me in",
  "howto.error_generic": "That didn't take. Try again.",











  // The eight steps — owner's copy verbatim (2026-08-22 rewrite; wireframes in the
  // session record). Two accuracy fixes agreed with the owner: "every few weeks" (the
  // ante tiers are week ranges, not game counts) and "gains the most chips" (the Pot
  // pays the biggest weekly GAIN, not the biggest stack \u2014 the distinction people argue).
  "howto.s1_title": "It's a Pick'em Pool",
  "howto.s1_sub": "But Weighted",
  "howto.s1_body":
    "Every week you'll pick at least 5 games to wager on. Select the teams you think will win. Add more chips (weight) to teams you're more confident in. Select a team here to stack chips.",
  "howto.s2_title": "The Big Reveal",
  "howto.s2_sub": "Each Week",
  "howto.s2_body":
    "Once everyone has made their picks, the game board reveals everyone's picks in a single view. See who bet on what games and teams to see how you'll stack up over the weekend.",
  "howto.s3_title": "The Weekly Payout",
  "howto.s3_sub": "For Most",
  "howto.s3_body":
    "If your weekly bets followed the crowd, your payout is much less. Select underdogs, sleepers and less popular games with the right weight (chips) and your payout multiplies.",
  "howto.s4_title": "Winning the Week",
  "howto.s4_sub": "The Pot",
  "howto.s4_body":
    "The player who gains the most chips for the week wins the weekly pot. Every week, each player will ante automatically. The ante goes up every few weeks; we start at 10 (one chip).",
  "howto.s5_title": "Season Champion",
  "howto.s5_sub": "There's One",
  "howto.s5_body":
    "You start the season with 500 chips. Betting aggressively or more conservatively changes the strategy. The player with the most chips at the end of week 18 is crowned champion.",
  "howto.s6_title": "Going for Broke",
  "howto.s6_sub": "The Felt",
  "howto.s6_body":
    "The game is designed to keep people playing all season without going absolutely broke. Complete details about how this works can be found in the Rule Book; open to everyone.",
  "howto.s7_title": "Other Game Plays",
  "howto.s7_sub": "Like Poker",
  "howto.s7_body":
    "Two moves borrowed from the card table. Both live on your ticket every week \u2014 and like everything else, the room only finds out at the reveal.",
  "howto.s8_title": "You're All Set",
  "howto.s8_sub": "Let's Play",
  "howto.s8_body":
    "This tutorial covered the basics to get everyone playing. For those that would like the full rule book, it is available at all times in the top-right of the website. Enjoy.",

  // Step visuals \u2014 labels for the sample boards and worked examples.
  "howto.viz_sample_note": "Sample \u2014 fake players, fake games",
  "howto.ex_crowd_title": "Follow the crowd",
  "howto.ex_crowd_line": "You and 5 others take KC. 3 take BUF. KC wins.",
  "howto.ex_crowd_result": "30 chips at 0.50\u00d7 pays +15",
  "howto.ex_dog_title": "Find the underdog",
  "howto.ex_dog_line": "You alone take JAX. 4 take TEN. JAX wins.",
  "howto.ex_dog_result": "30 chips at 2.50\u00d7 pays +75",
  "howto.viz_pot_total": "Total Pot",
  "howto.viz_your_stack": "Your Stack",
  "howto.viz_winner": "Winner",
  "howto.viz_champion_note": "Final stacks after Week 18",
  "howto.viz_felt_note": "A cold season never zeroes out \u2014 the last chip is protected, and you're still dealt in every week.",
  "howto.shove_title": "The Shove",
  "howto.shove_body":
    "Once a season you can push your entire stack onto one game. One team, everything you have. A shove always pays even money: win and you double, lose and you're on the felt.",
  "howto.fold_title": "Folding",
  "howto.fold_body":
    "Don't like the slate? Fold. You sit the week out, pay only the ante, and keep the rest of your stack. A fold never wins the Pot \u2014 but it never loses big either.",
  "howto.learn_more": "Learn more",
  "howto.link_rules": "Gamebook \u2014 the rules",
  "howto.link_guide": "How to Play \u2014 plain English",

  // Dashboard
  "dash.commissioner_link_label": "Commissioner",
  "dash.header_rank_label": "Rank",
  "dash.header_chips_label": "Chips",
  "dash.logout_label": "Log out",
  "dash.guide_link_label": "How to Play",
  "dash.tutorial_link_label": "Tutorial",
  "guide.heading": "How to Play",
  "guide.intro": "ANTE is a season-long football pool. You bet chips on NFL games. The biggest stack on the last Sunday wins. Here is the whole thing in plain English.",
  "guide.back_cta": "Back to the game board",
  "guide.tutorial_cta": "Run the tutorial again",
  "guide.rules_cta": "The Rule Book",
  "guide.rules_note": "This page is the short version. The rulebook is the real thing, and it wins any argument.",
  "guide.start_title": "You start with 500 chips",
  "guide.start_body": "Everyone in the league starts with the same 500 chips. Nobody can buy more. Chips are just points \u2014 they are never worth money. The season runs from Week 1 to Week 18.",
  "guide.ante_title": "Every week you pay an ante",
  "guide.ante_body": "An ante is a small fee you pay before you bet. Everyone pays it, even if you sit the week out. It starts at 10 chips and grows to 30 chips by the end of the season. Every ante goes straight into the Pot.",
  "guide.pick_title": "Pick games and put chips on them",
  "guide.pick_body": "The slate opens Tuesday at 6:00am ET. Pick the team you like in each game, then put chips on it. You bet in tens: at least 10 chips on a game, and no more than 50. You have to bet at least 5 games. You cannot bet both teams in the same game. The deadline is Thursday at 12:00 noon ET, every single week.",
  "guide.lock_title": "Once you send it in, it is locked",
  "guide.lock_body": "When you submit your picks, you cannot change them. Neither can the Commissioner. So take your time before you press the button. If you send nothing by Thursday noon, you folded for the week \u2014 and you still pay the ante.",
  "guide.limit_title": "The house limit keeps you safe",
  "guide.limit_body": "There is a cap on how many chips you can bet in one week. It is one third of your own stack, or one third of the league's middle stack \u2014 whichever is smaller. So you can never lose everything in a single week. It also stops a big leader from running away from everyone else.",
  "guide.blackout_title": "Nobody sees anything until everyone is in",
  "guide.blackout_body": "Before the reveal you cannot see anyone's picks. Not their teams, not their chips, not even a count. Nothing on the screen moves. The only thing you can see is the list of people who have not sent their picks in yet. The reveal happens the moment the last player is in.",
  "guide.payout_title": "How much you win",
  "guide.payout_body": "Your payout depends on how many people took the other side of your game. Take the number of people against you and divide it by the number of people with you \u2014 and you count yourself. So being alone against four is 4 divided by 1. The most you can ever get is 2.5 times your bet. The least is a quarter of it. If nobody took the other side, you get even money. Only the people who bet that same game count.",
  "guide.strategy_title": "How to actually win",
  "guide.strategy_body": "Here is the part people miss. What you win depends on how many players took the other side of your game. If you and nine others all back the same team, you are splitting the room and the win is small \u2014 as low as a quarter of what you bet. If you are the only one on your side against four, that is four against one, and you get the most the game allows: two and a half times your bet.\n\nSo the goal is not to pick the games everyone else is picking. The goal is to find the game where you think the room is wrong, and be right about it. Safe picks keep you alive. Different picks win Pots.\n\nAnd you are betting blind. Nobody sees a single pick until everyone is in. All you have is the spread, the moneyline, and what you know about these specific people \u2014 you already know who takes the prime-time favorite every single week. Reading that is the whole game.",
  "guide.pot_title": "The Pot",
  "guide.flow_title": "Your bets and the Pot are two different things",
  "guide.flow_body": "Two things happen every week and they are easy to mix up. First, your bets: chips move between you and the other players who bet the same games. Nothing is created \u2014 what you win, somebody else lost. Second, the Pot: everyone's ante goes into it, and at the end of the week the whole thing goes to whoever gained the most chips. So your bets decide how far your stack moves, and the Pot is the prize for moving it the most. Playing it safe keeps you alive, but it almost never wins a Pot.",
  "guide.pot_body": "Every ante that week goes into the Pot, and none of it disappears. It goes to whoever gained the most chips that week \u2014 your ante counts in that, so you can win the Pot on a week you finished down, as long as everyone else finished down further. You have to have turned in a ticket: folding pays you nothing. In a league of 8 to 15, one player takes the whole Pot. Bigger leagues pay more places \u2014 one for every 8 players. If every single person folds, nothing is awarded and the Pot rolls into next week.",
  "guide.shove_title": "The shove",
  "guide.shove_body": "Once a season you can go all in. You pick one game and push your whole stack onto it. It ignores the house limit \u2014 that is the point. You pay no ante that week, and you make no other bets. A shove always pays even money: win and you double your stack. Lose and you are on the felt. Nobody sees it coming until the reveal.",
  "guide.felt_title": "The felt",
  "guide.felt_body": "Your stack can never drop below 1 chip. If your stack falls below one full ante, you are on the felt. You stop paying the ante, and the 5-game minimum goes away \u2014 bet what you have, on whatever you want. You are not out. Nobody in this league is ever out.",
  "guide.win_title": "How you win the season",
  "guide.win_body": "Biggest stack after Week 18 wins. If two players tie, we look at who had the most winning bets. Still tied? Most Pots won, then fewest weeks folded, then one public card draw.",
  "dash.wager.heading": "Game Board",
  "dash.wager.closed_message": "The slate opens Tuesday at 6:00am ET.",
  "dash.wager.submitted_message": "Your ticket is in. Locked. No edits — not by you, not by anyone.",
  "dash.wager.blackout_notice": "Nobody sees a pick until everyone is in.",
  "dash.wager.waiting_on_label": "Waiting on",
  "dash.wager.confirm_title": "Push your chips in?",
  "dash.wager.confirm_body":
    "Submitting locks this ticket. It cannot be changed — not by you, not by the Commissioner, not for injuries, weather, or regret.",
  "dash.wager.shove_warning":
    "The shove commits your entire stack to one game at even money. Once per season. No other bets this week. Type SHOVE to confirm.",
  "dash.wager.ante_label": "Ante paid",
  "dash.wager.limit_label": "House limit",
  "dash.wager.committed_label": "Committed",
  "dash.wager.remaining_label": "Remaining",
  "dash.wager.games_label": "Games",
  "dash.wager.submit_cta": "Push your chips in",
  "dash.wager.confirm_cta": "Lock it",
  "dash.wager.cancel_cta": "Not yet",
  "dash.wager.shove_mode_cta": "The shove",
  "dash.wager.shove_spent_label": "Shove spent — Week {week}",
  "dash.wager.shove_commit_note": "You'll push {stake}, including the {ante} ante coming back at the reveal.",
  "dash.wager.shove_dark_note": "Nobody will know until the reveal. Not even the Commissioner.",
  "dash.wager.spread_note":
    "The spread and the moneyline come from the sportsbooks and are frozen when the slate opens. Neither one pays here: bets settle straight-up, and what you win is set by how the room split (rulebook \u00a75).",
  "dash.wager.submit_tooltip":
    "Locks your picks in for the week. You'll get one confirmation first. After that there are no edits \u2014 not by you, not by the Commissioner.",
  // Arming the shove (D-040): an explainer gate BEFORE shove mode, distinct from the
  // type-SHOVE gate that guards the commit itself.
  "dash.wager.shove_arm_title": "Use your shove?",
  "dash.wager.shove_arm_body":
    "A shove pushes your entire stack onto one game, at even money — win and you double, lose and you're on the felt. You get one per season, and using it replaces your other bets this week.",
  "dash.wager.shove_arm_note": "This only arms it. You still pick your game and confirm before anything is committed.",
  "dash.wager.shove_arm_cta": "Arm the shove",
  "dash.wager.shove_tooltip":
    "Once a season: push your whole stack onto one game. Win and it pays big. Lose and you're on the felt. Nobody sees it until the reveal.",
  "dash.wager.at_label": "at",
  "dash.wager.raise_hint":
    "Back a team by pressing it. Every press raises your stake — one more past {max} takes the bet back off the table.",
  "dash.wager.felt_notice": "You're on the felt: bet what you have, on whatever you want.",
  "dash.wager.capped_room": "capped by the room",
  "dash.wager.capped_stack": "capped by your stack",
  "dash.wager.min_games_note": "Pick at least {min} games.",
  "dash.wager.min_games_note_one": "Pick at least one game.",
  // Notification templates (ADMIN §4.7) — email season one (D-001)
  "notify.slate_open": "Week {week} is open. The ante was {ante}; your limit is {limit}. Thursday noon is the wall.",
  "notify.reminder": "Week {week}: {hours_left} hours to the wall, and your name is on the waiting list.",
  "notify.final_call": "Final call for Week {week}. Submit by noon ET or you're folded — and you still owe the ante.",
  "notify.nudge": "The room is waiting on you. Everyone can see it.",
  "notify.reveal": "The room is open — every Week {week} ticket is live.",
  "notify.settled": "Week {week} settled: {delta} on the week. Stack {stack}, rank {rank}.",
  "notify.pot": "{winner} takes the Week {week} Pot: +{amount}.",
  "notify.correction": "Commissioner correction on Week {week}: {reason}. Every correction is public.",

  // Stakes band (art §3 — the one big colored plane)
  "band.week_label": "Week",
  "band.tier_purple": "Purple tier",
  "band.tier_red": "Red tier",
  "band.tier_teal": "Teal tier",
  "band.tier_gold": "Gold tier",
  "band.ante_label": "Ante",
  "band.pot_label": "The Pot",
  "band.limit_label": "Your limit",
  "band.deadline_label": "Deadline",
  "band.preseason_message": "Preseason. The roster is forming — Week 1 locks {lock}.",

  // Ticker system items (ADMIN §4.5.3 — wording is content-managed)
  "ticker.deadline": "Thursday noon ET — {remaining}",
  "ticker.waiting_on": "{in} of {total} in — waiting on {names}",
  "ticker.pot": "This week's Pot: {pot} chips",
  "ticker.marker": "The Pot is carrying a {marker}-chip marker",
  "ticker.reveal": "The room is open — every ticket is live",
  "ticker.leader": "{name} leads with {stack}",
  // Rulebook Q&A on the dashboard (D-037) — the ten questions the room actually
  // asks. Answers compress the rulebook, never contradict it; §-precision lives at
  // /rules and every answer defers there.
  "faq.heading": "Quick answers",
  "faq.more": "The full rulebook settles everything \u2192",
  "faq.q1": "How do I win the season?",
  "faq.a1":
    "Biggest stack after the Week 18 games settle. Ties break by most winning bets, then most Pots won, then fewest folds, then one public card draw.",
  "faq.q2": "Why did my stack drop before I bet anything?",
  "faq.a2":
    "The ante. Every week costs one \u2014 10 chips to start, rising to 30 by season's end \u2014 posted automatically when the slate opens. Every ante goes into the Pot.",
  "faq.q3": "How much can I bet?",
  "faq.q4": "How do payouts work?",
  "faq.a3":
    "10 to 50 chips per game, in tens, on at least 5 games. The week's total is capped at one third of your stack or one third of the league's middle stack \u2014 whichever is smaller.",
  "faq.a4":
    "Head counts, not odds: the people against you divided by the people with you, counting yourself. Alone against four pays 2.50\u00d7 \u2014 the cap. Riding with the crowd pays a fraction \u2014 the floor is 0.25\u00d7. Nobody on the other side pays even money.",
  "faq.q5": "When do I see everyone's picks?",
  "faq.a5":
    "At the reveal: the moment the last ticket lands, or Thursday noon ET \u2014 whichever comes first. Until then you see nothing. Not a pick, not a chip, not a count.",
  "faq.q6": "Can I change my ticket after submitting?",
  "faq.a6": "No. Not you, not the Commissioner, not for any reason. Submitted is stone.",
  "faq.q7": "What happens if I skip a week?",
  "faq.a7":
    "You're folded automatically at the deadline. You still pay the ante, and a fold can never win the Pot. Miss three weeks running with no ticket at all and the Commissioner may remove you under the deadweight rule \u2014 your chips are then split evenly across everyone still playing. Submitting anything, even a fold you chose, resets that count to zero.",
  "faq.q8": "Who wins the weekly Pot?",
  "faq.a8":
    "Whoever GAINS the most chips that week, ante included \u2014 not the biggest stack. Every ante in the league is in it, and in bigger leagues it pays more places.",
  "faq.q9": "What's the shove?",
  "faq.a9":
    "Once a season you can push your entire stack onto one game. It always pays even money: win and you double, lose and you're on the felt.",
  "faq.q10": "Can I go broke and get knocked out?",
  "faq.a10":
    "Not by losing. Your last chip is protected, you're dealt into every week, and on the felt you bet 1-chip slips until you climb back. The only way out of this league is not turning up at all \u2014 three straight weeks without a ticket and the Commissioner may remove the seat (\u00a714).",

  "ticker.leader_tied": "{count} players tied at the top on {stack} \u2014 nobody leads yet",

  // Promo box (fields editable in the admin console)
  "promo.heading": "",
  "promo.body": "",
  "promo.cta_label": "",
  "promo.cta_url": "",
  "promo.image_url": "",

  // Season page
  "season.standings_heading": "Final standings",
  "season.awards_heading": "Awards",
  "season.unclaimed": "unclaimed",
  "season.mark_label": "The Mark",
  "season.mark_open": "ballot open — felt finishers only",
  "season.not_closed": "Computed when the season closes. Every ticket stays readable forever.",
  "season.mark_vote_heading": "The Mark — your vote",
  "season.mark_vote_body": "You finished on the felt, which makes this yours to give. One vote. Anyone is nominable.",
  "season.cast_cta": "Cast it",
  "dash.wager.total_label": "Total",
  "reveal.you_label": "you",

  "reveal.interstitial_title": "The room is open",
  "reveal.interstitial_sub": "Every ticket. Every chip. Nothing can change now.",
  "reveal.enter_cta": "See the board",
  "reveal.shove_beat_title": "A shove",
  "reveal.shove_beat_body": "{name} pushed everything. {stake} on {team}, even money. It moved every price on the board.",
  "results.heading": "Results",
  "results.empty": "No week has been revealed yet. The board opens the moment the last ticket lands.",
  "results.back_cta": "Back to the game board",
  "dash.results_link_label": "Results",
  "dash.wager.revealed_title": "The room is open",
  "dash.wager.revealed_body": "Every ticket in the league is live. See who was with you and who faded the room.",
  "dash.wager.revealed_cta": "See the board",
  "reveal.by_h2h_label": "Head to head",
  "reveal.h2h_record": "weeks played together",
  "reveal.h2h_note": "Who out-gained who, week by week. Bragging rights only \u2014 no chips ride on this.",
  "reveal.by_season_label": "By season",
  "reveal.season_record": "W\u2013L",
  "reveal.season_chalk": "Chalk",
  "reveal.season_big_price": "2.00\u00d7+",
  "reveal.season_avg": "Avg \u00d7",
  "reveal.season_folds": "Folds",
  "reveal.season_best": "Best week",
  "reveal.season_backs": "Backs most",
  "reveal.by_game_label": "By game",
  "reveal.by_player_label": "By player",
  "reveal.folded_label": "Folded",
  "reveal.shove_label": "Shove",
  "reveal.pays_label": "pays",
  "reveal.nobody_label": "Nobody",
  "dash.leaderboard.heading": "Standings",
  "dash.leaderboard.empty": "No stacks to show yet.",
  "lb.rank": "#",
  "lb.player": "Player",
  "lb.stack": "Stack",
  "lb.delta": "Δ wk",
  "lb.won": "W",
  "lb.lost": "L",
  "lb.win_pct": "Win %",
  "lb.pots": "Pots",
  "lb.folds": "Folds",
  "lb.avg_mult": "Avg ×",
  "lb.shove": "Shove",
  "lb.shove_held": "Held",
  "lb.felt_badge": "Felt",
  "lb.out_badge": "Out",
  "settled.heading": "Week {week} — settled",
  "settled.delta_label": "Your week, ante included",
  "settled.pot_label": "The Pot",
  "settled.pot_none": "Nobody took the Pot this week. It rolls.",
  "settled.pot_marker": "The table is into the Pot for {marker}. The marker carries.",
  "settled.stack_label": "Your stack",
  "settled.rank_label": "Rank",
  "settled.won_label": "Won",
  "settled.lost_label": "Lost",
  "settled.returned_label": "Returned",

  // The Pot explained (§7/§14) — the one number the room argues about.
  "potmath.heading": "How Week {week} was won",
  "potmath.rule":
    "The Pot goes to the biggest chip gain of the week — winnings minus losses, with your ante counted against you. Not the biggest stack. Not the most bets right.",
  "potmath.places": "{players} playing, {places} places paid: {split}.",
  "potmath.places_unpaid": "{players} playing. The split would have been {split}.",
  "potmath.one_place": "{players} playing, one place paid.",
  "potmath.pool": "The Pot held {pool}.",
  "potmath.paid": "{awarded} paid out.",
  "potmath.rolled": "{rolled} could not be split evenly, so it rolls to next week.",
  "potmath.rolled_all": "Nothing was paid, so all of it rolls.",
  "potmath.marker": "The Pot is under water by {marker}. Nobody wins one until it is paid back.",
  "potmath.gain_label": "Week gain",
  "potmath.took_label": "Took",
  "potmath.folded_label": "Folded — not eligible",
  "potmath.split_note": "Place {place} split {ways} ways.",
  "potmath.you": "You",
  "potmath.room_label": "The room",
  "dash.tabletalk.heading": "Table Talk",
  "dash.tabletalk.live_label": "Chat with the league",
  "dash.tabletalk.placeholder": "Say it to the whole room…",
  "dash.tabletalk.muted_notice": "You're muted until {expiry}. You can read, and you can still bet.",
  "dash.tabletalk.tombstone": "— a message was hidden by the Commissioner —",
  "dash.tabletalk.help_aria": "How Table Talk works",
  "dash.tabletalk.help_title": "How Table Talk works",
  "dash.tabletalk.help_mentions":
    "Type @ and a name to call somebody out \u2014 pick from the list that pops up. They get an email pointing them back to the room. Five mentions per message, tops.",
  "dash.tabletalk.help_emoji":
    "Emojis work everywhere: tap the \ud83d\ude42 by the send button, or use your keyboard \u2014 Ctrl+\u2318+Space on a Mac, Win+. on Windows, the emoji key on your phone.",
  "dash.tabletalk.emoji_aria": "Add an emoji",
  "dash.news.heading": "Your team",
  "dash.news.source_label": "Source",
  "dash.news.empty": "Quiet day. Nothing worth reading.",
  "dash.promo.fallback_heading": "ANTE",
  "dash.stats.heading": "League stats",
  "dash.stats.empty": "Nothing settled yet. The first numbers land after Week 1 scores.",
  "dash.stats.biggest_week": "Biggest week",
  "dash.stats.best_price": "Best price",
  "dash.stats.coldest_take": "Coldest take",
  "dash.stats.hot_hand": "Hot hand",
  "dash.stats.week_label": "weeks up",
  "dash.support.cta": "Message the desk",
  "dash.support.dialog_title": "Message the desk",
  "dash.support.dialog_intro": "We already know who you are, so just say what is going on. The Commissioner reads every one of these.",
  "dash.support.placeholder": "What do you need?",
  "dash.support.submit_cta": "Send it",
  "dash.support.cancel_cta": "Never mind",
  "dash.support.sent_title": "Message sent",
  "dash.support.sent_body": "The Commissioner has been told there is a message waiting. When they answer, the reply comes to the email address on your profile \u2014 you do not need to check back here.",
  "dash.support.close_cta": "Done",
  "notify.mention_subject": "ANTE \u2014 {author} mentioned you at the table",
  "notify.mention": "{author} mentioned you in Table Talk:\n\n{message}\n\nAnswer them at https://theantegame.com/dashboard",
  "notify.backup_reminder_subject": "ANTE \u2014 your league backup is due",
  "notify.backup_reminder": "It has been {days} days since you last saved a copy of the league.\n\nOpen the Commissioner console, go to Backups, press \"Download current data\", then press \"I've got the file\" so this stops nagging you.\n\nThis is the only copy that survives losing the database, so it is worth the thirty seconds.",
  "notify.support_new_subject": "ANTE \u2014 new message from {player}",
  "notify.support_new": "{player} sent a message from the dashboard:\n\n{message}\n\nAnswer it in the console under Support.",
  "notify.support_reply_subject": "ANTE \u2014 the Commissioner answered",
  "notify.support_reply": "You wrote:\n\n{original}\n\nThe Commissioner replied:\n\n{reply}",
  "dash.support.heading": "Need a human?",
  "dash.support.body": "Message the desk. Complaints must be notarized and set on fire, but questions are fine.",

  // Rules / awards / misc
  "rules.intro":
    "The complete rules, frozen for the season. Versioned with the code — nobody can edit these at 11pm, including the Commissioner.",
  "awards.intro": "They cost nothing. They carry more weight than they should.",
  "sms.optin_disclosure":
    "We'll text you a login code now and league updates during the season. Reply STOP anytime to opt out of updates.",
  "error.404": "There's nothing here. There may never have been.",
  "error.500": "Something broke on our end. The ledger is fine. It's always fine.",
  "empty.no_games": "No games on the slate.",
  "empty.no_news": "Nothing to report.",
};

export type ContentKey = keyof typeof contentDefaults;
