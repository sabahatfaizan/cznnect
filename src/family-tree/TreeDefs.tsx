import { memo } from "react";
import { LINEAGE_COLORS } from "./layout";
import { mulberry32 } from "./rng";

type V = { x: number; y: number };

/** One leaf, pointing along `angle`, baked into absolute coordinates so a clump is a single path. */
function leafPath(at: V, angle: number, length: number, width: number): string {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const tr = (x: number, y: number) => `${(at.x + x * c - y * s).toFixed(1)} ${(at.y + x * s + y * c).toFixed(1)}`;
  const L = length;
  const W = width;
  return `M${tr(0, 0)}C${tr(L * 0.3, W)} ${tr(L * 0.8, W * 0.8)} ${tr(L, 0)}C${tr(L * 0.8, -W * 0.8)} ${tr(L * 0.3, -W)} ${tr(0, 0)}Z`;
}

/** Leaf clump variants (dark mass + lighter top leaves), deterministic for SSR. */
function clump(seed: number) {
  const r = mulberry32(seed);
  const dark: string[] = [];
  const light: string[] = [];
  const vein: string[] = [];
  for (let i = 0; i < 11; i++) {
    const ang = r() * Math.PI * 2;
    const d = 6 + r() * 30;
    const at = { x: Math.cos(ang) * d, y: Math.sin(ang) * d * 0.85 };
    const dir = ang + (r() - 0.5) * 1.2;
    const L = 16 + r() * 13;
    const W = 5 + r() * 3.5;
    const p = leafPath(at, dir, L, W);
    if (i < 7) dark.push(p);
    else light.push(p);
    if (i >= 7) {
      const c = Math.cos(dir);
      const s = Math.sin(dir);
      vein.push(`M${at.x.toFixed(1)} ${at.y.toFixed(1)}L${(at.x + c * L * 0.85).toFixed(1)} ${(at.y + s * L * 0.85).toFixed(1)}`);
    }
  }
  return { dark: dark.join(""), light: light.join(""), vein: vein.join("") };
}

const CLUMPS = [clump(11), clump(29), clump(57)];

/** Shared SVG definitions: wood, soil, light, portrait clip, leaf symbols. */
export const TreeDefs = memo(function TreeDefs() {
  return (
    <defs>
      <clipPath id="ft-clip" clipPathUnits="objectBoundingBox">
        <circle cx="0.5" cy="0.5" r="0.5" />
      </clipPath>

      <linearGradient id="ft-trunk" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{ stopColor: "var(--ft-bark-deep)" }} />
        <stop offset="0.22" style={{ stopColor: "var(--ft-bark-light)" }} />
        <stop offset="0.5" style={{ stopColor: "var(--ft-bark)" }} />
        <stop offset="0.82" style={{ stopColor: "var(--ft-bark-dark)" }} />
        <stop offset="1" style={{ stopColor: "var(--ft-bark-deep)" }} />
      </linearGradient>

      <radialGradient id="ft-ring" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" style={{ stopColor: "var(--ft-ring-hi)" }} />
        <stop offset="0.55" style={{ stopColor: "var(--ft-ring)" }} />
        <stop offset="1" style={{ stopColor: "var(--ft-bark-deep)" }} />
      </radialGradient>
      <radialGradient id="ft-ring-dusk" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" style={{ stopColor: "var(--ft-dusk-hi)" }} />
        <stop offset="0.6" style={{ stopColor: "var(--ft-dusk)" }} />
        <stop offset="1" style={{ stopColor: "var(--ft-bark-deep)" }} />
      </radialGradient>
      <radialGradient id="ft-ring-lit" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" style={{ stopColor: "var(--ft-lit-hi)" }} />
        <stop offset="0.6" style={{ stopColor: "var(--ft-lit)" }} />
        <stop offset="1" style={{ stopColor: "var(--ft-bark-dark)" }} />
      </radialGradient>

      {Array.from({ length: LINEAGE_COLORS }, (_, i) => (
        <radialGradient key={i} id={`ft-mono-${i}`} cx="0.4" cy="0.32" r="0.75">
          <stop offset="0" style={{ stopColor: `color-mix(in oklab, var(--ft-leaf-${i}) 60%, var(--ft-parchment))` }} />
          <stop offset="1" style={{ stopColor: `color-mix(in oklab, var(--ft-leaf-${i}) 70%, var(--ft-night))` }} />
        </radialGradient>
      ))}
      <radialGradient id="ft-mono-f" cx="0.4" cy="0.32" r="0.75">
        <stop offset="0" style={{ stopColor: "var(--ft-lit-hi)" }} />
        <stop offset="1" style={{ stopColor: "var(--ft-bark)" }} />
      </radialGradient>
      <radialGradient id="ft-mono-a" cx="0.4" cy="0.32" r="0.75">
        <stop offset="0" style={{ stopColor: "var(--ft-root-hi)" }} />
        <stop offset="1" style={{ stopColor: "var(--ft-root)" }} />
      </radialGradient>

      <radialGradient id="ft-shadow">
        <stop offset="0" style={{ stopColor: "var(--ft-night)", stopOpacity: 0.55 }} />
        <stop offset="1" style={{ stopColor: "var(--ft-night)", stopOpacity: 0 }} />
      </radialGradient>
      <radialGradient id="ft-glow" cx="0.5" cy="0.55" r="0.5">
        <stop offset="0" style={{ stopColor: "var(--ft-sun)", stopOpacity: 0.22 }} />
        <stop offset="0.6" style={{ stopColor: "var(--ft-sun)", stopOpacity: 0.06 }} />
        <stop offset="1" style={{ stopColor: "var(--ft-sun)", stopOpacity: 0 }} />
      </radialGradient>
      <linearGradient id="ft-soil" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style={{ stopColor: "var(--ft-soil-top)" }} />
        <stop offset="0.05" style={{ stopColor: "var(--ft-soil)" }} />
        <stop offset="1" style={{ stopColor: "var(--ft-night)" }} />
      </linearGradient>

      {CLUMPS.map((c, i) => (
        <symbol key={i} id={`ft-leaf-${i}`} overflow="visible">
          <path d={c.dark} fill="currentColor" />
          <path d={c.light} fill="currentColor" />
          <path d={c.light} className="ft-leaf-sheen" />
          <path d={c.vein} className="ft-leaf-vein" />
        </symbol>
      ))}
    </defs>
  );
});
