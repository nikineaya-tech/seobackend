'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyAngleRelation,
  dedupeMarketingAngles,
  buildAngleDrivenStpModel,
  sanitizeEvidenceIds,
  dedupePersonas,
  mapPersonasToAngles,
  classifyProductSemantics
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

test('arabic beauty STP personas do not expose english placeholders or evidence ids', () => {
  const model = buildAngleDrivenStpModel({
    query: 'مزيل الرؤوس السوداء',
    geo: 'Libya',
    lang: 'ar',
    budget: 'ميزانية صغيرة',
    segments: [
      { id: 'urgent-local', name: 'طلب محلي سريع', need: 'الحصول على أداة عناية بالبشرة بسرعة', buyingTriggers: ['توصيل سريع', 'توفر محلي'] },
      { id: 'comparison', name: 'مقارن البدائل', need: 'اختيار أداة مناسبة دون ندم', buyingTriggers: ['مقارنة', 'سعر'] },
      { id: 'proof-seeker', name: 'طالب الدليل', need: 'رؤية نتيجة حقيقية قبل الشراء', buyingTriggers: ['دليل', 'آراء'] }
    ],
    personaCards: [
      { id: 'p1', displayName: 'سلمى المستعجلة', summary: 'تريد مزيل الرؤوس السوداء بتوصيل واضح داخل ليبيا', details: { buyingTriggers: ['توصيل سريع'], pains: ['غموض التوصيل'] } },
      { id: 'p2', displayName: 'ليلى الباحثة عن الدليل', summary: 'تقارن مزيل الرؤوس السوداء حسب السعر والضمان وطريقة الاستعمال', details: { buyingTriggers: ['مقارنة السعر'], pains: ['عدم وضوح الفرق بين البدائل'] } },
      { id: 'p3', displayName: 'يوسف طالب الثقة', summary: 'لا يشتري مزيل الرؤوس السوداء قبل رؤية آراء وتجربة واضحة', details: { buyingTriggers: ['آراء موثقة'], pains: ['الخوف من منتج غير مناسب'] } }
    ],
    competitorData: {
      keywordStrategy: {
        primary: ['مزيل الرؤوس السوداء', 'أداة إزالة الرؤوس السوداء'],
        longTail: ['أفضل مزيل للرؤوس السوداء في ليبيا', 'طريقة استعمال مزيل الرؤوس السوداء']
      },
      marketInsights: { painPoint: 'الناس تريد أداة عناية بالبشرة مع سعر وتوصيل وضمان واضح' },
      productServiceAudit: { missingProof: 'طريقة الاستعمال والضمان والتوصيل غير واضحة' },
      top10Competitors: [
        { title: 'Dukan DZ', snippet: 'أدوات عناية بالبشرة وأسعار مختلفة', domain: 'www.dukandz.com' },
        { title: 'Instagram Shop', snippet: 'عروض تجميل مع تواصل عبر الرسائل', domain: 'www.instagram.com' },
        { title: 'Shein', snippet: 'بدائل متعددة لأدوات البشرة', domain: 'jo.shein.com' }
      ]
    }
  });
  const visible = JSON.stringify({ personas: model.personaCards, angles: model.marketingAngles });
  assert.doesNotMatch(visible, /\bev_\d+\b/i);
  assert.doesNotMatch(visible, /delivery area|response time|local contact|comparison table|competitor differences|objective criteria|verified reviews|verified customer reviews|warranty terms|visible delivery or result proof|guarantee terms|visible result proof|current price|old price if true|total cost and conditions|before-after|case or customer proof|local SEO|win with local availability/i);
  assert.ok(model.personaCards.every(persona => /مزيل الرؤوس السوداء/.test(`${persona.summary} ${persona.attackAngle} ${persona.details.attackFormula}`)));
  assert.ok(model.personaCards.some(persona => /منطقة التوصيل|مدة التسليم|التواصل المحلي/.test(JSON.stringify(persona))));
  assert.ok(model.personaCards.some(persona => /جدول|مقارنة|البدائل/.test(JSON.stringify(persona))));
  assert.ok(model.personaCards.some(persona => /آراء|تجربة|قبل\/بعد|ضمان/.test(JSON.stringify(persona))));
  assert.ok(new Set(model.personaCards.map(persona => persona.attackAngle)).size >= 3);
});

test('beauty device personas stay product-specific across skin proof safety and alternatives', () => {
  const model = buildAngleDrivenStpModel({
    query: 'extracteur de points noirs',
    geo: 'Libya',
    lang: 'fr',
    budget: 'petit budget',
    segments: [
      { id: 'beauty-visible-result', name: 'Chercheurs de résultat visible', need: 'voir un avant apres reel sur peau', buyingTriggers: ['demo peau reelle', 'avant apres'] },
      { id: 'beauty-sensitive-skin-safety', name: 'Peaux sensibles', need: 'eviter irritation marques et mauvais niveau aspiration', buyingTriggers: ['peau sensible', 'hygiene', 'niveaux aspiration'] },
      { id: 'beauty-alternative-comparison', name: 'Comparateurs soins', need: 'comparer appareil patchs institut selon peau et budget', buyingTriggers: ['patchs', 'institut', 'budget'] },
      { id: 'beauty-whatsapp-order-trust', name: 'Commande WhatsApp', need: 'connaitre pack prix final delai retour avant commande', buyingTriggers: ['pack', 'prix final', 'retour'] }
    ],
    personaCards: [
      { id: 'p1', displayName: 'Salma resultat visible', summary: 'veut une demo sur peau reelle', details: { buyingTriggers: ['avant apres'], pains: ['preuve retouchee'] } },
      { id: 'p2', displayName: 'Leila peau sensible', summary: 'craint irritation et traces sur le visage', details: { buyingTriggers: ['peau sensible'], pains: ['irritation'] } },
      { id: 'p3', displayName: 'Mariam comparatrice soins', summary: 'compare appareil patchs et institut', details: { buyingTriggers: ['comparaison patch institut'], pains: ['choix au hasard'] } },
      { id: 'p4', displayName: 'Nadia commande WhatsApp', summary: 'veut prix pack delai et retour clairs', details: { buyingTriggers: ['prix final'], pains: ['conditions floues'] } }
    ],
    competitorData: {
      keywordStrategy: {
        primary: ['extracteur de points noirs', 'aspirateur points noirs'],
        longTail: ['extracteur points noirs peau sensible', 'meilleur appareil points noirs visage']
      },
      marketInsights: { painPoint: 'les acheteurs veulent voir le resultat sans risquer irritation ou arnaque avant apres' },
      productServiceAudit: { missingProof: 'demo peau reelle, niveaux aspiration, hygiene et retour a montrer' },
      top10Competitors: [
        { title: 'Beauty marketplace', snippet: 'appareil points noirs avec embouts et avis clients', domain: 'beauty.example' }
      ]
    }
  });
  const visible = JSON.stringify({ personas: model.personaCards, angles: model.marketingAngles, ultimate: model.ultimateAttackAngles });
  const personaOnly = JSON.stringify(model.personaCards);
  assert.match(visible, /peau|hygiene|hygiène|aspiration|embouts|patchs|institut|avant\/apres|avant\/après|routine|retour/i);
  assert.doesNotMatch(personaOnly, /solution localement et rapidement|besoin localement|zone servie|google maps|promesse plus claire et preuve plus rapide/i);
  assert.ok(model.marketingAngles[0].type !== 'local_speed');
  assert.ok(model.personaCards.every(persona => Array.isArray(persona.details?.categorySpecificProofs) && persona.details.categorySpecificProofs.length >= 3));
  assert.ok(model.personaCards.every(persona => Array.isArray(persona.details?.categoryDecisionCriteria) && persona.details.categoryDecisionCriteria.length >= 3));
  assert.ok(new Set(model.personaCards.map(persona => persona.attackAngle)).size >= 4);
});

test('arabic STP translates french product and market before visible persona formulas', () => {
  const model = buildAngleDrivenStpModel({
    query: 'projecteur solaire',
    geo: 'Tunisia',
    lang: 'ar',
    budget: 'ميزانية صغيرة',
    segments: [
      { id: 's1', name: 'besoin urgent', need: 'acheter projecteur solaire rapidement', buyingTriggers: ['local', 'prix'] },
      { id: 's2', name: 'comparateur', need: 'comparer projecteur solaire avant achat', buyingTriggers: ['comparaison', 'garantie'] }
    ],
    personaCards: [
      { id: 'p1', displayName: 'Persona 1', summary: 'veut projecteur solaire rapidement', details: { buyingTriggers: ['local'], pains: ['delai flou'] } },
      { id: 'p2', displayName: 'Persona 2', summary: 'compare projecteur solaire avant achat', details: { buyingTriggers: ['comparaison'], pains: ['choix difficile'] } },
      { id: 'p3', displayName: 'Persona 3', summary: 'cherche preuve pour projecteur solaire', details: { buyingTriggers: ['preuve'], pains: ['peur de perdre argent'] } }
    ],
    competitorData: {
      marketInsights: { painPoint: 'السعر والتوصيل والضمان غير واضحة' },
      productServiceAudit: { missingProof: 'الضمان والبطارية ومدة التوصيل تحتاج توضيحا' }
    }
  });
  const visible = JSON.stringify({ product: model.productUnderstanding, personas: model.personaCards, angles: model.marketingAngles, problems: model.problemsJtbdUseCases });
  assert.doesNotMatch(visible, /projecteur solaire|Tunisia|veut projecteur|compare projecteur|cherche preuve pour projecteur/i);
  assert.match(visible, /كشاف شمسي/);
  assert.match(visible, /تونس/);
  assert.ok(model.personaCards.every(persona => /كشاف شمسي/.test(`${persona.summary} ${persona.attackAngle} ${persona.details.attackFormula}`)));
});

test('french STP output does not expose english internal hooks', () => {
  const model = buildAngleDrivenStpModel({
    query: 'extracteur points noirs',
    geo: 'Libya',
    lang: 'fr',
    budget: 'petit budget',
    segments: [
      { id: 's1', name: 'Besoin local', need: 'acheter vite', buyingTriggers: ['local', 'prix'] },
      { id: 's2', name: 'Comparateur', need: 'comparer avant achat', buyingTriggers: ['comparaison', 'garantie'] }
    ],
    personaCards: [
      { id: 'p1', displayName: 'Persona 1', summary: 'veut recevoir vite', details: { buyingTriggers: ['local'], pains: ['delai flou'] } },
      { id: 'p2', displayName: 'Persona 2', summary: 'compare les alternatives', details: { buyingTriggers: ['comparaison'], pains: ['choix difficile'] } }
    ],
    competitorData: {
      marketInsights: { painPoint: 'prix, preuve, livraison et garantie pas assez clairs' },
      productServiceAudit: { missingProof: 'garantie, delai et preuve resultat a verifier' }
    }
  });
  const visible = JSON.stringify({ personas: model.personaCards, angles: model.marketingAngles });
  assert.doesNotMatch(visible, /win with local availability|make delivery or access concrete|show total cost and savings clearly|compare against the current alternatives|prove the result before asking/i);
  assert.match(visible, /disponibilite locale|reponse rapide|comparer avec les alternatives|prouver le resultat/i);
});

test('online ecommerce training blocks physical delivery local angle and keeps local market fit', () => {
  const semantics = classifyProductSemantics({
    query: 'formation e-commerce en ligne',
    geo: 'Morocco',
    segments: [
      { id: 'merchant', name: 'Commerçant physique', need: 'digitaliser une boutique au Maroc', buyingTriggers: ['WhatsApp', 'paiement local'] }
    ]
  });
  assert.equal(semantics.productType, 'education');
  assert.equal(semantics.deliveryMode, 'digital');
  assert.equal(semantics.requiresPhysicalShipping, false);
  assert.equal(semantics.physicalLocalDeliveryAllowed, false);
  assert.equal(semantics.localRelevanceAllowed, true);

  const model = buildAngleDrivenStpModel({
    query: 'formation e-commerce en ligne',
    geo: 'Morocco',
    lang: 'fr',
    budget: 'petit budget',
    segments: [
      { id: 'beginner', name: 'Débutant lancement business', need: 'savoir par où commencer sans outil compliqué', buyingTriggers: ['premier business', 'méthode'] },
      { id: 'merchant', name: 'Commerçant physique', need: 'passer boutique physique vers WhatsApp Instagram et site', buyingTriggers: ['paiement local', 'COD', 'fournisseurs'] },
      { id: 'skeptic', name: 'Prospect méfiant', need: 'éviter une formation trop générique', buyingTriggers: ['preuves', 'cas marocain'] }
    ],
    personaCards: [
      { id: 'p1', displayName: 'Noura premier business', occupation: 'Débutant qui veut lancer son premier business', summary: 'veut une méthode e-commerce pas à pas', details: { buyingTriggers: ['méthode pas à pas'], pains: ['ne sait pas par où commencer'] } },
      { id: 'p2', displayName: 'Karima commerçante physique', occupation: 'Commerçante physique qui veut vendre en ligne', summary: 'veut transformer sa boutique physique en canal digital au Maroc', details: { buyingTriggers: ['paiement local', 'WhatsApp', 'Instagram'], pains: ['contenu international peu adapté'] } },
      { id: 'p3', displayName: 'Leila sceptique', occupation: 'Prospect méfiant envers les formations', summary: 'veut des preuves avant de payer une formation e-commerce', details: { buyingTriggers: ['preuve', 'avis'], pains: ['promesses irréalistes'] } }
    ],
    competitorData: {
      keywordStrategy: {
        primary: ['formation e-commerce Maroc', 'apprendre e-commerce'],
        longTail: ['comment créer une boutique en ligne au Maroc', 'formation e-commerce paiement COD Maroc']
      },
      marketInsights: { painPoint: 'les prospects veulent une méthode adaptée au marché marocain et pas une théorie générique' },
      productServiceAudit: { missingProof: 'cas client marocain, paiement local, fournisseurs et WhatsApp à montrer' }
    }
  });
  const visible = JSON.stringify({ personas: model.personaCards, angles: model.marketingAngles, ultimate: model.ultimateAttackAngles });
  assert.doesNotMatch(visible, /zone de livraison|d[ée]lai de livraison|livraison disponible|served cities|delivery area|delivery window|shipping|stock|google maps|\bMaps\b|local contact/i);
  assert.match(visible, /march[ée] local|Maroc|paiement|COD|fournisseur|WhatsApp|Instagram|YouTube|méthode|pas-a-pas|pas à pas/i);
  assert.ok(model.marketingAngles.some(angle => angle.angleType === 'local_market_fit' || /march[ée] local|paiement|COD|fournisseur/i.test(`${angle.name} ${angle.proofToShow} ${angle.offerMove}`)));
  assert.ok(model.personaCards.every(persona => Number(persona.details?.repetitionScore || 0) <= 0.92));
  assert.ok(model.personaCards.every(persona => Array.isArray(persona.details?.buyingTriggers) && persona.details.buyingTriggers.length > 0));
});

test('arabic ecommerce training translates french product and rejects delivery-zone proof', () => {
  const model = buildAngleDrivenStpModel({
    query: 'formation e-commerce en ligne',
    geo: 'Morocco',
    lang: 'ar',
    budget: 'ميزانية صغيرة',
    segments: [
      { id: 'merchant', name: 'commercant physique', need: 'digitaliser boutique Maroc', buyingTriggers: ['paiement local', 'COD', 'WhatsApp'] },
      { id: 'beginner', name: 'debutant', need: 'lancer premier business e-commerce', buyingTriggers: ['méthode', 'pas à pas'] }
    ],
    personaCards: [
      { id: 'p1', displayName: 'كريمة صاحبة المتجر', occupation: 'تاجرة فعلية', summary: 'veut vendre en ligne au Maroc', details: { buyingTriggers: ['paiement local'], pains: ['formation trop générique'] } },
      { id: 'p2', displayName: 'نورة بداية المشروع', occupation: 'مبتدئة', summary: 'veut formation e-commerce pas à pas', details: { buyingTriggers: ['méthode'], pains: ['ne sait pas commencer'] } }
    ],
    competitorData: {
      marketInsights: { painPoint: 'الحاجة إلى تطبيق التجارة الإلكترونية على السوق المغربي' },
      productServiceAudit: { missingProof: 'حالات مغربية، دفع محلي، COD، موردون' }
    }
  });
  const visible = JSON.stringify({ personas: model.personaCards, angles: model.marketingAngles });
  assert.doesNotMatch(visible, /formation e-commerce|e-commerce en ligne|Morocco|zone de livraison|delivery area|shipping|stock|خرائط|منطقة التوصيل|مدة التوصيل/i);
  assert.match(visible, /تكوين التجارة الإلكترونية|المغرب|الدفع|COD|مورد|واتساب|إنستغرام|منهج/i);
  assert.ok(model.personaCards.every(persona => Array.isArray(persona.details?.buyingTriggers) && persona.details.buyingTriggers.length > 0));
});
