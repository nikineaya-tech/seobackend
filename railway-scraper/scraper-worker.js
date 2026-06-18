'use strict';

require('dotenv').config();
process.env.WORKER_MODE = 'scraping-only';

const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { scrapeUrl, scrapeMany } = require('./scraper-orchestrator');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const WORKER_ID = process.env.WORKER_ID || `railway-scraper-${Date.now()}`;
const POLL_MS = Math.max(500, Number(process.env.POLL_MS || 2000));
const MAX_RETRIES = Math.max(1, Number(process.env.MAX_RETRIES || 3));
const PORT = Number(process.env.PORT || process.env.HEALTH_PORT || 8080);

const ALLOWED_JOB_TYPES = new Set([
  'scrape',
  'scrape-url',
  'scrape_url',
  'deep-scrape',
  'deep_scrape',
  'scrape_funnel_deep', // Legacy compatibility for jobs created before the Railway router fix.
  'product-scrape',
  'product_scrape',
  'page-scrape',
  'page_scrape'
]);

class NonScrapingJobError extends Error {
  constructor(jobType) {
    super(`NON_SCRAPING_JOB: Railway scraper refuses job type "${jobType}". Business/AI jobs must run on Render, not Railway.`);
    this.name = 'NonScrapingJobError';
    this.code = 'NON_SCRAPING_JOB';
    this.jobType = jobType;
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[RailwayScraper] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws }
});

const METRICS = {
  startedAt: Date.now(),
  claimed: 0,
  done: 0,
  failed: 0,
  rejected: 0,
  retried: 0,
  pollErrors: 0,
  currentJobId: null,
  lastJobId: null,
  lastJobType: null,
  lastJobAt: null
};

let stopping = false;
let processing = false;
let interval = null;

const healthServer = http.createServer((req, res) => {
  const payload = {
    service: 'railway-scraper',
    mode: 'scraping-only',
    status: stopping ? 'stopping' : processing ? 'busy' : 'idle',
    workerId: WORKER_ID,
    uptimeSeconds: Math.round((Date.now() - METRICS.startedAt) / 1000),
    allowedJobTypes: [...ALLOWED_JOB_TYPES],
    forbiddenJobTypes: ['competitors', 'funnel', 'technical', 'technical-seo', 'keywords', 'seo-assets', 'generate-seo-assets'],
    metrics: METRICS,
    timestamp: new Date().toISOString()
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
});

healthServer.listen(PORT, () => {
  console.log(`[RailwayScraper:${WORKER_ID}] Health server listening on ${PORT}`);
});

function sanitizeJsonString(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '') // supprime les surrogates Unicode cassés
    .replace(/\s+/g, ' ')
    .trim();
}

async function updateJob(jobId, patch) {
  const safePatch = JSON.parse(JSON.stringify(patch, (_key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    if (typeof value === 'string') return sanitizeJsonString(value);
    if (value === undefined) return null;
    return value;
  }));

  const body = JSON.stringify(safePatch);

  try {
    JSON.parse(body);
  } catch (parseError) {
    console.error(
      `[RailwayScraper:${WORKER_ID}] Local JSON parse failed job=${jobId}: ${parseError.message}`
    );
    throw new Error(`Job update failed before request: invalid local JSON`);
  }

  if (!body || body === 'undefined') {
    throw new Error('Job update failed before request: empty JSON body');
  }

  const endpoint =
    `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/scrape_jobs?id=eq.${encodeURIComponent(jobId)}`;

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json; charset=utf-8',
      Prefer: 'return=minimal'
    },
    body: Buffer.from(body, 'utf8')
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');

    console.error(
      `[RailwayScraper:${WORKER_ID}] Supabase REST update failed job=${jobId} — ` +
      `status=${response.status} bodySize=${Buffer.byteLength(body, 'utf8')} ` +
      `first=${body.slice(0, 120)} ` +
      `last=${body.slice(-120)} ` +
      `response=${responseText.slice(0, 800)}`
    );

    throw new Error(`Job update failed: HTTP ${response.status} ${responseText.slice(0, 300)}`);
  }
}
function buildSmallJobResult(source = {}, strategy = 'hotfix-ultra-safe-result') {
  const sections = Array.isArray(source.sectionRawBlocks)
    ? source.sectionRawBlocks
    : [];

  const safeTextArray = (value, limit = 10, max = 180) => {
    return arr(value)
      .slice(0, limit)
      .map(item => clean(
        typeof item === 'string'
          ? item
          : item?.text || item?.label || item?.title || item?.alt || item?.value || '',
        max
      ))
      .filter(Boolean);
  };

  const safeLinkArray = (value, limit = 8) => {
    return arr(value)
      .slice(0, limit)
      .map(item => ({
        text: clean(item?.text || item?.label || item?.title || item?.alt || '', 120),
        url: clean(item?.url || item?.href || item?.src || '', 400)
      }))
      .filter(item => item.text || item.url);
  };

  const safePriceArray = (value, limit = 5) => {
    return arr(value)
      .slice(0, limit)
      .map(item => ({
        value: clean(item?.value ?? item?.price ?? item ?? '', 80),
        currency: clean(item?.currency || '', 20),
        context: clean(item?.context || item?.label || '', 160)
      }))
      .filter(item => item.value || item.currency || item.context);
  };

  const smallSections = sections.slice(0, 8).map((section, index) => ({
    position: Number(section.position || index + 1) || index + 1,
    type: clean(section.type || section.detectedType || '', 80),
    title: clean(section.title || section.label || '', 180),
    textPreview: clean(section.textPreview || section.text || '', 350),
    headings: safeTextArray(section.headings, 4, 140),
    paragraphs: safeTextArray(section.paragraphs, 4, 180),
    ctas: safeLinkArray(section.ctas, 3),
    images: safeLinkArray(section.images, 3),
    links: safeLinkArray(section.links, 3),
    prices: safePriceArray(section.prices || section.priceSignals, 3),
    confidence: clean(section.confidence || 'MEDIUM', 30)
  }));

  const bodyText = clean(
    source.bodyText || source.text || source.content || '',
    4000
  );

  const headings = safeTextArray(source.headings, 15, 160);
  const ctas = safeLinkArray(source.ctas, 6);
  const images = safeLinkArray(source.images, 6);
  const links = safeLinkArray(source.links, 8);
  const prices = safePriceArray(source.prices, 5);
const compatPage = {
  url: clean(source.url || '', 500),
  finalUrl: clean(source.finalUrl || source.url || '', 500),
  title: clean(source.title || '', 220),
  h1: clean(source.h1 || '', 220),
  metaDescription: clean(source.metaDescription || '', 400),

  bodyText,
  text: bodyText,
  content: bodyText,

  headings,
  ctas,
  images,
  links,
  prices,

  sectionRawBlocks: smallSections,
  sectionBlocks: smallSections,
  sectionsDetailed: smallSections,
  sections: smallSections
};
  return {
    mainPage: compatPage,
scrapeData: compatPage,
data: compatPage,
pagesExplored: [compatPage],
    success: source.success !== false,
    partial: true,
    compacted: true,
    compactStrategy: strategy,

    provider: clean(source.provider || 'railway-playwright', 80),
    layer: clean(source.layer || 'railway-playwright', 80),

    url: clean(source.url || '', 500),
    finalUrl: clean(source.finalUrl || source.url || '', 500),
    title: clean(source.title || '', 220),
    h1: clean(source.h1 || '', 220),
    metaDescription: clean(source.metaDescription || '', 400),

    bodyText,
    text: bodyText,
    content: bodyText,

    headings,
    ctas,
    images,
    links,
    prices,

    price: clean(source.price || '', 80),
    currency: clean(source.currency || '', 20),

    sectionRawBlocks: smallSections,
    sectionBlocks: smallSections,
    sectionsDetailed: smallSections,
    sections: smallSections,

    counts: {
      originalSections: sections.length,
      savedSections: smallSections.length,
      headings: headings.length,
      ctas: ctas.length,
      images: images.length,
      links: links.length,
      prices: prices.length
    },

    limits: {
      ultraSafeResult: true,
      htmlRemoved: true,
      rawObjectsRemoved: true,
      rawResultNotStored: true,
      maxBodyText: 4000,
      maxSections: 8
    }
  };
}

/**
 * Verify a value is JSON-serializable and return its byte size.
 * Returns -1 if serialization fails (circular refs, BigInt, etc.).
 */
function assertJsonSafe(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch (err) {
    return -1;
  }
}

/**
 * Build an ultra-minimal result stub for when even buildMinimalJobResult
 * produces something that can't be serialized.
 */
function buildEmergencyResult(rawResult, reason) {
  return {
    success: true,
    compacted: true,
    compactStrategy: 'worker-emergency-stub',
    emergencyReason: String(reason || 'json-serialize-failed').slice(0, 200),
    url: clean(
      (rawResult && (rawResult.url || rawResult.targetUrl)) ||
      (rawResult && rawResult.mainPage && rawResult.mainPage.url) || '',
      500
    ),
    title: clean((rawResult && rawResult.title) || '', 240),
    sectionRawBlocks: [],
    sectionBlocks: [],
    sectionsDetailed: [],
    counts: { pages: 0, sectionRawBlocks: 0 },
    limits: { htmlRemoved: true, emergencyFallback: true }
  };
}

function extractUrls(payload = {}) {
  if (Array.isArray(payload.urls)) return payload.urls.filter(Boolean);
  if (payload.url) return [payload.url];
  if (payload.targetUrl) return [payload.targetUrl];
  if (payload.website) return [payload.website];
  return [];
}

async function processScrapingJob(job) {
  if (!ALLOWED_JOB_TYPES.has(job.type)) {
    throw new NonScrapingJobError(job.type);
  }

  const payload = job.payload || {};
  const urls = extractUrls(payload);

  if (!urls.length) {
    throw new Error('No URL found in job payload. Expected payload.url, payload.targetUrl, payload.website or payload.urls');
  }

  const options = {
    explore: payload.explore !== false,
    maxPages: payload.maxPages,
    maxExtraPages: payload.maxExtraPages,
    maxDepth: payload.maxDepth,
    maxClicks: payload.maxClicks,
    maxButtonsPerPage: payload.maxButtonsPerPage,
    crawlBudgetMs: payload.crawlBudgetMs,
    sameOriginOnly: payload.sameOriginOnly !== false
  };

  return urls.length === 1
    ? scrapeUrl(urls[0], options)
    : scrapeMany(urls, options);
}

async function claimAndProcess() {
if (stopping || processing) return;
processing = true;

try {
const { data, error } = await supabase.rpc('claim_next_job', {
p_worker_id: WORKER_ID
});


if (error) {
  METRICS.pollErrors++;
  throw new Error(`Claim failed: ${error.message}`);
}

const job = Array.isArray(data) ? data[0] : data;
if (!job?.id) return;

METRICS.claimed++;
METRICS.currentJobId = job.id;
METRICS.lastJobId = job.id;
METRICS.lastJobType = job.type;
METRICS.lastJobAt = new Date().toISOString();

console.log(`[RailwayScraper:${WORKER_ID}] Processing job=${job.id} type=${job.type}`);
const startedAt = Date.now();

try {
    const rawResult = await processScrapingJob(job);
    const safeResult = buildSafeJobResult(rawResult);
    const safeResultBytes = assertJsonSafe(safeResult);
    const safeMainPage = safeResult?.mainPage || safeResult?.page || safeResult;
    const safeSectionCount = countSections(safeResult);
    const safeBodyLength = String(safeMainPage?.bodyText || safeResult?.bodyText || '').length;
    console.log(`[RAILWAY-SCRAPE] done sections=${safeSectionCount} body=${safeBodyLength}`);

  console.log(
    `[RailwayScraper:${WORKER_ID}] Result ready job=${job.id} ` +
    `size=${safeResultBytes === -1 ? 'NON-SERIALIZABLE' : safeResultBytes} bytes ` +
    `sections=${countSections(safeResult)}`
  );

  const smallResult = safeResultBytes === -1
    ? buildEmergencyResult(rawResult, 'safe-result-not-serializable')
    : buildSmallJobResult(safeResult);

  const smallResultBytes = assertJsonSafe(smallResult);

  console.log(
    `[RailwayScraper:${WORKER_ID}] Small result ready job=${job.id} ` +
    `size=${smallResultBytes === -1 ? 'NON-SERIALIZABLE' : smallResultBytes} bytes ` +
    `sections=${countSections(smallResult)}`
  );

  if (smallResultBytes === -1) {
    throw new Error('Small result is not JSON serializable');
  }

  await updateJob(job.id, {
    status: 'done',
    result: smallResult,
    error: null,
    finished_at: new Date().toISOString()
  });

  METRICS.done++;

  console.log(
    `[RailwayScraper:${WORKER_ID}] Done job=${job.id} type=${job.type} ` +
    `in ${Date.now() - startedAt}ms | sections=${countSections(smallResult)} ` +
    `strategy=${smallResult.compactStrategy || 'small'}`
  );
} catch (jobError) {
  const isNonScrapingJob = jobError?.code === 'NON_SCRAPING_JOB';
  const retryCount = isNonScrapingJob
    ? Number(job.retry_count || 0)
    : Number(job.retry_count || 0) + 1;

  const shouldRetry = !isNonScrapingJob && retryCount < MAX_RETRIES;
  const errorMessage = String(jobError?.message || jobError).slice(0, 2000);

  const errorPatch = {
    status: shouldRetry ? 'pending' : 'error',
    retry_count: retryCount,
    error: errorMessage,
    finished_at: shouldRetry ? null : new Date().toISOString()
  };

  if (isNonScrapingJob) {
    errorPatch.result = {
      success: false,
      code: 'NON_SCRAPING_JOB',
      message: errorMessage,
      allowedJobTypes: [...ALLOWED_JOB_TYPES],
      routeTo: 'Render API backend'
    };
  }

  try {
    await updateJob(job.id, errorPatch);
  } catch (errorUpdateFailure) {
    METRICS.pollErrors++;
    console.error(
      `[RailwayScraper:${WORKER_ID}] CRITICAL error-state update failed job=${job.id}: ` +
      `${errorUpdateFailure.message}`
    );
  }

  if (isNonScrapingJob) {
    METRICS.rejected++;
    console.warn(
      `[RailwayScraper:${WORKER_ID}] Rejected non-scraping job=${job.id} ` +
      `type=${job.type}. Must run on Render.`
    );
  } else if (shouldRetry) {
    METRICS.retried++;
    console.warn(
      `[RailwayScraper:${WORKER_ID}] Retry ${retryCount}/${MAX_RETRIES} ` +
      `job=${job.id}: ${jobError.message}`
    );
  } else {
    METRICS.failed++;
    console.error(
      `[RailwayScraper:${WORKER_ID}] Failed job=${job.id}: ${jobError.message}`
    );
  }
}


} catch (err) {
METRICS.pollErrors++;
console.error(`[RailwayScraper:${WORKER_ID}] Poll error: ${err.message}`);
} finally {
METRICS.currentJobId = null;
processing = false;
}
}


function buildSafeJobResult(result = {}) {
  const pages = Array.isArray(result.pages)
    ? result.pages
    : Array.isArray(result.results)
      ? result.results
      : [];

  const main = result.mainPage || result.page || pages[0] || result || {};

  const sections = collectSectionBlocks(result)
    .slice(0, 35)
    .map(normalizeSectionBlock)
    .filter(Boolean);

  const headings = collectUnique([
    result.h1,
    main.h1,
    ...arr(result.headings),
    ...arr(main.headings),
    ...sections.flatMap(section => arr(section.headings)),
    ...sections.map(section => section.title)
  ], 30, 180);

  const ctas = collectObjects([
    ...arr(result.ctas),
    ...arr(main.ctas),
    ...sections.flatMap(section => arr(section.ctas))
  ], 30);

  const images = collectObjects([
    ...arr(result.images),
    ...arr(main.images),
    ...sections.flatMap(section => arr(section.images))
  ], 30);

  const links = collectObjects([
    ...arr(result.links),
    ...arr(main.links),
    ...sections.flatMap(section => arr(section.links))
  ], 40);

  const prices = collectObjects([
    ...arr(result.prices),
    ...arr(result.priceSignals),
    ...arr(main.prices),
    ...arr(main.priceSignals),
    ...sections.flatMap(section => arr(section.prices || section.priceSignals))
  ], 20);

  const bodyText = buildBodyText(result, main, sections);

  const safe = {
    success: result.success !== false,
    compacted: true,
    compactStrategy: 'worker-direct-safe-result-render-compatible',

    provider: clean(result.provider || result.layer || 'railway-playwright', 80),
    layer: clean(result.layer || result.provider || 'railway-playwright', 80),
    source: clean(result.source || result.provider || 'railway-playwright', 80),

    url: clean(result.url || result.targetUrl || main.url || '', 500),
    finalUrl: clean(result.finalUrl || main.finalUrl || main.url || result.url || '', 500),
    title: clean(result.title || main.title || '', 240),
    h1: clean(result.h1 || main.h1 || headings[0] || '', 240),
    metaDescription: clean(result.metaDescription || main.metaDescription || '', 500),

    bodyText,
    text: bodyText,
    content: bodyText,

    headings,
    h2: headings.slice(1, 12),
    h3: headings.slice(12, 24),

    ctas,
    images,
    links,
    prices,

    cms: clean(result.cms || main.cms || '', 80),
    colors: arr(result.colors || main.colors).slice(0, 8).map(color => clean(color, 40)),

    price: scalar(result.price || result.primaryPrice || main.price || prices[0]?.value),
    currency: clean(result.currency || main.currency || prices[0]?.currency || '', 20),
    priceIntel: normalizePriceIntel(result.priceIntel || result.pricingIntel || main.priceIntel),

    sectionRawBlocks: sections,
    sectionBlocks: sections,
    sectionsDetailed: sections,
    sections: sections,

    pagesExplored: pages
      .slice(0, 8)
      .map(page => ({
        url: clean(page?.url || page?.normalizedUrl || '', 500),
        title: clean(page?.title || '', 180),
        sectionRawBlocksFound: arr(page?.sectionRawBlocks || page?.sectionBlocks || page?.sectionsDetailed).length
      }))
      .filter(page => page.url),

    mainPage: {
      url: clean(main.url || result.url || '', 500),
      title: clean(main.title || result.title || '', 240),
      h1: clean(main.h1 || result.h1 || headings[0] || '', 240),
      metaDescription: clean(main.metaDescription || result.metaDescription || '', 500),
      bodyText,
      text: bodyText,
      headings,
      ctas,
      images,
      links,
      prices,
      sectionRawBlocks: sections,
      sectionBlocks: sections,
      sectionsDetailed: sections
    },

    scrapeData: {
      url: clean(result.url || main.url || '', 500),
      title: clean(result.title || main.title || '', 240),
      h1: clean(result.h1 || main.h1 || headings[0] || '', 240),
      bodyText,
      headings,
      ctas,
      images,
      links,
      prices,
      sectionRawBlocks: sections,
      sectionsDetailed: sections
    },

    counts: {
      pages: pages.length,
      sectionRawBlocks: sections.length,
      headings: headings.length,
      images: images.length,
      ctas: ctas.length,
      links: links.length,
      prices: prices.length
    },

    limits: {
      htmlRemoved: true,
      scriptsRemoved: true,
      stylesRemoved: true,
      rawResultNotStored: true,
      renderCompatibility: true
    }
  };

  return safe;
}

function buildMinimalJobResult(result = {}, error) {
  const safe = buildSafeJobResult(result);

  return {
    success: true,
    partial: true,
    fallback: true,
    compacted: true,
    compactStrategy: 'worker-direct-minimal-render-compatible',
    fallbackReason: clean(error?.message || error || 'done update failed', 500),

    provider: safe.provider,
    layer: safe.layer,
    source: safe.source,

    url: safe.url,
    finalUrl: safe.finalUrl,
    title: safe.title,
    h1: safe.h1,
    metaDescription: safe.metaDescription,

    bodyText: safe.bodyText,
    text: safe.bodyText,
    content: safe.bodyText,

    headings: safe.headings,
    h2: safe.h2,
    h3: safe.h3,

    ctas: safe.ctas.slice(0, 20),
    images: safe.images.slice(0, 20),
    links: safe.links.slice(0, 25),
    prices: safe.prices.slice(0, 15),

    price: safe.price,
    currency: safe.currency,
    priceIntel: safe.priceIntel,

    sectionRawBlocks: safe.sectionRawBlocks.slice(0, 20),
    sectionBlocks: safe.sectionBlocks.slice(0, 20),
    sectionsDetailed: safe.sectionsDetailed.slice(0, 20),
    sections: safe.sections.slice(0, 20),

    pagesExplored: safe.pagesExplored.slice(0, 5),

    mainPage: {
      url: safe.url,
      title: safe.title,
      h1: safe.h1,
      metaDescription: safe.metaDescription,
      bodyText: safe.bodyText,
      text: safe.bodyText,
      headings: safe.headings,
      ctas: safe.ctas.slice(0, 15),
      images: safe.images.slice(0, 15),
      links: safe.links.slice(0, 15),
      prices: safe.prices.slice(0, 10),
      sectionRawBlocks: safe.sectionRawBlocks.slice(0, 20),
      sectionsDetailed: safe.sectionsDetailed.slice(0, 20)
    },

    scrapeData: {
      url: safe.url,
      title: safe.title,
      h1: safe.h1,
      bodyText: safe.bodyText,
      headings: safe.headings,
      ctas: safe.ctas.slice(0, 15),
      images: safe.images.slice(0, 15),
      links: safe.links.slice(0, 15),
      prices: safe.prices.slice(0, 10),
      sectionRawBlocks: safe.sectionRawBlocks.slice(0, 20),
      sectionsDetailed: safe.sectionsDetailed.slice(0, 20)
    },

    counts: safe.counts,

    limits: {
      htmlRemoved: true,
      fallbackMinimal: true,
      rawResultNotStored: true,
      renderCompatibility: true
    }
  };
}
function buildBodyText(result, main, sections) {
  const chunks = [
    result.bodyText,
    result.text,
    result.content,
    main.bodyText,
    main.text,
    main.content,
    ...sections.flatMap(section => [
      section.title,
      ...arr(section.headings),
      ...arr(section.paragraphs),
      section.textPreview
    ])
  ];

  return collectUnique(chunks, 80, 500)
    .join('\n')
    .slice(0, 12000);
}

function collectUnique(values, limit = 30, max = 180) {
  const seen = new Set();
  const output = [];

  for (const value of values || []) {
    const cleaned = clean(value, max);
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(cleaned);

    if (output.length >= limit) break;
  }

  return output;
}

function collectObjects(values, limit = 30) {
  const seen = new Set();
  const output = [];

  for (const value of values || []) {
    if (!value) continue;

    const item = typeof value === 'object'
      ? normalizeSmallObject(value)
      : { text: clean(value, 180) };

    const key = JSON.stringify(item).slice(0, 300);
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(item);

    if (output.length >= limit) break;
  }

  return output;
}

function normalizeSmallObject(value = {}) {
  return {
    text: clean(value.text || value.label || value.title || value.alt || value.value || '', 180),
    label: clean(value.label || value.text || value.title || '', 180),
    url: clean(value.url || value.href || value.src || '', 500),
    href: clean(value.href || value.url || '', 500),
    value: scalar(value.value || value.price || ''),
    currency: clean(value.currency || '', 20),
    context: clean(value.context || '', 200)
  };
}
function collectSectionBlocks(root) {
  const out = [];
  const seen = new WeakSet();

  function visit(node, depth = 0) {
    if (!node || depth > 6 || out.length >= 80) return;

    if (Array.isArray(node)) {
      node.slice(0, 40).forEach(item => visit(item, depth + 1));
      return;
    }

    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);

    [
      'sectionRawBlocks',
      'sectionBlocks',
      'sectionsDetailed',
      'domSections',
      'rawSections'
    ].forEach(key => {
      if (Array.isArray(node[key])) out.push(...node[key]);
    });

    [
      'mainPage',
      'page',
      'pages',
      'results',
      'extraPages',
      'data',
      'result'
    ].forEach(key => {
      if (node[key]) visit(node[key], depth + 1);
    });
  }

  visit(root);
  return out;
}

function normalizeSectionBlock(block = {}) {
  const prices = arr(block.prices || block.priceSignals)
    .slice(0, 5)
    .map(item => ({
      value: scalar(item?.value ?? item),
      currency: clean(item?.currency || '', 20),
      context: clean(item?.context || '', 160)
    }));

  return {
    position: Number(block.position || block.index || 0) || null,
    tag: clean(block.tag || '', 30),
    selector: clean(block.selector || '', 160),
    id: clean(block.id || '', 100),
    className: clean(block.className || '', 160),
    visible: block.visible !== false,
    detectedType: clean(block.detectedType || block.type || '', 80),
    type: clean(block.type || block.detectedType || '', 80),
    label: clean(block.label || '', 140),
    title: clean(block.title || '', 220),
    headings: arr(block.headings).slice(0, 6).map(v => clean(v, 180)).filter(Boolean),
    paragraphs: arr(block.paragraphs).slice(0, 8).map(v => clean(v, 220)).filter(Boolean),
    textPreview: clean(block.textPreview || block.text || '', 420),
    wordCount: Number(block.wordCount || 0) || 0,
    ctas: arr(block.ctas).slice(0, 6).map(item => ({
      text: clean(item?.text ?? item, 140),
      href: clean(item?.href || '', 400)
    })),
    prices,
    priceSignals: prices,
    images: arr(block.images).slice(0, 5).map(item => ({
      url: clean(item?.url || '', 500),
      alt: clean(item?.alt || '', 120)
    })),
    links: arr(block.links).slice(0, 6).map(item => ({
      url: clean(item?.url || '', 500),
      label: clean(item?.label || '', 120)
    })),
    forms: arr(block.forms).slice(0, 2).map(item => ({
      inputCount: Number(item?.inputCount || 0) || 0
    })),
    trustSignals: normalizeTrustSignals(block.trustSignals),
    rawEvidence: arr(block.rawEvidence || block.evidence)
      .slice(0, 5)
      .map(v => clean(v, 180))
      .filter(Boolean),
    extractionSource: clean(block.extractionSource || 'railway-dom-section-scan', 80),
    confidence: clean(block.confidence || 'MEDIUM', 20)
  };
}

function normalizePriceIntel(value) {
  if (!value || typeof value !== 'object') return null;

  return {
    primaryPrice: scalar(value.primaryPrice || value.detectedPrice || value.price),
    currencyDetected: clean(value.currencyDetected || value.currency || '', 20),
    priceConfidence: clean(value.priceConfidence || value.confidence || value.confidenceBand || '', 40),
    priceExtractionReason: clean(value.priceExtractionReason || value.reason || '', 240)
  };
}

function normalizeTrustSignals(value) {
  const trust = value && typeof value === 'object' ? value : {};

  return {
    hasReviews: Boolean(trust.hasReviews),
    hasGuarantee: Boolean(trust.hasGuarantee),
    hasDelivery: Boolean(trust.hasDelivery),
    hasWhatsapp: Boolean(trust.hasWhatsapp),
    hasPaymentSecurity: Boolean(trust.hasPaymentSecurity)
  };
}

function countNestedArray(root, key) {
  let total = 0;
  const seen = new WeakSet();

  function visit(node, depth = 0) {
    if (!node || depth > 5) return;

    if (Array.isArray(node)) {
      node.slice(0, 30).forEach(item => visit(item, depth + 1));
      return;
    }

    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node[key])) total += node[key].length;

    ['mainPage', 'page', 'pages', 'results', 'extraPages'].forEach(childKey => {
      if (node[childKey]) visit(node[childKey], depth + 1);
    });
  }

  visit(root);
  return total;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function scalar(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  return clean(value, 120);
}

function clean(value, max = 250) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function jsonSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return -1;
  }
}

function countSections(value) {
  return Array.isArray(value?.sectionRawBlocks) ? value.sectionRawBlocks.length : 0;
}
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (interval) clearInterval(interval);

  console.log(`[RailwayScraper:${WORKER_ID}] ${signal} received. Waiting for current job...`);
  const deadline = Date.now() + 30000;
  while (processing && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  healthServer.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', reason => console.error('[RailwayScraper] Unhandled rejection:', reason));
process.on('uncaughtException', err => console.error('[RailwayScraper] Uncaught exception:', err));

console.log(`[RailwayScraper:${WORKER_ID}] Started in scraping-only mode. Poll=${POLL_MS}ms`);
interval = setInterval(claimAndProcess, POLL_MS);
claimAndProcess();
