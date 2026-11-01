(() => {
  const script=document.currentScript;
  if(!script || location.protocol==='file:')return;
  const root=new URL('../',script.src),cabin=new URL('cabin.html',root);
  // In the gallery player the parent toolbar owns navigation. Standalone games return to the cabin.
  if(window.top!==window.self)return;
  function fixLinks(){
    for(const anchor of document.querySelectorAll('a[href]')){
      const url=new URL(anchor.href);
      if(url.origin===root.origin && [root.pathname,new URL('index.html',root).pathname].includes(url.pathname))anchor.href=cabin.href;
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fixLinks);else fixLinks();
  addEventListener('pageshow',fixLinks);
  // React games can render their header after DOMContentLoaded; handle their links at click time too.
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a[href]');if(!anchor || anchor.target==='_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
    const url=new URL(anchor.href);
    if(url.origin===root.origin && [root.pathname,new URL('index.html',root).pathname].includes(url.pathname)){event.preventDefault();location.href=cabin.href}
  },true);
})();
