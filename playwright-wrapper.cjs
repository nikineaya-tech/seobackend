'use strict';

const axios = require('axios');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createCursor } = require('ghost-cursor');

chromium.use(StealthPlugin());

// ── CONFIG ────────────────────────────────────────────────
const NAVIGATION_TIMEOUT = 20000;
const PAGE_TIMEOUT       = 25000;
const USER_AGENT         = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── ENV HELPERS ───────────────────────────────────────────
function isRenderEnv() {
    return !!process.env.RENDER;
}

function isBrowserlessEnabled() {
    return !!process.env.BROWSERLESS_TOKEN;
}

function isScrapeDoEnabled() {
    return !!process.env.SCRAPE_DO_TOKEN;
}

function isSerpApiEnabled() {
    return !!process.env.SERPAPI_KEY;
}

function isSerperEnabled() {
    return !!process.env.SERPER_API_KEY;
}

function getBrowserlessWSEndpoint() {
    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) return null;
    return `wss://production-sfo.browserless.io?token=${token}`;
}

function getEmptyRemoteResult(provider = 'unknown', error = 'Provider unavailable') {
    return {
        provider,
        browser: null,
        context: null,
        page: null,
        html: '',
        error,
        close: async () => {}
    };
}

// ── COMMON PAGE PREP ──────────────────────────────────────
async function prepareContext(context) {
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    });

    await context.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'media', 'font'].includes(type)) return route.abort();
        return route.continue();
    });
}

async function preparePage(page, url, mode = 'unknown') {
    page.setDefaultTimeout(PAGE_TIMEOUT);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: NAVIGATION_TIMEOUT,
        });

        const cursor = createCursor(page);
        await cursor.moveTo({
            x: 100 + Math.random() * 400,
            y: 100 + Math.random() * 300
        }).catch(() => {});

        await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }))
            .catch(() => {});

        await page.waitForTimeout(1500);
    } catch (gotoErr) {
        console.warn(`⚠️ [BROWSER:${mode}] Timeout ou blocage ignoré sur le goto : ${gotoErr.message}`);
    }

    await page.waitForFunction(
        () => document.body && document.body.innerText.trim().length > 50,
        { timeout: 8000 }
    ).catch(() => {
        console.warn(`⚠️ [BROWSER:${mode}] Body introuvable, tentative de continuation...`);
    });

    console.log(`✅ [BROWSER:${mode}] Page chargée : ${url}`);
}

// ── LOCAL BROWSER ─────────────────────────────────────────
async function launchLocalBrowser(url) {
    console.log(`🖥️ [PLAYWRIGHT LOCAL] Scraping : ${url}`);

    let browser = null;
    let context = null;

    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--mute-audio',
                '--hide-scrollbars',
                '--disable-software-rasterizer',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--js-flags=--max-old-space-size=256'
            ],
        });

        context = await browser.newContext({
            userAgent: USER_AGENT,
            locale: 'fr-FR',
            timezoneId: 'Africa/Casablanca',
            viewport: { width: 1280, height: 800 },
            ignoreHTTPSErrors: true,
            javaScriptEnabled: true,
            hasTouch: false,
        });

        await prepareContext(context);

        const page = await context.newPage();
        await preparePage(page, url, 'local');

        return {
            provider: 'playwright-local',
            browser,
            context,
            page,
            html: '',
            close: async () => {
                try { await context?.close().catch(() => {}); } catch (_) {}
                try { await browser?.close().catch(() => {}); } catch (_) {}
            }
        };
    } catch (err) {
        console.error('❌ [PLAYWRIGHT LOCAL] launch failed:', err.message);
        try { await context?.close().catch(() => {}); } catch (_) {}
        try { await browser?.close().catch(() => {}); } catch (_) {}
        return getEmptyRemoteResult('playwright-local', err.message);
    }
}

// ── REMOTE BROWSERLESS ────────────────────────────────────
async function launchBrowserless(url) {
    const wsEndpoint = getBrowserlessWSEndpoint();

    if (!wsEndpoint) {
        console.warn('⚠️ [BROWSERLESS] Token absent');
        return getEmptyRemoteResult('browserless', 'BROWSERLESS_TOKEN missing');
    }

    console.log(`☁️ [BROWSERLESS] Remote scraping : ${url}`);

    let browser = null;
    let context = null;

    try {
        browser = await chromium.connectOverCDP(wsEndpoint);

        context = await browser.newContext({
            userAgent: USER_AGENT,
            locale: 'fr-FR',
            timezoneId: 'Africa/Casablanca',
            viewport: { width: 1280, height: 800 },
            ignoreHTTPSErrors: true,
            javaScriptEnabled: true,
            hasTouch: false,
        });

        await prepareContext(context);

        const page = await context.newPage();
        await preparePage(page, url, 'browserless');

        return {
            provider: 'browserless',
            browser,
            context,
            page,
            html: '',
            close: async () => {
                try { await context?.close().catch(() => {}); } catch (_) {}
                try { await browser?.close().catch(() => {}); } catch (_) {}
            }
        };
    } catch (err) {
        console.error('❌ [BROWSERLESS] launch failed:', err.message);
        try { await context?.close().catch(() => {}); } catch (_) {}
        try { await browser?.close().catch(() => {}); } catch (_) {}
        return getEmptyRemoteResult('browserless', err.message);
    }
}

// ── SCRAPE.DO FALLBACK ────────────────────────────────────
async function launchScrapeDo(url) {
    if (!isScrapeDoEnabled()) {
        console.warn('⚠️ [SCRAPE.DO] Token absent');
        return getEmptyRemoteResult('scrape.do', 'SCRAPE_DO_TOKEN missing');
    }

    try {
        const token = process.env.SCRAPE_DO_TOKEN;
        const apiUrl = `http://api.scrape.do?token=${token}&url=${encodeURIComponent(url)}&render=true`;

        console.log(`🛟 [SCRAPE.DO] Fallback scraping : ${url}`);

        const response = await axios.get(apiUrl, {
            timeout: 45000,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const html = typeof response.data === 'string'
            ? response.data
            : response.data?.html || response.data?.body || '';

        if (!html || html.length < 500) {
            throw new Error(`HTML too short from Scrape.do (${html?.length || 0} chars)`);
        }

        console.log(`✅ [SCRAPE.DO] HTML récupéré : ${html.length} chars`);

        return {
            provider: 'scrape.do',
            browser: null,
            context: null,
            page: null,
            html,
            close: async () => {}
        };
    } catch (err) {
        console.error('❌ [SCRAPE.DO] failed:', err.message);
        return getEmptyRemoteResult('scrape.do', err.message);
    }
}

// ── SEARCH FALLBACK INTEL ─────────────────────────────────
async function searchFallbackUrl(url) {
    const domain = (() => {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return null;
        }
    })();

    if (!domain) return null;

    try {
        if (isSerperEnabled()) {
            console.log(`🔎 [SERPER] Recherche fallback pour : ${domain}`);
            const res = await axios.post(
                'https://google.serper.dev/search',
                { q: `site:${domain}` },
                {
                    timeout: 12000,
                    headers: {
                        'X-API-KEY': process.env.SERPER_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const candidate = res.data?.organic?.[0]?.link;
            if (candidate) return candidate;
        }

        if (isSerpApiEnabled()) {
            console.log(`🔎 [SERPAPI] Recherche fallback pour : ${domain}`);
            const res = await axios.get('https://serpapi.com/search.json', {
                timeout: 12000,
                params: {
                    engine: 'google',
                    q: `site:${domain}`,
                    api_key: process.env.SERPAPI_KEY
                }
            });

            const candidate = res.data?.organic_results?.[0]?.link;
            if (candidate) return candidate;
        }
    } catch (err) {
        console.warn(`⚠️ [SEARCH FALLBACK] ${err.message}`);
    }

    return null;
}

// ── MAIN ENTRY ────────────────────────────────────────────
async function launchPlaywright(url) {
    // Render => Browserless primaire, puis Scrape.do
    if (isRenderEnv()) {
        const remote = await launchBrowserless(url);
        if (remote.page || remote.html) return remote;

        console.warn('⚠️ [WRAPPER] Browserless indisponible sur Render, tentative Scrape.do...');
        const scrapeDo = await launchScrapeDo(url);
        if (scrapeDo.html) return scrapeDo;

        const alternativeUrl = await searchFallbackUrl(url);
        if (alternativeUrl && alternativeUrl !== url) {
            console.warn(`⚠️ [WRAPPER] URL alternative trouvée : ${alternativeUrl}`);

            const remoteAlt = await launchBrowserless(alternativeUrl);
            if (remoteAlt.page || remoteAlt.html) return remoteAlt;

            const scrapeDoAlt = await launchScrapeDo(alternativeUrl);
            if (scrapeDoAlt.html) return scrapeDoAlt;
        }

        return getEmptyRemoteResult('render-fallback', 'Browserless and Scrape.do failed');
    }

    // Local/dev => Browserless si explicitement activé
    if (isBrowserlessEnabled() && process.env.BROWSER_PROVIDER === 'browserless') {
        const remote = await launchBrowserless(url);
        if (remote.page || remote.html) return remote;
        console.warn('⚠️ [WRAPPER] Fallback vers Playwright local');
    }

    const local = await launchLocalBrowser(url);
    if (local.page) return local;

    const scrapeDo = await launchScrapeDo(url);
    if (scrapeDo.html) return scrapeDo;

    return getEmptyRemoteResult('local-fallback', 'All providers failed');
}

// ── CLOSE ─────────────────────────────────────────────────
async function closeBrowser(instance) {
    if (!instance) return;

    try {
        if (typeof instance.close === 'function') {
            await instance.close();
            console.log('🛑 [BROWSER] Session fermée — ressources libérées');
            return;
        }

        if (instance.context) {
            await instance.context.close().catch(() => {});
        }

        if (instance.browser) {
            await instance.browser.close().catch(() => {});
        }

        console.log('🛑 [BROWSER] Session fermée — ressources libérées');
    } catch (err) {
        console.warn('⚠️ [BROWSER] close warning:', err.message);
    }
}

// ── HEALTH CHECK ──────────────────────────────────────────
async function isAvailable() {
    if (isRenderEnv()) {
        return isBrowserlessEnabled() || isScrapeDoEnabled();
    }
    return true;
}

// ── HELPERS ───────────────────────────────────────────────
async function safeEval(page, selector, attr = 'innerText') {
    try {
        return await page.$eval(selector, (el, a) => {
            if (a === 'innerText') return el.innerText?.trim() || null;
            if (a === 'href') return el.href || null;
            if (a === 'src') return el.src || null;
            return el.getAttribute(a) || null;
        }, attr);
    } catch (_) {
        return null;
    }
}

async function safeEvalAll(page, selector, attr = 'innerText') {
    try {
        return await page.$$eval(selector, (els, a) =>
            els.map(el => {
                if (a === 'innerText') return el.innerText?.trim() || '';
                if (a === 'href') return el.href || '';
                if (a === 'src') return el.src || '';
                return el.getAttribute(a) || '';
            }).filter(Boolean)
        , attr);
    } catch (_) {
        return [];
    }
}

async function extractDominantColors(page) {
    try {
        if (!page) return [];

        return await page.evaluate(() => {
            const targets = [
                document.body,
                document.querySelector('header'),
                document.querySelector('nav'),
                document.querySelector('.hero,[class*="hero"],[class*="banner"]'),
                document.querySelector('h1'),
                document.querySelector('footer'),
            ].filter(Boolean);

            const colors = new Set();

            targets.forEach(el => {
                const s = window.getComputedStyle(el);
                if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    colors.add(s.backgroundColor);
                }
                if (s.color) colors.add(s.color);
            });

            return [...colors].slice(0, 8);
        });
    } catch (_) {
        return [];
    }
}

module.exports = {
    launchPlaywright,
    closeBrowser,
    isAvailable,
    safeEval,
    safeEvalAll,
    extractDominantColors,
};