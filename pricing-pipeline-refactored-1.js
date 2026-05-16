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
function resolveExtractionStatus(primary, conflicts, allCandidates) {
  if (!primary || allCandidates.length === 0) {
    return EXTRACTION_STATUS.NOT_FOUND;
  }

  const hasBlockingConflict = conflicts.some(c => !c.resolved && c.divergencePct > 30);
  if (hasBlockingConflict) {
    return EXTRACTION_STATUS.CONFLICT;
  }

  const normalizedScore = (primary.score || 0) / 180; // max theoretical score ≈ 180
  if (normalizedScore >= CONFIDENCE_THRESHOLDS.HIGH) {
    return EXTRACTION_STATUS.CONFIRMED;
  }

  return EXTRACTION_STATUS.WEAK;
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
  const text   = String(bodyText || '').replace(/\u00A0/g, ' ').substring(0, 40000);

  const rules = [
    {
      regex: /(?:à partir de|from|starting at|dès)\s*([0-9][0-9\s.,]*)\s*(MAD|DH|DHS|EUR|USD|GBP|€|\$|£)/gi,
      kind: 'from', confidence: 0.83,
    },
    {
      regex: /(?:au lieu de|instead of|was|avant|prix normal|regular price)\s*([0-9][0-9\s.,]*)\s*(MAD|DH|DHS|EUR|USD|GBP|€|\$|£)/gi,
      kind: 'old', confidence: 0.80,
    },
    {
      regex: /([0-9][0-9\s.,]*)\s*(MAD|DH|DHS|EUR|USD|GBP|€|\$|£)/gi,
      kind: 'current', confidence: 0.66,
    },
    {
      regex: /(MAD|DH|DHS|EUR|USD|GBP|€|\$|£)\s*([0-9][0-9\s.,]*)/gi,
      kind: 'current', confidence: 0.66,
    },
  ];

  for (const { regex, kind, confidence } of rules) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw   = match[0];
      if (raw.length > 80) continue;
      const value    = normalizePriceValue(match[1]) || normalizePriceValue(match[2]);
      const currency = detectCurrency(raw, html);
      if (!value) continue;

      pushValidatedPrice(prices, { value, currency, raw, source: 'text', kind, context: raw.toLowerCase(), confidence });
    }
  }

  // Range pattern: "100 MAD - 500 MAD"
  const rangeRegex = /([0-9][0-9\s.,]*)\s*(MAD|DH|DHS|EUR|USD|GBP|€|\$|£)\s*(?:-|à|to)\s*([0-9][0-9\s.,]*)\s*(MAD|DH|DHS|EUR|USD|GBP|€|\$|£)?/gi;
  let rm;
  while ((rm = rangeRegex.exec(text)) !== null) {
    const raw      = rm[0];
    const currency = detectCurrency(raw, html);
    const min      = normalizePriceValue(rm[1]);
    const max      = normalizePriceValue(rm[3]);
    if (min) pushValidatedPrice(prices, { value: min, currency, raw, source: 'text', kind: 'range-min', context: raw, confidence: 0.82 });
    if (max) pushValidatedPrice(prices, { value: max, currency, raw, source: 'text', kind: 'range-max', context: raw, confidence: 0.82 });
  }

  return prices;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 12 — DOM PRICE EXTRACTOR
// ─────────────────────────────────────────────────────────────────

function extractDomPrices($, html = '') {
  const prices  = [];
  if (!$ || typeof $.root !== 'function') return prices;

  const selectors = [
    '[class*="price"]', '[id*="price"]', '[class*="pricing"]', '[id*="pricing"]',
    '[class*="plan"]', '[class*="tarif"]', '[class*="offer"]',
    '[data-price]', '[itemprop="price"]',
    '.woocommerce-Price-amount', '.price', '.product-price',
    '.sale-price', '.regular-price', '.compare-at-price',
  ];

  const seen = new Set();

  $(selectors.join(',')).each((_, el) => {
    const node = $(el);
    const text = node.text().replace(/\s+/g, ' ').trim();
    const attrs = [node.attr('data-price'), node.attr('content'), node.attr('aria-label')]
      .filter(Boolean).join(' ');
    const rawBlock = `${text} ${attrs}`.replace(/\s+/g, ' ').trim();

    if (!rawBlock || rawBlock.length > 300) return;

    const key = `${node.get(0)?.tagName || 'x'}|${rawBlock}`;
    if (seen.has(key)) return;
    seen.add(key);

    const lowered = rawBlock.toLowerCase();
    if (isNoisePriceContext(lowered)) return;

    let kind = 'current';
    if (/old|regular|compare|barr|avant|instead of|au lieu/.test(lowered)) kind = 'old';
    else if (/from|à partir|starting at|dès/.test(lowered))                kind = 'from';
    else if (/mois|month|monthly|year|annuel|annual|abonnement|subscription/.test(lowered)) kind = 'plan';

    // Compute visibility score
    let visibilityScore = 0;
    if (/\b(price|pricing|plan|tarif|offre)\b/i.test(rawBlock))                             visibilityScore += 2;
    if (node.closest('[class*="pricing"],[id*="pricing"],[class*="plan"],[class*="offer"]').length) visibilityScore += 3;
    if (node.closest('button,a,[class*="cta"],[class*="buy"],[class*="cart"]').length)      visibilityScore += 2;
    if (/acheter|buy|order|commander|shop|subscribe|signup|trial|demo/.test(lowered))       visibilityScore += 2;

    const matches = rawBlock.match(
      /([0-9][0-9\s.,]*)\s*(MAD|DH|DHS|EUR|USD|GBP|€|\$|£)|(?:MAD|DH|DHS|EUR|USD|GBP|€|\$|£)\s*([0-9][0-9\s.,]*)/gi
    ) || [];

    matches.forEach(match => {
      const value    = normalizePriceValue(match);
      const currency = detectCurrency(match, html);
      pushValidatedPrice(prices, {
        value, currency, raw: match, source: 'dom', kind,
        context:         rawBlock.substring(0, 200),
        selector:        node.attr('class') || node.attr('id') || node.get(0)?.tagName || null,
        visibilityScore,
        confidence:      0.74 + Math.min(0.16, visibilityScore * 0.03),
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
  // ── 1. Deduplication ──────────────────────────────────────────
  const normalized = [];
  const seen       = new Set();

  for (const p of allPrices) {
    if (!p || !p.value || p.value <= 0) continue;
    const key = [p.value, p.currency || '', p.kind || '', p.source || '', (p.raw || '').slice(0, 80)].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      value:          p.value,
      currency:       p.currency || null,
      raw:            p.raw || null,
      source:         p.source || 'unknown',
      kind:           p.kind || 'current',
      context:        p.context || '',
      selector:       p.selector || null,
      visibilityScore: Number(p.visibilityScore ?? 0),
      confidence:     Number(p.confidence ?? 0.5),
    });
  }

  // ── 2. Score each candidate ───────────────────────────────────
  const candidates = normalized.map(p => ({ ...p, score: scorePriceCandidate(p) }));

  // ── 3. Detect conflicts ───────────────────────────────────────
  const conflicts = detectPriceConflicts(candidates);

  // ── 4. Select primary (highest-scoring current candidate) ─────
  const currentCandidates = candidates.filter(p =>
    ['current', 'from', 'plan', 'range-min'].includes(p.kind)
  );
  const oldCandidates     = candidates.filter(p => p.kind === 'old');
  const rangeMaxCandidates = candidates.filter(p => p.kind === 'range-max');

  const primary = [...currentCandidates].sort((a, b) => {
    if (b.score !== a.score)       return b.score - a.score;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.value - b.value;
  })[0] || null;

  // ── 5. Determine extraction status ───────────────────────────
  const extractionStatus = resolveExtractionStatus(primary, conflicts, candidates);

  // ── 6. Blocking? ──────────────────────────────────────────────
  const isBlocked      = extractionStatus !== EXTRACTION_STATUS.CONFIRMED;
  const blockingReasons = [];
  if (extractionStatus === EXTRACTION_STATUS.NOT_FOUND) blockingReasons.push('no_price_detected');
  if (extractionStatus === EXTRACTION_STATUS.CONFLICT)  blockingReasons.push('price_conflict_detected');
  if (extractionStatus === EXTRACTION_STATUS.WEAK)      blockingReasons.push('weak_price_signal');

  // ── 7. Confidence score ───────────────────────────────────────
  const rawScore      = primary ? primary.score : 0;
  const maxScore      = 180;                                    // theoretical max
  const confidenceScore = Math.min(1, Math.max(0, rawScore / maxScore));
  const { band: confidenceBand } = confidenceScoreToMeta(confidenceScore);

  // ── 8. Price ranges and sets ──────────────────────────────────
  const primaryCurrency =
    primary?.currency ||
    normalized.find(p => p.currency)?.currency ||
    detectCurrency('', html) ||
    null;                                               // ← no MAD default: null = unknown

  const currentValues   = currentCandidates.map(p => p.value).sort((a, b) => a - b);
  const minPrice        = currentValues[0] ?? null;
  const currentMax      = currentValues[currentValues.length - 1] ?? null;
  const rangeMax        = rangeMaxCandidates.map(p => p.value).sort((a, b) => b - a)[0] ?? null;
  const maxPrice        = rangeMax || currentMax || null;
  const hasRange        = minPrice !== null && maxPrice !== null && minPrice !== maxPrice;
  const priceRange      = hasRange ? { min: minPrice, max: maxPrice } : null;

  const struckPrices    = [...new Set(oldCandidates.map(p => p.value))].sort((a, b) => a - b);
  const bestOld         = struckPrices[struckPrices.length - 1] ?? null;
  const discountRate    = (primary?.value && bestOld && bestOld > primary.value)
    ? Math.round(((bestOld - primary.value) / bestOld) * 100)
    : null;

  // ── 9. Classify pricing model ─────────────────────────────────
  const { model: pricingModel, confidence: classificationConfidence } =
    classifyPricingModel(candidates, struckPrices, html);

  // ── 10. Build audit trail ─────────────────────────────────────
  const selectionReason = primary
    ? `Selected from ${primary.source} (score=${primary.score}, kind=${primary.kind})`
    : 'No valid candidate found';

  const auditTrail = buildAuditTrail(candidates, primary, conflicts, selectionReason);

  // ── 11. Source evidence chain (for UI bloc 1) ─────────────────
  const sourceEvidence = candidates.slice(0, 10).map(c => ({
    source:     c.source,
    value:      c.value,
    currency:   c.currency,
    kind:       c.kind,
    confidence: c.confidence,
    selector:   c.selector || null,
    textSnippet: (c.raw || '').substring(0, 60),
  }));

  // ── 12. Assemble canonical PriceIntelObserved ─────────────────
  return {
    // Observed values
    primaryPrice:    primary?.value ?? null,
    currency:        primaryCurrency,
    allPrices:       [...new Set(normalized.map(p => p.value))].sort((a, b) => a - b),
    struckPrices,
    schemaPrices:    normalized.filter(p => p.source === 'schema').map(p => p.value),
    domPrices:       normalized.filter(p => p.source === 'dom').map(p => p.value),
    textPrices:      normalized.filter(p => p.source === 'text').map(p => p.value),
    planPrices:      normalized.filter(p => p.kind === 'plan').map(p => p.value),
    priceRange,
    discountRate,

    // Classification
    pricingModel,
    classificationConfidence,

    // Status & confidence
    extractionStatus,
    confidenceScore,
    confidenceBand,

    // Evidence
    sourceEvidence,
    primarySource: primary?.source || null,
    primaryKind:   primary?.kind   || null,
    primaryScore:  primary?.score  || null,
    prices:        normalized.sort((a, b) => a.value - b.value),

    // Audit trail
    auditTrail,

    // Blocking
    isBlocked,
    blockingReasons,

    // Summary
    priceSourcesSummary: {
      schema:   normalized.filter(p => p.source === 'schema').length,
      dom:      normalized.filter(p => p.source === 'dom').length,
      text:     normalized.filter(p => p.source === 'text').length,
      checkout: normalized.filter(p => p.source === 'checkout').length,
    },

    // Legacy aliases (backward compat — READ ONLY)
    detected:   !!primary,
    bestPrice:  primary?.value ?? null,
    minPrice,
    maxPrice,
    confidence: confidenceBand,
    all:        [...new Set(normalized.map(p => p.value))].sort((a, b) => a - b),
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
  if (!priceIntel) return null;
  // Only surface price if not blocked by architecture
  if (priceIntel.isBlocked) return null;
  const value = priceIntel.primaryPrice ?? priceIntel.bestPrice ?? null;
  return typeof value === 'number' && value > 0 ? value : null;
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
  EMPTYFINANCIALINTEL,
  EMPTYPRICINGRECOMMENDATION,

  // Constants
  CONFIDENCETHRESHOLDS,
  EXTRACTIONSTATUS,
  SOURCEPRIORITY,
  PRICINGMODELS,
  CONFIDENCEBAND,
};
