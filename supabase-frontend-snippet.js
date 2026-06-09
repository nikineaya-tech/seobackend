// ═══════════════════════════════════════════════════════════════
// SUPABASE FRONTEND AUTH SNIPPET — À coller dans index.html
// Copie ce bloc dans ton <script> principal
// ═══════════════════════════════════════════════════════════════

// ── CONFIG (remplace par tes vraies valeurs) ──────────────────
const SUPABASE_URL  = 'https://etjwmqnbfsevlwaeixwb.supabase.co';
const SUPABASE_ANON = 'COLLE_TON_ANON_KEY_ICI'; // Settings → API → anon public

// ── INIT SDK ──────────────────────────────────────────────────
// Ajoute ce script dans ton <head> :
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── LOGIN GOOGLE ───────────────────────────────────────────────
async function loginWithGoogle() {
  const { error } = await _supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin // redirige vers ton app après login
    }
  });
  if (error) console.error('Login Google error:', error.message);
}

// ── LOGOUT ────────────────────────────────────────────────────
async function logout() {
  await _supabase.auth.signOut();
  updateAuthUI(null);
}

// ── ÉCOUTE LES CHANGEMENTS D AUTH ─────────────────────────────
_supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session?.user?.email);
  updateAuthUI(session?.user || null);

  // Stocke le token pour les appels API backend
  if (session?.access_token) {
    localStorage.setItem('daka_token', session.access_token);
  } else {
    localStorage.removeItem('daka_token');
  }
});

// ── MET À JOUR L UI ───────────────────────────────────────────
function updateAuthUI(user) {
  const btnLogin  = document.getElementById('btn-google-login');
  const btnLogout = document.getElementById('btn-logout');
  const userInfo  = document.getElementById('user-info');
  const userName  = document.getElementById('user-name');
  const userAvatar= document.getElementById('user-avatar');

  if (user) {
    if (btnLogin)   btnLogin.style.display  = 'none';
    if (btnLogout)  btnLogout.style.display = 'block';
    if (userInfo)   userInfo.style.display  = 'flex';
    if (userName)   userName.textContent    = user.user_metadata?.full_name || user.email;
    if (userAvatar) userAvatar.src          = user.user_metadata?.avatar_url || '';
  } else {
    if (btnLogin)   btnLogin.style.display  = 'block';
    if (btnLogout)  btnLogout.style.display = 'none';
    if (userInfo)   userInfo.style.display  = 'none';
  }
}

// ── APPEL API BACKEND AVEC TOKEN ──────────────────────────────
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('daka_token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
}

// ── HTML À AJOUTER DANS TON NAVBAR ────────────────────────────
/*
<!-- Bouton connexion Google -->
<button id="btn-google-login" onclick="loginWithGoogle()" style="
  display:flex; align-items:center; gap:8px;
  background:#fff; color:#333; border:1px solid #ddd;
  padding:8px 16px; border-radius:8px; cursor:pointer;
  font-weight:600; font-size:14px;
">
  <img src="https://www.google.com/favicon.ico" width="18" height="18">
  Se connecter avec Google
</button>

<!-- Infos utilisateur connecté -->
<div id="user-info" style="display:none; align-items:center; gap:10px;">
  <img id="user-avatar" width="32" height="32" style="border-radius:50%;">
  <span id="user-name" style="font-weight:600; color:#fff;"></span>
  <button id="btn-logout" onclick="logout()" style="
    background:rgba(255,255,255,0.1); color:#fff;
    border:1px solid rgba(255,255,255,0.2);
    padding:6px 12px; border-radius:6px; cursor:pointer;
  ">Déconnexion</button>
</div>
*/
