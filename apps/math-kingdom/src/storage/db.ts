let opening:Promise<IDBDatabase>|null=null;
function open(){if(!opening)opening=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('dangdang-math-kingdom',1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});return opening}
export async function readLocal<T>(key:string,fallback:T):Promise<T>{try{const db=await open();return await new Promise<T>((resolve,reject)=>{const tx=db.transaction('kv','readonly'),req=tx.objectStore('kv').get(key);req.onsuccess=()=>resolve(req.result??fallback);req.onerror=()=>reject(req.error)})}catch{try{return JSON.parse(localStorage.getItem('math-kingdom:'+key)||'null')??fallback}catch{return fallback}}}
export async function writeLocal(key:string,value:unknown){await writeLocalBatch([[key,value]])}
export async function writeLocalBatch(values:[string,unknown][]){try{const db=await open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite');for(const [key,value] of values)tx.objectStore('kv').put(structuredClone(value),key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}catch{for(const [key,value] of values)localStorage.setItem('math-kingdom:'+key,JSON.stringify(value))}}

export function download(name:string,content:BlobPart,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
const csvCell=(s:unknown)=>'"'+String(s??'').replaceAll('"','""')+'"';
export const csv=(rows:unknown[][])=>'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
export function errorCSV(errors:import('../engine/types').Mistake[]){return csv([['question','answer','submitted','topic','count','skipped'],...errors.map(e=>[e.prompt,e.answer,e.submitted,e.topic,e.count,e.skipped])])}
