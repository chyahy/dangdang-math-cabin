import {useEffect,useRef,useState} from 'react';
import {load,serialize,type Document} from './model';
export function useHistory(){
 const [doc,setDoc]=useState(load),current=useRef(doc),past=useRef<Document[]>([]),future=useRef<Document[]>([]),before=useRef<Document|null>(null),[,refresh]=useState(0);
 const put=(next:Document,record=true)=>{if(serialize(next)===serialize(current.current))return;if(record){past.current=[...past.current,current.current].slice(-80);future.current=[]}current.current=next;setDoc(next);refresh(n=>n+1)};
 const begin=()=>{if(!before.current)before.current=current.current};
 const end=()=>{if(before.current&&serialize(before.current)!==serialize(current.current)){past.current=[...past.current,before.current].slice(-80);future.current=[];refresh(n=>n+1)}before.current=null};
 const undo=()=>{const previous=past.current.pop();if(!previous)return;future.current.push(current.current);before.current=null;put(previous,false)};
 const redo=()=>{const next=future.current.pop();if(!next)return;past.current.push(current.current);before.current=null;put(next,false)};
 useEffect(()=>{const timer=setTimeout(()=>{try{localStorage.setItem('dangdang-number-line-v1',serialize(doc))}catch{}},250);return()=>clearTimeout(timer)},[doc]);
 return {doc,current,put,begin,end,undo,redo,canUndo:past.current.length>0,canRedo:future.current.length>0};
}
