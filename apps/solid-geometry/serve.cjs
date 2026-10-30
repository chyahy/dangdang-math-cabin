const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../../site');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.pdf':'application/pdf','.ico':'image/x-icon'};
function createServer(){return http.createServer(async(req,res)=>{try{
const url=new URL(req.url,'http://localhost'),relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),candidate=path.resolve(root,relative);
if(candidate!==root&&!candidate.startsWith(root+path.sep)){res.writeHead(403).end();return}
const stat=await fs.stat(candidate),file=stat.isDirectory()?path.join(candidate,'index.html'):candidate;
const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
}catch{res.writeHead(404).end('Not found')}})}
module.exports={createServer};
if(require.main===module){createServer().listen(4186,'127.0.0.1',()=>console.log('http://127.0.0.1:4186/solid-geometry/'))}
