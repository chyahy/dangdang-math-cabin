import {useRef,useState,type ReactNode,type PointerEvent} from 'react';
import {P,add,sub,mul,norm,square,camera,phase,mix,mixP,clamp,rightTriangle,dissection,assembledPoses,rearrangedPoses,posedTriangle,garfieldTriangles,hypFrame,shearSquare,oblique} from './geometry.mjs';
export type Point={x:number;y:number};
export type Options={lengths:boolean;areas:boolean;guides:boolean;formulas:boolean};
export type SceneProps={a:number;b:number;p:number;options:Options;onLegs?:(a:number,b:number)=>void;highlight?:string;onHighlight?:(s:string)=>void;compare?:boolean;layout?:number;spread?:number;apex?:number;onApex?:(n:number)=>void;normalize?:boolean;angle?:number};
const C={a:'#57b6ff',b:'#58d6a4',c:'#ff6c7c',tri:'#f4b64e',white:'#edf3fa',dim:'#91a1b4'};
const pts=(ps:Point[])=>ps.map(p=>`${p.x},${p.y}`).join(' ');
export const fmt=(n:number)=>Number((Math.abs(n)<.005?0:n).toFixed(2)).toLocaleString('zh-CN',{maximumFractionDigits:2});
function Poly({ps,color,fill=.16,opacity=1,active=false,onClick,dashed=false}:{ps:Point[];color:string;fill?:number;opacity?:number;active?:boolean;onClick?:()=>void;dashed?:boolean}){return <polygon points={pts(ps)} fill={color} fillOpacity={fill} stroke={color} strokeWidth={active?3.5:1.8} opacity={opacity} strokeDasharray={dashed?'7 6':undefined} strokeLinejoin="round" onClick={onClick} onKeyDown={e=>{if(onClick&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onClick()}}} tabIndex={onClick?0:undefined} role={onClick?'button':undefined} aria-label={onClick?'高亮此区域':undefined} className={onClick?'click-region':undefined}/>}
function Line({a,b,color=C.dim,dash=false,width=1.5,opacity=1}:{a:Point;b:Point;color?:string;dash?:boolean;width?:number;opacity?:number}){return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeDasharray={dash?'6 6':undefined} opacity={opacity}/>}
function Text({at,children,color=C.white,size=24,opacity=1,math=true}:{at:Point;children:ReactNode;color?:string;size?:number;opacity?:number;math?:boolean}){return <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size} style={{fontSize:`${size/24}em`}} opacity={opacity} className={math?'math-label':'scene-caption'}>{children}</text>}
const center=(ps:Point[])=>mul(ps.reduce((s,p)=>add(s,p),P(0,0)),1/ps.length);
function Right({at,u,v,color=C.white}:{at:Point;u:Point;v:Point;color?:string}){const U=mul(sub(u,at),13/norm(sub(u,at))),V=mul(sub(v,at),13/norm(sub(v,at)));return <polyline points={pts([add(at,U),add(add(at,U),V),add(at,V)])} fill="none" stroke={color} strokeWidth="1.5"/>}
function EdgeLabel({u,v,text,color=C.white,offset=22}:{u:Point;v:Point;text:ReactNode;color?:string;offset?:number}){const d=sub(v,u),n=mul(P(-d.y,d.x),offset/norm(d));return <Text at={add(mul(add(u,v),.5),n)} color={color} size={23}>{text}</Text>}
function SVG({children,label,onPointerMove,onPointerUp,svgRef}:{children:ReactNode;label:string;onPointerMove?:(e:PointerEvent<SVGSVGElement>)=>void;onPointerUp?:(e:PointerEvent<SVGSVGElement>)=>void;svgRef?:React.RefObject<SVGSVGElement|null>}){return <svg ref={svgRef} className="geometry" viewBox="0 0 1000 620" role="img" aria-label={label} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}><title>{label}</title>{children}</svg>}
function useDrag(){const ref=useRef<SVGSVGElement>(null),drag=useRef('');return {ref,drag,point:(e:PointerEvent<SVGSVGElement>)=>{const svg=ref.current!,ctm=svg.getScreenCTM();if(!ctm)return P(0,0);const q=new DOMPoint(e.clientX,e.clientY).matrixTransform(ctm.inverse());return P(q.x,q.y)},start:(kind:string,e:PointerEvent<SVGCircleElement>)=>{e.stopPropagation();drag.current=kind;e.currentTarget.ownerSVGElement!.setPointerCapture(e.pointerId)},end:()=>{drag.current=''}}}
export function Intro({a,b,p,options:o,onLegs,angle=90}:SceneProps){
 const [dragCam,setDragCam]=useState<{s:number;tx:number;ty:number}|null>(null);
 const {A,B,C:V,c,delta}=oblique(a,b,angle),triangle=[A,B,V],sq=[square(A,B),square(V,A),square(B,V)];
 const wide=camera(sq.flat(),{x:105,y:55,w:790,h:505}),close=camera(triangle,{x:240,y:100,w:520,h:400}),z=phase(p,0,1),cam=dragCam??{s:mix(close.s,wide.s,z),tx:mix(close.tx,wide.tx,z),ty:mix(close.ty,wide.ty,z)},f=(q:Point)=>P(q.x*cam.s+cam.tx,q.y*cam.s+cam.ty),drag=useDrag(),fill=angle===90?phase(p,3,4):0;const visible=[phase(p,0),phase(p,1),phase(p,2)];
 const names=['a','b','c'],values=[a*a,b*b,c*c],colors=[C.a,C.b,C.c];
 return <SVG svgRef={drag.ref} label={`三边正方形，a=${a}，b=${b}，夹角${angle}度`} onPointerUp={()=>{drag.end();setDragCam(null)}} onPointerMove={e=>{if(!drag.drag.current||!onLegs||angle!==90)return;const q=drag.point(e);if(drag.drag.current==='a')onLegs(clamp((q.x-cam.tx)/cam.s,1,13),b);else onLegs(a,clamp((cam.ty-q.y)/cam.s,1,13))}}>
 {sq.map((s,i)=><g key={i} opacity={visible[i]}><Poly ps={s.map(f)} color={colors[i]} fill={i<2?.06+fill*.3:.04}/>{o.areas&&p>=4.99&&<Text at={f(center(s))} color={colors[i]} size={27}>{names[i]}² = {fmt(values[i])}</Text>}{(o.lengths||o.areas)&&(!o.areas||p<4.99)&&<Text at={f(center(s))} color={colors[i]} size={34}>{names[i]}²</Text>}</g>)}
 {fill>0&&(()=>{const [u,v,,w]=sq[2],d=sub(v,u),h=sub(w,u),ratio=a*a/(c*c);return <g>{[0,1].map(i=>{const start=i===0?0:ratio,end=i===0?ratio:1;return <Poly key={i} ps={[add(u,mul(d,start)),add(u,mul(d,end)),add(add(u,mul(d,end)),mul(h,fill)),add(add(u,mul(d,start)),mul(h,fill))].map(f)} color={colors[i]} fill={.6} opacity={.85}/>})}</g>})()}
 <Poly ps={triangle.map(f)} color={C.tri} fill={.24}/>{angle===90?<Right at={f(A)} u={f(B)} v={f(V)}/>:<Text at={add(f(A),P(27,-25))} size={18} color={C.tri}>{angle}°</Text>}
 {o.lengths&&<><EdgeLabel u={f(A)} v={f(B)} text={<>a<tspan className="numeric-length"> = {fmt(a)}</tspan></>} color={C.a} offset={-20}/><EdgeLabel u={f(V)} v={f(A)} text={<>b<tspan className="numeric-length"> = {fmt(b)}</tspan></>} color={C.b} offset={-20}/><EdgeLabel u={f(B)} v={f(V)} text={<>c<tspan className="numeric-length"> = {fmt(c)}</tspan></>} color={C.c} offset={22}/></>}
 {onLegs&&angle===90&&[B,V].map((q,i)=><g key={i}><circle cx={f(q).x} cy={f(q).y} r="23" fill="transparent" className="drag-handle" onPointerDown={e=>{setDragCam(cam);drag.start(i===0?'a':'b',e)}}/><circle cx={f(q).x} cy={f(q).y} r="6" fill={colors[i]} stroke="#080b10" strokeWidth="2" pointerEvents="none"/></g>)}
 {o.guides&&p>=3.99&&<Text at={P(500,590)} color={C.dim} size={17} math={false}>{angle===90?'拖动两个彩色端点，保持直角改变边长':'相同的两条边，改变夹角；正方形面积仍按真实边长计算'}</Text>}
 {angle!==90&&o.areas&&<Text at={P(500,590)} color={C.white} size={23}>a² + b² − c² = {fmt(delta)}</Text>}
 </SVG>
}
function Arrangement({a,b,p,o,box,layout}:{a:number;b:number;p:number;o:Options;box:{x:number;y:number;w:number;h:number};layout?:number}){
 const L=a+b,T=rightTriangle(a,b);
 const poses=dissection(a,b,0),dest=dissection(a,b,1);const move=layout??phase(p,8,9);
 // Rigid displacement only. The lifted path makes it clear that the partition is temporarily open.
 const final=move>=.999,showPartition=p>=4||layout!==undefined;
 const movingPoses=rearrangedPoses(a,b,move);
 const current=move>0?movingPoses:layout!==undefined?poses:assembledPoses(a,b,p);
 const cam=camera([P(-L*.12,-L*.12),P(L*1.12,L*1.12),...current.flatMap(q=>posedTriangle(a,b,q))],box),f=cam.map;
 const central=[P(a,0),P(L,a),P(b,L),P(0,b)];
 const newSquares=[[P(0,0),P(a,0),P(a,a),P(0,a)],[P(a,a),P(L,a),P(L,L),P(a,L)]];
 return <g><Poly ps={[P(0,0),P(L,0),P(L,L),P(0,L)].map(f)} color={o.guides||p>=5?C.white:'#283443'} fill={0} active={p>=5&&p<6}/>
 {showPartition&&move<.001&&<><Poly ps={central.map(f)} color={C.c} fill={p>=5?.4:.12} active={p>=8}/>{o.areas&&<Text at={f(P(L/2,L/2))} color={C.c} size={30}>c²</Text>}</>}
 {showPartition&&final&&newSquares.map((sq,i)=><g key={i}><Poly ps={sq.map(f)} color={i===0?C.a:C.b} fill={.3}/>{o.areas&&<Text at={f(center(sq))} color={i===0?C.a:C.b} size={30}>{i===0?'a²':'b²'}</Text>}</g>)}
 {poses.map((pose,i)=>{const {x,y,r}=current[i];
 const origin=f(P(x,y));const moving=move>0&&move<1;return <g key={i} transform={`translate(${origin.x} ${origin.y}) rotate(${r}) scale(${cam.s})`}><polygon data-rigid={i} points={pts(T)} fill={C.tri} fillOpacity={moving?.62:.28} stroke={C.tri} strokeWidth={1.7/cam.s} strokeLinejoin="round"/>
 <polyline points={pts([P(a*.09,0),P(a*.09,Math.min(a,b)*.09),P(0,Math.min(a,b)*.09)])} fill="none" stroke={C.white} strokeWidth={1/cam.s}/>
 {o.lengths&&<>{[[P(a/2,-13/cam.s),'a'],[P(-13/cam.s,b/2),'b'],[P(a*.55,b*.55),'c']].map(([q,label],j)=><text key={j} x={(q as Point).x} y={(q as Point).y} textAnchor="middle" fill={C.white} fontSize={18/cam.s} style={{fontSize:`${18/(cam.s*24)}em`}} className="math-label" transform={`rotate(${-r} ${(q as Point).x} ${(q as Point).y})`}>{label as string}</text>)}</>}
 </g>})}
 {o.lengths&&<EdgeLabel u={f(P(0,0))} v={f(P(L,0))} text="a + b" offset={-24}/>}
 </g>
}
export function Dissection({a,b,p,options:o,compare=false,layout}:SceneProps){return <SVG label="四个全等直角三角形的两种拼接"><Arrangement a={a} b={b} p={p} o={o} box={compare?{x:15,y:75,w:475,h:450}:{x:100,y:10,w:800,h:570}} layout={compare?0:layout}/>{compare&&<><Line a={P(500,80)} b={P(500,520)} color="#26313e"/><Arrangement a={a} b={b} p={10} o={o} box={{x:510,y:75,w:475,h:450}} layout={1}/><Text at={P(250,565)} color={C.c} size={26}>剩余：c²</Text><Text at={P(750,565)} color={C.b} size={26}>剩余：a² + b²</Text></>}{!compare&&p>8&&p<9&&<Text at={P(500,590)} color={C.dim} size={17} math={false}>刚体移动中 · 到位后再比较剩余面积</Text>}</SVG>}
export function Garfield({a,b,p,options:o,spread=0,highlight='',onHighlight}:SceneProps){
 const L=a+b;
 const triangles=garfieldTriangles(a,b,p),k=phase(p,0),middleOpacity=phase(p,1),gap=spread*L*.22;
 const cam=camera([P(-L*.15,-L*.08),P(Math.max(a,b)+L*.15,L*1.08),...triangles.flat()],{x:150,y:45,w:700,h:510}),f=cam.map;
 // Both canonical triangles are transformed by Euclidean rotation and translation.
 return <SVG label="加菲尔德梯形：两块全等三角形与中间的等腰直角三角形">
 {o.guides&&p>=.99&&<Poly ps={[P(0,0),P(b,0),P(a,L),P(0,L)].map(f)} color={C.white} fill={0} active={p>=3&&p<4}/>}
 {triangles.map((tri,i)=>{const offset=i===0?P(-gap,-gap/2):i===1?P(-gap,gap/2):P(gap,0);const screen=tri.map(q=>f(add(q,offset)));const id=i===2?'middle':String(i);return <g key={i} opacity={i===2?middleOpacity:1}><Poly ps={screen} color={i===2?C.a:C.tri} fill={highlight===id?.5:.25} active={highlight===id||(p>=4&&p<5)} onClick={()=>onHighlight?.(id)}/>{i===2?<Right at={screen[2]} u={screen[0]} v={screen[1]} color={C.a}/>:<Right at={screen[0]} u={screen[1]} v={screen[2]}/>}{o.areas&&p>=1.99&&<Text at={center(screen)} size={i===2?27:23} color={i===2?C.a:C.tri}>{i===2?'c²/2':'ab/2'}</Text>}</g>})}
 {o.lengths&&k>.99&&<><EdgeLabel u={f(P(0,0))} v={f(P(b,0))} text="b" offset={-24}/><EdgeLabel u={f(P(0,L))} v={f(P(a,L))} text="a" offset={25}/><EdgeLabel u={f(P(0,L))} v={f(P(0,0))} text="a + b" offset={-32}/><EdgeLabel u={f(P(0,a))} v={f(P(b,0))} text="c" color={C.a} offset={25}/><EdgeLabel u={f(P(a,L))} v={f(P(0,a))} text="c" color={C.a} offset={25}/></>}
 {o.guides&&k>.99&&<Text at={P(500,590)} color={C.dim} size={17} math={false}>两条平行边为 a、b · 高为 a+b · 中间两条 c 边互相垂直</Text>}
 </SVG>
}
export function AreaScene({a,b,p,options:o,apex=0,onApex}:SceneProps){
 const drag=useDrag();const base=6,height=3,cam1=camera([P(-3,-4),P(9,1)],{x:130,y:85,w:740,h:430}),f1=cam1.map;
 if(p<1){const A=P(apex+3,-height),B=P(0,0),D=P(6,0);return <SVG svgRef={drag.ref} label="等底等高三角形，底6，高3，面积始终为9" onPointerUp={drag.end} onPointerMove={e=>{if(drag.drag.current){const q=drag.point(e);onApex?.(clamp((q.x-cam1.tx)/cam1.s-3,-5,5))}}}>
 {o.guides&&<><Line a={f1(P(-3,-3))} b={f1(P(9,-3))} dash/><Line a={f1(P(-3,0))} b={f1(P(9,0))} dash/></>}
 <Poly ps={[B,D,A].map(f1)} color={C.a} fill={.3}/><Line a={f1(A)} b={f1(P(A.x,0))} dash color={C.white}/><Right at={f1(P(A.x,0))} u={f1(A)} v={f1(P(A.x+1,0))}/><circle className="drag-handle" cx={f1(A).x} cy={f1(A).y} r="22" fill="transparent" onPointerDown={e=>drag.start('apex',e)}/><circle cx={f1(A).x} cy={f1(A).y} r="7" fill={C.a} pointerEvents="none"/>
 <EdgeLabel u={f1(B)} v={f1(D)} text="底 = 6" offset={30}/><Text at={add(f1(P(A.x,-1.5)),P(48,0))} size={24}>高 = 3</Text>{o.areas&&<Text at={P(500,545)} color={C.a} size={30}>面积 = 9（保持不变）</Text>}<Text at={P(500,595)} color={C.dim} size={18} math={false}>拖动蓝色顶点 · 顶点只能沿水平辅助线移动</Text>
 </SVG>}
 const frame=hypFrame(a,b),{A,B,C:V,D,c,m,n}=frame;const sqA=shearSquare(a,b,'a',0),sqB=shearSquare(a,b,'b',0),sqC=[B,V,P(c,c),P(0,c)];
 const stageA=phase(p,1,2)+phase(p,2,3)+phase(p,3,4),stageB=phase(p,4,5)+phase(p,5,6)+phase(p,6,7);
 const polyA=shearSquare(a,b,'a',stageA),polyB=shearSquare(a,b,'b',stageB);
 const all=[...sqA,...sqB,...sqC,...polyA,...polyB],cam=camera(all,{x:105,y:45,w:790,h:510}),f=cam.map;
 return <SVG label="面积变换：两次保持底高的剪切，将两个正方形变成斜边正方形内的两个矩形">
 {[sqA,sqB,sqC].map((s,i)=><Poly key={i} ps={s.map(f)} color={i===0?C.a:i===1?C.b:C.c} fill={0} dashed={i<2}/>)}
 {o.guides&&<><Line a={f(A)} b={f(P(m,c))} dash/><Line a={f(P(0,-c))} b={f(P(c,-c))} dash color="#566476"/><Line a={f(B)} b={f(V)} dash/></>}
 <Poly ps={[A,B,V].map(f)} color={C.tri} fill={.12}/><Right at={f(A)} u={f(B)} v={f(V)}/>
 {[polyA,polyB].map((s,i)=><g key={i}><Poly ps={s.map(f)} color={i===0?C.a:C.b} fill={.38} active={i===0?p>=1&&p<4:p>=4&&p<7}/>{o.areas&&<Text at={add(f(center(s)),P(0,-12))} color={i===0?C.a:C.b} size={26}>{i===0?'a²':'b²'}</Text>}</g>)}
 {o.guides&&(()=>{const i=p<4?0:1,t=i===0?stageA:stageB,poly=i===0?polyA:polyB,color=i===0?C.a:C.b;return <><Line a={f(poly[0])} b={f(poly[t<1?1:3])} color={color} width={4}/>{t<1&&<Line a={f(poly[3])} b={f(poly[2])} color={color} dash/>}</>})()}
 {o.lengths&&<><EdgeLabel u={f(B)} v={f(A)} text="a" color={C.a} offset={20}/><EdgeLabel u={f(A)} v={f(V)} text="b" color={C.b} offset={20}/><EdgeLabel u={f(P(0,c))} v={f(P(c,c))} text="c" color={C.c} offset={24}/>{stageA>=2.99&&<Text at={add(f(P(m/2,c*.5)),P(0,17))} color={C.a} size={16}>m × c</Text>}{stageB>=2.99&&<Text at={add(f(P(m+n/2,c*.5)),P(0,17))} color={C.b} size={16}>n × c</Text>}</>}
 </SVG>
}
function Angle({at,u,v,label,color}:{at:Point;u:Point;v:Point;label:string;color:string}){const uu=mul(sub(u,at),1/norm(sub(u,at))),vv=mul(sub(v,at),1/norm(sub(v,at))),bis=add(uu,vv),pos=add(at,mul(bis,28/Math.max(.1,norm(bis))));return <Text at={pos} color={color} size={20}>{label}</Text>}
export function Similarity({a,b,p,options:o,highlight='',normalize=false}:SceneProps){
 const {A,B,C:V,D,c,m,n,h}=hypFrame(a,b);const cam=camera([P(-.6,-h-.7),P(c+.6,.8)],{x:265,y:35,w:470,h:265}),f=cam.map,alt=phase(p,0),sep=phase(p,1,2),align=phase(p,2,3);
 const tris=[[D,B,A],[D,A,V]],colors=[C.a,C.b];
 function overlayEdges(map:(p:Point)=>Point,which:number){const onA=highlight==='a',onB=highlight==='b',all=highlight==='all';return <>{(onA||all)&&<><Line a={map(A)} b={map(B)} color={C.a} width={4}/><Line a={map(B)} b={map(D)} color={C.a} width={4}/></>}{(onB||all)&&<><Line a={map(A)} b={map(V)} color={C.b} width={4}/><Line a={map(D)} b={map(V)} color={C.b} width={4}/></>}{(onA||onB||all)&&which===2&&<Line a={map(B)} b={map(V)} color={onA?C.a:C.b} width={3}/>}</>}
 const actualTris=[...tris,[A,B,V]];return <SVG label="斜边高线分割出两个相似直角三角形，展示对应角与投影关系">
 <Poly ps={[A,B,V].map(f)} color={C.tri} fill={.07}/><Right at={f(A)} u={f(B)} v={f(V)}/>
 {alt>0&&<g opacity={alt}>{tris.map((t,i)=><Poly key={i} ps={t.map(f)} color={colors[i]} fill={.22}/>)}<Line a={f(A)} b={mixP(f(A),f(D),alt)} color={C.white} dash/><Right at={f(D)} u={f(A)} v={f(V)}/>{o.lengths&&<><EdgeLabel u={f(B)} v={f(D)} text={`m${o.areas?' = '+fmt(m):''}`} color={C.a} offset={23}/><EdgeLabel u={f(D)} v={f(V)} text={`n${o.areas?' = '+fmt(n):''}`} color={C.b} offset={23}/><Text at={add(f(D),P(0,-18))} size={19}>D</Text></>}</g>}
 {overlayEdges(f,2)}
 {o.lengths&&<><EdgeLabel u={f(B)} v={f(A)} text="a" color={C.a} offset={-24}/><EdgeLabel u={f(A)} v={f(V)} text="b" color={C.b} offset={-24}/><Text at={add(f(A),P(0,-24))}>A</Text><Text at={add(f(B),P(-20,10))}>B</Text><Text at={add(f(V),P(20,10))}>C</Text><Text at={P(500,350)} size={20} color={C.dim}>BC = c = {fmt(c)}</Text></>}
 {p>=2.99&&<><Angle at={f(B)} u={f(A)} v={f(V)} label="α" color={C.a}/><Angle at={f(V)} u={f(B)} v={f(A)} label="β" color={C.b}/></>}
 {sep>0&&actualTris.map((tri,i)=>{const origin=tri[0],d=sub(tri[1],origin),theta=-Math.atan2(d.y,d.x)*180/Math.PI;const targetAngle=mix(0,theta,align);const rot=targetAngle*Math.PI/180;
 const scale=normalize&&align>=.99?c/(i===0?a:i===1?b:c):1;const local=tri.map(v=>{const q=sub(v,origin);return P((q.x*Math.cos(rot)-q.y*Math.sin(rot))*scale,(q.x*Math.sin(rot)+q.y*Math.cos(rot))*scale)});
 const bounds=[...local,P(0,0)],minX=Math.min(...bounds.map(v=>v.x)),maxX=Math.max(...bounds.map(v=>v.x)),maxY=Math.max(...bounds.map(v=>v.y)),minY=Math.min(...bounds.map(v=>v.y));
 const s=mix(cam.s,Math.min(240/c,140/h),align);const destX=mix(i===0?265:i===1?735:500,175+i*320,align);const desired=P(destX-(minX+maxX)*s/2,430-(minY+maxY)*s/2);const originScreen=mixP(f(origin),desired,sep);
 const map=(v:Point)=>{const q=sub(v,origin);return add(originScreen,P((q.x*Math.cos(rot)-q.y*Math.sin(rot))*s*scale,(q.x*Math.sin(rot)+q.y*Math.cos(rot))*s*scale))};const screen=tri.map(map);
 return <g key={i} opacity={i===2?align:sep}><Poly ps={screen} color={i===2?C.tri:colors[i]} fill={.24}/><Right at={screen[0]} u={screen[1]} v={screen[2]}/>{p>=2.99&&<><Angle at={screen[1]} u={screen[0]} v={screen[2]} label="α" color={C.a}/><Angle at={screen[2]} u={screen[0]} v={screen[1]} label="β" color={C.b}/></>}{overlayEdges(map,i)}<Text at={P(destX,570)} color={i===2?C.tri:colors[i]} size={21} math={false}>{i===0?'△DBA · 斜边 a':i===1?'△DAC · 斜边 b':'△ABC · 斜边 c'}</Text></g>})}
 {normalize&&p>=2.99&&<Text at={P(500,605)} size={15} color={C.dim} math={false}>统一对应斜边仅作相似形比较 · 缩放后不用于面积相加</Text>}
 </SVG>
}
