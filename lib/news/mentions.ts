// Does a league-wide headline actually concern one team (D-100)?
//
// The club's own feed tags its items with a team code; the league desks (ESPN, CBS)
// tag nothing, so their Broncos stories look identical to their Packers stories.
// The nickname is the reliable signal: all 32 are unique across the league, while
// cities are not — "New York" is two teams and "Los Angeles" is two more.
//
// Word boundaries are the whole point. A bare substring test puts "Jalen RAMSEY"
// and "proGRAMS" in a Rams fan's box, and "CHIEFS of staff" in a Chiefs fan's. The
// database prefilters with a cheap ilike; this is what decides.

export function mentionsTeam(title: string, nickname: string): boolean {
  if (!nickname) return false;
  const escaped = nickname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Singular too: "a Bronco" is about the Broncos. Only when the plural ends in s.
  const singular = /s$/i.test(escaped) ? `|${escaped.slice(0, -1)}` : "";
  return new RegExp(`(?:^|[^A-Za-z])(?:${escaped}${singular})(?![A-Za-z])`, "i").test(title);
}
