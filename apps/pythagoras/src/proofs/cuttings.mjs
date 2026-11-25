import {P, add, sub, mul, area, norm, mixP, foot, square, hypFrame, phase} from '../geometry.mjs';
import {rect,shift,rotate,polygon,line,label,centroid,clip,intersect,piece} from './primitives.mjs';

const tolerance = 1e-9;
const hasArea = poly => poly.length >= 3 && area(poly)>tolerance;

export function bricks(a,b) {
  const l=Math.max(a,b), s=Math.min(a,b), g=setup(l,s,a>b);
  const {O,A,B,U,W,tri,large,small,longColor:L,shortColor:S}=g;
  const corner=P(s,-s), E=P(0,l-s), F=P(l,l);
  const smallDestination=shift(small,P(s,0));
  const blueDestination=[corner,A,U];
  const largeTop=[O,B,F,E];
  const largeBottom=[E,F,P(0,l)];
  return {
    originals:[polygon(large,L),polygon(small,S),polygon(tri,'tri')], targets:[g.target,tri],
    cuts:[line(E,F,'cut',{at:2})], cutAt:2, ready:5,
    pieces:[
      piece('triangle','tri',tri,blueDestination,1,false,'原来的直角三角形'),
      piece('small',S,small,smallDestination,2),
      piece('large-triangle',L,largeBottom,shift(largeBottom,P(s,-2*l)),4),
      piece('large-rest',L,largeTop,largeTop.map(p=>add(P(s,0),rotate(p,-Math.PI/2))),5),
    ],
    outlines:[polygon(g.target,'c',{at:-1})],
    marks:[label(L+'²',centroid(large),L),label(S+'²',centroid(small),S)],
    // The small square partly occupies the triangle's old location, so the
    // congruent auxiliary area is cancelled symbolically from the two totals.
    finalNote:'新轮廓是斜边正方形与一个直角三角形的并集。',
  };
}

function setup(l,s,swap) {
  const O=P(0,0), A=P(0,-s), B=P(l,0), U=P(s,-s-l), W=P(l+s,-l);
  return {O,A,B,U,W,tri:[O,A,B],target:[A,B,W,U],large:rect(0,0,l),small:rect(-s,-s,s),
    longColor:swap?'a':'b',shortColor:swap?'b':'a'};
}

export function seven(a,b) {
  const l=Math.max(a,b),s=Math.min(a,b),d=l-s,g=setup(l,s,a>b);
  const {O,A,B,U,W,large,small,target,tri,longColor:L,shortColor:S}=g;
  const E=P(0,s),F=P(d,s),G=P(d,l),H=P(l,l);
  const opposite=p=>sub(add(A,W),p);
  const definitions=[
    ['long-1',L,[O,B,E],[A,B,P(l,-s)]],
    ['short-1',S,[A,O,P(-s,0)],[A,P(s,-s),P(s,-2*s)]],
    ['long-2',L,[B,F,G],[A,P(s,-2*s),U]],
    ['long-3',L,[B,G,H],[U,W,P(s,-l)]],
    ['short-2',S,[A,P(-s,0),P(-s,-s)],[A,P(s,-s),P(s,-2*s)].map(opposite)],
    ['long-4',L,[B,E,F],[A,P(s,-2*s),U].map(opposite)],
    ['center',L,rect(0,s,d),rect(s,-l,d)],
  ];
  // Two pieces and the center reduce to zero area when the legs are equal.
  const pieces=definitions.flatMap(([id,color,source,dest],i)=>hasArea(source)?[piece(id,color,source,dest,3+i,true)]:[]);
  return {originals:[polygon(large,L),polygon(small,S)],targets:[target],outlines:[polygon(target,'c',{at:-1})],
    context:[polygon(tri,'tri')],cuts:[line(A,P(-s,0),'cut',{at:0}),line(E,B,'cut',{at:0}),line(E,F,'cut',{at:1}),line(F,G,'cut',{at:1}),line(F,B,'cut',{at:1}),line(G,B,'cut',{at:1})],
    pieces,cutAt:2,ready:9,finalNote:d<tolerance?'两直角边相等，中心与两块侧片面积为零，其余四片仍恰好铺满。':''};
}

export function perigal(a,b) {
  const {A,B,C,c}=hypFrame(a,b);
  const shortIsA=a<=b, L=shortIsA?'b':'a', S=shortIsA?'a':'b';
  const large=shortIsA?square(C,A):square(A,B);
  const small=shortIsA?square(A,B):square(C,A);
  const target=rect(0,0,c), center=centroid(large);
  const side=norm(sub(large[1],large[0]));
  const markedLength=(a+b)/2;
  let dimension;
  for(let i=0;i<large.length&&!dimension;i++){
    const u=large[i],v=large[(i+1)%large.length],d=sub(v,u);
    for(const axis of ['x','y']){
      const ratio=(center[axis]-u[axis])/d[axis];
      if(ratio< -1e-9||ratio>1+1e-9||!Number.isFinite(ratio))continue;
      if(Math.abs(Math.max(ratio,1-ratio)*side-markedLength)>1e-7)continue;
      const end=ratio>=.5?u:v,cut=mixP(u,v,ratio),middle=mixP(end,cut,.5);
      const outward=sub(middle,center);
      dimension={point:add(middle,mul(outward,c*.10/norm(outward))),ends:[end,cut]};
      break;
    }
  }
  const horizontal=[P(center.x-1,center.y),P(center.x+1,center.y)];
  const vertical=[P(center.x,center.y-1),P(center.x,center.y+1)];
  const parts=[[1,-1,0], [1,1,1], [-1,1,2], [-1,-1,3]];
  const pieces=parts.map(([ys,xs,corner],i)=>{
    const source=clip(clip(large,...horizontal,ys),...vertical,xs);
    return piece('quarter-'+i,L,source,shift(source,sub(target[corner],center)),3+i);
  });
  pieces.push(piece('center',S,small,shift(small,sub(centroid(target),centroid(small))),7));
  return {originals:[polygon(large,L),polygon(small,S)],targets:[target],context:[polygon([A,B,C],'tri')],
    outlines:[polygon(target,'c',{at:-1})],cuts:[line(P(center.x-c*.5,center.y),P(center.x+c*.5,center.y),'cut',{at:0,clip:large}),line(P(center.x,center.y-c*.5),P(center.x,center.y+c*.5),'cut',{at:1,clip:large})],
    pieces,cutAt:2,ready:7,marks:dimension?[{...label('(a+b)/2',dimension.point,L),at:2,ends:dimension.ends}]:[]};
}

function squarePair(a,b) {
  const l=Math.max(a,b),s=Math.min(a,b),L=a>b?'a':'b',S=a>b?'b':'a';
  return {l,s,L,S,sources:[{poly:rect(0,0,l),color:L},{poly:rect(l,l-s,s),color:S}]};
}

function cutPair(sources, regions) {
  return regions.flatMap(({poly,to,at,id})=>sources.flatMap(({poly:parent,color})=>{
    const source=intersect(parent,poly);
    return hasArea(source)?[piece(id+'-'+color,color,source,source.map(to),at)]:[];
  }));
}

export function diagonalPair(a,b) {
  const {l,s,sources}=squarePair(a,b);
  const U=P(0,0), V=P(s,l), W=P(l+s,l-s), Z=P(l,-s);
  const left=[U,V,P(0,l)], right=[V,W,P(l+s,l)];

  const pieces=cutPair(sources,[
    {poly:left,to:p=>rotate(p,-Math.PI/2),at:3,id:'left'},
    {poly:right,to:p=>add(W,rotate(sub(p,W),Math.PI/2)),at:4,id:'right'},

  ]);
  for (const {poly,color} of sources) {
    const rest=clip(clip(poly,U,V,-1),V,W,-1);
    if (hasArea(rest)) pieces.push(piece('middle-'+color,color,rest,rest,2));
  }
  return {originals:sources.map(s=>polygon(s.poly,s.color)),targets:[[U,V,W,Z]],pieces,cutAt:2,ready:4,
    context:[polygon(left,'tri',{at:0,until:2}),polygon(right,'tri',{at:1,until:3})],
    cuts:[line(U,V,'cut',{at:0}),line(V,W,'cut',{at:1})],
    outlines:[polygon([U,V,W,Z],'c',{at:2})],tracks:true};
}

export function offsetPair(a,b) {
  const {l,s,sources}=squarePair(a,b);
  const U=P(l,0),V=P(l+s,l),W=P(s,l+s),Z=P(0,s), target=[U,V,W,Z];
  const pieces=sources.flatMap(({poly,color})=>{
    const keep=intersect(poly,target);
    const cap=clip(poly,U,Z,1);
    const tip=clip(poly,U,V,-1);
    const returnTip=clip(poly,W,Z,-1);
    // In this clockwise outline, the positive half-plane is the interior.
    return [
      hasArea(keep)&&piece('middle-'+color,color,keep,keep,2),
      hasArea(cap)&&piece('cap-'+color,color,cap,shift(cap,P(s,l)),4),
      hasArea(tip)&&piece('tip-'+color,color,tip,shift(tip,P(-l,s)),3),
      hasArea(returnTip)&&piece('bottom-'+color,color,returnTip,shift(returnTip,P(l,-s)),3),
    ].filter(Boolean);
  });
  return {originals:sources.map(s=>polygon(s.poly,s.color)),targets:[target],pieces,cutAt:2,ready:4,
    setupMotion:{index:1,offset:P(-l,s)},
    cuts:[line(U,V,'cut',{at:.55}),line(U,Z,'cut',{at:1}),line(Z,W,'cut',{at:1})],outlines:[polygon(target,'c',{at:2})],tracks:true};
}

export function daVinci(a,b) {
  const {A,B,C,c}=hypFrame(a,b);
  const sa=square(A,B), sb=square(C,A), sc=rect(0,0,c);
  const E=sa[2], F=sa[3], H=sb[2], G=sb[3];
  const BL=P(0,c), BR=P(c,c), M=P(c-A.x,c-A.y);
  const lowLeft=[A,B,BL,M], lowRight=[A,M,BR,C], cut=[E,G];
  // Each lower half rotates onto the same lower half of the upper hexagon.
  // The other upper half is its exact reflection in E--G.
  const lower=[E,B,C,G], upper=[E,F,H,G];
  const delta=P(c*2.15,0);
  return {originals:[polygon(lowLeft,'aux'),polygon(lowRight,'tri')],targets:[lower,shift(upper,delta)],
    outlines:[polygon(sa,'a',{at:-1}),polygon(sb,'b',{at:-1}),polygon(sc,'c',{at:-1}),polygon([A,F,H],'tri',{at:0}),polygon([A,B,C],'tri',{at:0}),polygon([BL,BR,M],'tri',{at:0})],
    cuts:[line(...cut,'cut',{at:1}),line(A,M,'cut',{at:1})],
    pieces:[
      piece('left','aux',lowLeft,lower,3,false,'下方六边形左半'),
      {...piece('right','tri',lowRight,shift(upper,delta),4,true,'下方六边形右半'),
       change:t=>{
         if(t<.57) return lowRight.map(pt=>add(C,rotate(sub(pt,C),Math.PI/2*phase(t,0,.57))));
         const turn=phase(t,.57,1);
         return lowRight.map(pt=>{
           const q=add(C,rotate(sub(pt,C),Math.PI/2));
           const hinge=foot(q,E,G), perpendicular=sub(q,hinge);
           return add(add(hinge,mul(perpendicular,Math.cos(Math.PI*turn))),mul(delta,turn));
         });
       }},

    ],cutAt:2,ready:4,tracks:true,
    finalNote:'为同时看清两半，右半的重合图在旁边展开。两个六边形各含两块全等的辅助三角形。'};
}
