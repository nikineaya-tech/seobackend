# 🔑 Supabase Auth Setup — Daka Pro

## Variables d’environnement à ajouter sur Render

```
SUPABASE_URL         = https://etjwmqnbfsevlwaeixwb.supabase.co
SUPABASE_ANON_KEY    = [ton anon key — Supabase → Settings → API → anon public]
SUPABASE_SERVICE_KEY = [ton service_role key — Supabase → Settings → API → service_role]
FRONTEND_URL         = https://app.da-ka.live
```

## Routes disponibles

| Route | Méthode | Description |
|---|---|---|
| `/auth/health` | GET | Vérifie la config Supabase |
| `/auth/google/url` | GET | Retourne l’URL OAuth Google |
| `/auth/me` | GET | Infos utilisateur connecté (JWT requis) |

## Test rapide

```bash
# Vérifie la config
curl https://[TON_BACKEND].onrender.com/auth/health

# Obtenir l’URL Google OAuth
curl https://[TON_BACKEND].onrender.com/auth/google/url
```

## Integration frontend (index.html)

Ajoute dans ton `<head>` :
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

Voir `supabase-frontend-snippet.js` pour le code complet.

## Callback URL Google (Supabase)
```
https://etjwmqnbfsevlwaeixwb.supabase.co/auth/v1/callback
```
