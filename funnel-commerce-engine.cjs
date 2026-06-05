'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════
 * 🛒 FUNNEL COMMERCE ENGINE — Scraping Elite Engine
 * ═══════════════════════════════════════════════════════════════════
 *
 * exploreFunnelCommerce(url, options)
 *   → visits the site like a user (scroll, product detection, pricing page)
 *   → returns: { observed, userContext, deduced, recommended }
 *
 * Render Free limits:
 *   - 1 main page explored
 *   - up to 6 products detected
 *   - up to 3 product pages opened
 *   - 1 pagination/"see more" click max
 *   - priority search for pricing/tarifs/offres page
 *   - short timeout + URL cache (TTL 10min, LRU 200)
 *
 * No new dependencies — uses playwright-wrapper.cjs already in the project.
 */

const { launchPlaywright, closeBrowser, safeEvalAll } = require('./playwright-wrapper.cjs');

// ── LRU CACHE ─────────────────────────────────────────────────────
const FCE_CACHE = new Map();
const FCE_CACHE_MAX  = 200;
const FCE_CACHE_TTL  = 10 * 60 * 1000; // 10 min

function cacheGet(url) {
  const entry = FCE_CACHE.get(url);
  if (!entry) return null;
  if (Date.now() - entry.ts > FCE_CACHE_TTL) { FCE_CACHE.delete(url); return null; }
  return entry.data;
}

function cacheSet(url, data) {
  if (FCE_CACHE.size >= FCE_CACHE_MAX) {
    const oldest = FCE_CACHE.keys().next().value;
    FCE_CACHE.delete(oldest);
  }
  FCE_CACHE.set(url, { ts: Date.now(), data });
}

// ── PRICING PAGE PATTERNS ─────────────────────────────────────────
const PRICING_PATH_RX = /\/(?:pricing|tarif[s]?|tarification|offre[s]?|plans?|abonnement[s]?|price[s]?|أسعار|عروض|باقات|pakete|preise)/i;
const PRICING_TEXT_RX = /(?:pricing|tarif[s]?|nos\s+offres|nos\s+prix|voir\s+les\s+tarifs|plans?\s+et\s+tarifs|abonnements?|subscription|أسعار|عروض|باقات)/i;

// ── PRICE REGEX (multi-currency) ──────────────────────────────────
const PRICE_RX = /([0-9][\d\s.,']*)\s*(MAD|DH|DHS|درهم|EUR|€|USD|\$|GBP|£|LYD|LD)|(?:MAD|DH|DHS|درهم|EUR|€|USD|\$|GBP|£|LYD|LD)\s*([0-9][\d\s.,']*)/gi;

function normVal(s) {
  if (!s) return null;
  let v = String(s).replace(/[^\d.,]/g, '');
  const dc = (v.match(/,/g) || []).length;
  const dd = (v.match(/\./g) || []).length;
  if (dc > 0 && dd > 0) {
    v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  } else if (dc > 0) {
    const p = v.split(',');
    v = p.length === 2 && p[1].length <= 2 ? p[0] + '.' + p[1] : v.replace(/,/g, '');
  } else if (dd > 0) {
    const p = v.split('.');
    v = p.length === 2 && p[1].length <= 2 ? p[0] + '.' + p[1] : v.replace(/\./g, '');
  }
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 && n < 1e8 ? n : null;
}

function detectCur(raw = '') {
  const s = raw.toUpperCase();
  if (/MAD|DHS?|درهم/.test(s)) return 'MAD';
  if (/EUR|€/.test(s)) return 'EUR';
  if (/USD|\$/.test(s)) return 'USD';
  if (/GBP|£/.test(s)) return 'GBP';
  if (/LYD|LD/.test(s)) return 'LYD';
  return 'MAD'; // default for Moroccan sites
}

function extractPricesFromText(text = '') {
  const found = [];
  let m;
  PRICE_RX.lastIndex = 0;
  const rx = new RegExp(PRICE_RX.source, 'gi');
  while ((m = rx.exec(text)) !== null) {
    const raw = m[0];
    const numStr = m[1] || m[3];
    const val = normVal(numStr);
    if (val && val >= 1 && val <= 999999) {
      found.push({ value: val, currency: detectCur(raw), raw, context: text.slice(Math.max(0, m.index - 30), m.index + 60) });
    }
  }
  return found;
}

// ── TRUST SIGNAL DETECTION ────────────────────────────────────────
function detectTrustSignals(html = '', bodyText = '') {
  const h = html.toLowerCase();
  const t = bodyText.toLowerCase();
  const combined = h + ' ' + t;

  return {
    hasGuarantee: /garantie|remboursement|satisfait|money.back|guarantee|ضمان|استرجاع|مضمون/.test(combined),
    hasDelivery:  /livraison|delivery|shipping|توصيل|شحن/.test(combined),
    hasReturn:    /retour|retours|returns?|échange|استرجاع|إرجاع/.test(combined),
    hasWhatsApp:  /whatsapp|wa\.me|api\.whatsapp/.test(combined),
    hasReviews:   /avis|review|témoignage|testimonial|تقييم|رأي|نجوم|stars?|rating/.test(combined),
    hasFAQ:       /\bfaq\b|foire.aux.questions|questions.fréquentes|أسئلة.شائعة/.test(combined),
    hasBadges:    /ssl|https|sécurisé|secure|certif|badge|trust|pci|verified|moyen.de.paiement|carte.bancaire|paypal|cmi/.test(combined),
    hasPhone:     /\+\d{6,}|0[56789]\d{8}|téléphone|contactez.nous|اتصل/.test(combined),
    hasAddress:   /adresse|address|المغرب|maroc|casablanca|rabat|تونس|الجزائر/.test(combined),
  };
}

// ── SEO SIGNAL DETECTION ─────────────────────────────────────────
function detectSeoSignals(html = '') {
  const h = html.toLowerCase();
  return {
    hasTitle:       /<title[^>]*>[^<]{5,}<\/title>/i.test(html),
    hasDescription: /meta[^>]+(?:name=["']description["']|property=["']og:description["'])/i.test(html),
    hasH1:          /<h1[\s>]/i.test(html),
    hasSchema:      /application\/ld\+json/i.test(html),
    hasOpenGraph:   /property=["']og:/i.test(html),
    hasCanonical:   /rel=["']canonical["']/i.test(html),
    hasSitemap:     /sitemap/i.test(html),
    hasAltImages:   /img[^>]+alt=["'][^"']{3,}/i.test(html),
    hasBreadcrumb:  /breadcrumb|fil.d.ariane|schema.org\/BreadcrumbList/i.test(html),
    hasInternalLinks: (html.match(/<a[^>]+href=["']//gi) || []).length > 3,
  };
}

// ── TRUST SCORE (0-100) ───────────────────────────────────────────
function calcTrustScoreNum(ts = {}) {
  let score = 0;
  if (ts.hasBadges)   score += 20;
  if (ts.hasReviews)  score += 20;
  if (ts.hasGuarantee) score += 15;
  if (ts.hasReturn)   score += 10;
  if (ts.hasDelivery) score += 10;
  if (ts.hasWhatsApp) score += 10;
  if (ts.hasFAQ)      score += 8;
  if (ts.hasPhone)    score += 5;
  if (ts.hasAddress)  score += 2;
  return Math.min(100, score);
}

// ── SEO SCORE (0-100) ─────────────────────────────────────────────
function calcSeoScoreNum(ss = {}) {
  let score = 0;
  if (ss.hasTitle)        score += 20;
  if (ss.hasDescription)  score += 15;
  if (ss.hasH1)           score += 15;
  if (ss.hasSchema)       score += 15;
  if (ss.hasOpenGraph)    score += 10;
  if (ss.hasCanonical)    score += 8;
  if (ss.hasAltImages)    score += 7;
  if (ss.hasBreadcrumb)   score += 5;
  if (ss.hasInternalLinks) score += 3;
  if (ss.hasSitemap)      score += 2;
  return Math.min(100, score);
}

// ── CONFIDENCE LABEL ──────────────────────────────────────────────
function confidenceLevel(score) {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

// ── PRICING RECOMMENDATION LOGIC ─────────────────────────────────
function buildCommerceRecommendation(priceStats, userPriceRange, trustScore, ts = {}) {
  const { median, min: minP, max: maxP, currency, count } = priceStats;

  // Parse user price range if present
  let userMin = null, userMax = null;
  if (userPriceRange) {
    const nums = [...String(userPriceRange).matchAll(/([\d.,]+)/g)].map(m => normVal(m[1])).filter(Boolean);
    if (nums.length === 1) { userMin = nums[0]; userMax = nums[0]; }
    if (nums.length >= 2)  { userMin = Math.min(...nums); userMax = Math.max(...nums); }
  }

  // Base: observed median, fallback to user price
  let basePrice = median || userMin || null;

  if (!basePrice) {
    return {
      missingData: true,
      defensivePrice: null,
      recommendedRange: null,
      premiumPrice: null,
      pricingRationale: 'Aucun prix fiable observé ni fourni — ajoutez des prix visibles sur la page.',
      nextActions: [
        'Afficher le prix clairement sur la page produit',
        'Ajouter une page pricing ou tarifs',
        'Afficher le prix dans le titre ou le résumé produit',
      ],
    };
  }

  // Adjustments
  let adjustedBase = basePrice;

  // User price signal: if user price is higher than observed median, shift up slightly
  if (userMin && median && userMin > median * 1.1) adjustedBase = (median + userMin) / 2;
  if (userMax && median && userMax > median * 1.2) adjustedBase = Math.min(userMax, median * 1.15);

  // Trust adjustment
  const trustAdj = trustScore >= 70 ? 1.08 : trustScore >= 40 ? 1.0 : 0.95;

  // Guarantee/delivery bonus
  const serviceAdj = (ts.hasGuarantee ? 1.03 : 1.0) * (ts.hasDelivery ? 1.02 : 1.0);

  const recommended = Math.round(adjustedBase * trustAdj * serviceAdj);
  const defensive   = Math.round(recommended * 0.88);
  const premium     = Math.round(recommended * 1.18);
  const cur         = currency || 'MAD';

  const rationale = [
    median ? `Médiane observée: ${median} ${cur}` : null,
    userPriceRange ? `Signal utilisateur: ${userPriceRange}` : null,
    `Ajustement confiance: ${trustAdj > 1 ? '+' : ''}${Math.round((trustAdj - 1) * 100)}%`,
    (ts.hasGuarantee || ts.hasDelivery) ? `Bonus services: +${Math.round((serviceAdj - 1) * 100)}%` : null,
    `Formule: médiane × confiance × services = ${recommended} ${cur}`,
  ].filter(Boolean).join(' · ');

  const nextActions = [];
  if (!ts.hasReviews)  nextActions.push('Ajouter des avis clients visibles');
  if (!ts.hasGuarantee) nextActions.push('Afficher une garantie ou politique de remboursement');
  if (!ts.hasDelivery) nextActions.push('Mentionner les conditions de livraison');
  if (count < 3)       nextActions.push('Ajouter plus de signaux prix sur la page (schema, balises)'); 
  if (nextActions.length === 0) nextActions.push('Maintenir la structure prix actuelle');

  return {
    missingData: false,
    defensivePrice:   `${defensive} ${cur}`,
    recommendedRange: `${recommended}–${Math.round(recommended * 1.08)} ${cur}`,
    premiumPrice:     `${premium} ${cur}`,
    pricingRationale: rationale,
    nextActions,
  };
}

// ── STATS FROM PRICE LIST ─────────────────────────────────────────
function calcPriceStats(prices = []) {
  if (!prices.length) return { count: 0, min: null, max: null, median: null, currency: 'MAD' };
  const vals = prices.map(p => p.value).filter(Number.isFinite).sort((a, b) => a - b);
  if (!vals.length) return { count: 0, min: null, max: null, median: null, currency: 'MAD' };
  const mid = Math.floor(vals.length / 2);
  const median = vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
  const currency = prices.find(p => p.currency)?.currency || 'MAD';
  return { count: vals.length, min: vals[0], max: vals[vals.length - 1], median: Math.round(median), currency };
}

// ── DEDUCTION ────────────────────────────────────────────────────
function buildDeduced(products, priceStats, trustScore, seoScore, pricingPageVisited) {
  const hasProducts = products.length > 0;
  const hasPrices   = priceStats.count > 0;

  let offerType = 'Indéterminé';
  if (hasProducts && hasPrices)    offerType = 'E-commerce (produits + prix)';
  else if (hasProducts)            offerType = 'Catalogue produits (prix non détectés)';
  else if (pricingPageVisited)     offerType = 'SaaS / Service (page pricing détectée)';
  else if (hasPrices)              offerType = 'Offre commerciale (prix sans catalogue)';

  let productIntent = 'Inconnu';
  if (products.length >= 5)  productIntent = `Catalogue large (${products.length}+ produits)`;
  else if (products.length > 0) productIntent = `${products.length} produit(s) détecté(s)`;
  else if (pricingPageVisited)  productIntent = 'Service/SaaS (plans tarifaires)';

  const pricingConf = pricingPageVisited ? confidenceLevel(70) :
                      hasPrices ? confidenceLevel(priceStats.count >= 3 ? 65 : 45) :
                      'LOW';
  const trustConf   = confidenceLevel(trustScore);
  const trustScoreN = trustScore;
  const seoScoreN   = seoScore;

  return { offerType, productIntent, pricingConfidence: pricingConf, trustConfidence: trustConf, trustScore: trustScoreN, seoScore: seoScoreN };
}

// ── PRODUCT DETECTION (from page HTML/text) ───────────────────────
async function detectProducts(page, maxProducts = 6) {
  if (!page) return [];
  try {
    return await page.evaluate((max) => {
      const candidates = [];
      const seen = new Set();

      // Common product card selectors
      const selectors = [
        '[class*="product"]',
        '[class*="item"]',
        '[class*="card"]',
        '[class*="article"]',
        'article',
        '.product',
        '.item',
      ];

      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          if (candidates.length >= max * 3) return;
          const name = el.querySelector('h2,h3,h4,[class*="title"],[class*="name"]')?.innerText?.trim();
          if (!name || name.length < 3 || seen.has(name)) return;
          seen.add(name);

          const priceEl = el.querySelector('[class*="price"],[class*="prix"],[class*="tarif"]');
          const priceText = priceEl?.innerText?.trim() || null;

          const linkEl = el.querySelector('a[href]') || (el.tagName === 'A' ? el : null);
          const link = linkEl?.href || null;

          candidates.push({ name, priceText, link });
        });
        if (candidates.length >= max) break;
      }

      return candidates.slice(0, max);
    }, maxProducts);
  } catch (_) {
    return [];
  }
}

// ── FIND & VISIT PRICING PAGE ─────────────────────────────────────
async function findAndVisitPricingPage(page, baseUrl, timeout = 8000) {
  if (!page) return null;
  try {
    // 1. Look for pricing link in the current page
    const links = await page.evaluate(() => {
      return [...document.querySelectorAll('a[href]')]
        .map(a => ({ href: a.href, text: a.innerText?.trim() || '' }))
        .filter(l => l.href && l.href.startsWith('http'))
        .slice(0, 100);
    });

    const pricingLink = links.find(l =>
      PRICING_PATH_RX.test(l.href) || PRICING_TEXT_RX.test(l.text)
    );

    if (!pricingLink) return null;

    // 2. Navigate to pricing page
    const pricingPage = await page.context().newPage();
    try {
      await pricingPage.goto(pricingLink.href, { waitUntil: 'domcontentloaded', timeout });
      await pricingPage.waitForTimeout(1500);

      const html = await pricingPage.content();
      const text = await pricingPage.evaluate(() => document.body?.innerText || '');
      const prices = extractPricesFromText(text);

      await pricingPage.close().catch(() => {});

      return {
        url: pricingLink.href,
        pricesFound: prices.length,
        prices,
        text: text.slice(0, 2000),
      };
    } catch (e) {
      await pricingPage.close().catch(() => {});
      return null;
    }
  } catch (_) {
    return null;
  }
}

// ── OPEN PRODUCT PAGES ────────────────────────────────────────────
async function openProductPages(page, products, maxPages = 3, timeout = 6000) {
  if (!page || !products.length) return [];
  const evidenceLinks = [];
  const toOpen = products.filter(p => p.link).slice(0, maxPages);

  for (const prod of toOpen) {
    let prodPage = null;
    try {
      prodPage = await page.context().newPage();
      await prodPage.goto(prod.link, { waitUntil: 'domcontentloaded', timeout });
      await prodPage.waitForTimeout(1000);
      const text = await prodPage.evaluate(() => document.body?.innerText || '');
      const prices = extractPricesFromText(text);
      if (prices.length) {
        evidenceLinks.push({ url: prod.link, name: prod.name, prices, price: prices[0]?.value, currency: prices[0]?.currency });
      }
    } catch (_) {}
    finally {
      if (prodPage) await prodPage.close().catch(() => {});
    }
  }
  return evidenceLinks;
}

// ─────────────────────────────────────────────────────────────────
// MAIN: exploreFunnelCommerce
// ─────────────────────────────────────────────────────────────────

async function exploreFunnelCommerce(url, options = {}) {
  const {
    lang            = 'fr',
    userPriceRange  = null,
    timeout         = 20000,
    maxProducts     = 6,
    maxProductPages = 3,
    maxPaginationClicks = 1,
  } = options;

  // Cache check
  const cacheKey = `${url}::${userPriceRange || ''}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let instance = null;
  try {
    instance = await launchPlaywright(url);
    const page = instance?.page;

    // ── Fallback: HTML-only mode (scrape.do or static) ────────────
    let html = instance?.html || '';
    let bodyText = '';

    if (page) {
      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' })).catch(() => {});
      await page.waitForTimeout(800);

      // Pagination/see-more click (max 1)
      try {
        const moreBtn = await page.$('[class*="more"],[class*="voir-plus"],[class*="load-more"],[aria-label*="plus"]');
        if (moreBtn) {
          await moreBtn.click();
          await page.waitForTimeout(1200);
        }
      } catch (_) {}

      html = await page.content().catch(() => '');
      bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    } else if (html) {
      // Static HTML mode: extract text roughly
      bodyText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 50000);
    }

    if (!html && !bodyText) {
      const empty = { success: false, error: 'No content retrieved', commerceExploration: null };
      cacheSet(cacheKey, empty);
      return empty;
    }

    // ── Detect products ───────────────────────────────────────────
    const products = page ? await detectProducts(page, maxProducts) : [];

    // ── Find pricing page ─────────────────────────────────────────
    let pricingPageVisited = null;
    if (page) {
      pricingPageVisited = await findAndVisitPricingPage(page, url, timeout * 0.4);
    }

    // ── Open product pages for price evidence ────────────────────
    let evidenceLinks = [];
    if (page && products.length) {
      evidenceLinks = await openProductPages(page, products, maxProductPages, timeout * 0.3);
    }

    // ── Extract all prices ────────────────────────────────────────
    const mainPrices = extractPricesFromText(bodyText || html.replace(/<[^>]+>/g, ' '));
    const pricingPrices = pricingPageVisited?.prices || [];
    const evidencePrices = evidenceLinks.flatMap(e => e.prices || []);

    // Priority: pricing page > product pages > main page
    const allPrices = [
      ...pricingPrices,
      ...evidencePrices,
      ...mainPrices,
    ].filter(p => p.value >= 1 && p.value < 999999);

    const priceStats = calcPriceStats(allPrices);

    // ── Detect signals ────────────────────────────────────────────
    const trustSignals = detectTrustSignals(html, bodyText);
    const seoSignals   = detectSeoSignals(html);
    const trustScore   = calcTrustScoreNum(trustSignals);
    const seoScore     = calcSeoScoreNum(seoSignals);

    // ── Build deductions ──────────────────────────────────────────
    const deduced = buildDeduced(products, priceStats, trustScore, seoScore, pricingPageVisited);

    // ── Build recommendation ──────────────────────────────────────
    const recommended = buildCommerceRecommendation(priceStats, userPriceRange, trustScore, trustSignals);

    // ── Assemble ──────────────────────────────────────────────────
    const commerceExploration = {
      observed: {
        products,
        pricingPages:    pricingPageVisited ? [pricingPageVisited.url] : [],
        pricingPageVisited,
        priceStats,
        allPrices:       allPrices.slice(0, 30),
        trustSignals,
        seoSignals,
        evidenceLinks,
      },
      userContext: {
        userPriceRange: userPriceRange || null,
      },
      deduced,
      recommended,
    };

    const result = { success: true, commerceExploration };
    cacheSet(cacheKey, result);
    return result;

  } catch (err) {
    console.error(`❌ [FCE] exploreFunnelCommerce failed: ${err.message}`);
    return { success: false, error: err.message, commerceExploration: null };
  } finally {
    if (instance) await closeBrowser(instance).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────

module.exports = {
  exploreFunnelCommerce,
  calcTrustScoreNum,
  calcSeoScoreNum,
  calcPriceStats,
  detectTrustSignals,
  detectSeoSignals,
  extractPricesFromText,
  buildCommerceRecommendation,
};
