import * as THREE from 'three';
import { CUP_HEIGHT as H, CUP_RADIUS as R, liquidPlane } from './beakerMath';
type P = [number, number, number];
/** Clip a closed cylinder against a gravity-aligned water plane and close the cut.
 * Coordinates remain inside the real beaker; liquid never rotates rigidly with the cup.
 */
export function cupWaterGeometry(volume: number, angle: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (volume <= 0) { geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); return geometry; }
  const plane = liquidPlane(volume, angle), sin = Math.sin(angle), cos = Math.cos(angle);
  const vertices: number[] = [], cuts: P[] = [];
  const signed = (p: P) => p[1] * cos - p[0] * sin - plane;
  function clip(triangle: P[]) {
    const polygon: P[] = [];
    for (let i = 0; i < triangle.length; i++) {
      const a = triangle[i], b = triangle[(i + 1) % triangle.length], da = signed(a), db = signed(b);
      if (da <= 1e-9) polygon.push(a);
      if ((da < -1e-9 && db > 1e-9) || (da > 1e-9 && db < -1e-9)) {
        const t = da / (da - db), point = a.map((n, k) => n + t * (b[k] - n)) as P;
        polygon.push(point); cuts.push(point);
      } else if (Math.abs(da) <= 1e-9) cuts.push(a);
    }
    for (let i = 1; i < polygon.length - 1; i++) vertices.push(...polygon[0], ...polygon[i], ...polygon[i + 1]);
  }
  const count = 96;
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, b = (i + 1) / count * Math.PI * 2;
    const p: P = [R * Math.cos(a), 0, R * Math.sin(a)], q: P = [R * Math.cos(b), 0, R * Math.sin(b)];
    const pt: P = [p[0], H, p[2]], qt: P = [q[0], H, q[2]];
    clip([p, pt, qt]); clip([p, qt, q]); clip([[0, 0, 0], p, q]); clip([[0, H, 0], qt, pt]);
  }
  if (volume < 1000 - 1e-8) {
    const unique = [...new Map(cuts.map(p => [p.map(v => Math.round(v * 1e7)).join(':'), p])).values()];
    if (unique.length >= 3) {
      const center = unique.reduce((out, p) => out.map((v, i) => v + p[i] / unique.length) as P, [0, 0, 0] as P);
      unique.sort((a, b) => Math.atan2(-(a[2] - center[2]), (a[0] - center[0]) * cos + (a[1] - center[1]) * sin) - Math.atan2(-(b[2] - center[2]), (b[0] - center[0]) * cos + (b[1] - center[1]) * sin));
      for (let i = 0; i < unique.length; i++) vertices.push(...center, ...unique[i], ...unique[(i + 1) % unique.length]);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
  return geometry;
}
