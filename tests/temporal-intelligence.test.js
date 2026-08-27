'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildTemporalIntelligence,
  classifyTemporalSignal,
  windowFor
} = require('../lib/market-intelligence/temporal-intelligence');
const {
  buildDecisionReportV2
} = require('../lib/market-intelligence/report-v2');

const NOW = '2026-08-27T12:00:00.000Z';

test('temporal intelligence compares 7 30 and 90 day evidence windows', () => {
  const temporal = buildTemporalIntelligence({
    now: NOW,
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_recent_1',
          claimType: 'review',
          value: 'Buyers ask about return policy and proof.',
          sourcePlatform: 'youtube',
          sourceUrl: 'https://youtube.com/watch?v=1',
          publishedAt: '2026-08-26T12:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_recent_2',
          claimType: 'review',
          value: 'Another buyer asks about return policy and proof.',
          sourcePlatform: 'reddit',
          sourceUrl: 'https://reddit.com/r/example/1',
          publishedAt: '2026-08-18T12:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_older_1',
          claimType: 'offer',
          value: 'Seller page mentions price and direct checkout.',
          sourcePlatform: 'serp',
          sourceUrl: 'https://shop.example/product',
          publishedAt: '2026-06-20T12:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        }
      ]
    }
  });

  assert.equal(temporal.version, 'temporal-intelligence-v1');
  assert.equal(temporal.windows.last7d, 1);
  assert.equal(temporal.windows.last30d, 1);
  assert.equal(temporal.windows.last90d, 1);
  assert.equal(temporal.windows.dated, 3);
  assert.ok(temporal.sampleShifts.length >= 1);
  assert.equal(temporal.quality.noDemandGrowthClaim, true);
  assert.equal(temporal.quality.boundedToObservedSample, true);
  assert.equal(temporal.quality.allShiftsTraceable, true);
  assert.doesNotMatch(JSON.stringify(temporal), /market is growing|growing demand|demand growth|sales growth/i);
});

test('temporal intelligence stays unknown when evidence is undated', () => {
  const temporal = buildTemporalIntelligence({
    now: NOW,
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_undated_1',
          claimType: 'offer',
          value: 'Page mentions delivery and price.',
          sourcePlatform: 'serp',
          sourceUrl: 'https://shop.example/product',
          verificationStatus: 'CONFIRMED'
        }
      ]
    }
  });

  assert.equal(temporal.windows.dated, 1);
  assert.equal(temporal.quality.sampleShiftCount, 0);
  assert.match(temporal.unknowns.join(' '), /No repeated recent signal/i);
});

test('temporal helpers classify activity without overclaiming growth', () => {
  assert.equal(windowFor({ publishedAt: '2026-08-25T12:00:00.000Z' }, new Date(NOW)), 'last7d');
  assert.equal(windowFor({ publishedAt: '2026-08-10T12:00:00.000Z' }, new Date(NOW)), 'last30d');
  assert.equal(windowFor({ publishedAt: '2026-06-10T12:00:00.000Z' }, new Date(NOW)), 'last90d');
  assert.equal(classifyTemporalSignal({ claimType: 'review', value: 'Customer complaint about proof' }), 'CUSTOMER_VOICE_ACTIVITY');
  assert.equal(classifyTemporalSignal({ claimType: 'offer', value: 'Bundle price with guarantee' }), 'OFFER_ACTIVITY');
});

test('decision report deep dive carries temporal intelligence', () => {
  const temporal = buildTemporalIntelligence({
    now: NOW,
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_recent_1',
          claimType: 'RSS_ITEM',
          title: 'Fresh offer comparison',
          value: 'Recent comparison of offers and customer objections.',
          sourcePlatform: 'rss',
          sourceUrl: 'https://news.example/1',
          publishedAt: '2026-08-26T12:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_recent_2',
          claimType: 'RSS_ITEM',
          title: 'Fresh offer guide',
          value: 'Recent guide mentions offers and customer objections.',
          sourcePlatform: 'rss',
          sourceUrl: 'https://news.example/2',
          publishedAt: '2026-08-24T12:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        }
      ]
    }
  });
  const report = buildDecisionReportV2({
    query: 'blackhead remover',
    country: 'Libya',
    temporalIntelligence: temporal,
    marketSignalModel: {
      signals: [],
      quality: { limitations: [] }
    },
    strategicAgentsV2: {
      marketPatternAnalyst: { observations: [] },
      gapAnalyst: { gaps: [], saturatedPatterns: [] },
      decisionStrategist: { actions: [] }
    },
    marketEntityMap: { byType: {}, supplierIntelligence: { status: 'UNKNOWN' } }
  });

  assert.equal(report.deepDive.temporalIntelligence.version, 'temporal-intelligence-v1');
  assert.equal(report.quality.temporalClaimsBounded, true);
});
