'use strict';
// ═══════════════════════════════════════════════════
// SUPABASE AUTH ROUTES — Daka Pro
// Ce fichier est auto-chargé par server.js
// Routes: /auth/google/url | /auth/me | /auth/health
// ═══════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const SUPA_URL  = process.env.SUPABASE_URL  || '';
const SUPA_ANON = process.env.SUPABASE_ANON_KEY || '';

if (!SUPA_URL || !SUPA_ANON) {
  console.warn('⚠️  [Auth] SUPABASE_URL ou SUPABASE_ANON_KEY manquante — routes auth désactivées');
}

const supaAuth = (SUPA_URL && SUPA_ANON)
  ? createClient(SUPA_URL, SUPA_ANON)
  : null;

/**
 * Middleware JWT — vérifie le token Supabase dans Authorization: Bearer <token>
 */
async function requireAuth(req, res, next) {
  if (!supaAuth) {
    return res.status(503).json({ success: false, error: 'Auth service non configuré' });
  }
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token manquant — connectez-vous' });
  }
  try {
    const { data: { user }, error } = await supaAuth.auth.getUser(token);
    if (error || !user) throw new Error(error?.message || 'Token invalide');
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Non autorisé', details: err.message });
  }
}

/**
 * Enregistre toutes les routes auth sur l'app Express passée en paramètre
 */
function registerAuthRoutes(app) {

  // GET /auth/health — vérifie la config Supabase
  app.get('/auth/health', (req, res) => {
    res.json({
      success: true,
      supabase: {
        url:        SUPA_URL  ? '✅ configuré' : '❌ manquant',
        anonKey:    SUPA_ANON ? '✅ configuré' : '❌ manquant',
        serviceKey: process.env.SUPABASE_SERVICE_KEY ? '✅ configuré' : '❌ manquant'
      },
      callbackUrl: SUPA_URL ? `${SUPA_URL}/auth/v1/callback` : null
    });
  });

  // GET /auth/google/url — retourne l’URL OAuth Google
  app.get('/auth/google/url', (req, res) => {
    if (!SUPA_URL) {
      return res.status(503).json({ success: false, error: 'Supabase non configuré' });
    }
    const redirectTo = req.query.redirectTo
      || process.env.FRONTEND_URL
      || 'https://app.da-ka.live';
    const url = `${SUPA_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
    res.json({ success: true, url });
  });

  // GET /auth/me — infos utilisateur connecté (protégé)
  app.get('/auth/me', requireAuth, (req, res) => {
    const u = req.user;
    res.json({
      success: true,
      user: {
        id:        u.id,
        email:     u.email,
        name:      u.user_metadata?.full_name || u.user_metadata?.name || null,
        avatar:    u.user_metadata?.avatar_url || null,
        provider:  u.app_metadata?.provider || 'email',
        createdAt: u.created_at
      }
    });
  });

  console.log('✅ Auth routes registered: /auth/health | /auth/google/url | /auth/me');
}

module.exports = { registerAuthRoutes, requireAuth, supaAuth };
