'use strict';

require('dotenv').config();

const cheerio = require('cheerio');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createCursor } = require('ghost-cursor');

chromium.use(StealthPlugin());

const DEFAULT_TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS || 25000);
const MAX_EXTRA_PAGES = Math.max(0, Number(process.env.SCRAPER_MAX_EXTRA_PAGES || 3));
const USER_AGENT = process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function normalizeUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) throw new Error('Missing URL');
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs are allowed');
  return parsed.href;
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
      for (const candidate of mainPage.links.slice(0, MAX_EXTRA_PAGES)) {
        const tab = await context.newPage();
        try {
          extraPages.push(await scrapeSinglePage(tab, candidate.url));
        } catch (err) {
          extraPages.push({ url: candidate.url, error: err.message, scrapedAt: new Date().toISOString() });
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

  for (const url of list.filter(Boolean)) {
    try {
      results.push(await scrapeUrl(url, options));
    } catch (err) {
      results.push({ success: false, inputUrl: url, error: err.message, scrapedAt: new Date().toISOString() });
    }
  }

  return { success: true, results, count: results.length };
}

module.exports = { scrapeUrl, scrapeMany };

if (require.main === module) {
  const url = process.argv[2];
  scrapeUrl(url || process.env.TEST_URL || '')
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
