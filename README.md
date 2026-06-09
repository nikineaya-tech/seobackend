# Daka SEO Backend

## Deployment boundaries

This repository contains both the main backend and an isolated Railway scraping service.

### Render / API backend

Deploy the repository root on Render or another API host.

Root files such as these belong to the API/backend side:

- `server.js`
- `funnel-commerce-engine.cjs`
- `pricing-pipeline-refactored-1.js`
- `pricing-fixes.js`
- `supabase-auth-routes.js`
- `supabase-report-routes.js`
- `supabase-middleware.js`

### Railway / scraping only

Railway must deploy only this folder:

```text
railway-scraper
```

Railway settings:

```text
Root Directory: railway-scraper
Start Command: npm start
```

Railway must not run `server.js`.

The Railway worker is intentionally limited to scraping job types and must not execute AI routes, pricing logic, auth routes, report routes, or frontend code.

### Frontend

Frontend files such as `index.html` and frontend patch scripts should be deployed on a frontend host such as Vercel, Netlify, GitHub Pages, or a static host.
