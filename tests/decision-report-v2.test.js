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
  assert.equal(report.mainReport.commentsReviews.mode, 'observed_comments_reviews');
  assert.equal(report.mainReport.commentsReviews.quality.noInventedReviews, true);
  assert.ok(report.mainReport.commentsReviews.observedItems.some(item => item.id === 'ev_social_1'));
  assert.ok(report.mainReport.commentsReviews.patterns.some(pattern => pattern.evidenceIds.includes('ev_social_1')));
  assert.ok(report.mainReport.marketCoverage);
  assert.equal(report.mainReport.marketCoverage.quality.canonicalCoverageObject, true);
  assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(report.mainReport.marketCoverage.level));
  assert.ok(report.mainReport.marketCoverage.sections.some(section => section.key === 'comments_reviews' && section.status === 'READY'));
  assert.ok(report.mainReport.marketCoverage.sections.some(section => section.key === 'pricing'));
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

test('decision report v2 deduplicates repeated comments and content patterns', () => {
  const report = buildDecisionReportV2({
    query: 'soins de peau',
    country: 'Libya',
    lang: 'ar',
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_review_1',
          scope: 'CUSTOMER',
          claimType: 'review',
          value: 'Customer asks for real proof before trusting the product.',
          sourcePlatform: 'youtube',
          sourceUrl: 'https://youtube.example/review-1',
          confidence: 'LOW',
          verificationStatus: 'CONFIRMED',
          collectedAt: NOW
        },
        {
          id: 'ev_review_2',
          scope: 'CUSTOMER',
          claimType: 'comment',
          value: 'Customer asks for real proof before trusting the product.',
          sourcePlatform: 'review_search',
          sourceUrl: 'https://reviews.example/review-2',
          confidence: 'MEDIUM',
          verificationStatus: 'CONFIRMED',
          collectedAt: NOW
        }
      ]
    },
    marketSignalModel: {
      signals: [],
      customerVoice: {
        patterns: [
          {
            type: 'OBJECTION',
            key: 'proof_or_reviews_needed',
            label: 'Need proof before trust',
            count: 1,
            confidence: 'LOW',
            evidenceIds: ['ev_review_1'],
            sourceUrls: ['https://youtube.example/review-1'],
            sourcePlatforms: ['youtube']
          }
        ]
      },
      socialContent: {
        patterns: [
          {
            format: 'review',
            key: 'proof_or_reviews_needed',
            label: 'Need proof before trust',
            count: 1,
            confidence: 'MEDIUM',
            evidenceIds: ['ev_review_2'],
            sourceUrls: ['https://reviews.example/review-2'],
            sourcePlatforms: ['review_search']
          }
        ],
        quality: { quantifiedFromEvidence: true, noInventedEngagementClaims: true }
      },
      offerIntelligence: { patterns: [] },
      quality: { limitations: [] }
    },
    strategicAgentsV2: {
      marketPatternAnalyst: { observations: [] },
      gapAnalyst: { gaps: [], saturatedPatterns: [], unknowns: [] },
      decisionStrategist: { actions: [], unknowns: [] }
    },
    marketEntityMap: {
      byType: {},
      supplierIntelligence: { status: 'UNKNOWN', limitations: [] }
    }
  });

  const duplicated = report.mainReport.commentsReviews.patterns
    .filter(pattern => pattern.key === 'proof_or_reviews_needed');

  assert.equal(duplicated.length, 1);
  assert.deepEqual(duplicated[0].evidenceIds.sort(), ['ev_review_1', 'ev_review_2']);
  assert.equal(duplicated[0].confidence, 'MEDIUM');
  assert.equal(report.deepDive.socialContentIntelligence.reviews.length, 1);
});

test('decision report v2 rejects social login pages as comments or reviews', () => {
  const loginUrl = 'https://www.facebook.com/login/device-based/regular/login/?login_attempt=1';
  const report = buildDecisionReportV2({
    query: 'soins de peau',
    country: 'Libya',
    lang: 'ar',
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_login_wall',
          scope: 'CUSTOMER',
          claimType: 'review',
          value: 'Title: Facebook URL Source: https://www.facebook.com/post Markdown Content: Explore the things you love. Log into Facebook Email or mobile.',
          sourcePlatform: 'facebook',
          sourceUrl: loginUrl,
          confidence: 'MEDIUM',
          verificationStatus: 'CONFIRMED',
          collectedAt: NOW
        }
      ]
    },
    marketSignalModel: buildMarketSignalEngine({
      now: NOW,
      evidenceRegistry: {
        evidence: [
          {
            id: 'ev_login_wall',
            scope: 'CUSTOMER',
            claimType: 'review',
            value: 'Title: Facebook URL Source: https://www.facebook.com/post Markdown Content: Explore the things you love. Log into Facebook Email or mobile.',
            sourcePlatform: 'facebook',
            sourceUrl: loginUrl,
            confidence: 'MEDIUM',
            verificationStatus: 'CONFIRMED',
            collectedAt: NOW
          }
        ]
      }
    }),
    strategicAgentsV2: {
      marketPatternAnalyst: { observations: [] },
      gapAnalyst: { gaps: [], saturatedPatterns: [], unknowns: [] },
      decisionStrategist: { actions: [], unknowns: [] }
    },
    marketEntityMap: {
      byType: {},
      supplierIntelligence: { status: 'UNKNOWN', limitations: [] }
    }
  });

  assert.equal(report.mainReport.commentsReviews.summary.evidenceCount, 0);
  assert.equal(report.mainReport.commentsReviews.patterns.length, 0);
  assert.doesNotMatch(JSON.stringify(report.mainReport.commentsReviews), /login_attempt|Log into Facebook/i);
});

test('decision report v2 comments and reviews section refuses to invent missing customer voice', () => {
  const report = buildDecisionReportV2({
    query: 'blackhead remover',
    country: 'Libya',
    lang: 'en',
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_offer_only',
          scope: 'OFFER',
          claimType: 'offer',
          value: 'Product page mentions suction levels and LED light.',
          sourcePlatform: 'inspected_page',
          sourceUrl: 'https://seller.example/product',
          confidence: 'MEDIUM',
          verificationStatus: 'CONFIRMED'
        }
      ]
    },
    agentReachEvidence: {
      channelDiagnostics: [
        {
          channel: 'youtube',
          provider: 'agent-reach',
          backend: 'youtube',
          status: 'UNAVAILABLE',
          reason: 'missing_api_key',
          resultCount: 0,
          evidenceCount: 0
        }
      ],
      channelSummary: { unavailable: 1 },
      evidenceRegistry: { evidence: [] }
    },
    marketSignalModel: buildMarketSignalEngine({
      now: NOW,
      evidenceRegistry: {
        evidence: [
          {
            id: 'ev_offer_only',
            scope: 'OFFER',
            claimType: 'offer',
            value: 'Product page mentions suction levels and LED light.',
            sourcePlatform: 'inspected_page',
            sourceUrl: 'https://seller.example/product',
            confidence: 'MEDIUM',
            verificationStatus: 'CONFIRMED'
          }
        ]
      }
    }),
    strategicAgentsV2: {
      marketPatternAnalyst: { observations: [] },
      gapAnalyst: { gaps: [], saturatedPatterns: [], unknowns: [] },
      decisionStrategist: { actions: [], unknowns: [] }
    },
    marketEntityMap: {
      byType: {},
      supplierIntelligence: { status: 'UNKNOWN', limitations: ['No supplier evidence.'] }
    }
  });

  assert.equal(report.mainReport.commentsReviews.mode, 'insufficient_customer_voice_evidence');
  assert.equal(report.mainReport.commentsReviews.status, 'NO_COMMENTS_OR_REVIEWS_FOUND');
  assert.equal(report.mainReport.commentsReviews.observedItems.length, 0);
  assert.equal(report.mainReport.commentsReviews.channelDiagnostics[0].reason, 'missing_api_key');
  assert.equal(report.mainReport.commentsReviews.quality.noInventedReviews, true);
  assert.equal(report.mainReport.marketCoverage.sections.find(section => section.key === 'customer_voice').status, 'MISSING');
  assert.equal(report.mainReport.marketCoverage.sections.find(section => section.key === 'comments_reviews').status, 'MISSING');
  assert.ok(report.mainReport.marketCoverage.missingCapabilities.includes('Real customer voice is insufficient'));
});

test('decision report v2 localizes Arabic coverage and refuses catalog snippets as comments', () => {
  const report = buildDecisionReportV2({
    query: 'soins de peau',
    country: 'Libya',
    lang: 'ar',
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_catalog_snippet',
          scope: 'MARKET',
          claimType: 'CUSTOMER_DESIRE',
          value: 'Buy premium skin care products online on a marketplace catalog with many product options.',
          sourcePlatform: 'web',
          sourceUrl: 'https://catalog.example/skin-care',
          confidence: 'MEDIUM',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_offer_snippet',
          scope: 'OFFER',
          claimType: 'offer',
          value: 'Product page mentions price and available skin care products.',
          sourcePlatform: 'serp',
          sourceUrl: 'https://seller.example/product',
          confidence: 'MEDIUM',
          verificationStatus: 'CONFIRMED'
        }
      ]
    },
    marketSignalModel: buildMarketSignalEngine({
      now: NOW,
      query: 'soins de peau',
      country: 'Libya',
      evidenceRegistry: {
        evidence: [
          {
            id: 'ev_catalog_snippet',
            scope: 'MARKET',
            claimType: 'CUSTOMER_DESIRE',
            value: 'Buy premium skin care products online on a marketplace catalog with many product options.',
            sourcePlatform: 'web',
            sourceUrl: 'https://catalog.example/skin-care',
            confidence: 'MEDIUM',
            verificationStatus: 'CONFIRMED'
          },
          {
            id: 'ev_offer_snippet',
            scope: 'OFFER',
            claimType: 'offer',
            value: 'Product page mentions price and available skin care products.',
            sourcePlatform: 'serp',
            sourceUrl: 'https://seller.example/product',
            confidence: 'MEDIUM',
            verificationStatus: 'CONFIRMED'
          }
        ]
      }
    }),
    strategicAgentsV2: {
      marketPatternAnalyst: { observations: [] },
      gapAnalyst: { gaps: [], saturatedPatterns: [], unknowns: [] },
      decisionStrategist: { actions: [], unknowns: [] }
    },
    marketEntityMap: {
      byType: {},
      supplierIntelligence: { status: 'UNKNOWN', limitations: [] }
    }
  });

  const coverageJson = JSON.stringify(report.mainReport.marketCoverage);
  assert.equal(report.mainReport.commentsReviews.summary.evidenceCount, 0);
  assert.equal(report.mainReport.commentsReviews.patterns.length, 0);
  assert.match(coverageJson, /صوت العميل الحقيقي غير كاف/);
  assert.match(coverageJson, /لم يتم جمع تعليقات أو آراء قابلة للاستعمال/);
  assert.doesNotMatch(coverageJson, /Customer Voice réel|Commentaires et avis|Guide concret|Pricing Intelligence|Offer Intelligence/i);
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
