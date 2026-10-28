export type Vec = { x: number; y: number };
export type Point = Vec & { id: string; label: string };
export type Shape = {
  id: string;
  kind: "segment" | "polygon";
  vertices: string[];
  color?: string;
  rotation?: { angle: number; center: Vec };
};
export type Document = {
  points: Point[];
  shapes: Shape[];
  preset?: "example5";
};
export type View = Vec & { scale: number };
export type Size = { width: number; height: number };
export type Selection =
  | { kind: "shape"; id: string }
  | { kind: "vertices"; ids: string[] }
  | { kind: "point"; id: string }
  | null;
export type Tool =
  | "select"
  | "point"
  | "segment"
  | "triangle"
  | "polygon"
  | "vertices"
  | "rotate"
  | "pan"
  | "delete";
export type Rotation = {
  originals: Point[];
  center: Vec;
  centerId?: string;
  angle: number;
  kind: Shape["kind"];
};
export type BoardFile = {
  format: "dangdang-geometry";
  version: 1;
  document: Document;
  view: View;
};
export const uid = (prefix = "p") => `${prefix}-${crypto.randomUUID()}`;
export const emptyDocument = (): Document => ({ points: [], shapes: [] });
export function nextLabel(points: Point[]) {
  for (let n = 0; n < 10000; n++) {
    let k = n + 1,
      label = "";
    while (k > 0) {
      k--;
      label = String.fromCharCode(65 + (k % 26)) + label;
      k = Math.floor(k / 26);
    }
    if (!points.some((p) => p.label === label)) return label;
  }
  throw new Error("点的数量已达上限");
}
export function selectedIds(doc: Document, selection: Selection): string[] {
  if (!selection) return [];
  if (selection.kind === "point") return [selection.id];
  if (selection.kind === "vertices")
    return selection.ids.filter((id) => doc.points.some((p) => p.id === id));
  return doc.shapes.find((s) => s.id === selection.id)?.vertices || [];
}
export function objectName(doc: Document, ids: string[]) {
  const text = ids
    .map((id) => doc.points.find((p) => p.id === id)?.label || "?")
    .join("");
  return `${ids.length === 3 ? "△" : ids.length === 2 ? "线段 " : ids.length > 3 ? "多边形 " : "点 "}${text}`;
}
export function deleteSelection(doc: Document, selection: Selection): Document {
  if (!selection) return doc;
  // A temporary vertex combination is a selection, not an object to destroy.
  if (selection.kind === "vertices") return doc;
  if (selection.kind === "shape")
    return { ...doc, shapes: doc.shapes.filter((s) => s.id !== selection.id) };
  const removed = new Set([selection.id]);
  return {
    ...doc,
    points: doc.points.filter((p) => !removed.has(p.id)),
    shapes: doc.shapes.filter((s) => !s.vertices.some((id) => removed.has(id))),
  };
}
