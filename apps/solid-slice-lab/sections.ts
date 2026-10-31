import * as THREE from 'three';

export type Solid = 'cube' | 'cuboid' | 'prism' | 'pyramid' | 'cylinder' | 'cone';
export type SectionKind = 'empty' | 'triangle' | 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'trapezoid' | 'quadrilateral' | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon' | 'circle' | 'ellipse' | 'curved';
export interface Section { points: THREE.Vector3[]; kind: SectionKind; area: number; note: string }
export interface CutPose { normal: THREE.Vector3; distance: number; section: Section }
export const labels: Record<SectionKind,string> = {
 empty:'未切到立体',triangle:'三角形',square:'正方形',rectangle:'长方形',rhombus:'菱形',parallelogram:'平行四边形',trapezoid:'梯形',quadrilateral:'其他四边形',pentagon:'五边形',hexagon:'六边形',heptagon:'七边形',octagon:'八边形',circle:'圆',ellipse:'椭圆',curved:'含曲线的截面',
};
export const TARGETS: SectionKind[] = ['triangle','square','rectangle','rhombus','parallelogram','trapezoid','quadrilateral','pentagon','hexagon','heptagon','octagon','circle','ellipse'];
export const dimensions = { cylinder:{r:1.5,h:3.2},cone:{r:1.65,h:3.2} };
const EPS=1e-7;

export function createSolid(shape:Solid,sides=4){
 if(shape==='cube')return new THREE.BoxGeometry(2.7,2.7,2.7);
 if(shape==='cuboid')return new THREE.BoxGeometry(3.6,2.6,2.2);
 const curved=shape==='cylinder'||shape==='cone',r=shape==='pyramid'||shape==='cone'?1.65:1.5;
 const n=curved?256:sides,g=new THREE.CylinderGeometry(shape==='pyramid'||shape==='cone'?0:r,r,3.2,n,1,false);
 if(!curved)g.rotateY(Math.PI/sides);
 return g;
}
export function frame(normal:THREE.Vector3){
 const helper=Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
 const u=new THREE.Vector3().crossVectors(normal,helper).normalize();
 return {u,v:new THREE.Vector3().crossVectors(normal,u).normalize()};
}
export function ordered(points:THREE.Vector3[],normal:THREE.Vector3,straight=false){
 const unique:THREE.Vector3[]=[];
 for(const p of points)if(p.toArray().every(Number.isFinite)&&!unique.some(q=>q.distanceToSquared(p)<1e-12))unique.push(p);
 if(unique.length<3)return [];
 const center=unique.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/unique.length),{u,v}=frame(normal);
 unique.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(v),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(v),b.clone().sub(center).dot(u)));
 if(!straight)return unique;
 // Work with physical edges, then remove collinear edge contacts at vertices.
 return unique.filter((p,i)=>{
  const a=unique[(i+unique.length-1)%unique.length].clone().sub(p),b=unique[(i+1)%unique.length].clone().sub(p);
  return new THREE.Vector3().crossVectors(a,b).length()>1e-6*a.length()*b.length();
 });
}
export function polygonArea(points:THREE.Vector3[],normal:THREE.Vector3){
 const sum=new THREE.Vector3();for(let i=0;i<points.length;i++)sum.add(new THREE.Vector3().crossVectors(points[i],points[(i+1)%points.length]));
 return Math.abs(sum.dot(normal))/2;
}
export function polygonKind(p:THREE.Vector3[]):SectionKind{
 if(p.length<3)return 'empty';
 if(p.length!==4)return ({3:'triangle',5:'pentagon',6:'hexagon',7:'heptagon',8:'octagon'} as Record<number,SectionKind>)[p.length]||'curved';
 const e=p.map((a,i)=>p[(i+1)%4].clone().sub(a)),length=e.map(a=>a.length()),dir=e.map(a=>a.clone().normalize());
 const parallel=[new THREE.Vector3().crossVectors(dir[0],dir[2]).length()<1e-5,new THREE.Vector3().crossVectors(dir[1],dir[3]).length()<1e-5];
 const right=dir.every((a,i)=>Math.abs(a.dot(dir[(i+1)%4]))<1e-5),equal=Math.max(...length)-Math.min(...length)<1e-5*Math.max(...length);
 if(right)return equal?'square':'rectangle';
 if(parallel.every(Boolean))return equal?'rhombus':'parallelogram';
 if(parallel.filter(Boolean).length===1)return 'trapezoid';
 return 'quadrilateral';
}
export function physicalEdges(g:THREE.BufferGeometry){
 const wire=new THREE.EdgesGeometry(g,.1),p=wire.getAttribute('position'),edges: [THREE.Vector3,THREE.Vector3][]=[];
 for(let i=0;i<p.count;i+=2)edges.push([new THREE.Vector3().fromBufferAttribute(p,i),new THREE.Vector3().fromBufferAttribute(p,i+1)]);
 wire.dispose();return edges;
}
export function polygonSection(edges:[THREE.Vector3,THREE.Vector3][],plane:THREE.Plane):Section{
 const pts:THREE.Vector3[]=[];
 for(const [a,b] of edges){const da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);if(Math.abs(da)<EPS)pts.push(a);if(Math.abs(db)<EPS)pts.push(b);if(da*db<0)pts.push(a.clone().lerp(b,da/(da-db)))}
 const points=ordered(pts,plane.normal,true),area=polygonArea(points,plane.normal);
 if(area<1e-7)return {points:[],kind:'empty',area:0,note:'切面未穿过立体内部，或只接触一个点、一条线。'};
 return {points,kind:polygonKind(points),area,note:''};
}
function angleRoots(a:number,b:number,c:number){
 const amplitude=Math.hypot(a,b);if(amplitude<EPS||Math.abs(c)>amplitude+EPS)return [];
 const phi=Math.atan2(b,a),delta=Math.acos(THREE.MathUtils.clamp(c/amplitude,-1,1));return [phi-delta,phi+delta];
}
function capChord(n:THREE.Vector3,d:number,y:number,r:number){
 const radial=Math.hypot(n.x,n.z),signed=(d-n.y*y)/radial;
 if(radial<EPS||Math.abs(signed)>r+EPS)return [];
 const foot=new THREE.Vector3(n.x/radial*signed,y,n.z/radial*signed),half=Math.sqrt(Math.max(0,r*r-signed*signed)),tangent=new THREE.Vector3(-n.z/radial,0,n.x/radial);
 return [foot.clone().addScaledVector(tangent,half),foot.clone().addScaledVector(tangent,-half)];
}
export function roundSection(shape:'cylinder'|'cone',plane:THREE.Plane):Section{
 const {r,h}=dimensions[shape],n=plane.normal,d=-plane.constant,radial=Math.hypot(n.x,n.z),pts:THREE.Vector3[]=[];
 let kind:SectionKind='curved',note='截面含有曲线，不能把弧线当成多边形的直边。';
 if(shape==='cylinder'&&Math.abs(n.y)<EPS){
  const chord=capChord(n,d,0,r);if(chord.length===2)for(const p of chord){pts.push(new THREE.Vector3(p.x,-h/2,p.z),new THREE.Vector3(p.x,h/2,p.z))}
  kind='rectangle';note='切面平行于圆柱的轴，得到长方形。';
 }else if(shape==='cone'&&Math.abs(d-n.y*h/2)<EPS){
  pts.push(new THREE.Vector3(0,h/2,0),...capChord(n,d,-h/2,r));kind='triangle';note='切面经过圆锥顶点并切入底面，得到三角形。';
 }else {
  const angles=Array.from({length:720},(_,i)=>i*Math.PI*2/720);
  for(const y of shape==='cylinder'?[-h/2,h/2]:[-h/2])angles.push(...angleRoots(r*n.x,r*n.z,d-n.y*y));
  let allInside=true;
  for(const a of angles){
   const x=r*Math.cos(a),z=r*Math.sin(a);
   if(shape==='cylinder'){
    const y=(d-n.x*x-n.z*z)/n.y;
    if(y>=-h/2-EPS&&y<=h/2+EPS)pts.push(new THREE.Vector3(x,y,z));else allInside=false;
   }else {
    const denominator=n.x*x+n.z*z-n.y*h,t=(d-n.y*h/2)/denominator;
    if(Number.isFinite(t)&&t>=-EPS&&t<=1+EPS)pts.push(new THREE.Vector3(x*t,h/2-h*t,z*t));else allInside=false;
   }
  }
  if(allInside&&pts.length>20){kind=radial<EPS?'circle':'ellipse';note=kind==='circle'?'切面平行于底面，得到圆。':'斜切侧面，且切面不碰到底面，得到完整椭圆。'}
 }
 const points=ordered(pts,n),area=polygonArea(points,n);
 if(points.length<3||area<1e-7)return {points:[],kind:'empty',area:0,note:'切面未穿过立体内部，或只与表面相切。'};
 return {points,kind,area,note};
}
export function sectionFor(shape:Solid,g:THREE.BufferGeometry,plane:THREE.Plane){
 return shape==='cylinder'||shape==='cone'?roundSection(shape,plane):polygonSection(physicalEdges(g),plane);
}
function normalFor(tilt:number,turn:number){const a=tilt*Math.PI/180,b=turn*Math.PI/180;return new THREE.Vector3(Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)).normalize()}
const catalogCache=new Map<string,Map<SectionKind,CutPose>>();
export function targetCatalog(shape:Solid,sides=4){
 const key=shape+':'+sides;if(catalogCache.has(key))return catalogCache.get(key)!;
 const found=new Map<SectionKind,CutPose>(),g=createSolid(shape,sides);
 if(shape==='cylinder'||shape==='cone'){
  for(const [tilt,turn,distance] of [[0,0,0],[shape==='cylinder'?45:40,20,0],[90,0,0]]){
   const normal=normalFor(tilt,turn),plane=new THREE.Plane(normal,-distance),section=roundSection(shape,plane);
   if(TARGETS.includes(section.kind))found.set(section.kind,{normal,distance,section});
  }
 }else {
  const edges=physicalEdges(g),vertices=edges.flat(),scores=new Map<SectionKind,number>();
  const turns=new Set<number>();for(let a=0;a<360;a+=15)turns.add(a);for(let j=0;j<4*sides;j++)turns.add(j*90/sides);
  for(const tilt of [0,15,30,35.264389682754654,45,54.735610317245346,60,75,90])for(const turn of turns){
   const normal=normalFor(tilt,turn),dots=vertices.map(v=>v.dot(normal)),min=Math.min(...dots),max=Math.max(...dots);
   for(const fraction of [.08,.15,.25,.35,.5,.65,.75,.85,.92]){
    const distance=min+(max-min)*fraction,section=polygonSection(edges,new THREE.Plane(normal,-distance));
    if(!TARGETS.includes(section.kind)||section.area<.08)continue;
    const lengths=section.points.map((v,i)=>v.distanceTo(section.points[(i+1)%section.points.length])),short=Math.min(...lengths);
    if(short<.16)continue;const score=short/Math.max(...lengths)+section.area*.025;
    if(score>(scores.get(section.kind)??-Infinity)){found.set(section.kind,{normal:normal.clone(),distance,section});scores.set(section.kind,score)}
   }
  }
 }
 g.dispose();catalogCache.set(key,found);return found;
}
export function unavailableReason(shape:Solid,kind:SectionKind){
 if(shape==='cylinder')return '圆柱的平面截面可为圆、椭圆、长方形或含曲线的图形，不能切出真正的'+labels[kind]+'。';
 if(shape==='cone')return '圆锥的平面截面可为圆、椭圆、三角形或含曲线的图形，不能切出真正的'+labels[kind]+'。';
 return '当前立体未收录这种截面的自动定位示例，请选择可定位的选项，或手动探索。';
}
export function faceGeometry(section:Section){
 if(section.points.length<3)return null;
 const center=section.points.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/section.points.length),data:number[]=[];
 for(let i=0;i<section.points.length;i++)data.push(...center.toArray(),...section.points[i].toArray(),...section.points[(i+1)%section.points.length].toArray());
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();return g;
}
