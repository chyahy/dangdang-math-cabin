import {lessons,type Step} from './lessons';
import {bricks,seven,perigal,diagonalPair,offsetPair,daVinci} from './proofs/cuttings.mjs';
import {trapezoids,mirrorHex,pinwheel,equalHeight} from './proofs/comparisons.mjs';
import {scaled,projection,secant} from './proofs/extensions.mjs';

export const categories = ['直观面积与等积变换','图形切割与拼接','全等与面积比较','拓展欣赏','原课件与自由实验'];
const theorem='a^2+b^2=c^2';
const question='比较移动前后，哪些长度、角度或面积保持不变？';
const step=(title:string, note:string, formula='', highlight='')=>({title,prompt:note,note:'',formulas:formula?[formula]:[],highlight});
const start=(title:string,note:string)=>step(title,note);
const finish=(note:string)=>step('得到勾股定理',note,theorem,'all');
const both='比较两边的组成，找出可以逐一抵消的辅助区域。';
const move=(title:string,note=question)=>step(title,note);
type Builder=typeof daVinci|typeof bricks|typeof seven|typeof equalHeight|typeof perigal|typeof trapezoids|typeof diagonalPair|typeof offsetPair|typeof mirrorHex|typeof pinwheel|typeof scaled|typeof projection|typeof secant;
const item=(number:number,id:string,name:string,category:number,time:string,principle:string,build:Builder|null,steps:Omit<Step,'stepId'|'duration'>[])=>({number,id,name,category,time,principle,build,steps:steps.map((s,i)=>({...s,stepId:id+'-'+i,duration: i===0?1200:1800})),tag:'证明 '+String(number).padStart(2,'0')+' · '+categories[category],subtitle:principle,extension:category===3});

export const videoProofs=[
 item(1,'video01','欧几里得式面积变换',0,'00:06–00:43','保持底和高的平行四边形剪切',null,lessons.find(lesson=>lesson.id==='area')!.steps.slice(1)),
 item(2,'davinci','达·芬奇图形分割',2,'00:44–01:28','两个六边形分成对应的全等四边形',daVinci,[
  start('在三边上作正方形','看清两条直角边与一条斜边上的正方形。'),
  move('各补一个直角三角形','上下六边形都含两个相同的直角三角形。'),
  move('沿两条线分割六边形','上方沿通过直角顶点的直线分开，下方连接两个三角形的直角顶点。'),
  move('左半绕斜边左端旋转 90°','观察蓝色轮廓与上方靠下的四边形重合。'),
  move('右半旋转并与另一半比较','右半绕斜边右端旋转 90° 也重合。上方两半沿切线互为镜像。'),
  finish('上下六边形面积相等，同时减去两个全等的直角三角形。')]),
 item(3,'bricks','平移与切割填补',1,'01:29–02:13','把两正方形和一个三角形重排，再抵消三角形',bricks,[
  start('画出三边的正方形','留空斜边正方形，观察右上方的目标位置。'),
  move('把三角形旋进斜边正方形','三角形绕直角点转四分之一圈并移到上方，斜边与左侧边重合。'),
  move('把小正方形向右移一格','移动距离恰好等于小正方形的边长。'),
  move('用短边定位斜切线','从大直角边正方形底边向上量一条短边，再连到底边的另一端。'),
  move('把切出的三角形向上平移'),
  move('旋转并填入剩余四边形','拼图形成斜边正方形与一个直角三角形。'),
  finish('开始和结束都含一个全等的直角三角形。两边各减去它的面积。')]),
 item(4,'seven','七块图形切割重组',1,'02:14–02:49','两条对角线型切法与中心方块',seven,[
  start('找出长、短直角边正方形','比较短边与长边之差，观察它在切割中的作用。'),
  move('沿短边正方形的对角线切开','同时从长边正方形上量出一段短边，连接到相对顶点。'),
  move('画出中心小方块及其两条切边','长边正方形分成五块，短边正方形分成两块。'),
  move('放入长边第一片'),move('放入短边第一片'),move('填补第一侧'),move('放入长边对侧片'),move('放入短边第二片'),move('填补另一侧'),move('放入中心方块'),
  finish('逐块检查斜边正方形的边界，以及各块之间共用的边。')]),
 item(5,'equal-height','等底等高 · 三角形变换',0,'02:50–03:31','三角形的顶点沿底边平行线滑动',equalHeight,[
  start('从斜边正方形开始','直角顶点的垂线把正方形分成两个矩形。'),
  move('延长斜边上的高','这条辅助线与斜边正方形的两侧平行。'),
  move('沿每个矩形的对角线切开','每个矩形分成两个等面积的三角形。'),
  move('左半：滑动、旋转，再滑动','先固定竖直底，再绕斜边左端转 90°，最后固定小正方形的一条边。'),
  step('比较左侧两组等底等高三角形','顶点沿平行线移动时，固定底与它的垂直距离都保持不变。','S_{\triangle}=\frac12 bh','a'),
  move('补上左侧另一半','利用对角线两旁的三角形全等，重复变换。'),
  move('右半：对称地完成同样的两次滑动','旋转方向相反，面积理由相同。'),
  step('比较右侧两组等底等高三角形','找出每一段中固定的底和移动的顶点。','S_{\triangle}=\frac12 bh','b'),
  move('补上右侧另一半'),
  finish('两个矩形的四个半片分别覆盖两小正方形。')]),
 item(6,'perigal','四块切割与中心填补',1,'03:32–03:58','过长边正方形中心作两条正交切线',perigal,[
  start('确定较长直角边','中央切线分别平行和垂直于斜边。'),
  move('画水平中心切线','四片拥有相同的直角角点，均来自大正方形中心。'),
  move('画竖直中心切线','同一条切线上，中心两边的距离相等。'),
  move('第一片移到对角'),move('第二片移到对角'),move('第三片移到对角'),move('第四片移到对角'),
  move('移入未切开的小正方形','中央缺口与小正方形全等，朝向一致。'),
  finish('四块与中心小正方形的总面积等于斜边正方形。')]),
 item(7,'trapezoids','全等梯形与辅助面积抵消',2,'04:00–04:37','矩形沿过中心的斜线切成两个全等梯形',trapezoids,[
  start('画出三边的正方形','比较它们在斜边的延长线两侧的位置。'),
  move('补齐外接矩形','斜边中点就是外接矩形中心。'),
  move('沿延长的斜边切开','两半的外框经 180° 旋转全等。'),
  move('并排对照两个梯形',both),
  move('把每一块辅助图形与对应区域重合',both),
  finish('减掉每对全等辅助块，左侧只剩两个直角边正方形，右侧只剩斜边正方形。')]),
 item(8,'diagonal-pair','双正方形斜线切割',1,'04:38–05:07','在并底的两正方形中切出两个直角三角形并各旋转 90°',diagonalPair,[
  start('让两个正方形底边对齐','左边放长边正方形，右边放短边正方形。'),
  move('用第一块直角三角形画切割线','它的长直角边与左边正方形左边重合。'),
  move('用另一个直角三角形画切割线','两条斜边在底部共点且互相垂直。'),
  move('左侧切片绕第一个顶点旋转'),
  move('右侧切片沿相反方向旋转'),
  finish('外框四边都是原三角形的斜边长，邻边互相垂直。')]),
 item(9,'offset-pair','双正方形错位切割',1,'05:08–05:39','以长方块右上角为起点建立斜向正方形边界',offsetPair,[
  start('把两个正方形拼成台阶','先将短边正方形移到长边正方形的右下侧。'),
  move('从右下角向长边正方形右上角画斜线','这条线与原直角三角形斜边等长。'),
  move('转 90°确定相邻边及其平行边','切线把斜方形外的边角与中间区域分开。'),
  move('跨过两条平行边来回平移','沿目标正方形的一条边平移，使轮廓的一边与对面对应。'),
  move('把上角平移到对面','检查新外框的四个直角和四条等长边。'),
  finish('切片只是平移，总面积不变。')]),
 item(10,'mirror-hex','对称翻转与面积抵消',2,'05:40–06:24','六边形沿轴分开，把一半上下镜像翻转',mirrorHex,[
  start('在两条直角边上补两个菱形朝向的正方形','蓝色两块来自同一个直角三角形，关于中线互为镜像。'),
  move('沿中轴分开六边形','两半共享同一条竖直中线。'),
  move('把右半上下翻面','以轴段中点的水平线为翻转轴，两端互换。'),
  move('在新六边形内找出斜边正方形','四条斜边首尾连接，相邻两边夹角为直角。'),
  move('配对上、下两个辅助三角形',both),
  finish('两六边形面积相等，减去相同的两个辅助三角形。')]),
 item(11,'pinwheel','斜边正方形与四三角形',2,'06:25–06:56','四条斜边围边，中间留下边长 |b−a| 的小正方形',pinwheel,[
  start('先画斜边正方形','先观察边长同为 c 的四条边。'),
  move('准备四块全等的直角三角形'),
  move('将四条斜边依次贴到外框','每块的直角顶点朝内。'),
  step('测量中央空白的边长','相邻的长、短直角边共线，剩余的一段长为两腿之差。','c^2=4\cdot\frac{ab}{2}+(b-a)^2'),
  move('移出第一块'),move('与第二块配成第一个矩形'),move('移出第三块'),move('与第四块配成第二个矩形'),
  step('把中心方块也移到右侧','两个矩形的面积各为 ab。','c^2=2ab+(b-a)^2'),
  finish('把差的平方展开，抵消正负 2ab。')]),
 item(12,'video12','两个大正方形的剩余面积',2,'06:57–07:37','同一个大正方形，减去四块全等三角形',null,[
  start('画一个边长 a+b 的大正方形','先比较左右两段和上下两段的长度。'),
  move('把两个矩形沿斜线分成四块','两种颜色表示一对对全等的三角形。'),
  step('计算第一种排列的剩余面积','从大正方形减去四块全等三角形。','a^2+b^2=(a+b)^2-2ab'),
  move('移动同样的四片围出中央正方形','旋转或平移均保持三角形面积。'),
  step('并排比较两种排列','两幅图的外框相同，扣去的面积也相同。','c^2=(a+b)^2-2ab'),
  finish('两个剩余面积都等于同一个差。')]),
 item(13,'scale','相似三角形比例缩放',3,'07:38–08:09','按 a、b、c 倍缩放，拼接后以两直角边判全等',scaled,[
  start('先看原来的直角三角形','记下直角边 a、b 和斜边 c。'),
  step('按 a 倍和 b 倍放大副本','两份副本各有一条长度 ab 的直角边。','a^2,ab,ac\qquad ab,b^2,bc'),
  move('先放入 a 倍副本','它的斜边 ac 将成为外框的一条直角边。'),
  move('沿 ab 拼入 b 倍副本','共边两侧的锐角互余，斜边位置的两段由此共线。'),
  step('与 c 倍副本比较','外框两条直角边为 ac、bc，所以两个大三角形全等。','a^2+b^2\;=\;c\cdot c'),
  finish('两段斜边长度之和与 c 倍副本的斜边相等。')]),
 item(14,'projection','三角函数与矩形投影',3,'08:10–08:38','同角的正弦由相似定义，矩形上下边长度相等',projection,[
  start('标出锐角 α、β','α 对应的对边是 a，β 对应的对边是 b。'),
  step('从相似三角形的边比定义正弦','相同锐角的对边与斜边之比相同。','\sin\alpha=a/c,\quad\sin\beta=b/c'),
  step('放大 c 倍并画矩形','底边变为 c²，两腿分别变为 ac、bc。','ac,\quad bc,\quad c^2'),
  step('从左右端点作垂直投影','矩形侧边与斜线形成互余角；顶部两段是相应小直角三角形的对边。','ac\sin\alpha=a^2'),
  step('计算另一段投影','正弦只使用边比与相似，无需引用勾股定理。','bc\sin\beta=b^2'),
  finish('矩形上边分成两段，长度之和等于下边长度。')]),
 item(15,'secant','圆的切线与割线',3,'08:39–09:16','切线弦定理与相似三角形给出切割线定理',secant,[
  start('确定直角三角形与圆心','取 b 边远离直角的端点为圆心，半径为 b。'),
  move('画圆并标出切点','半径与 a 边垂直，a 边所在直线与圆相切。'),
  step('延长斜边，标出近、远交点','割线经过圆心，两交点到圆心的距离均为 b。','PN=c-b,\quad PF=c+b'),
  step('用切割线定理','连切点 T 到 N、F。由切线弦定理和 P 处公共角，△PTN 与 △PFT 相似。','PT^2=PN\cdot PF'),
  step('用平方差展开','代入 a、c−b、c+b。','a^2=(c-b)(c+b)=c^2-b^2'),
  finish('两边加上 b²。')]),
];

export const extraLessons=videoProofs.filter(p=>p.steps.length);
export const videoByModule=new Map(videoProofs.map(proof=>[proof.id,proof]));
