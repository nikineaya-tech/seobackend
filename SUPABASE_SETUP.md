# 🔑 Supabase Auth Setup — Daka Pro

## Variables d’environnement à ajouter sur Render

```
SUPABASE_URL         = https://etjwmqnbfsevlwaeixwb.supabase.co
SUPABASE_ANON_KEY    = [ton anon key — Supabase → Settings → API → anon public]
SUPABASE_SERVICE_KEY = [ton service_role key — Supabase → Settings → API → service_role]
FRONTEND_URL         = https://marketinsight.mktnstrategix.com/app
AUTH_REDIRECT_URL    = https://marketinsight.mktnstrategix.com/app
# Après activation du domaine personnalisé Supabase :
SUPABASE_PUBLIC_URL  = https://auth.da-ka.live
```

## Configuration URL Auth obligatoire

Dans Supabase Dashboard > Authentication > URL Configuration :

```text
Site URL:
https://marketinsight.mktnstrategix.com

Redirect URLs:
https://marketinsight.mktnstrategix.com
https://marketinsight.mktnstrategix.com/**
https://marketinsight.mktnstrategix.com/app
https://marketinsight.mktnstrategix.com/app/**
```

Supprimer `http://localhost:3000` des URLs de production. Sinon Supabase peut y
rediriger l'utilisateur lorsque l'URL demandée n'est pas autorisée.

## Ne jamais afficher le domaine technique Supabase

Pour que Google n'affiche plus `etjwmqnbfsevlwaeixwb.supabase.co`, activer un
domaine personnalisé Supabase, par exemple :

```text
auth.da-ka.live
```

Puis ajouter dans Google Cloud OAuth les deux callbacks pendant la migration :

```text
https://etjwmqnbfsevlwaeixwb.supabase.co/auth/v1/callback
https://auth.da-ka.live/auth/v1/callback
```

Après activation et validation, configurer sur Render :

```text
SUPABASE_PUBLIC_URL=https://auth.da-ka.live
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

Le frontend actif est déjà intégré dans `index.html`.
