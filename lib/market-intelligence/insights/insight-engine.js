const { SIGNAL_TYPES, SIGNAL_STATUS, evidenceRowsFrom } = require('../signal-engine');
const {
  confidenceFor,
  scoreInsight,
  scoreBreakdown,
  sourceDiversity,
  domainDiversity
} = require('./insight-scorer');
const {
  isGenericAdvice,
  validateInsights
} = require('./insight-validator');
const { DETECTOR_SEQUENCE, runRegisteredDetectors } = require('./detector-registry');

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

function isCustomerVoiceEvidenceRow(row = {}) {
  const scope = normalize(row.scope);
  const platform = normalize(row.sourcePlatform);
  const claim = normalize(row.claimType);
  const url = normalize(row.sourceUrl || row.url || '');
  const text = normalize(`${row.title || ''} ${row.value || ''}`);
  const customerPlatform = ['youtube', 'reddit', 'facebook', 'instagram', 'x', 'twitter', 'tiktok', 'trustpilot', 'google_reviews', 'review', 'reviews'].includes(platform) ||
    /youtube|youtu be|reddit|facebook|instagram|tiktok|twitter|x\.com|trustpilot|avis|reviews?|comments?/.test(url);
  const genericMarketPlatform = ['serp', 'serper', 'serpapi', 'web', 'website', 'jina', 'jina_search', 'jina_reader', 'inspected_page', 'organic', 'search', 'marketplace', 'shopping'].includes(platform);
  const explicitVoiceClaim = /customer voice|customer review|customer comment|customer question|customer complaint|review|avis|comment|testimonial|rating|opinion|feedback|reaction|complaint|objection|question|faq|تقييم|اراء|آراء|مراجعة|تعليق|شكوى|اعتراض|سؤال/.test(claim);
  const textHint = /review|avis|comment|testimonial|rating|feedback|experience|question|objection|complaint|تقييم|اراء|آراء|مراجعة|تعليق|تجربة|سؤال|شكوى|اعتراض/.test(text);

  if (genericMarketPlatform && !customerPlatform) return false;
  return (scope === 'customer' && (explicitVoiceClaim || customerPlatform || textHint)) ||
    (customerPlatform && (explicitVoiceClaim || textHint));
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

function inferDimensions(type = '') {
  const map = {
    CUSTOMER_COMPETITOR_CONTRADICTION: ['CUSTOMER', 'COMPETITOR', 'MESSAGE'],
    CUSTOMER_OFFER_GAP: ['CUSTOMER', 'OFFER', 'PROOF'],
    SATURATION: ['COMPETITOR', 'OFFER', 'MESSAGE'],
    LOCAL_GLOBAL_ASYMMETRY: ['LOCAL_MARKET', 'REGIONAL_BENCHMARK', 'GLOBAL_BENCHMARK'],
    SOCIAL_CONTENT_GAP: ['SOCIAL_CONTENT', 'COMPETITOR', 'CUSTOMER'],
    PROOF_GAP: ['CUSTOMER', 'PROOF', 'OFFER'],
    TRUST_GAP: ['CUSTOMER', 'TRUST', 'OFFER'],
    PRICE_VALUE_ASYMMETRY: ['PRICE', 'VALUE', 'PROOF'],
    OFFER_SIMILARITY_PROOF_GAP: ['COMPETITOR', 'OFFER', 'PROOF'],
    SUBSTITUTE_RISK: ['CUSTOMER', 'SUBSTITUTE', 'PRODUCT'],
    SUPPLIER_LOCAL_GAP: ['SUPPLIER', 'LOCAL_MARKET', 'OFFER'],
    TEMPORAL_OPPORTUNITY: ['TEMPORAL_SAMPLE', 'CONTENT', 'COMPETITOR']
  };
  return map[type] || ['MARKET', 'EVIDENCE'];
}

function makeInsight(input = {}) {
  const rows = uniq(input.rows || [], 40);
  const evidence = asArray(input.evidenceRows);
  const confidence = input.confidence || confidenceFor({ rows: evidence });
  const metrics = {
    mentions: evidence.length,
    independentSources: domainDiversity(evidence),
    platformCount: sourceDiversity(evidence),
    competitorCount: new Set(evidence.filter(row => /COMPETITOR|OFFER|SELLER/i.test(`${row.scope} ${row.claimType}`)).map(row => hostOf(row.sourceUrl || row.entityId)).filter(Boolean)).size,
    ...(input.metrics || {})
  };
  const scoring = scoreBreakdown({
    evidence,
    crossSourceCount: metrics.platformCount,
    relationStrength: input.relationStrength || 1,
    specificity: input.specificity || 1
  });
  const insight = {
    id: input.id || `insight_${hash(`${input.type}|${input.title}|${evidenceIds(evidence).join('|')}`)}`,
    type: cleanText(input.type, 80),
    status: input.status || SIGNAL_STATUS.INFERRED,
    title: cleanText(input.title, 180),
    finding: cleanText(input.finding, 520),
    whyItMatters: cleanText(input.whyItMatters || input.interpretation, 620),
    relationship: cleanText(input.relationship, 520),
    interpretation: cleanText(input.interpretation, 620),
    decisionTest: cleanText(input.decisionTest, 420),
    recommendedTest: input.recommendedTest || {
      type: 'TEST',
      action: cleanText(input.decisionTest, 420),
      successMetric: cleanText(input.successMetric || 'Compare conversion rate, qualified click-through rate and objection reduction before scaling budget.', 220)
    },
    dimensions: uniq(input.dimensions || inferDimensions(input.type), 8),
    metrics,
    confidence,
    score: scoreInsight({
      evidence,
      crossSourceCount: metrics.platformCount,
      relationStrength: input.relationStrength || 1,
      specificity: input.specificity || 1,
      confidence
    }),
    ...scoring,
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
  const customerRows = rows.filter(isCustomerVoiceEvidenceRow);
  const offerRows = rows.filter(row => !isCustomerVoiceEvidenceRow(row));
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

function detectOfferSimilarityProofGaps(ctx) {
  const sellerRows = ctx.evidenceRows.filter(row => /COMPETITOR|OFFER|SELLER|web_page|product/i.test(`${row.scope} ${row.claimType}`));
  const featureRows = patternRows(
    sellerRows,
    /led|usb|battery|charging|suction|level|mode|magnif|50x|silicone|head|feature list|specification|fiche produit|مستويات|شفط|اضاءة|إضاءة|شحن|بطارية|تكبير|رؤوس|مواصفات/
  );
  const proofRows = sellerRows.filter(isPositiveProofRow);
  const featureHosts = new Set(featureRows.map(row => hostOf(row.sourceUrl || row.entityId)).filter(Boolean));
  const proofHosts = new Set(proofRows.map(row => hostOf(row.sourceUrl || row.entityId)).filter(Boolean));
  const sellerCount = Math.max(ctx.counts.sellerCount || 0, featureHosts.size);
  const proofCoverage = sellerCount ? proofHosts.size / sellerCount : 0;
  if (featureRows.length < 6 || featureHosts.size < 3 || proofHosts.size > Math.max(1, Math.floor(featureHosts.size * 0.4))) return [];
  return [makeInsight({
    type: 'OFFER_SIMILARITY_PROOF_GAP',
    title: 'Similar feature lists make proof the real differentiator',
    finding: `${featureRows.length} observed offer rows repeat device/specification features across ${featureHosts.size} sellers, while only ${proofHosts.size} seller domains show strong verified proof assets in the same sample.`,
    relationship: 'Repeated offer features + low proof-host coverage = commoditization risk.',
    interpretation: 'When visible offers look alike, another feature claim is unlikely to create a strong difference unless it is attached to proof the buyer can verify.',
    decisionTest: 'Test one proof-led comparison block that shows the result, what the buyer receives, and why the offer is safer or clearer than similar feature-list sellers.',
    evidenceRows: [...featureRows.slice(0, 10), ...proofRows.slice(0, 4)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.FEATURE_PATTERN, SIGNAL_TYPES.OFFER_PATTERN, SIGNAL_TYPES.BUYING_CRITERION], ['led', 'usb', 'suction', 'proof']),
    relationStrength: 0.8,
    components: {
      repeatedFeatureRows: featureRows.length,
      featureSellerDomains: featureHosts.size,
      proofSellerDomains: proofHosts.size,
      estimatedProofCoverage: Number(proofCoverage.toFixed(2))
    },
    limitations: ['This detects visible offer similarity in the collected sample; it does not prove identical suppliers or full-market commoditization.']
  })].filter(Boolean);
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
  const sellerProof = patternRows(rows, /verified reviews|customer photos|before after|case study|avis verifie|صور عملاء|تقييمات موثقة|قبل وبعد/).filter(isPositiveProofRow);
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

function detectTrustGaps(ctx) {
  const rows = ctx.evidenceRows;
  const customerRows = rows.filter(isCustomerVoiceEvidenceRow);
  const sellerRows = rows.filter(row => /COMPETITOR|OFFER|SELLER|web_page|product/i.test(`${row.scope} ${row.claimType}`));
  const riskConcern = patternRows(customerRows, /refund|return|guarantee|cash on delivery|cod|delivery|support|seller identity|trust|risk|ارجاع|إرجاع|ضمان|توصيل|دفع عند الاستلام|ثقة|مخاطرة/);
  const trustCoverage = patternRows(sellerRows, /clear return|return policy|refund policy|verified guarantee|seller address|phone support|cash on delivery confirmed|سياسة إرجاع واضحة|ضمان موثق|دفع عند الاستلام مؤكد|عنوان البائع/);
  const sellerCount = Math.max(1, ctx.counts.sellerCount || 0);
  if (riskConcern.length < 4 || trustCoverage.length > Math.max(2, Math.ceil(sellerCount * 0.4))) return [];
  return [makeInsight({
    type: 'TRUST_GAP',
    title: 'Purchase-risk reassurance is thinner than buyer uncertainty',
    finding: `${riskConcern.length} rows mention return, guarantee, delivery, payment or seller-risk concerns, while only ${trustCoverage.length} rows show explicit verified trust coverage.`,
    relationship: 'Risk concern + weak return/payment/seller clarity = trust gap.',
    interpretation: 'The conversion obstacle is not only product desire; buyers may need clearer risk removal before they commit.',
    decisionTest: 'Test a decision block that states exact return terms, payment method, delivery limits and seller contact without inventing a new guarantee.',
    evidenceRows: [...riskConcern.slice(0, 8), ...trustCoverage.slice(0, 4)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.OBJECTION, SIGNAL_TYPES.BUYING_CRITERION, SIGNAL_TYPES.OFFER_PATTERN], ['return', 'guarantee', 'delivery', 'trust']),
    relationStrength: 0.82,
    components: {
      riskConcernRows: riskConcern.length,
      trustCoverageRows: trustCoverage.length,
      observedSellerCount: ctx.counts.sellerCount
    },
    limitations: ['Do not claim absence of return or guarantee; only visible clarity was low in the observed sample.']
  })].filter(Boolean);
}

function extractPriceValue(row = {}) {
  const text = normalize(`${row.title || ''} ${row.value || ''}`);
  const match = text.match(/(?:\$|usd|lyd|د\.ل|درهم|mad|eur|€)?\s*(\d{2,5})(?:[.,](\d{1,2}))?\s*(?:\$|usd|lyd|د\.ل|درهم|mad|eur|€)?/i);
  if (!match) return null;
  const amount = Number(`${match[1]}.${match[2] || '0'}`);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function isPositiveProofRow(row = {}) {
  const text = normalize(`${row.title || ''} ${row.value || ''}`);
  if (/\b(?:no|without|missing|lacks?|weak|unclear|not)\b.{0,48}\b(?:verified review|review|proof|guarantee|warranty|case study|testimonial)\b/i.test(text)) return false;
  if (/\b(?:verified review|customer photo|before after|guarantee|warranty|case study|testimonial|proof)\b/i.test(text)) return true;
  return /تقييمات موثقة|صور عملاء|قبل وبعد|ضمان موثق|دليل موثق/i.test(text);
}

function detectPriceValueAsymmetry(ctx) {
  const priceRows = ctx.evidenceRows
    .map(row => ({ row, price: extractPriceValue(row) }))
    .filter(item => item.price && /price|offer|product|competitor|web_page_content|pricing|السعر|ثمن/i.test(`${item.row.claimType} ${item.row.scope} ${item.row.value}`));
  if (priceRows.length < 4) return [];
  const sorted = priceRows.map(item => item.price).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const highPrice = priceRows.filter(item => item.price >= median * 1.25);
  const highPriceProof = highPrice.filter(item => isPositiveProofRow(item.row));
  const proofRows = patternRows(ctx.evidenceRows, /verified review|before after|guarantee|warranty|case study|proof|تقييم موثق|قبل وبعد|ضمان|دليل/).filter(isPositiveProofRow);
  if (highPrice.length < 1 || highPriceProof.length >= highPrice.length) return [];
  return [makeInsight({
    type: 'PRICE_VALUE_ASYMMETRY',
    title: 'Higher visible prices are weakly justified by proof',
    finding: `${highPrice.length} observed priced offers sit at least 25% above the sample median (${median}), but only ${highPriceProof.length} of them carry stronger visible proof in the same evidence rows.`,
    relationship: 'Price premium + weak proof/value evidence = value justification gap.',
    interpretation: 'A premium price may need proof, guarantee or bundle clarity before it can outperform cheaper alternatives.',
    decisionTest: 'If pricing above the visible median, test a value stack block that proves the extra value before showing the CTA.',
    evidenceRows: [...highPrice.map(item => item.row).slice(0, 6), ...proofRows.slice(0, 4)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.OFFER_PATTERN, SIGNAL_TYPES.BUYING_CRITERION], ['price', 'proof', 'guarantee']),
    relationStrength: 0.76,
    components: {
      pricedOfferRows: priceRows.length,
      sampleMedianPrice: median,
      highPriceRows: highPrice.length,
      highPriceRowsWithProof: highPriceProof.length
    },
    limitations: ['Currency normalization is approximate; this insight should be treated as a pricing hypothesis until prices are verified.']
  })].filter(Boolean);
}

function detectSubstituteRisks(ctx) {
  const rows = ctx.evidenceRows;
  const substituteRows = patternRows(rows, /substitute|alternative|pore strip|salicylic|clay mask|manual extraction|professional facial|chemical exfoliant|بديل|لاصقات|ساليسيليك|ماسك الطين|تنظيف احترافي/);
  const productPainRows = patternRows(rows, /irritat|sensitive|pain|bruis|too strong|not work|unsafe|تهيج|حساس|ألم|ضرر|لا يعمل/);
  if (substituteRows.length < 3 || productPainRows.length < 3) return [];
  return [makeInsight({
    type: 'SUBSTITUTE_RISK',
    title: 'The real battle may include gentler alternatives',
    finding: `${substituteRows.length} rows mention substitutes or alternative treatments, while ${productPainRows.length} rows mention device pain, irritation, safety or effectiveness concerns.`,
    relationship: 'Product pain + substitute discussion = substitution risk.',
    interpretation: 'The market may not only compare device against device; some buyers may choose gentler treatments if the device looks risky.',
    decisionTest: 'Test a comparison section that explains when the product is better than strips, acids or manual extraction, and when it is not suitable.',
    evidenceRows: [...substituteRows.slice(0, 7), ...productPainRows.slice(0, 7)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.CUSTOMER_PAIN, SIGNAL_TYPES.MESSAGE_PATTERN], ['alternative', 'substitute', 'salicylic', 'irritation']),
    relationStrength: 0.81,
    components: {
      substituteRows: substituteRows.length,
      productPainRows: productPainRows.length
    },
    limitations: ['This is a substitution-risk signal, not proof that substitutes outsell the product.']
  })].filter(Boolean);
}

function detectSupplierLocalGaps(ctx) {
  const verifiedSupplier = ctx.evidenceRows.filter(row =>
    /SUPPLIER|supplier|wholesale|manufacturer|factory|oem|moq|fob|packaging|مورد|مصنع|جملة/i.test(`${row.scope} ${row.claimType} ${row.sourcePlatform} ${row.value}`) &&
    /CONFIRMED|PARTIAL/i.test(String(row.verificationStatus || row.status || ''))
  );
  const localOfferRows = ctx.evidenceRows.filter(row => /COMPETITOR|OFFER|SELLER/i.test(`${row.scope} ${row.claimType}`));
  if (verifiedSupplier.length < 2 || localOfferRows.length < 3) return [];
  const supplierVariant = patternRows(verifiedSupplier, /oem|private label|packaging|variant|bundle|heads|skin type|moq|custom|تغليف|علامة خاصة|رؤوس|باندل/);
  const localVariant = patternRows(localOfferRows, /oem|private label|packaging|bundle|heads|skin type|custom|تغليف|علامة خاصة|باندل/);
  if (supplierVariant.length < 2 || localVariant.length > Math.max(1, Math.floor(supplierVariant.length * 0.6))) return [];
  return [makeInsight({
    type: 'SUPPLIER_LOCAL_GAP',
    title: 'Supplier variants may be ahead of local offer packaging',
    finding: `${supplierVariant.length} verified supplier rows mention variants, packaging, OEM/private label or bundles, while only ${localVariant.length} local offer rows show similar merchandising.`,
    relationship: 'Verified supplier availability + weak local offer expression = product/packaging opportunity candidate.',
    interpretation: 'There may be room to differentiate the offer package without claiming a unique product or shared supplier.',
    decisionTest: 'Validate supplier terms, then test a local bundle/package angle against the generic single-product offer.',
    evidenceRows: [...supplierVariant.slice(0, 6), ...localVariant.slice(0, 3)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.OFFER_PATTERN, SIGNAL_TYPES.FEATURE_PATTERN], ['bundle', 'variant', 'packaging']),
    relationStrength: 0.74,
    components: {
      verifiedSupplierRows: verifiedSupplier.length,
      supplierVariantRows: supplierVariant.length,
      localVariantRows: localVariant.length
    },
    limitations: ['Supplier opportunity is only a candidate; no same-supplier or landed-cost claim is inferred.']
  })].filter(Boolean);
}

function detectTemporalOpportunities(ctx) {
  const rows = ctx.evidenceRows;
  const datedRows = rows.filter(row => row.publishedAt || row.observedAt || row.collectedAt);
  if (datedRows.length < 4) return [];
  const now = Date.parse(ctx.now || '') || Date.now();
  const recent = datedRows.filter(row => {
    const time = Date.parse(row.publishedAt || row.observedAt || row.collectedAt);
    if (!Number.isFinite(time)) return false;
    return now - time <= 1000 * 60 * 60 * 24 * 30;
  });
  const recentTheme = patternRows(recent, /review|tutorial|comparison|safe|proof|before after|new|guide|مقارنة|شرح|دليل|آمن|قبل وبعد/);
  const olderStatic = patternRows(datedRows.filter(row => !recent.includes(row)), /feature list|product description|static|مواصفات|وصف المنتج/);
  if (recentTheme.length < 3 || olderStatic.length < 1) return [];
  return [makeInsight({
    type: 'TEMPORAL_OPPORTUNITY',
    title: 'Recent observed content leans toward proof and comparison',
    finding: `${recentTheme.length} dated rows in the recent observed sample mention proof, review, tutorial, safety or comparison themes, while older/static rows still lean on descriptions.`,
    relationship: 'Recent sample theme + older static seller messaging = temporal creative test.',
    interpretation: 'This supports a test around proof/comparison content, but it does not prove demand, market or sales growth.',
    decisionTest: 'Run one proof/comparison creative during the next test window and compare saved leads or qualified clicks against a static feature creative.',
    evidenceRows: [...recentTheme.slice(0, 8), ...olderStatic.slice(0, 3)],
    signalIds: signalIdsForTypes(ctx.marketSignalModel, [SIGNAL_TYPES.EMERGING_SIGNAL, SIGNAL_TYPES.MESSAGE_PATTERN], ['proof', 'review', 'comparison']),
    relationStrength: 0.69,
    components: {
      recentThemeRows: recentTheme.length,
      olderStaticRows: olderStatic.length,
      window: 'recent observed sample, not demand growth'
    },
    limitations: ['Mention frequency is not demand growth, market growth or sales growth.']
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

const COVERAGE_SENSITIVE_INSIGHT_TYPES = new Set([
  'SATURATION',
  'OFFER_SIMILARITY_PROOF_GAP',
  'LOCAL_GLOBAL_ASYMMETRY',
  'PRICE_VALUE_ASYMMETRY',
  'TEMPORAL_OPPORTUNITY'
]);

function buildMarketCoverageGate(evidenceRows = [], counts = {}) {
  const diversity = sourceDiversity(evidenceRows);
  const domains = domainDiversity(evidenceRows);
  const localSellerCount = counts.sellerCount || 0;
  const globalBenchmarkCount = counts.globalCount || 0;
  return {
    evidenceCount: evidenceRows.length,
    sourceDiversity: diversity,
    domainDiversity: domains,
    localSellerCount,
    globalBenchmarkCount,
    level: evidenceRows.length >= 10 && (diversity >= 3 || domains >= 4) && localSellerCount >= 3 ? 'HIGH' : (evidenceRows.length >= 6 && (diversity >= 2 || domains >= 3) ? 'MEDIUM' : 'LOW'),
    canCreateHighConfidence: evidenceRows.length >= 8 && (diversity >= 3 || domains >= 4) && localSellerCount >= 3,
    gates: {
      saturation: localSellerCount >= 3 && domains >= 3 && evidenceRows.length >= 6,
      offerSimilarityProofGap: localSellerCount >= 3 && domains >= 3 && evidenceRows.length >= 6,
      localGlobalAsymmetry: localSellerCount >= 2 && globalBenchmarkCount >= 2 && diversity >= 2,
      priceValueAsymmetry: evidenceRows.length >= 5 && domains >= 3,
      temporalOpportunity: evidenceRows.length >= 6 && (diversity >= 2 || domains >= 3)
    }
  };
}

function coverageDecisionForInsight(insight = {}, coverageGate = {}) {
  if (!COVERAGE_SENSITIVE_INSIGHT_TYPES.has(insight.type)) {
    return { allowed: true };
  }
  const gateKey = {
    SATURATION: 'saturation',
    OFFER_SIMILARITY_PROOF_GAP: 'offerSimilarityProofGap',
    LOCAL_GLOBAL_ASYMMETRY: 'localGlobalAsymmetry',
    PRICE_VALUE_ASYMMETRY: 'priceValueAsymmetry',
    TEMPORAL_OPPORTUNITY: 'temporalOpportunity'
  }[insight.type];
  if (coverageGate.gates?.[gateKey]) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `MARKET_COVERAGE_TOO_LOW_FOR_${insight.type}`,
    coverage: {
      evidenceCount: coverageGate.evidenceCount,
      sourceDiversity: coverageGate.sourceDiversity,
      domainDiversity: coverageGate.domainDiversity,
      localSellerCount: coverageGate.localSellerCount,
      globalBenchmarkCount: coverageGate.globalBenchmarkCount,
      level: coverageGate.level
    }
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
  const coverageGate = buildMarketCoverageGate(evidenceRows, counts);
  const ctx = { ...input, marketSignalModel, evidenceRows, counts };
  const detected = runRegisteredDetectors(ctx, {
    customerCompetitorContradictions: detectCustomerCompetitorContradictions,
    customerOfferGaps: detectCustomerOfferGaps,
    proofGaps: detectProofGaps,
    trustGaps: detectTrustGaps,
    priceValueAsymmetry: detectPriceValueAsymmetry,
    saturation: detectSaturation,
    offerSimilarityProofGaps: detectOfferSimilarityProofGaps,
    localGlobalAsymmetry: detectLocalGlobalAsymmetry,
    socialContentGaps: detectSocialContentGaps,
    substituteRisks: detectSubstituteRisks,
    supplierLocalGaps: detectSupplierLocalGaps,
    temporalOpportunities: detectTemporalOpportunities
  }).filter(Boolean);
  const seen = new Set();
  const suppressedInsights = [];
  const insights = detected
    .filter(insight => {
      const key = normalize(`${insight.type} ${insight.title} ${insight.finding}`).slice(0, 240);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter(insight => {
      const decision = coverageDecisionForInsight(insight, coverageGate);
      if (decision.allowed) return true;
      suppressedInsights.push({
        id: insight.id,
        type: insight.type,
        title: insight.title,
        reason: decision.reason,
        coverage: decision.coverage
      });
      return false;
    })
    .sort((a, b) => (b.score - a.score) || (b.evidenceIds.length - a.evidenceIds.length))
    .slice(0, 8);
  const validation = validateInsights(insights);
  return {
    version: 'insight-discovery-engine-v1',
    generatedAt: new Date().toISOString(),
    mode: 'cross_source_relationship_discovery',
    detectorRegistry: DETECTOR_SEQUENCE.map(item => ({
      key: item.key,
      type: item.type,
      relationship: item.relationship,
      dimensions: item.dimensions,
      evidencePolicy: item.evidencePolicy
    })),
    topInsights: insights.slice(0, 5),
    insights,
    suppressedInsights,
    insightTrace: buildInsightTrace(insights),
    coverageGate,
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
  detectOfferSimilarityProofGaps,
  detectLocalGlobalAsymmetry,
  detectSocialContentGaps,
  detectProofGaps,
  detectTrustGaps,
  detectPriceValueAsymmetry,
  detectSubstituteRisks,
  detectSupplierLocalGaps,
  detectTemporalOpportunities,
  validateInsights,
  isGenericAdvice,
  scoreInsight,
  buildMarketCoverageGate,
  coverageDecisionForInsight,
  DETECTOR_SEQUENCE,
  runRegisteredDetectors
};
