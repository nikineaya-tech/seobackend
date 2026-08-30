'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SIGNAL_TYPES,
  SIGNAL_STATUS,
  buildMarketSignalEngine,
  buildSocialContentModel,
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

test('customer voice patterns are quantified from traceable social and review evidence', () => {
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
          claimType: 'CUSTOMER_REVIEW_SOURCE_CONTENT',
          title: 'Buyer comparison discussion',
          value: 'Buyers compare price, refund guarantee and verified reviews before ordering.',
          sourceUrl: 'https://reddit.com/r/skincare/comments/example',
          sourcePlatform: 'reddit',
          publishedAt: '2026-08-20T10:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_jina_question_1',
          scope: 'CUSTOMER',
          claimType: 'CUSTOMER_QUESTION',
          title: 'Search questions',
          value: 'People ask whether the return policy is real and if the product is safe for sensitive skin.',
          sourceUrl: 'https://facebook.com/groups/skincare/posts/example',
          sourcePlatform: 'facebook',
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

test('loose semantic search evidence stays market evidence until a real customer source is opened', () => {
  const model = buildMarketSignalEngine({
    now: NOW,
    query: 'مزيل رؤوس سوداء بتكبير 50× وإضاءة LED',
    country: 'Libya',
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_jina_noise_1',
          scope: 'MARKET',
          claimType: 'JINA_SEARCH_RESULTS',
          title: 'Jumia Maroc lanterne LED',
          value: 'Fast delivery and customer reviews for decorative lanterns in Morocco.',
          sourceUrl: 'https://s.jina.ai/http%3A%2F%2Fexample.com',
          sourcePlatform: 'jina_search',
          observedAt: NOW,
          verificationStatus: 'PARTIAL'
        },
        {
          id: 'ev_jina_relevant_1',
          scope: 'CUSTOMER',
          claimType: 'JINA_SEARCH_RESULTS',
          title: 'مزيل رؤوس سوداء في ليبيا',
          value: 'يسأل المشترون في ليبيا عن السعر والضمان ونتيجة مزيل رؤوس سوداء للبشرة الحساسة.',
          sourceUrl: 'https://s.jina.ai/http%3A%2F%2Flocal.example',
          sourcePlatform: 'jina_search',
          observedAt: NOW,
          verificationStatus: 'CONFIRMED'
        }
      ]
    }
  });

  const voiceJson = JSON.stringify(model.customerVoice);
  assert.doesNotMatch(voiceJson, /ev_jina_relevant_1/);
  assert.doesNotMatch(voiceJson, /ev_jina_noise_1/);
  assert.equal(model.customerVoice.patternCount, 0);
  assert.ok(model.signals.some(signal => signal.evidenceIds.includes('ev_jina_noise_1')));
  assert.ok(model.signals.some(signal => signal.evidenceIds.includes('ev_jina_relevant_1')));
});

test('offer intelligence patterns are quantified without inventing commercial terms', () => {
  const model = buildMarketSignalEngine({
    now: NOW,
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_offer_page_1',
          scope: 'COMPETITOR',
          claimType: 'WEB_PAGE_CONTENT',
          title: 'Product page',
          value: 'The product page mentions price, COD payment, delivery and return policy.',
          sourceUrl: 'https://shop.example/product',
          sourcePlatform: 'inspected_page',
          observedAt: NOW,
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_shopping_1',
          scope: 'OFFER',
          claimType: 'shopping_offer',
          title: 'Marketplace offer',
          value: 'Offer includes LED feature, USB charging and a bundle kit.',
          sourceUrl: 'https://market.example/item',
          sourcePlatform: 'shopping',
          observedAt: NOW,
          verificationStatus: 'CONFIRMED'
        }
      ]
    }
  });

  const offer = model.offerIntelligence;
  assert.equal(offer.version, 'offer-intelligence-v1');
  assert.equal(offer.quality.quantifiedFromEvidence, true);
  assert.equal(offer.quality.noInventedCommercialTerms, true);
  assert.equal(offer.quality.unsupportedPatterns, 0);
  assert.ok(offer.byAspect.pricing.some(pattern => pattern.key === 'pricing_visible'));
  assert.ok(offer.byAspect.payment.some(pattern => pattern.key === 'payment_or_cod'));
  assert.ok(offer.byAspect.fulfillment.some(pattern => pattern.key === 'delivery_or_stock'));
  assert.ok(offer.byAspect.feature_set.some(pattern => pattern.key === 'product_specs'));
  assert.ok(offer.patterns.every(pattern => pattern.evidenceIds.length > 0));
  assert.match(offer.quality.limitations.join(' '), /Exact price, stock, delivery speed/i);
  assert.doesNotMatch(JSON.stringify(offer), /confirmed market price|guaranteed 24h|market share/i);
});

test('social content intelligence quantifies content patterns without inventing engagement', () => {
  const model = buildMarketSignalEngine({
    now: NOW,
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_youtube_tutorial_1',
          scope: 'CONTENT',
          claimType: 'YOUTUBE_SEARCH_RESULT',
          title: 'Blackhead remover tutorial and review',
          value: 'A video tutorial shows safe usage, visible result proof and before after demo.',
          sourceUrl: 'https://youtube.com/watch?v=demo',
          sourcePlatform: 'youtube',
          publishedAt: '2026-08-24T10:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_rss_comparison_1',
          scope: 'CONTENT',
          claimType: 'RSS_ITEM',
          title: 'New comparison guide for facial cleaning devices',
          value: 'The article compares alternatives and lists buyer questions before purchase.',
          sourceUrl: 'https://publisher.example/guide',
          sourcePlatform: 'rss',
          publishedAt: '2026-08-22T10:00:00.000Z',
          verificationStatus: 'CONFIRMED'
        },
        {
          id: 'ev_instagram_offer_1',
          scope: 'SOCIAL',
          claimType: 'SOCIAL_POST',
          title: 'Promo post',
          value: 'Instagram post promotes the offer and comments ask about price, order and refund.',
          sourceUrl: 'https://instagram.com/p/demo',
          sourcePlatform: 'instagram',
          observedAt: NOW,
          verificationStatus: 'CONFIRMED'
        }
      ]
    }
  });

  const social = model.socialContent;
  assert.equal(social.version, 'social-content-intelligence-v1');
  assert.equal(social.quality.quantifiedFromEvidence, true);
  assert.equal(social.quality.noInventedEngagementClaims, true);
  assert.equal(social.quality.unsupportedPatterns, 0);
  assert.ok(social.patternCount >= 5);
  assert.ok(social.byFormat.review.some(pattern => pattern.evidenceIds.includes('ev_youtube_tutorial_1')));
  assert.ok(social.byFormat.tutorial.some(pattern => pattern.evidenceIds.includes('ev_youtube_tutorial_1')));
  assert.ok(social.byFormat.comparison.some(pattern => pattern.evidenceIds.includes('ev_rss_comparison_1')));
  assert.ok(social.byFormat.offer_post.some(pattern => pattern.evidenceIds.includes('ev_instagram_offer_1')));
  assert.ok(social.patterns.every(pattern => pattern.evidenceIds.length > 0));
  assert.match(social.quality.limitations.join(' '), /not audience size, engagement rate or campaign performance/i);
  assert.doesNotMatch(JSON.stringify(social), /viral hit|engagement rate\s*[:=]\s*\d|influencer roi|campaign performance proven/i);

  const direct = buildSocialContentModel([], new Date(NOW));
  assert.equal(direct.quality.noInventedEngagementClaims, true);
});
