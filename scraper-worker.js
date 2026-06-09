'use strict';

require('dotenv').config();
process.env.WORKER_MODE = 'true';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[Worker] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_KEY');
    process.exit(1);
}

const { processJob } = require('./job-processors');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const POLL_MS = Math.max(500, Number(process.env.POLL_MS || 2000));
const MAX_RETRIES = 3;

let interval = null;
let stopping = false;
let processing = false;

async function updateJob(jobId, patch) {
    const { error } = await supabase
        .from('scrape_jobs')
        .update(patch)
        .eq('id', jobId);

    if (error) throw new Error(`Job update failed: ${error.message}`);
}

async function claimAndProcess() {
    if (stopping || processing) return;
    processing = true;

    try {
        const { data, error } = await supabase.rpc('claim_next_job', {
            p_worker_id: WORKER_ID
        });

        if (error) throw new Error(`Claim failed: ${error.message}`);

        const job = Array.isArray(data) ? data[0] : data;
        if (!job?.id) return;

        console.log(`[Worker:${WORKER_ID}] Processing ${job.type} job ${job.id}`);

        try {
            const result = await processJob(job.type, job.payload || {});
            await updateJob(job.id, {
                status: 'done',
                result,
                error: null,
                finished_at: new Date().toISOString()
            });
            console.log(`[Worker:${WORKER_ID}] Completed job ${job.id}`);
        } catch (jobError) {
            const retryCount = Number(job.retry_count || 0) + 1;
            const shouldRetry = retryCount < MAX_RETRIES;

            await updateJob(job.id, {
                status: shouldRetry ? 'pending' : 'error',
                retry_count: retryCount,
                error: String(jobError?.message || jobError).slice(0, 2000),
                finished_at: shouldRetry ? null : new Date().toISOString()
            });

            console.error(
                `[Worker:${WORKER_ID}] Job ${job.id} ${shouldRetry ? 'queued for retry' : 'failed'}:`,
                jobError?.message || jobError
            );
        }
    } catch (error) {
        console.error(`[Worker:${WORKER_ID}] Poll error:`, error.message);
    } finally {
        processing = false;
    }
}

async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    if (interval) clearInterval(interval);
    console.log(`[Worker:${WORKER_ID}] ${signal} received, waiting for current job...`);

    while (processing) {
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    process.exit(0);
}

console.log(`[Worker:${WORKER_ID}] Ready, polling every ${POLL_MS}ms`);
interval = setInterval(claimAndProcess, POLL_MS);
claimAndProcess();

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
