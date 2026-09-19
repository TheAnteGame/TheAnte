// GIFs in Table Talk (D-094). A message carries a GIF as a plain link on its own
// line; nothing is uploaded and no file is stored. Only the two providers' media
// hosts render as an image — any other link stays a link — so a body cannot embed
// an arbitrary image, a tracking pixel, or a hotlinked file. One image per message.

const GIF_HOSTS = ["media.tenor.com", "c.tenor.com", "media1.tenor.com", "media.giphy.com", "i.giphy.com"];

/** The GIF url when a line is exactly one provider link, else null. */
export function gifUrlOf(line: string): string | null {
  const t = line.trim();
  if (!/^https:\/\/\S+$/.test(t)) return null;
  try {
    const u = new URL(t);
    if (!GIF_HOSTS.includes(u.hostname)) return null;
    if (!/\.(gif|webp|mp4)$/i.test(u.pathname) && !u.hostname.endsWith("tenor.com")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Split a body into the text to show and the first GIF to render, if any. */
export function extractGif(body: string): { text: string; gif: string | null } {
  const lines = body.split("\n");
  let gif: string | null = null;
  const kept: string[] = [];
  for (const l of lines) {
    const g: string | null = gif ? null : gifUrlOf(l);
    if (g) gif = g;
    else kept.push(l);
  }
  return { text: kept.join("\n").trim(), gif };
}
