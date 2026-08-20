'use strict';

const ANGLE_TYPES = {
  security_trust: {
    angleType: 'security',
    icon: 'fa-shield-halved',
    tone: '34,197,94',
    groups: ['risk', 'trust'],
    channels: ['SEO', 'comparison page', 'WhatsApp', 'reviews'],
    hooks: ['prove the result before asking for the sale', 'make risk and guarantees visible']
  },
  savings_budget: {
    angleType: 'saving',
    icon: 'fa-coins',
    tone: '245,158,11',
    groups: ['price', 'budget'],
    channels: ['SEO', 'price comparison', 'retargeting', 'offer page'],
    hooks: ['show total cost and savings clearly', 'make the low-risk entry offer obvious']
  },
  proof_outcome: {
    angleType: 'performance',
    icon: 'fa-circle-check',
    tone: '34,211,238',
    groups: ['proof', 'result'],
    channels: ['landing page', 'UGC', 'case study', 'demo video'],
    hooks: ['show the visible outcome', 'turn proof into the first screen']
  },
  comparison_alternative: {
    angleType: 'other',
    icon: 'fa-scale-balanced',
    tone: '139,92,246',
    groups: ['comparison', 'alternatives'],
    channels: ['SERP', 'comparison page', 'FAQ', 'search ads'],
    hooks: ['compare against the current alternatives', 'explain the difference without vague claims']
  },
  local_speed: {
    angleType: 'convenience',
    icon: 'fa-location-dot',
    tone: '59,130,246',
    groups: ['local', 'speed'],
    channels: ['local SEO', 'Maps', 'WhatsApp', 'local partnerships'],
    hooks: ['win with local availability and faster response', 'make delivery or access concrete']
  },
  expertise_method: {
    angleType: 'status',
    icon: 'fa-user-graduate',
    tone: '236,72,153',
    groups: ['expertise', 'method'],
    channels: ['LinkedIn', 'expert content', 'case study', 'direct outreach'],
    hooks: ['make the expert method visible', 'sell the process, not only the service']
  },
  convenience_comfort: {
    angleType: 'comfort',
    icon: 'fa-face-smile',
    tone: '20,184,166',
    groups: ['comfort', 'ease'],
    channels: ['social content', 'landing page', 'WhatsApp', 'email'],
    hooks: ['remove effort from the decision', 'make the easy path obvious']
  },
  reliability_risk: {
    angleType: 'reliability',
    icon: 'fa-triangle-exclamation',
    tone: '248,113,113',
    groups: ['reliability', 'risk'],
    channels: ['FAQ', 'reviews', 'technical proof', 'support'],
    hooks: ['reduce failure anxiety', 'show what happens if it does not work']
  },
  offgrid_autonomy: {
    angleType: 'off_grid',
    icon: 'fa-solar-panel',
    tone: '34,197,94',
    groups: ['autonomy', 'availability'],
    channels: ['SEO', 'community groups', 'marketplace', 'local demo'],
    hooks: ['sell autonomy where access is uncertain', 'show use without dependence on infrastructure']
  },
  installation_ease: {
    angleType: 'installation',
    icon: 'fa-screwdriver-wrench',
    tone: '34,211,238',
    groups: ['setup', 'ease'],
    channels: ['how-to content', 'video demo', 'FAQ', 'WhatsApp'],
    hooks: ['remove setup fear', 'show installation in simple steps']
  }
};

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-').slice(0, 80);
}

const TYPE_LABELS = {
  fr: {
    security_trust: 'Confiance et risque',
    savings_budget: 'Budget et valeur',
    proof_outcome: 'Preuve du resultat',
    comparison_alternative: 'Comparaison des alternatives',
    local_speed: 'Acces local rapide',
    expertise_method: 'Expertise et methode',
    convenience_comfort: 'Facilite et confort',
    reliability_risk: 'Fiabilite et garantie',
    offgrid_autonomy: 'Autonomie hors reseau',
    installation_ease: 'Installation simple'
  },
  en: {
    security_trust: 'Trust and risk',
    savings_budget: 'Budget and value',
    proof_outcome: 'Outcome proof',
    comparison_alternative: 'Alternative comparison',
    local_speed: 'Fast local access',
    expertise_method: 'Expertise and method',
    convenience_comfort: 'Ease and comfort',
    reliability_risk: 'Reliability and guarantee',
    offgrid_autonomy: 'Off-grid autonomy',
    installation_ease: 'Simple installation'
  },
  ar: {
    security_trust: 'الثقة وتقليل المخاطر',
    savings_budget: 'الميزانية والقيمة',
    proof_outcome: 'إثبات النتيجة',
    comparison_alternative: 'مقارنة البدائل',
    local_speed: 'وصول محلي سريع',
    expertise_method: 'الخبرة والمنهجية',
    convenience_comfort: 'السهولة والراحة',
    reliability_risk: 'الموثوقية والضمان',
    offgrid_autonomy: 'استقلالية خارج الشبكة',
    installation_ease: 'سهولة التركيب'
  }
};

function safeText(value, max = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeArray(value, max = 8) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  raw.flat(Infinity).forEach(item => {
    const text = typeof item === 'object' && item ? safeText(item.text || item.name || item.title || item.query || item.url || item.domain || item.snippet || '') : safeText(item);
    if (text && !out.some(x => normalizeText(x) === normalizeText(text))) out.push(text);
  });
  return out.slice(0, max);
}

function normalizeText(value) {
  return safeText(value, 500)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value) {
  const stop = new Set(['the', 'and', 'for', 'avec', 'pour', 'dans', 'les', 'des', 'une', 'على', 'عن', 'في', 'من', 'الى', 'إلى']);
  return new Set(normalizeText(value).split(' ').filter(t => t.length > 2 && !stop.has(t)));
}

function overlapScore(a, b) {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  aa.forEach(t => { if (bb.has(t)) overlap += 1; });
  return overlap / Math.min(aa.size, bb.size);
}

function localLabel(type, lang = 'fr') {
  const pack = TYPE_LABELS[lang] || TYPE_LABELS.fr;
  return pack[type] || TYPE_LABELS.fr[type] || type;
}

function inferTypesFromText(value) {
  const text = normalizeText(value);
  const types = new Set();
  if (/trust|proof|preuve|avis|review|garantie|return|refund|ثقة|دليل|ضمان|استرجاع|مراجعة/.test(text)) types.add('security_trust');
  if (/price|prix|budget|cheap|cost|saving|econom|سعر|ميزانية|توفير|رخيص/.test(text)) types.add('savings_budget');
  if (/result|outcome|before after|demo|case|نتيجة|تجربة|قبل|بعد/.test(text)) types.add('proof_outcome');
  if (/compar|alternative|versus|vs|competitor|مقارنة|بديل|منافس/.test(text)) types.add('comparison_alternative');
  if (/local|near|delivery|maps|city|maroc|libya|tunisia|morocco|محلي|قريب|توصيل/.test(text)) types.add('local_speed');
  if (/expert|agency|b2b|method|consult|audit|خبير|وكالة|منهج|استشارة/.test(text)) types.add('expertise_method');
  if (/easy|simple|comfort|convenient|سهل|راحة|بسيط/.test(text)) types.add('convenience_comfort');
  if (/reliable|risk|failure|broken|maintenance|موثوق|عطل|خطر|صيانة/.test(text)) types.add('reliability_risk');
  if (/solar|solaire|projecteur|off.?grid|power|energy|شمسي|طاقة|كاشف|اضاءة/.test(text)) {
    types.add('offgrid_autonomy');
    types.add('installation_ease');
    types.add('reliability_risk');
  }
  return [...types];
}

function buildEvidenceCatalog({ query = '', segments = [], competitorData = {} } = {}) {
  const catalog = [];
  const push = (source, label, value) => {
    const text = safeText(value, 320);
    if (!text) return;
    catalog.push({ id: `ev_${catalog.length + 1}`, source, label: safeText(label, 80), text });
  };
  push('input', 'query', query);
  (segments || []).slice(0, 8).forEach(segment => {
    push('segment', segment.id || segment.name, `${segment.name || ''} ${segment.need || ''} ${safeArray(segment.buyingTriggers, 4).join(' ')}`);
  });
  (competitorData.top10Competitors || competitorData.competitors || []).slice(0, 10).forEach(c => {
    push('competitor', c.domain || c.displayed_link || c.title || c.url || c.link, `${c.title || ''} ${c.snippet || ''} ${c.url || c.link || ''}`);
  });
  const kw = competitorData.keywordStrategy || {};
  [...safeArray(kw.primary, 8), ...safeArray(kw.longTail, 8), ...safeArray(kw.questions, 8)].forEach(item => push('keyword', 'keyword', item));
  const insights = competitorData.marketInsights || {};
  ['painPoint', 'dominantOffer', 'mainRisk', 'winningCriteria'].forEach(key => push('market', key, insights[key]));
  const audit = competitorData.productServiceAudit || {};
  ['weakestProductFeature', 'killShotFeature', 'missingProof', 'risk'].forEach(key => push('product', key, audit[key]));
  return catalog;
}

function structuredAngleParts(type, { label = '', query = '', market = '', reason = '' } = {}) {
  const q = safeText(query || 'offer', 120);
  const place = market ? ` in ${safeText(market, 80)}` : '';
  const base = {
    coreProblem: safeText(reason || `${label} need around ${q}`, 180),
    context: safeText(`${q}${place}`, 160),
    trigger: 'active search or visible need',
    desiredOutcome: safeText(`solve ${label || type} without unnecessary risk`, 180),
    primaryBenefit: safeText(label || type, 120),
    emotionalDriver: 'clarity and confidence',
    proofNeeded: ['clear offer proof', 'price or terms clarity'],
    keywords: safeArray([q, label], 5)
  };
  const byType = {
    security_trust: {
      trigger: 'fear of risk, loss, fraud or unclear guarantee',
      desiredOutcome: 'feel safe enough to act',
      primaryBenefit: 'lower perceived risk',
      emotionalDriver: 'reassurance',
      proofNeeded: ['verified reviews', 'guarantee terms', 'visible result proof']
    },
    savings_budget: {
      trigger: 'price pressure or budget constraint',
      desiredOutcome: 'get the needed outcome at a controlled total cost',
      primaryBenefit: 'better value for money',
      emotionalDriver: 'control',
      proofNeeded: ['current price', 'old price if true', 'total cost and conditions']
    },
    proof_outcome: {
      trigger: 'doubt that the product or service really works',
      desiredOutcome: 'see the outcome before committing',
      primaryBenefit: 'proof-led confidence',
      emotionalDriver: 'certainty',
      proofNeeded: ['demo', 'before-after', 'case or customer proof']
    },
    comparison_alternative: {
      trigger: 'choice between multiple alternatives',
      desiredOutcome: 'understand the best fit quickly',
      primaryBenefit: 'faster decision through comparison',
      emotionalDriver: 'avoid regret',
      proofNeeded: ['comparison table', 'competitor differences', 'objective criteria']
    },
    local_speed: {
      trigger: 'need for local access, delivery or response',
      desiredOutcome: 'get the solution locally and quickly',
      primaryBenefit: 'faster access',
      emotionalDriver: 'urgency relief',
      proofNeeded: ['delivery area', 'response time', 'local contact']
    },
    expertise_method: {
      trigger: 'need for a credible expert path',
      desiredOutcome: 'choose the provider with the clearest method',
      primaryBenefit: 'expert confidence',
      emotionalDriver: 'status and competence',
      proofNeeded: ['method', 'case study', 'expert credentials']
    },
    convenience_comfort: {
      trigger: 'friction, fatigue or desire for easier use',
      desiredOutcome: 'reach the result with less effort',
      primaryBenefit: 'simplicity',
      emotionalDriver: 'comfort',
      proofNeeded: ['simple steps', 'usage demo', 'support process']
    },
    reliability_risk: {
      trigger: 'fear of failure, breakdown or bad after-sale',
      desiredOutcome: 'trust the solution will keep working',
      primaryBenefit: 'reliability',
      emotionalDriver: 'peace of mind',
      proofNeeded: ['warranty', 'support policy', 'technical proof']
    },
    offgrid_autonomy: {
      trigger: 'lack of grid access or unstable infrastructure',
      desiredOutcome: 'operate without dependency on the grid',
      primaryBenefit: 'autonomy',
      emotionalDriver: 'independence',
      proofNeeded: ['autonomy proof', 'battery or energy spec', 'real use case']
    },
    installation_ease: {
      trigger: 'fear of wiring, electrician cost or complex setup',
      desiredOutcome: 'install or start using without hassle',
      primaryBenefit: 'easy setup',
      emotionalDriver: 'relief',
      proofNeeded: ['installation steps', 'setup video', 'what is included']
    }
  };
  return { ...base, ...(byType[type] || {}) };
}

function makeAngle(type, { lang = 'fr', query = '', market = '', evidence = [], reason = '' } = {}) {
  const def = ANGLE_TYPES[type] || ANGLE_TYPES.proof_outcome;
  const label = localLabel(type, lang);
  const structured = structuredAngleParts(type, { label, query, market, reason });
  return {
    id: `angle-${type}`,
    slug: slugify(`${type}-${label}`),
    type,
    angleType: def.angleType || 'other',
    name: label,
    label,
    coreProblem: structured.coreProblem,
    context: structured.context,
    trigger: structured.trigger,
    desiredOutcome: structured.desiredOutcome,
    primaryBenefit: structured.primaryBenefit,
    emotionalDriver: structured.emotionalDriver,
    problem: safeText(reason || `${label}: ${query}`, 220),
    jobToBeDone: safeText(`${label} - ${query}${market ? ` - ${market}` : ''}`, 220),
    promise: safeText((def.hooks || [])[0] || label, 180),
    proofNeeded: safeArray(structured.proofNeeded, 5),
    keywords: safeArray(structured.keywords, 8),
    hooks: safeArray(def.hooks, 4),
    channels: safeArray(def.channels, 5),
    tone: def.tone,
    icon: def.icon,
    evidenceIds: safeArray(evidence.map(e => e.id), 8),
    evidenceStatus: evidence.length ? 'observed_or_inferred' : 'hypothesis',
    confidence: evidence.length ? 0.72 : 0.48
  };
}

function generateMarketingAngleCandidates({ query = '', geo = '', lang = 'fr', segments = [], competitorData = {} } = {}) {
  const evidenceCatalog = buildEvidenceCatalog({ query, segments, competitorData });
  const allText = [
    query,
    geo,
    ...(segments || []).map(s => `${s.name || ''} ${s.need || ''} ${safeArray(s.buyingTriggers, 4).join(' ')}`),
    JSON.stringify(competitorData.keywordStrategy || {}),
    JSON.stringify(competitorData.marketInsights || {}),
    JSON.stringify(competitorData.productServiceAudit || {}),
    ...(competitorData.top10Competitors || competitorData.competitors || []).slice(0, 8).map(c => `${c.title || ''} ${c.snippet || ''} ${c.domain || c.url || c.link || ''}`)
  ].join(' ');
  const types = new Set(inferTypesFromText(allText));
  ['security_trust', 'proof_outcome', 'comparison_alternative', 'savings_budget'].forEach(t => types.add(t));

  const market = safeText(geo, 80);
  const candidates = [...types].flatMap(type => {
    const matchedEvidence = evidenceCatalog
      .filter(e => inferTypesFromText(e.text).includes(type) || overlapScore(e.text, `${query} ${localLabel(type, lang)}`) >= 0.32)
      .slice(0, 6);
    const base = makeAngle(type, {
      lang,
      query,
      market,
      evidence: matchedEvidence,
      reason: matchedEvidence[0]?.text || ''
    });
    const lexicalVariant = {
      ...base,
      id: `${base.id}-variant`,
      name: `${base.name} · variant`,
      label: base.label,
      coreProblem: base.coreProblem,
      problem: `${base.problem} ${base.primaryBenefit}`,
      trigger: base.trigger,
      desiredOutcome: base.desiredOutcome,
      primaryBenefit: base.primaryBenefit
    };
    return [base, lexicalVariant];
  });
  return candidates.slice(0, 20);
}

function classifyAngleRelation(a = {}, b = {}) {
  const at = a.type || '';
  const bt = b.type || '';
  if (at && bt && at === bt) return 'SAME_ANGLE';
  if ([at, bt].includes('installation_ease')) return 'DISTINCT';
  if ([at, bt].includes('offgrid_autonomy')) return 'DISTINCT';
  const ag = new Set((ANGLE_TYPES[at]?.groups || []));
  const bg = new Set((ANGLE_TYPES[bt]?.groups || []));
  const sharedGroup = [...ag].some(g => bg.has(g));
  const overlap = overlapScore(`${a.name || ''} ${a.problem || ''} ${a.promise || ''}`, `${b.name || ''} ${b.problem || ''} ${b.promise || ''}`);
  if (sharedGroup && overlap >= 0.72) return 'SAME_ANGLE';
  if (sharedGroup && overlap >= 0.42) return 'RELATED_BUT_DISTINCT';
  return 'DISTINCT';
}

function normalizeAngle(angle = {}) {
  const type = angle.type || inferTypesFromText(`${angle.name || ''} ${angle.problem || ''} ${angle.promise || ''}`)[0] || 'proof_outcome';
  const def = ANGLE_TYPES[type] || ANGLE_TYPES.proof_outcome;
  return {
    ...angle,
    id: safeText(angle.id || `angle-${type}`, 80),
    slug: safeText(angle.slug || slugify(angle.name || angle.label || type), 80),
    type,
    angleType: safeText(angle.angleType || def.angleType || 'other', 40),
    name: safeText(angle.name || angle.label || localLabel(type, angle.lang || 'fr'), 120),
    label: safeText(angle.label || angle.name || localLabel(type, angle.lang || 'fr'), 120),
    coreProblem: safeText(angle.coreProblem || angle.problem || angle.need || '', 220),
    context: safeText(angle.context || angle.market || '', 180),
    trigger: safeText(angle.trigger || '', 180),
    desiredOutcome: safeText(angle.desiredOutcome || angle.outcome || '', 180),
    primaryBenefit: safeText(angle.primaryBenefit || angle.benefit || '', 160),
    emotionalDriver: safeText(angle.emotionalDriver || '', 120),
    problem: safeText(angle.problem || angle.need || angle.jobToBeDone || '', 260),
    jobToBeDone: safeText(angle.jobToBeDone || angle.problem || angle.name || '', 260),
    promise: safeText(angle.promise || angle.attackAngle || def.hooks?.[0] || '', 220),
    proofNeeded: safeArray(angle.proofNeeded, 6),
    keywords: safeArray(angle.keywords, 10),
    hooks: safeArray(angle.hooks || def.hooks, 5),
    channels: safeArray(angle.channels || def.channels, 6),
    tone: safeText(angle.tone || def.tone, 40),
    icon: safeText(angle.icon || def.icon, 40),
    evidenceIds: safeArray(angle.evidenceIds, 10),
    score: Number.isFinite(Number(angle.score)) ? Math.round(Number(angle.score)) : 0
  };
}

function dedupeMarketingAngles(candidates = []) {
  const accepted = [];
  const rejected = [];
  candidates.map(normalizeAngle).forEach(angle => {
    const duplicate = accepted.find(existing => classifyAngleRelation(existing, angle) === 'SAME_ANGLE');
    if (duplicate) {
      rejected.push({ id: angle.id, duplicateOf: duplicate.id, reason: classifyAngleRelation(duplicate, angle) });
      duplicate.evidenceIds = safeArray([...(duplicate.evidenceIds || []), ...(angle.evidenceIds || [])], 10);
      duplicate.hooks = safeArray([...(duplicate.hooks || []), ...(angle.hooks || [])], 5);
      duplicate.keywords = safeArray([...(duplicate.keywords || []), ...(angle.keywords || [])], 10);
      duplicate.proofNeeded = safeArray([...(duplicate.proofNeeded || []), ...(angle.proofNeeded || [])], 6);
      return;
    }
    accepted.push(angle);
  });
  return { angles: accepted, rejected };
}

function scoreMarketingAngle(angle = {}, evidence = {}, context = {}) {
  const normalized = normalizeAngle(angle);
  const evidenceCount = safeArray(normalized.evidenceIds, 10).length;
  const budget = normalizeText(context.budget || '');
  const leanBoost = budget && /lean|small|petit|low|faible|قليل|صغير/.test(budget) && ['savings_budget', 'local_speed', 'comparison_alternative'].includes(normalized.type) ? 8 : 0;
  const solarBoost = /solar|solaire|شمسي|projecteur/.test(normalizeText(context.query || '')) && ['offgrid_autonomy', 'installation_ease', 'reliability_risk'].includes(normalized.type) ? 10 : 0;
  const score = 48 + Math.min(22, evidenceCount * 4) + leanBoost + solarBoost + (normalized.type === 'security_trust' ? 7 : 0);
  return Math.max(35, Math.min(96, Math.round(score)));
}

function sanitizeEvidenceIds(ids = [], evidenceCatalog = []) {
  const valid = new Set((evidenceCatalog || []).map(e => e.id));
  const kept = safeArray(ids, 12).filter(id => valid.has(id));
  return {
    ids: kept,
    removed: safeArray(ids, 12).filter(id => !valid.has(id))
  };
}

function personaDiversitySignature(persona = {}) {
  const details = persona.details || {};
  return normalizeText([
    persona.primaryAngle?.type || persona.angleType || '',
    details.primaryJobToBeDone || persona.summary || '',
    details.buyingBehavior || '',
    details.searchBehavior || '',
    safeArray(details.pains, 3).join(' '),
    safeArray(details.buyingTriggers, 3).join(' ')
  ].join(' '));
}

function personaStructuralDimensions(persona = {}) {
  const details = persona.details || {};
  return {
    purchaseContext: safeText(details.purchaseContext || details.context || persona.market || ''),
    primaryJobToBeDone: safeText(details.primaryJobToBeDone || details.need || persona.summary || ''),
    mainPain: safeText(details.mainPain || safeArray(details.pains, 1)[0] || ''),
    trigger: safeText(details.trigger || safeArray(details.buyingTriggers, 1)[0] || ''),
    desiredOutcome: safeText(details.desiredOutcome || persona.primaryAngle?.desiredOutcome || ''),
    decisionCriteria: safeText(details.decisionCriteria || safeArray(details.proofNeeded, 2).join(' ')),
    objections: safeText(safeArray(details.objections, 3).join(' ')),
    environment: safeText(details.environment || details.segmentName || persona.segmentName || ''),
    buyingBehavior: safeText(details.buyingBehavior || ''),
    informationBehavior: safeText(details.informationBehavior || details.searchBehavior || '')
  };
}

function countStructuralDifferences(a = {}, b = {}) {
  const aa = personaStructuralDimensions(a);
  const bb = personaStructuralDimensions(b);
  return Object.keys(aa).reduce((count, key) => {
    if (!aa[key] || !bb[key]) return count;
    return overlapScore(aa[key], bb[key]) < 0.55 ? count + 1 : count;
  }, 0);
}

function arePersonasStructurallyDuplicate(a = {}, b = {}) {
  if ((a.primaryAngle?.type || a.angleType) && (b.primaryAngle?.type || b.angleType) && (a.primaryAngle?.type || a.angleType) !== (b.primaryAngle?.type || b.angleType)) return false;
  if (countStructuralDifferences(a, b) >= 2) return false;
  const sigA = personaDiversitySignature(a);
  const sigB = personaDiversitySignature(b);
  if (!sigA || !sigB) return false;
  return overlapScore(sigA, sigB) >= 0.66;
}

function dedupePersonas(personas = []) {
  const accepted = [];
  const rejected = [];
  personas.forEach(persona => {
    const dup = accepted.find(existing => arePersonasStructurallyDuplicate(existing, persona));
    if (dup) rejected.push({ id: persona.id, duplicateOf: dup.id, reason: 'same_context_jtbd_pain_trigger_behavior' });
    else accepted.push(persona);
  });
  return { personas: accepted, rejected };
}

function deriveChannelsFromBehavior(persona = {}, angle = {}) {
  const details = persona.details || {};
  const text = normalizeText(`${persona.summary || ''} ${details.searchBehavior || ''} ${details.buyingBehavior || ''} ${safeArray(details.buyingTriggers, 4).join(' ')}`);
  const channels = [...safeArray(angle.channels, 5), ...safeArray(details.channels, 5)];
  if (/urgent|near|local|قريب|عاجل/.test(text)) channels.push('local SEO', 'WhatsApp');
  if (/compare|price|budget|سعر|مقارنة/.test(text)) channels.push('comparison page', 'search ads');
  if (/proof|review|trust|دليل|ثقة/.test(text)) channels.push('reviews', 'UGC');
  if (/expert|b2b|method|خبير/.test(text)) channels.push('LinkedIn', 'case study');
  return safeArray(channels, 7);
}

function priorityFromScore(score = 0) {
  if (score >= 76) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function mapPersonasToAngles(personas = [], angles = []) {
  const normalizedAngles = angles.map(normalizeAngle);
  const usedPrimaryIds = new Set();
  return personas.map((persona, index) => {
    const text = `${persona.summary || ''} ${persona.attackAngle || ''} ${JSON.stringify(persona.details || {})}`;
    const ranked = normalizedAngles
      .map(angle => ({
        angle,
        rawScore: overlapScore(text, `${angle.name} ${angle.coreProblem} ${angle.trigger} ${angle.desiredOutcome} ${angle.primaryBenefit} ${angle.problem} ${angle.promise} ${angle.hooks?.join(' ')}`),
        score: overlapScore(text, `${angle.name} ${angle.coreProblem} ${angle.trigger} ${angle.desiredOutcome} ${angle.primaryBenefit} ${angle.problem} ${angle.promise} ${angle.hooks?.join(' ')}`) + (angle.score || 0) / 200
      }))
      .sort((a, b) => b.score - a.score);
    const uniquePrimary = ranked.find(item => item.angle?.id && !usedPrimaryIds.has(item.angle.id))?.angle;
    const fallbackPrimary = normalizedAngles.find(angle => angle?.id && !usedPrimaryIds.has(angle.id)) || normalizedAngles[index % Math.max(1, normalizedAngles.length)];
    const primary = uniquePrimary || ranked[0]?.angle || fallbackPrimary;
    if (primary?.id) usedPrimaryIds.add(primary.id);
    const secondary = ranked
      .map(item => item.angle)
      .filter(angle => angle && angle.id !== primary?.id)
      .slice(0, 2);
    return {
      ...persona,
      angleType: primary?.type,
      primaryAngle: primary || null,
      secondaryAngles: secondary,
      angleMappings: [primary, ...secondary].filter(Boolean).map((angle, rank) => {
        const rankedItem = ranked.find(item => item.angle.id === angle.id) || { rawScore: 0, score: 0 };
        const relevanceScore = Math.max(35, Math.min(100, Math.round((rankedItem.rawScore * 58) + ((angle.score || 0) * 0.42))));
        return {
        angleId: angle.id,
        type: angle.type,
        angleType: angle.angleType,
        name: angle.name,
        relevanceScore,
        priority: priorityFromScore(relevanceScore),
        rank: rank + 1,
        role: rank === 0 ? 'primary_attack_angle' : 'secondary_support_angle',
        rationale: safeText(`${angle.coreProblem || angle.problem} -> ${angle.desiredOutcome || angle.promise}`, 240),
        message: safeText(angle.promise || angle.primaryBenefit || angle.name, 180),
        hooks: safeArray(angle.hooks, 4),
        objections: safeArray(persona.details?.objections, 4),
        proofPoints: safeArray(angle.proofNeeded || persona.details?.proofNeeded, 5),
        confidence: Number(angle.confidence || 0.5)
      };
      })
    };
  });
}

function buildAngleDrivenStpModel({ query = '', geo = '', lang = 'fr', segments = [], personaCards = [], competitorData = {}, beachheadMarket = {}, budget = '' } = {}) {
  const evidenceCatalog = buildEvidenceCatalog({ query, segments, competitorData });
  const generated = generateMarketingAngleCandidates({ query, geo, lang, segments, competitorData });
  let { angles, rejected } = dedupeMarketingAngles(generated);
  angles = angles.map(angle => {
    const evidence = sanitizeEvidenceIds(angle.evidenceIds, evidenceCatalog);
    const scored = { ...angle, evidenceIds: evidence.ids, removedEvidenceIds: evidence.removed };
    scored.score = scoreMarketingAngle(scored, evidenceCatalog, { query, budget });
    scored.opportunityScore = scored.score;
    scored.confidence = evidence.ids.length ? Math.max(Number(scored.confidence || 0), 0.68) : Number(scored.confidence || 0.48);
    return scored;
  }).sort((a, b) => b.score - a.score);

  const beachheadType = angles[0]?.type || 'security_trust';
  const enrichedPersonas = mapPersonasToAngles(personaCards, angles).map((persona, index) => {
    const angle = persona.primaryAngle || angles[index % Math.max(1, angles.length)] || null;
    const channels = deriveChannelsFromBehavior(persona, angle || {});
    const details = persona.details || {};
    const isFirst = index === 0 || angle?.type === beachheadType;
    const personaNeed = safeText(details.primaryJobToBeDone || details.need || persona.summary || '', 220);
    const anglePromise = safeText(angle?.promise || angle?.primaryBenefit || angle?.name || '', 220);
    const combinedAttack = safeText([personaNeed, anglePromise].filter(Boolean).join(' -> '), 320);
    return {
      ...persona,
      icon: angle?.icon || persona.icon,
      tone: angle?.tone || persona.tone,
      priorityScore: Math.max(Number(persona.priorityScore || 0), angle?.score || 0),
      attackAngle: combinedAttack || persona.attackAngle,
      beachheadPriority: {
        ...(persona.beachheadPriority || {}),
        firstToAttack: isFirst,
        reason: isFirst ? (beachheadMarket?.rationale || angle?.problem || persona.beachheadPriority?.reason) : (angle?.problem || persona.beachheadPriority?.reason)
      },
      details: {
        ...details,
        primaryMarketingAngle: angle?.name || '',
        primaryJobToBeDone: personaNeed || angle?.jobToBeDone || persona.summary,
        informationBehavior: details.informationBehavior || inferBehavior('information', angle, lang),
        buyingBehavior: details.buyingBehavior || inferBehavior('buying', angle, lang),
        searchBehavior: details.searchBehavior || inferBehavior('search', angle, lang),
        trustSources: safeArray([...(details.trustSources || []), ...(angle?.evidenceIds || []), ...(details.proofNeeded || [])], 5),
        discoveryBehavior: details.discoveryBehavior || inferBehavior('discovery', angle, lang),
        channels,
        socialPlan: {
          ...(details.socialPlan || {}),
          platforms: safeArray((details.socialPlan || {}).platforms || channels, 5),
          contentAngles: safeArray([angle?.promise, ...(angle?.hooks || []), ...safeArray((details.socialPlan || {}).contentAngles, 4)], 6)
        },
        stp: {
          ...(details.stp || {}),
          positioning: combinedAttack || details.stp?.positioning || persona.attackAngle
        }
      },
      evidenceStatus: angle?.evidenceStatus || 'inferred_without_direct_evidence'
    };
  });

  const deduped = dedupePersonas(enrichedPersonas);
  return {
    productUnderstanding: {
      query: safeText(query, 160),
      geo: safeText(geo, 80),
      source: 'competitor_serp_market_layers'
    },
    problemsJtbdUseCases: angles.map(angle => ({
      angleId: angle.id,
      coreProblem: angle.coreProblem,
      trigger: angle.trigger,
      desiredOutcome: angle.desiredOutcome,
      primaryBenefit: angle.primaryBenefit,
      jobToBeDone: angle.jobToBeDone,
      evidenceStatus: angle.evidenceStatus
    })),
    marketingAngles: angles,
    personaCards: deduped.personas,
    personaAngleMappings: deduped.personas.map(persona => ({
      personaId: persona.id,
      personaName: persona.displayName || persona.title,
      primaryAngleId: persona.primaryAngle?.id || null,
      secondaryAngleIds: safeArray((persona.secondaryAngles || []).map(a => a.id), 4),
      mappings: persona.angleMappings || []
    })),
    angleDeduplication: rejected,
    personaDeduplication: deduped.rejected,
    evidenceCatalog,
    observability: [
      `[AngleEngine] candidates=${generated.length}`,
      `[AngleEngine] accepted_angles=${angles.length}`,
      `[AngleEngine] rejected_angles=${rejected.length}`,
      `[AngleEngine] accepted_personas=${deduped.personas.length}`,
      `[AngleEngine] rejected_personas=${deduped.rejected.length}`
    ]
  };
}

function inferBehavior(kind, angle = {}, lang = 'fr') {
  const name = angle?.name || '';
  const map = {
    fr: {
      information: `Lit les preuves et compare avant d'avancer: ${name}`,
      buying: `Achete quand le risque percu baisse et que l'action devient simple.`,
      search: `Cherche des requetes concretes liees au probleme, prix, avis et alternatives.`,
      discovery: `Decouvre via recherche, contenu utile, preuve sociale et retargeting leger.`
    },
    en: {
      information: `Reads proof and compares before moving forward: ${name}`,
      buying: `Buys when perceived risk drops and the next action is simple.`,
      search: `Searches concrete problem, price, review and alternative queries.`,
      discovery: `Discovers through search, useful content, social proof and light retargeting.`
    },
    ar: {
      information: `يقارن الأدلة قبل القرار: ${name}`,
      buying: `يشتري عندما تنخفض المخاطرة ويصبح الإجراء التالي واضحا.`,
      search: `يبحث عن المشكلة والسعر والآراء والبدائل بصيغة عملية.`,
      discovery: `يكتشف العرض عبر البحث والمحتوى المفيد والدليل الاجتماعي وإعادة الاستهداف.`
    }
  };
  return map[lang]?.[kind] || map.fr[kind] || '';
}

module.exports = {
  ANGLE_TYPES,
  normalizeText,
  normalizeAngle,
  classifyAngleRelation,
  dedupeMarketingAngles,
  scoreMarketingAngle,
  sanitizeEvidenceIds,
  personaDiversitySignature,
  personaStructuralDimensions,
  countStructuralDifferences,
  arePersonasStructurallyDuplicate,
  dedupePersonas,
  deriveChannelsFromBehavior,
  mapPersonasToAngles,
  buildEvidenceCatalog,
  generateMarketingAngleCandidates,
  buildAngleDrivenStpModel
};
