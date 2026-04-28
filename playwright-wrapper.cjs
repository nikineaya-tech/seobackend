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
const NAVIGATION_TIMEOUT = 30000; // Légèrement augmenté pour les gros sites e-commerce
const PAGE_TIMEOUT       = 35000;
// User-Agent très standard et moderne
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

// ─── LAUNCH (STEALTH MODE) ────────────────────────────────
async function launchPlaywright(url) {
  console.log(`🚀 [PLAYWRIGHT] Scraping Stealth : ${url}`);

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
        // ❌ '--single-process' SUPPRIMÉ (cause des blocages silencieux)
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--mute-audio',
        '--hide-scrollbars',
        '--disable-software-rasterizer',
        // ✅ AJOUT STEALTH : Désactive l'indicateur d'automatisation Chromium
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris', // Ajoute au réalisme de l'empreinte
      viewport: { width: 1920, height: 1080 }, // Résolution d'écran plus crédible
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      hasTouch: false,
    });

    // ✅ INJECTION STEALTH : Efface les preuves que tu es un bot
    await context.addInitScript(() => {
      // 1. Supprime le flag webdriver (Technique n°1 contre Datadome/Cloudflare)
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // 2. Simule la présence de plugins (les headless n'en ont pas, ce qui est suspect)
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      // 3. Fake la langue pour coller au contexte
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    });

    // ✅ ROUTAGE INTELLIGENT : On ne bloque PLUS le CSS et les Fonts !
    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      // Bloquer le CSS hurle "Je suis un robot" aux anti-bots.
      // On se contente de bloquer les images et vidéos pour économiser de la RAM.
      if (['image', 'media'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

    // ✅ GOTO ANTI-TIMEOUT : Passage en force
    try {
      // 'commit' = On arrête d'attendre l'événement 'domcontentloaded' qui est souvent piégé
      await page.goto(url, {
        waitUntil: 'commit',
        timeout: NAVIGATION_TIMEOUT,
      });

      // On force une pause manuelle de 6 secondes pour laisser le DOM (les produits) se construire
      await page.waitForTimeout(6000);

    } catch (gotoErr) {
      console.warn(`⚠️ [PLAYWRIGHT] Timeout ou blocage ignoré sur le goto : ${gotoErr.message}`);
    }

    // On vérifie que le body a bien chargé
    await page.waitForSelector('body', { timeout: 5000 }).catch(() => {
      console.warn('⚠️ [PLAYWRIGHT] Body introuvable, mais tentative de continuation...');
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