'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildMarketSignalEngine
} = require('../lib/market-intelligence/signal-engine');
const {
  runStrategicAgentsV2
} = require('../lib/market-intelligence/strategic-agents-v2');

const NOW = '2026-08-27T12:00:00.000Z';

function modelFromEvidence(evidence) {
  return buildMarketSignalEngine({
    now: NOW,
    evidenceRegistry: { evidence }
  });
}

test('strategic agents produce at most three traceable actions from validated signals', () => {
  const marketSignalModel = modelFromEvidence([
    {
      id: 'ev_gap_1',
      claimType: 'not_found',
      value: 'Guarantee and return conditions were not found on the inspected product page.',
      sourceUrl: 'https://competitor.example/product',
      sourcePlatform: 'inspected_page',
      verificationStatus: 'NOT_FOUND_ON_INSPECTED_PAGE',
      confidence: 'LOW',
      observedAt: NOW
    },
    {
      id: 'ev_price_1',
      claimType: 'offer',
      value: 'The offer highlights price, cash on delivery and a direct checkout button.',
      sourceUrl: 'https://shop.example/product',
      sourcePlatform: 'serp',
      verificationStatus: 'CONFIRMED',
      confidence: 'HIGH',
      observedAt: NOW
    },
    {
      id: 'ev_proof_1',
      claimType: 'review',
      value: 'Customers ask if visible before-after proof exists before ordering.',
      sourceUrl: 'https://youtube.com/watch?v=review',
      sourcePlatform: 'youtube',
      verificationStatus: 'CONFIRMED',
      confidence: 'MEDIUM',
      observedAt: NOW
    },
    {
      id: 'ev_feature_1',
      claimType: 'offer',
      value: 'The page repeats LED light, USB charging and multiple suction levels.',
      sourceUrl: 'https://shop.example/product',
      sourcePlatform: 'serp',
      verificationStatus: 'CONFIRMED',
      confidence: 'MEDIUM',
      observedAt: NOW
    }
  ]);
  const agents = runStrategicAgentsV2({
    marketSignalModel,
    query: 'blackhead remover',
    country: 'Libya'
  });

  assert.equal(agents.version, 'strategic-agents-v2');
  assert.equal(agents.quality.maxThreeActions, true);
  assert.equal(agents.quality.allActionsTraceable, true);
  assert.ok(agents.decisionStrategist.actions.length > 0);
  assert.ok(agents.decisionStrategist.actions.length <= 3);
  assert.ok(agents.decisionStrategist.actions.every(action => action.signalIds.length && action.evidenceIds.length));
});

test('strategic agents stay empty when no evidence-backed signal is available', () => {
  const agents = runStrategicAgentsV2({
    marketSignalModel: {
      version: 'market-signal-engine-v1',
      sourceEvidenceCount: 0,
      signals: [],
      signalTypes: [],
      quality: { noMarketGrowthClaim: true }
    },
    competitors: [{ title: 'Market leader with 100% dominance' }]
  });

  assert.equal(agents.decisionStrategist.actions.length, 0);
  assert.equal(agents.quality.unsupportedActionCount, 0);
  assert.doesNotMatch(JSON.stringify(agents), /market leader|100% dominance/i);
});

test('gap analyst keeps inferred gap limitations attached', () => {
  const marketSignalModel = modelFromEvidence([
    {
      id: 'ev_missing_1',
      claimType: 'not_found',
      value: 'Customer proof was not found on the inspected landing page.',
      sourceUrl: 'https://competitor.example',
      sourcePlatform: 'inspected_page',
      verificationStatus: 'NOT_FOUND_ON_INSPECTED_PAGE',
      confidence: 'LOW',
      observedAt: NOW
    }
  ]);
  const agents = runStrategicAgentsV2({ marketSignalModel });
  const gap = agents.gapAnalyst.gaps[0];

  assert.equal(gap.status, 'INFERRED');
  assert.ok(gap.evidenceIds.includes('ev_missing_1'));
  assert.match(gap.limitations.join(' '), /not confirmed absence/i);
});

test('decision strategist never states market growth from fresh sample signals', () => {
  const marketSignalModel = buildMarketSignalEngine({
    now: NOW,
    marketEvidence: {
      evidenceRegistry: {
        evidence: [
          {
            id: 'ev_rss_1',
            claimType: 'RSS_ITEM',
            title: 'LED device review',
            value: 'Fresh review content about LED skin-care devices.',
            sourceUrl: 'https://news.example/1',
            sourcePlatform: 'rss',
            publishedAt: '2026-08-25T10:00:00.000Z',
            collectedAt: NOW,
            verificationStatus: 'CONFIRMED'
          },
          {
            id: 'ev_rss_2',
            claimType: 'RSS_ITEM',
            title: 'LED offer guide',
            value: 'Fresh guide compares LED skin-care device offers.',
            sourceUrl: 'https://news.example/2',
            sourcePlatform: 'rss',
            publishedAt: '2026-08-21T10:00:00.000Z',
            collectedAt: NOW,
            verificationStatus: 'CONFIRMED'
          }
        ]
      }
    }
  });
  const agents = runStrategicAgentsV2({ marketSignalModel });

  assert.equal(agents.quality.noMarketGrowthClaim, true);
  assert.doesNotMatch(JSON.stringify(agents.decisionStrategist.actions), /market is growing|growing demand|demand growth/i);
});
