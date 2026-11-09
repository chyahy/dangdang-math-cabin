import type {Card,Question,QuestionType,Settings,Word} from '../engine/types';
export function rng(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function shuffle<T>(items:T[],random:()=>number){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export const normalize=(s:string)=>s.trim().toLowerCase();
export function splitWord(word:string):string[]{const size=word.length>12?3:word.length>6?2:1;const out=[];for(let i=0;i<word.length;i+=size)out.push(word.slice(i,i+size));return out}
export function filterWords(words:Word[],s:Settings){return words.filter(w=>(s.bank==='all'||(s.bank==='builtin'?w.id.startsWith('builtin-'):!w.id.startsWith('builtin-')))&&(s.grade==='全部'||w.grade===s.grade)&&(s.unit==='全部'||w.unit===s.unit)&&(!s.difficulty||w.difficulty===s.difficulty))}
export function typesFor(s:Settings,seed:number):QuestionType[]{const types:QuestionType[]=[];for(const type of ['spell','meaning','missing'] as QuestionType[])for(let n=0;n<Math.round(s.weights[type]/5);n++)types.push(type);return shuffle(types.length?types:['spell'],rng(seed))}
export function makeQuestion(word:Word,pool:Word[],type:QuestionType,index:number,cycle:number,seed:number,team:string):Question {
 const random=rng(seed+index*191+cycle*3571),id=`${team}:${cycle}:${index}:${word.id}:${type}`;
 let text:string[]=[],answer=word.word,prompt=word.meaning,missingIndex:number|undefined;
 if(type==='spell'){
  const parts=word.segments.length?word.segments:splitWord(word.word);const candidates=['a','e','i','o','u','ar','er','th','ch','sh'];
  const distractors=word.distractors.length?word.distractors.slice(0,Math.max(0,12-parts.length)):shuffle(candidates.filter(c=>!parts.includes(c)),random).slice(0,Math.min(2,12-parts.length));text=[...parts,...distractors];
 }else if(type==='meaning'){
  prompt=word.word;answer=word.meaning;
  const ordered=[...shuffle(pool.filter(w=>w.id!==word.id&&w.unit===word.unit&&w.grade===word.grade),random),...shuffle(pool.filter(w=>w.id!==word.id&&w.grade===word.grade),random),...shuffle(pool.filter(w=>w.id!==word.id),random)];
  text=[word.meaning,...[...new Set(ordered.map(w=>w.meaning))].filter(m=>m!==word.meaning).slice(0,3)];
  // A tiny imported bank remains playable: omit this question type rather than fabricate translations.
  if(text.length<2)return makeQuestion(word,pool,'spell',index,cycle,seed,team);
 }else{
  missingIndex=Math.floor(random()*word.word.length);answer=word.word[missingIndex];prompt=word.word.slice(0,missingIndex)+'＿'+word.word.slice(missingIndex+1);
  const vowels='aeiou',alphabet=vowels.includes(answer.toLowerCase())?vowels:'bcdfghjklmnprstvw';text=[answer,...shuffle([...alphabet].filter(c=>normalize(c)!==normalize(answer)),random).slice(0,3)];
 }
 const options:Card[]=shuffle(text.map((text,i)=>({id:`${id}:card:${i}`,text})),rng(seed+index*977+cycle*31+(team==='blue'?8301:201)));
 return {id,entry:word,type,prompt,options,answer,missingIndex,cycle};
}
export function judge(question:Question,selected:string[]):boolean {
 if(new Set(selected).size!==selected.length)return false;
 const chosen=selected.map(id=>question.options.find(c=>c.id===id));if(chosen.some(c=>!c)||!chosen.length)return false;
 if(question.type==='meaning')return chosen.length===1&&chosen[0]!.text===question.entry.meaning;
 const word=normalize(chosen.map(c=>c!.text).join(''));
 return question.type==='missing'?chosen.length===1&&word===normalize(question.answer):[question.entry.word,...question.entry.acceptedAnswers].some(a=>normalize(a)===word);
}
export function validateWord(raw:Partial<Word>):{word:Word|null;errors:string[]} {
 const errors:string[]=[],word=String(raw.word??'').trim(),meaning=String(raw.meaning??'').trim();
 const arr=(a:unknown)=>Array.isArray(a)?a.map(String).map(s=>s.trim()).filter(Boolean):typeof a==='string'?a.split(/[|；;]/).map(s=>s.trim()).filter(Boolean):[];
 const segments=arr(raw.segments),distractors=arr(raw.distractors),acceptedAnswers=arr(raw.acceptedAnswers),difficulty=Number(raw.difficulty??1);
 if(!/^[a-z]+(?:[-'][a-z]+)*$/i.test(word)||word.length>20)errors.push('英文应为20字母以内的单词，可含连字符或撇号');
 if(!meaning||meaning.length>45)errors.push('请填写45字以内的中文释义');
 if(!String(raw.grade??'').trim())errors.push('请填写年级');if(!String(raw.unit??'').trim())errors.push('请填写单元');
 if(![1,2,3].includes(difficulty))errors.push('难度只能是1、2或3');
 if(segments.length&&(normalize(segments.join(''))!==normalize(word)||segments.length>8))errors.push('拆分必须完整还原单词，且不超过8块');
 if([...segments,...distractors].some(s=>s.length>8||!/^[a-z'-]+$/i.test(s)))errors.push('字母块只允许英文字母，单块不超过8个字符');
 if(acceptedAnswers.some(s=>!/^[a-z]+(?:[-'][a-z]+)*$/i.test(s)))errors.push('可接受答案必须是有效英文单词');
 return {errors,word:errors.length?null:{id:raw.id||crypto.randomUUID(),word,meaning,grade:String(raw.grade).trim(),unit:String(raw.unit).trim(),difficulty,segments,distractors,acceptedAnswers}};
}
