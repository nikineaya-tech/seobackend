'use strict';

const crypto = require('crypto');

const REPORT_TYPES = new Set(['competitors', 'funnel', 'technical', 'keywords']);
const REPORT_QUOTA_OVERRIDES = new Map([
    ['59b72eaee5717910df3184989e434daaa9336eb7bbc955a6471546ccbc0d9fb0', { plan: 'owner_unlimited', unlimited: true, limit: null }],
    ['f06e9d63c577e061ae63094c2c58d53e112bea074a69d936a53731117fa81315', { plan: 'pro_200', unlimited: false, limit: 200 }]
]);

function resolveReportQuotaPolicy(email, defaultLimit) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const emailHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    return REPORT_QUOTA_OVERRIDES.get(emailHash) || {
        plan: 'free',
        unlimited: false,
        limit: defaultLimit
    };
}

function safeText(value, max = 240) {
    return String(value || '').trim().slice(0, max);
}

function extractPriceSnapshot(type, result) {
    if (type !== 'funnel' || !result || typeof result !== 'object') return null;
    const commerce = result.commerceExploration || {};
    const observed = commerce.observed || {};
    const recommended = commerce.recommended || {};

    return {
        observedMin: observed.priceStats?.min ?? null,
        observedMedian: observed.priceStats?.median ?? null,
        observedMax: observed.priceStats?.max ?? null,
        defensivePrice: recommended.defensivePrice ?? null,
        recommendedRange: recommended.recommendedRange ?? null,
        premiumPrice: recommended.premiumPrice ?? null,
        confidence: commerce.deduced?.pricingConfidence ?? null
    };
}

function buildReportRecord({ userId, type, input = {}, result = {}, title, targetUrl, query, sourceJobId }) {
    const rawInput = input && typeof input === 'object' ? input : {};
    const { _authUserId, async: _asyncMode, ...safeInput } = rawInput;
    const safeResult = result && typeof result === 'object' ? result : {};

    return {
        user_id: userId,
        type,
        title: safeText(
            title ||
            safeResult.query ||
            safeResult.url ||
            safeInput.query ||
            safeInput.url ||
            `${type} report`,
            180
        ),
        target_url: safeText(targetUrl || safeResult.url || safeInput.url, 1000) || null,
        query: safeText(query || safeResult.query || safeInput.query || safeInput.seedKeyword, 300) || null,
        input: safeInput,
        result: safeResult,
        price_snapshot: extractPriceSnapshot(type, safeResult),
        source_job_id: safeText(sourceJobId, 100) || null,
        share_token: crypto.randomUUID()
    };
}

async function saveGeneratedReportForUser(supabase, options) {
    const type = safeText(options?.type, 32);
    const userId = safeText(options?.userId, 100);

    if (!supabase) throw new Error('REPORT_STORAGE_NOT_CONFIGURED');
    if (!userId) throw new Error('REPORT_USER_REQUIRED');
    if (!REPORT_TYPES.has(type)) throw new Error('INVALID_REPORT_TYPE');

    const record = buildReportRecord({ ...options, userId, type });
    const mutation = record.source_job_id
        ? supabase.from('user_reports').upsert(record, { onConflict: 'source_job_id' })
        : supabase.from('user_reports').insert(record);
    const { data, error } = await mutation
        .select('id,type,title,target_url,query,is_public,share_token,created_at')
        .single();

    if (error) throw new Error(`REPORT_SAVE_FAILED: ${error.message}`);
    return data;
}

function registerReportRoutes(app, { supabase, requireAuth }) {
    const freeMonthlyQuota = Math.max(1, Number(process.env.FREE_REPORTS_PER_MONTH || 15));

    function ensureReportsConfigured(res) {
        if (supabase) return true;
        res.status(503).json({
            success: false,
            error: 'REPORT_STORAGE_NOT_CONFIGURED',
            message: 'Supabase service key is required for report storage.'
        });
        return false;
    }

    async function getQuota(userId, email = '') {
        const start = new Date();
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);
        const policy = resolveReportQuotaPolicy(email, freeMonthlyQuota);

        const { count, error } = await supabase
            .from('user_reports')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', start.toISOString());

        if (error) throw new Error(`REPORT_QUOTA_FAILED: ${error.message}`);

        const used = Number(count || 0);
        return {
            plan: policy.plan,
            unlimited: policy.unlimited,
            limit: policy.limit,
            used,
            remaining: policy.unlimited ? null : Math.max(0, policy.limit - used),
            resetsAt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString()
        };
    }

    async function requireReportQuota(req, res, next) {
        if (req.queueBypass === true) return next();
        if (!ensureReportsConfigured(res)) return;

        try {
            const quota = await getQuota(req.user.id, req.user.email);
            req.reportQuota = quota;
            if (!quota.unlimited && quota.remaining <= 0) {
                return res.status(429).json({
                    success: false,
                    error: 'FREE_QUOTA_EXHAUSTED',
                    message: `Quota mensuel atteint: ${quota.limit} rapports par mois.`,
                    quota
                });
            }
            return next();
        } catch (error) {
            return res.status(503).json({
                success: false,
                error: 'REPORT_QUOTA_UNAVAILABLE',
                message: error.message
            });
        }
    }

    function persistGeneratedReport(type) {
        return (req, res, next) => {
            const originalJson = res.json.bind(res);
            let responseStarted = false;

            res.json = function persistBeforeResponse(payload) {
                if (responseStarted) return res;
                responseStarted = true;

                const shouldSave =
                    payload &&
                    typeof payload === 'object' &&
                    payload.success === true &&
                    !payload.jobId &&
                    !payload.savedReport &&
                    req.user?.id;

                if (!shouldSave || !supabase) {
                    originalJson(payload);
                    return res;
                }

                saveGeneratedReportForUser(supabase, {
                    userId: req.user.id,
                    type,
                    input: req.body || {},
                    result: payload
                })
                    .then(async report => {
                        let quota = req.reportQuota || null;
                        try {
                            quota = await getQuota(req.user.id, req.user.email);
                        } catch (quotaError) {
                            console.warn('[Reports] quota refresh failed:', quotaError.message);
                        }
                        originalJson({ ...payload, savedReport: report, reportQuota: quota });
                    })
                    .catch(error => {
                        console.error(`[Reports] automatic ${type} save failed:`, error.message);
                        originalJson({
                            ...payload,
                            reportPersistence: {
                                saved: false,
                                error: 'REPORT_SAVE_FAILED'
                            }
                        });
                    });

                return res;
            };

            return next();
        };
    }

    app.get('/api/reports/quota', requireAuth, async (req, res) => {
        if (!ensureReportsConfigured(res)) return;
        try {
            return res.json({ success: true, quota: await getQuota(req.user.id, req.user.email) });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/reports', requireAuth, requireReportQuota, async (req, res) => {
        if (!ensureReportsConfigured(res)) return;

        const type = safeText(req.body?.type, 32);
        if (!REPORT_TYPES.has(type)) {
            return res.status(400).json({ success: false, error: 'INVALID_REPORT_TYPE' });
        }

        let data;
        try {
            data = await saveGeneratedReportForUser(supabase, {
                userId: req.user.id,
                type,
                input: req.body?.input,
                result: req.body?.result,
                title: req.body?.title,
                targetUrl: req.body?.targetUrl,
                query: req.body?.query
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(201).json({
            success: true,
            report: data,
            quota: await getQuota(req.user.id, req.user.email)
        });
    });

    app.get('/api/reports', requireAuth, async (req, res) => {
        if (!ensureReportsConfigured(res)) return;

        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
        let query = supabase
            .from('user_reports')
            .select('id,type,title,target_url,query,price_snapshot,is_public,share_token,created_at')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (REPORT_TYPES.has(req.query.type)) query = query.eq('type', req.query.type);
        const { data, error } = await query;

        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, reports: data || [], quota: await getQuota(req.user.id, req.user.email) });
    });

    app.get('/api/reports/price-history', requireAuth, async (req, res) => {
        if (!ensureReportsConfigured(res)) return;
        const targetUrl = safeText(req.query.targetUrl, 1000);
        if (!targetUrl) return res.status(400).json({ success: false, error: 'TARGET_URL_REQUIRED' });

        const { data, error } = await supabase
            .from('user_reports')
            .select('id,title,price_snapshot,created_at')
            .eq('user_id', req.user.id)
            .eq('type', 'funnel')
            .eq('target_url', targetUrl)
            .not('price_snapshot', 'is', null)
            .order('created_at', { ascending: true });

        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, targetUrl, history: data || [] });
    });

    app.get('/api/reports/:id', requireAuth, async (req, res) => {
        if (!ensureReportsConfigured(res)) return;
        const { data, error } = await supabase
            .from('user_reports')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (error || !data) return res.status(404).json({ success: false, error: 'REPORT_NOT_FOUND' });
        return res.json({ success: true, report: data });
    });

    app.patch('/api/reports/:id/share', requireAuth, async (req, res) => {
        if (!ensureReportsConfigured(res)) return;
        const isPublic = req.body?.isPublic !== false;
        const { data, error } = await supabase
            .from('user_reports')
            .update({ is_public: isPublic })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select('id,is_public,share_token')
            .single();

        if (error || !data) return res.status(404).json({ success: false, error: 'REPORT_NOT_FOUND' });
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        return res.json({
            success: true,
            isPublic: data.is_public,
            shareUrl: data.is_public ? `${baseUrl}/shared-report/${data.share_token}` : null
        });
    });

    app.get('/api/public/reports/:token', async (req, res) => {
        if (!ensureReportsConfigured(res)) return;
        const { data, error } = await supabase
            .from('user_reports')
            .select('id,type,title,target_url,query,result,price_snapshot,created_at')
            .eq('share_token', req.params.token)
            .eq('is_public', true)
            .single();

        if (error || !data) return res.status(404).json({ success: false, error: 'REPORT_NOT_FOUND' });
        return res.json({ success: true, report: data });
    });

    app.get('/shared-report/:token', async (req, res) => {
        if (!ensureReportsConfigured(res)) return;
        const { data, error } = await supabase
            .from('user_reports')
            .select('type,title,target_url,query,result,created_at')
            .eq('share_token', req.params.token)
            .eq('is_public', true)
            .single();

        if (error || !data) return res.status(404).send('Rapport introuvable ou non partagé.');
        const escaped = JSON.stringify(data.result, null, 2)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const title = safeText(data.title, 180).replace(/[<>&"]/g, '');
        return res.type('html').send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - Daka</title><style>
body{margin:0;background:#090d1d;color:#e5e7eb;font-family:Inter,Arial,sans-serif}
main{width:min(1100px,calc(100% - 32px));margin:32px auto}
h1{font-size:clamp(1.5rem,4vw,2.6rem);margin:0 0 8px}.meta{color:#94a3b8;margin-bottom:22px}
pre{white-space:pre-wrap;word-break:break-word;background:#12182d;border:1px solid #26304f;border-radius:8px;padding:18px;line-height:1.55}
</style></head><body><main><h1>${title}</h1><div class="meta">${data.type} · ${new Date(data.created_at).toLocaleDateString('fr-FR')}</div><pre>${escaped}</pre></main></body></html>`);
    });

    return { requireReportQuota, persistGeneratedReport, getQuota };
}

module.exports = { registerReportRoutes, saveGeneratedReportForUser, resolveReportQuotaPolicy };
