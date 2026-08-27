'use strict';

const { evidenceRowsFrom, SIGNAL_STATUS } = require('./signal-engine');

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

function evidenceIdsOf(value = {}) {
  return [
    ...asArray(value.evidenceIds),
    ...asArray(value.evidence_ids),
    ...asArray(value.sources).flatMap(source => evidenceIdsOf(source))
  ].map(item => cleanText(item, 120)).filter(Boolean);
}

function hasActionableText(value = {}) {
  return Boolean(cleanText(value.value || value.statement || value.action || value.insight || value.title, 40));
}

function severityFor(code) {
  if (/OBSERVED|RECOMMENDED_FACT|EVIDENCE_ROW_EMPTY/.test(code)) return 'high';
  if (/INFERRED|NOT_FOUND/.test(code)) return 'medium';
  return 'low';
}

function issue(code, path, message) {
  return { severity: severityFor(code), code, path, message };
}

function auditEvidenceRows(input = {}) {
  const rows = evidenceRowsFrom(input);
  const issues = [];
  rows.forEach((row, index) => {
    const path = `evidence[${index}]`;
    if (!row.id || !hasActionableText(row)) {
      issues.push(issue('EVIDENCE_ROW_EMPTY', path, 'Evidence rows need an id and usable text.'));
    }
    if (!row.sourceUrl && !row.sourcePlatform) {
      issues.push(issue('EVIDENCE_ROW_SOURCE_MISSING', path, 'Evidence rows need a sourceUrl or sourcePlatform.'));
    }
    if (/CONFIRMED|OBSERVED/.test(row.verificationStatus) && !cleanText(row.sourceUrl || row.sourcePlatform)) {
      issues.push(issue('CONFIRMED_EVIDENCE_SOURCE_MISSING', path, 'Confirmed evidence must remain source traceable.'));
    }
    if (/NOT_FOUND|ABSENT/.test(row.verificationStatus) && !/not_found|missing|weak|gap/i.test(row.claimType)) {
      issues.push(issue('NOT_FOUND_STATUS_ON_FACT_CLAIM', path, 'Not-found evidence must be represented as inspected-page limitation, not confirmed absence.'));
    }
  });
  return { rows, issues };
}

function shouldAuditClaim(node = {}) {
  return node && typeof node === 'object' && !Array.isArray(node) && (
    node.status ||
    node.verificationStatus ||
    node.statement ||
    node.insight ||
    node.action ||
    node.claimType
  );
}

function claimStatus(node = {}) {
  const raw = cleanText(node.status || node.verificationStatus, 80).toUpperCase();
  if (/OBSERVED|CONFIRMED/.test(raw)) return 'OBSERVED';
  if (/INFERRED|PARTIAL|NOT_FOUND_ON_INSPECTED_PAGE/.test(raw)) return 'INFERRED';
  if (/RECOMMENDED|TEST/.test(raw)) return 'RECOMMENDED';
  if (/UNKNOWN|NOT_VERIFIED|INSUFFICIENT/.test(raw)) return 'UNKNOWN';
  return raw || null;
}

function auditClaimNode(node = {}, path = '$') {
  const issues = [];
  const status = claimStatus(node);
  const evidenceIds = evidenceIdsOf(node);
  const limitations = asArray(node.limitations).map(item => cleanText(item, 240)).filter(Boolean);
  const confidence = cleanText(node.confidence, 20);

  if (status === 'OBSERVED' && !evidenceIds.length && hasActionableText(node)) {
    issues.push(issue('OBSERVED_CLAIM_WITHOUT_EVIDENCE', path, 'OBSERVED/CONFIRMED claims must carry evidenceIds.'));
  }
  if (status === 'INFERRED' && hasActionableText(node)) {
    if (!evidenceIds.length) issues.push(issue('INFERRED_CLAIM_WITHOUT_EVIDENCE', path, 'INFERRED claims need supporting evidenceIds.'));
    if (!limitations.length) issues.push(issue('INFERRED_CLAIM_WITHOUT_LIMITATION', path, 'INFERRED claims need explicit limitations.'));
    if (!confidence) issues.push(issue('INFERRED_CLAIM_WITHOUT_CONFIDENCE', path, 'INFERRED claims need confidence.'));
  }
  if (status === 'RECOMMENDED' && !/RECOMMENDED_TEST/i.test(cleanText(node.status, 80))) {
    issues.push(issue('RECOMMENDATION_NOT_MARKED_AS_TEST', path, 'Recommendations must be marked as tests, not facts.'));
  }
  return issues;
}

function walkClaims(value, path = '$', seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const issues = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      issues.push(...walkClaims(item, `${path}[${index}]`, seen));
    });
    return issues;
  }
  if (shouldAuditClaim(value)) {
    issues.push(...auditClaimNode(value, path));
  }
  Object.entries(value).forEach(([key, child]) => {
    if (['rawEvidence', 'evidenceRegistry'].includes(key)) return;
    issues.push(...walkClaims(child, `${path}.${key}`, seen));
  });
  return issues;
}

function auditMarketEvidenceContract(input = {}) {
  const evidenceAudit = auditEvidenceRows(input);
  const claimTargets = {
    marketSignalModel: input.marketSignalModel,
    temporalIntelligence: input.temporalIntelligence,
    strategicAgentsV2: input.strategicAgentsV2,
    decisionReportV2: input.decisionReportV2,
    marketEntityMap: input.marketEntityMap
  };
  const claimIssues = walkClaims(claimTargets);
  const issues = [...evidenceAudit.issues, ...claimIssues];
  const high = issues.filter(item => item.severity === 'high').length;
  const medium = issues.filter(item => item.severity === 'medium').length;
  return {
    version: 'market-evidence-contract-v1',
    generatedAt: new Date().toISOString(),
    status: high ? 'failed' : medium ? 'warnings' : 'approved',
    evidenceRows: evidenceAudit.rows.length,
    issues,
    summary: {
      high,
      medium,
      low: issues.filter(item => item.severity === 'low').length,
      observedClaimIssues: issues.filter(item => item.code === 'OBSERVED_CLAIM_WITHOUT_EVIDENCE').length,
      inferredClaimIssues: issues.filter(item => /^INFERRED/.test(item.code)).length,
      recommendedFactIssues: issues.filter(item => item.code === 'RECOMMENDATION_NOT_MARKED_AS_TEST').length
    },
    rules: {
      observedRequiresEvidence: true,
      inferredRequiresEvidenceConfidenceAndLimitations: true,
      recommendationIsTestNotFact: true,
      notFoundIsNotAbsence: true,
      unknownAllowedWhenEvidenceIsInsufficient: true
    },
    quality: {
      evidenceFirst: true,
      noObservedWithoutEvidence: !issues.some(item => item.code === 'OBSERVED_CLAIM_WITHOUT_EVIDENCE'),
      recommendationsRemainTests: !issues.some(item => item.code === 'RECOMMENDATION_NOT_MARKED_AS_TEST'),
      notFoundDoesNotBecomeAbsence: !issues.some(item => item.code === 'NOT_FOUND_STATUS_ON_FACT_CLAIM')
    }
  };
}

module.exports = {
  auditMarketEvidenceContract,
  auditEvidenceRows,
  walkClaims
};
