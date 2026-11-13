import {describe,it,expect} from 'vitest';
import {GRADE1_CUSTOM_ENTRIES,GRADE1_PACK_ID,GRADE1_DIFFICULTY_REVISION,CUSTOM_PACK_ID,DEFAULT_CUSTOM_ENTRIES,seedCustomQuestions} from './custom';
import {validateEntry,filterEntries,makeDeck} from './questions';
import originalGradeOne from './custom-grade1-add-sub-v1.json';
import type {Entry} from '../engine/types';
import {DEFAULT_SETTINGS} from '../engine/config';
describe('一年级50以内加减法自定义题包',()=>{
 it('100道独立题目，加减各50，全部答案精确且无超纲',()=>{
  expect(GRADE1_CUSTOM_ENTRIES).toHaveLength(100);expect(new Set(GRADE1_CUSTOM_ENTRIES.map(e=>e.expression)).size).toBe(100);
  let small=0;for(const e of GRADE1_CUSTOM_ENTRIES){expect(e).toMatchObject({grade:'一年级',type:'calculate'});expect(e.id.startsWith('builtin-')).toBe(false);expect(validateEntry(e).errors,e.expression).toEqual([]);const match=e.expression.match(/^(\d+)([+-])(\d+)$/)!;expect(match).toBeTruthy();const a=+match[1],b=+match[3],answer=+e.answer;expect(Math.max(a,b,answer)).toBeLessThanOrEqual(50);expect(answer).toBeGreaterThanOrEqual(0);if(a<=20&&b<=20&&answer<=20)small++}
  expect(GRADE1_CUSTOM_ENTRIES.filter(e=>e.expression.includes('+'))).toHaveLength(50);expect(small).toBeGreaterThanOrEqual(80);
 });
 it('已有四年级包的浏览器仍自动加入新包，不重复旧题，也不会复活用户删掉的新题',()=>{
  const migrated=seedCustomQuestions(DEFAULT_CUSTOM_ENTRIES,[CUSTOM_PACK_ID]);expect(migrated.entries).toHaveLength(140);expect(migrated.appliedPacks).toEqual([CUSTOM_PACK_ID,GRADE1_PACK_ID,GRADE1_DIFFICULTY_REVISION]);
  const edited=migrated.entries.filter(e=>e.id!==GRADE1_CUSTOM_ENTRIES[0].id);expect(seedCustomQuestions(edited,migrated.appliedPacks)).toMatchObject({entries:edited,changed:false});
 });
 it('一年级、自定义、直接计算筛选恰好100题，整轮不会重复',()=>{
  const s={...DEFAULT_SETTINGS,grade:'一年级',bank:'custom' as const,difficulty:0,weights:{calculate:1,missing:0,method:0,fraction:0}};
  expect(filterEntries(seedCustomQuestions([],[]).entries,s)).toHaveLength(100);const deck=makeDeck(seedCustomQuestions([],[]).entries,s,7);expect(new Set(deck.map(e=>e.id)).size).toBe(100);
 });
 it('三档题量为60、30、10，筛选对应现有档位',()=>{
  const bank=seedCustomQuestions([],[]).entries;
  for(const [difficulty,count] of [[1,60],[2,30],[3,10]])expect(filterEntries(bank,{...DEFAULT_SETTINGS,grade:'一年级',bank:'custom',difficulty})).toHaveLength(count);
 });
 it('旧版100题原位升级且保留教师修改、导入和删除，不增加重复题',()=>{
  const old=structuredClone(originalGradeOne) as Entry[];
  const migrated=seedCustomQuestions(old,[CUSTOM_PACK_ID,GRADE1_PACK_ID]);
  expect(migrated.entries).toEqual(GRADE1_CUSTOM_ENTRIES);expect(migrated.entries).toHaveLength(100);
  const edited={...old[20],explanation:'老师自己的提示'};
  const imported={...old[28],id:'teacher-import'};
  const source=[...old.filter(e=>e.id!==old[30].id).map(e=>e.id===edited.id?edited:e),imported];
  const result=seedCustomQuestions(source,[CUSTOM_PACK_ID,GRADE1_PACK_ID]);
  expect(result.entries).toHaveLength(100);expect(result.entries).toContainEqual(edited);expect(result.entries).toContainEqual(imported);
  expect(result.entries.some(e=>e.id===old[30].id)).toBe(false);
  expect(result.entries.find(e=>e.id===old[28].id)?.difficulty).toBe(3);
  expect(seedCustomQuestions(result.entries,result.appliedPacks).changed).toBe(false);
 });
 it('拒绝一年级乘除、分数、负数和超过50的运算',()=>{
  for(const [expression,answer] of [['2*3','6'],['2/2','1'],['1-3','-2'],['49+2','51'],['60-10','50']])expect(validateEntry({...GRADE1_CUSTOM_ENTRIES[0],expression,answer}).errors.length).toBeGreaterThan(0);
 });
});
