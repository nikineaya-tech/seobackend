'use strict';

const { createClient } = require('@supabase/supabase-js');

function normalizeRedirect(rawUrl, allowedOrigins) {
    try {
        const url = new URL(rawUrl);
        return allowedOrigins.has(url.origin) ? url.href : null;
    } catch {
        return null;
    }
}

function registerAuthRoutes(app) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
    const authClient = supabaseUrl && anonKey
        ? createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        })
        : null;
    const verifierClient = supabaseUrl && (serviceKey || anonKey)
        ? createClient(supabaseUrl, serviceKey || anonKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        })
        : null;
    const allowedOrigins = new Set([
        'https://seo.mktnstrategix.com',
        'https://app.da-ka.live',
        'http://localhost:10000',
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        ...String(process.env.AUTH_REDIRECT_ORIGINS || '')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
    ]);

    async function getUserFromRequest(req) {
        if (!verifierClient) return { user: null, error: 'AUTH_NOT_CONFIGURED' };

        const authorization = req.get('authorization') || '';
        const token = authorization.startsWith('Bearer ')
            ? authorization.slice(7).trim()
            : '';
        if (!token) return { user: null, error: 'AUTH_REQUIRED' };

        const { data, error } = await verifierClient.auth.getUser(token);
        return {
            user: data?.user || null,
            error: error?.message || (!data?.user ? 'INVALID_SESSION' : null)
        };
    }

    async function requireAuth(req, res, next) {
        if (req.queueBypass === true) return next();

        const { user, error } = await getUserFromRequest(req);
        if (!user) {
            return res.status(error === 'AUTH_NOT_CONFIGURED' ? 503 : 401).json({
                success: false,
                authenticated: false,
                error,
                message: error === 'AUTH_NOT_CONFIGURED'
                    ? 'Authentication is not configured.'
                    : 'Connectez-vous pour lancer une analyse.'
            });
        }

        req.user = user;
        return next();
    }

    app.get('/auth/health', (req, res) => {
        res.json({
            success: true,
            supabase: {
                url: Boolean(supabaseUrl),
                anonKey: Boolean(anonKey),
                serviceKey: Boolean(serviceKey)
            },
            authEnabled: Boolean(authClient && verifierClient)
        });
    });

    app.get('/auth/config', (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            enabled: Boolean(authClient),
            supabaseUrl: authClient ? supabaseUrl : null,
            anonKey: authClient ? anonKey : null,
            provider: 'google'
        });
    });

    app.get('/auth/google/url', async (req, res) => {
        if (!authClient) {
            return res.status(503).json({
                success: false,
                error: 'AUTH_NOT_CONFIGURED',
                message: 'SUPABASE_ANON_KEY is missing.'
            });
        }

        const fallbackOrigin = allowedOrigins.has(req.get('origin'))
            ? req.get('origin')
            : 'https://seo.mktnstrategix.com';
        const redirectTo = normalizeRedirect(
            req.query.redirectTo || fallbackOrigin,
            allowedOrigins
        );

        if (!redirectTo) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REDIRECT'
            });
        }

        const { data, error } = await authClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                skipBrowserRedirect: true
            }
        });

        if (error || !data?.url) {
            return res.status(500).json({
                success: false,
                error: error?.message || 'GOOGLE_AUTH_URL_FAILED'
            });
        }

        return res.json({ success: true, url: data.url });
    });

    app.get('/auth/me', async (req, res) => {
        if (!verifierClient) {
            return res.status(503).json({
                authenticated: false,
                error: 'AUTH_NOT_CONFIGURED'
            });
        }

        const { user, error } = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({
                authenticated: false,
                user: null,
                error
            });
        }

        return res.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email || null,
                name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || null,
                avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
            }
        });
    });

    console.log(authClient
        ? '[Auth] Supabase Google auth routes enabled'
        : '[Auth] SUPABASE_ANON_KEY missing - auth UI will remain available but disabled');

    return {
        authEnabled: Boolean(authClient && verifierClient),
        getUserFromRequest,
        requireAuth
    };
}

module.exports = { registerAuthRoutes };
