'use strict';

const crypto = require('crypto');
const cheerio = require('cheerio');

const MAX_URLS = Math.max(1, Number(process.env.AGENT_REACH_MAX_URLS || 8));
const MAX_FEEDS = Math.max(0, Number(process.env.AGENT_REACH_MAX_FEEDS || 4));
const MAX_SEARCHES = Math.max(0, Number(process.env.AGENT_REACH_MAX_SEARCHES || 6));
const MAX_EXA_SEARCHES = Math.max(0, Number(process.env.AGENT_REACH_MAX_EXA_SEARCHES || 3));
const MAX_EXA_RESULTS = Math.min(10, Math.max(1, Number(process.env.AGENT_REACH_MAX_EXA_RESULTS || 5)));
const MAX_EXA_RESPONSE_CHARS = Math.max(2000, Number(process.env.AGENT_REACH_MAX_EXA_RESPONSE_CHARS || 30000));
const MAX_YOUTUBE_SEARCHES = Math.max(0, Number(process.env.AGENT_REACH_MAX_YOUTUBE_SEARCHES || 3));
const MAX_YOUTUBE_RESULTS = Math.max(1, Number(process.env.AGENT_REACH_MAX_YOUTUBE_RESULTS || 5));
const MAX_TEXT_CHARS = Math.max(800, Number(process.env.AGENT_REACH_MAX_TEXT_CHARS || 5000));
const FETCH_TIMEOUT_MS = Math.max(3000, Number(process.env.AGENT_REACH_FETCH_TIMEOUT_MS || 25000));

function jinaAuthHeaders() {
  const apiKey = String(process.env.JINA_API_KEY || '').trim();
  return apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};
}
function arr(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clean(value, max = 1000) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function normalizeUrl(rawUrl) {
  const value = clean(rawUrl, 900);
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch (_) {
    return null;
  }
}

function platformOf(url = '') {
  const host = (() => {
    try { return new URL(url).hostname.toLowerCase(); } catch (_) { return ''; }
  })();
  if (/youtube\.com|youtu\.be/.test(host)) return 'youtube';
  if (/reddit\.com/.test(host)) return 'reddit';
  if (/(^|\.)x\.com|twitter\.com/.test(host)) return 'x';
  if (/instagram\.com/.test(host)) return 'instagram';
  if (/facebook\.com/.test(host)) return 'facebook';
  if (/linkedin\.com/.test(host)) return 'linkedin';
  return 'web';
}

function scopeForPlatform(platform) {
  if (['youtube', 'reddit', 'x', 'instagram', 'facebook', 'linkedin'].includes(platform)) return 'CUSTOMER';
  return 'MARKET';
}

async function fetchText(
  url,
  {
    accept = 'text/plain',
    method = 'GET',
    headers = {},
    body = null,
    maxChars = MAX_TEXT_CHARS,
    preserveRaw = false
  } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'Daka-Agent-Reach-Sensor/1.0',
        Accept: accept,
        ...headers
      },
      body,
      signal: controller.signal
    });

    const rawText = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      url: response.url || url,

      // IMPORTANT:
      // JSON ne doit jamais être tronqué avant JSON.parse().
      text: preserveRaw
        ? rawText
        : clean(rawText, maxChars)
    };
  } finally {
    clearTimeout(timer);
  }
}
async function readViaJina(targetUrl) {
  const normalized = normalizeUrl(targetUrl);

  if (!normalized) {
    throw new Error('Invalid public URL');
  }

  return fetchText(`https://r.jina.ai/${normalized}`, {
    accept: 'text/plain',
    headers: jinaAuthHeaders()
  });
}

async function searchViaJina(query) {
  const cleanQuery = clean(query, 180);

  if (!cleanQuery) {
    throw new Error('Empty search query');
  }

  return fetchText(
    `https://s.jina.ai/${encodeURIComponent(cleanQuery)}`,
    {
      accept: 'text/plain',
      headers: jinaAuthHeaders()
    }
  );
}
function evidenceFromText({ url, text, title, country, query, claimType = 'WEB_CONTENT', platform }) {
  const value = clean(text, MAX_TEXT_CHARS);
  const sourcePlatform = platform || platformOf(url);
  return {
    id: `ev_agent_reach_${hash(`${url}|${claimType}|${value.slice(0, 180)}`)}`,
    scope: scopeForPlatform(sourcePlatform),
    entityId: null,
    country: clean(country, 80) || null,
    query: clean(query, 180) || null,
    claimType,
    value,
    title: clean(title, 220) || null,
    sourcePlatform,
    sourceUrl: url,
    publishedAt: null,
    collectedAt: new Date().toISOString(),
    confidence: value.length > 240 ? 'MEDIUM' : 'LOW',
    verificationStatus: value ? 'CONFIRMED' : 'NOT_VERIFIED',
    limitations: value
      ? ['Content was collected as source evidence only; interpretation must happen after claim validation.']
      : ['No readable content was collected from this source.']
  };
}

async function collectUrlEvidence(url, context = {}) {
  const normalized = normalizeUrl(url);
  if (!normalized) return { unavailable: { url, reason: 'invalid_url' }, evidence: null };
  try {
    const read = await readViaJina(normalized);
    if (!read.ok || !read.text) {
      return { unavailable: { url: normalized, reason: `http_${read.status || 'unknown'}` }, evidence: null };
    }
    const titleMatch = read.text.match(/^Title:\s*(.+)$/im);
    return {
      unavailable: null,
      evidence: evidenceFromText({
        url: normalized,
        text: read.text,
        title: titleMatch?.[1] || '',
        country: context.country,
        query: context.query,
        platform: platformOf(normalized),
        claimType: platformOf(normalized) === 'youtube' ? 'VIDEO_PAGE_CONTENT' : 'WEB_PAGE_CONTENT'
      })
    };
  } catch (error) {
    return { unavailable: { url: normalized, reason: clean(error.message, 220) }, evidence: null };
  }
}

function parseFeedItems(xml, feedUrl, context = {}) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const nodes = $('item, entry').slice(0, 12).toArray();
  return nodes.map(node => {
    const el = $(node);
    const title = clean(el.find('title').first().text(), 220);
    const link = clean(el.find('link').first().attr('href') || el.find('link').first().text() || feedUrl, 900);
    const publishedAt = clean(el.find('pubDate, published, updated').first().text(), 80) || null;
    const summary = clean(el.find('description, summary, content').first().text(), MAX_TEXT_CHARS);
    const sourceUrl = normalizeUrl(link) || feedUrl;
    return {
      id: `ev_agent_reach_${hash(`${feedUrl}|${sourceUrl}|${title}`)}`,
      scope: 'MARKET',
      entityId: null,
      country: clean(context.country, 80) || null,
      query: clean(context.query, 180) || null,
      claimType: 'RSS_ITEM',
      value: summary || title,
      title,
      sourcePlatform: 'rss',
      sourceUrl,
      feedUrl,
      publishedAt,
      collectedAt: new Date().toISOString(),
      confidence: title || summary ? 'MEDIUM' : 'LOW',
      verificationStatus: title || summary ? 'CONFIRMED' : 'NOT_VERIFIED',
      limitations: ['RSS item is a freshness signal; it is not proof of market growth by itself.']
    };
  }).filter(item => item.value || item.title);
}

async function collectFeedEvidence(feedUrl, context = {}) {
  const normalized = normalizeUrl(feedUrl);
  if (!normalized) return { unavailable: { url: feedUrl, reason: 'invalid_feed_url' }, evidence: [] };
  try {
    const read = await fetchText(normalized, { accept: 'application/rss+xml, application/atom+xml, text/xml, */*' });
    if (!read.ok || !read.text) {
      return { unavailable: { url: normalized, reason: `http_${read.status || 'unknown'}` }, evidence: [] };
    }
    return { unavailable: null, evidence: parseFeedItems(read.text, normalized, context) };
  } catch (error) {
    return { unavailable: { url: normalized, reason: clean(error.message, 220) }, evidence: [] };
  }
}

async function collectSearchEvidence(searchQuery, context = {}) {
  const query = clean(searchQuery, 180);

  if (!query) {
    return {
      unavailable: {
        query: searchQuery,
        provider: 'jina',
        channel: 'search',
        status: 'INVALID_INPUT',
        reason: 'empty_search_query'
      },
      evidence: null
    };
  }

  try {
    const read = await searchViaJina(query);

    if (!read.ok || !read.text) {
      const authRequired = read.status === 401 || read.status === 403;
      return {
        unavailable: {
          query,
          provider: 'jina',
          channel: 'search',
          backend: 'jina-search',
          status: authRequired ? 'AUTH_REQUIRED' : 'FAILED',
          reason: read.reason || `http_${read.status || 'unknown'}`
        },
        evidence: null
      };
    }

    return {
      unavailable: null,
      evidence: evidenceFromText({
        url:
          read.url ||
          `https://s.jina.ai/${encodeURIComponent(query)}`,
        text: read.text,
        title: `Jina search results: ${query}`,
        country: context.country,
        query: context.query || query,
        platform: 'jina_search',
        claimType: 'JINA_SEARCH_RESULTS'
      })
    };
  } catch (error) {
    return {
      unavailable: {
        query,
        provider: 'jina',
        channel: 'search',
        backend: 'jina-search',
        status: /401|403|auth|unauthor/i.test(String(error.message || '')) ? 'AUTH_REQUIRED' : 'FAILED',
        reason: clean(error.message, 220)
      },
      evidence: null
    };
  }
}

function exaCountryHint(country) {
  const value = clean(country, 10).toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

function exaEvidenceFromResult(item = {}, query = '', context = {}) {
  const sourceUrl = normalizeUrl(item.url || item.id);
  const title = clean(item.title, 220);
  const highlights = arr(item.highlights).map(value => clean(value, 900)).filter(Boolean);
  const summary = clean(item.summary, 1200);
  const text = clean(item.text, 1800);
  const value = clean([title, highlights.join(' '), summary, text].filter(Boolean).join(' — '), MAX_TEXT_CHARS);
  if (!sourceUrl || !value) return null;
  const resultPlatform = platformOf(sourceUrl);
  return {
    id: `ev_agent_reach_${hash(`${sourceUrl}|EXA_SEARCH_RESULT|${value.slice(0, 180)}`)}`,
    scope: scopeForPlatform(resultPlatform),
    entityId: null,
    country: clean(context.country, 80) || null,
    query: clean(context.query || query, 180) || null,
    claimType: 'EXA_SEARCH_RESULT',
    value,
    title,
    sourcePlatform: 'exa_search',
    resultPlatform,
    sourceUrl,
    publishedAt: clean(item.publishedDate || item.publishedAt, 80) || null,
    collectedAt: new Date().toISOString(),
    confidence: highlights.length || summary || text.length > 240 ? 'MEDIUM' : 'LOW',
    verificationStatus: 'CONFIRMED',
    limitations: ['Exa semantic result is discovery evidence; it does not verify business claims or market size by itself.']
  };
}

async function collectExaSearchEvidence(searchQuery, context = {}) {
  const apiKey = clean(process.env.EXA_API_KEY || process.env.EXA_SEARCH_API_KEY, 500);
  const query = clean(searchQuery, 220);
  if (!query) return { unavailable: { query: searchQuery, provider: 'exa', reason: 'empty_exa_query' }, evidence: [] };
  if (!apiKey) return { unavailable: { query, provider: 'exa', reason: 'missing_api_key' }, evidence: [] };

  const body = {
    query,
    type: 'auto',
    numResults: MAX_EXA_RESULTS,
    moderation: true,
    contents: {
      highlights: true
    }
  };
  const userLocation = exaCountryHint(context.country);
  if (userLocation) body.userLocation = userLocation;

  try {
    const read = await fetchText('https://api.exa.ai/search', {
  method: 'POST',
  accept: 'application/json',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  },
  body: JSON.stringify(body),
  preserveRaw: true
});
    if (!read.ok || !read.text) {
      return { unavailable: { query, provider: 'exa', reason: `http_${read.status || 'unknown'}` }, evidence: [] };
    }
    const parsed = JSON.parse(read.text);
    return {
      unavailable: null,
      evidence: arr(parsed.results).map(item => exaEvidenceFromResult(item, query, context)).filter(Boolean)
    };
  } catch (error) {
    return { unavailable: { query, provider: 'exa', reason: clean(error.message, 220) }, evidence: [] };
  }
}

function youtubeEvidenceFromItem(item = {}, query = '', context = {}) {
  const snippet = item.snippet || {};
  const videoId = item.id?.videoId || item.id;
  const sourceUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  const title = clean(snippet.title, 220);
  const description = clean(snippet.description, MAX_TEXT_CHARS);
  const value = clean([title, description].filter(Boolean).join(' — '), MAX_TEXT_CHARS);
  if (!sourceUrl || !value) return null;
  return {
    id: `ev_agent_reach_${hash(`${sourceUrl}|YOUTUBE_SEARCH_RESULT|${value.slice(0, 180)}`)}`,
    scope: 'CUSTOMER',
    entityId: null,
    country: clean(context.country, 80) || null,
    query: clean(context.query || query, 180) || null,
    claimType: 'YOUTUBE_SEARCH_RESULT',
    value,
    title,
    sourcePlatform: 'youtube',
    sourceUrl,
    publishedAt: clean(snippet.publishedAt, 80) || null,
    collectedAt: new Date().toISOString(),
    confidence: 'MEDIUM',
    verificationStatus: 'CONFIRMED',
    limitations: ['YouTube result is sampled customer/content evidence; it is not representative market statistics.']
  };
}

async function collectYouTubeSearchEvidence(searchQuery, context = {}) {
  const apiKey = clean(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_YOUTUBE_API_KEY, 300);
  const query = clean(searchQuery, 180);
  if (!query) return { unavailable: { query: searchQuery, provider: 'youtube', reason: 'empty_youtube_query' }, evidence: [] };
  if (!apiKey) return { unavailable: { query, provider: 'youtube', reason: 'missing_api_key' }, evidence: [] };
  const endpoint = new URL('https://www.googleapis.com/youtube/v3/search');
  endpoint.searchParams.set('part', 'snippet');
  endpoint.searchParams.set('type', 'video');
  endpoint.searchParams.set('maxResults', String(MAX_YOUTUBE_RESULTS));
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('key', apiKey);
  try {
    const read = await fetchText(endpoint.toString(), {
  accept: 'application/json',
  preserveRaw: true
});
    if (!read.ok || !read.text) {
      return { unavailable: { query, provider: 'youtube', reason: `http_${read.status || 'unknown'}` }, evidence: [] };
    }
    const parsed = JSON.parse(read.text);
    return {
      unavailable: null,
      evidence: arr(parsed.items).map(item => youtubeEvidenceFromItem(item, query, context)).filter(Boolean)
    };
  } catch (error) {
    return { unavailable: { query, provider: 'youtube', reason: clean(error.message, 220) }, evidence: [] };
  }
}

function dedupeEvidence(evidence = []) {
  const seen = new Set();
  return evidence.filter(item => {
    const key = `${item.sourceUrl}|${item.claimType}|${clean(item.value, 180).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pushDiagnostic(channelDiagnostics, row = {}) {
  const item = {
    provider: row.provider || null,
    channel: row.channel || row.provider || 'unknown',
    backend: row.backend || null,
    query: clean(row.query, 180) || '',
    url: clean(row.url || row.sourceUrl, 900) || '',
    resultCount: Number(row.resultCount || 0),
    evidence: Number(row.evidence || 0),
    status: row.status || 'UNKNOWN',
    reason: row.reason || (row.status === 'READY' ? 'ok' : 'unknown'),
    durationMs: Number(row.durationMs || 0)
  };
  channelDiagnostics.push(item);
  return item;
}

function summarizeDiagnostics(channelDiagnostics = []) {
  return channelDiagnostics.reduce((acc, item) => {
    const key = item.channel || 'unknown';
    if (!acc[key]) acc[key] = { evidence: 0, unavailable: 0, ready: 0, status: 'UNKNOWN' };
    acc[key].evidence += Number(item.evidence || 0);
    if (item.status !== 'READY') acc[key].unavailable += 1;
    if (item.status === 'READY') acc[key].ready += 1;
    acc[key].status = acc[key].ready > 0 ? 'READY' : item.status || acc[key].status;
    return acc;
  }, {});
}

async function collectAgentReachMarketEvidence(payload = {}) {
  const startedAt = Date.now();
  const context = {
    query: payload.query || payload.keyword || payload.niche || '',
    country: payload.country || payload.geo || payload.market || ''
  };
  const urls = arr(payload.urls || [payload.url, payload.targetUrl]).map(normalizeUrl).filter(Boolean).slice(0, MAX_URLS);
  const feeds = arr(payload.feeds || payload.rssFeeds).map(normalizeUrl).filter(Boolean).slice(0, MAX_FEEDS);
  const searches = arr(payload.searches || payload.searchQueries).map(item => clean(item, 180)).filter(Boolean).slice(0, MAX_SEARCHES);
  const exaSearches = arr(payload.exaSearches || payload.exaQueries).map(item => clean(item, 220)).filter(Boolean).slice(0, MAX_EXA_SEARCHES);
  const youtubeSearches = arr(payload.youtubeSearches || payload.youtubeQueries).map(item => clean(item, 180)).filter(Boolean).slice(0, MAX_YOUTUBE_SEARCHES);
  const evidence = [];
  const unavailable = [];
  const channelDiagnostics = [];

  for (const exaQuery of exaSearches) {
    const channelStarted = Date.now();
    const result = await collectExaSearchEvidence(exaQuery, context);
    evidence.push(...arr(result.evidence));
    if (result.unavailable) unavailable.push(result.unavailable);
    pushDiagnostic(channelDiagnostics, {
      ...(result.unavailable || {}),
      provider: 'exa',
      channel: 'exa',
      backend: 'exa-search',
      query: exaQuery,
      status: result.unavailable ? (result.unavailable.status || 'UNAVAILABLE') : 'READY',
      reason: result.unavailable?.reason || 'ok',
      resultCount: arr(result.evidence).length,
      evidence: arr(result.evidence).length,
      durationMs: Date.now() - channelStarted
    });
  }

  for (const youtubeQuery of youtubeSearches) {
    const channelStarted = Date.now();
    const result = await collectYouTubeSearchEvidence(youtubeQuery, context);
    evidence.push(...arr(result.evidence));
    if (result.unavailable) unavailable.push(result.unavailable);
    pushDiagnostic(channelDiagnostics, {
      ...(result.unavailable || {}),
      provider: 'youtube',
      channel: 'youtube',
      backend: 'youtube-data-api',
      query: youtubeQuery,
      status: result.unavailable ? (result.unavailable.status || 'UNAVAILABLE') : 'READY',
      reason: result.unavailable?.reason || 'ok',
      resultCount: arr(result.evidence).length,
      evidence: arr(result.evidence).length,
      durationMs: Date.now() - channelStarted
    });
  }

let jinaSearchAuthFailed = false;
for (const search of searches) {
  const channelStarted = Date.now();
  if (jinaSearchAuthFailed) {
    const blocked = {
      query: search,
      provider: 'jina',
      channel: 'search',
      backend: 'jina-search',
      status: 'AUTH_REQUIRED',
      reason: 'jina_search_auth_failed_after_first_attempt'
    };
    unavailable.push(blocked);
    pushDiagnostic(channelDiagnostics, {
      ...blocked,
      durationMs: Date.now() - channelStarted
    });
    continue;
  }
  try {
    const result = await collectSearchEvidence(search, context);
    if (result?.evidence) evidence.push(result.evidence);
    if (result?.unavailable) unavailable.push(result.unavailable);
    const status = result?.unavailable ? (result.unavailable.status || 'FAILED') : 'READY';
    if (status === 'AUTH_REQUIRED') jinaSearchAuthFailed = true;
    pushDiagnostic(channelDiagnostics, {
      ...(result?.unavailable || {}),
      provider: 'jina',
      channel: 'search',
      backend: 'jina-search',
      query: search,
      status,
      reason: result?.unavailable?.reason || 'ok',
      resultCount: result?.evidence ? 1 : 0,
      evidence: result?.evidence ? 1 : 0,
      durationMs: Date.now() - channelStarted
    });
  } catch (error) {
    const failed = {
      provider: 'jina',
      channel: 'search',
      backend: 'jina-search',
      status: 'FAILED',
      reason: clean(error?.message || 'search_failed', 220)
    };
    unavailable.push(failed);
    pushDiagnostic(channelDiagnostics, {
      ...failed,
      query: search,
      durationMs: Date.now() - channelStarted
    });
  }
}

  const urlResults = await Promise.allSettled(
  urls.map(url =>
    collectUrlEvidence(url, context)
  )
);

for (const settled of urlResults) {
  if (settled.status === 'fulfilled') {
    const result = settled.value;

    if (result?.evidence) {
      evidence.push(result.evidence);
    }

    if (result?.unavailable) {
      unavailable.push(result.unavailable);
    }
    const platform = result?.evidence?.sourcePlatform || platformOf(result?.unavailable?.url || '');
    pushDiagnostic(channelDiagnostics, {
      ...(result?.unavailable || {}),
      provider: 'jina',
      channel: `${platform || 'web'}-url`,
      backend: 'jina-reader',
      url: result?.evidence?.sourceUrl || result?.unavailable?.url || '',
      status: result?.unavailable ? 'UNAVAILABLE' : 'READY',
      reason: result?.unavailable?.reason || 'ok',
      resultCount: result?.evidence ? 1 : 0,
      evidence: result?.evidence ? 1 : 0
    });
  } else {
    const failed = {
      provider: 'jina',
      channel: 'web',
      status: 'FAILED',
      reason: clean(settled.reason?.message || 'url_read_failed', 220)
    };
    unavailable.push(failed);
    pushDiagnostic(channelDiagnostics, failed);
  }
}
const MARKET_SENSOR_BUDGET_MS = Math.max(
  5000,
  Number(process.env.AGENT_REACH_TOTAL_TIMEOUT_MS || 18000)
);
  for (const feed of feeds) {
    const channelStarted = Date.now();
    const result = await collectFeedEvidence(feed, context);
    evidence.push(...arr(result.evidence));
    if (result.unavailable) unavailable.push(result.unavailable);
    pushDiagnostic(channelDiagnostics, {
      ...(result.unavailable || {}),
      provider: 'rss',
      channel: 'rss',
      backend: 'rss-parser',
      url: feed,
      status: result.unavailable ? (result.unavailable.status || 'UNAVAILABLE') : 'READY',
      reason: result.unavailable?.reason || 'ok',
      resultCount: arr(result.evidence).length,
      evidence: arr(result.evidence).length,
      durationMs: Date.now() - channelStarted
    });
  }

  const normalizedEvidence = dedupeEvidence(evidence);
  return {
    success: normalizedEvidence.length > 0,
    kind: 'market-sensor',
    provider: 'agent-reach-railway-adapter',
    layer: 'market-sensor',
    sourceRouter: {
      web: 'Jina Reader compatible path',
      search: 'Jina Search compatible path',
      exa: 'Exa semantic search when EXA_API_KEY is configured',
      youtube: 'YouTube Data API search when YOUTUBE_API_KEY is configured',
      rss: 'direct RSS parser',
      youtubeUrl: 'captured as readable page evidence when URL is provided',
      note: 'Agent Reach remains an acquisition layer; no business conclusion is produced here.'
    },
    query: context.query || null,
    country: context.country || null,
    evidenceRegistry: {
      version: 'market-evidence-v1',
      generatedAt: new Date().toISOString(),
      evidence: normalizedEvidence
    },
    unavailable,
    channelDiagnostics,
    channelSummary: summarizeDiagnostics(channelDiagnostics),
    counts: {
      exaSearches: exaSearches.length,
      searches: searches.length,
      youtubeSearches: youtubeSearches.length,
      urls: urls.length,
      feeds: feeds.length,
      evidence: normalizedEvidence.length,
      unavailable: unavailable.length
    },
    durationMs: Date.now() - startedAt
  };
}

module.exports = {
  collectAgentReachMarketEvidence,
  platformOf,
  normalizeUrl
};
