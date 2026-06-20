# Codex follow-up - Funnel Evidence-First

Branch: fix/funnel-evidence-first

Objectif: corriger le parser de sections Funnel sans preload runtime et sans modification cachée du moteur.

Probleme observe:
- Le parser declare parfois une preuve absente alors qu elle existe sur la page.
- Les preuves affichees sont trop generiques: signal garantie detecte, FAQ detectee, etc.
- La detection FR EN AR est insuffisante.
- La nouvelle analyse de sections ne doit pas remplacer les anciens details Funnel; elle doit etre additive.

Regles:
- Ne pas ajouter de node -r preload.
- Ne pas modifier package.json pour charger un patch runtime.
- Ne pas remplacer massivement index.html.
- Integrer la logique directement dans server.js et railway-scraper si necessaire.

Correction attendue:
- Dans buildFunnelSectionSurgeryModel, construire un index de preuves depuis sectionsDetailed, sectionRawBlocks, copyIntel.pageSections, bodyText, fullTextSample, ctaList, socialProofs et priceIntel.
- Pour chaque section, decider a partir de preuves reelles.
- Si evidenceItems existe, ne jamais marquer la section missing.
- Si scrape incomplet, utiliser unconfirmed au lieu de missing.
- Ajouter evidenceItems avec text, source, type, selector, confidence.
- Garder les anciens champs et ajouter les nouveaux champs sans casser le rendu existant.

Statuts attendus:
- present: preuve forte.
- present_but_weak: preuve presente mais section faible.
- missing: scrape complet et aucune preuve.
- unconfirmed: scrape partiel ou preuve trop faible.

Validation:
- node --check server.js
- npm run check
- pas de preload runtime
- package.json doit rester node server.js
- les anciennes analyses Funnel restent visibles
- la cartographie des sections devient additive et fondee sur preuves reelles.

Bilan pour reprise Codex:
Le correctif doit etre applique en patch minimal, pas en refactor global. Le but est de rendre le parser Evidence-First et multilingue, puis de restaurer les details Funnel historiques si un rendu les a supprimes.
