'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mergeDuplicateSegments,
  buildTargeting,
  buildPositioningObjects,
  validateRealStpDecision
} = require('../lib/stp-real-engine');

test('real STP rejects angle labels used as fake segments', () => {
  const { segments, rejected } = mergeDuplicateSegments([
    { id: 'trust', name: 'Trust seeker', need: 'needs proof', buyingTriggers: ['proof'] },
    { id: 'budget', name: 'Budget buyer', need: 'wants better value', buyingTriggers: ['price'] },
    {
      id: 'merchant-online',
      name: 'Physical merchant moving online in Morocco',
      need: 'turn existing store products into a digital sales channel',
      accessChannels: ['Facebook', 'Instagram', 'WhatsApp'],
      buyingTriggers: ['competitors sell online', 'needs COD and supplier logic'],
      evidence: ['SERP merchant questions', 'local payment/COD need']
    }
  ]);

  assert.equal(segments.length, 1);
  assert.equal(segments[0].id, 'merchant-online');
  assert.ok(rejected.some(item => item.reason === 'ANGLE_LABEL_USED_AS_SEGMENT'));
});

test('real STP remains complete before persona generation', () => {
  const { segments } = mergeDuplicateSegments([
    {
      id: 'local-purchase-intent',
      name: 'Local purchase intent for vape in Biougra',
      need: 'find a locally reachable offer with clear price and ordering terms',
      accessChannels: ['Google Search', 'WhatsApp'],
      buyingTriggers: ['nearby seller', 'price clarity', 'availability'],
      evidence: ['SERP leader one', 'local query modifier']
    },
    {
      id: 'assortment-fit-buyers',
      name: 'Buyers needing the right vape variant',
      need: 'choose the right flavor or device variant without guessing',
      accessChannels: ['SERP', 'WhatsApp'],
      buyingTriggers: ['variant choice', 'seller answer'],
      evidence: ['competitor snippets mention variants']
    }
  ]);
  const targets = buildTargeting(segments, {
    budget: 'petit budget',
    competitorData: {
      top10Competitors: [{ domain: 'example.ma' }, { domain: 'shop.ma' }],
      observedUrls: ['https://example.ma', 'https://shop.ma']
    }
  });
  const positions = buildPositioningObjects(targets.filter(t => t.targetSelected), {
    query: 'vente de vapeur de cigarette a biougra',
    geo: 'Morocco',
    competitorData: { top10Competitors: [{ domain: 'example.ma' }] },
    lang: 'fr'
  });
  const gateWithoutPersonas = validateRealStpDecision({
    segmentation: { validatedSegments: segments },
    targeting: { targets },
    positioning: positions,
    personaCards: [],
    activations: []
  });

  assert.ok(targets.some(target => target.targetStatus === 'PRIMARY_TARGET'));
  assert.ok(positions.length >= 1);
  assert.equal(gateWithoutPersonas.valid, true);
});

test('personas must inherit segment target and positioning ids before activation', () => {
  const segments = [{
    id: 'first-business',
    name: 'Beginner launching first business',
    need: 'learn e-commerce step by step',
    validation: { valid: true, basis: ['market_context', 'need_jtbd', 'reachability'] },
    accessChannels: ['SEO', 'YouTube'],
    targetSelected: true,
    targetStatus: 'PRIMARY_TARGET',
    targetScores: { total: 82 }
  }];
  const positions = buildPositioningObjects(segments, {
    query: 'formation e-commerce en ligne',
    geo: 'Morocco',
    competitorData: {},
    lang: 'fr'
  });
  const gate = validateRealStpDecision({
    segmentation: { validatedSegments: segments },
    targeting: { targets: segments },
    positioning: positions,
    personaCards: [{
      id: 'persona-1',
      segmentId: segments[0].id,
      targetStatus: segments[0].targetStatus,
      positioningId: positions[0].id
    }],
    activations: [{
      personaId: 'persona-1',
      segmentId: segments[0].id,
      positioningId: positions[0].id,
      primaryAngleId: 'angle-method',
      personaAngleFit: 71
    }]
  });

  assert.equal(gate.valid, true);
});
