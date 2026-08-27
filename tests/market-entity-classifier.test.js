'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ENTITY_TYPES,
  GEO_STATUS,
  classifyMarketEntity,
  buildMarketEntityMap
} = require('../lib/market-intelligence/entity-classifier');

test('confirmed local commercial result can become direct competitor', () => {
  const entity = classifyMarketEntity({
    sourceType: 'directCompetitor',
    title: 'Local skin care seller',
    url: 'https://seller.ly/product',
    snippet: 'Buy blackhead remover with local return terms',
    geoTier: 'LOCAL_CONFIRMED',
    geoConfirmed: true
  }, {
    evidenceRegistry: {
      evidence: [{ id: 'ev_1', sourceUrl: 'https://seller.ly/product', value: 'SERP result' }]
    }
  });

  assert.equal(entity.type, ENTITY_TYPES.DIRECT_COMPETITOR);
  assert.equal(entity.geoStatus, GEO_STATUS.LOCAL_CONFIRMED);
  assert.ok(entity.evidenceIds.includes('ev_1'));
});

test('probable local seller is not promoted to confirmed direct competitor', () => {
  const entity = classifyMarketEntity({
    sourceType: 'directCompetitor',
    title: 'Probable shop',
    url: 'https://shop.example/product',
    snippet: 'Product page with price',
    geoTier: 'LOCAL_PROBABLE',
    geoConfirmed: false
  });

  assert.equal(entity.type, ENTITY_TYPES.LOCAL_SELLER);
  assert.equal(entity.geoStatus, GEO_STATUS.LOCAL_PROBABLE);
  assert.match(entity.limitations.join(' '), /probable or unconfirmed/i);
});

test('marketplaces and substitutes are separated from competitors', () => {
  const map = buildMarketEntityMap({
    marketProductSources: {
      groups: {
        marketplaceProduct: [{
          title: 'Blackhead remover on marketplace',
          url: 'https://www.amazon.com/product/123',
          sourceType: 'marketplaceProduct',
          geoTier: 'FOREIGN_BENCHMARK'
        }],
        youtubeVideo: [{
          title: 'How to use a blackhead remover safely',
          url: 'https://www.youtube.com/watch?v=abc',
          sourceType: 'youtubeVideo',
          snippet: 'Tutorial and review'
        }]
      }
    },
    evidenceRegistry: {
      evidence: [
        { id: 'ev_amazon', sourceUrl: 'https://www.amazon.com/product/123', value: 'Shopping result' },
        { id: 'ev_youtube', sourceUrl: 'https://www.youtube.com/watch?v=abc', value: 'Review page' }
      ]
    }
  });

  assert.equal(map.counts[ENTITY_TYPES.MARKETPLACE], 1);
  assert.equal(map.counts[ENTITY_TYPES.SUBSTITUTE], 1);
  assert.equal(map.counts[ENTITY_TYPES.DIRECT_COMPETITOR], 0);
});

test('supplier intelligence remains unknown without traceable supplier evidence', () => {
  const map = buildMarketEntityMap({
    marketProductSources: {
      groups: {
        supplierSource: [{
          title: 'Wholesale manufacturer',
          url: 'https://supplier.example/item',
          sourceType: 'supplierSource',
          snippet: 'Factory wholesale product'
        }]
      }
    },
    evidenceRegistry: { evidence: [] }
  });

  assert.equal(map.counts[ENTITY_TYPES.SUPPLIER], 1);
  assert.equal(map.supplierIntelligence.status, 'UNKNOWN');
  assert.match(map.supplierIntelligence.limitations.join(' '), /dedicated sourcing source/i);
});

test('supplier intelligence is partial only when supplier candidate is traceable', () => {
  const map = buildMarketEntityMap({
    marketProductSources: {
      groups: {
        supplierSource: [{
          title: 'Alibaba manufacturer',
          url: 'https://www.alibaba.com/product-detail/example',
          sourceType: 'supplierSource',
          snippet: 'OEM factory and wholesale listing'
        }]
      }
    },
    evidenceRegistry: {
      evidence: [{ id: 'ev_supplier', sourceUrl: 'https://www.alibaba.com/product-detail/example', value: 'Supplier page observed' }]
    }
  });

  assert.equal(map.counts[ENTITY_TYPES.SUPPLIER], 1);
  assert.equal(map.supplierIntelligence.status, 'PARTIAL');
  assert.equal(map.supplierIntelligence.confidence, 'MEDIUM');
  assert.ok(map.supplierIntelligence.suppliers[0].evidenceIds.includes('ev_supplier'));
});

test('agent reach exa supplier evidence becomes supplier candidate without confirmed sourcing claims', () => {
  const map = buildMarketEntityMap({
    evidenceRegistry: {
      evidence: [{
        id: 'ev_agent_reach_exa_supplier',
        sourcePlatform: 'exa_search',
        claimType: 'EXA_SEARCH_RESULT',
        sourceUrl: 'https://www.alibaba.com/product-detail/example',
        title: 'OEM wholesale blackhead remover factory',
        query: 'blackhead remover supplier wholesale',
        value: 'OEM factory wholesale listing for blackhead remover devices.',
        confidence: 'MEDIUM'
      }]
    }
  });

  assert.equal(map.counts[ENTITY_TYPES.SUPPLIER], 1);
  assert.equal(map.supplierIntelligence.status, 'PARTIAL');
  assert.match(map.supplierIntelligence.limitations.join(' '), /MOQ, FOB, lead time or OEM claims/i);
  assert.ok(map.supplierIntelligence.suppliers[0].evidenceIds.includes('ev_agent_reach_exa_supplier'));
});

test('agent reach exa content evidence is not promoted to a direct competitor', () => {
  const map = buildMarketEntityMap({
    evidenceRegistry: {
      evidence: [{
        id: 'ev_agent_reach_exa_guide',
        sourcePlatform: 'exa_search',
        resultPlatform: 'web',
        claimType: 'EXA_SEARCH_RESULT',
        sourceUrl: 'https://example.com/blackhead-remover-comparison',
        title: 'How buyers compare blackhead remover devices',
        query: 'blackhead remover comparison Libya',
        value: 'Guide comparing suction levels, reviews and return terms.',
        confidence: 'MEDIUM'
      }]
    }
  });

  assert.equal(map.counts[ENTITY_TYPES.SUBSTITUTE], 1);
  assert.equal(map.counts[ENTITY_TYPES.DIRECT_COMPETITOR], 0);
  assert.equal(map.counts[ENTITY_TYPES.LOCAL_SELLER], 0);
});
