// Table Talk formatting (D-084): plain text in, blocks out. No markup language — a
// player types what they would type in a text message. Two conventions are read:
//
//   - a line starting with "-", "*" or "•" and a space is a bullet
//   - a line starting with "1." / "1)" and a space is a numbered item
//
// Consecutive items form one list; everything else is a paragraph, with single
// line breaks kept (rendered whitespace-pre-line) and blank lines separating
// paragraphs. A message with no line breaks is exactly one paragraph, so the
// existing single-line look is untouched. Pure and tested; the component only maps.

export type Block = { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*\S.*)$/;
const NUMBERED = /^\s*\d{1,2}[.)]\s+(.*\S.*)$/;

export function blocksOf(body: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length > 0) {
      out.push({ kind: "p", text: para.join("\n") });
      para = [];
    }
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const b = line.match(BULLET);
    const n = b ? null : line.match(NUMBERED);
    const kind: "ul" | "ol" | null = b ? "ul" : n ? "ol" : null;
    if (kind) {
      flush();
      const item = (b ?? n)![1].trim();
      const last = out[out.length - 1];
      if (last && last.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out;
}

/** True when the body is one plain paragraph — the inline, single-line rendering. */
export function isPlain(blocks: Block[]): boolean {
  return blocks.length === 1 && blocks[0].kind === "p" && !blocks[0].text.includes("\n");
}
