import { memo, type CSSProperties, type KeyboardEvent } from "react";
import type { FamilyGraph } from "./graph";
import { birthYear, displayName, initials, isDeceased } from "./graph";
import type { LeafClump, Limb, PlacedPerson, SceneUnit, TreeScene } from "./layout";
import { LINEAGE_COLORS } from "./layout";

const lc = (lineage: number) => ((lineage % LINEAGE_COLORS) + LINEAGE_COLORS) % LINEAGE_COLORS;
const css = (o: Record<string, unknown>) => o as CSSProperties;
const pathStyle = (d: string): Record<string, string> => ({ d: `path("${d}")` });

/* ---------------- wood ---------------- */

export const LimbView = memo(function LimbView({ limb, lit, dim, delay }: { limb: Limb; lit: boolean; dim: boolean; delay: number }) {
  const w = limb.w0;
  return (
    <g
      className={`ft-limb ft-limb--${limb.kind}${lit ? " is-lit" : ""}${dim ? " is-dim" : ""}`}
      style={css({ "--ox": `${limb.start.x.toFixed(1)}px`, "--oy": `${limb.start.y.toFixed(1)}px`, animationDelay: `${delay}ms` })}
    >
      <path className="ft-limb-body" d={limb.body} style={pathStyle(limb.body)} />
      {w > 3.5 && <path className="ft-limb-shade" d={limb.shade} style={css({ ...pathStyle(limb.shade), strokeWidth: w * 0.3 })} />}
      {w > 3.5 && <path className="ft-limb-hi" d={limb.highlight} style={css({ ...pathStyle(limb.highlight), strokeWidth: Math.max(0.7, w * 0.11) })} />}
      {w > 8 && (
        <path
          className="ft-limb-grain"
          d={limb.grain}
          style={css({ ...pathStyle(limb.grain), strokeWidth: Math.max(0.6, w * 0.05), strokeDasharray: `${(w * 1.6).toFixed(1)} ${(w * 0.9).toFixed(1)}` })}
        />
      )}
      {limb.graft && (
        <g transform={`translate(${limb.graft.x} ${limb.graft.y}) rotate(${limb.graft.angle})`} className="ft-graft">
          <rect x={-2.2} y={-limb.graft.w / 2 - 1.5} width={4.4} height={limb.graft.w + 3} rx={2} />
        </g>
      )}
    </g>
  );
});

export const LineageLabel = memo(function LineageLabel({ limb }: { limb: Limb }) {
  if (!limb.label) return null;
  const id = `ft-lp-${limb.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <g className="ft-lineage-label">
      <path id={id} d={limb.label.path} fill="none" stroke="none" />
      <text style={{ fontSize: limb.label.size }} dy={limb.label.size * 0.36}>
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {limb.label.text}
        </textPath>
      </text>
    </g>
  );
});

export const TrunkView = memo(function TrunkView({ scene, title }: { scene: TreeScene; title: string }) {
  const t = scene.trunk;
  const carve = title.toUpperCase();
  const size = Math.min(t.topW * 0.13, (t.topW * 1.5) / Math.max(4, carve.length));
  return (
    <g className="ft-trunk">
      <path className="ft-trunk-body" d={t.body} style={pathStyle(t.body)} />
      {t.grain.map((g, i) => (
        <path key={i} className="ft-trunk-grain" d={g} style={css({ ...pathStyle(g), strokeDasharray: `${40 + i * 7} ${12 + i * 3}` })} />
      ))}
      <path className="ft-trunk-hi" d={t.highlight} style={css({ ...pathStyle(t.highlight), strokeWidth: t.topW * 0.05 })} />
      <path className="ft-trunk-shade" d={t.shade} style={css({ ...pathStyle(t.shade), strokeWidth: t.topW * 0.12 })} />
      {t.knots.map((k, i) => (
        <g key={i} transform={`translate(${k.x.toFixed(1)} ${k.y.toFixed(1)}) rotate(${k.rot.toFixed(1)})`} className="ft-knot">
          <ellipse rx={k.rx * 1.5} ry={k.ry * 1.4} className="ft-knot-ring" />
          <ellipse rx={k.rx} ry={k.ry} className="ft-knot-hole" />
        </g>
      ))}
      {carve && (
        <g className="ft-carving" transform={`translate(0 ${(-t.height * 0.16).toFixed(1)})`}>
          <text className="ft-carving-light" y={1.2} style={{ fontSize: size }}>
            {carve}
          </text>
          <text className="ft-carving-dark" style={{ fontSize: size }}>
            {carve}
          </text>
        </g>
      )}
    </g>
  );
});

/* ---------------- foliage ---------------- */

export const LeafLayer = memo(function LeafLayer({ leaves, layer }: { leaves: LeafClump[]; layer: "back" | "front" }) {
  const groups = new Map<number, LeafClump[]>();
  for (const l of leaves) {
    if (l.layer !== layer) continue;
    const k = lc(l.lineage);
    const list = groups.get(k);
    if (list) list.push(l);
    else groups.set(k, [l]);
  }
  return (
    <g className={`ft-leaves ft-leaves--${layer}`}>
      {[...groups.entries()].map(([k, list]) => (
        <g key={k} className="ft-leaf-group" style={css({ "--leaf": `var(--ft-leaf-${k})` })}>
          {list.map((l) => (
            <use
              key={l.id}
              href={`#ft-leaf-${l.v}`}
              className="ft-leaf"
              style={css({ "--tx": `${l.x.toFixed(1)}px`, "--ty": `${l.y.toFixed(1)}px`, "--r": `${l.rot.toFixed(0)}deg`, "--s": l.s.toFixed(2) })}
            />
          ))}
        </g>
      ))}
    </g>
  );
});

/* ---------------- people ---------------- */

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export interface NodeProps {
  placed: PlacedPerson;
  graph: FamilyGraph;
  selected: boolean;
  lit: boolean;
  dim: boolean;
  isMe: boolean;
  onSelect: (id: string) => void;
}

export const PersonNode = memo(function PersonNode({ placed, graph, selected, lit, dim, isMe, onSelect }: NodeProps) {
  const person = graph.get(placed.id);
  if (!person) return null;
  const { r } = placed;
  const ring = placed.role === "founder" ? 5 : placed.role === "partner" ? 3 : 4;
  const dead = isDeceased(person);
  const name = displayName(person);
  const born = birthYear(person);
  const kind = placed.role;
  const mono = kind === "founder" ? "ft-mono-f" : kind === "ancestor" ? "ft-mono-a" : `ft-mono-${lc(placed.lineage)}`;
  const ringFill = lit || selected ? "url(#ft-ring-lit)" : dead ? "url(#ft-ring-dusk)" : "url(#ft-ring)";
  const nameSize = kind === "founder" ? 19 : kind === "partner" ? 12 : kind === "ancestor" ? 13 : 14.5;
  const shownName = truncate(name, kind === "founder" ? 24 : 22);
  // Only the birth year sits under the name; family roles are left to the profile.
  const meta = born ? String(born) : "";
  const metaSize = kind === "founder" ? 10.5 : 9;
  const plateW = Math.max(shownName.length * nameSize * 0.47, meta.length * metaSize * 0.62) + 18;
  const plateH = meta ? nameSize + metaSize + 13 : nameSize + 11;
  const partner = kind === "partner";
  const labelX = partner ? r + ring + 6 + plateW / 2 : 0;
  const labelY = partner ? -plateH / 2 : r + ring + 7;
  const delay = Math.max(0, placed.gen) * 110 + (kind === "ancestor" ? 260 : 0);

  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(placed.id);
    }
  };

  return (
    <g
      className={`ft-node ft-node--${kind}${selected ? " is-selected" : ""}${lit ? " is-lit" : ""}${dim ? " is-dim" : ""}${dead ? " is-deceased" : ""}`}
      style={css({
        "--tx": `${placed.x.toFixed(1)}px`,
        "--ty": `${placed.y.toFixed(1)}px`,
        "--fx": `${placed.from.x.toFixed(1)}px`,
        "--fy": `${placed.from.y.toFixed(1)}px`,
        animationDelay: `${delay}ms`,
      })}
      role="button"
      tabIndex={0}
      aria-label={`${name}${born ? `, born ${born}` : ""}`}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(placed.id);
      }}
      onKeyDown={onKey}
    >
      <ellipse className="ft-node-shadow" cy={r * 0.62} rx={r * 1.15} ry={r * 0.45} fill="url(#ft-shadow)" />
      {selected && <circle className="ft-node-halo" r={r + ring + 7} />}
      <circle r={r + ring} fill={ringFill} className="ft-node-ring" />
      <circle r={r + ring - 1.4} className="ft-node-ring-line" />
      {person.avatar ? (
        <image
          href={person.avatar}
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          clipPath="url(#ft-clip)"
          preserveAspectRatio="xMidYMid slice"
          className="ft-node-photo"
        />
      ) : (
        <>
          <circle r={r} fill={`url(#${mono})`} className="ft-node-face" />
          <text className="ft-initials" dy="0.36em" style={{ fontSize: r * 0.74 }}>
            {initials(person)}
          </text>
        </>
      )}
      <circle r={r} className="ft-node-inner-edge" />
      {isMe && (
        <g className="ft-me" transform={`translate(0 ${-(r + ring + 9)})`}>
          <rect x={-15} y={-8} width={30} height={15} rx={7.5} />
          <text dy="0.33em">You</text>
        </g>
      )}
      <g className={`ft-label${partner ? " ft-label--partner" : ""}${kind === "founder" ? " ft-label--keep" : ""}`} transform={`translate(${labelX.toFixed(1)} ${labelY.toFixed(1)})`}>
        <rect x={-plateW / 2} y={0} width={plateW} height={plateH} rx={plateH / 2.6} className="ft-plate" />
        <text className="ft-name" y={nameSize * 0.98 + 3} style={{ fontSize: nameSize }}>
          {shownName}
        </text>
        {meta && (
          <text className="ft-meta" y={nameSize + metaSize + 6} style={{ fontSize: metaSize }}>
            {meta}
          </text>
        )}
      </g>
    </g>
  );
});

export const UnitKnob = memo(function UnitKnob({ unit, onToggle, dim }: { unit: SceneUnit; onToggle: (id: string) => void; dim: boolean }) {
  if (!unit.hasChildren) return null;
  const label = unit.collapsed ? `+${unit.hidden}` : "";
  const w = unit.collapsed ? Math.max(22, 12 + label.length * 6.4) : 18;
  return (
    <g
      className={`ft-knob${unit.collapsed ? " is-collapsed" : ""}${dim ? " is-dim" : ""}`}
      style={css({ "--tx": `${unit.knob.x.toFixed(1)}px`, "--ty": `${unit.knob.y.toFixed(1)}px` })}
      role="button"
      tabIndex={0}
      aria-label={unit.collapsed ? `Show ${unit.hidden} more relatives` : "Fold this branch"}
      aria-expanded={!unit.collapsed}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(unit.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(unit.id);
        }
      }}
    >
      <circle r={16} className="ft-knob-hit" />
      <rect x={-w / 2} y={-9} width={w} height={18} rx={9} className="ft-knob-pill" />
      {unit.collapsed ? (
        <text dy="0.34em" className="ft-knob-text">
          {label}
        </text>
      ) : (
        <path d="M-4 0H4" className="ft-knob-glyph" />
      )}
    </g>
  );
});
