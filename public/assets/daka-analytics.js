(function(){
  if (window.__dakaAnalyticsLoaded) return;
  window.__dakaAnalyticsLoaded = true;
  function authUser(){try{return window.currentAuthUser||null}catch(_){return null}}
  function send(type,data){
    try{
      const user=authUser();
      const payload={type,path:location.pathname,domain:location.hostname,title:document.title,userId:user&&user.id||null,email:user&&user.email||null,data:data||{},ts:Date.now()};
      const body=JSON.stringify(payload);
      if(navigator.sendBeacon){navigator.sendBeacon('/api/track',new Blob([body],{type:'application/json'}));return;}
      fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(function(){});
    }catch(_){}
  }
  window.dakaTrackEvent=send;
  send('page_view');
  document.addEventListener('click',function(e){
    const el=e.target.closest('a,button,[data-track]');
    if(!el)return;
    send('click',{text:(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,120),id:el.id||null,href:el.href||null,track:el.dataset&&el.dataset.track||null});
  },true);
  document.addEventListener('submit',function(e){send('form_submit',{id:e.target&&e.target.id||null});},true);
  addEventListener('pagehide',function(){send('page_exit',{scrollY:scrollY,viewport:{w:innerWidth,h:innerHeight}})});
})();