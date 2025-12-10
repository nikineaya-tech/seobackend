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

app.listen(PORT, '127.0.0.1', () => {  // important: 127.0.0.1
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
