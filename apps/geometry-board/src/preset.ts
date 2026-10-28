import type { Document } from "./model";
import { angleAt, distance } from "./geometry";
export function example5(): Document {
  // Exact convex coordinates: AD=CD=4, angle ABC=30°, angle ADC=60°.
  // The supplied conclusion is NOT generally valid. Never falsify this geometry to imply a proof.
  return {
    preset: "example5",
    points: [
      { id: "ex-A", label: "A", x: 2 * Math.sqrt(3), y: 2 },
      { id: "ex-B", label: "B", x: 6 * Math.sqrt(3), y: 2 },
      { id: "ex-C", label: "C", x: 2 * Math.sqrt(3), y: -2 },
      { id: "ex-D", label: "D", x: 0, y: 0 },
    ],
    shapes: [
      {
        id: "ex-quad",
        kind: "polygon",
        vertices: ["ex-A", "ex-B", "ex-C", "ex-D"],
      },
      { id: "ex-BD", kind: "segment", vertices: ["ex-B", "ex-D"] },
    ],
  };
}
export function exampleMeasurements(doc: Document) {
  const [a, b, c, d] = ["A", "B", "C", "D"].map((name) =>
    doc.points.find((p) => p.id === `ex-${name}`),
  );
  if (!a || !b || !c || !d) return null;
  const angleB = angleAt(a, b, c),
    angleD = angleAt(a, d, c),
    ad = distance(a, d),
    cd = distance(c, d);
  const lhs = distance(b, d) ** 2 + distance(a, b) ** 2,
    rhs = distance(b, c) ** 2;
  return {
    a,
    b,
    c,
    d,
    angleB,
    angleD,
    ad,
    cd,
    lhs,
    rhs,
    valid:
      Math.abs(angleB - 30) < 1e-6 &&
      Math.abs(angleD - 60) < 1e-6 &&
      Math.abs(ad - cd) < 1e-6,
  };
}
