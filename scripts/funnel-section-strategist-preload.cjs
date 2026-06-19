'use strict';

/**
 * Daka Render Funnel Section Strategist Preload
 *
 * Render remains the business/AI/report layer. Railway captures raw DOM sections.
 * This preload enriches /api/analyze-funnel JSON responses with a deterministic
 * Landing Page Section Strategist model when Railway returns sectionRawBlocks.
 *
 * It is intentionally defensive:
 * - no full HTML handling
 * - no external API call
 * - no mutation of files on disk
 * - no changes to Competitors routes
 */

const express = require('express');

if (!global.__DAKA_FUNNEL_SECTION_STRATEGIST_PRELOAD__) {
  global.__DAKA_FUNNEL_SECTION_STRATEGIST_PRELOAD__ = true;
  patchExpressJson(express);
  console.log('[FunnelSectionStrategist] Render response enrichment enabled');
}

function patchExpressJson(expressModule) {
  const responseProto = expressModule?.response;
  if (!responseProto || responseProto.__dakaFunnelSectionStrategistPatched) return;

  const originalJson = responseProto.json;

  responseProto.json = function dakaFunnelSectionStrategistJson(body) {
    try {
      const req = this.req;
      const path = String(req?.originalUrl || req?.url || '');

      if (/\/api\/(analyze-funnel|funnel)\b/i.test(path)) {
        body = enrichFunnelResponse(body, req);
      }
    } catch (error) {
      console.warn('[FunnelSectionStrategist] Enrichment skipped:', error.message);
    }

    return originalJson.call(this, body);
  };

  responseProto.__dakaFunnelSectionStrategistPatched = true;
}

function enrichFunnelResponse(body, req) {
  if (!body || typeof body !== 'object') return body;

  const sectionRawBlocks = collectSectionRawBlocks(body);
  if (!sectionRawBlocks.length) return body;

  const url = pickFirstString(
    body.url,
    body.targetUrl,
    body.inputUrl,
    body.normalizedUrl,
    req?.body?.url,
    req?.body?.targetUrl,
    req?.query?.url
  );

  const priceIntel = body.priceIntel || body.pricingIntel || body.offer?.priceIntel || {};
  const offerType = inferOfferType({ body, sectionRawBlocks, priceIntel });
  const language = pickFirstString(body.language, body.lang, req?.body?.lang, req?.body?.language) || 'fr';
  const country = pickFirstString(body.country, req?.body?.country, req?.body?.geo) || null;

  const landingPageStrategyPayload = {
    version: 'landing-page-section-strategist-payload-v1',
    url: url || null,
    language,
    country,
    offerType,
    priceIntel: compactPriceIntel(priceIntel),
    pagesExplored: collectPagesExplored(body),
    sectionRawBlocks,
    globalSignals: buildGlobalSignals(body),
    agentInstruction: buildAgentInstruction(language)
  };

  const funnelSectionScanner = buildSectionSurgeryFromRawBlocks(landingPageStrategyPayload);

  body.landingPageStrategyPayload = landingPageStrategyPayload;
  body.funnelSectionScanner = funnelSectionScanner;
  body.sectionSurgery = mergeSurgery(body.sectionSurgery, funnelSectionScanner);
  body.funnelSectionSurgery = mergeSurgery(body.funnelSectionSurgery, funnelSectionScanner);

  if (body.spyReport && typeof body.spyReport === 'object') {
    body.spyReport.funnelSectionScanner = funnelSectionScanner;
    body.spyReport.funnelSectionSurgery = mergeSurgery(body.spyReport.funnelSectionSurgery, funnelSectionScanner);
  }

  return body;
}

function mergeSurgery(existing, scanner) {
  return {
    ...(existing && typeof existing === 'object' ? existing : {}),
    scanner,
    scannedSections: scanner.scannedSections,
    presentSections: scanner.presentSections,
    keepSections: scanner.keepSections,
    updateSections: scanner.updateSections,
    moveSections: scanner.moveSections,
    removeOrMergeSections: scanner.removeOrMergeSections,
    missingSections: scanner.missingSections,
    surgeryMatrix: scanner.surgeryMatrix,
    recommendedOrder: scanner.recommendedOrder,
    expertDiagnosis: scanner.expertDiagnosis
  };
}

function collectSectionRawBlocks(root) {
  const found = [];
  const seenObject = new WeakSet();
  const seenKey = new Set();

  function visit(node, depth) {
    if (!node || depth > 7) return;

    if (Array.isArray(node)) {
      if (looksLikeSectionBlockArray(node)) addBlocks(node);
      for (const item of node.slice(0, 80)) visit(item, depth + 1);
      return;
    }

    if (typeof node !== 'object') return;
    if (seenObject.has(node)) return;
    seenObject.add(node);

    for (const key of ['sectionRawBlocks', 'sectionBlocks', 'sectionsDetailed', 'rawSections', 'domSections']) {
      if (looksLikeSectionBlockArray(node[key])) addBlocks(node[key]);
    }

    for (const key of ['mainPage', 'page', 'scrape', 'scrapedData', 'railwayResult', 'data', 'result', 'spyReport', 'pages', 'extraPages']) {
      if (node[key]) visit(node[key], depth + 1);
    }
  }

  function addBlocks(blocks) {
    for (const block of blocks || []) {
      const normalized = normalizeRawBlock(block, found.length + 1);
      if (!normalized) continue;
      const key = [normalized.position, normalized.type, normalized.title, normalized.textPreview.slice(0, 90)].join('|').toLowerCase();
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      found.push(normalized);
      if (found.length >= 50) break;
    }
  }

  visit(root, 0);
  return found.slice(0, 50);
}

function looksLikeSectionBlockArray(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.slice(0, 6).some(item => item && typeof item === 'object' && (
    item.textPreview || item.paragraphs || item.headings || item.ctas || item.rawEvidence || item.detectedType || item.type || item.label
  ));
}

function normalizeRawBlock(block, fallbackPosition) {
  if (!block || typeof block !== 'object') return null;

  const title = compactText(block.title || block.heading || block.label || first(block.headings), 180);
  const paragraphs = arrayOfStrings(block.paragraphs || block.textBlocks || block.bullets).slice(0, 10).map(v => compactText(v, 240));
  const headings = arrayOfStrings(block.headings).slice(0, 8).map(v => compactText(v, 180));
  const textPreview = compactText(block.textPreview || block.text || block.content || paragraphs.join(' '), 500);

  if (!title && !textPreview && !headings.length && !paragraphs.length && !arrayLike(block.ctas).length && !arrayLike(block.images).length) {
    return null;
  }

  const classified = classifyBlockType([
    block.detectedType,
    block.type,
    block.label,
    block.id,
    block.className,
    title,
    headings.join(' '),
    textPreview,
    JSON.stringify(block.ctas || [])
  ].filter(Boolean).join(' '));

  return {
    position: Number(block.position || block.index || fallbackPosition) || fallbackPosition,
    tag: compactText(block.tag || 'section', 40),
    selector: compactText(block.selector || '', 220),
    id: compactText(block.id || '', 120) || null,
    className: compactText(block.className || '', 220) || null,
    visible: block.visible !== false,
    detectedType: classified.type,
    type: classified.type,
    label: classified.label,
    title: title || classified.label,
    headings,
    paragraphs,
    textPreview,
    wordCount: Number(block.wordCount || countWords(textPreview || paragraphs.join(' '))) || 0,
    ctas: normalizeSmallItems(block.ctas, ['text', 'label', 'href']).slice(0, 8),
    prices: normalizeSmallItems(block.prices || block.priceSignals, ['value', 'currency', 'context']).slice(0, 6),
    images: normalizeSmallItems(block.images, ['url', 'alt']).slice(0, 8),
    links: normalizeSmallItems(block.links, ['url', 'label']).slice(0, 10),
    forms: normalizeSmallItems(block.forms, ['inputCount', 'fields']).slice(0, 3),
    trustSignals: normalizeTrustSignals(block.trustSignals),
    rawEvidence: arrayOfStrings(block.rawEvidence || block.evidence).slice(0, 8).map(v => compactText(v, 220)),
    confidence: normalizeConfidence(block.confidence || 'MEDIUM')
  };
}

function buildSectionSurgeryFromRawBlocks(payload) {
  const blocks = payload.sectionRawBlocks || [];
  const presentSections = blocks.map(block => buildPresentSectionDecision(block, payload));
  const presentTypes = new Set(presentSections.map(s => s.detectedType));
  const expected = expectedSectionsForOffer(payload.offerType);

  const missingSections = expected
    .filter(item => !presentTypes.has(item.type))
    .map(item => ({
      sectionName: item.label,
      section: item.label,
      detectedType: item.type,
      type: item.type,
      present: false,
      evidenceFromRawBlock: 'Non détectée dans les sections accessibles',
      evidence: 'Non détectée dans les sections accessibles',
      decision: 'Ajouter',
      reason: item.reason,
      problem: item.reason,
      conversionImpact: item.impact,
      exactAction: item.action,
      action: item.action,
      priority: item.priority,
      confidence: 'MEDIUM'
    }));

  const keepSections = presentSections.filter(s => /^garder$/i.test(s.decision)).slice(0, 10);
  const updateSections = presentSections.filter(s => /mettre à jour/i.test(s.decision)).slice(0, 12);
  const moveSections = presentSections.filter(s => /déplacer|rapprocher/i.test(s.decision)).slice(0, 8);
  const removeOrMergeSections = presentSections.filter(s => /supprimer|fusionner/i.test(s.decision)).slice(0, 8);

  const surgeryMatrix = [...presentSections, ...missingSections].map(s => ({
    section: s.sectionName || s.section,
    type: s.detectedType || s.type,
    present: s.present ? 'Oui' : 'Non',
    position: s.position || null,
    currentState: s.currentState || s.reason,
    decision: s.decision,
    action: s.exactAction || s.action,
    priority: s.priority,
    confidence: s.confidence,
    evidence: s.evidenceFromRawBlock || s.evidence
  }));

  return {
    version: 'landing-page-section-strategist-v1',
    strategy: 'Railway observe raw DOM sections; Render classifies with landing-page strategy rules.',
    offerType: payload.offerType,
    scannedSections: presentSections,
    presentSections,
    keepSections,
    updateSections,
    moveSections,
    removeOrMergeSections,
    missingSections,
    surgeryMatrix,
    recommendedOrder: expected.map(item => item.label),
    expertDiagnosis: buildExpertDiagnosis({ presentSections, missingSections, payload })
  };
}

function buildPresentSectionDecision(block, payload) {
  const type = block.detectedType || block.type || 'content';
  const ctaCount = arrayLike(block.ctas).length;
  const priceCount = arrayLike(block.prices).length;
  const wordCount = Number(block.wordCount || 0);
  const evidence = buildEvidenceText(block);

  let decision = 'Garder';
  let currentState = 'Section observée et utile à la compréhension.';
  let reason = 'La section apporte un signal identifiable dans le parcours.';
  let impact = 'Améliore la compréhension de l’offre.';
  let action = 'Garder la section et vérifier sa clarté visuelle.';
  let priority = 'Moyenne';
  let confidence = block.confidence || 'MEDIUM';

  if (['hero', 'pricing', 'cta'].includes(type)) {
    decision = 'Mettre à jour';
    currentState = 'Section critique détectée.';
    reason = 'Cette section influence directement la première décision du visiteur.';
    impact = 'Impact direct sur le clic, la compréhension et la conversion.';
    action = 'Rendre promesse, prix/preuve et CTA visibles dans le même parcours immédiat.';
    priority = 'Haute';
    confidence = 'HIGH';
  } else if (['faq', 'delivery', 'guarantee', 'returns', 'reviews', 'testimonials', 'trust'].includes(type)) {
    decision = 'Déplacer / rapprocher';
    currentState = 'Section de réassurance détectée.';
    reason = 'Elle réduit les objections mais doit être proche du prix, du CTA ou de l’offre.';
    impact = 'Réduit le risque perçu avant achat ou prise de contact.';
    action = 'Garder la section et la rapprocher de l’offre, du prix ou du CTA final.';
    priority = 'Haute';
  } else if (type === 'content' && wordCount > 320 && ctaCount === 0 && priceCount === 0) {
    decision = 'Supprimer ou fusionner';
    currentState = 'Bloc long sans action claire.';
    reason = 'Le texte peut diluer le message et ralentir la décision.';
    impact = 'Réduit la surcharge cognitive et renforce la lisibilité.';
    action = 'Fusionner en 3 à 5 bullets orientés bénéfice, puis ajouter un CTA proche.';
    priority = 'Moyenne';
    confidence = 'MEDIUM';
  } else if (['header', 'footer', 'gallery', 'features', 'benefits', 'process', 'contact', 'form'].includes(type)) {
    decision = 'Garder';
    currentState = 'Section utile détectée.';
    reason = 'Elle structure la page ou soutient la conversion.';
    action = 'Garder, clarifier le titre et connecter au CTA principal.';
  }

  return {
    sectionName: block.label || block.title || type,
    section: block.label || block.title || type,
    detectedType: type,
    type,
    present: true,
    position: block.position || null,
    title: block.title || '',
    textPreview: block.textPreview || '',
    evidenceFromRawBlock: evidence,
    evidence,
    currentState,
    decision,
    reason,
    problem: reason,
    conversionImpact: impact,
    exactAction: action,
    action,
    priority,
    confidence: normalizeConfidence(confidence),
    ctas: block.ctas || [],
    prices: block.prices || [],
    images: block.images || [],
    links: block.links || []
  };
}

function buildEvidenceText(block) {
  const parts = [];
  if (block.title) parts.push(`Titre: ${block.title}`);
  if (block.headings?.length) parts.push(`${block.headings.length} titre(s)`);
  if (block.paragraphs?.length) parts.push(`${block.paragraphs.length} paragraphe(s)`);
  if (block.ctas?.length) parts.push(`${block.ctas.length} CTA`);
  if (block.prices?.length) parts.push(`${block.prices.length} signal prix`);
  if (block.images?.length) parts.push(`${block.images.length} image(s)`);
  if (block.links?.length) parts.push(`${block.links.length} lien(s)`);
  if (block.rawEvidence?.length) parts.push(block.rawEvidence.slice(0, 2).join(' | '));
  return parts.filter(Boolean).join(' | ') || 'Bloc observé dans les sections accessibles';
}

function expectedSectionsForOffer(offerType = 'generic') {
  const ecommerce = [
    ['header', 'Header / navigation', 'Orienter sans distraire.', 'Accélère la compréhension.', 'Simplifier la navigation et garder un CTA visible.', 'Moyenne'],
    ['hero', 'Hero', 'Première promesse indispensable.', 'Impact fort sur attention et clic.', 'Ajouter un hero avec promesse bénéfice + visuel + CTA.', 'Haute'],
    ['pricing', 'Prix', 'Le visiteur doit comprendre l’offre.', 'Réduit l’hésitation prix.', 'Afficher prix, devise, contenu de l’offre et réassurance.', 'Haute'],
    ['cta', 'CTA principal', 'Le prochain pas doit être évident.', 'Augmente le passage à l’action.', 'Ajouter un CTA clair et répété aux points clés.', 'Haute'],
    ['delivery', 'Livraison', 'Question clé avant achat.', 'Réduit l’incertitude logistique.', 'Ajouter délai, zone et conditions de livraison.', 'Haute'],
    ['guarantee', 'Garantie', 'Réduit le risque perçu.', 'Augmente la confiance.', 'Ajouter garantie ou politique de satisfaction.', 'Haute'],
    ['returns', 'Retours', 'Objection fréquente en e-commerce.', 'Réduit la peur de se tromper.', 'Ajouter conditions de retour simples.', 'Moyenne'],
    ['reviews', 'Avis clients', 'Preuve sociale nécessaire.', 'Renforce la crédibilité.', 'Ajouter avis vérifiables ou preuves réelles.', 'Haute'],
    ['faq', 'FAQ', 'Traiter les objections avant achat.', 'Réduit les abandons.', 'Ajouter FAQ proche de l’offre.', 'Moyenne'],
    ['trust', 'Paiement sécurisé / confiance', 'Rassurer au moment du paiement.', 'Réduit le risque perçu.', 'Ajouter badges paiement, support et preuves.', 'Haute'],
    ['footer', 'Footer légal', 'Crédibilité et conformité.', 'Rassure les visiteurs.', 'Ajouter liens légaux et contact.', 'Basse']
  ];

  const service = [
    ['hero', 'Hero', 'Clarifier le résultat promis.', 'Impact fort sur prise de contact.', 'Créer un hero avec résultat + CTA devis/appel.', 'Haute'],
    ['benefits', 'Bénéfices', 'Expliquer la valeur.', 'Rend l’offre concrète.', 'Lister 3 à 5 bénéfices orientés résultat.', 'Haute'],
    ['process', 'Process / comment ça marche', 'Rassurer sur le déroulement.', 'Réduit l’incertitude.', 'Ajouter étapes de travail.', 'Moyenne'],
    ['reviews', 'Cas clients / avis', 'Prouver la capacité.', 'Augmente la confiance.', 'Ajouter cas clients ou témoignages.', 'Haute'],
    ['faq', 'FAQ objections', 'Traiter les freins.', 'Augmente la prise de contact.', 'Ajouter FAQ avant CTA final.', 'Moyenne'],
    ['contact', 'Contact / formulaire', 'Permettre la conversion.', 'Impact direct sur leads.', 'Afficher formulaire ou contact visible.', 'Haute']
  ];

  const saas = [
    ['hero', 'Hero', 'Clarifier le bénéfice produit.', 'Impact fort sur activation.', 'Ajouter hero avec cas d’usage + CTA essai.', 'Haute'],
    ['features', 'Fonctionnalités', 'Montrer ce que fait l’outil.', 'Rend la valeur tangible.', 'Organiser fonctionnalités par cas d’usage.', 'Haute'],
    ['pricing', 'Pricing', 'Lever l’incertitude commerciale.', 'Améliore l’intention.', 'Afficher plans, trial et limites.', 'Haute'],
    ['trust', 'Sécurité / intégrations', 'Rassurer sur adoption.', 'Réduit les objections B2B.', 'Ajouter sécurité, intégrations et onboarding.', 'Moyenne'],
    ['faq', 'FAQ', 'Traiter objections SaaS.', 'Réduit friction.', 'Ajouter FAQ pricing, trial, support.', 'Moyenne'],
    ['cta', 'CTA principal', 'Pousser essai ou démo.', 'Impact direct.', 'CTA essai/démo visible et répété.', 'Haute']
  ];

  const generic = [
    ['hero', 'Hero', 'Première promesse nécessaire.', 'Impact sur compréhension.', 'Ajouter une promesse claire + CTA.', 'Haute'],
    ['benefits', 'Bénéfices', 'Clarifier la valeur.', 'Renforce la décision.', 'Ajouter 3 à 5 bénéfices.', 'Haute'],
    ['trust', 'Preuves de confiance', 'Rassurer.', 'Réduit le doute.', 'Ajouter preuves et garanties.', 'Haute'],
    ['faq', 'FAQ', 'Répondre aux objections.', 'Réduit friction.', 'Ajouter FAQ utile.', 'Moyenne'],
    ['cta', 'CTA principal', 'Guider l’action.', 'Impact direct.', 'Ajouter CTA clair.', 'Haute']
  ];

  const selected = offerType === 'saas' ? saas : offerType === 'service' ? service : offerType === 'ecommerce' ? ecommerce : generic;
  return selected.map(([type, label, reason, impact, action, priority]) => ({ type, label, reason, impact, action, priority }));
}

function inferOfferType({ body, sectionRawBlocks, priceIntel }) {
  const text = JSON.stringify({
    url: body.url || body.targetUrl,
    title: body.title || body.offer?.title,
    priceIntel,
    blocks: sectionRawBlocks.slice(0, 20).map(b => ({ type: b.type || b.detectedType, title: b.title, text: b.textPreview, ctas: b.ctas }))
  }).toLowerCase();

  if (/saas|software|logiciel|subscription|abonnement|trial|demo|api|dashboard/.test(text)) return 'saas';
  if (/formation|course|cours|module|programme|academy|webinar/.test(text)) return 'formation';
  if (/devis|consultation|service|agency|agence|réserver|rdv|appointment/.test(text) && !/add to cart|panier|checkout/.test(text)) return 'service';
  if (/price|prix|€|mad|dh|usd|lyd|acheter|commander|panier|checkout|add to cart|product|produit|livraison/.test(text)) return 'ecommerce';
  return 'generic';
}

function buildGlobalSignals(body) {
  return {
    h1: pickFirstString(body.h1, body.siteData?.h1, body.scrape?.h1, body.spyReport?.h1),
    title: pickFirstString(body.title, body.siteData?.title, body.scrape?.title, body.spyReport?.title),
    metaDescription: pickFirstString(body.metaDescription, body.siteData?.metaDescription, body.scrape?.metaDescription),
    ctas: findFirstArray(body, ['ctas', 'ctaList']).slice(0, 12),
    prices: findFirstArray(body, ['prices', 'priceCandidates']).slice(0, 12),
    images: findFirstArray(body, ['images']).slice(0, 12),
    faq: findFirstArray(body, ['faq', 'faqs']).slice(0, 8),
    trustSignals: body.trustSignals || body.scrape?.trustSignals || body.siteData?.trustSignals || {}
  };
}

function collectPagesExplored(body) {
  const pages = [];
  const arrays = [body.pages, body.extraPages, body.pagesExplored, body.railwayResult?.pages].filter(Array.isArray);
  for (const arr of arrays) {
    for (const page of arr.slice(0, 8)) {
      if (typeof page === 'string') pages.push({ url: page });
      else if (page && typeof page === 'object') pages.push({ url: page.url || page.normalizedUrl || '', title: page.title || '' });
    }
  }
  return pages.filter(p => p.url).slice(0, 8);
}

function buildExpertDiagnosis({ presentSections, missingSections, payload }) {
  const highMissing = missingSections.filter(s => s.priority === 'Haute').slice(0, 4);
  const highUpdates = presentSections.filter(s => s.priority === 'Haute' && /mettre|déplacer|rapprocher/i.test(s.decision)).slice(0, 4);

  return [
    {
      title: 'Lecture stratégique des sections Railway',
      observation: `${presentSections.length} section(s) réelle(s) remontée(s) par Railway et ${missingSections.length} section(s) critique(s) non détectée(s).`,
      impact: 'Le rapport peut maintenant distinguer sections observées et recommandations à construire.',
      action: 'Utiliser la matrice pour reconstruire la page dans l’ordre recommandé.',
      confidence: presentSections.length ? 'HIGH' : 'LOW'
    },
    ...highUpdates.map(s => ({
      title: `${s.sectionName} à optimiser`,
      observation: s.evidenceFromRawBlock,
      impact: s.conversionImpact,
      action: s.exactAction,
      confidence: s.confidence
    })),
    ...highMissing.map(s => ({
      title: `${s.sectionName} manquante`,
      observation: s.evidenceFromRawBlock,
      impact: s.conversionImpact,
      action: s.exactAction,
      confidence: s.confidence
    }))
  ].slice(0, 8);
}

function buildAgentInstruction(language = 'fr') {
  return `Tu es un expert Landing Page, CRO, UX, Website Strategy et Conversion. Tu reçois des sections brutes extraites par Railway. Ta mission est d'identifier le type réel de chaque section, décider quoi garder, mettre à jour, déplacer, supprimer/fusionner ou ajouter, puis produire une Section Surgery Matrix. Ne pas inventer une section présente si elle n'est pas dans sectionRawBlocks. Chaque conclusion doit citer evidenceFromRawBlock et avoir priority + confidence. Langue de sortie: ${language}.`;
}

function classifyBlockType(raw) {
  const value = String(raw || '').toLowerCase();
  const rules = [
    ['header', 'Header / navigation', /header|navbar|nav|menu|logo|navigation/],
    ['hero', 'Hero', /hero|banner|headline|main-title|above.?fold|intro|cover|accueil/],
    ['pricing', 'Prix', /price|prix|tarif|pricing|amount|sale|promo|€|eur|mad|dh|dhs|درهم|د\.م|lyd|usd/],
    ['cta', 'CTA principal', /acheter|commander|buy|add to cart|panier|checkout|contact|whatsapp|devis|réserver|reserver|cta|button|call to action/],
    ['benefits', 'Bénéfices', /benefit|bénéfice|avantage|why|pourquoi|résultat|result|gain|facile|rapide|liberté|portable|sans fil/],
    ['features', 'Caractéristiques', /feature|caractéristique|spec|spécification|technical|details|dimension|mah|watt|voltage|capacity|puissance/],
    ['gallery', 'Galerie / images', /gallery|galerie|slider|carousel|image|photo|media|swiper/],
    ['video', 'Vidéo produit', /video|youtube|vimeo|mp4|watch|player|reel/],
    ['reviews', 'Avis clients', /avis|review|rating|stars|étoile|testimonial|customer|client|commentaire/],
    ['testimonials', 'Témoignages', /témoignage|testimonial|case-study|case study|success story/],
    ['faq', 'FAQ', /faq|question|réponse|answer|accordion|q&a|frequently|أسئلة/],
    ['delivery', 'Livraison', /livraison|shipping|delivery|expédition|توصيل|délai|delay|entrega|envio/],
    ['guarantee', 'Garantie', /garantie|warranty|refund|rembours|money back|satisfaction|ضمان/],
    ['returns', 'Retours', /retour|return|exchange|refund|remboursement|devolución|devolucao/],
    ['trust', 'Badges de confiance', /secure|sécurisé|ssl|paiement|payment|visa|mastercard|paypal|trust|badge|certified|certifié/],
    ['contact', 'WhatsApp / contact', /whatsapp|contact|phone|tel|email|support|message|call/],
    ['form', 'Formulaire', /form|input|submit|envoyer|email|name|message|field/],
    ['checkout', 'Checkout / panier', /checkout|cart|panier|basket|payment|payer|order|commande/],
    ['comparison', 'Comparaison', /compare|comparaison|versus|vs|avant après|before after/],
    ['urgency', 'Urgence / rareté', /stock|limited|limité|rare|urgence|dernier|today|aujourd|reste|oferta limitada/],
    ['bonus', 'Bonus', /bonus|cadeau|gratuit|free|offert|gift|regalo/],
    ['process', 'Comment ça marche', /comment ça marche|how it works|process|étape|step|fonctionne|modo de uso/],
    ['objections', 'Objections', /objection|risque|doute|peur|sécurité|garantie|faq|question|safe|seguro/],
    ['legal', 'Pages légales', /privacy|terms|conditions|mentions|politique|legal|cookies|privacidade/],
    ['footer', 'Footer', /footer|copyright|mentions légales|conditions générales/],
    ['social', 'Réseaux sociaux', /facebook|instagram|tiktok|linkedin|youtube|social/]
  ];
  const found = rules.find(([, , rx]) => rx.test(value));
  return found ? { type: found[0], label: found[1] } : { type: 'content', label: 'Bloc contenu' };
}

function compactPriceIntel(value) {
  if (!value || typeof value !== 'object') return {};
  return {
    primaryPrice: value.primaryPrice || value.detectedPrice || value.price || null,
    currencyDetected: value.currencyDetected || value.currency || null,
    priceConfidence: value.priceConfidence || value.confidence || value.confidenceBand || null,
    priceEvidence: arrayLike(value.priceEvidence || value.evidence).slice(0, 5),
    priceExtractionReason: value.priceExtractionReason || value.reason || null,
    rejectedPriceCandidates: arrayLike(value.rejectedPriceCandidates).slice(0, 6)
  };
}

function normalizeSmallItems(value, preferredKeys = []) {
  return arrayLike(value).map(item => {
    if (!item || typeof item !== 'object') return { text: compactText(item, 180) };
    const out = {};
    for (const key of preferredKeys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== '') out[key] = item[key];
    }
    for (const key of ['text', 'label', 'title', 'url', 'href', 'context', 'value', 'currency']) {
      if (out[key] === undefined && item[key] !== undefined && item[key] !== null && item[key] !== '') out[key] = item[key];
    }
    return sanitizeObject(out, 240);
  }).filter(item => Object.keys(item).length > 0);
}

function sanitizeObject(obj, maxValueLength = 240) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (Array.isArray(value)) out[key] = value.slice(0, 8);
    else if (value && typeof value === 'object') out[key] = sanitizeObject(value, maxValueLength);
    else out[key] = typeof value === 'string' ? compactText(value, maxValueLength) : value;
  }
  return out;
}

function normalizeTrustSignals(value) {
  const trust = value && typeof value === 'object' ? value : {};
  return {
    hasReviews: Boolean(trust.hasReviews),
    hasGuarantee: Boolean(trust.hasGuarantee),
    hasDelivery: Boolean(trust.hasDelivery),
    hasWhatsapp: Boolean(trust.hasWhatsapp),
    hasPaymentSecurity: Boolean(trust.hasPaymentSecurity)
  };
}

function normalizeConfidence(value) {
  const v = String(value || '').toUpperCase();
  if (v === 'HIGH' || v === 'MEDIUM' || v === 'LOW') return v;
  return 'MEDIUM';
}

function findFirstArray(root, keys) {
  const seen = new WeakSet();
  let result = [];
  function visit(node, depth) {
    if (result.length || !node || depth > 5) return;
    if (Array.isArray(node)) return;
    if (typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    for (const key of keys) {
      if (Array.isArray(node[key])) {
        result = node[key];
        return;
      }
    }
    for (const key of ['data', 'result', 'scrape', 'siteData', 'spyReport', 'mainPage']) visit(node[key], depth + 1);
  }
  visit(root, 0);
  return result;
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function arrayLike(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function arrayOfStrings(value) {
  return arrayLike(value).map(item => typeof item === 'string' ? item : JSON.stringify(item || '')).filter(Boolean);
}

function compactText(value = '', max = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function countWords(value = '') {
  return String(value || '').split(/\s+/).filter(Boolean).length;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}
