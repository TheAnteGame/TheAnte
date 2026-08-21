// The gem treatment, built the way the art direction actually specifies it
// (art §5): irregular triangular planes, hard edges between them, each plane a
// flat fill, all of them lit from the upper left. No gradients, no glow, no blur.
//
// Before D-008 this was a 45° repeating-linear-gradient hatch, which is a stripe,
// not a facet. Reserved for the surfaces §5 names: the stakes band, the homepage,
// the reveal, empty states and the promo box — never behind a number.

const W = 1200;
const H = 200;

/** Deterministic jitter. The field must be identical on the server and the client. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Facet {
  d: string;
  /** 0 = deepest plane, 1 = brightest. Derived from distance to the light. */
  shade: number;
}

function buildField(seed: number, cols: number, rows: number): Facet[] {
  const rng = mulberry32(seed);
  const colW = W / (cols - 1);
  const rowH = H / (rows - 1);

  // A jittered lattice — irregular, but never degenerate.
  const pts: { x: number; y: number }[][] = [];
  for (let c = 0; c < cols; c++) {
    const col: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const edgeX = c === 0 || c === cols - 1;
      const edgeY = r === 0 || r === rows - 1;
      col.push({
        x: c * colW + (edgeX ? 0 : (rng() - 0.5) * colW * 0.7),
        y: r * rowH + (edgeY ? 0 : (rng() - 0.5) * rowH * 0.8),
      });
    }
    pts.push(col);
  }

  const facets: Facet[] = [];
  const tri = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
    const cx = (a.x + b.x + c.x) / 3 / W;
    const cy = (a.y + b.y + c.y) / 3 / H;
    // Light sits off the upper-left corner; a plane's tone falls off away from it.
    const lit = 1 - Math.min(1, Math.hypot(cx + 0.15, cy + 0.3) / 1.5);
    facets.push({
      d: `M${Math.round(a.x)} ${Math.round(a.y)}L${Math.round(b.x)} ${Math.round(b.y)}L${Math.round(c.x)} ${Math.round(c.y)}Z`,
      // Quantised to five steps: flat planes, not a smooth ramp.
      shade: Math.min(1, Math.max(0, lit * 0.85 + rng() * 0.3)),
    });
  };

  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const flip = (c + r) % 2 === 0;
      const tl = pts[c][r];
      const tr = pts[c + 1][r];
      const bl = pts[c][r + 1];
      const br = pts[c + 1][r + 1];
      if (flip) {
        tri(tl, tr, bl);
        tri(tr, br, bl);
      } else {
        tri(tl, tr, br);
        tri(tl, br, bl);
      }
    }
  }
  return facets;
}

// Five flat tones: three below the base plane, two above it.
const RAMP: { key: "deep" | "bright"; opacity: number }[] = [
  { key: "deep", opacity: 0.72 },
  { key: "deep", opacity: 0.38 },
  { key: "deep", opacity: 0.12 },
  { key: "bright", opacity: 0.16 },
  { key: "bright", opacity: 0.36 },
];

interface FacetsProps {
  deep: string;
  base: string;
  bright: string;
  /** Change to re-cut the field; the same seed always cuts the same gem. */
  seed?: number;
  cols?: number;
  rows?: number;
  className?: string;
}

export function Facets({ deep, base, bright, seed = 7, cols = 13, rows = 4, className }: FacetsProps) {
  const facets = buildField(seed, cols, rows);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden focusable="false">
      <rect width={W} height={H} fill={base} />
      {facets.map((f, i) => {
        const step = RAMP[Math.round(f.shade * (RAMP.length - 1))];
        return <path key={i} d={f.d} fill={step.key === "deep" ? deep : bright} fillOpacity={step.opacity} />;
      })}
    </svg>
  );
}
