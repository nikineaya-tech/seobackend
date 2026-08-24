'use strict';

function safeText(value, max = 320) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeArray(value, max = 8) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  raw.flat(Infinity).forEach(item => {
    const text = typeof item === 'object' && item
      ? safeText(item.value || item.name || item.title || item.need || item.id || '')
      : safeText(item);
    if (text && !out.some(x => x.toLowerCase() === text.toLowerCase())) out.push(text);
  });
  return out.slice(0, max);
}

function normalize(value) {
  return safeText(value, 800)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}

function tokenSet(value) {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'buyer', 'persona',
    'avec', 'pour', 'dans', 'les', 'des', 'une', 'qui', 'que', 'sans',
    'على', 'عن', 'في', 'من', 'الى', 'إلى', 'شخصية', 'العميل'
  ]);
  return new Set(normalize(value).split(' ').filter(t => t.length > 2 && !stop.has(t)));
}

function overlapScore(a, b) {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  aa.forEach(t => { if (bb.has(t)) overlap += 1; });
  return overlap / Math.min(aa.size, bb.size);
}

const ANGLE_AS_SEGMENT = /(^|\b)(proof seeker|trust seeker|budget buyer|budget sensitive|comparison shopper|comparator|decision maker|expertise seeker|chercheur de confiance|sensible au budget|comparateur|chercheuse de preuve|طالب الثقة|الباحث عن الدليل|حساس للميزانية|المقارن قبل القرار|صاحب القرار)(\b|$)/i;

function segmentStrategicBasis(segment = {}) {
  const text = normalize(`${segment.id || ''} ${segment.name || ''} ${segment.type || ''} ${segment.need || ''} ${safeArray(segment.buyingTriggers, 6).join(' ')}`);
  const dimensions = [];
  if (/local|geo|near|ville|city|region|maroc|morocco|libya|tunisia|biougra|محلي|قريب|مدينة|المغرب|ليبيا|تونس/.test(text)) dimensions.push('geography');
  if (/beginner|debut|début|merchant|commerc|employee|founder|store|boutique|business|b2b|service|agency|مبتد|تاجر|موظف|متجر|شركة|وكالة/.test(text)) dimensions.push('market_context');
  if (/need|jtbd|job|solve|learn|launch|sell|buy|digital|skill|outcome|يريد|يحتاج|إطلاق|بيع|شراء|تعلم/.test(text)) dimensions.push('need_jtbd');
  if (/trigger|pressure|competitor|urgent|ready|problem|pain|intent|search|طلب|بحث|ضغط|مشكلة|جاهز/.test(text)) dimensions.push('trigger_intent');
  if (/seo|serp|meta|whatsapp|linkedin|youtube|maps|marketplace|channel|قناة|واتساب|يوتيوب/.test(text)) dimensions.push('reachability');
  if (/cod|payment|budget|price|proof|guarantee|supplier|method|support|دفع|سعر|دليل|ضمان|مورد|منهج/.test(text)) dimensions.push('decision_criteria');
  return [...new Set(dimensions)];
}

function validateSegment(segment = {}) {
  const basis = segmentStrategicBasis(segment);
  const name = safeText(segment.name || segment.id, 160);
  const angleLabelOnly = ANGLE_AS_SEGMENT.test(name);
  const valid = Boolean(segment.id && name && safeText(segment.need, 80) && basis.length >= 2 && !angleLabelOnly);
  return {
    valid,
    basis,
    reason: valid
      ? 'strategically_distinct_market_condition'
      : angleLabelOnly
        ? 'ANGLE_LABEL_USED_AS_SEGMENT'
        : 'SEGMENT_LACKS_STRATEGIC_BASIS'
  };
}

function mergeDuplicateSegments(segments = []) {
  const kept = [];
  const rejected = [];
  segments.forEach((segment, index) => {
    const validation = validateSegment(segment);
    const candidate = {
      ...segment,
      id: safeText(segment.id || `segment-${index + 1}`, 80),
      validation
    };
    if (!validation.valid) {
      rejected.push({ id: candidate.id, name: candidate.name, reason: validation.reason });
      return;
    }
    const duplicate = kept.find(existing => {
      const basisOverlap = validation.basis.filter(item => existing.validation?.basis?.includes(item)).length;
      const textOverlap = overlapScore(`${candidate.name} ${candidate.need}`, `${existing.name} ${existing.need}`);
      return textOverlap > 0.68 && basisOverlap >= 2;
    });
    if (duplicate) {
      duplicate.buyingTriggers = safeArray([...(duplicate.buyingTriggers || []), ...(candidate.buyingTriggers || [])], 8);
      duplicate.evidence = safeArray([...(duplicate.evidence || []), ...(candidate.evidence || []), `Merged: ${candidate.name}`], 8);
      duplicate.mergedSegmentIds = safeArray([...(duplicate.mergedSegmentIds || []), candidate.id], 8);
      rejected.push({ id: candidate.id, name: candidate.name, mergedInto: duplicate.id, reason: 'MERGED_NO_MATERIAL_STRATEGY_CHANGE' });
      return;
    }
    kept.push(candidate);
  });
  return { segments: kept, rejected };
}

function statusForRank(score, rank) {
  if (rank === 0 && score >= 50) return 'PRIMARY_TARGET';
  if (rank === 1 && score >= 48) return 'SECONDARY_TARGET';
  if (score >= 54) return 'EXPERIMENTAL_TARGET';
  if (score >= 42) return 'LOW_PRIORITY';
  return 'REJECTED';
}

function buildTargeting(segments = [], { budget = '', competitorData = {} } = {}) {
  const competitorCount = Number(competitorData?.top10Competitors?.length || competitorData?.competitors?.length || 0);
  const sourceCount = Number(competitorData?.observedUrls?.length || competitorData?.marketSources?.length || 0);
  const budgetText = normalize(budget);
  const leanBudget = /petit|small|lean|low|faible|محدود|صغير/.test(budgetText);
  const scored = segments.map(segment => {
    const base = Number(segment.scores?.total || segment.fitScore || 50);
    const basis = segment.validation?.basis || segmentStrategicBasis(segment);
    const productFit = clamp(base + (basis.includes('need_jtbd') ? 12 : 0));
    const problemIntensity = clamp(42 + (basis.includes('trigger_intent') ? 24 : 0) + (competitorCount ? 6 : 0));
    const purchaseIntent = clamp(42 + (/buy|acheter|achat|شراء|ready|intent|طلب/i.test(`${segment.id} ${segment.name} ${segment.need}`) ? 26 : 0));
    const reachability = clamp(40 + (basis.includes('reachability') ? 24 : 0) + (leanBudget && /seo|serp|whatsapp|content|youtube/i.test(safeArray(segment.accessChannels, 8).join(' ')) ? 10 : 0));
    const differentiationPotential = clamp(44 + (basis.includes('market_context') ? 18 : 0) + (basis.includes('decision_criteria') ? 12 : 0));
    const evidenceStrength = clamp(34 + Math.min(30, safeArray(segment.evidence, 8).length * 7) + Math.min(20, sourceCount * 3));
    const commercialPotential = clamp((productFit * 0.32) + (purchaseIntent * 0.28) + (problemIntensity * 0.18) + (differentiationPotential * 0.22));
    const risk = clamp(100 - evidenceStrength + (competitorData?.dataIntegrity?.riskLevel === 'HIGH' ? 18 : 0));
    const targetScore = Math.round(
      productFit * 0.20 +
      problemIntensity * 0.16 +
      purchaseIntent * 0.18 +
      reachability * 0.16 +
      differentiationPotential * 0.14 +
      evidenceStrength * 0.08 +
      commercialPotential * 0.08 -
      risk * 0.08
    );
    return {
      ...segment,
      targetScores: {
        productFit: Math.round(productFit),
        problemIntensity: Math.round(problemIntensity),
        purchaseIntent: Math.round(purchaseIntent),
        reachability: Math.round(reachability),
        differentiationPotential: Math.round(differentiationPotential),
        evidenceStrength: Math.round(evidenceStrength),
        commercialPotential: Math.round(commercialPotential),
        risk: Math.round(risk),
        total: clamp(targetScore, 0, 100)
      }
    };
  }).sort((a, b) => b.targetScores.total - a.targetScores.total);

  return scored.map((segment, index) => {
    const targetStatus = statusForRank(segment.targetScores.total, index);
    return {
      ...segment,
      targetStatus,
      targetSelected: ['PRIMARY_TARGET', 'SECONDARY_TARGET', 'EXPERIMENTAL_TARGET'].includes(targetStatus),
      targetRationale: safeArray([
        `rank ${index + 1}/${scored.length}`,
        `fit ${segment.targetScores.productFit}/100`,
        `intent ${segment.targetScores.purchaseIntent}/100`,
        `reach ${segment.targetScores.reachability}/100`,
        `risk ${segment.targetScores.risk}/100`
      ], 6)
    };
  });
}

function buildPositioningObjects(targets = [], { query = '', geo = '', competitorData = {}, lang = 'fr' } = {}) {
  const isAr = lang === 'ar';
  const isEn = lang === 'en';
  const offer = safeText(query, 160);
  const market = safeText(geo, 90);
  const leader = competitorData?.top10Competitors?.[0] || competitorData?.competitors?.[0] || {};
  const alternative = safeText(leader.domain || leader.displayed_link || leader.title || leader.url || leader.link || (isAr ? 'البدائل الحالية' : isEn ? 'current alternatives' : 'les alternatives actuelles'), 140);
  const differentiator = safeText(
    competitorData?.productServiceAudit?.killShotFeature ||
    competitorData?.blueOceanStrategy?.blueOceanMoves?.[0] ||
    competitorData?.winningMove ||
    '', 220
  );
  return targets.filter(t => t.targetSelected).map((target, index) => {
    const positioningId = `pos-${target.id}`;
    const coreNeed = safeText(target.need, 260);
    const desiredOutcome = isAr
      ? `تحقيق ${coreNeed} بدون عرض عام أو دليل ضعيف`
      : isEn
        ? `Achieve ${coreNeed} without a generic offer or weak proof`
        : `Obtenir ${coreNeed} sans offre générique ni preuve faible`;
    const differentiatedValue = differentiator || (isAr
      ? `ترجمة ${offer} إلى عرض مناسب لشريحة ${target.name}`
      : isEn
        ? `Translate ${offer} into an offer adapted to ${target.name}`
        : `Traduire ${offer} en offre adaptée à ${target.name}`);
    const reasonToBelieve = safeArray([
      ...(target.evidence || []),
      competitorData?.marketInsights?.serpIntent,
      competitorData?.productServiceAudit?.missingProof
    ], 5);
    const statement = isAr
      ? `لـ ${target.name} في ${market}، يتموضع ${offer} كخيار يحقق "${coreNeed}" عبر ${differentiatedValue}، مع إثبات مطلوب: ${reasonToBelieve[0] || 'دليل قابل للتحقق'}.`
      : isEn
        ? `For ${target.name} in ${market}, ${offer} is positioned as the option that delivers "${coreNeed}" through ${differentiatedValue}, with proof required: ${reasonToBelieve[0] || 'verifiable proof'}.`
        : `Pour ${target.name} en ${market}, ${offer} se positionne comme l’option qui permet "${coreNeed}" via ${differentiatedValue}, avec preuve requise : ${reasonToBelieve[0] || 'preuve vérifiable'}.`;
    return {
      id: positioningId,
      targetSegmentId: target.id,
      targetStatus: target.targetStatus,
      frameOfReference: safeText(`${offer} · ${market}`, 180),
      coreNeed,
      desiredOutcome,
      alternative,
      differentiatedValue,
      reasonToBelieve,
      statement,
      validation: {
        valid: !/buy safely|get better results|save money|choose quickly|acheter sans risque|meilleurs résultats|وفر المال/i.test(statement),
        genericClaimTest: 'Could a generic competitor make exactly the same claim?',
        order: index + 1
      }
    };
  });
}

function decisionTrace(stage, decision, { inputs = [], alternatives = [], rejectedAlternatives = [], evidenceIds = [], risks = [], confidence = 'MEDIUM' } = {}) {
  return {
    stage,
    inputs: safeArray(inputs, 8),
    evidenceIds: safeArray(evidenceIds, 8),
    criteria: stage,
    alternatives: safeArray(alternatives, 8),
    rejectedAlternatives,
    decision: safeText(decision, 420),
    risks: safeArray(risks, 6),
    assumptions: [],
    confidence
  };
}

function validateRealStpDecision({ segmentation = {}, targeting = {}, positioning = [], personaCards = [], activations = [] } = {}) {
  const failures = [];
  if (!Array.isArray(segmentation.validatedSegments) || !segmentation.validatedSegments.length) failures.push('NO_VALID_SEGMENTS');
  const selected = (targeting.targets || []).filter(t => t.targetSelected);
  if (!selected.length) failures.push('NO_TARGET_SELECTED');
  selected.forEach(target => {
    if (!positioning.some(pos => pos.targetSegmentId === target.id)) failures.push(`NO_POSITIONING_FOR_${target.id}`);
  });
  personaCards.forEach(card => {
    if (!card.segmentId) failures.push(`NO_PERSONA_SEGMENT_ID_${card.id || card.number || ''}`);
    if (!card.targetStatus) failures.push(`NO_PERSONA_TARGET_STATUS_${card.id || card.number || ''}`);
    if (!card.positioningId) failures.push(`NO_PERSONA_POSITIONING_ID_${card.id || card.number || ''}`);
  });
  activations.forEach(item => {
    if (!item.personaId || !item.primaryAngleId || !item.positioningId) failures.push(`INVALID_ACTIVATION_${item.personaId || ''}`);
    if (Number(item.personaAngleFit || 0) < 35) failures.push(`LOW_PERSONA_ANGLE_FIT_${item.personaId || ''}`);
  });
  return { valid: failures.length === 0, failures };
}

module.exports = {
  safeText,
  safeArray,
  normalize,
  overlapScore,
  validateSegment,
  mergeDuplicateSegments,
  buildTargeting,
  buildPositioningObjects,
  decisionTrace,
  validateRealStpDecision
};
