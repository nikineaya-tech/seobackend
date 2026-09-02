# Ads Campaign Optimizer API

`POST /api/analyze-campaigns` is a protected Daka endpoint. It imports campaign rows,
calculates metrics on the server, calculates product break-even economics, asks the Daka
AI layer for recommendations, and persists the result in the user's report history.

The request needs a Supabase access token:

```http
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

```json
{
  "platform": "meta",
  "language": "fr",
  "product": {
    "price": 299,
    "cogs": 75,
    "shipping": 35,
    "fees": 18,
    "returnRate": 12
  },
  "campaigns": [
    {
      "Campaign name": "UGC blackheads 01",
      "Amount spent": 400,
      "Impressions": 30000,
      "Link clicks": 530,
      "Purchases": 5,
      "Purchase conversion value": 1495
    }
  ]
}
```

`product` is mandatory for a reliable business decision. The response contains:

- `decision.verdict`: `CONTINUE_AND_SCALE`, `TEST_UNDER_CONDITIONS`, or `STOP_OR_REBUILD`
- `decision.reason` and `decision.nextAction`
- `decision.breakEvenRoas`, `decision.targetCpa`, observed CPA/ROAS, and estimated ad profit
- `campaignDecisions[]`: the same verdict logic applied to each imported campaign row
- campaign metrics calculated from imported rows, recommendations, and a saved Daka report.

The UI must not call OpenRouter and must not store an OpenRouter key. After parsing an Excel
file, it should send its `campaignData` to this endpoint along with the product economics.

## External frontend integration

The frontend can be hosted outside this backend. Include Supabase JS, XLSX, then the Daka
client helper:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="https://seobackend-f81n.onrender.com/assets/daka-ads-optimizer-client.js"></script>
```

Set the backend URL if your deployment URL changes:

```html
<script>
  window.DAKA_API_BASE_URL = 'https://seobackend-f81n.onrender.com';
</script>
```

Minimal HTML binding:

```html
<input type="file" data-daka-file accept=".csv,.xlsx,.xls">

<input data-daka-price placeholder="Prix de vente">
<input data-daka-cogs placeholder="Coût produit">
<input data-daka-shipping placeholder="Livraison">
<input data-daka-fees placeholder="Frais">
<input data-daka-return-rate placeholder="Retours %">
<input data-daka-target-cpa placeholder="CPA cible optionnel">

<select data-daka-platform>
  <option value="meta">Meta Ads</option>
  <option value="tiktok">TikTok Ads</option>
  <option value="google">Google Ads</option>
</select>

<button data-daka-login>Se connecter</button>
<button data-daka-analyze>Analyser</button>
<p data-daka-status></p>
<div data-daka-output></div>

<script>
  DakaAdsOptimizer.bindOptimizerUi();
</script>
```

Direct JS usage if the existing app already parses the file:

```js
const authClient = await DakaAdsOptimizer.createSupabaseAuthClient();

const result = await DakaAdsOptimizer.analyzeCampaigns({
  authClient,
  platform: 'meta',
  language: 'fr',
  product: {
    price: 299,
    cogs: 75,
    shipping: 35,
    fees: 18,
    returnRate: 12
  },
  campaigns: campaignData
});

document.querySelector('#decision').innerHTML =
  DakaAdsOptimizer.renderDecisionHtml(result);
```

For an external host, configure the backend environment with the exact frontend origins:

```bash
FRONTEND_ORIGINS=https://ton-domaine.com,https://www.ton-domaine.com
AUTH_REDIRECT_ORIGINS=https://ton-domaine.com,https://www.ton-domaine.com
```

Also add the frontend URL to Supabase Auth redirect allow-list.
