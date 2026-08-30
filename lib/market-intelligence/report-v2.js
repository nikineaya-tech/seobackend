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

function uniqObjects(values = [], keyFn, limit = 10) {
  const seen = new Set();
  const out = [];

  asArray(values).forEach(value => {
    if (!value || typeof value !== 'object') return;

    let key = '';

    try {
      key = typeof keyFn === 'function'
        ? keyFn(value)
        : [
            value.status,
            value.title,
            value.insight,
            ...evidenceIdsOf(value, 8)
          ].join('::');
    } catch (error) {
      key = '';
    }

    key = cleanText(key, 2000).toLowerCase();

    if (!key || seen.has(key)) return;

    seen.add(key);
    out.push(value);
  });

  return out.slice(0, limit);
}

function semanticKey(value = '') {
  return cleanText(value, 600)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestConfidence(a = 'LOW', b = 'LOW') {
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const current = cleanText(a || 'LOW', 20).toUpperCase();
  const next = cleanText(b || 'LOW', 20).toUpperCase();
  return (rank[next] || 0) > (rank[current] || 0) ? next : current;
}

function mergePatternDuplicates(values = [], keyFn, limit = 10) {
  const byKey = new Map();

  asArray(values).forEach(item => {
    if (!item || typeof item !== 'object') return;
    const rawKey = typeof keyFn === 'function'
      ? keyFn(item)
      : `${item.type || item.format || ''}|${item.key || item.label || item.statement || item.topic || ''}`;
    const key = semanticKey(rawKey);
    if (!key) return;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...item,
        count: Number(item.count || 0),
        evidenceIds: evidenceIdsOf(item, 12),
        sourceUrls: sourceUrlsOf(item, 8),
        sourcePlatforms: uniq(asArray(item.sourcePlatforms), 8),
        limitations: uniq(asArray(item.limitations), 5)
      });
      return;
    }

    existing.count = Math.max(Number(existing.count || 0), Number(item.count || 0));
    existing.evidenceIds = uniq([...asArray(existing.evidenceIds), ...evidenceIdsOf(item, 12)], 12);
    existing.sourceUrls = uniq([...asArray(existing.sourceUrls), ...sourceUrlsOf(item, 8)], 8);
    existing.sourcePlatforms = uniq([...asArray(existing.sourcePlatforms), ...asArray(item.sourcePlatforms)], 8);
    existing.confidence = bestConfidence(existing.confidence, item.confidence);
    existing.limitations = uniq([...asArray(existing.limitations), ...asArray(item.limitations)], 5);
  });

  return Array.from(byKey.values()).slice(0, limit);
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

function localizedPatternLabel(key = '', fallback = '', lang = 'fr') {
  const labels = {
    proof_or_reviews_needed: { fr: 'Preuves, avis ou résultats visibles nécessaires', en: 'Proof, reviews or visible results needed', ar: 'الحاجة إلى دليل أو آراء أو نتيجة مرئية' },
    guarantee_or_return_risk: { fr: 'Risque lié à la garantie ou au retour', en: 'Guarantee, refund or return risk', ar: 'مخاطرة الضمان أو الاسترجاع' },
    price_budget_clarity: { fr: 'Clarté du prix et du budget', en: 'Price and budget clarity', ar: 'وضوح السعر والميزانية' },
    delivery_or_availability: { fr: 'Clarté livraison, stock ou disponibilité', en: 'Delivery, stock or availability clarity', ar: 'وضوح التوصيل أو المخزون أو التوفر' },
    trust_or_scam_risk: { fr: 'Risque de confiance et peur d’être trompé', en: 'Trust risk and fear of being misled', ar: 'مخاطرة الثقة والخوف من التضليل' },
    safety_or_side_effect_fear: { fr: 'Peur sécurité, irritation ou effets secondaires', en: 'Safety, irritation or side-effect fear', ar: 'الخوف من السلامة أو التهيج أو الآثار الجانبية' },
    visible_result_fast: { fr: 'Résultat visible rapidement', en: 'Fast visible result', ar: 'نتيجة مرئية بسرعة' },
    comparison_or_alternatives: { fr: 'Comparaison avec les alternatives', en: 'Comparison against alternatives', ar: 'المقارنة مع البدائل' },
    payment_or_cod: { fr: 'Clarté paiement et paiement à la livraison', en: 'Payment and COD clarity', ar: 'وضوح الدفع والدفع عند الاستلام' },
    method_or_support: { fr: 'Méthode, support ou accompagnement', en: 'Method, support or guided execution', ar: 'المنهجية أو الدعم أو المرافقة' }
  };
  const locale = /^ar/i.test(lang) ? 'ar' : /^en/i.test(lang) ? 'en' : 'fr';
  return cleanText(labels[key]?.[locale] || fallback, 180);
}

function localeOf(lang = 'fr') {
  return /^ar/i.test(lang) ? 'ar' : /^en/i.test(lang) ? 'en' : 'fr';
}

function pickLocale(lang = 'fr', values = {}) {
  const locale = localeOf(lang);
  return cleanText(values[locale] || values.fr || values.en || values.ar || '', 400);
}

function coverageCopy(lang = 'fr') {
  return {
    missing: {
      customerVoice: pickLocale(lang, { fr: 'Voix client réelle insuffisante', en: 'Real customer voice is insufficient', ar: 'صوت العميل الحقيقي غير كاف' }),
      commentsReviews: pickLocale(lang, { fr: 'Commentaires et avis exploitables non collectés', en: 'Usable comments and reviews were not collected', ar: 'لم يتم جمع تعليقات أو آراء قابلة للاستعمال' }),
      socialContent: pickLocale(lang, { fr: 'Intelligence de contenu social faible', en: 'Social content intelligence is weak', ar: 'ذكاء المحتوى الاجتماعي ضعيف' }),
      offerIntel: pickLocale(lang, { fr: 'Lecture comparative des offres faible', en: 'Comparative offer intelligence is weak', ar: 'قراءة العروض المقارنة ضعيفة' }),
      pricing: pickLocale(lang, { fr: 'Prix non vérifiés', en: 'Pricing is not verified', ar: 'الأسعار غير موثقة' }),
      proof: pickLocale(lang, { fr: 'Preuve commerciale faible', en: 'Proof intelligence is weak', ar: 'الأدلة التجارية ضعيفة' }),
      trust: pickLocale(lang, { fr: 'Signaux de confiance faibles', en: 'Trust intelligence is weak', ar: 'إشارات الثقة ضعيفة' }),
      substitutes: pickLocale(lang, { fr: 'Substituts absents', en: 'Substitutes missing', ar: 'البدائل غير مرصودة' }),
      suppliers: pickLocale(lang, { fr: 'Fournisseurs absents', en: 'Supplier intelligence missing', ar: 'بيانات الموردين غير مرصودة' }),
      temporal: pickLocale(lang, { fr: 'Signaux temporels absents', en: 'Temporal intelligence missing', ar: 'الإشارات الزمنية غير مرصودة' }),
      topInsights: pickLocale(lang, { fr: 'Premiers insights pas assez traçables', en: 'Top insights are not traceable enough', ar: 'الرؤى الأولى ليست قابلة للتتبع بما يكفي' })
    },
    labels: {
      topInsights: pickLocale(lang, { fr: 'Premiers insights', en: 'Top insights', ar: 'الرؤى الأولى' }),
      customerVoice: pickLocale(lang, { fr: 'Voix client réelle', en: 'Real customer voice', ar: 'صوت العميل الحقيقي' }),
      commentsReviews: pickLocale(lang, { fr: 'Commentaires et avis', en: 'Comments and reviews', ar: 'التعليقات والآراء' }),
      socialContent: pickLocale(lang, { fr: 'Contenu social', en: 'Social content', ar: 'المحتوى الاجتماعي' }),
      offerIntel: pickLocale(lang, { fr: 'Offres comparées', en: 'Compared offers', ar: 'العروض المقارنة' }),
      pricing: pickLocale(lang, { fr: 'Prix', en: 'Pricing', ar: 'الأسعار' }),
      proofTrust: pickLocale(lang, { fr: 'Preuve et confiance', en: 'Proof and trust', ar: 'الأدلة والثقة' }),
      entityGeo: pickLocale(lang, { fr: 'Pays et entités', en: 'Geo and entities', ar: 'البلد والكيانات' }),
      substitutesSuppliersTemporal: pickLocale(lang, { fr: 'Alternatives, fournisseurs, temps', en: 'Substitutes, suppliers and timing', ar: 'البدائل والموردون والزمن' })
    },
    why: {
      topReady: pickLocale(lang, { fr: 'Insights reliés à des signaux et preuves.', en: 'Insights are linked to signals and evidence.', ar: 'الرؤى مرتبطة بإشارات وأدلة.' }),
      topWeak: pickLocale(lang, { fr: 'Les insights existent peu ou manquent de trace signal/preuve.', en: 'Insights are scarce or missing signal/evidence traceability.', ar: 'الرؤى قليلة أو ينقصها ربط واضح بالإشارات والأدلة.' }),
      customerReady: pickLocale(lang, { fr: 'Douleurs, objections ou critères issus de preuves.', en: 'Pains, objections or buying criteria come from evidence.', ar: 'الآلام أو الاعتراضات أو معايير الشراء مبنية على أدلة.' }),
      customerMissing: pickLocale(lang, { fr: 'Aucun pattern client quantifié depuis des sources traçables.', en: 'No quantified customer pattern from traceable sources.', ar: 'لا يوجد نمط عميل قابل للقياس من مصادر قابلة للتتبع.' }),
      commentsReady: pickLocale(lang, { fr: 'Avis/commentaires observés seulement, sans sentiment inventé.', en: 'Only observed reviews/comments are shown, without invented sentiment.', ar: 'تظهر فقط الآراء أو التعليقات المرصودة دون اختراع شعور العملاء.' }),
      commentsMissing: pickLocale(lang, { fr: 'Aucun avis/commentaire exploitable dans ce run.', en: 'No usable review/comment was collected in this run.', ar: 'لم يتم جمع أي رأي أو تعليق قابل للاستعمال في هذا التشغيل.' }),
      socialReady: pickLocale(lang, { fr: 'Des formats ou messages sociaux existent, mais la diversité peut rester limitée.', en: 'Some social formats or messages exist, but diversity may remain limited.', ar: 'توجد بعض صيغ أو رسائل المحتوى الاجتماعي، لكن التنوع قد يبقى محدودا.' }),
      socialMissing: pickLocale(lang, { fr: 'Pas assez de hooks, formats, CTA ou objections socialement observés.', en: 'Not enough observed hooks, formats, CTAs or social objections.', ar: 'لا توجد هوكات أو صيغ أو دعوات فعل أو اعتراضات اجتماعية كافية مرصودة.' }),
      offerReady: pickLocale(lang, { fr: 'Patterns d’offre détectés avec preuves.', en: 'Offer patterns detected with evidence.', ar: 'تم رصد أنماط عروض مدعومة بأدلة.' }),
      offerMissing: pickLocale(lang, { fr: 'Matrice prix, garantie, livraison, paiement et preuve absente.', en: 'Price, guarantee, delivery, payment and proof matrix is missing.', ar: 'مصفوفة السعر والضمان والتوصيل والدفع والدليل غير مكتملة.' }),
      pricingReady: pickLocale(lang, { fr: 'Prix ou signaux prix observés.', en: 'Price or pricing signals observed.', ar: 'تم رصد أسعار أو إشارات سعر.' }),
      pricingMissing: pickLocale(lang, { fr: 'Aucun prix confirmé ni fourchette vérifiable.', en: 'No confirmed price or verifiable range.', ar: 'لا يوجد سعر مؤكد أو نطاق قابل للتحقق.' }),
      proofReady: pickLocale(lang, { fr: 'Quelques preuves ou signaux de confiance existent.', en: 'Some proof or trust signals exist.', ar: 'توجد بعض الأدلة أو إشارات الثقة.' }),
      proofMissing: pickLocale(lang, { fr: 'Avis, UGC, garantie, retour, paiement ou contact non vérifiés.', en: 'Reviews, UGC, guarantee, returns, payment or contact are not verified.', ar: 'الآراء أو المحتوى الحقيقي أو الضمان أو الإرجاع أو الدفع أو التواصل غير موثقة.' }),
      entity: pickLocale(lang, { fr: 'Les entités restent typées: direct, local, benchmark, marketplace, substitut ou fournisseur.', en: 'Entities stay classified: direct, local, benchmark, marketplace, substitute or supplier.', ar: 'يتم تصنيف الكيانات بوضوح: مباشر، محلي، معيار خارجي، سوق، بديل أو مورد.' }),
      advanced: pickLocale(lang, { fr: 'Ces couches nécessitent des preuves spécialisées et datées.', en: 'These layers require specialized and dated evidence.', ar: 'هذه الطبقات تحتاج أدلة متخصصة ومؤرخة.' })
    },
    next: {
      top: pickLocale(lang, { fr: 'Croiser voix client, offres et concurrents avant recommandation.', en: 'Cross customer voice, offers and competitors before recommending.', ar: 'اربط صوت العميل بالعروض والمنافسين قبل التوصية.' }),
      customer: pickLocale(lang, { fr: 'Collecter avis, commentaires, questions et plaintes par plateforme.', en: 'Collect reviews, comments, questions and complaints by platform.', ar: 'اجمع الآراء والتعليقات والأسئلة والشكاوى حسب المنصة.' }),
      comments: pickLocale(lang, { fr: 'Activer ou corriger les canaux sociaux/avis indisponibles.', en: 'Enable or fix unavailable social/review channels.', ar: 'فعّل أو أصلح قنوات التعليقات والآراء غير المتاحة.' }),
      social: pickLocale(lang, { fr: 'Analyser hooks, formats, commentaires, CTA et objections par canal.', en: 'Analyze hooks, formats, comments, CTAs and objections by channel.', ar: 'حلل الهوكات والصيغ والتعليقات ودعوات الفعل والاعتراضات حسب القناة.' }),
      offer: pickLocale(lang, { fr: 'Construire la matrice prix / preuve / garantie / livraison / paiement.', en: 'Build the price / proof / guarantee / delivery / payment matrix.', ar: 'ابن مصفوفة السعر / الدليل / الضمان / التوصيل / الدفع.' }),
      pricing: pickLocale(lang, { fr: 'Ne pas transformer une promesse en prix ni un prix en promesse.', en: 'Do not turn a promise into a price or a price into a promise.', ar: 'لا تحول الوعد إلى سعر ولا السعر إلى وعد.' }),
      proof: pickLocale(lang, { fr: 'Séparer preuve observée, inférence prudente et test recommandé.', en: 'Separate observed proof, cautious inference and recommended test.', ar: 'افصل بين الدليل المرصود والاستنتاج الحذر والتجربة المقترحة.' }),
      entity: pickLocale(lang, { fr: 'Expliquer pourquoi un résultat est local probable ou benchmark.', en: 'Explain why a result is likely local or a benchmark.', ar: 'اشرح لماذا النتيجة محلية محتملة أو معيار خارجي.' }),
      advanced: pickLocale(lang, { fr: 'Garder INCONNU lorsque fournisseur, substitut ou tendance ne sont pas prouvés.', en: 'Keep UNKNOWN when supplier, substitute or trend is not proven.', ar: 'ابقها غير معروفة عندما لا يثبت المورد أو البديل أو الاتجاه.' })
    },
    qualityLimitations: [
      pickLocale(lang, { fr: 'Une couverture faible ou moyenne impose un ton prudent, sans affirmation sur tout le marché.', en: 'Low or medium coverage requires cautious wording, without full-market claims.', ar: 'التغطية الضعيفة أو المتوسطة تفرض صياغة حذرة دون تعميم على السوق كله.' }),
      pickLocale(lang, { fr: 'La visibilité SERP n’est pas une part de marché.', en: 'SERP visibility is not market share.', ar: 'الظهور في نتائج البحث ليس حصة سوقية.' }),
      pickLocale(lang, { fr: 'Certaines briques restent manquantes faute de preuves traçables.', en: 'Some intelligence blocks remain missing because no traceable evidence was collected.', ar: 'تبقى بعض طبقات الذكاء ناقصة لأن الأدلة القابلة للتتبع لم تجمع.' })
    ]
  };
}

function compactCustomerVoicePattern(pattern = {}, lang = 'fr') {
  return {
    id: cleanText(pattern.id, 120),
    type: cleanText(pattern.type, 80),
    key: cleanText(pattern.key, 120),
    label: localizedPatternLabel(pattern.key, pattern.label, lang),
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

function compactDiscoveryInsight(insight = {}) {
  return {
    id: cleanText(insight.id, 120),
    type: cleanText(insight.type, 90),
    status: cleanText(insight.status || SIGNAL_STATUS.INFERRED, 60),
    title: cleanText(insight.title, 180),
    finding: cleanText(insight.finding, 520),
    whyItMatters: cleanText(insight.whyItMatters || insight.interpretation, 520),
    relationship: cleanText(insight.relationship, 420),
    interpretation: cleanText(insight.interpretation, 520),
    decisionTest: cleanText(insight.decisionTest, 360),
    recommendedTest: insight.recommendedTest || null,
    dimensions: uniq(asArray(insight.dimensions), 8),
    metrics: insight.metrics || {},
    confidence: cleanText(insight.confidence || 'LOW', 20).toUpperCase(),
    score: Number(insight.score || 0),
    formula: cleanText(insight.formula, 240),
    evidenceStrengthScore: Number(insight.evidenceStrengthScore || 0),
    crossSourceDiversityScore: Number(insight.crossSourceDiversityScore || 0),
    crossDimensionDepthScore: Number(insight.crossDimensionDepthScore || 0),
    businessImpactScore: Number(insight.businessImpactScore || 0),
    actionabilityScore: Number(insight.actionabilityScore || 0),
    noveltyScore: Number(insight.noveltyScore || 0),
    freshnessScore: Number(insight.freshnessScore || 0),
    geoRelevanceScore: Number(insight.geoRelevanceScore || 0),
    signalIds: uniq(asArray(insight.signalIds), 10),
    evidenceIds: evidenceIdsOf(insight, 12),
    sourceUrls: sourceUrlsOf(insight, 8),
    sourcePlatforms: uniq(asArray(insight.sourcePlatforms), 8),
    components: insight.components || {},
    limitations: asArray(insight.limitations).map(item => cleanText(item, 240)).filter(Boolean).slice(0, 4)
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
  const agentObservations = asArray(
    strategicAgentsV2.marketPatternAnalyst?.observations
  )
    .map(observedObservation)
    .filter(Boolean);

  const fallbackObservations = asArray(marketSignalModel.signals)
    .map(observedObservation)
    .filter(Boolean);

  const observations = [
    ...agentObservations,
    ...fallbackObservations
  ];

  const seen = new Set();
  const out = [];

  for (const item of observations) {
    if (!item || typeof item !== 'object') continue;

    const key = [
      item.status || '',
      item.title || '',
      item.insight || '',
      ...evidenceIdsOf(item, 8)
    ]
      .join('::')
      .toLowerCase();

    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(item);

    if (out.length >= 5) break;
  }

  return out;
}
function buildCustomerVoice(marketSignalModel = {}, lang = 'fr') {
  const quantified = asArray(marketSignalModel.customerVoice?.patterns)
    .filter(pattern => evidenceIdsOf(pattern).length > 0)
    .map(pattern => compactCustomerVoicePattern(pattern, lang));
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

function isCustomerVoicePlatform(row = {}) {
  const platform = cleanText(row.sourcePlatform, 80).toLowerCase();
  const url = cleanText(row.sourceUrl || row.url, 600).toLowerCase();
  return /^(youtube|reddit|facebook|instagram|tiktok|x|twitter|trustpilot|google_reviews?|review|reviews)$/i.test(platform) ||
    /youtube\.com|youtu\.be|reddit\.com|facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|trustpilot|avis|reviews?|comments?/.test(url);
}

function isGenericMarketPlatform(row = {}) {
  const platform = cleanText(row.sourcePlatform, 80).toLowerCase();
  return /^(serp|serper|serpapi|web|website|jina|jina_search|jina_reader|inspected_page|organic|search|marketplace|shopping)$/i.test(platform);
}

function hasExplicitCustomerVoiceClaim(row = {}) {
  const claim = cleanText(row.claimType, 120).toLowerCase();
  return /customer[_\s-]?voice|customer[_\s-]?review|customer[_\s-]?comment|customer[_\s-]?question|customer[_\s-]?complaint|review|avis|comment|testimonial|rating|opinion|feedback|reaction|complaint|objection|question|faq|تقييم|آراء|اراء|مراجعة|تعليق|شكوى|اعتراض|سؤال/.test(claim);
}

function isCommentsReviewsEvidence(row = {}) {
  const scope = cleanText(row.scope, 60).toUpperCase();
  const text = cleanText(`${row.title || ''} ${row.value || ''}`, 2200).toLowerCase();
  const textHint = /review|avis|comment|testimonial|rating|feedback|experience|question|objection|complaint|تقييم|آراء|اراء|مراجعة|تعليق|تجربة|سؤال|شكوى|اعتراض/i;
  const customerPlatform = isCustomerVoicePlatform(row);
  const explicitVoiceClaim = hasExplicitCustomerVoiceClaim(row);

  if (isGenericMarketPlatform(row) && !customerPlatform) return false;

  return Boolean(
    row.value &&
    (
      (scope === 'CUSTOMER' && (explicitVoiceClaim || customerPlatform || textHint.test(text))) ||
      (customerPlatform && (explicitVoiceClaim || textHint.test(text)))
    )
  );
}

function commentsReviewsCopy(lang = 'fr') {
  return {
    limitations: {
      evidenceOnly: pickLocale(lang, {
        fr: 'Cette section affiche uniquement les avis, commentaires, questions ou preuves de voix client issus de sources traçables.',
        en: 'This section only shows reviews, comments, questions or customer-voice evidence from traceable sources.',
        ar: 'يعرض هذا القسم فقط الآراء أو التعليقات أو الأسئلة أو أدلة صوت العميل القادمة من مصادر قابلة للتتبع.'
      }),
      none: pickLocale(lang, {
        fr: 'Aucun avis/commentaire exploitable n’a été collecté dans ce run. Ne pas déduire le sentiment client à partir d’une absence de preuve.',
        en: 'No usable comment or review was collected in this run. Do not infer customer sentiment from absence of evidence.',
        ar: 'لم يتم جمع أي رأي أو تعليق قابل للاستعمال في هذا التشغيل. لا تستنتج شعور العميل من غياب الدليل.'
      }),
      diversity: pickLocale(lang, {
        fr: 'La diversité des sources voix client reste faible tant qu’une autre plateforme indépendante ne confirme pas le même motif.',
        en: 'Customer voice source diversity is still low until another independent platform confirms the same pattern.',
        ar: 'يبقى تنوع مصادر صوت العميل ضعيفا إلى أن تؤكد منصة مستقلة أخرى نفس النمط.'
      })
    }
  };
}

function classifyCommentsReviewsEvidence(row = {}) {
  const haystack = cleanText(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`, 1800).toLowerCase();
  if (/complaint|plainte|شكوى|سيئ|bad|broken|late|slow|broke|تأخير|بطيء/.test(haystack)) return 'complaint';
  if (/question|faq|ask|هل|كيف|لماذا|سؤال|استفسار/.test(haystack)) return 'question';
  if (/review|avis|testimonial|rating|تقييم|آراء|اراء|مراجعة|شهادة/.test(haystack)) return 'review';
  if (/comment|feedback|reaction|opinion|تعليق|رأي|تجربة/.test(haystack)) return 'comment';
  return 'customer_voice';
}

function compactCommentsReviewsEvidence(row = {}) {
  return {
    id: cleanText(row.id, 120),
    kind: classifyCommentsReviewsEvidence(row),
    value: cleanText(row.value, 360),
    title: cleanText(row.title, 180) || null,
    sourcePlatform: cleanText(row.sourcePlatform || 'unknown', 80).toLowerCase(),
    sourceUrl: cleanText(row.sourceUrl || row.url, 600) || null,
    publishedAt: cleanText(row.publishedAt, 80) || null,
    collectedAt: cleanText(row.collectedAt, 80) || null,
    confidence: cleanText(row.confidence || 'LOW', 20).toUpperCase(),
    verificationStatus: cleanText(row.verificationStatus || 'NOT_VERIFIED', 80).toUpperCase()
  };
}

function domainOf(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function evidenceMetrics(input = {}) {
  const rows = rawEvidenceIndex(input);
  const platforms = uniq(rows.map(row => row.sourcePlatform).filter(Boolean), 40);
  const domains = uniq(rows.map(row => domainOf(row.sourceUrl)).filter(Boolean), 60);
  const datedEvidenceCount = rows.filter(row => row.publishedAt || row.collectedAt).length;
  return {
    evidenceCount: rows.length,
    sourceDiversity: platforms.length,
    domainDiversity: domains.length,
    platforms,
    domains,
    datedEvidenceCount
  };
}

function countEntityTypes(marketEntityMap = {}) {
  const byType = marketEntityMap.byType || {};
  const count = type => asArray(byType[type]).length;
  return {
    directCompetitors: count('DIRECT_COMPETITOR'),
    localSellers: count('LOCAL_SELLER'),
    regionalBenchmarks: count('REGIONAL_BENCHMARK'),
    marketplaces: count('MARKETPLACE'),
    substitutes: count('SUBSTITUTE'),
    suppliers: count('SUPPLIER'),
    informationSources: count('INFORMATION_SOURCE')
  };
}

function sectionCoverage({ key, label, status, why = '', evidenceCount = 0, signalCount = 0, next = '' }) {
  return {
    key,
    label,
    status,
    why: cleanText(why, 260),
    evidenceCount: Number(evidenceCount || 0),
    signalCount: Number(signalCount || 0),
    next: cleanText(next, 220) || null
  };
}

function buildMarketCoverage(input = {}, marketSignalModel = {}, commentsReviews = {}) {
  const copy = coverageCopy(input.lang || input.reportLang || 'fr');
  const metrics = evidenceMetrics(input);
  const entities = countEntityTypes(input.marketEntityMap || {});
  const coverageGate = input.insightDiscoveryModel?.coverageGate || {};
  const topInsights = asArray(input.insightDiscoveryModel?.topInsights);
  const allSignals = asArray(marketSignalModel.signals);
  const offerPatterns = asArray(marketSignalModel.offerIntelligence?.patterns).filter(pattern => evidenceIdsOf(pattern).length > 0);
  const socialPatterns = asArray(marketSignalModel.socialContent?.patterns).filter(pattern => evidenceIdsOf(pattern).length > 0);
  const customerPatterns = asArray(marketSignalModel.customerVoice?.patterns).filter(pattern => evidenceIdsOf(pattern).length > 0);
  const channelDiagnostics = asArray(input.agentReachEvidence?.channelDiagnostics);
  const readyChannels = channelDiagnostics.filter(item => String(item.status || '').toUpperCase() === 'READY' && Number(item.evidence ?? item.evidenceCount ?? 0) > 0);
  const hasPricing = offerPatterns.some(pattern => cleanText(pattern.aspect).toLowerCase() === 'pricing');
  const hasProof = offerPatterns.some(pattern => cleanText(pattern.aspect).toLowerCase() === 'proof') || commentsReviews.summary?.reviews > 0;
  const hasTrust = offerPatterns.some(pattern => /payment|fulfillment|risk_reversal|proof/i.test(cleanText(pattern.aspect)));
  const hasTraceableTopInsights = topInsights.length > 0 && topInsights.every(item => evidenceIdsOf(item).length > 0 && asArray(item.signalIds).length > 0);
  const level = cleanText(coverageGate.level || (
    metrics.evidenceCount >= 10 && metrics.sourceDiversity >= 3 && (entities.directCompetitors + entities.localSellers) >= 3
      ? 'HIGH'
      : metrics.evidenceCount >= 6 && metrics.sourceDiversity >= 2
        ? 'MEDIUM'
        : 'LOW'
  ), 20).toUpperCase();
  const missingCapabilities = uniq([
    customerPatterns.length ? null : copy.missing.customerVoice,
    commentsReviews.summary?.evidenceCount ? null : copy.missing.commentsReviews,
    socialPatterns.length ? null : copy.missing.socialContent,
    offerPatterns.length ? null : copy.missing.offerIntel,
    hasPricing ? null : copy.missing.pricing,
    hasProof ? null : copy.missing.proof,
    hasTrust ? null : copy.missing.trust,
    entities.substitutes ? null : copy.missing.substitutes,
    entities.suppliers ? null : copy.missing.suppliers,
    metrics.datedEvidenceCount ? null : copy.missing.temporal,
    hasTraceableTopInsights ? null : copy.missing.topInsights
  ], 14);

  const sections = [
    sectionCoverage({
      key: 'top_insights',
      label: copy.labels.topInsights,
      status: hasTraceableTopInsights ? 'READY' : 'WEAK',
      why: hasTraceableTopInsights ? copy.why.topReady : copy.why.topWeak,
      evidenceCount: topInsights.reduce((sum, item) => sum + evidenceIdsOf(item).length, 0),
      signalCount: topInsights.reduce((sum, item) => sum + asArray(item.signalIds).length, 0),
      next: copy.next.top
    }),
    sectionCoverage({
      key: 'customer_voice',
      label: copy.labels.customerVoice,
      status: customerPatterns.length ? 'READY' : 'MISSING',
      why: customerPatterns.length ? copy.why.customerReady : copy.why.customerMissing,
      evidenceCount: customerPatterns.reduce((sum, item) => sum + evidenceIdsOf(item).length, 0),
      signalCount: customerPatterns.length,
      next: copy.next.customer
    }),
    sectionCoverage({
      key: 'comments_reviews',
      label: copy.labels.commentsReviews,
      status: commentsReviews.summary?.evidenceCount ? 'READY' : 'MISSING',
      why: commentsReviews.summary?.evidenceCount ? copy.why.commentsReady : copy.why.commentsMissing,
      evidenceCount: commentsReviews.summary?.evidenceCount || 0,
      signalCount: commentsReviews.summary?.patternCount || 0,
      next: copy.next.comments
    }),
    sectionCoverage({
      key: 'social_content',
      label: copy.labels.socialContent,
      status: socialPatterns.length >= 2 && readyChannels.length >= 2 ? 'READY' : (socialPatterns.length || readyChannels.length ? 'WEAK' : 'MISSING'),
      why: socialPatterns.length ? copy.why.socialReady : copy.why.socialMissing,
      evidenceCount: socialPatterns.reduce((sum, item) => sum + evidenceIdsOf(item).length, 0),
      signalCount: socialPatterns.length,
      next: copy.next.social
    }),
    sectionCoverage({
      key: 'offer_intelligence',
      label: copy.labels.offerIntel,
      status: offerPatterns.length >= 3 ? 'READY' : (offerPatterns.length ? 'WEAK' : 'MISSING'),
      why: offerPatterns.length ? copy.why.offerReady : copy.why.offerMissing,
      evidenceCount: offerPatterns.reduce((sum, item) => sum + evidenceIdsOf(item).length, 0),
      signalCount: offerPatterns.length,
      next: copy.next.offer
    }),
    sectionCoverage({ key: 'pricing', label: copy.labels.pricing, status: hasPricing ? 'READY' : 'MISSING', why: hasPricing ? copy.why.pricingReady : copy.why.pricingMissing, evidenceCount: offerPatterns.filter(pattern => cleanText(pattern.aspect).toLowerCase() === 'pricing').reduce((sum, item) => sum + evidenceIdsOf(item).length, 0), signalCount: offerPatterns.filter(pattern => cleanText(pattern.aspect).toLowerCase() === 'pricing').length, next: copy.next.pricing }),
    sectionCoverage({ key: 'proof_trust', label: copy.labels.proofTrust, status: hasProof && hasTrust ? 'READY' : (hasProof || hasTrust ? 'WEAK' : 'MISSING'), why: hasProof || hasTrust ? copy.why.proofReady : copy.why.proofMissing, evidenceCount: offerPatterns.filter(pattern => /payment|fulfillment|risk_reversal|proof/i.test(cleanText(pattern.aspect))).reduce((sum, item) => sum + evidenceIdsOf(item).length, 0) + (commentsReviews.summary?.evidenceCount || 0), signalCount: offerPatterns.filter(pattern => /payment|fulfillment|risk_reversal|proof/i.test(cleanText(pattern.aspect))).length, next: copy.next.proof }),
    sectionCoverage({ key: 'entity_geo', label: copy.labels.entityGeo, status: (entities.directCompetitors + entities.localSellers + entities.regionalBenchmarks + entities.marketplaces) ? 'READY' : 'WEAK', why: copy.why.entity, evidenceCount: metrics.evidenceCount, signalCount: entities.directCompetitors + entities.localSellers + entities.regionalBenchmarks + entities.marketplaces, next: copy.next.entity }),
    sectionCoverage({ key: 'substitutes_suppliers_temporal', label: copy.labels.substitutesSuppliersTemporal, status: entities.substitutes || entities.suppliers || metrics.datedEvidenceCount ? 'WEAK' : 'MISSING', why: copy.why.advanced, evidenceCount: metrics.datedEvidenceCount, signalCount: entities.substitutes + entities.suppliers, next: copy.next.advanced })
  ];

  return {
    level,
    status: level === 'HIGH' ? 'READY' : level === 'MEDIUM' ? 'PARTIAL' : 'LOW_COVERAGE',
    summary: {
      evidenceCount: metrics.evidenceCount,
      sourceDiversity: metrics.sourceDiversity,
      domainDiversity: metrics.domainDiversity,
      datedEvidenceCount: metrics.datedEvidenceCount,
      readyChannels: readyChannels.length,
      localCommercialEntities: entities.directCompetitors + entities.localSellers,
      regionalBenchmarks: entities.regionalBenchmarks,
      marketplaces: entities.marketplaces,
      substitutes: entities.substitutes,
      suppliers: entities.suppliers
    },
    entityClassification: entities,
    missingCapabilities,
    sections,
    quality: {
      canonicalCoverageObject: true,
      noSocialContradiction: true,
      notFoundDoesNotMeanAbsent: true,
      limitations: [
        copy.qualityLimitations[0],
        copy.qualityLimitations[1],
        ...(missingCapabilities.length ? [copy.qualityLimitations[2]] : [])
      ]
    }
  };
}

function compactChannelDiagnostic(item = {}) {
  return {
    channel: cleanText(item.channel || 'unknown', 80),
    provider: cleanText(item.provider || 'agent-reach', 80),
    backend: cleanText(item.backend || item.provider || 'unknown', 80),
    status: cleanText(item.status || 'UNKNOWN', 40).toUpperCase(),
    reason: cleanText(item.reason || '', 180) || null,
    resultCount: Number(item.resultCount || 0),
    evidenceCount: Number(item.evidence ?? item.evidenceCount ?? 0),
    durationMs: Number(item.durationMs || 0)
  };
}

function buildCommentsReviews(input = {}, marketSignalModel = {}) {
  const lang = cleanText(input.lang || 'fr', 20);
  const copy = commentsReviewsCopy(lang);
  const evidenceRows = rawEvidenceIndex(input)
    .filter(isCommentsReviewsEvidence)
    .map(compactCommentsReviewsEvidence);
  const uniqueEvidence = uniqObjects(
    evidenceRows,
    item => `${item.kind}|${item.sourceUrl}|${semanticKey(item.value).slice(0, 180)}`,
    24
  );
  const diagnostics = uniqObjects(
    asArray(input.agentReachEvidence?.channelDiagnostics)
    .map(compactChannelDiagnostic)
    .filter(item => item.channel),
    item => `${item.channel}|${item.backend}|${item.status}|${item.reason || ''}`,
    16
  );
  const patterns = mergePatternDuplicates([
    ...asArray(marketSignalModel.customerVoice?.patterns).map(pattern => compactCustomerVoicePattern(pattern, lang)),
    ...asArray(marketSignalModel.socialContent?.patterns)
      .filter(pattern => ['review', 'faq'].includes(pattern.format))
      .map(compactSocialContentPattern)
  ].filter(pattern => evidenceIdsOf(pattern).length > 0), item => {
    const family = item.type || item.format || 'pattern';
    const topic = item.key || item.label || item.statement || item.topic || '';
    return topic || family;
  }, 12);
  const platforms = uniq(uniqueEvidence.map(item => item.sourcePlatform), 10);
  const countsByKind = uniqueEvidence.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    return acc;
  }, {});
  const channelSummary = input.agentReachEvidence?.channelSummary || {};

  return {
    mode: uniqueEvidence.length ? 'observed_comments_reviews' : 'insufficient_customer_voice_evidence',
    status: uniqueEvidence.length ? 'READY' : 'NO_COMMENTS_OR_REVIEWS_FOUND',
    summary: {
      evidenceCount: uniqueEvidence.length,
      patternCount: patterns.length,
      platformCount: platforms.length,
      platforms,
      comments: countsByKind.comment || 0,
      reviews: countsByKind.review || 0,
      questions: countsByKind.question || 0,
      complaints: countsByKind.complaint || 0
    },
    patterns,
    observedItems: uniqueEvidence,
    channelDiagnostics: diagnostics,
    unavailableChannels: diagnostics.filter(item => item.status !== 'READY' || item.evidenceCount <= 0).slice(0, 10),
    channelSummary: {
      ready: Number(channelSummary.ready || diagnostics.filter(item => item.status === 'READY').length || 0),
      unavailable: Number(channelSummary.unavailable || diagnostics.filter(item => item.status === 'UNAVAILABLE').length || 0),
      authRequired: Number(channelSummary.authRequired || diagnostics.filter(item => item.status === 'AUTH_REQUIRED').length || 0),
      errors: Number(channelSummary.errors || diagnostics.filter(item => item.status === 'ERROR').length || 0)
    },
    quality: {
      evidenceOnly: true,
      noInventedReviews: true,
      noInventedEngagementClaims: true,
      limitations: [
        copy.limitations.evidenceOnly,
        ...(uniqueEvidence.length ? [] : [copy.limitations.none]),
        ...(platforms.length >= 2 ? [] : [copy.limitations.diversity])
      ]
    }
  };
}

function buildSellerFight(marketSignalModel = {}) {
  const quantified = mergePatternDuplicates(asArray(marketSignalModel.offerIntelligence?.patterns)
    .filter(pattern => evidenceIdsOf(pattern).length > 0)
    .map(compactOfferPattern), item => `${item.aspect || 'offer'}|${item.key || item.label}`, 32);
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
  const quantified = mergePatternDuplicates(asArray(marketSignalModel.socialContent?.patterns)
    .filter(pattern => evidenceIdsOf(pattern).length > 0)
    .map(compactSocialContentPattern), item => `${item.format || 'content'}|${item.key || item.label}`, 32);
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
    insightDiscovery: {
      mode: cleanText(input.insightDiscoveryModel?.mode || 'cross_source_relationship_discovery', 120),
      insights: asArray(input.insightDiscoveryModel?.insights).map(compactDiscoveryInsight).slice(0, 12),
      insightTrace: input.insightDiscoveryModel?.insightTrace || {},
      coverageGate: input.insightDiscoveryModel?.coverageGate || null,
      validation: input.insightDiscoveryModel?.validation || null,
      quality: input.insightDiscoveryModel?.quality || null
    },
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
  const reportLang = cleanText(input.lang || 'fr', 20);
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
  const commentsReviews = buildCommentsReviews(input, marketSignalModel);
  const marketCoverage = buildMarketCoverage(input, marketSignalModel, commentsReviews);

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
      marketCoverage,
      discoveryInsights: asArray(input.insightDiscoveryModel?.topInsights).map(compactDiscoveryInsight).slice(0, 5),
      marketIn60Seconds: observations,
      customerVoice: buildCustomerVoice(marketSignalModel, reportLang),
      commentsReviews,
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
