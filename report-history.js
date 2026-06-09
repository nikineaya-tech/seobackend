/* =============================================================
   DAKA — REPORT HISTORY v2.0
   1. Historique cliquable : chaque rapport ré-affiche le résultat
   2. Bouton téléchargement PDF dans le modal historique
   3. Cache mémoire : si même clé (type+URL/keyword) →
      affiche ancien sans refaire l'analyse
   ============================================================= */

(function () {
  'use strict';

  /* --------------------------------------------------------
     CACHE ANALYSIS (session + localStorage)
     clé = type:"competitors"|"funnel"|"technical"|"keywords" + identifiant
  -------------------------------------------------------- */
  var CACHE = {};

  function cacheKey(type, id) {
    return type + '::' + (id || '').trim().toLowerCase();
  }

  function cacheSet(type, id, htmlResult) {
    var k = cacheKey(type, id);
    CACHE[k] = { html: htmlResult, ts: Date.now() };
    try {
      var store = JSON.parse(localStorage.getItem('daka_cache') || '{}');
      store[k] = { html: htmlResult, ts: Date.now() };
      // garde les 30 derniers
      var keys = Object.keys(store).sort(function(a,b){ return store[b].ts - store[a].ts; });
      if (keys.length > 30) { keys.slice(30).forEach(function(kk){ delete store[kk]; }); }
      localStorage.setItem('daka_cache', JSON.stringify(store));
    } catch(e) {}
  }

  function cacheGet(type, id) {
    var k = cacheKey(type, id);
    if (CACHE[k]) return CACHE[k].html;
    try {
      var store = JSON.parse(localStorage.getItem('daka_cache') || '{}');
      if (store[k]) { CACHE[k] = store[k]; return store[k].html; }
    } catch(e) {}
    return null;
  }

  /* --------------------------------------------------------
     INTERCEPTION DES FONCTIONS D'ANALYSE
     On wrap analyzeCompetitors / analyzeFunnel /
     analyzeTechnical / analyzeKeywords pour mémoriser
     leur résultat HTML au moment où il est injecté
  -------------------------------------------------------- */
  function observeResults() {
    var targets = [
      { containerId: 'resultsCompetitors', type: 'competitors',
        getKey: function(){ return (document.getElementById('keyword')||{}).value
          || (document.getElementById('url')||{}).value || ''; } },
      { containerId: 'resultsFunnel',      type: 'funnel',
        getKey: function(){ return (document.getElementById('funnelUrl')||{}).value || ''; } },
      { containerId: 'resultsTechnical',   type: 'technical',
        getKey: function(){ return (document.getElementById('techUrl')||{}).value || ''; } },
      { containerId: 'resultsKeywords',    type: 'keywords',
        getKey: function(){ return (document.getElementById('seedKeyword')||{}).value || ''; } },
    ];

    targets.forEach(function(t) {
      var container = document.getElementById(t.containerId);
      if (!container) return;

      var obs = new MutationObserver(function() {
        if (!container.classList.contains('active')) return;
        var html = container.innerHTML;
        if (!html || html.length < 100) return;
        var key = t.getKey();
        if (key) cacheSet(t.type, key, html);
      });

      obs.observe(container, { childList: true, subtree: true, characterData: true });
    });
  }

  /* --------------------------------------------------------
     INTERCEPTION DES SOUMISSIONS DE FORMULAIRE
     Avant de lancer l'analyse, vérifie si un cache existe.
     Si oui : affiche directement, bloque l'appel API,
     propose un bouton "Relancer" pour forcer l'actualisation.
  -------------------------------------------------------- */
  function interceptForms() {
    var forms = [
      { formId: 'competitorsForm', resultId: 'resultsCompetitors', type: 'competitors',
        getKey: function(){ return (document.getElementById('keyword')||{}).value
          || (document.getElementById('url')||{}).value || ''; } },
      { formId: 'funnelForm',      resultId: 'resultsFunnel',      type: 'funnel',
        getKey: function(){ return (document.getElementById('funnelUrl')||{}).value || ''; } },
      { formId: 'technicalForm',   resultId: 'resultsTechnical',   type: 'technical',
        getKey: function(){ return (document.getElementById('techUrl')||{}).value || ''; } },
      { formId: 'keywordsForm',    resultId: 'resultsKeywords',    type: 'keywords',
        getKey: function(){ return (document.getElementById('seedKeyword')||{}).value || ''; } },
    ];

    forms.forEach(function(f) {
      var form = document.getElementById(f.formId);
      if (!form) return;

      form.addEventListener('submit', function(e) {
        var key     = f.getKey();
        var cached  = key ? cacheGet(f.type, key) : null;
        if (!cached) return; // pas de cache → analyse normale

        e.preventDefault();
        e.stopImmediatePropagation();

        var container = document.getElementById(f.resultId);
        if (!container) return;

        container.innerHTML = cached;
        container.classList.add('active');
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Banniere "depuis cache"
        var banner = document.createElement('div');
        banner.style.cssText = [
          'display:flex','align-items:center','justify-content:space-between',
          'gap:12px','padding:10px 16px','margin-bottom:14px',
          'background:rgba(245,158,11,0.1)','border:1px solid rgba(245,158,11,0.35)',
          'border-radius:10px','font-size:0.8rem','color:#fcd34d'
        ].join(';');

        var timeAgo = (function() {
          try {
            var store = JSON.parse(localStorage.getItem('daka_cache') || '{}');
            var ck = cacheKey(f.type, key);
            if (store[ck]) {
              var diff = Math.round((Date.now() - store[ck].ts) / 60000);
              if (diff < 1) return 'il y a quelques secondes';
              if (diff < 60) return 'il y a ' + diff + ' min';
              var h = Math.round(diff / 60);
              if (h < 24) return 'il y a ' + h + 'h';
              return 'il y a ' + Math.round(h/24) + 'j';
            }
          } catch(e) {}
          return '';
        })();

        banner.innerHTML = [
          '<span><i class="fas fa-history" style="margin-right:6px"></i>',
          'Rapport en cache ' + (timeAgo ? '(' + timeAgo + ')' : '') + '</span>',
          '<button onclick="REPORT_HISTORY.forceAnalysis(\'' + f.formId + '\')"',
          ' style="background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.5);',
          'color:#fcd34d;padding:5px 12px;border-radius:7px;cursor:pointer;font-size:0.75rem;font-weight:700;">',
          '<i class="fas fa-rotate-right"></i> Actualiser</button>'
        ].join('');

        container.insertAdjacentElement('afterbegin', banner);

        // Active les boutons PDF s'ils existent
        ['btn-export-competitors-pdf','btn-export-funnel-pdf','btn-export-technical-pdf','btn-export-keywords-pdf']
          .forEach(function(id) {
            var btn = document.getElementById(id);
            if (btn) btn.style.display = 'inline-flex';
          });
      }, true);
    });
  }

  /* --------------------------------------------------------
     RENDER REPORT IN MODAL
     Quand l'utilisateur clique sur un rapport dans l'historique,
     on affiche son contenu dans le bon onglet + on ouvre ce dernier.
  -------------------------------------------------------- */
  function renderReport(report) {
    if (!report) return;

    /* Ferme le modal historique */
    if (typeof closeReportDashboard === 'function') closeReportDashboard();
    else {
      var m = document.getElementById('reports-modal');
      if (m) m.classList.remove('active');
    }

    var type = (report.type || report.analysis_type || 'competitors').toLowerCase();

    /* Mapping type → onglet + container */
    var map = {
      competitors : { tab: 'competitors', containerId: 'resultsCompetitors', btnExport: 'btn-export-competitors-pdf' },
      funnel      : { tab: 'funnel',       containerId: 'resultsFunnel',      btnExport: 'btn-export-funnel-pdf' },
      technical   : { tab: 'technical',    containerId: 'resultsTechnical',   btnExport: 'btn-export-technical-pdf' },
      keywords    : { tab: 'keywords',     containerId: 'resultsKeywords',    btnExport: 'btn-export-keywords-pdf' },
    };
    var info = map[type] || map['competitors'];

    /* Restaure le HTML du rapport */
    var html = report.html_result || report.result_html || report.html || '';
    if (!html) {
      /* Essaie de retrouver depuis le cache localStorage */
      var id = report.keyword || report.url || report.seed || report.id || '';
      html = cacheGet(type, id) || '';
    }

    var container = document.getElementById(info.containerId);
    if (!container) return;

    /* Active l'onglet */
    document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(t){ t.classList.remove('active'); });
    var tabEl = document.getElementById(info.tab + 'Tab');
    if (tabEl) tabEl.classList.add('active');
    var navBtn = document.querySelector('[data-tab="' + info.tab + '"]');
    if (navBtn) navBtn.classList.add('active');

    /* Injecte le résultat */
    if (html) {
      container.innerHTML = html;
      container.classList.add('active');
    } else {
      container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;"><i class="fas fa-clock-rotate-left" style="font-size:2rem;opacity:0.4;margin-bottom:12px;display:block"></i>Contenu non disponible — l\'analyse a peut-être été effectuée dans une session précédente.</div>';
      container.classList.add('active');
    }

    /* Active le bouton PDF */
    var pdfBtn = document.getElementById(info.btnExport);
    if (pdfBtn && html) pdfBtn.style.display = 'inline-flex';

    /* Scroll vers le résultat */
    setTimeout(function() {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  /* --------------------------------------------------------
     REBUILD REPORT LIST UI
     Remplace le rendu des items du modal par des items
     cliquables + bouton PDF inline.
  -------------------------------------------------------- */
  function buildReportItem(report) {
    var title = report.keyword || report.url || report.title
      || report.seed_keyword || report.analysis_type || 'Rapport';
    var type  = (report.type || report.analysis_type || '').toLowerCase();
    var date  = report.created_at || report.date || '';
    var dateStr = '';
    if (date) {
      try { dateStr = new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
      catch(e) { dateStr = date; }
    }

    var iconMap = { competitors:'fa-chess-knight', funnel:'fa-filter', technical:'fa-microchip', keywords:'fa-key' };
    var icon = iconMap[type] || 'fa-chart-bar';
    var colorMap = { competitors:'#a78bfa', funnel:'#34d399', technical:'#38bdf8', keywords:'#f59e0b' };
    var color = colorMap[type] || '#94a3b8';

    var div = document.createElement('div');
    div.className = 'report-history-item';
    div.style.cssText = 'cursor:pointer;transition:border-color 0.2s,background 0.2s;';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.title = 'Cliquez pour voir ce rapport';

    div.innerHTML = [
      '<div style="min-width:0;display:flex;align-items:center;gap:10px;">',
        '<span style="width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;',
          'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);flex-shrink:0;">',
          '<i class="fas ' + icon + '" style="color:' + color + ';font-size:0.85rem;"></i></span>',
        '<div style="min-width:0;">',
          '<strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;">',
            escHtml(title),
          '</strong>',
          '<small style="color:#64748b;">' + escHtml(dateStr) + '</small>',
        '</div>',
      '</div>',
      '<div class="report-history-actions">',
        '<button class="rh-view-btn" title="Voir le rapport"',
          ' style="width:34px;height:34px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;',
          'background:rgba(56,189,248,0.12);color:#38bdf8;cursor:pointer;">',
          '<i class="fas fa-eye"></i></button>',
        '<button class="rh-pdf-btn" title="Télécharger PDF"',
          ' style="width:34px;height:34px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;',
          'background:rgba(139,92,246,0.12);color:#c4b5fd;cursor:pointer;">',
          '<i class="fas fa-file-pdf"></i></button>',
      '</div>'
    ].join('');

    /* Clic sur la ligne ou bouton œil → affiche rapport */
    function handleView(e) {
      e.stopPropagation();
      renderReport(report);
    }
    div.addEventListener('click', handleView);
    div.querySelector('.rh-view-btn').addEventListener('click', handleView);
    div.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' ') handleView(e); });

    /* Survol */
    div.addEventListener('mouseenter', function(){ div.style.borderColor='rgba(56,189,248,0.3)'; div.style.background='rgba(56,189,248,0.04)'; });
    div.addEventListener('mouseleave', function(){ div.style.borderColor=''; div.style.background=''; });

    /* Bouton PDF */
    div.querySelector('.rh-pdf-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      downloadReportPDF(report);
    });

    return div;
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* --------------------------------------------------------
     TÉLÉCHARGER PDF D'UN RAPPORT HISTORIQUE
     Affiche d'abord le rapport dans le DOM, puis lance export.
  -------------------------------------------------------- */
  function downloadReportPDF(report) {
    var type = (report.type || report.analysis_type || 'competitors').toLowerCase();
    var html = report.html_result || report.result_html || report.html || '';
    if (!html) {
      var id = report.keyword || report.url || report.seed || '';
      html = cacheGet(type, id) || '';
    }
    if (!html) {
      renderReport(report); // affiche d'abord dans l'onglet
      setTimeout(function() { triggerPDFExport(type); }, 600);
      return;
    }

    /* Injecte temporairement dans le container correct */
    var map = { competitors:'resultsCompetitors', funnel:'resultsFunnel', technical:'resultsTechnical', keywords:'resultsKeywords' };
    var container = document.getElementById(map[type] || 'resultsCompetitors');
    if (!container) return;

    var prev = container.innerHTML;
    var wasActive = container.classList.contains('active');
    container.innerHTML = html;
    container.classList.add('active');

    setTimeout(function() {
      triggerPDFExport(type);
      /* Restaure si l'utilisateur n'a pas navigué vers cet onglet */
      if (!wasActive) {
        setTimeout(function() {
          container.innerHTML = prev;
          if (!wasActive) container.classList.remove('active');
        }, 3000);
      }
    }, 400);
  }

  function triggerPDFExport(type) {
    /* Essaie les fonctions d'export existantes dans l'ordre */
    var exportFns = [
      window.PDF_EXPORT && window.PDF_EXPORT[type],
      window['export' + type.charAt(0).toUpperCase() + type.slice(1) + 'PDF'],
      window.exportFullAnalysisToPDF,
    ];
    for (var i = 0; i < exportFns.length; i++) {
      if (typeof exportFns[i] === 'function') {
        try { exportFns[i](); return; } catch(e) {}
      }
    }
    /* Fallback : window.print() */
    window.print();
  }

  /* --------------------------------------------------------
     PATCH openReportDashboard / loadReportHistory
     On intercepte le rendu de la liste pour rebuildla
     avec nos items cliquables.
  -------------------------------------------------------- */
  function patchReportDashboard() {
    /* Observe le container de la liste pour reprocesser les items */
    var listEl = document.getElementById('report-history-list');
    if (!listEl) {
      /* Le modal n'est peut-être pas encore dans le DOM, on attend */
      var bodyObs = new MutationObserver(function() {
        listEl = document.getElementById('report-history-list');
        if (listEl) { bodyObs.disconnect(); watchList(listEl); }
      });
      bodyObs.observe(document.body, { childList: true, subtree: true });
      return;
    }
    watchList(listEl);
  }

  function watchList(listEl) {
    var obs = new MutationObserver(function() {
      /* Détecte si des .report-history-item ont été ajoutés sans notre patch */
      var items = listEl.querySelectorAll('.report-history-item:not([data-rh-patched])');
      if (!items.length) return;

      /* On reconstruit chaque item avec les données stockées */
      items.forEach(function(oldItem) {
        oldItem.dataset.rhPatched = '1';
        /* Récupère le report depuis le dataset si injecté, sinon analyse le HTML */
        var report = {};
        if (oldItem.dataset.report) {
          try { report = JSON.parse(oldItem.dataset.report); } catch(e) {}
        } else {
          var strong = oldItem.querySelector('strong');
          var small  = oldItem.querySelector('small');
          report.title = strong ? strong.textContent.trim() : '';
          report.date  = small  ? small.textContent.trim()  : '';
          /* Essaie de deviner le type depuis l'icône */
          var ic = oldItem.querySelector('i[class*="fa-"]');
          if (ic) {
            var cl = ic.className;
            if (cl.includes('chess-knight')) report.type = 'competitors';
            else if (cl.includes('filter'))   report.type = 'funnel';
            else if (cl.includes('microchip'))report.type = 'technical';
            else if (cl.includes('key'))      report.type = 'keywords';
          }
        }

        /* Rend l'item cliquable */
        oldItem.style.cursor = 'pointer';
        oldItem.title = 'Cliquez pour afficher ce rapport';

        /* Ajoute bouton œil si pas déjà présent */
        var actions = oldItem.querySelector('.report-history-actions');
        if (actions && !actions.querySelector('.rh-view-btn')) {
          var viewBtn = document.createElement('button');
          viewBtn.className = 'rh-view-btn';
          viewBtn.title = 'Voir le rapport';
          viewBtn.style.cssText = 'width:34px;height:34px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(56,189,248,0.12);color:#38bdf8;cursor:pointer;';
          viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
          viewBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            renderReport(report);
          });
          actions.insertBefore(viewBtn, actions.firstChild);
        }

        /* Rend la ligne entière cliquable */
        oldItem.addEventListener('click', function(e) {
          if (e.target.closest('button')) return;
          renderReport(report);
        });

        /* Patch le bouton de téléchargement existant */
        var dlBtn = actions && actions.querySelectorAll('button');
        if (dlBtn) dlBtn.forEach(function(b) {
          if (b.className === 'rh-view-btn') return;
          if (b.querySelector('.fa-download,.fa-file-pdf') && !b.dataset.pdfPatched) {
            b.dataset.pdfPatched = '1';
            b.addEventListener('click', function(e) {
              e.stopPropagation();
              downloadReportPDF(report);
            });
          }
        });
      });
    });
    obs.observe(listEl, { childList: true, subtree: true });
  }

  /* --------------------------------------------------------
     FORCE ANALYSIS (bypass cache)
  -------------------------------------------------------- */
  function forceAnalysis(formId) {
    var formMap = {
      competitorsForm: { type:'competitors', getKey: function(){ return (document.getElementById('keyword')||{}).value || ''; } },
      funnelForm:      { type:'funnel',       getKey: function(){ return (document.getElementById('funnelUrl')||{}).value || ''; } },
      technicalForm:   { type:'technical',    getKey: function(){ return (document.getElementById('techUrl')||{}).value || ''; } },
      keywordsForm:    { type:'keywords',     getKey: function(){ return (document.getElementById('seedKeyword')||{}).value || ''; } },
    };
    var info = formMap[formId];
    if (info) {
      var k = cacheKey(info.type, info.getKey());
      delete CACHE[k];
      try {
        var store = JSON.parse(localStorage.getItem('daka_cache') || '{}');
        delete store[k];
        localStorage.setItem('daka_cache', JSON.stringify(store));
      } catch(e) {}
    }
    /* Soumet le formulaire sans l'intercepteur */
    var form = document.getElementById(formId);
    if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  /* --------------------------------------------------------
     INIT
  -------------------------------------------------------- */
  function init() {
    observeResults();
    interceptForms();
    patchReportDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* API publique */
  window.REPORT_HISTORY = {
    renderReport    : renderReport,
    downloadPDF     : downloadReportPDF,
    forceAnalysis   : forceAnalysis,
    cacheSet        : cacheSet,
    cacheGet        : cacheGet,
  };

})();
