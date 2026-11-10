import {describe,expect,it,vi} from 'vitest';
import {createMatch,pause,purchase,resume,summon,tick} from './game';
import {DEFAULT_SETTINGS,FIXED_STEP,LIGHTNING,PRICES,STATS,WORLD} from './config';
import {BUILTIN_WORDS} from '../questions/words';
import type {Kind,Match,Team} from './types';
function match(){const m=createMatch(BUILTIN_WORDS,DEFAULT_SETTINGS,17);m.phase='RUNNING';return m}
function step(m:Match,seconds:number){for(let i=0;i<Math.ceil(seconds/FIXED_STEP);i++)tick(m)}
function unit(m:Match,team:Team,kind:Kind,x:number,waiting=true){summon(m,team,kind);const u=m.units.at(-1)!;u.x=x;if(waiting){u.cooldown=100;u.state='hurt';u.stateUntil=100}return u}
describe('当当老师 · 200金币连锁雷电',()=>{
 it('199金币不足，200金币独立购买，快速重复点击不重复扣款',()=>{
  const m=match();m.players.red.coins=199;expect(purchase(m,'red','teacher')).toBe(false);expect(m.players.red.coins).toBe(199);
  m.players.red.coins=400;expect(purchase(m,'red','teacher')).toBe(true);expect(purchase(m,'red','teacher')).toBe(false);
  expect(m.players.red).toMatchObject({coins:200,spent:200,purchases:{teacher:1}});expect(m.players.blue.purchases.teacher).toBe(0);expect(PRICES.teacher).toBe(200);
 });
 it.each(['red','blue'] as Team[])('%s施法有前摇，命中最近目标并最多连锁3人，护甲减伤',team=>{
  const m=match(),other=team==='red'?'blue':'red',dir=team==='red'?1:-1,origin=team==='red'?800:1120;
  const caster=unit(m,team,'teacher',origin,false);caster.cooldown=0;
  const foes=[250,280,310,370,400].map(dx=>unit(m,other,'knight',origin+dir*dx));
  const friend=unit(m,team,'knight',origin+dir*260);
  tick(m);expect(m.spells).toHaveLength(1);expect(foes.every(u=>u.hp===u.maxHp)).toBe(true);expect(m.events.some(e=>e.type==='lightning')).toBe(false);
  step(m,LIGHTNING.castDelay);expect(m.spells).toHaveLength(0);expect(foes.map(u=>u.maxHp-u.hp)).toEqual([31,18,18,0,0]);expect(friend.hp).toBe(friend.maxHp);
  expect(m.events.filter(e=>e.type==='lightning')).toHaveLength(3);expect(m.players[other].hp).toBe(150);
 });
 it('范围外不开始施法，走近后锁定；连锁不跨越125单位',()=>{
  const m=match(),caster=unit(m,'red','teacher',800,false);caster.cooldown=0;
  const foe=unit(m,'blue','knight',800+STATS.teacher.range+10);tick(m);expect(m.spells).toHaveLength(0);
  foe.x=caster.x+300;const far=unit(m,'blue','knight',foe.x+LIGHTNING.radius+1);tick(m);step(m,.2);expect(foe.hp).toBeLessThan(foe.maxHp);expect(far.hp).toBe(far.maxHp);
 });
 it('每2.6秒一次，不因持续瞄准而每帧攻击',()=>{
  const m=match(),caster=unit(m,'red','teacher',800,false);caster.cooldown=0;unit(m,'blue','knight',1050);
  step(m,2.6);expect(m.events.filter(e=>e.type==='lightning')).toHaveLength(1);step(m,.3);expect(m.events.filter(e=>e.type==='lightning')).toHaveLength(2);
 });
 it.each(['caster','target'])('前摇中%s阵亡取消，不转移到其他人',who=>{
  const m=match(),caster=unit(m,'red','teacher',800,false);caster.cooldown=0;const target=unit(m,'blue','knight',1050),other=unit(m,'blue','knight',1100);tick(m);
  const dead=who==='caster'?caster:target;dead.hp=0;dead.deathAt=m.elapsed;dead.state='death';step(m,.3);
  expect(m.spells).toHaveLength(0);expect(m.events.some(e=>e.type==='lightning')).toBe(false);expect(other.hp).toBe(other.maxHp);
 });
 it('暂停冻结前摇，结束不再攻击，新局无旧法术',()=>{
  const m=match(),caster=unit(m,'red','teacher',800,false);caster.cooldown=0;const target=unit(m,'blue','knight',1050);tick(m);pause(m);
  const snapshot=JSON.stringify(m);step(m,3);expect(JSON.stringify(m)).toBe(snapshot);resume(m);step(m,.2);expect(target.hp).toBe(89);
  m.phase='FINISHED';const ended=JSON.stringify(m);step(m,4);expect(JSON.stringify(m)).toBe(ended);expect(match().spells).toEqual([]);
 });
 it('同一时刻完成的雷击同时结算，不因队伍遍历顺序取消另一方',()=>{
  const m=match(),red=unit(m,'red','teacher',800,false),blue=unit(m,'blue','teacher',1100,false);red.hp=blue.hp=30;red.cooldown=blue.cooldown=0;
  step(m,.25);expect(red.hp).toBe(0);expect(blue.hp).toBe(0);expect(m.events.filter(e=>e.type==='lightning')).toHaveLength(2);
 });
 it('无人防守时对城堡造成18伤害，雷电不生成箭矢或奖励金币',()=>{
  const m=match(),caster=unit(m,'red','teacher',WORLD.right-350,false);caster.cooldown=0;step(m,.25);
  expect(m.players.blue.hp).toBe(132);expect(m.players.red.coins).toBe(0);expect(m.projectiles.some(p=>p.team==='red')).toBe(false);
 });
 it('自动购买与设置保存支持当当老师',async()=>{
  const m=match();m.settings.deployment='auto';m.settings.autoOrder=['teacher'];m.players.blue.coins=200;tick(m);expect(m.players.blue.coins).toBe(0);expect(m.units[0].kind).toBe('teacher');
  const data=new Map<string,string>();vi.stubGlobal('indexedDB',undefined);vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});
  try{const {useGame}=await import('../store');await useGame.getState().saveSettings({...DEFAULT_SETTINGS,autoOrder:['teacher','mage','knight']});await useGame.getState().load();expect(useGame.getState().settings.autoOrder).toEqual(['teacher','mage','knight'])}finally{vi.unstubAllGlobals()}
 });
});
