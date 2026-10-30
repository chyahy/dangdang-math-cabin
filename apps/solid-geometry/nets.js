/* Exact face-hinge unfolding for convex polyhedra. No geometry is scaled or stretched. */
(function(root){
  'use strict';
  const sub=(a,b)=>a.map((v,i)=>v-b[i]), add=(a,b)=>a.map((v,i)=>v+b[i]);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=v=>{const l=Math.hypot(...v);return v.map(n=>n/l)};
  function axisRotate(v,axis,angle){
    const c=Math.cos(angle),s=Math.sin(angle),d=dot(axis,v),k=cross(axis,v);
    return v.map((n,i)=>n*c+k[i]*s+axis[i]*d*(1-c));
  }
  function polygonArea(vertices){let area=0;for(let i=1;i<vertices.length-1;i++)area+=Math.hypot(...cross(sub(vertices[i],vertices[0]),sub(vertices[i+1],vertices[0])))/2;return area}
  function tree(model,allowed=null){
    const {vertices,faces,normals}=model;
    let rootFace=0,lowest=Infinity;
    faces.forEach((f,i)=>{const y=f.reduce((s,v)=>s+vertices[v][1]/f.length,0);if(y<lowest){lowest=y;rootFace=i}});
    const adjacency=faces.map(()=>[]),edges=new Map();
    faces.forEach((f,fi)=>f.forEach((a,i)=>{
      const b=f[(i+1)%f.length],key=[Math.min(a,b),Math.max(a,b)].join(':');
      if(edges.has(key)){const p=edges.get(key);if(!allowed||allowed.has([fi,p.face].sort((a,b)=>a-b).join(':'))){adjacency[fi].push({face:p.face,a,b});adjacency[p.face].push({face:fi,a,b})}}
      else edges.set(key,{face:fi,a,b});
    }));
    const nodes=Array(faces.length).fill(null),queue=[rootFace];nodes[rootFace]={parent:-1,root:true,angle:0};
    for(let i=0;i<queue.length;i++){
      const parent=queue[i];
      for(const e of adjacency[parent])if(!nodes[e.face]){
        const axis=unit(sub(vertices[e.b],vertices[e.a]));
        const nc=normals[e.face],np=normals[parent];
        nodes[e.face]={parent,a:e.a,b:e.b,axis,angle:Math.atan2(dot(axis,cross(nc,np)),Math.max(-1,Math.min(1,dot(nc,np))))};
        queue.push(e.face);
      }
    }
    if(queue.length!==faces.length)throw new Error('图形的各个面必须连通。');
    return {rootFace,nodes,order:queue};
  }
  function unfold(model,amount,topology=tree(model)){
    amount=Math.max(0,Math.min(1,amount));
    function transform(point,face){
      let p=[...point],n=topology.nodes[face];
      while(n.parent!==-1){const origin=model.vertices[n.a];p=add(origin,axisRotate(sub(p,origin),n.axis,n.angle*amount));n=topology.nodes[n.parent]}
      return p;
    }
    return {rootFace:topology.rootFace,faces:model.faces.map((f,i)=>({id:i,points:f.map(v=>transform(model.vertices[v],i)),normal:unit(cross(sub(transform(model.vertices[f[1]],i),transform(model.vertices[f[0]],i)),sub(transform(model.vertices[f[2]],i),transform(model.vertices[f[0]],i))))})),hinges:topology.order.filter(i=>topology.nodes[i].parent!==-1).map(i=>{const n=topology.nodes[i];return {a:transform(model.vertices[n.a],i),b:transform(model.vertices[n.b],i),face:i,parent:n.parent}})};
  }
  function surfaceArea(model){return model.faces.reduce((s,f)=>s+polygonArea(f.map(i=>model.vertices[i])),0)}
  function curvedNet(kind,dims){
    const r=dims.r,h=dims.h;
    if(kind==='cylinder')return {kind,r,h,width:2*Math.PI*r,height:h+4*r,area:2*Math.PI*r*(r+h)};
    if(kind==='cone'){const l=Math.hypot(r,h),angle=2*Math.PI*r/l;return {kind,r,h,l,angle,degrees:angle*180/Math.PI,area:Math.PI*r*(r+l)}}
    return null;
  }
  function cubeNets(model){
    const links=model.edges.map(e=>[...e.faces].sort((a,b)=>a-b).join(':'));
    const length=Math.hypot(...sub(model.vertices[model.faces[0][0]],model.vertices[model.faces[0][1]]));
    function cellsFor(t){const net=unfold(model,1,t),centers=net.faces.map(f=>f.points.reduce((s,p)=>s.map((v,i)=>v+p[i]/f.points.length),[0,0,0])),origin=centers[t.rootFace];return centers.map(p=>[Math.round((p[0]-origin[0])/length),Math.round((p[2]-origin[2])/length)])}
    function keyFor(cells){const variants=[];for(const mirror of [-1,1])for(let turn=0;turn<4;turn++){const pts=cells.map(([x,y])=>{x*=mirror;for(let i=0;i<turn;i++)[x,y]=[-y,x];return [x,y]}),minX=Math.min(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1]));variants.push(pts.map(([x,y])=>[x-minX,y-minY]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(p=>p.join(',')).join(';'))}return variants.sort()[0]}
    const found=new Map(),defaultKey=keyFor(cellsFor(tree(model)));
    function choose(start,selected){
      if(selected.length===5){
        let t;try{t=tree(model,new Set(selected))}catch{return}
        const cells=cellsFor(t);if(new Set(cells.map(p=>p.join(','))).size!==6)return;
        const key=keyFor(cells);if(!found.has(key))found.set(key,{topology:t,cells,key});return;
      }
      for(let i=start;i<=links.length-(5-selected.length);i++)choose(i+1,[...selected,links[i]]);
    }
    choose(0,[]);
    return [...found.values()].sort((a,b)=>a.key===defaultKey?-1:b.key===defaultKey?1:a.key.localeCompare(b.key));
  }
  root.SolidNets={tree,unfold,polygonArea,surfaceArea,curvedNet,cubeNets,sub,cross,dot,unit};
})(globalThis);
