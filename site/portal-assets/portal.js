import {GAMES} from './catalog.js?v=2026.11.12.1';

const ROOT = new URL('../', import.meta.url);
const page = document.body.dataset.page;
if(page==='entry'){
  const video=document.getElementById('entry-background-video'),backdrop=document.querySelector('.entry-video-backdrop'),toggle=document.getElementById('background-toggle');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let wantsMotion=true,started=false,playAttempt=0;
  function staticBackground(){wantsMotion=false;playAttempt++;video.pause();backdrop.classList.remove('is-playing');toggle.textContent='切换动态背景'}
  function playBackground(){
    if(!wantsMotion || document.hidden || reduced.matches || navigator.connection?.saveData)return;
    video.muted=true;
    if(!video.hasAttribute('src'))video.src=new URL(video.dataset.src,ROOT).href;
    const attempt=++playAttempt;
    video.play()?.catch(error=>{if(attempt!==playAttempt || document.hidden || error.name==='AbortError')return;staticBackground();toggle.hidden=false});
  }
  video.addEventListener('playing',()=>{
    if(!wantsMotion || reduced.matches || document.hidden){video.pause();return}
    backdrop.classList.add('is-playing');toggle.hidden=false;toggle.textContent='切换静态背景';
  });
  video.addEventListener('error',()=>{staticBackground();toggle.hidden=true});
  toggle.addEventListener('click',()=>{if(wantsMotion)staticBackground();else{wantsMotion=true;playBackground()}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){playAttempt++;video.pause()}else if(started)playBackground()});
  addEventListener('pagehide',()=>{playAttempt++;video.pause()});
  addEventListener('pageshow',()=>{if(started)playBackground()});
  reduced.addEventListener('change',()=>{if(reduced.matches){staticBackground();toggle.hidden=true}});
  function start(){started=true;playBackground()}
  if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});
}
if(page==='games'){
  const filters=[...document.querySelectorAll('[data-filter]')];
  const cards=[...document.querySelectorAll('[data-category]')];
  function select(category,updateHistory=false){
    if(!['all','numbers','geometry','language'].includes(category))category='all';
    filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===category)));
    let count=0;cards.forEach(card=>{
      card.hidden=category!=='all' && card.dataset.category!==category;if(!card.hidden)count++;
      const link=card.querySelector('a'),url=new URL(link.href);if(category==='all')url.searchParams.delete('category');else url.searchParams.set('category',category);link.href=url.href;
    });
    document.getElementById('filter-status').textContent=`显示${count}个${category==='numbers'?'数与运算':category==='geometry'?'图形与几何':category==='language'?'英语词汇':'课堂'}游戏`;
    if(updateHistory){const url=new URL(location.href);if(category==='all')url.searchParams.delete('category');else url.searchParams.set('category',category);history.replaceState(null,'',url)}
  }
  filters.forEach(button=>button.addEventListener('click',()=>select(button.dataset.filter,true)));
  select(new URL(location.href).searchParams.get('category')||'all');
  addEventListener('pageshow',()=>select(new URL(location.href).searchParams.get('category')||'all'));
}

if(page==='play'){
  const game=GAMES.find(game=>game.id===new URL(location.href).searchParams.get('game'));
  const frame=document.getElementById('game-frame'),invalid=document.getElementById('invalid-game'),loading=document.getElementById('game-loading');
  const category=new URL(location.href).searchParams.get('category'),galleryBack=new URL('games/',ROOT);
  if(['numbers','geometry','language'].includes(category))galleryBack.searchParams.set('category',category);
  document.querySelector('.play-back').href=galleryBack.href;
  if(!game){frame.hidden=true;loading.hidden=true;invalid.hidden=false;document.title='选择一个游戏｜当当老师'}
  else{
    document.title=game.title+'｜当当老师';
    document.getElementById('playing-title').textContent=game.title;
    document.getElementById('open-game').href=new URL(game.path,ROOT).href;
    frame.title=game.title;
    frame.addEventListener('load',()=>{
      loading.hidden=true;
      // Older games return to their original home. Keep that action in the gallery flow.
      try{
        const win=frame.contentWindow,doc=frame.contentDocument;
        const target=new URL(win.location.href);
        const homes=[ROOT.pathname,new URL('index.html',ROOT).pathname,new URL('cabin.html',ROOT).pathname];
        if(target.origin===ROOT.origin && homes.includes(target.pathname)){location.href=galleryBack.href;return}
        for(const anchor of doc.querySelectorAll('a[href]')){
          const url=new URL(anchor.href);
          if(url.origin===ROOT.origin && homes.includes(url.pathname)){
            anchor.dataset.portalBack='true';anchor.href=galleryBack.href;anchor.setAttribute('aria-label','返回游戏广场');
            if(anchor.matches('#backHome,.home-link,.room-back,.cabin-return,.cabin-link,.back'))anchor.textContent='← 返回游戏广场';
          }
        }
        doc.addEventListener('click',event=>{
          const anchor=event.target.closest?.('a[href]');if(!anchor || anchor.target==='_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
          const url=new URL(anchor.href);
          if(anchor.dataset.portalBack || (url.origin===ROOT.origin && homes.includes(url.pathname))){event.preventDefault();event.stopPropagation();location.href=galleryBack.href}
        },true);
      }catch{/* The permanent parent toolbar is still available for external content. */}
    });
    frame.src=new URL(game.path,ROOT).href;
  }
}
