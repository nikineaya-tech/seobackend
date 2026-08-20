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

  function ready(fn){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function forceTab(tabName, options){
    const key=String(tabName||'').trim();
    const target=document.getElementById(key+'Tab');
    if(!key||!target)return null;
    document.querySelectorAll('.tab-content').forEach(function(tab){
      tab.classList.remove('active');
      tab.setAttribute('aria-hidden','true');
      tab.style.display='none';
    });
    document.querySelectorAll('.nav-btn').forEach(function(btn){
      btn.classList.toggle('active',btn.getAttribute('data-tab')===key);
      btn.setAttribute('aria-selected',btn.getAttribute('data-tab')===key?'true':'false');
    });
    target.classList.add('active');
    target.setAttribute('aria-hidden','false');
    target.style.display='block';
    try{ if(window.STATE) window.STATE.currentTab=key; }catch(_){}
    if(!options||options.scroll!==false){
      setTimeout(function(){(document.querySelector('main')||target).scrollIntoView({behavior:'smooth',block:'start'});},30);
    }
    return target;
  }

  function installTabFallback(){
    if(window.__dakaTabFallbackBound)return;
    window.__dakaTabFallbackBound=true;
    window.dakaForceTab=forceTab;
    document.addEventListener('click',function(e){
      const btn=e.target&&e.target.closest?e.target.closest('.nav-btn[data-tab]'):null;
      if(!btn)return;
      const tab=btn.getAttribute('data-tab');
      setTimeout(function(){
        const target=document.getElementById(tab+'Tab');
        if(!target)return;
        const hidden=getComputedStyle(target).display==='none'||!target.classList.contains('active');
        if(hidden) forceTab(tab,{scroll:true});
      },60);
    },true);
  }

  function installLibraryFullscreen(){
    if(document.getElementById('daka-library-hotfix-style'))return;
    const style=document.createElement('style');
    style.id='daka-library-hotfix-style';
    style.textContent='.daka-library-viewer:fullscreen{background:#020617!important;overflow:auto!important;padding:0!important}.daka-library-viewer:fullscreen .daka-library-toolbar{top:0!important}.daka-library-viewer:fullscreen .daka-library-canvas-wrap{max-height:calc(100vh - 112px)!important}.daka-library-viewer:fullscreen #dakaLibraryCanvas{max-width:min(100%,1200px)!important}.daka-library-fullscreen-btn{white-space:nowrap}';
    document.head.appendChild(style);
  }

  function ensureLibraryFullscreenButton(){
    installLibraryFullscreen();
    const toolbar=document.querySelector('.daka-library-toolbar');
    if(!toolbar||document.getElementById('dakaLibraryFullscreen'))return;
    const btn=document.createElement('button');
    btn.id='dakaLibraryFullscreen';
    btn.type='button';
    btn.className='btn btn-secondary daka-library-fullscreen-btn';
    btn.innerHTML='<i class="fas fa-expand"></i><span data-i18n="library_fullscreen">Plein écran</span>';
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      const viewer=document.getElementById('dakaLibraryViewer')||toolbar.closest('.daka-library-viewer')||toolbar.parentElement;
      if(!viewer)return;
      if(document.fullscreenElement){document.exitFullscreen&&document.exitFullscreen();return;}
      if(viewer.requestFullscreen)viewer.requestFullscreen().catch(function(){});
    });
    const close=document.getElementById('dakaLibraryClose');
    if(close&&close.parentElement===toolbar) toolbar.insertBefore(btn,close);
    else toolbar.appendChild(btn);
  }

  function normalizeReportType(type){
    const value=String(type||'').toLowerCase().trim().replace(/[\s_]+/g,'-');
    if(['competitor','competition','competitor-analysis','competitors-analysis'].includes(value))return'competitors';
    if(['seo','audit','technical-seo','technical-audit','site-audit'].includes(value))return'technical';
    if(['keyword','keyword-research','market-demand'].includes(value))return'keywords';
    if(['stp','persona','personas','segmentation','targeting','positioning','stp-persona','stp-analysis'].includes(value))return'stp';
    return value;
  }

  function installStpReportOpenPatch(){
    if(window.__dakaStpReportOpenPatch)return true;
    if(typeof window.displaySavedReport!=='function'||typeof window.getSavedReport!=='function')return false;
    const original=window.displaySavedReport;
    window.displaySavedReport=async function(id,options){
      try{
        const report=await window.getSavedReport(id);
        const type=normalizeReportType(report&&report.type);
        if(type!=='stp')return original.apply(this,arguments);
        const data=report.result||report.data||report.payload||{};
        if(typeof window.closeReportDashboard==='function')window.closeReportDashboard();
        if(window.tabManager&&typeof window.tabManager.switchTab==='function')window.tabManager.switchTab('stp',{scroll:false});
        else forceTab('stp',{scroll:false});
        setTimeout(function(){
          const target=document.getElementById('stpTab');
          if(target&&(getComputedStyle(target).display==='none'||!target.classList.contains('active')))forceTab('stp',{scroll:false});
        },80);
        window.DAKA_LAST_STP_DECISION=data;
        if(typeof window.renderStpDecision==='function')window.renderStpDecision(data);
        else{
          const box=document.getElementById('resultsStpDecision');
          if(box){box.classList.add('active');box.innerHTML='<section class="daka-stp-report"><h2>STP</h2><pre style="white-space:pre-wrap;color:#dbeafe">'+String(JSON.stringify(data,null,2)).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c];})+'</pre></section>';}
        }
        setTimeout(function(){document.getElementById('resultsStpDecision')?.scrollIntoView({behavior:'smooth',block:'start'});},180);
        if(window.toast&&typeof window.toast.success==='function')window.toast.success('Rapport STP ouvert.');
        return report;
      }catch(error){
        if(String(error&&error.message||'').includes('REPORT_TYPE_UNSUPPORTED')){
          if(window.toast&&typeof window.toast.error==='function')window.toast.error('Type de rapport corrigé: rechargez et réessayez.');
          return null;
        }
        return original.apply(this,arguments);
      }
    };
    window.__dakaStpReportOpenPatch=true;
    return true;
  }

  function installHotfixes(){
    installTabFallback();
    ensureLibraryFullscreenButton();
    installStpReportOpenPatch();
    let tries=0;
    const timer=setInterval(function(){
      tries+=1;
      ensureLibraryFullscreenButton();
      const ok=installStpReportOpenPatch();
      if(ok&&tries>8)clearInterval(timer);
      if(tries>80)clearInterval(timer);
    },250);
  }

  window.dakaTrackEvent=send;
  ready(installHotfixes);
  send('page_view');
  document.addEventListener('click',function(e){
    const el=e.target.closest('a,button,[data-track]');
    if(!el)return;
    ensureLibraryFullscreenButton();
    send('click',{text:(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,120),id:el.id||null,href:el.href||null,track:el.dataset&&el.dataset.track||null});
  },true);
  document.addEventListener('submit',function(e){send('form_submit',{id:e.target&&e.target.id||null});},true);
  addEventListener('pagehide',function(){send('page_exit',{scrollY:scrollY,viewport:{w:innerWidth,h:innerHeight}})});
})();