#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.WORKER_MODE = process.env.WORKER_MODE || 'true';

const missing = [];
if (!process.env.SERPER_API_KEY && !process.env.SERPAPI_KEY) missing.push('SERPER_API_KEY or SERPAPI_KEY');
if (!process.env.OPENROUTER_API_KEY) missing.push('OPENROUTER_API_KEY');

if (missing.length && process.env.DAKA_E2E_ALLOW_PARTIAL !== '1') {
  console.error(JSON.stringify({
    success: false,
    error: 'INSIGHT_E2E_PRECONDITION_FAILED',
    missing,
    message: 'Full live insight E2E needs real search and reasoning providers. Set the missing keys, or run with DAKA_E2E_ALLOW_PARTIAL=1 only for debugging incomplete local wiring.'
  }, null, 2));
  process.exit(1);
}

const { analyzeCompetitors } = require('../server');

const GENERIC_TOP_INSIGHT = /\b(improve seo|use social media|offer good customer service|competitive pricing|add testimonials|differentiate your offer|expand locally|increase brand awareness|create valuable content)\b/i;
const FORBIDDEN_CLAIMS = /\b(market leader|market dominance|dominance\s*[:=]\s*100|demand growth|market growth|sales growth|exploding demand)\b/i;
const RELATIONSHIP_MARKERS = /\+|gap|contradiction|asymmetry|risk|saturation|underused|coverage|while/i;

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
    query: 'blackhead remover',
    market: 'Libya',
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

(async () => {
  const startedAt = Date.now();
  const result = await analyzeCompetitors('blackhead remover', 'ly', 'en', null, true, null, {
    productDescription: 'Blackhead remover device for the Libyan market.',
    objective: 'sales',
    priceRange: 'unknown',
    budget: 'small'
  });
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
