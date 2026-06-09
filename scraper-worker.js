'use strict';

// ═══════════════════════════════════════════════════════════════════
// SCRAPER WORKER — Railway Multi-Agent Engine
// Architecture: Render 1 (API) → Supabase Queue → Railway Worker
// Features: WS fix | Metrics | Health | Multi-job | Graceful shutdown
// ═══════════════════════════════════════════════════════════════════

require('dotenv').config();
process.env.WORKER_MODE = 'true';

const { createClient } = require('@supabase/supabase-js');
const http = require('http');

// ── ENV VALIDATION ───────────────────────────────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[Worker] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// ── IMPORTS ──────────────────────────────────────────────────────
const { processJob } = require('./job-processors');

// ── SUPABASE CLIENT — Node.js 20 WebSocket fix ───────────────────
const ws = require('ws');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
});

// ── CONFIGURATION ─────────────────────────────────────────────────
const WORKER_ID   = process.env.WORKER_ID   || `worker-${Date.now()}`;
const POLL_MS     = Math.max(500, Number(process.env.POLL_MS     || 2000));
const MAX_RETRIES = Math.max(1,   Number(process.env.MAX_RETRIES || 3));
const HEALTH_PORT = Number(process.env.HEALTH_PORT || 8080);

// ── METRICS ───────────────────────────────────────────────────────
const METRICS = {
    startTime:    Date.now(),
    jobsTotal:    0,
    jobsDone:     0,
    jobsFailed:   0,
    jobsRetried:  0,
    pollErrors:   0,
    lastJobAt:    null,
    lastJobType:  null,
    lastJobId:    null,
    currentJobId: null,
};

// ── STATE ─────────────────────────────────────────────────────────
let interval   = null;
let stopping   = false;
let processing = false;

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK SERVER (Railway keepalive + monitoring)
// ═══════════════════════════════════════════════════════════════════
const healthServer = http.createServer((req, res) => {
    const uptime = Date.now() - METRICS.startTime;
    const status = stopping ? 'stopping' : (processing ? 'busy' : 'idle');

    const payload = JSON.stringify({
        status,
        workerId:    WORKER_ID,
        uptime:      Math.round(uptime / 1000) + 's',
        pollEvery:   POLL_MS + 'ms',
        metrics: {
            total:   METRICS.jobsTotal,
            done:    METRICS.jobsDone,
            failed:  METRICS.jobsFailed,
            retried: METRICS.jobsRetried,
            errors:  METRICS.pollErrors,
        },
        lastJob: {
            id:   METRICS.lastJobId,
            type: METRICS.lastJobType,
            at:   METRICS.lastJobAt,
        },
        currentJob: METRICS.currentJobId || null,
        timestamp: new Date().toISOString(),
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(payload);
});

healthServer.listen(HEALTH_PORT, () => {
    console.log(`[Worker:${WORKER_ID}] 🏥 Health server on port ${HEALTH_PORT}`);
});

// ═══════════════════════════════════════════════════════════════════
// JOB UPDATE HELPER
// ═══════════════════════════════════════════════════════════════════
async function updateJob(jobId, patch) {
    const { error } = await supabase
        .from('scrape_jobs')
        .update(patch)
        .eq('id', jobId);

    if (error) throw new Error(`Job update failed: ${error.message}`);
}

// ═══════════════════════════════════════════════════════════════════
// CORE POLL LOOP
// ═══════════════════════════════════════════════════════════════════
async function claimAndProcess() {
    if (stopping || processing) return;
    processing = true;

    try {
        // ── Claim next available job atomically ──────────────────
        const { data, error } = await supabase.rpc('claim_next_job', {
            p_worker_id: WORKER_ID
        });

        if (error) {
            METRICS.pollErrors++;
            throw new Error(`Claim failed: ${error.message}`);
        }

        const job = Array.isArray(data) ? data[0] : data;
        if (!job?.id) return; // Nothing to do

        // ── Job claimed ──────────────────────────────────────────
        METRICS.jobsTotal++;
        METRICS.currentJobId = job.id;
        METRICS.lastJobId    = job.id;
        METRICS.lastJobType  = job.type;
        METRICS.lastJobAt    = new Date().toISOString();

        console.log(`[Worker:${WORKER_ID}] 🔄 Processing ${job.type} | job=${job.id}`);
        const startMs = Date.now();

        try {
            const result = await processJob(job.type, job.payload || {});
            const elapsed = Date.now() - startMs;

            await updateJob(job.id, {
                status:      'done',
                result,
                error:       null,
                finished_at: new Date().toISOString()
            });

            METRICS.jobsDone++;
            console.log(`[Worker:${WORKER_ID}] ✅ Done job=${job.id} type=${job.type} (${elapsed}ms)`);

        } catch (jobError) {
            const retryCount  = Number(job.retry_count || 0) + 1;
            const shouldRetry = retryCount < MAX_RETRIES;
            const elapsed     = Date.now() - startMs;

            await updateJob(job.id, {
                status:      shouldRetry ? 'pending' : 'error',
                retry_count: retryCount,
                error:       String(jobError?.message || jobError).slice(0, 2000),
                finished_at: shouldRetry ? null : new Date().toISOString()
            });

            if (shouldRetry) {
                METRICS.jobsRetried++;
                console.warn(`[Worker:${WORKER_ID}] ⚠️  Retry ${retryCount}/${MAX_RETRIES} job=${job.id} (${elapsed}ms): ${jobError?.message}`);
            } else {
                METRICS.jobsFailed++;
                console.error(`[Worker:${WORKER_ID}] ❌ Failed job=${job.id} after ${MAX_RETRIES} retries (${elapsed}ms): ${jobError?.message}`);
            }
        }

    } catch (err) {
        METRICS.pollErrors++;
        console.error(`[Worker:${WORKER_ID}] 🔥 Poll error:`, err.message);
    } finally {
        METRICS.currentJobId = null;
        processing = false;
    }
}

// ═══════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════
async function shutdown(signal) {
    if (stopping) return;
    stopping = true;

    if (interval) clearInterval(interval);
    console.log(`[Worker:${WORKER_ID}] 🛑 ${signal} received — waiting for current job to finish...`);

    // Wait for current job to complete (max 30s)
    const timeout = Date.now() + 30000;
    while (processing && Date.now() < timeout) {
        await new Promise(r => setTimeout(r, 250));
    }

    if (processing) {
        console.warn(`[Worker:${WORKER_ID}] ⚠️  Forced shutdown after 30s timeout`);
    }

    // Print final stats
    console.log(`[Worker:${WORKER_ID}] 📊 Final stats:`, {
        total:   METRICS.jobsTotal,
        done:    METRICS.jobsDone,
        failed:  METRICS.jobsFailed,
        retried: METRICS.jobsRetried,
        uptime:  Math.round((Date.now() - METRICS.startTime) / 1000) + 's',
    });

    healthServer.close();
    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// UNCAUGHT ERROR HANDLERS
// ═══════════════════════════════════════════════════════════════════
process.on('uncaughtException', (err) => {
    console.error(`[Worker:${WORKER_ID}] 💥 UNCAUGHT EXCEPTION:`, err.message);
    console.error(err.stack);
    // Don't exit — let Railway restart if truly fatal
});

process.on('unhandledRejection', (reason) => {
    console.error(`[Worker:${WORKER_ID}] 💥 UNHANDLED REJECTION:`, reason);
});

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════
console.log(`[Worker:${WORKER_ID}] 🚀 Starting — polling every ${POLL_MS}ms | maxRetries=${MAX_RETRIES}`);
console.log(`[Worker:${WORKER_ID}] 🔗 Supabase: ${SUPABASE_URL}`);

interval = setInterval(claimAndProcess, POLL_MS);
claimAndProcess(); // Immediate first poll

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
