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

function relevanceTokens(value = '') {
  return normalize(value)
    .split(/\s+/)
    .filter(token => token.length >= 4)
    .filter(token => !/^(with|from|that|this|market|source|page|product|produit|avec|pour|dans|sans|plus|moins|موقع|الذي|التي|على|الى|إلى|هذا|هذه|ذلك|منتج|سوق)$/.test(token))
    .slice(0, 18);
}

function countryAliases(value = '') {
  const raw = normalize(value);
  const aliases = {
    libya: ['libya', 'libye', 'ليبيا'],
    ly: ['libya', 'libye', 'ليبيا'],
    morocco: ['morocco', 'maroc', 'المغرب'],
    maroc: ['morocco', 'maroc', 'المغرب'],
    ma: ['morocco', 'maroc', 'المغرب'],
    tunisia: ['tunisia', 'tunisie', 'تونس'],
    tunisie: ['tunisia', 'tunisie', 'تونس'],
    tn: ['tunisia', 'tunisie', 'تونس'],
    algeria: ['algeria', 'algerie', 'الجزائر'],
    algerie: ['algeria', 'algerie', 'الجزائر'],
    dz: ['algeria', 'algerie', 'الجزائر'],
    egypt: ['egypt', 'egypte', 'مصر'],
    egypte: ['egypt', 'egypte', 'مصر'],
    eg: ['egypt', 'egypte', 'مصر']
  };
  return aliases[raw] || (raw ? [raw] : []);
}

function isLooseSearchEvidence(row = {}) {
  const platform = normalize(row.sourcePlatform);
  const claim = normalize(row.claimType);
  return ['jina_search', 'exa_search'].includes(platform) ||
    /jina_search|exa_search|search_result|search_results/.test(claim);
}

function matchesQueryContext(row = {}, context = {}) {
  const queryTokens = relevanceTokens(`${context.reportQuery || ''} ${context.query || ''} ${context.originalQuery || ''}`);
  const rowText = normalize(`${row.title || ''} ${row.value || ''}`);
  if (!queryTokens.length || !rowText) return true;

  const tokenHits = queryTokens.filter(token => rowText.includes(token)).length;
  const productRelevant = tokenHits >= Math.min(2, queryTokens.length);
  const aliases = countryAliases(context.country || context.geo || context.market || '');
  const countryRelevant = !aliases.length || aliases.some(alias => rowText.includes(normalize(alias)));
  return productRelevant && countryRelevant;
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

function classifyRow(row = {}, context = {}) {
  const claim = normalize(row.claimType);
  const text = normalize(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`);
  const platform = normalize(row.sourcePlatform);
  const types = new Set();

  if (isLooseSearchEvidence(row) && !matchesQueryContext(row, context)) {
    types.add(SIGNAL_TYPES.MESSAGE_PATTERN);
    return [...types];
  }

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

function isCustomerVoicePlatform(row = {}) {
  const platform = normalize(row.sourcePlatform);
  const url = normalize(`${row.sourceUrl || ''} ${row.url || ''}`);
  return ['youtube', 'reddit', 'facebook', 'instagram', 'x', 'twitter', 'tiktok', 'trustpilot', 'google_reviews', 'review', 'reviews'].includes(platform) ||
    /youtube|youtu be|reddit|facebook|instagram|tiktok|twitter|trustpilot|google reviews|avis|reviews?|comments?/.test(url);
}

function isGenericMarketPlatform(row = {}) {
  const platform = normalize(row.sourcePlatform);
  return ['serp', 'serper', 'serpapi', 'web', 'website', 'jina', 'jina_search', 'jina_reader', 'inspected_page', 'organic', 'search', 'marketplace', 'shopping'].includes(platform);
}

function hasExplicitCustomerVoiceClaim(row = {}) {
  const claim = normalize(row.claimType);
  return /customer voice|voice of customer|customer review|customer comment|customer question|customer complaint|review|avis|comment|testimonial|rating|opinion|feedback|reaction|complaint|objection|question|faq|تقييم|اراء|آراء|مراجعة|تعليق|شكوى|اعتراض|سؤال/.test(claim);
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

const CUSTOMER_VOICE_PATTERNS = Object.freeze([
  {
    type: SIGNAL_TYPES.OBJECTION,
    key: 'proof_or_reviews_needed',
    label: 'Proof, reviews or visible results needed',
    pattern: /review|rating|testimonial|avis|proof|preuve|case|before after|avant apres|قبل وبعد|تقييم|اراء|آراء|دليل|نتيجة مرئية/
  },
  {
    type: SIGNAL_TYPES.OBJECTION,
    key: 'guarantee_or_return_risk',
    label: 'Guarantee, refund or return risk',
    pattern: /guarantee|warranty|return|refund|garantie|retour|ضمان|استرجاع|ارجاع|إرجاع|استرداد/
  },
  {
    type: SIGNAL_TYPES.BUYING_CRITERION,
    key: 'price_budget_clarity',
    label: 'Price and budget clarity',
    pattern: /price|pricing|prix|tarif|cost|budget|discount|sale|سعر|ثمن|تكلفة|ميزانية|خصم/
  },
  {
    type: SIGNAL_TYPES.BUYING_CRITERION,
    key: 'delivery_or_availability',
    label: 'Delivery, stock or availability clarity',
    pattern: /delivery|shipping|livraison|stock|available|availability|disponible|توصيل|شحن|تسليم|توفر|متاح|مخزون/
  },
  {
    type: SIGNAL_TYPES.CUSTOMER_PAIN,
    key: 'trust_or_scam_risk',
    label: 'Trust risk and fear of being misled',
    pattern: /trust|trusted|reliable|scam|fake|risk|doubt|peur|doute|موثوق|ثقة|نصب|مزيف|مخاطرة|خوف|شك/
  },
  {
    type: SIGNAL_TYPES.CUSTOMER_PAIN,
    key: 'safety_or_side_effect_fear',
    label: 'Safety, irritation or side-effect fear',
    pattern: /safe|safety|irritat|damage|hurt|side effect|sensitive|danger|امن|آمن|حساس|حساسة|تهيج|ضرر|خطر|اثار جانبية/
  },
  {
    type: SIGNAL_TYPES.CUSTOMER_DESIRE,
    key: 'visible_result_fast',
    label: 'Fast visible result',
    pattern: /result|benefit|outcome|fast|quick|clean|visible|easy|نتيجة|فائدة|سريع|نظيف|واضح|مرئي|سهل/
  },
  {
    type: SIGNAL_TYPES.BUYING_CRITERION,
    key: 'comparison_or_alternatives',
    label: 'Comparison against alternatives',
    pattern: /compare|comparison|alternative|vs|best|meilleur|comparatif|بديل|مقارنة|افضل|أفضل/
  },
  {
    type: SIGNAL_TYPES.BUYING_CRITERION,
    key: 'payment_or_cod',
    label: 'Payment and COD clarity',
    pattern: /cod|cash on delivery|payment|paiement|pay|الدفع|دفع|عند الاستلام|الدفع عند الاستلام/
  },
  {
    type: SIGNAL_TYPES.CUSTOMER_DESIRE,
    key: 'method_or_support',
    label: 'Method, support or guided execution',
    pattern: /course|formation|learn|module|lesson|method|support|mentor|template|تعلم|تكوين|دورة|منهج|دعم|قالب|مرافقة/
  }
]);

function isCustomerVoiceRow(row = {}, context = {}) {
  const platform = normalize(row.sourcePlatform);
  const scope = normalize(row.scope);
  const claim = normalize(row.claimType);
  const text = normalize(`${row.title || ''} ${row.value || ''}`);
  if (isLooseSearchEvidence(row) && !matchesQueryContext(row, context)) return false;

  const platformIsCustomerVoice = isCustomerVoicePlatform(row);
  const explicitVoiceClaim = hasExplicitCustomerVoiceClaim(row);
  const sourceHasVoiceText = platformIsCustomerVoice &&
    /review|avis|comment|testimonial|rating|feedback|experience|question|objection|complaint|تقييم|اراء|آراء|مراجعة|تعليق|تجربة|سؤال|شكوى|اعتراض/.test(text);

  if (isGenericMarketPlatform(row) && !platformIsCustomerVoice) return false;

  return (scope === 'customer' && explicitVoiceClaim) ||
    (['youtube', 'reddit', 'facebook', 'instagram', 'x', 'twitter', 'tiktok', 'trustpilot', 'review', 'reviews'].includes(platform) && (explicitVoiceClaim || sourceHasVoiceText)) ||
    (platformIsCustomerVoice && (explicitVoiceClaim || sourceHasVoiceText));
}

function matchedCustomerVoicePatterns(row = {}) {
  const text = normalize(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`);
  return CUSTOMER_VOICE_PATTERNS.filter(pattern => pattern.pattern.test(text));
}

function buildCustomerVoicePattern(type, key, label, rows, now) {
  const platforms = [...new Set(rows.map(row => row.sourcePlatform).filter(Boolean))];
  const windows = temporalCounts(rows, now);
  return {
    id: `cv_${type.toLowerCase()}_${key}_${hash(rows.map(row => row.id).join('|'))}`,
    type,
    key,
    label,
    count: rows.length,
    evidenceIds: rows.map(row => row.id).filter(Boolean).slice(0, 12),
    sourceUrls: [...new Set(rows.map(row => row.sourceUrl).filter(Boolean))].slice(0, 8),
    sourcePlatforms: platforms.slice(0, 6),
    representativeEvidence: rows.slice(0, 3).map(row => ({
      evidenceId: row.id,
      title: row.title,
      sourcePlatform: row.sourcePlatform,
      sourceUrl: row.sourceUrl
    })),
    confidence: confidenceFor(rows, SIGNAL_STATUS.OBSERVED),
    temporal: windows,
    limitations: [
      'Customer voice is quantified from collected evidence only; it is not a demographic survey.',
      ...(platforms.length < 2 ? ['Low platform diversity until another independent source repeats this pattern.'] : []),
      ...(windows.dated ? [] : ['No reliable published date was available for this customer voice pattern.'])
    ]
  };
}

function buildCustomerVoiceModel(evidence = [], now = new Date(), context = {}) {
  const customerRows = evidence.filter(row => isCustomerVoiceRow(row, context));
  const grouped = {};
  customerRows.forEach(row => {
    matchedCustomerVoicePatterns(row).forEach(pattern => {
      const groupKey = `${pattern.type}::${pattern.key}`;
      grouped[groupKey] = grouped[groupKey] || { ...pattern, rows: [] };
      grouped[groupKey].rows.push(row);
    });
  });
  const patterns = Object.values(grouped)
    .map(group => buildCustomerVoicePattern(group.type, group.key, group.label, group.rows, now))
    .sort((a, b) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (rank[b.confidence] - rank[a.confidence]) || (b.count - a.count);
    });
  const byType = patterns.reduce((acc, pattern) => {
    acc[pattern.type] = acc[pattern.type] || [];
    acc[pattern.type].push(pattern);
    return acc;
  }, {});
  return {
    version: 'customer-voice-v1',
    evidenceCount: customerRows.length,
    patternCount: patterns.length,
    patterns,
    byType,
    quality: {
      quantifiedFromEvidence: true,
      unsupportedPatterns: patterns.filter(pattern => !pattern.evidenceIds.length).length,
      sourceDiversity: new Set(customerRows.map(row => row.sourcePlatform || row.sourceUrl || row.id).filter(Boolean)).size,
      limitations: [
        'Customer voice patterns are observed in the collected sample and must not be presented as full-market statistics.',
        ...(patterns.length ? [] : ['No repeated customer voice pattern was extracted from the collected evidence.'])
      ]
    }
  };
}

const OFFER_INTELLIGENCE_PATTERNS = Object.freeze([
  {
    key: 'pricing_visible',
    label: 'Visible price or pricing terms',
    aspect: 'pricing',
    pattern: /price|pricing|prix|tarif|cost|discount|sale|promo|سعر|ثمن|تكلفة|خصم|عرض/
  },
  {
    key: 'payment_or_cod',
    label: 'Payment terms or cash on delivery',
    aspect: 'payment',
    pattern: /cod|cash on delivery|payment|paiement|pay|الدفع|دفع|عند الاستلام|الدفع عند الاستلام/
  },
  {
    key: 'delivery_or_stock',
    label: 'Delivery, stock or availability terms',
    aspect: 'fulfillment',
    pattern: /delivery|shipping|livraison|stock|available|availability|disponible|توصيل|شحن|تسليم|توفر|متاح|مخزون/
  },
  {
    key: 'guarantee_or_returns',
    label: 'Guarantee, refund or return policy',
    aspect: 'risk_reversal',
    pattern: /guarantee|warranty|return|refund|garantie|retour|ضمان|استرجاع|ارجاع|إرجاع|استرداد/
  },
  {
    key: 'proof_assets',
    label: 'Reviews, testimonials or result proof',
    aspect: 'proof',
    pattern: /review|rating|testimonial|avis|proof|preuve|case|before after|avant apres|قبل وبعد|تقييم|اراء|آراء|دليل|نتيجة مرئية/
  },
  {
    key: 'bundle_or_bonus',
    label: 'Bundle, bonus or promotional mechanism',
    aspect: 'offer_mechanism',
    pattern: /bundle|pack|kit|bonus|free gift|gift|upsell|cross sell|باقة|حزمة|هدية|مجاني|عرض خاص/
  },
  {
    key: 'product_specs',
    label: 'Concrete product specs and features',
    aspect: 'feature_set',
    pattern: /feature|spec|led|usb|battery|batterie|level|niveau|mode|material|size|خاصية|ميزة|مواصفة|اضاءة|ضوء|شحن|بطارية|مستوى|شفط/
  },
  {
    key: 'cta_or_checkout',
    label: 'Clear CTA, checkout or order path',
    aspect: 'conversion_path',
    pattern: /cta|checkout|order|buy now|add to cart|landing|whatsapp|call|commander|acheter|طلب|اطلب|اشتري|سلة|واتساب/
  }
]);

function isOfferEvidenceRow(row = {}) {
  const scope = normalize(row.scope);
  const claim = normalize(row.claimType);
  const platform = normalize(row.sourcePlatform);
  return ['offer', 'competitor', 'market', 'marketplace'].includes(scope) ||
    /offer|product|shopping|price|pricing|web_page_content|exa_search_result|jina_search_results|serp|snippet/.test(claim) ||
    ['shopping', 'serp', 'exa_search', 'jina_search', 'inspected_page', 'web'].includes(platform);
}

function matchedOfferPatterns(row = {}) {
  const text = normalize(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`);
  return OFFER_INTELLIGENCE_PATTERNS.filter(pattern => pattern.pattern.test(text));
}

function buildOfferIntelligencePattern(key, label, aspect, rows, now) {
  const platforms = [...new Set(rows.map(row => row.sourcePlatform).filter(Boolean))];
  const windows = temporalCounts(rows, now);
  return {
    id: `offer_${aspect}_${key}_${hash(rows.map(row => row.id).join('|'))}`,
    key,
    label,
    aspect,
    count: rows.length,
    evidenceIds: rows.map(row => row.id).filter(Boolean).slice(0, 12),
    sourceUrls: [...new Set(rows.map(row => row.sourceUrl).filter(Boolean))].slice(0, 8),
    sourcePlatforms: platforms.slice(0, 6),
    confidence: confidenceFor(rows, SIGNAL_STATUS.OBSERVED),
    temporal: windows,
    representativeEvidence: rows.slice(0, 3).map(row => ({
      evidenceId: row.id,
      title: row.title,
      sourcePlatform: row.sourcePlatform,
      sourceUrl: row.sourceUrl
    })),
    limitations: [
      'Offer pattern is observed from collected evidence; exact commercial terms require page-level verification.',
      ...(platforms.length < 2 ? ['Low source diversity until another independent seller or source repeats this offer pattern.'] : []),
      ...(windows.dated ? [] : ['No reliable published date was available for this offer pattern.'])
    ]
  };
}

function buildOfferIntelligenceModel(evidence = [], now = new Date()) {
  const offerRows = evidence.filter(isOfferEvidenceRow);
  const grouped = {};
  offerRows.forEach(row => {
    matchedOfferPatterns(row).forEach(pattern => {
      grouped[pattern.key] = grouped[pattern.key] || { ...pattern, rows: [] };
      grouped[pattern.key].rows.push(row);
    });
  });
  const patterns = Object.values(grouped)
    .map(group => buildOfferIntelligencePattern(group.key, group.label, group.aspect, group.rows, now))
    .sort((a, b) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (rank[b.confidence] - rank[a.confidence]) || (b.count - a.count);
    });
  const byAspect = patterns.reduce((acc, pattern) => {
    acc[pattern.aspect] = acc[pattern.aspect] || [];
    acc[pattern.aspect].push(pattern);
    return acc;
  }, {});
  return {
    version: 'offer-intelligence-v1',
    evidenceCount: offerRows.length,
    patternCount: patterns.length,
    patterns,
    byAspect,
    quality: {
      quantifiedFromEvidence: true,
      unsupportedPatterns: patterns.filter(pattern => !pattern.evidenceIds.length).length,
      sourceDiversity: new Set(offerRows.map(row => row.sourcePlatform || row.sourceUrl || row.id).filter(Boolean)).size,
      noInventedCommercialTerms: true,
      limitations: [
        'Offer intelligence describes observed offer patterns, not complete market coverage.',
        'Exact price, stock, delivery speed, guarantee or payment claims stay unverified unless the evidence explicitly contains them.',
        ...(patterns.length ? [] : ['No repeated offer pattern was extracted from the collected evidence.'])
      ]
    }
  };
}

const SOCIAL_CONTENT_PATTERNS = Object.freeze([
  {
    key: 'review_or_opinion',
    label: 'Reviews, opinions or customer reactions',
    format: 'review',
    pattern: /review|rating|testimonial|avis|opinion|reaction|comment|feedback|تقييم|رأي|اراء|آراء|تعليق|تجربة/
  },
  {
    key: 'tutorial_or_how_to',
    label: 'Tutorials, how-to content or usage guidance',
    format: 'tutorial',
    pattern: /tutorial|how to|guide|tips|demo|usage|use case|طريقة|كيفية|شرح|دليل|نصائح|تجربة/
  },
  {
    key: 'comparison_or_alternative',
    label: 'Comparisons, alternatives or versus content',
    format: 'comparison',
    pattern: /compare|comparison|alternative|versus|\bvs\b|best|top|meilleur|comparatif|بديل|مقارنة|افضل|أفضل/
  },
  {
    key: 'faq_or_question',
    label: 'Questions, FAQ and decision doubts',
    format: 'faq',
    pattern: /faq|question|ask|why|what|which|هل|ما هو|لماذا|كيف|سؤال|أسئلة|استفسار/
  },
  {
    key: 'problem_solution',
    label: 'Problem/solution education',
    format: 'education',
    pattern: /problem|solution|pain|fix|resolve|mistake|avoid|مشكلة|حل|خطأ|تجنب|يعالج|ألم/
  },
  {
    key: 'proof_demo_before_after',
    label: 'Proof, demo or before/after content',
    format: 'proof',
    pattern: /proof|preuve|case|result|before after|avant apres|demo|دليل|نتيجة|قبل وبعد|برهان|إثبات/
  },
  {
    key: 'offer_or_promo_post',
    label: 'Offer, promo or selling post',
    format: 'offer_post',
    pattern: /offer|promo|discount|deal|buy|order|sale|عرض|خصم|اشتري|اطلب|تخفيض|صفقة/
  },
  {
    key: 'fresh_news_or_recent_signal',
    label: 'Recent news, article or fresh market content',
    format: 'fresh_content',
    pattern: /news|recent|new|trend|2026|2025|rss|article|جديد|حديث|خبر|اتجاه|ترند|مقال/
  }
]);

function isSocialContentRow(row = {}) {
  const scope = normalize(row.scope);
  const platform = normalize(row.sourcePlatform);
  const claim = normalize(row.claimType);
  return ['social', 'content', 'customer'].includes(scope) ||
    ['youtube', 'reddit', 'facebook', 'instagram', 'x', 'tiktok', 'rss'].includes(platform) ||
    /youtube|reddit|facebook|instagram|tiktok|social|review|comment|rss|article|video|post|content|exa_search|jina_search/.test(`${platform} ${claim}`);
}

function matchedSocialContentPatterns(row = {}) {
  const text = normalize(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`);
  return SOCIAL_CONTENT_PATTERNS.filter(pattern => pattern.pattern.test(text));
}

function buildSocialContentPattern(key, label, format, rows, now) {
  const platforms = [...new Set(rows.map(row => row.sourcePlatform).filter(Boolean))];
  const windows = temporalCounts(rows, now);
  return {
    id: `social_${format}_${key}_${hash(rows.map(row => row.id).join('|'))}`,
    key,
    label,
    format,
    count: rows.length,
    evidenceIds: rows.map(row => row.id).filter(Boolean).slice(0, 12),
    sourceUrls: [...new Set(rows.map(row => row.sourceUrl).filter(Boolean))].slice(0, 8),
    sourcePlatforms: platforms.slice(0, 6),
    representativeEvidence: rows.slice(0, 4).map(row => ({
      evidenceId: row.id,
      title: row.title,
      sourcePlatform: row.sourcePlatform,
      sourceUrl: row.sourceUrl,
      publishedAt: row.publishedAt
    })),
    confidence: confidenceFor(rows, SIGNAL_STATUS.OBSERVED),
    temporal: windows,
    limitations: [
      'Social and content patterns are observed in the collected sample only; engagement, reach, virality and ad performance are not inferred.',
      ...(platforms.length < 2 ? ['Low platform diversity until another independent source repeats this content pattern.'] : []),
      ...(windows.dated ? [] : ['No reliable published date was available for this content pattern.'])
    ]
  };
}

function buildSocialContentModel(evidence = [], now = new Date()) {
  const socialRows = evidence.filter(isSocialContentRow);
  const grouped = {};
  socialRows.forEach(row => {
    matchedSocialContentPatterns(row).forEach(pattern => {
      grouped[pattern.key] = grouped[pattern.key] || { ...pattern, rows: [] };
      grouped[pattern.key].rows.push(row);
    });
  });
  const patterns = Object.values(grouped)
    .map(group => buildSocialContentPattern(group.key, group.label, group.format, group.rows, now))
    .sort((a, b) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (rank[b.confidence] - rank[a.confidence]) || (b.count - a.count);
    });
  const byFormat = patterns.reduce((acc, pattern) => {
    acc[pattern.format] = acc[pattern.format] || [];
    acc[pattern.format].push(pattern);
    return acc;
  }, {});
  return {
    version: 'social-content-intelligence-v1',
    evidenceCount: socialRows.length,
    patternCount: patterns.length,
    patterns,
    byFormat,
    quality: {
      quantifiedFromEvidence: true,
      unsupportedPatterns: patterns.filter(pattern => !pattern.evidenceIds.length).length,
      sourceDiversity: new Set(socialRows.map(row => row.sourcePlatform || row.sourceUrl || row.id).filter(Boolean)).size,
      noInventedEngagementClaims: true,
      limitations: [
        'Social content intelligence describes collected content patterns, not audience size, engagement rate or campaign performance.',
        ...(patterns.length ? [] : ['No repeated social or content pattern was extracted from the collected evidence.'])
      ]
    }
  };
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
    classifyRow(row, input).forEach(type => {
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
  const customerVoice = buildCustomerVoiceModel(evidence, now, input);
  const offerIntelligence = buildOfferIntelligenceModel(evidence, now);
  const socialContent = buildSocialContentModel(evidence, now);
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
    customerVoice,
    offerIntelligence,
    socialContent,
    temporal,
    quality: {
      observedSignals: signals.filter(signal => signal.status === SIGNAL_STATUS.OBSERVED).length,
      inferredSignals: signals.filter(signal => signal.status === SIGNAL_STATUS.INFERRED).length,
      unsupportedObservedSignals: signals.filter(signal => signal.status === SIGNAL_STATUS.OBSERVED && !signal.evidenceIds.length).length,
      hasTemporalEvidence: temporal.dated > 0,
      noMarketGrowthClaim: true,
      customerVoiceQuantifiedFromEvidence: customerVoice.quality.quantifiedFromEvidence,
      offerIntelligenceQuantifiedFromEvidence: offerIntelligence.quality.quantifiedFromEvidence,
      noInventedCommercialTerms: offerIntelligence.quality.noInventedCommercialTerms,
      socialContentQuantifiedFromEvidence: socialContent.quality.quantifiedFromEvidence,
      noInventedEngagementClaims: socialContent.quality.noInventedEngagementClaims,
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
  classifyRow,
  buildCustomerVoiceModel,
  buildOfferIntelligenceModel,
  buildSocialContentModel
};
