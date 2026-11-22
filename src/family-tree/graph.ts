import type { FamilyData, ParentSubtype, PartnerStatus, TreePerson, TreeRelationship } from "./types";

export interface ParentRel {
  person: TreePerson;
  subtype: ParentSubtype | null;
}
export interface PartnerRel {
  person: TreePerson;
  status: PartnerStatus | null;
  since: string | null;
  /** True when they share a child but no partner link is recorded. */
  inferred: boolean;
}
export type SiblingKind = "full" | "half" | "step";
export interface SiblingRel {
  person: TreePerson;
  kind: SiblingKind;
}

const SUBTYPE_RANK: Record<ParentSubtype | "none", number> = {
  biological: 0,
  none: 1,
  adoptive: 2,
  foster: 3,
  step: 4,
};

export function subtypeRank(s: ParentSubtype | null): number {
  return SUBTYPE_RANK[s ?? "none"];
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function birthYear(p: TreePerson): number | null {
  if (!p.birth_date) return null;
  const y = Number.parseInt(p.birth_date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function deathYear(p: TreePerson): number | null {
  if (!p.death_date) return null;
  const y = Number.parseInt(p.death_date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function isDeceased(p: TreePerson): boolean {
  return p.is_deceased === true || deathYear(p) !== null;
}

export function displayName(p: TreePerson): string {
  const n = p.full_name.trim();
  return n || "Unknown name";
}

export function firstName(p: TreePerson): string {
  return displayName(p).split(/\s+/)[0] ?? displayName(p);
}

export function initials(p: TreePerson): string {
  const parts = displayName(p)
    .replace(/[^\p{L}\s'-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** "1932 – 2004", "b. 1987", "† 1990", or "" when nothing is known. */
export function lifespan(p: TreePerson): string {
  const b = birthYear(p);
  const d = deathYear(p);
  if (b && d) return `${b} – ${d}`;
  if (b && isDeceased(p)) return `${b} – ?`;
  if (b) return `b. ${b}`;
  if (d) return `† ${d}`;
  return "";
}

function sortByBirth(a: TreePerson, b: TreePerson) {
  const ya = birthYear(a) ?? 99999;
  const yb = birthYear(b) ?? 99999;
  return ya - yb || displayName(a).localeCompare(displayName(b));
}

/**
 * Read-only index over the family's people and relationships.
 * All relationship answers come from the stored links — nothing is guessed except
 * "partners" who share a child without a recorded partner link (flagged `inferred`).
 */
export class FamilyGraph {
  readonly people = new Map<string, TreePerson>();
  private parentLinks = new Map<string, ParentRel[]>();
  private childLinks = new Map<string, ParentRel[]>();
  private partnerLinks = new Map<string, { other: string; rel: TreeRelationship }[]>();
  private ancCache = new Map<string, Map<string, number>>();
  private descCache = new Map<string, Map<string, number>>();

  constructor(readonly data: FamilyData) {
    for (const p of data.people) this.people.set(p.id, p);
    for (const r of data.relationships) {
      const a = this.people.get(r.a_id);
      const b = this.people.get(r.b_id);
      if (!a || !b || a.id === b.id) continue;
      if (r.kind === "parent") {
        // de-duplicate repeated links
        if ((this.parentLinks.get(b.id) ?? []).some((x) => x.person.id === a.id)) continue;
        push(this.parentLinks, b.id, { person: a, subtype: r.subtype ?? null });
        push(this.childLinks, a.id, { person: b, subtype: r.subtype ?? null });
      } else {
        if ((this.partnerLinks.get(a.id) ?? []).some((x) => x.other === b.id)) continue;
        push(this.partnerLinks, a.id, { other: b.id, rel: r });
        push(this.partnerLinks, b.id, { other: a.id, rel: r });
      }
    }
    for (const list of this.childLinks.values()) list.sort((x, y) => sortByBirth(x.person, y.person));
    for (const list of this.parentLinks.values()) list.sort((x, y) => sortByBirth(x.person, y.person));
  }

  get size() {
    return this.people.size;
  }

  get(id: string): TreePerson | undefined {
    return this.people.get(id);
  }

  parentsOf(id: string): ParentRel[] {
    return this.parentLinks.get(id) ?? [];
  }

  childrenOf(id: string): ParentRel[] {
    return this.childLinks.get(id) ?? [];
  }

  partnersOf(id: string): PartnerRel[] {
    const out: PartnerRel[] = [];
    const seen = new Set<string>();
    for (const { other, rel } of this.partnerLinks.get(id) ?? []) {
      const person = this.people.get(other);
      if (!person || seen.has(other)) continue;
      seen.add(other);
      out.push({ person, status: rel.status ?? null, since: rel.since ?? null, inferred: false });
    }
    // co-parents without a recorded partnership
    for (const child of this.childrenOf(id)) {
      for (const cp of this.parentsOf(child.person.id)) {
        if (cp.person.id === id || seen.has(cp.person.id)) continue;
        if (cp.subtype === "step" || child.subtype === "step") continue;
        seen.add(cp.person.id);
        out.push({ person: cp.person, status: null, since: null, inferred: true });
      }
    }
    return out;
  }

  /** Siblings derived from shared parents (step-siblings via a parent's partner). */
  siblingsOf(id: string): SiblingRel[] {
    const mine = this.parentsOf(id)
      .filter((p) => p.subtype !== "step")
      .map((p) => p.person.id);
    const mineSet = new Set(mine);
    const result = new Map<string, SiblingRel>();
    for (const pid of mine) {
      for (const c of this.childrenOf(pid)) {
        if (c.person.id === id || c.subtype === "step" || result.has(c.person.id)) continue;
        const theirs = this.parentsOf(c.person.id)
          .filter((p) => p.subtype !== "step")
          .map((p) => p.person.id);
        const same = theirs.length === mine.length && theirs.every((t) => mineSet.has(t));
        result.set(c.person.id, { person: c.person, kind: same ? "full" : "half" });
      }
    }
    for (const pid of this.parentsOf(id).map((p) => p.person.id)) {
      for (const partner of this.partnersOf(pid)) {
        for (const c of this.childrenOf(partner.person.id)) {
          if (c.person.id === id || result.has(c.person.id)) continue;
          result.set(c.person.id, { person: c.person, kind: "step" });
        }
      }
    }
    return [...result.values()].sort((a, b) => sortByBirth(a.person, b.person));
  }

  /** Every ancestor with its generation distance (1 = parent). */
  ancestors(id: string): Map<string, number> {
    const hit = this.ancCache.get(id);
    if (hit) return hit;
    const out = new Map<string, number>();
    let frontier = [id];
    let depth = 0;
    while (frontier.length && depth < 64) {
      depth++;
      const next: string[] = [];
      for (const f of frontier)
        for (const p of this.parentsOf(f)) {
          if (out.has(p.person.id) || p.person.id === id) continue;
          out.set(p.person.id, depth);
          next.push(p.person.id);
        }
      frontier = next;
    }
    this.ancCache.set(id, out);
    return out;
  }

  /** Every descendant with its generation distance (1 = child). */
  descendants(id: string): Map<string, number> {
    const hit = this.descCache.get(id);
    if (hit) return hit;
    const out = new Map<string, number>();
    let frontier = [id];
    let depth = 0;
    while (frontier.length && depth < 64) {
      depth++;
      const next: string[] = [];
      for (const f of frontier)
        for (const c of this.childrenOf(f)) {
          if (out.has(c.person.id) || c.person.id === id) continue;
          out.set(c.person.id, depth);
          next.push(c.person.id);
        }
      frontier = next;
    }
    this.descCache.set(id, out);
    return out;
  }

  search(query: string, limit = 8): TreePerson[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored: { p: TreePerson; s: number }[] = [];
    for (const p of this.people.values()) {
      const name = displayName(p).toLowerCase();
      const nick = (p.nickname ?? "").toLowerCase();
      let s = -1;
      if (name.startsWith(q) || nick.startsWith(q)) s = 0;
      else if (name.split(/\s+/).some((w) => w.startsWith(q))) s = 1;
      else if (name.includes(q) || nick.includes(q)) s = 2;
      if (s >= 0) scored.push({ p, s });
    }
    scored.sort((a, b) => a.s - b.s || displayName(a.p).localeCompare(displayName(b.p)));
    return scored.slice(0, limit).map((x) => x.p);
  }
}

/* ---------- relationship wording ---------- */

function gendered(p: TreePerson, male: string, female: string, neutral: string) {
  if (p.gender === "male") return male;
  if (p.gender === "female") return female;
  return neutral;
}

function generationPrefix(depth: number): string {
  if (depth <= 1) return "";
  if (depth === 2) return "grand";
  if (depth === 3) return "great-grand";
  if (depth === 4) return "great-great-grand";
  return `${depth - 2}× great-grand`;
}

export function descendantTerm(p: TreePerson, depth: number): string {
  const base = gendered(p, "son", "daughter", "child");
  return generationPrefix(depth) + base;
}

export function ancestorTerm(p: TreePerson, depth: number): string {
  const base = gendered(p, "father", "mother", "parent");
  return generationPrefix(depth) + base;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Short role for a node, relative to the founding couple of the tree:
 * "Founder", "Granddaughter", "Adopted son", "Son-in-law", "Mother of Rahim", "Relative".
 */
export function describeRole(graph: FamilyGraph, foundingIds: string[], id: string): string {
  const p = graph.get(id);
  if (!p) return "";
  if (p.title?.trim()) return p.title.trim();
  if (foundingIds.includes(id)) return "Founder";

  let best: { depth: number; via: string } | null = null;
  for (const f of foundingIds) {
    const d = graph.descendants(f).get(id);
    if (d !== undefined && (!best || d < best.depth)) best = { depth: d, via: f };
  }
  if (best) {
    const direct = graph.parentsOf(id);
    const sub = direct.length > 0 && direct.every((x) => x.subtype && x.subtype !== "biological") ? direct[0]?.subtype : null;
    const term = descendantTerm(p, best.depth);
    if (sub === "adoptive") return `Adopted ${term}`;
    if (sub === "foster") return `Foster ${term}`;
    if (sub === "step") return cap(`step${term}`);
    return cap(term);
  }

  for (const partner of graph.partnersOf(id)) {
    for (const f of foundingIds) {
      const d = graph.descendants(f).get(partner.person.id);
      if (d !== undefined) return cap(`${descendantTerm(p, d)}-in-law`);
    }
  }

  for (const f of foundingIds) {
    const d = graph.ancestors(f).get(id);
    const founder = graph.get(f);
    if (d !== undefined && founder) return `${cap(ancestorTerm(p, d))} of ${firstName(founder)}`;
  }
  return "Relative";
}
