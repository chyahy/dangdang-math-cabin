import type {Entry} from '../engine/types';
import questions from './custom-mental-multiplication.json';
import {entryKey} from '../storage/import';

export const CUSTOM_PACK_ID='mental-multiplication-40-v1';
export const DEFAULT_CUSTOM_ENTRIES:Entry[]=questions as Entry[];

/** Install once per browser; preserve imported copies, edits and later deletions. */
export function seedCustomQuestions(entries:Entry[],appliedPacks:string[]){
 if(appliedPacks.includes(CUSTOM_PACK_ID))return {entries,appliedPacks,changed:false};
 const seen=new Set(entries.map(entryKey));
 const additions=DEFAULT_CUSTOM_ENTRIES.filter(e=>{const key=entryKey(e);if(seen.has(key))return false;seen.add(key);return true});
 return {entries:[...entries,...structuredClone(additions)],appliedPacks:[...appliedPacks,CUSTOM_PACK_ID],changed:true};
}
