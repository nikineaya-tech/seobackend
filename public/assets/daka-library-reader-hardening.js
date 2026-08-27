(() => {
  'use strict';

  const STYLE_ID = 'daka-library-reader-fullscreen-secure-style';
  const ACTIVE_CLASS = 'daka-library-reader-active';
  const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);
  let wheelLock = 0;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${ACTIVE_CLASS},
      html.${ACTIVE_CLASS} body,
      body.daka-library-reader-open {
        overflow: hidden !important;
        overscroll-behavior: none !important;
      }

      .daka-library-shell.is-reading {
        position: fixed !important;
        inset: 0 !important;
        z-index: 24000 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: radial-gradient(circle at 15% 0%, rgba(34,211,238,.13), transparent 35%), radial-gradient(circle at 88% 6%, rgba(139,92,246,.15), transparent 38%), #020617 !important;
        overflow: hidden !important;
      }

      .daka-library-shell.is-reading > :not(.daka-library-viewer),
      .daka-library-shell.is-reading .card-header,
      .daka-library-shell.is-reading .daka-library-intro,
      .daka-library-shell.is-reading .daka-library-shelf,
      .daka-library-shell.is-reading .daka-library-guard {
        display: none !important;
      }

      .daka-library-viewer,
      .daka-library-viewer.is-fullscreen,
      .daka-library-shell.is-reading .daka-library-viewer {
        position: fixed !important;
        inset: 0 !important;
        z-index: 24001 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        max-width: none !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        background: linear-gradient(180deg, rgba(2,6,23,.98), rgba(4,10,22,.96)) !important;
        box-shadow: none !important;
        overflow: hidden !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -webkit-touch-callout: none !important;
      }

      .daka-library-viewer::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background: linear-gradient(90deg, rgba(34,211,238,.45), rgba(139,92,246,.42), rgba(245,158,11,.3)) top / 100% 3px no-repeat;
      }

      .daka-library-reader-head {
        flex: 0 0 auto !important;
        min-height: 74px !important;
        display: grid !important;
        grid-template-columns: minmax(430px, auto) minmax(160px, auto) minmax(220px, 1fr) !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 12px clamp(14px, 2vw, 24px) !important;
        border-bottom: 1px solid rgba(148,163,184,.12) !important;
        background: rgba(2,6,23,.78) !important;
        backdrop-filter: blur(18px) !important;
      }

      .daka-library-reader-head > div {
        min-width: 0 !important;
        display: grid !important;
        justify-items: end !important;
        gap: 8px !important;
        grid-column: 3 !important;
      }

      .daka-library-reader-head h2 {
        margin: 0 !important;
        color: #f8fafc !important;
        font-size: clamp(1rem, 1.7vw, 1.32rem) !important;
        line-height: 1.15 !important;
        letter-spacing: 0 !important;
        max-width: min(760px, 45vw) !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .daka-library-reader-head p,
      .daka-library-reader-head .daka-library-pill {
        display: none !important;
      }

      .daka-library-progress {
        flex: 0 0 3px !important;
        height: 3px !important;
        min-height: 3px !important;
      }

      .daka-library-status {
        position: static !important;
        left: auto !important;
        top: auto !important;
        transform: none !important;
        z-index: auto !important;
        min-height: 0 !important;
        width: max-content !important;
        max-width: min(330px, 22vw) !important;
        padding: 8px 12px !important;
        border: 1px solid rgba(34,197,94,.2) !important;
        border-radius: 999px !important;
        background: rgba(2,6,23,.82) !important;
        color: #86efac !important;
        text-align: center !important;
        font-size: .82rem !important;
        font-weight: 900 !important;
        backdrop-filter: blur(16px) !important;
        pointer-events: none !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        grid-column: 2 !important;
        justify-self: center !important;
      }

      .daka-library-status[hidden] {
        display: none !important;
      }

      .daka-library-canvas-wrap {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        height: auto !important;
        max-height: none !important;
        width: 100% !important;
        padding: 10px 16px 14px !important;
        display: grid !important;
        place-items: center !important;
        align-items: center !important;
        justify-items: center !important;
        overflow: hidden !important;
        background: radial-gradient(circle at 50% 4%, rgba(34,211,238,.08), transparent 34%), rgba(0,0,0,.18) !important;
        touch-action: none !important;
      }

      #dakaLibraryCanvas {
        display: block !important;
        width: auto !important;
        height: auto !important;
        max-width: calc(100vw - 34px) !important;
        max-height: calc(100dvh - 92px) !important;
        border-radius: 14px !important;
        background: #fff !important;
        box-shadow: 0 24px 90px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.08) !important;
        pointer-events: none !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }

      .daka-library-toolbar,
      .daka-library-viewer.is-fullscreen .daka-library-toolbar,
      .daka-library-shell.is-reading .daka-library-toolbar {
        position: static !important;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        bottom: auto !important;
        z-index: auto !important;
        transform: none !important;
        width: auto !important;
        max-width: min(820px, 46vw) !important;
        min-height: 54px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        padding: 7px !important;
        border: 1px solid rgba(148,163,184,.18) !important;
        border-radius: 20px !important;
        background: rgba(8,15,30,.92) !important;
        box-shadow: 0 24px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06) !important;
        backdrop-filter: blur(18px) !important;
        overflow: visible !important;
        grid-column: 1 !important;
        justify-self: start !important;
      }

      .daka-library-toolbar .btn {
        min-height: 42px !important;
        border-radius: 14px !important;
        white-space: nowrap !important;
      }

      #dakaLibraryPageIndicator,
      .daka-library-toolbar [id*="PageIndicator"] {
        min-width: 124px !important;
        color: #f8fafc !important;
        font-size: .9rem !important;
        font-weight: 950 !important;
        text-align: center !important;
      }

      .daka-library-viewer canvas,
      .daka-library-viewer img,
      .daka-library-viewer iframe,
      .daka-library-viewer embed,
      .daka-library-viewer object {
        -webkit-user-drag: none !important;
        user-select: none !important;
      }

      @media (max-width: 760px) {
        .daka-library-reader-head {
          min-height: 142px !important;
          grid-template-columns: 1fr !important;
          align-items: stretch !important;
          padding: 8px 10px !important;
          gap: 8px !important;
        }
        .daka-library-reader-head > div {
          width: 100% !important;
          justify-items: start !important;
          grid-column: 1 !important;
        }
        .daka-library-reader-head h2 {
          max-width: calc(100vw - 28px) !important;
          white-space: normal !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
        }
        .daka-library-canvas-wrap {
          padding: 10px 8px 12px !important;
        }
        #dakaLibraryCanvas {
          max-width: calc(100vw - 16px) !important;
          max-height: calc(100dvh - 164px) !important;
          border-radius: 10px !important;
        }
        .daka-library-toolbar {
          width: calc(100vw - 14px) !important;
          max-width: calc(100vw - 14px) !important;
          min-height: 58px !important;
          grid-column: 1 !important;
          justify-content: flex-start !important;
          overflow-x: auto !important;
          scrollbar-width: none !important;
        }
        .daka-library-toolbar::-webkit-scrollbar { display: none !important; }
        .daka-library-toolbar .btn span { display: inline !important; }
        #dakaLibraryPageIndicator { min-width: 94px !important; }
        .daka-library-status {
          grid-column: 1 !important;
          justify-self: start !important;
          width: fit-content !important;
          max-width: calc(100vw - 20px) !important;
          font-size: .72rem !important;
        }
      }

      @media (min-width: 1180px) {
        .daka-library-reader-head {
          grid-template-columns: minmax(520px, auto) minmax(170px, auto) minmax(280px, 1fr) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isReaderOpen(viewer) {
    return Boolean(viewer && !viewer.hidden && viewer.offsetParent !== null);
  }

  function dockReaderChrome(viewer) {
    if (!viewer) return;
    const head = viewer.querySelector('.daka-library-reader-head');
    const toolbar = viewer.querySelector('.daka-library-toolbar');
    const status = viewer.querySelector('.daka-library-status');
    if (!head) return;
    if (toolbar && toolbar.parentElement !== head) head.insertBefore(toolbar, head.firstChild);
    if (status && status.parentElement !== head) {
      const titleWrap = head.querySelector(':scope > div:last-child');
      head.insertBefore(status, titleWrap || null);
    }
  }

  function requestNativeFullscreen(viewer) {
    if (!viewer || document.fullscreenElement === viewer || !viewer.requestFullscreen) return;
    try {
      const result = viewer.requestFullscreen({ navigationUI: 'hide' });
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) {}
  }

  function enterAutomaticFullscreen(viewer) {
    if (!viewer) return;
    viewer.hidden = false;
    viewer.classList.add('is-fullscreen');
    viewer.closest('.daka-library-shell')?.classList.add('is-reading');
    document.documentElement.classList.add(ACTIVE_CLASS);
    document.body.classList.add('daka-library-reader-open');
    window.setTimeout(() => requestNativeFullscreen(viewer), 40);
  }

  function syncReaderState() {
    const viewer = document.getElementById('dakaLibraryViewer');
    const open = isReaderOpen(viewer);
    document.documentElement.classList.toggle(ACTIVE_CLASS, open);
    document.body.classList.toggle('daka-library-reader-open', open);
    if (!viewer) return;
    viewer.classList.toggle('is-fullscreen', open);
    const shell = viewer.closest('.daka-library-shell');
    if (shell) shell.classList.toggle('is-reading', open);
    if (open) {
      dockReaderChrome(viewer);
      hardenNode(viewer);
    }
  }

  function clickByHint(hints) {
    const buttons = Array.from(document.querySelectorAll('.daka-library-toolbar button, .daka-library-toolbar .btn'));
    const target = buttons.find((button) => {
      const text = `${button.id || ''} ${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`.toLowerCase();
      return hints.some((hint) => text.includes(hint));
    });
    if (target && !target.disabled) target.click();
  }

  function hardenNode(node) {
    if (!node || node.dataset.dakaPdfHardened === '1') return;
    node.dataset.dakaPdfHardened = '1';
    ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart', 'drop'].forEach((eventName) => {
      node.addEventListener(eventName, (event) => event.preventDefault(), { capture: true });
    });
    node.addEventListener('wheel', (event) => {
      if (!document.documentElement.classList.contains(ACTIVE_CLASS)) return;
      event.preventDefault();
      const now = Date.now();
      if (now - wheelLock < 650) return;
      wheelLock = now;
      if (event.deltaY > 34) clickByHint(['next', 'suiv', 'التالي', 'page suivante']);
      if (event.deltaY < -34) clickByHint(['prev', 'prec', 'السابق', 'page precedente', 'page précédente']);
    }, { passive: false, capture: true });
  }

  function bindGlobalGuards() {
    document.addEventListener('keydown', (event) => {
      if (!document.documentElement.classList.contains(ACTIVE_CLASS)) return;
      const key = event.key;
      const blockedCombo = (event.ctrlKey || event.metaKey) && ['s', 'p', 'o', 'u', 'c', 'a'].includes(key.toLowerCase());
      if (blockedCombo) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (SCROLL_KEYS.has(key)) {
        event.preventDefault();
        if (key === 'ArrowDown' || key === 'PageDown' || key === ' ') clickByHint(['next', 'suiv', 'التالي', 'page suivante']);
        if (key === 'ArrowUp' || key === 'PageUp') clickByHint(['prev', 'prec', 'السابق', 'page precedente', 'page précédente']);
      }
      if (key === 'Escape') {
        const close = Array.from(document.querySelectorAll('.daka-library-toolbar button, .daka-library-reader-head button, .daka-library-toolbar .btn')).find((button) => {
          const text = `${button.id || ''} ${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`.toLowerCase();
          return text.includes('close') || text.includes('fermer') || text.includes('اغلاق') || text.includes('إغلاق');
        });
        if (close && !close.disabled) close.click();
      }
    }, true);
  }

  function watchReader() {
    injectStyle();
    bindGlobalGuards();
    document.addEventListener('click', (event) => {
      const trigger = event.target && event.target.closest ? event.target.closest('[data-library-open]') : null;
      if (!trigger) return;
      const card = trigger.closest('.daka-library-book-card');
      if (card && card.classList.contains('is-soon')) return;
      enterAutomaticFullscreen(document.getElementById('dakaLibraryViewer'));
      setTimeout(syncReaderState, 0);
      setTimeout(syncReaderState, 180);
    }, true);
    const observer = new MutationObserver(syncReaderState);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
    window.addEventListener('resize', syncReaderState, { passive: true });
    document.addEventListener('fullscreenchange', syncReaderState);
    syncReaderState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchReader, { once: true });
  } else {
    watchReader();
  }
})();
