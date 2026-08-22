'use strict';

const assert = require('node:assert/strict');
const { buildAngleDrivenStpModel } = require('../lib/stp-angle-engine');
const { sanitizeStpDecisionForClient } = require('../lib/stp-client-sanitizer');

function collectStrings(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string') out.push(node);
  else if (typeof node === 'number' || typeof node === 'boolean') out.push(String(node));
  else if (Array.isArray(node)) node.forEach(item => collectStrings(item, out));
  else if (typeof node === 'object') {
    Object.entries(node).forEach(([key, value]) => {
      if (['id', 'slug', 'type', 'angleType', 'role', 'rank', 'evidenceStatus', 'productFamily', 'source'].includes(key)) return;
      collectStrings(value, out);
    });
  }
  return out;
}

function buildCaseModel(sample) {
  return buildAngleDrivenStpModel({
    query: sample.query,
    geo: sample.geo,
    lang: sample.lang,
    budget: sample.budget,
    segments: [
      { id: 's-local', name: 'local demand', need: `besoin ${sample.query}`, buyingTriggers: ['local', 'prix', 'preuve'] },
      { id: 's-compare', name: 'comparison demand', need: `comparer ${sample.query}`, buyingTriggers: ['comparaison', 'garantie'] },
      { id: 's-proof', name: 'proof demand', need: `preuve ${sample.query}`, buyingTriggers: ['avis', 'demo'] }
    ],
    personaCards: [
      { id: 'p1', displayName: sample.lang === 'ar' ? 'سلمى المستعجلة' : 'Persona 1', summary: `veut ${sample.query} rapidement`, details: { buyingTriggers: ['local'], pains: ['delai flou'] } },
      { id: 'p2', displayName: sample.lang === 'ar' ? 'ليلى المقارنة' : 'Persona 2', summary: `compare ${sample.query} avant achat`, details: { buyingTriggers: ['comparaison'], pains: ['choix difficile'] } },
      { id: 'p3', displayName: sample.lang === 'ar' ? 'يوسف طالب الدليل' : 'Persona 3', summary: `cherche preuve pour ${sample.query}`, details: { buyingTriggers: ['preuve'], pains: ['peur de perdre argent'] } }
    ],
    competitorData: {
      keywordStrategy: {
        primary: [sample.query],
        longTail: [`meilleur ${sample.query}`, `${sample.query} prix`, `${sample.query} avis`]
      },
      marketInsights: { painPoint: 'prix, preuve, livraison et garantie pas assez clairs' },
      productServiceAudit: { missingProof: 'garantie, delai, preuve resultat et conditions a verifier' },
      top10Competitors: [
        { title: 'Competitor one', snippet: 'prix avis livraison garantie', domain: 'example.com' },
        { title: 'Competitor two', snippet: 'comparison and reviews', domain: 'example.net' }
      ]
    }
  });
}

const samples = [
  { name: 'arabic beauty Libya', query: 'extratecteur de الرؤوس السوداء', geo: 'Libya', lang: 'ar', budget: 'ميزانية صغيرة', mustContain: [/مزيل الرؤوس السوداء/, /ليبيا/] },
  { name: 'arabic solar Tunisia', query: 'projecteur solaire', geo: 'Tunisia', lang: 'ar', budget: 'ميزانية صغيرة', mustContain: [/كشاف شمسي/, /تونس/] },
  { name: 'arabic agency Morocco', query: 'AGENCE MARKETING IA', geo: 'Morocco', lang: 'ar', budget: 'petit budget', mustContain: [/وكالة تسويق بالذكاء الاصطناعي/, /المغرب/] },
  { name: 'french beauty Libya', query: 'extracteur points noirs', geo: 'Libya', lang: 'fr', budget: 'petit budget', mustContain: [/extracteur points noirs|points noirs/i] },
  { name: 'english saas Morocco', query: 'AI marketing agency', geo: 'Morocco', lang: 'en', budget: 'small test budget', mustContain: [/AI marketing agency/i] },
  {
    name: 'french ecommerce training Morocco',
    query: 'formation e-commerce en ligne',
    geo: 'Morocco',
    lang: 'fr',
    budget: 'petit budget',
    mustContain: [/formation e-commerce|e-commerce/i, /march[ée] local|Maroc|paiement|COD|fournisseur|WhatsApp|Instagram|YouTube|m[ée]thode/i],
    mustNot: [/zone de livraison|d[ée]lai de livraison|delivery area|delivery window|shipping|stock|Google Maps|\bMaps\b|local contact/i]
  },
  {
    name: 'arabic ecommerce training Morocco',
    query: 'formation e-commerce en ligne',
    geo: 'Morocco',
    lang: 'ar',
    budget: 'ميزانية صغيرة',
    mustContain: [/تكوين التجارة الإلكترونية/, /المغرب/, /الدفع|COD|مورد|واتساب|إنستغرام|منهج/],
    mustNot: [/formation e-commerce|e-commerce en ligne|Morocco|zone de livraison|delivery area|shipping|stock|خرائط|منطقة التوصيل|مدة التوصيل/i]
  }
];

const forbiddenVisible = /\bev_\d+\b|undefined|null|not available|غير متوفر|delivery area|response time|local contact|comparison table|verified reviews|verified customer reviews|warranty terms|visible delivery or result proof|clear offer proof|price or terms clarity|proof source or proof need|short evidence from input|win with local availability and faster response|make delivery or access concrete|show total cost and savings clearly|compare against the current alternatives/i;
const forbiddenArabic = /\b(get the|solve|fear of|price pressure|choice between|doubt that|active search|lower perceived|better value|faster access|proof-led|expert confidence|urgency relief|without unnecessary risk|current price|delivery area|response time|warranty terms|verified customer|projecteur solaire|agence marketing ia|extratecteur)\b/i;

const failures = [];

for (const sample of samples) {
  const model = sanitizeStpDecisionForClient(buildCaseModel(sample), sample.lang);
  const visibleObject = {
    productUnderstanding: model.productUnderstanding,
    personaCards: model.personaCards,
    marketingAngles: model.marketingAngles,
    ultimateAttackAngles: model.ultimateAttackAngles,
    problemsJtbdUseCases: model.problemsJtbdUseCases,
    actionPlan: model.actionPlan,
    decisionCards: model.decisionCards
  };
  const visibleText = collectStrings(visibleObject).join('\n');
  const caseFailures = [];
  if (forbiddenVisible.test(visibleText)) caseFailures.push(`forbidden placeholder: ${visibleText.match(forbiddenVisible)?.[0]}`);
  if (sample.lang === 'ar' && forbiddenArabic.test(visibleText)) caseFailures.push(`arabic residue: ${visibleText.match(forbiddenArabic)?.[0]}`);
  if (!Array.isArray(model.personaCards) || model.personaCards.length < 2) caseFailures.push('not enough persona cards');
  const uniqueAttacks = new Set((model.personaCards || []).map(card => card.attackAngle).filter(Boolean));
  if (uniqueAttacks.size < Math.min(2, model.personaCards?.length || 0)) caseFailures.push('persona attack angles collapsed');
  const weakSummaries = (model.personaCards || []).filter(card => /^(أريد|je veux\b|i want\b)/i.test(String(card.summary || '').trim()));
  if (weakSummaries.length) caseFailures.push('persona summaries still expose JTBD formula instead of human persona sentence');
  const uniqueJobs = new Set((model.personaCards || []).map(card => card.details?.wantStatement || card.details?.primaryJobToBeDone).filter(Boolean));
  if (uniqueJobs.size < Math.min(2, model.personaCards?.length || 0)) caseFailures.push('persona JTBD statements collapsed');
  for (const pattern of sample.mustContain || []) {
    if (!pattern.test(visibleText)) caseFailures.push(`missing expected localized signal: ${pattern}`);
  }
  for (const pattern of sample.mustNot || []) {
    if (pattern.test(visibleText)) caseFailures.push(`forbidden case-specific signal: ${visibleText.match(pattern)?.[0]}`);
  }
  if (caseFailures.length) failures.push({ sample: sample.name, failures: caseFailures });
}

if (failures.length) {
  console.error('[audit-stp-output] FAILED');
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

assert.equal(failures.length, 0);
console.log(`[audit-stp-output] OK — ${samples.length} STP visible-output samples clean`);
