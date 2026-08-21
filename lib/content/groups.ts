// Plain-English map of the content namespaces. The keys stay as they are — they are
// how the code finds a string — but the commissioner should never have to reverse
// engineer "band" from the front end to know which box they are editing.

export interface GroupInfo {
  /** What the commissioner would call it. */
  title: string;
  /** Where on the site it shows up. */
  where: string;
}

const CONTENT_GROUPS: Record<string, GroupInfo> = {
  home: { title: "Sign-in page", where: "The logged-out homepage: headline, blurb, phone field, legal line, footer." },
  join: { title: "Joining the league", where: "The join and waiting screens people see before they are approved." },
  onboarding: { title: "Onboarding", where: "The profile form a new player fills in after their first sign-in." },
  profile: { title: "Profile page", where: "The player's own profile screen and its error messages." },
  howto: { title: "Tutorial (click-through)", where: "The interactive tutorial every player walks through once, and can replay." },
  guide: { title: "How to Play page", where: "The written instructions page at /guide, linked from the dashboard header." },
  rules: { title: "Rulebook intro", where: "The one editable line above the rulebook. The rulebook itself ships with the code." },
  dash: { title: "Dashboard", where: "The main player screen: header, Game Board, bet slip, Table Talk, news, support." },
  band: { title: "Stakes band", where: "The big coloured bar across the top of the dashboard — week, tier, ante, Pot, limit, deadline." },
  ticker: { title: "Ticker lines", where: "The wording of the scrolling rail's league facts. Speed, colour and posts live under Ticker." },
  lb: { title: "Leaderboard columns", where: "The column headings and badges on the standings table." },
  reveal: { title: "The reveal", where: "The interstitial and board shown when the week opens and every ticket turns over." },
  settled: { title: "Settled week", where: "The results view after a week is scored and the Pot is awarded." },
  season: { title: "Season page", where: "The season summary, awards and history screen." },
  awards: { title: "Season awards", where: "Award names and descriptions." },
  promo: { title: "Promo box", where: "Your announcement slot on the dashboard. Leave the heading empty and the box does not show." },
  notify: { title: "Emails", where: "Subject lines and bodies of the emails the app sends players." },
  sms: { title: "SMS", where: "The text-message opt-in wording. SMS is not switched on yet (D-001)." },
  error: { title: "Error messages", where: "Generic failure messages shown when something goes wrong." },
  empty: { title: "Empty states", where: "What a screen says when there is nothing to show yet." },
};

export function groupInfo(prefix: string): GroupInfo {
  return CONTENT_GROUPS[prefix] ?? { title: prefix, where: "" };
}
