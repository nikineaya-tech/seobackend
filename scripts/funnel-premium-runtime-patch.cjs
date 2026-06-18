'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const serverPath = path.join(rootDir, 'server.js');
const indexPath = path.join(rootDir, 'index.html');

function patchServer() {
  if (!fs.existsSync(serverPath)) return;
  let code = fs.readFileSync(serverPath, 'utf8');
  const original = code;

  const helperMarker = '// DAKA_FUNNEL_PREMIUM_SERVER_PATCH_START';
  const helperCode = `
${helperMarker}
const FUNNEL_ANALYSIS_ROUTE_CACHE_TTL_MS = Number(process.env.FUNNEL_ANALYSIS_CACHE_TTL_MS || 20 * 60 * 1000);
const funnelAnalysisRouteInFlight = new Map();
const funnelAnalysisRouteCache = new Map();

function buildFunnelAnalysisRouteKey(req) {
    try {
        const body = req.body || {};
        const rawUrl = body.url || body.targetUrl || body.website || '';
        if (!rawUrl) return null;
        const normalizedUrl = normalizeFunnelCacheUrl(rawUrl);
        const lang = body.userLang || body.lang || 'fr';
        const mode = body.mode || 'deep';
        const salesAngle = body.salesAngle || 'aggressive';
        const authUser = req.user?.id || req.user?.email || req.auth?.user?.id || req.auth?.user?.email || 'auth';
        const contextBits = [body.offer, body.audience, body.objective, body.priceRange, body.cityRegion, body.country, body.geo].filter(Boolean).join('|').slice(0, 240);
        return [req.path || '/api/analyze-funnel', authUser, normalizedUrl, lang, mode, salesAngle, contextBits].join('::');
    } catch {
        return null;
    }
}

function getFunnelAnalysisRouteCache(key) {
    const entry = funnelAnalysisRouteCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > FUNNEL_ANALYSIS_ROUTE_CACHE_TTL_MS) {
        funnelAnalysisRouteCache.delete(key);
        return null;
    }
    return entry.value;
}

function funnelAnalysisDedupeMiddleware(req, res, next) {
    if (req.method !== 'POST') return next();
    const key = buildFunnelAnalysisRouteKey(req);
    if (!key) return next();
    const cached = getFunnelAnalysisRouteCache(key);
    if (cached && !req.body?.skipCache) {
        console.log('[FUNNEL-ROUTE-DEDUPE] Cache HIT');
        return res.json({ ...cached, fromRouteCache: true });
    }
    const existing = funnelAnalysisRouteInFlight.get(key);
    if (existing && !req.body?.skipCache) {
        console.log('[FUNNEL-ROUTE-DEDUPE] Awaiting in-flight report');
        return existing.then(body => res.json({ ...body, fromInFlight: true })).catch(error => next(error));
    }
    let settled = false;
    let resolveShared;
    let rejectShared;
    const sharedPromise = new Promise((resolve, reject) => { resolveShared = resolve; rejectShared = reject; });
    funnelAnalysisRouteInFlight.set(key, sharedPromise);
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (!settled) {
            settled = true;
            funnelAnalysisRouteInFlight.delete(key);
            if (res.statusCode < 400 && body && typeof body === 'object') {
                const safeBody = typeof cleanFunnelScrapePayload === 'function' ? cleanFunnelScrapePayload(body) : body;
                funnelAnalysisRouteCache.set(key, { value: safeBody, createdAt: Date.now() });
                resolveShared(safeBody);
            } else {
                rejectShared(new Error(body?.message || body?.error || ('FUNNEL_ROUTE_FAILED_' + res.statusCode)));
            }
        }
        return originalJson(body);
    };
    res.on('close', () => {
        if (!settled && !res.headersSent) {
            settled = true;
            funnelAnalysisRouteInFlight.delete(key);
            rejectShared(new Error('FUNNEL_ROUTE_CLOSED'));
        }
    });
    next();
}
// DAKA_FUNNEL_PREMIUM_SERVER_PATCH_END
`;

  if (!code.includes(helperMarker)) {
    const marker = '// ============================================================================\n//  /api/analyze-funnel';
    if (code.includes(marker)) code = code.replace(marker, helperCode + '\n' + marker);
  }

  if (!code.includes('analysisLimiter, funnelAnalysisDedupeMiddleware, async (req, res) =>')) {
    code = code.replace('analysisLimiter, async (req, res) =>', 'analysisLimiter, funnelAnalysisDedupeMiddleware, async (req, res) =>');
  }

  if (code !== original) {
    fs.writeFileSync(serverPath, code, 'utf8');
    console.log('[FunnelPremiumPatch] server.js patched: route dedupe and cache only.');
  } else {
    console.log('[FunnelPremiumPatch] server.js already patched.');
  }
}

function patchIndex() {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');
  const marker = 'DAKA_FUNNEL_PREMIUM_RENDER_PATCH_START';
  if (html.includes(marker)) {
    console.log('[FunnelPremiumPatch] index.html already patched.');
    return;
  }

  const patch = `
<!-- DAKA_FUNNEL_PREMIUM_RENDER_PATCH_START -->
<style id="daka-funnel-premium-render-css">
.daka-funnel-premium{margin:22px 0;display:grid;gap:16px}.daka-funnel-premium *{box-sizing:border-box}.daka-funnel-card{border:1px solid rgba(148,163,184,.18);background:linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.95));border-radius:18px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.daka-funnel-card>summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#e2e8f0;font-weight:900}.daka-funnel-card>summary::-webkit-details-marker{display:none}.daka-funnel-card h3{margin:0;color:#fff;font-size:1rem}.daka-funnel-sub{color:#94a3b8;font-size:.82rem;margin-top:5px;line-height:1.55}.daka-funnel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:14px}.daka-funnel-item{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px}.daka-funnel-k{color:#67e8f9;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;font-weight:900;margin-bottom:6px}.daka-funnel-v{color:#e2e8f0;font-size:.84rem;line-height:1.55}.daka-funnel-scroll{overflow-x:auto}.daka-funnel-table{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:12px;min-width:720px}.daka-funnel-table th,.daka-funnel-table td{border-bottom:1px solid rgba(255,255,255,.06);padding:9px;text-align:left;vertical-align:top;color:#cbd5e1}.daka-funnel-table th{color:#93c5fd;font-size:.68rem;text-transform:uppercase}.daka-pill{display:inline-flex;padding:3px 8px;border-radius:999px;font-weight:900;font-size:.66rem;border:1px solid rgba(255,255,255,.12)}.daka-priority-high{color:#fecaca;background:rgba(239,68,68,.12)}.daka-priority-medium{color:#fde68a;background:rgba(245,158,11,.12)}.daka-priority-low{color:#bbf7d0;background:rgba(16,185,129,.12)}#btn-export-funnel-pdf{position:fixed!important;right:18px!important;bottom:18px!important;z-index:3000!important;border-radius:999px!important;padding:12px 16px!important;background:linear-gradient(135deg,#ef4444,#8b5cf6)!important;color:#fff!important;border:0!important;box-shadow:0 16px 40px rgba(139,92,246,.32)!important}.daka-logo-loader{position:fixed;inset:0;display:none;place-items:center;z-index:999999;background:radial-gradient(circle at 50% 30%,rgba(99,102,241,.25),rgba(2,6,23,.96) 58%,#000)}.daka-logo-loader.active{display:grid}.daka-logo-loader-card{width:min(88vw,380px);border:1px solid rgba(139,92,246,.35);border-radius:24px;padding:24px;text-align:center;background:rgba(15,23,42,.72);box-shadow:0 0 70px rgba(139,92,246,.32)}.daka-logo-orb{width:92px;height:92px;border-radius:24px;margin:0 auto 16px;display:grid;place-items:center;background:linear-gradient(135deg,#06b6d4,#8b5cf6);box-shadow:0 0 40px rgba(6,182,212,.55);animation:dakaPulse 1.45s ease-in-out infinite}.daka-logo-orb span{font-size:42px;font-weight:900;color:#fff}.daka-loader-title{font-weight:900;color:#fff;font-size:1.1rem;margin-bottom:8px}.daka-loader-sub{color:#cbd5e1;font-size:.86rem;line-height:1.55}@keyframes dakaPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}@media(max-width:640px){.daka-funnel-card{padding:13px;border-radius:15px}.daka-funnel-grid{grid-template-columns:1fr}.daka-funnel-table{font-size:.72rem}#btn-export-funnel-pdf{right:12px!important;bottom:12px!important}}
</style>
<script id="daka-funnel-premium-render-js">
(function(){
if(window.__DAKA_FUNNEL_PREMIUM_RENDER__)return;window.__DAKA_FUNNEL_PREMIUM_RENDER__=true;
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const arr=v=>Array.isArray(v)?v:[];
function pri(p){const s=String(p||'').toLowerCase();return s.includes('haut')||s.includes('high')||s.includes('عالية')?'daka-priority-high':s.includes('bas')||s.includes('low')?'daka-priority-low':'daka-priority-medium'}
function card(t,sub,body,open){return '<details class="daka-funnel-card" '+(open?'open':'')+'><summary><div><h3>'+esc(t)+'</h3>'+(sub?'<div class="daka-funnel-sub">'+esc(sub)+'</div>':'')+'</div><i class="fas fa-chevron-down"></i></summary>'+body+'</details>'}
function cards(items){return '<div class="daka-funnel-grid">'+arr(items).slice(0,8).map(x=>'<div class="daka-funnel-item"><div class="daka-funnel-k">'+esc(x.section||x.name||x.title||x.label||'Section')+'</div><div class="daka-funnel-v">'+esc(x.action||x.problem||x.reason||x.impact||x.conversionImpact||x.objective||x.evidence||x.recommendedPosition||x.value||'À traiter')+'</div>'+(x.priority?'<div style="margin-top:8px"><span class="daka-pill '+pri(x.priority)+'">'+esc(x.priority)+'</span></div>':'')+'</div>').join('')+'</div>'}
function matrix(rows){let r=arr(rows).slice(0,40);if(!r.length)return '<div class="daka-funnel-sub">Matrice non disponible.</div>';return '<div class="daka-funnel-scroll"><table class="daka-funnel-table"><thead><tr><th>Section</th><th>Présente</th><th>État</th><th>Décision</th><th>Action</th><th>Priorité</th><th>Confiance</th></tr></thead><tbody>'+r.map(x=>'<tr><td>'+esc(x.section||x.name||x.label)+'</td><td>'+esc(x.present)+'</td><td>'+esc(x.currentState||x.status||x.state||'—')+'</td><td>'+esc(x.decision||'—')+'</td><td>'+esc(x.action||x.problem||x.conversionImpact||'—')+'</td><td><span class="daka-pill '+pri(x.priority)+'">'+esc(x.priority||'Moyenne')+'</span></td><td>'+esc(x.confidence||'MEDIUM')+'</td></tr>').join('')+'</tbody></table></div>'}
function normalize(data){const raw=data.funnelSurgery||data.sectionSurgery||data.surgery||{};if(raw.surgeryMatrix)return raw;const sections=arr(data.rawIntel&&data.rawIntel.sectionsDetailed);const missing=arr(data.rawIntel&&data.rawIntel.missingCriticalSections);const issues=arr(data.auditIssues);const q=arr(data.concreteActionPlan);return{verdict:{section:'Verdict Funnel',action:(data.auditSummary&&data.auditSummary.verdict)||'Diagnostic basé sur les signaux observés',priority:'Haute'},offerDetected:{section:'Offre détectée',action:(data.projectIdentity&&data.projectIdentity.niche)||'Offre à confirmer',priority:'Moyenne'},sectionDiagnosis:{keep:sections.slice(0,4).map(s=>({section:s.label||s.type,action:'Garder si cette section soutient directement la décision.',priority:'Moyenne',confidence:'MEDIUM'})),improve:issues.slice(0,5).map(i=>({section:i.title,problem:i.impact,action:i.recommendedFix,priority:i.severity,confidence:i.confidence})),add:missing.slice(0,8).map(m=>({section:m,action:'Ajouter cette section avec preuve, CTA et réassurance.',priority:'Haute',confidence:'HIGH'})),removeOrMerge:[]},surgeryMatrix:[...sections.map(s=>({section:s.label||s.type,present:'Oui',currentState:s.score?('Score '+s.score):'Détectée',decision:s.score>=70?'Garder':'Améliorer',action:'Clarifier le rôle conversion de cette section.',priority:s.score>=70?'Moyenne':'Haute',confidence:'MEDIUM'})),...missing.map(m=>({section:m,present:'Non',currentState:'Absent',decision:'Ajouter',action:'Créer le bloc et le placer avant la décision d achat.',priority:'Haute',confidence:'HIGH'}))],frictions:issues.slice(0,5).map(i=>({section:i.title,evidence:i.evidence,impact:i.impact,action:i.recommendedFix,priority:i.severity,confidence:i.confidence})),priorityPlan:{now:q.slice(0,3).map(x=>({action:x.changeNow||x.title||x.action||x.howTo})),sevenDays:q.slice(3,6).map(x=>({action:x.changeNow||x.title||x.action||x.howTo})),thirtyDays:q.slice(6,9).map(x=>({action:x.changeNow||x.title||x.action||x.howTo}))},copyReadySections:{H1:data.copywritingDeep&&data.copywritingDeep.rewriteSuggestions&&data.copywritingDeep.rewriteSuggestions.newH1,CTA:data.copywritingDeep&&data.copywritingDeep.rewriteSuggestions&&data.copywritingDeep.rewriteSuggestions.newCTA,Microcopy:'Livraison claire · Paiement sécurisé · Garantie disponible'},observedLimits:{section:'Données observées et limites',action:'Source scraping: '+(data.fetchLayer||'Railway/cache')+' · Confiance: '+((data.scrapeReliability&&data.scrapeReliability.confidence)||'MEDIUM')}}}
}
function plan(p){let groups=[['MAINTENANT',arr(p&&p.now)],['SOUS 7 JOURS',arr(p&&p.sevenDays)],['SOUS 30 JOURS',arr(p&&p.thirtyDays)]];return '<div class="daka-funnel-grid">'+groups.map(g=>'<div class="daka-funnel-item"><div class="daka-funnel-k">'+g[0]+'</div>'+(g[1].slice(0,3).map(a=>'<div class="daka-funnel-v" style="margin-bottom:7px">• '+esc(a.action||a)+'</div>').join('')||'<div class="daka-funnel-v">—</div>')+'</div>').join('')+'</div>'}
window.renderDakaFunnelPremium=function(data){const root=document.getElementById('resultsFunnel');if(!root||!data||root.querySelector('#daka-funnel-premium-report'))return;const s=normalize(data);const d=s.sectionDiagnosis||{};const html='<div id="daka-funnel-premium-report" class="daka-funnel-premium">'+card('Verdict Funnel','Section Surgery + Conversion Diagnosis + Reconstruction Plan',cards([s.verdict,s.offerDetected,data.scrapeReliability||{}]),true)+card('Diagnostic des sections de la page','Présentes, absentes, à garder, améliorer, déplacer, supprimer ou ajouter.',cards([...(d.keep||[]),...(d.improve||[]),...(d.add||[])]),true)+card('Section Surgery Matrix','Lecture opérationnelle section par section.',matrix(s.surgeryMatrix),true)+card('Sections manquantes à ajouter','Les blocs prioritaires à construire.',cards(d.add||s.missingSections),true)+card('Sections à supprimer ou fusionner','Éléments qui distraient ou diluent la conversion.',cards(d.removeOrMerge||s.removeOrMergeSections),true)+card('Nouvel ordre recommandé de la page','Ordre de reconstruction recommandé.',cards(arr(s.recommendedOrder&&s.recommendedOrder.recommendedOrder).map((x,i)=>({section:'#'+(i+1),action:x}))),true)+card('Frictions qui bloquent l achat','Maximum 5 frictions prioritaires.',cards(s.frictions),true)+card('Preuves et confiance','Preuves présentes, faibles et manquantes.',cards([...(arr(s.proofTrust&&s.proofTrust.present).map(x=>({section:'Présent',action:x}))),...(arr(s.proofTrust&&s.proofTrust.missing).map(x=>({section:'À ajouter',action:x})))]),false)+card('Offre, prix et valeur perçue','Prix confirmé ou non, devise et clarté.',cards([s.offerPriceValue||{}]),false)+card('Message, promesse et CTA','H1, sous-titre, CTA et microcopy proposés.',cards([s.messagePromiseCta||{}]),false)+card('Expérience mobile','Frictions UX mobile et simplification.',cards(arr(s.mobileUx&&s.mobileUx.risks).map(x=>({section:'Risque mobile',action:x}))),false)+card('Plan de correction prioritaire','Maintenant / 7 jours / 30 jours.',plan(s.priorityPlan),true)+card('Sections prêtes à copier','Textes directement exploitables.',cards(Object.entries(s.copyReadySections||{}).map(([k,v])=>({section:k,action:typeof v==='object'?JSON.stringify(v):v}))),false)+card('Données observées et limites','Sources, confiance et limites.',cards([s.observedLimits||{}]),false)+'</div>';root.insertAdjacentHTML('afterbegin',html);document.getElementById('btn-export-funnel-pdf')&&(document.getElementById('btn-export-funnel-pdf').style.display='inline-flex')};
window.showDakaLogoLoader=function(){let el=document.getElementById('dakaLogoLoader');if(!el){el=document.createElement('div');el.id='dakaLogoLoader';el.className='daka-logo-loader';el.innerHTML='<div class="daka-logo-loader-card"><div class="daka-logo-orb"><span>D</span></div><div class="daka-loader-title">Daka analyse le funnel</div><div class="daka-loader-sub">Scraping Railway, diagnostic des sections et plan de conversion.</div></div>';document.body.appendChild(el)}el.classList.add('active')};
window.hideDakaLogoLoader=function(){let el=document.getElementById('dakaLogoLoader');if(el)el.classList.remove('active')};
const nativeFetch=window.fetch.bind(window);window.fetch=async function(input,init){const url=String((input&&input.url)||input||'');const isFunnel=url.includes('/api/analyze-funnel')||url.includes('/api/funnel');if(isFunnel)window.showDakaLogoLoader();try{const res=await nativeFetch(input,init);if(isFunnel){res.clone().json().then(d=>setTimeout(()=>window.renderDakaFunnelPremium(d),80)).catch(()=>{});}return res}finally{if(isFunnel)setTimeout(window.hideDakaLogoLoader,350)}};
})();
</script>
<!-- DAKA_FUNNEL_PREMIUM_RENDER_PATCH_END -->`;

  html = html.includes('</body>') ? html.replace('</body>', patch + '\n</body>') : html + patch;
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[FunnelPremiumPatch] index.html patched: premium funnel render, loader, PDF button.');
}

console.log('[FunnelPremiumPatch] Backend source patch disabled; routing and dedupe are implemented in server.js.');
patchIndex();
