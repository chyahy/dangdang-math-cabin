import {describe,expect,it,vi} from 'vitest';
import {createMatch,finish,movementSpeed,pause,purchase,resume,summon,tick,upgradeCastle} from './game';
import {CASTLE_LEVELS,DEFAULT_SETTINGS,FIXED_STEP,FROST,PRICES,STATS,WORLD} from './config';
import {BUILTIN_ENTRIES} from '../questions/builtin';
import type {Match,Team} from './types';
function match(){const m=createMatch(BUILTIN_ENTRIES,DEFAULT_SETTINGS,7);m.phase='RUNNING';return m}
function step(m:Match,seconds:number){for(let i=0;i<Math.ceil(seconds/FIXED_STEP);i++)tick(m)}
function fighter(m:Match,team:Team,kind:'mage'|'knight'|'soldier',x:number){summon(m,team,kind);const u=m.units.at(-1)!;u.x=x;return u}
describe('冰冻法师',()=>{
 it('50金币购买，金币不足不扣款，双方独立',()=>{
  const m=match();m.players.red.coins=49;expect(purchase(m,'red','mage')).toBe(false);expect(m.players.red.coins).toBe(49);
  m.players.red.coins=50;expect(purchase(m,'red','mage')).toBe(true);expect(m.players.red.coins).toBe(0);expect(m.players.red.purchases.mage).toBe(1);expect(m.players.blue.purchases.mage).toBe(0);
 });
 it.each(['red','blue'] as Team[])('%s法师命中后才减速，护甲正确减伤',team=>{
  const m=match(),opponent=team==='red'?'blue':'red';
  const mage=fighter(m,team,'mage',team==='red'?800:1100),foe=fighter(m,opponent,'knight',team==='red'?1050:850);foe.cooldown=100;
  step(m,.25);expect(m.projectiles.some(p=>p.effect==='frost')).toBe(true);expect(foe.slowUntil).toBe(0);expect(foe.hp).toBe(foe.maxHp);
  step(m,.5);expect(foe.hp).toBe(foe.maxHp-(STATS.mage.damage-STATS.knight.armor));
  expect(foe.slowUntil).toBeGreaterThan(m.elapsed);expect(movementSpeed(foe,m.elapsed)).toBeCloseTo(STATS.knight.speed*.55);expect(mage.slowUntil).toBe(0);
 });
 it('减速作用于实际位移，到期恢复，经过0点时间也正常',()=>{
  const m=match(),u=fighter(m,'red','soldier',800);u.slowUntil=1;
  const start=u.x;step(m,.5);expect(u.x-start).toBeCloseTo(STATS.soldier.speed*FROST.speedMultiplier*.5,5);
  step(m,.6);expect(movementSpeed(u,m.elapsed)).toBe(STATS.soldier.speed);
  const before=u.x;tick(m);expect(u.x-before).toBeCloseTo(STATS.soldier.speed*FIXED_STEP);
 });
 it('重复命中延长时间，不叠加减速倍率；暂停冻结剩余时间',()=>{
  const m=match(),mage=fighter(m,'red','mage',800),foe=fighter(m,'blue','knight',1050);foe.state='hurt';foe.stateUntil=100;foe.cooldown=100;
  step(m,.8);const first=foe.slowUntil;expect(first).toBeGreaterThan(m.elapsed);
  step(m,2);expect(foe.slowUntil).toBeGreaterThan(first);expect(movementSpeed(foe,m.elapsed)).toBeCloseTo(STATS.knight.speed*.55);
  pause(m);const snapshot=JSON.stringify(m);step(m,5);expect(JSON.stringify(m)).toBe(snapshot);resume(m);mage.cooldown=100;step(m,3.5);expect(movementSpeed(foe,m.elapsed)).toBe(STATS.knight.speed);
 });
 it('死亡目标不产生减速或转移伤害，城堡只受到伤害',()=>{
  const m=match();fighter(m,'red','mage',800);const foe=fighter(m,'blue','soldier',1050);step(m,.25);foe.hp=0;foe.deathAt=m.elapsed;foe.state='death';step(m,.5);expect(foe.slowUntil).toBe(0);expect(m.projectiles).toHaveLength(0);
  const n=match();fighter(n,'red','mage',WORLD.right-200);step(n,.8);expect(n.players.blue.hp).toBe(150-STATS.mage.castleDamage);expect(n.players.blue.castleLevel).toBe(1);
 });
 it('自动出兵可以选择冰冻法师',()=>{
  const m=match();m.settings.deployment='auto';m.settings.autoOrder=['mage'];m.players.blue.coins=PRICES.mage;tick(m);expect(m.units[0]).toMatchObject({team:'blue',kind:'mage'});expect(m.players.blue.coins).toBe(0);
 });
});
describe('城堡升级',()=>{
 it('按100/160金币升级至3级，生命仅恢复新增值，满级不扣钱',()=>{
  const m=match(),p=m.players.red;p.coins=300;p.hp=90;
  expect(upgradeCastle(m,'red')).toBe(true);expect(p).toMatchObject({coins:200,spent:100,hp:160,maxHp:220,castleLevel:2});
  expect(upgradeCastle(m,'red')).toBe(false);expect(p.coins).toBe(200);
  step(m,.4);expect(upgradeCastle(m,'red')).toBe(true);expect(p).toMatchObject({coins:40,spent:260,hp:240,maxHp:300,castleLevel:3});
  p.coins=1000;expect(upgradeCastle(m,'red')).toBe(false);expect(p.coins).toBe(1000);expect(m.players.blue).toMatchObject({hp:150,maxHp:150,castleLevel:1});
 });
 it('金币不足、暂停、倒计时、结束与摧毁都不能升级',()=>{
  const m=match();m.players.red.coins=99;expect(upgradeCastle(m,'red')).toBe(false);expect(m.players.red.coins).toBe(99);
  m.players.red.coins=1000;for(const phase of ['PAUSED','COUNTDOWN','FINISHED'] as const){m.phase=phase;expect(upgradeCastle(m,'red')).toBe(false)}
  m.phase='RUNNING';m.players.red.hp=0;expect(upgradeCastle(m,'red')).toBe(false);expect(m.players.red.coins).toBe(1000);
 });
 it.each([2,3])('Lv.%s实际提升箭塔射程、伤害及冷却',level=>{
  const m=match();m.players.red.coins=1000;upgradeCastle(m,'red');if(level===3){step(m,.4);upgradeCastle(m,'red')}
  const stats=CASTLE_LEVELS[level-1],foe=fighter(m,'blue','knight',WORLD.left+stats.range-1);foe.state='hurt';foe.stateUntil=100;foe.cooldown=100;
  tick(m);expect(m.projectiles[0]).toMatchObject({source:'tower',damage:stats.damage,targetId:foe.id});expect(m.towers.red.cooldown).toBe(stats.interval);
  step(m,1);expect(foe.hp).toBe(foe.maxHp-(stats.damage-STATS.knight.armor));
 });
 it('升级不会改变已经发射箭矢的伤害',()=>{
  const m=match(),foe=fighter(m,'blue','knight',WORLD.left+350);foe.state='hurt';foe.stateUntil=100;
  tick(m);expect(m.projectiles[0].damage).toBe(12);m.players.red.coins=100;upgradeCastle(m,'red');
  expect(m.projectiles[0].damage).toBe(12);step(m,.7);expect(foe.hp).toBe(foe.maxHp-7);
 });
 it('升级不立即重置射击冷却，自动出兵模式也允许手动升级',()=>{
  const m=match();m.settings.deployment='auto';m.players.red.coins=300;m.towers.red.cooldown=.6;
  expect(upgradeCastle(m,'red')).toBe(true);expect(m.towers.red.cooldown).toBe(.6);expect(m.players.red.earned).toBe(0);
 });
 it('新局重置城堡等级，结束后保留真实升级和法师战绩',()=>{
  const m=match();m.players.red.coins=200;upgradeCastle(m,'red');purchase(m,'red','mage');finish(m,'时间结束');
  expect(m.players.red.castleLevel).toBe(2);expect(m.players.red.purchases.mage).toBe(1);const n=match();expect(n.players.red).toMatchObject({castleLevel:1,maxHp:150,hp:150,purchases:{mage:0}});
 });
 it('本机自动购买顺序保存后仍允许法师',async()=>{
  const data=new Map<string,string>();vi.stubGlobal('indexedDB',undefined);vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});
  try{const {useGame}=await import('../store');await useGame.getState().saveSettings({...DEFAULT_SETTINGS,autoOrder:['mage','knight','archer']});await useGame.getState().load();expect(useGame.getState().settings.autoOrder).toEqual(['mage','knight','archer'])}finally{vi.unstubAllGlobals()}
 });
});
