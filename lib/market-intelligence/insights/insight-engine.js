const { SIGNAL_TYPES, SIGNAL_STATUS, evidenceRowsFrom } = require('../signal-engine');

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanText(value, max = 900) {
  return String(value == null ? '' : value)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalize(value) {
  return cleanText(value, 1400)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s:/.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(value) {
  let h = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

function hostOf(value = '') {
  try {
    return new URL(String(value).startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return cleanText(value, 120).replace(/^www\./i, '').toLowerCase();
  }
}

function uniq(values = [], limit = 20) {
  const seen = new Set();
  const out = [];
  asArray(values).forEach(value => {
    const text = cleanText(value, 900);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  });
  return out.slice(0, limit);
}

function rowsForEvidenceIds(rows = [], ids = []) {
  const wanted = new Set(asArray(ids));
  return rows.filter(row => wanted.has(row.id));
}

function patternRows(rows = [], pattern) {
  return rows.filter(row => pattern.test(normalize(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`)));
}

function entityCounts(marketEntityMap = {}) {
  const byType = marketEntityMap.byType || {};
  const localSellers = [
    ...asArray(byType.DIRECT_COMPETITOR),
    ...asArray(byType.LOCAL_SELLER)
  ];
  const regional = [
    ...asArray(byType.REGIONAL_BENCHMARK),
    ...asArray(byType.MARKETPLACE)
  ];
  const globalLike = [
    ...regional,
    ...asArray(byType.SUBSTITUTE)
  ];
  return {
    localSellers,
    regional,
    globalLike,
    sellerCount: localSellers.length,
    globalCount: globalLike.length
  };
}

function sourceDiversity(rows = []) {
  return new Set(rows.map(row => row.sourcePlatform || hostOf(row.sourceUrl) || row.id).filter(Boolean)).size;
}

function evidenceIds(rows = [], limit = 16) {
  return uniq(rows.map(row => row.id), limit);
}

function sourceUrls(rows = [], limit = 10) {
  return uniq(rows.map(row => row.sourceUrl), limit);
}

function signalIdsForTypes(marketSignalModel = {}, types = [], topics = []) {
  const wantedTypes = new Set(types);
  const wantedTopics = topics.map(normalize).filter(Boolean);
  return asArray(marketSignalModel.signals)
    .filter(signal => wantedTypes.has(signal.type))
    .filter(signal => !wantedTopics.length || wantedTopics.some(topic => normalize(signal.topic).includes(topic) || normalize(signal.statement).includes(topic)))
    .map(signal => signal.id)
    .filter(Boolean)
    .slice(0, 10);
}

function confidenceFor(parts = {}) {
  const rows = asArray(parts.rows);
  const platforms = sourceDiversity(rows);
  const evidenceCount = rows.length;
  if (evidenceCount >= 8 && platforms >= 3) return 'HIGH';
  if (evidenceCount >= 4 && platforms >= 2) return 'MEDIUM';
  return 'LOW';
}

function scoreInsight({ evidence = [], crossSourceCount = 2, relationStrength = 1, specificity = 1, confidence = 'LOW' } = {}) {
  const confidenceScore = { HIGH: 28, MEDIUM: 18, LOW: 8 }[confidence] || 8;
  const evidenceScore = Math.min(24, asArray(evidence).length * 3);
  const crossScore = Math.min(20, Math.max(0, crossSourceCount - 1) * 8);
  const relationScore = Math.min(18, Math.round(relationStrength * 18));
  const specificityScore = Math.min(10, Math.round(specificity * 10));
  return Math.max(1, Math.min(100, confidenceScore + evidenceScore + crossScore + relationScore + specificityScore));
}

const GENERIC_ADVICE_PATTERNS = [
  /^use social media to increase awareness\.?$/i,
  /^improve seo\.?$/i,
  /^add testimonials\.?$/i,
  /^differentiate your offer\.?$/i,
  /^offer good customer service\.?$/i,
  /^competitive pricing\.?$/i,
  /^expand locally\.?$/i
];

function isGenericAdvice(value = '') {
  const text = cleanText(value, 300).toLowerCase();
  return GENERIC_ADVICE_PATTERNS.some(pattern => pattern.test(text));
}

function makeInsight(input = {}) {
  const rows = uniq(input.rows || [], 40);
  const evidence = asArray(input.evidenceRows);
  const confidence = input.confidence || confidenceFor({ rows: evidence });
  const insight = {
    id: input.id || `insight_${hash(`${input.type}|${input.title}|${evidenceIds(evidence).join('|')}`)}`,
    type: cleanText(input.type, 80),
    status: input.status || SIGNAL_STATUS.INFERRED,
    title: cleanText(input.title, 180),
    finding: cleanText(input.finding, 520),
    relationship: cleanText(input.relationship, 520),
    interpretation: cleanText(input.interpretation, 620),
    decisionTest: cleanText(input.decisionTest, 420),
    confidence,
    score: scoreInsight({
      evidence,
      crossSourceCount: sourceDiversity(evidence),
      relationStrength: input.relationStrength || 1,
      specificity: input.specificity || 1,
      confidence
    }),
    signalIds: uniq(input.signalIds, 12),
    evidenceIds: evidenceIds(evidence, 18),
    sourceUrls: sourceUrls(evidence, 12),
    sourcePlatforms: uniq(evidence.map(row => row.sourcePlatform), 8),
    components: input.components || {},
    limitations: uniq([
      'Insight is inferred from relationships inside the collected evidence sample; it is not a full-market statistic.',
      ...asArray(input.limitations)
    ], 6)
  };
  const combined = `${insight.title} ${insight.finding} ${insight.interpretation} ${insight.decisionTest}`;
  if (!insight.type || !insight.evidenceIds.length || isGenericAdvice(combined)) return null;
  return insight;
}

function detectCustomerOfferGaps(ctx) {
  const rows = ctx.evidenceRows;
  const customerRows = rows.filter(row => /customer|review|comment|youtube|reddit|facebook|instagram|tiktok/i.test(`${row.scope} ${row.claimType} ${row.sourcePlatform}`));
  const offerRows = rows.filter(row => !/customer|review|comment/i.test(`${row.scope} ${row.claimType}`));
  const customerSafety = patternRows(customerRows, /safe|safety|irritat|sensitive|side effect|danger|امن|آمن|حساس|تهيج|ضرر|خطر/);
  const offerSafety = patternRows(offerRows, /safe use|usage guidance|progressive|skin type|sensitive skin|mode doux|gentle|استخدام آمن|طريقة آمنة|بشرة حساسة/);
  const sellerCount = Math.max(1, ctx.counts.sellerCount || 0);
  if (customerSafety.length < 3 || offerSafety.length > Math.max(2, Math.ceil(sellerCount * 0.35))) return [];
  const evidence = [...customerSafety.slice(0, 8), ...offerSafety.slice(0, 4)];
  return [makeInsight({
    type: 'CUSTOMER_OFFER_GAP',
    title: 'Safety concern is stronger than visible safety guidance',
    finding: `${customerSafety.length} collected customer/content observations mention safety, irritation, sensitivity or misuse risk, while only ${offerSafety.length} observed offer records visibly address safe usage.`,
    relationship: 'Customer concern + low offer coverage = proof/content gap.',
    interpretation: 'The market may be competing on product presence while leaving safety reassurance under-explained.',
    decisionTest: 'Test a safety/control landing block and creative against the current feature-led message.',
    evidenceRows: evidence,
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.CUSTOMER_PAIN, SIGNAL_TYPES.BUYING_CRITERION, SIGNAL_TYPES.OFFER_PATTERN], ['safe', 'safety', 'sensitive']),
    relationStrength: sellerCount >= 5 ? 0.9 : 0.72,
    components: {
      customerNeedCount: customerSafety.length,
      offerCoverageCount: offerSafety.length,
      observedSellerCount: ctx.counts.sellerCount
    },
    limitations: ctx.counts.sellerCount < 3 ? ['Seller sample is small; treat as a candidate gap, not a proven category gap.'] : []
  })].filter(Boolean);
}

function detectCustomerCompetitorContradictions(ctx) {
  const rows = ctx.evidenceRows;
  const concern = patternRows(rows, /safe|safety|irritat|sensitive|bruise|pain|hurt|danger|حساس|تهيج|ضرر|خطر|ألم/);
  const powerLed = patternRows(rows, /powerful suction|strong suction|maximum suction|5 levels|قوة شفط|شفط قوي|مستويات شفط|شفط/);
  if (concern.length < 3 || powerLed.length < 3) return [];
  const evidence = [...concern.slice(0, 7), ...powerLed.slice(0, 7)];
  return [makeInsight({
    type: 'CUSTOMER_COMPETITOR_CONTRADICTION',
    title: 'The category speaks power while customers signal control risk',
    finding: `${concern.length} observations point to safety/control concern, while ${powerLed.length} observed seller/content records emphasize suction power or levels.`,
    relationship: 'Customer fear + competitor power messaging = positioning contradiction.',
    interpretation: 'More power may be a weak primary promise if buyers first need confidence that use is controlled and safe.',
    decisionTest: 'Run a safety-first message against a power-first message before scaling spend.',
    evidenceRows: evidence,
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.CUSTOMER_PAIN, SIGNAL_TYPES.FEATURE_PATTERN, SIGNAL_TYPES.MESSAGE_PATTERN], ['suction', 'safe', 'safety']),
    relationStrength: 0.86,
    components: {
      customerConcernCount: concern.length,
      powerMessageCount: powerLed.length
    }
  })].filter(Boolean);
}

function detectSaturation(ctx) {
  const rows = ctx.evidenceRows;
  const featureSets = [
    { key: 'led', label: 'LED', pattern: /led|eclairage|light|اضاءة|إضاءة|ضوء/ },
    { key: 'usb', label: 'USB charging', pattern: /usb|charge|charging|battery|batterie|بطارية|شحن/ },
    { key: 'suction_levels', label: 'Suction levels', pattern: /suction level|levels|niveau|mode|مستويات شفط|شفط/ },
    { key: 'free_delivery', label: 'Free delivery', pattern: /free delivery|livraison gratuite|توصيل مجاني|شحن مجاني/ }
  ];
  const sellerCount = ctx.counts.sellerCount || 0;
  if (sellerCount < 3 && rows.length < 6) return [];
  return featureSets.map(feature => {
    const matches = patternRows(rows, feature.pattern);
    const hosts = new Set(matches.map(row => hostOf(row.sourceUrl || row.entityId)).filter(Boolean));
    const coverage = sellerCount ? hosts.size / sellerCount : 0;
    if (matches.length < 4 || (sellerCount >= 3 && coverage < 0.55)) return null;
    return makeInsight({
      type: 'SATURATION',
      title: `${feature.label} looks commoditized in the observed sample`,
      finding: `${feature.label} appears in ${matches.length} evidence rows across ${hosts.size || 'multiple'} observed sources.`,
      relationship: 'High offer/message frequency = weak standalone differentiation.',
      interpretation: `${feature.label} may still be useful, but it should support a stronger promise rather than act as the primary angle.`,
      decisionTest: `Keep ${feature.label} as proof, then test a sharper promise around safety, proof, speed, local fit or risk removal.`,
      evidenceRows: matches.slice(0, 10),
      signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.FEATURE_PATTERN, SIGNAL_TYPES.OFFER_PATTERN], [feature.key, feature.label]),
      relationStrength: Math.min(1, coverage || matches.length / 8),
      components: { feature: feature.key, matches: matches.length, observedSellerCount: sellerCount, estimatedCoverage: Number(coverage.toFixed(2)) },
      limitations: sellerCount ? [] : ['Coverage ratio is unavailable because seller count was not resolved.']
    });
  }).filter(Boolean);
}

function detectLocalGlobalAsymmetry(ctx) {
  const rows = ctx.evidenceRows;
  const localDomains = new Set(ctx.counts.localSellers.map(entity => entity.domain).filter(Boolean));
  const globalDomains = new Set(ctx.counts.globalLike.map(entity => entity.domain).filter(Boolean));
  const demoPattern = /demo|before after|proof|review|tutorial|case|دليل|قبل وبعد|تجربة|شرح/;
  const localRows = rows.filter(row => localDomains.has(hostOf(row.sourceUrl || row.entityId)));
  const globalRows = rows.filter(row => globalDomains.has(hostOf(row.sourceUrl || row.entityId)) || /youtube|rss|reddit|instagram|facebook|x|exa_search|jina_search/.test(normalize(row.sourcePlatform)));
  const localDemo = patternRows(localRows, demoPattern);
  const globalDemo = patternRows(globalRows, demoPattern);
  if (globalDemo.length < 4 || localDemo.length > Math.max(1, Math.floor(globalDemo.length * 0.35))) return [];
  return [makeInsight({
    type: 'LOCAL_GLOBAL_ASYMMETRY',
    title: 'Demonstration proof appears underused locally',
    finding: `${globalDemo.length} regional/global/content rows show demo, review or before-after proof language, while only ${localDemo.length} local seller rows show the same pattern.`,
    relationship: 'Wider category content + local absence = local adoption gap.',
    interpretation: 'A demonstration-first angle may be locally underused, but it should be tested as a candidate opportunity.',
    decisionTest: 'Create one local demo/proof block and one short demonstration creative, then compare against a static feature-led version.',
    evidenceRows: [...globalDemo.slice(0, 8), ...localDemo.slice(0, 3)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.MESSAGE_PATTERN, SIGNAL_TYPES.OFFER_PATTERN, SIGNAL_TYPES.BUYING_CRITERION], ['proof', 'review', 'demo']),
    relationStrength: 0.82,
    components: {
      localProofRows: localDemo.length,
      widerCategoryProofRows: globalDemo.length,
      localSellerCount: ctx.counts.sellerCount
    },
    limitations: ['This is a local adoption gap candidate, not a guaranteed opportunity.']
  })].filter(Boolean);
}

function detectSocialContentGaps(ctx) {
  const social = ctx.marketSignalModel.socialContent || {};
  const proofPatterns = [
    ...asArray(social.byFormat?.tutorial),
    ...asArray(social.byFormat?.proof),
    ...asArray(social.byFormat?.review)
  ];
  const evidence = rowsForEvidenceIds(ctx.evidenceRows, proofPatterns.flatMap(pattern => pattern.evidenceIds));
  const localStatic = patternRows(ctx.evidenceRows, /product description|feature list|static|fiche produit|description produit|مواصفات|وصف المنتج/);
  if (evidence.length < 4 || localStatic.length < 2) return [];
  return [makeInsight({
    type: 'SOCIAL_CONTENT_GAP',
    title: 'Content demand is more demonstrative than local seller pages',
    finding: `${evidence.length} social/content evidence rows show review, proof or tutorial patterns, while observed seller content still leans on static product descriptions/features.`,
    relationship: 'Recurring content format + seller content style = creative gap.',
    interpretation: 'The first creative test should show the product solving the problem, not only list specifications.',
    decisionTest: 'Test a demonstration-first ad and landing hero before increasing budget on static offer creatives.',
    evidenceRows: [...evidence.slice(0, 8), ...localStatic.slice(0, 4)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.MESSAGE_PATTERN, SIGNAL_TYPES.FEATURE_PATTERN], ['demo', 'proof', 'review']),
    relationStrength: 0.78,
    components: {
      socialProofPatterns: proofPatterns.length,
      localStaticRows: localStatic.length
    }
  })].filter(Boolean);
}

function detectProofGaps(ctx) {
  const rows = ctx.evidenceRows;
  const uncertainty = patternRows(rows, /does it work|proof|review|testimonial|before after|doubt|trust|real|هل يعمل|دليل|تقييم|قبل وبعد|ثقة|شك/);
  const sellerProof = patternRows(rows, /verified reviews|customer photos|before after|case study|avis verifie|صور عملاء|تقييمات موثقة|قبل وبعد/);
  if (uncertainty.length < 3 || sellerProof.length > Math.max(2, Math.ceil(uncertainty.length * 0.45))) return [];
  return [makeInsight({
    type: 'PROOF_GAP',
    title: 'The decision risk is proof, not another feature',
    finding: `${uncertainty.length} evidence rows mention proof, trust, reviews or result doubt, but only ${sellerProof.length} rows show strong verified proof assets.`,
    relationship: 'Customer uncertainty + weak visible proof = conversion risk gap.',
    interpretation: 'The next strongest improvement is likely proof architecture, not a broader feature promise.',
    decisionTest: 'Add a proof strip with verified review, before/after, guarantee terms and what the buyer receives; test against the current hero.',
    evidenceRows: [...uncertainty.slice(0, 8), ...sellerProof.slice(0, 4)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.OBJECTION, SIGNAL_TYPES.BUYING_CRITERION], ['proof', 'review', 'trust']),
    relationStrength: 0.84,
    components: { uncertaintyRows: uncertainty.length, strongProofRows: sellerProof.length }
  })].filter(Boolean);
}

function buildInsightTrace(insights = []) {
  return asArray(insights).reduce((acc, insight) => {
    acc[insight.id] = {
      signalIds: asArray(insight.signalIds),
      evidenceIds: asArray(insight.evidenceIds),
      sources: asArray(insight.sourceUrls)
    };
    return acc;
  }, {});
}

function validateInsights(insights = []) {
  const issues = [];
  asArray(insights).forEach((insight, index) => {
    if (!asArray(insight.evidenceIds).length) {
      issues.push({ severity: 'high', code: 'INSIGHT_WITHOUT_EVIDENCE', path: `insights[${index}]` });
    }
    if (isGenericAdvice(`${insight.title} ${insight.finding} ${insight.interpretation} ${insight.decisionTest}`)) {
      issues.push({ severity: 'high', code: 'GENERIC_ADVICE_AS_INSIGHT', path: `insights[${index}]` });
    }
    if (insight.confidence === 'HIGH' && sourceDiversity(asArray(insight.sourcePlatforms).map(sourcePlatform => ({ sourcePlatform }))) < 2) {
      issues.push({ severity: 'medium', code: 'HIGH_CONFIDENCE_LOW_SOURCE_DIVERSITY', path: `insights[${index}]` });
    }
  });
  return {
    status: issues.some(issue => issue.severity === 'high') ? 'downgraded' : 'approved',
    issues
  };
}

function buildInsightDiscoveryEngine(input = {}) {
  const marketSignalModel = input.marketSignalModel || {};
  const evidenceRows = evidenceRowsFrom({
    evidenceRegistry: input.evidenceRegistry,
    marketEvidence: input.marketEvidence,
    agentReachEvidence: input.agentReachEvidence,
    evidence: input.evidence
  });
  const counts = entityCounts(input.marketEntityMap || {});
  const ctx = { ...input, marketSignalModel, evidenceRows, counts };
  const detected = [
    ...detectCustomerCompetitorContradictions(ctx),
    ...detectCustomerOfferGaps(ctx),
    ...detectProofGaps(ctx),
    ...detectSaturation(ctx),
    ...detectLocalGlobalAsymmetry(ctx),
    ...detectSocialContentGaps(ctx)
  ].filter(Boolean);
  const seen = new Set();
  const insights = detected
    .filter(insight => {
      const key = normalize(`${insight.type} ${insight.title} ${insight.finding}`).slice(0, 240);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.score - a.score) || (b.evidenceIds.length - a.evidenceIds.length))
    .slice(0, 8);
  const validation = validateInsights(insights);
  return {
    version: 'insight-discovery-engine-v1',
    generatedAt: new Date().toISOString(),
    mode: 'cross_source_relationship_discovery',
    topInsights: insights.slice(0, 5),
    insights,
    insightTrace: buildInsightTrace(insights),
    coverageGate: {
      evidenceCount: evidenceRows.length,
      sourceDiversity: sourceDiversity(evidenceRows),
      localSellerCount: counts.sellerCount,
      globalBenchmarkCount: counts.globalCount,
      canCreateHighConfidence: evidenceRows.length >= 8 && sourceDiversity(evidenceRows) >= 3 && counts.sellerCount >= 3
    },
    validation,
    quality: {
      factIsNotInsight: true,
      genericAdviceRejected: validation.issues.every(issue => issue.code !== 'GENERIC_ADVICE_AS_INSIGHT'),
      traceable: insights.every(insight => insight.evidenceIds.length > 0),
      noDemandGrowthClaim: true,
      supplierClaimsRequireDedicatedEvidence: true,
      limitations: [
        'Insight discovery uses observed relationships in the collected evidence, not full-market statistics.',
        ...(insights.length ? [] : ['No non-obvious cross-source insight passed the coverage and generic-advice gates.'])
      ]
    }
  };
}

module.exports = {
  buildInsightDiscoveryEngine,
  detectCustomerCompetitorContradictions,
  detectCustomerOfferGaps,
  detectSaturation,
  detectLocalGlobalAsymmetry,
  detectSocialContentGaps,
  detectProofGaps,
  validateInsights,
  isGenericAdvice,
  scoreInsight
};
