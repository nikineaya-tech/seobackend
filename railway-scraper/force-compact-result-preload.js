'use strict';

/**
 * Railway forced JSON compact preload
 *
 * Re-enabled after rollback: acts as the second layer of defence when
 * json-sanitize-preload fails or the result is still too large after
 * sanitization.  Aggressively compacts scrape_jobs.result into a small,
 * guaranteed JSONB-safe shape before every Supabase update().
 *
 * Load order (package.json):
 *   1. json-sanitize-preload  – removes HTML/buffers, trims strings
 *   2. force-compact-result-preload (this file) – structural compaction
 *   3. landing-section-preload – section block enrichment
 *
 * The __dakaForceCompactPatched guard prevents double-patching when both
 * preloads are active.
 */

const Module = require('module');
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request !== '@supabase/supabase-js' || !loaded || loaded.__dakaForceCompactPatched) return loaded;

  const originalCreateClient = loaded.createClient;
  if (typeof originalCreateClient !== 'function') return loaded;

  loaded.createClient = function forceCompactCreateClient() {
    const client = originalCreateClient.apply(this, arguments);
    if (!client || client.__dakaForceCompactClient) return client;

    const originalFrom = client.from.bind(client);
    client.from = function forceCompactFrom(table) {
      const builder = originalFrom(table);
      if (String(table) !== 'scrape_jobs' || !builder || builder.__dakaForceCompactBuilder) return builder;

      const originalUpdate = builder.update.bind(builder);
      builder.update = function forceCompactUpdate(patch, options) {
        if (patch && patch.result && typeof patch.result === 'object') {
          try {
            patch = { ...patch, result: buildJsonSafeResult(patch.result) };
          } catch (compactErr) {
            console.error('[RailwayForceCompact] buildJsonSafeResult threw:', compactErr.message);
            patch = {
              ...patch,
              result: {
                success: false,
                compacted: true,
                compactStrategy: 'force-compact-emergency-fallback',
                compactError: String(compactErr.message).slice(0, 200),
                url: clean(patch.result && (patch.result.url || patch.result.targetUrl), 500),
                title: clean(patch.result && patch.result.title, 240)
              }
            };
          }
        }
        if (patch && patch.error !== undefined && patch.error !== null) {
          patch = { ...patch, error: clean(String(patch.error), 2000) };
        }
        return originalUpdate(patch, options);
      };

      builder.__dakaForceCompactBuilder = true;
      return builder;
    };

    client.__dakaForceCompactClient = true;
    return client;
  };

  loaded.__dakaForceCompactPatched = true;
  console.log('[RailwayForceCompact] Forced JSONB-safe scrape result compaction enabled');
  return loaded;
};

console.log('[RailwayForceCompact] Preload registered — waiting for @supabase/supabase-js load');

function buildJsonSafeResult(result) {
  const pages = Array.isArray(result.pages) ? result.pages : Array.isArray(result.results) ? result.results : [];
  const main = result.mainPage || result.page || pages[0] || result;
  const sections = collectSections(result).slice(0, 35).map(normalizeSection).filter(Boolean);

  const compact = {
    success: result.success !== false,
    compacted: true,
    compactStrategy: 'forced-jsonb-safe-result',
    provider: pick(result.provider, result.layer, result.source, 'railway-playwright'),
    layer: pick(result.layer, result.provider, 'railway-playwright'),
    url: pick(result.url, result.targetUrl, main && main.url),
    title: clean(pick(result.title, main && main.title), 240),
    h1: clean(pick(result.h1, main && main.h1), 240),
    metaDescription: clean(pick(result.metaDescription, main && main.metaDescription), 500),
    colors: arr(pick(result.colors, main && main.colors)).slice(0, 8).map(v => clean(v, 32)),
    cms: clean(pick(result.cms, main && main.cms), 80),
    price: safeScalar(pick(result.price, result.primaryPrice, main && main.price)),
    currency: clean(pick(result.currency, main && main.currency), 20),
    priceIntel: normalizePriceIntel(pick(result.priceIntel, result.pricingIntel, main && main.priceIntel)),
    summary: normalizeSummary(result.summary),
    sectionRawBlocks: sections,
    sectionBlocks: sections,
    sectionsDetailed: sections,
    pagesExplored: pages.slice(0, 8).map(page => ({
      url: clean(pick(page && page.url, page && page.normalizedUrl), 500),
      title: clean(page && page.title, 220),
      sectionRawBlocksFound: arr(page && (page.sectionRawBlocks || page.sectionBlocks || page.sectionsDetailed)).length
    })).filter(page => page.url),
    counts: {
      pages: pages.length,
      sectionRawBlocks: sections.length,
      images: countArrays(result, 'images'),
      ctas: countArrays(result, 'ctas'),
      prices: countArrays(result, 'prices')
    },
    limits: {
      htmlRemoved: true,
      scriptsRemoved: true,
      stylesRemoved: true,
      forcedCompact: true
    }
  };

  // Final serialization round-trip: catches any remaining non-JSON-safe values
  // (circular refs, Infinity, NaN, undefined, etc.) before Supabase sees them.
  try {
    return JSON.parse(JSON.stringify(compact));
  } catch (serializeErr) {
    console.error('[RailwayForceCompact] JSON round-trip failed:', serializeErr.message);
    // Absolute last resort: return a minimal stub so the job can still be marked done.
    return {
      success: true,
      compacted: true,
      compactStrategy: 'force-compact-serialize-fallback',
      serializeError: String(serializeErr.message).slice(0, 200),
      url: clean(result && (result.url || result.targetUrl), 500),
      title: clean(result && result.title, 240),
      sectionRawBlocks: [],
      sectionBlocks: [],
      sectionsDetailed: [],
      counts: { pages: 0, sectionRawBlocks: 0 }
    };
  }
}

function normalizeSection(block) {
  if (!block || typeof block !== 'object') return null;
  const prices = arr(block.prices || block.priceSignals).slice(0, 5).map(item => ({
    value: safeScalar(item && item.value !== undefined ? item.value : item),
    currency: clean(item && item.currency, 20),
    context: clean(item && item.context, 160)
  }));

  return {
    position: Number(block.position || block.index || 0) || null,
    tag: clean(block.tag, 30),
    selector: clean(block.selector, 160),
    id: clean(block.id, 100),
    className: clean(block.className, 160),
    visible: block.visible !== false,
    detectedType: clean(pick(block.detectedType, block.type), 80),
    type: clean(pick(block.type, block.detectedType), 80),
    label: clean(block.label, 140),
    title: clean(block.title, 220),
    headings: arr(block.headings).slice(0, 6).map(v => clean(v, 180)).filter(Boolean),
    paragraphs: arr(block.paragraphs).slice(0, 8).map(v => clean(v, 220)).filter(Boolean),
    textPreview: clean(pick(block.textPreview, block.text), 420),
    wordCount: Number(block.wordCount || 0) || 0,
    ctas: arr(block.ctas).slice(0, 6).map(item => ({ text: clean(item && item.text !== undefined ? item.text : item, 140), href: clean(item && item.href, 400) })),
    prices,
    priceSignals: prices,
    images: arr(block.images).slice(0, 5).map(item => ({ url: clean(item && item.url, 500), alt: clean(item && item.alt, 120) })),
    links: arr(block.links).slice(0, 6).map(item => ({ url: clean(item && item.url, 500), label: clean(item && item.label, 120) })),
    forms: arr(block.forms).slice(0, 2).map(item => ({ inputCount: Number(item && item.inputCount || 0) || 0 })),
    trustSignals: normalizeTrust(block.trustSignals),
    rawEvidence: arr(block.rawEvidence || block.evidence).slice(0, 5).map(v => clean(v, 180)).filter(Boolean),
    extractionSource: clean(block.extractionSource || 'railway-dom-section-scan', 80),
    confidence: clean(block.confidence || 'MEDIUM', 20)
  };
}

function collectSections(root) {
  const out = [];
  const seen = new WeakSet();
  const visit = (node, depth) => {
    if (!node || depth > 6 || out.length >= 80) return;
    if (Array.isArray(node)) return node.slice(0, 40).forEach(item => visit(item, depth + 1));
    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    ['sectionRawBlocks', 'sectionBlocks', 'sectionsDetailed', 'domSections', 'rawSections'].forEach(key => {
      if (Array.isArray(node[key])) out.push(...node[key]);
    });
    ['mainPage', 'page', 'pages', 'results', 'extraPages', 'data', 'result'].forEach(key => visit(node[key], depth + 1));
  };
  visit(root, 0);
  return out;
}

function normalizePriceIntel(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    primaryPrice: safeScalar(pick(value.primaryPrice, value.detectedPrice, value.price)),
    currencyDetected: clean(pick(value.currencyDetected, value.currency), 20),
    priceConfidence: clean(pick(value.priceConfidence, value.confidence, value.confidenceBand), 40),
    priceExtractionReason: clean(pick(value.priceExtractionReason, value.reason), 240)
  };
}

function normalizeSummary(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    pagesExplored: safeScalar(value.pagesExplored),
    sectionRawBlocksFound: safeScalar(value.sectionRawBlocksFound),
    pricesFound: safeScalar(value.pricesFound),
    ctasFound: safeScalar(value.ctasFound),
    imagesFound: safeScalar(value.imagesFound)
  };
}

function normalizeTrust(value) {
  const v = value && typeof value === 'object' ? value : {};
  return {
    hasReviews: Boolean(v.hasReviews),
    hasGuarantee: Boolean(v.hasGuarantee),
    hasDelivery: Boolean(v.hasDelivery),
    hasWhatsapp: Boolean(v.hasWhatsapp),
    hasPaymentSecurity: Boolean(v.hasPaymentSecurity)
  };
}

function countArrays(root, key) {
  let total = 0;
  const seen = new WeakSet();
  const visit = (node, depth) => {
    if (!node || depth > 5) return;
    if (Array.isArray(node)) return node.slice(0, 30).forEach(item => visit(item, depth + 1));
    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node[key])) total += node[key].length;
    ['mainPage', 'page', 'pages', 'results', 'extraPages'].forEach(k => visit(node[k], depth + 1));
  };
  visit(root, 0);
  return total;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function pick() {
  for (const value of arguments) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function safeScalar(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return clean(value, 120);
  return clean(JSON.stringify(value), 120);
}

function clean(value, max) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 250);
}
