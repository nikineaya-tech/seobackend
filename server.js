const express = require('express');
const fetch = require('node-fetch'); // npm install node-fetch

const app = express();
const PORT = process.env.PORT || 10000;

// Pour lire le JSON envoyé par le frontend
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

// Écouter sur 0.0.0.0 avec PORT (une seule fois)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
