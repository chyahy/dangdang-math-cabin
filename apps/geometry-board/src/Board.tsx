import type { RefObject } from "react";
import {
  arcPath,
  copyLabels,
  distance,
  previewPoints,
  rotationReference,
  toScreen,
} from "./geometry";
import {
  objectName,
  selectedIds,
  type Document,
  type Point,
  type Rotation,
  type Selection,
  type Size,
  type Tool,
  type Vec,
  type View,
} from "./model";
import { exampleMeasurements } from "./preset";
import { useBoardInteraction } from "./useBoardInteraction";
type Props = {
  svg: RefObject<SVGSVGElement | null>;
  doc: Document;
  docRef: RefObject<Document>;
  size: Size;
  view: View;
  selection: Selection;
  tool: Tool;
  construction: string[];
  cursor: Vec;
  draft: Rotation | null;
  copy: boolean;
  setView: (v: View) => void;
  setCursor: (v: Vec) => void;
  selectPoint: (id: string) => void;
  click: (v: Vec, pointId?: string, shapeId?: string) => void;
  setAngle: (n: number) => void;
  fitPreview: () => void;
  begin: () => void;
  preview: (d: Document) => void;
  end: () => void;
  cancel: () => void;
};
const blue = "#2861ce",
  teal = "#008780",
  ink = "#24364a";
export function Board(p: Props) {
  const { doc, size, view, draft } = p,
    screen = (v: Vec) => toScreen(v, view, size),
    selected = selectedIds(doc, p.selection);
  const interaction = useBoardInteraction({
    svg: p.svg,
    doc: p.docRef,
    size,
    view,
    setView: p.setView,
    tool: p.tool,
    draft,
    cursor: p.setCursor,
    selectPoint: p.selectPoint,
    click: p.click,
    setAngle: p.setAngle,
    fitPreview: p.fitPreview,
    begin: p.begin,
    preview: p.preview,
    end: p.end,
    cancel: p.cancel,
  });
  const unit = view.scale < 24 ? 5 : view.scale > 130 ? 0.5 : 1,
    spacing = unit * view.scale,
    origin = screen({ x: 0, y: 0 });
  const poly = (points: Vec[]) =>
    points
      .map((pt) => {
        const q = screen(pt);
        return `${q.x},${q.y}`;
      })
      .join(" ");
  const pointsFor = (ids: string[]) =>
    ids.map((id) => doc.points.find((pt) => pt.id === id)!).filter(Boolean);
  const renderShape = (
    ids: string[],
    kind: string,
    color: string,
    highlight = false,
    shapeId?: string,
  ) => {
    const pts = pointsFor(ids);
    if (pts.length < 2) return null;
    const Tag = kind === "polygon" ? "polygon" : "polyline";
    return (
      <g key={shapeId} data-shape={shapeId} aria-label={objectName(doc, ids)}>
        <Tag
          points={poly(pts)}
          fill={kind === "polygon" ? color : "none"}
          fillOpacity={highlight ? 0.13 : 0.045}
          stroke={color}
          strokeWidth={highlight ? 3 : 2}
          strokeLinejoin="round"
        />
        <Tag
          data-no-export="true"
          points={poly(pts)}
          fill={kind === "polygon" ? "transparent" : "none"}
          stroke="transparent"
          strokeWidth={16}
          strokeLinejoin="round"
          style={{ cursor: p.tool === "delete" ? "not-allowed" : "pointer" }}
        />
      </g>
    );
  };
  const measurement = doc.preset ? exampleMeasurements(doc) : null;
  const construction = pointsFor(p.construction);
  const ghost = draft ? previewPoints(draft) : [];
  const ghostLabels = draft ? copyLabels(doc, draft.originals) : [];
  const center = draft && screen(draft.center),
    reference = draft ? rotationReference(draft) : 0;
  const handleRadius = draft
    ? Math.min(
        190,
        Math.max(
          90,
          ...draft.originals.map((v) => distance(v, draft.center) * view.scale),
        ),
      )
    : 120;
  const handle =
    center && draft
      ? {
          x:
            center.x +
            handleRadius * Math.cos(reference + (draft.angle * Math.PI) / 180),
          y:
            center.y -
            handleRadius * Math.sin(reference + (draft.angle * Math.PI) / 180),
        }
      : null;
  function angleMark(a: Point, b: Point, c: Point, label: string) {
    const start = Math.atan2(a.y - b.y, a.x - b.x),
      end = Math.atan2(c.y - b.y, c.x - b.x);
    let delta = end - start;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const s = screen(b),
      angle = start + delta / 2;
    return (
      <g pointerEvents="none">
        <path
          d={arcPath(s, 25, start, (delta * 180) / Math.PI)}
          fill="none"
          stroke="#8796ab"
          strokeWidth="1.3"
        />
        <text
          x={s.x + 45 * Math.cos(angle)}
          y={s.y - 45 * Math.sin(angle)}
          fill="#64768a"
          textAnchor="middle"
          fontSize="12"
        >
          {label}
        </text>
      </g>
    );
  }
  return (
    <svg
      ref={p.svg}
      className={`geometry-canvas tool-${p.tool}`}
      viewBox={`0 0 ${size.width} ${size.height}`}
      aria-label="交互几何画板"
      role="application"
      tabIndex={0}
      {...interaction}
    >
      <title>几何画板：使用左侧工具绘图，滚轮缩放，空白处拖动平移</title>
      <defs>
        <pattern
          id="geo-grid"
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
          x={((origin.x % spacing) + spacing) % spacing}
          y={((origin.y % spacing) + spacing) % spacing}
        >
          <path
            d={`M ${spacing} 0 L 0 0 0 ${spacing}`}
            fill="none"
            stroke="#dfe7f0"
            strokeWidth=".7"
          />
        </pattern>
      </defs>
      <rect width={size.width} height={size.height} fill="#fbfcfe" />
      <rect width={size.width} height={size.height} fill="url(#geo-grid)" />
      {doc.shapes.map((s) =>
        renderShape(
          s.vertices,
          s.kind,
          s.color || blue,
          p.selection?.kind === "shape" && p.selection.id === s.id,
          s.id,
        ),
      )}
      {p.selection?.kind === "vertices" && selected.length >= 2 && (
        <polygon
          data-no-export="true"
          points={poly(pointsFor(selected))}
          fill={teal}
          fillOpacity=".1"
          stroke={teal}
          strokeWidth="3"
          strokeDasharray="7 4"
          pointerEvents="none"
        />
      )}
      {measurement && (
        <g>
          {angleMark(
            measurement.a,
            measurement.b,
            measurement.c,
            `${Number.isFinite(measurement.angleB) ? measurement.angleB.toFixed(1) : "—"}°`,
          )}
          {angleMark(
            measurement.a,
            measurement.d,
            measurement.c,
            `${Number.isFinite(measurement.angleD) ? measurement.angleD.toFixed(1) : "—"}°`,
          )}
          {Math.abs(measurement.ad - measurement.cd) < 1e-6 &&
            [measurement.a, measurement.c].map((pt) => {
              const a = screen(pt),
                b = screen(measurement.d),
                mx = (a.x + b.x) / 2,
                my = (a.y + b.y) / 2,
                ang = Math.atan2(a.y - b.y, a.x - b.x) + Math.PI / 2;
              return (
                <line
                  key={pt.id}
                  x1={mx - 5 * Math.cos(ang)}
                  y1={my - 5 * Math.sin(ang)}
                  x2={mx + 5 * Math.cos(ang)}
                  y2={my + 5 * Math.sin(ang)}
                  stroke={blue}
                  strokeWidth="2"
                  pointerEvents="none"
                />
              );
            })}
        </g>
      )}
      {construction.length > 0 && (
        <g pointerEvents="none" data-no-export="true">
          <polyline
            points={poly([...construction, p.cursor])}
            fill="none"
            stroke={teal}
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          {construction.map((pt) => (
            <circle
              key={pt.id}
              cx={screen(pt).x}
              cy={screen(pt).y}
              r="10"
              fill="none"
              stroke={teal}
              strokeWidth="2"
            />
          ))}
        </g>
      )}
      {doc.points.map((pt) => {
        const s = screen(pt),
          chosen = selected.includes(pt.id);
        return (
          <g
            key={pt.id}
            data-point={pt.id}
            data-label={pt.label}
            data-world-x={pt.x}
            data-world-y={pt.y}
            aria-label={`点${pt.label}`}
          >
            {chosen && (
              <circle
                data-no-export="true"
                cx={s.x}
                cy={s.y}
                r="10"
                fill="white"
                stroke={teal}
                strokeWidth="1.7"
              />
            )}
            <circle
              cx={s.x}
              cy={s.y}
              r={chosen ? 4.5 : 4}
              fill={chosen ? teal : ink}
              stroke="white"
              strokeWidth="1.5"
            />
            <text
              x={s.x - 10}
              y={s.y - 12}
              fontFamily="Cambria, Georgia, serif"
              fontSize="18"
              fontStyle="italic"
              fill={ink}
              paintOrder="stroke"
              stroke="#fbfcfe"
              strokeWidth="3"
            >
              {pt.label}
            </text>
            <circle
              data-no-export="true"
              cx={s.x}
              cy={s.y}
              r="13"
              fill="transparent"
              style={{ cursor: p.tool === "select" ? "grab" : "crosshair" }}
            />
          </g>
        );
      })}
      {draft && center && handle && (
        <g>
          <polygon
            points={poly(draft.originals)}
            fill="none"
            stroke={blue}
            strokeWidth="3"
            strokeLinejoin="round"
            pointerEvents="none"
          />
          <polygon
            points={ghost
              .map((pt) => {
                const q = screen(pt);
                return `${q.x},${q.y}`;
              })
              .join(" ")}
            fill={draft.kind === "polygon" ? teal : "none"}
            fillOpacity=".12"
            stroke={teal}
            strokeWidth="2.6"
            strokeDasharray="7 4"
            strokeLinejoin="round"
            pointerEvents="none"
          />
          {ghost.map((pt, i) => {
            const q = screen(pt),
              coincident = doc.points.find(
                (o) => o.id !== pt.id && distance(o, pt) < 1e-7,
              );
            return (
              <g
                key={pt.id}
                pointerEvents="none"
                data-preview-point={pt.id}
                data-world-x={pt.x}
                data-world-y={pt.y}
              >
                <circle
                  cx={q.x}
                  cy={q.y}
                  r="6"
                  fill="white"
                  stroke={teal}
                  strokeWidth="2"
                />
                <text
                  x={q.x + 12}
                  y={q.y + 22}
                  fill={teal}
                  fontFamily="Cambria,Georgia,serif"
                  fontSize="17"
                  paintOrder="stroke"
                  stroke="#fbfcfe"
                  strokeWidth="3"
                >
                  {p.copy ? ghostLabels[i] : pt.label}
                  {coincident ? ` = ${coincident.label}` : ""}
                </text>
              </g>
            );
          })}
          <line
            data-no-export="true"
            x1={center.x}
            y1={center.y}
            x2={center.x + handleRadius * Math.cos(reference)}
            y2={center.y - handleRadius * Math.sin(reference)}
            stroke="#b0becf"
            strokeDasharray="4 4"
          />
          <line
            data-no-export="true"
            x1={center.x}
            y1={center.y}
            x2={handle.x}
            y2={handle.y}
            stroke={teal}
            strokeOpacity=".5"
          />
          {Math.abs(draft.angle) > 0.01 && (
            <>
              <path
                d={arcPath(center, 44, reference, draft.angle)}
                fill="none"
                stroke="#dc8a2c"
                strokeWidth="2.5"
              />
              <text
                x={
                  center.x +
                  90 * Math.cos(reference + (draft.angle * Math.PI) / 360)
                }
                y={
                  center.y -
                  90 * Math.sin(reference + (draft.angle * Math.PI) / 360)
                }
                fill="#9c6015"
                fontSize="13"
                textAnchor="middle"
                paintOrder="stroke"
                stroke="white"
                strokeWidth="3"
              >
                {Math.abs(draft.angle).toFixed(1).replace(".0", "")}°
              </text>
            </>
          )}
          <circle
            cx={center.x}
            cy={center.y}
            r="11"
            fill="white"
            stroke="#dc8a2c"
            strokeWidth="2"
          />
          <path
            d={`M ${center.x - 5} ${center.y} h 10 M ${center.x} ${center.y - 5} v 10`}
            stroke="#dc8a2c"
            strokeWidth="2"
          />
          <g
            data-rotation-handle="true"
            data-no-export="true"
            aria-label="拖动旋转手柄"
            style={{ cursor: "grab" }}
          >
            <circle cx={handle.x} cy={handle.y} r="22" fill="transparent" />
            <circle
              cx={handle.x}
              cy={handle.y}
              r="12"
              fill={teal}
              stroke="white"
              strokeWidth="3"
            />
            <path
              d={`M ${handle.x - 5} ${handle.y + 3} A 6 6 0 1 1 ${handle.x + 5} ${handle.y - 3} M ${handle.x + 5} ${handle.y - 3} v -4 m 0 4 h -4`}
              fill="none"
              stroke="white"
              strokeWidth="1.4"
            />
          </g>
        </g>
      )}
    </svg>
  );
}
