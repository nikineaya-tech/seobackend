#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.WORKER_MODE = process.env.WORKER_MODE || 'true';

const GENERIC_TOP_INSIGHT = /\b(improve seo|use social media|offer good customer service|competitive pricing|add testimonials|differentiate your offer|expand locally|increase brand awareness|create valuable content)\b/i;
const FORBIDDEN_CLAIMS = /\b(market leader|market dominance|dominance\s*[:=]\s*100|demand growth|market growth|sales growth|exploding demand)\b/i;
const RELATIONSHIP_MARKERS = /\+|gap|contradiction|asymmetry|risk|saturation|underused|coverage|while/i;
const QUERY = process.env.DAKA_E2E_QUERY || 'blackhead remover';
const MARKET = process.env.DAKA_E2E_MARKET || 'Libya';
const GEO = process.env.DAKA_E2E_GEO || 'ly';
const LANG = process.env.DAKA_E2E_LANG || 'en';

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function collectInsights(result = {}) {
  return asArray(
    result.discoveryInsights ||
    result.mainReport?.discoveryInsights ||
    result.decisionReportV2?.mainReport?.discoveryInsights ||
    result.reportV2?.mainReport?.discoveryInsights ||
    result.insightDiscoveryModel?.topInsights
  ).slice(0, 5);
}

function inspectPayload(result = {}) {
  const insights = collectInsights(result);
  const trace = result.insightTrace || result.insightDiscoveryModel?.insightTrace || result.decisionReportV2?.deepDive?.insightDiscovery?.insightTrace || {};
  if (!result || result.success === false) fail('E2E competitor pipeline returned failure.', { error: result.error });
  if (!insights.length) fail('No top discovery insights reached the final payload.');
  if (insights.length > 5) fail('Top discovery insight count exceeds the 3-5 report surface.', { count: insights.length });

  const badGeneric = insights.find(insight => GENERIC_TOP_INSIGHT.test(`${insight.title} ${insight.finding} ${insight.interpretation} ${insight.decisionTest}`));
  if (badGeneric) fail('Generic advice reached top discovery insights.', { insight: badGeneric });

  const badForbidden = insights.find(insight => FORBIDDEN_CLAIMS.test(JSON.stringify(insight)));
  if (badForbidden) fail('Forbidden market-share/growth wording reached top discovery insights.', { insight: badForbidden });

  const untraced = insights.find(insight => !asArray(insight.evidenceIds).length || !trace[insight.id]);
  if (untraced) fail('A top insight is missing evidence IDs or insightTrace.', { insight: untraced, trace: trace[untraced.id] });

  const noRelationship = insights.find(insight => !RELATIONSHIP_MARKERS.test(`${insight.relationship} ${insight.finding} ${insight.type}`));
  if (noRelationship) fail('A top insight does not express a cross-source relationship.', { insight: noRelationship });

  return {
    mode: process.env.DAKA_E2E_API_URL ? 'remote-api' : 'local-internal',
    query: QUERY,
    market: MARKET,
    success: true,
    source: result.source || null,
    competitors: result.totalFound || asArray(result.competitors).length,
    topInsights: insights.map(insight => ({
      id: insight.id,
      type: insight.type,
      confidence: insight.confidence,
      score: insight.score,
      finding: insight.finding,
      relationship: insight.relationship,
      test: insight.decisionTest || insight.recommendedTest?.action,
      evidenceIds: asArray(insight.evidenceIds).slice(0, 8),
      sources: asArray((trace[insight.id] || {}).sources || insight.sourceUrls).slice(0, 5)
    })),
    coverageGate: result.insightDiscoveryModel?.coverageGate || result.decisionReportV2?.deepDive?.insightDiscovery?.coverageGate || null
  };
}

function assertLocalPreconditions() {
  const missing = [];
  if (!process.env.SERPER_API_KEY && !process.env.SERPAPI_KEY) missing.push('SERPER_API_KEY or SERPAPI_KEY');
  if (!process.env.OPENROUTER_API_KEY) missing.push('OPENROUTER_API_KEY');
  if (missing.length && process.env.DAKA_E2E_ALLOW_PARTIAL !== '1') {
    fail('INSIGHT_E2E_PRECONDITION_FAILED', {
      missing,
      message: 'Full local insight E2E needs real search and reasoning providers. Set the missing keys locally, run on Render, or set DAKA_E2E_API_URL plus DAKA_E2E_AUTH_TOKEN/DAKA_E2E_COOKIE to inspect the deployed final payload.'
    });
  }
}

async function runLocalE2E() {
  assertLocalPreconditions();
  const { analyzeCompetitors } = require('../server');
  return analyzeCompetitors(QUERY, GEO, LANG, null, true, null, {
    productDescription: 'Blackhead remover device for the Libyan market.',
    objective: 'sales',
    priceRange: 'unknown',
    budget: 'small'
  });
}

async function runRemoteE2E() {
  const base = String(process.env.DAKA_E2E_API_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  if (!process.env.DAKA_E2E_AUTH_TOKEN && !process.env.DAKA_E2E_COOKIE && process.env.DAKA_E2E_ALLOW_PARTIAL !== '1') {
    fail('INSIGHT_E2E_REMOTE_AUTH_REQUIRED', {
      missing: ['DAKA_E2E_AUTH_TOKEN or DAKA_E2E_COOKIE'],
      message: 'The deployed /api/competitors route is protected. Provide a bearer token or cookie copied from an authenticated session.'
    });
  }
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.DAKA_E2E_AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.DAKA_E2E_AUTH_TOKEN}`;
  if (process.env.DAKA_E2E_COOKIE) headers.Cookie = process.env.DAKA_E2E_COOKIE;
  const response = await fetch(`${base}/api/competitors`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: QUERY,
      geo: MARKET,
      lang: LANG,
      forceRefresh: true,
      context: {
        productDescription: 'Blackhead remover device for the Libyan market.',
        objective: 'sales',
        priceRange: 'unknown',
        budget: 'small'
      }
    })
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    fail('INSIGHT_E2E_REMOTE_NON_JSON_RESPONSE', {
      status: response.status,
      body: text.slice(0, 600)
    });
  }
  if (!response.ok) {
    fail('INSIGHT_E2E_REMOTE_HTTP_FAILED', {
      status: response.status,
      response: json
    });
  }
  return json;
}

(async () => {
  const startedAt = Date.now();
  const result = process.env.DAKA_E2E_API_URL ? await runRemoteE2E() : await runLocalE2E();
  const audit = inspectPayload(result);
  audit.durationMs = Date.now() - startedAt;
  console.log(JSON.stringify(audit, null, 2));
})().catch(error => {
  console.error(JSON.stringify({
    success: false,
    error: error.message,
    details: error.details || null
  }, null, 2));
  process.exit(1);
});
