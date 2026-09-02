'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCampaignAnalysisHandler,
  summarizeCampaigns,
  productEconomics,
  decideCampaign,
  decideCampaignRows
} = require('../lib/campaign-analysis-engine');

test('summarizes Meta-style campaign rows without trusting browser totals', () => {
  const result = summarizeCampaigns([
    { 'Campaign name': 'Winner', 'Amount spent': '100', Impressions: '10,000', 'Link clicks': '200', Purchases: '10', 'Purchase conversion value': '300' },
    { 'Campaign name': 'Loser', 'Amount spent': '50', Impressions: '5,000', 'Link clicks': '25', Purchases: '0', 'Purchase conversion value': '0' }
  ]);
  assert.equal(result.metrics.spend, 150);
  assert.equal(result.metrics.revenue, 300);
  assert.equal(result.metrics.roas, 2);
  assert.equal(result.metrics.ctr, 1.5);
  assert.equal(result.underperformers[0].name, 'Loser');
});

test('stops a campaign materially below its product break-even point', () => {
  const summary = summarizeCampaigns([{ Campaign: 'Bad test', Spend: 100, Impressions: 10000, Clicks: 100, Purchases: 1, Revenue: 40 }]);
  const economics = productEconomics({ price: 100, cogs: 30, shipping: 10, fees: 5, returnRate: 10 });
  const decision = decideCampaign(summary, economics);
  assert.equal(decision.verdict, 'STOP_OR_REBUILD');
  assert.equal(decision.confidence, 'HIGH');
});

test('returns one deterministic decision per imported campaign', () => {
  const summary = summarizeCampaigns([
    { Campaign: 'Scale candidate', Spend: 120, Impressions: 12000, Clicks: 240, Purchases: 8, Revenue: 800 },
    { Campaign: 'Stop candidate', Spend: 180, Impressions: 11000, Clicks: 150, Purchases: 1, Revenue: 100 }
  ]);
  const economics = productEconomics({ price: 100, cogs: 30, shipping: 10, fees: 5, returnRate: 0 });
  const decisions = decideCampaignRows(summary, economics);
  assert.equal(decisions.length, 2);
  assert.equal(decisions[0].name, 'Scale candidate');
  assert.equal(decisions[0].decision.verdict, 'CONTINUE_AND_SCALE');
  assert.equal(decisions[1].name, 'Stop candidate');
  assert.equal(decisions[1].decision.verdict, 'STOP_OR_REBUILD');
});

test('handler exposes frontend-ready decision payload', async () => {
  const handler = createCampaignAnalysisHandler({
    callOpenRouterAPI: async () => ({ success: false })
  });
  let statusCode = 200;
  let body = null;
  await handler({
    body: {
      language: 'fr',
      platform: 'meta',
      product: { price: 100, cogs: 30, shipping: 10, fees: 5 },
      campaigns: [{ Campaign: 'One', Spend: 100, Impressions: 10000, Clicks: 200, Purchases: 7, Revenue: 700 }]
    }
  }, {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    }
  });
  assert.equal(statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.decision.verdict, 'CONTINUE_AND_SCALE');
  assert.equal(body.campaignDecisions[0].name, 'One');
  assert.ok(Array.isArray(body.topCampaigns));
  assert.ok(Array.isArray(body.underperformers));
});
