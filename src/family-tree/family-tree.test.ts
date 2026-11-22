import { describe, expect, it } from "vitest";
import { FamilyGraph, describeRole, lifespan } from "./graph";
import { buildFullTree, computeScene } from "./layout";
import type { FamilyData, TreePerson, TreeRelationship } from "./types";

const P = (id: string, extra: Partial<TreePerson> = {}): TreePerson => ({ id, full_name: id, ...extra });
const parent = (a: string, b: string, subtype: TreeRelationship["subtype"] = null): TreeRelationship => ({ id: `${a}>${b}`, a_id: a, b_id: b, kind: "parent", subtype });
const partner = (a: string, b: string): TreeRelationship => ({ id: `${a}+${b}`, a_id: a, b_id: b, kind: "partner" });

// Grandpa + Grandma -> Dad (married Mum) -> Kid1, Kid2 ; Dad + Ex -> Half ; Grandparents adopted Aunt
const family: FamilyData = {
  people: [
    P("Grandpa", { gender: "male", birth_date: "1920-01-01", is_deceased: true }),
    P("Grandma", { gender: "female", birth_date: "1922" }),
    P("Dad", { gender: "male", birth_date: "1950" }),
    P("Mum", { gender: "female" }),
    P("Ex", { gender: "female" }),
    P("Kid1", { gender: "female" }),
    P("Kid2", { gender: "male" }),
    P("Half", { gender: "male" }),
    P("Aunt", { gender: "female" }),
    P("Stranger"),
  ],
  relationships: [
    partner("Grandpa", "Grandma"),
    parent("Grandpa", "Dad"),
    parent("Grandma", "Dad"),
    parent("Grandpa", "Aunt", "adoptive"),
    parent("Grandma", "Aunt", "adoptive"),
    partner("Dad", "Mum"),
    parent("Dad", "Kid1"),
    parent("Mum", "Kid1"),
    parent("Dad", "Kid2"),
    parent("Mum", "Kid2"),
    parent("Dad", "Half"),
    parent("Ex", "Half"),
  ],
};
const g = new FamilyGraph(family);

describe("relationships come only from stored links", () => {
  it("children who share both parents are full siblings", () => {
    expect(g.siblingsOf("Kid1").find((s) => s.person.id === "Kid2")?.kind).toBe("full");
  });
  it("children who share one parent are half siblings", () => {
    expect(g.siblingsOf("Kid1").find((s) => s.person.id === "Half")?.kind).toBe("half");
  });
  it("a co-parent without a partner link is shown as an inferred partner", () => {
    const ex = g.partnersOf("Dad").find((p) => p.person.id === "Ex");
    expect(ex?.inferred).toBe(true);
    expect(g.partnersOf("Dad").find((p) => p.person.id === "Mum")?.inferred).toBe(false);
  });
  it("ancestors and descendants count generations", () => {
    expect(g.ancestors("Kid1").get("Grandpa")).toBe(2);
    expect(g.descendants("Grandma").get("Half")).toBe(2);
    expect(g.ancestors("Stranger").size).toBe(0);
  });
});

describe("role labels relative to the founders", () => {
  const full = buildFullTree(g);
  it("picks the oldest couple with the most descendants as founders", () => {
    expect(full?.foundingIds.sort()).toEqual(["Grandma", "Grandpa"]);
  });
  it("labels adoption, in-laws and grandchildren", () => {
    const f = full?.foundingIds ?? [];
    expect(describeRole(g, f, "Aunt")).toBe("Adopted daughter");
    expect(describeRole(g, f, "Mum")).toBe("Daughter-in-law");
    expect(describeRole(g, f, "Kid2")).toBe("Grandson");
    expect(describeRole(g, f, "Stranger")).toBe("Relative");
  });
  it("formats lifespans", () => {
    expect(lifespan(g.get("Grandpa") as TreePerson)).toBe("1920 – ?");
    expect(lifespan(g.get("Grandma") as TreePerson)).toBe("b. 1922");
  });
});

describe("tree layout", () => {
  const full = buildFullTree(g);
  if (!full) throw new Error("no tree");
  const scene = computeScene(g, full, new Set());
  it("draws every connected person exactly once", () => {
    const ids = scene.placed.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["Grandpa", "Grandma", "Dad", "Mum", "Ex", "Kid1", "Kid2", "Half", "Aunt"]) expect(ids).toContain(id);
  });
  it("every branch joins a person to one of their recorded parents' family units", () => {
    for (const limb of scene.limbs.filter((l) => l.kind === "branch")) {
      const child = limb.childUnitId as string;
      const unit = full.units.get(limb.parentUnitId as string);
      const members = unit ? [unit.primaryId, ...unit.partnerIds] : [];
      expect(g.parentsOf(child).some((p) => members.includes(p.person.id))).toBe(true);
    }
  });
  it("folding a family hides its descendants", () => {
    const folded = computeScene(g, full, new Set(["Dad"]));
    const ids = folded.placed.map((p) => p.id);
    expect(ids).not.toContain("Kid1");
    expect(folded.units.find((u) => u.id === "Dad")?.hidden).toBe(3);
  });
});
