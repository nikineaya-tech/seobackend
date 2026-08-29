'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildMarketDiscoveryPlan,
  buildQueryVariants
} = require('../lib/market-intelligence/source-router');

test('source router plans acquisition routes without creating claims', () => {
  const plan = buildMarketDiscoveryPlan({
    query: 'formation e-commerce en ligne',
    country: 'Morocco',
    lang: 'fr',
    agentReachEnabled: true,
    hasExaApiKey: true,
    hasYoutubeApiKey: true,
    competitors: [
      { url: 'https://competitor.example/course', domain: 'competitor.example' }
    ],
    rssFeeds: ['https://news.example/feed.xml']
  });

  assert.equal(plan.version, 'market-source-router-v1');
  assert.equal(plan.quality.acquisitionOnly, true);
  assert.equal(plan.quality.routesProduceNoClaims, true);
  assert.ok(plan.routes.some(route => route.provider === 'agent-reach-railway' && route.status === 'ACTIVE'));
  assert.ok(plan.routes.some(route => route.provider === 'exa' && route.status === 'AVAILABLE'));
  assert.ok(plan.railwayPayload.urls.includes('https://competitor.example/course'));
  assert.ok(plan.railwayPayload.searches.some(item => /formation e-commerce/i.test(item)));
  assert.ok(plan.railwayPayload.exaSearches.some(item => /formation e-commerce/i.test(item)));
  assert.ok(plan.railwayPayload.youtubeSearches.some(item => /formation e-commerce/i.test(item)));
  assert.ok(plan.railwayPayload.feeds.includes('https://news.example/feed.xml'));
  assert.doesNotMatch(JSON.stringify(plan), /market leader|dominance|growth proven/i);
});

test('query variants include local review comparison and supplier discovery paths', () => {
  const variants = buildQueryVariants({
    query: 'extracteur points noirs',
    country: 'Libya',
    lang: 'fr'
  });

  assert.ok(variants.includes('extracteur points noirs Libye'));
  assert.ok(variants.some(item => /reviews|avis/i.test(item)));
  assert.ok(variants.some(item => /comparison|comparatif/i.test(item)));
  assert.ok(variants.some(item => /supplier wholesale/i.test(item)));
});

test('source router compacts long product descriptions before Agent Reach searches', () => {
  const variants = buildQueryVariants({
    query: 'مزيل رؤوس سوداء بتكبير 50× وإضاءة LED، مع 3 مستويات شفط تناسب مختلف أنواع البشرة و3 رؤوس سيليكون ناعمة. مزود بالضوء الأزرق، شاشة للبطارية والشفط، وشحن USB.',
    country: 'Libya',
    lang: 'ar'
  });

  assert.ok(variants[0].length < 80);
  assert.match(variants[0], /مزيل رؤوس سوداء/);
  assert.match(variants[0], /ليبيا/);
  assert.doesNotMatch(variants.join(' '), /Libya/);
  assert.doesNotMatch(variants.join(' '), /مزود بالضوء الأزرق، شاشة للبطارية/);
});
