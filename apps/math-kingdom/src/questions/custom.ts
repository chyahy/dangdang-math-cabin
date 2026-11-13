import type {Entry} from '../engine/types';
import questions from './custom-mental-multiplication.json';
import gradeOne from './custom-grade1-add-sub.json';
import gradeOneV1 from './custom-grade1-add-sub-v1.json';
import {entryKey} from '../storage/import';

export const CUSTOM_PACK_ID='mental-multiplication-40-v1';
export const DEFAULT_CUSTOM_ENTRIES:Entry[]=questions as Entry[];

export const GRADE1_PACK_ID='grade1-add-sub-50-100-v1';
export const GRADE1_DIFFICULTY_REVISION='grade1-add-sub-difficulty-v2';
export const GRADE1_CUSTOM_ENTRIES:Entry[]=gradeOne as Entry[];
export const ALL_CUSTOM_ENTRIES:Entry[]=[...DEFAULT_CUSTOM_ENTRIES,...GRADE1_CUSTOM_ENTRIES];

/** Each published pack installs independently, preserving user edits, imports and deletions. */
export function seedCustomQuestions(entries:Entry[],appliedPacks:string[]){
 const pending=[{id:CUSTOM_PACK_ID,entries:DEFAULT_CUSTOM_ENTRIES},{id:GRADE1_PACK_ID,entries:GRADE1_CUSTOM_ENTRIES}].filter(p=>!appliedPacks.includes(p.id));
 const revise=!appliedPacks.includes(GRADE1_DIFFICULTY_REVISION);
 if(!pending.length&&!revise)return {entries,appliedPacks,changed:false};
 // Update only untouched supplied questions. Keep teacher edits, imports and deletions.
 const signature=(e:Entry)=>JSON.stringify([entryKey(e),e.answer,e.topic,e.difficulty,e.options,e.explanation,e.context||'']);
 const originals=new Map((gradeOneV1 as Entry[]).map(e=>[e.id,signature(e)]));
 const replacements=new Map(GRADE1_CUSTOM_ENTRIES.map(e=>[e.id,e]));
 if(revise)entries=entries.map(e=>originals.get(e.id)===signature(e)?structuredClone(replacements.get(e.id)!):e);
 const seen=new Set(entries.map(entryKey)),additions:Entry[]=[];
 for(const pack of pending)for(const entry of pack.entries){const key=entryKey(entry);if(seen.has(key))continue;seen.add(key);additions.push(entry)}
 return {entries:[...entries,...structuredClone(additions)],appliedPacks:[...appliedPacks,...pending.map(p=>p.id),...(revise?[GRADE1_DIFFICULTY_REVISION]:[])],changed:true};
}
