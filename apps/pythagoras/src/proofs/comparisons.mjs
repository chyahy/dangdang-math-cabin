import {P,add,sub,mul,area,square,hypFrame,mixP,phase} from '../geometry.mjs';
import {rect,shift,rotate,polygon,line,label,centroid,clip,piece} from './primitives.mjs';

export function trapezoids(a,b) {
  const l=Math.max(a,b),s=Math.min(a,b),L=a>b?'a':'b',S=a>b?'b':'a';
  const A=P(0,-s), B=P(l,0), O=P(0,0);
  const outer=rect(-s,-s-l,l+2*s,2*l+s);
  const y0=-s-s*s/l, y1=s*s/l;
  const low=[P(-s,y0),P(l+s,y1),P(l+s,l),P(-s,l)];
  const upper=[outer[0],outer[1],P(l+s,y1),P(-s,y0)];
  const sc=square(B,A), sa=rect(0,0,l), sb=rect(-s,-s,s);
  const halfTurn=p=>sub(P(l,-s),p);
  const offset=P(l+3*s+(l+s)*.55,0);
  const toRight=poly=>shift(poly,offset);
  const F=P(-s,l-s), G=P(l-s,l);
  const auxiliary=[
    [[P(-s,y0),A,P(-s,-s)],[P(-s,y0),A,P(-s,-s)]],
    [[O,A,B],[F,P(-s,l),G]],
    [[P(-s,0),O,P(-s,l)],[P(-s,-s),A,F]],
    [[O,P(-s,l),P(0,l)],[B,G,P(l,l)]],
    [[B,P(l+s,y1),P(l+s,l),P(l,l)],[B,P(l+s,y1),P(l+s,l),P(l,l)]],
  ];
  const movedSlab=piece('rotate-slab','aux',upper,toRight(upper.map(halfTurn)),2);
  const movedSquare=piece('rotate-square','c',sc,toRight(sc.map(halfTurn)),2);
  return {kind:'cancel', halves:[movedSlab,movedSquare], originals:[polygon(sa,L),polygon(sb,S),polygon(sc,'c',{at:0})],targets:[],
    context:[polygon(low,'aux',{at:1,until:4}),polygon(upper,'aux',{at:1,until:2}),
      polygon(toRight(low),'aux',{at:2,until:4}),
      polygon(toRight(sc.map(halfTurn)),'c',{at:2})],
    outlines:[polygon(outer,'guide',{at:0,until:2})],
    cuts:[line(low[0],low[1],'cut',{at:1})],
    auxiliary: auxiliary.map(([source,dest],i)=>piece('aux-'+i,'tri',source,toRight(dest),4,true,'两边对应的辅助区域')),
    cancellation:{left:low,right:toRight(low),leftMain:[sa,sb],rightMain:[toRight(sc.map(halfTurn))]},
    pieces:[],cutAt:2,ready:4,
    finalNote:'斜切线过矩形中心。上半绕中心转 180° 与下半全等，再逐对消去辅助区域。'};
}

export function mirrorHex(a,b) {
  const l=Math.max(a,b),s=Math.min(a,b),L=a>b?'a':'b',S=a>b?'b':'a';
  const k=Math.SQRT1_2, O=P(0,0), T=P(0,-2*l*k), D=P(0,2*s*k);
  const U=P(-l*k,-l*k),V=P(-s*k,s*k), Ur=P(l*k,-l*k),Vr=P(s*k,s*k);
  const flip=p=>P(p.x, T.y+D.y-p.y);
  const offset=P((l+s)*1.3,0);
  const right=poly=>shift(poly,offset);
  const leftHalf=[T,U,V,D], rightHalf=[T,Ur,Vr,D];
  const bigSquare=[U,flip(Vr),flip(Ur),V];
  const topCut=[T,U,flip(Vr)], bottomCut=[D,V,flip(Ur)];
  return {kind:'cancel',originals:[polygon([T,U,O,Ur],L),polygon([D,V,O,Vr],S)],
    outlines:[polygon(right(bigSquare),'c',{at:3})],
    context:[polygon(rightHalf,'aux',{at:0,until:2}),polygon(right(leftHalf),'aux',{at:1,until:4}),polygon(right(rightHalf.map(flip)),'aux',{at:2,until:4}),polygon(right(bigSquare),'c',{at:3})],
    cuts:[line(T,D,'cut',{at:0}),line(add(T,offset),add(D,offset),'cut',{at:2})],
    auxiliary:[piece('top','tri',[O,U,V],right(topCut),4,true,'左侧辅助三角形'),piece('bottom','tri',[O,Ur,Vr],right(bottomCut),4,true,'右侧辅助三角形')],
    halves:[{...piece('flip','aux',rightHalf,right(rightHalf.map(flip)),2,true,'原六边形右半'), change:t=>{const eased=phase(t,0), y=(T.y+D.y)/2;return rightHalf.map(p=>add(P(p.x,y+(p.y-y)*Math.cos(Math.PI*eased)),mul(offset,eased)))}}],
    cancellation:{left:[T,Ur,Vr,D,V,U],right:right([T,flip(Vr),flip(Ur),D,V,U]),leftMain:[[T,U,O,Ur],[D,V,O,Vr]],rightMain:[right(bigSquare)]},
    pieces:[],targets:[],cutAt:1,ready:4,
    finalNote:'上下翻转右半六边形；左右各减去两块全等直角三角形。'};
}

export function pinwheel(a,b) {
  const l=Math.max(a,b),s=Math.min(a,b),c=Math.hypot(l,s),d=l-s;
  const O=P(c/2,c/2), Q=P(l*l/c,l*s/c);
  const spin=(p,i)=>add(O,rotate(sub(p,O),i*Math.PI/2));
  const source=[P(0,0),P(c,0),Q];
  const destX=c*1.28;
  const destinations=[
    [P(destX+l,0),P(destX,s),P(destX,0)],
    [P(destX,s),P(destX+l,0),P(destX+l,s)],
    [P(destX+l,0),P(destX+l+s,l),P(destX+l+s,0)],
    [P(destX+l+s,l),P(destX+l,0),P(destX+l,l)],
  ];
  const inside=Array.from({length:4},(_,i)=>source.map(p=>spin(p,i)));
  const center=inside.map(tri=>tri[2]);
  const parts=inside.map((tri,i)=>piece('triangle-'+i,i%2?'tri':'aux',tri,destinations[i],4+i,false,'斜边正方形内第 '+(i+1)+' 块'));
  if (d>1e-9) parts.push(piece('difference','difference',center,rect(destX+l-d,s,d),8));
  const initialOffset=P(c*1.25,0);
  return {originals:[polygon(rect(0,0,c),'c'),...inside.map((tri,i)=>polygon(shift(tri,initialOffset),i%2?'tri':'aux',{at:0,until:2}))],
    assembling:inside.map((tri,i)=>piece('in-'+i,i%2?'tri':'aux',shift(tri,initialOffset),tri,2)),
    targets:[rect(destX,0,l,s),rect(destX+l,0,s,l),...(d>1e-9?[rect(destX+l-d,s,d)]:[])],
    sourceRegions:inside.concat(d>1e-9?[center]:[]),outlines:[polygon(rect(0,0,c),'c',{at:-1}),...(d>1e-9?[polygon(center,'difference',{at:2})]:[])],
    cuts:[], pieces:parts,cutAt:3,ready:8,marks:[label('|b−a|',centroid(center),'difference')],
    finalNote:d<=1e-9?'两条直角边相等，中间正方形退化为一个点。':'四块直角三角形两两配成两个 ab 矩形。'};
}

export function equalHeight(a,b) {
  const {A,B,C,c,m}=hypFrame(a,b);
  const target=rect(0,0,c), sa=square(A,B), sb=square(C,A);
  const data=[{color:'a',corner:B,other:C,side:1,sq:sa,outer:sa[2],tip:sa[3]},
    {color:'b',corner:C,other:B,side:-1,sq:sb,outer:sb[3],tip:sb[2]}];
  const pieces=data.flatMap(({color,corner,other,side,sq,outer,tip},i)=>{
    const lower=add(corner,P(0,c)), cut=P(m,c), and=P(m,0);
    const first=[corner,lower,cut], dest=[corner,outer,tip];
    const reverse=(poly,center)=>poly.map(p=>sub(mul(center,2),p));
    const origin=centroid([corner,and,cut,lower]), ending=centroid(sq);
    return [
      {id:color+'1',color,source:first,target:dest,moveAt:3+i*3,area:area(first),name:'斜边正方形中的'+(i?'右':'左')+'矩形', change:t=>{
        const g=t*3;
        if(g<1) return [corner,lower,mixP(cut,A,phase(g,0))];
        if(g<2) return [corner,lower,A].map(p=>add(corner,rotate(sub(p,corner),-side*Math.PI/2*phase(g,1))));
        return [corner,outer,mixP(other,tip,phase(g,2))];
      }},
      {id:color+'2',color,source:reverse(first,origin),target:reverse(dest,ending),moveAt:5+i*3,area:area(first),name:'斜边正方形中的'+(i?'右':'左')+'矩形', change:t=>{
        const g=t*5;
        if(g<1) return first.map(p=>add(origin,rotate(sub(p,origin),Math.PI*(1-phase(g,0)))));
        if(g<2) return [corner,lower,mixP(cut,A,phase(g,1))];
        if(g<3) return [corner,lower,A].map(p=>add(corner,rotate(sub(p,corner),-side*Math.PI/2*phase(g,2))));
        if(g<4) return [corner,outer,mixP(other,tip,phase(g,3))];
        return dest.map(p=>add(ending,rotate(sub(p,ending),Math.PI*phase(g,4))));
      }},
    ];
  });
  return {originals:[polygon(target,'c')],outlines:[polygon(sa,'a',{at:-1}),polygon(sb,'b',{at:-1}),polygon(target,'c',{at:-1})],
    context:[polygon([A,B,C],'tri')],targets:[sa,sb],cuts:[line(A,P(m,c),'cut',{at:0}),line(B,P(m,c),'cut',{at:1}),line(C,P(m,c),'cut',{at:1})],
    pieces,cutAt:2,ready:8,
    finalNote:'每次顶点滑动都平行于固定底，垂直距离保持不变。两次旋转保持全等。'};
}
