import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSolid,targetCatalog,sectionFor,roundSection,dimensions,polygonKind,TARGETS,unavailableReason} from './sections.ts';
let cases=0;
function close(a,b,tolerance=1e-6){assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`)}
for(const shape of ['cube','cuboid','prism','pyramid','cylinder','cone'])for(const sides of shape==='prism'||shape==='pyramid'?[3,4,5,6]:[4]){
 const g=createSolid(shape,sides),catalog=targetCatalog(shape,sides);assert.ok(catalog.size>=2);
 for(const [target,pose] of catalog){
  const plane=new THREE.Plane(pose.normal,-pose.distance),s=sectionFor(shape,g,plane);
  assert.equal(s.kind,target,shape+' '+sides+' '+target);assert.ok(s.area>.08);
  for(const p of s.points)close(plane.distanceToPoint(p),0,5e-6);
  if(shape==='cylinder'||shape==='cone')for(const p of s.points){const {r,h}=dimensions[shape];assert.ok(p.y>=-h/2-1e-6&&p.y<=h/2+1e-6);assert.ok(Math.hypot(p.x,p.z)<=r*(shape==='cone'?(h/2-p.y)/h:1)+1e-6)}
  else assert.equal(polygonKind(s.points),target);
  cases++;
 }
 g.dispose();
}
for(const shape of ['cylinder','cone']){
 const {r,h}=dimensions[shape],circle=roundSection(shape,new THREE.Plane(new THREE.Vector3(0,1,0),0)),expected=Math.PI*(shape==='cone'?r/2:r)**2;
 assert.equal(circle.kind,'circle');close(circle.area/expected,1,.00003);
 const vertical=roundSection(shape,new THREE.Plane(new THREE.Vector3(1,0,0),0));
 assert.equal(vertical.kind,shape==='cylinder'?'rectangle':'triangle');close(vertical.area,shape==='cylinder'?2*r*h:r*h);
 assert.equal(roundSection(shape,new THREE.Plane(new THREE.Vector3(0,1,0),-10)).kind,'empty');
 assert.ok(!targetCatalog(shape).has('trapezoid'));assert.match(unavailableReason(shape,'trapezoid'),/不能/);
 // Arbitrary tilted planes remain inside the actual round solid and in the cutting plane.
 for(let i=0;i<80;i++){
  const normal=new THREE.Vector3(Math.sin(i*.71),Math.cos(i*.29),Math.sin(i*.37)).normalize(),plane=new THREE.Plane(normal,(i%15-7)/4),section=roundSection(shape,plane);
  for(const p of section.points){close(plane.distanceToPoint(p),0,1e-5);assert.ok(p.y>=-h/2-1e-6&&p.y<=h/2+1e-6);assert.ok(Math.hypot(p.x,p.z)<=r*(shape==='cone'?(h/2-p.y)/h:1)+1e-5)}
  if(section.kind==='trapezoid')throw Error('A true round surface cannot be labeled trapezoid');
 }
}
assert.ok(targetCatalog('cube').has('trapezoid'));
assert.ok(targetCatalog('cube').has('hexagon'));
console.log(`PASS ${cases} automatic cut poses across all solids and base choices; true plane membership, square/rectangle/rhombus/trapezoid distinctions; analytic cylinder/cone circle and axial areas; 160 arbitrary round cuts; impossible trapezoids rejected.`);
