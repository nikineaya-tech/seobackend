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
  buildInsightDiscoveryEngine
} = require('../lib/market-intelligence/insights/insight-engine');
const {
  buildDecisionReportV2,
  validateDecisionReportV2
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
  const insightDiscoveryModel = buildInsightDiscoveryEngine({
    evidenceRegistry,
    marketSignalModel,
    marketEntityMap,
    country: 'Libya',
    query: 'blackhead remover'
  });
  return {
    evidenceRegistry,
    marketSignalModel,
    strategicAgentsV2,
    marketEntityMap,
    insightDiscoveryModel
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
  assert.equal(report.mainReport.customerVoice.mode, 'quantified_evidence_patterns');
  assert.equal(report.mainReport.customerVoice.quality.quantifiedFromEvidence, true);
  assert.ok(report.mainReport.customerVoice.objections.some(pattern => pattern.count >= 1));
  assert.equal(report.mainReport.sellerFight.mode, 'quantified_offer_patterns');
  assert.equal(report.mainReport.sellerFight.quality.noInventedCommercialTerms, true);
  assert.ok(report.mainReport.sellerFight.payment.some(pattern => pattern.evidenceIds.includes('ev_offer_1')));
  assert.ok(Array.isArray(report.mainReport.discoveryInsights));
  if (report.mainReport.discoveryInsights[0]) {
    assert.ok(Array.isArray(report.mainReport.discoveryInsights[0].dimensions));
    assert.ok(report.mainReport.discoveryInsights[0].metrics);
    assert.ok(report.mainReport.discoveryInsights[0].recommendedTest);
  }
  assert.ok(report.deepDive.insightDiscovery);
  assert.deepEqual(
    Object.keys(report.deepDive.insightDiscovery.insightTrace).sort(),
    report.deepDive.insightDiscovery.insights.map(item => item.id).sort()
  );
  assert.equal(report.deepDive.socialContentIntelligence.mode, 'quantified_content_patterns');
  assert.equal(report.deepDive.socialContentIntelligence.quality.noInventedEngagementClaims, true);
  assert.ok(report.deepDive.socialContentIntelligence.reviews.some(pattern => pattern.evidenceIds.includes('ev_social_1')));
  assert.ok(report.mainReport.opportunityGaps.length <= 3);
  assert.ok(report.mainReport.priorityActions.length <= 3);
  assert.ok(report.mainReport.priorityActions.every(action => action.status === 'RECOMMENDED_TEST'));
  assert.ok(report.deepDive.rawEvidence.length >= 3);
  assert.ok(report.deepDive.substitutes.some(item => item.type === 'SUBSTITUTE'));
  assert.equal(report.quality.evidenceFirst, true);
  assert.equal(report.quality.noObservedClaimWithoutEvidence, true);
  assert.equal(report.claimValidation.status, 'approved');
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

test('decision report validator blocks untraceable output contracts', () => {
  const validation = validateDecisionReportV2({
    mainReport: {
      marketIn60Seconds: [
        {
          status: 'OBSERVED',
          title: 'leader',
          insight: 'This is the market leader with 100% dominance.',
          evidenceIds: []
        }
      ],
      opportunityGaps: [{ statement: 'Gap without limits', evidenceIds: [] }],
      priorityActions: [{ status: 'OBSERVED', action: 'Scale ads now', signalIds: [], evidenceIds: [] }]
    },
    deepDive: {
      supplierLandscape: { status: 'CONFIRMED', evidenceIds: [] },
      rawEvidence: []
    }
  });

  assert.equal(validation.status, 'downgraded');
  assert.ok(validation.issues.some(issue => issue.code === 'OBSERVED_WITHOUT_EVIDENCE'));
  assert.ok(validation.issues.some(issue => issue.code === 'UNTRACEABLE_ACTION'));
  assert.ok(validation.issues.some(issue => issue.code === 'UNSUPPORTED_STRONG_MARKET_CLAIM'));
  assert.ok(validation.issues.some(issue => issue.code === 'SUPPLIER_CONFIRMED_WITHOUT_EVIDENCE'));
});
test('decision report v2 does not crash when observation exceeds 500 characters', () => {
  const longStatement = `Observed market statement: ${'x'.repeat(900)}`;

  const report = buildDecisionReportV2({
    query: 'fanous led',
    country: 'Morocco',
    lang: 'ar',

    marketSignalModel: {
      signals: [
        {
          id: 'sig_long_1',
          type: 'MESSAGE_PATTERN',
          topic: 'long observation regression',
          status: 'OBSERVED',
          statement: longStatement,
          confidence: 'MEDIUM',
          evidenceIds: ['ev_long_1'],
          sourceUrls: ['https://example.com/product'],
          limitations: []
        }
      ]
    },

    strategicAgentsV2: {
      marketPatternAnalyst: {
        observations: []
      },
      gapAnalyst: {
        gaps: [],
        saturatedPatterns: [],
        unknowns: []
      },
      decisionStrategist: {
        actions: [],
        unknowns: []
      }
    },

    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_long_1',
          scope: 'MARKET',
          claimType: 'message_pattern',
          value: longStatement,
          sourcePlatform: 'serp',
          sourceUrl: 'https://example.com/product',
          confidence: 'MEDIUM',
          verificationStatus: 'CONFIRMED'
        }
      ]
    },

    marketEntityMap: {
      byType: {},
      supplierIntelligence: {
        status: 'UNKNOWN',
        limitations: ['No supplier evidence collected.']
      }
    },

    temporalIntelligence: {
      status: 'UNKNOWN',
      quality: {
        noDemandGrowthClaim: true
      }
    }
  });

  assert.ok(report);
  assert.ok(report.mainReport);
  assert.ok(Array.isArray(report.mainReport.marketIn60Seconds));
  assert.ok(report.mainReport.marketIn60Seconds.length >= 1);

  const observation = report.mainReport.marketIn60Seconds[0];

  assert.ok(observation.evidenceIds.includes('ev_long_1'));
  assert.equal(observation.status, 'OBSERVED');
});
