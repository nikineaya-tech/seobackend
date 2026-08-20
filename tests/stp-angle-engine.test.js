'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyAngleRelation,
  dedupeMarketingAngles,
  buildAngleDrivenStpModel,
  sanitizeEvidenceIds,
  dedupePersonas,
  mapPersonasToAngles
} = require('../lib/stp-angle-engine');

test('dedupes paraphrased savings angles', () => {
  const result = dedupeMarketingAngles([
    { id: 'a1', type: 'savings_budget', name: 'Budget and value', problem: 'lower total cost' },
    { id: 'a2', type: 'savings_budget', name: 'Price saving angle', problem: 'reduce total cost' }
  ]);
  assert.equal(result.angles.length, 1);
  assert.equal(result.rejected.length, 1);
});

test('keeps security and outage/autonomy angles distinct', () => {
  const relation = classifyAngleRelation(
    { type: 'security_trust', name: 'Trust and guarantee', problem: 'buyer risk' },
    { type: 'offgrid_autonomy', name: 'Off-grid autonomy', problem: 'power outage usage' }
  );
  assert.equal(relation, 'distinct_angle');
});

test('rejects structurally duplicate personas', () => {
  const base = {
    id: 'p1',
    angleType: 'security_trust',
    summary: 'needs proof before buying',
    details: {
      primaryJobToBeDone: 'needs proof before buying',
      buyingBehavior: 'buys after guarantee',
      searchBehavior: 'searches reviews',
      pains: ['unclear guarantee'],
      buyingTriggers: ['proof']
    }
  };
  const result = dedupePersonas([
    base,
    { ...base, id: 'p2', summary: 'needs reviews and proof before buying' }
  ]);
  assert.equal(result.personas.length, 1);
  assert.equal(result.rejected.length, 1);
});

test('keeps solar security villa and rural off-grid personas distinct', () => {
  const result = dedupePersonas([
    {
      id: 'villa',
      angleType: 'security_trust',
      summary: 'villa owner needs reliable outdoor security lighting',
      details: {
        primaryJobToBeDone: 'secure villa entrance at night',
        buyingBehavior: 'buys after seeing reliability proof',
        searchBehavior: 'searches outdoor security light',
        pains: ['theft anxiety'],
        buyingTriggers: ['security']
      }
    },
    {
      id: 'rural',
      angleType: 'offgrid_autonomy',
      summary: 'rural home needs light during power cuts',
      details: {
        primaryJobToBeDone: 'get light without grid electricity',
        buyingBehavior: 'buys after autonomy proof',
        searchBehavior: 'searches solar projector off grid',
        pains: ['power cuts'],
        buyingTriggers: ['autonomy']
      }
    }
  ]);
  assert.equal(result.personas.length, 2);
});

test('invalid evidence ids are removed', () => {
  const result = sanitizeEvidenceIds(['ev_1', 'fake', 'ev_2'], [{ id: 'ev_1' }, { id: 'ev_2' }]);
  assert.deepEqual(result.ids, ['ev_1', 'ev_2']);
  assert.deepEqual(result.removed, ['fake']);
});

test('persona angle mapping supports multiple angles without duplicating persona', () => {
  const mapped = mapPersonasToAngles([
    { id: 'p1', summary: 'compares price, guarantee and proof', details: {} }
  ], [
    { id: 'angle-savings_budget', type: 'savings_budget', name: 'Budget', score: 80 },
    { id: 'angle-security_trust', type: 'security_trust', name: 'Trust', score: 78 }
  ]);
  assert.equal(mapped.length, 1);
  assert.ok(mapped[0].primaryAngle);
  assert.ok(mapped[0].angleMappings.length >= 2);
});

test('solar projector market produces distinct useful angles', () => {
  const model = buildAngleDrivenStpModel({
    query: 'projecteur solaire Libya',
    geo: 'Libya',
    lang: 'fr',
    budget: 'petit budget test',
    segments: [
      { id: 'security', name: 'Villa security', need: 'secure outdoor areas', buyingTriggers: ['security', 'night light'] },
      { id: 'rural', name: 'Rural autonomy', need: 'lighting during power cuts', buyingTriggers: ['solar autonomy'] },
      { id: 'setup', name: 'Easy setup', need: 'simple installation', buyingTriggers: ['installation facile'] }
    ],
    personaCards: [
      { id: 'p1', displayName: 'Persona 1', summary: 'needs outdoor security proof', details: { buyingTriggers: ['security'], pains: ['risk'] } },
      { id: 'p2', displayName: 'Persona 2', summary: 'needs off grid lighting during power cuts', details: { buyingTriggers: ['autonomy'], pains: ['power cuts'] } },
      { id: 'p3', displayName: 'Persona 3', summary: 'needs simple installation and clear setup', details: { buyingTriggers: ['installation'], pains: ['complex setup'] } }
    ],
    competitorData: {
      keywordStrategy: { primary: ['projecteur solaire', 'eclairage solaire exterieur'], longTail: ['meilleur projecteur solaire avec telecommande'] },
      marketInsights: { painPoint: 'power cuts and security at night' },
      productServiceAudit: { weakestProductFeature: 'guarantee unclear and installation proof missing' },
      top10Competitors: [{ title: 'Solar light shop', snippet: 'solar outdoor projector with guarantee' }]
    }
  });
  const types = model.marketingAngles.map(a => a.type);
  assert.ok(types.includes('security_trust'));
  assert.ok(types.includes('offgrid_autonomy'));
  assert.ok(types.includes('installation_ease'));
  assert.ok(model.personaCards.every(p => p.primaryAngle && p.attackAngle));
});
