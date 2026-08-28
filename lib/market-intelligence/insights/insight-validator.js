function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanText(value, max = 300) {
  return String(value == null ? '' : value)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
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

function validateInsights(insights = []) {
  const issues = [];
  asArray(insights).forEach((insight, index) => {
    if (!asArray(insight.evidenceIds).length) {
      issues.push({ severity: 'high', code: 'INSIGHT_WITHOUT_EVIDENCE', path: `insights[${index}]` });
    }
    if (isGenericAdvice(`${insight.title} ${insight.finding} ${insight.interpretation} ${insight.decisionTest}`)) {
      issues.push({ severity: 'high', code: 'GENERIC_ADVICE_AS_INSIGHT', path: `insights[${index}]` });
    }
    const uniquePlatforms = new Set(asArray(insight.sourcePlatforms).filter(Boolean)).size;
    if (insight.confidence === 'HIGH' && uniquePlatforms < 2) {
      issues.push({ severity: 'medium', code: 'HIGH_CONFIDENCE_LOW_SOURCE_DIVERSITY', path: `insights[${index}]` });
    }
  });
  return {
    status: issues.some(issue => issue.severity === 'high') ? 'downgraded' : 'approved',
    issues
  };
}

module.exports = {
  GENERIC_ADVICE_PATTERNS,
  isGenericAdvice,
  validateInsights
};
