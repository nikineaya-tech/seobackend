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

async function updateJob(jobId, patch) {
  const { error } = await supabase
    .from('scrape_jobs')
    .update(patch)
    .eq('id', jobId);

  if (error) throw new Error(`Job update failed: ${error.message}`);
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
      const result = await processScrapingJob(job);
      const mainPage = result?.mainPage || (Array.isArray(result?.pages) ? result.pages[0] : null) || {};
      const sectionCount = Array.isArray(mainPage.sectionRawBlocks)
        ? mainPage.sectionRawBlocks.length
        : Array.isArray(mainPage.sectionsDetailed) ? mainPage.sectionsDetailed.length : 0;
      const bodyLength = String(mainPage.bodyText || '').length;
      console.log(`[RAILWAY-SCRAPE] done sections=${sectionCount} body=${bodyLength}`);

      await updateJob(job.id, {
        status: 'done',
        result,
        error: null,
        finished_at: new Date().toISOString()
      });

      METRICS.done++;
      console.log(`[RailwayScraper:${WORKER_ID}] Done job=${job.id} type=${job.type} in ${Date.now() - startedAt}ms`);
    } catch (jobError) {
      const isNonScrapingJob = jobError?.code === 'NON_SCRAPING_JOB';
      const retryCount = isNonScrapingJob ? Number(job.retry_count || 0) : Number(job.retry_count || 0) + 1;
      const shouldRetry = !isNonScrapingJob && retryCount < MAX_RETRIES;
      const errorMessage = String(jobError?.message || jobError).slice(0, 2000);

      await updateJob(job.id, {
        status: shouldRetry ? 'pending' : 'error',
        retry_count: retryCount,
        result: isNonScrapingJob ? {
          success: false,
          code: 'NON_SCRAPING_JOB',
          message: errorMessage,
          allowedJobTypes: [...ALLOWED_JOB_TYPES],
          routeTo: 'Render API backend'
        } : null,
        error: errorMessage,
        finished_at: shouldRetry ? null : new Date().toISOString()
      });

      if (isNonScrapingJob) {
        METRICS.rejected++;
        console.warn(`[RailwayScraper:${WORKER_ID}] Rejected non-scraping job=${job.id} type=${job.type}. Must run on Render.`);
      } else if (shouldRetry) {
        METRICS.retried++;
        console.warn(`[RailwayScraper:${WORKER_ID}] Retry ${retryCount}/${MAX_RETRIES} job=${job.id}: ${jobError.message}`);
      } else {
        METRICS.failed++;
        console.error(`[RailwayScraper:${WORKER_ID}] Failed job=${job.id}: ${jobError.message}`);
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
