import {useId,useMemo,useState} from 'react';
import {P,add,sub,mul,norm,foot,camera,phase,mixP,clamp} from './geometry.mjs';
import {centroid,movingPoints,piece} from './proofs/primitives.mjs';
import {fmt,type Options,type Point} from './Diagrams';

export const palette:Record<string,string>={a:'#ff777d',b:'#f3d55b',c:'#67dca7',tri:'#63c9ff',aux:'#7d9dc0',guide:'#b3c1d6',cut:'#f3f6fb',difference:'#bda5ff'};
type Shape={points:Point[];color:string;at?:number;until?:number};
type Segment={from:Point;to:Point;color:string;at?:number;clip?:Point[]};
type Part=ReturnType<typeof piece>&{change?:(t:number)=>Point[]};
type Model={kind?:string;originals:Shape[];pieces:Part[];targets:Point[][];outlines?:Shape[];context?:Shape[];cuts:Segment[];tracks?:boolean;cutAt:number;ready:number;finalNote?:string;marks?:{text:string;point:Point;color:string;at?:number;ends?:Point[]}[];auxiliary?:Part[];halves?:Part[];assembling?:Part[];setupMotion?:{index:number;offset:Point};cancellation?:{left:Point[];right:Point[]}};
type Build=(a:number,b:number)=>unknown;
export type View='live'|'original'|'cut'|'complete'|'compare';
type Props={id:string;build:Build;a:number;b:number;p:number;options:Options;cuts:boolean;view:View;selected:string;onSelect:(id:string)=>void;highlight:string};
const path=(ps:Point[])=>ps.map(({x,y})=>x+','+y).join(' ');
const move=(part:Part,t:number)=>part.change?part.change(clamp(t)):movingPoints(part,t);
const sourceName=(part:Part)=>part.name||('直角边 '+part.color+' 上的正方形');
function GeometryLabel({point,text,color='guide',size=23}:{point:Point;text:string;color?:string;size?:number}){
 return <text x={point.x} y={point.y} fill={palette[color]} fontSize={size} className="museum-label" textAnchor="middle" dominantBaseline="middle">{text}</text>;
}
function ShapePolygon({points,color,fill=.24,opacity=1,outline=false,selected=false,id,onSelect,label}:{points:Point[];color:string;fill?:number;opacity?:number;outline?:boolean;selected?:boolean;id?:string;onSelect?:()=>void;label?:string}){
 return <polygon points={path(points)} fill={outline?'none':palette[color]} fillOpacity={fill} stroke={palette[color]} strokeWidth={selected?4:outline?1.6:2} opacity={opacity} strokeLinejoin="round" data-proof-piece={id} aria-label={label}
  tabIndex={onSelect?0:undefined} role={onSelect?'button':undefined} className={onSelect?'click-region':undefined}
  onClick={onSelect?(event)=>{event.stopPropagation();onSelect()}:undefined}
  onKeyDown={onSelect?(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onSelect()}}:undefined}/>;
}
function DrawLine({from,to,color='guide',dashed=false,width=2,opacity=1,marker}:{from:Point;to:Point;color?:string;dashed?:boolean;width?:number;opacity?:number;marker?:string}){
 return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={palette[color]} strokeWidth={width} strokeDasharray={dashed?'6 5':undefined} opacity={opacity} markerEnd={marker}/>;
}
function onStage(shape:Shape,p:number){
 return phase(p,shape.at??-1)*(shape.until===undefined?1:1-phase(p,shape.until-1));
}

export function ProofScene(props:Props){
 const model=useMemo(()=>props.build(props.a,props.b) as Model,[props.build,props.a,props.b]);
 if(model.kind && ['scaled','projection','secant'].includes(model.kind))return <ExtensionScene model={model as unknown as Extension} {...props}/>;
 return <PiecesScene model={model} {...props}/>;
}

function PiecesScene({model,id,p,options,cuts,view,selected,onSelect,highlight}:Props&{model:Model}){
 const uid=useId(),[trace,setTrace]=useState(false);
 const {originals,context=[],outlines=[],pieces,auxiliary=[],halves=[],assembling=[],marks=[]}=model;
 const allParts=[...pieces,...auxiliary,...halves,...assembling];
 const picked=allParts.find(x=>x.id===selected);
 const compare=view==='compare', reference=compare||!!picked&&view==='live'&&p>=model.cutAt;
 const time=view==='original'?0:view==='cut'?model.cutAt:view==='complete'||compare?model.ready:p;
 const isOriginal=view==='original'||(time<model.cutAt&&id!=='bricks'&&id!=='pinwheel');
 const setup=model.setupMotion;
 const setupBounds=setup?originals[setup.index].points.map(p=>add(p,setup.offset)):[];
 const framePoints=[...originals,...context,...outlines].flatMap(s=>s.points).concat(setupBounds).concat(allParts.flatMap(x=>[...x.source,...x.target,...[.2,.4,.6,.8].flatMap(t=>move(x,t))]));
 const box=reference?{x:0,y:52,w:575,h:505}:{x:65,y:45,w:870,h:525};
 // Keep one fixed camera for all timeline positions so motion can be compared exactly.
 const draw=camera(framePoints,box).map;
 const sources=pieces.length?pieces:auxiliary;
 const sourcePoints=sources.flatMap(x=>x.source);
 const src=camera(sourcePoints.length?sourcePoints:framePoints,{x:602,y:125,w:355,h:350}).map;
 const geom=(shape:Shape,index:number,outline:boolean)=>{
  const opacity=onStage(shape,time);
  if(opacity<=0)return null;
  return <ShapePolygon key={index} points={shape.points.map(draw)} color={shape.color} opacity={opacity} outline={outline}/>;
 };
 const movingPart=(x:Part,amount:number,baseOpacity=1,partOutline=false)=>{
  const active=x.id===selected, emphasis=highlight===x.color||highlight==='all';
  const points=move(x,amount).map(draw);
  const showBase=id==='equal-height'&&options.guides&&amount>0&&amount<1&&x.change;
  const guideBase=showBase?[points[0],points[1]]:null;
  return <g key={x.id}>
   <ShapePolygon points={points} color={x.color} fill={active?.58:.32} opacity={baseOpacity*(selected&&!active?.26:1)} outline={partOutline} selected={active||emphasis}
    id={partOutline?undefined:x.id} onSelect={partOutline?undefined:()=>onSelect(x.id)} label={sourceName(x)+' '+x.id}/>
   {guideBase&&<g>
    <DrawLine from={guideBase[0]} to={guideBase[1]} color="cut" width={4}/>
    <DrawLine from={points[2]} to={foot(points[2],...guideBase as [Point,Point])} color="cut" dashed/>
   </g>}
   {options.areas&&active&&<GeometryLabel point={centroid(points)} color={x.color} text={fmt(x.area)}/>}
  </g>;
 };
 return <svg viewBox="0 0 1000 620" className="geometry museum-geometry" aria-label="参数化证明图形">
  <defs><marker id={uid+'arrow'} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill={palette.guide}/></marker>
  {model.cuts.map((x,i)=>x.clip&&<clipPath id={uid+i} key={i}><polygon points={path(x.clip.map(draw))}/></clipPath>)}</defs>
  {context.map((x,i)=>geom(x,i,false))}
  {outlines.map((x,i)=>geom(x,i,true))}
  {originals.map((x,i)=>{
   if(id==='bricks')return i===0&&time<model.cutAt+1?geom(x,i,false):geom(x,i,true);
   if(id==='pinwheel')return isOriginal||time<=1?geom(x,i,i===0):i===0?geom(x,i,true):null;
   if(setup?.index===i&&time<1){
    const offset=mul(setup.offset,1-phase(time,0,.65));
    return geom({...x,points:x.points.map(q=>add(q,offset))},i,false);
   }
   return geom(x,i,!isOriginal&&model.kind!=='cancel');
  })}
  {id==='davinci'&&time>=3.99&&<ShapePolygon points={model.targets[1].map(draw)} color="guide" outline/>}
  {options.guides&&time>=model.cutAt&&model.tracks&&pieces.filter(x=>x.moveAt>model.cutAt).map(x=>{
    const from=draw(centroid(x.source)),to=draw(centroid(x.target));
    return norm(sub(from,to))>12&&(trace||selected===x.id||time<x.moveAt&&time>x.moveAt-1)&&
      <DrawLine key={x.id} from={from} to={to} color={x.color} dashed opacity={.65} marker={'url(#'+uid+'arrow)'}/>;
  })}
  {model.kind==='cancel'&&model.cancellation&&time>1&&time<2&&<ShapePolygon points={model.cancellation.right.map(v=>mixP(v,centroid(model.cancellation!.right),.06)).map(draw)} color="guide" outline opacity={phase(time,1)}/>}
  {halves.map(x=>time>1&&time<2?movingPart(x,clamp(time-1),.9):null)}
  {assembling.map((x,i)=>time>1&&time<3?movingPart(x,phase(time,1+i*.18,1.42+i*.19)):null)}
  {pieces.map(x=>{
   if(id==='bricks'&&time<model.cutAt+1&&x.id.startsWith('large-'))return null;
   if(id==='pinwheel'&&time<3)return null;
   if(isOriginal&&id!=='bricks')return null;
   const amount=x.moveAt<=model.cutAt?1:clamp(time-x.moveAt+1);
   return movingPart(x,amount);
  })}
  {auxiliary.map(x=>{
   const amount=clamp(time-x.moveAt+1);
   if(id==='mirror-hex'&&time<3)return movingPart(x,0);
   if(time<2)return null;
   if(time>=model.ready+1){
    return <ShapePolygon key={x.id} points={x.target.map(draw)} color={x.color} fill={x.id===selected?.42:.02}
      opacity={x.id===selected?1:.22} selected={x.id===selected} id={x.id} onSelect={()=>onSelect(x.id)} label={sourceName(x)}/>;
   }
   return <g key={x.id}>
    <ShapePolygon points={x.target.map(draw)} color={x.color} opacity={.3} outline/>
    {movingPart(x,amount,time>model.ready?1-phase(time,model.ready):1)}
   </g>;
  })}
  {cuts&&model.cuts.map((x,i)=>{
    const k=phase(time,x.at??0);
    if(k<=0)return null;
    return <g key={i} clipPath={x.clip?'url(#'+uid+i+')':undefined}><DrawLine from={draw(x.from)} to={draw(mixP(x.from,x.to,k))} color="cut" dashed opacity={time>model.cutAt?.56:.94}/></g>;
  })}
  {options.lengths&&marks.filter(x=>time>=(x.at??0)).map(x=><g key={x.text}>
   {x.ends&&<DrawLine from={draw(x.ends[0])} to={draw(x.ends[1])} color="cut" width={3}/>}
   <GeometryLabel point={draw(x.point)} text={x.text} color={x.color}/>
  </g>)}
  {reference&&<g>
   <DrawLine from={P(585,45)} to={P(585,540)} opacity={.32}/>
   <GeometryLabel point={P(775,70)} text="原始位置" size={19}/>
   {sources.map(x=><ShapePolygon key={x.id} points={x.source.map(src)} color={x.color} fill={selected===x.id?.55:.24} opacity={picked&&selected!==x.id?.26:1} selected={selected===x.id}
     onSelect={()=>onSelect(x.id)} label={sourceName(x)}/>)}
   {picked&&<GeometryLabel point={P(775,520)} text={sourceName(picked)} size={17} color={picked.color}/>}
  </g>}
  {model.finalNote&&time>=model.ready&&<GeometryLabel point={P(500,570)} text={model.finalNote} size={16}/>}
  {model.tracks&&options.guides&&view==='live'&&time>=model.cutAt&&<g role="button" aria-label="切换移动路径" tabIndex={0} onClick={e=>{e.stopPropagation();setTrace(t=>!t)}} onKeyDown={e=>{if(e.key==='Enter'){setTrace(t=>!t)}}}><rect x={22} y={565} width={98} height={34} rx={6} fill="#192331"/><GeometryLabel text={trace?'隐藏轨迹':'显示轨迹'} point={P(71,582)} size={14}/></g>}
 </svg>;
}

type Extension={kind:string;original:Point[];poses?:{source:Point[];target:Point[];at:number;color:string;name:string}[];assembled?:Point[];comparison?:Point[];join?:Point[];big?:Point[];box?:Point[];projection?:Point[];triangle?:Point[];center?:Point;tangent?:Point;outside?:Point;near?:Point;far?:Point;radius?:number;c:number};
function ExtensionScene({model,p,options,cuts,highlight,a:propsA,b:propsB}:Props&{model:Extension}){
 const {kind,original}=model;
 const bounds=[...original,...(model.assembled??[]),...(model.comparison??[]),...(model.box??[]),...(model.triangle??[]),...(model.poses??[]).flatMap(x=>x.source)];
 if(model.center&&model.radius){const {center,radius}=model;bounds.push(add(center,P(-radius,-radius)),add(center,P(radius,radius)))}
 const cam=camera(bounds,{x:90,y:107,w:820,h:365}), f=cam.map;
 const poly=(ps:Point[],color:string,fill=.25,opacity=1)=><ShapePolygon points={ps.map(f)} color={color} fill={fill} opacity={opacity}/>;
 const edge=(a:Point,b:Point,text:string,color:string,offset=20)=>{
  const d=sub(f(b),f(a)), n=mul(P(-d.y,d.x),offset/Math.max(1,norm(d)));
  return <g><DrawLine from={f(a)} to={f(b)} color={color} width={highlight===color?5:2}/>
   {options.lengths&&<GeometryLabel point={add(mixP(f(a),f(b),.5),n)} text={text} color={color}/>}</g>;
 };
 const named=(point:Point,text:string,color='guide',x=0,y=-16)=>options.lengths&&<GeometryLabel point={add(f(point),P(x,y))} text={text} color={color} size={19}/>;
 if(kind==='scaled'){
  const [r,u,v]=original, compare=model.comparison!;
  return <svg viewBox="0 0 1000 620" className="geometry museum-geometry" aria-label="三种比例缩放和共边拼合">
   {poly(original,'tri')}{edge(r,u,'a','a')}{edge(r,v,'b','b',-22)}{edge(u,v,'c','c')}
   {p>0&&model.poses!.map(({source,target,at,color,name},i)=>{
    const part=piece(name,color,source,target,at,true), amount=clamp(p-at+1);
    const factor=i===0?propsA:propsB;
    const origin=source[0], size=1/factor+(1-1/factor)*phase(p,0);
    const pts=p<1?source.map(q=>add(mixP(centroid(original),origin,phase(p,0)),mul(sub(q,origin),size))):movingPoints(part,amount);
    const known=i===0?['ac','a²','ab']:['ab','b²','bc'];
    const match=part.target;
    return <g key={name} opacity={phase(p,0)}>
     {poly(pts,color)}{named(centroid(pts),name,color,0,0)}
     {p>=at&&match.map((q:Point,j:number)=><g key={j}>{edge(q,match[(j+1)%3],known[j],color,i===0?17:-17)}</g>)}
    </g>;
   })}
   {p>=3&&cuts&&options.guides&&<DrawLine from={f(model.join![0])} to={f(model.join![1])} dashed/>}
   {p>3&&<g opacity={phase(p,3)}>{poly(compare,'c')}{edge(compare[0],compare[1],'ac','a')}{edge(compare[0],compare[2],'bc','b',-24)}{edge(compare[1],compare[2],'c²','c')}{named(centroid(compare),'×c','c',0,0)}</g>}
  </svg>;
 }
 if(kind==='projection'){
  const [T,L,R]=model.big!,[UL,,UR]=model.projection!, grow=phase(p,1);
  const growing=original.map((q,i)=>mixP(q,model.big![i],grow));
  return <svg viewBox="0 0 1000 620" className="geometry museum-geometry" aria-label="放大三角形后用矩形比较两段投影">
   {poly(original,'tri')}{edge(original[0],original[1],'a','a')}{edge(original[0],original[2],'b','b',-20)}{edge(original[1],original[2],'c','c')}
   {named(original[1],'β','b',22,-13)}{named(original[2],'α','a',-22,-13)}
   {p>1&&<g>{poly(growing,'tri')}{named(centroid(growing),'×c','tri',0,16)}</g>}
   {p>=2&&<>{edge(T,L,'ac','a')}{edge(T,R,'bc','b',-22)}{edge(L,R,'c²','c')}
    {options.guides&&poly(model.box!,'guide',0)}
    {options.guides&&p>2&&<g><DrawLine from={f(L)} to={f(mixP(L,UL,phase(p,2)))} dashed/><DrawLine from={f(R)} to={f(mixP(R,UR,phase(p,2)))} dashed/></g>}
    {p>=3&&<>{edge(UL,T,'a²','a',-24)}{named(L,'α','a',13,-28)}</>}
    {p>=4&&<>{edge(T,UR,'b²','b',-24)}{named(R,'β','b',-13,-28)}</>}
   </>}
  </svg>;
 }
 const {center:O,tangent:T,outside:X,near:N,far:F,radius}=model as Required<Extension>;
 const draw=phase(p,0),ray=phase(p,1), r=radius*cam.s,circ=2*Math.PI*r;
 return <svg viewBox="0 0 1000 620" className="geometry museum-geometry" aria-label="圆的切点、割线近远交点和两段长度">
  {poly(original,'tri')}{edge(original[1],original[2],'a','a')}{edge(original[0],original[1],'b','b')}{edge(original[0],original[2],'c','c',-15)}
  {poly([O,T,X],'tri',.18)}{edge(T,X,'a','a')}{edge(O,T,'b','b')}
  {draw>0&&<><circle cx={f(O).x} cy={f(O).y} r={r} stroke={palette.tri} strokeWidth="2" fill={palette.tri} fillOpacity={.12*draw} strokeDasharray={circ} strokeDashoffset={circ*(1-draw)} transform={'rotate(-90 '+f(O).x+' '+f(O).y+')'}/>{named(O,'O','tri',11,-12)}{named(T,'T','a',-12,15)}{named(X,'P','a',16,13)}</>}
  {options.guides&&ray>0&&<DrawLine from={f(X)} to={f(mixP(X,F,ray))} color="guide" dashed/>}
  {p>=2&&<>{edge(X,N,'c−b','b',19)}{edge(add(X,P(0,-radius*.13)),add(F,P(0,-radius*.13)),'c+b','c',15)}
   {[N,F].map((q,i)=><g key={i}><circle cx={f(q).x} cy={f(q).y} r={4} fill={palette.c}/>{named(q,i?'F':'N','c',-12,12)}</g>)}</>}
  {p>=3&&cuts&&options.guides&&<><DrawLine from={f(T)} to={f(N)} color="a" dashed/><DrawLine from={f(T)} to={f(F)} color="c" dashed/></>}
 </svg>;
}
