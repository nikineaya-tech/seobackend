'use strict';

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const marker = 'DAKA_SCORE_DONUT_HOTFIX';

if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');

if (html.includes(marker)) {
  console.log('[ScoreDonutHotfix] already present.');
  process.exit(0);
}

const patch = `
<!-- ${marker} -->
<script id="daka-score-donut-hotfix">
(function(){
  if (window.__DAKA_SCORE_DONUT_HOTFIX__) return;
  window.__DAKA_SCORE_DONUT_HOTFIX__ = true;

  function safeAttachDestroy(value) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return value;
    if (typeof value.destroy === 'function') return value;
    try {
      Object.defineProperty(value, 'destroy', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: function noopDestroy() {}
      });
    } catch (e) {
      try { value.destroy = function noopDestroy() {}; } catch (_) {}
    }
    return value;
  }

  function guardChartGlobal(key) {
    let internalValue = safeAttachDestroy(window[key]);
    try {
      Object.defineProperty(window, key, {
        configurable: true,
        enumerable: true,
        get: function() {
          return safeAttachDestroy(internalValue);
        },
        set: function(nextValue) {
          internalValue = safeAttachDestroy(nextValue);
        }
      });
    } catch (e) {
      safeAttachDestroy(window[key]);
    }
  }

  [
    'scoreDonut',
    'competitorScoreDonut',
    'funnelScoreDonut',
    'technicalScoreDonut',
    'keywordScoreDonut'
  ].forEach(guardChartGlobal);

  function hideBlockingLoaders() {
    ['loadingState', 'loadingFunnel', 'loadingCompetitors', 'loadingTechnical', 'loadingKeywords', 'dakaLogoLoader'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('active', 'show', 'is-active');
      if (id === 'loadingState' || id === 'dakaLogoLoader') el.style.display = 'none';
    });
  }

  window.addEventListener('error', function(event) {
    var message = String((event && (event.message || event.error && event.error.message)) || '');
    if (/scoreDonut/i.test(message) && /destroy is not a function/i.test(message)) {
      console.warn('[ScoreDonutHotfix] Prevented scoreDonut destroy crash.');
      hideBlockingLoaders();
      event.preventDefault();
      return true;
    }
    return false;
  }, true);

  window.addEventListener('unhandledrejection', function(event) {
    var message = String((event && event.reason && (event.reason.message || event.reason)) || '');
    if (/scoreDonut/i.test(message) && /destroy is not a function/i.test(message)) {
      console.warn('[ScoreDonutHotfix] Prevented scoreDonut destroy promise crash.');
      hideBlockingLoaders();
      event.preventDefault();
      return true;
    }
    return false;
  }, true);
})();
</script>
`;

if (html.includes('<head>')) {
  html = html.replace('<head>', '<head>' + patch);
} else {
  html = patch + html;
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('[ScoreDonutHotfix] index.html patched: scoreDonut destroy guard.');
