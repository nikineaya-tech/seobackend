'use strict';

const STATUS = Object.freeze({
  CONFIRMED: 'CONFIRMED',
  NOT_FOUND_ON_INSPECTED_PAGE: 'NOT_FOUND_ON_INSPECTED_PAGE',
  NOT_VERIFIED: 'NOT_VERIFIED',
  CONFIRMED_ABSENT: 'CONFIRMED_ABSENT',
  UNKNOWN: 'UNKNOWN',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  RECOMMENDED: 'RECOMMENDED'
});

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanText(value, max = 800) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value || {}));
  } catch (_) {
    return {};
  }
}

function hostOf(value = '') {
  try {
    return new URL(String(value).startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return cleanText(value, 120).replace(/^www\./i, '').toLowerCase();
  }
}

function makeEvidenceId(index, claimType, competitorId) {
  return `ev_${claimType}_${String(competitorId || 'market').replace(/[^a-z0-9]+/gi, '_')}_${index}`;
}

function createEvidenceRegistry(input = {}) {
  const competitors = asArray(input.competitors || input.top10Competitors || input.enrichedCompetitors);
  const externalEvidence = [
    ...asArray(input.evidence),
    ...asArray(input.externalEvidence),
    ...asArray(input.agentReachEvidence?.evidenceRegistry?.evidence),
    ...asArray(input.marketEvidence?.evidenceRegistry?.evidence)
  ];
  const rows = [];

  function add(row) {
    if (!row.value) return null;
    const competitorId = row.competitorId || hostOf(row.sourceUrl || row.value) || 'market';
    const evidence = {
      id: row.id || makeEvidenceId(rows.length + 1, row.claimType || 'observed', competitorId),
      competitorId,
      claimType: row.claimType || 'observed',
      value: cleanText(row.value, 900),
      sourceUrl: row.sourceUrl || null,
      sourceType: row.sourceType || 'serp',
      observedAt: row.observedAt || new Date().toISOString(),
      confidence: row.confidence || 'MEDIUM',
      verificationStatus: row.verificationStatus || STATUS.CONFIRMED
    };
    rows.push(evidence);
    return evidence;
  }

  competitors.forEach((competitor, index) => {
    const competitorId = hostOf(competitor.domain || competitor.url || competitor.link || competitor.title || `competitor-${index + 1}`);
    const sourceUrl = competitor.url || competitor.link || (competitor.domain ? `https://${competitor.domain}` : null);
    add({ competitorId, claimType: 'serp_result', value: competitor.title || competitor.domain || sourceUrl, sourceUrl, sourceType: competitor.source || 'serp', confidence: 'HIGH' });
    add({ competitorId, claimType: 'snippet', value: competitor.snippet, sourceUrl, sourceType: 'serp', confidence: 'MEDIUM' });
    add({ competitorId, claimType: 'geo_signal', value: asArray(competitor.geoSignals).join(' | ') || competitor.geoTier, sourceUrl, sourceType: 'geo_classifier', confidence: competitor.geoConfirmed ? 'HIGH' : 'LOW' });
    const profile = competitor.businessProfile || {};
    add({ competitorId, claimType: 'offer', value: profile.whatTheySell || profile.primaryPromise, sourceUrl, sourceType: 'inspected_page', confidence: profile.confidence || 'LOW' });
    asArray(profile.observedStrengths).forEach(value => add({ competitorId, claimType: 'observed_strength', value, sourceUrl, sourceType: 'inspected_page', confidence: profile.confidence || 'LOW' }));
    asArray(profile.missingProofs).forEach(value => add({ competitorId, claimType: 'not_found', value, sourceUrl, sourceType: 'inspected_page', confidence: 'LOW', verificationStatus: STATUS.NOT_FOUND_ON_INSPECTED_PAGE }));
  });

  externalEvidence.forEach(row => {
    add({
      id: row.id,
      competitorId: row.entityId || row.competitorId || hostOf(row.sourceUrl || row.url || row.value),
      claimType: row.claimType || 'market_signal',
      value: row.value || row.text || row.summary || row.title,
      sourceUrl: row.sourceUrl || row.url || null,
      sourceType: row.sourceType || row.sourcePlatform || row.provider || 'agent_reach',
      observedAt: row.collectedAt || row.observedAt || new Date().toISOString(),
      confidence: row.confidence || 'LOW',
      verificationStatus: row.verificationStatus || STATUS.NOT_VERIFIED
    });
  });

  return {
    version: 'competitor-evidence-v1',
    createdAt: new Date().toISOString(),
    evidence: rows,
    byId: Object.fromEntries(rows.map(item => [item.id, item])),
    counts: rows.reduce((acc, row) => {
      acc[row.claimType] = (acc[row.claimType] || 0) + 1;
      return acc;
    }, {})
  };
}

function hasEvidence(registry, types = []) {
  const wanted = new Set(types);
  return asArray(registry?.evidence).some(row => wanted.has(row.claimType) && row.verificationStatus === STATUS.CONFIRMED);
}

function hasTemporalEvidence(registry, context = {}) {
  if (context.trendsData || context.mainKwData?.trend?.length) return true;
  return hasEvidence(registry, ['trend', 'temporal_trend', 'gsc_90d', 'keyword_trend']);
}

function logCompetitorEvent(event, payload = {}) {
  try {
    const safePayload = cloneJson(payload);
    console.warn(event, JSON.stringify({
      event,
      ...safePayload,
      loggedAt: new Date().toISOString()
    }));
  } catch (_) {}
}

function noUserMessage(lang = 'fr') {
  if (lang === 'ar') return 'لم يتم تقييم عرضك لأن أي رابط لموقع شركتك لم يتم تدقيقه.';
  if (lang === 'en') return 'Your offer was not evaluated because no URL from your business was audited.';
  return "Votre offre n'a pas été évaluée car aucune URL de votre entreprise n'a été auditée.";
}

function cleanseUnsupportedText(value, context = {}) {
  if (typeof value !== 'string') return value;
  let out = value;
  if (!hasEvidence(context.evidenceRegistry, ['market_share'])) {
    out = out
      .replace(/market leader|dominates(?: the)? market|leader du march[ée]|domine le march[ée]/gi, context.lang === 'ar' ? 'أول نتيجة تجارية مرصودة' : context.lang === 'en' ? 'top observed commercial result' : 'premier résultat commercial observé')
      .replace(/من يتصدر السوق ولماذا؟|من يتصدر السوق|يتصدر السوق|المتصدر التجاري المرصود|القائد في السوق/gi, 'أول نتيجة تجارية مرصودة');
  }
  if (!hasTemporalEvidence(context.evidenceRegistry, context)) {
    out = out
      .replace(/[^.!?\n]*(?:demande\s+(?:croissante|en hausse|augmente|grandissante)|march[ée]\s+en\s+croissance|growing demand|increasing demand|market is growing|طلب(?:ا)?\s+متزايد|زيادة الطلب)[^.!?\n]*[.!?]?/gi, '')
      .trim();
  }
  if (!hasEvidence(context.evidenceRegistry, ['delivery', 'shipping'])) {
    out = out.replace(/(?:24\s*h|24h|same[-\s]?day|livr[ée]?\s+en\s+24\s*h|التسليم خلال 24 ساعة|توصيل خلال 24 ساعة)/gi, context.lang === 'ar' ? 'سرعة تسليم غير مؤكدة' : 'delivery speed not verified');
  }
  if (!hasEvidence(context.evidenceRegistry, ['traffic_source', 'ads', 'influencer'])) {
    out = out.replace(/(?:influenceurs?|influencers?|ads?|publicit[ée]s?|إعلانات|مؤثرين)/gi, match => {
      return /إعلانات|مؤثرين/.test(match) ? 'قناة غير مؤكدة' : 'unverified channel';
    });
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function dedupePrimitiveList(values = [], limit = 12) {
  const seen = new Set();
  return asArray(values).filter(item => {
    const key = cleanText(typeof item === 'string' ? item : JSON.stringify(item), 220).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function dedupeActionList(values = [], limit = 6) {
  const seen = new Set();
  return asArray(values).filter(item => {
    const key = cleanText(item?.action || item?.gap || item?.title || item?.value || JSON.stringify(item), 260)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function groupCompetitorsByGeo(competitors = []) {
  const groups = {
    directLocalCompetitors: [],
    probableLocalCompetitors: [],
    regionalBenchmarks: [],
    foreignBenchmarks: [],
    marketplaces: [],
    substitutes: [],
    unconfirmedResults: []
  };
  asArray(competitors).forEach(item => {
    const tier = item.geoTier || 'UNCONFIRMED';
    const typeText = `${item.category || ''} ${item.competitorType || ''} ${item.typeLabel || ''} ${item.type || ''}`.toLowerCase();
    if (/marketplace|amazon|jumia|shein|aliexpress/.test(typeText)) groups.marketplaces.push(item);
    else if (/substitute|content|social/.test(typeText)) groups.substitutes.push(item);
    else if (tier === 'LOCAL_CONFIRMED') groups.directLocalCompetitors.push(item);
    else if (tier === 'LOCAL_PROBABLE') groups.probableLocalCompetitors.push(item);
    else if (tier === 'REGIONAL_BENCHMARK') groups.regionalBenchmarks.push(item);
    else if (tier === 'FOREIGN_BENCHMARK') groups.foreignBenchmarks.push(item);
    else groups.unconfirmedResults.push(item);
  });
  return groups;
}

function walkAndClean(node, context, depth = 0) {
  if (depth > 12) return node;
  if (typeof node === 'string') return cleanseUnsupportedText(node, context);
  if (Array.isArray(node)) return node.map(item => walkAndClean(item, context, depth + 1)).filter(item => !(typeof item === 'string' && !item.trim()));
  if (node && typeof node === 'object') {
    Object.keys(node).forEach(key => {
      node[key] = walkAndClean(node[key], context, depth + 1);
    });
  }
  return node;
}

function enforceNoUserAudit(report, lang = 'fr') {
  const message = noUserMessage(lang);
  report.userSiteAudited = false;
  report.userBenchmark = null;
  report.userWeaknesses = [];
  report.userStrengths = [];
  report.comparisonScores = { ...(report.comparisonScores || {}), user: null };
  report.duelComparison = null;
  report.recommendedBenchmark = report.recommendedBenchmark || {
    status: STATUS.RECOMMENDED,
    message,
    priorities: [
      lang === 'ar' ? 'إثبات واضح يمكن التحقق منه' : lang === 'en' ? 'Clear verifiable proof' : 'Preuve claire et vérifiable',
      lang === 'ar' ? 'وعد عرض محدد' : lang === 'en' ? 'Specific offer promise' : 'Promesse d’offre précise',
      lang === 'ar' ? 'تقليل المخاطر قبل الشراء' : lang === 'en' ? 'Risk reduction before purchase' : 'Réduction du risque avant achat'
    ]
  };
  if (report.legacyStudies) {
    if (report.legacyStudies.comparisonScores) report.legacyStudies.comparisonScores.user = null;
    if (report.legacyStudies.duelComparison) report.legacyStudies.duelComparison = null;
  }
  report.userEvaluationNotice = message;
  return report;
}

function sanitizeCompetitorReport(payload = {}, context = {}) {
  const report = cloneJson(payload);
  const lang = context.lang || report.lang || 'fr';
  const competitors = asArray(report.competitors || report.top10Competitors);
  const evidenceRegistry = context.evidenceRegistry || createEvidenceRegistry({
    competitors,
    agentReachEvidence: context.agentReachEvidence,
    marketEvidence: context.marketEvidence,
    externalEvidence: context.externalEvidence
  });
  const userSiteAudited = Boolean(context.userSiteAudited || report.userSiteAudited || report.userBenchmark?.url || context.userSiteData?.url);
  logCompetitorEvent('competitor_evidence_created', {
    evidenceCount: asArray(evidenceRegistry.evidence).length,
    competitors: competitors.length
  });

  competitors.forEach(item => {
    const score = Number(item.serpRelevanceScore ?? item.observedVisibilityScore ?? item.dominance ?? 0);
    item.serpRelevanceScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
    item.observedVisibilityScore = item.serpRelevanceScore;
    item.dominanceDeprecated = item.dominance;
    delete item.dominance;
    if (item.geoTier === 'LOCAL_CONFIRMED' && !item.geoConfirmed) item.geoTier = 'LOCAL_PROBABLE';
    item.evidenceIds = asArray(evidenceRegistry.evidence)
      .filter(ev => ev.competitorId === hostOf(item.domain || item.url))
      .map(ev => ev.id)
      .slice(0, 8);
    logCompetitorEvent('competitor_geo_classification', {
      domain: item.domain || hostOf(item.url),
      geoTier: item.geoTier,
      geoConfirmed: Boolean(item.geoConfirmed),
      evidenceIds: item.evidenceIds
    });
  });
  report.competitors = competitors;
  report.top10Competitors = competitors.slice(0, 10);
  report.competitorGeoGroups = groupCompetitorsByGeo(competitors);

  if (!userSiteAudited) enforceNoUserAudit(report, lang);
  else report.userSiteAudited = true;

  if (!hasTemporalEvidence(evidenceRegistry, context)) {
    report.marketInsights = report.marketInsights || {};
    report.marketInsights.trend = null;
    report.marketInsights.demandTrend = {
      status: STATUS.NOT_VERIFIED,
      message: lang === 'ar' ? 'لم يتم تأكيد اتجاه الطلب زمنيا من مصدر موثوق.' : lang === 'en' ? 'Demand trend was not verified with a temporal source.' : "La tendance de demande n'a pas été vérifiée par une source temporelle."
    };
  }
  if (!hasEvidence(evidenceRegistry, ['price', 'pricing'])) {
    report.productServiceAudit = report.productServiceAudit || {};
    delete report.productServiceAudit.pricingStrategy;
    report.productServiceAudit.pricingStatus = STATUS.NOT_VERIFIED;
    report.pricing = { ...(report.pricing || {}), status: STATUS.NOT_VERIFIED };
    logCompetitorEvent('competitor_unknown_field', { field: 'pricing', status: STATUS.NOT_VERIFIED });
  }
  if (!hasEvidence(evidenceRegistry, ['delivery', 'shipping'])) {
    if (report.grandSlamOfferBlueprint?.timeDelay) {
      report.grandSlamOfferBlueprint.timeDelay = null;
    }
    report.claimRequiresValidation = { ...(report.claimRequiresValidation || {}), deliveryPromise: true };
    logCompetitorEvent('competitor_claim_downgraded', { claimType: 'delivery', reason: 'missing_delivery_evidence' });
  }
  if (!hasEvidence(evidenceRegistry, ['traffic_source', 'ads', 'influencer'])) {
    report.masteringTechniques = report.masteringTechniques || {};
    report.masteringTechniques.trafficSources = {
      status: STATUS.UNKNOWN,
      message: lang === 'ar' ? 'مصادر الحركة غير مؤكدة من الأدلة المتاحة.' : lang === 'en' ? 'Traffic sources are not verified from available evidence.' : 'Les sources de trafic ne sont pas vérifiées par les preuves disponibles.'
    };
    logCompetitorEvent('competitor_unknown_field', { field: 'trafficSources', status: STATUS.UNKNOWN });
  }
  report.marketDynamics = report.marketDynamics || {};
  report.marketDynamics.porter = report.marketDynamics.porter || {};
  report.marketDynamics.porter.supplierPower = { status: STATUS.UNKNOWN, confidence: 'LOW', evidenceIds: [] };
  report.marketDynamics.porter.completeness = report.marketDynamics.porter.completeness || '1/5';
  report.marketDynamics.porter.assessment = {
    status: STATUS.INSUFFICIENT_EVIDENCE,
    message: lang === 'ar' ? 'الأدلة غير كافية لتقييم قوى بورتر الخمس بالكامل.' : lang === 'en' ? 'Insufficient evidence for a complete Five Forces assessment.' : 'Preuves insuffisantes pour une évaluation complète des cinq forces.'
  };
  logCompetitorEvent('competitor_framework_skipped', { framework: 'porter', reason: 'insufficient_supplier_evidence' });
  report.frameworkLimitations = asArray(report.frameworkLimitations);
  report.frameworkLimitations.push('Porter supplier power is UNKNOWN unless supplier evidence is collected.');

  report.whatCouldNotVerify = [
    ...(asArray(report.whatCouldNotVerify)),
    ...(hasTemporalEvidence(evidenceRegistry, context) ? [] : ['Demand trend / growth']),
    ...(hasEvidence(evidenceRegistry, ['price', 'pricing']) ? [] : ['Exact pricing strategy']),
    ...(hasEvidence(evidenceRegistry, ['delivery', 'shipping']) ? [] : ['Delivery speed / 24h claim']),
    ...(hasEvidence(evidenceRegistry, ['traffic_source', 'ads', 'influencer']) ? [] : ['Ads, influencer or traffic-source claims'])
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  report.evidenceRegistry = evidenceRegistry;
  if (report.actionRoadmap) report.actionRoadmap = dedupePrimitiveList(report.actionRoadmap, 6);
  if (report.semanticDifferences) report.semanticDifferences = dedupeActionList(report.semanticDifferences, 6);
  if (report.competitorIntelligence?.priorityActions) {
    report.competitorIntelligence.priorityActions = dedupeActionList(report.competitorIntelligence.priorityActions, 6);
  }
  if (report.competitorIntelligence?.finalAnswers?.thisWeek) {
    report.competitorIntelligence.finalAnswers.thisWeek = dedupeActionList(report.competitorIntelligence.finalAnswers.thisWeek, 3);
  }
  if (report.competitorIntelligence?.finalAnswers?.next30Days) {
    report.competitorIntelligence.finalAnswers.next30Days = dedupeActionList(report.competitorIntelligence.finalAnswers.next30Days, 3);
  }
  walkAndClean(report, { ...context, lang, evidenceRegistry });

  report.claimValidation = validateCompetitorClaims(report, evidenceRegistry, { ...context, userSiteAudited });
  asArray(report.claimValidation.issues).forEach(issue => {
    logCompetitorEvent(issue.severity === 'high' ? 'competitor_claim_rejected' : 'competitor_claim_downgraded', {
      code: issue.code,
      reason: issue.message
    });
  });
  return report;
}

function validateCompetitorClaims(payload = {}, evidenceRegistry = null, context = {}) {
  const report = cloneJson(payload);
  const registry = evidenceRegistry || report.evidenceRegistry || createEvidenceRegistry(report);
  const issues = [];
  const allText = JSON.stringify(report);
  if (!context.userSiteAudited && /(?:موقعك|your site|votre site|user UX|user pricing|موقعك.*ضعيف|تجربة مستخدم ضعيفة)/i.test(allText)) {
    issues.push({ severity: 'high', code: 'UNSUPPORTED_USER_SITE_CLAIM', message: noUserMessage(context.lang || report.lang || 'fr') });
  }
  if (!hasTemporalEvidence(registry, context) && /(?:demande\s+(?:croissante|en hausse)|market is growing|growing demand|طلب(?:ا)?\s+متزايد|زيادة الطلب)/i.test(allText)) {
    issues.push({ severity: 'high', code: 'UNSUPPORTED_DEMAND_GROWTH', message: 'Demand growth requires temporal evidence.' });
  }
  if (!hasEvidence(registry, ['price', 'pricing']) && /(?:pricing strategy|strat[ée]gie de prix|هندسة الأسعار|نطاق سعري|price range)/i.test(allText)) {
    issues.push({ severity: 'medium', code: 'UNSUPPORTED_PRICING_STRATEGY', message: 'Pricing strategy requires observed price evidence.' });
  }
  if (!hasEvidence(registry, ['delivery', 'shipping']) && /(?:24\s*h|24h|same[-\s]?day|التسليم خلال 24 ساعة)/i.test(allText)) {
    issues.push({ severity: 'high', code: 'UNSUPPORTED_DELIVERY_CLAIM', message: 'Delivery speed requires observed delivery evidence.' });
  }
  if (/dominance\s*[:=]?\s*100|الهيمنة\s*100|market dominance/i.test(allText)) {
    issues.push({ severity: 'medium', code: 'DOMINANCE_LABEL_UNSAFE', message: 'Use serpRelevanceScore/observedVisibilityScore instead of market dominance.' });
  }
  if (!hasEvidence(registry, ['market_share']) && /(?:market leader|leader du march[ée]|dominates(?: the)? market|يتصدر السوق|القائد في السوق|من يتصدر السوق)/i.test(allText)) {
    issues.push({ severity: 'high', code: 'UNSUPPORTED_MARKET_LEADER_CLAIM', message: 'Market leadership requires market-share evidence; SERP can only support top observed result wording.' });
  }
  return {
    status: issues.some(issue => issue.severity === 'high') ? 'downgraded' : 'approved',
    issues,
    evidenceCount: asArray(registry.evidence).length,
    sourceDiversity: new Set(asArray(registry.evidence).map(row => row.sourceType)).size,
    validatedAt: new Date().toISOString()
  };
}

module.exports = {
  STATUS,
  createEvidenceRegistry,
  validateCompetitorClaims,
  sanitizeCompetitorReport,
  noUserMessage
};
