'use strict';

/**
 * Railway JSON sanitize preload
 *
 * Fixes Supabase/PostgREST failures like:
 * "Job update failed: Empty or invalid json"
 *
 * Cause: scraper result may contain huge/raw/non-JSON-safe structures after
 * section extraction. This preload sanitizes scrape_jobs.result before update.
 */

const Module = require('module');
const originalLoad = Module._load;

const MAX_RESULT_BYTES = Number(process.env.MAX_SCRAPE_RESULT_JSON_BYTES || 2500000);
const DROP_KEYS = /^(html|rawHtml|bodyHtml|innerHTML|outerHTML|scripts?|styles?|svg|rawSvg|screenshot|screenshotBase64|buffer|dom|document)$/i;
const SECTION_KEYS = /^(sectionRawBlocks|sectionBlocks|sectionsDetailed|domSections|rawSections)$/i;

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request !== '@supabase/supabase-js' || !loaded || loaded.__dakaJsonSanitizePatched) return loaded;

  const originalCreateClient = loaded.createClient;
  if (typeof originalCreateClient !== 'function') return loaded;

  loaded.createClient = function patchedCreateClient() {
    const client = originalCreateClient.apply(this, arguments);
    if (!client || client.__dakaJsonSanitizeClient) return client;

    const originalFrom = client.from.bind(client);
    client.from = function patchedFrom(table) {
      const builder = originalFrom(table);
      if (String(table) !== 'scrape_jobs' || !builder || builder.__dakaJsonSanitizeBuilder) return builder;

      const originalUpdate = builder.update.bind(builder);
      builder.update = function patchedUpdate(patch) {
        if (patch && Object.prototype.hasOwnProperty.call(patch, 'result')) {
          patch = { ...patch, result: sanitizeResult(patch.result) };
        }
        if (patch && patch.error !== undefined && patch.error !== null) {
          patch = { ...patch, error: cleanString(patch.error, 2000) };
        }
        return originalUpdate(patch);
      };

      builder.__dakaJsonSanitizeBuilder = true;
      return builder;
    };

    client.__dakaJsonSanitizeClient = true;
    return client;
  };

  loaded.__dakaJsonSanitizePatched = true;
  console.log('[RailwayJsonSanitize] Supabase scrape_jobs result sanitizer enabled');
  return loaded;
};

function sanitizeResult(result) {
  const safe = sanitize(result, 0, new WeakSet());
  const bytes = jsonBytes(safe);
  if (bytes <= MAX_RESULT_BYTES) return safe;
  console.warn(`[RailwayJsonSanitize] Result too large (${bytes} bytes). Compacting before Supabase update.`);
  return compactResult(safe, `Compacted from ${bytes} bytes`);
}

function sanitize(value, depth, seen) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return cleanString(value, depth <= 2 ? 16000 : 2400);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function' || typeof value === 'symbol') return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`;

  if (Array.isArray(value)) {
    if (depth > 8) return [];
    return value.slice(0, depth <= 1 ? 100 : depth === 2 ? 60 : 30)
      .map(item => sanitize(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);
    if (depth > 8) return {};

    const out = {};
    for (const [key, raw] of Object.entries(value).slice(0, depth <= 1 ? 150 : 80)) {
      if (DROP_KEYS.test(key)) continue;
      if (SECTION_KEYS.test(key) && Array.isArray(raw)) {
        out[key] = raw.slice(0, 40).map(normalizeSectionBlock).filter(Boolean);
      } else {
        out[cleanString(key, 100)] = sanitize(raw, depth + 1, seen);
      }
    }
    return out;
  }

  return null;
}

function normalizeSectionBlock(block) {
  if (!block || typeof block !== 'object') return null;
  return sanitize({
    position: block.position || block.index || null,
    tag: block.tag || null,
    selector: cleanString(block.selector || '', 160),
    id: block.id || null,
    className: cleanString(block.className || '', 180),
    visible: block.visible !== false,
    detectedType: block.detectedType || block.type || null,
    type: block.type || block.detectedType || null,
    label: block.label || null,
    title: cleanString(block.title || '', 220),
    headings: strings(block.headings, 6, 180),
    paragraphs: strings(block.paragraphs, 8, 240),
    textPreview: cleanString(block.textPreview || block.text || '', 520),
    wordCount: Number(block.wordCount || 0) || 0,
    ctas: items(block.ctas, ['text', 'href', 'tag'], 8),
    prices: items(block.prices || block.priceSignals, ['value', 'currency', 'context'], 6),
    images: items(block.images, ['url', 'alt'], 6),
    links: items(block.links, ['url', 'label'], 8),
    forms: items(block.forms, ['inputCount', 'fields'], 3),
    trustSignals: block.trustSignals || {},
    rawEvidence: strings(block.rawEvidence || block.evidence, 6, 220),
    extractionSource: block.extractionSource || 'railway-dom-section-scan',
    confidence: block.confidence || 'MEDIUM'
  }, 0, new WeakSet());
}

function compactResult(result, reason) {
  const sections = collectSections(result).slice(0, 40).map(normalizeSectionBlock).filter(Boolean);
  const pages = Array.isArray(result?.pages) ? result.pages : Array.isArray(result?.results) ? result.results : [];
  const main = result?.mainPage || result?.page || pages[0] || result || {};

  return sanitize({
    success: result?.success !== false,
    compacted: true,
    compactReason: reason,
    provider: result?.provider || result?.layer || 'railway-playwright',
    layer: result?.layer || result?.provider || 'railway-playwright',
    url: result?.url || main.url || result?.targetUrl || null,
    title: result?.title || main.title || null,
    h1: result?.h1 || main.h1 || null,
    metaDescription: result?.metaDescription || main.metaDescription || null,
    colors: result?.colors || main.colors || [],
    cms: result?.cms || main.cms || null,
    priceIntel: result?.priceIntel || result?.pricingIntel || null,
    sectionRawBlocks: sections,
    sectionBlocks: sections,
    sectionsDetailed: sections,
    pagesExplored: pages.slice(0, 8).map(p => ({ url: p?.url || p?.normalizedUrl || '', title: p?.title || '' })).filter(p => p.url),
    counts: { pages: pages.length, sectionRawBlocks: sections.length },
    limits: { htmlRemoved: true, scriptsRemoved: true, stylesRemoved: true, maxResultJsonBytes: MAX_RESULT_BYTES }
  }, 0, new WeakSet());
}

function collectSections(root) {
  const out = [];
  const seen = new WeakSet();
  const visit = (node, depth) => {
    if (!node || depth > 6 || out.length >= 60) return;
    if (Array.isArray(node)) return node.slice(0, 30).forEach(item => visit(item, depth + 1));
    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    ['sectionRawBlocks', 'sectionBlocks', 'sectionsDetailed', 'domSections', 'rawSections'].forEach(k => {
      if (Array.isArray(node[k])) out.push(...node[k]);
    });
    ['mainPage', 'page', 'pages', 'results', 'extraPages', 'data', 'result'].forEach(k => visit(node[k], depth + 1));
  };
  visit(root, 0);
  return out;
}

function items(value, keys, limit) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map(item => {
    if (!item || typeof item !== 'object') return { text: cleanString(item, 180) };
    const out = {};
    keys.forEach(k => { if (item[k] !== undefined && item[k] !== null && item[k] !== '') out[k] = item[k]; });
    return sanitize(out, 0, new WeakSet());
  });
}

function strings(value, limit, max) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map(v => cleanString(v, max)).filter(Boolean);
}

function cleanString(value, max) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 2500);
}

function jsonBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); }
  catch { return Number.POSITIVE_INFINITY; }
}
