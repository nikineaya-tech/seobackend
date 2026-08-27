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

test('Exa search creates semantic discovery evidence when API key exists', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.EXA_API_KEY;
  process.env.EXA_API_KEY = 'test-exa-key';
  global.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://api.exa.ai/search');
    assert.equal(options.method, 'POST');
    assert.match(options.headers.Authorization, /^Bearer test-exa-key$/);
    const requestBody = JSON.parse(options.body);
    assert.equal(requestBody.query, 'blackhead remover Libya alternatives');
    assert.equal(requestBody.contents.highlights, true);
    return {
      ok: true,
      status: 200,
      url,
      text: async () => JSON.stringify({
        results: [
          {
            title: 'Best blackhead remover alternatives',
            url: 'https://example.com/blackhead-guide',
            publishedDate: '2026-08-20T00:00:00.000Z',
            highlights: ['Buyers compare suction levels, proof photos and return terms before choosing.']
          }
        ]
      })
    };
  };

  try {
    const result = await collectAgentReachMarketEvidence({
      query: 'blackhead remover',
      country: 'LY',
      exaSearches: ['blackhead remover Libya alternatives']
    });

    const item = result.evidenceRegistry.evidence[0];
    assert.equal(result.counts.exaSearches, 1);
    assert.equal(item.claimType, 'EXA_SEARCH_RESULT');
    assert.equal(item.sourcePlatform, 'exa_search');
    assert.equal(item.resultPlatform, 'web');
    assert.equal(item.scope, 'MARKET');
    assert.equal(item.publishedAt, '2026-08-20T00:00:00.000Z');
    assert.match(item.sourceUrl, /example\.com\/blackhead-guide/);
    assert.match(item.limitations.join(' '), /does not verify business claims/i);
    assert.doesNotMatch(JSON.stringify(result), /market leader|winning strategy|demand growth/i);
  } finally {
    global.fetch = originalFetch;
    if (originalKey == null) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = originalKey;
  }
});

test('Exa search records unavailable state when API key is missing', async () => {
  const originalKey = process.env.EXA_API_KEY;
  delete process.env.EXA_API_KEY;
  try {
    const result = await collectAgentReachMarketEvidence({
      query: 'blackhead remover',
      country: 'Libya',
      exaSearches: ['blackhead remover Libya alternatives']
    });

    assert.equal(result.counts.exaSearches, 1);
    assert.equal(result.evidenceRegistry.evidence.length, 0);
    assert.ok(result.unavailable.some(item => item.provider === 'exa' && item.reason === 'missing_api_key'));
  } finally {
    if (originalKey == null) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = originalKey;
  }
});

test('YouTube search creates dated customer evidence when API key exists', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = 'test-key';
  global.fetch = async url => ({
    ok: true,
    status: 200,
    url,
    text: async () => JSON.stringify({
      items: [
        {
          id: { videoId: 'abc123' },
          snippet: {
            publishedAt: '2026-08-24T10:00:00Z',
            title: 'Blackhead remover review',
            description: 'Customers compare proof, safe use and visible results.'
          }
        }
      ]
    })
  });

  try {
    const result = await collectAgentReachMarketEvidence({
      query: 'blackhead remover',
      country: 'Libya',
      youtubeSearches: ['blackhead remover review Libya']
    });

    const item = result.evidenceRegistry.evidence[0];
    assert.equal(result.counts.youtubeSearches, 1);
    assert.equal(item.claimType, 'YOUTUBE_SEARCH_RESULT');
    assert.equal(item.sourcePlatform, 'youtube');
    assert.equal(item.scope, 'CUSTOMER');
    assert.equal(item.publishedAt, '2026-08-24T10:00:00Z');
    assert.match(item.sourceUrl, /youtube\.com\/watch\?v=abc123/);
    assert.match(item.limitations.join(' '), /not representative market statistics/i);
    assert.doesNotMatch(JSON.stringify(result), /market leader|winning strategy|demand growth/i);
  } finally {
    global.fetch = originalFetch;
    if (originalKey == null) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = originalKey;
  }
});

test('YouTube search records unavailable state when API key is missing', async () => {
  const originalKey = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  try {
    const result = await collectAgentReachMarketEvidence({
      query: 'blackhead remover',
      country: 'Libya',
      youtubeSearches: ['blackhead remover review Libya']
    });

    assert.equal(result.counts.youtubeSearches, 1);
    assert.equal(result.evidenceRegistry.evidence.length, 0);
    assert.ok(result.unavailable.some(item => item.provider === 'youtube' && item.reason === 'missing_api_key'));
  } finally {
    if (originalKey == null) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = originalKey;
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
