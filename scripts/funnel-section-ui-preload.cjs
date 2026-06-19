'use strict';

/**
 * Daka Funnel Section UI Preload
 *
 * Enriches the existing Funnel "Sections et textes" block with
 * funnelSectionScanner data. It does not create a duplicated top-level report.
 */

const fs = require('fs');
const express = require('express');

const MARKER = 'DAKA_FUNNEL_SECTION_INLINE_UI_V1';

if (!global.__DAKA_FUNNEL_SECTION_INLINE_UI__) {
  global.__DAKA_FUNNEL_SECTION_INLINE_UI__ = true;
  patchHtmlResponses(express);
  console.log('[FunnelSectionUI] Existing Sections et textes enrichment enabled');
}

function patchHtmlResponses(expressModule) {
  const proto = expressModule?.response;
  if (!proto || proto.__dakaFunnelSectionInlineUiPatched) return;

  const originalSend = proto.send;
  const originalSendFile = proto.sendFile;

  proto.send = function dakaFunnelSectionInlineSend(body) {
    try {
      if (typeof body === 'string' && isHtml(this, body)) body = inject(body);
    } catch (error) {
      console.warn('[FunnelSectionUI] send injection skipped:', error.message);
    }
    return originalSend.call(this, body);
  };

  proto.sendFile = function dakaFunnelSectionInlineSendFile(filePath, options, callback) {
    try {
      const file = String(filePath || '');
      if (/\.html?$/i.test(file) && fs.existsSync(file)) {
        const html = fs.readFileSync(file, 'utf8');
        this.type('html');
        return originalSend.call(this, inject(html));
      }
    } catch (error) {
      console.warn('[FunnelSectionUI] sendFile injection skipped:', error.message);
    }
    return originalSendFile.call(this, filePath, options, callback);
  };

  proto.__dakaFunnelSectionInlineUiPatched = true;
}

function isHtml(res, body) {
  const contentType = String(res.getHeader?.('content-type') || res.get?.('content-type') || '').toLowerCase();
  return contentType.includes('text/html') || /<\/body>/i.test(body) || /<html[\s>]/i.test(body);
}

function inject(html) {
  if (!html || html.includes(MARKER)) return html;
  const script = buildClientScript();
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, script + '\n</body>');
  return html + '\n' + script;
}

function buildClientScript() {
  return `<script id="${MARKER}">
(function () {
  if (window.__dakaFunnelSectionInlineUi) return;
  window.__dakaFunnelSectionInlineUi = true;

  function safe(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function asArray(value) { return Array.isArray(value) ? value : []; }

  function ensureScoreDonutDestroy() {
    const donut = window.scoreDonut;
    if (!donut || typeof donut !== 'object' || typeof donut.destroy === 'function') return;
    try {
      Object.defineProperty(donut, 'destroy', {
        value: function noopScoreDonutDestroy() {},
        configurable: true,
        writable: true
      });
    } catch (error) {
      try { donut.destroy = function noopScoreDonutDestroy() {}; } catch (ignored) {}
    }
  }

  function installScoreDonutGuard() {
    if (window.__dakaScoreDonutGuardInstalled) return;
    window.__dakaScoreDonutGuardInstalled = true;
    try {
      let currentScoreDonut = window.scoreDonut;
      Object.defineProperty(window, 'scoreDonut', {
        configurable: true,
        get: function () { return currentScoreDonut; },
        set: function (value) {
          currentScoreDonut = value;
          ensureScoreDonutDestroy();
        }
      });
    } catch (error) {}
    ensureScoreDonutDestroy();
    setTimeout(ensureScoreDonutDestroy, 0);
    setTimeout(ensureScoreDonutDestroy, 250);
    setTimeout(ensureScoreDonutDestroy, 1000);
  }

  installScoreDonutGuard();

  function getScanner(data) {
    if (!data || typeof data !== 'object') return null;
    return data.funnelSectionScanner ||
      data.funnelSectionSurgery?.scanner ||
      data.sectionSurgery?.scanner ||
      data.spyReport?.funnelSectionScanner ||
      data.spyReport?.funnelSectionSurgery?.scanner ||
      null;
  }

  function decisionColor(decision) {
    const v = String(decision || '').toLowerCase();
    if (v.includes('ajouter')) return '#38bdf8';
    if (v.includes('mettre')) return '#f59e0b';
    if (v.includes('déplacer') || v.includes('rapprocher')) return '#a78bfa';
    if (v.includes('supprimer') || v.includes('fusionner')) return '#fb7185';
    return '#22c55e';
  }

  function findExistingSectionsCard() {
    const cards = Array.from(document.querySelectorAll('#resultsFunnel .result-card, #resultsFunnel .report-section, .result-card, .report-section'));
    return cards.find(card => {
      const title = card.querySelector('h2,h3,strong')?.textContent || '';
      const text = (title || card.textContent || '').toLowerCase();
      return text.includes('sections et textes') ||
        text.includes('sections') ||
        text.includes('textes') ||
        text.includes('autopsie') ||
        text.includes('microscope') ||
        text.includes('أقسام');
    }) || null;
  }

  function miniList(title, items, limit) {
    const rows = asArray(items).slice(0, limit || 4);
    if (!rows.length) return '';
    return '<div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px;min-width:0;">' +
      '<div style="font-size:.72rem;color:#cbd5e1;font-weight:900;margin-bottom:8px;">' + safe(title) + '</div>' +
      rows.map(item => {
        const color = decisionColor(item.decision);
        return '<div style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);">' +
          '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">' +
            '<strong style="color:#fff;font-size:.74rem;">' + safe(item.section || item.sectionName || item.type || 'Section') + '</strong>' +
            '<span style="font-size:.58rem;color:' + color + ';border:1px solid ' + color + '55;border-radius:999px;padding:1px 6px;">' + safe(item.decision || '') + '</span>' +
            '<span style="font-size:.58rem;color:#94a3b8;">' + safe(item.confidence || 'MEDIUM') + '</span>' +
          '</div>' +
          '<div style="font-size:.68rem;color:#94a3b8;line-height:1.45;">' + safe(item.action || item.exactAction || item.currentState || item.reason || '') + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function renderInline(scanner) {
    if (!scanner || !asArray(scanner.surgeryMatrix).length) return '';
    const present = asArray(scanner.presentSections).length;
    const missing = asArray(scanner.missingSections).length;
    const update = asArray(scanner.updateSections).length;
    const remove = asArray(scanner.removeOrMergeSections).length;
    return '<div class="daka-section-surgery-inline" data-no-toggle="true" style="margin:14px 0 16px;padding:14px;border-radius:16px;background:linear-gradient(135deg,rgba(14,165,233,.10),rgba(168,85,247,.08));border:1px solid rgba(125,211,252,.18);" dir="auto">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<div><div style="font-weight:950;color:#fff;font-size:.92rem;">Section Surgery — enrichissement Railway</div>' +
        '<div style="font-size:.7rem;color:#94a3b8;">Analyse intégrée dans Sections et textes, sans bloc dupliqué.</div></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<span style="font-size:.62rem;color:#22c55e;border:1px solid #22c55e55;border-radius:999px;padding:2px 7px;">' + present + ' présentes</span>' +
          '<span style="font-size:.62rem;color:#f59e0b;border:1px solid #f59e0b55;border-radius:999px;padding:2px 7px;">' + update + ' à MAJ</span>' +
          '<span style="font-size:.62rem;color:#38bdf8;border:1px solid #38bdf855;border-radius:999px;padding:2px 7px;">' + missing + ' manquantes</span>' +
          '<span style="font-size:.62rem;color:#fb7185;border:1px solid #fb718555;border-radius:999px;padding:2px 7px;">' + remove + ' à fusionner</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' +
        miniList('À garder', scanner.keepSections, 3) +
        miniList('À mettre à jour', scanner.updateSections, 4) +
        miniList('À déplacer / rapprocher', scanner.moveSections, 3) +
        miniList('À supprimer ou fusionner', scanner.removeOrMergeSections, 3) +
        miniList('Manquantes à ajouter', scanner.missingSections, 5) +
      '</div>' +
    '</div>';
  }

  function mount(scanner) {
    ensureScoreDonutDestroy();
    if (document.querySelector('#resultsFunnel .funnel-surgery-shell')) return;
    if (!scanner || !asArray(scanner.surgeryMatrix).length) return;
    const card = findExistingSectionsCard();
    if (!card) return;
    const html = renderInline(scanner);
    if (!html) return;
    const old = card.querySelector('.daka-section-surgery-inline');
    if (old) { old.outerHTML = html; return; }
    const anchor = card.querySelector('h2,h3,strong') || card.firstElementChild;
    if (anchor) anchor.insertAdjacentHTML('afterend', html);
    else card.insertAdjacentHTML('afterbegin', html);
  }

  function scheduleMount(scanner) {
    ensureScoreDonutDestroy();
    window.__dakaLatestFunnelSectionScanner = scanner;
    setTimeout(function () { mount(scanner); }, 60);
    setTimeout(function () { mount(scanner); }, 400);
    setTimeout(function () { mount(scanner); }, 1200);
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function' && !originalFetch.__dakaFunnelSectionWrapped) {
    const wrapped = function () {
      return originalFetch.apply(this, arguments).then(function (response) {
        try {
          ensureScoreDonutDestroy();
          const requestUrl = String(arguments[0]?.url || arguments[0] || '');
          if (/\/api\/(analyze-funnel|funnel)\b/i.test(requestUrl)) {
            response.clone().json().then(function (data) {
              ensureScoreDonutDestroy();
              const scanner = getScanner(data);
              if (scanner) scheduleMount(scanner);
            }).catch(function () {});
          }
        } catch (e) {}
        return response;
      });
    };
    wrapped.__dakaFunnelSectionWrapped = true;
    window.fetch = wrapped;
  }

  const observer = new MutationObserver(function () {
    ensureScoreDonutDestroy();
    if (window.__dakaLatestFunnelSectionScanner) mount(window.__dakaLatestFunnelSectionScanner);
  });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;
}
