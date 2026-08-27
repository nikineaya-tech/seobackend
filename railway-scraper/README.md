# Railway Scraper Service

This folder is the only folder that Railway should deploy.

## Rule

Railway is reserved for scraping and market-sensor collection jobs only.

It must not run:

- `../server.js`
- AI analysis routes
- pricing pipeline
- Supabase auth routes
- report routes
- frontend HTML or frontend patches

## Railway settings

Set Railway project settings like this:

```text
Root Directory: railway-scraper
Start Command: npm start
```

`npm start` runs:

```bash
node scraper-worker.js
```

## Allowed job types

The worker accepts scraping job types:

- `scrape`
- `scrape-url`
- `scrape_url`
- `deep-scrape`
- `deep_scrape`
- `product-scrape`
- `product_scrape`
- `page-scrape`
- `page_scrape`

It also accepts evidence-only market sensor jobs:

- `agent-reach`
- `agent_reach`
- `market-sensor`
- `market_sensor`

These jobs collect source evidence through the Agent Reach acquisition layer pattern. They do not run strategic analysis, pricing logic, auth routes, report rendering or frontend code. Any other job type is marked as skipped so business logic does not execute on Railway.

## Files in this service

- `scraper-worker.js` — Railway scraping and market-sensor queue worker
- `scraper-orchestrator.js` — standalone Playwright scraper
- `agent-reach-sensor.js` — evidence-only market sensor for Web/Jina-style pages, YouTube URLs and RSS feeds
- `package.json` — minimal Railway dependencies
- `.puppeteerrc.cjs` — browser cache config
- `env.example` — variable template without real secrets

## Health check

The worker exposes a JSON health endpoint on `PORT`.

Default:

```text
PORT=8080
```

## Required variables

Set real values in Railway Variables, not in Git:

```text
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

Optional:

```text
SCRAPER_TIMEOUT_MS
SCRAPER_MAX_EXTRA_PAGES
PLAYWRIGHT_BROWSERS_PATH
SCRAPE_DO_TOKEN
BROWSERLESS_API_TOKEN
SERPAPI_KEY
SERPER_API_KEY
AGENT_REACH_MARKET_SENSOR_ENABLED
AGENT_REACH_COMPETITOR_URLS
AGENT_REACH_SENSOR_TIMEOUT_MS
AGENT_REACH_MAX_URLS
AGENT_REACH_MAX_FEEDS
AGENT_REACH_FETCH_TIMEOUT_MS
```
