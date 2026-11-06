import {useEffect,useRef,useState,type PointerEvent as ReactPointer} from 'react';
import {fromPixel,toPixel,tickValues,zoom,pan,snap,value,fmt,type View,type Q} from './math';
import type {Dot} from './model';
export type Measure={from:number;to:number;color:string;label:string};
export type Arrow={from:number;to:number;color:string;label:string};
type Props={points:Dot[];view:View;snapMode:string;denominator:number;labels:boolean;selected:string;tool:'move'|'add';measures:Measure[];arrows?:Arrow[];cursor?:number;
 onBegin:()=>void;onEnd:()=>void;onView:(v:View)=>void;onMove:(id:string,x:Q)=>void;onAdd:(x:Q)=>void;onSelect:(id:string)=>void};
export function Axis(p:Props){
 const host=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),[width,setWidth]=useState(850);const latest=useRef(p);latest.current=p;
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef<{startX:number;view:View;id:string|null;offset:number;moved:boolean;pinch?:{distance:number;anchor:number;span:number}}|null>(null);
 useEffect(()=>{const ob=new ResizeObserver(entries=>setWidth(Math.max(250,entries[0].contentRect.width)));if(host.current)ob.observe(host.current);return()=>ob.disconnect()},[]);
 const px=(clientX:number)=>{const r=svg.current!.getBoundingClientRect();return (clientX-r.left)*width/r.width};
 useEffect(()=>{const el=svg.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();const p=latest.current,r=el.getBoundingClientRect(),x=(e.clientX-r.left)*r.width/r.width;p.onBegin();p.onView(zoom(p.view,Math.exp(Math.max(-.5,Math.min(.5,e.deltaY*.002))),x,r.width));p.onEnd()};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[]);
 function down(e:ReactPointer<SVGSVGElement>){if(e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();const x=px(e.clientX),id=(e.target as Element).closest('[data-point]')?.getAttribute('data-point')??null;
  if(pointers.current.size===0){p.onBegin();gesture.current={startX:x,view:p.view,id,offset:id?x-toPixel(value(p.points.find(d=>d.id===id)!.x),p.view,width):0,moved:false};if(id)p.onSelect(id)}
  pointers.current.set(e.pointerId,{x,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);
  if(pointers.current.size===2&&gesture.current){const [a,b]=[...pointers.current.values()],mid=(a.x+b.x)/2;gesture.current.id=null;gesture.current.moved=true;gesture.current.view=p.view;gesture.current.pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),anchor:fromPixel(mid,p.view,width),span:p.view.span}}
 }
 function move(e:ReactPointer<SVGSVGElement>){const g=gesture.current;if(!g||!pointers.current.has(e.pointerId))return;const x=px(e.clientX);pointers.current.set(e.pointerId,{x,y:e.clientY});
  if(pointers.current.size>=2&&g.pinch){const [a,b]=[...pointers.current.values()],span=Math.max(.1,Math.min(2e6,g.pinch.span*g.pinch.distance/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)))),mid=(a.x+b.x)/2;p.onView({span,center:Math.max(-1e6,Math.min(1e6,g.pinch.anchor-(mid/width-.5)*span))});return}
  if(g.pinch)return;
  if(Math.abs(x-g.startX)>3)g.moved=true;
  if(g.id){p.onMove(g.id,snap(Math.max(-1e6,Math.min(1e6,fromPixel(x-g.offset,p.view,width))),p.snapMode,p.denominator))}
  else if(g.moved)p.onView(pan(g.view,x-g.startX,width));
 }
 function end(e:ReactPointer<SVGSVGElement>,cancel=false){if(!pointers.current.has(e.pointerId))return;const g=gesture.current;pointers.current.delete(e.pointerId);if(pointers.current.size)return;
  if(g&&!g.moved&&!g.id&&!cancel&&p.tool==='add')p.onAdd(snap(fromPixel(px(e.clientX),p.view,width),p.snapMode,p.denominator));gesture.current=null;p.onEnd();
 }
 const lanes:number[][]=[];const layout=p.points.map(d=>({d,x:toPixel(value(d.x),p.view,width)})).filter(item=>item.x>=16&&item.x<=width-16).sort((a,b)=>a.x-b.x).map(item=>{let lane=lanes.findIndex(xs=>xs.every(x=>Math.abs(x-item.x)>Math.max(105,fmt(item.d.x).length*9+36)));if(lane<0){lane=lanes.length;lanes.push([])}lanes[lane].push(item.x);return {...item,lane}});
 const axisY=Math.max(247,lanes.length*45+65),height=axisY+145;
 const fractional=p.snapMode==='fraction'&&width/p.view.span/p.denominator>=55;
 const first=Math.ceil((p.view.center-p.view.span/2)*p.denominator),last=Math.floor((p.view.center+p.view.span/2)*p.denominator);
 const ticks=fractional?Array.from({length:Math.max(0,Math.min(100,last-first+1))},(_,i)=>(first+i)/p.denominator):tickValues(p.view,width),zero=toPixel(0,p.view,width),inView=(x:number)=>x>=16&&x<=width-16;
 return <div className="axis-host" ref={host}>
  <svg ref={svg} className={'axis '+(p.tool==='add'?'adding':'')} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="交互数轴，拖动圆点改变数值，拖动空白平移，滚轮或双指缩放" onPointerDown={down} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>{if(pointers.current.has(e.pointerId))end(e,true)}}>
   <defs><pattern id="paper" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--grid)" strokeWidth="1"/></pattern><marker id="axis-tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)"/></marker>{['#2269cb','#e37e35','#148375'].map(c=><marker key={c} id={'tip'+c.slice(1)} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={c}/></marker>)}</defs>
   <rect width={width} height={height} fill="url(#paper)"/>
   <text x="22" y="30" className="axis-note">{p.tool==='add'?'点击空白添加点 · 拖动空白仍可平移':'拖动圆点探索 · 拖动空白平移'}</text>
   {inView(zero)&&<><line x1={zero} x2={zero} y1="46" y2={height-29} stroke="var(--origin)" strokeDasharray="4 6"/><text x={zero} y={height-13} textAnchor="middle" className="origin-label">原点</text></>}
   <line x1="16" x2={width-16} y1={axisY} y2={axisY} stroke="var(--ink)" strokeWidth="2" markerStart="url(#axis-tip)" markerEnd="url(#axis-tip)"/>
   {p.snapMode==='integer'&&width/p.view.span>=8&&Array.from({length:Math.max(0,Math.min(400,Math.floor(p.view.center+p.view.span/2)-Math.ceil(p.view.center-p.view.span/2)+1))},(_,i)=>{const x=toPixel(Math.ceil(p.view.center-p.view.span/2)+i,p.view,width);return inView(x)?<line key={'integer'+i} x1={x} x2={x} y1={axisY-4} y2={axisY+4} stroke="#7fa6c7"/>:null})}
   {p.snapMode==='fraction'&&!fractional&&width/p.view.span/p.denominator>=8&&Array.from({length:Math.max(0,Math.min(400,last-first+1))},(_,i)=>{const t=(first+i)/p.denominator,x=toPixel(t,p.view,width);return inView(x)?<line key={'minor'+i} x1={x} x2={x} y1={axisY-4} y2={axisY+4} stroke="#7fa6c7"/>:null})}
   {ticks.map(t=>{const x=toPixel(t,p.view,width);return inView(x)?<g key={t}><line x1={x} x2={x} y1={axisY-(t===0?12:8)} y2={axisY+8} stroke="var(--ink)" strokeWidth={t===0?2:1.3}/><text x={x} y={axisY+32} textAnchor="middle" className={'tick '+(t===0?'zero':'')}>{fractional?fmt(snap(t,'fraction',p.denominator)):t}</text></g>:null})}
   {p.measures.map((m,i)=>{const x1=toPixel(m.from,p.view,width),x2=toPixel(m.to,p.view,width),y=axisY+63+i*30;return <g key={i} className="measurement"><line x1={x1} x2={x2} y1={y} y2={y} stroke={m.color} strokeWidth="4"/><path d={`M${x1},${y-7}v14 M${x2},${y-7}v14`} stroke={m.color} strokeWidth="2"/><text x={Math.max(80,Math.min(width-80,(x1+x2)/2))} y={y+22} textAnchor="middle" fill={m.color}>{m.label}</text></g>})}
   {p.arrows?.map((a,i)=>{const x1=toPixel(a.from,p.view,width),x2=toPixel(a.to,p.view,width),y=98+i*65;return <g key={i}><line x1={x1} x2={x2} y1={y} y2={y} stroke={a.color} strokeWidth="5" markerEnd={Math.abs(x2-x1)>1?`url(#tip${a.color.slice(1)})`:undefined}/><text x={Math.max(65,Math.min(width-65,(x1+x2)/2))} y={y-17} fill={a.color} textAnchor="middle" className="arrow-label">{a.label}</text></g>})}
   {p.cursor!==undefined&&<g><line x1={toPixel(p.cursor,p.view,width)} x2={toPixel(p.cursor,p.view,width)} y1="185" y2={axisY} stroke="#148375" strokeDasharray="4 3"/><circle cx={toPixel(p.cursor,p.view,width)} cy={axisY} r="10" fill="#148375"/></g>}
   {layout.map(({d,x,lane})=>{if(!inView(x))return null;const y=axisY-48-lane*45,selected=d.id===p.selected;return <g key={d.id} data-point={d.id} tabIndex={0} role="slider" aria-label={`${d.name}${p.labels?' = '+fmt(d.x):'，坐标已隐藏'}`} aria-valuemin={-1e6} aria-valuemax={1e6} aria-valuenow={p.labels?value(d.x):undefined} aria-valuetext={p.labels?fmt(d.x):'坐标已隐藏'} className={'dot '+(selected?'selected':'')} onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();p.onBegin();p.onSelect(d.id);const step=p.snapMode==='integer'?1:p.snapMode==='fraction'?1/p.denominator:.1;p.onMove(d.id,snap(value(d.x)+(e.key==='ArrowRight'?step:-step),p.snapMode,p.denominator));p.onEnd()}}}>
    <line x1={x} x2={x} y1={y} y2={axisY} stroke={d.color} strokeWidth="1.8" strokeDasharray="3 3"/><circle cx={x} cy={axisY} r="5" fill={d.color}/><circle cx={x} cy={y} r="23" fill="transparent"/><circle cx={x} cy={y} r={selected?15:12} fill={d.color} stroke="var(--surface)" strokeWidth="4"/>{selected&&<circle cx={x} cy={y} r="21" fill="none" stroke={d.color} strokeOpacity=".22" strokeWidth="3"/>}
    <text x={Math.max(43,Math.min(width-43,x))} y={y-25} textAnchor="middle" fill={d.color} className="dot-label">{d.name}{p.labels?' = '+fmt(d.x):' = ?'}</text></g>})}
  </svg>
 </div>
}
