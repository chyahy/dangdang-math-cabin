export type Q = {n:bigint; d:bigint};
const gcd=(a:bigint,b:bigint):bigint=>b===0n?(a<0n?-a:a):gcd(b,a%b);
function rational(n:bigint,d:bigint):Q {
  if(d===0n)throw new Error('分母不能为0');
  if(d<0n){n=-n;d=-d}const g=gcd(n,d);n/=g;d/=g;
  return {n,d};
}
export const q=(n:number,d=1):Q=>rational(BigInt(n),BigInt(d));
export const value=(a:Q)=>Number(a.n)/Number(a.d);
export function parse(text:string):Q {
  const s=text.trim().replaceAll('−','-').replaceAll('／','/');
  if(s.length>40)throw new Error('输入过长，请缩短数值');
  if(s.includes('/')){const parts=s.split('/');if(parts.length!==2||!parts.every(x=>/^[+-]?\d+$/.test(x.trim())))throw new Error('请输入整数、小数或分数，如 -3、0.5、1/3');return bounded(rational(BigInt(parts[0].trim()),BigInt(parts[1].trim())))}
  if(!/^[+-]?(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(s))throw new Error('请输入有效的数，小数最多6位');
  const sign=s.startsWith('-')?-1n:1n,clean=s.replace(/^[+-]/,''),[whole,dec='']=clean.split('.');
  return bounded(rational(sign*BigInt((whole||'0')+dec),10n**BigInt(dec.length)));
}
function bounded(a:Q){if(Math.abs(value(a))>1e6||a.d>1e9)throw new Error('请使用±1000000以内的数，分母不超过1000000000');return a}
export const add=(a:Q,b:Q)=>rational(BigInt(a.n)*BigInt(b.d)+BigInt(b.n)*BigInt(a.d),BigInt(a.d)*BigInt(b.d));
export const neg=(a:Q):Q=>({n:-a.n,d:a.d});
export const sub=(a:Q,b:Q)=>add(a,neg(b));
export const abs=(a:Q):Q=>({n:a.n<0n?-a.n:a.n,d:a.d});
export const distance=(a:Q,b:Q)=>abs(sub(a,b));
export const equal=(a:Q,b:Q)=>BigInt(a.n)*BigInt(b.d)===BigInt(b.n)*BigInt(a.d);
export function fmt(a:Q):string {
  if(a.d===1n)return String(a.n);
  let rest=a.d;while(rest%2n===0n)rest/=2n;while(rest%5n===0n)rest/=5n;
  if(rest!==1n)return `${a.n}/${a.d}`;
  const n=a.n<0n?-a.n:a.n;let remainder=n%a.d,digits='';
  while(remainder&&digits.length<18){remainder*=10n;digits+=String(remainder/a.d);remainder%=a.d}
  return remainder?`${a.n}/${a.d}`:`${a.n<0n?'-':''}${n/a.d}.${digits}`;
}
export const tex=(a:Q)=>a.d===1n?String(a.n):`${a.n<0?'-':''}\\frac{${abs(a).n}}{${a.d}}`;
export const operand=(a:Q)=>a.n<0?`(${fmt(a)})`:fmt(a);
export const solutions=(a:Q,center:Q=q(0)):Q[]=>a.n<0n?[]:a.n===0n?[center]:[sub(center,a),add(center,a)];
export const arithmetic=(a:Q,b:Q,op:'+'|'-')=>op==='+'?add(a,b):sub(a,b);
export const displacement=(b:Q,op:'+'|'-')=>op==='+'?b:neg(b);
export type View={center:number;span:number};
export const toPixel=(x:number,v:View,w:number)=>w/2+(x-v.center)*w/v.span;
export const fromPixel=(px:number,v:View,w:number)=>v.center+(px-w/2)*v.span/w;
export function zoom(v:View,factor:number,anchor:number,w:number):View {
  const span=Math.max(.1,Math.min(2e6,v.span*factor));
  return {center:Math.max(-1e6,Math.min(1e6,fromPixel(anchor,v,w)-(anchor/w-.5)*span)),span};
}
export const pan=(v:View,delta:number,w:number):View=>({...v,center:Math.max(-1e6,Math.min(1e6,v.center-delta*v.span/w))});
export const snap=(x:number,mode:string,den:number):Q=>mode==='integer'?q(Math.round(x)):mode==='fraction'?q(Math.round(x*den),den):q(Math.round(x*1e6),1e6);
export function tickStep(span:number,width:number):number {
  const raw=span/Math.max(2,width/75),base=10**Math.floor(Math.log10(raw));
  return [1,2,2.5,5,10].map(x=>x*base).find(x=>x>=raw)??base*10;
}
export function tickValues(v:View,width:number):number[]{const step=tickStep(v.span,width),start=Math.ceil((v.center-v.span/2)/step),end=Math.floor((v.center+v.span/2)/step);return Array.from({length:Math.min(100,end-start+1)},(_,i)=>Number(((start+i)*step).toPrecision(12)))}
export function fit(values:number[]):View{const low=Math.min(0,...values),high=Math.max(0,...values);return {center:(low+high)/2,span:Math.min(2e6,Math.max(6,(high-low)*1.5))}}
