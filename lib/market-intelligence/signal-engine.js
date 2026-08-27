'use strict';

const crypto = require('crypto');

const SIGNAL_TYPES = Object.freeze({
  CUSTOMER_PAIN: 'CUSTOMER_PAIN',
  CUSTOMER_DESIRE: 'CUSTOMER_DESIRE',
  OBJECTION: 'OBJECTION',
  BUYING_CRITERION: 'BUYING_CRITERION',
  COMPLAINT: 'COMPLAINT',
  OFFER_PATTERN: 'OFFER_PATTERN',
  MESSAGE_PATTERN: 'MESSAGE_PATTERN',
  FEATURE_PATTERN: 'FEATURE_PATTERN',
  COMPETITIVE_GAP: 'COMPETITIVE_GAP',
  EMERGING_SIGNAL: 'EMERGING_SIGNAL'
});

const SIGNAL_STATUS = Object.freeze({
  OBSERVED: 'OBSERVED',
  INFERRED: 'INFERRED',
  UNKNOWN: 'UNKNOWN',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

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

function normalize(value) {
  return cleanText(value, 1200)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function hostOf(value = '') {
  try {
    return new URL(String(value).startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return cleanText(value, 120).replace(/^www\./i, '').toLowerCase();
  }
}

function parseDate(value) {
  const raw = cleanText(value, 90);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function daysAgo(dateIso, now = new Date()) {
  if (!dateIso) return null;
  const ms = Date.parse(dateIso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (now.getTime() - ms) / 86400000);
}

function evidenceRowsFrom(input = {}) {
  const registries = [
    input.evidenceRegistry,
    input.marketEvidence?.evidenceRegistry,
    input.agentReachEvidence?.evidenceRegistry
  ];
  const rows = [
    ...asArray(input.evidence),
    ...asArray(input.externalEvidence),
    ...registries.flatMap(registry => asArray(registry?.evidence))
  ];
  const seen = new Set();
  return rows.map((row, index) => {
    const sourceUrl = cleanText(row.sourceUrl || row.url || '', 900) || null;
    const value = cleanText(row.value || row.text || row.summary || row.title, 1400);
    const key = `${sourceUrl || row.id || index}|${row.claimType || 'signal'}|${normalize(value).slice(0, 220)}`;
    if (!value || seen.has(key)) return null;
    seen.add(key);
    return {
      id: cleanText(row.id || `ev_market_${hash(key)}`, 120),
      scope: cleanText(row.scope || 'MARKET', 40).toUpperCase(),
      entityId: cleanText(row.entityId || row.competitorId || hostOf(sourceUrl || value), 160) || null,
      claimType: cleanText(row.claimType || 'market_signal', 80),
      value,
      title: cleanText(row.title, 240) || null,
      sourcePlatform: cleanText(row.sourcePlatform || row.sourceType || row.provider || 'unknown', 80).toLowerCase(),
      sourceUrl,
      publishedAt: parseDate(row.publishedAt),
      collectedAt: parseDate(row.collectedAt || row.observedAt) || new Date().toISOString(),
      confidence: cleanText(row.confidence || 'LOW', 20).toUpperCase(),
      verificationStatus: cleanText(row.verificationStatus || row.status || 'NOT_VERIFIED', 60).toUpperCase(),
      limitations: asArray(row.limitations).map(item => cleanText(item, 240)).filter(Boolean).slice(0, 4)
    };
  }).filter(Boolean);
}

function topicFor(row = {}) {
  const text = normalize(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`);
  const topics = [
    ['price', /price|pricing|prix|tarif|cost|budget|discount|sale|سعر|ثمن|ميزانية|خصم/],
    ['payment_cod', /cod|cash on delivery|payment|paiement|الدفع|دفع|عند الاستلام/],
    ['delivery', /delivery|shipping|livraison|توصيل|شحن|تسليم/],
    ['feature_led', /led|light|eclairage|اضاءة|ضوء/],
    ['feature_usb', /usb|charge|battery|batterie|بطارية|شحن/],
    ['feature_levels', /level|niveau|speed|mode|شفط|مستوى|سرعة/],
    ['skin_result', /skin|face|pore|blackhead|acne|peau|visage|رؤوس سوداء|بشرة|وجه|مسام/],
    ['guarantee', /guarantee|warranty|return|refund|garantie|retour|ضمان|استرجاع|ارجاع/],
    ['reviews_proof', /review|rating|testimonial|avis|proof|preuve|case|before after|قبل وبعد|تقييم|اراء|دليل/],
    ['availability', /stock|available|availability|disponible|توفر|متاح|مخزون/],
    ['support', /support|whatsapp|chat|service client|دعم|واتساب/],
    ['comparison', /compare|comparison|alternative|vs|meilleur|best|بديل|مقارنة|افضل/],
    ['education_method', /course|formation|learn|module|lesson|education|تعلم|تكوين|دورة|منهج/],
    ['local_relevance', /local|near|city|country|maroc|morocco|libya|tunisia|محلي|قريب|المغرب|ليبيا|تونس/]
  ];
  const found = topics.find(([, pattern]) => pattern.test(text));
  if (found) return found[0];
  const words = text.split(' ').filter(word => word.length > 3 && !/^(with|pour|dans|from|that|this|market|source|page|موقع|الذي|على|الى|إلى)$/.test(word));
  return words.slice(0, 3).join('_') || 'general_signal';
}

function classifyRow(row = {}) {
  const claim = normalize(row.claimType);
  const text = normalize(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`);
  const platform = normalize(row.sourcePlatform);
  const types = new Set();

  if (/not_found|not found|missing|gap|weakness|absence|blind|غير واضح|ناقصة|ضعف|غياب/.test(text)) {
    types.add(SIGNAL_TYPES.COMPETITIVE_GAP);
    types.add(SIGNAL_TYPES.OBJECTION);
  }
  if (/pain|problem|friction|fear|peur|doubt|doute|risk|مشكلة|خوف|احتكاك|مخاطرة/.test(text)) types.add(SIGNAL_TYPES.CUSTOMER_PAIN);
  if (/objection|hesitat|question|ask if|faq|why|هل|اعتراض|تردد|سؤال/.test(text)) types.add(SIGNAL_TYPES.OBJECTION);
  if (/complaint|plainte|bad|broken|scam|late|slow|سيئ|شكوى|تاخير|بطيء/.test(text)) types.add(SIGNAL_TYPES.COMPLAINT);
  if (/want|desire|result|benefit|outcome|clean|fast|easy|need|يريد|نتيجة|فائدة|نظيف|سريع|سهل|حاجة/.test(text)) types.add(SIGNAL_TYPES.CUSTOMER_DESIRE);
  if (/price|pricing|delivery|shipping|guarantee|warranty|refund|return|review|rating|proof|payment|cod|سعر|توصيل|شحن|ضمان|استرجاع|دفع|تقييم|دليل/.test(text)) types.add(SIGNAL_TYPES.BUYING_CRITERION);
  if (/offer|product|bundle|discount|guarantee|delivery|cta|landing|deal|عرض|منتج|خصم|زر|طلب/.test(text) || ['offer', 'observed_strength'].includes(claim)) types.add(SIGNAL_TYPES.OFFER_PATTERN);
  if (/feature|section|spec|led|usb|niveau|level|module|whatsapp|instagram|خاصية|ميزة|قسم|اضاءة|شفط|شحن/.test(text)) types.add(SIGNAL_TYPES.FEATURE_PATTERN);
  if (/snippet|title|message|promise|hook|headline|copy|وعد|رسالة|عنوان/.test(text)) types.add(SIGNAL_TYPES.MESSAGE_PATTERN);
  if (['youtube', 'reddit', 'facebook', 'instagram', 'x', 'review', 'reviews'].includes(platform)) {
    types.add(SIGNAL_TYPES.CUSTOMER_PAIN);
    types.add(SIGNAL_TYPES.BUYING_CRITERION);
  }
  if (!types.size) types.add(SIGNAL_TYPES.MESSAGE_PATTERN);
  return [...types];
}

function confidenceFor(rows = [], status = SIGNAL_STATUS.OBSERVED) {
  const confirmed = rows.filter(row => /CONFIRMED|OBSERVED/.test(row.verificationStatus)).length;
  const sourceDiversity = new Set(rows.map(row => row.sourcePlatform || row.sourceUrl || row.id).filter(Boolean)).size;
  if (status !== SIGNAL_STATUS.OBSERVED) return rows.length >= 2 ? 'MEDIUM' : 'LOW';
  if (confirmed >= 3 && sourceDiversity >= 2) return 'HIGH';
  if (confirmed >= 1 || rows.length >= 2) return 'MEDIUM';
  return 'LOW';
}

function temporalCounts(rows = [], now = new Date()) {
  return rows.reduce((acc, row) => {
    const date = row.publishedAt || row.collectedAt;
    const age = daysAgo(date, now);
    if (age == null) {
      acc.unknown += 1;
    } else {
      if (age <= 7) acc.last7d += 1;
      if (age <= 30) acc.last30d += 1;
      if (age <= 90) acc.last90d += 1;
      acc.dated += 1;
    }
    return acc;
  }, { last7d: 0, last30d: 0, last90d: 0, dated: 0, unknown: 0 });
}

function signalStatement(type, topic, rows) {
  const first = rows[0] || {};
  const sample = cleanText(first.title || first.value, 220);
  if (type === SIGNAL_TYPES.COMPETITIVE_GAP) return `Observed or inferred gap around ${topic}: ${sample}`;
  if (type === SIGNAL_TYPES.EMERGING_SIGNAL) return `Fresh signal observed in the collected sample around ${topic}: ${sample}`;
  return `${type.replace(/_/g, ' ').toLowerCase()} observed around ${topic}: ${sample}`;
}

function buildSignal(type, topic, rows, now) {
  const isGap = type === SIGNAL_TYPES.COMPETITIVE_GAP;
  const isEmerging = type === SIGNAL_TYPES.EMERGING_SIGNAL;
  const status = isGap ? SIGNAL_STATUS.INFERRED : SIGNAL_STATUS.OBSERVED;
  const confidence = confidenceFor(rows, status);
  const windows = temporalCounts(rows, now);
  return {
    id: `sig_${type.toLowerCase()}_${hash(`${type}|${topic}|${rows.map(row => row.id).join('|')}`)}`,
    type,
    topic,
    status: isEmerging ? SIGNAL_STATUS.OBSERVED : status,
    statement: signalStatement(type, topic, rows),
    count: rows.length,
    evidenceIds: rows.map(row => row.id).filter(Boolean).slice(0, 12),
    sourceUrls: [...new Set(rows.map(row => row.sourceUrl).filter(Boolean))].slice(0, 8),
    entities: [...new Set(rows.map(row => row.entityId).filter(Boolean))].slice(0, 8),
    sourcePlatforms: [...new Set(rows.map(row => row.sourcePlatform).filter(Boolean))].slice(0, 6),
    confidence,
    temporal: windows,
    firstSeenAt: rows.map(row => row.publishedAt || row.collectedAt).filter(Boolean).sort()[0] || null,
    lastSeenAt: rows.map(row => row.publishedAt || row.collectedAt).filter(Boolean).sort().pop() || null,
    limitations: [
      ...(isGap ? ['This gap is inferred from observed missing or weak evidence; it is not confirmed absence in the whole market.'] : []),
      ...(isEmerging ? ['Freshness means recently observed in this sample, not proven market growth or sales growth.'] : []),
      ...(confidence === 'LOW' ? ['Low confidence until more independent sources confirm the same signal.'] : [])
    ]
  };
}

function buildEmergingSignals(grouped = {}, now = new Date()) {
  const candidates = [];
  Object.entries(grouped).forEach(([key, rows]) => {
    const windows = temporalCounts(rows, now);
    if (windows.last30d >= 2 && windows.dated >= 2) {
      candidates.push(buildSignal(SIGNAL_TYPES.EMERGING_SIGNAL, key.split('::')[1] || 'fresh_signal', rows, now));
    }
  });
  return candidates;
}

function buildMarketSignalEngine(input = {}) {
  const now = input.now ? new Date(input.now) : new Date();
  const evidence = evidenceRowsFrom(input);
  const grouped = {};
  evidence.forEach(row => {
    const topic = topicFor(row);
    classifyRow(row).forEach(type => {
      const key = `${type}::${topic}`;
      grouped[key] = grouped[key] || [];
      grouped[key].push(row);
    });
  });

  const baseSignals = Object.entries(grouped).map(([key, rows]) => {
    const [type, topic] = key.split('::');
    return buildSignal(type, topic, rows, now);
  });
  const emergingSignals = buildEmergingSignals(grouped, now);
  const signals = [...baseSignals, ...emergingSignals]
    .filter(signal => signal.evidenceIds.length > 0)
    .sort((a, b) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (rank[b.confidence] - rank[a.confidence]) || (b.count - a.count);
    });

  const byType = signals.reduce((acc, signal) => {
    acc[signal.type] = acc[signal.type] || [];
    acc[signal.type].push(signal);
    return acc;
  }, {});
  const temporal = temporalCounts(evidence, now);
  const sourceDiversity = new Set(evidence.map(row => row.sourcePlatform || row.sourceUrl || row.id).filter(Boolean)).size;
  return {
    version: 'market-signal-engine-v1',
    generatedAt: now.toISOString(),
    sourceEvidenceCount: evidence.length,
    sourceDiversity,
    signalTypes: Object.keys(byType),
    signals,
    byType,
    temporal,
    quality: {
      observedSignals: signals.filter(signal => signal.status === SIGNAL_STATUS.OBSERVED).length,
      inferredSignals: signals.filter(signal => signal.status === SIGNAL_STATUS.INFERRED).length,
      unsupportedObservedSignals: signals.filter(signal => signal.status === SIGNAL_STATUS.OBSERVED && !signal.evidenceIds.length).length,
      hasTemporalEvidence: temporal.dated > 0,
      noMarketGrowthClaim: true,
      limitations: [
        'Signals are grouped from collected evidence and must be used as inputs to strategy, not as unchecked final claims.',
        ...(temporal.dated ? [] : ['No dated evidence was available for temporal comparison.'])
      ]
    }
  };
}

module.exports = {
  SIGNAL_TYPES,
  SIGNAL_STATUS,
  buildMarketSignalEngine,
  evidenceRowsFrom,
  topicFor,
  classifyRow
};
