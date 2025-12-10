const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Route racine (optionnelle)
app.get('/', (req, res) => {
  console.log('GET / reçu');
  res.send('SEO backend en ligne');
});

// Healthcheck Render
app.get('/api/health', (req, res) => {
  console.log('GET /api/health reçu');
  res.json({ status: 'ok', message: 'SEO backend minimal en ligne' });
});

// NOUVELLE ROUTE SEO : proxy vers OpenRouter
app.post('/api/seo', async (req, res) => {
  try {
    const body = req.body;

    const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://seo.mktnstrategix.com',
        'X-Title': 'SEO Master IA'
      },
      body: JSON.stringify(body),
    });

    const data = await orResponse.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur SEO' });
  }
});

/**
 * ====== GOOGLE SEARCH CONSOLE ======
 * Variables utilisées :
 *  - GSC_CLIENT_ID
 *  - GSC_CLIENT_SECRET
 *  - GSC_REDIRECT_URI
 */

// 1) Générer l’URL OAuth pour connecter GSC
app.get('/api/gsc/auth-url', (req, res) => {
  const base = 'https://accounts.google.com/o/oauth2/v2/auth';

  const params = new URLSearchParams({
    client_id: process.env.GSC_CLIENT_ID,
    redirect_uri: process.env.GSC_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ')
  });

  res.json({ url: `${base}?${params.toString()}` });
});

// 2) Callback OAuth (Google redirige ici avec ?code=...)
app.get('/api/gsc/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing code');
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GSC_CLIENT_ID,
        client_secret: process.env.GSC_CLIENT_SECRET,
        redirect_uri: process.env.GSC_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();
    // TODO : stocker tokens.access_token et tokens.refresh_token en base pour l’utilisateur
    console.log('GSC tokens:', tokens);

    res.send('Compte Google Search Console connecté. Vous pouvez fermer cette fenêtre.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur lors de la récupération des tokens GSC');
  }
});

// 3) Récupérer les données Search Analytics (clics, impressions, positions)
app.post('/api/gsc/search-analytics', async (req, res) => {
  const { accessToken, siteUrl, startDate, endDate, rowLimit = 1000 } = req.body;

  if (!accessToken || !siteUrl || !startDate || !endDate) {
    return res.status(400).json({ error: 'accessToken, siteUrl, startDate, endDate requis' });
  }

  try {
    const gscResponse = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        siteUrl
      )}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['query', 'page'],
          rowLimit
        })
      }
    );

    const data = await gscResponse.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l’appel Search Console' });
  }
});

// Écouter sur 0.0.0.0 avec PORT (une seule fois)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
