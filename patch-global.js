/* =============================================================
   PATCH GLOBAL DAKA v1.0
   1. Loader vidéo robuste (remplace boule + texte DAKA)
   2. Boutons fermeture sections qui ne fermaient plus
   3. Anti-scroll parasite sur accordéons <details>
   ============================================================= */

(function() {
  'use strict';

  const VIDEO_URL = 'https://etjwmqnbfsevlwaeixwb.supabase.co/storage/v1/object/public/Transform_this_static_logo_int-online-video-cutter.com.mp4/Transform_this_static_logo_int%20(online-video-cutter.com).mp4';

  /* ── 1. LOADER VIDÉO ──────────────────────────────────────────
     Remplace chaque .loading-orb par une vidéo autoplay/muted/loop
     Fallback : si la vidéo échoue, affiche la boule DAKA originale
  ──────────────────────────────────────────────────────────────── */
  function injectVideoLoaders() {
    document.querySelectorAll('.loading-orb').forEach(function(orb) {
      if (orb.dataset.videoPatch) return;
      orb.dataset.videoPatch = '1';

      var video = document.createElement('video');
      video.src         = VIDEO_URL;
      video.autoplay    = true;
      video.muted       = true;
      video.loop        = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.style.cssText = [
        'width:140px',
        'height:140px',
        'border-radius:50%',
        'object-fit:cover',
        'display:block',
        'box-shadow:0 0 0 4px rgba(56,189,248,0.3),0 0 40px rgba(56,189,248,0.18)'
      ].join(';');

      video.onerror = function() {
        video.style.display = 'none';
        var fallback = orb.querySelector('.brand-loader-orb');
        if (fallback) fallback.style.display = 'flex';
      };

      var orig = orb.querySelector('.brand-loader-orb');
      if (orig) orig.style.display = 'none';
      orb.style.cssText = 'display:flex;align-items:center;justify-content:center;margin-bottom:24px';
      orb.appendChild(video);

      video.play().catch(function() {
        video.muted = true;
        video.play().catch(function() {
          if (orig) orig.style.display = 'flex';
          video.style.display = 'none';
        });
      });
    });
  }

  /* ── 2. BOUTONS FERMETURE SECTIONS ───────────────────────────
     Délégation globale en capture pour intercepter avant tout autre
     handler. Couvre data-collapse, data-close, .btn-close, etc.
  ──────────────────────────────────────────────────────────────── */
  function fixCollapseButtons() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest(
        '[data-collapse],[data-close],[data-dismiss],'
        + '.btn-close,.btn-collapse,.section-toggle,'
        + '[data-action="close"],[data-action="toggle"]'
      );
      if (!btn) return;

      e.stopPropagation();

      var targetId = btn.dataset.collapse || btn.dataset.close || btn.dataset.dismiss || btn.getAttribute('aria-controls');
      var target   = targetId
        ? document.getElementById(targetId)
        : btn.closest('.result-card,.collapsible-section,.accordion-section');

      if (!target) return;

      var isHidden = target.style.display === 'none' || target.hidden || target.classList.contains('collapsed');

      if (isHidden) {
        target.style.display = '';
        target.hidden = false;
        target.classList.remove('collapsed');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        target.style.display = 'none';
        target.hidden = true;
        target.classList.add('collapsed');
        btn.setAttribute('aria-expanded', 'false');
      }
    }, true);
  }

  /* ── 3. ANTI-SCROLL PARASITE SUR ACCORDÉONS ─────────────────────
     Verrouille le scrollY avant/après chaque toggle <summary>
     et bloque la propagation vers les listeners parasites.
  ──────────────────────────────────────────────────────────────── */
  function fixDetailsScroll() {
    document.addEventListener('click', function(e) {
      var summary = e.target.closest('summary');
      if (!summary) return;
      if (!summary.closest('details')) return;

      var scrollY = window.scrollY;
      var scrollX = window.scrollX;
      e.stopPropagation();

      requestAnimationFrame(function() {
        window.scrollTo({ top: scrollY, left: scrollX, behavior: 'instant' });
      });
    }, true);
  }

  /* ── INIT + OBSERVER ─────────────────────────────────────────────── */
  function init() {
    injectVideoLoaders();
    fixCollapseButtons();
    fixDetailsScroll();

    var observer = new MutationObserver(function(mutations) {
      var shouldReinject = false;
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          if (m.target.classList.contains('active') && m.target.classList.contains('loading-state')) {
            shouldReinject = true;
          }
        }
        if (m.type === 'childList') shouldReinject = true;
      });
      if (shouldReinject) injectVideoLoaders();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
