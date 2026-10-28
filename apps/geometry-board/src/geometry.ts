import type { Document, Point, Rotation, Size, Vec, View } from "./model";
import { uid } from "./model";
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const degrees = (r: number) => (r * 180) / Math.PI;
export function rotate(p: Vec, center: Vec, angle: number): Vec {
  const r = (angle * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    x = p.x - center.x,
    y = p.y - center.y;
  return { x: center.x + x * c - y * s, y: center.y + x * s + y * c };
}
export const toScreen = (p: Vec, view: View, size: Size): Vec => ({
  x: size.width / 2 + (p.x - view.x) * view.scale,
  y: size.height / 2 - (p.y - view.y) * view.scale,
});
export const toWorld = (p: Vec, view: View, size: Size): Vec => ({
  x: view.x + (p.x - size.width / 2) / view.scale,
  y: view.y - (p.y - size.height / 2) / view.scale,
});
export function zoomAt(
  view: View,
  size: Size,
  screen: Vec,
  scale: number,
): View {
  scale = Math.max(8, Math.min(500, scale));
  const before = toWorld(screen, view, size);
  return {
    scale,
    x: before.x - (screen.x - size.width / 2) / scale,
    y: before.y + (screen.y - size.height / 2) / scale,
  };
}
export function fitView(points: Vec[], size: Size): View {
  if (!points.length) return { x: 0, y: 0, scale: 55 };
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    bottom = Math.min(...ys),
    top = Math.max(...ys);
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    scale: Math.max(
      8,
      Math.min(
        90,
        (size.width - 150) / Math.max(2, right - left),
        (size.height - 180) / Math.max(2, top - bottom),
      ),
    ),
  };
}
export function nearestPoint(
  points: Point[],
  world: Vec,
  scale: number,
  tolerance = 12,
) {
  return points
    .map((p) => ({ p, d: distance(p, world) * scale }))
    .filter((o) => o.d <= tolerance)
    .sort((a, b) => a.d - b.d)[0]?.p;
}
export function angleAt(a: Vec, b: Vec, c: Vec) {
  const u = { x: a.x - b.x, y: a.y - b.y },
    v = { x: c.x - b.x, y: c.y - b.y };
  const lengths = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  return lengths < 1e-10
    ? NaN
    : degrees(
        Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / lengths))),
      );
}
export function previewPoints(draft: Rotation): Point[] {
  return draft.originals.map((p) => ({
    ...p,
    ...rotate(p, draft.center, draft.angle),
  }));
}
export function copyLabels(doc: Document, originals: Point[]) {
  const taken = new Set(doc.points.map((p) => p.label));
  return originals.map((p) => {
    let label = `${p.label}′`;
    while (taken.has(label)) label += "′";
    taken.add(label);
    return label;
  });
}
export function commitRotation(
  doc: Document,
  draft: Rotation,
  copy: boolean,
): Document {
  const transformed = previewPoints(draft);
  if (!copy)
    return {
      ...doc,
      points: doc.points.map(
        (p) => transformed.find((t) => t.id === p.id) || p,
      ),
      shapes: doc.shapes.some(
        (s) => s.vertices.join() === draft.originals.map((p) => p.id).join(),
      )
        ? doc.shapes
        : [
            ...doc.shapes,
            {
              id: uid("s"),
              kind: draft.kind,
              vertices: draft.originals.map((p) => p.id),
              color: "#008780",
            },
          ],
    };
  const labels = copyLabels(doc, draft.originals);
  const copies = transformed.map((p, i) => ({
    ...p,
    id: uid(),
    label: labels[i],
  }));
  return {
    ...doc,
    points: [...doc.points, ...copies],
    shapes: [
      ...doc.shapes,
      {
        id: uid("s"),
        kind: draft.kind,
        vertices: copies.map((p) => p.id),
        color: "#008780",
        rotation: { angle: draft.angle, center: { ...draft.center } },
      },
    ],
  };
}
export function rotationReference(draft: Rotation) {
  const p = draft.originals.find((p) => distance(p, draft.center) > 1e-8);
  return p ? Math.atan2(p.y - draft.center.y, p.x - draft.center.x) : 0;
}
export function arcPath(
  center: Vec,
  radius: number,
  start: number,
  angle: number,
): string {
  const steps = Math.max(1, Math.ceil(Math.abs(angle) / 150));
  let text = `M ${center.x + radius * Math.cos(start)} ${center.y - radius * Math.sin(start)}`;
  for (let i = 1; i <= steps; i++) {
    const a = start + (((angle * Math.PI) / 180) * i) / steps;
    text += ` A ${radius} ${radius} 0 0 ${angle >= 0 ? 0 : 1} ${center.x + radius * Math.cos(a)} ${center.y - radius * Math.sin(a)}`;
  }
  return text;
}
export function polygonArea(points: Vec[]) {
  return (
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2
  );
}
