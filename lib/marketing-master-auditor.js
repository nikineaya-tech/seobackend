'use strict';

const DEFAULT_LANG = 'fr';

function text(value, max = 5000) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value || {}));
  } catch (_) {
    return {};
  }
}

function flattenStrings(value, out = [], depth = 0) {
  if (depth > 7 || out.length > 900) return out;
  if (typeof value === 'string' || typeof value === 'number') {
    const v = text(value, 900);
    if (v) out.push(v);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach(item => flattenStrings(item, out, depth + 1));
    return out;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (/^(html|raw|bodyText|text|content|sectionHtml|markdown)$/i.test(key)) {
        const v = text(child, 1800);
        if (v) out.push(v);
        return;
      }
      flattenStrings(child, out, depth + 1);
    });
  }
  return out;
}

function addIssue(issues, severity, code, message, path = '') {
  issues.push({ severity, code, message, path });
}

function severityWeight(severity) {
  if (severity === 'critical') return 5;
  if (severity === 'high') return 4;
  if (severity === 'medium') return 2;
  return 1;
}

function isWeakVisibleText(value = '') {
  const v = text(value, 700);
  if (!v) return true;
  const normalized = v.toLowerCase();
  if (/^(null|undefined|nan|n\/a|na|none|empty|---|--|-|non disponible|not available|غير متوفر|لا يوجد|aucun)$/i.test(v)) return true;
  if (/^ev_\d+$/i.test(v)) return true;
  if (/^(proof|evidence|hook|channel|experiment|persona|angle|offer|market|result|demo|case|cta)$/i.test(v)) return true;
  if (/formula d[’']attaque:\s*persona\s*\+/i.test(v)) return true;
  if (/persona \+ tension immediate \+ promesse/i.test(v)) return true;
  if (/same id from input|same or sharper angle name|short evidence from input|clear offer proof/i.test(normalized)) return true;
  return false;
}

function pruneWeakVisibleText(value, path = '') {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => pruneWeakVisibleText(item, `${path}[${index}]`))
      .filter(item => {
        if (item === '' || item == null) return false;
        if (Array.isArray(item)) return item.length > 0;
        if (item && typeof item === 'object') return Object.keys(item).length > 0;
        return true;
      });
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, child]) => {
      if (/^(rawHtml|html|bodyText|text|content|sectionHtml)$/i.test(key) && typeof child === 'string') {
        out[key] = child;
        return;
      }
      const cleaned = pruneWeakVisibleText(child, path ? `${path}.${key}` : key);
      if (cleaned === '' || cleaned == null) return;
      if (Array.isArray(cleaned) && !cleaned.length) return;
      if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned) && !Object.keys(cleaned).length) return;
      out[key] = cleaned;
    });
    return out;
  }
  if (typeof value === 'string') {
    return isWeakVisibleText(value) ? '' : value;
  }
  return value;
}

function normalizeForSimilarity(value = '') {
  return text(value, 500)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(le|la|les|des|du|de|the|and|or|avec|sans|في|من|على|و|أو)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value = '') {
  return new Set(normalizeForSimilarity(value).split(' ').filter(token => token.length > 2));
}

function similarity(a = '', b = '') {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  A.forEach(token => { if (B.has(token)) common += 1; });
  return common / Math.max(A.size, B.size);
}

function countNearDuplicates(strings = [], threshold = 0.78) {
  const clean = strings.map(s => text(s, 700)).filter(s => s.length > 24);
  let duplicates = 0;
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      if (similarity(clean[i], clean[j]) >= threshold) duplicates += 1;
    }
  }
  return duplicates;
}

function collectModuleEvidence(reportType, payload = {}) {
  if (reportType === 'competitors') {
    const competitors = asArray(payload.competitors || payload.topCompetitors || payload.enrichedCompetitors);
    const urls = competitors.map(item => item.url || item.link || item.domain).filter(Boolean);
    return { count: competitors.length, urls };
  }
  if (reportType === 'funnel') {
    const evidence = payload.evidence || payload.funnelEvidence || payload.debugFunnelPipeline?.evidence || {};
    const blocks = asArray(evidence.evidenceBlocks || payload.evidenceBlocks);
    const sections = asArray(payload.rawIntel?.sectionsDetailed || payload.sectionsDetailed || payload.sectionRawBlocks);
    return { count: blocks.length + sections.length, urls: asArray(payload.evidence?.links || payload.proofModel?.observed).map(x => x.url || x.value).filter(Boolean) };
  }
  if (reportType === 'stp') {
    const personas = asArray(payload.personaCards);
    const competitors = asArray(payload.competitorSnapshot?.top10Competitors || payload.competitorSnapshot?.competitors);
    return { count: personas.length + competitors.length, urls: competitors.map(x => x.url || x.link || x.domain).filter(Boolean) };
  }
  if (reportType === 'technical') {
    const observed = asArray(payload.proofModel?.observed);
    const issues = asArray(payload.criticalIssues || payload.actionRoadmap);
    return { count: observed.length + issues.length + (payload.extraction?.title ? 1 : 0), urls: [payload.url || payload.validUrl].filter(Boolean) };
  }
  if (reportType === 'keywords') {
    const keywords = asArray(payload.keywords);
    const paa = asArray(payload.paaQuestions);
    return { count: keywords.length + paa.length, urls: [] };
  }
  return { count: 0, urls: [] };
}

function moduleCompleteness(reportType, payload = {}, issues = []) {
  if (!payload || typeof payload !== 'object') {
    addIssue(issues, 'critical', 'EMPTY_PAYLOAD', 'La réponse est vide ou invalide.');
    return;
  }
  if (payload.success === false) {
    addIssue(issues, 'critical', 'ENGINE_FAILED', text(payload.error || payload.message || 'Le moteur a échoué.'));
    return;
  }
  if (reportType === 'competitors' && !asArray(payload.competitors || payload.topCompetitors || payload.enrichedCompetitors).length) {
    addIssue(issues, 'high', 'NO_COMPETITORS', 'Aucun concurrent exploitable dans la réponse.');
  }
  if (reportType === 'funnel') {
    const hasSections = asArray(payload.rawIntel?.sectionsDetailed || payload.sectionsDetailed || payload.sectionRawBlocks).length;
    const hasSurgery = payload.funnelSurgery || payload.funnelSectionSurgery || payload.sectionSurgery;
    if (!hasSections && !hasSurgery) addIssue(issues, 'high', 'NO_FUNNEL_STRUCTURE', 'Aucune structure de funnel exploitable.');
  }
  if (reportType === 'stp' && !asArray(payload.personaCards).length) {
    addIssue(issues, 'high', 'NO_PERSONAS', 'Aucune carte persona exploitable.');
  }
  if (reportType === 'technical' && !payload.extraction && !payload.seoAudit && !payload.globalReport) {
    addIssue(issues, 'high', 'NO_TECHNICAL_AUDIT', 'Aucun diagnostic technique exploitable.');
  }
  if (reportType === 'keywords' && !asArray(payload.keywords).length) {
    addIssue(issues, 'high', 'NO_KEYWORDS', 'Aucun mot-clé exploitable.');
  }
}

function productCompatibility(reportType, payload = {}, issues = []) {
  if (reportType !== 'stp') return;
  const semanticText = flattenStrings(payload.productUnderstanding || payload.productSemantics || payload.inputs || {}).join(' ');
  const visibleText = flattenStrings(payload.personaCards || payload.marketingAngles || payload.positioningObjects || {}).join(' ');
  const digitalEducation = /education|formation|course|training|digital|online|en ligne|تكوين|دورة|تعليم/i.test(semanticText);
  const physicalShippingClaim = /delivery area|shipping|stock availability|served cities|google maps|zone de livraison|délai de livraison|livraison physique|منطقة التوصيل|الشحن|المخزون/i.test(visibleText);
  if (digitalEducation && physicalShippingClaim) {
    addIssue(issues, 'high', 'PRODUCT_ANGLE_MISMATCH', 'Preuve de livraison physique appliquée à une offre digitale/formation.');
  }
}

function visibleQuality(reportType, payload = {}, issues = []) {
  const strings = flattenStrings(payload);
  const weak = strings.filter(isWeakVisibleText);
  if (weak.length >= 3) {
    addIssue(issues, 'medium', 'WEAK_PLACEHOLDERS', `${weak.length} placeholders ou champs internes visibles détectés.`);
  }
  const formulaLeaks = strings.filter(v => /persona \+ tension immediate \+ promesse|formula d[’']attaque|same id from input|ev_\d+/i.test(v));
  if (formulaLeaks.length) {
    addIssue(issues, 'high', 'INTERNAL_PROMPT_LEAK', 'Des éléments internes ou preuves fictives sont visibles dans la réponse.');
  }
  if (reportType === 'stp') {
    const personas = asArray(payload.personaCards);
    const personaStatements = personas.map(p => p.attackAngle || p.summary || p.details?.primaryJobToBeDone || p.details?.attackAngle || '').filter(Boolean);
    const duplicates = countNearDuplicates(personaStatements);
    if (personas.length >= 2 && duplicates >= Math.max(1, personas.length - 2)) {
      addIssue(issues, 'high', 'PERSONA_REPETITION', 'Les personas répètent le même angle au lieu de créer des segments distincts.');
    }
  }
}

function auditMarketingResponse(reportType, payload = {}, context = {}) {
  const issues = [];
  moduleCompleteness(reportType, payload, issues);
  visibleQuality(reportType, payload, issues);
  productCompatibility(reportType, payload, issues);

  const evidence = collectModuleEvidence(reportType, payload);
  if (evidence.count <= 0 && !['keywords'].includes(reportType)) {
    addIssue(issues, 'medium', 'LOW_EVIDENCE', 'Peu de preuves observées dans la réponse.');
  }

  const severityScore = issues.reduce((sum, item) => sum + severityWeight(item.severity), 0);
  const highCount = issues.filter(item => ['critical', 'high'].includes(item.severity)).length;
  const status = highCount >= 1 || severityScore >= 5
    ? 'needs_correction'
    : issues.length
      ? 'repaired'
      : 'approved';

  return {
    version: 'marketing-master-v1',
    reportType,
    status,
    approved: status !== 'needs_correction',
    needsCorrection: status === 'needs_correction',
    severityScore,
    issues,
    evidence,
    inspectedAt: new Date().toISOString(),
    inspector: 'Daka Marketing Master Auditor',
    context: {
      lang: context.lang || payload.lang || payload.analysisLang || DEFAULT_LANG,
      query: text(context.query || payload.query || payload.inputs?.query || '', 180),
      geo: text(context.geo || payload.geo || payload.inputs?.geo || payload.geoResolved || '', 120)
    }
  };
}

function rejectionMessage(lang = 'fr') {
  if (lang === 'ar') return 'أوقف Daka هذه النتيجة لأن طبقة التدقيق التسويقي رصدت نقصا أو هلوسة محتملة. أعد المحاولة أو اجعل الطلب أكثر تحديدا.';
  if (lang === 'en') return 'Daka stopped this result because the marketing audit layer detected missing evidence or possible hallucination. Try again with a more specific request.';
  return 'Daka a stoppé cette réponse car la couche d’audit marketing a détecté une anomalie ou hallucination possible. Relancez avec une demande plus précise.';
}

function buildMarketingMasterRejection(reportType, audit, lang = DEFAULT_LANG) {
  return {
    success: false,
    error: 'MARKETING_MASTER_NEEDS_CORRECTION',
    reportType,
    message: rejectionMessage(lang),
    marketingMaster: audit
  };
}

async function runMarketingMasterGate(reportType, payload = {}, options = {}) {
  const originalAudit = auditMarketingResponse(reportType, payload, options);
  const working = pruneWeakVisibleText(cloneJson(payload));
  const changedByPrune = JSON.stringify(working) !== JSON.stringify(payload || {});
  let audit = auditMarketingResponse(reportType, working, options);
  if (originalAudit.needsCorrection && !audit.needsCorrection) {
    audit = {
      ...audit,
      status: 'repaired',
      issues: originalAudit.issues,
      repairedIssues: originalAudit.issues.map(issue => issue.code)
    };
  } else if (changedByPrune && audit.status === 'approved') {
    audit = {
      ...audit,
      status: 'repaired',
      repairedIssues: ['WEAK_VISIBLE_TEXT_PRUNED']
    };
  }

  if (!audit.needsCorrection) {
    return {
      payload: {
        ...working,
        marketingMaster: {
          ...audit,
          status: audit.status === 'approved' ? 'approved' : 'repaired',
          approved: true,
          needsCorrection: false
        }
      },
      audit
    };
  }

  if (typeof options.repairWithAi === 'function') {
    try {
      const repaired = await options.repairWithAi({ reportType, payload: working, audit });
      if (repaired && typeof repaired === 'object') {
        const repairedPayload = pruneWeakVisibleText(repaired);
        const repairedAudit = auditMarketingResponse(reportType, repairedPayload, options);
        if (!repairedAudit.needsCorrection) {
          return {
            payload: {
              ...repairedPayload,
              marketingMaster: {
                ...repairedAudit,
                status: 'repaired',
                approved: true,
                needsCorrection: false,
                correctedBy: 'ai-repair-pass'
              }
            },
            audit: repairedAudit
          };
        }
        audit = {
          ...repairedAudit,
          issues: [...audit.issues, ...repairedAudit.issues],
          repairFailed: true
        };
      }
    } catch (error) {
      audit = {
        ...audit,
        repairFailed: true,
        repairError: text(error.message || error, 220)
      };
    }
  }

  return {
    payload: buildMarketingMasterRejection(reportType, audit, options.lang || DEFAULT_LANG),
    audit
  };
}

module.exports = {
  auditMarketingResponse,
  buildMarketingMasterRejection,
  runMarketingMasterGate,
  isWeakVisibleText,
  pruneWeakVisibleText,
  similarity
};
