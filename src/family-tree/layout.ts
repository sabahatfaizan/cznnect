/**
 * Organic tree layout. Pure geometry — no React, no DOM.
 *
 * Mapping (genealogy -> tree):
 *   roots   : ancestors of the founding couple (the family's origins)
 *   trunk   : the founding couple — the ancestry every branch shares
 *   limbs   : each child of the founders starts a lineage (major branch)
 *   canopy  : later generations grow outward/upward; each lineage keeps its own foliage cluster
 *
 * The layout never invents relationships: every branch connects a person to a recorded parent.
 */
import { FamilyGraph, birthYear, firstName, subtypeRank } from "./graph";
import type { ParentSubtype } from "./types";
import { noise, rngFor } from "./rng";

export type Pt = { x: number; y: number };

export const R_PRIMARY = 24;
export const R_PARTNER = 16;
export const R_FOUNDER = 36;
export const R_ANCESTOR = 22;
export const LINEAGE_COLORS = 8;

const DEG = Math.PI / 180;
/** Spread of a family's children around the parent's growth direction. */
const FAN = 158 * DEG;
/** Spread of the lineages around the crown. */
const FAN_ROOT = 186 * DEG;
/** Room each person needs (portrait + name plate), and extra per partner locket. */
const NODE_R = 72;
const PARTNER_R = 22;
const GAP = 10;
const LIMB_SAMPLES = 12;

/* ------------------------------------------------------------------ */
/* Full family tree (independent of what is collapsed)                 */
/* ------------------------------------------------------------------ */

export interface UnitNode {
  /** id of the unit = id of its primary (blood-line) person */
  id: string;
  primaryId: string;
  /** partners who married into the family, drawn as lockets beside the primary */
  partnerIds: string[];
  gen: number;
  parent: UnitNode | null;
  children: UnitNode[];
  subtype: ParentSubtype | null;
  size: number;
  lineage: number;
}

export interface FullTree {
  founding: UnitNode;
  foundingIds: string[];
  units: Map<string, UnitNode>;
  unitOfPerson: Map<string, string>;
  rootAncestors: Map<string, number>;
}

export function findFounder(graph: FamilyGraph): string | null {
  const ids = [...graph.people.keys()];
  if (ids.length === 0) return null;
  const parentless = ids.filter((id) => graph.parentsOf(id).length === 0);
  const pool = parentless.length ? parentless : ids;
  let best = pool[0] as string;
  let bestScore = -1;
  for (const id of pool) {
    const s = graph.descendants(id).size;
    const p = graph.get(id);
    const b = graph.get(best);
    const older = p && b && (birthYear(p) ?? 99999) < (birthYear(b) ?? 99999);
    if (s > bestScore || (s === bestScore && older)) {
      best = id;
      bestScore = s;
    }
  }
  // Walk down single-child generations: they become roots, the trunk starts where the family branches.
  let cur = best;
  for (let hop = 0; hop < 8; hop++) {
    const members = [cur, ...graph.partnersOf(cur).map((p) => p.person.id)];
    const kids = new Set<string>();
    for (const m of members) for (const c of graph.childrenOf(m)) kids.add(c.person.id);
    const only = kids.size === 1 ? [...kids][0] : undefined;
    if (only && graph.descendants(only).size > 0) cur = only;
    else break;
  }
  return cur;
}

export function buildFullTree(graph: FamilyGraph): FullTree | null {
  const primary = findFounder(graph);
  if (!primary) return null;
  const partnerIds = graph.partnersOf(primary).map((p) => p.person.id);
  const foundingIds = [primary, ...partnerIds].sort((a, b) => {
    const pa = graph.get(a);
    const pb = graph.get(b);
    return (pa ? (birthYear(pa) ?? 99999) : 0) - (pb ? (birthYear(pb) ?? 99999) : 0);
  });

  const descSet = new Set<string>();
  for (const f of foundingIds) for (const d of graph.descendants(f).keys()) descSet.add(d);
  for (const f of foundingIds) descSet.delete(f);

  const placed = new Set<string>(foundingIds);
  const founding: UnitNode = {
    id: primary,
    primaryId: primary,
    partnerIds,
    gen: 0,
    parent: null,
    children: [],
    subtype: null,
    size: 0,
    lineage: -1,
  };
  const units = new Map<string, UnitNode>([[founding.id, founding]]);
  const unitOfPerson = new Map<string, string>();
  for (const f of foundingIds) unitOfPerson.set(f, founding.id);

  const queue: UnitNode[] = [founding];
  while (queue.length) {
    const u = queue.shift() as UnitNode;
    if (u.gen > 40) continue;
    const members = [u.primaryId, ...u.partnerIds];
    const kidMap = new Map<string, ParentSubtype | null>();
    for (const m of members)
      for (const c of graph.childrenOf(m)) {
        if (placed.has(c.person.id)) continue;
        const prev = kidMap.get(c.person.id);
        if (!kidMap.has(c.person.id) || subtypeRank(c.subtype) < subtypeRank(prev ?? null))
          kidMap.set(c.person.id, c.subtype);
      }
    const kids = [...kidMap.entries()].sort((a, b) => {
      const pa = graph.get(a[0]);
      const pb = graph.get(b[0]);
      return (pa ? (birthYear(pa) ?? 99999) : 0) - (pb ? (birthYear(pb) ?? 99999) : 0);
    });
    for (const [kid] of kids) placed.add(kid);
    kids.forEach(([kid, subtype], index) => {
      const partners = graph
        .partnersOf(kid)
        .map((p) => p.person.id)
        .filter((p) => !placed.has(p) && !descSet.has(p));
      for (const p of partners) placed.add(p);
      const child: UnitNode = {
        id: kid,
        primaryId: kid,
        partnerIds: partners,
        gen: u.gen + 1,
        parent: u,
        children: [],
        subtype,
        size: 0,
        lineage: u.gen === 0 ? index : u.lineage,
      };
      u.children.push(child);
      units.set(kid, child);
      unitOfPerson.set(kid, kid);
      for (const p of partners) unitOfPerson.set(p, kid);
      queue.push(child);
    });
  }

  const sizeOf = (u: UnitNode): number => {
    u.size = 1 + u.partnerIds.length + u.children.reduce((s, c) => s + sizeOf(c), 0);
    return u.size;
  };
  sizeOf(founding);

  const rootAncestors = new Map<string, number>();
  for (const f of foundingIds)
    for (const [id, depth] of graph.ancestors(f)) {
      if (placed.has(id) || depth > 7) continue;
      const prev = rootAncestors.get(id);
      if (prev === undefined || depth < prev) rootAncestors.set(id, depth);
    }

  return { founding, foundingIds, units, unitOfPerson, rootAncestors };
}

/** Collapse deep generations by default when a family is very large. */
export function defaultCollapsed(full: FullTree | null): Set<string> {
  const out = new Set<string>();
  if (!full || full.units.size <= 150) return out;
  for (const u of full.units.values()) if (u.gen >= 3 && u.children.length) out.add(u.id);
  return out;
}

/** Unit ids that must be expanded for a person to become visible. */
export function unitsToReveal(full: FullTree, personId: string): string[] {
  const unitId = full.unitOfPerson.get(personId);
  if (!unitId) return [];
  const out: string[] = [];
  let u = full.units.get(unitId)?.parent ?? null;
  while (u) {
    out.push(u.id);
    u = u.parent;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Scene (what is drawn)                                               */
/* ------------------------------------------------------------------ */

export type PersonRole = "founder" | "descendant" | "partner" | "ancestor";

export interface PlacedPerson {
  id: string;
  unitId: string | null;
  x: number;
  y: number;
  r: number;
  role: PersonRole;
  lineage: number;
  gen: number;
  /** where the node sprouts from when it first appears */
  from: Pt;
}

export interface SceneUnit {
  id: string;
  x: number;
  y: number;
  gen: number;
  lineage: number;
  collapsed: boolean;
  hasChildren: boolean;
  hidden: number;
  knob: Pt;
  memberIds: string[];
}

export type LimbKind = "branch" | "twig" | "root" | "decor";

export interface Limb {
  id: string;
  kind: LimbKind;
  lineage: number;
  body: string;
  highlight: string;
  shade: string;
  grain: string;
  w0: number;
  start: Pt;
  childUnitId: string | null;
  parentUnitId: string | null;
  /** person ids at both ends, for lineage highlighting */
  ends: [string, string] | null;
  graft: { x: number; y: number; angle: number; w: number } | null;
  label: { path: string; text: string; size: number } | null;
}

export interface LeafClump {
  id: string;
  x: number;
  y: number;
  s: number;
  rot: number;
  v: number;
  lineage: number;
  layer: "back" | "front";
}

export interface Trunk {
  body: string;
  grain: string[];
  highlight: string;
  shade: string;
  knots: { x: number; y: number; rx: number; ry: number; rot: number }[];
  height: number;
  topW: number;
  baseW: number;
}

export interface TreeScene {
  placed: PlacedPerson[];
  placedById: Map<string, PlacedPerson>;
  units: SceneUnit[];
  limbs: Limb[];
  roots: Limb[];
  leaves: LeafClump[];
  trunk: Trunk;
  grass: string;
  canopy: { cx: number; cy: number; rx: number; ry: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  lineageCount: number;
  familyLabel: string;
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const P = (p: Pt) => `${f1(p.x)} ${f1(p.y)}`;
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const rot = (a: Pt, ang: number): Pt => ({
  x: a.x * Math.cos(ang) - a.y * Math.sin(ang),
  y: a.x * Math.sin(ang) + a.y * Math.cos(ang),
});
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}
function cubicTan(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

interface LimbGeom {
  body: string;
  highlight: string;
  shade: string;
  grain: string;
  center: Pt[];
  tangents: Pt[];
}

/** A tapered, curved limb built from a cubic spine. Fixed point count so paths can morph. */
export function limbGeometry(p0: Pt, c1: Pt, c2: Pt, p3: Pt, w0: number, w1: number): LimbGeom {
  const L: Pt[] = [];
  const R: Pt[] = [];
  const C: Pt[] = [];
  const T: Pt[] = [];
  const H: Pt[] = [];
  const S: Pt[] = [];
  const G: Pt[] = [];
  // light comes from the upper left: pick the side facing it for the highlight
  const midTan = norm(cubicTan(p0, c1, c2, p3, 0.5));
  const midN = { x: -midTan.y, y: midTan.x };
  const lightSide = midN.x * -0.6 + midN.y * -0.8 > 0 ? 1 : -1;
  for (let i = 0; i <= LIMB_SAMPLES; i++) {
    const t = i / LIMB_SAMPLES;
    const b = cubicAt(p0, c1, c2, p3, t);
    const d = norm(cubicTan(p0, c1, c2, p3, t));
    const n = { x: -d.y, y: d.x };
    const w = (w0 + (w1 - w0) * Math.pow(t, 0.75)) / 2;
    L.push(add(b, mul(n, w)));
    R.push(add(b, mul(n, -w)));
    C.push(b);
    T.push(d);
    H.push(add(b, mul(n, w * 0.5 * lightSide)));
    S.push(add(b, mul(n, -w * 0.62 * lightSide)));
    G.push(add(b, mul(n, w * 0.08 * -lightSide)));
  }
  const body = `M${L.map(P).join("L")}L${[...R].reverse().map(P).join("L")}Z`;
  return {
    body,
    highlight: `M${H.map(P).join("L")}`,
    shade: `M${S.map(P).join("L")}`,
    grain: `M${G.map(P).join("L")}`,
    center: C,
    tangents: T,
  };
}

function thickness(u: UnitNode) {
  return 5 + 6.2 * Math.sqrt(u.size);
}

export function computeScene(graph: FamilyGraph, full: FullTree, collapsed: Set<string>): TreeScene {
  const visKids = (u: UnitNode) => (collapsed.has(u.id) ? [] : u.children);
  const nodeR = (u: UnitNode) => NODE_R + PARTNER_R * Math.min(u.partnerIds.length, 3);

  /* ---- measure: each subtree becomes a circle; children fan out on an arc (balloon layout) ---- */
  interface Pack {
    D: number;
    betas: number[];
    off: number;
    rho: number;
  }
  const pack = new Map<string, Pack>();
  const measure = (u: UnitNode) => {
    const kids = visKids(u);
    if (!kids.length) {
      pack.set(u.id, { D: 0, betas: [], off: 0, rho: nodeR(u) });
      return;
    }
    for (const c of kids) measure(c);
    const info = kids.map((c) => pack.get(c.id) as Pack);
    const S = u.gen === 0 ? FAN_ROOT : FAN;
    const selfR = u.gen === 0 ? 40 : nodeR(u);
    let D = 0;
    kids.forEach((c, i) => {
      const off = info[i]?.off ?? 0;
      D = Math.max(D, Math.max(u.gen === 0 ? 220 : 150, (selfR + nodeR(c)) * 0.82) + off);
    });
    const occupancy = (d: number) =>
      info.map((k) => {
        const q = (k.rho + GAP) / d;
        return q >= 1 ? Math.PI : 2 * Math.asin(q);
      });
    let alphas = occupancy(D);
    for (let iter = 0; iter < 600 && alphas.reduce((a, b) => a + b, 0) > S; iter++) {
      D *= 1.035;
      alphas = occupancy(D);
    }
    const total = alphas.reduce((a, b) => a + b, 0);
    const spread = Math.min(S, total * 1.12) / (total || 1);
    let b = -(total * spread) / 2;
    const betas = alphas.map((a) => {
      const mid = b + (a * spread) / 2;
      b += a * spread;
      return mid;
    });
    // tightest bounding circle centred on the growth axis
    const centres = betas.map((bt) => ({ x: Math.cos(bt) * D, y: Math.sin(bt) * D }));
    let best = { off: 0, rho: Infinity };
    for (const f of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
      const cx = f * D;
      let rho = selfR + cx;
      centres.forEach((c, i) => {
        rho = Math.max(rho, Math.hypot(c.x - cx, c.y) + (info[i]?.rho ?? 0));
      });
      if (rho < best.rho) best = { off: cx, rho };
    }
    pack.set(u.id, { D, betas, off: best.off, rho: best.rho });
  };
  measure(full.founding);

  /* ---- place: top-down, relative to the crown, branches bend gently upward ---- */
  const rel = new Map<string, Pt>();
  const dir = new Map<string, Pt>();
  const angleOf = new Map<string, number>();
  const UP = -Math.PI / 2;
  const placeUnit = (u: UnitNode, P: Pt, A: number) => {
    rel.set(u.id, P);
    angleOf.set(u.id, A);
    dir.set(u.id, { x: Math.cos(A), y: Math.sin(A) });
    const pk = pack.get(u.id) as Pack;
    const kids = visKids(u);
    let diff = UP - A;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const bias = u.gen === 0 ? 0 : clamp(diff * 0.22, -0.32, 0.32);
    kids.forEach((c, i) => {
      const jitter = (noise(`${c.id}:a`) - 0.5) * 0.06;
      const Ac = A + bias + (pk.betas[i] ?? 0) + jitter;
      const cp = pack.get(c.id) as Pack;
      let d = pk.D - cp.off + (noise(`${c.id}:r`) - 0.5) * 24;
      // a lineage with no descendants stays a short limb near the crown instead of reaching across the canopy
      if (u.gen === 0 && visKids(c).length === 0) d = Math.min(d, Math.max(300, pk.D * 0.32));
      placeUnit(c, { x: P.x + Math.cos(Ac) * d, y: P.y + Math.sin(Ac) * d }, Ac);
    });
  };
  placeUnit(full.founding, { x: 0, y: 0 }, UP);

  const heads = visKids(full.founding);
  const visible: UnitNode[] = [];
  const walk = (u: UnitNode) => {
    visible.push(u);
    for (const c of visKids(u)) walk(c);
  };
  walk(full.founding);

  /* trunk height: proportional to the crown, and tall enough that no lobe touches the ground */
  const D0 = pack.get(full.founding.id)?.D ?? 300;
  let lowest = -Infinity;
  for (const u of visible) {
    if (u.gen === 0) continue;
    const p = rel.get(u.id) as Pt;
    lowest = Math.max(lowest, p.y + 120);
  }
  const T = clamp(Math.max(D0 * 0.46, lowest + 90), 260, 1700);
  /* main limbs and trunk thicken with the size of the crown so they read as an old tree */
  const girth = clamp(D0 / 850, 1, 3.2);
  const crown: Pt = { x: 0, y: -T };

  /* trunk dimensions follow the pipe model of its lineages */
  const headW = heads.map((h) => thickness(h) * 1.05 * girth);
  const topW = clamp(Math.sqrt(headW.reduce((s, x) => s + x * x, 0)) * 1.05, 130, 560);
  const baseW = topW * 1.32;

  const pos = new Map<string, Pt>();
  for (const [id, p] of rel) pos.set(id, { x: p.x, y: p.y - T });
  const nF = full.foundingIds.length;
  const founderGap = R_FOUNDER * 2 + 22;
  const foundingY = -T * 0.47;
  full.foundingIds.forEach((id, i) => {
    pos.set(`f:${id}`, { x: (i - (nF - 1) / 2) * founderGap, y: foundingY });
  });

  const placed: PlacedPerson[] = [];
  const units: SceneUnit[] = [];
  const limbs: Limb[] = [];
  const roots: Limb[] = [];
  const leaves: LeafClump[] = [];
  const crownFrom: Pt = { x: 0, y: -T };

  /* founders on the trunk */
  full.foundingIds.forEach((id) => {
    const p = pos.get(`f:${id}`) as Pt;
    placed.push({ id, unitId: full.founding.id, x: p.x, y: p.y, r: R_FOUNDER, role: "founder", lineage: -1, gen: 0, from: { x: p.x, y: 0 } });
  });

  /* canopy units */
  for (const u of visible) {
    if (u.gen === 0) continue;
    const p = pos.get(u.id) as Pt;
    const d = dir.get(u.id) as Pt;
    const parentPos = u.parent?.gen === 0 ? crownFrom : (pos.get(u.parent?.id ?? "") ?? crownFrom);
    placed.push({ id: u.primaryId, unitId: u.id, x: p.x, y: p.y, r: R_PRIMARY, role: "descendant", lineage: u.lineage, gen: u.gen, from: parentPos });
    const tan = { x: -d.y, y: d.x };
    u.partnerIds.forEach((pid, k) => {
      const side = k % 2 === 0 ? 1 : -1;
      const mult = Math.floor(k / 2) + 1;
      const off = add(mul(tan, side * (R_PRIMARY + R_PARTNER + 1) * mult), mul(d, 7));
      placed.push({ id: pid, unitId: u.id, x: p.x + off.x, y: p.y + off.y, r: R_PARTNER, role: "partner", lineage: u.lineage, gen: u.gen, from: p });
    });
    const hasChildren = u.children.length > 0;
    const isCollapsed = collapsed.has(u.id) && hasChildren;
    units.push({
      id: u.id,
      x: p.x,
      y: p.y,
      gen: u.gen,
      lineage: u.lineage,
      collapsed: isCollapsed,
      hasChildren,
      hidden: isCollapsed ? u.size - 1 - u.partnerIds.length : 0,
      knob: add(p, mul(d, R_PRIMARY + 19)),
      memberIds: [u.primaryId, ...u.partnerIds],
    });

    /* the limb from the parent */
    const parent = u.parent as UnitNode;
    let p0: Pt;
    let dir0: Pt;
    if (parent.gen === 0) {
      const s = (dir.get(u.id) as Pt).x;
      p0 = { x: s * topW * 0.36, y: -T + 10 + Math.pow(Math.abs(s), 2) * T * 0.2 };
      dir0 = norm({ x: s * 0.9, y: -1 });
    } else {
      p0 = pos.get(parent.id) as Pt;
      dir0 = norm(add(mul(dir.get(parent.id) as Pt, 0.55), mul(norm(sub(p, p0)), 0.45)));
    }
    const dist = len(sub(p, p0));
    const perp = { x: -d.y, y: d.x };
    const c1 = add(p0, mul(dir0, dist * 0.42));
    const c2 = add(sub(p, mul(d, dist * 0.3)), mul(perp, (noise(`${u.id}:b`) - 0.5) * dist * 0.22));
    const th = thickness(u);
    const w0 = th * (parent.gen === 0 ? 1.05 * girth : 1);
    const w1 = Math.max(2.4, th * (parent.gen === 0 ? 0.8 : 0.58));
    const g = limbGeometry(p0, c1, c2, p, w0, w1);
    let graft: Limb["graft"] = null;
    if (u.subtype && u.subtype !== "biological") {
      const gp = g.center[2] as Pt;
      const gt = g.tangents[2] as Pt;
      graft = { x: gp.x, y: gp.y, angle: (Math.atan2(gt.y, gt.x) * 180) / Math.PI, w: w0 * 0.95 };
    }
    let label: Limb["label"] = null;
    if (parent.gen === 0) {
      const person = graph.get(u.primaryId);
      const pts = g.center.slice(2, 11);
      if (p.x < 0) pts.reverse();
      label = {
        path: `M${pts.map(P).join("L")}`,
        text: person ? `${firstName(person)}'s line` : "Lineage",
        size: clamp(w0 * 0.36, 11, 26),
      };
    }
    limbs.push({
      id: `b:${u.id}`,
      kind: "branch",
      lineage: u.lineage,
      ...g,
      w0,
      start: p0,
      childUnitId: u.id,
      parentUnitId: parent.id,
      ends: [parent.primaryId, u.primaryId],
      graft,
      label,
    });

    /* twigs + foliage */
    const rng = rngFor(`${u.id}:leaf`);
    const isTip = visKids(u).length === 0;
    if (isTip || rng() > 0.55) {
      const count = isTip ? 2 + (rng() > 0.5 ? 1 : 0) : 1;
      for (let k = 0; k < count; k++) {
        const off = isTip ? (k - (count - 1) / 2) * 0.8 + (rng() - 0.5) * 0.4 : (rng() > 0.5 ? 1 : -1) * (0.9 + rng() * 0.4);
        const dd = rot(d, off);
        const l = 48 + rng() * 42;
        const a0 = add(p, mul(dd, R_PRIMARY * 0.4));
        const tip = add(p, mul(dd, l + R_PRIMARY * 0.4));
        const tg = limbGeometry(a0, add(a0, mul(rot(d, off * 0.4), l * 0.45)), sub(tip, mul(dd, l * 0.35)), tip, 5.5, 0.8);
        limbs.push({ id: `t:${u.id}:${k}`, kind: "twig", lineage: u.lineage, ...tg, w0: 5.5, start: a0, childUnitId: u.id, parentUnitId: u.id, ends: null, graft: null, label: null });
        leaves.push({ id: `lt:${u.id}:${k}`, x: tip.x, y: tip.y, s: 0.7 + rng() * 0.4, rot: rng() * 360, v: Math.floor(rng() * 3), lineage: u.lineage, layer: k % 2 ? "front" : "back" });
      }
    }
    const isBud = isCollapsed;
    let count = isTip ? 5 : 3;
    if (isBud) count += Math.min(6, Math.ceil((u.size - 1) / 4));
    const baseAng = Math.atan2(d.y, d.x);
    for (let k = 0; k < count; k++) {
      const ang = baseAng + (rng() - 0.5) * (isTip ? 2.8 : 2.2);
      const dist2 = (isTip ? 54 : 46) + rng() * (isTip ? 82 : 58);
      const lp = add(p, { x: Math.cos(ang) * dist2, y: Math.sin(ang) * dist2 });
      leaves.push({ id: `l:${u.id}:${k}`, x: lp.x, y: lp.y, s: 0.85 + rng() * 0.75, rot: rng() * 360, v: Math.floor(rng() * 3), lineage: u.lineage, layer: k % 3 === 2 && dist2 > 64 ? "front" : "back" });
    }
    const along = parent.gen === 0 ? [0.55, 0.8] : [0.6];
    along.forEach((t, k) => {
      const idx = Math.round(t * LIMB_SAMPLES);
      const c = g.center[idx] as Pt;
      const tg = g.tangents[idx] as Pt;
      const side = rng() > 0.5 ? 1 : -1;
      const lp = add(c, mul({ x: -tg.y, y: tg.x }, side * (18 + rng() * 22)));
      leaves.push({ id: `la:${u.id}:${k}`, x: lp.x, y: lp.y, s: 0.8 + rng() * 0.45, rot: rng() * 360, v: Math.floor(rng() * 3), lineage: u.lineage, layer: "back" });
    });
  }

  /* decorative young limbs keep small families looking like a tree, not a stump */
  if (heads.length < 4) {
    const used = heads.map((h) => {
      const d = dir.get(h.id) as Pt;
      return Math.atan2(d.x, -d.y);
    });
    const candidates = [-72, -40, -12, 16, 44, 74].map((a) => a * DEG).filter((a) => used.every((u) => Math.abs(u - a) > 20 * DEG));
    candidates.slice(0, 5 - heads.length).forEach((a, k) => {
      const rng = rngFor(`decor:${k}`);
      const r = 230 * (0.75 + rng() * 0.3);
      const tip = { x: r * Math.sin(a) * 1.2, y: crown.y - r * Math.cos(a) * 0.85 };
      const s = Math.sin(a);
      const p0 = { x: s * topW * 0.3, y: -T + 14 + Math.abs(s) * T * 0.12 };
      const dd = norm(sub(tip, crown));
      const g = limbGeometry(p0, add(p0, mul(norm({ x: s, y: -1 }), r * 0.4)), sub(tip, mul(dd, r * 0.3)), tip, 16, 2);
      const lineage = heads.length + k;
      limbs.push({ id: `d:${k}`, kind: "decor", lineage, ...g, w0: 16, start: p0, childUnitId: null, parentUnitId: null, ends: null, graft: null, label: null });
      for (let j = 0; j < 6; j++) {
        const ang = Math.atan2(dd.y, dd.x) + (rng() - 0.5) * 2.6;
        const dist2 = 30 + rng() * 80;
        leaves.push({ id: `ld:${k}:${j}`, x: tip.x + Math.cos(ang) * dist2, y: tip.y + Math.sin(ang) * dist2, s: 0.8 + rng() * 0.6, rot: rng() * 360, v: Math.floor(rng() * 3), lineage, layer: j % 3 === 2 ? "front" : "back" });
      }
    });
  }

  /* ---------------- roots ---------------- */
  const rootRng = rngFor("roots");
  const rootCount = 9;
  for (let k = 0; k < rootCount; k++) {
    const side = k % 2 ? 1 : -1;
    const spread = (k + 1) / rootCount;
    const start = { x: side * baseW * (0.12 + 0.34 * spread), y: -6 };
    const a = side * (18 + spread * 62 + rootRng() * 8) * DEG;
    const l = 150 + rootRng() * 230 + spread * 60;
    const end = { x: start.x + Math.sin(a) * l * 1.45, y: start.y + Math.cos(a) * l * 0.62 };
    const c1 = { x: start.x + side * l * 0.32, y: start.y + 14 };
    const c2 = { x: end.x - Math.sin(a) * l * 0.35, y: end.y - Math.cos(a) * l * 0.18 };
    const w0 = baseW * (0.16 + rootRng() * 0.14);
    const g = limbGeometry(start, c1, c2, end, w0, 1.4);
    roots.push({ id: `r:${k}`, kind: "root", lineage: -2, ...g, w0, start, childUnitId: null, parentUnitId: null, ends: null, graft: null, label: null });
    // a fork for texture
    const mid = g.center[6] as Pt;
    const fa = a + side * (0.3 + rootRng() * 0.4);
    const fl = l * 0.45;
    const fe = { x: mid.x + Math.sin(fa) * fl * 1.3, y: mid.y + Math.cos(fa) * fl * 0.7 };
    const fg = limbGeometry(mid, add(mid, { x: side * fl * 0.3, y: fl * 0.15 }), sub(fe, { x: Math.sin(fa) * fl * 0.3, y: 0 }), fe, w0 * 0.42, 0.8);
    roots.push({ id: `rf:${k}`, kind: "root", lineage: -2, ...fg, w0: w0 * 0.42, start: mid, childUnitId: null, parentUnitId: null, ends: null, graft: null, label: null });
  }

  /* ancestors grow down into the roots, one sector per founder */
  const ancPlaced = new Set<string>();
  const sectorFor = (i: number): [number, number] => {
    if (nF <= 1) return [-82 * DEG, 82 * DEG];
    const lo = -84 * DEG;
    const hi = 84 * DEG;
    const gap = 10 * DEG;
    const width = (hi - lo - gap * (nF - 1)) / nF;
    const a0 = lo + i * (width + gap);
    return [a0, a0 + width];
  };
  const placeAncestors = (childId: string, depth: number, a0: number, a1: number, from: Pt, fromW: number) => {
    if (depth > 7) return;
    const parents = graph.parentsOf(childId).filter((p) => full.rootAncestors.has(p.person.id) && !ancPlaced.has(p.person.id));
    parents.forEach((par, j) => {
      ancPlaced.add(par.person.id);
      const s0 = a0 + ((a1 - a0) * j) / parents.length;
      const s1 = a0 + ((a1 - a0) * (j + 1)) / parents.length;
      const am = (s0 + s1) / 2;
      const rr = 175 + (depth - 1) * 170;
      const pt = { x: Math.sin(am) * rr * 1.45, y: 80 + Math.abs(Math.cos(am)) * rr * 0.62 + depth * 26 };
      placed.push({ id: par.person.id, unitId: null, x: pt.x, y: pt.y, r: R_ANCESTOR, role: "ancestor", lineage: -2, gen: -depth, from });
      const dd = norm(sub(pt, from));
      const g = limbGeometry(from, add(from, { x: dd.x * 40, y: 50 }), sub(pt, mul(dd, 60)), pt, fromW, Math.max(5, fromW * 0.5));
      roots.push({ id: `ra:${par.person.id}`, kind: "root", lineage: -2, ...g, w0: fromW, start: from, childUnitId: null, parentUnitId: null, ends: [childId, par.person.id], graft: null, label: null });
      placeAncestors(par.person.id, depth + 1, s0, s1, pt, Math.max(6, fromW * 0.55));
    });
  };
  full.foundingIds.forEach((id, i) => {
    const [a0, a1] = sectorFor(i);
    const fp = pos.get(`f:${id}`) as Pt;
    placeAncestors(id, 1, a0, a1, { x: fp.x * 0.6, y: 6 }, baseW * 0.22);
  });

  /* ---------------- trunk ---------------- */
  const tr = rngFor("trunk");
  const N = 16;
  const cx = (t: number) => (Math.sin(t * Math.PI * 1.2 + 0.4) - Math.sin(0.4)) * topW * 0.07;
  const wAt = (t: number) => topW + (baseW - topW) * Math.pow(1 - t, 1.4) + baseW * 0.8 * Math.pow(1 - t, 7);
  const Lp: Pt[] = [];
  const Rp: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = -T * t;
    const wt = wAt(t) / 2;
    Lp.push({ x: cx(t) - wt, y });
    Rp.push({ x: cx(t) + wt, y });
  }
  const topL = Lp[N] as Pt;
  const topR = Rp[N] as Pt;
  const trunkBody = `M${Lp.map(P).join("L")}Q${f1(cx(1))} ${f1(-T - topW * 0.42)} ${P(topR)}L${[...Rp].reverse().map(P).join("L")}Z`;
  const line = (f: number, wobble: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const ww = wAt(t);
      pts.push({ x: cx(t) + f * ww + Math.sin(t * 9 + f * 20) * ww * wobble, y: -T * t - (i === N ? topW * 0.1 : 0) });
    }
    return `M${pts.map(P).join("L")}`;
  };
  const trunk: Trunk = {
    body: trunkBody,
    grain: [-0.36, -0.24, -0.12, 0.0, 0.11, 0.22, 0.32].map((f) => line(f, 0.012)),
    highlight: line(-0.3, 0.006),
    shade: line(0.36, 0.004),
    knots: [0, 1, 2].map((k) => {
      const t = 0.18 + tr() * 0.5;
      const f = (tr() - 0.5) * 0.5;
      return { x: cx(t) + f * wAt(t), y: -T * t, rx: 6 + tr() * 7, ry: 10 + tr() * 10, rot: (tr() - 0.5) * 30 + k };
    }),
    height: T,
    topW,
    baseW,
  };
  void topL;

  /* ---------------- bounds, ground ---------------- */
  let minX = -baseW * 2;
  let maxX = baseW * 2;
  let minY = -T - topW;
  let maxY = 200;
  const grow = (x: number, y: number, pad: number) => {
    minX = Math.min(minX, x - pad);
    maxX = Math.max(maxX, x + pad);
    minY = Math.min(minY, y - pad);
    maxY = Math.max(maxY, y + pad);
  };
  for (const p of placed) grow(p.x, p.y, p.r + 70);
  for (const l of leaves) grow(l.x, l.y, l.s * 55);
  for (const r of roots) {
    const last = r.highlight.split("L").pop();
    if (last) {
      const [x, y] = last.split(" ").map(Number);
      if (Number.isFinite(x) && Number.isFinite(y)) grow(x as number, y as number, 30);
    }
  }

  const gr = rngFor("grass");
  const blades: string[] = [];
  for (let x = minX - 500; x < maxX + 500; x += 11 + gr() * 9) {
    const near = Math.abs(x) < baseW * 0.7;
    if (near) continue;
    const h = 5 + gr() * (Math.abs(x) < 900 ? 14 : 9);
    const lean = (gr() - 0.5) * 7;
    blades.push(`M${f1(x)} 3Q${f1(x + lean * 0.3)} ${f1(-h * 0.5)} ${f1(x + lean)} ${f1(-h)}`);
  }

  const canopyTop = Math.min(...placed.filter((p) => p.role !== "ancestor").map((p) => p.y), crown.y - 200);
  const founder = graph.get(full.foundingIds[0] ?? "");
  const surname = founder ? (founder.full_name.trim().split(/\s+/).slice(-1)[0] ?? "") : "";

  return {
    placed,
    placedById: new Map(placed.map((p) => [p.id, p])),
    units,
    limbs,
    roots,
    leaves,
    trunk,
    grass: blades.join(""),
    canopy: { cx: 0, cy: (canopyTop + crown.y) / 2, rx: (maxX - minX) * 0.48, ry: Math.max(260, (crown.y - canopyTop) * 0.62) },
    bounds: { minX, minY, maxX, maxY },
    lineageCount: Math.max(heads.length, 1),
    familyLabel: surname,
  };
}
