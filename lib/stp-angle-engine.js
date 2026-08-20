'use strict';

const ANGLE_TYPES = {
  security_trust: {
    icon: 'fa-shield-halved',
    tone: '34,197,94',
    groups: ['risk', 'trust'],
    channels: ['SEO', 'comparison page', 'WhatsApp', 'reviews'],
    hooks: ['prove the result before asking for the sale', 'make risk and guarantees visible']
  },
  savings_budget: {
    icon: 'fa-coins',
    tone: '245,158,11',
    groups: ['price', 'budget'],
    channels: ['SEO', 'price comparison', 'retargeting', 'offer page'],
    hooks: ['show total cost and savings clearly', 'make the low-risk entry offer obvious']
  },
  proof_outcome: {
    icon: 'fa-circle-check',
    tone: '34,211,238',
    groups: ['proof', 'result'],
    channels: ['landing page', 'UGC', 'case study', 'demo video'],
    hooks: ['show the visible outcome', 'turn proof into the first screen']
  },
  comparison_alternative: {
    icon: 'fa-scale-balanced',
    tone: '139,92,246',
    groups: ['comparison', 'alternatives'],
    channels: ['SERP', 'comparison page', 'FAQ', 'search ads'],
    hooks: ['compare against the current alternatives', 'explain the difference without vague claims']
  },
  local_speed: {
    icon: 'fa-location-dot',
    tone: '59,130,246',
    groups: ['local', 'speed'],
    channels: ['local SEO', 'Maps', 'WhatsApp', 'local partnerships'],
    hooks: ['win with local availability and faster response', 'make delivery or access concrete']
  },
  expertise_method: {
    icon: 'fa-user-graduate',
    tone: '236,72,153',
    groups: ['expertise', 'method'],
    channels: ['LinkedIn', 'expert content', 'case study', 'direct outreach'],
    hooks: ['make the expert method visible', 'sell the process, not only the service']
  },
  convenience_comfort: {
    icon: 'fa-face-smile',
    tone: '20,184,166',
    groups: ['comfort', 'ease'],
    channels: ['social content', 'landing page', 'WhatsApp', 'email'],
    hooks: ['remove effort from the decision', 'make the easy path obvious']
  },
  reliability_risk: {
    icon: 'fa-triangle-exclamation',
    tone: '248,113,113',
    groups: ['reliability', 'risk'],
    channels: ['FAQ', 'reviews', 'technical proof', 'support'],
    hooks: ['reduce failure anxiety', 'show what happens if it does not work']
  },
  offgrid_autonomy: {
    icon: 'fa-solar-panel',
    tone: '34,197,94',
    groups: ['autonomy', 'availability'],
    channels: ['SEO', 'community groups', 'marketplace', 'local demo'],
    hooks: ['sell autonomy where access is uncertain', 'show use without dependence on infrastructure']
  },
  installation_ease: {
    icon: 'fa-screwdriver-wrench',
    tone: '34,211,238',
    groups: ['setup', 'ease'],
    channels: ['how-to content', 'video demo', 'FAQ', 'WhatsApp'],
    hooks: ['remove setup fear', 'show installation in simple steps']
  }
};

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

function makeAngle(type, { lang = 'fr', query = '', market = '', evidence = [], reason = '' } = {}) {
  const def = ANGLE_TYPES[type] || ANGLE_TYPES.proof_outcome;
  const label = localLabel(type, lang);
  return {
    id: `angle-${type}`,
    type,
    name: label,
    label,
    problem: safeText(reason || `${label}: ${query}`, 220),
    jobToBeDone: safeText(`${label} - ${query}${market ? ` - ${market}` : ''}`, 220),
    promise: safeText((def.hooks || [])[0] || label, 180),
    hooks: safeArray(def.hooks, 4),
    channels: safeArray(def.channels, 5),
    tone: def.tone,
    icon: def.icon,
    evidenceIds: safeArray(evidence.map(e => e.id), 8),
    evidenceStatus: evidence.length ? 'observed_or_inferred' : 'inferred_without_direct_evidence'
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
  return [...types].map(type => {
    const matchedEvidence = evidenceCatalog
      .filter(e => inferTypesFromText(e.text).includes(type) || overlapScore(e.text, `${query} ${localLabel(type, lang)}`) >= 0.32)
      .slice(0, 6);
    return makeAngle(type, {
      lang,
      query,
      market,
      evidence: matchedEvidence,
      reason: matchedEvidence[0]?.text || ''
    });
  });
}

function classifyAngleRelation(a = {}, b = {}) {
  const at = a.type || '';
  const bt = b.type || '';
  if (at && bt && at === bt) return 'same_angle';
  if ([at, bt].includes('installation_ease')) return 'distinct_angle';
  if ([at, bt].includes('offgrid_autonomy')) return 'distinct_angle';
  const ag = new Set((ANGLE_TYPES[at]?.groups || []));
  const bg = new Set((ANGLE_TYPES[bt]?.groups || []));
  const sharedGroup = [...ag].some(g => bg.has(g));
  const overlap = overlapScore(`${a.name || ''} ${a.problem || ''} ${a.promise || ''}`, `${b.name || ''} ${b.problem || ''} ${b.promise || ''}`);
  if (sharedGroup && overlap >= 0.48) return 'near_duplicate';
  return 'distinct_angle';
}

function normalizeAngle(angle = {}) {
  const type = angle.type || inferTypesFromText(`${angle.name || ''} ${angle.problem || ''} ${angle.promise || ''}`)[0] || 'proof_outcome';
  const def = ANGLE_TYPES[type] || ANGLE_TYPES.proof_outcome;
  return {
    ...angle,
    id: safeText(angle.id || `angle-${type}`, 80),
    type,
    name: safeText(angle.name || angle.label || localLabel(type, angle.lang || 'fr'), 120),
    label: safeText(angle.label || angle.name || localLabel(type, angle.lang || 'fr'), 120),
    problem: safeText(angle.problem || angle.need || angle.jobToBeDone || '', 260),
    jobToBeDone: safeText(angle.jobToBeDone || angle.problem || angle.name || '', 260),
    promise: safeText(angle.promise || angle.attackAngle || def.hooks?.[0] || '', 220),
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
    const duplicate = accepted.find(existing => classifyAngleRelation(existing, angle) !== 'distinct_angle');
    if (duplicate) {
      rejected.push({ id: angle.id, duplicateOf: duplicate.id, reason: classifyAngleRelation(duplicate, angle) });
      duplicate.evidenceIds = safeArray([...(duplicate.evidenceIds || []), ...(angle.evidenceIds || [])], 10);
      duplicate.hooks = safeArray([...(duplicate.hooks || []), ...(angle.hooks || [])], 5);
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

function arePersonasStructurallyDuplicate(a = {}, b = {}) {
  if ((a.primaryAngle?.type || a.angleType) && (b.primaryAngle?.type || b.angleType) && (a.primaryAngle?.type || a.angleType) !== (b.primaryAngle?.type || b.angleType)) return false;
  const sigA = personaDiversitySignature(a);
  const sigB = personaDiversitySignature(b);
  if (!sigA || !sigB) return false;
  return overlapScore(sigA, sigB) >= 0.72;
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

function mapPersonasToAngles(personas = [], angles = []) {
  const normalizedAngles = angles.map(normalizeAngle);
  return personas.map((persona, index) => {
    const text = `${persona.summary || ''} ${persona.attackAngle || ''} ${JSON.stringify(persona.details || {})}`;
    const ranked = normalizedAngles
      .map(angle => ({
        angle,
        score: overlapScore(text, `${angle.name} ${angle.problem} ${angle.promise} ${angle.hooks?.join(' ')}`) + (angle.score || 0) / 200
      }))
      .sort((a, b) => b.score - a.score);
    const primary = ranked[0]?.angle || normalizedAngles[index % Math.max(1, normalizedAngles.length)];
    const secondary = ranked.slice(1, 3).map(item => item.angle).filter(Boolean);
    return {
      ...persona,
      angleType: primary?.type,
      primaryAngle: primary || null,
      secondaryAngles: secondary,
      angleMappings: [primary, ...secondary].filter(Boolean).map((angle, rank) => ({
        angleId: angle.id,
        type: angle.type,
        name: angle.name,
        rank: rank + 1,
        role: rank === 0 ? 'primary_attack_angle' : 'secondary_support_angle'
      }))
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
    return scored;
  }).sort((a, b) => b.score - a.score);

  const beachheadType = angles[0]?.type || 'security_trust';
  const enrichedPersonas = mapPersonasToAngles(personaCards, angles).map((persona, index) => {
    const angle = persona.primaryAngle || angles[index % Math.max(1, angles.length)] || null;
    const channels = deriveChannelsFromBehavior(persona, angle || {});
    const details = persona.details || {};
    const isFirst = index === 0 || angle?.type === beachheadType;
    return {
      ...persona,
      icon: angle?.icon || persona.icon,
      tone: angle?.tone || persona.tone,
      priorityScore: Math.max(Number(persona.priorityScore || 0), angle?.score || 0),
      attackAngle: angle?.promise || persona.attackAngle,
      beachheadPriority: {
        ...(persona.beachheadPriority || {}),
        firstToAttack: isFirst,
        reason: isFirst ? (beachheadMarket?.rationale || angle?.problem || persona.beachheadPriority?.reason) : (angle?.problem || persona.beachheadPriority?.reason)
      },
      details: {
        ...details,
        primaryMarketingAngle: angle?.name || '',
        primaryJobToBeDone: angle?.jobToBeDone || details.primaryJobToBeDone || persona.summary,
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
          positioning: angle?.promise || details.stp?.positioning || persona.attackAngle
        }
      },
      evidenceStatus: angle?.evidenceStatus || 'inferred_without_direct_evidence'
    };
  });

  const deduped = dedupePersonas(enrichedPersonas);
  return {
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
  arePersonasStructurallyDuplicate,
  dedupePersonas,
  deriveChannelsFromBehavior,
  mapPersonasToAngles,
  buildEvidenceCatalog,
  generateMarketingAngleCandidates,
  buildAngleDrivenStpModel
};
