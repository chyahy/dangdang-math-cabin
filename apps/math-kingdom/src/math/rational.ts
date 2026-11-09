const gcd=(a:bigint,b:bigint):bigint=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r}return a||1n};
export class R {
 readonly n:bigint;readonly d:bigint;
 constructor(n:bigint|number,d:bigint|number=1){n=BigInt(n);d=BigInt(d);if(!d)throw Error('除数不能为0');if(d<0n){n=-n;d=-d}const g=gcd(n,d);this.n=n/g;this.d=d/g;if(String(this.n).length>100||String(this.d).length>100)throw Error('数值过大')}
 add(b:R){return new R(this.n*b.d+b.n*this.d,this.d*b.d)}sub(b:R){return this.add(b.neg())}mul(b:R){return new R(this.n*b.n,this.d*b.d)}div(b:R){return new R(this.n*b.d,this.d*b.n)}neg(){return new R(-this.n,this.d)}abs(){return this.n<0n?this.neg():this}eq(b:R){return this.n===b.n&&this.d===b.d}get zero(){return this.n===0n}toString(){return this.d===1n?String(this.n):`${this.n}/${this.d}`}
}
export function decimal(s:string):R{if(!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)||s.replace(/[+-.]/g,'').length>24)throw Error('请输入有效数字（最多24位）');const sign=s.startsWith('-')?-1n:1n;const [a,b='']=s.replace(/^[+-]/,'').split('.');return new R(sign*BigInt((a||'0')+b),10n**BigInt(b.length))}
export function parseAnswer(input:string):R{const s=input.trim().replace(/−/g,'-').replace(/\s+/g,'');const parts=s.split('/');if(parts.length>2||!s||s.length>52)throw Error('请填写整数、小数或分数');return parts.length===2?decimal(parts[0]).div(decimal(parts[1])):decimal(s)}
type Node={k:'num';v:R}|{k:'var';v:string}|{k:'neg'|'abs';a:Node}|{k:'op';op:string;a:Node;b:Node};
function ast(input:string):Node{
 if(input.length>240)throw Error('算式过长');const s=input.replace(/×|·/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/（/g,'(').replace(/）/g,')').replace(/□/g,'x').replace(/\|([^|]+)\|/g,'abs($1)').replace(/\s+/g,'');
 const tokens=s.match(/abs|\d+(?:\.\d*)?|\.\d+|[a-zA-Z]|[+\-*/()^]/g)||[];if(tokens.join('')!==s||!tokens.length||tokens.length>150)throw Error('算式含有不支持的字符');let i=0;
 function factor():Node{const t=tokens[i++];if(t==='('){const n=expr();if(tokens[i++]!==')')throw Error('括号不匹配');return n}if(t==='abs'){if(tokens[i++]!=='(')throw Error('绝对值格式错误');const n=expr();if(tokens[i++]!==')')throw Error('括号不匹配');return {k:'abs',a:n}}if(t&&/^[a-zA-Z]$/.test(t))return {k:'var',v:t};if(t&&/^[\d.]/.test(t))return {k:'num',v:decimal(t)};throw Error('算式不完整')}
 function power():Node{let n=factor();if(tokens[i]==='^'){i++;const exponent=tokens[i++];if(exponent!=='2')throw Error('本版只支持平方');n={k:'op',op:'*',a:n,b:n}}return n}
 function unary():Node{if(tokens[i]==='-'){i++;return {k:'neg',a:unary()}}if(tokens[i]==='+'){i++;return unary()}return power()}
 function term():Node{let n=unary();while(['*','/'].includes(tokens[i])){const op=tokens[i++];n={k:'op',op,a:n,b:unary()}}return n}
 function expr():Node{let n=term();while(['+','-'].includes(tokens[i])){const op=tokens[i++];n={k:'op',op,a:n,b:term()}}return n}const n=expr();if(i!==tokens.length)throw Error('算式不完整');return n;
}
const apply=(op:string,a:R,b:R)=>op==='+'?a.add(b):op==='-'?a.sub(b):op==='*'?a.mul(b):a.div(b);
export function evaluate(input:string,env:Record<string,R>={}):R{function walk(n:Node):R{if(n.k==='num')return n.v;if(n.k==='var'){if(!env[n.v])throw Error('缺少字母的值');return env[n.v]}if(n.k==='neg')return walk(n.a).neg();if(n.k==='abs')return walk(n.a).abs();if(n.k==='op')return apply(n.op,walk(n.a),walk(n.b));throw Error('无效算式')}return walk(ast(input))}
export function solve(input:string):R{
 const sides=input.split('=');if(sides.length!==2)throw Error('填空题需要1个等号');type L={a:R;b:R};const z=()=>new R(0);
 function walk(n:Node):L{if(n.k==='num')return {a:z(),b:n.v};if(n.k==='var'){if(n.v!=='x')throw Error('只支持一个未知数□或x');return {a:new R(1),b:z()}}if(n.k==='neg'){const v=walk(n.a);return {a:v.a.neg(),b:v.b.neg()}}if(n.k==='abs')throw Error('含未知数的绝对值不作为唯一填空答案');if(n.k!=='op')throw Error('无效算式');const a=walk(n.a),b=walk(n.b);if(n.op==='+'||n.op==='-')return {a:apply(n.op,a.a,b.a),b:apply(n.op,a.b,b.b)};if(n.op==='*'){if(!a.a.zero&&!b.a.zero)throw Error('只支持一次方程');return {a:a.a.mul(b.b).add(b.a.mul(a.b)),b:a.b.mul(b.b)}}if(!b.a.zero)throw Error('未知数不能在分母');return {a:a.a.div(b.b),b:a.b.div(b.b)}}
 const l=walk(ast(sides[0])),r=walk(ast(sides[1])),coefficient=l.a.sub(r.a);if(coefficient.zero)throw Error('填空题必须有唯一答案');return r.b.sub(l.b).div(coefficient);
}
export const equivalent=(a:string,b:string)=>{try{return parseAnswer(a).eq(parseAnswer(b))}catch{return false}};
/** Check intermediate values as well as the answer, preventing hidden out-of-grade arithmetic. */
export function checkGrade(input:string,grade:string,missing=false){if(grade==='初一')return;function walk(n:Node):R|null{let value:R|null;if(n.k==='num')value=n.v;else if(n.k==='var'){if(!missing||n.v!=='x')throw Error('该年级不设置代数式求值');return null}else if(n.k==='abs')throw Error('该年级不设置绝对值');else if(n.k==='neg'){const a=walk(n.a);value=a?.neg()||null}else if(n.k==='op'){const a=walk(n.a),b=walk(n.b);value=a&&b?apply(n.op,a,b):null}else throw Error('无效算式');if(value&&value.n<0n)throw Error('该年级不设置含负数的运算');if(grade==='四年级'&&value&&value.d!==1n)throw Error('四年级题库不含分数或小数中间结果');return value}for(const side of input.split('='))walk(ast(side))}
