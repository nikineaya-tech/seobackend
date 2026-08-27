'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildMarketSignalEngine
} = require('../lib/market-intelligence/signal-engine');
const {
  runStrategicAgentsV2
} = require('../lib/market-intelligence/strategic-agents-v2');
const {
  buildMarketEntityMap
} = require('../lib/market-intelligence/entity-classifier');
const {
  buildDecisionReportV2
} = require('../lib/market-intelligence/report-v2');

const NOW = '2026-08-27T12:00:00.000Z';

function buildFixture() {
  const evidenceRegistry = {
    evidence: [
      {
        id: 'ev_offer_1',
        scope: 'COMPETITOR',
        competitorId: 'shop_example',
        claimType: 'offer',
        value: 'The product page shows price, cash on delivery and a direct checkout CTA.',
        sourceUrl: 'https://shop.example/product',
        sourcePlatform: 'serp',
        verificationStatus: 'CONFIRMED',
        confidence: 'HIGH',
        observedAt: NOW
      },
      {
        id: 'ev_gap_1',
        scope: 'COMPETITOR',
        competitorId: 'shop_example',
        claimType: 'not_found',
        value: 'Customer proof and return terms were not found on the inspected page.',
        sourceUrl: 'https://shop.example/product',
        sourcePlatform: 'inspected_page',
        verificationStatus: 'NOT_FOUND_ON_INSPECTED_PAGE',
        confidence: 'LOW',
        observedAt: NOW
      },
      {
        id: 'ev_social_1',
        scope: 'CUSTOMER',
        claimType: 'review',
        value: 'Video viewers ask if the device is safe for sensitive skin and whether before-after proof exists.',
        sourceUrl: 'https://youtube.com/watch?v=abc',
        sourcePlatform: 'youtube',
        verificationStatus: 'CONFIRMED',
        confidence: 'MEDIUM',
        publishedAt: '2026-08-25T10:00:00.000Z',
        collectedAt: NOW
      }
    ]
  };
  const marketSignalModel = buildMarketSignalEngine({
    now: NOW,
    evidenceRegistry
  });
  const strategicAgentsV2 = runStrategicAgentsV2({
    marketSignalModel,
    query: 'blackhead remover',
    country: 'Libya'
  });
  const marketEntityMap = buildMarketEntityMap({
    competitors: [
      {
        domain: 'shop.example',
        url: 'https://shop.example/product',
        title: 'Blackhead remover product page',
        geoTier: 'LOCAL_CONFIRMED',
        sourceType: 'directCompetitor',
        evidenceIds: ['ev_offer_1', 'ev_gap_1']
      }
    ],
    marketProductSources: {
      groups: {
        proofLinks: [
          {
            title: 'Customer review video',
            url: 'https://youtube.com/watch?v=abc',
            sourceType: 'youtubeVideo',
            evidenceIds: ['ev_social_1']
          }
        ]
      }
    },
    evidenceRegistry,
    country: 'Libya'
  });
  return {
    evidenceRegistry,
    marketSignalModel,
    strategicAgentsV2,
    marketEntityMap
  };
}

test('decision report v2 exposes short executive surface and deep dive', () => {
  const fixture = buildFixture();
  const report = buildDecisionReportV2({
    ...fixture,
    query: 'blackhead remover',
    country: 'Libya',
    lang: 'en'
  });

  assert.equal(report.version, 'decision-report-v2');
  assert.equal(report.mode, 'executive_first_deep_dive_on_demand');
  assert.ok(report.mainReport.marketIn60Seconds.length > 0);
  assert.ok(report.mainReport.marketIn60Seconds.length <= 5);
  assert.ok(report.mainReport.opportunityGaps.length <= 3);
  assert.ok(report.mainReport.priorityActions.length <= 3);
  assert.ok(report.mainReport.priorityActions.every(action => action.status === 'RECOMMENDED_TEST'));
  assert.ok(report.deepDive.rawEvidence.length >= 3);
  assert.ok(report.deepDive.substitutes.some(item => item.type === 'SUBSTITUTE'));
  assert.equal(report.quality.evidenceFirst, true);
  assert.equal(report.quality.noObservedClaimWithoutEvidence, true);
});

test('decision report v2 does not promote unsupported observations or supplier claims', () => {
  const report = buildDecisionReportV2({
    query: 'formation ecommerce',
    country: 'Morocco',
    lang: 'fr',
    marketSignalModel: {
      signals: [
        {
          id: 'sig_bad',
          type: 'MESSAGE_PATTERN',
          topic: 'leader',
          status: 'OBSERVED',
          statement: 'Market leader with 100% dominance.',
          evidenceIds: []
        }
      ],
      quality: { limitations: ['No verified signals available.'] }
    },
    strategicAgentsV2: {
      marketPatternAnalyst: {
        observations: [
          {
            signalId: 'sig_bad',
            type: 'MESSAGE_PATTERN',
            topic: 'leader',
            status: 'OBSERVED',
            statement: 'Market leader with 100% dominance.',
            evidenceIds: []
          }
        ]
      },
      gapAnalyst: { gaps: [], saturatedPatterns: [] },
      decisionStrategist: { actions: [] }
    },
    marketEntityMap: {
      byType: {},
      supplierIntelligence: { status: 'UNKNOWN', limitations: ['No supplier evidence.'] }
    }
  });

  assert.equal(report.mainReport.marketIn60Seconds.length, 0);
  assert.equal(report.mainReport.priorityActions.length, 0);
  assert.equal(report.deepDive.supplierLandscape.status, 'UNKNOWN');
  assert.equal(report.quality.noObservedClaimWithoutEvidence, true);
  assert.doesNotMatch(JSON.stringify(report.mainReport), /market leader|100% dominance/i);
});
