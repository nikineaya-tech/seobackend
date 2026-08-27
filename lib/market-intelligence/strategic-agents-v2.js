'use strict';

const { SIGNAL_TYPES, SIGNAL_STATUS } = require('./signal-engine');

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanText(value, max = 1000) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function uniq(values = [], limit = 12) {
  const seen = new Set();
  const out = [];
  asArray(values).forEach(value => {
    const text = cleanText(value, 280);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  });
  return out.slice(0, limit);
}

function confidenceRank(value) {
  if (String(value).toUpperCase() === 'HIGH') return 3;
  if (String(value).toUpperCase() === 'MEDIUM') return 2;
  return 1;
}

function usableSignals(marketSignalModel = {}) {
  return asArray(marketSignalModel.signals)
    .filter(signal => asArray(signal.evidenceIds).length > 0)
    .sort((a, b) => {
      return (confidenceRank(b.confidence) - confidenceRank(a.confidence)) || ((b.count || 0) - (a.count || 0));
    });
}

function compactSignal(signal = {}) {
  return {
    signalId: signal.id,
    type: signal.type,
    topic: signal.topic,
    status: signal.status,
    statement: cleanText(signal.statement, 320),
    count: Number(signal.count || 0),
    confidence: signal.confidence || 'LOW',
    evidenceIds: asArray(signal.evidenceIds).slice(0, 8),
    sourceUrls: asArray(signal.sourceUrls).slice(0, 5),
    limitations: asArray(signal.limitations).slice(0, 3)
  };
}

function buildMarketPatternAnalyst(marketSignalModel = {}) {
  const signals = usableSignals(marketSignalModel);
  const priorityTypes = [
    SIGNAL_TYPES.CUSTOMER_PAIN,
    SIGNAL_TYPES.OBJECTION,
    SIGNAL_TYPES.BUYING_CRITERION,
    SIGNAL_TYPES.OFFER_PATTERN,
    SIGNAL_TYPES.FEATURE_PATTERN,
    SIGNAL_TYPES.MESSAGE_PATTERN,
    SIGNAL_TYPES.EMERGING_SIGNAL
  ];
  const observations = [];
  priorityTypes.forEach(type => {
    const picked = signals.find(signal => signal.type === type && !observations.some(item => item.signalId === signal.id));
    if (picked) observations.push(compactSignal(picked));
  });
  return {
    role: 'Market Pattern Analyst',
    rule: 'Analyze validated market signals only.',
    observations: observations.slice(0, 5),
    unknowns: [
      ...(marketSignalModel?.quality?.hasTemporalEvidence ? [] : ['No dated signal strong enough for temporal comparison.']),
      ...(signals.length ? [] : ['No market signal available after evidence filtering.'])
    ],
    sourceEvidenceCount: Number(marketSignalModel?.sourceEvidenceCount || 0),
    sourceDiversity: Number(marketSignalModel?.sourceDiversity || 0)
  };
}

function buildGapAnalyst(marketSignalModel = {}) {
  const signals = usableSignals(marketSignalModel);
  const gaps = signals
    .filter(signal => signal.type === SIGNAL_TYPES.COMPETITIVE_GAP)
    .map(compactSignal)
    .slice(0, 3);
  const saturatedPatterns = signals
    .filter(signal => [
      SIGNAL_TYPES.OFFER_PATTERN,
      SIGNAL_TYPES.MESSAGE_PATTERN,
      SIGNAL_TYPES.FEATURE_PATTERN
    ].includes(signal.type) && Number(signal.count || 0) >= 2)
    .map(compactSignal)
    .slice(0, 4);
  return {
    role: 'Gap Analyst',
    rule: 'Call something a gap only when the signal carries evidence and limitations.',
    gaps,
    saturatedPatterns,
    unknowns: gaps.length ? [] : ['No opportunity gap can be stated from the current evidence sample.']
  };
}

function actionTemplate(topic = '') {
  if (/price|payment|cod/.test(topic)) {
    return {
      title: 'Clarify price and payment risk',
      action: 'Put confirmed price, payment method, refund terms and purchase conditions in one visible decision block.',
      impact: 'HIGH',
      effort: 'LOW'
    };
  }
  if (/guarantee|reviews_proof/.test(topic)) {
    return {
      title: 'Make proof visible before the CTA',
      action: 'Show verifiable reviews, guarantee terms, before-after proof or a concrete use case before asking for the order.',
      impact: 'HIGH',
      effort: 'MEDIUM'
    };
  }
  if (/delivery|availability|support|local/.test(topic)) {
    return {
      title: 'Remove local execution uncertainty',
      action: 'Make availability, delivery area, response time and support route explicit, then test that message against the visible competitors.',
      impact: 'MEDIUM',
      effort: 'LOW'
    };
  }
  if (/feature_|skin_result/.test(topic)) {
    return {
      title: 'Turn product features into proof',
      action: 'Demonstrate the observed feature with a short visual proof, usage context and the risk it removes for the buyer.',
      impact: 'MEDIUM',
      effort: 'MEDIUM'
    };
  }
  if (/education_method/.test(topic)) {
    return {
      title: 'Show the method, not the promise',
      action: 'Expose the step-by-step curriculum, local examples and practical output so the buyer sees what will be built.',
      impact: 'HIGH',
      effort: 'MEDIUM'
    };
  }
  return {
    title: 'Test one evidence-backed angle',
    action: 'Transform this signal into one landing section, one ad hook and one proof block, then validate response before scaling.',
    impact: 'MEDIUM',
    effort: 'LOW'
  };
}

function actionFromSignal(signal = {}, index = 0) {
  const template = actionTemplate(signal.topic || '');
  return {
    id: `decision_action_${index + 1}`,
    status: 'RECOMMENDED_TEST',
    title: template.title,
    action: template.action,
    why: cleanText(signal.statement, 320),
    signalIds: [signal.id].filter(Boolean),
    evidenceIds: asArray(signal.evidenceIds).slice(0, 8),
    confidence: signal.confidence || 'LOW',
    impact: template.impact,
    effort: template.effort,
    validationNeeded: 'Validate with fresh response data before treating this as a proven growth lever.',
    limitations: uniq([
      ...asArray(signal.limitations),
      'Recommendation is an experiment derived from evidence-backed signals, not an observed market fact.'
    ], 4)
  };
}

function buildDecisionStrategist(marketSignalModel = {}, { maxActions = 3 } = {}) {
  const signals = usableSignals(marketSignalModel);
  const candidates = [
    ...signals.filter(signal => signal.type === SIGNAL_TYPES.COMPETITIVE_GAP),
    ...signals.filter(signal => signal.type === SIGNAL_TYPES.OBJECTION),
    ...signals.filter(signal => signal.type === SIGNAL_TYPES.BUYING_CRITERION),
    ...signals.filter(signal => signal.type === SIGNAL_TYPES.CUSTOMER_PAIN),
    ...signals.filter(signal => signal.type === SIGNAL_TYPES.OFFER_PATTERN)
  ];
  const seen = new Set();
  const actions = [];
  candidates.forEach(signal => {
    const key = `${signal.type}:${signal.topic}`;
    if (actions.length >= maxActions || seen.has(key) || !asArray(signal.evidenceIds).length) return;
    seen.add(key);
    actions.push(actionFromSignal(signal, actions.length));
  });
  return {
    role: 'Decision Strategist',
    rule: 'Produce at most three actions, each connected to signalIds and evidenceIds.',
    actions,
    unknowns: actions.length ? [] : ['No action generated because no evidence-backed signal passed the gate.']
  };
}

function runStrategicAgentsV2(input = {}) {
  const marketSignalModel = input.marketSignalModel || {};
  const patternAnalyst = buildMarketPatternAnalyst(marketSignalModel);
  const gapAnalyst = buildGapAnalyst(marketSignalModel);
  const decisionStrategist = buildDecisionStrategist(marketSignalModel, {
    maxActions: input.maxActions || 3
  });
  const allActionsTraceable = decisionStrategist.actions.every(action =>
    asArray(action.signalIds).length > 0 && asArray(action.evidenceIds).length > 0
  );
  return {
    version: 'strategic-agents-v2',
    generatedAt: new Date().toISOString(),
    inputs: {
      query: cleanText(input.query, 180) || null,
      country: cleanText(input.country, 90) || null,
      signalCount: asArray(marketSignalModel.signals).length,
      signalTypes: asArray(marketSignalModel.signalTypes),
      evidenceCount: Number(marketSignalModel.sourceEvidenceCount || 0)
    },
    marketPatternAnalyst: patternAnalyst,
    gapAnalyst,
    decisionStrategist,
    quality: {
      evidenceFirst: true,
      allActionsTraceable,
      maxThreeActions: decisionStrategist.actions.length <= 3,
      noUncheckedFrameworks: true,
      noMarketGrowthClaim: marketSignalModel?.quality?.noMarketGrowthClaim !== false,
      unsupportedActionCount: decisionStrategist.actions.filter(action => !asArray(action.evidenceIds).length).length
    }
  };
}

module.exports = {
  buildMarketPatternAnalyst,
  buildGapAnalyst,
  buildDecisionStrategist,
  runStrategicAgentsV2
};
