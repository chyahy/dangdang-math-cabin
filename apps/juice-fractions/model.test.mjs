import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),context=vm.createContext({});
vm.runInContext(html.match(/<script id="juice-model">([\s\S]*?)<\/script>/)[1],context);
const M=context.JuiceModel,{F,ONE,ZERO,fmt,add,sub,mul,div,cmp}=M;
const drinkEighths=(s,k)=>M.drinkAmount(s,F(k,8));
const equal=(a,b)=>assert.equal(fmt(a),b);
test('Juice and water accumulate independently and exclude refills from both calculation histories',()=>{
 let s=M.drink(M.initial(),6);s=M.drink(M.refill(s),6);let c=M.cumulativeCalculation(s);
 equal(c.steps[0].juiceAmount,'1/2');equal(c.steps[0].waterAmount,'0');equal(c.steps[1].juicePrevious,'1/2');equal(c.steps[1].juiceAmount,'1/4');equal(c.steps[1].juiceTotal,'3/4');equal(c.steps[1].waterPrevious,'0');equal(c.steps[1].waterAmount,'1/4');equal(c.steps[1].waterTotal,'1/4');
 const before=s;s=M.drink(M.refill(s),6);c=M.cumulativeCalculation(s);equal(c.steps[2].juiceAmount,'1/8');equal(c.steps[2].juiceTotal,'7/8');equal(c.steps[2].waterAmount,'3/8');equal(c.steps[2].waterTotal,'5/8');equal(M.cumulativeCalculation(before).juice,'3/4');
});
test('Only cumulative collection cups and separate calculations occupy the right panel',()=>{
 const panel=html.slice(html.indexOf('<section class="panel right"'),html.indexOf('</main>'));
 for(const id of ['juice-collection','water-collection','juice-process','water-process','collection-total'])assert(panel.includes('id="'+id+'"'));
 assert(!html.includes('id="out-cup"'));assert(!html.includes('class="collection-section"'));assert(!html.includes('id="this-juice"'));
});
test('Twelve selectable parts drink exact twelfths and keep both rulers complementary',()=>{
 assert.equal(M.DIVISIONS,12);assert.equal(M.rulerChoices(ONE).length,13);
 for(let k=1;k<=12;k++){const s=M.drink(M.initial(),k);equal(s.last.amount,fmt(F(k,12)));equal(s.volume,fmt(F(12-k,12)));assert.equal(M.maxTick(s),12-k);for(const side of ['drink','remain']){const choice=M.selectAmount(ONE,side,F(k,12));equal(add(choice.amount,choice.remaining),'1')}}
});
test('Cumulative calculation includes only drinks, conserves volume, and follows undo snapshots',()=>{
 let s=M.drink(M.initial(),6),before=s;s=M.refill(s);assert.equal(M.cumulativeCalculation(s).steps.length,1);s=M.drink(s,3);let c=M.cumulativeCalculation(s);equal(c.total,'3/4');equal(c.steps[1].previous,'1/2');equal(c.steps[1].amount,'1/4');equal(add(c.juice,c.water),fmt(c.total));s=before;equal(M.cumulativeCalculation(s).total,'1/2');assert.equal(M.cumulativeCalculation(M.initial()).steps.length,0);
});
function invariant(s){equal(add(s.juice,s.water),fmt(s.volume));equal(add(s.totalJuice,s.juice),'1');equal(add(s.totalWater,s.water),fmt(s.waterAdded));assert(cmp(s.juice,ZERO)>=0);assert(cmp(s.water,ZERO)>=0);assert(cmp(s.volume,ONE)<=0);for(const [j,w] of [[s.juice,s.water],...(s.last?[[s.last.juice,s.last.water]]:[])]){const v=M.visual(j,w);assert(Math.abs(v.height*v.juiceWidth/100-M.percent(j))<1e-8);assert(Math.abs(v.height*v.waterWidth/100-M.percent(w))<1e-8)}}
test('Exact fraction arithmetic, signs, reduction, improper and long fractions',()=>{equal(F(6,8),'3/4');equal(add(F(1,3),F(1,6)),'1/2');equal(sub(ONE,F(7,8)),'1/8');equal(mul(F(3,7),F(7,9)),'1/3');equal(div(F(3,4),F(9,8)),'2/3');equal(F(-2,-4),'1/2');equal(add(ONE,F(1,2)),'3/2');equal(F(1,2n**100n),'1/1267650600228229401496703205376');assert.throws(()=>div(ONE,ZERO))});
for(let k=1;k<=8;k++)test(`Drink ${k}/8 of a fresh cup, exact amount and complementary remaining`,()=>{const s=drinkEighths(M.initial(),k);equal(s.last.amount,fmt(F(k,8)));equal(s.juice,fmt(F(8-k,8)));equal(s.last.water,'0');assert.equal(M.maxTick(s),Math.floor((8-k)*12/8));invariant(s)});
test('Half cup followed by refill and repeated half cups: 1/4 then 1/8 juice',()=>{let s=drinkEighths(M.initial(),4);s=M.refill(s);equal(s.juice,'1/2');equal(s.water,'1/2');s=drinkEighths(s,4);equal(s.last.juice,'1/4');equal(s.last.water,'1/4');equal(s.juice,'1/4');equal(s.water,'1/4');s=drinkEighths(M.refill(s),4);equal(s.last.juice,'1/8');equal(s.last.water,'3/8');invariant(s)});
test('Continuous drinks without refill use current concentration and reject excessive volume',()=>{let s=drinkEighths(M.initial(),3);s=drinkEighths(s,2);equal(s.volume,'3/8');assert.throws(()=>drinkEighths(s,4));s=drinkEighths(s,3);equal(s.volume,'0');assert.equal(M.maxTick(s),0);assert.throws(()=>drinkEighths(s,1));invariant(s)});
test('7/8 drink, refill, then 3/8: normalized widths and actual quantities',()=>{let s=M.refill(drinkEighths(M.initial(),7));s=drinkEighths(s,3);equal(s.last.juice,'3/64');equal(s.last.water,'21/64');equal(s.juice,'5/64');equal(s.water,'35/64');invariant(s)});
test('Empty then refill pure water; latest drink is not accumulated or erased by refill',()=>{let s=drinkEighths(M.initial(),8),last=s.last;s=M.refill(s);assert.equal(s.last,last);equal(s.juice,'0');equal(s.water,'1');s=drinkEighths(s,4);equal(s.last.juice,'0');equal(s.last.water,'1/2');equal(add(s.totalJuice,s.totalWater),'3/2');invariant(s)});
test('Arbitrary many cycles conserve both components; stored snapshots remain independent',()=>{let s=M.initial();const initial=s;for(let i=0;i<160;i++){if(!M.maxTick(s))s=M.refill(s);const k=1+i%Number(s.volume.n*8n/s.volume.d);const before=s;s=drinkEighths(s,k);assert.notEqual(before.log,s.log);equal(add(s.last.juice,s.last.water),fmt(s.last.amount));if(i%3!==1)s=M.refill(s);invariant(s)}equal(initial.juice,'1');assert.equal(initial.log.length,0)});
test('Refill animation geometry keeps the absolute juice area constant at every frame',()=>{const s=drinkEighths(M.refill(drinkEighths(M.initial(),4)),4);for(let i=0;i<=100;i++){const j=s.juice,w=add(s.water,mul(sub(ONE,s.volume),F(i,100))),v=M.visual(j,w);assert(Math.abs(v.height*v.juiceWidth/100-M.percent(j))<1e-8)}});
test('Input domain is finite ticks only, no negative/zero/fractional drink or redundant refill',()=>{for(const k of [0,-1,13,1.5,NaN])assert.throws(()=>M.drink(M.initial(),k));assert.throws(()=>M.refill(M.initial()))});
test('History records all per-action components and after amounts exactly',()=>{const s=M.refill(drinkEighths(M.initial(),3)),d=s.log[0],r=s.log[1];equal(d.afterJuice,'5/8');equal(d.afterWater,'0');equal(r.added,'3/8');equal(r.afterJuice,'5/8');equal(r.afterWater,'3/8')});

test('Dual rulers use complementary real volumes, with whichever side was changed taking priority',()=>{
  for(const [side,k,drink,remain] of [['drink',1,'1/8','7/8'],['drink',3,'3/8','5/8'],['drink',4,'1/2','1/2'],['remain',6,'1/4','3/4'],['remain',2,'3/4','1/4'],['remain',3,'5/8','3/8']]){
    const v=M.selectAmount(ONE,side,F(k,8));equal(v.amount,drink);equal(v.remaining,remain);equal(add(v.amount,v.remaining),'1');
  }
});
test('All pairs of eight ticks obey volume conservation on partial cups',()=>{
  for(let current=0;current<=8;current++)for(let k=0;k<=8;k++)for(const side of ['drink','remain']){
    const v=M.selectAmount(F(current,8),side,F(k,8));equal(add(v.amount,v.remaining),fmt(F(current,8)));assert(cmp(v.amount,F(current,8))<=0);assert(cmp(v.remaining,F(current,8))<=0);
  }
});
test('Ruler orientation, pointer snapping and the two extra zero states are correct',()=>{
  assert.equal(M.rulerPosition('drink',F(1,8),280),35);assert.equal(M.rulerPosition('drink',ONE,280),280);
  assert.equal(M.rulerPosition('remain',ONE,280),0);assert.equal(M.rulerPosition('remain',F(1,8),280),245);
  for(const side of ['drink','remain'])for(const amount of M.rulerChoices(ONE))equal(M.nearestRuler(ONE,side,M.rulerPosition(side,amount,280),280),fmt(amount));
  equal(M.selectAmount(ONE,'drink',ZERO).remaining,'1');equal(M.selectAmount(ONE,'remain',ZERO).amount,'1');
  assert.equal(M.rulerChoices(F(3,8)).length,6);equal(M.nearestRuler(F(3,8),'drink',280,280),'3/8');
});
test('Volumes below 1/8 and off-grid totals are preserved exactly by either ruler',()=>{
  for(const volume of [F(1,16),F(3,32),F(11,32)]){
    const options=M.rulerChoices(volume);equal(options.at(-1),fmt(volume));
    equal(M.selectAmount(volume,'drink',volume).amount,fmt(volume));equal(M.selectAmount(volume,'remain',volume).amount,'0');
    for(const side of ['drink','remain'])equal(M.nearestRuler(volume,side,M.rulerPosition(side,volume,280),280),fmt(volume));
  }
  let s=M.initial();s=M.drinkAmount(s,F(15,16));equal(s.volume,'1/16');s=M.drinkAmount(s,F(1,16));equal(s.volume,'0');invariant(s);
});
test('Exact amount engine handles 1/16, 3/32 and rejects zero/no-op without a history entry',()=>{
  let s=M.refill(drinkEighths(M.initial(),4));s=M.drinkAmount(s,F(3,16));equal(s.last.juice,'3/32');equal(s.last.water,'3/32');equal(s.volume,'13/16');
  const before=s;assert.throws(()=>M.drinkAmount(s,ZERO));assert.equal(s,before);invariant(s);
});
test('Collection keeps an empty cup at zero, but no extra empty cup at exact integers',()=>{
  for(const [amount,count,last] of [[ZERO,1n,'0'],[ONE,1n,'1'],[F(2),2n,'1'],[F(3),3n,'1'],[F(3,4),1n,'3/4'],[F(5,4),2n,'1/4'],[F(9,4),3n,'1/4']]){
    const spec=M.collectionSpec(amount);assert.equal(spec.count,count);equal(M.collectionVolume(amount,count-1n),last);
    let sum=ZERO;for(let index=0n;index<count;index++){const v=M.collectionVolume(amount,index);assert(cmp(v,ONE)<=0);sum=add(sum,v)}equal(sum,fmt(amount));
  }
});
test('Collection supports more than ten cups and large exact counts without allocating an array',()=>{
  assert.equal(M.collectionSpec(F(85,8)).count,11n);equal(M.collectionVolume(F(85,8),10n),'5/8');
  const huge=F(1000000000000000000001n,4);assert.equal(M.collectionSpec(huge).count,250000000000000000001n);equal(M.collectionVolume(huge,250000000000000000000n),'1/4');
});
test('Repeated halves produce 3/4 juice and 1/4 water, while refill leaves collection unchanged',()=>{
  let s=drinkEighths(M.initial(),4),old=s;s=M.refill(s);equal(s.totalJuice,fmt(old.totalJuice));equal(s.totalWater,fmt(old.totalWater));s=drinkEighths(s,4);equal(s.totalJuice,'3/4');equal(s.totalWater,'1/4');invariant(s);
});
test('Adding a second and third water cup can be undone and redone with immutable snapshots',()=>{
  let s=M.refill(drinkEighths(M.initial(),8));s=drinkEighths(s,6);equal(s.totalWater,'3/4');
  s=M.refill(s);const oneCup=s;s=drinkEighths(s,4);const twoCups=s;equal(s.totalWater,'5/4');assert.equal(M.collectionSpec(s.totalWater).count,2n);
  s=oneCup;equal(s.totalWater,'3/4');assert.equal(M.collectionSpec(s.totalWater).count,1n);
  s=twoCups;equal(s.totalWater,'5/4');assert.equal(M.collectionSpec(s.totalWater).count,2n);
  s=drinkEighths(M.refill(s),8);equal(s.totalWater,'9/4');assert.equal(M.collectionSpec(s.totalWater).count,3n);invariant(s);
  s=M.initial();assert.equal(M.collectionSpec(s.totalJuice).count,1n);assert.equal(M.collectionSpec(s.totalWater).count,1n);assert.equal(s.log.length,0);
});
test('Mixed and improper labels are exact, including large fractions',()=>{
  assert.equal(M.mixed(F(9,4)),'2又1/4杯（9/4杯）');assert.equal(M.mixed(F(3)),'3 杯');assert.equal(M.mixed(F(1,16)),'1/16 杯');
});
test('Sub-eighth special positions remain ordered between zero and the first major tick at every viewport height',()=>{
  for(const height of [220,240,280,310,320]){
    const left=[ZERO,F(1,32),F(1,16),F(3,32),F(1,8)].map(f=>M.rulerPosition('drink',f,height));
    const right=[ZERO,F(1,32),F(1,16),F(3,32),F(1,8)].map(f=>M.rulerPosition('remain',f,height));
    assert(left.every((v,i)=>!i||v>left[i-1]));assert(right.every((v,i)=>!i||v<right[i-1]));
  }
});

test('The right thumb exactly follows the cutline even on partial and off-grid cups',()=>{for(const volume of [ONE,F(1,2),F(3,8),F(11,32)])for(const amount of M.rulerChoices(volume)){const remaining=sub(volume,amount);assert(Math.abs(M.rulerPosition('remain',remaining,320)-(1-M.value(remaining))*320)<1e-10)}});
