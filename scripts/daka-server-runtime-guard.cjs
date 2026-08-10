'use strict';

// Daka runtime guard
// Keep Render focused on business/reporting while Railway remains scraping-only.
// This starter applies narrow source-level guards before executing server.js.

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'server.js');

function isFunnelClientClosed(reason) {
  const message = String(reason && (reason.message || reason) || '');
  return message.includes('FUNNEL_CLIENT_CONNECTION_CLOSED') || message.includes('ERR_STREAM_PREMATURE_CLOSE');
}

const originalOn = process.on.bind(process);
process.on = function patchedProcessOn(event, listener) {
  if (event === 'unhandledRejection' && typeof listener === 'function') {
    return originalOn(event, (reason, promise) => {
      if (isFunnelClientClosed(reason)) {
        console.warn('[FUNNEL-GUARD] Client closed analysis connection; background rejection ignored.');
        return;
      }
      return listener(reason, promise);
    });
  }
  return originalOn(event, listener);
};

originalOn('unhandledRejection', (reason) => {
  if (isFunnelClientClosed(reason)) {
    console.warn('[FUNNEL-GUARD] Client closed analysis connection; ignored.');
  }
});

function patchModelIds(source) {
  return source
    .replaceAll('z-ai/glm-4.7-flash', 'z-ai/glm-5.2')
    .replaceAll('xiaomi/mimo-v2-flash', 'xiaomi/mimo-v2.5')
    .replaceAll('qwen/qwen-3.5-9b-instruct', 'qwen/qwen3.7-plus');
}

function patchCommerceFallback(source) {
  const marker = 'async function exploreFunnelCommerce';
  if (!source.includes(marker)) {
    console.warn('[FUNNEL-GUARD] exploreFunnelCommerce function not found; commerce guard not injected.');
    return source;
  }
  return source.replace(/async\s+function\s+exploreFunnelCommerce\s*\(([^)]*)\)\s*\{/, (match, args) => {
    if (match.includes('DAKA_FUNNEL_DISABLE_COMMERCE_AFTER_DEEP')) return match;
    return `async function exploreFunnelCommerce(${args}) {\n    if (process.env.DAKA_FUNNEL_DISABLE_COMMERCE_AFTER_DEEP !== 'false') {\n        console.warn('[SCRAPING-ROUTER] Commerce exploration skipped by Funnel guard; deep-scrape is the canonical Railway job.');\n        return { success: false, partial: true, source: 'railway-commerce-skipped', pagesExplored: [], sectionRawBlocks: [], sectionsDetailed: [], bodyText: '', text: '', ctas: [], prices: [], links: [], images: [], limits: ['Commerce exploration skipped after deep scrape to prevent duplicate Railway jobs.'] };\n    }`;
  });
}

function compileServer() {
  let source = fs.readFileSync(SERVER_PATH, 'utf8');
  source = patchModelIds(source);
  source = patchCommerceFallback(source);

  const mod = new Module(SERVER_PATH, module.parent || module);
  mod.filename = SERVER_PATH;
  mod.paths = Module._nodeModulePaths(ROOT);
  mod._compile(source, SERVER_PATH);
}

compileServer();
