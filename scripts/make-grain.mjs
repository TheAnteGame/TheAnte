/*
 * Generates the seamless grain tile the table is built on (`public/tex/grain.png`).
 *
 * The old ground was a 512px photograph of felt, and a photograph does not tile:
 * its edges never matched, so the page showed a grid of seams (D-057). This makes
 * the tile procedurally instead, so it is seamless by construction — every noise
 * lattice wraps modulo the tile, which means the right edge IS the left edge and
 * the bottom edge IS the top.
 *
 * It is deliberately almost all high-frequency: fine grain over a very shallow
 * cloud. Anything with large-scale structure would announce the repeat.
 *
 *   node scripts/make-grain.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 512;
const OUT = new URL("../public/tex/grain.png", import.meta.url);

/* Levels are matched to the ground this replaces, measured off the old swatch as
   it was actually composited (felt.jpg, mean 29.8 / sd 5.1, at 50% over the #0b0b0d
   canvas): mean ≈ 20, sd ≈ 2.5. The tone of the table does not change — only the
   seams leave. */
const BASE = 20.4;
const CLOUD = 3.6; // ± soft clumping, the thing that keeps it from looking digital
const GRAIN = 5.6; // ± per-pixel fibre

/* Felt has the odd fibre catching the light, and that sparkle is most of why the
   photograph read as cloth rather than as noise. A flat distribution never makes
   one, so the bright tail is drawn separately and sparsely. */
const FLECK_P = 0.018;
const FLECK_MIN = 2;
const FLECK_MAX = 22;

/* Cloth is not symmetric about its mean. Between the fibres are pits the light
   never reaches, and on top of them are tips that catch it — so the dark side of
   the distribution runs deeper than the bright side, and the bright side is carried
   by the flecks instead. Symmetric noise is what makes a texture read as printed. */
const PIT = 1.4; // how much further the dark half travels
const TIP = 0.72; // how much the bright half is held back

/* Matted fibre, not a weave: short filaments at unrelated angles. A single shared
   angle would be a nap, and a nap is the near relation of the weave that is not
   wanted here. Each one is drawn with wrapped coordinates, so a filament running off
   the right edge arrives on the left and the tile stays seamless. */
const FIBRES = 2600;
const FIBRE_LEN = [3.5, 10]; // px
const FIBRE_LIT = 0.64; // the rest lie in their own shadow

/* Deterministic PRNG — the tile must be reproducible from this file alone. */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x0a17e);

/* Value noise on a lattice of `f` cells across the tile. Indices are taken mod f,
   so the interpolation wraps: this is what makes the result tileable. */
function lattice(f) {
  const v = new Float64Array(f * f);
  for (let i = 0; i < v.length; i++) v[i] = rand() * 2 - 1;
  return v;
}
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function sample(v, f, x, y) {
  const gx = (x * f) / SIZE;
  const gy = (y * f) / SIZE;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = smooth(gx - x0);
  const ty = smooth(gy - y0);
  const xa = ((x0 % f) + f) % f;
  const ya = ((y0 % f) + f) % f;
  const xb = (xa + 1) % f;
  const yb = (ya + 1) % f;
  const a = v[ya * f + xa] * (1 - tx) + v[ya * f + xb] * tx;
  const b = v[yb * f + xa] * (1 - tx) + v[yb * f + xb] * tx;
  return a * (1 - ty) + b * ty;
}

/* Octaves are all powers of two so every one divides the tile exactly. The lowest
   is 4 cells across, not 1 or 2: a single blob per tile would be a visible motif. */
const OCTAVES = [
  [4, 0.5],
  [8, 0.62],
  [16, 0.5],
  [32, 0.34],
  [64, 0.2],
  [128, 0.12],
];
const fields = OCTAVES.map(([f, amp]) => [lattice(f), f, amp]);
const norm = OCTAVES.reduce((s, [, amp]) => s + amp, 0);

/* Filaments are laid down first, into their own accumulation buffer, because they
   overlap each other and have to add rather than overwrite. */
const fibre = new Float32Array(SIZE * SIZE);

function deposit(x, y, a) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  for (let dy = 0; dy < 2; dy++) {
    const yy = (((y0 + dy) % SIZE) + SIZE) % SIZE;
    const wy = dy ? fy : 1 - fy;
    for (let dx = 0; dx < 2; dx++) {
      const xx = (((x0 + dx) % SIZE) + SIZE) % SIZE;
      fibre[yy * SIZE + xx] += a * wy * (dx ? fx : 1 - fx);
    }
  }
}

for (let i = 0; i < FIBRES; i++) {
  const cx = rand() * SIZE;
  const cy = rand() * SIZE;
  const th = rand() * Math.PI * 2;
  const len = FIBRE_LEN[0] + rand() * (FIBRE_LEN[1] - FIBRE_LEN[0]);
  const lit = rand() < FIBRE_LIT;
  const peak = lit ? 1.6 + rand() * 3.1 : -(1.1 + rand() * 2.1);
  const steps = Math.ceil(len * 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    /* Tapered at both ends — a fibre fades into the mat rather than stopping dead. */
    const a = peak * Math.sin(Math.PI * t) * 0.5;
    deposit(cx + Math.cos(th) * (t - 0.5) * len, cy + Math.sin(th) * (t - 0.5) * len, a);
  }
}

const field = new Float32Array(SIZE * SIZE);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let cloud = 0;
    for (const [v, f, amp] of fields) cloud += sample(v, f, x, y) * amp;
    cloud /= norm;

    /* Triangular grain rather than flat: fewer extremes, so it reads as fibre and
       not as television static. It doubles as the dither for the quantise. */
    const g = rand() + rand() - 1;
    const grain = g < 0 ? g * PIT : g * TIP;

    const fleck = rand() < FLECK_P ? FLECK_MIN + rand() * (FLECK_MAX - FLECK_MIN) : 0;

    field[y * SIZE + x] = BASE + cloud * CLOUD + grain * GRAIN + fleck + fibre[y * SIZE + x];
  }
}

/* Re-centre on the target mean. The skew, the flecks and the fibres each pull the
   average off BASE by a little, and the tone of the table is the one thing that is
   not up for negotiation between passes. */
let sum = 0;
for (const v of field) sum += v;
const drift = BASE - sum / field.length;
for (let i = 0; i < field.length; i++) field[i] += drift;

/* The tile lives inside a narrow slice of near-black, so it ships as a 16-entry
   palette at 4 bits a pixel — half the bytes of greyscale. Thirteen entries span the
   body of the distribution, at a step well under the grain itself, which dithers it;
   the last three are spread across the bright tail, where the flecks and lit fibre
   tips are far too rare to deserve even spacing. */
const BODY_LEVELS = 13;
const sorted = Float32Array.from(field).sort();
const pct = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const LO = pct(0.0005);
const HI = pct(0.995);
const TAIL = pct(0.99999);
const PALETTE = [
  ...Array.from({ length: BODY_LEVELS }, (_, i) => LO + (i * (HI - LO)) / (BODY_LEVELS - 1)),
  HI + (TAIL - HI) * 0.25,
  HI + (TAIL - HI) * 0.55,
  TAIL,
].map((v) => Math.max(0, Math.min(255, Math.round(v))));

function quantise(lum) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const d = Math.abs(PALETTE[i] - lum);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const px = new Uint8Array(SIZE * SIZE);
for (let i = 0; i < field.length; i++) px[i] = quantise(field[i]);

/* ── PNG (4-bit indexed, no dependencies) ──────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 4; // bit depth
ihdr[9] = 3; // colour type: indexed
// 10-12: deflate / adaptive filtering / no interlace, all zero

const plte = Buffer.alloc(PALETTE.length * 3);
PALETTE.forEach((g, i) => {
  plte[i * 3] = g;
  plte[i * 3 + 1] = g;
  plte[i * 3 + 2] = g;
});

/* Filter 0 on every scanline; noise does not predict, so the fancier filters only
   add work and bytes. Two pixels to the byte, high nibble first. */
const stride = SIZE / 2;
const raw = Buffer.alloc((stride + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const row = y * (stride + 1) + 1;
  for (let x = 0; x < SIZE; x += 2) {
    raw[row + x / 2] = (px[y * SIZE + x] << 4) | px[y * SIZE + x + 1];
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("PLTE", plte),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(`${OUT.pathname} — ${SIZE}×${SIZE}, ${(png.length / 1024).toFixed(1)} KB`);
