import { smooth } from './units';
export const CUP_RADIUS = 5;
export const CUP_HEIGHT = 1000 / (Math.PI * CUP_RADIUS ** 2);
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
function gaussRule(n: number) {
  const nodes: { x: number; w: number }[] = [];
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + .75) / (n + .5)), derivative = 0;
    for (let iteration = 0; iteration < 30; iteration++) {
      let p0 = 1, p1 = z;
      for (let k = 2; k <= n; k++) { const p = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p; }
      derivative = n * (z * p1 - p0) / (z * z - 1);
      const delta = p1 / derivative; z -= delta; if (Math.abs(delta) < 1e-15) break;
    }
    nodes.push({ x: z, w: 2 / ((1 - z * z) * derivative * derivative) });
  }
  return nodes;
}
const GAUSS = gaussRule(20);
function integrate(from: number, to: number, fn: (x: number) => number) {
  if (to <= from) return 0;
  const mid = (from + to) / 2, half = (to - from) / 2;
  return half * GAUSS.reduce((sum, p) => sum + p.w * fn(mid + half * p.x), 0);
}
/** Stable cross-section integral of a tilted cylinder clipped below a gravity plane.
 * Local x²+z² <= r², 0 <= y <= h. Rotation about Z is -angle.
 * Plane in the untilted local frame: y cos(angle) - x sin(angle) <= level.
 * Split at the bottom/top intersections, then use Gaussian quadrature on smooth
 * trigonometric intervals. This avoids subtracting nearly equal circular segments.
 */
export function cylinderVolumeBelow(level: number, angle: number, r = CUP_RADIUS, h = CUP_HEIGHT): number {
  if (Math.abs(angle) < 1e-8) return Math.PI * r * r * clamp(level, 0, h);
  const a = level / Math.cos(angle), b = Math.tan(angle);
  const zero = -a / b, lo = clamp(zero, -r, r), hi = clamp((h - a) / b, -r, r);
  const phi0 = zero >= -r && zero <= r ? Math.acos(zero / r) : null;
  const linear = integrate(Math.acos(hi / r), Math.acos(lo / r), phi => {
    const depth = phi0 !== null ? b * (-2 * r * Math.sin((phi + phi0) / 2) * Math.sin((phi - phi0) / 2)) : a + b * r * Math.cos(phi);
    return 2 * r * r * Math.sin(phi) ** 2 * clamp(depth, 0, h);
  });
  const full = integrate(0, Math.acos(hi / r), phi => 2 * r * r * Math.sin(phi) ** 2 * h);
  return clamp(linear + full, 0, Math.PI * r * r * h);
}
export function liquidPlane(volume: number, angle: number): number {
  if (volume <= 0) return -CUP_RADIUS * Math.sin(angle);
  if (Math.abs(angle) < 1e-8) return volume / (Math.PI * CUP_RADIUS ** 2);
  let low = -CUP_RADIUS * Math.sin(angle), high = CUP_HEIGHT * Math.cos(angle) + CUP_RADIUS * Math.sin(angle);
  for (let i = 0; i < 44; i++) { const mid = (low + high) / 2; if (cylinderVolumeBelow(mid, angle) < volume) low = mid; else high = mid; }
  return (low + high) / 2;
}
/** Maximum angle that retains the given amount without crossing the lowest point of the rim. */
export function spillAngle(remaining: number): number {
  if (remaining <= 0) return Math.PI / 2;
  if (remaining >= 1000 - 1e-8) return 0;
  let low = 0, high = Math.PI / 2 - 1e-7;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2, rim = CUP_HEIGHT * Math.cos(mid) - CUP_RADIUS * Math.sin(mid);
    if (cylinderVolumeBelow(rim, mid) > remaining) low = mid; else high = mid;
  }
  return (low + high) / 2;
}
export function pourFraction(progress: number) { return smooth((progress - .18) / .64); }
export function pourAngle(progress: number, startCup: number, currentCup: number, endCup: number) {
  if (progress < .18) return spillAngle(startCup) * smooth(progress / .18);
  if (progress > .82) return spillAngle(endCup) * (1 - smooth((progress - .82) / .18));
  return spillAngle(currentCup);
}
