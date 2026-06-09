// PATCH LOGO VIDEO DAKA
// Ce script injecte la vidéo Supabase à la place du logo statique
// et remplace tous les brand-loader-orb par la vidéo animée
// Appliqué automatiquement au chargement de la page

(function() {
  const VIDEO_URL = 'https://etjwmqnbfsevlwaeixwb.supabase.co/storage/v1/object/public/Transform_this_static_logo_int-online-video-cutter.com.mp4/Transform_this_static_logo_int%20(online-video-cutter.com).mp4';

  function applyLogoPatch() {
    // 1. Remplacer le logo header (span.logo-mark > span.logo-mark-core)
    const logoMark = document.querySelector('.logo .logo-mark');
    if (logoMark && !logoMark.querySelector('video')) {
      const video = document.createElement('video');
      video.src = VIDEO_URL;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 0 20px rgba(139,92,246,0.55);display:block;';
      logoMark.style.cssText = 'display:flex;align-items:center;justify-content:center;';
      logoMark.innerHTML = '';
      logoMark.appendChild(video);
    }

    // 2. Remplacer tous les brand-loader-orb
    document.querySelectorAll('.brand-loader-orb').forEach(orb => {
      if (orb.querySelector('video')) return; // déjà patché
      const label = orb.querySelector('span');
      const labelText = label ? label.textContent : 'DAKA';
      
      const video = document.createElement('video');
      video.src = VIDEO_URL;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;';
      
      const span = document.createElement('span');
      span.textContent = labelText;
      span.style.cssText = 'position:relative;z-index:2;text-shadow:0 2px 8px rgba(0,0,0,0.8);';
      
      orb.style.position = 'relative';
      orb.style.overflow = 'hidden';
      orb.innerHTML = '';
      orb.appendChild(video);
      orb.appendChild(span);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLogoPatch);
  } else {
    applyLogoPatch();
  }

  // Observer pour les éléments chargés dynamiquement
  const observer = new MutationObserver(() => applyLogoPatch());
  observer.observe(document.body, { childList: true, subtree: true });
})();
