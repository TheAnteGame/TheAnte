import "server-only";

// One layout, two renderings. Every league email is described as a list of blocks and
// then rendered TWICE, once as branded HTML and once as plain text, from that single
// description. The point is parity: a player whose client refuses HTML gets the same
// facts in the same order as everyone else, and neither version can drift from the
// other, because there is only one source (D-056).
//
// Table-based, inline-styled, no webfonts. The palette is the site's own tokens, and
// the design is dark ON PURPOSE. The color-scheme meta pair tells Gmail and Apple
// Mail not to invert it, and [data-ogsc] restates every colour for Outlook.com, which
// rewrites them regardless.

const C = {
  canvas: "#0b0b0d",
  card: "#131316",
  well: "#1b1b20",
  well2: "#24242a",
  hi: "#f2f2f4",
  mid: "#cfcfd8",
  low: "#a6a6b0",
  chrome: "#e8e8ec",
  gold: "#c9a24b",
  purpleDeep: "#2e1856",
  purple: "#4c2a8e",
  purpleBright: "#8b5fd6",
  win: "#4d9a6a",
  loss: "#bd5b5b",
} as const;

const SANS = "Helvetica,Arial,sans-serif";

export type Block =
  | { kind: "lead"; text: string }
  | { kind: "para"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "stats"; items: Array<{ label: string; value: string }> }
  | { kind: "table"; caption?: string; head: string[]; rows: string[][] }
  | { kind: "note"; title?: string; text: string }
  | { kind: "cta"; label: string; href: string; sub?: string }
  | { kind: "signoff"; name: string; role: string; paras: string[] }
  | { kind: "rule" };

export interface EmailDoc {
  /** Inbox preview line. */
  preheader: string;
  /** Gold eyebrow above the headline. */
  eyebrow: string;
  /** The big italic headline. */
  headline: string;
  blocks: Block[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── HTML ─────────────────────────────────────────────────────────────────────────

const pad = "padding-left:40px;padding-right:40px;";

function htmlBlock(b: Block): string {
  switch (b.kind) {
    case "lead":
      return `<tr><td bgcolor="${C.card}" class="bg-card px" style="background-color:${C.card};${pad}padding-top:0;padding-bottom:16px;"><p class="t-mid" style="margin:0;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.mid};">${b.text}</p></td></tr>`;
    case "para":
      return `<tr><td bgcolor="${C.card}" class="bg-card px" style="background-color:${C.card};${pad}padding-top:0;padding-bottom:16px;"><p class="t-mid" style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.mid};">${b.text}</p></td></tr>`;
    case "steps":
      return `<tr><td bgcolor="${C.card}" class="bg-card px" style="background-color:${C.card};${pad}padding-top:6px;padding-bottom:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${b.items
        .map(
          (t, i) =>
            `<tr><td class="num" width="40" valign="top" style="width:40px;padding:0 0 18px 0;font-family:${SANS};font-size:15px;font-weight:800;color:${C.gold};line-height:1.55;">${String(i + 1).padStart(2, "0")}</td><td valign="top" class="t-mid" style="padding:0 0 18px 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.mid};">${t}</td></tr>`,
        )
        .join("")}</table></td></tr>`;
    case "stats":
      return `<tr><td bgcolor="${C.card}" class="bg-card px" style="background-color:${C.card};${pad}padding-top:4px;padding-bottom:22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${b.items
        .map(
          (s) =>
            `<td class="stack" align="center" bgcolor="${C.well}" style="background-color:${C.well};padding:14px 8px;border:1px solid #2a2a31;"><div class="t-low" style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.low};padding-bottom:5px;">${s.label}</div><div class="t-hi" style="font-family:${SANS};font-size:22px;font-weight:800;color:${C.hi};">${s.value}</div></td><td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>`,
        )
        .join("")}</tr></table></td></tr>`;
    case "table":
      return `<tr><td bgcolor="${C.card}" class="bg-card px" style="background-color:${C.card};${pad}padding-top:2px;padding-bottom:22px;">${
        b.caption
          ? `<p class="t-gold" style="margin:0 0 10px 0;font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${C.gold};font-weight:700;">${b.caption}</p>`
          : ""
      }<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #2a2a31;"><tr>${b.head
        .map(
          (h) =>
            `<td bgcolor="${C.well2}" style="background-color:${C.well2};padding:9px 12px;font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.low};font-weight:700;">${h}</td>`,
        )
        .join("")}</tr>${b.rows
        .map(
          (r, i) =>
            `<tr>${r
              .map(
                (c) =>
                  `<td bgcolor="${i % 2 ? C.well : C.card}" style="background-color:${i % 2 ? C.well : C.card};padding:10px 12px;font-family:${SANS};font-size:14px;line-height:1.45;color:${C.mid};border-top:1px solid #2a2a31;">${c}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")}</table></td></tr>`;
    case "note":
      return `<tr><td bgcolor="${C.well}" class="bg-well px" style="background-color:${C.well};${pad}padding-top:22px;padding-bottom:22px;border-left:3px solid ${C.gold};">${
        b.title
          ? `<p class="t-gold" style="margin:0 0 10px 0;font-family:${SANS};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${C.gold};font-weight:700;">${b.title}</p>`
          : ""
      }<p class="t-mid" style="margin:0;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.mid};">${b.text}</p></td></tr>`;
    case "cta":
      return `<tr><td bgcolor="${C.card}" class="bg-card px" style="background-color:${C.card};${pad}padding-top:12px;padding-bottom:32px;" align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin:0 auto;"><tr><td bgcolor="${C.chrome}" align="center" style="background-color:${C.chrome};padding:15px 38px;"><a href="${b.href}" style="font-family:${SANS};font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${C.canvas};text-decoration:none;display:inline-block;">${b.label} &rarr;</a></td></tr></table>${
        b.sub
          ? `<p class="t-low" style="margin:15px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.low};">${b.sub}</p>`
          : ""
      }</td></tr>`;
    case "signoff":
      return `<tr><td bgcolor="${C.well}" class="bg-well px" style="background-color:${C.well};${pad}padding-top:30px;padding-bottom:30px;border-left:3px solid ${C.gold};"><p class="t-gold" style="margin:0 0 14px 0;font-family:${SANS};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${C.gold};font-weight:700;">Why I built this</p>${b.paras
        .map(
          (p) =>
            `<p class="t-mid" style="margin:0 0 14px 0;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.mid};">${p}</p>`,
        )
        .join("")}<p class="t-hi" style="margin:4px 0 0 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.hi};font-weight:700;">${b.name}<br /><span class="t-low" style="color:${C.low};font-weight:400;font-size:13px;letter-spacing:1px;text-transform:uppercase;">${b.role}</span></p></td></tr>`;
    case "rule":
      return `<tr><td bgcolor="${C.card}" class="bg-card" style="background-color:${C.card};padding:0 40px;"><div style="height:1px;background-color:#2a2a31;font-size:0;line-height:0;">&nbsp;</div></td></tr>`;
  }
}

export function renderHtml(doc: EmailDoc): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="dark" /><meta name="supported-color-schemes" content="dark" />
<title>${esc(doc.headline)}</title>
<style type="text/css">
:root { color-scheme: dark; supported-color-schemes: dark; }
body { margin:0 !important; padding:0 !important; width:100% !important; background-color:${C.canvas} !important; }
table { border-collapse:collapse !important; }
img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; display:block; }
a { text-decoration:none; }
[data-ogsc] .bg-canvas { background-color:${C.canvas} !important; }
[data-ogsc] .bg-card { background-color:${C.card} !important; }
[data-ogsc] .bg-well { background-color:${C.well} !important; }
[data-ogsc] .t-hi { color:${C.hi} !important; }
[data-ogsc] .t-mid { color:${C.mid} !important; }
[data-ogsc] .t-low { color:${C.low} !important; }
[data-ogsc] .t-gold { color:${C.gold} !important; }
@media only screen and (max-width:620px) {
  .wrap { width:100% !important; }
  .px { padding-left:22px !important; padding-right:22px !important; }
  .h1 { font-size:30px !important; }
  .logo { width:150px !important; height:auto !important; }
  .num { width:34px !important; }
  .stack { display:block !important; width:100% !important; margin-bottom:8px !important; }
}
</style></head>
<body class="bg-canvas" style="margin:0;padding:0;background-color:${C.canvas};">
<div style="display:none;font-size:1px;color:${C.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(doc.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.canvas}" class="bg-canvas" style="background-color:${C.canvas};">
<tr><td align="center" style="padding:28px 12px 40px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td bgcolor="${C.purpleDeep}" style="background-color:${C.purpleDeep};background-image:linear-gradient(135deg,${C.purpleDeep} 0%,${C.purple} 62%,#3a1f6e 100%);padding:32px 30px 28px 30px;text-align:center;border-top:2px solid ${C.purpleBright};">
<img src="https://theantegame.com/logo.png" width="170" alt="ANTE" class="logo" style="width:170px;max-width:68%;height:auto;margin:0 auto;" /></td></tr>
<tr><td bgcolor="${C.gold}" style="background-color:${C.gold};font-size:0;line-height:0;height:2px;">&nbsp;</td></tr>
<tr><td bgcolor="${C.card}" class="bg-card px" style="background-color:${C.card};${pad}padding-top:36px;padding-bottom:14px;">
<p class="t-gold" style="margin:0 0 10px 0;font-family:${SANS};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${C.gold};font-weight:700;">${esc(doc.eyebrow)}</p>
<h1 class="h1 t-hi" style="margin:0;font-family:${SANS};font-size:36px;line-height:1.06;letter-spacing:1px;text-transform:uppercase;color:${C.hi};font-weight:800;font-style:italic;">${esc(doc.headline)}</h1>
</td></tr>
${doc.blocks.map(htmlBlock).join("\n")}
<tr><td bgcolor="${C.gold}" style="background-color:${C.gold};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
<tr><td bgcolor="${C.canvas}" class="bg-canvas px" style="background-color:${C.canvas};${pad}padding-top:24px;padding-bottom:8px;" align="center">
<p class="t-gold" style="margin:0 0 10px 0;font-family:${SANS};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.gold};font-weight:700;">Chips have no cash value. None. Ever.</p>
<p class="t-low" style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.low};"><a href="https://theantegame.com" style="color:${C.low};text-decoration:underline;">theantegame.com</a> &nbsp;&middot;&nbsp; You are getting this because you have a seat in the league.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

// ── Plain text, from the same blocks ─────────────────────────────────────────────

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&rarr;/g, "->").replace(/&middot;/g, "-").replace(/&nbsp;/g, " ");
const rule = "------------------------------------------------------------";

function textBlock(b: Block): string {
  switch (b.kind) {
    case "lead":
    case "para":
      return strip(b.text);
    case "steps":
      return b.items.map((t, i) => `${String(i + 1).padStart(2, "0")}. ${strip(t)}`).join("\n\n");
    case "stats":
      return b.items.map((s) => `${s.label.toUpperCase()}: ${strip(s.value)}`).join("\n");
    case "table": {
      const w = b.head.map((_, i) => Math.max(b.head[i].length, ...b.rows.map((r) => strip(r[i] ?? "").length)));
      const line = (cells: string[]) => cells.map((c, i) => strip(c).padEnd(w[i])).join("  ").trimEnd();
      return [b.caption ? b.caption.toUpperCase() : "", line(b.head), w.map((n) => "-".repeat(n)).join("  "), ...b.rows.map(line)]
        .filter(Boolean)
        .join("\n");
    }
    case "note":
      return [b.title ? b.title.toUpperCase() : "", strip(b.text)].filter(Boolean).join("\n");
    case "cta":
      return [`${b.label.toUpperCase()}: ${b.href}`, b.sub ? strip(b.sub) : ""].filter(Boolean).join("\n");
    case "signoff":
      return ["WHY I BUILT THIS", ...b.paras.map(strip), `${b.name} - ${b.role}`].join("\n\n");
    case "rule":
      return rule;
  }
}

export function renderText(doc: EmailDoc): string {
  return [
    "ANTE",
    rule,
    doc.eyebrow.toUpperCase(),
    doc.headline.toUpperCase(),
    "",
    ...doc.blocks.map(textBlock).filter((s) => s.trim().length > 0),
    "",
    rule,
    "Chips have no cash value. None. Ever.",
    "theantegame.com",
  ].join("\n\n");
}

export function render(doc: EmailDoc): { html: string; text: string } {
  return { html: renderHtml(doc), text: renderText(doc) };
}
