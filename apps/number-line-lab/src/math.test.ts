import {describe,it,expect} from 'vitest';
import {abs,add,arithmetic,distance,equal,fmt,fromPixel,neg,pan,parse,q,snap,solutions,tickValues,toPixel,value,zoom} from './math';
import {TASKS,taskPoints} from './tasks';
describe('精确有理数与边界',()=>{
 it('0的相反数与绝对值是0，且没有负0',()=>{expect(neg(q(0))).toEqual(q(0));expect(Object.is(neg(q(0)).n,-0)).toBe(false);expect(abs(q(0))).toEqual(q(0))});
 it('|−5|=5',()=>expect(abs(q(-5))).toEqual(q(5)));
 it('小数加法与分数计算没有浮点尾数',()=>{expect(fmt(add(parse('.1'),parse('0.2')))).toBe('0.3');expect(add(parse('1/3'),parse('2/3'))).toEqual(q(1));expect(parse('2/-4')).toEqual(q(-1,2))});
 it('有限小数保持小数显示，大分母的中间计算仍精确',()=>{expect(fmt(parse('0.333333'))).toBe('0.333333');const a=parse('999999.999999'),b=parse('1/999999937');expect(equal(arithmetic(arithmetic(a,b,'+'),b,'-'),a)).toBe(true)});
 it.each(['','1/0','NaN','Infinity','1e3','1.2345678','1/2/3','1000001','<script>'])('拒绝无效输入 %s',s=>expect(()=>parse(s)).toThrow());
 it.each([[-3,7,'+',4],[3,-5,'+',-2],[-3,-5,'-',2],[3,5,'+',8],[-3,-5,'+',-8],[3,5,'-',-2],[3,-5,'-',8],[-3,5,'-',-8],[0,0,'+',0],[0,-3,'-',3]] as const)('%s %s %s 的计算正确',(a,b,op,result)=>expect(arithmetic(q(a),q(b),op)).toEqual(q(result)));
 it('重合距离0、交换位置距离不变',()=>{expect(distance(q(2),q(2))).toEqual(q(0));expect(distance(q(-3),q(5))).toEqual(q(8));expect(distance(q(-3),q(5))).toEqual(distance(q(5),q(-3)))});
 it('绝对值方程按实际几何计算',()=>{expect(solutions(q(-1))).toEqual([]);expect(solutions(q(0))).toEqual([q(0)]);expect(solutions(q(3),q(2))).toEqual([q(-1),q(5)])});
 it('穿过0的拖动与分数吸附',()=>{expect(snap(-.02,'integer',2)).toEqual(q(0));expect(snap(.02,'integer',2)).toEqual(q(0));expect(snap(.33,'fraction',3)).toEqual(q(1,3));expect(snap(-.51,'fraction',2)).toEqual(q(-1,2))});
});
describe('真实坐标与视图分离',()=>{
 it('不同宽度和缩放状态坐标映射互逆',()=>{for(const width of [320,800,1400])for(const span of [.1,20,10000])for(const n of [-5,0,3.5]){const v={center:2,span};expect(fromPixel(toPixel(n,v,width),v,width)).toBeCloseTo(n,10)}});
 it('缩放保留鼠标锚点的数学坐标',()=>{const v={center:0,span:20},next=zoom(v,.4,123,850);expect(fromPixel(123,v,850)).toBeCloseTo(fromPixel(123,next,850),12)});
 it('平移只改变视图，点值不变',()=>{const x=parse('1/3'),before=structuredClone(x),v={center:0,span:20},next=pan(v,50,800);expect(next.center).toBe(-1.25);expect(x).toEqual(before);expect(fromPixel(toPixel(value(x),next,800),next,800)).toBeCloseTo(value(x),12)});
 it('刻度有限、有序、不会无限生成',()=>{for(const span of [.1,20,2e6]){const ts=tickValues({center:0,span},390);expect(ts.length).toBeLessThan(100);expect(ts.every((x,i)=>i===0||x>ts[i-1])).toBe(true)}});
});
describe('15道操作任务按数值判定',()=>{
 const answers=[[-3],[-5,5],[-2,6],[4],[-1,5],[-1,5],[7],[0],[2],[-2],[.5],[-1.5],[-4,4],[2,2],[-.5,1.5]];
 it('所有任务有真实可操作的初始点',()=>{expect(TASKS.length).toBe(15);TASKS.forEach((t,i)=>expect(taskPoints(i).length).toBe(t.count))});
 it.each(answers.map((v,i)=>[i,v] as const))('任务 %s 接受正确数值并拒绝错误位置',(i,answer)=>{const points=answer.map(x=>parse(String(x)));expect(TASKS[i].check(points)).toBe(true);expect(TASKS[i].check(points.map((x,j)=>j===0?add(x,q(100)):x))).toBe(false)});
 it('所有解任务拒绝重复答案，允许交换两个点',()=>{expect(TASKS[1].check([q(5),q(5)])).toBe(false);expect(TASKS[1].check([q(5),q(-5)])).toBe(true);expect(equal(parse('2/4'),parse('0.5'))).toBe(true)});
});
