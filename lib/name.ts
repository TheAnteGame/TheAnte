/** Normalizes a player-entered name to Title Case ("john smith" -> "John Smith"),
 *  so self-service onboarding and commissioner edits can't leave inconsistent
 *  casing on the roster (D-064). Capitalizes the first letter of every run of
 *  letters, so hyphenated and apostrophized names ("mary-jane", "o'brien") come
 *  out reasonably too, even though no casing rule gets every surname right. */
export function titleCase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[a-z]+/gi, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
