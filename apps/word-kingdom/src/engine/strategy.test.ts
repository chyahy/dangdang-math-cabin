import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMatch,finish,pause,purchase,reward,submit,summon,tick} from './game';
import {CASTLE_LEVELS,DEFAULT_SETTINGS,FIXED_STEP,FROST,MAX_UNITS,PRICES,STATS,TOWER} from './config';
import * as math from '../../../math-kingdom/src/engine/config';
import {BUILTIN_WORDS} from '../questions/words';
import {filterWords} from '../questions/questions';
const match=()=>{const m=createMatch(BUILTIN_WORDS,DEFAULT_SETTINGS,23);m.phase='RUNNING';return m};
afterEach(()=>vi.unstubAllGlobals());
describe('数学与英语版策略功能一致',()=>{
 it('四兵种、50金币法师、护甲、冰冻、箭塔和升级参数完全一致',()=>{
  expect(PRICES).toEqual(math.PRICES);expect(PRICES.mage).toBe(50);expect(PRICES.knight).toBe(100);
  expect(STATS).toEqual(math.STATS);expect(FROST).toEqual(math.FROST);expect(TOWER).toEqual(math.TOWER);expect(CASTLE_LEVELS).toEqual(math.CASTLE_LEVELS);expect(MAX_UNITS).toBe(math.MAX_UNITS);
 });
 it.each([1,2,3])('难度%s奖励15/20/30，每3连击额外5，无直接召唤',difficulty=>{
  const m=match();m.players.red.question!.entry={...m.players.red.question!.entry,difficulty};
  for(let i=0;i<3;i++)reward(m,'red');expect(m.players.red.earned).toBe([0,15,20,30][difficulty]*3+5);expect(m.players.blue.earned).toBe(0);expect(m.units).toHaveLength(0);
 });
 it('购买扣本队金币，快速重复点击与上限不重扣，暂停/结束不能购买',()=>{
  const m=match();m.players.red.coins=100;expect(purchase(m,'red','mage')).toBe(true);expect(purchase(m,'red','mage')).toBe(false);expect(m.players.red.coins).toBe(50);expect(m.players.blue.coins).toBe(0);
  for(let i=1;i<MAX_UNITS/2;i++)summon(m,'red','soldier');tick(m,.3);expect(purchase(m,'red','mage')).toBe(false);expect(m.players.red.coins).toBe(50);
  pause(m);expect(purchase(m,'blue','soldier')).toBe(false);finish(m,'测试结束');expect(purchase(m,'red','soldier')).toBe(false);
 });
 it('无可用题型时明确报错',()=>expect(()=>createMatch(BUILTIN_WORDS,{...DEFAULT_SETTINGS,weights:{spell:0,meaning:0,missing:0}})).toThrow('至少启用'));
 it('时间到依次比较生命、累计金币、正确率，剩余金币不参与',()=>{
  for(const mode of ['hp','earned','accuracy','draw']){const m=match();if(mode==='hp')m.players.red.hp=149;if(mode==='earned'){m.players.red.earned=40;m.players.blue.coins=1000}if(mode==='accuracy'){m.players.red.correct=1;m.players.blue.wrong=1}m.elapsed=m.settings.duration-.01;tick(m,FIXED_STEP);expect(m.winner).toBe(mode==='draw'?'draw':mode==='hp'?'blue':'red');const snapshot=JSON.stringify(m);tick(m);expect(JSON.stringify(m)).toBe(snapshot);expect(submit(m,'red',m.players.red.question!.id)).toBeNull()}
 });
 it('旧设备词库、60秒设置和旧战绩保留，新策略设置自动补齐，数学存储不被覆盖',async()=>{
  const custom={...BUILTIN_WORDS[0],id:'my-word',word:'lemon',meaning:'柠檬',segments:['le','mon']};
  const {deployment,autoOrder,...oldSettings}=DEFAULT_SETTINGS;
  const oldRecord={id:'old',date:'2026-11-01',redName:'红队',blueName:'蓝队',players:{red:{hp:100},blue:{hp:90}}};
  const data=new Map([['word-kingdom:words',JSON.stringify([...BUILTIN_WORDS,custom])],['word-kingdom:settings',JSON.stringify({...oldSettings,duration:60,bank:'custom'})],['word-kingdom:history',JSON.stringify([oldRecord])],['math-kingdom:settings','math untouched']]);
  vi.stubGlobal('indexedDB',undefined);vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});
  const {useGame}=await import('../store');await useGame.getState().load();const state=useGame.getState();expect(state.words).toHaveLength(73);expect(state.history).toEqual([oldRecord]);expect(state.settings).toMatchObject({duration:60,bank:'custom',deployment:'strategy',autoOrder:['soldier','archer','knight']});expect(filterWords(state.words,state.settings).map(w=>w.id)).toEqual(['my-word']);await state.saveSettings({...state.settings,autoOrder:['mage','knight','archer']});expect(data.get('math-kingdom:settings')).toBe('math untouched');
  await useGame.getState().saveWords([]);await useGame.getState().load();expect(useGame.getState().words).toEqual([]);
 });
});
