import {create} from 'zustand';import type {Entry,Kind,Match,RecordEntry,Settings,Team} from './engine/types';import {DEFAULT_SETTINGS} from './engine/config';import {choose,createMatch,inputKey,pause,purchase,resume,submit,tick,upgradeCastle} from './engine/game';import {BUILTIN_ENTRIES} from './questions/builtin';import {validateEntry} from './questions/questions';import {readLocal,writeLocal,writeLocalBatch} from './storage/db';import {DEFAULT_CUSTOM_ENTRIES,seedCustomQuestions} from './questions/custom';
type Screen='menu'|'game'|'bank'|'settings'|'history'|'help';
type State={ready:boolean;entries:Entry[];settings:Settings;history:RecordEntry[];match:Match|null;revision:number;notice:string;screen:Screen;setScreen:(s:Screen)=>void;load:()=>Promise<void>;saveEntries:(e:Entry[])=>Promise<void>;saveSettings:(s:Settings)=>Promise<void>;start:()=>void;step:(dt:number)=>void;key:(t:Team,k:string)=>void;choose:(t:Team,id:string)=>void;buy:(t:Team,k:Kind)=>void;upgrade:(t:Team)=>void;answer:(t:Team,id:string,skip?:boolean)=>void;pause:()=>void;resume:()=>void;note:(s:string)=>void};
export const useGame=create<State>((set,get)=>{const update=()=>set(s=>({revision:s.revision+1}));return {
 ready:false,entries:[...BUILTIN_ENTRIES,...DEFAULT_CUSTOM_ENTRIES],settings:structuredClone(DEFAULT_SETTINGS),history:[],match:null,revision:0,notice:'',screen:'menu',setScreen:screen=>set({screen}),note:notice=>set({notice}),
 load:async()=>{
  const [bank,s,h,packs]=await Promise.all([readLocal<Entry[]>('entries',BUILTIN_ENTRIES),readLocal<Settings>('settings',DEFAULT_SETTINGS),readLocal<RecordEntry[]>('history',[]),readLocal<string[]>('questionPacks',[])]);
  const valid=Array.isArray(bank)?bank.filter(e=>!validateEntry(e).errors.length):BUILTIN_ENTRIES;
  const seeded=seedCustomQuestions(valid,Array.isArray(packs)?packs.filter(p=>typeof p==='string'):[]);
  let notice='';
  if(seeded.changed)try{await writeLocalBatch([['entries',seeded.entries],['questionPacks',seeded.appliedPacks]])}catch{notice='40道口算题已加载，但未能保存到此浏览器。请检查本地存储。'}
  const settings={...DEFAULT_SETTINGS,...s,weights:{...DEFAULT_SETTINGS.weights,...s.weights}};
  if(![120,180,240,300].includes(settings.duration))settings.duration=240;
  if(!settings.autoOrder?.length||settings.autoOrder.some(k=>!['soldier','archer','knight','mage'].includes(k)))settings.autoOrder=['soldier','archer','knight'];
  set({ready:true,entries:seeded.entries,settings,history:Array.isArray(h)?h.slice(0,50):[],notice});
 },
 saveEntries:async entries=>{try{await writeLocal('entries',entries);set({entries})}catch{get().note('题库保存失败，请检查浏览器本地存储。')}},saveSettings:async settings=>{try{await writeLocal('settings',settings);set({settings})}catch{get().note('设置保存失败。')}},
 start:()=>{try{set({match:createMatch(get().entries,get().settings),screen:'game',revision:0,notice:''})}catch(e){get().note((e as Error).message)}},
 step:dt=>{const m=get().match;if(!m)return;const previous=m.phase;tick(m,dt);if(m.phase==='FINISHED'&&!m.resultSaved){m.resultSaved=true;const result:RecordEntry={id:m.id,date:new Date().toISOString(),winner:m.winner==='draw'?'平局':m.winner==='red'?m.settings.redName:m.settings.blueName,reason:m.reason,duration:m.elapsed,redName:m.settings.redName,blueName:m.settings.blueName,players:structuredClone(m.players)},history=[result,...get().history].slice(0,50);set({history});void writeLocal('history',history).catch(()=>get().note('本局完成，但战绩未能保存到浏览器。'))}if((m.phase!=='PAUSED'&&m.phase!=='FINISHED')||previous!==m.phase)update()},
 key:(t,k)=>{const m=get().match;if(m){inputKey(m,t,k);update()}},choose:(t,id)=>{const m=get().match;if(m){choose(m,t,id);update()}},buy:(t,k)=>{const m=get().match;if(m){purchase(m,t,k);update()}},upgrade:t=>{const m=get().match;if(m){upgradeCastle(m,t);update()}},answer:(t,id,skip)=>{const m=get().match;if(m){submit(m,t,id,skip);update()}},pause:()=>{if(get().match){pause(get().match!);update()}},resume:()=>{if(get().match){resume(get().match!);update()}}
}});
