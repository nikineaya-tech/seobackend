'use strict';

/**
 * Daka Funnel Route Dedupe Preload
 *
 * Prevents two near-identical Funnel analyses from running at the same time.
 * This is route-level protection for /api/analyze-funnel and /api/funnel.
 *
 * Behavior:
 * - First request runs normally.
 * - Concurrent duplicate with same user scope + URL + language/country waits for the first.
 * - Recent identical completed report is reused for a short TTL.
 * - No Railway, scraping, Competitors, or AI logic is changed.
 */

const crypto = require('crypto');
const express = require('express');

const LOG = '[FUNNEL-ROUTE-DEDUPE]';
const CACHE_TTL_MS = Number(process.env.FUNNEL_ROUTE_DEDUPE_TTL_MS || 10 * 60 * 1000);
const MAX_CACHE_ENTRIES = Number(process.env.FUNNEL_ROUTE_DEDUPE_MAX || 40);
const inFlight = new Map();
const completed = new Map();

if (!global.__DAKA_FUNNEL_ROUTE_DEDUPE__) {
  global.__DAKA_FUNNEL_ROUTE_DEDUPE__ = true;
  patchExpressPost(express);
  setInterval(cleanup, Math.min(CACHE_TTL_MS, 60 * 1000)).unref?.();
  console.log(`${LOG} Enabled for /api/analyze-funnel and /api/funnel`);
}

function patchExpressPost(expressModule) {
  const proto = expressModule?.application;
  if (!proto || proto.__dakaFunnelRouteDedupePatched) return;

  const originalPost = proto.post;

  proto.post = function dakaFunnelDedupePost(path, ...handlers) {
    if (isFunnelPath(path)) {
      const flatHandlers = flattenHandlers(handlers);
      if (flatHandlers.length) {
        return originalPost.call(this, path, createDedupeRouteHandler(path, flatHandlers));
      }
    }

    return originalPost.call(this, path, ...handlers);
  };

  proto.__dakaFunnelRouteDedupePatched = true;
}

function createDedupeRouteHandler(routePath, handlers) {
  return function funnelRouteDedupeHandler(req, res, next) {
    const key = buildDedupeKey(req, routePath);
    if (!key) return runHandlers(req, res, next, handlers);

    const cached = completed.get(key);
    if (cached && Date.now() - cached.createdAt <= CACHE_TTL_MS) {
      console.log(`${LOG} Cache HIT for ${shortKey(key)}`);
      return sendCaptured(res, cached.payload);
    }

    const active = inFlight.get(key);
    if (active) {
      console.log(`${LOG} Awaiting in-flight report for ${shortKey(key)}`);
      return active.promise
        .then(payload => sendCaptured(res, payload))
        .catch(error => {
          console.warn(`${LOG} In-flight duplicate failed:`, error.message);
          next(error);
        });
    }

    let resolveEntry;
    let rejectEntry;
    const promise = new Promise((resolve, reject) => {
      resolveEntry = resolve;
      rejectEntry = reject;
    });

    inFlight.set(key, { promise, startedAt: Date.now() });

    const finishSuccess = payload => {
      if (!payload) return;
      completed.set(key, { payload, createdAt: Date.now() });
      trimCompletedCache();
      inFlight.delete(key);
      resolveEntry(payload);
    };

    const finishError = error => {
      inFlight.delete(key);
      rejectEntry(error);
    };

    patchResponseCapture(res, finishSuccess);

    runHandlers(req, res, error => {
      if (error) finishError(error);
      return next(error);
    }, handlers);
  };
}

function runHandlers(req, res, next, handlers) {
  let index = 0;

  function step(error) {
    if (error) return next(error);
    if (res.headersSent || res.writableEnded) return;

    const handler = handlers[index++];
    if (!handler) return next();

    try {
      if (handler.length >= 4) return step();

      const result = handler(req, res, step);
      if (result && typeof result.then === 'function') {
        result.catch(step);
      }
    } catch (err) {
      step(err);
    }
  }

  step();
}

function patchResponseCapture(res, onCaptured) {
  if (res.__dakaFunnelDedupeCapture) return;
  res.__dakaFunnelDedupeCapture = true;

  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function dakaDedupeJson(body) {
    captureLater(res, 'json', body, onCaptured);
    return originalJson.call(this, body);
  };

  res.send = function dakaDedupeSend(body) {
    captureLater(res, 'send', body, onCaptured);
    return originalSend.call(this, body);
  };
}

function captureLater(res, method, body, onCaptured) {
  setImmediate(() => {
    try {
      onCaptured({
        method,
        statusCode: res.statusCode || 200,
        headers: captureHeaders(res),
        body
      });
    } catch (error) {
      console.warn(`${LOG} Capture failed:`, error.message);
    }
  });
}

function sendCaptured(res, payload) {
  if (!payload || res.headersSent || res.writableEnded) return;

  const statusCode = Number(payload.statusCode || 200);
  res.status(statusCode);

  for (const [key, value] of Object.entries(payload.headers || {})) {
    try { if (value !== undefined) res.setHeader(key, value); } catch {}
  }

  if (payload.method === 'json') return res.json(payload.body);
  return res.send(payload.body);
}

function captureHeaders(res) {
  const headers = {};
  for (const key of ['content-type', 'cache-control']) {
    const value = res.getHeader?.(key);
    if (value !== undefined) headers[key] = value;
  }
  return headers;
}

function buildDedupeKey(req, routePath) {
  const body = req.body || {};
  const url = pickFirstString(
    body.url,
    body.targetUrl,
    body.websiteUrl,
    body.funnelUrl,
    body.analysisUrl,
    body.pageUrl,
    req.query?.url
  );

  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return '';

  const lang = pickFirstString(body.lang, body.language, req.query?.lang, req.query?.language, 'auto').toLowerCase();
  const country = pickFirstString(body.country, body.geo, body.market, req.query?.country, 'auto').toLowerCase();
  const context = hashShort(JSON.stringify({
    offerType: body.offerType || body.type || '',
    mode: body.mode || body.analysisMode || '',
    source: body.source || ''
  }));
  const userScope = buildUserScope(req);

  return ['funnel-route', String(routePath), userScope, normalizedUrl, lang, country, context].join('|');
}

function buildUserScope(req) {
  const explicit = pickFirstString(
    req.user?.id,
    req.auth?.userId,
    req.headers?.['x-user-id'],
    req.headers?.['x-supabase-user'],
    req.headers?.['x-client-id']
  );
  if (explicit) return `u:${hashShort(explicit)}`;

  const auth = pickFirstString(req.headers?.authorization, req.headers?.Authorization);
  if (auth) return `a:${hashShort(auth)}`;

  return `ip:${hashShort(req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous')}`;
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|msclkid|_hs|mc_)/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return raw.toLowerCase().slice(0, 300);
  }
}

function isFunnelPath(path) {
  if (Array.isArray(path)) return path.some(isFunnelPath);
  if (path instanceof RegExp) return /analyze-funnel|funnel/i.test(String(path));
  return /^\/api\/(analyze-funnel|funnel)$/i.test(String(path || '').trim());
}

function flattenHandlers(handlers) {
  const out = [];
  for (const item of handlers) {
    if (Array.isArray(item)) out.push(...flattenHandlers(item));
    else if (typeof item === 'function') out.push(item);
  }
  return out;
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value !== undefined && value !== null && typeof value !== 'object' && String(value).trim()) return String(value).trim();
  }
  return '';
}

function hashShort(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function shortKey(key) {
  return hashShort(key);
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of completed.entries()) {
    if (now - entry.createdAt > CACHE_TTL_MS) completed.delete(key);
  }
  for (const [key, entry] of inFlight.entries()) {
    if (now - entry.startedAt > 5 * 60 * 1000) inFlight.delete(key);
  }
  trimCompletedCache();
}

function trimCompletedCache() {
  while (completed.size > MAX_CACHE_ENTRIES) {
    const oldestKey = completed.keys().next().value;
    completed.delete(oldestKey);
  }
}
