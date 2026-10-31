const assert=require('node:assert/strict');require('./nets.js');const N=globalThis.SolidNets;
const distance=(a,b)=>Math.hypot(...N.sub(a,b));
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
let cases=0;
for(const kind of ['cylinder','cone'])for(const [r,h] of [[1,3],[2.4,1],[.7,5]])for(const t of [0,.01,.1,.25,.5,.75,.9,.99,1]){
 const m=N.curvedUnfold(kind,{r,h},t),eps=1e-5;
 assert.equal(m.faces.length,kind==='cylinder'?98:97);
 // Numerical first fundamental form: material lengths are invariant, not lerped.
 const u=kind==='cone'?m.l*.6:r*.8,v=kind==='cone'?.2:0;
 const p=m.point(u,v),du=N.sub(m.point(u+eps,v),m.point(u-eps,v)).map(x=>x/(2*eps)),dv=N.sub(m.point(u,v+eps),m.point(u,v-eps)).map(x=>x/(2*eps));
 close(Math.hypot(...du),1);close(Math.hypot(...dv),kind==='cone'?u:1);close(N.dot(du,dv),0);
 for(let i=0;i<95;i++){
  const a=m.faces[i],b=m.faces[i+1];close(distance(a.points[kind==='cone'?2:1],b.points[kind==='cone'?1:0]),0);
 }
 for(const disk of m.faces.filter(f=>f.group!=='side')){
  const center=disk.points.reduce((a,p)=>a.map((v,i)=>v+p[i]/disk.points.length),[0,0,0]);
  for(const p of disk.points){close(distance(p,center),r);close(N.dot(N.sub(p,center),disk.normal),0)}
  close(distance(disk.points[0],disk.pivot),0);
 }
 close(m.sideArea,kind==='cylinder'?2*Math.PI*r*h:Math.PI*r*m.l);
 if(kind==='cone')for(const f of m.faces.slice(0,96))for(const p of f.points.slice(1))close(distance(p,[0,h/2,0]),m.l);
 if(t===0){
  if(kind==='cylinder')close(distance(m.point(-Math.PI*r,0),m.point(Math.PI*r,0)),0);
  else {const p=m.point(m.l,0);close(p[1],-h/2);close(Math.hypot(p[0],p[2]),r)}
 }
 if(t===1){
  if(kind==='cylinder'){close(distance(m.point(-Math.PI*r,0),m.point(Math.PI*r,0)),2*Math.PI*r);for(const f of m.faces)for(const p of f.points)close(p[2],r)}
  else {for(const f of m.faces)for(const p of f.points)close(p[1],h/2);close(m.sectorAngle*m.l,2*Math.PI*r)}
  const area=m.faces.filter(f=>f.group==='side').reduce((s,f)=>s+N.polygonArea(f.points),0);assert.ok(Math.abs(area/m.sideArea-1)<.001);
 }
 cases++;
}
console.log(`PASS ${cases} curved-surface states: invariant intrinsic metric, joined patches, rigid circular bases, tangent contact, closed geometry, accurate final rectangle/sector and conserved area.`);
