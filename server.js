const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  console.log('GET / reçu');
  res.send('SEO backend en ligne');
});

app.get('/api/health', (req, res) => {
  console.log('GET /api/health reçu');
  res.json({ status: 'ok', message: 'SEO backend minimal en ligne' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

