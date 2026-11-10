import {afterEach,describe,expect,it,vi} from 'vitest';
import {BUILTIN_ENTRIES} from './builtin';
import {CUSTOM_PACK_ID,DEFAULT_CUSTOM_ENTRIES,seedCustomQuestions} from './custom';
import {filterEntries,validateEntry} from './questions';
import {DEFAULT_SETTINGS} from '../engine/config';
import {useGame} from '../store';

afterEach(()=>vi.unstubAllGlobals());
describe('网站随附的40道自定义口算题',()=>{
 it('全部精确校验通过，分类为四年级标准数值计算',()=>{
  expect(DEFAULT_CUSTOM_ENTRIES).toHaveLength(40);
  for(const entry of DEFAULT_CUSTOM_ENTRIES){expect(validateEntry(entry).errors,entry.expression).toEqual([]);expect(entry).toMatchObject({grade:'四年级',difficulty:2,type:'calculate'});expect(entry.id.startsWith('builtin-')).toBe(false)}
  const bank=seedCustomQuestions(BUILTIN_ENTRIES,[]).entries;
  expect(filterEntries(bank,{...DEFAULT_SETTINGS,bank:'custom'})).toHaveLength(40);
  expect(filterEntries(bank,{...DEFAULT_SETTINGS,bank:'builtin',grade:'全部'})).toHaveLength(260);
 });
 it('保留已导入的同题及自有题目，不重复添加',()=>{
  const imported={...DEFAULT_CUSTOM_ENTRIES[0],id:'existing-import',explanation:'教师自己的讲解'};
  const other={...DEFAULT_CUSTOM_ENTRIES[0],id:'other',expression:'2+2',answer:'4'};
  const result=seedCustomQuestions([...BUILTIN_ENTRIES,imported,other],[]);
  expect(result.entries).toHaveLength(301);
  expect(result.entries.find(e=>e.id===imported.id)).toEqual(imported);
  expect(result.entries.filter(e=>e.expression===imported.expression&&e.type===imported.type)).toHaveLength(1);
  expect(result.entries).toContain(other);
 });
 it('安装后删除或修改的题目不会在刷新时被重新加入',()=>{
  const seeded=seedCustomQuestions(BUILTIN_ENTRIES,[]);
  const edited=seeded.entries.filter(e=>e.id!==DEFAULT_CUSTOM_ENTRIES[0].id).map(e=>e.id===DEFAULT_CUSTOM_ENTRIES[1].id?{...e,expression:'2+2',answer:'4'}:e);
  expect(seedCustomQuestions(edited,seeded.appliedPacks)).toEqual({entries:edited,appliedPacks:[CUSTOM_PACK_ID],changed:false});
 });
 it('新浏览器自动安装、保存，后续清空和设置可以保留',async()=>{
  const data=new Map<string,string>();
  vi.stubGlobal('indexedDB',undefined);
  vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});
  await useGame.getState().load();
  expect(useGame.getState().entries).toHaveLength(300);
  expect(JSON.parse(data.get('math-kingdom:questionPacks')!)).toEqual([CUSTOM_PACK_ID]);
  await useGame.getState().saveEntries([]);
  await useGame.getState().saveSettings({...DEFAULT_SETTINGS,bank:'custom',duration:180});
  await useGame.getState().load();
  expect(useGame.getState().entries).toEqual([]);
  expect(useGame.getState().settings).toMatchObject({bank:'custom',duration:180});
 });
 it('旧浏览器已有40题时升级后仍只有40道自定义题',async()=>{
  const existing=DEFAULT_CUSTOM_ENTRIES.map((e,i)=>({...e,id:`imported-${i}`}));
  const data=new Map([['math-kingdom:entries',JSON.stringify([...BUILTIN_ENTRIES,...existing])]]);
  vi.stubGlobal('indexedDB',undefined);
  vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});
  await useGame.getState().load();
  expect(useGame.getState().entries).toHaveLength(300);
  expect(useGame.getState().entries.filter(e=>e.id.startsWith('imported-'))).toHaveLength(40);
 });
});
