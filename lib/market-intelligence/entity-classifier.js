'use strict';

const ENTITY_TYPES = Object.freeze({
  DIRECT_COMPETITOR: 'DIRECT_COMPETITOR',
  LOCAL_SELLER: 'LOCAL_SELLER',
  REGIONAL_BENCHMARK: 'REGIONAL_BENCHMARK',
  MARKETPLACE: 'MARKETPLACE',
  SUBSTITUTE: 'SUBSTITUTE',
  SUPPLIER: 'SUPPLIER',
  INFORMATION_SOURCE: 'INFORMATION_SOURCE',
  USER_BENCHMARK: 'USER_BENCHMARK'
});

const GEO_STATUS = Object.freeze({
  LOCAL_CONFIRMED: 'LOCAL_CONFIRMED',
  LOCAL_PROBABLE: 'LOCAL_PROBABLE',
  REGIONAL_OR_FOREIGN: 'REGIONAL_OR_FOREIGN',
  UNCONFIRMED: 'UNCONFIRMED',
  USER_PROVIDED: 'USER_PROVIDED'
});

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanText(value, max = 700) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return cleanText(value, 1000)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s.:-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hostOf(value = '') {
  try {
    return new URL(String(value).startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return cleanText(value, 120).replace(/^www\./i, '').toLowerCase();
  }
}

function sourceUrlOf(item = {}) {
  return cleanText(item.url || item.link || item.sourceUrl || item.productLink || item.website || '', 900);
}

function entityIdFor(item = {}) {
  const host = hostOf(sourceUrlOf(item) || item.domain || item.displayed_link || item.title);
  return host || cleanText(item.id || item.title || item.name || 'market-entity', 120).toLowerCase().replace(/[^a-z0-9]+/gi, '_');
}

function isMarketplaceHost(host = '') {
  return /(amazon|jumia|aliexpress|ebay|etsy|walmart|noon|fnac|cdiscount|shein|temu|shopify|youcan|woocommerce|marketplace)/i.test(host);
}

function isAgentReachEvidence(row = {}) {
  return /^ev_agent_reach_/i.test(cleanText(row.id, 80)) ||
    /exa_search|jina_search|youtube|rss/i.test(cleanText(row.sourcePlatform, 80));
}

function rawEntityFromEvidence(row = {}) {
  if (!isAgentReachEvidence(row)) return null;
  const url = sourceUrlOf(row);
  const host = hostOf(url);
  if (!url || /(^|\.)s\.jina\.ai$|(^|\.)r\.jina\.ai$/i.test(host)) return null;
  const blob = normalize([
    row.claimType,
    row.sourcePlatform,
    row.resultPlatform,
    row.query,
    row.title,
    row.value,
    url
  ].join(' '));
  let sourceType = 'contentProof';
  if (/supplier|fournisseur|grossiste|wholesale|manufacturer|factory|fabricant|distributor|alibaba|1688|made in china|globalsources|indiamart/.test(blob)) {
    sourceType = 'supplierSource';
  } else if (/youtube|video|review|tutorial|how to|avis|comparatif|comparison|guide|faq|blog|reddit|forum/.test(blob)) {
    sourceType = 'contentProof';
  } else if (isMarketplaceHost(host)) {
    sourceType = 'marketplaceProduct';
  }
  return {
    title: row.title || host,
    url,
    sourceType,
    sourceGroup: 'agentReachEvidence',
    snippet: row.value,
    observedEvidence: row.value,
    confidence: row.confidence,
    geoTarget: row.country
  };
}

function classifyGeo(item = {}) {
  if (item.userProvided || item.sourceType === 'userBenchmark') return GEO_STATUS.USER_PROVIDED;
  if (item.geoConfirmed || item.geoTier === 'LOCAL_CONFIRMED') return GEO_STATUS.LOCAL_CONFIRMED;
  if (item.geoMatched || item.geoTier === 'LOCAL_PROBABLE') return GEO_STATUS.LOCAL_PROBABLE;
  if (/FOREIGN|REGIONAL/i.test(String(item.geoTier || item.sourceType || item.category || ''))) return GEO_STATUS.REGIONAL_OR_FOREIGN;
  return GEO_STATUS.UNCONFIRMED;
}

function evidenceIdsFor(item = {}, evidenceRegistry = {}) {
  const url = sourceUrlOf(item);
  const host = hostOf(url || item.domain || item.displayed_link || '');
  return asArray(evidenceRegistry.evidence)
    .filter(row => {
      const rowUrl = row.sourceUrl || row.url || '';
      const rowHost = hostOf(rowUrl || row.competitorId || row.entityId || '');
      return (url && rowUrl === url) || (host && rowHost === host) || (host && cleanText(row.competitorId).includes(host));
    })
    .map(row => row.id)
    .filter(Boolean)
    .slice(0, 10);
}

function classifyMarketEntity(item = {}, context = {}) {
  const url = sourceUrlOf(item);
  const host = hostOf(url || item.domain || item.displayed_link || '');
  const sourceType = cleanText(item.sourceType || item.type || item.category || item.sourceGroup || '', 80);
  const blob = normalize([
    sourceType,
    host,
    item.title,
    item.name,
    item.snippet,
    item.description,
    item.observedEvidence,
    item.whyRelevant
  ].join(' '));
  const geoStatus = classifyGeo(item);
  const evidenceIds = evidenceIdsFor(item, context.evidenceRegistry);
  let entityType = ENTITY_TYPES.INFORMATION_SOURCE;
  const reasons = [];

  if (sourceType === 'userBenchmark') {
    entityType = ENTITY_TYPES.USER_BENCHMARK;
    reasons.push('user_provided_url');
  } else if (/supplier|fournisseur|grossiste|wholesale|manufacturer|factory|fabricant|distributor|alibaba|1688/.test(blob)) {
    entityType = ENTITY_TYPES.SUPPLIER;
    reasons.push('supplier_or_sourcing_language');
  } else if (/marketplaceProduct|marketplace|shopping/.test(sourceType) || isMarketplaceHost(host)) {
    entityType = ENTITY_TYPES.MARKETPLACE;
    reasons.push('marketplace_or_shopping_source');
  } else if (/youtubeVideo|contentProof|blog|guide|review|reddit|youtube|forum|comparison|comparatif|how to|tutorial|faq/.test(blob)) {
    entityType = ENTITY_TYPES.SUBSTITUTE;
    reasons.push('solves_same_problem_or_informs_choice');
  } else if (/foreignBenchmark|FOREIGN_BENCHMARK|REGIONAL_BENCHMARK/i.test(sourceType) || geoStatus === GEO_STATUS.REGIONAL_OR_FOREIGN) {
    entityType = ENTITY_TYPES.REGIONAL_BENCHMARK;
    reasons.push('foreign_or_regional_reference');
  } else if (/directCompetitor/.test(sourceType) && geoStatus === GEO_STATUS.LOCAL_CONFIRMED) {
    entityType = ENTITY_TYPES.DIRECT_COMPETITOR;
    reasons.push('confirmed_local_commercial_result');
  } else if (/directCompetitor|sameProductPage|shop|store|boutique|product|produit|acheter|buy|price|prix/.test(blob)) {
    entityType = geoStatus === GEO_STATUS.LOCAL_CONFIRMED ? ENTITY_TYPES.DIRECT_COMPETITOR : ENTITY_TYPES.LOCAL_SELLER;
    reasons.push(geoStatus === GEO_STATUS.LOCAL_CONFIRMED ? 'confirmed_local_seller' : 'probable_or_unconfirmed_seller');
  }

  return {
    id: entityIdFor(item),
    type: entityType,
    title: cleanText(item.title || item.name || host || url, 180),
    domain: host || cleanText(item.domain || item.displayed_link, 120),
    url: url || null,
    sourceType: sourceType || 'unknown',
    sourceGroup: cleanText(item.sourceGroup || sourceType || 'unknown', 80),
    geoStatus,
    geoTarget: cleanText(item.geoTarget || context.geoData?.location || context.country, 120) || null,
    geoConfirmed: geoStatus === GEO_STATUS.LOCAL_CONFIRMED,
    evidenceIds,
    confidence: evidenceIds.length
      ? cleanText(item.confidence || 'MEDIUM', 20).toUpperCase()
      : 'LOW',
    observedEvidence: cleanText(item.observedEvidence || item.snippet || item.description, 260),
    reason: reasons[0] || 'classified_from_source_context',
    limitations: [
      ...(entityType === ENTITY_TYPES.LOCAL_SELLER && geoStatus !== GEO_STATUS.LOCAL_CONFIRMED ? ['Local status is probable or unconfirmed, not a confirmed direct competitor.'] : []),
      ...(entityType === ENTITY_TYPES.SUPPLIER && !evidenceIds.length ? ['Supplier intelligence is UNKNOWN until a dedicated sourcing source confirms supplier details.'] : []),
      ...(entityType === ENTITY_TYPES.SUBSTITUTE ? ['Substitute/information source solves or explains the same customer problem but is not treated as a direct seller by default.'] : [])
    ]
  };
}

function collectEvidenceEntities(input = {}) {
  const evidenceRows = [
    ...asArray(input.evidenceRegistry?.evidence),
    ...asArray(input.agentReachEvidence?.evidenceRegistry?.evidence),
    ...asArray(input.marketEvidence?.evidenceRegistry?.evidence)
  ];
  const seen = new Set();
  return evidenceRows
    .filter(row => {
      const key = `${cleanText(row.id, 120)}|${sourceUrlOf(row)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(rawEntityFromEvidence)
    .filter(Boolean);
}

function collectRawEntities(input = {}) {
  const { competitors = [], marketProductSources = {} } = input;
  const groups = marketProductSources.groups || {};
  const fromGroups = Object.entries(groups).flatMap(([sourceGroup, items]) =>
    asArray(items).map(item => ({ ...item, sourceGroup, sourceType: item.sourceType || sourceGroup }))
  );
  const fromCompetitors = asArray(competitors).map(item => ({
    ...item,
    sourceGroup: 'competitors',
    sourceType: item.sourceType || 'directCompetitor'
  }));
  return [...fromCompetitors, ...fromGroups, ...collectEvidenceEntities(input)];
}

function mergeEntity(existing, incoming) {
  const priority = {
    [ENTITY_TYPES.USER_BENCHMARK]: 90,
    [ENTITY_TYPES.SUPPLIER]: 80,
    [ENTITY_TYPES.MARKETPLACE]: 70,
    [ENTITY_TYPES.DIRECT_COMPETITOR]: 65,
    [ENTITY_TYPES.LOCAL_SELLER]: 60,
    [ENTITY_TYPES.REGIONAL_BENCHMARK]: 50,
    [ENTITY_TYPES.SUBSTITUTE]: 40,
    [ENTITY_TYPES.INFORMATION_SOURCE]: 30
  };
  const chosen = (priority[incoming.type] || 0) > (priority[existing.type] || 0) ? incoming : existing;
  return {
    ...chosen,
    evidenceIds: [...new Set([...asArray(existing.evidenceIds), ...asArray(incoming.evidenceIds)])].slice(0, 12),
    sourceGroups: [...new Set([
      ...asArray(existing.sourceGroups),
      existing.sourceGroup,
      ...asArray(incoming.sourceGroups),
      incoming.sourceGroup
    ].filter(Boolean))],
    limitations: [...new Set([...asArray(existing.limitations), ...asArray(incoming.limitations)])].slice(0, 6)
  };
}

function buildMarketEntityMap(input = {}) {
  const raw = collectRawEntities(input);
  const byId = {};
  raw.forEach(item => {
    const classified = classifyMarketEntity(item, input);
    if (!classified.id || !classified.title) return;
    byId[classified.id] = byId[classified.id]
      ? mergeEntity(byId[classified.id], classified)
      : classified;
  });
  const entities = Object.values(byId);
  const byType = entities.reduce((acc, entity) => {
    acc[entity.type] = acc[entity.type] || [];
    acc[entity.type].push(entity);
    return acc;
  }, {});
  const supplierCandidates = asArray(byType[ENTITY_TYPES.SUPPLIER]);
  const traceableSuppliers = supplierCandidates.filter(item => item.evidenceIds.length > 0);
  const supplierIntelligence = traceableSuppliers.length
    ? {
        status: 'PARTIAL',
        confidence: 'MEDIUM',
        suppliers: supplierCandidates,
        limitations: ['Supplier candidates require dedicated sourcing validation before MOQ, FOB, lead time or OEM claims.']
      }
    : {
        status: 'UNKNOWN',
        confidence: 'LOW',
        suppliers: supplierCandidates,
        limitations: ['No supplier evidence was collected from a dedicated sourcing source.']
      };
  return {
    version: 'market-entity-map-v1',
    generatedAt: new Date().toISOString(),
    entities,
    byType,
    counts: Object.fromEntries(Object.values(ENTITY_TYPES).map(type => [type, asArray(byType[type]).length])),
    supplierIntelligence,
    quality: {
      totalEntities: entities.length,
      traceableEntities: entities.filter(entity => entity.evidenceIds.length > 0).length,
      directCompetitorsRequireConfirmedGeo: true,
      substitutesSeparatedFromCompetitors: true,
      supplierClaimsRemainUnknownWithoutDedicatedEvidence: supplierIntelligence.status === 'UNKNOWN'
    }
  };
}

module.exports = {
  ENTITY_TYPES,
  GEO_STATUS,
  classifyMarketEntity,
  buildMarketEntityMap,
  collectRawEntities
};
