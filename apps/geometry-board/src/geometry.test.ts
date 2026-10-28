import { describe, expect, it } from "vitest";
import {
  angleAt,
  arcPath,
  commitRotation,
  distance,
  fitView,
  nearestPoint,
  polygonArea,
  previewPoints,
  rotate,
  toScreen,
  toWorld,
  zoomAt,
} from "./geometry";
import {
  deleteSelection,
  emptyDocument,
  nextLabel,
  selectedIds,
  type Point,
  type Rotation,
} from "./model";
import { example5, exampleMeasurements } from "./preset";
import { fileData, parseBoard } from "./persistence";
describe("standard rotation matrix in mathematical coordinates", () => {
  it.each([0, 30, 45, 60, 90, 180, 270, 360, -30, -90, -180, -360])(
    "keeps lengths and center at %s°",
    (angle) => {
      const c = { x: 2.1, y: -1.3 },
        a = { x: 5.2, y: 3.7 },
        b = { x: -4.9, y: 8.3 };
      expect(distance(rotate(a, c, angle), rotate(b, c, angle))).toBeCloseTo(
        distance(a, b),
        10,
      );
      expect(rotate(c, c, angle)).toEqual(c);
    },
  );
  it("positive is counterclockwise, not SVG screen clockwise", () => {
    const p = rotate({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
    expect(
      toScreen(p, { x: 0, y: 0, scale: 50 }, { width: 800, height: 600 }).y,
    ).toBeCloseTo(250);
  });
  it("30 then 60 always starts from immutable original coordinates", () => {
    const d = example5(),
      draft: Rotation = {
        originals: d.points.slice(0, 2),
        center: d.points[3],
        centerId: "ex-D",
        angle: -30,
        kind: "polygon",
      };
    const snapshot = JSON.stringify(draft.originals);
    previewPoints(draft);
    draft.angle = -60;
    expect(distance(previewPoints(draft)[0], d.points[2])).toBeLessThan(1e-10);
    expect(JSON.stringify(draft.originals)).toBe(snapshot);
  });
  it("checks 1000 random rotations and zoom coordinate round trips", () => {
    let seed = 99;
    const rng = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let i = 0; i < 1000; i++) {
      const a = { x: rng() * 30 - 15, y: rng() * 30 - 15 },
        b = { x: rng() * 30, y: rng() * 30 },
        c = { x: rng() * 5, y: rng() * 5 },
        angle = rng() * 720 - 360;
      expect(distance(rotate(a, c, angle), rotate(b, c, angle))).toBeCloseTo(
        distance(a, b),
        9,
      );
      const v = { x: rng() * 20, y: rng() * 20, scale: 8 + rng() * 492 },
        size = { width: 842, height: 621 },
        r = toWorld(toScreen(a, v, size), v, size);
      expect(r.x).toBeCloseTo(a.x, 10);
      expect(r.y).toBeCloseTo(a.y, 10);
      const pixel = { x: rng() * 800, y: rng() * 600 },
        before = toWorld(pixel, v, size),
        after = toWorld(pixel, zoomAt(v, size, pixel, v.scale * 1.4), size);
      expect(distance(before, after)).toBeLessThan(1e-10);
    }
  });
  it("builds complete 360° arcs as multiple arcs rather than a zero-length SVG arc", () => {
    const path = arcPath({ x: 0, y: 0 }, 40, 0, 360);
    expect(path.match(/ A /g)).toHaveLength(3);
  });
});
describe("real example5, with honest handling of the supplied conclusion", () => {
  it("satisfies ALL known conditions and A maps to C under clockwise 60° about D", () => {
    const d = example5(),
      m = exampleMeasurements(d)!;
    expect(m.valid).toBe(true);
    expect(m.angleB).toBeCloseTo(30, 10);
    expect(m.angleD).toBeCloseTo(60, 10);
    expect(m.ad).toBeCloseTo(m.cd, 10);
    expect(distance(rotate(m.a, m.d, -60), m.c)).toBeLessThan(1e-10);
    expect(m.lhs).toBeCloseTo(160, 10);
    expect(m.rhs).toBeCloseTo(64, 10);
  });
  it("does not force A to C after the student edits the figure", () => {
    const d = example5();
    d.points[0].x = 5;
    const m = exampleMeasurements(d)!;
    expect(m.valid).toBe(false);
    expect(distance(rotate(m.a, m.d, -60), m.c)).toBeGreaterThan(0.99);
  });
  it("fits all points inside a wide and a narrow viewport", () => {
    for (const size of [
      { width: 900, height: 600 },
      { width: 360, height: 450 },
    ]) {
      const d = example5(),
        v = fitView(d.points, size);
      for (const p of d.points) {
        const q = toScreen(p, v, size);
        expect(q.x).toBeGreaterThan(30);
        expect(q.x).toBeLessThan(size.width - 30);
        expect(q.y).toBeGreaterThan(30);
        expect(q.y).toBeLessThan(size.height - 30);
      }
    }
  });
});
describe("point references and independent copies", () => {
  it("selects ABD from a quadrilateral without adding another shape", () => {
    const d = example5();
    expect(
      selectedIds(d, { kind: "vertices", ids: ["ex-A", "ex-B", "ex-D"] }),
    ).toEqual(["ex-A", "ex-B", "ex-D"]);
    expect(d.shapes).toHaveLength(2);
  });
  it("copy rotation creates independent IDs for ALL vertices including the center", () => {
    const d = example5(),
      before = structuredClone(d),
      r: Rotation = {
        originals: [d.points[0], d.points[1], d.points[3]],
        center: { x: 0, y: 0 },
        centerId: "ex-D",
        angle: 60,
        kind: "polygon",
      };
    const next = commitRotation(d, r, true),
      copy = next.points.slice(4);
    expect(d).toEqual(before);
    expect(next.shapes).toHaveLength(3);
    expect(copy.map((p) => p.label)).toEqual(["A′", "B′", "D′"]);
    expect(new Set(next.points.map((p) => p.id)).size).toBe(7);
    copy[0].x = 123;
    expect(d.points[0].x).toBe(before.points[0].x);
    const twice = commitRotation(next, r, true);
    expect(twice.points.at(-3)!.label).toBe("A′′");
  });
  it("explicit original rotation keeps point IDs and updates associated shapes", () => {
    const d = example5(),
      r: Rotation = {
        originals: [d.points[0], d.points[1], d.points[3]],
        center: d.points[3],
        angle: -60,
        kind: "polygon",
      };
    const next = commitRotation(d, r, false);
    expect(next.points).toHaveLength(4);
    expect(next.points[0].id).toBe("ex-A");
    expect(distance(next.points[0], d.points[2])).toBeLessThan(1e-10);
    expect(next.shapes[0].vertices).toEqual(d.shapes[0].vertices);
  });
  it("deletion cannot leave dangling references and shape deletion keeps its points", () => {
    const d = example5(),
      next = deleteSelection(d, { kind: "point", id: "ex-B" });
    expect(next.shapes).toHaveLength(0);
    expect(next.points).toHaveLength(3);
    const shapeOnly = deleteSelection(d, { kind: "shape", id: "ex-quad" });
    expect(shapeOnly.points).toHaveLength(4);
    expect(shapeOnly.shapes).toHaveLength(1);
    expect(
      deleteSelection(d, { kind: "vertices", ids: ["ex-A", "ex-B", "ex-D"] }),
    ).toEqual(d);
  });
  it("names beyond Z, reuses existing points, and detects zero-area triangles", () => {
    const points: Point[] = Array.from({ length: 26 }, (_, i) => ({
      id: String(i),
      label: String.fromCharCode(65 + i),
      x: i,
      y: 0,
    }));
    expect(nextLabel(points)).toBe("AA");
    expect(nearestPoint(points, { x: 2.1, y: 0 }, 100)?.label).toBe("C");
    expect(nearestPoint(points, { x: 2.2, y: 0 }, 100)).toBeUndefined();
    expect(polygonArea(points.slice(0, 3))).toBe(0);
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNaN();
  });
});
describe("versioned JSON persistence", () => {
  const file = () => fileData(example5(), { x: 4, y: 2, scale: 55 });
  it("round trips geometry, IDs and view without restoring ephemeral previews", () => {
    const saved = file();
    expect(parseBoard(JSON.stringify(saved))).toEqual(saved);
    expect(
      parseBoard(
        JSON.stringify(fileData(emptyDocument(), { x: 0, y: 0, scale: 55 })),
      ),
    ).toEqual(fileData(emptyDocument(), { x: 0, y: 0, scale: 55 }));
  });
  it.each([
    "duplicate-point",
    "bad-reference",
    "nonfinite",
    "bad-scale",
    "bad-color",
    "duplicate-shape",
  ])("rejects corrupt %s", (kind) => {
    const f = file();
    if (kind === "duplicate-point")
      f.document.points.push(f.document.points[0]);
    if (kind === "bad-reference") f.document.shapes[0].vertices[0] = "missing";
    if (kind === "nonfinite") f.document.points[0].x = Infinity;
    if (kind === "bad-scale") f.view.scale = 0;
    if (kind === "bad-color")
      f.document.shapes[0].color = "url(javascript:bad)";
    if (kind === "duplicate-shape")
      f.document.shapes.push(f.document.shapes[0]);
    expect(() => parseBoard(JSON.stringify(f))).toThrow();
  });
  it("rejects unrelated JSON and oversized content", () => {
    expect(() => parseBoard("{}")).toThrow();
    expect(() => parseBoard(" ".repeat(4_000_001))).toThrow();
  });
});
