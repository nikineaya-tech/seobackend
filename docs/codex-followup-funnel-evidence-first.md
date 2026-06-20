# Codex follow-up - Funnel Evidence-First

Branch: fix/funnel-evidence-first

Objectif: corriger le parser de sections Funnel sans preload runtime et sans modification cachee du moteur.

## Principe directeur simple

Railway doit observer le site comme un vrai navigateur et envoyer a Render toutes les donnees factuelles. Render ne doit pas deviner depuis un fallback pauvre. Render doit donner ces donnees a un agent qui lit, classe, deduit le type de site, puis audite les sections.

Architecture cible:

1. Railway scrape le site.
2. Railway extrait les details reels: html, bodyText, headings, CTA, liens, images, prix, avis, FAQ, livraison, garantie, formulaires, badges, sections brutes.
3. Railway envoie un payload normalise a Render.
4. Render construit un evidenceIndex a partir de ce payload.
5. Un agent Render lit cet evidenceIndex.
6. L agent deduit le type: ecommerce, service, SaaS, formation, contenu, marketplace, autre.
7. L agent classe les donnees par sections.
8. L agent audite chaque section avec preuves reelles.
9. Le rapport final garde les anciens details Funnel et ajoute la cartographie sections.

## Mode lourd / mini scraping

Si une page est lourde ou si le scrape complet depasse le budget, utiliser un mode mini-scraping parallele:

- mini scrape homepage / landing principale
- mini scrape pricing ou produit
- mini scrape FAQ
- mini scrape reviews ou proof
- mini scrape checkout ou CTA
- mini scrape legal / footer

Ces mini scrapes peuvent etre lances en parallele avec limite de concurrence. Chaque mini scrape renvoie un fragment normalise. Render fusionne ensuite les fragments dans un seul evidenceIndex.

Regle: mieux vaut plusieurs fragments factuels courts qu un gros scrape vide ou tronque.

## Probleme observe

- Le parser declare parfois une preuve absente alors qu elle existe sur la page.
- Les preuves affichees sont trop generiques: signal garantie detecte, FAQ detectee, etc.
- La detection FR EN AR est insuffisante.
- La nouvelle analyse de sections ne doit pas remplacer les anciens details Funnel; elle doit etre additive.

## Regles

- Ne pas ajouter de node -r preload.
- Ne pas modifier package.json pour charger un patch runtime.
- Ne pas remplacer massivement index.html.
- Integrer la logique directement dans server.js et railway-scraper si necessaire.
- Ne jamais marquer missing si une preuve textuelle existe dans evidenceIndex.
- Si scrape partiel ou incertain, utiliser unconfirmed.

## Correction attendue

- Dans buildFunnelSectionSurgeryModel, construire un index de preuves depuis sectionsDetailed, sectionRawBlocks, copyIntel.pageSections, bodyText, fullTextSample, ctaList, socialProofs et priceIntel.
- Pour chaque section, decider a partir de preuves reelles.
- Si evidenceItems existe, ne jamais marquer la section missing.
- Si scrape incomplet, utiliser unconfirmed au lieu de missing.
- Ajouter evidenceItems avec text, source, type, selector, confidence.
- Garder les anciens champs et ajouter les nouveaux champs sans casser le rendu existant.
- Ajouter une fusion de preuves qui accepte les donnees issues de mini scrapes paralleles.

## Statuts attendus

- present: preuve forte.
- present_but_weak: preuve presente mais section faible.
- missing: scrape complet et aucune preuve.
- unconfirmed: scrape partiel ou preuve trop faible.

## Payload Railway attendu

Chaque section ou fragment doit garder les preuves, pas seulement un label:

- typeGuess
- selector
- position
- text
- textPreview
- headings
- buttons
- links
- images
- priceMentions
- trustMentions
- languageHints
- confidence

## Validation

- node --check server.js
- npm run check
- pas de preload runtime
- package.json doit rester node server.js
- les anciennes analyses Funnel restent visibles
- la cartographie des sections devient additive et fondee sur preuves reelles
- une section avec preuve reelle ne doit plus etre affichee comme absente

## Bilan pour reprise Codex

Le correctif doit etre applique en patch minimal, pas en refactor global. Le but est de rendre le parser Evidence-First et multilingue, puis de restaurer les details Funnel historiques si un rendu les a supprimes.

La bonne logique n est pas: IA devine les sections.
La bonne logique est: Railway observe, Render indexe les preuves, agent classe et audite.
