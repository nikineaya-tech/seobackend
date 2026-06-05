const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const patch = String.raw`

<!-- DAKA FAST LOADER PATCH: injected by scripts/patch-loader-fast.js -->
<style id="daka-loader-fast-fix">
.loading-state{display:none!important;position:fixed!important;inset:0!important;z-index:999999!important;width:100vw!important;height:100vh!important;align-items:center!important;justify-content:center!important;flex-direction:column!important;gap:12px!important;padding:24px!important;text-align:center!important;overflow:hidden!important;background:rgba(7,11,22,.98)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;contain:layout paint!important}.loading-state.active{display:flex!important}.loading-orb{width:180px!important;height:180px!important;min-width:180px!important;min-height:180px!important;border-radius:50%!important;position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0 auto 8px!important;background:linear-gradient(135deg,#38bdf8,#818cf8,#a78bfa,#f472b6)!important;animation:dakaSpinFast 3.5s linear infinite!important;box-shadow:none!important;filter:none!important;flex:0 0 180px!important}.loading-orb:before{content:""!important;position:absolute!important;inset:8px!important;border-radius:50%!important;background:#0f172a!important}.loading-orb:after{display:none!important}.brand-loader-orb{position:relative!important;z-index:2!important;width:118px!important;height:56px!important;min-height:56px!important;border-radius:16px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:rgba(15,23,42,.9)!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:none!important;animation:dakaAntiSpinFast 3.5s linear infinite!important}.brand-loader-orb span,.loading-title{background:linear-gradient(90deg,#38bdf8,#818cf8,#a78bfa,#f472b6,#22c55e)!important;background-size:220% 220%!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;animation:dakaTextFast 3s ease-in-out infinite!important}.brand-loader-orb span{font-family:Inter,Cairo,sans-serif!important;font-size:1.45rem!important;font-weight:900!important;letter-spacing:.2em!important;line-height:1!important}.loading-title{max-width:720px!important;margin:0 auto!important;font-family:Cairo,Inter,sans-serif!important;font-size:clamp(1.05rem,2vw,1.45rem)!important;font-weight:900!important;line-height:1.4!important}.loading-subtitle{max-width:680px!important;margin:0 auto!important;color:#cbd5e1!important;font-size:.95rem!important;line-height:1.6!important;opacity:.9!important}.loading-progress-wrap{width:min(540px,82vw)!important;height:7px!important;min-height:7px!important;max-height:7px!important;border-radius:999px!important;overflow:hidden!important;background:rgba(255,255,255,.08)!important;border:0!important;margin:4px auto 0!important}.loading-progress-bar{height:100%!important;border-radius:999px!important;background:linear-gradient(90deg,#38bdf8,#818cf8,#a78bfa,#f472b6,#22c55e)!important;box-shadow:none!important}.loading-phases{width:min(660px,90vw)!important;display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:8px!important;margin:6px auto 0!important;padding:0!important;background:transparent!important}.loading-phase{min-height:42px!important;height:auto!important;padding:9px 10px!important;border-radius:12px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;background:rgba(15,23,42,.75)!important;border:1px solid rgba(148,163,184,.15)!important;color:#e2e8f0!important;font-size:.75rem!important;font-weight:800!important;line-height:1.25!important;white-space:normal!important;box-shadow:none!important;transform:none!important}.loading-phase i{color:#38bdf8!important;background:none!important;-webkit-text-fill-color:initial!important}.loading-tip{max-width:680px!important;color:#94a3b8!important;font-size:.82rem!important;line-height:1.55!important}@keyframes dakaSpinFast{to{transform:rotate(360deg)}}@keyframes dakaAntiSpinFast{to{transform:rotate(-360deg)}}@keyframes dakaTextFast{0%,100%{background-position:0 50%}50%{background-position:100% 50%}}@media(max-width:768px){.loading-state{gap:10px!important;padding:18px 12px!important}.loading-orb{width:145px!important;height:145px!important;min-width:145px!important;min-height:145px!important;flex-basis:145px!important}.brand-loader-orb{width:96px!important;height:48px!important;min-height:48px!important}.brand-loader-orb span{font-size:1.15rem!important;letter-spacing:.15em!important}.loading-phases{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:420px){.loading-orb{width:118px!important;height:118px!important;min-width:118px!important;min-height:118px!important;flex-basis:118px!important}.brand-loader-orb{width:78px!important;height:40px!important;min-height:40px!important;border-radius:12px!important}.brand-loader-orb span{font-size:.95rem!important;letter-spacing:.11em!important}.loading-title{font-size:.95rem!important}.loading-subtitle{font-size:.8rem!important}.loading-phases{grid-template-columns:1fr!important}.loading-phase{min-height:36px!important;font-size:.7rem!important;padding:8px 10px!important}}
</style>
<script id="daka-loader-paint-fix">
(function(){
  function waitPaint(){return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});});}
  window.showLoaderFast = async function(loaderId){
    var loader = document.getElementById(loaderId);
    if(!loader) return;
    document.body.classList.add('loading-active');
    loader.classList.add('active');
    await waitPaint();
  };
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if(nativeFetch && !window.__dakaFetchPaintFix){
    window.__dakaFetchPaintFix = true;
    window.fetch = async function(){
      if(document.querySelector('.loading-state.active')) await waitPaint();
      return nativeFetch.apply(null, arguments);
    };
  }
})();
</script>
<!-- /DAKA FAST LOADER PATCH -->
`;

html = html.replace(/\n?<!-- DAKA FAST LOADER PATCH:[\s\S]*?<!-- \/DAKA FAST LOADER PATCH -->\n?/g, '\n');

if (!html.includes('</body>')) {
  throw new Error('index.html: closing </body> tag not found');
}

html = html.replace('</body>', patch + '\n</body>');
fs.writeFileSync(indexPath, html, 'utf8');
console.log('✅ DAKA fast loader patch injected before </body>');
