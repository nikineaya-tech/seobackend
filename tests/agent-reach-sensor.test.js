'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectAgentReachMarketEvidence,
  normalizeUrl,
  platformOf
} = require('../railway-scraper/agent-reach-sensor');
const {
  createEvidenceRegistry
} = require('../lib/competitor-evidence-engine');

test('normalizes Agent Reach URL evidence without producing strategy claims', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => ({
    ok: true,
    status: 200,
    url,
    text: async () => [
      'Title: Buyer review page',
      'Customers compare price, delivery clarity and verified reviews before buying.'
    ].join('\n')
  });

  try {
    const result = await collectAgentReachMarketEvidence({
      query: 'blackhead remover',
      country: 'Libya',
      urls: ['https://youtube.com/watch?v=abc123']
    });

    assert.equal(result.kind, 'market-sensor');
    assert.equal(result.provider, 'agent-reach-railway-adapter');
    assert.equal(result.evidenceRegistry.evidence.length, 1);
    assert.equal(result.evidenceRegistry.evidence[0].sourcePlatform, 'youtube');
    assert.equal(result.evidenceRegistry.evidence[0].scope, 'CUSTOMER');
    assert.equal(result.evidenceRegistry.evidence[0].verificationStatus, 'CONFIRMED');
    assert.ok(result.evidenceRegistry.evidence[0].collectedAt);
    assert.doesNotMatch(JSON.stringify(result), /leader|dominates|market share|strategy to win/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('RSS entries become dated market evidence, not market-growth proof', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://example.com/feed.xml',
    text: async () => `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>New comparison guide</title>
          <link>https://example.com/guide</link>
          <pubDate>Tue, 25 Aug 2026 10:00:00 GMT</pubDate>
          <description>Comparison of offers and buyer objections.</description>
        </item>
      </channel></rss>`
  });

  try {
    const result = await collectAgentReachMarketEvidence({
      query: 'formation e-commerce',
      country: 'Morocco',
      feeds: ['https://example.com/feed.xml']
    });

    const item = result.evidenceRegistry.evidence[0];
    assert.equal(item.claimType, 'RSS_ITEM');
    assert.equal(item.sourcePlatform, 'rss');
    assert.equal(item.scope, 'MARKET');
    assert.equal(item.publishedAt, 'Tue, 25 Aug 2026 10:00:00 GMT');
    assert.match(item.limitations.join(' '), /not proof of market growth/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Jina searches become market evidence, not strategy claims', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => ({
    ok: true,
    status: 200,
    url,
    text: async () => [
      'Title: Search results',
      'Result: buyers compare return policy, proof and price before ordering.'
    ].join('\n')
  });

  try {
    const result = await collectAgentReachMarketEvidence({
      query: 'blackhead remover',
      country: 'Libya',
      searches: ['blackhead remover Libya reviews']
    });

    assert.equal(result.counts.searches, 1);
    assert.equal(result.evidenceRegistry.evidence.length, 1);
    assert.equal(result.evidenceRegistry.evidence[0].claimType, 'JINA_SEARCH_RESULTS');
    assert.equal(result.evidenceRegistry.evidence[0].sourcePlatform, 'jina_search');
    assert.equal(result.evidenceRegistry.evidence[0].scope, 'MARKET');
    assert.doesNotMatch(JSON.stringify(result), /winning strategy|market leader|dominates/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Agent Reach evidence can be merged into the common competitor evidence registry', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => ({
    ok: true,
    status: 200,
    url,
    text: async () => 'Title: Competitor FAQ\nReturn policy, guarantee and proof language found on page.'
  });

  try {
    const agentReachEvidence = await collectAgentReachMarketEvidence({
      query: 'portable blender',
      country: 'MA',
      urls: ['example.com/faq']
    });
    const registry = createEvidenceRegistry({
      competitors: [{ domain: 'example.com', url: 'https://example.com/faq', title: 'Example FAQ' }],
      agentReachEvidence
    });

    assert.ok(registry.evidence.some(item => item.id.startsWith('ev_agent_reach_')));
    assert.ok(registry.evidence.some(item => item.sourceType === 'web'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('URL and platform helpers keep the sensor bounded and explicit', () => {
  assert.equal(normalizeUrl('example.com/page'), 'https://example.com/page');
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(platformOf('https://www.instagram.com/brand'), 'instagram');
  assert.equal(platformOf('https://example.com/page'), 'web');
});
