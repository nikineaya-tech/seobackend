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
const POLL_MS = Math.max(500, Number(
  process.env.POLL_MS || process.env.WORKER_POLL_INTERVAL || 2000
));
const MAX_RETRIES = Math.max(1, Number(process.env.MAX_RETRIES || 3));
const PORT = Number(process.env.PORT || process.env.HEALTH_PORT || 8080);

const ALLOWED_JOB_TYPES = new Set([
  'scrape',
  'scrape-url',
  'scrape_url',
  'deep-scrape',
  'deep_scrape',
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
    polling: { intervalMs: POLL_MS, source: process.env.POLL_MS ? 'POLL_MS' : process.env.WORKER_POLL_INTERVAL ? 'WORKER_POLL_INTERVAL' : 'default' },
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

function compactFunnelEvidence(source = {}, maxBlocks = 120) {
  const candidate = source.evidencePayload
    || source.mainPage?.evidencePayload
    || source.scrapeData?.evidencePayload
    || {};
  const seenRawBlocks = new Set();
  const rawBlocks = arr(candidate.evidenceBlocks)
    .concat(arr(source.evidenceBlocks))
    .filter(block => {
      const key = [block?.source, block?.pageUrl, block?.selector, block?.position, block?.text || block?.textPreview]
        .join('|').toLowerCase();
      if (seenRawBlocks.has(key)) return false;
      seenRawBlocks.add(key);
      return true;
    })
    .slice(0, maxBlocks);
  const blocks = rawBlocks.map((block, index) => ({
    id: `evidence-${index + 1}`,
    source: clean(block?.source || 'observed-text', 80),
    pageUrl: clean(block?.pageUrl || source.url || '', 500),
    selector: clean(block?.selector || '', 220) || null,
    position: Number(block?.position || index + 1) || index + 1,
    text: clean(
      block?.text || block?.textPreview || '',
      /body-text/i.test(String(block?.source || '')) ? 6000 : 1400
    ),
    confidence: clean(block?.confidence || 'HIGH', 20),
    typeGuess: clean(block?.typeGuess || '', 80) || null,
    labelGuess: clean(block?.labelGuess || '', 140) || null,
    classificationSource: clean(block?.classificationSource || '', 80) || null,
    url: clean(block?.url || '', 500) || null,
    alt: clean(block?.alt || '', 180) || null
  })).filter(block => block.text || block.url);

  const rawMiniScrapers = arr(candidate.miniScrapers).concat(arr(source.miniScrapers));
  const seenScrapers = new Set();
  const miniScrapers = rawMiniScrapers.filter(scraper => {
    const name = clean(scraper?.scraperName || 'evidenceScraper', 100);
    if (seenScrapers.has(name)) return false;
    seenScrapers.add(name);
    return true;
  }).slice(0, 12).map(scraper => {
    const evidenceBlocks = arr(scraper?.evidenceBlocks)
      .map(block => {
        const sourceName = clean(block?.source || 'observed-text', 80);
        const rawText = clean(block?.text || block?.textPreview || '',
          /body-text/i.test(sourceName) ? 6000 : 1400);
        return blocks.find(item => item.source === sourceName && (
          item.text === rawText || item.text.startsWith(rawText) || rawText.startsWith(item.text)
        ));
      })
      .filter(Boolean)
      .slice(0, 45);
    return {
      scraperName: clean(scraper?.scraperName || 'evidenceScraper', 100),
      success: scraper?.success !== false && evidenceBlocks.length > 0,
      pageUrl: clean(scraper?.pageUrl || source.url || '', 500),
      evidenceText: clean(scraper?.evidenceText || evidenceBlocks.map(item => item.text).join(' | '), 1600),
      evidenceBlockRefs: evidenceBlocks.map(item => item.id),
      evidenceCount: evidenceBlocks.length,
      limits: arr(scraper?.limits).slice(0, 8).map(item => clean(item, 240)).filter(Boolean)
    };
  });

  return {
    version: clean(candidate.version || 'funnel-evidence-v1', 60),
    pageUrl: clean(candidate.pageUrl || source.url || '', 500),
    evidenceText: clean(candidate.evidenceText || blocks.map(item => item.text).join(' | '), 24000),
    evidenceBlocks: blocks,
    miniScrapers,
    limits: collectUnique([
      ...arr(candidate.limits),
      'HTML brut exclu du résultat Railway'
    ], 12, 240)
  };
}

function buildSmallJobResult(source = {}, strategy = 'hotfix-ultra-safe-result') {
  const sections = [
    source.sectionRawBlocks,
    source.sectionsDetailed,
    source.mainPage?.sectionRawBlocks,
    source.scrapeData?.sectionRawBlocks
  ].find(value => Array.isArray(value) && value.length) || [];

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

  const smallSections = sections.slice(0, 16).map((section, index) => ({
    source: clean(section.source || 'dom-block', 80),
    pageUrl: clean(section.pageUrl || source.url || '', 500),
    selector: clean(section.selector || '', 220) || null,
    position: Number(section.position || index + 1) || index + 1,
    typeGuess: clean(section.typeGuess || section.type || section.detectedType || '', 80) || null,
    labelGuess: clean(section.labelGuess || section.label || '', 180) || null,
    classificationSource: clean(section.classificationSource || 'weak-regex-hint', 80),
    title: clean(section.title || '', 180),
    text: clean(section.text || section.textPreview || '', 900),
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
    source.bodyText || source.text || source.content || source.mainPage?.bodyText || '',
    9000
  );

  const sourceHeadingGroups = source.mainPage?.headings && !Array.isArray(source.mainPage.headings)
    ? source.mainPage.headings
    : (source.headingGroups && !Array.isArray(source.headingGroups) ? source.headingGroups : {});
  const headingGroups = {
    h1: safeTextArray(sourceHeadingGroups.h1 || [source.h1], 8, 180),
    h2: safeTextArray(sourceHeadingGroups.h2 || source.h2, 12, 180),
    h3: safeTextArray(sourceHeadingGroups.h3 || source.h3, 12, 180)
  };
  const headings = safeTextArray([
    ...headingGroups.h1,
    ...headingGroups.h2,
    ...headingGroups.h3,
    ...safeTextArray(source.headings, 15, 160)
  ], 30, 180);
  const ctas = safeLinkArray(source.ctas, 6);
  const images = safeLinkArray(source.images, 6);
  const links = safeLinkArray(source.links, 8);
  const prices = safePriceArray(source.prices, 5);
  const evidencePayload = compactFunnelEvidence(source, 120);
const compatPage = {
  url: clean(source.url || '', 500),
  finalUrl: clean(source.finalUrl || source.url || '', 500),
  title: clean(source.title || '', 220),
  h1: clean(source.h1 || '', 220),
  metaDescription: clean(source.metaDescription || '', 400),
  bodyTextPreview: clean(bodyText, 1200),
  headings: headingGroups,
  counts: {
    sections: smallSections.length,
    evidence: evidencePayload.evidenceBlocks.length,
    ctas: ctas.length,
    images: images.length,
    links: links.length,
    prices: prices.length
  }
};
  return {
    mainPage: compatPage,
scrapeData: compatPage,
data: compatPage,
pagesExplored: arr(source.pagesExplored).slice(0, 5).map(page => ({
  url: clean(page?.url || '', 500),
  title: clean(page?.title || '', 180),
  bodyTextPreview: clean(page?.bodyTextPreview || page?.bodyText || '', 600),
  sectionRawBlocksFound: Number(page?.sectionRawBlocksFound || arr(page?.sectionRawBlocks).length || 0)
})).filter(page => page.url),
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
    headingGroups,
    h2: headingGroups.h2,
    h3: headingGroups.h3,
    ctas,
    images,
    links,
    prices,
    evidencePayload,
    structuredEvidence: cleanStructuredValue(source.structuredEvidence, 16),
    jobContext: cleanStructuredValue(source.jobContext, 12),

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
      maxBodyText: 9000,
      maxSections: 16
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

console.log(
  `[RailwayScraper:${WORKER_ID}] Processing job=${job.id} type=${job.type} ` +
  `purpose=${job.payload?.purpose || 'deep-scrape'} ` +
  `clientAnalysisId=${job.payload?.clientAnalysisId || 'N/A'} ` +
  `requestId=${job.payload?.requestId || 'N/A'}`
);
const startedAt = Date.now();

try {
  const rawResult = await processScrapingJob(job);
  const rawResultBytes = assertJsonSafe(rawResult);
  const safeResult = buildSafeJobResult({
    ...rawResult,
    jobContext: {
      clientAnalysisId: job.payload?.clientAnalysisId || null,
      requestId: job.payload?.requestId || null,
      purpose: job.payload?.purpose || 'deep-scrape',
      railwayJobId: job.id
    }
  });
  const safeResultBytes = assertJsonSafe(safeResult);

  console.log(
    `[RailwayScraper:${WORKER_ID}] Result ready job=${job.id} ` +
    `size=${safeResultBytes === -1 ? 'NON-SERIALIZABLE' : safeResultBytes} bytes ` +
    `sections=${countSections(safeResult)}`
  );

  const maxCanonicalBytes = Math.max(300000, Number(process.env.SCRAPER_MAX_RESULT_BYTES || 950000));
  const needsCompaction = safeResultBytes === -1 || safeResultBytes > maxCanonicalBytes;
  const smallResult = needsCompaction
    ? (safeResultBytes === -1
      ? buildEmergencyResult(rawResult, 'safe-result-not-serializable')
      : buildSmallJobResult(safeResult, 'worker-size-limited-canonical'))
    : null;
  const smallResultBytes = smallResult ? assertJsonSafe(smallResult) : 0;
  const selectedResult = smallResult || safeResult;
  selectedResult.pipelineDebug = {
    rawResultBytes,
    safeResultBytes,
    smallResultBytes,
    selectedResultBytes: smallResult ? smallResultBytes : safeResultBytes,
    compactedForStorage: Boolean(smallResult),
    maxCanonicalBytes
  };

  console.log(
    `[RailwayScraper:${WORKER_ID}] Storage result job=${job.id} ` +
    `mode=${smallResult ? 'compact' : 'canonical'} ` +
    `raw=${rawResultBytes} safe=${safeResultBytes} small=${smallResultBytes} bytes ` +
    `sections=${countSections(selectedResult)}`
  );

  if (assertJsonSafe(selectedResult) === -1) {
    throw new Error('Selected result is not JSON serializable');
  }

  await updateJob(job.id, {
    status: 'done',
    result: selectedResult,
    error: null,
    finished_at: new Date().toISOString()
  });

  METRICS.done++;

  console.log(
    `[RailwayScraper:${WORKER_ID}] Done job=${job.id} type=${job.type} ` +
    `in ${Date.now() - startedAt}ms | sections=${countSections(selectedResult)} ` +
    `strategy=${selectedResult.compactStrategy || 'canonical'}`
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
  const pages = Array.isArray(result.pagesExplored)
    ? result.pagesExplored
    : Array.isArray(result.pages)
    ? result.pages
    : Array.isArray(result.results)
      ? result.results
      : [];

  const main = result.mainPage || result.page || pages[0] || result || {};

  const allSectionBlocks = [];
  const seenSectionBlocks = new Set();
  collectSectionBlocks(result).forEach(block => {
    const key = [
      clean(block?.pageUrl || result.url || '', 500),
      clean(block?.selector || '', 180),
      Number(block?.position || block?.index || 0),
      clean(block?.text || block?.textPreview || block?.title || '', 260)
    ].join('|').toLowerCase();
    if (seenSectionBlocks.has(key)) return;
    seenSectionBlocks.add(key);
    allSectionBlocks.push(block);
  });
  const sections = allSectionBlocks
    .slice(0, 35)
    .map(normalizeSectionBlock)
    .filter(Boolean);

  const headingGroups = {
    h1: collectUnique([
      result.h1,
      main.h1,
      ...arr(result.headingGroups?.h1),
      ...arr(main.headingGroups?.h1),
      ...arr(result.headings?.h1),
      ...arr(main.headings?.h1)
    ], 8, 180),
    h2: collectUnique([
      ...arr(result.h2),
      ...arr(main.h2),
      ...arr(result.headingGroups?.h2),
      ...arr(main.headingGroups?.h2),
      ...arr(result.headings?.h2),
      ...arr(main.headings?.h2)
    ], 16, 180),
    h3: collectUnique([
      ...arr(result.h3),
      ...arr(main.h3),
      ...arr(result.headingGroups?.h3),
      ...arr(main.headingGroups?.h3),
      ...arr(result.headings?.h3),
      ...arr(main.headings?.h3)
    ], 16, 180)
  };
  const headings = collectUnique([
    ...headingGroups.h1,
    ...headingGroups.h2,
    ...headingGroups.h3,
    ...arr(result.headings),
    ...arr(main.headings),
    ...sections.flatMap(section => arr(section.headings)),
    ...sections.map(section => section.title)
  ], 40, 180);

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
  const evidencePayload = compactFunnelEvidence({
    ...result,
    evidencePayload: result.evidencePayload || main.evidencePayload,
    miniScrapers: result.miniScrapers || main.miniScrapers,
    url: result.url || main.url
  }, 120);
  const structuredEvidence = {
    forms: collectObjects([...arr(result.forms), ...arr(main.forms)], 12),
    faq: {
      detectedBlocks: collectObjects([
        ...arr(result.faq?.detectedBlocks),
        ...arr(main.faq?.detectedBlocks)
      ], 20),
      jsonLdFaqs: collectObjects([
        ...arr(result.faq?.jsonLdFaqs),
        ...arr(main.faq?.jsonLdFaqs)
      ], 20)
    },
    mentionHints: main.mentionHints || result.mentionHints || null,
    trustSignals: main.trustSignals || result.trustSignals || null,
    whatsappLinks: collectObjects([...arr(result.whatsappLinks), ...arr(main.whatsappLinks)], 12),
    contactLinks: collectObjects([...arr(result.contactLinks), ...arr(main.contactLinks)], 20),
    socialLinks: collectObjects([...arr(result.socialLinks), ...arr(main.socialLinks)], 20),
    legalLinks: collectObjects([...arr(result.legalLinks), ...arr(main.legalLinks)], 20),
    productCards: collectObjects([...arr(result.productCards), ...arr(main.productCards)], 16),
    clickExploration: cleanStructuredValue(main.clickExploration || result.clickExploration, 24),
    deliveryInfo: cleanStructuredValue(main.deliveryInfo || result.deliveryInfo, 16),
    guaranteeInfo: cleanStructuredValue(main.guaranteeInfo || result.guaranteeInfo, 16),
    reviewsInfo: cleanStructuredValue(main.reviewsInfo || result.reviewsInfo, 16),
    paymentInfo: cleanStructuredValue(main.paymentInfo || result.paymentInfo, 16),
    socialProofInfo: cleanStructuredValue(main.socialProofInfo || result.socialProofInfo, 16),
    legalInfo: cleanStructuredValue(main.legalInfo || result.legalInfo, 16)
  };
  const meaningfulTruncation = allSectionBlocks.length > sections.length || pages.length > 8;

  const safe = {
    success: result.success !== false,
    partial: result.partial === true || meaningfulTruncation,
    compacted: meaningfulTruncation,
    compactStrategy: meaningfulTruncation
      ? 'worker-canonical-with-bounded-arrays'
      : 'worker-canonical-evidence-result',

    provider: clean(result.provider || result.layer || 'railway-playwright', 80),
    layer: clean(result.layer || result.provider || 'railway-playwright', 80),
    source: clean(result.source || result.provider || 'railway-playwright', 80),
    attempts: cleanStructuredValue(result.attempts, 12),
    summary: cleanStructuredValue(result.summary, 30),
    crawlMap: cleanStructuredValue(result.crawlMap, 30),
    crawlErrors: cleanStructuredValue(result.crawlErrors, 12),
    blockedUsefulPages: cleanStructuredValue(result.blockedUsefulPages, 20) || [],

    url: clean(result.url || result.targetUrl || main.url || '', 500),
    finalUrl: clean(result.finalUrl || main.finalUrl || main.url || result.url || '', 500),
    title: clean(result.title || main.title || '', 240),
    h1: clean(result.h1 || main.h1 || headings[0] || '', 240),
    metaDescription: clean(result.metaDescription || main.metaDescription || '', 500),

    bodyText,
    text: bodyText,
    content: bodyText,

    headings,
    headingGroups,
    h2: headingGroups.h2,
    h3: headingGroups.h3,

    ctas,
    images,
    links,
    prices,
    evidencePayload,
    structuredEvidence,
    jobContext: cleanStructuredValue(result.jobContext, 12),
    phones: collectUnique([...arr(result.phones), ...arr(main.phones)], 8, 60),
    emails: collectUnique([...arr(result.emails), ...arr(main.emails)], 8, 120),
    canonical: clean(result.canonical || main.canonical || '', 500),
    language: clean(result.language || main.language || '', 30),
    openGraph: cleanStructuredValue(result.openGraph || main.openGraph, 16),
    jsonLd: cleanStructuredValue(result.jsonLd || main.jsonLd, 20),
    weakTechnicalHints: cleanStructuredValue(result.weakTechnicalHints || main.weakTechnicalHints, 20),

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
        bodyTextPreview: clean(page?.bodyText || page?.text || '', 900),
        sectionRawBlocksFound: arr(page?.sectionRawBlocks || page?.sectionBlocks || page?.sectionsDetailed).length,
        ctaCount: arr(page?.ctas).length,
        imageCount: arr(page?.images).length,
        linkCount: arr(page?.links).length
      }))
      .filter(page => page.url),

    mainPage: {
      url: clean(main.url || result.url || '', 500),
      title: clean(main.title || result.title || '', 240),
      h1: clean(main.h1 || result.h1 || headings[0] || '', 240),
      metaDescription: clean(main.metaDescription || result.metaDescription || '', 500),
      headings: headingGroups,
      bodyTextPreview: clean(bodyText, 1200),
      counts: {
        sections: sections.length,
        evidence: evidencePayload.evidenceBlocks.length,
        ctas: ctas.length,
        images: images.length,
        links: links.length,
        prices: prices.length
      }
    },

    scrapeData: {
      url: clean(result.url || main.url || '', 500),
      title: clean(result.title || main.title || '', 240),
      h1: clean(result.h1 || main.h1 || headings[0] || '', 240),
      canonicalPayload: true,
      counts: {
        sections: sections.length,
        evidence: evidencePayload.evidenceBlocks.length
      }
    },

    counts: {
      pages: pages.length,
      originalSections: allSectionBlocks.length,
      savedSections: sections.length,
      evidenceBlocks: evidencePayload.evidenceBlocks.length,
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
      renderCompatibility: true,
      canonicalEvidencePayload: true,
      meaningfulTruncation
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

function cleanStructuredValue(value, maxEntries = 20, depth = 0) {
  if (value == null || depth > 4) return null;
  if (typeof value === 'string') return clean(value, 800);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, maxEntries)
      .map(item => cleanStructuredValue(item, maxEntries, depth + 1))
      .filter(item => item != null);
  }
  if (typeof value !== 'object') return null;

  const out = {};
  Object.entries(value).slice(0, maxEntries).forEach(([key, item]) => {
    if (/html|script|style|svg|screenshot|buffer/i.test(key)) return;
    const cleaned = cleanStructuredValue(item, maxEntries, depth + 1);
    if (cleaned != null) out[key] = cleaned;
  });
  return out;
}

function normalizeSmallObject(value = {}) {
  return {
    text: clean(value.text || value.label || value.title || value.alt || value.value || '', 180),
    label: clean(value.label || value.text || value.title || '', 180),
    title: clean(value.title || value.label || value.text || '', 180),
    alt: clean(value.alt || '', 180),
    url: clean(value.url || value.href || value.src || '', 500),
    src: clean(value.src || value.url || '', 500),
    href: clean(value.href || value.url || '', 500),
    value: scalar(value.value || value.price || ''),
    currency: clean(value.currency || '', 20),
    context: clean(value.context || '', 200),
    intent: clean(value.intent || '', 60) || null,
    strengthScore: Number.isFinite(Number(value.strengthScore)) ? Number(value.strengthScore) : null,
    contextHeading: clean(value.contextHeading || '', 180) || null,
    position: Number(value.position || 0) || null,
    isPrimarySignal: value.isPrimarySignal === true,
    source: clean(value.source || '', 80) || null,
    kind: clean(value.kind || '', 60) || null
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
    source: clean(block.source || 'dom-block', 80),
    pageUrl: clean(block.pageUrl || '', 500),
    position: Number(block.position || block.index || 0) || null,
    tag: clean(block.tag || '', 30),
    selector: clean(block.selector || '', 160),
    id: clean(block.id || '', 100),
    className: clean(block.className || '', 160),
    visible: block.visible !== false,
    typeGuess: clean(block.typeGuess || block.type || block.detectedType || '', 80) || null,
    labelGuess: clean(block.labelGuess || block.label || '', 140) || null,
    classificationSource: clean(
      block.classificationSource || ((block.typeGuess || block.type || block.detectedType) ? 'weak-regex-hint' : ''),
      80
    ) || null,
    title: clean(block.title || '', 220),
    text: clean(block.text || block.textPreview || '', 900),
    headings: arr(block.headings).slice(0, 6).map(v => clean(v, 180)).filter(Boolean),
    paragraphs: arr(block.paragraphs).slice(0, 8).map(v => clean(v, 220)).filter(Boolean),
    textPreview: clean(block.textPreview || block.text || '', 420),
    wordCount: Number(block.wordCount || 0) || 0,
    ctas: arr(block.ctas).slice(0, 6).map(item => ({
      text: clean(item?.text ?? item, 140),
      href: clean(item?.href || item?.url || '', 400),
      intent: clean(item?.intent || '', 60) || null,
      strengthScore: Number.isFinite(Number(item?.strengthScore)) ? Number(item.strengthScore) : null,
      contextHeading: clean(item?.contextHeading || '', 180) || null,
      position: Number(item?.position || 0) || null,
      isPrimarySignal: item?.isPrimarySignal === true
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
    mentionHints: block.mentionHints && typeof block.mentionHints === 'object'
      ? { ...block.mentionHints, classificationSource: 'weak-regex-hint' }
      : null,
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
