'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function normalizeRedirect(rawUrl, allowedOrigins) {
    try {
        const url = new URL(rawUrl);
        return allowedOrigins.has(url.origin) ? url.href : null;
    } catch {
        return null;
    }
}

function getBearerToken(req) {
    const authorization = req.get('authorization') || '';
    return authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : '';
}

function hashAdminToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function normalizeAuthUser(user) {
    const metadata = user.user_metadata || {};
    const appMetadata = user.app_metadata || {};
    return {
        id: user.id,
        email: user.email || null,
        name: metadata.full_name || metadata.name || metadata.display_name || user.email || null,
        avatarUrl: metadata.avatar_url || metadata.picture || null,
        provider: appMetadata.provider || (Array.isArray(user.identities) && user.identities[0]?.provider) || null,
        providers: Array.isArray(user.identities) ? user.identities.map(identity => identity.provider).filter(Boolean) : [],
        createdAt: user.created_at || null,
        confirmedAt: user.confirmed_at || user.email_confirmed_at || null,
        lastSignInAt: user.last_sign_in_at || null,
        phone: user.phone || null
    };
}

function registerAuthRoutes(app) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const publicSupabaseUrl = String(process.env.SUPABASE_PUBLIC_URL || supabaseUrl).replace(/\/+$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
    const publicAuthRedirectUrl = String(
        process.env.AUTH_REDIRECT_URL ||
        process.env.FRONTEND_URL ||
        'https://marketinsight.mktnstrategix.com/app'
    ).trim();
    const authClient = publicSupabaseUrl && anonKey
        ? createClient(publicSupabaseUrl, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        })
        : null;
    const verifierClient = supabaseUrl && (serviceKey || anonKey)
        ? createClient(supabaseUrl, serviceKey || anonKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        })
        : null;
    const adminClient = supabaseUrl && serviceKey
        ? createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        })
        : null;
    const allowedOrigins = new Set([
        'https://marketinsight.mktnstrategix.com',
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

        const token = getBearerToken(req);
        if (!token) return { user: null, error: 'AUTH_REQUIRED' };

        const { data, error } = await verifierClient.auth.getUser(token);
        return {
            user: data?.user || null,
            error: error?.message || (!data?.user ? 'INVALID_SESSION' : null)
        };
    }

    async function getAdminFromRequest(req) {
        if (!adminClient) return { admin: null, error: 'ADMIN_AUTH_NOT_CONFIGURED' };

        const token = getBearerToken(req);
        if (!token) return { admin: null, error: 'ADMIN_AUTH_REQUIRED' };

        const tokenHash = hashAdminToken(token);
        const columnsToTry = ['token_hash', 'session_hash', 'session_token_hash'];
        let lastError = null;

        for (const column of columnsToTry) {
            const { data, error } = await adminClient
                .from('daka_admin_sessions')
                .select('*')
                .eq(column, tokenHash)
                .maybeSingle();

            if (error) {
                lastError = error;
                continue;
            }

            if (!data) continue;
            if (data.revoked_at) return { admin: null, error: 'ADMIN_SESSION_REVOKED' };
            if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
                return { admin: null, error: 'ADMIN_SESSION_EXPIRED' };
            }
            return { admin: data, error: null };
        }

        return { admin: null, error: lastError?.message || 'ADMIN_SESSION_NOT_FOUND' };
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
        const requestOrigin = req.get('origin') || '';
        const isLocalRequest = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
        res.json({
            enabled: Boolean(authClient),
            supabaseUrl: authClient ? publicSupabaseUrl : null,
            anonKey: authClient ? anonKey : null,
            provider: 'google',
            redirectUrl: isLocalRequest ? requestOrigin : publicAuthRedirectUrl
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
            : publicAuthRedirectUrl;
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

    app.get('/auth/admin/users', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const { admin, error: adminError } = await getAdminFromRequest(req);
        if (!admin) {
            return res.status(401).json({
                success: false,
                error: adminError || 'ADMIN_AUTH_REQUIRED'
            });
        }

        try {
            const users = [];
            let page = 1;
            const perPage = 100;
            while (page <= 10) {
                const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
                if (error) throw error;
                const batch = Array.isArray(data?.users) ? data.users : [];
                users.push(...batch.map(normalizeAuthUser));
                if (batch.length < perPage) break;
                page += 1;
            }

            return res.json({
                success: true,
                source: 'supabase-auth',
                total: users.length,
                users
            });
        } catch (error) {
            console.error('[AuthAdmin] list users failed:', error);
            return res.status(500).json({
                success: false,
                error: 'SUPABASE_AUTH_USERS_UNAVAILABLE'
            });
        }
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