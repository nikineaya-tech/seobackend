'use strict';

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

function uniq(values = [], limit = 20) {
  const seen = new Set();
  const out = [];
  asArray(values).forEach(value => {
    const text = cleanText(value, 900);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  });
  return out.slice(0, limit);
}

function hostOf(value = '') {
  try {
    return new URL(String(value).startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return cleanText(value, 160).replace(/^www\./i, '').toLowerCase();
  }
}

function urlOf(item = {}) {
  return cleanText(item.url || item.link || item.sourceUrl || item.href, 900);
}

function buildQueryVariants({ query = '', country = '', lang = '' } = {}) {
  const q = cleanText(query, 180);
  const c = cleanText(country, 90);
  const suffix = c ? ` ${c}` : '';
  const variants = [
    q,
    `${q}${suffix}`,
    `${q} reviews${suffix}`,
    `${q} comparison${suffix}`,
    `${q} price${suffix}`,
    `${q} alternatives${suffix}`,
    `${q} supplier wholesale`,
    `${q} site:youtube.com${suffix}`,
    `${q} site:reddit.com${suffix}`
  ];
  if (/^ar/i.test(lang)) {
    variants.push(`${q} مراجعات${suffix}`, `${q} سعر${suffix}`, `${q} مقارنة${suffix}`);
  }
  if (/^fr/i.test(lang)) {
    variants.push(`${q} avis${suffix}`, `${q} prix${suffix}`, `${q} comparatif${suffix}`);
  }
  return uniq(variants, 12);
}

function route(name, role, status, details = {}) {
  return {
    provider: name,
    role,
    status,
    priority: details.priority || 'MEDIUM',
    scopes: asArray(details.scopes),
    inputs: details.inputs || {},
    fallback: details.fallback || null,
    limitations: asArray(details.limitations),
    producesClaims: false
  };
}

function buildMarketDiscoveryPlan(input = {}) {
  const query = cleanText(input.query || input.keyword || input.niche, 180);
  const country = cleanText(input.country || input.geo || input.market, 90);
  const lang = cleanText(input.lang || 'fr', 20);
  const competitors = asArray(input.competitors);
  const urls = uniq(competitors.map(urlOf), Number(input.maxUrls || process.env.AGENT_REACH_COMPETITOR_URLS || 4));
  const hosts = uniq(urls.map(hostOf), 12);
  const searches = buildQueryVariants({ query, country, lang });
  const rssFeeds = uniq(asArray(input.rssFeeds || input.feeds), 8);
  const hasExa = Boolean(input.hasExaApiKey ?? process.env.EXA_API_KEY);
  const hasYoutube = Boolean(input.hasYoutubeApiKey ?? process.env.YOUTUBE_API_KEY);
  const agentReachEnabled = Boolean(input.agentReachEnabled);

  const routes = [
    route('serper', 'SERP and competitor discovery', 'ACTIVE', {
      priority: 'HIGH',
      scopes: ['MARKET', 'COMPETITOR', 'SUBSTITUTE'],
      inputs: { query, country, lang },
      limitations: ['SERP visibility is not market share and must not become a leader claim by itself.']
    }),
    route('maps', 'Local geo evidence and local seller context', 'ACTIVE', {
      priority: country ? 'HIGH' : 'LOW',
      scopes: ['MARKET', 'COMPETITOR', 'GEO'],
      inputs: { query, country },
      limitations: ['Map presence can support local relevance, not prove total market coverage.']
    }),
    route('shopping', 'Offer, price and marketplace evidence', 'ACTIVE', {
      priority: 'MEDIUM',
      scopes: ['OFFER', 'MARKETPLACE', 'PRICE'],
      inputs: { query, country },
      limitations: ['Observed prices remain sample evidence unless page-level pricing is verified.']
    }),
    route('agent-reach-railway', 'Market sensor collection through Jina Reader/Search, Exa, YouTube, URL pages and RSS', agentReachEnabled ? 'ACTIVE' : 'CONFIG_DISABLED', {
      priority: 'HIGH',
      scopes: ['MARKET', 'CUSTOMER', 'SOCIAL', 'CONTENT', 'TEMPORAL'],
      inputs: { urls, searches: searches.slice(0, 6), rssFeeds },
      fallback: 'serper + existing scraper',
      limitations: ['Agent Reach is acquisition only; all output must be normalized as evidence before interpretation.']
    }),
    route('exa', 'Semantic discovery for adjacent brands, guides and substitutes', hasExa ? 'AVAILABLE' : 'MISSING_API_KEY', {
      priority: 'MEDIUM',
      scopes: ['MARKET', 'SUBSTITUTE', 'CONTENT'],
      inputs: { searches: searches.slice(0, 5) },
      fallback: 'jina_search',
      limitations: ['Semantic discovery expands candidates; it does not verify business claims.']
    }),
    route('youtube', 'Review, tutorial and objection discovery', hasYoutube ? 'AVAILABLE' : 'MISSING_API_KEY', {
      priority: 'MEDIUM',
      scopes: ['CUSTOMER', 'SOCIAL', 'OBJECTION'],
      inputs: { searches: searches.filter(item => !/site:reddit/i.test(item)).slice(0, 4) },
      fallback: 'Jina readable YouTube URLs from SERP results',
      limitations: ['YouTube results are sampled customer-voice evidence, not representative market statistics.']
    }),
    route('supplier-search', 'Supplier and sourcing candidate discovery', hasExa || agentReachEnabled ? 'AVAILABLE' : 'LIMITED', {
      priority: 'LOW',
      scopes: ['SUPPLIER'],
      inputs: { searches: searches.filter(item => /supplier|wholesale|fabricant|grossiste/i.test(item)).slice(0, 4) },
      fallback: 'shopping + marketplace classification',
      limitations: ['Supplier intelligence remains UNKNOWN unless supplier-specific evidence confirms sourcing facts.']
    })
  ];

  return {
    version: 'market-source-router-v1',
    generatedAt: new Date().toISOString(),
    input: { query, country, lang },
    routes,
    railwayPayload: {
      query,
      country,
      urls,
      searches: searches.slice(0, Number(input.maxSearches || process.env.AGENT_REACH_MAX_SEARCHES || 6)),
      exaSearches: hasExa
        ? searches.slice(0, Number(input.maxExaSearches || process.env.AGENT_REACH_MAX_EXA_SEARCHES || 3))
        : [],
      youtubeSearches: hasYoutube
        ? searches.filter(item => !/site:reddit/i.test(item)).slice(0, Number(input.maxYoutubeSearches || process.env.AGENT_REACH_MAX_YOUTUBE_SEARCHES || 3))
        : [],
      feeds: rssFeeds
    },
    quality: {
      acquisitionOnly: true,
      providerFallbacks: routes.every(item => item.provider === 'serper' || item.fallback || ['ACTIVE', 'AVAILABLE'].includes(item.status)),
      routesProduceNoClaims: routes.every(item => item.producesClaims === false),
      competitorUrlsPlanned: urls.length,
      searchQueriesPlanned: searches.length
    },
    notes: [
      'Route outputs must be converted into market evidence before any strategic synthesis.',
      'Unsupported providers stay explicit instead of silently reducing confidence.'
    ]
  };
}

module.exports = {
  buildMarketDiscoveryPlan,
  buildQueryVariants
};
