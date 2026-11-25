import test from 'node:test';
import assert from 'node:assert/strict';
import {P,add,sub,mul,area,norm,dot} from '../src/geometry.mjs';
import {centroid,intersect,movingPoints,rigidMap,cross,signedArea} from '../src/proofs/primitives.mjs';
import * as cuttings from '../src/proofs/cuttings.mjs';
import * as comparisons from '../src/proofs/comparisons.mjs';
import * as extensions from '../src/proofs/extensions.mjs';

const fixed=[[3,4],[5,12],[8,15],[4,3],[5,5],[2.5,4.5],[1,20],[20,1],[6,8],[4.999,5]];
let seed=43068;
function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return 1+19*seed/2**32}
const samples=[...fixed,...Array.from({length:70},()=>[random(),random()])];
const near=(a,b,context='')=>assert.ok(Math.abs(a-b)<1e-6,context+' '+a+' ≠ '+b);
const areaSum=ps=>ps.reduce((a,p)=>a+area(p),0);
const intersectionArea=(poly, targets)=>areaSum(targets.map(t=>intersect(poly,t)));
function convex(poly) {
 const sign=Math.sign(signedArea(poly));
 assert(sign!==0);
 for(let i=0;i<poly.length;i++){
  const u=poly[i],v=poly[(i+1)%poly.length];
  assert(Number.isFinite(u.x)&&Number.isFinite(u.y));
  for(const w of poly)assert(cross(sub(v,u),sub(w,u))*sign>=-1e-7);
 }
}
function covers(pieces,target) {
 near(areaSum(pieces),areaSum(target),'total area');
 pieces.forEach((p,i)=>{
  convex(p);
  near(intersectionArea(p,target),area(p),'outside boundary');
  for (const q of pieces.slice(i+1)) near(area(intersect(p,q)),0,'interior overlap');
 });
}
function validateSquare(poly) {
 const edges=poly.map((p,i)=>sub(poly[(i+1)%4],p));
 for(let i=0;i<4;i++){near(norm(edges[i]),norm(edges[0]));near(dot(edges[i],edges[(i+1)%4]),0)}
}
const builders={...cuttings,...comparisons};
for(const name of ['bricks','seven','perigal','diagonalPair','offsetPair','daVinci','equalHeight','pinwheel']){
 test(name+' partitions the original and covers the exact target geometry',()=>{
  for (const [a,b] of samples){
   const g=builders[name](a,b);
   let originals=(g.sourceRegions??g.originals.map(x=>x.points));
   covers(g.pieces.map(x=>x.source),originals);
   covers(g.pieces.map(x=>x.target),g.targets);
   if(!['daVinci','pinwheel'].includes(name))validateSquare(g.targets[0]);
   const expected=name==='bricks'||name==='daVinci'?a*a+b*b+a*b*(name==='daVinci'?1:.5):a*a+b*b;
   near(areaSum(g.targets),expected,name);
   for(const part of g.pieces){
    const initial=part.change?part.change(0):movingPoints(part,0);
    const final=part.change?part.change(1):movingPoints(part,1);
    near(area(intersect(initial,part.source)),part.area,'initial');
    near(area(intersect(final,part.target)),part.area,'final');
    if(part.change&&name==='daVinci'||part.motion?.mirror)continue;
    for(let i=0;i<=20;i++) near(area(part.change?part.change(i/20):movingPoints(part,i/20)),part.area,'continuous area');
   }
  }
 });
}
for(const name of ['trapezoids','mirrorHex']){
 test(name+' cancels pairwise congruent blocks from equal-area outlines',()=>{
  for(const [a,b] of samples){
   const g=builders[name](a,b),{left,right,leftMain,rightMain}=g.cancellation;
   near(area(left),area(right));validateSquare(rightMain[0]);
   covers([...leftMain,...g.auxiliary.map(x=>x.source)],[left]);
   covers([...rightMain,...g.auxiliary.map(x=>x.target)],[right]);
   for(const part of g.auxiliary)near(area(part.source),area(part.target));
   for(const part of g.halves){
    const end=part.change?part.change(1):movingPoints(part,1);
    near(area(intersect(end,part.target)),part.area);
   }
  }
 });
}
test('seven-piece equal-leg limit has four nondegenerate pieces',()=>assert.equal(cuttings.seven(5,5).pieces.length,4));
test('pinwheel center vanishes and the four triangles still form two rectangles',()=>{
 for(const [a,b] of samples){const g=comparisons.pinwheel(a,b),center=g.pieces.find(p=>p.id==='difference');near(center?.area??0,(b-a)**2);if(center)validateSquare(center.target);}
});
test('similar triangles scale uniformly and meet along the shared ab leg',()=>{
 for(const [a,b] of samples){
  const g=extensions.scaled(a,b);
  for(const p of g.poses)rigidMap(p.source,p.target,true);
  covers(g.poses.map(p=>p.target),g.targets);
  near(norm(sub(...g.join)),a*b);
  near(norm(sub(g.comparison[0],g.comparison[1])),a*g.c);
  near(norm(sub(g.comparison[0],g.comparison[2])),b*g.c);
  near(norm(sub(g.comparison[1],g.comparison[2])),g.c*g.c);
 }
});
test('rectangular projections use the two positive lengths a² and b²',()=>{
 for(const [a,b] of samples){
  const g=extensions.projection(a,b),[left,peak,right]=g.projection;
  near(norm(sub(peak,left)),a*a);near(norm(sub(right,peak)),b*b);
  near(norm(sub(right,left)),g.c**2);
  near(dot(sub(g.box[1],g.box[0]),sub(g.box[3],g.box[0])),0);
 }
});
test('circle tangent and secant share the same exterior point and their segment lengths are correct',()=>{
 for(const [a,b] of samples){
  const {center,tangent,outside,near:N,far:F,c}=extensions.secant(a,b);
  near(norm(sub(center,tangent)),b);near(norm(sub(center,N)),b);near(norm(sub(center,F)),b);
  near(dot(sub(center,tangent),sub(outside,tangent)),0);
  near(cross(sub(outside,N),sub(outside,F)),0);
  near(norm(sub(outside,N)),c-b);near(norm(sub(outside,F)),c+b);
  near(norm(sub(outside,tangent))**2,(c-b)*(c+b));
 }
});
