'use strict';

const path = require('path');
const { execSync } = require('child_process');

// ── PATH FIXE RENDER FREE ─────────────────────────────────
const BROWSERS_PATH = path.join(__dirname, '.cache', 'playwright');
process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS_PATH;

// ── AUTO-INSTALL si binaire absent ───────────────────────
function ensureChromium() {
  const chromiumPath = path.join(
    BROWSERS_PATH,
    'chromium_headless_shell-1208',
    'chrome-headless-shell-linux64',
    'chrome-headless-shell'
  );

  const fs = require('fs');
  if (!fs.existsSync(chromiumPath)) {
    console.log('⚙️ [PLAYWRIGHT] Chromium absent — installation en cours...');
    try {
      execSync(
        `PLAYWRIGHT_BROWSERS_PATH=${BROWSERS_PATH} npx playwright install chromium`,
        { stdio: 'inherit', timeout: 120000 }
      );
      console.log('✅ [PLAYWRIGHT] Chromium installé avec succès');
    } catch (err) {
      console.error('❌ [PLAYWRIGHT] Installation Chromium échouée:', err.message);
    }
  } else {
    console.log('✅ [PLAYWRIGHT] Chromium déjà présent');
  }
}

// Exécuter avant tout lancement
ensureChromium();

const { chromium } = require('playwright');

// ─── CONFIG ───────────────────────────────────────────────
const NAVIGATION_TIMEOUT = 25000;
const PAGE_TIMEOUT       = 28000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

// ─── LAUNCH ───────────────────────────────────────────────
async function launchPlaywright(url) {
  console.log(`🚀 [PLAYWRIGHT] Scraping : ${url}`);

  let browser = null;

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
      ],
    });

    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'fr-FR',
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT,
    });

    await page.waitForSelector('body', { timeout: 8000 }).catch(() => {});

    console.log(`✅ [PLAYWRIGHT] Page chargée : ${url}`);
    return { browser, page };

  } catch (err) {
    console.error('❌ [PLAYWRIGHT] launchPlaywright failed:', err.message);
    if (browser) await browser.close().catch(() => {});
    return null;
  }
}

// ─── CLOSE ────────────────────────────────────────────────
async function closeBrowser(browser) {
  if (!browser) return;
  try {
    await browser.close();
    console.log('🛑 [PLAYWRIGHT] Browser fermé — RAM libérée');
  } catch (_) {}
}

// ─── HEALTH CHECK ─────────────────────────────────────────
async function isAvailable() {
  const fs = require('fs');
  const chromiumPath = path.join(
    BROWSERS_PATH,
    'chromium_headless_shell-1208',
    'chrome-headless-shell-linux64',
    'chrome-headless-shell'
  );
  return fs.existsSync(chromiumPath);
}

// ─── HELPER : safeEval ────────────────────────────────────
async function safeEval(page, selector, attr = 'innerText') {
  try {
    return await page.$eval(selector, (el, a) => {
      if (a === 'innerText') return el.innerText?.trim() || null;
      if (a === 'href')      return el.href   || null;
      if (a === 'src')       return el.src    || null;
      return el.getAttribute(a) || null;
    }, attr);
  } catch (_) { return null; }
}

// ─── HELPER : safeEvalAll ─────────────────────────────────
async function safeEvalAll(page, selector, attr = 'innerText') {
  try {
    return await page.$$eval(selector, (els, a) =>
      els.map(el => {
        if (a === 'innerText') return el.innerText?.trim() || '';
        if (a === 'href')      return el.href   || '';
        if (a === 'src')       return el.src    || '';
        return el.getAttribute(a) || '';
      }).filter(Boolean)
    , attr);
  } catch (_) { return []; }
}

// ─── HELPER : extractDominantColors ───────────────────────
async function extractDominantColors(page) {
  try {
    return await page.evaluate(() => {
      const targets = [
        document.body,
        document.querySelector('header'),
        document.querySelector('nav'),
        document.querySelector('.hero, [class*="hero"], [class*="banner"]'),
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
  } catch (_) { return []; }
}

// ─── EXPORTS ──────────────────────────────────────────────
module.exports = {
  launchPlaywright,
  closeBrowser,
  isAvailable,
  safeEval,
  safeEvalAll,
  extractDominantColors,
};