const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMarketSignalEngine } = require('../lib/market-intelligence/signal-engine');
const {
  buildInsightDiscoveryEngine,
  isGenericAdvice
} = require('../lib/market-intelligence/insights/insight-engine');

const NOW = '2026-08-28T10:00:00.000Z';

function evidenceRegistry(evidence) {
  return { evidence };
}

function entityMap({ local = 0, global = 0 } = {}) {
  const direct = Array.from({ length: local }, (_, index) => ({
    id: `local_${index + 1}`,
    type: 'DIRECT_COMPETITOR',
    domain: `seller${index + 1}.ly`,
    url: `https://seller${index + 1}.ly/product`,
    evidenceIds: [`ev_local_${index + 1}`],
    confidence: 'MEDIUM'
  }));
  const regional = Array.from({ length: global }, (_, index) => ({
    id: `global_${index + 1}`,
    type: 'REGIONAL_BENCHMARK',
    domain: `benchmark${index + 1}.com`,
    url: `https://benchmark${index + 1}.com/product`,
    evidenceIds: [`ev_global_${index + 1}`],
    confidence: 'MEDIUM'
  }));
  return {
    byType: {
      DIRECT_COMPETITOR: direct,
      REGIONAL_BENCHMARK: regional
    },
    supplierIntelligence: { status: 'UNKNOWN', limitations: ['No supplier evidence.'] }
  };
}

function buildModels(evidence, map = entityMap()) {
  const registry = evidenceRegistry(evidence);
  const marketSignalModel = buildMarketSignalEngine({
    now: NOW,
    evidenceRegistry: registry
  });
  return {
    registry,
    marketSignalModel,
    insightModel: buildInsightDiscoveryEngine({
      evidenceRegistry: registry,
      marketSignalModel,
      marketEntityMap: map,
      country: 'Libya',
      query: 'blackhead remover'
    })
  };
}

test('fact alone is not promoted to a top insight', () => {
  const { insightModel } = buildModels([
    {
      id: 'ev_price_only',
      scope: 'OFFER',
      claimType: 'price',
      value: 'The observed offer price is 219 LYD.',
      sourceUrl: 'https://seller1.ly/product',
      sourcePlatform: 'inspected_page',
      verificationStatus: 'CONFIRMED',
      observedAt: NOW
    }
  ], entityMap({ local: 1 }));

  assert.equal(insightModel.topInsights.length, 0);
  assert.equal(insightModel.quality.factIsNotInsight, true);
});

test('customer offer gap crosses safety complaints with weak safety coverage', () => {
  const safetyRows = Array.from({ length: 15 }, (_, index) => ({
    id: `ev_safety_${index + 1}`,
    scope: 'CUSTOMER',
    claimType: 'review',
    value: `Buyer asks if the device is safe for sensitive skin and avoids irritation ${index + 1}.`,
    sourceUrl: `https://youtube.com/watch?v=safety${index + 1}`,
    sourcePlatform: index % 2 ? 'youtube' : 'reddit',
    verificationStatus: 'CONFIRMED',
    publishedAt: '2026-08-20T10:00:00.000Z'
  }));
  const offerRows = [
    {
      id: 'ev_offer_safe_1',
      scope: 'COMPETITOR',
      claimType: 'web_page_content',
      value: 'Seller explains safe use for sensitive skin.',
      sourceUrl: 'https://seller1.ly/product',
      sourcePlatform: 'inspected_page',
      verificationStatus: 'CONFIRMED'
    },
    {
      id: 'ev_offer_safe_2',
      scope: 'COMPETITOR',
      claimType: 'web_page_content',
      value: 'Seller includes usage guidance for skin type.',
      sourceUrl: 'https://seller2.ly/product',
      sourcePlatform: 'inspected_page',
      verificationStatus: 'CONFIRMED'
    }
  ];
  const { insightModel } = buildModels([...safetyRows, ...offerRows], entityMap({ local: 10 }));
  const gap = insightModel.topInsights.find(item => item.type === 'CUSTOMER_OFFER_GAP');

  assert.ok(gap);
  assert.match(gap.relationship, /Customer concern \+ low offer coverage/i);
  assert.ok(gap.evidenceIds.some(id => id.startsWith('ev_safety_')));
  assert.ok(gap.evidenceIds.includes('ev_offer_safe_1'));
  assert.ok(insightModel.insightTrace[gap.id].sources.length >= 2);
});

test('saturation detects common LED feature without calling it market dominance', () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({
    id: `ev_led_${index + 1}`,
    scope: 'COMPETITOR',
    claimType: 'offer',
    value: 'Offer mentions LED light and USB charging in the product feature list.',
    sourceUrl: `https://seller${index + 1}.ly/product`,
    sourcePlatform: 'inspected_page',
    verificationStatus: 'CONFIRMED',
    observedAt: NOW
  }));
  const { insightModel } = buildModels(rows, entityMap({ local: 10 }));
  const saturation = insightModel.insights.find(item => item.type === 'SATURATION' && /LED/i.test(item.title));

  assert.ok(saturation);
  assert.match(saturation.relationship, /weak standalone differentiation/i);
  assert.doesNotMatch(JSON.stringify(saturation), /dominance|market leader/i);
});

test('local global asymmetry detects underused local proof pattern', () => {
  const globalProof = Array.from({ length: 8 }, (_, index) => ({
    id: `ev_global_demo_${index + 1}`,
    scope: 'CONTENT',
    claimType: 'review',
    value: 'Tutorial review shows before after demo and visible proof.',
    sourceUrl: `https://benchmark${index + 1}.com/review`,
    sourcePlatform: index % 2 ? 'youtube' : 'rss',
    verificationStatus: 'CONFIRMED',
    publishedAt: '2026-08-22T10:00:00.000Z'
  }));
  const localStatic = Array.from({ length: 5 }, (_, index) => ({
    id: `ev_local_static_${index + 1}`,
    scope: 'COMPETITOR',
    claimType: 'offer',
    value: 'Static product description and feature list.',
    sourceUrl: `https://seller${index + 1}.ly/product`,
    sourcePlatform: 'inspected_page',
    verificationStatus: 'CONFIRMED',
    observedAt: NOW
  }));
  const { insightModel } = buildModels([...globalProof, ...localStatic], entityMap({ local: 5, global: 8 }));
  const asymmetry = insightModel.insights.find(item => item.type === 'LOCAL_GLOBAL_ASYMMETRY');

  assert.ok(asymmetry);
  assert.match(asymmetry.relationship, /local adoption gap/i);
  assert.match(asymmetry.limitations.join(' '), /candidate/i);
});

test('insufficient sample prevents high confidence market insight', () => {
  const { insightModel } = buildModels([
    {
      id: 'ev_one_customer',
      scope: 'CUSTOMER',
      claimType: 'review',
      value: 'One buyer asks if it is safe.',
      sourceUrl: 'https://youtube.com/watch?v=one',
      sourcePlatform: 'youtube',
      verificationStatus: 'CONFIRMED'
    },
    {
      id: 'ev_one_seller',
      scope: 'COMPETITOR',
      claimType: 'offer',
      value: 'One seller mentions strong suction.',
      sourceUrl: 'https://seller1.ly/product',
      sourcePlatform: 'inspected_page',
      verificationStatus: 'CONFIRMED'
    }
  ], entityMap({ local: 1 }));

  assert.equal(insightModel.coverageGate.canCreateHighConfidence, false);
  assert.equal(insightModel.topInsights.some(item => item.confidence === 'HIGH'), false);
});

test('generic advice is rejected as an insight candidate', () => {
  assert.equal(isGenericAdvice('Use social media to increase awareness.'), true);
  assert.equal(isGenericAdvice('Safety concern + power messaging creates a positioning contradiction.'), false);
});

test('same topic across platforms scores higher confidence than one-source repetition', () => {
  const multi = buildModels([
    ...['youtube', 'reddit', 'reviews', 'inspected_page'].map((platform, index) => ({
      id: `ev_multi_${index + 1}`,
      scope: index === 3 ? 'COMPETITOR' : 'CUSTOMER',
      claimType: index === 3 ? 'offer' : 'review',
      value: index === 3 ? 'Seller emphasizes strong suction power.' : 'Customer worries about safe use and skin irritation.',
      sourceUrl: `https://${platform}.example/item${index + 1}`,
      sourcePlatform: platform,
      verificationStatus: 'CONFIRMED'
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `ev_power_${index + 1}`,
      scope: 'COMPETITOR',
      claimType: 'offer',
      value: 'Seller emphasizes strong suction and suction levels.',
      sourceUrl: `https://seller${index + 1}.ly/product`,
      sourcePlatform: 'inspected_page',
      verificationStatus: 'CONFIRMED'
    }))
  ], entityMap({ local: 4 })).insightModel;
  const single = buildModels([
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `ev_single_${index + 1}`,
      scope: 'CUSTOMER',
      claimType: 'review',
      value: 'Customer worries about safe use and skin irritation.',
      sourceUrl: `https://youtube.example/watch${index + 1}`,
      sourcePlatform: 'youtube',
      verificationStatus: 'CONFIRMED'
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `ev_single_power_${index + 1}`,
      scope: 'COMPETITOR',
      claimType: 'offer',
      value: 'Seller emphasizes strong suction and suction levels.',
      sourceUrl: `https://seller${index + 1}.ly/product`,
      sourcePlatform: 'inspected_page',
      verificationStatus: 'CONFIRMED'
    }))
  ], entityMap({ local: 4 })).insightModel;

  assert.ok(multi.coverageGate.sourceDiversity > single.coverageGate.sourceDiversity);
  assert.ok((multi.topInsights[0]?.score || 0) >= (single.topInsights[0]?.score || 0));
});

test('supplier opportunity is not created without verified supplier evidence', () => {
  const { insightModel } = buildModels([
    {
      id: 'ev_supplier_unverified',
      scope: 'SUPPLIER',
      claimType: 'supplier_search',
      value: 'A search result mentions wholesale supplier, but MOQ and OEM are not verified.',
      sourceUrl: 'https://supplier.example',
      sourcePlatform: 'exa_search',
      verificationStatus: 'NOT_VERIFIED'
    }
  ], entityMap({ local: 4 }));

  assert.equal(insightModel.insights.some(item => /SUPPLIER/i.test(item.type)), false);
  assert.equal(insightModel.quality.supplierClaimsRequireDedicatedEvidence, true);
});

test('fresh content can support emerging sample signals but never demand growth wording', () => {
  const { insightModel, marketSignalModel } = buildModels([
    {
      id: 'ev_recent_1',
      scope: 'CONTENT',
      claimType: 'RSS_ITEM',
      title: 'New review guide',
      value: 'Recent article compares blackhead remover safety proof.',
      sourceUrl: 'https://publisher.example/1',
      sourcePlatform: 'rss',
      publishedAt: '2026-08-27T10:00:00.000Z',
      verificationStatus: 'CONFIRMED'
    },
    {
      id: 'ev_recent_2',
      scope: 'CONTENT',
      claimType: 'RSS_ITEM',
      title: 'New tutorial',
      value: 'Recent tutorial compares blackhead remover safety proof.',
      sourceUrl: 'https://publisher.example/2',
      sourcePlatform: 'rss',
      publishedAt: '2026-08-26T10:00:00.000Z',
      verificationStatus: 'CONFIRMED'
    }
  ], entityMap({ local: 3 }));

  assert.equal(marketSignalModel.quality.noMarketGrowthClaim, true);
  assert.equal(insightModel.quality.noDemandGrowthClaim, true);
  assert.doesNotMatch(JSON.stringify(insightModel), /demand growth|market growth|sales growth/i);
});
