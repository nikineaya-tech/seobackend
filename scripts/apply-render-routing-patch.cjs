'use strict';

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const server = fs.readFileSync(serverPath, 'utf8');

const forbiddenQueuedTypes = [
  'competitors',
  'funnel',
  'technical',
  'technical-seo',
  'keywords',
  'seo-assets',
  'generate-seo-assets'
];

let patched = server;
const changedTypes = [];

for (const type of forbiddenQueuedTypes) {
  const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`,\\s*queuedJobMiddleware\\(\\s*['\"]${escapedType}['\"]\\s*\\)`, 'g');
  const before = patched;
  patched = patched.replace(rx, '');
  if (patched !== before) changedTypes.push(type);
}

if (patched !== server) {
  fs.writeFileSync(serverPath, patched, 'utf8');
  console.log(`[RenderRoutingPatch] Removed queuedJobMiddleware for: ${changedTypes.join(', ')}`);
  console.log('[RenderRoutingPatch] Business/AI routes will run on Render. Railway remains scraping-only.');
} else {
  console.log('[RenderRoutingPatch] No forbidden business queue middleware found. Nothing to patch.');
}

const stillForbidden = forbiddenQueuedTypes.filter(type => {
  const rx = new RegExp(`queuedJobMiddleware\\(\\s*['\"]${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]\\s*\\)`);
  return rx.test(fs.readFileSync(serverPath, 'utf8'));
});

if (stillForbidden.length) {
  console.error(`[RenderRoutingPatch] Failed: still found forbidden queued middleware for: ${stillForbidden.join(', ')}`);
  process.exit(1);
}
