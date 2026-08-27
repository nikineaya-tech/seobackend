'use strict';

const crypto = require('crypto');
const cheerio = require('cheerio');

const MAX_URLS = Math.max(1, Number(process.env.AGENT_REACH_MAX_URLS || 8));
const MAX_FEEDS = Math.max(0, Number(process.env.AGENT_REACH_MAX_FEEDS || 4));
const MAX_SEARCHES = Math.max(0, Number(process.env.AGENT_REACH_MAX_SEARCHES || 6));
const MAX_TEXT_CHARS = Math.max(800, Number(process.env.AGENT_REACH_MAX_TEXT_CHARS || 5000));
const FETCH_TIMEOUT_MS = Math.max(3000, Number(process.env.AGENT_REACH_FETCH_TIMEOUT_MS || 25000));

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

async function fetchText(url, { accept = 'text/plain' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Daka-Agent-Reach-Sensor/1.0',
        Accept: accept
      },
      signal: controller.signal
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url || url,
      text: clean(text, MAX_TEXT_CHARS)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readViaJina(targetUrl) {
  const normalized = normalizeUrl(targetUrl);
  if (!normalized) throw new Error('Invalid public URL');
  return fetchText(`https://r.jina.ai/${normalized}`, { accept: 'text/plain' });
}

async function searchViaJina(query) {
  const cleanQuery = clean(query, 180);
  if (!cleanQuery) throw new Error('Empty search query');
  return fetchText(`https://s.jina.ai/${encodeURIComponent(cleanQuery)}`, { accept: 'text/plain' });
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
  if (!query) return { unavailable: { query: searchQuery, reason: 'empty_search_query' }, evidence: null };
  try {
    const read = await searchViaJina(query);
    if (!read.ok || !read.text) {
      return { unavailable: { query, reason: `http_${read.status || 'unknown'}` }, evidence: null };
    }
    return {
      unavailable: null,
      evidence: evidenceFromText({
        url: read.url || `https://s.jina.ai/${encodeURIComponent(query)}`,
        text: read.text,
        title: `Jina search results: ${query}`,
        country: context.country,
        query: context.query || query,
        platform: 'jina_search',
        claimType: 'JINA_SEARCH_RESULTS'
      })
    };
  } catch (error) {
    return { unavailable: { query, reason: clean(error.message, 220) }, evidence: null };
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

async function collectAgentReachMarketEvidence(payload = {}) {
  const startedAt = Date.now();
  const context = {
    query: payload.query || payload.keyword || payload.niche || '',
    country: payload.country || payload.geo || payload.market || ''
  };
  const urls = arr(payload.urls || [payload.url, payload.targetUrl]).map(normalizeUrl).filter(Boolean).slice(0, MAX_URLS);
  const feeds = arr(payload.feeds || payload.rssFeeds).map(normalizeUrl).filter(Boolean).slice(0, MAX_FEEDS);
  const searches = arr(payload.searches || payload.searchQueries).map(item => clean(item, 180)).filter(Boolean).slice(0, MAX_SEARCHES);
  const evidence = [];
  const unavailable = [];

  for (const search of searches) {
    const result = await collectSearchEvidence(search, context);
    if (result.evidence) evidence.push(result.evidence);
    if (result.unavailable) unavailable.push(result.unavailable);
  }

  for (const url of urls) {
    const result = await collectUrlEvidence(url, context);
    if (result.evidence) evidence.push(result.evidence);
    if (result.unavailable) unavailable.push(result.unavailable);
  }

  for (const feed of feeds) {
    const result = await collectFeedEvidence(feed, context);
    evidence.push(...arr(result.evidence));
    if (result.unavailable) unavailable.push(result.unavailable);
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
      rss: 'direct RSS parser',
      youtube: 'captured as readable page evidence when URL is provided',
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
    counts: {
      searches: searches.length,
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
