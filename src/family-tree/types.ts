/**
 * Data shapes for the Cznnect family tree.
 *
 * These mirror the rows the Cznnect app already stores:
 *   people         (id, full_name, nickname, birth_date, is_deceased, notes, claimed_by, ...)
 *   relationships  (id, a_id, b_id, kind)  — kind "parent": a_id is a parent of b_id
 *                                           kind "partner": a_id and b_id are partners
 *
 * Every extra field is optional, so the tree works with the current tables as-is and
 * picks up richer details (photos, adoption, divorce, places) if they are added later.
 */

export type RelationshipKind = "parent" | "partner";

/** How a parent link came about. Missing means "not recorded" (shown as plain parent/child). */
export type ParentSubtype = "biological" | "adoptive" | "step" | "foster";

/** State of a partnership. Missing means "partners" with no further detail. */
export type PartnerStatus = "married" | "partner" | "divorced" | "separated" | "widowed";

export interface TreePerson {
  id: string;
  full_name: string;
  nickname?: string | null;
  /** ISO date (YYYY-MM-DD) or just a year (YYYY). */
  birth_date?: string | null;
  death_date?: string | null;
  is_deceased?: boolean | null;
  notes?: string | null;
  /** Portrait image URL (e.g. the claimed profile's avatar). */
  avatar?: string | null;
  /** Extra photograph URLs for the profile gallery. */
  photos?: string[] | null;
  gender?: "female" | "male" | "other" | null;
  birth_place?: string | null;
  occupation?: string | null;
  /** Optional custom role shown on the node, e.g. "Family elder". */
  title?: string | null;
  claimed_by?: string | null;
}

export interface TreeRelationship {
  id: string;
  a_id: string;
  b_id: string;
  kind: RelationshipKind;
  subtype?: ParentSubtype | null;
  status?: PartnerStatus | null;
  since?: string | null;
}

export interface FamilyData {
  people: TreePerson[];
  relationships: TreeRelationship[];
}
