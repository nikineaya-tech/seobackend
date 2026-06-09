(function () {
  var VIDEO_URL = 'https://etjwmqnbfsevlwaeixwb.supabase.co/storage/v1/object/public/Transform_this_static_logo_int-online-video-cutter.com.mp4/Transform_this_static_logo_int%20(online-video-cutter.com).mp4';

  /* ―― Taille responsive du logo header ――
     ≥ 768px  → 40px   (desktop compact)
     < 768px  → 34px   (tablette)
     < 480px  → 30px   (mobile)
     < 390px  → 28px   (petit mobile)
  */
  function getLogoSize() {
    var w = window.innerWidth;
    if (w < 390) return '28px';
    if (w < 480) return '30px';
    if (w < 768) return '34px';
    return '40px';
  }

  function patchLogo() {
    var sz = getLogoSize();

    /* ―― 1. HEADER LOGO ―― */
    var logoMark = document.querySelector('.logo .logo-mark');
    if (logoMark) {
      var vid = logoMark.querySelector('video');
      if (!vid) {
        vid = document.createElement('video');
        vid.src = VIDEO_URL;
        vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true;
        vid.setAttribute('playsinline', '');
        logoMark.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;flex-shrink:0;';
        logoMark.innerHTML = '';
        logoMark.appendChild(vid);
        vid.play().catch(function () {});
      }
      /* Toujours re-appliquer la taille (resize) */
      vid.style.cssText = [
        'width:' + sz,
        'height:' + sz,
        'border-radius:50%',
        'object-fit:cover',
        'flex-shrink:0',
        'display:block',
        /* Glow violet ultrafin — visible même sur fond sombre */
        'box-shadow:0 0 0 2px rgba(139,92,246,0.55),0 0 12px rgba(139,92,246,0.4)',
        'transition:width .2s,height .2s'
      ].join(';');
      /* Conteneur : taille identique + pas de débordement */
      logoMark.style.width  = sz;
      logoMark.style.height = sz;
    }

    /* ―― 2. LOADING / BRAND-LOADER ORBs ―― */
    document.querySelectorAll('.brand-loader-orb').forEach(function (orb) {
      var existing = orb.querySelector('video');
      if (!existing) {
        var label = orb.querySelector('span');
        var txt   = label ? label.textContent : 'DAKA';
        var ov = document.createElement('video');
        ov.src = VIDEO_URL;
        ov.autoplay = true; ov.loop = true; ov.muted = true; ov.playsInline = true;
        ov.setAttribute('playsinline', '');
        ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;';
        var ns = document.createElement('span');
        ns.textContent = txt;
        ns.style.cssText = 'position:relative;z-index:2;text-shadow:0 2px 10px rgba(0,0,0,0.9);letter-spacing:.5px;';
        orb.style.position = 'relative';
        orb.style.overflow = 'hidden';
        orb.innerHTML = '';
        orb.appendChild(ov);
        orb.appendChild(ns);
        ov.play().catch(function () {});
        existing = ov;
      }
      /* Resserrer la taille de l'orbe selon l'écran */
      var orbSz = window.innerWidth < 480 ? '80px'
                : window.innerWidth < 768 ? '96px'
                : '110px';
      orb.style.width  = orbSz;
      orb.style.height = orbSz;
    });
  }

  /* Lancement initial */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchLogo);
  } else {
    patchLogo();
  }

  /* Resize — recalcule la taille à la volée */
  window.addEventListener('resize', patchLogo);

  /* MutationObserver pour les éléments dynamiques (loader injecte après) */
  document.addEventListener('DOMContentLoaded', function () {
    var mo = new MutationObserver(patchLogo);
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();
