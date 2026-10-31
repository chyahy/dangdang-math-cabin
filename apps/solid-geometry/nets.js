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
  function prismTree(model,n){
    const links=new Set([`0:${n}`,`0:${n+1}`]);
    for(let i=0;i<n-1;i++)links.add(`${i}:${i+1}`);
    return tree(model,links);
  }
  // Isometric development: material coordinates keep their lengths at every frame.
  // Cylinder: arc-length s becomes an arc of decreasing curvature, ending at x=s.
  // Cone: slant distance u and sector angle beta retain metric du² + u² dBeta².
  function curvedUnfold(kind,dims,amount,segments=96){
    const t=Math.max(0,Math.min(1,amount)),r=dims.r,h=dims.h,l=Math.hypot(r,h),faces=[];
    if(!(r>0&&h>0)||!['cylinder','cone'].includes(kind))throw Error('曲面展开需要正的半径和高度');
    function cylinderPoint(s,y){const k=(1-t)/r;return Math.abs(k)<1e-9?[s,y,r]:[Math.sin(k*s)/k,y,r-2*Math.sin(k*s/2)**2/k]}
    const opening=Math.asin(r/l)+(Math.PI/2-Math.asin(r/l))*t,rho=Math.sin(opening),q=Math.cos(opening);
    function conePoint(u,beta){const phi=beta/rho;return [u*rho*Math.sin(phi),h/2-u*q,u*rho*Math.cos(phi)]}
    const point=kind==='cylinder'?cylinderPoint:conePoint;
    for(let i=0;i<segments;i++){
      const a=-Math.PI+2*Math.PI*i/segments,b=-Math.PI+2*Math.PI*(i+1)/segments;
      let points,normal;
      if(kind==='cylinder'){
        points=[point(r*a,-h/2),point(r*b,-h/2),point(r*b,h/2),point(r*a,h/2)];
        normal=[Math.sin((1-t)*(a+b)/2),0,Math.cos((1-t)*(a+b)/2)];
      }else{
        points=[[0,h/2,0],point(l,r/l*a),point(l,r/l*b)];
        const phi=r/l*(a+b)/2/rho;normal=[q*Math.sin(phi),rho,q*Math.cos(phi)];
      }
      faces.push({group:'side',points,normal});
    }
    // Disk bases are rigid and rotate around a tangent through the retained contact point.
    for(const sign of kind==='cylinder'?[-1,1]:[-1]){
      const pivot=kind==='cylinder'?[0,sign*h/2,r]:point(l,0),angle=kind==='cylinder'?sign*t*Math.PI/2:-t*Math.PI;
      const points=[];
      for(let i=0;i<segments;i++){
        const phi=2*Math.PI*i/segments,relative=[r*Math.sin(phi),0,r*(Math.cos(phi)-1)];
        points.push(add(pivot,axisRotate(relative,[1,0,0],angle)));
      }
      faces.push({group:sign<0?'bottom':'top',points,normal:axisRotate([0,sign,0],[1,0,0],angle),pivot});
    }
    return {kind,amount:t,faces,point,r,h,l,width:2*Math.PI*r,sectorAngle:2*Math.PI*r/l,sideArea:kind==='cylinder'?2*Math.PI*r*h:Math.PI*r*l};
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
    return [...found.values()].sort((a,b)=>a.key===defaultKey?-1:b.key===defaultKey?1:a.key.localeCompare(b.key)).map(n=>({...n,...netOrientation(n.cells)}));
  }
  function netOrientation(cells){
    for(const type of ['1-4-1','2-3-1','2-2-2','3-3'])for(let turn=0;turn<4;turn++){
      const rows=new Map();
      for(let [x,y] of cells){for(let i=0;i<turn;i++)[x,y]=[-y,x];rows.set(y,(rows.get(y)||0)+1)}
      const counts=[...rows].sort((a,b)=>a[0]-b[0]).map(r=>r[1]);
      if(counts.join('-')===type)return {type,turn};
      if(counts.reverse().join('-')===type)return {type,turn:(turn+2)%4};
    }
    throw Error('未识别的正方体展开图');
  }
  function netType(cells){return netOrientation(cells).type}
  function boxNets(model){
    // Classify topology on a unit cube; unfold the actual rectangular faces later.
    const half=[0,1,2].map(i=>Math.max(...model.vertices.map(p=>Math.abs(p[i]))));
    const reference={...model,vertices:model.vertices.map(p=>p.map((v,i)=>v/half[i]))};
    return cubeNets(reference);
  }
  function edgeAxis(model,edge){
    const v=sub(model.vertices[edge.b],model.vertices[edge.a]);
    return v.reduce((axis,x,i)=>Math.abs(x)>Math.abs(v[axis])?i:axis,0);
  }
  function boxFaceName(normal){const axis=normal.reduce((best,x,i)=>Math.abs(x)>Math.abs(normal[best])?i:best,0);return [['左面','右面'],['下面','上面'],['后面','前面']][axis][normal[axis]>0?1:0]}
  root.SolidNets={tree,unfold,polygonArea,surfaceArea,curvedNet,curvedUnfold,prismTree,cubeNets,boxNets,netType,edgeAxis,boxFaceName,sub,cross,dot,unit};
})(globalThis);
