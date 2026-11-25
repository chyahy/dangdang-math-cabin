import {P, add, sub, mul, dot, norm, area, mixP, ease, phase} from '../geometry.mjs';

export const cross = (u, v) => u.x * v.y - u.y * v.x;
export const rect = (x, y, w, h = w) => [P(x,y), P(x+w,y), P(x+w,y+h), P(x,y+h)];
export const shift = (poly, offset) => poly.map(p => add(p, offset));
export const centroid = poly => mul(poly.reduce(add, P(0,0)), 1/poly.length);
export const rotate = (p, angle) => P(p.x*Math.cos(angle)-p.y*Math.sin(angle), p.x*Math.sin(angle)+p.y*Math.cos(angle));
export const polygon = (points, color, extra = {}) => ({points, color, ...extra});
export const line = (from, to, color = 'guide', extra = {}) => ({from, to, color, ...extra});
export const label = (text, point, color = 'guide') => ({text, point, color});

export function signedArea(poly) {
  return poly.reduce((sum,p,i) => sum + cross(p,poly[(i+1)%poly.length]), 0)/2;
}

export function clip(poly, u, v, side = 1) {
  const normal = p => side * cross(sub(v,u),sub(p,u));
  const result = [];
  poly.forEach((p,i) => {
    const q = poly[(i+1)%poly.length], dp = normal(p), dq = normal(q);
    if (dp >= -1e-10) result.push(p);
    if ((dp > 1e-10 && dq < -1e-10) || (dp < -1e-10 && dq > 1e-10)) result.push(mixP(p,q,dp/(dp-dq)));
  });
  return result;
}

export function intersect(poly, target) {
  const side = Math.sign(signedArea(target));
  return target.reduce((clipped,p,i) => clip(clipped,p,target[(i+1)%target.length],side), poly);
}

// Target vertex order may start anywhere and may run in either direction.
export function rigidMap(source, target, allowMirror = false) {
  const origin = source[0], u = sub(source[1], origin);
  const tol = Math.max(1,...source.map(p=>norm(sub(p,origin)))) * 1e-8;
  for (const mirror of allowMirror ? [false,true] : [false]) {
    for (let i=0; i<target.length; i++) for (const order of [1,-1]) {
      const match = source.map((_,j) => target[(i+j*order+target.length)%target.length]);
      const flip = p => P(p.x,mirror?-p.y:p.y);
      const v = sub(match[1],match[0]), flipped = flip(u);
      const angle = Math.atan2(cross(flipped,v),dot(flipped,v));
      if (source.every((p,j) => norm(sub(add(match[0],rotate(flip(sub(p,origin)),angle)),match[j]))<tol))
        return {angle, mirror, origin, end:match[0]};
    }
  }
  throw new Error('Source and target polygons must be congruent.');
}

export function piece(id, color, source, target, moveAt, allowMirror = false, name = '') {
  return {id,color,source,target,moveAt,name,area:area(source),motion:rigidMap(source,target,allowMirror)};
}

export function movingPoints(part, progress) {
  const {motion,source} = part;
  const {origin,end,angle,mirror}=motion;
  const t=ease(progress);
  if (mirror) {
    // Lift the reflection into 3D first. A paper flip preserves spatial lengths;
    // its orthographic projection is temporarily foreshortened.
    return source.map(p => {
      const q=sub(p,origin);
      return add(mixP(origin,end,t),rotate(P(q.x,q.y*Math.cos(Math.PI*t)),angle*t));
    });
  }
  return source.map(p => add(mixP(origin,end,t),rotate(sub(p,origin),angle*t)));
}
