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
  assert.equal(relation, 'DISTINCT');
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
  assert.ok(Number.isFinite(mapped[0].angleMappings[0].relevanceScore));
  assert.ok(['high', 'medium', 'low'].includes(mapped[0].angleMappings[0].priority));
  assert.ok(mapped[0].angleMappings[0].message);
});

test('persona angle mapping distributes primary angles across distinct personas', () => {
  const mapped = mapPersonasToAngles([
    { id: 'urgent', summary: 'ready buyer wants fast ordering and clear CTA', details: { buyingTriggers: ['fast order'] } },
    { id: 'proof', summary: 'trust seeker needs guarantee reviews and proof', details: { buyingTriggers: ['proof'], objections: ['unclear guarantee'] } },
    { id: 'budget', summary: 'comparison shopper compares price and terms', details: { buyingTriggers: ['price'], objections: ['expensive'] } }
  ], [
    { id: 'angle-fast_action', type: 'fast_action', name: 'Fast action', promise: 'order quickly', score: 86 },
    { id: 'angle-security_trust', type: 'security_trust', name: 'Trust', promise: 'proof and guarantee', score: 84 },
    { id: 'angle-savings_budget', type: 'savings_budget', name: 'Budget', promise: 'price and terms clarity', score: 82 }
  ]);
  const primaryIds = mapped.map(persona => persona.primaryAngle?.id).filter(Boolean);
  assert.equal(new Set(primaryIds).size, 3);
});

test('marketing angle exposes canonical business fields', () => {
  const model = buildAngleDrivenStpModel({
    query: 'projecteur solaire exterieur',
    geo: 'Morocco',
    lang: 'fr',
    segments: [],
    personaCards: [{ id: 'p1', displayName: 'Persona 1', summary: 'wants safe outdoor lighting', details: { buyingTriggers: ['security'] } }],
    competitorData: { marketInsights: { painPoint: 'security at night' } }
  });
  const angle = model.marketingAngles[0];
  assert.ok(angle.id);
  assert.ok(angle.name);
  assert.ok(angle.slug);
  assert.ok(angle.coreProblem);
  assert.ok(angle.context);
  assert.ok(angle.trigger);
  assert.ok(angle.desiredOutcome);
  assert.ok(angle.primaryBenefit);
  assert.ok(angle.angleFormula);
  assert.ok(angle.corePromise);
  assert.ok(angle.proofToShow);
  assert.ok(angle.objectionToNeutralize);
  assert.ok(angle.offerMove);
  assert.ok(angle.channelFit);
  assert.ok(angle.landingPageSection);
  assert.ok(angle.hookExamples.length >= 2);
  assert.ok(angle.antiHallucinationChecks.length >= 3);
  assert.ok(angle.angleType);
  assert.ok(Number.isFinite(angle.opportunityScore));
  assert.ok(model.productUnderstanding);
  assert.ok(model.problemsJtbdUseCases.length > 0);
  assert.ok(model.ultimateAttackAngles.length > 0);
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
  assert.ok(new Set(model.personaCards.map(p => p.primaryAngle?.id).filter(Boolean)).size >= 3);
  assert.ok(new Set(model.personaCards.map(p => p.attackAngle).filter(Boolean)).size >= 3);
  assert.ok(model.personaCards.every(p => p.details.attackFormula && p.details.proofToShow && p.details.objectionToNeutralize));
  assert.ok(model.personaCards.some(p => /autonomie|إضاءة|light|grid/i.test(`${p.attackAngle} ${p.details.attackFormula}`)));
  assert.ok(model.personaCards.some(p => /install|تركيب|montage/i.test(`${p.attackAngle} ${p.details.attackFormula}`)));
  assert.ok(model.personaCards.some(p => /garantie|مخاطرة|risk|preuve|proof/i.test(`${p.attackAngle} ${p.details.attackFormula}`)));
  assert.ok(model.marketingAngles.length >= 5);
  assert.ok(model.observability.some(line => line.includes('candidates=')));
});

test('arabic STP formulas stay concrete for translated solar product', () => {
  const model = buildAngleDrivenStpModel({
    query: 'كشاف شمسي',
    geo: 'Tunisia',
    lang: 'ar',
    budget: 'ميزانية صغيرة',
    segments: [
      { id: 'urgent', name: 'صاحب منزل', need: 'إضاءة المدخل ليلا', buyingTriggers: ['الأمان'] },
      { id: 'rural', name: 'منزل خارج المدينة', need: 'إضاءة بدون كهرباء', buyingTriggers: ['استقلالية'] }
    ],
    personaCards: [
      { id: 'p1', displayName: 'Persona 1', summary: 'يريد أمانا للمدخل ليلا', details: { pains: ['الخوف من الظلام'], buyingTriggers: ['الأمان'] } },
      { id: 'p2', displayName: 'Persona 2', summary: 'يريد إضاءة عند انقطاع الكهرباء', details: { pains: ['انقطاع الكهرباء'], buyingTriggers: ['استقلالية'] } }
    ],
    competitorData: {
      marketInsights: { painPoint: 'الأمان ليلا وانقطاع الكهرباء' },
      productServiceAudit: { missingProof: 'الضمان والبطارية غير واضحين' }
    }
  });
  assert.ok(model.marketingAngles.every(angle => angle.angleFormula.includes('كشاف شمسي') || angle.context.includes('كشاف شمسي')));
  assert.ok(model.personaCards.every(persona => /كشاف شمسي|إضاءة|الكهرباء|الأمان/.test(`${persona.summary} ${persona.attackAngle} ${persona.details.attackFormula}`)));
  assert.ok(new Set(model.personaCards.map(persona => persona.attackAngle)).size >= 2);
});

test('persona display details remove nulls evidence ids and filler placeholders', () => {
  const model = buildAngleDrivenStpModel({
    query: 'projecteur solaire',
    geo: 'Tunisia',
    lang: 'fr',
    segments: [{ id: 'weak', name: 'Weak segment', need: 'proof', buyingTriggers: ['evidence'] }],
    personaCards: [{
      id: 'p1',
      displayName: 'Persona 1',
      summary: 'proof',
      attackAngle: 'clear offer proof',
      details: {
        primaryJobToBeDone: 'proof',
        proofNeeded: ['clear offer proof', 'price or terms clarity', 'ev_1', null, 'not available'],
        trustSources: ['ev_1', 'evidence', 'غير متوفر'],
        pains: ['result'],
        objections: ['n/a'],
        constraints: ['undefined'],
        socialPlan: { platforms: ['Experiment'], contentAngles: ['hook', 'clear offer proof'] }
      }
    }],
    competitorData: {
      marketInsights: { painPoint: 'projecteur solaire pour securite de nuit' },
      productServiceAudit: { missingProof: 'garantie et autonomie a verifier' },
      top10Competitors: [{ title: 'Projecteur solaire Tunisie', snippet: 'projecteur solaire avec batterie et garantie' }]
    }
  });
  const visible = JSON.stringify(model.personaCards);
  assert.doesNotMatch(visible, /\bev_\d+\b/i);
  assert.doesNotMatch(visible, /clear offer proof|price or terms clarity|not available|غير متوفر|undefined|null/i);
  assert.ok(model.personaCards.every(persona => persona.qualityScore >= 20));
  assert.ok(model.personaCards.every(persona => persona.details.proofNeeded.length > 0));
});
