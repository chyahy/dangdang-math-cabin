import type {Entry,QuestionType} from '../engine/types';import {expected,validateEntry} from './questions';
const bank:Entry[]=[];
function add(grade:string,topic:string,difficulty:number,type:QuestionType,expression:string,explanation:string,options:string[]=[],extra:Partial<Entry>={}){const e:Entry={id:`builtin-${bank.length+1}`,grade,topic,difficulty,type,expression,explanation,options,answer:'0',...extra};e.answer=expected(e).toString();const checked=validateEntry(e);if(!checked.entry)throw Error(`${expression}: ${checked.errors.join(';')}`);bank.push(e)}
for(let k=0;k<10;k++){
 const a=12+k*3,b=7+k,c=5+k;
 add('四年级','整数加减',1,'calculate',`${a*10}+${b*10}-${c*5}`,'按从左到右的顺序计算。');
 add('四年级','整数乘除',1,'calculate',`${a*6}÷6×${b}`,'乘除同级，从左到右。');
 add('四年级','运算顺序',2,'calculate',`${a}+${b}×${c}`,'先算乘法，再算加法。');
 add('四年级','混合运算',3,'calculate',`(${a}+${b})×${c}-${b}×${c}`,'先算括号，也可观察两个相同乘数。');
 add('四年级','加法交换律',1,'method',`${a}+${b}`, '两个加数交换位置，和不变。',[`${b}+${a}`,`${a}-${b}`,`${b}+${a}+1`]);
 add('四年级','加法结合律',2,'method',`${a}+${100-a}+${b}`, '先把能凑成100的两个数相加。',[`(${a}+${100-a})+${b}`,`${a}+(${100-a}+${b})`,`100-${b}`]);
 add('四年级','乘法交换律',1,'method',`${a}×${b}`,'交换两个乘数的位置，积不变。',[`${b}×${a}`,`${a}+${b}`,`${b}×(${a}+1)`]);
 add('四年级','乘法结合律',2,'method',`${k+2}×25×4`,'25×4=100，先把25和4结合。',[`${k+2}×(25×4)`,`${k+2}×100`,`${k+2}×(25+4)`]);
 add('四年级','乘法分配律',2,'method',`${a}×99`,'99看作100−1，分别相乘再相减。',[`${a}×100-${a}`,`${a}×(100-1)`,`${a}×100-1`]);
 add('四年级','简便运算',3,'method',`${48+k*4}×25`,'25=100÷4；也可以把乘数拆开后使用分配律。',[`${48+k*4}×100÷4`,`(${40+k*4}+8)×25`,`${48+k*4}×(20+5)`,`${48+k*4}×100÷2`]);
 add('四年级','数量关系',2,'missing',`□×25=${(k+8)*25}`,'一个乘数=积÷另一个乘数。');
 add('四年级','混合运算',2,'missing',`(□+${b})×3=${(a+b)*3}`,'从最后一步逆推，先除以3，再减去已知加数。');
 add('五年级','小数运算',1,'fraction',`${a/10}+${b/10}`,'相同数位对齐，也可以把小数化为相同分母的分数。');
 add('五年级','小数运算',2,'fraction',`${a/10}×0.25`,'乘0.25相当于除以4。');
 add('五年级','分数基础',1,'fraction',`${k+1}/4+1/4`,'同分母分数相加，分母不变，分子相加。');
 add('五年级','分数加减',2,'fraction',`${k+2}/3+1/6`,'先通分成6分之几，再相加。');
 add('五年级','分数加减',3,'fraction',`${k+5}/4-2/3+1/6`,'通分成12分之几，再按从左到右的顺序计算。');
 add('五年级','数量关系',2,'missing',`□×0.5=${a/2}`,'一个乘数=积÷另一个乘数。');
 add('五年级','计算规律',2,'method',`${a}×0.25`,'0.25=1/4；下面结果相同的方法都可以。',[`${a}÷4`,`${a}×25÷100`,`${a}÷25`]);
 add('初一','正负数',1,'calculate',`(-${a})+${b}`,'异号两数相加，取绝对值较大的数的符号。');
 add('初一','有理数四则运算',2,'calculate',`(-${a})-(-${b})`,'减去一个数，等于加上这个数的相反数。');
 add('初一','有理数四则运算',3,'fraction',`(-${a})÷${c}+${b}/2`,'先算除法，按分数进行精确计算。');
 add('初一','绝对值',1,'calculate',`abs(-${a})-${b}`,'绝对值表示距离，先求绝对值再相减。');
 add('初一','代数式求值',2,'calculate',`3*a-2*b`,'先代入字母的值，再按运算顺序计算。',[],{context:`当 a=${k-4}，b=${k+2} 时，求代数式的值`,environment:{a:String(k-4),b:String(k+2)}});
 add('初一','简单方程',2,'missing',`3×x-${b}=${a}`,'等式两边同时加上已知数，再除以3。');
 add('初一','有理数四则运算',3,'method',`(-${a})×99`,'把99拆成100−1，注意负数乘法的符号。',[`(-${a})×100+${a}`,`(-${a})×(100-1)`,`(-${a})×100-${a}`]);
}
export const BUILTIN_ENTRIES=bank;
