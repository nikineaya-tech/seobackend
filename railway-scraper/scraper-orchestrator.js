'use strict';

require('dotenv').config();

const cheerio = require('cheerio');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createCursor } = require('ghost-cursor');

chromium.use(StealthPlugin());

const DEFAULT_TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS || 45000);
const MAX_EXTRA_PAGES = Math.max(0, Number(process.env.SCRAPER_MAX_EXTRA_PAGES || 12));
const USER_AGENT = process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_CRAWL_OPTIONS = {
  maxPages: Math.max(1, Number(process.env.SCRAPER_MAX_PAGES || 12)),
  maxDepth: Math.max(0, Number(process.env.SCRAPER_MAX_DEPTH || 2)),
  maxClicks: Math.max(0, Number(process.env.SCRAPER_MAX_CLICKS || 20)),
  maxButtonsPerPage: Math.max(0, Number(process.env.SCRAPER_MAX_BUTTONS_PER_PAGE || 8)),
  crawlBudgetMs: Math.max(15000, Number(process.env.SCRAPER_CRAWL_BUDGET_MS || 120000)),
  sameOriginOnly: String(process.env.SCRAPER_SAME_ORIGIN_ONLY || 'true') !== 'false'
};

const TRACKING_PARAMS = new Set([
  'srsltid',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'mc_cid',
  'mc_eid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'utm_name'
]);

const BLOCKED_CRAWL_PATTERNS = [
  /\/cart\b/i,
  /\/checkout\b/i,
  /\/panier\b/i,
  /\/basket\b/i,
  /\/payment\b/i,
  /\/paiement\b/i,
  /\/login\b/i,
  /\/logout\b/i,
  /\/account\b/i,
  /\/admin\b/i,
  /\/wp-admin\b/i,
  /\/my-account\b/i,
  /\/privacy\b/i,
  /\/terms\b/i,
  /\/conditions\b/i,
  /\/mentions/i,
  /delete/i,
  /remove/i
];

function normalizeCrawlUrl(rawUrl, baseUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(value)
      ? value
      : baseUrl
        ? new URL(value, baseUrl).href
        : `https://${value}`;

    const parsed = new URL(withProtocol);

    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    parsed.hash = '';

    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }

    const sortedParams = [...parsed.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b));

    parsed.search = '';

    for (const [key, value] of sortedParams) {
      parsed.searchParams.append(key, value);
    }

    return parsed.href;
  } catch (_) {
    return null;
  }
}

function isBlockedCrawlUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return true;

  return BLOCKED_CRAWL_PATTERNS.some(rx => rx.test(value));
}

function isSameOriginUrl(rawUrl, rootUrl) {
  try {
    return new URL(rawUrl).origin === new URL(rootUrl).origin;
  } catch (_) {
    return false;
  }
}

function buildCrawlOptions(options = {}) {
  return {
    maxPages: Math.max(1, Number(options.maxPages || DEFAULT_CRAWL_OPTIONS.maxPages)),
    maxDepth: Math.max(0, Number(options.maxDepth ?? DEFAULT_CRAWL_OPTIONS.maxDepth)),
    maxClicks: Math.max(0, Number(options.maxClicks ?? DEFAULT_CRAWL_OPTIONS.maxClicks)),
    maxButtonsPerPage: Math.max(0, Number(options.maxButtonsPerPage ?? DEFAULT_CRAWL_OPTIONS.maxButtonsPerPage)),
    crawlBudgetMs: Math.max(15000, Number(options.crawlBudgetMs || DEFAULT_CRAWL_OPTIONS.crawlBudgetMs)),
    sameOriginOnly: options.sameOriginOnly !== false && DEFAULT_CRAWL_OPTIONS.sameOriginOnly
  };
}

function normalizeUrl(rawUrl) {
  const normalized = normalizeCrawlUrl(rawUrl);
  if (!normalized) throw new Error('Missing or invalid URL');
  if (isBlockedCrawlUrl(normalized)) throw new Error('Blocked crawl URL');
  return normalized;
}

function extractPrices(text = '') {
  const prices = [];
  const seen = new Set();
  const rx = /(\d{1,3}(?:[\s,.]?\d{3})*(?:[,.]\d{1,2})?)\s*(MAD|DH|DHS|د\.م|درهم|€|EUR|\$|USD|LYD)/gi;
  let match;

  while ((match = rx.exec(text)) !== null) {
    const value = Number(String(match[1]).replace(/\s/g, '').replace(',', '.'));
    const currency = String(match[2] || '').toUpperCase().replace('DHS', 'MAD').replace('DH', 'MAD').replace('درهم', 'MAD').replace('د.م', 'MAD');
    const key = `${value}-${currency}`;

    if (Number.isFinite(value) && value > 0 && !seen.has(key)) {
      seen.add(key);
      prices.push({ value, currency, context: text.slice(Math.max(0, match.index - 60), match.index + 90).replace(/\s+/g, ' ').trim() });
    }
  }

  return prices.slice(0, 25);
}

function extractLinks($, baseUrl) {
  const candidates = [];
  const seen = new Set();
  const base = new URL(baseUrl);

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const label = ($(el).text() || '').replace(/\s+/g, ' ').trim();
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return;

    try {
      const url = new URL(href, baseUrl);
      if (url.origin !== base.origin) return;
      if (seen.has(url.href)) return;

      const text = `${label} ${url.pathname}`.toLowerCase();
      let score = 0;
      if (/product|produit|collection|shop|store|boutique|pricing|prix|tarif|pack|plan|service|solution/i.test(text)) score += 50;
      if (/checkout|cart|panier|login|admin|account|privacy|terms|mentions/i.test(text)) score -= 50;
      if (score <= 0) return;

      seen.add(url.href);
      candidates.push({ url: url.href, label, score });
    } catch (_) {}
  });

  return candidates.sort((a, b) => b.score - a.score).slice(0, MAX_EXTRA_PAGES);
}

async function createBrowser() {
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-blink-features=AutomationControlled',
      '--js-flags=--max-old-space-size=512'
    ]
  });
}

async function scrapeSinglePage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});

  const cursor = createCursor(page);
  await cursor.moveTo({ x: 100 + Math.random() * 400, y: 120 + Math.random() * 300 }).catch(() => {});
  await page.evaluate(() => window.scrollBy({ top: Math.min(document.body.scrollHeight, 900), behavior: 'smooth' })).catch(() => {});
  await page.waitForTimeout(600).catch(() => {});

  const html = await page.content();
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const title = await page.title().catch(() => '');
  const $ = cheerio.load(html);

  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const prices = extractPrices(text);
  const links = extractLinks($, url);

  return {
    url,
    title,
    h1,
    metaDescription,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    prices,
    links,
    trustSignals: {
      hasWhatsapp: /wa\.me|whatsapp/i.test(html),
      hasReviews: /avis|reviews?|rating|étoile|stars?|testimonial|témoignage/i.test(text),
      hasGuarantee: /garantie|rembours|refund|money back|ضمان/i.test(text),
      hasDelivery: /livraison|delivery|shipping|توصيل/i.test(text),
      hasContact: /contact|support|email|téléphone|phone|whatsapp/i.test(text)
    },
    htmlLength: html.length,
    scrapedAt: new Date().toISOString()
  };
}

async function scrapeUrl(rawUrl, options = {}) {
  const crawlOptions = buildCrawlOptions(options);
  const url = normalizeUrl(rawUrl);
  const browser = await createBrowser();
  const startedAt = Date.now();

  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'fr-FR',
      timezoneId: 'Africa/Casablanca',
      viewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    });

    const page = await context.newPage();
    const mainPage = await scrapeSinglePage(page, url);

    const shouldExplore = options.explore !== false;
    const extraPages = [];

    if (shouldExplore && mainPage.links.length) {
  const remainingBudget = Math.max(0, crawlOptions.maxPages - 1);
  const extraCandidates = mainPage.links.slice(0, remainingBudget);

  for (const candidate of extraCandidates) {
    if (Date.now() - startedAt > crawlOptions.crawlBudgetMs) {
      extraPages.push({
        url: candidate.url,
        skipped: true,
        reason: 'Crawl budget exceeded',
        scrapedAt: new Date().toISOString()
      });
      break;
    }

    const normalizedCandidateUrl = normalizeCrawlUrl(candidate.url, url);

    if (!normalizedCandidateUrl || isBlockedCrawlUrl(normalizedCandidateUrl)) {
      extraPages.push({
        url: candidate.url,
        skipped: true,
        reason: 'Blocked or invalid crawl URL',
        scrapedAt: new Date().toISOString()
      });
      continue;
    }

    if (crawlOptions.sameOriginOnly && !isSameOriginUrl(normalizedCandidateUrl, url)) {
      extraPages.push({
        url: candidate.url,
        skipped: true,
        reason: 'External origin skipped',
        scrapedAt: new Date().toISOString()
      });
      continue;
    }

    const tab = await context.newPage();

    try {
      extraPages.push(await scrapeSinglePage(tab, normalizedCandidateUrl));
    } catch (err) {
      extraPages.push({
        url: normalizedCandidateUrl,
        error: err.message,
        scrapedAt: new Date().toISOString()
      });
    } finally {
      await tab.close().catch(() => {});
    }
  }
}

    await context.close().catch(() => {});

    return {
  success: true,
  provider: 'railway-playwright',
  inputUrl: rawUrl,
  normalizedUrl: url,
  crawlOptions,
  durationMs: Date.now() - startedAt,
  mainPage,
  extraPages,
      summary: {
        pagesScraped: 1 + extraPages.filter(p => !p.error).length,
        pricesFound: mainPage.prices.length + extraPages.reduce((sum, p) => sum + (Array.isArray(p.prices) ? p.prices.length : 0), 0),
        trustSignals: mainPage.trustSignals
      }
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function scrapeMany(urls = [], options = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  const results = [];
  const seen = new Set();

  for (const rawUrl of list.filter(Boolean)) {
    const normalized = normalizeCrawlUrl(rawUrl);

    if (!normalized) {
      results.push({
        success: false,
        inputUrl: rawUrl,
        error: 'Invalid URL',
        scrapedAt: new Date().toISOString()
      });
      continue;
    }

    if (isBlockedCrawlUrl(normalized)) {
      results.push({
        success: false,
        inputUrl: rawUrl,
        normalizedUrl: normalized,
        error: 'Blocked crawl URL',
        scrapedAt: new Date().toISOString()
      });
      continue;
    }

    if (seen.has(normalized)) {
      results.push({
        success: true,
        skipped: true,
        inputUrl: rawUrl,
        normalizedUrl: normalized,
        reason: 'Duplicate URL after normalization',
        scrapedAt: new Date().toISOString()
      });
      continue;
    }

    seen.add(normalized);

    try {
      results.push(await scrapeUrl(normalized, options));
    } catch (err) {
      results.push({
        success: false,
        inputUrl: rawUrl,
        normalizedUrl: normalized,
        error: err.message,
        scrapedAt: new Date().toISOString()
      });
    }
  }

  return {
    success: true,
    results,
    count: results.length,
    uniqueCount: seen.size
  };
}

module.exports = {
  scrapeUrl,
  scrapeMany,
  normalizeCrawlUrl,
  buildCrawlOptions,
  isBlockedCrawlUrl,
  isSameOriginUrl
};

if (require.main === module) {
  const url = process.argv[2];
  scrapeUrl(url || process.env.TEST_URL || '')
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
