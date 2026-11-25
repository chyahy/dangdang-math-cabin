import {P,add,sub,mul,norm,hypFrame,phase,square} from '../geometry.mjs';
import {rect,polygon,line,label,centroid,shift} from './primitives.mjs';

export function scaled(a,b) {
  const {A,B,C,D,c}=hypFrame(a,b);
  const base=[A,B,C];
  const scaled=base.map(p=>mul(p,c));
  const total=c*c;
  const start=P(-total*.66,-total*.37), center=P(total*.12,0), right=P(total*1.23,0);
  const leftTriangle=[A,B,D].map(p=>mul(p,c));
  const rightTriangle=[A,D,C].map(p=>mul(p,c));
  const u=[P(0,0),P(a*a,0),P(0,-a*b)], v=[P(0,0),P(b*b,0),P(0,-a*b)];
  const poses=[
    {source:shift(u,P(-total*.63,total*.22)),target:shift(leftTriangle,center),at:2,color:'a',name:'×a'},
    {source:shift(v,P(-total*.63,-total*.14)),target:shift(rightTriangle,center),at:3,color:'b',name:'×b'},
  ];
  return {kind:'scaled',original:shift(base,start),poses,comparison:shift(scaled,right),assembled:shift(scaled,center),
    join:shift([mul(A,c),mul(D,c)],center), c, targets:[shift(scaled,center)],cutAt:1,ready:5};
}

export function projection(a,b) {
  const {A,B,C,c}=hypFrame(a,b), big=[A,B,C].map(p=>mul(p,c));
  const [T,L,R]=big, width=R.x-L.x, height=-T.y;
  const upLeft=P(L.x,T.y), upRight=P(R.x,T.y);
  return {kind:'projection',original:shift([A,B,C],P(-width*.5,-height*.3)),
    big, box:[L,R,upRight,upLeft], projection:[upLeft,T,upRight], c, height, width,cutAt:2,ready:5};
}

export function secant(a,b) {
  const O=P(0,0), T=P(0,b), X=P(a,b), c=norm(X), unit=mul(X,1/c);
  const near=mul(unit,b),far=mul(unit,-b);
  return {kind:'secant',original:shift([O,T,X],P(-b*1.7-a,-b*.45)), triangle:[O,T,X],
    center:O,tangent:T,outside:X,near,far,radius:b,c,cutAt:2,ready:5};
}
