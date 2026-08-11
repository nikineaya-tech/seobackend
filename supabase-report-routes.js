'use strict';

const crypto = require('crypto');

const REPORT_TYPES = new Set(['competitors', 'funnel', 'technical', 'keywords']);
const PUBLIC_REPORT_FRONTEND_URL = process.env.PUBLIC_REPORT_FRONTEND_URL || 'https://marketinsight.mktnstrategix.com';

function safeText(value, max = 240) {
    return String(value || '').trim().slice(0, max);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function reportText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (Array.isArray(value)) return reportText(value[0]);
    if (typeof value === 'object') {
        return reportText(
            value.action || value.changeNow || value.recommendation || value.howTo ||
            value.title || value.name || value.opportunity || value.issue ||
            value.problem || value.weakness || value.value || value.description ||
            value.summary || value.verdict
        );
    }
    return '';
}

function reportList(values, limit = 5) {
    const out = [];
    const seen = new Set();
    const visit = value => {
        if (out.length >= limit || value === null || value === undefined) return;
        if (Array.isArray(value)) return value.forEach(visit);
        const text = reportText(value).replace(/\s+/g, ' ').trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key) || /^(—|-|null|undefined)$/i.test(text)) return;
        seen.add(key);
        out.push(text);
    };
    visit(values);
    return out.slice(0, limit);
}

function sharedReportLang(result = {}) {
    const raw = String(result.analysisLang || result.userLang || result.lang || result.language || 'fr')
        .toLowerCase()
        .slice(0, 2);
    return ['fr', 'en', 'ar'].includes(raw) ? raw : 'fr';
}

function buildReadableSharedReportHtml(data = {}) {
    const result = data.result && typeof data.result === 'object' ? data.result : {};
    const lang = sharedReportLang(result);
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    const dir = isAr ? 'rtl' : 'ltr';
    const labels = isAr ? {
        prepared: '\u062a\u0642\u0631\u064a\u0631 Daka \u0642\u0627\u0628\u0644 \u0644\u0644\u0645\u0634\u0627\u0631\u0643\u0629',
        open: '\u0647\u0630\u0627 \u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u0645\u062a\u0627\u062d \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0628\u0639\u062f \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644.',
        score: '\u0627\u0644\u0646\u062a\u064a\u062c\u0629',
        verdict: '\u0627\u0644\u062e\u0644\u0627\u0635\u0629',
        opportunities: '\u0623\u0641\u0636\u0644 \u0627\u0644\u0641\u0631\u0635',
        weaknesses: '\u0646\u0642\u0627\u0637 \u0627\u0644\u0627\u0646\u062a\u0628\u0627\u0647',
        actions: '\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0645\u0642\u062a\u0631\u062d\u0629',
        details: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0645\u062e\u062a\u0627\u0631\u0629',
        empty: '\u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u062a\u0642\u0631\u064a\u0631.'
    } : isEn ? {
        prepared: 'Shareable Daka report',
        open: 'This report is readable after sign-in.',
        score: 'Score',
        verdict: 'Verdict',
        opportunities: 'Top opportunities',
        weaknesses: 'Watch points',
        actions: 'Recommended actions',
        details: 'Selected details',
        empty: 'Not available in this report.'
    } : {
        prepared: 'Rapport Daka partageable',
        open: 'Ce rapport est consultable apr\u00e8s connexion.',
        score: 'Score',
        verdict: 'Verdict',
        opportunities: 'Top opportunit\u00e9s',
        weaknesses: 'Points d\u2019attention',
        actions: 'Actions recommand\u00e9es',
        details: 'D\u00e9tails s\u00e9lectionn\u00e9s',
        empty: 'Non disponible dans ce rapport.'
    };
    const title = safeText(data.title || result.title || result.query || result.url || `${data.type || 'Daka'} report`, 180);
    const score = [
        result.auditSummary?.overallScore,
        result.globalScoring?.overall,
        result.globalReport?.score,
        result.score,
        result.overallScore
    ].find(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
    const verdict = reportText(
        result.funnelSurgery?.pageQuality?.message ||
        result.funnelSurgery?.verdict?.summary ||
        result.executiveBrief?.priority ||
        result.auditSummary?.verdict ||
        result.globalReport?.verdict ||
        title
    );
    const opportunities = reportList([
        result.funnelPrimaryAnalysis?.present?.map(x => x.sectionType || x.section || x.name || x.title),
        result.auditSummary?.topStrengths,
        result.swot?.opportunities,
        result.quickWins
    ], 5);
    const weaknesses = reportList([
        result.funnelPrimaryAnalysis?.weak?.map(x => x.problem || x.sectionType || x.section || x.reason),
        result.auditSummary?.topWeaknesses,
        result.criticalIssues,
        result.auditIssues,
        result.swot?.weaknesses
    ], 5);
    const actions = reportList([
        result.funnelSurgery?.priorityPlan?.now,
        result.funnelSurgery?.priorityPlan?.sevenDays,
        result.concreteActionPlan?.map(x => x.changeNow || x.action),
        result.auditQuickWins?.map(x => x.title || x.howTo),
        result.recommendations
    ], 7);
    const details = reportList([
        result.funnelSurgery?.messagePromiseCta?.proposedH1,
        result.funnelSurgery?.messagePromiseCta?.proposedCta,
        result.funnelSurgery?.offerDetected?.offerType,
        result.target_url || data.target_url || data.query
    ], 8);
    const listHtml = items => items.length
        ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : `<p class="muted">${escapeHtml(labels.empty)}</p>`;
    const date = data.created_at ? new Date(data.created_at).toLocaleDateString(isAr ? 'ar' : isEn ? 'en-US' : 'fr-FR') : '';
    return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} - Daka</title>
<style>
body{margin:0;background:#f8fafc;color:#020617;font-family:Inter,Arial,sans-serif;line-height:1.55}
main{width:min(1040px,calc(100% - 32px));margin:28px auto 46px}
.hero{padding:28px;border-radius:18px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#f8fafc;box-shadow:0 18px 46px rgba(15,23,42,.2)}
.kicker{color:#7dd3fc;font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
h1{font-size:clamp(1.65rem,4vw,3rem);line-height:1.08;margin:10px 0 10px}
.meta{color:#cbd5e1}.score{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:8px 12px;border:1px solid rgba(125,211,252,.32);border-radius:999px;background:rgba(14,165,233,.12);font-weight:900}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}
section{padding:20px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.06)}
section.full{grid-column:1/-1}h2{margin:0 0 10px;font-size:1.05rem;color:#0f172a}ul{margin:0;padding-inline-start:22px}li+li{margin-top:7px}.muted{color:#64748b}.details{display:grid;gap:8px}.details span{padding:10px 12px;border-radius:12px;background:#f1f5f9;color:#334155;overflow-wrap:anywhere}
@media(max-width:760px){main{width:min(100% - 18px,1040px);margin-top:12px}.hero{padding:20px}.grid{grid-template-columns:1fr}section{padding:16px}}
</style>
</head>
<body><main>
<article class="hero">
<div class="kicker">${escapeHtml(labels.prepared)}</div>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(labels.open)} ${date ? `· ${escapeHtml(date)}` : ''}</p>
${score !== undefined ? `<div class="score">${escapeHtml(labels.score)} ${Math.round(Number(score))}/100</div>` : ''}
</article>
<div class="grid">
<section class="full"><h2>${escapeHtml(labels.verdict)}</h2><p>${escapeHtml(verdict || title)}</p></section>
<section><h2>${escapeHtml(labels.opportunities)}</h2>${listHtml(opportunities)}</section>
<section><h2>${escapeHtml(labels.weaknesses)}</h2>${listHtml(weaknesses)}</section>
<section class="full"><h2>${escapeHtml(labels.actions)}</h2>${listHtml(actions)}</section>
${details.length ? `<section class="full"><h2>${escapeHtml(labels.details)}</h2><div class="details">${details.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div></section>` : ''}
</div>
</main></body></html>`;
}

function buildSharedReportGateHtml({ token = '', title = '' } = {}) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    const safeTitle = safeText(title || 'Daka shared report', 180);
    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(safeTitle)} - Daka</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020617;color:#f8fafc;font-family:Inter,Arial,sans-serif}
main{width:min(760px,calc(100% - 32px));padding:28px;border:1px solid rgba(125,211,252,.22);border-radius:22px;background:radial-gradient(circle at 10% 0%,rgba(34,211,238,.15),transparent 32%),linear-gradient(145deg,#0f172a,#050816);box-shadow:0 24px 70px rgba(0,0,0,.36)}
.kicker{color:#7dd3fc;font-size:.75rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}h1{font-size:clamp(1.8rem,5vw,3.2rem);line-height:1.05;margin:12px 0}p{color:#cbd5e1;line-height:1.65}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}a{min-height:44px;padding:10px 15px;border-radius:999px;border:1px solid rgba(125,211,252,.24);background:#10213a;color:#e0f2fe;text-decoration:none;font-weight:900;display:inline-flex;align-items:center}.primary{background:linear-gradient(135deg,#22c55e,#06b6d4);color:#03111c;border:0}.error{color:#fecaca}
</style>
</head>
<body>
<main>
<div class="kicker">Daka Market Intelligence Spyer</div>
<h1 id="title">Rapport partagé</h1>
<p id="status">Vérification de votre accès au rapport...</p>
<div class="actions" id="actions"></div>
</main>
<script>
const SHARED_TOKEN = ${JSON.stringify(String(token || ''))};
const SUPABASE_URL = ${JSON.stringify(String(supabaseUrl || ''))};
const SUPABASE_ANON_KEY = ${JSON.stringify(String(supabaseAnonKey || ''))};
const title = document.getElementById('title');
const status = document.getElementById('status');
const actions = document.getElementById('actions');
function showSubscribe(message){
  title.textContent = 'Ce rapport est réservé aux abonnés Daka';
  status.textContent = message || 'Connectez-vous avec un compte abonné pour consulter ce rapport partagé.';
  actions.innerHTML = '<a class="primary" href="/#pricing">S\\'abonner</a><a href="/">Se connecter</a>';
}
async function boot(){
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) return showSubscribe('Connexion requise pour vérifier votre abonnement.');
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const sessionResult = await client.auth.getSession();
    const accessToken = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
    if (!accessToken) return showSubscribe('Connectez-vous avec votre compte abonné pour ouvrir ce rapport.');
    const response = await fetch('/api/public/reports/' + encodeURIComponent(SHARED_TOKEN), {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 402) return showSubscribe(payload.message || 'Votre compte doit être abonné pour consulter ce rapport.');
    if (!response.ok || !payload.html) throw new Error(payload.message || 'Rapport indisponible.');
    document.open();
    document.write(payload.html);
    document.close();
  } catch (error) {
    title.textContent = 'Rapport indisponible';
    status.textContent = error.message || 'Impossible de charger ce rapport.';
    status.className = 'error';
    actions.innerHTML = '<a href="/">Retour à Daka</a>';
  }
}
boot();
</script>
</body>
</html>`;
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
function getQuotaPolicy(email = '') {
    const e = String(email || '').trim().toLowerCase();

    if (e === 'nikineaya@gmail.com') {
        return { plan: 'owner_unlimited', unlimited: true, limit: null };
    }

    if (e === 'ecm00bcm@gmail.com') {
        return { plan: 'pro_150', unlimited: false, limit: 150 };
    }

    return { plan: 'free', unlimited: false, limit: freeMonthlyQuota };
}
    function ensureReportsConfigured(res) {
        if (supabase) return true;
        res.status(503).json({
            success: false,
            error: 'REPORT_STORAGE_NOT_CONFIGURED',
            message: 'Supabase service key is required for report storage.'
        });
        return false;
    }

    async function getViewerFromRequest(req) {
        const authHeader = String(req.headers.authorization || '');
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!match) return null;
        const { data, error } = await supabase.auth.getUser(match[1]);
        if (error || !data?.user) return null;
        return {
            id: data.user.id,
            email: data.user.email || data.user.user_metadata?.email || ''
        };
    }

    function canViewSharedReport(viewer) {
        if (!viewer) return false;
        const policy = getQuotaPolicy(viewer.email);
        return policy.unlimited || policy.plan !== 'free';
    }

    async function getQuota(userId, email = '') {
        const start = new Date();
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);

        const { count, error } = await supabase
            .from('user_reports')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', start.toISOString());

        if (error) throw new Error(`REPORT_QUOTA_FAILED: ${error.message}`);

        const used = Number(count || 0);
        const policy = getQuotaPolicy(email);

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
                    message: 'Quota gratuit atteint: 15 rapports par mois.',
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
        const { data: existing, error: readError } = await supabase
            .from('user_reports')
            .select('share_token')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();
        if (readError || !existing) return res.status(404).json({ success: false, error: 'REPORT_NOT_FOUND' });
        const shareToken = existing.share_token || crypto.randomUUID();
        const { data, error } = await supabase
            .from('user_reports')
            .update({
                is_public: isPublic,
                ...(isPublic ? { share_token: shareToken } : {})
            })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select('id,is_public,share_token')
            .single();

        if (error || !data) return res.status(404).json({ success: false, error: 'REPORT_NOT_FOUND' });
        const encodedToken = data.is_public ? encodeURIComponent(data.share_token) : null;
        const sharePath = encodedToken ? `/app?sharedReport=${encodedToken}` : null;
        const legacySharePath = encodedToken ? `/shared-report/${encodedToken}` : null;
        return res.json({
            success: true,
            isPublic: data.is_public,
            shareToken: data.share_token,
            sharePath,
            shareUrl: sharePath ? `${PUBLIC_REPORT_FRONTEND_URL}${sharePath}` : null,
            legacySharePath,
            legacyShareUrl: legacySharePath ? `${PUBLIC_REPORT_FRONTEND_URL}${legacySharePath}` : null
        });
    });

    app.get('/api/public/reports/:token', async (req, res) => {
        if (!ensureReportsConfigured(res)) return;
        const { data, error } = await supabase
            .from('user_reports')
            .select('id,user_id,type,title,target_url,query,result,price_snapshot,created_at')
            .eq('share_token', req.params.token)
            .eq('is_public', true)
            .single();

        if (error || !data) return res.status(404).json({ success: false, error: 'REPORT_NOT_FOUND' });
        const viewer = await getViewerFromRequest(req);
        if (!viewer) {
            return res.status(401).json({
                success: false,
                error: 'LOGIN_REQUIRED',
                message: 'Connectez-vous avec un compte abonné pour consulter ce rapport.'
            });
        }
        if (!canViewSharedReport(viewer)) {
            return res.status(402).json({
                success: false,
                error: 'SUBSCRIPTION_REQUIRED',
                message: 'Ce rapport partagé est réservé aux comptes abonnés Daka.'
            });
        }
        return res.json({ success: true, report: data, html: buildReadableSharedReportHtml(data) });
    });

    app.get('/shared-report/:token', async (req, res) => {
        const token = String(req.params.token || '').trim();
        const redirectUrl = `${PUBLIC_REPORT_FRONTEND_URL}/app?sharedReport=${encodeURIComponent(token)}`;
        return res.redirect(302, redirectUrl);
    });

    return { requireReportQuota, persistGeneratedReport, getQuota };
}

module.exports = { registerReportRoutes, saveGeneratedReportForUser };
