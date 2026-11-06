import {abs,arithmetic,distance,equal,neg,q,solutions,type Q} from './math';
import {dot,type Dot} from './model';
export type Task={title:string;question:string;count:number;hints:string[];explanation:string;check:(p:Q[])=>boolean};
const sameSet=(p:Q[],s:Q[])=>p.length===s.length&&s.every(x=>p.some(y=>equal(x,y)))&&p.every(x=>s.some(y=>equal(x,y)));
const at=(n:number)=>(p:Q[])=>p.length===1&&equal(p[0],q(n));
export const TASKS:Task[]=[
 {title:'找到负数',question:'把点 A 移动到 −3。',count:1,hints:['先找到原点0。','从0向左走3个单位。'],explanation:'负数在原点左侧。−3在0左侧3个单位处。',check:at(-3)},
 {title:'距离相同的两个位置',question:'移动 A、B，找全到原点距离为5的两个位置。',count:2,hints:['绝对值表示到原点的距离。','原点左侧和右侧各有一个。'],explanation:'|x|=5的解是−5和5。',check:p=>sameSet(p,solutions(q(5)))},
 {title:'以2为中心',question:'移动 A、B，找全与2的距离等于4的位置。',count:2,hints:['以2为出发点。','向左4个单位，向右4个单位。'],explanation:'2−4=−2，2+4=6。两处到2的距离都为4。',check:p=>sameSet(p,solutions(q(4),q(2)))},
 {title:'从负数出发',question:'在数轴上用点 A 表示 −3 + 7 的结果。',count:1,hints:['先从0走到−3。','从−3向右走7个单位。'],explanation:'−3+7=4，向右移动7个单位后到达4。',check:p=>p.length===1&&equal(p[0],arithmetic(q(-3),q(7),'+'))},
 {title:'拉开6个单位',question:'拖动 A、B，使两点之间的距离恰好等于6。',count:2,hints:['距离等于两数之差的绝对值。','例如可以把一个点放在0，再移动另一个点。'],explanation:'只要|A−B|=6就成立，答案有无数种。',check:p=>p.length===2&&equal(distance(p[0],p[1]),q(6))},
 {title:'解一个绝对值方程',question:'移动 A、B，找到 |x−2|=3 的全部解。',count:2,hints:['这表示到2的距离为3。','从2分别向左、向右走3个单位。'],explanation:'x=−1或x=5。两点关于2对称。',check:p=>sameSet(p,solutions(q(3),q(2)))},
 {title:'寻找相反数',question:'把 A 移到 −7 的相反数上。',count:1,hints:['相反数关于原点对称。','−7在左侧，另一个点应在右侧。'],explanation:'−7的相反数是7。',check:p=>p.length===1&&equal(p[0],neg(q(-7)))},
 {title:'绝对值为0',question:'移动 A，使 |A|=0。',count:1,hints:['距离不可能小于0。','到原点距离为0的点就是原点。'],explanation:'|0|=0，唯一的位置是0。',check:p=>p.length===1&&equal(abs(p[0]),q(0))},
 {title:'减去一个负数',question:'把 A 移到 −3−(−5) 的结果处。',count:1,hints:['减去一个数，等于加上它的相反数。','−3−(−5)=−3+5。'],explanation:'−3−(−5)=2，减去−5相当于向右移动5个单位。',check:p=>p.length===1&&equal(p[0],arithmetic(q(-3),q(-5),'-'))},
 {title:'跨过原点',question:'把 A 移到 3+(−5) 的结果处。',count:1,hints:['从3开始。','向左走5个单位。'],explanation:'3+(−5)=−2，箭头经过0后继续向左2个单位。',check:p=>p.length===1&&equal(p[0],arithmetic(q(3),q(-5),'+'))},
 {title:'分数也有位置',question:'把 A 移到 1/2；可以改用分数吸附或精确输入。',count:1,hints:['1/2=0.5。','它在0和1的正中间。'],explanation:'分数和小数可以表示同一个数：1/2=0.5。',check:p=>p.length===1&&equal(p[0],q(1,2))},
 {title:'负的小数',question:'把 A 移到 −1.5；可以使用1/2刻度。',count:1,hints:['−1.5在−2与−1之间。','它到两个整数刻度的距离相同。'],explanation:'−1.5=−3/2，在−2和−1的中间。',check:p=>p.length===1&&equal(p[0],q(-3,2))},
 {title:'相反数相加',question:'移动 A、B，使 A+B=0，且两点距离为8。',count:2,hints:['两点应关于原点对称。','两点各离原点4个单位。'],explanation:'两点是−4和4，相加为0，距离为8。',check:p=>sameSet(p,solutions(q(4)))},
 {title:'重合也是一种距离',question:'把 A、B 都移到2，观察两点距离。',count:2,hints:['两点可以有同一个坐标。','用下方输入框可分别设为2。'],explanation:'两点重合时，|2−2|=0。',check:p=>p.length===2&&p.every(x=>equal(x,q(2)))},
 {title:'跨过半个单位',question:'把 A 放在−1/2，把 B 放在3/2，验证距离为2。',count:2,hints:['把吸附方式改为分数，分母选择2。','A=−0.5，B=1.5。'],explanation:'|3/2−(−1/2)|=2。',check:p=>p.length===2&&equal(p[0],q(-1,2))&&equal(p[1],q(3,2))&&equal(distance(p[0],p[1]),q(2))}
];
export function taskPoints(index:number):Dot[]{return Array.from({length:TASKS[index].count},(_,i)=>dot(i?'b':'a',i?'B':'A',q(i),i))}
