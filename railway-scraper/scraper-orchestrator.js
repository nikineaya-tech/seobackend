'use strict';

require('dotenv').config();

const cheerio = require('cheerio');
const { chromium } = require('playwright-extra');
const axios = require('axios');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createCursor } = require('ghost-cursor');

chromium.use(StealthPlugin());

const DEFAULT_TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS || 45000);
const MAX_EXTRA_PAGES = Math.max(0, Number(process.env.SCRAPER_MAX_EXTRA_PAGES || 12));
const USER_AGENT = process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BROWSERLESS_API_TOKEN = process.env.BROWSERLESS_API_TOKEN || '';
const BROWSERLESS_URL = process.env.BROWSERLESS_URL || 'https://production-sfo.browserless.io';
const SCRAPE_DO_TOKEN = process.env.SCRAPE_DO_TOKEN || '';

const ENABLE_BROWSERLESS = String(process.env.SCRAPER_ENABLE_BROWSERLESS || 'true') !== 'false';
const ENABLE_SCRAPEDO = String(process.env.SCRAPER_ENABLE_SCRAPEDO || 'true') !== 'false';
const SCRAPEDO_TIMEOUT_MS = Math.max(10000, Number(process.env.SCRAPEDO_TIMEOUT_MS || 45000));
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

// ─────────────────────────────────────────────────────────────
// CHAPITRE 5 — Enriched ecommerce extraction
// ─────────────────────────────────────────────────────────────

function safeAttr($, el, name) {
  return ($(el).attr(name) || '').trim();
}

function absoluteUrl(rawUrl, baseUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  try {
    return new URL(value, baseUrl).href;
  } catch (_) {
    return '';
  }
}

function extractHeadings($) {
  return {
    h1: $('h1').map((_, el) => compactText($(el).text(), 140)).get().filter(Boolean).slice(0, 5),
    h2: $('h2').map((_, el) => compactText($(el).text(), 160)).get().filter(Boolean).slice(0, 20),
    h3: $('h3').map((_, el) => compactText($(el).text(), 160)).get().filter(Boolean).slice(0, 25)
  };
}

function extractOpenGraph($, baseUrl) {
  const og = {};

  $('meta[property^="og:"], meta[name^="twitter:"]').each((_, el) => {
    const key = safeAttr($, el, 'property') || safeAttr($, el, 'name');
    const content = safeAttr($, el, 'content');

    if (!key || !content) return;

    og[key] = /image/i.test(key) ? absoluteUrl(content, baseUrl) || content : content;
  });

  return og;
}

function extractJsonLd($) {
  const schemas = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = ($(el).contents().text() || '').trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;

        schemas.push({
          type: item['@type'] || item.type || 'Unknown',
          name: item.name || item.headline || '',
          url: item.url || '',
          price: item.offers?.price || item.offers?.lowPrice || '',
          currency: item.offers?.priceCurrency || '',
          availability: item.offers?.availability || '',
          ratingValue: item.aggregateRating?.ratingValue || '',
          reviewCount: item.aggregateRating?.reviewCount || ''
        });
      }
    } catch (_) {
      schemas.push({
        type: 'InvalidJSONLD',
        rawPreview: raw.slice(0, 240)
      });
    }
  });

  return schemas.slice(0, 25);
}

function extractImages($, baseUrl) {
  const images = [];
  const seen = new Set();

  $('img').each((_, el) => {
    const src =
      safeAttr($, el, 'src') ||
      safeAttr($, el, 'data-src') ||
      safeAttr($, el, 'data-lazy-src') ||
      safeAttr($, el, 'data-original');

    const url = absoluteUrl(src, baseUrl);
    if (!url || seen.has(url)) return;

    seen.add(url);

    images.push({
      url,
      alt: compactText(safeAttr($, el, 'alt'), 140),
      title: compactText(safeAttr($, el, 'title'), 140),
      width: safeAttr($, el, 'width'),
      height: safeAttr($, el, 'height')
    });
  });

  return images.slice(0, 40);
}

function extractCtas($) {
  const ctas = [];
  const seen = new Set();

  const selector = [
    'button',
    'a',
    '[role="button"]',
    'input[type="submit"]',
    '.btn',
    '.button',
    '.cta',
    '[class*="button"]',
    '[class*="btn"]'
  ].join(',');

  $(selector).each((_, el) => {
    const text = compactText(
      $(el).text() ||
      safeAttr($, el, 'value') ||
      safeAttr($, el, 'aria-label') ||
      safeAttr($, el, 'title'),
      120
    );

    if (!text) return;

    const signal = `${text} ${safeAttr($, el, 'class')} ${safeAttr($, el, 'href')}`.toLowerCase();

    const isCta = /acheter|commander|ajouter|panier|devis|contact|whatsapp|réserver|reserver|download|essai|demo|start|get started|buy|add to cart|checkout|subscribe|pricing|tarif|voir|découvrir|decouvrir/i.test(signal);
    if (!isCta) return;

    const key = `${text}:${safeAttr($, el, 'href')}`;
    if (seen.has(key)) return;
    seen.add(key);

    ctas.push({
      text,
      href: safeAttr($, el, 'href'),
      type: el.tagName ? el.tagName.toLowerCase() : 'unknown',
      className: compactText(safeAttr($, el, 'class'), 140)
    });
  });

  return ctas.slice(0, 30);
}

function extractForms($) {
  const forms = [];

  $('form').each((_, form) => {
    const inputs = [];

    $(form).find('input, textarea, select').each((__, input) => {
      inputs.push({
        type: safeAttr($, input, 'type') || input.tagName?.toLowerCase() || 'input',
        name: safeAttr($, input, 'name'),
        placeholder: compactText(safeAttr($, input, 'placeholder'), 100),
        required: typeof $(input).attr('required') !== 'undefined'
      });
    });

    forms.push({
      action: safeAttr($, form, 'action'),
      method: safeAttr($, form, 'method') || 'get',
      inputCount: inputs.length,
      inputs: inputs.slice(0, 12)
    });
  });

  return forms.slice(0, 10);
}

function extractFaq($) {
  const faqs = [];
  const seen = new Set();

  $('[class*="faq"], [id*="faq"], details, .accordion, [class*="question"]').each((_, el) => {
    const blockText = compactText($(el).text(), 500);
    if (!blockText || blockText.length < 20) return;

    const key = blockText.slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);

    faqs.push({
      text: blockText
    });
  });

  const jsonLdFaqs = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = ($(el).contents().text() || '').trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (String(item['@type'] || '').toLowerCase() !== 'faqpage') continue;

        for (const q of item.mainEntity || []) {
          jsonLdFaqs.push({
            question: compactText(q.name, 180),
            answer: compactText(q.acceptedAnswer?.text, 300)
          });
        }
      }
    } catch (_) {}
  });

  return {
    detectedBlocks: faqs.slice(0, 10),
    jsonLdFaqs: jsonLdFaqs.slice(0, 20)
  };
}

function detectCmsSignals(html = '', text = '') {
  const value = `${html.slice(0, 50000)} ${text.slice(0, 10000)}`.toLowerCase();

  return {
    wordpress: /wp-content|wp-json|wordpress/.test(value),
    woocommerce: /woocommerce|wc-block|add_to_cart|wc-ajax/.test(value),
    shopify: /cdn\.shopify|shopify|myshopify|shopify-section/.test(value),
    prestashop: /prestashop|blockcart|product-prices/.test(value),
    magento: /magento|mage\/|customer\/section\/load/.test(value),
    wix: /wixstatic|wix\.com/.test(value),
    webflow: /webflow|w-webflow-badge/.test(value),
    googleTagManager: /googletagmanager|gtm\.js/.test(value),
    facebookPixel: /fbq\(|facebook-pixel|connect\.facebook\.net/.test(value),
    tiktokPixel: /ttq\.|analytics\.tiktok/.test(value)
  };
}

function detectEcommerceSignals(html = '', text = '') {
  const value = `${html.slice(0, 60000)} ${text.slice(0, 15000)}`.toLowerCase();

  return {
    hasCart: /cart|panier|basket/.test(value),
    hasCheckout: /checkout|paiement|payment/.test(value),
    hasAddToCart: /add to cart|ajouter au panier|commander|acheter|add_to_cart/.test(value),
    hasPrice: /(\d+[\s,.]?\d*)\s*(mad|dh|dhs|درهم|€|eur|\$|usd|lyd)/i.test(value),
    hasVariants: /variant|taille|size|couleur|color|option|select options/.test(value),
    hasStock: /stock|disponible|available|out of stock|rupture/.test(value),
    hasCoupon: /coupon|promo|discount|réduction|remise/.test(value)
  };
}

function extractSocialAndContactLinks(externalLinks = [], html = '', text = '') {
  const socials = [];
  const whatsappLinks = [];
  const contactLinks = [];

  for (const link of externalLinks || []) {
    const value = String(link.url || '').toLowerCase();

    if (/facebook|instagram|tiktok|linkedin|youtube|twitter|x\.com/.test(value)) {
      socials.push(link);
    }

    if (/wa\.me|whatsapp/.test(value)) {
      whatsappLinks.push(link);
    }

    if (/maps\.google|google\.com\/maps/.test(value)) {
      contactLinks.push({ ...link, type: 'google-maps' });
    }
  }

  const emails = [...new Set(String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])].slice(0, 10);
  const phones = [...new Set(String(text || '').match(/(?:\+?\d[\s().-]*){8,}/g) || [])]
    .map(v => v.replace(/\s+/g, ' ').trim())
    .filter(v => v.length >= 8)
    .slice(0, 10);

  const htmlWhatsapp = [...new Set(String(html || '').match(/https?:\/\/(?:wa\.me|api\.whatsapp\.com)[^"'\s<>]+/gi) || [])]
    .slice(0, 10)
    .map(url => ({ url, label: 'WhatsApp', type: 'whatsapp', source: 'html' }));

  return {
    socialLinks: socials.slice(0, 15),
    whatsappLinks: [...whatsappLinks, ...htmlWhatsapp].slice(0, 15),
    contactLinks: contactLinks.slice(0, 10),
    emails,
    phones
  };
}

function extractPaginationSignals($, baseUrl) {
  const pagination = [];
  const seen = new Set();

  $('.pagination a[href], nav a[href], [rel="next"], [class*="pagination"] a[href], [class*="page-numbers"] a[href]').each((_, el) => {
    const href = safeAttr($, el, 'href');
    const url = normalizeCrawlUrl(href, baseUrl);
    if (!url || seen.has(url)) return;

    seen.add(url);

    pagination.push({
      url,
      label: compactText($(el).text() || safeAttr($, el, 'aria-label') || safeAttr($, el, 'title'), 100),
      rel: safeAttr($, el, 'rel')
    });
  });

  return pagination.slice(0, 20);
}

function extractProductCards($, baseUrl) {
  const cards = [];
  const seen = new Set();

  const selectors = [
    '.product',
    '.product-card',
    '.woocommerce-loop-product__link',
    'li.product',
    '[class*="product"]',
    '[class*="produit"]',
    '[class*="item"]',
    '[class*="card"]'
  ].join(',');

  $(selectors).each((_, el) => {
    const $el = $(el);
    const text = compactText($el.text(), 500);

    if (!text || text.length < 10) return;

    const href = $el.is('a[href]')
      ? safeAttr($, el, 'href')
      : ($el.find('a[href]').first().attr('href') || '');

    const url = absoluteUrl(href, baseUrl);

    const imgEl = $el.find('img').first();
    const image =
      absoluteUrl(imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src'), baseUrl);

    const title =
      compactText($el.find('h1,h2,h3,.title,.product-title,[class*="title"],.woocommerce-loop-product__title').first().text(), 180) ||
      compactText(imgEl.attr('alt'), 180) ||
      text.slice(0, 120);

    const priceText =
      compactText($el.find('.price,[class*="price"],.amount,bdi').first().text(), 120) ||
      compactText((text.match(/(\d{1,3}(?:[\s,.]?\d{3})*(?:[,.]\d{1,2})?)\s*(MAD|DH|DHS|درهم|€|EUR|\$|USD|LYD)/i) || [])[0], 120);

    const cta =
      compactText($el.find('button,a.button,.btn,[class*="button"],[class*="btn"]').first().text(), 120);

    const badge =
      compactText($el.find('.badge,.onsale,[class*="sale"],[class*="promo"],[class*="discount"]').first().text(), 120);

    const key = url || `${title}:${priceText}:${image}`;
    if (!key || seen.has(key)) return;
    seen.add(key);

    cards.push({
      title,
      priceText,
      url,
      image,
      cta,
      badge,
      textPreview: text.slice(0, 240)
    });
  });

  return cards
    .filter(card => card.title || card.priceText || card.image || card.url)
    .slice(0, 40);
}
// ─────────────────────────────────────────────────────────────
// CHAPITRE 2 — Advanced discovery: links + clickable targets
// ─────────────────────────────────────────────────────────────

const POSITIVE_NAVIGATION_PATTERNS = [
  /product/i,
  /produit/i,
  /products/i,
  /collection/i,
  /collections/i,
  /shop/i,
  /store/i,
  /boutique/i,
  /pricing/i,
  /prix/i,
  /tarif/i,
  /tarifs/i,
  /pack/i,
  /plan/i,
  /plans/i,
  /service/i,
  /services/i,
  /solution/i,
  /solutions/i,
  /catalog/i,
  /catalogue/i,
  /category/i,
  /categorie/i,
  /catégorie/i,
  /offer/i,
  /offre/i,
  /devis/i,
  /demo/i,
  /contact/i,
  /about/i,
  /avis/i,
  /review/i,
  /testimonial/i,
  /faq/i,
  /blog/i
];

const POSITIVE_BUTTON_PATTERNS = [
  /voir plus/i,
  /afficher plus/i,
  /charger plus/i,
  /load more/i,
  /show more/i,
  /view more/i,
  /next/i,
  /suivant/i,
  /plus de produits/i,
  /découvrir/i,
  /decouvrir/i,
  /explorer/i,
  /voir produits/i,
  /nos produits/i,
  /boutique/i,
  /shop/i,
  /collection/i,
  /catalogue/i,
  /services/i,
  /tarifs/i,
  /pricing/i,
  /offres/i,
  /plans/i,
  /demander un devis/i,
  /contact/i
];

const NEGATIVE_NAVIGATION_PATTERNS = [
  /checkout/i,
  /cart/i,
  /panier/i,
  /basket/i,
  /login/i,
  /logout/i,
  /account/i,
  /admin/i,
  /wp-admin/i,
  /privacy/i,
  /terms/i,
  /mentions/i,
  /conditions/i,
  /cookies/i,
  /payment/i,
  /paiement/i,
  /delete/i,
  /remove/i,
  /unsubscribe/i
];

function compactText(value = '', max = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function scoreNavigationText(text = '') {
  const value = String(text || '').toLowerCase();
  let score = 0;

  for (const rx of POSITIVE_NAVIGATION_PATTERNS) {
    if (rx.test(value)) score += 25;
  }

  for (const rx of POSITIVE_BUTTON_PATTERNS) {
    if (rx.test(value)) score += 30;
  }

  for (const rx of NEGATIVE_NAVIGATION_PATTERNS) {
    if (rx.test(value)) score -= 100;
  }

  if (/\/products?\//i.test(value)) score += 35;
  if (/\/collections?\//i.test(value)) score += 35;
  if (/\/category\//i.test(value)) score += 25;
  if (/\/shop\b/i.test(value)) score += 25;
  if (/\/services?\b/i.test(value)) score += 20;
  if (/\/pricing\b/i.test(value)) score += 30;

  return score;
}

function extractUrlFromOnclick(onclick = '', baseUrl = '') {
  const value = String(onclick || '').trim();
  if (!value) return null;

  const patterns = [
    /(?:window\.location\.href|location\.href)\s*=\s*['"]([^'"]+)['"]/i,
    /(?:window\.location|location)\s*=\s*['"]([^'"]+)['"]/i,
    /open\(\s*['"]([^'"]+)['"]/i,
    /href=['"]([^'"]+)['"]/i
  ];

  for (const rx of patterns) {
    const match = value.match(rx);
    if (match?.[1]) {
      return normalizeCrawlUrl(match[1], baseUrl);
    }
  }

  return null;
}

function addUrlCandidate({ candidates, seen, rawUrl, baseUrl, label = '', source = 'link', scoreBoost = 0 }) {
  const normalized = normalizeCrawlUrl(rawUrl, baseUrl);
  if (!normalized) return;

  if (isBlockedCrawlUrl(normalized)) return;
  if (seen.has(normalized)) return;

  const base = new URL(baseUrl);
  const url = new URL(normalized);

  if (url.origin !== base.origin) return;

  const scoringText = `${label} ${url.pathname} ${url.search}`.toLowerCase();
  const score = scoreNavigationText(scoringText) + scoreBoost;

  if (score <= 0) return;

  seen.add(normalized);

  candidates.push({
    url: normalized,
    label: compactText(label),
    score,
    source
  });
}
function classifyExternalLink(url = '') {
  const value = String(url || '').toLowerCase();

  if (/facebook\.com|fb\.com/.test(value)) return 'social-facebook';
  if (/instagram\.com/.test(value)) return 'social-instagram';
  if (/tiktok\.com/.test(value)) return 'social-tiktok';
  if (/linkedin\.com/.test(value)) return 'social-linkedin';
  if (/youtube\.com|youtu\.be/.test(value)) return 'social-youtube';
  if (/wa\.me|whatsapp\.com/.test(value)) return 'whatsapp';
  if (/maps\.google|google\.com\/maps/.test(value)) return 'google-maps';
  if (/trustpilot|avis-verifies|reviews/.test(value)) return 'reviews';
  if (/paypal|stripe|payzone|cmi|checkout/.test(value)) return 'payment';
  if (/amazon|etsy|ebay|jumia|aliexpress/.test(value)) return 'marketplace';

  return 'external';
}

function extractAllLinks($, baseUrl) {
  const internalLinks = [];
  const externalLinks = [];
  const seenInternal = new Set();
  const seenExternal = new Set();

  let base;

  try {
    base = new URL(baseUrl);
  } catch (_) {
    return { internalLinks, externalLinks };
  }

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const label = compactText($(el).text() || $(el).attr('aria-label') || $(el).attr('title') || '');

    if (!href || href.startsWith('#') || /^javascript:/i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) {
      return;
    }

    const normalized = normalizeCrawlUrl(href, baseUrl);
    if (!normalized) return;

    try {
      const parsed = new URL(normalized);

      if (parsed.origin === base.origin) {
        if (seenInternal.has(normalized)) return;
        seenInternal.add(normalized);

        internalLinks.push({
          url: normalized,
          label,
          source: 'a[href]',
          score: scoreNavigationText(`${label} ${parsed.pathname}`)
        });
      } else {
        if (seenExternal.has(normalized)) return;
        seenExternal.add(normalized);

        externalLinks.push({
          url: normalized,
          label,
          source: 'a[href]',
          type: classifyExternalLink(normalized)
        });
      }
    } catch (_) {}
  });

  return {
    internalLinks: internalLinks.sort((a, b) => (b.score || 0) - (a.score || 0)),
    externalLinks
  };
}
function extractLinks($, baseUrl) {
  const candidates = [];
  const seen = new Set();

  // 1. Liens classiques <a href>
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const label = compactText($(el).text() || $(el).attr('aria-label') || $(el).attr('title') || '');
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return;

    addUrlCandidate({
      candidates,
      seen,
      rawUrl: href,
      baseUrl,
      label,
      source: 'a[href]',
      scoreBoost: 10
    });
  });

  // 2. Éléments avec data-url / data-href
  $('[data-url], [data-href]').each((_, el) => {
    const rawUrl = ($(el).attr('data-url') || $(el).attr('data-href') || '').trim();
    const label = compactText($(el).text() || $(el).attr('aria-label') || $(el).attr('title') || '');

    addUrlCandidate({
      candidates,
      seen,
      rawUrl,
      baseUrl,
      label,
      source: 'data-url',
      scoreBoost: 15
    });
  });

  // 3. onclick contenant une URL
  $('[onclick]').each((_, el) => {
    const rawUrl = extractUrlFromOnclick($(el).attr('onclick'), baseUrl);
    const label = compactText($(el).text() || $(el).attr('aria-label') || $(el).attr('title') || '');

    if (!rawUrl) return;

    addUrlCandidate({
      candidates,
      seen,
      rawUrl,
      baseUrl,
      label,
      source: 'onclick-url',
      scoreBoost: 10
    });
  });

  // 4. Cartes produits : si une card contient un lien, on booste le lien
  $('[class*="product"], [class*="produit"], [class*="card"], [class*="item"], li.product').each((_, el) => {
    const cardText = compactText($(el).text(), 220);
    const href = $(el).find('a[href]').first().attr('href');

    if (!href) return;

    addUrlCandidate({
      candidates,
      seen,
      rawUrl: href,
      baseUrl,
      label: cardText,
      source: 'product-card',
      scoreBoost: 40
    });
  });

  // 5. Pagination
  $('.pagination a[href], nav a[href], [class*="pagination"] a[href], [class*="page"] a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const label = compactText($(el).text() || $(el).attr('aria-label') || $(el).attr('title') || '');

    addUrlCandidate({
      candidates,
      seen,
      rawUrl: href,
      baseUrl,
      label,
      source: 'pagination',
      scoreBoost: /next|suivant|plus|page/i.test(label) ? 35 : 10
    });
  });

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EXTRA_PAGES);
}
async function discoverClickableTargets(page, baseUrl, options = {}) {
  const maxButtons = Math.max(0, Number(options.maxButtonsPerPage || DEFAULT_CRAWL_OPTIONS.maxButtonsPerPage));

  const rawTargets = await page.evaluate(() => {
    function visible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      return (
        rect.width > 8 &&
        rect.height > 8 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || 1) > 0.05
      );
    }

    function cssPath(el) {
      if (!el || !el.tagName) return '';

      const parts = [];
      let node = el;

      while (node && node.nodeType === 1 && parts.length < 5) {
        let part = node.tagName.toLowerCase();

        if (node.id) {
          part += `#${CSS.escape(node.id)}`;
          parts.unshift(part);
          break;
        }

        const className = String(node.className || '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(cls => `.${CSS.escape(cls)}`)
          .join('');

        part += className;

        const parent = node.parentElement;
        if (parent) {
          const sameTag = [...parent.children].filter(child => child.tagName === node.tagName);
          if (sameTag.length > 1) {
            part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
          }
        }

        parts.unshift(part);
        node = node.parentElement;
      }

      return parts.join(' > ');
    }

    const selector = [
      'button',
      '[role="button"]',
      'a',
      '[data-url]',
      '[data-href]',
      '.load-more',
      '.show-more',
      '.view-more',
      '.next',
      '.pagination a',
      '[class*="load"]',
      '[class*="more"]',
      '[class*="next"]',
      '[class*="pagination"]'
    ].join(',');

    return [...document.querySelectorAll(selector)]
      .filter(visible)
      .map(el => ({
        selector: cssPath(el),
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 180),
        href: el.getAttribute('href') || '',
        dataUrl: el.getAttribute('data-url') || '',
        dataHref: el.getAttribute('data-href') || '',
        onclick: el.getAttribute('onclick') || '',
        className: String(el.className || '').slice(0, 180),
        id: el.id || ''
      }));
  }).catch(() => []);

  const seen = new Set();
  const clickTargets = [];
  const urlTargets = [];

  for (const target of rawTargets) {
    const label = compactText(`${target.text} ${target.className} ${target.id}`, 260);
    const score = scoreNavigationText(label);

    if (score <= 0) continue;
    if (!target.selector) continue;

    const directUrl =
      target.href ||
      target.dataUrl ||
      target.dataHref ||
      extractUrlFromOnclick(target.onclick, baseUrl);

    if (directUrl) {
      const normalized = normalizeCrawlUrl(directUrl, baseUrl);

      if (
        normalized &&
        !isBlockedCrawlUrl(normalized) &&
        isSameOriginUrl(normalized, baseUrl) &&
        !seen.has(`url:${normalized}`)
      ) {
        seen.add(`url:${normalized}`);
        urlTargets.push({
          url: normalized,
          label,
          score: score + 20,
          source: 'clickable-url'
        });
      }

      continue;
    }

    const key = `${target.selector}:${label}`;

    if (seen.has(key)) continue;
    seen.add(key);

    clickTargets.push({
      selector: target.selector,
      label,
      score,
      tag: target.tag,
      source: 'clickable-button'
    });
  }

  return {
    urlTargets: urlTargets.sort((a, b) => b.score - a.score),
    clickTargets: clickTargets.sort((a, b) => b.score - a.score).slice(0, maxButtons),
    totalRawTargets: rawTargets.length
  };
}

// ─────────────────────────────────────────────────────────────
// CHAPITRE 3 — Controlled click explorer
// Clique les boutons utiles sans toucher checkout/login/payment.
// ─────────────────────────────────────────────────────────────

function isDangerousClickLabel(label = '') {
  const value = String(label || '').toLowerCase();

  return NEGATIVE_NAVIGATION_PATTERNS.some(rx => rx.test(value)) ||
    /checkout|cart|panier|basket|payment|paiement|login|logout|account|admin|delete|remove|unsubscribe|commander|acheter|buy now|pay/i.test(value);
}

function hashText(value = '') {
  let hash = 0;
  const str = String(value || '').slice(0, 5000);

  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }

  return String(hash);
}

async function getPageFingerprint(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    const links = document.querySelectorAll('a[href]').length;
    const buttons = document.querySelectorAll('button, [role="button"], .load-more, .show-more, .view-more').length;
    const products = document.querySelectorAll('[class*="product"], [class*="produit"], li.product, .woocommerce').length;

    return {
      textLength: text.length,
      links,
      buttons,
      products,
      title: document.title || '',
      url: location.href
    };
  }).catch(() => ({
    textLength: 0,
    links: 0,
    buttons: 0,
    products: 0,
    title: '',
    url: ''
  }));
}

function didPageChange(before, after) {
  if (!before || !after) return false;

  if (before.url !== after.url) return true;
  if (Math.abs((after.textLength || 0) - (before.textLength || 0)) > 250) return true;
  if ((after.links || 0) !== (before.links || 0)) return true;
  if ((after.products || 0) !== (before.products || 0)) return true;

  return false;
}

async function clickUsefulButtons(page, baseUrl, options = {}) {
  const crawlOptions = buildCrawlOptions(options);
  const clickedButtons = [];
  const discoveredAfterClicks = [];
  const clickedSelectors = new Set();

  const initialTargets = await discoverClickableTargets(page, baseUrl, crawlOptions);
  const targets = (initialTargets.clickTargets || [])
    .filter(target => target?.selector && !isDangerousClickLabel(target.label))
    .slice(0, crawlOptions.maxButtonsPerPage);

  for (const target of targets) {
    if (clickedButtons.length >= crawlOptions.maxClicks) break;
    if (clickedSelectors.has(target.selector)) continue;

    clickedSelectors.add(target.selector);

    const before = await getPageFingerprint(page);
    const beforeTextHash = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      let hash = 0;
      for (let i = 0; i < Math.min(text.length, 5000); i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
      }
      return String(hash);
    }).catch(() => '');

    try {
      const locator = page.locator(target.selector).first();

      const isVisible = await locator.isVisible({ timeout: 1200 }).catch(() => false);
      if (!isVisible) {
        clickedButtons.push({
          ...target,
          clicked: false,
          reason: 'not-visible'
        });
        continue;
      }

      await locator.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(250).catch(() => {});

      await Promise.race([
        locator.click({ timeout: 3500, trial: false }),
        page.waitForTimeout(3500)
      ]);

      await Promise.race([
        page.waitForLoadState('networkidle', { timeout: 4500 }).catch(() => {}),
        page.waitForTimeout(1800)
      ]);

      const after = await getPageFingerprint(page);
      const afterTextHash = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        let hash = 0;
        for (let i = 0; i < Math.min(text.length, 5000); i++) {
          hash = ((hash << 5) - hash) + text.charCodeAt(i);
          hash |= 0;
        }
        return String(hash);
      }).catch(() => '');

      const changed = didPageChange(before, after) || beforeTextHash !== afterTextHash;

      clickedButtons.push({
        ...target,
        clicked: true,
        changed,
        before,
        after,
        clickedAt: new Date().toISOString()
      });

      if (changed) {
        const html = await page.content().catch(() => '');
        const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
        const $ = cheerio.load(html);

        const links = extractLinks($, after.url || baseUrl);
        const { internalLinks, externalLinks } = extractAllLinks($, after.url || baseUrl);
        const prices = extractPrices(text);
        const newTargets = await discoverClickableTargets(page, after.url || baseUrl, crawlOptions);

        discoveredAfterClicks.push({
          sourceButton: {
            selector: target.selector,
            label: target.label,
            score: target.score
          },
          url: after.url || baseUrl,
          title: await page.title().catch(() => ''),
          textLength: text.length,
          htmlLength: html.length,
          prices,
          links,
          internalLinks,
          externalLinks,
          urlTargets: newTargets.urlTargets,
          clickTargets: newTargets.clickTargets,
          scrapedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      clickedButtons.push({
        ...target,
        clicked: false,
        error: String(error?.message || error).slice(0, 500),
        clickedAt: new Date().toISOString()
      });
    }
  }

  return {
    clickedButtons,
    discoveredAfterClicks,
    totalClicked: clickedButtons.filter(btn => btn.clicked).length,
    totalChanged: clickedButtons.filter(btn => btn.changed).length
  };
}

// ─────────────────────────────────────────────────────────────
// CHAPITRE 4 — BFS crawl helpers
// ─────────────────────────────────────────────────────────────

function collectNextUrlsFromPage(pageResult = {}, rootUrl, currentDepth = 0) {
  const candidates = [
    ...(pageResult.links || []),
    ...(pageResult.urlTargets || []),
    ...(pageResult.internalLinks || [])
  ];

  for (const afterClick of pageResult.discoveredAfterClicks || []) {
    candidates.push(...(afterClick.links || []));
    candidates.push(...(afterClick.urlTargets || []));
    candidates.push(...(afterClick.internalLinks || []));
  }

  const seen = new Set();
  const urls = [];

  for (const candidate of candidates) {
    const rawUrl = candidate?.url;
    const normalized = normalizeCrawlUrl(rawUrl, rootUrl);

    if (!normalized) continue;
    if (isBlockedCrawlUrl(normalized)) continue;
    if (!isSameOriginUrl(normalized, rootUrl)) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);

    urls.push({
      url: normalized,
      depth: currentDepth + 1,
      source: candidate.source || 'discovered',
      label: candidate.label || '',
      score: Number(candidate.score || 0)
    });
  }

  return urls.sort((a, b) => b.score - a.score);
}
async function crawlSite(context, startUrl, options = {}) {
  const crawlOptions = buildCrawlOptions(options);
  const startedAt = Date.now();

  const rootUrl = normalizeUrl(startUrl);
  const queue = [{ url: rootUrl, depth: 0, source: 'start', label: 'start', score: 999 }];
  const visited = new Set();
  const pages = [];
  const crawlMap = [];
  const errors = [];

  let mainPage = null;

  while (queue.length > 0 && pages.length < crawlOptions.maxPages) {
    if (Date.now() - startedAt > crawlOptions.crawlBudgetMs) {
      crawlMap.push({
        event: 'budget-exceeded',
        elapsedMs: Date.now() - startedAt,
        remainingQueue: queue.length,
        scrapedPages: pages.length,
        at: new Date().toISOString()
      });
      break;
    }

    const next = queue.shift();
    const normalizedUrl = normalizeCrawlUrl(next.url, rootUrl);

    if (!normalizedUrl) continue;
    if (visited.has(normalizedUrl)) continue;
    if (isBlockedCrawlUrl(normalizedUrl)) continue;
    if (crawlOptions.sameOriginOnly && !isSameOriginUrl(normalizedUrl, rootUrl)) continue;
    if (next.depth > crawlOptions.maxDepth) continue;

    visited.add(normalizedUrl);

    const tab = await context.newPage();

    try {
      const pageResult = await scrapeSinglePage(tab, normalizedUrl, {
        ...crawlOptions,
        clickExplore: next.depth === 0 && options.clickExplore !== false
      });

      pageResult.depth = next.depth;
      pageResult.discoverySource = next.source;
      pageResult.discoveryLabel = next.label;
      pageResult.discoveryScore = next.score;

      if (next.depth === 0) {
        mainPage = pageResult;
      }

      pages.push(pageResult);

      crawlMap.push({
        event: 'scraped',
        url: normalizedUrl,
        depth: next.depth,
        source: next.source,
        label: next.label,
        score: next.score,
        wordCount: pageResult.wordCount,
        pricesFound: Array.isArray(pageResult.prices) ? pageResult.prices.length : 0,
        internalLinksFound: Array.isArray(pageResult.internalLinks) ? pageResult.internalLinks.length : 0,
        externalLinksFound: Array.isArray(pageResult.externalLinks) ? pageResult.externalLinks.length : 0,
        clickTargetsFound: Array.isArray(pageResult.clickTargets) ? pageResult.clickTargets.length : 0,
        buttonsClicked: pageResult.clickExploration?.totalClicked || 0,
        at: new Date().toISOString()
      });

      if (next.depth < crawlOptions.maxDepth) {
        const discovered = collectNextUrlsFromPage(pageResult, rootUrl, next.depth);

        for (const item of discovered) {
          if (pages.length + queue.length >= crawlOptions.maxPages * 3) break;
          if (visited.has(item.url)) continue;
          queue.push(item);
        }

        queue.sort((a, b) => b.score - a.score);
      }
    } catch (error) {
      errors.push({
        url: normalizedUrl,
        depth: next.depth,
        source: next.source,
        error: String(error?.message || error).slice(0, 800),
        at: new Date().toISOString()
      });

      crawlMap.push({
        event: 'error',
        url: normalizedUrl,
        depth: next.depth,
        source: next.source,
        error: String(error?.message || error).slice(0, 500),
        at: new Date().toISOString()
      });
    } finally {
      await tab.close().catch(() => {});
    }
  }

  return {
    rootUrl,
    mainPage: mainPage || pages[0] || null,
    pages,
    crawlMap,
    errors,
    visitedCount: visited.size,
    queuedRemaining: queue.length,
    durationMs: Date.now() - startedAt
  };
}
function buildBrowserlessWsEndpoint() {
  if (!BROWSERLESS_API_TOKEN || !BROWSERLESS_URL) return '';

  const base = BROWSERLESS_URL.replace(/\/+$/, '');

  // Supporte https://production-sfo.browserless.io ou wss://...
  if (/^wss?:\/\//i.test(base)) {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}token=${encodeURIComponent(BROWSERLESS_API_TOKEN)}`;
  }

  const httpUrl = new URL(base);
  const wsProtocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${httpUrl.host}?token=${encodeURIComponent(BROWSERLESS_API_TOKEN)}`;
}

async function createBrowser(provider = 'local') {
  if (provider === 'browserless') {
    const endpoint = buildBrowserlessWsEndpoint();

    if (!endpoint) {
      throw new Error('Browserless not configured: missing BROWSERLESS_API_TOKEN or BROWSERLESS_URL');
    }

    console.log('[RailwayScraper] Connecting to Browserless remote browser...');

    return chromium.connectOverCDP(endpoint, {
      timeout: Math.min(DEFAULT_TIMEOUT_MS, 30000)
    });
  }

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

function isWeakScrapeResult(result = {}) {
  if (!result || typeof result !== 'object') return true;

  const wordCount = Number(result.wordCount || 0);
  const htmlLength = Number(result.htmlLength || 0);
  const pricesCount = Array.isArray(result.prices) ? result.prices.length : 0;
  const productsCount = Array.isArray(result.productCards) ? result.productCards.length : 0;
  const linksCount = Array.isArray(result.internalLinks) ? result.internalLinks.length : 0;

  const hasMeaningfulCommerce =
    pricesCount > 0 ||
    productsCount > 0 ||
    result.ecommerceSignals?.hasPrice ||
    result.ecommerceSignals?.hasAddToCart ||
    result.cmsSignals?.woocommerce ||
    result.cmsSignals?.shopify ||
    result.cmsSignals?.prestashop;

  if (hasMeaningfulCommerce) return false;
  if (wordCount >= 120 && htmlLength >= 3000 && linksCount >= 2) return false;

  return true;
}

function isBlockedHtml(html = '', text = '') {
  const value = `${html.slice(0, 30000)} ${text.slice(0, 10000)}`.toLowerCase();

  return /captcha|cloudflare|access denied|forbidden|verify you are human|are you human|robot check|blocked|checking your browser/i.test(value);
}
async function fetchViaScrapeDo(rawUrl) {
  if (!ENABLE_SCRAPEDO || !SCRAPE_DO_TOKEN) {
    throw new Error('Scrape.do not configured');
  }

  const targetUrl = normalizeUrl(rawUrl);

  const endpoint = 'https://api.scrape.do/';
  const response = await axios.get(endpoint, {
    timeout: SCRAPEDO_TIMEOUT_MS,
    params: {
      token: SCRAPE_DO_TOKEN,
      url: targetUrl,
      render: 'true',
      super: 'true'
    },
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    validateStatus: status => status >= 200 && status < 500
  });

  if (response.status === 429) {
    const err = new Error('Scrape.do rate limited 429');
    err.code = 'SCRAPEDO_429';
    err.status = 429;
    throw err;
  }

  if (response.status >= 400) {
    const err = new Error(`Scrape.do HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return String(response.data || '');
}

function buildPageResultFromHtml(html = '', url = '', provider = 'scrape.do') {
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').first().text().replace(/\s+/g, ' ').trim();
  const headings = extractHeadings($);
  const h1 = headings.h1[0] || '';
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const language = $('html').attr('lang') || '';
  const openGraph = extractOpenGraph($, url);
  const jsonLd = extractJsonLd($);
  const images = extractImages($, url);
  const productCards = extractProductCards($, url);
  const ctas = extractCtas($);
  const forms = extractForms($);
  const faq = extractFaq($);
  const cmsSignals = detectCmsSignals(html, text);
  const ecommerceSignals = detectEcommerceSignals(html, text);
  const prices = extractPrices(text);
  const links = extractLinks($, url);
  const { internalLinks, externalLinks } = extractAllLinks($, url);
  const socialContact = extractSocialAndContactLinks(externalLinks, html, text);
  const paginationSignals = extractPaginationSignals($, url);

  return {
    url,
    title,
    h1,
    headings,
    metaDescription,
    canonical: absoluteUrl(canonical, url) || canonical,
    language,
    openGraph,
    jsonLd,
    images,
    productCards,
    ctas,
    forms,
    faq,
    cmsSignals,
    ecommerceSignals,
    socialLinks: socialContact.socialLinks,
    whatsappLinks: socialContact.whatsappLinks,
    contactLinks: socialContact.contactLinks,
    emails: socialContact.emails,
    phones: socialContact.phones,
    paginationSignals,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    prices,
    links,
    internalLinks,
    externalLinks,
    discoveredTargets: { urlTargets: [], clickTargets: [], totalRawTargets: 0 },
    clickTargets: [],
    urlTargets: [],
    clickExploration: { clickedButtons: [], discoveredAfterClicks: [], totalClicked: 0, totalChanged: 0 },
    clickedButtons: [],
    discoveredAfterClicks: [],
    trustSignals: {
      hasWhatsapp: /wa\.me|whatsapp/i.test(html),
      hasReviews: /avis|reviews?|rating|étoile|stars?|testimonial|témoignage/i.test(text),
      hasGuarantee: /garantie|rembours|refund|money back|ضمان/i.test(text),
      hasDelivery: /livraison|delivery|shipping|توصيل/i.test(text),
      hasContact: /contact|support|email|téléphone|phone|whatsapp/i.test(text)
    },
    provider,
    htmlLength: html.length,
    scrapedAt: new Date().toISOString()
  };
}

async function scrapeSinglePage(page, url, options = {}){
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

 const headings = extractHeadings($);
const h1 = headings.h1[0] || '';
const metaDescription = $('meta[name="description"]').attr('content') || '';
const canonical = $('link[rel="canonical"]').attr('href') || '';
const language = $('html').attr('lang') || '';
const openGraph = extractOpenGraph($, url);
const jsonLd = extractJsonLd($);
const images = extractImages($, url);
const productCards = extractProductCards($, url);
const ctas = extractCtas($);
const forms = extractForms($);
const faq = extractFaq($);
const cmsSignals = detectCmsSignals(html, text);
const ecommerceSignals = detectEcommerceSignals(html, text);
const prices = extractPrices(text);
const links = extractLinks($, url);
const { internalLinks, externalLinks } = extractAllLinks($, url);
const socialContact = extractSocialAndContactLinks(externalLinks, html, text);
const paginationSignals = extractPaginationSignals($, url);
const discoveredTargets = await discoverClickableTargets(page, url, options);
const clickExploration = options.clickExplore === false
  ? { clickedButtons: [], discoveredAfterClicks: [], totalClicked: 0, totalChanged: 0 }
  : await clickUsefulButtons(page, url, options);

  return {
  url,
  title,
  h1,
  headings,
  metaDescription,
  canonical: absoluteUrl(canonical, url) || canonical,
  language,
  openGraph,
  jsonLd,
  images,
  productCards,
  ctas,
  forms,
  faq,
  cmsSignals,
  ecommerceSignals,
  socialLinks: socialContact.socialLinks,
  whatsappLinks: socialContact.whatsappLinks,
  contactLinks: socialContact.contactLinks,
  emails: socialContact.emails,
  phones: socialContact.phones,
  paginationSignals,
  wordCount: text.split(/\s+/).filter(Boolean).length,
  prices,
   links,
internalLinks,
externalLinks,
discoveredTargets,
clickTargets: discoveredTargets.clickTargets,
urlTargets: discoveredTargets.urlTargets,
clickExploration,
clickedButtons: clickExploration.clickedButtons,
discoveredAfterClicks: clickExploration.discoveredAfterClicks,
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


async function scrapeUrlWithProvider(rawUrl, options = {}, provider = 'local') {
  const crawlOptions = buildCrawlOptions(options);
  const url = normalizeUrl(rawUrl);
  const browser = await createBrowser(provider);
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

    const shouldExplore = options.explore !== false;

    let crawlResult;

    if (shouldExplore) {
      crawlResult = await crawlSite(context, url, {
        ...crawlOptions,
        clickExplore: options.clickExplore !== false
      });
    } else {
      const singlePage = await context.newPage();

      try {
        const mainOnly = await scrapeSinglePage(singlePage, url, {
          ...crawlOptions,
          clickExplore: options.clickExplore !== false
        });

        crawlResult = {
          rootUrl: url,
          mainPage: mainOnly,
          pages: [mainOnly],
          crawlMap: [{
            event: 'scraped',
            url,
            depth: 0,
            source: 'start',
            label: 'start',
            score: 999,
            at: new Date().toISOString()
          }],
          errors: [],
          visitedCount: 1,
          queuedRemaining: 0,
          durationMs: Date.now() - startedAt
        };
      } finally {
        await singlePage.close().catch(() => {});
      }
    }

    await context.close().catch(() => {});

    const mainPage = crawlResult.mainPage;
    const pages = crawlResult.pages || [];
    const extraPages = pages.filter(page => page.url !== mainPage?.url);
    const allPages = pages.length ? pages : [mainPage].filter(Boolean);

    return {
      success: true,
      provider: provider === 'browserless' ? 'railway-browserless-multi-agent' : 'railway-playwright-multi-agent',
      inputUrl: rawUrl,
      normalizedUrl: url,
      crawlOptions,
      durationMs: Date.now() - startedAt,
      mainPage,
      pages: allPages,
      extraPages,
      crawlMap: crawlResult.crawlMap || [],
      crawlErrors: crawlResult.errors || [],
      summary: {
        pagesScraped: allPages.filter(Boolean).length,
        visitedCount: crawlResult.visitedCount || allPages.filter(Boolean).length,
        queuedRemaining: crawlResult.queuedRemaining || 0,
        pricesFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.prices) ? page.prices.length : 0), 0),
        productCardsFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.productCards) ? page.productCards.length : 0), 0),
        imagesFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.images) ? page.images.length : 0), 0),
        ctasFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.ctas) ? page.ctas.length : 0), 0),
        formsFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.forms) ? page.forms.length : 0), 0),
        faqBlocksFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.faq?.detectedBlocks) ? page.faq.detectedBlocks.length : 0), 0),
        jsonLdSchemasFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.jsonLd) ? page.jsonLd.length : 0), 0),
        whatsappLinksFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.whatsappLinks) ? page.whatsappLinks.length : 0), 0),
        socialLinksFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.socialLinks) ? page.socialLinks.length : 0), 0),
        linksDiscovered: allPages.reduce((sum, page) => sum + (Array.isArray(page?.links) ? page.links.length : 0), 0),
        internalLinksFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.internalLinks) ? page.internalLinks.length : 0), 0),
        externalLinksFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.externalLinks) ? page.externalLinks.length : 0), 0),
        urlTargetsDiscovered: allPages.reduce((sum, page) => sum + (Array.isArray(page?.urlTargets) ? page.urlTargets.length : 0), 0),
        clickTargetsDiscovered: allPages.reduce((sum, page) => sum + (Array.isArray(page?.clickTargets) ? page.clickTargets.length : 0), 0),
        rawClickableTargets: allPages.reduce((sum, page) => sum + Number(page?.discoveredTargets?.totalRawTargets || 0), 0),
        buttonsClicked: allPages.reduce((sum, page) => sum + Number(page?.clickExploration?.totalClicked || 0), 0),
        buttonsChangedDom: allPages.reduce((sum, page) => sum + Number(page?.clickExploration?.totalChanged || 0), 0),
        afterClickDiscoveries: allPages.reduce((sum, page) => sum + (Array.isArray(page?.discoveredAfterClicks) ? page.discoveredAfterClicks.length : 0), 0),
        errors: (crawlResult.errors || []).length,
        trustSignals: mainPage?.trustSignals || {}
      }
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
async function scrapeUrl(rawUrl, options = {}) {
  const url = normalizeUrl(rawUrl);
  const attempts = [];

  // 1. Local Playwright
  try {
    const localResult = await scrapeUrlWithProvider(url, options, 'local');

    attempts.push({
      provider: 'local',
      success: true,
      weak: isWeakScrapeResult(localResult.mainPage)
    });

    if (!isWeakScrapeResult(localResult.mainPage)) {
      return {
        ...localResult,
        attempts
      };
    }

    console.warn('[RailwayScraper] Local scrape weak. Trying Browserless...');
  } catch (error) {
    attempts.push({
      provider: 'local',
      success: false,
      error: String(error?.message || error).slice(0, 500)
    });

    console.warn('[RailwayScraper] Local scrape failed:', error.message);
  }

  // 2. Browserless
  if (ENABLE_BROWSERLESS && BROWSERLESS_API_TOKEN) {
    try {
      const browserlessResult = await scrapeUrlWithProvider(url, options, 'browserless');

      attempts.push({
        provider: 'browserless',
        success: true,
        weak: isWeakScrapeResult(browserlessResult.mainPage)
      });

      if (!isWeakScrapeResult(browserlessResult.mainPage)) {
        return {
          ...browserlessResult,
          attempts
        };
      }

      console.warn('[RailwayScraper] Browserless scrape weak. Trying Scrape.do...');
    } catch (error) {
      attempts.push({
        provider: 'browserless',
        success: false,
        error: String(error?.message || error).slice(0, 500)
      });

      console.warn('[RailwayScraper] Browserless failed:', error.message);
    }
  } else {
    attempts.push({
      provider: 'browserless',
      success: false,
      skipped: true,
      reason: 'BROWSERLESS_API_TOKEN missing or disabled'
    });
  }

  // 3. Scrape.do fallback
  if (ENABLE_SCRAPEDO && SCRAPE_DO_TOKEN) {
    try {
      const html = await fetchViaScrapeDo(url);

      if (isBlockedHtml(html)) {
        attempts.push({
          provider: 'scrape.do',
          success: false,
          weak: true,
          error: 'Blocked HTML detected'
        });
      } else {
        const pageResult = buildPageResultFromHtml(html, url, 'scrape.do');

        attempts.push({
          provider: 'scrape.do',
          success: true,
          weak: isWeakScrapeResult(pageResult)
        });

        return {
          success: true,
          provider: 'railway-scrapedo-fallback',
          inputUrl: rawUrl,
          normalizedUrl: url,
          crawlOptions: buildCrawlOptions(options),
          durationMs: 0,
          mainPage: pageResult,
          pages: [pageResult],
          extraPages: [],
          crawlMap: [{
            event: 'scraped',
            url,
            depth: 0,
            source: 'scrape.do',
            label: 'scrape.do fallback',
            score: 500,
            at: new Date().toISOString()
          }],
          crawlErrors: [],
          attempts,
          summary: {
            pagesScraped: 1,
            visitedCount: 1,
            queuedRemaining: 0,
            pricesFound: Array.isArray(pageResult.prices) ? pageResult.prices.length : 0,
            productCardsFound: Array.isArray(pageResult.productCards) ? pageResult.productCards.length : 0,
            imagesFound: Array.isArray(pageResult.images) ? pageResult.images.length : 0,
            ctasFound: Array.isArray(pageResult.ctas) ? pageResult.ctas.length : 0,
            formsFound: Array.isArray(pageResult.forms) ? pageResult.forms.length : 0,
            faqBlocksFound: Array.isArray(pageResult.faq?.detectedBlocks) ? pageResult.faq.detectedBlocks.length : 0,
            jsonLdSchemasFound: Array.isArray(pageResult.jsonLd) ? pageResult.jsonLd.length : 0,
            whatsappLinksFound: Array.isArray(pageResult.whatsappLinks) ? pageResult.whatsappLinks.length : 0,
            socialLinksFound: Array.isArray(pageResult.socialLinks) ? pageResult.socialLinks.length : 0,
            linksDiscovered: Array.isArray(pageResult.links) ? pageResult.links.length : 0,
            internalLinksFound: Array.isArray(pageResult.internalLinks) ? pageResult.internalLinks.length : 0,
            externalLinksFound: Array.isArray(pageResult.externalLinks) ? pageResult.externalLinks.length : 0,
            urlTargetsDiscovered: 0,
            clickTargetsDiscovered: 0,
            rawClickableTargets: 0,
            buttonsClicked: 0,
            buttonsChangedDom: 0,
            afterClickDiscoveries: 0,
            errors: 0,
            trustSignals: pageResult.trustSignals || {}
          }
        };
      }
    } catch (error) {
      attempts.push({
        provider: 'scrape.do',
        success: false,
        error: String(error?.message || error).slice(0, 500),
        code: error?.code || undefined,
        status: error?.status || undefined
      });

      console.warn('[RailwayScraper] Scrape.do failed:', error.message);
    }
  } else {
    attempts.push({
      provider: 'scrape.do',
      success: false,
      skipped: true,
      reason: 'SCRAPE_DO_TOKEN missing or disabled'
    });
  }

  return {
    success: false,
    provider: 'railway-scraper-failed',
    inputUrl: rawUrl,
    normalizedUrl: url,
    attempts,
    error: 'All scraping providers failed or returned weak data',
    scrapedAt: new Date().toISOString()
  };
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
