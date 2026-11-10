import {describe,expect,it} from 'vitest';
import {createMatch,finish,pause,resume,summon,tick} from './game';
import {DEFAULT_SETTINGS,FIXED_STEP,STATS,TOWER,WORLD} from './config';
import {BUILTIN_ENTRIES} from '../questions/builtin';
import type {Match,Team} from './types';
function match(){const m=createMatch(BUILTIN_ENTRIES,DEFAULT_SETTINGS,7);m.phase='RUNNING';return m}
function step(m:Match,seconds:number){for(let i=0;i<Math.ceil(seconds/FIXED_STEP);i++)tick(m)}
function target(m:Match,team:Team,x:number,kind:'soldier'|'archer'|'knight'='soldier'){
 summon(m,team,kind);const u=m.units.at(-1)!;u.x=x;u.cooldown=100;u.state='hurt';u.stateUntil=100;return u;
}
describe('双方箭塔自动防守',()=>{
 it('没有敌人或只有友军时不射击、不消耗金币',()=>{
  const m=match();target(m,'red',WORLD.left+100);step(m,2);
  expect(m.events.filter(e=>e.type==='tower')).toHaveLength(0);
  expect(m.players.red.coins).toBe(0);expect(m.players.red.earned).toBe(0);
 });
 it('射程外不锁定，进入边界后射击最近存活敌人',()=>{
  const m=match(),far=target(m,'blue',WORLD.left+TOWER.range+1);
  tick(m);expect(m.projectiles).toHaveLength(0);
  far.x=WORLD.left+TOWER.range;
  const close=target(m,'blue',WORLD.left+200);
  const dead=target(m,'blue',WORLD.left+100);dead.deathAt=m.elapsed;dead.state='death';dead.hp=0;
  tick(m);expect(m.projectiles).toHaveLength(1);
  expect(m.projectiles[0]).toMatchObject({team:'red',source:'tower',targetId:close.id,targetCastle:null,castleDamage:0});
 });
 it.each(['red','blue'] as Team[])('%s箭塔弹道命中后才扣血，护甲真实生效',team=>{
  const m=match(),opponent=team==='red'?'blue':'red',x=team==='red'?WORLD.left+300:WORLD.right-300;
  const u=target(m,opponent,x,'knight');tick(m);
  expect(u.hp).toBe(STATS.knight.hp);expect(m.projectiles[0].team).toBe(team);
  step(m,.6);expect(u.hp).toBe(STATS.knight.hp-(TOWER.damage-STATS.knight.armor));
  expect(m.players[team].earned).toBe(0);expect(m.players[opponent].hp).toBe(150);
 });
 it('每1.5秒最多一箭，死亡目标的在途箭不会转移伤害',()=>{
  const m=match(),u=target(m,'blue',WORLD.left+400);tick(m);step(m,1);
  expect(m.events.filter(e=>e.type==='tower')).toHaveLength(1);
  step(m,.5);expect(m.events.filter(e=>e.type==='tower')).toHaveLength(2);
  u.hp=0;u.deathAt=m.elapsed;u.state='death';const other=target(m,'blue',WORLD.left+410);
  step(m,.1);expect(m.projectiles.some(p=>p.targetId===u.id)).toBe(false);expect(other.hp).toBe(other.maxHp);
 });
 it('红蓝镜像攻击效果一致',()=>{
  const m=match(),red=target(m,'red',WORLD.right-300,'knight'),blue=target(m,'blue',WORLD.left+300,'knight');
  step(m,5);expect(red.hp).toBe(blue.hp);expect(red.hp).toBeLessThan(red.maxHp);
  expect(m.events.filter(e=>e.type==='tower'&&e.team==='red').length).toBe(m.events.filter(e=>e.type==='tower'&&e.team==='blue').length);
 });
 it('暂停与结束冻结箭塔冷却及弹道，新局重置',()=>{
  const m=match();target(m,'blue',WORLD.left+300);tick(m);pause(m);
  const snapshot=JSON.stringify(m);step(m,2);expect(JSON.stringify(m)).toBe(snapshot);
  resume(m);step(m,.2);expect(m.towers.red.cooldown).toBeLessThan(TOWER.interval);
  finish(m,'测试结束');const ended=JSON.stringify(m);step(m,2);expect(JSON.stringify(m)).toBe(ended);
  const n=match();expect(n.towers.red).toEqual({cooldown:0,attackAt:-10});expect(n.projectiles).toEqual([]);
 });
 it('已摧毁的塔不攻击，倒计时期间不攻击',()=>{
  const m=match();target(m,'blue',WORLD.left+100);m.players.red.hp=0;tick(m);expect(m.events.some(e=>e.type==='tower')).toBe(false);
  const n=createMatch(BUILTIN_ENTRIES,DEFAULT_SETTINGS,7);target(n,'blue',WORLD.left+100);tick(n);expect(n.projectiles).toHaveLength(0);
 });
});
