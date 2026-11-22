import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { FamilyGraph, describeRole } from "./graph";
import { buildFullTree, computeScene, defaultCollapsed, unitsToReveal } from "./layout";
import type { TreePerson, TreeRelationship } from "./types";
import { TreeDefs } from "./TreeDefs";
import { LeafLayer, LimbView, LineageLabel, PersonNode, TrunkView, UnitKnob } from "./TreeScene";

export interface OrganicTreeProps {
  people: TreePerson[];
  relationships: TreeRelationship[];
  selectedId: string | null;
  /** The signed-in user's own person in the tree (gets a "You" tag). */
  meId?: string | null;
  /** Change `tick` to glide the view to someone (e.g. after a search). */
  focus?: { id: string; tick: number } | null;
  /** Whose ancestors and descendants are lit; everyone else is dimmed. */
  litId?: string | null;
  /** Carved into the trunk, e.g. the family name. */
  title?: string;
  onSelect: (id: string) => void;
  /** Tapping empty space. */
  onClear?: () => void;
  /** Screen space covered by overlays, so focused people stay visible. */
  insets?: { top?: number; right?: number; bottom?: number; left?: number } | undefined;
  /** Extra class on the root element. */
  className?: string;
}

type Lod = "far" | "mid" | "near";
const lodFor = (k: number): Lod => (k < 0.3 ? "far" : k < 0.85 ? "mid" : "near");
const REDUCED = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Icon({ d, label }: { d: string; label: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <title>{label}</title>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function OrganicTree({
  people,
  relationships,
  selectedId,
  meId = null,
  focus = null,
  litId = null,
  title,
  onSelect,
  onClear,
  insets,
  className,
}: OrganicTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const fittedRef = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const [lod, setLod] = useState<Lod>("mid");
  const [showGuide, setShowGuide] = useState(false);

  const graph = useMemo(() => new FamilyGraph({ people, relationships }), [people, relationships]);
  const full = useMemo(() => buildFullTree(graph), [graph]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => defaultCollapsed(full));
  const scene = useMemo(() => (full ? computeScene(graph, full, collapsed) : null), [graph, full, collapsed]);

  // Forget folds that no longer exist (people removed or merged).
  useEffect(() => {
    if (!full) return;
    setCollapsed((prev) => {
      const next = new Set([...prev].filter((id) => full.units.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [full]);

  const roles = useMemo(() => {
    const m = new Map<string, string>();
    if (!full || !scene) return m;
    for (const p of scene.placed) m.set(p.id, describeRole(graph, full.foundingIds, p.id));
    return m;
  }, [graph, full, scene]);

  /* lineage highlight: ancestors + descendants (+ partners) of litId */
  const litSet = useMemo(() => {
    if (!litId || !graph.get(litId)) return null;
    const s = new Set<string>([litId]);
    for (const id of graph.ancestors(litId).keys()) s.add(id);
    for (const id of graph.descendants(litId).keys()) s.add(id);
    for (const p of graph.partnersOf(litId)) s.add(p.person.id);
    return s;
  }, [graph, litId]);

  const unitMembers = useCallback(
    (unitId: string | null) => {
      if (!unitId || !full) return [];
      const u = full.units.get(unitId);
      return u ? [u.primaryId, ...u.partnerIds] : [];
    },
    [full],
  );
  const unitLit = useCallback((unitId: string | null) => !!litSet && unitMembers(unitId).some((m) => litSet.has(m)), [litSet, unitMembers]);

  /* ---------------- zoom & pan ---------------- */
  const applyLod = useCallback((k: number) => {
    const next = lodFor(k);
    setLod((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const world = worldRef.current;
    if (!svg || !world) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.02, 3.5])
      .clickDistance(7)
      .tapDistance(12)
      .on("zoom", (ev: { transform: ZoomTransform }) => {
        transformRef.current = ev.transform;
        world.setAttribute("transform", ev.transform.toString());
        applyLod(ev.transform.k);
      });
    zoomRef.current = z;
    const sel = select(svg);
    sel.call(z);
    return () => {
      sel.on(".zoom", null);
    };
  }, [applyLod]);

  const viewport = useCallback(() => {
    const svg = svgRef.current;
    const r = svg?.getBoundingClientRect();
    const i = insetsRef.current ?? {};
    const w = r?.width ?? 800;
    const h = r?.height ?? 600;
    const left = i.left ?? 0;
    const top = i.top ?? 0;
    return { w, h, left, top, aw: Math.max(80, w - left - (i.right ?? 0)), ah: Math.max(80, h - top - (i.bottom ?? 0)) };
  }, []);

  const go = useCallback((t: ZoomTransform, ms: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    const sel = select(svg);
    if (ms > 0 && !REDUCED) sel.transition().duration(ms).call(z.transform, t);
    else sel.call(z.transform, t);
  }, []);

  const fit = useCallback(
    (ms = 900) => {
      if (!scene) return;
      const { aw, ah, left, top } = viewport();
      const b = scene.bounds;
      const bw = b.maxX - b.minX;
      const bh = b.maxY - b.minY;
      const k = Math.min(aw / bw, ah / bh) * 0.95;
      zoomRef.current?.scaleExtent([Math.min(0.02, k * 0.5), 3.5]);
      const t = zoomIdentity
        .translate(left + aw / 2 - ((b.minX + b.maxX) / 2) * k, top + ah / 2 - ((b.minY + b.maxY) / 2) * k)
        .scale(k);
      go(t, ms);
    },
    [scene, viewport, go],
  );

  const focusOn = useCallback(
    (id: string, ms = 950) => {
      const p = scene?.placedById.get(id);
      if (!p) return false;
      const { aw, ah, left, top } = viewport();
      const k = Math.max(transformRef.current.k, 1);
      const t = zoomIdentity.translate(left + aw / 2 - p.x * k, top + ah * 0.46 - p.y * k).scale(k);
      go(t, ms);
      return true;
    },
    [scene, viewport, go],
  );

  // First paint: show the whole tree so roots, trunk and canopy read at a glance.
  useEffect(() => {
    if (!scene || fittedRef.current || !zoomRef.current) return;
    fittedRef.current = true;
    fit(0);
  }, [scene, fit]);

  useEffect(() => {
    const onResize = () => {
      if (!fittedRef.current) return;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Glide to someone when asked; unfold their branch first if needed.
  useEffect(() => {
    if (!focus || !full) return;
    const reveal = unitsToReveal(full, focus.id).filter((id) => collapsed.has(id));
    if (reveal.length) {
      pendingFocus.current = focus.id;
      setCollapsed((prev) => {
        const next = new Set(prev);
        for (const id of reveal) next.delete(id);
        return next;
      });
    } else {
      focusOn(focus.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.tick]);

  useEffect(() => {
    const id = pendingFocus.current;
    if (id && scene?.placedById.has(id)) {
      pendingFocus.current = null;
      window.setTimeout(() => focusOn(id), 60);
    }
  }, [scene, focusOn]);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem("ft-guide-seen")) setShowGuide(true);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const closeGuide = () => {
    setShowGuide(false);
    try {
      window.localStorage.setItem("ft-guide-seen", "1");
    } catch {
      /* ignore */
    }
  };

  const toggleUnit = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allOpen = collapsed.size === 0;
  const toggleAll = () => {
    if (!full) return;
    if (allOpen) {
      const next = new Set<string>();
      for (const u of full.units.values()) if (u.gen >= 2 && u.children.length) next.add(u.id);
      setCollapsed(next);
    } else setCollapsed(new Set());
  };

  const zoomBy = (f: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    select(svg).transition().duration(REDUCED ? 0 : 280).call(z.scaleBy, f);
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z || e.target !== svg) return;
    const step = 80;
    if (e.key === "+" || e.key === "=") zoomBy(1.25);
    else if (e.key === "-") zoomBy(0.8);
    else if (e.key === "0") fit();
    else if (e.key.startsWith("Arrow")) {
      const dx = e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0;
      const dy = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
      select(svg).transition().duration(180).call(z.translateBy, dx / transformRef.current.k, dy / transformRef.current.k);
    } else return;
    e.preventDefault();
  };

  if (!scene || !full) {
    return (
      <div className={`ft-root ft-empty ${className ?? ""}`}>
        <p>No one in the tree yet.</p>
      </div>
    );
  }

  const b = scene.bounds;
  const carved = (title ?? scene.familyLabel ?? "").trim();
  const dimAll = !!litSet;
  const branchLimbs = scene.limbs.filter((l) => l.kind !== "twig");
  const twigs = scene.limbs.filter((l) => l.kind === "twig");

  return (
    <div className={`ft-root ${className ?? ""}`} data-lod={lod}>
      <svg
        ref={svgRef}
        className="ft-svg"
        role="application"
        aria-label="Family tree. Drag to explore, pinch or scroll to zoom, tap a person to open them."
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <TreeDefs />
        <g ref={worldRef}>
          <rect
            className="ft-backdrop"
            x={b.minX - 6000}
            y={b.minY - 6000}
            width={b.maxX - b.minX + 12000}
            height={b.maxY - b.minY + 12000}
            onClick={() => onClear?.()}
          />
          <ellipse className="ft-canopy-light" cx={scene.canopy.cx} cy={scene.canopy.cy} rx={scene.canopy.rx} ry={scene.canopy.ry} fill="url(#ft-glow)" />
          <rect className="ft-ground" x={b.minX - 6000} y={0} width={b.maxX - b.minX + 12000} height={b.maxY + 6000} fill="url(#ft-soil)" onClick={() => onClear?.()} />
          <path className="ft-horizon" d={`M${b.minX - 6000} 0H${b.maxX + 6000}`} />
          <text className="ft-origins" x={0} y={46}>
            Roots · Where we began
          </text>

          <g className="ft-roots">
            {scene.roots.map((r) => (
              <LimbView key={r.id} limb={r} lit={!!litSet && !!r.ends && litSet.has(r.ends[0]) && litSet.has(r.ends[1])} dim={dimAll && !(r.ends && litSet?.has(r.ends[1]))} delay={150} />
            ))}
          </g>

          <LeafLayer leaves={scene.leaves} layer="back" />

          <g className="ft-wood">
            {branchLimbs.map((l) => {
              const lit = !!litSet && unitLit(l.parentUnitId) && unitLit(l.childUnitId);
              return <LimbView key={l.id} limb={l} lit={lit} dim={dimAll && !lit} delay={l.kind === "decor" ? 200 : 120 + (full.units.get(l.childUnitId ?? "")?.gen ?? 1) * 110} />;
            })}
            {twigs.map((l) => (
              <LimbView key={l.id} limb={l} lit={false} dim={dimAll && !unitLit(l.childUnitId)} delay={400 + (full.units.get(l.childUnitId ?? "")?.gen ?? 1) * 110} />
            ))}
            <TrunkView scene={scene} title={carved} />
          </g>
          <path className="ft-grass" d={scene.grass} />

          <LeafLayer leaves={scene.leaves} layer="front" />

          <g className="ft-lineage-labels">
            {scene.limbs
              .filter((l) => l.label)
              .map((l) => (
                <LineageLabel key={l.id} limb={l} />
              ))}
          </g>

          <g className="ft-knobs">
            {scene.units.map((u) => (
              <UnitKnob key={u.id} unit={u} onToggle={toggleUnit} dim={dimAll && !unitLit(u.id)} />
            ))}
          </g>

          <g className="ft-people">
            {scene.placed.map((p) => {
              const lit = !!litSet && litSet.has(p.id);
              return (
                <PersonNode
                  key={p.id}
                  placed={p}
                  graph={graph}
                  role={roles.get(p.id) ?? ""}
                  selected={p.id === selectedId}
                  lit={lit}
                  dim={dimAll && !lit}
                  isMe={p.id === meId}
                  onSelect={onSelect}
                />
              );
            })}
          </g>
        </g>
      </svg>

      <div className="ft-vignette" aria-hidden="true" />

      <div className="ft-controls" role="toolbar" aria-label="Tree view controls">
        <button type="button" className="ft-ctl" onClick={() => zoomBy(1.35)} aria-label="Zoom in">
          <Icon d="M12 5v14M5 12h14" label="Zoom in" />
        </button>
        <button type="button" className="ft-ctl" onClick={() => zoomBy(1 / 1.35)} aria-label="Zoom out">
          <Icon d="M5 12h14" label="Zoom out" />
        </button>
        <button
          type="button"
          className="ft-ctl"
          onClick={() => {
            onClear?.();
            fit();
          }}
          aria-label="Show the whole family"
        >
          <Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" label="Whole family" />
        </button>
        <button type="button" className="ft-ctl" onClick={toggleAll} aria-label={allOpen ? "Fold younger branches" : "Unfold every branch"} aria-pressed={!allOpen}>
          {allOpen ? <Icon d="M7 14l5-5 5 5" label="Fold" /> : <Icon d="M7 10l5 5 5-5" label="Unfold" />}
        </button>
        <button type="button" className="ft-ctl" onClick={() => setShowGuide((v) => !v)} aria-label="How to read the tree" aria-expanded={showGuide}>
          <Icon d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" label="Guide" />
        </button>
      </div>

      {showGuide && (
        <div className="ft-guide" role="dialog" aria-label="How to read the tree">
          <p className="ft-guide-title">Reading the tree</p>
          <ul>
            <li>
              <span className="ft-guide-key ft-guide-key--root" />
              <span>
                <b>Roots</b> — the oldest ancestors, where the family began
              </span>
            </li>
            <li>
              <span className="ft-guide-key ft-guide-key--trunk" />
              <span>
                <b>Trunk</b> — the founding couple everyone shares
              </span>
            </li>
            <li>
              <span className="ft-guide-key ft-guide-key--branch" />
              <span>
                <b>Branches</b> — each child of the founders starts a family line
              </span>
            </li>
            <li>
              <span className="ft-guide-key ft-guide-key--leaf" />
              <span>
                <b>Canopy</b> — the newest generations, at the outer edges
              </span>
            </li>
          </ul>
          <p className="ft-guide-hint">Drag to explore · pinch or scroll to zoom · tap someone to light their line.</p>
          <button type="button" className="ft-guide-close" onClick={closeGuide}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
