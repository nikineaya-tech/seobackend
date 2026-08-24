'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  auditMarketingResponse,
  runMarketingMasterGate,
  isWeakVisibleText,
  pruneWeakVisibleText
} = require('../lib/marketing-master-auditor');

test('approves a concrete competitor response with observed competitors', () => {
  const audit = auditMarketingResponse('competitors', {
    success: true,
    competitors: [
      { name: 'Alpha', url: 'https://alpha.example', positioning: 'Prix clair et preuve visible' },
      { name: 'Beta', url: 'https://beta.example', positioning: 'Catalogue plus large' }
    ],
    swot: { opportunities: ['Attaquer le SEO local avec une preuve prix'] }
  }, { lang: 'fr', query: 'projecteur solaire', geo: 'Morocco' });

  assert.equal(audit.approved, true);
  assert.equal(audit.status, 'approved');
});

test('blocks empty competitor output before it reaches the interface', () => {
  const audit = auditMarketingResponse('competitors', {
    success: true,
    competitors: []
  }, { lang: 'fr' });

  assert.equal(audit.needsCorrection, true);
  assert.equal(audit.issues.some(issue => issue.code === 'NO_COMPETITORS'), true);
});

test('blocks repeated STP personas and internal attack formula leaks', () => {
  const payload = {
    success: true,
    personaCards: [
      {
        displayName: 'Persona 1',
        summary: 'Quand je cherche formation e-commerce en Maroc je veux un angle clair pas generique.',
        attackAngle: "Formule d’attaque: Persona + tension immediate + promesse specifique + preuve visible"
      },
      {
        displayName: 'Persona 2',
        summary: 'Quand je cherche formation e-commerce en Maroc je veux un angle clair pas generique.',
        attackAngle: "Formule d’attaque: Persona + tension immediate + promesse specifique + preuve visible"
      }
    ]
  };

  const audit = auditMarketingResponse('stp', payload, { lang: 'fr', query: 'formation e-commerce en ligne' });

  assert.equal(audit.needsCorrection, true);
  assert.equal(audit.issues.some(issue => issue.code === 'INTERNAL_PROMPT_LEAK'), true);
});

test('blocks physical shipping evidence when STP product is digital education', () => {
  const audit = auditMarketingResponse('stp', {
    success: true,
    inputs: { query: 'formation e-commerce en ligne' },
    productUnderstanding: { productType: 'DIGITAL_EDUCATION', deliveryMode: 'online' },
    personaCards: [
      {
        displayName: 'Amina',
        ageRange: '24-38',
        summary: 'Veut apprendre le e-commerce au Maroc',
        attackAngle: 'Prouver une zone de livraison et un delai de livraison rapide avec Google Maps.'
      }
    ]
  }, { lang: 'fr', query: 'formation e-commerce en ligne' });

  assert.equal(audit.needsCorrection, true);
  assert.equal(audit.issues.some(issue => issue.code === 'PRODUCT_ANGLE_MISMATCH'), true);
});

test('repairs weak placeholders when deterministic pruning is enough', async () => {
  assert.equal(isWeakVisibleText('ev_1'), true);
  const pruned = pruneWeakVisibleText({ success: true, keywords: [{ keyword: 'projecteur solaire', proof: 'ev_1' }] });
  assert.deepEqual(pruned, { success: true, keywords: [{ keyword: 'projecteur solaire' }] });

  const { payload } = await runMarketingMasterGate('keywords', {
    success: true,
    keywords: [{ keyword: 'projecteur solaire', proof: 'ev_1', note: 'Non disponible' }]
  }, { lang: 'fr' });

  assert.equal(payload.success, true);
  assert.equal(payload.marketingMaster.status, 'repaired');
  assert.equal(payload.keywords[0].proof, undefined);
  assert.equal(payload.keywords[0].note, undefined);
});
