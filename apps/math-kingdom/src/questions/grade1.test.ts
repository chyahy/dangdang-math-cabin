import {describe,it,expect} from 'vitest';
import {GRADE1_CUSTOM_ENTRIES,GRADE1_PACK_ID,CUSTOM_PACK_ID,DEFAULT_CUSTOM_ENTRIES,seedCustomQuestions} from './custom';
import {validateEntry,filterEntries,makeDeck} from './questions';
import {DEFAULT_SETTINGS} from '../engine/config';
describe('一年级50以内加减法自定义题包',()=>{
 it('100道独立题目，加减各50，全部答案精确且简单无超纲',()=>{
  expect(GRADE1_CUSTOM_ENTRIES).toHaveLength(100);expect(new Set(GRADE1_CUSTOM_ENTRIES.map(e=>e.expression)).size).toBe(100);
  let small=0;for(const e of GRADE1_CUSTOM_ENTRIES){expect(e).toMatchObject({grade:'一年级',type:'calculate',difficulty:1});expect(e.id.startsWith('builtin-')).toBe(false);expect(validateEntry(e).errors,e.expression).toEqual([]);const match=e.expression.match(/^(\d+)([+-])(\d+)$/)!;expect(match).toBeTruthy();const a=+match[1],b=+match[3],answer=+e.answer;expect(Math.max(a,b,answer)).toBeLessThanOrEqual(50);expect(answer).toBeGreaterThanOrEqual(0);if(a<=20&&b<=20&&answer<=20)small++}
  expect(GRADE1_CUSTOM_ENTRIES.filter(e=>e.expression.includes('+'))).toHaveLength(50);expect(small).toBeGreaterThanOrEqual(80);
 });
 it('已有四年级包的浏览器仍自动加入新包，不重复旧题，也不会复活用户删掉的新题',()=>{
  const migrated=seedCustomQuestions(DEFAULT_CUSTOM_ENTRIES,[CUSTOM_PACK_ID]);expect(migrated.entries).toHaveLength(140);expect(migrated.appliedPacks).toEqual([CUSTOM_PACK_ID,GRADE1_PACK_ID]);
  const edited=migrated.entries.filter(e=>e.id!==GRADE1_CUSTOM_ENTRIES[0].id);expect(seedCustomQuestions(edited,migrated.appliedPacks)).toMatchObject({entries:edited,changed:false});
 });
 it('一年级、自定义、直接计算筛选恰好100题，整轮不会重复',()=>{
  const s={...DEFAULT_SETTINGS,grade:'一年级',bank:'custom' as const,difficulty:1,weights:{calculate:1,missing:0,method:0,fraction:0}};
  expect(filterEntries(seedCustomQuestions([],[]).entries,s)).toHaveLength(100);const deck=makeDeck(seedCustomQuestions([],[]).entries,s,7);expect(new Set(deck.map(e=>e.id)).size).toBe(100);
 });
 it('拒绝一年级乘除、分数、负数和超过50的运算',()=>{
  for(const [expression,answer] of [['2*3','6'],['2/2','1'],['1-3','-2'],['49+2','51'],['60-10','50']])expect(validateEntry({...GRADE1_CUSTOM_ENTRIES[0],expression,answer}).errors.length).toBeGreaterThan(0);
 });
});
