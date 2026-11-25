import {useState} from 'react';
import {BookOpen,ChevronRight,X} from 'lucide-react';
import {categories,videoProofs} from './proofRegistry';
import {palette} from './ProofScene';
import {camera} from './geometry.mjs';
import {lessons} from './lessons';
type Props={onChoose:(id:string)=>void;onClose:()=>void;extensions:boolean;setExtensions:(enabled:boolean)=>void};
const legacy=lessons.map(l=>({...l,principle:l.subtitle,extension:l.id==='similarity'}));

function Thumbnail({proof}:{proof:typeof videoProofs[number]}){
 const g=proof.build?.(3,4);
 let shapes:{points:{x:number;y:number}[];color:string}[]=[];
 if(g&&'originals' in g)shapes=g.originals.slice(0,4);
 else if(g&&'original' in g)shapes=[{points:g.original,color:'tri'}];
 if(!shapes.length)shapes=[{points:[{x:0,y:0},{x:3,y:0},{x:0,y:4}],color:'tri'},{points:[{x:3,y:0},{x:0,y:4},{x:4,y:7},{x:7,y:3}],color:'c'}];
 const fit=camera(shapes.flatMap(s=>s.points),{x:6,y:6,w:68,h:52}).map;
 return <svg viewBox="0 0 80 64" aria-hidden="true">{shapes.map((s,i)=><polygon key={i} points={s.points.map(fit).map(p=>p.x+','+p.y).join(' ')} stroke={palette[s.color]} strokeWidth="1.25" fill={palette[s.color]} fillOpacity=".17"/>)}</svg>;
}
export function ProofGallery({onChoose,onClose,extensions,setExtensions}:Props){
 const [category,setCategory]=useState(-1);
 const show=(i:number)=>category===-1||category===i;
 return <dialog open className="proof-gallery" aria-labelledby="proof-gallery-title" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose()}}}>
  <header><div><BookOpen size={18}/><h2 id="proof-gallery-title">证明方法总览</h2></div><button onClick={onClose} autoFocus aria-label="关闭总览"><X size={22}/></button></header>
  <div className="gallery-filters">
   <button className={category===-1?'active':''} onClick={()=>setCategory(-1)}>全部</button>
   {categories.map((name,i)=><button key={name} className={category===i?'active':''} onClick={()=>setCategory(i)}>{name}</button>)}
   <label><input type="checkbox" checked={extensions} onChange={e=>setExtensions(e.target.checked)}/> 显示拓展证明</label>
  </div>
  <div className="proof-catalog">
   {categories.map((name,i)=>{
    const visible=videoProofs.filter(p=>p.category===i&&(!p.extension||extensions));
    if(!show(i)||!visible.length&&i!==4)return null;
    return <section key={name}><h3>{name}</h3><div className="proof-cards">
     {visible.map(p=><button key={p.id} className="proof-card" data-video-proof={p.number} onClick={()=>onChoose(p.id)}>
      <Thumbnail proof={p}/><span><small>证明 {String(p.number).padStart(2,'0')} · {p.time}</small><strong>{p.name}</strong><span>{p.principle}</span></span><ChevronRight size={16}/>
     </button>)}
     {i===4&&[...legacy.filter(l=>extensions||!l.extension),{id:'free',name:'自由实验',principle:'拖动、调整角度、比较两种拼法'}].map(l=><button className="proof-card legacy-proof" key={l.id} onClick={()=>onChoose(l.id)}>
      <span><strong>{l.name}</strong><span>{l.principle}</span></span><ChevronRight size={16}/>
     </button>)}
    </div></section>
   })}
   {!extensions&&category===3&&<p className="teacher-note">打开「显示拓展证明」即可查看本分类。</p>}
  </div>
 </dialog>;
}
