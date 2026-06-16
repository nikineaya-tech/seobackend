'use strict';

// ═══════════════════════════════════════════════════════════════════
// JOB PROCESSORS — Multi-Agent Engine
// Architecture: Railway Worker → processJob() → handler par type
//
// Types standards :
//   funnel | technical | competitors | keywords
// Types scraping simples :
//   scrape_funnel | scrape_product | scrape_competitors
// Types scraping multi-agent (Orchestrateur) :
//   deep-scrape         → 1 URL → orchestrateFunnelExploration()
//   scrape_funnel_multi → N URLs → batch orchestrateFunnelExploration()
// ═══════════════════════════════════════════════════════════════════

const axios = require('axios');
const { app } = require('./server');
const { orchestrateFunnelExploration } = require('./scraper-orchestrator');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const ROUTES = {
    funnel:      '/api/analyze-funnel',
    technical:   '/api/technical-seo',
    competitors: '/api/competitors',
    keywords:    '/api/generate-keywords',
};

const JOB_TIMEOUTS = {
    funnel:              Number(process.env.TIMEOUT_FUNNEL        || 180000), // 3 min
    technical:           Number(process.env.TIMEOUT_TECHNICAL     || 120000), // 2 min
    competitors:         Number(process.env.TIMEOUT_COMPETITORS   || 120000), // 2 min
    keywords:            Number(process.env.TIMEOUT_KEYWORDS      || 60000),  // 1 min
    scrape_funnel:       Number(process.env.TIMEOUT_SCRAPE        || 60000),  // 1 min
    scrape_product:      Number(process.env.TIMEOUT_SCRAPE        || 60000),
    scrape_competitors:  Number(process.env.TIMEOUT_SCRAPE        || 90000),  // 1.5 min
    scrape_funnel_multi: Number(process.env.TIMEOUT_MULTI         || 120000), // 2 min
    default:             Number(process.env.WORKER_JOB_TIMEOUT_MS || 180000),
};

const RENDER1_URL = process.env.RENDER1_URL || process.env.API_BASE_URL || '';

function compactText(value, max = 700) {
    if (typeof value !== 'string') return value;
    const clean = value.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function normalizeRailwayPriceCandidate(item = {}) {
    const value = Number(item.value ?? item.price ?? item.amount);
    const currency = item.currency || null;
    const hasCurrency = Boolean(currency);
    let rejectedReason = null;
    if (!Number.isFinite(value) || value <= 0) rejectedReason = 'not_numeric';
    else if (!hasCurrency) rejectedReason = 'missing_currency';
    else if (value < 10 && !/USD|EUR|GBP/i.test(String(currency))) rejectedReason = 'too_low_for_currency';
    return {
        value: Number.isFinite(value) ? value : null,
        currency,
        period: item.period || null,
        source: item.source || 'railway-orchestrator',
        context: compactText(item.context || item.raw || '', 220),
        confidence: rejectedReason ? 'INVALID' : 'MEDIUM',
        rejectedReason
    };
}

function compactRailwayFunnelResult(result = {}, url = '') {
    const analysis = result.funnelAnalysis || {};
    const commerce = result.commerceExploration || {};
    const evidenceLinks = Array.isArray(commerce.evidenceLinks) ? commerce.evidenceLinks : [];
    const uncertainLinks = Array.isArray(commerce.uncertainLinks) ? commerce.uncertainLinks : [];
    const negativeSummaries = Array.isArray(commerce.negativeSummaries) ? commerce.negativeSummaries : [];
    const priceCandidates = (Array.isArray(analysis.prices) ? analysis.prices : [])
        .map(normalizeRailwayPriceCandidate);
    const validPrices = priceCandidates.filter(p => !p.rejectedReason && Number.isFinite(p.value));
    const rejectedPriceCandidates = priceCandidates.filter(p => p.rejectedReason).slice(0, 12);
    const values = validPrices.map(p => p.value).sort((a, b) => a - b);
    const priceStats = values.length ? {
        min: values[0],
        max: values[values.length - 1],
        median: values[Math.floor(values.length / 2)],
        count: values.length,
        currency: validPrices.find(p => p.currency)?.currency || null
    } : null;

    return {
        success: Boolean(result.success),
        url,
        executionLayer: 'railway',
        mainPage: result.mainPage ? {
            url: result.mainPage.url || url,
            title: compactText(result.mainPage.title || '', 180),
            metaDescription: compactText(result.mainPage.metaDescription || '', 320),
            h1: compactText(result.mainPage.h1 || '', 180),
            headings: {
                h1: (result.mainPage.headings?.h1 || []).slice(0, 5).map(x => compactText(x, 160)),
                h2: (result.mainPage.headings?.h2 || []).slice(0, 10).map(x => compactText(x, 160)),
                h3: (result.mainPage.headings?.h3 || []).slice(0, 10).map(x => compactText(x, 160))
            },
            ctas: (result.mainPage.ctas || []).slice(0, 12).map(x => ({ text: compactText(x.text || x, 120) })),
            prices: (result.mainPage.prices || []).map(normalizeRailwayPriceCandidate).filter(p => !p.rejectedReason).slice(0, 12),
            trustSignals: result.mainPage.trustSignals || {},
            sections: result.mainPage.sections || {},
            images: (result.mainPage.images || []).slice(0, 12).map(img => ({
                src: img.src,
                alt: compactText(img.alt || '', 100)
            })),
            internalLinks: (result.mainPage.internalLinks || []).slice(0, 18).map(link => ({
                url: link.url,
                label: compactText(link.label || link.url || '', 140)
            })),
            textPreview: compactText(result.mainPage.textPreview || '', 900),
            wordCount: result.mainPage.wordCount || 0,
            language: result.mainPage.language || ''
        } : null,
        exploration: {
            pagesExplored: result.exploration?.pagesExplored || 0,
            pagesWithData: result.exploration?.pagesWithData || 0,
            pagesUncertain: result.exploration?.pagesUncertain || 0,
            pagesEmpty: result.exploration?.pagesEmpty || 0,
            totalElapsedMs: result.exploration?.totalElapsedMs || null
        },
        funnelAnalysis: {
            priceStats,
            prices: validPrices.slice(0, 20),
            rejectedPriceCandidates,
            priceConfidence: validPrices.length >= 2 ? 'HIGH' : validPrices.length === 1 ? 'MEDIUM' : (priceCandidates.length ? 'INVALID' : 'LOW'),
            priceExtractionReason: validPrices.length ? 'railway_confirmed_price_candidates' : (priceCandidates.length ? 'railway_candidates_rejected_or_unconfirmed' : 'railway_no_price_detected'),
            positioning: analysis.positioning || 'unknown',
            confidence: analysis.confidence || 'low',
            trustSignals: analysis.trustSignals || {},
            plansFound: Array.isArray(analysis.plansFound) ? analysis.plansFound.slice(0, 10) : [],
            ctasFound: Array.isArray(analysis.ctasFound) ? analysis.ctasFound.slice(0, 12) : []
        },
        commerceExploration: {
            evidenceLinks: evidenceLinks.slice(0, 12).map(link => ({
                url: link.url,
                type: link.type,
                confidence: link.confidence,
                priceCount: link.priceCount || 0,
                prices: (link.prices || []).map(normalizeRailwayPriceCandidate).filter(p => !p.rejectedReason).slice(0, 5),
                plans: (link.plans || []).slice(0, 6),
                ctas: (link.ctas || []).slice(0, 8),
                trust: link.trust || {},
                elapsedMs: link.elapsedMs || null,
                summary: compactText(link.summary || '', 320)
            })),
            uncertainLinks: uncertainLinks.slice(0, 8).map(link => ({
                url: link.url,
                type: link.type,
                confidence: link.confidence,
                summary: compactText(link.summary || link.partialText || '', 320)
            })),
            negativeSummaries: negativeSummaries.slice(0, 8).map(link => ({
                url: link.url,
                type: link.type,
                reason: compactText(link.reason || '', 240)
            }))
        },
        verdict: {
            yesCount: result.yesCount || 0,
            maybeCount: result.maybeCount || 0,
            noCount: result.noCount || 0,
            confidence: analysis.confidence || 'low',
            positioning: analysis.positioning || 'unknown'
        },
        limits: {
            noRawHtmlReturned: true,
            maxEvidenceLinks: 12,
            maxTextPerField: 700
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// CORE: FIND HANDLER IN EXPRESS APP
// ═══════════════════════════════════════════════════════════════════

function findBusinessHandler(path) {
    const routeLayer = app?._router?.stack?.find(layer =>
        layer.route?.path === path &&
        layer.route?.methods?.post === true
    );

    const handlers      = routeLayer?.route?.stack || [];
    const businessLayer = handlers[handlers.length - 1];

    if (!businessLayer?.handle) throw new Error(`No business handler registered for ${path}`);
    return businessLayer.handle;
}

// ═══════════════════════════════════════════════════════════════════
// CORE: RUN HANDLER VIA MOCK REQ/RES (in-process, no HTTP overhead)
// ═══════════════════════════════════════════════════════════════════

function runBusinessHandler(path, payload = {}, timeoutMs) {
    const handler = findBusinessHandler(path);
    const body = { ...(payload || {}) };
    const authUserId = body._authUserId || null;
    delete body.async;
    delete body._authUserId;

    const timeout = timeoutMs || JOB_TIMEOUTS.default;

    return new Promise((resolve, reject) => {
        let settled = false;

        const finish = (cb, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            cb(value);
        };

        const req = {
            body, method: 'POST', path, originalUrl: path,
            headers:     { 'x-daka-worker-bypass': '1' },
            queueBypass: true,
            ip:          'railway-worker',
            user:        authUserId ? { id: authUserId } : null,
            get(name)   { return this.headers[String(name || '').toLowerCase()]; },
        };

        const res = {
            statusCode: 200,
            _headers:   {},
            status(code)       { this.statusCode = code; return this; },
            set(name, value)   { this._headers[String(name).toLowerCase()] = value; return this; },
            setHeader(n, v)    { this._headers[String(n).toLowerCase()] = v; },
            json(data) {
                if (this.statusCode >= 400) {
                    const err = new Error(data?.message || data?.error || `HTTP ${this.statusCode}`);
                    err.statusCode = this.statusCode;
                    err.response   = data;
                    finish(reject, err);
                } else {
                    finish(resolve, data);
                }
                return this;
            },
            send(data) { return this.json(data); },
            end(data)  { return this.json(data || {}); },
        };

        const next = (err) => finish(reject, err || new Error(`Unexpected next() from ${path}`));

        const timer = setTimeout(() => {
            finish(reject, Object.assign(
                new Error(`Job timeout after ${timeout}ms for ${path}`),
                { code: 'JOB_TIMEOUT' }
            ));
        }, timeout);

        Promise.resolve(handler(req, res, next)).catch(err => finish(reject, err));
    });
}

// ═══════════════════════════════════════════════════════════════════
// SCRAPE JOBS SIMPLES — Via HTTP/Render ou handler interne
// ═══════════════════════════════════════════════════════════════════

async function processScrapeFunnel(payload) {
    const { url, lang, userPriceRange, budget } = payload;
    if (!url) throw new Error('scrape_funnel: url required');

    try {
        return await runBusinessHandler(
            '/api/analyze-funnel',
            { url, lang, userPriceRange, scrapeOnly: true },
            JOB_TIMEOUTS.scrape_funnel
        );
    } catch (err) {
        if (!RENDER1_URL) throw err;
        console.warn(`[Processor] scrape_funnel internal failed, HTTP fallback: ${err.message}`);
        const res = await axios.post(`${RENDER1_URL}/api/analyze-funnel`, {
            url, lang, userPriceRange, budget, _workerBypass: true
        }, { timeout: JOB_TIMEOUTS.scrape_funnel, headers: { 'x-daka-worker-bypass': '1' } });
        return res.data;
    }
}

async function processScrapeProduct(payload) {
    const { url, lang } = payload;
    if (!url) throw new Error('scrape_product: url required');

    try {
        return await runBusinessHandler(
            '/api/analyze-funnel',
            { url, lang, mode: 'product', scrapeOnly: true },
            JOB_TIMEOUTS.scrape_product
        );
    } catch (err) {
        if (!RENDER1_URL) throw err;
        const res = await axios.post(`${RENDER1_URL}/api/analyze-funnel`, {
            url, lang, mode: 'product'
        }, { timeout: JOB_TIMEOUTS.scrape_product, headers: { 'x-daka-worker-bypass': '1' } });
        return res.data;
    }
}

async function processScrapeCompetitors(payload) {
    const { urls, lang, geo } = payload;
    if (!urls?.length) throw new Error('scrape_competitors: urls[] required');

    const BATCH = 3;
    const results = [];

    for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);
        console.log(`[Processor] scrape_competitors batch ${Math.floor(i / BATCH) + 1}: ${batch.length} urls`);

        const batchResults = await Promise.allSettled(
            batch.map(url =>
                RENDER1_URL
                    ? axios.post(`${RENDER1_URL}/api/analyze-funnel`,
                        { url, lang, geo, mode: 'competitor', scrapeOnly: true },
                        { timeout: 30000, headers: { 'x-daka-worker-bypass': '1' } }
                      ).then(r => r.data)
                    : runBusinessHandler(
                        '/api/analyze-funnel',
                        { url, lang, geo, mode: 'competitor', scrapeOnly: true },
                        30000
                      )
            )
        );

        batchResults.forEach((r, idx) => {
            results.push(r.status === 'fulfilled'
                ? { url: batch[idx], success: true,  data:  r.value }
                : { url: batch[idx], success: false, error: r.reason?.message }
            );
        });
    }

    return {
        success: true,
        total:   urls.length,
        done:    results.filter(r => r.success).length,
        failed:  results.filter(r => !r.success).length,
        results,
    };
}

// ═══════════════════════════════════════════════════════════════════
// SCRAPE JOBS DEEP (MULTI-AGENT ORCHESTRATEUR)
// ═══════════════════════════════════════════════════════════════════

/**
 * deep-scrape : explore 1 URL en profondeur avec l'orchestrateur
 * Payload: { url, lang?, userPriceRange?, maxCandidates?, maxConcurrentTabs? }
 */
async function processScrapeFunnelDeep(payload) {
    const { url, lang = 'fr', userPriceRange, maxCandidates = 8, maxConcurrentTabs = 3 } = payload;
    if (!url) throw new Error('deep-scrape: url required');

    console.log(`[Processor:deep-scrape] ► ${url}`);

    const result = await orchestrateFunnelExploration(url, {
        lang,
        userPriceRange,
        maxCandidates,
        maxConcurrentTabs,
    });

    return compactRailwayFunnelResult(result, url);
}

/**
 * scrape_funnel_multi : explore N URLs en série avec l'orchestrateur
 * Payload: { urls: string[], lang?, userPriceRange?, concurrency? }
 * Note: on sérialise (pas de concurrence inter-URL) pour respecter la RAM
 */
async function processScrapeFunnelMulti(payload) {
    const { urls, lang = 'fr', userPriceRange, concurrency = 1 } = payload;
    if (!urls?.length) throw new Error('scrape_funnel_multi: urls[] required');

    console.log(`[Processor:scrape_funnel_multi] ${urls.length} URLs — concurrency=${concurrency}`);

    const results = [];

    // Sérialisé par sécurité mémoire (1 browser à la fois)
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`[Processor:scrape_funnel_multi] [${i + 1}/${urls.length}] ► ${url}`);

        try {
            const res = await orchestrateFunnelExploration(url, { lang, userPriceRange });
            results.push({
                url,
                success:    res.success,
                verdict:    {
                    yesCount:    res.yesCount,
                    maybeCount:  res.maybeCount,
                    noCount:     res.noCount,
                    confidence:  res.funnelAnalysis?.confidence,
                    positioning: res.funnelAnalysis?.positioning,
                },
                prices:    res.funnelAnalysis?.prices || [],
                priceStats: res.funnelAnalysis?.priceStats || null,
            });
        } catch (err) {
            results.push({ url, success: false, error: err.message });
        }
    }

    const success = results.filter((r) => r.success);
    const failed  = results.filter((r) => !r.success);

    // Prix consolidés de toutes les URLs
    const allPrices = success.flatMap((r) => r.prices || []);
    const allValues = allPrices.map((p) => p.value).filter((v) => v > 0).sort((a, b) => a - b);
    const globalStats = allValues.length ? {
        min:    allValues[0],
        max:    allValues[allValues.length - 1],
        avg:    Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length),
        count:  allValues.length,
    } : null;

    return {
        success: true,
        totalUrls:   urls.length,
        successUrls: success.length,
        failedUrls:  failed.length,
        results,
        globalPriceStats: globalStats,
    };
}

// ═══════════════════════════════════════════════════════════════════
// STANDARD JOBS — In-process via Express handler
// ═══════════════════════════════════════════════════════════════════

const processJobFunnel      = (p) => runBusinessHandler(ROUTES.funnel,       p, JOB_TIMEOUTS.funnel);
const processJobTechnical   = (p) => runBusinessHandler(ROUTES.technical,    p, JOB_TIMEOUTS.technical);
const processJobCompetitors = (p) => runBusinessHandler(ROUTES.competitors,  p, JOB_TIMEOUTS.competitors);
const processJobKeywords    = (p) => runBusinessHandler(ROUTES.keywords,     p, JOB_TIMEOUTS.keywords);

// ═══════════════════════════════════════════════════════════════════
// ROUTER — Entrée principale pour scraper-worker.js
// ═══════════════════════════════════════════════════════════════════

function processJob(type, payload) {
    console.log(`[Processor] → type=${type}`);

    switch (type) {
        // ── Standard AI jobs (in-process) ───────────────────────────
        case 'funnel':               return processJobFunnel(payload);
        case 'technical':            return processJobTechnical(payload);
        case 'competitors':          return processJobCompetitors(payload);
        case 'keywords':             return processJobKeywords(payload);

        // ── Scrape simples (Playwright 1-page) ─────────────────────
        case 'scrape_funnel':        return processScrapeFunnel(payload);
        case 'scrape_product':       return processScrapeProduct(payload);
        case 'scrape_competitors':   return processScrapeCompetitors(payload);

        // ── Scrape multi-agent (Orchestrateur BOT+SubBots) ──────
        case 'deep-scrape':
        case 'deep_scrape':
        case 'scrape-url':
        case 'scrape_url':
        case 'page-scrape':
        case 'page_scrape':
            return processScrapeFunnelDeep(payload);
        case 'scrape_funnel_multi':  return processScrapeFunnelMulti(payload);

        default:
            throw new Error(`[Processor] Unsupported job type: "${type}"`);
    }
}

// ═══════════════════════════════════════════════════════════════════
module.exports = {
    processJob,
    processJobFunnel,
    processJobTechnical,
    processJobCompetitors,
    processJobKeywords,
    processScrapeFunnel,
    processScrapeProduct,
    processScrapeCompetitors,
    processScrapeFunnelDeep,
    processScrapeFunnelMulti,
};
