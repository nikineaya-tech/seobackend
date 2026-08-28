function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hostOf(value = '') {
  try {
    return new URL(String(value).startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return String(value || '').replace(/^www\./i, '').toLowerCase();
  }
}

function sourceDiversity(rows = []) {
  return new Set(asArray(rows).map(row => row.sourcePlatform || hostOf(row.sourceUrl) || row.id).filter(Boolean)).size;
}

function domainDiversity(rows = []) {
  return new Set(asArray(rows).map(row => hostOf(row.sourceUrl || row.entityId)).filter(Boolean)).size;
}

function hasFreshEvidence(rows = []) {
  return asArray(rows).some(row => row.publishedAt || row.observedAt || row.collectedAt);
}

function hasGeoRelevantEvidence(rows = []) {
  return asArray(rows).some(row => /LOCAL|DIRECT|LY|Libya|Maroc|Morocco/i.test(`${row.scope} ${row.country} ${row.geoTier} ${row.value}`));
}

function confidenceFor(parts = {}) {
  const rows = asArray(parts.rows);
  const platforms = sourceDiversity(rows);
  const domains = domainDiversity(rows);
  const evidenceCount = rows.length;
  if (evidenceCount >= 8 && platforms >= 3 && domains >= 3) return 'HIGH';
  if (evidenceCount >= 4 && platforms >= 2 && domains >= 2) return 'MEDIUM';
  return 'LOW';
}

function scoreInsight({ evidence = [], crossSourceCount = 2, relationStrength = 1, specificity = 1, confidence = 'LOW' } = {}) {
  const confidenceScore = { HIGH: 20, MEDIUM: 13, LOW: 6 }[confidence] || 6;
  const evidenceScore = Math.min(25, asArray(evidence).length * 3);
  const crossScore = Math.min(15, Math.max(0, crossSourceCount - 1) * 6);
  const relationScore = Math.min(15, Math.round(relationStrength * 15));
  const specificityScore = Math.min(10, Math.round(specificity * 10));
  const actionabilityScore = 8;
  const freshnessScore = hasFreshEvidence(evidence) ? 4 : 0;
  const geoScore = hasGeoRelevantEvidence(evidence) ? 3 : 0;
  return Math.max(1, Math.min(100, confidenceScore + evidenceScore + crossScore + relationScore + specificityScore + actionabilityScore + freshnessScore + geoScore));
}

function scoreBreakdown({ evidence = [], crossSourceCount = 2, relationStrength = 1, specificity = 1 } = {}) {
  const rows = asArray(evidence);
  return {
    formula: 'evidenceStrength 25 + crossSourceDiversity 15 + crossDimensionDepth 15 + businessImpact 15 + actionability 10 + novelty 10 + freshness 5 + geoRelevance 5',
    evidenceStrengthScore: Number(Math.min(1, rows.length / 9).toFixed(2)),
    crossSourceDiversityScore: Number(Math.min(1, Math.max(0, crossSourceCount - 1) / 3).toFixed(2)),
    crossDimensionDepthScore: Number(Math.min(1, relationStrength).toFixed(2)),
    businessImpactScore: Number(Math.min(1, relationStrength).toFixed(2)),
    actionabilityScore: 0.8,
    noveltyScore: Number(Math.min(1, specificity).toFixed(2)),
    freshnessScore: hasFreshEvidence(rows) ? 0.8 : 0.2,
    geoRelevanceScore: hasGeoRelevantEvidence(rows) ? 0.8 : 0.35
  };
}

module.exports = {
  confidenceFor,
  scoreInsight,
  scoreBreakdown,
  sourceDiversity,
  domainDiversity
};
