import {q, type Q,type View} from './math';
export const MODES=['free','opposite','absolute','distance','arithmetic','challenge'] as const;
export type Mode=typeof MODES[number];
export type Dot={id:string;name:string;x:Q;color:string};
export type Experiment={points:Dot[];view:View;parameter:Q;a:Q;b:Q;op:'+'|'-'};
export type Document={mode:Mode;experiments:Record<Mode,Experiment>;task:number;completed:number[]};
export const COLORS=['#2269cb','#e37e35','#148375','#8b59b9','#b84669','#557523'];
export const dot=(id:string,name:string,x:Q,index=0):Dot=>({id,name,x,color:COLORS[index%COLORS.length]});
export const experiment=(points:Dot[]):Experiment=>({points,view:{center:0,span:20},parameter:q(4),a:q(3),b:q(-5),op:'+'});
export function initial():Document{return {mode:'free',task:0,completed:[],experiments:{free:experiment([dot('a','A',q(-3)),dot('b','B',q(5),1)]),opposite:experiment([dot('a','A',q(3))]),absolute:experiment([dot('a','A',q(-4))]),distance:experiment([dot('a','A',q(-3)),dot('b','B',q(5),1)]),arithmetic:experiment([]),challenge:experiment([dot('a','A',q(0))])}}}
export const serialize=(d:Document)=>JSON.stringify(d,(_key,v)=>typeof v==='bigint'?String(v):v);
export function load():Document{try{const raw=localStorage.getItem('dangdang-number-line-v1');if(!raw)return initial();const d=JSON.parse(raw);if(!MODES.includes(d.mode)||!Number.isInteger(d.task)||d.task<0||d.task>=15||!Array.isArray(d.completed))return initial();for(const m of MODES){const e=d.experiments[m];if(!e||!Number.isFinite(e.view.center)||Math.abs(e.view.center)>1e6||!Number.isFinite(e.view.span)||e.view.span<.1||e.view.span>2e6||!['+','-'].includes(e.op)||!Array.isArray(e.points)||e.points.length>24) return initial();for(const r of [e.a,e.b,e.parameter,...e.points.map((p:Dot)=>p.x)]){if(!r||!/^[-]?\d{1,30}$/.test(String(r.n))||!/^\d{1,30}$/.test(String(r.d)))return initial();r.n=BigInt(r.n);r.d=BigInt(r.d);if(r.d<=0n||Math.abs(Number(r.n)/Number(r.d))>1e6)return initial()}for(const p of e.points)if(typeof p.id!=='string'||typeof p.name!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color))return initial();if(new Set(e.points.map((p:Dot)=>p.id)).size!==e.points.length)return initial()}d.completed=[...new Set(d.completed.filter((i:number)=>Number.isInteger(i)&&i>=0&&i<15))];return d}catch{return initial()}}
