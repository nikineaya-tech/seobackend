'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SIGNAL_TYPES,
  SIGNAL_STATUS,
  buildMarketSignalEngine,
  evidenceRowsFrom,
  topicFor
} = require('../lib/market-intelligence/signal-engine');

const NOW = '2026-08-27T12:00:00.000Z';

test('market signal engine groups evidence into traceable business signals', () => {
  const model = buildMarketSignalEngine({
    now: NOW,
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_price_1',
          claimType: 'offer',
          value: 'Product page shows clear price and cash on delivery terms.',
          sourceUrl: 'https://shop.example/product',
          sourcePlatform: 'serp',
          verificationStatus: 'CONFIRMED',
          confidence: 'HIGH',
          observedAt: NOW
        },
        {
          id: 'ev_review_1',
          claimType: 'review',
          value: 'Customers ask if the guarantee and return policy are real.',
          sourceUrl: 'https://youtube.com/watch?v=abc',
          sourcePlatform: 'youtube',
          verificationStatus: 'CONFIRMED',
          confidence: 'MEDIUM',
          observedAt: NOW
        }
      ]
    }
  });

  assert.equal(model.version, 'market-signal-engine-v1');
  assert.equal(model.quality.unsupportedObservedSignals, 0);
  assert.ok(model.sourceEvidenceCount >= 2);
  assert.ok(model.byType[SIGNAL_TYPES.BUYING_CRITERION].length >= 1);
  assert.ok(model.byType[SIGNAL_TYPES.OBJECTION].length >= 1);
  assert.ok(model.signals.every(signal => signal.evidenceIds.length > 0));
});

test('missing proof becomes an inferred gap, not a confirmed market absence', () => {
  const model = buildMarketSignalEngine({
    now: NOW,
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_missing_1',
          claimType: 'not_found',
          value: 'Guarantee was not found on the inspected page.',
          sourceUrl: 'https://competitor.example',
          sourcePlatform: 'inspected_page',
          verificationStatus: 'NOT_FOUND_ON_INSPECTED_PAGE',
          confidence: 'LOW',
          observedAt: NOW
        }
      ]
    }
  });

  const gap = model.byType[SIGNAL_TYPES.COMPETITIVE_GAP][0];
  assert.equal(gap.status, SIGNAL_STATUS.INFERRED);
  assert.match(gap.limitations.join(' '), /not confirmed absence/i);
  assert.doesNotMatch(JSON.stringify(gap), /CONFIRMED_ABSENT/i);
});

test('fresh dated evidence creates emerging sample signals without growth claims', () => {
  const model = buildMarketSignalEngine({
    now: NOW,
    marketEvidence: {
      evidenceRegistry: {
        evidence: [
          {
            id: 'ev_rss_1',
            claimType: 'RSS_ITEM',
            title: 'New sellers promote LED skin-care devices',
            value: 'Fresh content mentions LED skin-care device comparisons.',
            sourceUrl: 'https://news.example/1',
            sourcePlatform: 'rss',
            publishedAt: '2026-08-25T10:00:00.000Z',
            collectedAt: NOW,
            verificationStatus: 'CONFIRMED'
          },
          {
            id: 'ev_rss_2',
            claimType: 'RSS_ITEM',
            title: 'LED facial cleaner offer review',
            value: 'Another fresh review compares LED facial cleaner offers.',
            sourceUrl: 'https://news.example/2',
            sourcePlatform: 'rss',
            publishedAt: '2026-08-20T10:00:00.000Z',
            collectedAt: NOW,
            verificationStatus: 'CONFIRMED'
          }
        ]
      }
    }
  });

  const emerging = model.byType[SIGNAL_TYPES.EMERGING_SIGNAL] || [];
  assert.ok(emerging.length >= 1);
  assert.equal(model.quality.noMarketGrowthClaim, true);
  assert.doesNotMatch(JSON.stringify(emerging.map(item => item.statement)), /market is growing|growing demand|demand growth|sales growth/i);
  assert.match(JSON.stringify(emerging), /recently observed in this sample/i);
});

test('evidence rows are deduplicated before signal creation', () => {
  const rows = evidenceRowsFrom({
    evidenceRegistry: {
      evidence: [
        { id: 'ev_a', claimType: 'snippet', value: 'Clear delivery and return terms', sourceUrl: 'https://a.example' },
        { id: 'ev_b', claimType: 'snippet', value: 'Clear delivery and return terms', sourceUrl: 'https://a.example' }
      ]
    }
  });
  assert.equal(rows.length, 1);
  assert.equal(topicFor(rows[0]), 'delivery');
});

test('customer voice patterns are quantified from social and semantic evidence', () => {
  const model = buildMarketSignalEngine({
    now: NOW,
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_youtube_review_1',
          scope: 'CUSTOMER',
          claimType: 'YOUTUBE_SEARCH_RESULT',
          title: 'Blackhead remover review',
          value: 'Customers ask for visible results, safe use and real before after proof.',
          sourceUrl: 'https://youtube.com/watch?v=abc',
          sourcePlatform: 'youtube',
          publishedAt: '2026-08-25T10:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_exa_review_1',
          scope: 'CUSTOMER',
          claimType: 'EXA_SEARCH_RESULT',
          title: 'Buyer comparison guide',
          value: 'Buyers compare price, refund guarantee and verified reviews before ordering.',
          sourceUrl: 'https://example.com/guide',
          sourcePlatform: 'exa_search',
          publishedAt: '2026-08-20T10:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_jina_question_1',
          scope: 'CUSTOMER',
          claimType: 'JINA_SEARCH_RESULTS',
          title: 'Search questions',
          value: 'People ask whether the return policy is real and if the product is safe for sensitive skin.',
          sourceUrl: 'https://s.jina.ai/http%3A%2F%2Fexample.com',
          sourcePlatform: 'jina_search',
          observedAt: NOW,
          verificationStatus: 'CONFIRMED'
        }
      ]
    }
  });

  const voice = model.customerVoice;
  assert.equal(voice.version, 'customer-voice-v1');
  assert.equal(voice.quality.quantifiedFromEvidence, true);
  assert.equal(voice.quality.unsupportedPatterns, 0);
  assert.ok(voice.patternCount >= 4);
  assert.ok(voice.byType[SIGNAL_TYPES.OBJECTION].some(pattern => pattern.key === 'guarantee_or_return_risk'));
  assert.ok(voice.byType[SIGNAL_TYPES.BUYING_CRITERION].some(pattern => pattern.key === 'price_budget_clarity'));
  assert.ok(voice.byType[SIGNAL_TYPES.CUSTOMER_DESIRE].some(pattern => pattern.key === 'visible_result_fast'));
  assert.ok(voice.patterns.every(pattern => pattern.evidenceIds.length > 0));
  assert.match(voice.quality.limitations.join(' '), /must not be presented as full-market statistics/i);
  assert.doesNotMatch(JSON.stringify(voice), /market share|demand growth|sales growth/i);
});
