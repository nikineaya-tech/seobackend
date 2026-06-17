'use strict';

const Module = require('module');
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request !== '@supabase/supabase-js' || !loaded || loaded.__dakaForceCompactResultPatched) return loaded;

  const originalCreateClient = loaded.createClient;
  if (typeof originalCreateClient !== 'function') return loaded;

  loaded.createClient = function patchedCreateClient() {
    const client = originalCreateClient.apply(this, arguments);
    if (!client || client.__dakaForceCompactResultClient) return client;

    const originalFrom = client.from.bind(client);
    client.from = function patchedFrom(table) {
      const builder = originalFrom(table);
      if (String(table) !== 'scrape_jobs' || !builder || builder.__dakaForceCompactResultBuilder) return builder;

      const originalUpdate = builder.update.bind(builder);
      builder.update = function patchedUpdate(patch, options) {
        if (patch && patch.result && typeof patch.result === 'object') {
          patch = { ...patch, result: compactResult(patch.result) };
        }
        return originalUpdate(patch, options);
      };

      builder.__dakaForceCompactResultBuilder = true;
      return builder;
    };

    client.__dakaForceCompactResultClient = true;
    return client;
  };

  loaded.__dakaForceCompactResultPatched = true;
  console.log('[RailwayForceCompact] Forced compact result enabled');
  return loaded;
};

function compactResult(result) {
  const pages = Array.isArray(result.pages) ? result.pages : Array.isArray(result.results) ? result.results : [];
  const main = result.mainPage || result.page || pages[0] || result || {};
  const sections = collectSections(result).slice(0, 35).map(normalizeSection).filter(Boolean);
  return JSON.parse(JSON.stringify({
    success: result.success !== false,
    compacted: true,
    compactStrategy: 'forced-jsonb-safe-result',
    provider: safe(result.provider || result.layer || 'railway-playwright', 80),
    layer: safe(result.layer || result.provider || 'railway-playwright', 80),
    url: safe(result.url || result.targetUrl || main.url || '', 500),
    title: safe(result.title || main.title || '', 240),
    h1: safe(result.h1 || main.h1 || '', 240),
    metaDescription: safe(result.metaDescription || main.metaDescription || '', 500),
    colors: list(result.colors || main.colors, 8).map(x => safe(x, 32)),
    cms: safe(result.cms || main.cms || '', 80),
    price: scalar(result.price || result.primaryPrice || main.price),
    currency: safe(result.currency || main.currency || '', 20),
    priceIntel: normalizePriceIntel(result.priceIntel || result.pricingIntel || main.priceIntel),
    summary: normalizeSummary(result.summary),
    sectionRawBlocks: sections,
    sectionBlocks: sections,
    sectionsDetailed: sections,
    pagesExplored: pages.slice(0, 8).map(p => ({ url: safe((p && (p.url || p.normalizedUrl)) || '', 500), title: safe((p && p.title) || '', 180) })).filter(p => p.url),
    counts: { pages: pages.length, sectionRawBlocks: sections.length },
    limits: { htmlRemoved: true, scriptsRemoved: true, stylesRemoved: true, forcedCompact: true }
  }));
}

function normalizeSection(block) {
  if (!block || typeof block !== 'object') return null;
  const prices = list(block.prices || block.priceSignals, 5).map(item => ({ value: scalar(item && item.value !== undefined ? item.value : item), currency: safe(item && item.currency || '', 20), context: safe(item && item.context || '', 160) }));
  return {
    position: Number(block.position || block.index || 0) || null,
    tag: safe(block.tag || '', 30),
    selector: safe(block.selector || '', 160),
    id: safe(block.id || '', 100),
    className: safe(block.className || '', 160),
    visible: block.visible !== false,
    detectedType: safe(block.detectedType || block.type || '', 80),
    type: safe(block.type || block.detectedType || '', 80),
    label: safe(block.label || '', 140),
    title: safe(block.title || '', 220),
    headings: list(block.headings, 6).map(x => safe(x, 180)).filter(Boolean),
    paragraphs: list(block.paragraphs, 8).map(x => safe(x, 220)).filter(Boolean),
    textPreview: safe(block.textPreview || block.text || '', 420),
    wordCount: Number(block.wordCount || 0) || 0,
    ctas: list(block.ctas, 6).map(item => ({ text: safe((item && item.text !== undefined ? item.text : item) || '', 140), href: safe(item && item.href || '', 400) })),
    prices,
    priceSignals: prices,
    images: list(block.images, 5).map(item => ({ url: safe(item && item.url || '', 500), alt: safe(item && item.alt || '', 120) })),
    links: list(block.links, 6).map(item => ({ url: safe(item && item.url || '', 500), label: safe(item && item.label || '', 120) })),
    forms: list(block.forms, 2).map(item => ({ inputCount: Number(item && item.inputCount || 0) || 0 })),
    trustSignals: normalizeTrust(block.trustSignals),
    rawEvidence: list(block.rawEvidence || block.evidence, 5).map(x => safe(x, 180)).filter(Boolean),
    extractionSource: safe(block.extractionSource || 'railway-dom-section-scan', 80),
    confidence: safe(block.confidence || 'MEDIUM', 20)
  };
}

function collectSections(root) {
  const out = [];
  const seen = new WeakSet();
  function visit(node, depth) {
    if (!node || depth > 6 || out.length >= 80) return;
    if (Array.isArray(node)) return node.slice(0, 40).forEach(item => visit(item, depth + 1));
    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    ['sectionRawBlocks', 'sectionBlocks', 'sectionsDetailed', 'domSections', 'rawSections'].forEach(key => { if (Array.isArray(node[key])) out.push(...node[key]); });
    ['mainPage', 'page', 'pages', 'results', 'extraPages', 'data', 'result'].forEach(key => visit(node[key], depth + 1));
  }
  visit(root, 0);
  return out;
}

function normalizePriceIntel(value) {
  if (!value || typeof value !== 'object') return null;
  return { primaryPrice: scalar(value.primaryPrice || value.detectedPrice || value.price), currencyDetected: safe(value.currencyDetected || value.currency || '', 20), priceConfidence: safe(value.priceConfidence || value.confidence || value.confidenceBand || '', 40), priceExtractionReason: safe(value.priceExtractionReason || value.reason || '', 240) };
}

function normalizeSummary(value) {
  if (!value || typeof value !== 'object') return null;
  return { pagesExplored: scalar(value.pagesExplored), sectionRawBlocksFound: scalar(value.sectionRawBlocksFound), pricesFound: scalar(value.pricesFound), ctasFound: scalar(value.ctasFound), imagesFound: scalar(value.imagesFound) };
}

function normalizeTrust(value) {
  const v = value && typeof value === 'object' ? value : {};
  return { hasReviews: Boolean(v.hasReviews), hasGuarantee: Boolean(v.hasGuarantee), hasDelivery: Boolean(v.hasDelivery), hasWhatsapp: Boolean(v.hasWhatsapp), hasPaymentSecurity: Boolean(v.hasPaymentSecurity) };
}

function list(value, limit) { return Array.isArray(value) ? value.slice(0, limit) : []; }
function scalar(value) { return value === undefined || value === null || value === '' ? null : (typeof value === 'number' || typeof value === 'boolean' ? value : safe(value, 120)); }
function safe(value, max) { return String(value || '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 250); }
