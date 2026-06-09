'use strict';
// ═══════════════════════════════════════════════════
// SUPABASE AUTH MIDDLEWARE — Daka Pro
// Google OAuth + JWT verification + route protection
// ═══════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn('⚠️  SUPABASE_URL ou SUPABASE_ANON_KEY manquante — auth désactivée');
}

// Client public (vérification tokens côté backend)
const supabasePublic = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Client admin (opérations serveur uniquement)
const supabaseAdmin = process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

/**
 * Middleware : vérifie le JWT Supabase dans Authorization: Bearer <token>
 * Usage : app.get('/api/protected', requireAuth, handler)
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token manquant — connectez-vous' });
  }

  try {
    const { data: { user }, error } = await supabasePublic.auth.getUser(token);
    if (error || !user) throw new Error(error?.message || 'Token invalide');
    req.user = user;
    next();
  } catch (err) {
    console.warn('🔒 Auth failed:', err.message);
    return res.status(401).json({ success: false, error: 'Non autorisé', details: err.message });
  }
}

/**
 * GET /auth/google/url
 * Retourne l'URL de redirection Google OAuth
 */
function getGoogleOAuthUrl(req, res) {
  const redirectTo = req.query.redirectTo || process.env.FRONTEND_URL || 'https://app.da-ka.live';
  const url = `${process.env.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  res.json({ success: true, url });
}

/**
 * GET /auth/me  (protégé par requireAuth)
 * Retourne les infos de l'utilisateur connecté
 */
function getMe(req, res) {
  const u = req.user;
  res.json({
    success: true,
    user: {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.full_name || u.user_metadata?.name || null,
      avatar: u.user_metadata?.avatar_url || null,
      provider: u.app_metadata?.provider || 'email',
      createdAt: u.created_at
    }
  });
}

/**
 * GET /auth/health
 * Vérifie que Supabase est bien configuré
 */
function authHealth(req, res) {
  res.json({
    success: true,
    supabase: {
      url: process.env.SUPABASE_URL ? '✅ configuré' : '❌ manquant',
      anonKey: process.env.SUPABASE_ANON_KEY ? '✅ configuré' : '❌ manquant',
      serviceKey: process.env.SUPABASE_SERVICE_KEY ? '✅ configuré' : '❌ manquant'
    }
  });
}

module.exports = { supabasePublic, supabaseAdmin, requireAuth, getGoogleOAuthUrl, getMe, authHealth };
