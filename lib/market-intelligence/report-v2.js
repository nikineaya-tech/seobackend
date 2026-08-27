'use strict';

const { SIGNAL_TYPES, SIGNAL_STATUS } = require('./signal-engine');

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanText(value, max = 1000) {
  return String(value == null ? '' : value)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function uniq(values = [], limit = 10) {
  const seen = new Set();
  const out = [];
  asArray(values).forEach(value => {
    const text = cleanText(value, 500);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  });
  return out.slice(0, limit);
}

function evidenceIdsOf(item = {}, limit = 8) {
  return uniq([
    ...asArray(item.evidenceIds),
    ...asArray(item.evidence_ids),
    ...asArray(item.sources).flatMap(source => asArray(source.evidenceIds))
  ], limit);
}

function sourceUrlsOf(item = {}, limit = 5) {
  return uniq([
    ...asArray(item.sourceUrls),
    item.sourceUrl,
    item.url,
    ...asArray(item.sources).map(source => source.sourceUrl || source.url)
  ], limit);
}

function compactSignal(signal = {}) {
  return {
    id: cleanText(signal.id || signal.signalId, 120),
    type: cleanText(signal.type, 80),
    topic: cleanText(signal.topic, 120),
    status: cleanText(signal.status || SIGNAL_STATUS.UNKNOWN, 60),
    statement: cleanText(signal.statement || signal.title || signal.value, 360),
    confidence: cleanText(signal.confidence || 'LOW', 20).toUpperCase(),
    count: Number(signal.count || 0),
    evidenceIds: evidenceIdsOf(signal),
    sourceUrls: sourceUrlsOf(signal),
    limitations: asArray(signal.limitations).map(item => cleanText(item, 240)).filter(Boolean).slice(0, 4)
  };
}

function compactCustomerVoicePattern(pattern = {}) {
  return {
    id: cleanText(pattern.id, 120),
    type: cleanText(pattern.type, 80),
    key: cleanText(pattern.key, 120),
    label: cleanText(pattern.label, 180),
    count: Number(pattern.count || 0),
    confidence: cleanText(pattern.confidence || 'LOW', 20).toUpperCase(),
    evidenceIds: evidenceIdsOf(pattern, 8),
    sourceUrls: sourceUrlsOf(pattern, 5),
    sourcePlatforms: uniq(asArray(pattern.sourcePlatforms), 5),
    temporal: pattern.temporal || null,
    limitations: asArray(pattern.limitations).map(item => cleanText(item, 240)).filter(Boolean).slice(0, 3)
  };
}

function compactOfferPattern(pattern = {}) {
  return {
    id: cleanText(pattern.id, 120),
    key: cleanText(pattern.key, 120),
    label: cleanText(pattern.label, 180),
    aspect: cleanText(pattern.aspect, 80),
    count: Number(pattern.count || 0),
    confidence: cleanText(pattern.confidence || 'LOW', 20).toUpperCase(),
    evidenceIds: evidenceIdsOf(pattern, 8),
    sourceUrls: sourceUrlsOf(pattern, 5),
    sourcePlatforms: uniq(asArray(pattern.sourcePlatforms), 5),
    temporal: pattern.temporal || null,
    limitations: asArray(pattern.limitations).map(item => cleanText(item, 240)).filter(Boolean).slice(0, 3)
  };
}

function compactSocialContentPattern(pattern = {}) {
  return {
    id: cleanText(pattern.id, 120),
    key: cleanText(pattern.key, 120),
    label: cleanText(pattern.label, 180),
    format: cleanText(pattern.format, 80),
    count: Number(pattern.count || 0),
    confidence: cleanText(pattern.confidence || 'LOW', 20).toUpperCase(),
    evidenceIds: evidenceIdsOf(pattern, 8),
    sourceUrls: sourceUrlsOf(pattern, 5),
    sourcePlatforms: uniq(asArray(pattern.sourcePlatforms), 5),
    temporal: pattern.temporal || null,
    limitations: asArray(pattern.limitations).map(item => cleanText(item, 240)).filter(Boolean).slice(0, 3)
  };
}

function compactEntity(entity = {}) {
  return {
    id: cleanText(entity.id || entity.entityId || entity.domain || entity.url, 180),
    type: cleanText(entity.type || entity.entityType || 'INFORMATION_SOURCE', 60),
    name: cleanText(entity.name || entity.title || entity.domain || entity.url, 180),
    domain: cleanText(entity.domain, 180) || null,
    url: cleanText(entity.url || entity.sourceUrl, 600) || null,
    geoStatus: cleanText(entity.geoStatus || entity.geoTier || 'UNCONFIRMED', 80),
    confidence: cleanText(entity.confidence || 'LOW', 20).toUpperCase(),
    evidenceIds: evidenceIdsOf(entity),
    limitations: asArray(entity.limitations).map(item => cleanText(item, 240)).filter(Boolean).slice(0, 3)
  };
}

function pickSignals(model = {}, types = [], limit = 5) {
  const wanted = new Set(types);
  return asArray(model.signals)
    .filter(signal => wanted.has(signal.type))
    .filter(signal => evidenceIdsOf(signal).length > 0)
    .map(compactSignal)
    .slice(0, limit);
}

function observedObservation(signal = {}) {
  const compact = compactSignal(signal);
  if (!compact.evidenceIds.length) return null;
  return {
    status: compact.status === SIGNAL_STATUS.INFERRED ? SIGNAL_STATUS.INFERRED : SIGNAL_STATUS.OBSERVED,
    title: compact.topic || compact.type,
    insight: compact.statement,
    confidence: compact.confidence,
    evidenceIds: compact.evidenceIds,
    sourceUrls: compact.sourceUrls,
    limitations: compact.limitations
  };
}

function buildMarketIn60Seconds(strategicAgentsV2 = {}, marketSignalModel = {}) {
  const agentObservations = asArray(strategicAgentsV2.marketPatternAnalyst?.observations)
    .map(observedObservation)
    .filter(Boolean);
  const fallbackObservations = asArray(marketSignalModel.signals)
    .map(observedObservation)
    .filter(Boolean);
  return uniq([...agentObservations, ...fallbackObservations].map(item => JSON.stringify(item)), 5)
    .map(item => JSON.parse(item));
}

function buildCustomerVoice(marketSignalModel = {}) {
  const quantified = asArray(marketSignalModel.customerVoice?.patterns)
    .filter(pattern => evidenceIdsOf(pattern).length > 0)
    .map(compactCustomerVoicePattern);
  if (quantified.length) {
    return {
      mode: 'quantified_evidence_patterns',
      pains: quantified.filter(pattern => pattern.type === SIGNAL_TYPES.CUSTOMER_PAIN).slice(0, 3),
      desires: quantified.filter(pattern => pattern.type === SIGNAL_TYPES.CUSTOMER_DESIRE).slice(0, 3),
      objections: quantified.filter(pattern => pattern.type === SIGNAL_TYPES.OBJECTION).slice(0, 3),
      buyingCriteria: quantified.filter(pattern => pattern.type === SIGNAL_TYPES.BUYING_CRITERION).slice(0, 3),
      complaints: quantified.filter(pattern => pattern.type === SIGNAL_TYPES.COMPLAINT).slice(0, 3),
      quality: {
        quantifiedFromEvidence: marketSignalModel.customerVoice?.quality?.quantifiedFromEvidence === true,
        patternCount: quantified.length,
        limitations: asArray(marketSignalModel.customerVoice?.quality?.limitations).slice(0, 4)
      }
    };
  }
  const signals = pickSignals(marketSignalModel, [
    SIGNAL_TYPES.CUSTOMER_PAIN,
    SIGNAL_TYPES.CUSTOMER_DESIRE,
    SIGNAL_TYPES.OBJECTION,
    SIGNAL_TYPES.BUYING_CRITERION,
    SIGNAL_TYPES.COMPLAINT
  ], 8);
  return {
    mode: 'signal_fallback',
    pains: signals.filter(signal => signal.type === SIGNAL_TYPES.CUSTOMER_PAIN).slice(0, 3),
    desires: signals.filter(signal => signal.type === SIGNAL_TYPES.CUSTOMER_DESIRE).slice(0, 3),
    objections: signals.filter(signal => signal.type === SIGNAL_TYPES.OBJECTION).slice(0, 3),
    buyingCriteria: signals.filter(signal => signal.type === SIGNAL_TYPES.BUYING_CRITERION).slice(0, 3),
    complaints: signals.filter(signal => signal.type === SIGNAL_TYPES.COMPLAINT).slice(0, 3)
  };
}

function buildSellerFight(marketSignalModel = {}) {
  const quantified = asArray(marketSignalModel.offerIntelligence?.patterns)
    .filter(pattern => evidenceIdsOf(pattern).length > 0)
    .map(compactOfferPattern);
  if (quantified.length) {
    return {
      mode: 'quantified_offer_patterns',
      pricing: quantified.filter(pattern => pattern.aspect === 'pricing').slice(0, 3),
      payment: quantified.filter(pattern => pattern.aspect === 'payment').slice(0, 3),
      fulfillment: quantified.filter(pattern => pattern.aspect === 'fulfillment').slice(0, 3),
      riskReversal: quantified.filter(pattern => pattern.aspect === 'risk_reversal').slice(0, 3),
      proof: quantified.filter(pattern => pattern.aspect === 'proof').slice(0, 3),
      offerMechanism: quantified.filter(pattern => pattern.aspect === 'offer_mechanism').slice(0, 3),
      featureSet: quantified.filter(pattern => pattern.aspect === 'feature_set').slice(0, 3),
      conversionPath: quantified.filter(pattern => pattern.aspect === 'conversion_path').slice(0, 3),
      offers: pickSignals(marketSignalModel, [SIGNAL_TYPES.OFFER_PATTERN], 4),
      features: pickSignals(marketSignalModel, [SIGNAL_TYPES.FEATURE_PATTERN], 4),
      messages: pickSignals(marketSignalModel, [SIGNAL_TYPES.MESSAGE_PATTERN], 4),
      quality: {
        quantifiedFromEvidence: marketSignalModel.offerIntelligence?.quality?.quantifiedFromEvidence === true,
        noInventedCommercialTerms: marketSignalModel.offerIntelligence?.quality?.noInventedCommercialTerms === true,
        patternCount: quantified.length,
        limitations: asArray(marketSignalModel.offerIntelligence?.quality?.limitations).slice(0, 4)
      }
    };
  }
  return {
    mode: 'signal_fallback',
    offers: pickSignals(marketSignalModel, [SIGNAL_TYPES.OFFER_PATTERN], 4),
    features: pickSignals(marketSignalModel, [SIGNAL_TYPES.FEATURE_PATTERN], 4),
    messages: pickSignals(marketSignalModel, [SIGNAL_TYPES.MESSAGE_PATTERN], 4)
  };
}

function buildSocialContentDeepDive(marketSignalModel = {}) {
  const quantified = asArray(marketSignalModel.socialContent?.patterns)
    .filter(pattern => evidenceIdsOf(pattern).length > 0)
    .map(compactSocialContentPattern);
  if (quantified.length) {
    return {
      mode: 'quantified_content_patterns',
      reviews: quantified.filter(pattern => pattern.format === 'review').slice(0, 4),
      tutorials: quantified.filter(pattern => pattern.format === 'tutorial').slice(0, 4),
      comparisons: quantified.filter(pattern => pattern.format === 'comparison').slice(0, 4),
      questions: quantified.filter(pattern => pattern.format === 'faq').slice(0, 4),
      proofContent: quantified.filter(pattern => pattern.format === 'proof').slice(0, 4),
      offers: quantified.filter(pattern => pattern.format === 'offer_post').slice(0, 4),
      freshSignals: quantified.filter(pattern => pattern.format === 'fresh_content').slice(0, 4),
      allPatterns: quantified.slice(0, 16),
      quality: {
        quantifiedFromEvidence: marketSignalModel.socialContent?.quality?.quantifiedFromEvidence === true,
        noInventedEngagementClaims: marketSignalModel.socialContent?.quality?.noInventedEngagementClaims === true,
        patternCount: quantified.length,
        limitations: asArray(marketSignalModel.socialContent?.quality?.limitations).slice(0, 4)
      }
    };
  }
  return {
    mode: 'raw_social_evidence_fallback',
    allPatterns: [],
    quality: {
      quantifiedFromEvidence: false,
      noInventedEngagementClaims: true,
      limitations: ['No quantified social content patterns were available; use raw evidence only.']
    }
  };
}

function compactAction(action = {}) {
  return {
    id: cleanText(action.id, 80),
    status: cleanText(action.status || 'RECOMMENDED_TEST', 60),
    title: cleanText(action.title, 180),
    action: cleanText(action.action, 360),
    why: cleanText(action.why, 300),
    impact: cleanText(action.impact || 'MEDIUM', 20).toUpperCase(),
    effort: cleanText(action.effort || 'MEDIUM', 20).toUpperCase(),
    signalIds: uniq(asArray(action.signalIds), 5),
    evidenceIds: evidenceIdsOf(action, 8),
    confidence: cleanText(action.confidence || 'LOW', 20).toUpperCase(),
    validationNeeded: cleanText(action.validationNeeded, 260),
    limitations: asArray(action.limitations).map(item => cleanText(item, 240)).filter(Boolean).slice(0, 4)
  };
}

function buildUnknowns(input = {}) {
  const marketSignalModel = input.marketSignalModel || {};
  const supplierIntelligence = input.marketEntityMap?.supplierIntelligence || input.supplierIntelligence || {};
  const temporalIntelligence = input.temporalIntelligence || {};
  return uniq([
    ...asArray(marketSignalModel.quality?.limitations),
    ...asArray(input.strategicAgentsV2?.marketPatternAnalyst?.unknowns),
    ...asArray(input.strategicAgentsV2?.gapAnalyst?.unknowns),
    ...asArray(input.strategicAgentsV2?.decisionStrategist?.unknowns),
    ...asArray(temporalIntelligence.unknowns),
    supplierIntelligence.status === 'UNKNOWN' ? 'Supplier intelligence is unknown until dedicated supplier evidence is collected.' : null
  ], 8);
}

function rawEvidenceIndex(input = {}) {
  const evidence = [
    ...asArray(input.evidenceRegistry?.evidence),
    ...asArray(input.marketEvidence?.evidenceRegistry?.evidence),
    ...asArray(input.agentReachEvidence?.evidenceRegistry?.evidence)
  ];
  return evidence.map(row => ({
    id: cleanText(row.id, 120),
    scope: cleanText(row.scope || 'MARKET', 40).toUpperCase(),
    claimType: cleanText(row.claimType || row.type, 80),
    value: cleanText(row.value || row.text || row.title || row.summary, 260),
    sourcePlatform: cleanText(row.sourcePlatform || row.sourceType || row.provider || 'unknown', 80).toLowerCase(),
    sourceUrl: cleanText(row.sourceUrl || row.url, 600) || null,
    publishedAt: cleanText(row.publishedAt, 80) || null,
    collectedAt: cleanText(row.collectedAt || row.observedAt, 80) || null,
    confidence: cleanText(row.confidence || 'LOW', 20).toUpperCase(),
    verificationStatus: cleanText(row.verificationStatus || row.status || 'NOT_VERIFIED', 80).toUpperCase()
  })).filter(row => row.id && row.value).slice(0, 80);
}

function buildDeepDive(input = {}) {
  const marketEntityMap = input.marketEntityMap || {};
  const entitiesByType = marketEntityMap.byType || {};
  return {
    socialContentIntelligence: buildSocialContentDeepDive(input.marketSignalModel || {}),
    socialContent: [
      ...asArray(entitiesByType.SUBSTITUTE),
      ...rawEvidenceIndex(input).filter(row => /youtube|reddit|facebook|instagram|x|social|review/i.test(row.sourcePlatform))
    ].slice(0, 20),
    supplierLandscape: input.supplierIntelligence || marketEntityMap.supplierIntelligence || {
      status: 'UNKNOWN',
      limitations: ['No supplier evidence collected.']
    },
    substitutes: asArray(entitiesByType.SUBSTITUTE).map(compactEntity).slice(0, 20),
    channelEvidence: rawEvidenceIndex(input)
      .filter(row => /ads|serp|shopping|youtube|facebook|instagram|reddit|rss|maps|gsc/i.test(`${row.sourcePlatform} ${row.claimType}`))
      .slice(0, 30),
    marketWords: uniq([
      ...asArray(input.marketSignalModel?.signals).map(signal => signal.topic),
      ...asArray(input.relatedSearches),
      ...asArray(input.peopleAlsoAsk).map(item => item.question || item)
    ], 30),
    geoEvidence: {
      target: input.country || input.geo || null,
      audit: input.geoSourceAudit || null,
      entities: [
        ...asArray(entitiesByType.DIRECT_COMPETITOR),
        ...asArray(entitiesByType.LOCAL_SELLER),
        ...asArray(entitiesByType.REGIONAL_BENCHMARK)
      ].map(compactEntity).slice(0, 20)
    },
    temporalIntelligence: input.temporalIntelligence || {
      status: 'UNKNOWN',
      unknowns: ['Temporal intelligence was not available for this report.']
    },
    rawEvidence: rawEvidenceIndex(input)
  };
}

function textBlob(value) {
  return cleanText(JSON.stringify(value || {}), 20000);
}

function validateDecisionReportV2(report = {}) {
  const main = report.mainReport || {};
  const issues = [];
  const observed = [
    ...asArray(main.marketIn60Seconds),
    ...asArray(main.saturatedPatterns)
  ];
  observed.forEach((item, index) => {
    if (item.status === SIGNAL_STATUS.OBSERVED && !evidenceIdsOf(item).length) {
      issues.push({
        severity: 'high',
        code: 'OBSERVED_WITHOUT_EVIDENCE',
        path: `mainReport.observed[${index}]`,
        message: 'Observed report items must carry evidenceIds.'
      });
    }
  });
  asArray(main.opportunityGaps).forEach((gap, index) => {
    if (!evidenceIdsOf(gap).length || !asArray(gap.limitations).length) {
      issues.push({
        severity: 'medium',
        code: 'GAP_WITHOUT_LIMITATION_OR_EVIDENCE',
        path: `mainReport.opportunityGaps[${index}]`,
        message: 'Opportunity gaps must remain evidence-backed and limited.'
      });
    }
  });
  asArray(main.priorityActions).forEach((action, index) => {
    if (action.status !== 'RECOMMENDED_TEST' || !evidenceIdsOf(action).length || !asArray(action.signalIds).length) {
      issues.push({
        severity: 'high',
        code: 'UNTRACEABLE_ACTION',
        path: `mainReport.priorityActions[${index}]`,
        message: 'Strategic actions must be recommended tests tied to signals and evidence.'
      });
    }
  });
  if (asArray(main.marketIn60Seconds).length > 5) {
    issues.push({ severity: 'medium', code: 'TOO_MANY_TOP_OBSERVATIONS', path: 'mainReport.marketIn60Seconds' });
  }
  if (asArray(main.opportunityGaps).length > 3) {
    issues.push({ severity: 'medium', code: 'TOO_MANY_GAPS', path: 'mainReport.opportunityGaps' });
  }
  if (asArray(main.priorityActions).length > 3) {
    issues.push({ severity: 'medium', code: 'TOO_MANY_ACTIONS', path: 'mainReport.priorityActions' });
  }
  const forbidden = [
    /market leader/i,
    /\b100\s*%\s*dominance\b/i,
    /dominance\s*100\s*%/i,
    /demand growth/i,
    /growing demand/i,
    /sales growth/i,
    /croissance de la demande/i,
    /leader du marche/i
  ];
  const visibleText = textBlob(main);
  forbidden.forEach(pattern => {
    if (pattern.test(visibleText)) {
      issues.push({
        severity: 'high',
        code: 'UNSUPPORTED_STRONG_MARKET_CLAIM',
        path: 'mainReport',
        message: `Forbidden unsupported wording matched ${pattern}.`
      });
    }
  });
  const supplier = report.deepDive?.supplierLandscape || {};
  if (supplier.status === 'CONFIRMED' && !asArray(supplier.evidenceIds).length) {
    issues.push({
      severity: 'high',
      code: 'SUPPLIER_CONFIRMED_WITHOUT_EVIDENCE',
      path: 'deepDive.supplierLandscape',
      message: 'Supplier intelligence cannot be confirmed without supplier evidence.'
    });
  }
  return {
    status: issues.some(issue => issue.severity === 'high') ? 'downgraded' : 'approved',
    issues,
    coverage: {
      topObservations: asArray(main.marketIn60Seconds).length,
      opportunityGaps: asArray(main.opportunityGaps).length,
      priorityActions: asArray(main.priorityActions).length,
      rawEvidence: asArray(report.deepDive?.rawEvidence).length,
      observedWithoutEvidence: issues.filter(issue => issue.code === 'OBSERVED_WITHOUT_EVIDENCE').length
    }
  };
}

function buildDecisionReportV2(input = {}) {
  const marketSignalModel = input.marketSignalModel || {};
  const strategicAgentsV2 = input.strategicAgentsV2 || {};
  const marketEntityMap = input.marketEntityMap || {};
  const entitiesByType = marketEntityMap.byType || {};
  const observations = buildMarketIn60Seconds(strategicAgentsV2, marketSignalModel);
  const opportunityGaps = asArray(strategicAgentsV2.gapAnalyst?.gaps)
    .map(compactSignal)
    .filter(gap => gap.evidenceIds.length > 0)
    .slice(0, 3);
  const actions = asArray(strategicAgentsV2.decisionStrategist?.actions)
    .map(compactAction)
    .filter(action => action.status === 'RECOMMENDED_TEST' && action.evidenceIds.length > 0 && action.signalIds.length > 0)
    .slice(0, 3);
  const competitors = [
    ...asArray(entitiesByType.DIRECT_COMPETITOR),
    ...asArray(entitiesByType.LOCAL_SELLER),
    ...asArray(entitiesByType.REGIONAL_BENCHMARK),
    ...asArray(entitiesByType.MARKETPLACE)
  ].map(compactEntity).slice(0, 12);
  const saturatedPatterns = asArray(strategicAgentsV2.gapAnalyst?.saturatedPatterns)
    .map(compactSignal)
    .filter(signal => signal.evidenceIds.length > 0)
    .slice(0, 4);
  const unknowns = buildUnknowns(input);
  const deepDive = buildDeepDive(input);

  const report = {
    version: 'decision-report-v2',
    generatedAt: new Date().toISOString(),
    mode: 'executive_first_deep_dive_on_demand',
    inputs: {
      query: cleanText(input.query || input.originalQuery || input.localizedQuery, 180) || null,
      country: cleanText(input.country || input.geo, 90) || null,
      lang: cleanText(input.lang || 'fr', 20)
    },
    mainReport: {
      marketIn60Seconds: observations,
      customerVoice: buildCustomerVoice(marketSignalModel),
      sellerFight: buildSellerFight(marketSignalModel),
      classifiedCompetitors: competitors,
      saturatedPatterns,
      opportunityGaps,
      priorityActions: actions,
      unknowns
    },
    deepDive,
    quality: {
      evidenceFirst: true,
      observationsWithEvidence: observations.every(item => evidenceIdsOf(item).length > 0),
      maxFiveObservations: observations.length <= 5,
      maxThreeGaps: opportunityGaps.length <= 3,
      maxThreeActions: actions.length <= 3,
      actionsAreTests: actions.every(action => action.status === 'RECOMMENDED_TEST'),
      temporalClaimsBounded: input.temporalIntelligence?.quality?.noDemandGrowthClaim !== false,
      noObservedClaimWithoutEvidence: [
        ...observations,
        ...saturatedPatterns
      ].every(item => item.status !== SIGNAL_STATUS.OBSERVED || evidenceIdsOf(item).length > 0),
      supplierUnknownWhenUnproven: deepDive.supplierLandscape?.status !== 'CONFIRMED',
      deepDivePreserved: Boolean(deepDive.rawEvidence.length || deepDive.substitutes.length || deepDive.channelEvidence.length)
    }
  };
  report.claimValidation = validateDecisionReportV2(report);
  report.quality.claimValidationApproved = report.claimValidation.status === 'approved';
  return report;
}

module.exports = {
  buildDecisionReportV2,
  validateDecisionReportV2
};
