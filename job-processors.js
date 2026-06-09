'use strict';

// ═══════════════════════════════════════════════════════════════════
// JOB PROCESSORS — Multi-Agent Engine
// Architecture: Railway Worker → processJob() → handler par type
// Supported types: funnel | technical | competitors | keywords
//                  scrape_funnel | scrape_product | scrape_competitors
// ═══════════════════════════════════════════════════════════════════

const axios = require('axios');
const { app } = require('./server');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// Internal API routes (Render 1 handlers)
const ROUTES = {
    funnel:      '/api/analyze-funnel',
    technical:   '/api/technical-seo',
    competitors: '/api/competitors',
    keywords:    '/api/generate-keywords',
};

// Timeout per job type (ms)
const JOB_TIMEOUTS = {
    funnel:           Number(process.env.TIMEOUT_FUNNEL      || 180000), // 3 min
    technical:        Number(process.env.TIMEOUT_TECHNICAL   || 120000), // 2 min
    competitors:      Number(process.env.TIMEOUT_COMPETITORS || 120000), // 2 min
    keywords:         Number(process.env.TIMEOUT_KEYWORDS    || 60000),  // 1 min
    scrape_funnel:    Number(process.env.TIMEOUT_SCRAPE      || 60000),  // 1 min
    scrape_product:   Number(process.env.TIMEOUT_SCRAPE      || 60000),
    scrape_competitors: Number(process.env.TIMEOUT_SCRAPE    || 90000),  // 1.5 min
    default:          Number(process.env.WORKER_JOB_TIMEOUT_MS || 180000),
};

// Render 1 base URL (used for HTTP fallback)
const RENDER1_URL = process.env.RENDER1_URL || process.env.API_BASE_URL || '';

// ═══════════════════════════════════════════════════════════════════
// CORE: FIND HANDLER IN EXPRESS APP
// ═══════════════════════════════════════════════════════════════════

function findBusinessHandler(path) {
    const routeLayer = app?._router?.stack?.find(layer =>
        layer.route?.path === path &&
        layer.route?.methods?.post === true
    );

    const handlers = routeLayer?.route?.stack || [];
    const businessLayer = handlers[handlers.length - 1];

    if (!businessLayer?.handle) {
        throw new Error(`No business handler registered for ${path}`);
    }

    return businessLayer.handle;
}

// ═══════════════════════════════════════════════════════════════════
// CORE: RUN HANDLER VIA MOCK REQ/RES (in-process, no HTTP overhead)
// ═══════════════════════════════════════════════════════════════════

function runBusinessHandler(path, payload = {}, timeoutMs) {
    const handler = findBusinessHandler(path);
    const body    = { ...(payload || {}) };
    delete body.async;

    const timeout = timeoutMs || JOB_TIMEOUTS.default;

    return new Promise((resolve, reject) => {
        let settled = false;

        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            callback(value);
        };

        // ── Mock Request ───────────────────────────────────────
        const req = {
            body,
            method:      'POST',
            path,
            originalUrl: path,
            headers:     { 'x-daka-worker-bypass': '1' },
            queueBypass: true,
            ip:          'railway-worker',
            user:        null,
            get(name) {
                return this.headers[String(name || '').toLowerCase()];
            }
        };

        // ── Mock Response ────────────────────────────────────
        const res = {
            statusCode: 200,
            _headers:   {},
            status(code)        { this.statusCode = code; return this; },
            set(name, value)    { this._headers[String(name).toLowerCase()] = value; return this; },
            setHeader(n, v)     { this._headers[String(n).toLowerCase()] = v; },
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

        const next = (err) => {
            finish(reject, err || new Error(`Unexpected next() from ${path}`));
        };

        // ── Timeout guard ──────────────────────────────────────
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
// SCRAPE JOBS — Via HTTP POST to Render 1 (or direct if same process)
// These jobs trigger Playwright-based scraping via the main server
// ═══════════════════════════════════════════════════════════════════

async function processScrapeFunnel(payload) {
    const { url, lang, userPriceRange, budget } = payload;
    if (!url) throw new Error('scrape_funnel: url required');

    // Try internal handler first
    try {
        return await runBusinessHandler(
            '/api/analyze-funnel',
            { url, lang, userPriceRange, scrapeOnly: true },
            JOB_TIMEOUTS.scrape_funnel
        );
    } catch (err) {
        // Fallback: HTTP call to Render 1 if internal handler fails
        if (!RENDER1_URL) throw err;
        console.warn(`[Processor] scrape_funnel internal failed, trying HTTP fallback: ${err.message}`);
        const res = await axios.post(`${RENDER1_URL}/api/analyze-funnel`, {
            url, lang, userPriceRange, budget,
            _workerBypass: true
        }, {
            timeout: JOB_TIMEOUTS.scrape_funnel,
            headers: { 'x-daka-worker-bypass': '1' }
        });
        return res.data;
    }
}

async function processScrapeProduct(payload) {
    const { url, lang } = payload;
    if (!url) throw new Error('scrape_product: url required');

    // Direct scrape of a product page — lightweight
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
        }, {
            timeout: JOB_TIMEOUTS.scrape_product,
            headers: { 'x-daka-worker-bypass': '1' }
        });
        return res.data;
    }
}

async function processScrapeCompetitors(payload) {
    const { urls, lang, geo } = payload;
    if (!urls?.length) throw new Error('scrape_competitors: urls[] required');

    // Run up to 3 competitor scrapes in parallel
    const BATCH = 3;
    const results = [];

    for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);
        console.log(`[Processor] scrape_competitors batch ${Math.floor(i/BATCH)+1}: ${batch.length} urls`);

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
            if (r.status === 'fulfilled') {
                results.push({ url: batch[idx], success: true,  data: r.value  });
            } else {
                results.push({ url: batch[idx], success: false, error: r.reason?.message });
            }
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
// STANDARD JOBS — In-process via Express handler
// ═══════════════════════════════════════════════════════════════════

const processJobFunnel      = (p) => runBusinessHandler(ROUTES.funnel,       p, JOB_TIMEOUTS.funnel);
const processJobTechnical   = (p) => runBusinessHandler(ROUTES.technical,    p, JOB_TIMEOUTS.technical);
const processJobCompetitors = (p) => runBusinessHandler(ROUTES.competitors,  p, JOB_TIMEOUTS.competitors);
const processJobKeywords    = (p) => runBusinessHandler(ROUTES.keywords,     p, JOB_TIMEOUTS.keywords);

// ═══════════════════════════════════════════════════════════════════
// ROUTER — Main entry point for scraper-worker.js
// ═══════════════════════════════════════════════════════════════════

function processJob(type, payload) {
    console.log(`[Processor] → type=${type}`);

    switch (type) {
        // ── Standard AI jobs (in-process) ──────────────────────
        case 'funnel':           return processJobFunnel(payload);
        case 'technical':        return processJobTechnical(payload);
        case 'competitors':      return processJobCompetitors(payload);
        case 'keywords':         return processJobKeywords(payload);

        // ── Scrape jobs (Playwright multi-agent) ──────────────
        case 'scrape_funnel':       return processScrapeFunnel(payload);
        case 'scrape_product':      return processScrapeProduct(payload);
        case 'scrape_competitors':  return processScrapeCompetitors(payload);

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
};
