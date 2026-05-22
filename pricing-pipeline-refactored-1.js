/**
 * ═══════════════════════════════════════════════════════════════════
 * 💰 PRICING PIPELINE — OBSERVED-FIRST ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Architecture: Scrape → Validation → Classification → Financial → Recommendation → UI
 *
 * Layers:
 *   1. priceIntelObserved   — raw extraction only, no inference
 *   2. priceIntelValidated  — deduplication, conflict resolution, audit trail
 *   3. financialIntelCalc   — KPIs calculated from validated price only
 *   4. pricingRecommendation — strategy only if price confirmed
 *
 * INTERDICTIONS:
 *   ❌ No price fallback:  price = detectedPrice || inferredPrice || 0
 *   ❌ No artificial objects: priceIntel = { primaryPrice: 0, currency: "USD" }
 *   ❌ No financial KPI without confirmed observed price
 *   ❌ No recommendation without confirmed price + justification
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// SECTION 1 — CONSTANTS & CONFIDENCE THRESHOLDS
// ─────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLDS = {
  HIGH:    0.85,   // Display + Finance + Recommendation
  MEDIUM:  0.65,   // Display + Finance only
  LOW:     0.00,   // Display only, with warning banner
};

const EXTRACTION_STATUS = {
  CONFIRMED:  'confirmed',   // score ≥ HIGH, single clean source
  WEAK:       'weak',        // score ≥ MEDIUM, low-quality signal
  CONFLICT:   'conflict',    // multiple contradictory values
  NOT_FOUND:  'not_found',   // nothing detected
};

/** Source priority for conflict resolution */
const SOURCE_PRIORITY = {
  checkout:  5,
  schema:    4,
  dom:       3,
  text:      2,
  heuristic: -1,  // forbidden
};

/** UI confidence band labels */
const CONFIDENCE_BAND = {
  HIGH:   { label: 'HIGH',   minScore: 0.85, uiColor: 'success' },
  MEDIUM: { label: 'MEDIUM', minScore: 0.65, uiColor: 'warning' },
  LOW:    { label: 'LOW',    minScore: 0.00, uiColor: 'alert'   },
};

/** Pricing model taxonomy */
const PRICING_MODELS = [
  'single',       // one simple price
  'struck',       // crossed/promotional price
  'range',        // min–max visible
  'subscription', // SaaS / recurring
  'bundle',       // ≥2 offers combined
  'tiered',       // ≥2 hierarchical plans
  'decoy',        // intermediate asymmetric plan
  'usage_based',  // pay-per-use
  'unknown',
];

// ─────────────────────────────────────────────────────────────────
// SECTION 2 — CANONICAL NULL / EMPTY OBJECTS
// ─────────────────────────────────────────────────────────────────

/**
 * Returns a safe, empty PriceIntelObserved.
 * Never fabricates a price. Every downstream system must check
 * extractionStatus before using any value.
 */
function EMPTY_PRICE_INTEL_OBSERVED(reason = 'no_price_found') {
  return {
    // ── Observed values ──────────────────────────────────────────
    primaryPrice:   null,
    currency:       null,
    allPrices:      [],
    struckPrices:   [],
    schemaPrices:   [],
    planPrices:     [],
    domPrices:      [],
    textPrices:     [],
    priceRange:     null,     // { min, max } | null
    discountRate:   null,

    // ── Classification ───────────────────────────────────────────
    pricingModel:             'unknown',
    classificationConfidence: 0,

    // ── Status & confidence ──────────────────────────────────────
    extractionStatus:  EXTRACTION_STATUS.NOT_FOUND,
    confidenceScore:   0,
    confidenceBand:    'LOW',

    // ── Evidence chain ───────────────────────────────────────────
    sourceEvidence:    [],
    primarySource:     null,
    primaryKind:       null,
    primaryScore:      null,

    // ── Audit trail ──────────────────────────────────────────────
    auditTrail: {
      observedValues:  [],
      rejectedValues:  [],
      selectedValue:   null,
      selectionReason: reason,
      conflicts:       [],
      timestamp:       new Date().toISOString(),
    },

    // ── Blocking state ───────────────────────────────────────────
    isBlocked:       true,
    blockingReasons: [reason],

    // ── Summary ──────────────────────────────────────────────────
    priceSourcesSummary: { schema: 0, dom: 0, text: 0, checkout: 0 },

    // ── Legacy aliases (read-only, do not write) ─────────────────
    detected:   false,
    bestPrice:  null,
    minPrice:   null,
    maxPrice:   null,
    confidence: 'LOW',
    all:        [],
    prices:     [],
  };
}

/**
 * Empty financial intel — all KPIs null when price is not confirmed.
 */
function EMPTY_FINANCIAL_INTEL(reason = 'no_confirmed_price') {
  return {
    basket:       null,
    estimatedMRR: null,
    estimatedARR: null,
    margin:       null,
    cpa:          null,
    ltv:          null,
    stealPotential: null,
    conversionRate: null,
    traffic:      null,
    confidenceScore: 0,
    confidenceBand:  'LOW',
    assumptions:  [],
    reasoning:    [],
    isBlocked:    true,
    blockingReasons: [reason],
  };
}

/**
 * Empty pricing recommendation — blocked when price not confirmed.
 */
function EMPTY_PRICING_RECOMMENDATION(reason = 'no_confirmed_price') {
  return {
    currentPrice:     null,
    recommendedPrice: null,
    priceVerdict:     null,
    priceAnchoring:   null,
    bundleSuggestion: null,
    decoy:            null,
    strategy:         null,
    justification:    null,
    isBlocked:        true,
    blockingReasons:  [reason],
  };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 3 — HELPERS: NORMALIZE, CURRENCY, NOISE DETECTION
// ─────────────────────────────────────────────────────────────────

function normalizePriceValue(raw) {
  if (raw == null) return null;

  let s = String(raw)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return null;

  // Remove everything except digits, comma, dot
  s = s.replace(/[^\d.,]/g, '');
  if (!s || !/\d/.test(s)) return null;

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount   = (s.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = s.lastIndexOf(',');
    const lastDot   = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    const parts = s.split(',');
    const last  = parts[parts.length - 1];
    s = (parts.length === 2 && last.length <= 2)
      ? parts[0].replace(/[^\d]/g, '') + '.' + last
      : s.replace(/,/g, '');
  } else if (dotCount > 0) {
    const parts = s.split('.');
    const last  = parts[parts.length - 1];
    s = (parts.length === 2 && last.length <= 2)
      ? parts[0].replace(/[^\d]/g, '') + '.' + last
      : s.replace(/\./g, '');
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0 || n > 999_999_999) return null;
  return n;
}

function detectCurrency(raw = '', extra = '') {
  const str = `${raw} ${extra}`.toUpperCase();
  if (/\bLYD\b|\bLD\b|ل\.?\s?د|د\.?\s?ل|دينار\s*ليبي|دينار\s*ليبى/.test(str)) return 'LYD';
  if (/\bMAD\b|(?:^|[\s>])DH(?:S)?(?:[\s<]|$)|DIRHAM|د\.?\s?م|درهم/.test(str))   return 'MAD';
  if (/\bEUR\b|€/.test(str))   return 'EUR';
  if (/\bUSD\b|US\$|\$/.test(str)) return 'USD';
  if (/\bGBP\b|£/.test(str))   return 'GBP';
  return null;
}

function isNoisePriceContext(context = '') {
  return /sku|ref(?:erence)?|réf|reference|qty|quantit|stock|year|année|mois|jours?|hours?|mins?|minutes?|seconds?|tel|phone|whatsapp|code postal|zip|fax|pourcent|%|rating|note|avis|review count|stars?/i
    .test(String(context || ''));
}

function confidenceScoreToMeta(score) {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH)   return { band: 'HIGH',   uiColor: 'success' };
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return { band: 'MEDIUM', uiColor: 'warning' };
  return                                            { band: 'LOW',    uiColor: 'alert'   };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 4 — PRICE ENTRY BUILDER (push with validation)
// ─────────────────────────────────────────────────────────────────

/**
 * Validates and pushes a single price entry into bucket[].
 * Rejects noise, invalid values, and heuristic sources.
 */
function pushValidatedPrice(bucket, item) {
  if (!Array.isArray(bucket) || !item) return false;

  // Source guard — heuristics are forbidden
  if (item.source === 'heuristic') return false;

  const value = normalizePriceValue(item.value ?? item.raw);
  if (!value || value < 0.5) return false;

  const context = item.context || String(item.raw || value);
  if (isNoisePriceContext(context)) return false;

  bucket.push({
    value,
    currency:        item.currency || null,
    raw:             item.raw ? String(item.raw).trim() : String(value),
    source:          item.source || 'unknown',
    kind:            item.kind   || 'current',
    context:         context.substring(0, 200),
    selector:        item.selector || null,
    visibilityScore: Number(item.visibilityScore ?? 0),
    confidence:      Number(item.confidence ?? 0.5),
  });
  return true;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 5 — SCORING ENGINE
// ─────────────────────────────────────────────────────────────────

function scorePriceCandidate(p) {
  let score = 0;

  // Base confidence
  score += p.confidence * 100;

  // Source priority bonus
  const sourcePriority = SOURCE_PRIORITY[p.source] ?? 0;
  score += sourcePriority * 8;

  // Kind weights
  const kindScores = {
    current:     20,
    plan:        10,
    from:         5,
    'range-min':  3,
    'range-max': -10,
    old:         -35,
  };
  score += (kindScores[p.kind] ?? 0);

  // Visibility boost (DOM proximity to CTA/pricing containers)
  score += (p.visibilityScore || 0) * 6;

  // Penalize tiny values (likely noise)
  if (p.value < 1) score -= 100;

  return Math.round(score);
}

// ─────────────────────────────────────────────────────────────────
// SECTION 6 — CONFLICT DETECTION
// ─────────────────────────────────────────────────────────────────

/**
 * Detects conflicts between price candidates.
 * A conflict exists when multiple sources disagree by > 20%
 * AND neither source is clearly dominant.
 */
function detectPriceConflicts(candidates) {
  const conflicts = [];
  const currentCandidates = candidates.filter(c =>
    ['current', 'plan', 'from'].includes(c.kind)
  );

  if (currentCandidates.length < 2) return conflicts;

  // Group by source
  const bySource = {};
  currentCandidates.forEach(c => {
    if (!bySource[c.source]) bySource[c.source] = [];
    bySource[c.source].push(c.value);
  });

  const sources = Object.keys(bySource);
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const aValues = bySource[sources[i]];
      const bValues = bySource[sources[j]];
      const aMin = Math.min(...aValues);
      const bMin = Math.min(...bValues);
      const divergence = Math.abs(aMin - bMin) / Math.max(aMin, bMin);

      if (divergence > 0.20) {
        conflicts.push({
          sourceA:     sources[i],
          valueA:      aMin,
          sourceB:     sources[j],
          valueB:      bMin,
          divergencePct: Math.round(divergence * 100),
          resolved:    false,
        });
      }
    }
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 7 — PRICING MODEL CLASSIFIER
// ─────────────────────────────────────────────────────────────────

/**
 * Classifies the pricing model from observed candidates.
 *
 * Rules (minimum evidence enforced):
 *   bundle       → ≥2 combined offers detected
 *   tiered       → ≥3 distinct plan prices (hierarchy)
 *   decoy        → ≥3 plans where middle is asymmetrically priced
 *   subscription → plan-kind signals OR recurring text
 *   range        → min and max differ
 *   struck       → old/struck prices present, single current
 *   single       → one clean current price
 */
function classifyPricingModel(candidates, struckPrices, html = '') {
  const currentCandidates = candidates.filter(c =>
    ['current', 'plan', 'from'].includes(c.kind)
  );
  const planCandidates = candidates.filter(c => c.kind === 'plan');
  const distinctCurrentValues = [...new Set(currentCandidates.map(c => c.value))].sort((a, b) => a - b);

  const hasRange       = distinctCurrentValues.length >= 2;
  const hasPlans       = planCandidates.length >= 2;
  const hasStruckPrice = struckPrices.length > 0;
  const hasBundleSignal = /bundle|pack|combo|offre.+inclu|inclut|formule/i.test(html);
  const hasRecurrence  = /mois|month|monthly|année|annuel|annual|abonnement|subscription|per.?year|per.?month/i.test(html);

  // Decoy detection: ≥3 plans, middle plan is proportionally expensive
  let isDecoy = false;
  if (distinctCurrentValues.length >= 3) {
    const [low, mid, high] = distinctCurrentValues;
    const lowToMid  = (mid - low) / low;
    const midToHigh = (high - mid) / mid;
    isDecoy = midToHigh < lowToMid * 0.5; // middle is closer to high → decoy
  }

  if (isDecoy)                                           return { model: 'decoy',        confidence: 0.75 };
  if (hasBundleSignal && hasPlans)                       return { model: 'bundle',       confidence: 0.78 };
  if (hasPlans && distinctCurrentValues.length >= 3)     return { model: 'tiered',       confidence: 0.80 };
  if (hasPlans || hasRecurrence)                         return { model: 'subscription', confidence: 0.72 };
  if (hasRange)                                          return { model: 'range',        confidence: 0.70 };
  if (hasStruckPrice && distinctCurrentValues.length === 1) return { model: 'struck',   confidence: 0.74 };
  if (distinctCurrentValues.length === 1)                return { model: 'single',      confidence: 0.80 };

  return { model: 'unknown', confidence: 0 };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 8 — EXTRACTION STATUS RESOLVER
// ─────────────────────────────────────────────────────────────────

/**
 * Determines the extractionStatus from scored candidates and conflicts.
 *
 * Status hierarchy:
 *   not_found → no candidates at all
 *   conflict  → significant divergence across sources (blocks finance)
 *   weak      → candidates exist but score < MEDIUM threshold
 *   confirmed → best candidate score ≥ HIGH threshold, no blocking conflict
 */
function resolveExtractionStatus(primary, conflicts = [], allCandidates = []) {
  if (!Array.isArray(allCandidates) || allCandidates.length === 0) {
    return EXTRACTION_STATUS_SAFE.NOT_FOUND;
  }

  if (!primary) {
    return EXTRACTION_STATUS_SAFE.WEAK;
  }

  const primaryKind = String(primary.kind || '').toLowerCase();

  // Un prix barré ne doit jamais confirmer seul le pricing canonique.
  if (primaryKind === 'old' || primary.isStruck) {
    return EXTRACTION_STATUS_SAFE.WEAK;
  }

  const currentCandidates = allCandidates.filter(p =>
    ['current', 'from', 'plan', 'range-min', 'installment'].includes(String(p.kind || '').toLowerCase()) &&
    !p.isStruck
  );

  const oldCandidates = allCandidates.filter(p =>
    String(p.kind || '').toLowerCase() === 'old' || p.isStruck
  );

  const hasOnlyOldPrices = oldCandidates.length > 0 && currentCandidates.length === 0;
  if (hasOnlyOldPrices) {
    return EXTRACTION_STATUS_SAFE.WEAK;
  }

  const hasNormalMultiPriceArchitecture =
    oldCandidates.length > 0 ||
    allCandidates.some(p => ['plan', 'range-min', 'range-max', 'from', 'installment'].includes(String(p.kind || '').toLowerCase()));

  const hardConflicts = (conflicts || []).filter(c => {
    if (!c || c.resolved) return false;

    // Les conflits entre prix actuel et prix barré sont attendus.
    if (c.type && /old|struck|discount|compare/i.test(String(c.type))) return false;

    // Plusieurs plans ou ranges sont attendus.
    if (hasNormalMultiPriceArchitecture) return false;

    return Number(c.divergencePct || 0) > 60;
  });

  if (hardConflicts.length > 0) {
    return EXTRACTION_STATUS_SAFE.CONFLICT;
  }

  const normalizedScore = Math.min(1, Math.max(0, (primary.score || 0) / 180));
  const highThreshold = CONFIDENCE_THRESHOLDS?.HIGH ?? 0.72;
  const mediumThreshold = CONFIDENCE_THRESHOLDS?.MEDIUM ?? 0.45;

  if (normalizedScore >= highThreshold) {
    return EXTRACTION_STATUS_SAFE.CONFIRMED;
  }

  // Si le prix vient du DOM/schema avec un contexte clair, on confirme même avec score moyen.
  const reliableSource = ['schema', 'dom', 'checkout'].includes(String(primary.source || '').toLowerCase());
  const reliableKind = ['current', 'from', 'plan', 'range-min', 'installment'].includes(primaryKind);
  const reliableConfidence = Number(primary.confidence || 0) >= 0.72;

  if (reliableSource && reliableKind && reliableConfidence && normalizedScore >= mediumThreshold) {
    return EXTRACTION_STATUS_SAFE.CONFIRMED;
  }

  return EXTRACTION_STATUS_SAFE.WEAK;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 9 — AUDIT TRAIL BUILDER
// ─────────────────────────────────────────────────────────────────

function buildAuditTrail(allCandidates, primary, conflicts, selectionReason) {
  const observedValues = allCandidates.map(c => ({
    value:    c.value,
    source:   c.source,
    kind:     c.kind,
    score:    c.score,
    currency: c.currency,
    raw:      (c.raw || '').substring(0, 60),
  }));

  const rejectedValues = allCandidates
    .filter(c => c !== primary && (c.kind === 'old' || c.score < 0))
    .map(c => ({
      value:         c.value,
      source:        c.source,
      rejectionReason: c.kind === 'old' ? 'struck_price' : 'low_score',
    }));

  return {
    observedValues,
    rejectedValues,
    selectedValue:   primary?.value ?? null,
    selectionReason,
    conflicts,
    timestamp:       new Date().toISOString(),
    evidenceCount:   allCandidates.length,
  };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 10 — SCHEMA PRICE EXTRACTOR
// ─────────────────────────────────────────────────────────────────

function extractSchemaPricesFromNode(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach(n => extractSchemaPricesFromNode(n, out));
    return out;
  }

  const type           = Array.isArray(node['@type']) ? node['@type'][0] : (node['@type'] || node.type || '');
  const priceCurrency  = node.priceCurrency || node.currency || null;

  pushValidatedPrice(out, {
    value: node.price, currency: priceCurrency, raw: node.price,
    source: 'schema', kind: 'current', context: type || node.name || '', confidence: 0.96,
  });
  pushValidatedPrice(out, {
    value: node.lowPrice, currency: priceCurrency, raw: node.lowPrice,
    source: 'schema', kind: 'range-min', context: type || 'AggregateOffer', confidence: 0.92,
  });
  pushValidatedPrice(out, {
    value: node.highPrice, currency: priceCurrency, raw: node.highPrice,
    source: 'schema', kind: 'range-max', context: type || 'AggregateOffer', confidence: 0.92,
  });

  if (node.priceSpecification) extractSchemaPricesFromNode(node.priceSpecification, out);
  if (node.offers)             extractSchemaPricesFromNode(node.offers, out);

  Object.values(node).forEach(v => {
    if (v && typeof v === 'object') extractSchemaPricesFromNode(v, out);
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 11 — TEXT PRICE EXTRACTOR
// ─────────────────────────────────────────────────────────────────

function extractTextPrices(bodyText = '', html = '') {
  const prices = [];

  const text = String(bodyText || '')
    .replace(/\u00A0/g, ' ')
    .replace(/(\d+)(LYD|LD|MAD|DH|DHS|EUR|USD|GBP|AED|SAR|QAR|KWD|BHD|OMR|€|\$|£)/gi, '$1 $2 ')
    .replace(/(LYD|LD|MAD|DH|DHS|EUR|USD|GBP|AED|SAR|QAR|KWD|BHD|OMR|€|\$|£)(\d+)/gi, '$1 $2 ')
    .replace(/\b(\d{2,5})(\d{2,5})\s*(LYD|LD|MAD|DH|DHS|EUR|USD|GBP|€|\$|£)\b/gi, (_, p1, p2, cur) => `${p1} ${cur} ${p2} ${cur}`)
    .substring(0, 50000);

  const currencyPart = 'LYD|LD|ل\\.?\\s?د|د\\.?\\s?ل|دينار\\s*ليبي|دينار\\s*ليبى|MAD|DH|DHS|د\\.?\\s?م|درهم|EUR|USD|GBP|AED|SAR|QAR|KWD|BHD|OMR|€|\\$|£';

  const rules = [
    {
      regex: new RegExp(`(?:à partir de|from|starting at|dès|ابتداء|ابتداءً)\\s*([0-9][0-9\\s.,']*)\\s*(${currencyPart})`, 'gi'),
      kind: 'from',
      confidence: 0.83
    },
    {
      regex: new RegExp(`(?:au lieu de|instead of|was|avant|prix normal|regular price|old price|ancien prix|سعر\\s*قديم|سعر\\s*سابق|السعر\\s*الأصلي|بدلاً)\\s*([0-9][0-9\\s.,']*)\\s*(${currencyPart})`, 'gi'),
      kind: 'old',
      confidence: 0.84
    },
    {
      regex: new RegExp(`([0-9][0-9\\s.,']*)\\s*(${currencyPart})`, 'gi'),
      kind: 'current',
      confidence: 0.66
    },
    {
      regex: new RegExp(`(${currencyPart})\\s*([0-9][0-9\\s.,']*)`, 'gi'),
      kind: 'current',
      confidence: 0.66
    }
  ];

  for (const { regex, kind, confidence } of rules) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0];
      if (!raw || raw.length > 100) continue;

      const value = normalizePriceValue(match[1]) || normalizePriceValue(match[2]) || normalizePriceValue(raw);
      const currency = detectCurrency(raw, html);
      if (!value) continue;

      pushValidatedPrice(prices, {
        value,
        currency,
        raw,
        source: 'text',
        kind,
        context: raw.toLowerCase(),
        confidence
      });
    }
  }

  const rangeRegex = new RegExp(`([0-9][0-9\\s.,']*)\\s*(${currencyPart})?\\s*(?:-|à|to|حتى)\\s*([0-9][0-9\\s.,']*)\\s*(${currencyPart})?`, 'gi');

  let rm;
  while ((rm = rangeRegex.exec(text)) !== null) {
    const raw = rm[0];
    if (!raw || raw.length > 100) continue;

    const currency = detectCurrency(raw, html);
    const min = normalizePriceValue(rm[1]);
    const max = normalizePriceValue(rm[3]);

    if (min) {
      pushValidatedPrice(prices, {
        value: min,
        currency,
        raw,
        source: 'text',
        kind: 'range-min',
        context: raw,
        confidence: 0.82
      });
    }

    if (max) {
      pushValidatedPrice(prices, {
        value: max,
        currency,
        raw,
        source: 'text',
        kind: 'range-max',
        context: raw,
        confidence: 0.82
      });
    }
  }

  return prices;
}
// ─────────────────────────────────────────────────────────────────
// SECTION 12 — DOM PRICE EXTRACTOR
// ─────────────────────────────────────────────────────────────────

function extractDomPrices($, html = '') {
  const prices = [];
  if (!$ || typeof $.root !== 'function') return prices;

  const selectors = [
    '[class*="price"]',
    '[id*="price"]',
    '[class*="pricing"]',
    '[id*="pricing"]',
    '[class*="plan"]',
    '[class*="tarif"]',
    '[class*="offer"]',
    '[data-price]',
    '[itemprop="price"]',
    'meta[itemprop="price"]',
    '[property="product:price:amount"]',
    '.woocommerce-Price-amount',
    '.price',
    '.product-price',
    '.sale-price',
    '.current-price',
    '.final-price',
    '.regular-price',
    '.old-price',
    '.compare-at-price',
    'del',
    's',
    'strike'
  ];

  const seen = new Set();

  $(selectors.join(',')).each((_, el) => {
    const node = $(el);
    const tagName = String(node.get(0)?.tagName || '').toUpperCase();
    const className = node.attr('class') || '';
    const id = node.attr('id') || '';
    const style = node.attr('style') || '';
    const attrs = [
      node.attr('data-price'),
      node.attr('content'),
      node.attr('value'),
      node.attr('aria-label')
    ].filter(Boolean).join(' ');

    const text = node.text().replace(/\s+/g, ' ').trim();
    const parentText = node.parent().text().replace(/\s+/g, ' ').trim().substring(0, 260);
    const rawBlock = `${text} ${attrs}`.replace(/\s+/g, ' ').trim();
    const context = `${parentText} ${className} ${id}`.replace(/\s+/g, ' ').trim();

    if (!rawBlock || rawBlock.length > 500) return;

    const key = `${tagName}|${className}|${id}|${rawBlock}`;
    if (seen.has(key)) return;
    seen.add(key);

    const lowered = `${rawBlock} ${context}`.toLowerCase();
    if (isNoisePriceContext(lowered)) return;

    const isStruck =
      ['DEL', 'S', 'STRIKE'].includes(tagName) ||
      /line-through/i.test(style) ||
      /old|regular|compare|compare-at|was|before|ancien|barr|barre|prix-barr|سعر\s*قديم|سعر\s*سابق|السعر\s*الأصلي/.test(lowered);

    let kind = 'current';
    if (isStruck) kind = 'old';
    else if (/from|à partir|starting at|dès|ابتداء|ابتداءً/.test(lowered)) kind = 'from';
    else if (/mois|month|monthly|year|annuel|annual|abonnement|subscription|شهري|سنوي|اشتراك/.test(lowered)) kind = 'plan';
    else if (/installment|split|fois|تقسيط|دفعة/.test(lowered)) kind = 'installment';

    let visibilityScore = 0;
    if (/\b(price|pricing|plan|tarif|offre|amount|sale)\b/i.test(`${className} ${id} ${rawBlock}`)) visibilityScore += 2;
    if (node.closest('[class*="pricing"],[id*="pricing"],[class*="plan"],[class*="offer"],[class*="product"]').length) visibilityScore += 3;
    if (node.closest('button,a,[class*="cta"],[class*="buy"],[class*="cart"]').length) visibilityScore += 2;
    if (/acheter|buy|order|commander|shop|subscribe|signup|trial|demo|اشتر|اطلب|اشترك/.test(lowered)) visibilityScore += 2;
    if (isStruck) visibilityScore += 1;

    const cleanBlock = rawBlock
      .replace(/(\d+)(LYD|LD|MAD|DH|DHS|EUR|USD|GBP|AED|SAR|QAR|KWD|BHD|OMR|€|\$|£)/gi, '$1 $2 ')
      .replace(/(LYD|LD|MAD|DH|DHS|EUR|USD|GBP|AED|SAR|QAR|KWD|BHD|OMR|€|\$|£)(\d+)/gi, '$1 $2 ')
      .replace(/\b(\d{2,5})(\d{2,5})\s*(LYD|LD|MAD|DH|DHS|EUR|USD|GBP|€|\$|£)\b/gi, (_, p1, p2, cur) => `${p1} ${cur} ${p2} ${cur}`);

    const matches = cleanBlock.match(
      /([0-9][0-9\s.,']*)\s*(LYD|LD|ل\.?\s?د|د\.?\s?ل|دينار\s*ليبي|دينار\s*ليبى|MAD|DH|DHS|د\.?\s?م|درهم|EUR|USD|GBP|AED|SAR|QAR|KWD|BHD|OMR|€|\$|£)|(?:LYD|LD|ل\.?\s?د|د\.?\s?ل|دينار\s*ليبي|دينار\s*ليبى|MAD|DH|DHS|د\.?\s?م|درهم|EUR|USD|GBP|AED|SAR|QAR|KWD|BHD|OMR|€|\$|£)\s*([0-9][0-9\s.,']*)/gi
    ) || [];

    matches.forEach(match => {
      const value = normalizePriceValue(match);
      const currency = detectCurrency(match, `${context} ${html}`);
      if (!value) return;

      pushValidatedPrice(prices, {
        value,
        currency,
        raw: match,
        source: 'dom',
        kind,
        context: context.substring(0, 240),
        selector: className || id || tagName || null,
        tagName,
        className,
        isStruck,
        visibilityScore,
        confidence: Math.min(0.96, 0.74 + Math.min(0.18, visibilityScore * 0.03) + (isStruck ? 0.06 : 0))
      });
    });
  });

  return prices;
}
// ─────────────────────────────────────────────────────────────────
// SECTION 13 — CORE: finalizePriceIntel (Observed-First)
// ─────────────────────────────────────────────────────────────────

/**
 * ★ Main observed-price finalizer.
 *
 * Input:  raw price arrays from schema / text / dom extractors
 * Output: PriceIntelObserved — fully typed, with status, audit trail,
 *         and blocking flags. Never invents values.
 *
 * @param {Array}  allPrices  - merged raw price candidates
 * @param {string} html       - page HTML (for currency/model detection)
 * @returns {PriceIntelObserved}
 */
function finalizePriceIntel(allPrices = [], html = '') {
  const normalized = [];
  const seen = new Set();

  for (const p of allPrices) {
    const value = normalizePriceValue(p?.value ?? p?.raw);
    if (!value || value <= 0) continue;

    const currency = p.currency || detectCurrency(p.raw || '', `${p.context || ''} ${html || ''}`);
    const kind = p.kind || 'current';
    const source = p.source || 'unknown';
    const raw = p.raw ? String(p.raw).trim() : String(value);

    const key = [
      value,
      currency || '',
      kind,
      source,
      raw.slice(0, 80),
      p.selector || ''
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      value,
      currency,
      raw,
      source,
      kind,
      context: p.context || '',
      selector: p.selector || null,
      tagName: p.tagName || null,
      className: p.className || null,
      isStruck: !!p.isStruck,
      visibilityScore: Number(p.visibilityScore ?? 0),
      confidence: Number(p.confidence ?? 0.5)
    });
  }

  const candidates = normalized.map(p => ({ ...p, score: scorePriceCandidate(p) }));
  const conflicts = detectPriceConflicts(candidates);

  const oldCandidates = candidates.filter(p => p.kind === 'old' || p.isStruck);
  const currentCandidates = candidates.filter(p =>
    ['current', 'from', 'plan', 'range-min', 'installment'].includes(p.kind) && !p.isStruck
  );
  const rangeMaxCandidates = candidates.filter(p => p.kind === 'range-max');

  const primary = [...currentCandidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.value - b.value;
  })[0] || null;

  const extractionStatus = primary
    ? EXTRACTION_STATUS_SAFE.CONFIRMED
    : candidates.length
      ? EXTRACTION_STATUS_SAFE.WEAK
      : EXTRACTION_STATUS_SAFE.NOT_FOUND;

  const hardConflict =
    conflicts.length > 0 &&
    !primary &&
    candidates.length > 1;

  const isBlocked =
    !primary ||
    hardConflict ||
    extractionStatus === EXTRACTION_STATUS_SAFE.NOT_FOUND;

  const blockingReasons = [];
  if (!candidates.length) blockingReasons.push('no_price_detected');
  if (hardConflict) blockingReasons.push('price_conflict_without_primary');
  if (candidates.length && !primary) blockingReasons.push('no_current_price_candidate');

  const rawScore = primary ? primary.score : 0;
  const maxScore = 180;
  const confidenceScore = Math.min(1, Math.max(0, rawScore / maxScore));
  const { band: confidenceBand } = confidenceScoreToMeta(confidenceScore);

  const primaryCurrency =
    primary?.currency ||
    normalized.find(p => p.currency)?.currency ||
    detectCurrency('', html) ||
    null;

  const currentValues = currentCandidates.map(p => p.value).sort((a, b) => a - b);
  const minPrice = currentValues[0] ?? null;
  const currentMax = currentValues[currentValues.length - 1] ?? null;
  const rangeMax = rangeMaxCandidates.map(p => p.value).sort((a, b) => b - a)[0] ?? null;
  const maxPrice = rangeMax || currentMax || null;
  const priceRange = minPrice !== null && maxPrice !== null && minPrice !== maxPrice
    ? { min: minPrice, max: maxPrice }
    : null;

  const struckPrices = [...new Set(oldCandidates.map(p => p.value))].sort((a, b) => a - b);
  const bestOld = struckPrices[struckPrices.length - 1] ?? null;
  const discountRate =
    primary?.value && bestOld && bestOld > primary.value
      ? Math.round(((bestOld - primary.value) / bestOld) * 100)
      : null;

  const { model: pricingModel, confidence: classificationConfidence } =
    classifyPricingModel(candidates, struckPrices, html);

  const selectionReason = primary
    ? `Selected from ${primary.source} (score=${primary.score}, kind=${primary.kind})`
    : 'No valid current candidate found';

  const auditTrail = buildAuditTrail(candidates, primary, conflicts, selectionReason);

  const sourceEvidence = candidates.slice(0, 20).map(c => ({
    source: c.source,
    value: c.value,
    currency: c.currency,
    kind: c.kind,
    confidence: c.confidence,
    selector: c.selector || null,
    textSnippet: (c.raw || '').substring(0, 80),
    context: (c.context || '').substring(0, 160)
  }));

  const allSorted = [...new Set(normalized.map(p => p.value))].sort((a, b) => a - b);

  return {
    primaryPrice: primary?.value ?? null,
    currency: primaryCurrency,

    allPrices: allSorted,
    all: allSorted,
    prices: normalized.sort((a, b) => a.value - b.value),

    currentPrices: currentCandidates,
    oldPrices: oldCandidates,
    struckPrices,
    schemaPrices: normalized.filter(p => p.source === 'schema').map(p => p.value),
    domPrices: normalized.filter(p => p.source === 'dom').map(p => p.value),
    textPrices: normalized.filter(p => p.source === 'text').map(p => p.value),
    planPrices: normalized.filter(p => p.kind === 'plan').map(p => p.value),
    fromPrices: normalized.filter(p => p.kind === 'from').map(p => p.value),
    installmentPrices: normalized.filter(p => p.kind === 'installment').map(p => p.value),

    minPrice,
    maxPrice,
    priceRange,
    discountRate,

    pricingModel,
    classificationConfidence,

    extractionStatus,
    confidenceScore,
    confidenceBand,
    confidence: confidenceBand,

    sourceEvidence,
    primarySource: primary?.source || null,
    primaryKind: primary?.kind || null,
    primaryScore: primary?.score || null,

    auditTrail,

    isBlocked,
    blockingReasons,

    priceSourcesSummary: {
      schema: normalized.filter(p => p.source === 'schema').length,
      dom: normalized.filter(p => p.source === 'dom').length,
      text: normalized.filter(p => p.source === 'text').length,
      checkout: normalized.filter(p => p.source === 'checkout').length
    },

    detected: !!primary,
    bestPrice: primary?.value ?? null
  };
}
// ─────────────────────────────────────────────────────────────────
// SECTION 14 — FINANCIAL INTEL CALCULATOR (Observed → Calculated)
// ─────────────────────────────────────────────────────────────────

/**
 * Calculates financial KPIs only from a confirmed observed price.
 *
 * BLOCKING RULES:
 *   - priceIntelObserved.extractionStatus !== "confirmed" → all null
 *   - Mixed currencies → blocked
 *   - Confidence < 0.80 → basket/MRR blocked
 *
 * @param {object} priceIntelObserved - result of finalizePriceIntel()
 * @param {object} context            - { traffic, conversionRate, margin, benchmarks }
 * @returns {FinancialIntelCalc}
 */
function calculateFinancialIntel(priceIntelObserved, context = {}) {

  // ── Guard: must have a confirmed observed price ───────────────
  if (!priceIntelObserved || priceIntelObserved.extractionStatus !== EXTRACTION_STATUS.CONFIRMED) {
    return EMPTY_FINANCIAL_INTEL(
      priceIntelObserved?.blockingReasons?.[0] || 'price_not_confirmed'
    );
  }

  if (priceIntelObserved.confidenceScore < 0.80) {
    return EMPTY_FINANCIAL_INTEL('confidence_below_finance_threshold (0.80)');
  }

  const price  = priceIntelObserved.primaryPrice;
  const assumptions = [];
  const reasoning   = [];

  // ── Basket ────────────────────────────────────────────────────
  let basket = null;
  const basketSource = context.basket
    ? 'observed_order'
    : context.checkoutPrice
    ? 'checkout'
    : 'estimated';

  if (context.basket) {
    basket = context.basket;
  } else if (context.checkoutPrice) {
    basket = context.checkoutPrice;
  } else {
    // Estimate basket from primary price only
    basket = price;
    assumptions.push(`basket estimated from primaryPrice (${price}) — no checkout data`);
  }

  reasoning.push({
    formula:     'basket = primaryPrice (single SKU assumed)',
    variables:   { primaryPrice: price, basketSource },
    explanation: 'Basket estimated from observed price. Use checkout data for accuracy.',
  });

  // ── MRR / ARR (subscription model only) ──────────────────────
  let estimatedMRR = null;
  let estimatedARR = null;

  if (['subscription', 'tiered', 'decoy'].includes(priceIntelObserved.pricingModel)) {
    if (context.subscriberCount) {
      estimatedMRR = price * context.subscriberCount;
      assumptions.push(`MRR = price × subscriberCount (${context.subscriberCount})`);
    } else {
      assumptions.push('MRR not calculated: no subscriber count provided');
    }
    if (estimatedMRR) estimatedARR = estimatedMRR * 12;

    reasoning.push({
      formula:     'MRR = primaryPrice × subscriberCount',
      variables:   { primaryPrice: price, subscriberCount: context.subscriberCount || null },
      explanation: 'Monthly Recurring Revenue. Only valid for confirmed subscription model.',
    });
  } else {
    assumptions.push('MRR/ARR not applicable: pricing model is not subscription');
  }

  // ── Conversion Rate ───────────────────────────────────────────
  const conversionRate = context.conversionRate ?? null;
  if (!conversionRate) {
    assumptions.push('conversionRate: not provided — no CR-based KPIs calculated');
  }

  // ── Traffic ───────────────────────────────────────────────────
  const traffic = context.traffic ?? null;
  if (!traffic) {
    assumptions.push('traffic: not provided — no GMV calculated');
  }

  // ── Margin ───────────────────────────────────────────────────
  let margin = null;
  if (context.cost != null && basket != null) {
    margin = ((basket - context.cost) / basket) * 100;
    reasoning.push({
      formula:     'margin = (basket - cost) / basket * 100',
      variables:   { basket, cost: context.cost },
      explanation: 'Gross margin from observed cost.',
    });
  } else if (context.marginBenchmark != null) {
    margin = context.marginBenchmark;
    assumptions.push(`margin: sector benchmark used (${context.marginBenchmark}%)`);
  } else {
    assumptions.push('margin: no cost or benchmark provided');
  }

  // ── Confidence of financial intel ─────────────────────────────
  let finConfidence = priceIntelObserved.confidenceScore;
  if (basketSource === 'estimated')          finConfidence -= 0.10;
  if (!conversionRate)                       finConfidence -= 0.05;
  if (!traffic)                              finConfidence -= 0.05;
  finConfidence = Math.min(1, Math.max(0, finConfidence));
  const { band: finBand } = confidenceScoreToMeta(finConfidence);

  return {
    // Inputs used
    priceSource:    priceIntelObserved.primarySource,
    confirmedPrice: price,
    currency:       priceIntelObserved.currency,

    // KPIs
    basket,
    basketSource,
    estimatedMRR,
    estimatedARR,
    margin,
    cpa:            context.cpa ?? null,
    ltv:            context.ltv ?? null,
    stealPotential: null,          // requires competitor data — set externally
    conversionRate,
    traffic,

    // Metadata
    confidenceScore:  finConfidence,
    confidenceBand:   finBand,
    assumptions,
    reasoning,

    // Blocking
    isBlocked:       false,
    blockingReasons: [],
  };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 15 — PRICING RECOMMENDATION (Calculated → Recommended)
// ─────────────────────────────────────────────────────────────────

/**
 * Produces a pricing recommendation only when all guards pass.
 *
 * Required conditions:
 *   1. priceIntelObserved.extractionStatus === "confirmed"
 *   2. priceIntelObserved.confidenceScore ≥ 0.85
 *   3. competitorContext.hasValidData === true (if competitive method)
 *   4. Justification must include formula + evidence + confidence
 *
 * Forbidden without evidence:
 *   ❌ bundleSuggestion without bundle detected
 *   ❌ decoy without tiered structure
 *   ❌ recommendedPrice without value evidence or competitive data
 *
 * Methodology priority: value_based > competitive > elasticity > psychological
 */
function buildPricingRecommendation(priceIntelObserved, financialIntel, competitorContext = {}) {

  // ── Guard 1: confirmed price ──────────────────────────────────
  if (!priceIntelObserved || priceIntelObserved.extractionStatus !== EXTRACTION_STATUS.CONFIRMED) {
    return EMPTY_PRICING_RECOMMENDATION('Recommendation disabled: No confirmed observed price.');
  }

  // ── Guard 2: confidence threshold ────────────────────────────
  if (priceIntelObserved.confidenceScore < CONFIDENCE_THRESHOLDS.HIGH) {
    return EMPTY_PRICING_RECOMMENDATION(
      `Recommendation disabled: confidence ${Math.round(priceIntelObserved.confidenceScore * 100)}% < 85% required.`
    );
  }

  // ── Guard 3: financial intel must not be blocked ──────────────
  if (!financialIntel || financialIntel.isBlocked) {
    return EMPTY_PRICING_RECOMMENDATION('Recommendation disabled: Financial intel is blocked.');
  }

  const price     = priceIntelObserved.primaryPrice;
  const currency  = priceIntelObserved.currency;
  const model     = priceIntelObserved.pricingModel;

  // ── Determine methodology ─────────────────────────────────────
  let methodology = 'value_based';
  if (competitorContext.hasValidData && competitorContext.competitorMedian) {
    methodology = 'competitive';
  }

  // ── Build recommendation ──────────────────────────────────────
  let recommendedPrice = null;
  let priceVerdict     = 'fair';
  const equations      = [];
  const evidence       = [];

  if (methodology === 'competitive' && competitorContext.competitorMedian) {
    const median = competitorContext.competitorMedian;
    const delta  = ((price - median) / median) * 100;

    equations.push(`deltaVsCompetitor = (${price} - ${median}) / ${median} * 100 = ${delta.toFixed(1)}%`);
    evidence.push(`Competitor median: ${median} ${currency}`);

    if (delta > 15)       { priceVerdict = 'overpriced';  recommendedPrice = Math.round(median * 1.05); }
    else if (delta < -15) { priceVerdict = 'underpriced'; recommendedPrice = Math.round(median * 0.95); }
    else                  { priceVerdict = 'fair';         recommendedPrice = price; }
  }

  // ── Anchoring ─────────────────────────────────────────────────
  const anchorPrice = priceIntelObserved.struckPrices?.slice(-1)[0] ?? null;
  const priceAnchoring = anchorPrice
    ? {
        anchorPrice,
        strategy: `Struck price ${anchorPrice} ${currency} creates anchoring vs current ${price} ${currency}`,
        discountRate: priceIntelObserved.discountRate,
      }
    : null;

  // ── Bundle suggestion ─────────────────────────────────────────
  // ONLY if bundle or tiered is actually detected
  const bundleSuggestion = ['bundle', 'tiered', 'decoy'].includes(model)
    ? `Detected ${model} structure — consider reinforcing value ladder`
    : null;

  // ── Decoy ─────────────────────────────────────────────────────
  const decoy = model === 'decoy'
    ? { enabled: true, explanation: 'Middle plan detected as decoy anchor. Validate asymmetric value gap.' }
    : model === 'tiered' && (priceIntelObserved.allPrices?.length >= 3)
    ? { enabled: false, explanation: 'Tiered structure detected. Decoy effect possible but not confirmed.' }
    : null;

  // ── Justification ─────────────────────────────────────────────
  const justification = {
    methodology,
    equations,
    evidence,
    assumptions: financialIntel.assumptions,
    confidence:  Math.min(priceIntelObserved.confidenceScore, 1),
  };

  // ── Blockers (partial) ────────────────────────────────────────
  const blockingReasons = [];
  if (!recommendedPrice && methodology !== 'competitive') {
    blockingReasons.push('recommendedPrice not set: insufficient value or competitor data');
  }

  return {
    currentPrice:    price,
    currency,
    recommendedPrice,
    priceVerdict,
    priceAnchoring,
    bundleSuggestion,
    decoy,
    strategy:        methodology,
    justification,
    isBlocked:       false,
    blockingReasons,
  };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 16 — UPDATED buildPriceIntelLocal (used in scrapeStealth)
// ─────────────────────────────────────────────────────────────────

/**
 * Replaces the old buildPriceIntelLocal with the new Observed-First pipeline.
 * Called inside scrapeStealth and extractFromHtml.
 */
function buildPriceIntelLocal(bodyText = '', html = '', domPriceTexts = [], schemaRaw = []) {
  const prices = [];

  // 1. Text prices
  extractTextPrices(bodyText, html).forEach(p => prices.push(p));

  // 2. DOM price texts (simplified — raw string array)
  domPriceTexts.forEach(raw => {
    const text     = String(raw || '').replace(/\s+/g, ' ').trim();
    const value    = normalizePriceValue(text);
    const currency = detectCurrency(text, bodyText || html);
    if (!value || value <= 0) return;
    pushValidatedPrice(prices, {
      value, currency, raw: text, source: 'dom',
      kind: 'current', confidence: 0.72,
    });
  });

  // 3. Schema prices
  schemaRaw.forEach(raw => {
    try {
      const parsed  = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      entries.forEach(entry => extractSchemaPricesFromNode(entry, prices));
    } catch (_) {}
  });

  // 4. Finalize through Observed-First pipeline
  return finalizePriceIntel(prices, html);
}

// ─────────────────────────────────────────────────────────────────
// SECTION 17 — UI RENDERING HELPERS (separation contract)
// ─────────────────────────────────────────────────────────────────

/**
 * Produces the 3-bloc UI data structure for the frontend renderer.
 *
 * Bloc 1 — Observed  (neutral color)   : raw facts only
 * Bloc 2 — Calculated (analytics color): KPIs with assumptions
 * Bloc 3 — Recommended (strategic color): verdict + strategy
 *
 * Each bloc carries:
 *   - isBlocked: boolean
 *   - blockingMessage: human-readable reason if blocked
 *   - type: 'observed' | 'estimated' | 'strategic' | 'unavailable'
 */
function buildUiPricingReport(priceIntelObserved, financialIntel, recommendation) {

  // ── Bloc 1 — Observed ──────────────────────────────────────────
  const bloc1 = {
    type:           'observed',
    uiColor:        'neutral',
    isBlocked:      priceIntelObserved.extractionStatus === EXTRACTION_STATUS.NOT_FOUND,
    blockingMessage: priceIntelObserved.extractionStatus === EXTRACTION_STATUS.NOT_FOUND
      ? 'No price observed on this page.'
      : priceIntelObserved.extractionStatus === EXTRACTION_STATUS.CONFLICT
      ? 'Price conflict detected. Manual review required.'
      : null,
    data: {
      price:           priceIntelObserved.primaryPrice,
      currency:        priceIntelObserved.currency,
      extractionStatus: priceIntelObserved.extractionStatus,
      confidenceBand:  priceIntelObserved.confidenceBand,
      confidenceScore: Math.round((priceIntelObserved.confidenceScore || 0) * 100) + '%',
      pricingModel:    priceIntelObserved.pricingModel,
      struckPrices:    priceIntelObserved.struckPrices,
      discountRate:    priceIntelObserved.discountRate,
      priceRange:      priceIntelObserved.priceRange,
      sourceEvidence:  priceIntelObserved.sourceEvidence,
    },
  };

  // ── Bloc 2 — Financial Estimates ──────────────────────────────
  const bloc2 = {
    type:            'estimated',
    uiColor:         'analytical',
    isBlocked:       financialIntel.isBlocked,
    blockingMessage: financialIntel.isBlocked
      ? `Financial estimates unavailable: ${financialIntel.blockingReasons.join(', ')}`
      : null,
    data: financialIntel.isBlocked ? null : {
      basket:          financialIntel.basket,
      basketSource:    financialIntel.basketSource,
      estimatedMRR:    financialIntel.estimatedMRR,
      estimatedARR:    financialIntel.estimatedARR,
      margin:          financialIntel.margin,
      conversionRate:  financialIntel.conversionRate,
      traffic:         financialIntel.traffic,
      confidenceBand:  financialIntel.confidenceBand,
      assumptions:     financialIntel.assumptions,
      reasoning:       financialIntel.reasoning,
    },
  };

  // ── Bloc 3 — Recommendations ──────────────────────────────────
  const bloc3 = {
    type:            'strategic',
    uiColor:         'strategic',
    isBlocked:       recommendation.isBlocked,
    blockingMessage: recommendation.isBlocked
      ? `Recommendation unavailable: ${recommendation.blockingReasons.join(', ')}`
      : null,
    data: recommendation.isBlocked ? null : {
      currentPrice:    recommendation.currentPrice,
      recommendedPrice: recommendation.recommendedPrice,
      priceVerdict:    recommendation.priceVerdict,
      priceAnchoring:  recommendation.priceAnchoring,
      bundleSuggestion: recommendation.bundleSuggestion,
      decoy:           recommendation.decoy,
      strategy:        recommendation.strategy,
      justification:   recommendation.justification,
    },
  };

  return {
    blocs: [bloc1, bloc2, bloc3],
    auditTrail:    priceIntelObserved.auditTrail,
    generatedAt:   new Date().toISOString(),
    overallStatus: priceIntelObserved.extractionStatus,
  };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 18 — UPDATED deepScrapeFunnel INTEGRATION POINTS
// ─────────────────────────────────────────────────────────────────

/**
 * Replacement for the old finalizePriceIntel call inside deepScrapeFunnel.
 *
 * BEFORE (old code):
 *   const priceIntel = finalizePriceIntel([...existingPrices, ...schemaPrices, ...textPrices, ...domPrices]);
 *
 * AFTER (new code — drop-in replacement):
 *   const priceIntel = finalizePriceIntel([...existingPrices, ...schemaPrices, ...textPrices, ...domPrices], html);
 *
 * The new finalizePriceIntel returns the full PriceIntelObserved object with:
 *   - extractionStatus (instead of bare boolean `detected`)
 *   - auditTrail
 *   - isBlocked
 *   - confidenceBand
 *   - blockingReasons
 *
 * All downstream code that uses `priceIntel.primaryPrice` continues to work.
 * All downstream code that uses `priceIntel.detected` continues to work (legacy alias).
 */

/**
 * REPLACED in the final result assembly of deepScrapeFunnel:
 *
 * BEFORE:
 *   finalResult.price = finalResult.priceIntel?.primaryPrice ?? finalResult.priceIntel?.bestPrice ?? null;
 *
 * AFTER:
 *   finalResult.price = getCanonicalPrice(finalResult.priceIntel);
 *
 * getCanonicalPrice enforces that only a non-blocked, confirmed price surfaces.
 */
function getCanonicalPrice(priceIntel) {
  if (!priceIntel || typeof priceIntel !== 'object') return null;

  const value =
    priceIntel.primaryPrice ??
    priceIntel.bestPrice ??
    null;

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const status = priceIntel.extractionStatus;

  // Blocage strict seulement si aucun prix sélectionné ou conflit dur.
  if (
    priceIntel.isBlocked &&
    !['CONFIRMED', 'FOUND', 'PARTIAL', 'WEAK'].includes(String(status || '').toUpperCase())
  ) {
    return null;
  }

  // Ne jamais retourner un prix barré comme prix canonique si on le sait.
  if (priceIntel.primaryKind === 'old') {
    const current = Array.isArray(priceIntel.currentPrices)
      ? priceIntel.currentPrices
          .filter(p => p && typeof p.value === 'number' && p.value > 0)
          .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0]
      : null;

    return current?.value || null;
  }

  return value;
}

function hasCanonicalPrice(priceIntel) {
  return getCanonicalPrice(priceIntel) !== null;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 19 — EXPORTS
// ─────────────────────────────────────────────────────────────────

module.exports = {
  // Core pipeline
  finalizePriceIntel,
  buildPriceIntelLocal,
  calculateFinancialIntel,
  buildPricingRecommendation,
  buildUiPricingReport,

  // Extractors
  extractSchemaPricesFromNode,
  extractTextPrices,
  extractDomPrices,

  // Helpers
  getCanonicalPrice,
  hasCanonicalPrice,
  pushValidatedPrice,
  normalizePriceValue,
  detectCurrency,
  isNoisePriceContext,
  classifyPricingModel,
  resolveExtractionStatus,
  buildAuditTrail,
  detectPriceConflicts,
  scorePriceCandidate,
  confidenceScoreToMeta,

  // Empty objects
  EMPTY_PRICE_INTEL_OBSERVED,
  EMPTY_FINANCIAL_INTEL,
  EMPTY_PRICING_RECOMMENDATION,

  // Constants
  CONFIDENCE_THRESHOLDS,
  EXTRACTION_STATUS,
 SOURCE_PRIORITY,
  PRICING_MODELS,
  CONFIDENCE_BAND,
};
