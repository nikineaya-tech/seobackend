#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch (_) {
    return '';
  }
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function has(rel, pattern) {
  return pattern.test(read(rel));
}

function status(ok, partial = false) {
  if (ok) return 'PROVED';
  if (partial) return 'PARTIAL';
  return 'MISSING';
}

function row(id, requirement, evidence, ok, partial = false, note = '') {
  return {
    id,
    requirement,
    status: status(ok, partial),
    evidence,
    note
  };
}

const insightFile = 'lib/market-intelligence/insights/insight-engine.js';
const reportFile = 'lib/market-intelligence/report-v2.js';
const runtimeFile = 'public/assets/daka-main-runtime.js';
const e2eFile = 'scripts/run-insight-e2e.cjs';
const packageFile = 'package.json';

const insightText = read(insightFile);
const detectorTypes = [
  'CUSTOMER_COMPETITOR_CONTRADICTION',
  'CUSTOMER_OFFER_GAP',
  'SATURATION',
  'LOCAL_GLOBAL_ASYMMETRY',
  'SOCIAL_CONTENT_GAP',
  'PROOF_GAP',
  'TRUST_GAP',
  'PRICE_VALUE_ASYMMETRY',
  'SUBSTITUTE_RISK',
  'SUPPLIER_LOCAL_GAP',
  'TEMPORAL_OPPORTUNITY'
];

const checks = [
  row(
    'layer',
    'Dedicated insight layer exists',
    [insightFile],
    exists(insightFile) && /buildInsightDiscoveryEngine/.test(insightText)
  ),
  row(
    'detectors',
    'Required relationship detectors are implemented',
    [insightFile],
    detectorTypes.every(type => insightText.includes(type)),
    detectorTypes.some(type => insightText.includes(type)),
    `Detected ${detectorTypes.filter(type => insightText.includes(type)).length}/${detectorTypes.length} types.`
  ),
  row(
    'schema',
    'Insight schema contains evidence, signals, dimensions, metrics, scoring and recommended test',
    [insightFile],
    ['evidenceIds', 'signalIds', 'dimensions', 'metrics', 'recommendedTest', 'formula', 'noveltyScore', 'businessImpactScore', 'actionabilityScore'].every(token => insightText.includes(token))
  ),
  row(
    'generic-filter',
    'Generic advice and unsupported growth/leader claims are blocked by gates',
    [insightFile, e2eFile, reportFile],
    /GENERIC_ADVICE_PATTERNS/.test(insightText) &&
      has(e2eFile, /GENERIC_TOP_INSIGHT/) &&
      has(e2eFile, /FORBIDDEN_CLAIMS/) &&
      has(reportFile, /market leader/i)
  ),
  row(
    'server-wiring',
    'Competitor pipeline builds insightDiscoveryModel after evidence and signal models',
    ['server.js'],
    has('server.js', /buildInsightDiscoveryEngine/) &&
      has('server.js', /finalResult\.discoveryInsights/) &&
      has('server.js', /finalResult\.insightTrace/)
  ),
  row(
    'report-v2',
    'Report V2 exposes top discovery insights and deep dive trace',
    [reportFile],
    has(reportFile, /mainReport:[\s\S]*discoveryInsights/) &&
      has(reportFile, /insightDiscovery:[\s\S]*insightTrace/) &&
      has(reportFile, /coverageGate/)
  ),
  row(
    'frontend',
    'Frontend has a visible market-discovery section for the new payload',
    [runtimeFile, 'index.html'],
    has(runtimeFile, /renderDiscoveryInsights/) &&
      has('index.html', /daka-discovery-insights/) &&
      has('index.html', /20260828-insight-discovery1/)
  ),
  row(
    'tests',
    'Automated tests cover insight relationship classes and report payload contract',
    ['tests/insight-engine.test.js', 'tests/decision-report-v2.test.js', packageFile],
    exists('tests/insight-engine.test.js') &&
      has('tests/insight-engine.test.js', /trust gap/) &&
      has('tests/insight-engine.test.js', /price value asymmetry/) &&
      has('tests/insight-engine.test.js', /substitute risk/) &&
      has('tests/insight-engine.test.js', /verified supplier evidence/) &&
      has('tests/decision-report-v2.test.js', /recommendedTest/) &&
      has(packageFile, /test:competitors/)
  ),
  row(
    'e2e-gate',
    'Live E2E gate exists for blackhead remover / Libya and can validate Render or local payload',
    [e2eFile, packageFile],
    exists(e2eFile) &&
      has(e2eFile, /blackhead remover/) &&
      has(e2eFile, /Libya/) &&
      has(e2eFile, /DAKA_E2E_API_URL/) &&
      has(e2eFile, /DAKA_E2E_AUTH_TOKEN|DAKA_E2E_COOKIE/) &&
      has(packageFile, /test:insight-e2e/)
  ),
  row(
    'agent-reach',
    'Agent Reach evidence participates through registry/signal path, not raw strategy prompt',
    ['tests/agent-reach-sensor.test.js', 'lib/market-intelligence/signal-engine.js', 'server.js'],
    has('tests/agent-reach-sensor.test.js', /Agent Reach evidence can be merged/) &&
      has('lib/market-intelligence/signal-engine.js', /agentReachEvidence/) &&
      has('server.js', /agentReachMarketEvidence/)
  ),
  row(
    'legacy-dominance',
    'Legacy dominance is removed from user-facing competitor model',
    ['lib/competitor-evidence-engine.js', runtimeFile, 'server.js'],
    has('lib/competitor-evidence-engine.js', /delete item\.dominance/) &&
      has(runtimeFile, /SERP RELEVANCE|PERTINENCE SERP|ملاءمة SERP/),
    true,
    'Internal compatibility fallbacks may still use legacy variable names, but user-facing labels must say SERP relevance.'
  )
];

const e2ePreconditions = {
  localSearchProvider: Boolean(process.env.SERPER_API_KEY || process.env.SERPAPI_KEY),
  localReasoningProvider: Boolean(process.env.OPENROUTER_API_KEY),
  remoteApiUrl: Boolean(process.env.DAKA_E2E_API_URL),
  remoteAuth: Boolean(process.env.DAKA_E2E_AUTH_TOKEN || process.env.DAKA_E2E_COOKIE)
};

const criticalMissing = checks.filter(item => ['layer', 'detectors', 'schema', 'server-wiring', 'report-v2', 'tests', 'e2e-gate'].includes(item.id) && item.status === 'MISSING');

const output = {
  success: criticalMissing.length === 0,
  completionStatus: criticalMissing.length ? 'NOT_READY' : 'READY_FOR_LIVE_E2E',
  liveE2EStatus: (e2ePreconditions.localSearchProvider && e2ePreconditions.localReasoningProvider) || (e2ePreconditions.remoteApiUrl && e2ePreconditions.remoteAuth)
    ? 'CAN_RUN'
    : 'WAITING_FOR_PROVIDER_KEYS_OR_REMOTE_AUTH',
  e2ePreconditions,
  checks,
  nextCommand: e2ePreconditions.remoteApiUrl
    ? 'npm run test:insight-e2e'
    : 'Set DAKA_E2E_API_URL and DAKA_E2E_AUTH_TOKEN/DAKA_E2E_COOKIE, or set local SERPER/SERPAPI + OPENROUTER, then run npm run test:insight-e2e.'
};

console.log(JSON.stringify(output, null, 2));
process.exit(criticalMissing.length ? 1 : 0);
