'use strict';

const path = require('path');
const { execSync } = require('child_process');

// ── NOUVELLES IMPORTATIONS (STEALTH & COMPORTEMENT) ──
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const { createCursor } = require('ghost-cursor');

// ── AUTO-INSTALL CHROMIUM (Render.com Safe) ───────────────
// We removed the hardcoded paths. We now let Playwright manage 
// its own cache natively. This prevents crashes when Playwright updates.
function ensureChromium() {
  console.log('⚙️ [PLAYWRIGHT] Checking Chromium installation...');
  
  try {
    // This command is idempotent: it downloads Chromium if missing, 
    // but finishes in milliseconds if it is already installed.
    execSync('npx playwright install chromium', { 
      stdio: 'inherit', 
      timeout: 120000 // 2-minute timeout for the initial download
    });
    console.log('✅ [PLAYWRIGHT] Chromium is ready and verified');
  } catch (err) {
    console.error('❌ [PLAYWRIGHT] Chromium installation failed:', err.message);
    console.error('💡 TIP: If this persists on Render, add "npx playwright install chromium" to your Build Command.');
  }
}

// Execute the check before any scraping occurs
ensureChromium();

// ─── CONFIG ───────────────────────────────────────────────
const NAVIGATION_TIMEOUT = 15000; // Rapide pour déclencher le fallback Scrape.do si besoin
const PAGE_TIMEOUT       = 20000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── LAUNCH (STEALTH MODE) ────────────────────────────────
async function launchPlaywright(url) {
  console.log(`🚀 [PLAYWRIGHT EXTRA] Scraping Furtif : ${url}`);

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
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--mute-audio',
        '--hide-scrollbars',
        '--disable-software-rasterizer',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
    });

    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      hasTouch: false,
    });

    // Injection pour nettoyer les variables suspectes
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    });

    // On bloque uniquement images et médias (Laisser passer le CSS est VITAL pour l'anti-bot)
    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

    // 🟢 Création du curseur "Humain"
    const cursor = createCursor(page);

    try {
      // Goto avec "commit" pour ne pas rester bloqué
      await page.goto(url, {
        waitUntil: 'commit',
        timeout: NAVIGATION_TIMEOUT,
      });

      // Mouvements de souris et scrolls humains
      await cursor.moveTo({ x: 100 + Math.random() * 500, y: 100 + Math.random() * 400 });
      await page.evaluate(() => { window.scrollBy({ top: 400, behavior: 'smooth' }); });
      await page.waitForTimeout(3000 + Math.random() * 2000); // Temps de lecture

    } catch (gotoErr) {
      console.warn(`⚠️ [PLAYWRIGHT] Timeout ou blocage ignoré sur le goto : ${gotoErr.message}`);
    }

    await page.waitForSelector('body', { timeout: 4000 }).catch(() => {
      console.warn('⚠️ [PLAYWRIGHT] Body introuvable, tentative de continuation...');
    });

    console.log(`✅ [PLAYWRIGHT] Page chargée (Mode Stealth) : ${url}`);
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
  // Playwright gère maintenant son propre cache via ensureChromium()
  return true; 
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