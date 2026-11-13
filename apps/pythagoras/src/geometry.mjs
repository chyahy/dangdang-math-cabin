// All constructions use mathematical units. Only the final camera uses uniform scale.
export const P=(x,y)=>({x,y});
export const add=(p,q)=>P(p.x+q.x,p.y+q.y);
export const sub=(p,q)=>P(p.x-q.x,p.y-q.y);
export const mul=(p,s)=>P(p.x*s,p.y*s);
export const dot=(p,q)=>p.x*q.x+p.y*q.y;
export const norm=p=>Math.hypot(p.x,p.y);
export const hypotenuse=(a,b)=>Math.hypot(a,b);
export const rightTriangle=(a,b)=>[P(0,0),P(a,0),P(0,b)];
export function square(p,q,side=1){const v=sub(q,p),w=P(-side*v.y,side*v.x);return [p,q,add(q,w),add(p,w)]}
export function area(poly){return Math.abs(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p.x*q.y-p.y*q.x},0)/2)}
export const translationMatrix=(x,y)=>[1,0,0,1,x,y];
export const rotationMatrix=deg=>{const r=deg*Math.PI/180;return [Math.cos(r),Math.sin(r),-Math.sin(r),Math.cos(r),0,0]};
export const transform=(p,m)=>P(m[0]*p.x+m[2]*p.y+m[4],m[1]*p.x+m[3]*p.y+m[5]);
export function foot(p,u,v){const d=sub(v,u);return add(u,mul(d,dot(sub(p,u),d)/dot(d,d)))}
export function isRight(poly,tol=1e-9){return poly.some((p,i)=>{const u=sub(poly[(i+1)%3],p),v=sub(poly[(i+2)%3],p);return norm(u)>0&&norm(v)>0&&Math.abs(dot(u,v))<=tol*norm(u)*norm(v)})}
export const similarityRatio=(p,q)=>norm(sub(p[1],p[0]))/norm(sub(q[1],q[0]));
export function bounds(ps){return {minX:Math.min(...ps.map(p=>p.x)),minY:Math.min(...ps.map(p=>p.y)),maxX:Math.max(...ps.map(p=>p.x)),maxY:Math.max(...ps.map(p=>p.y))}}
export function camera(ps,box={x:80,y:65,w:840,h:480}){const b=bounds(ps);const s=Math.min(box.w/Math.max(.01,b.maxX-b.minX),box.h/Math.max(.01,b.maxY-b.minY));const tx=box.x+box.w/2-(b.minX+b.maxX)*s/2,ty=box.y+box.h/2-(b.minY+b.maxY)*s/2;return {s,tx,ty,map:p=>P(p.x*s+tx,p.y*s+ty)}}
export const clamp=(t,min=0,max=1)=>Math.max(min,Math.min(max,t));
export const mix=(a,b,t)=>a+(b-a)*t;
export const mixP=(a,b,t)=>P(mix(a.x,b.x,t),mix(a.y,b.y,t));
export const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
export const phase=(p,start,end=start+1)=>ease((p-start)/(end-start));
export function dissection(a,b,layout=0){const L=a+b;return layout===0?[{x:0,y:0,r:0},{x:L,y:0,r:90},{x:L,y:L,r:180},{x:0,y:L,r:270}]:[{x:0,y:a,r:0},{x:L,y:0,r:90},{x:a,y:L,r:180},{x:a,y:a,r:270}]}
export function posedTriangle(a,b,pose){const m=rotationMatrix(pose.r);return rightTriangle(a,b).map(p=>add(transform(p,m),pose))}
export function assembledPoses(a,b,p){const L=a+b;return dissection(a,b,0).map((pose,i)=>{const t=phase(p,i,i+1),sx=i===0||i===3?-1:1,sy=i<2?-1:1,shift=1-phase(t,.35,1);return {x:pose.x+sx*L*.65*shift,y:pose.y+sy*L*.65*shift,r:pose.r-25*(1-phase(t,0,.35))}})}
export function garfieldTriangles(a,b,p){const L=a+b,k=phase(p,0),first={x:-L*.25*(1-phase(k,0,.25)),y:0,r:0},second={x:(b+L*.3)*(1-phase(k,.7,1)),y:L*phase(k,.4,.7),r:-90*phase(k,0,.4)};return [posedTriangle(b,a,first),posedTriangle(b,a,second),[P(b,0),P(a,L),P(0,a)]]}
export function rearrangedPoses(a,b,t){const L=a+b,gap=L*.12,d=a+gap,s=n=>ease(t*6-n);return [
 {x:-(d*s(0))+(d*s(4)),y:a*s(3),r:0},
 {x:L,y:0,r:90},
 {x:L+d*s(1)-(L+d-a)*s(5),y:L,r:180},
 {x:a*s(2),y:L-b*s(2),r:270}
 ]}
export function hypFrame(a,b){const c=hypotenuse(a,b),m=a*a/c,n=b*b/c,h=a*b/c;return {a,b,c,m,n,h,A:P(m,-h),B:P(0,0),C:P(c,0),D:P(m,0)}}
// Two consecutive shears (each determinant 1), then a translation. No scaling.
// The first fixes the leg as base. The second fixes the vertical side of length c.
export function shearSquare(a,b,which,t){const {A,B,C,c,m,n,h}=hypFrame(a,b);const origin=which==='a'?B:C;const u=sub(A,origin),v=which==='a'?P(-h,-m):P(h,-n);const k=which==='a'?h/m:h/n;
 const first=clamp(t,0,1),second=clamp(t-1),third=clamp(t-2);
 const vv=add(v,mul(u,k*first)),uu=P(u.x,u.y*(1-second)),o=add(origin,P(0,c*third));
 return [o,add(o,uu),add(add(o,uu),vv),add(o,vv)];
}
export function oblique(a,b,degrees){const theta=degrees*Math.PI/180;const A=P(0,0),B=P(a,0),C=P(b*Math.cos(theta),-b*Math.sin(theta));const c=norm(sub(C,B));return {A,B,C,c,delta:a*a+b*b-c*c}}
export function advance(current,target,dt,speed=1,duration=1600){const direction=Math.sign(target-current);return current+direction*Math.min(Math.abs(target-current),Math.max(0,dt)*speed/duration)}
