'use strict';

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const server = fs.readFileSync(serverPath, 'utf8');

const businessRoutes = [
  { route: '/api/competitors', type: 'competitors' },
  { route: '/api/analyze-funnel', type: 'funnel' },
  { route: '/api/generate-keywords', type: 'keywords' },
  { route: '/api/technical-seo', type: 'technical' }
];

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const violations = businessRoutes.filter(({ route, type }) => {
  const rx = new RegExp(
    `app\\.post\\(\\s*['"]${escapeRegExp(route)}['"][\\s\\S]*?queuedJobMiddleware\\(\\s*['"]${escapeRegExp(type)}['"]\\s*\\)[\\s\\S]*?async\\s*\\(`,
    'm'
  );
  return rx.test(server);
});

if (violations.length) {
  console.error('[RenderRoutingCheck] Business routes must run on Render, not Railway:');
  for (const item of violations) {
    console.error(`- ${item.route} still uses queuedJobMiddleware('${item.type}')`);
  }
  process.exit(1);
}

console.log('[RenderRoutingCheck] Business routes run on Render. Railway remains scraping-only.');
