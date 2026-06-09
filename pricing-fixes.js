/**
 * ═══════════════════════════════════════════════════════════════════
 * PRICING FIXES — Patch des 4 bugs identifiés
 * À require() en haut de server.js juste après le require de pricing-pipeline-refactored-1
 *
 * USAGE dans server.js :
 *   const pricingFixes = require('./pricing-fixes');
 *   // Les fonctions patchées remplacent les originales manquantes/cassées
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const pipeline = require('./pricing-pipeline-refactored-1');

// ─────────────────────────────────────────────────────────────────
// FIX 1 — Alias EXTRACTIONSTATUS → EXTRACTION_STATUS
// server.js importe EXTRACTIONSTATUS mais le module exporte EXTRACTION_STATUS
// ─────────────────────────────────────────────────────────────────
const EXTRACTIONSTATUS = pipeline.EXTRACTION_STATUS;

// ─────────────────────────────────────────────────────────────────
// FIX 2 — normalizeConfidence (fonction manquante dans server.js)
// Utilisée par buildFunnelProofModel, proofFact, buildStrategicPricingFromCommerce
// ─────────────────────────────────────────────────────────────────
function normalizeConfidence(c) {
  if (c == null) return 'MEDIUM';
  const s = String(c).toUpperCase().trim();
  if (['HIGH', 'CONFIRMED', '1', 'TRUE'].includes(s))  return 'HIGH';
  if (['LOW', 'NOT_FOUND', 'WEAK', '0', 'FALSE'].includes(s)) return 'LOW';
  if (['MEDIUM', 'CONFLICT', 'PARTIAL'].includes(s))   return 'MEDIUM';
  // Cas numérique (score 0.0 → 1.0)
  const n = parseFloat(c);
  if (!isNaN(n)) {
    if (n >= 0.85) return 'HIGH';
    if (n >= 0.65) return 'MEDIUM';
    return 'LOW';
  }
  return 'MEDIUM';
}

// ─────────────────────────────────────────────────────────────────
// FIX 2b — roundPsychologicalPrice (fonction manquante dans server.js)
// Utilisée par buildStrategicPricingFromCommerce
// ─────────────────────────────────────────────────────────────────
function roundPsychologicalPrice(n, currency = 'MAD') {
  if (!n || isNaN(n)) return n;
  const v = Math.round(n);
  // Arrondi psychologique : x99 pour prix > 100, x9 pour prix > 10
  if (v > 1000) return Math.floor(v / 100) * 100 - 1;  // ex: 1234 → 1199
  if (v > 100)  return Math.floor(v / 10)  * 10  - 1;  // ex: 234  → 229
  if (v > 10)   return v % 10 === 0 ? v - 1 : v;       // ex: 50   → 49
  return v;
}

// ─────────────────────────────────────────────────────────────────
// FIX 3 — buildPriceIntelLocalSafe
// Wrapper sécurisé de buildPriceIntelLocal qui passe correctement
// l'objet Cheerio $ à extractDomPrices au lieu de strings brutes
// ─────────────────────────────────────────────────────────────────
function buildPriceIntelLocalSafe(bodyText = '', html = '', domPriceTexts = [], schemaRaw = [], cheerioInstance = null) {
  const prices = [];
  const {
    extractTextPrices,
    extractSchemaPricesFromNode,
    extractDomPrices,
    pushValidatedPrice,
    normalizePriceValue,
    detectCurrency,
    finalizePriceIntel,
  } = pipeline;

  // 1. Text prices
  extractTextPrices(bodyText, html).forEach(p => prices.push(p));

  // 2. DOM prices — utilise Cheerio $ si disponible, sinon strings brutes
  if (cheerioInstance && typeof cheerioInstance.root === 'function') {
    // FIX: passe l'objet $ correctement
    extractDomPrices(cheerioInstance, html).forEach(p => prices.push(p));
  } else {
    // Fallback string-based (ancien comportement)
    domPriceTexts.forEach(raw => {
      const text = String(raw || '').replace(/\s+/g, ' ').trim();
      const value = normalizePriceValue(text);
      const currency = detectCurrency(text);
      if (!value || value <= 0) return;
      pushValidatedPrice(prices, {
        value,
        currency,
        raw: text,
        source: 'dom',
        kind: 'current',
        confidence: 0.72,
        context: text.substring(0, 200)
      });
    });
  }

  // 3. Schema prices
  schemaRaw.forEach(raw => {
    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      entries.forEach(entry => extractSchemaPricesFromNode(entry, prices));
    } catch (_) {}
  });

  // 4. Finalize
  return finalizePriceIntel(prices, html);
}

// ─────────────────────────────────────────────────────────────────
// FIX 4 — Re-export de tous les helpers corrigés
// ─────────────────────────────────────────────────────────────────
module.exports = {
  // Alias corrigé
  EXTRACTIONSTATUS,
  EXTRACTION_STATUS: pipeline.EXTRACTION_STATUS,

  // Fonctions manquantes
  normalizeConfidence,
  roundPsychologicalPrice,

  // DOM fix
  buildPriceIntelLocalSafe,

  // Re-export complet du pipeline pour usage direct
  ...pipeline,
};
