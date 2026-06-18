'use strict';

/**
 * Daka Railway Funnel Section Raw Blocks Preload
 *
 * Purpose:
 * - Railway remains the factual scraper.
 * - It captures real visible page sections as structured raw blocks.
 * - Render/AI can then classify those blocks with Landing Page/CRO strategy.
 *
 * This preload is intentionally non-mutating: it does not rewrite files on disk.
 * It patches scraper-orchestrator.js at module compile time only.
 */

const Module = require('module');
const path = require('path');

const originalCompile = Module.prototype._compile;
const PATCH_MARKER = 'DAKA_LANDING_SECTION_RAW_BLOCKS_PATCH_V1';

Module.prototype._compile = function dakaLandingSectionCompile(content, filename) {
  try {
    if (shouldPatchFile(filename, content)) {
      content = patchScraperOrchestrator(content);
    }
  } catch (error) {
    console.warn('[LandingSectionPreload] Patch skipped:', error.message);
  }

  return originalCompile.call(this, content, filename);
};

function shouldPatchFile(filename, content) {
  if (!filename || typeof content !== 'string') return false;
  const normalized = filename.replace(/\\/g, '/');
  return normalized.endsWith('/railway-scraper/scraper-orchestrator.js') &&
    !content.includes(PATCH_MARKER) &&
    !content.includes('function extractLandingSectionRawBlocks(');
}

function patchScraperOrchestrator(source) {
  let patched = String(source || '');

  patched = insertExtractorHelpers(patched);
  patched = injectSectionExtractionCalls(patched);
  patched = injectSectionFieldsInPageResults(patched);
  patched = injectSummaryCounter(patched);

  console.log('[LandingSectionPreload] Railway sectionRawBlocks extraction enabled');
  return patched;
}

function insertExtractorHelpers(source) {
  const anchor = '// ─────────────────────────────────────────────────────────────\n// CHAPITRE 2 — Advanced discovery: links + clickable targets';
  if (!source.includes(anchor)) {
    console.warn('[LandingSectionPreload] Helper anchor not found');
    return source;
  }

  const helper = String.raw`
// ${PATCH_MARKER}
// ─────────────────────────────────────────────────────────────
// DAKA — Landing page raw section extraction
// Railway observes factual DOM blocks. Render/AI classifies strategy.
// ─────────────────────────────────────────────────────────────
function cleanSectionText(value = '', max = 900) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, max);
}

function classifyLandingRawBlock(raw = '') {
  const value = String(raw || '').toLowerCase();
  const rules = [
    { type: 'header', label: 'Header / navigation', rx: /header|navbar|nav|menu|logo|navigation/ },
    { type: 'hero', label: 'Hero', rx: /hero|banner|headline|main-title|above.?fold|intro|cover|accueil/ },
    { type: 'pricing', label: 'Prix', rx: /price|prix|tarif|pricing|amount|sale|promo|€|eur|mad|dh|dhs|درهم|د\.م|lyd|usd/ },
    { type: 'cta', label: 'CTA principal', rx: /acheter|commander|buy|add to cart|panier|checkout|contact|whatsapp|devis|réserver|reserver|cta|button|call to action/ },
    { type: 'benefits', label: 'Bénéfices', rx: /benefit|bénéfice|avantage|why|pourquoi|résultat|result|gain|facile|rapide|liberté|portable|sans fil/ },
    { type: 'features', label: 'Caractéristiques', rx: /feature|caractéristique|spec|spécification|technical|details|dimension|mah|watt|voltage|capacity|puissance/ },
    { type: 'gallery', label: 'Galerie / images', rx: /gallery|galerie|slider|carousel|image|photo|media|swiper/ },
    { type: 'video', label: 'Vidéo produit', rx: /video|youtube|vimeo|mp4|watch|player|reel/ },
    { type: 'reviews', label: 'Avis clients', rx: /avis|review|rating|stars|étoile|testimonial|customer|client|commentaire/ },
    { type: 'testimonials', label: 'Témoignages', rx: /témoignage|testimonial|case-study|case study|success story/ },
    { type: 'faq', label: 'FAQ', rx: /faq|question|réponse|answer|accordion|q&a|frequently|أسئلة/ },
    { type: 'delivery', label: 'Livraison', rx: /livraison|shipping|delivery|expédition|توصيل|délai|delay|entrega|envio/ },
    { type: 'guarantee', label: 'Garantie', rx: /garantie|warranty|refund|rembours|money back|satisfaction|ضمان/ },
    { type: 'returns', label: 'Retours', rx: /retour|return|exchange|refund|remboursement|devolución|devolucao/ },
    { type: 'trust', label: 'Badges de confiance', rx: /secure|sécurisé|ssl|paiement|payment|visa|mastercard|paypal|trust|badge|certified|certifié/ },
    { type: 'contact', label: 'WhatsApp / contact', rx: /whatsapp|contact|phone|tel|email|support|message|call/ },
    { type: 'form', label: 'Formulaire', rx: /form|input|submit|envoyer|email|name|message|field/ },
    { type: 'checkout', label: 'Checkout / panier', rx: /checkout|cart|panier|basket|payment|payer|order|commande/ },
    { type: 'comparison', label: 'Comparaison', rx: /compare|comparaison|versus|vs|avant après|before after/ },
    { type: 'urgency', label: 'Urgence / rareté', rx: /stock|limited|limité|rare|urgence|dernier|today|aujourd|reste|oferta limitada/ },
    { type: 'bonus', label: 'Bonus', rx: /bonus|cadeau|gratuit|free|offert|gift|regalo/ },
    { type: 'process', label: 'Comment ça marche', rx: /comment ça marche|how it works|process|étape|step|fonctionne|modo de uso/ },
    { type: 'objections', label: 'Objections', rx: /objection|risque|doute|peur|sécurité|garantie|faq|question|safe|seguro/ },
    { type: 'legal', label: 'Pages légales', rx: /privacy|terms|conditions|mentions|politique|legal|cookies|privacidade/ },
    { type: 'footer', label: 'Footer', rx: /footer|copyright|mentions légales|conditions générales/ },
    { type: 'social', label: 'Réseaux sociaux', rx: /facebook|instagram|tiktok|linkedin|youtube|social/ }
  ];
  return rules.find(rule => rule.rx.test(value)) || { type: 'content', label: 'Bloc contenu' };
}

function extractLandingSectionRawBlocks($, baseUrl = '') {
  const blocks = [];
  const seen = new Set();
  const selector = [
    'header',
    'main > section',
    'section',
    'article',
    'footer',
    '[role="banner"]',
    '[role="main"]',
    '[role="contentinfo"]',
    'div[id*="hero"]', 'div[class*="hero"]',
    'div[id*="faq"]', 'div[class*="faq"]',
    'div[id*="price"]', 'div[class*="price"]',
    'div[id*="pricing"]', 'div[class*="pricing"]',
    'div[id*="review"]', 'div[class*="review"]',
    'div[id*="testimonial"]', 'div[class*="testimonial"]',
    'div[id*="product"]', 'div[class*="product"]',
    'div[id*="feature"]', 'div[class*="feature"]',
    'div[id*="benefit"]', 'div[class*="benefit"]',
    'div[id*="guarantee"]', 'div[class*="guarantee"]',
    'div[id*="delivery"]', 'div[class*="delivery"]',
    'div[id*="shipping"]', 'div[class*="shipping"]',
    'div[id*="contact"]', 'div[class*="contact"]',
    'div[id*="checkout"]', 'div[class*="checkout"]',
    'div[id*="cart"]', 'div[class*="cart"]'
  ].join(',');

  $(selector).each((_, el) => {
    const $el = $(el);
    const tag = el.tagName ? el.tagName.toLowerCase() : 'div';
    const id = safeAttr($, el, 'id');
    const className = safeAttr($, el, 'class');
    const text = cleanSectionText($el.text(), 1200);
    const headings = $el.find('h1,h2,h3').map((__, h) => cleanSectionText($(h).text(), 180)).get().filter(Boolean).slice(0, 6);
    const paragraphs = $el.find('p,li').map((__, p) => cleanSectionText($(p).text(), 220)).get().filter(Boolean).slice(0, 10);
    const title = headings[0] || cleanSectionText($el.find('[class*="title"],[class*="heading"],[class*="headline"]').first().text(), 180);

    const ctas = [];
    $el.find('button,a,[role="button"],input[type="submit"],.btn,.button,[class*="btn"],[class*="button"]').each((__, ctaEl) => {
      const ctaText = cleanSectionText($(ctaEl).text() || safeAttr($, ctaEl, 'value') || safeAttr($, ctaEl, 'aria-label') || safeAttr($, ctaEl, 'title'), 140);
      if (!ctaText) return;
      const signal = (ctaText + ' ' + safeAttr($, ctaEl, 'class') + ' ' + safeAttr($, ctaEl, 'href')).toLowerCase();
      if (!/acheter|commander|buy|cart|panier|checkout|contact|whatsapp|devis|réserver|reserver|voir|découvrir|decouvrir|download|start|pricing|tarif|add to cart|order/.test(signal)) return;
      ctas.push({
        text: ctaText,
        href: absoluteUrl(safeAttr($, ctaEl, 'href'), baseUrl) || safeAttr($, ctaEl, 'href'),
        tag: ctaEl.tagName ? ctaEl.tagName.toLowerCase() : 'unknown'
      });
    });

    const links = [];
    $el.find('a[href]').each((__, linkEl) => {
      const href = safeAttr($, linkEl, 'href');
      const url = absoluteUrl(href, baseUrl) || href;
      const label = cleanSectionText($(linkEl).text() || safeAttr($, linkEl, 'aria-label') || safeAttr($, linkEl, 'title'), 140);
      if (!url || /^javascript:|^#/.test(url)) return;
      links.push({ url, label });
    });

    const images = [];
    $el.find('img').each((__, imgEl) => {
      const src = safeAttr($, imgEl, 'src') || safeAttr($, imgEl, 'data-src') || safeAttr($, imgEl, 'data-lazy-src') || safeAttr($, imgEl, 'data-original');
      const url = absoluteUrl(src, baseUrl);
      if (!url) return;
      images.push({ url, alt: cleanSectionText(safeAttr($, imgEl, 'alt'), 140) });
    });

    const forms = [];
    $el.find('form').each((__, formEl) => {
      const fields = [];
      $(formEl).find('input,textarea,select').each((___, fieldEl) => {
        fields.push({
          type: safeAttr($, fieldEl, 'type') || fieldEl.tagName?.toLowerCase() || 'input',
          name: safeAttr($, fieldEl, 'name'),
          placeholder: cleanSectionText(safeAttr($, fieldEl, 'placeholder'), 100)
        });
      });
      forms.push({ inputCount: fields.length, fields: fields.slice(0, 8) });
    });

    const prices = extractPrices(text).slice(0, 5);
    if (!text && !title && !ctas.length && !images.length && !links.length && !forms.length) return;

    const rawSignal = [tag, id, className, title, text, headings.join(' '), ctas.map(c => c.text).join(' ')].join(' ');
    const classified = classifyLandingRawBlock(rawSignal);
    const key = (classified.type + '|' + (title || '') + '|' + text.slice(0, 140)).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const trustSignals = {
      hasReviews: /avis|reviews?|rating|étoile|stars?|testimonial|témoignage/i.test(text),
      hasGuarantee: /garantie|rembours|refund|money back|warranty|ضمان/i.test(text),
      hasDelivery: /livraison|delivery|shipping|توصيل|entrega|envio/i.test(text),
      hasWhatsapp: /wa\.me|whatsapp/i.test(text + ' ' + links.map(l => l.url).join(' ')),
      hasPaymentSecurity: /ssl|secure|sécurisé|payment|paiement|visa|mastercard|paypal|stripe/i.test(text)
    };

    blocks.push({
      position: blocks.length + 1,
      tag,
      selector: [tag, id ? '#' + id : '', className ? '.' + String(className).split(/\s+/).slice(0, 2).join('.') : ''].join(''),
      id: id || null,
      className: cleanSectionText(className, 220) || null,
      visible: true,
      detectedType: classified.type,
      type: classified.type,
      label: classified.label,
      title: title || classified.label,
      headings,
      paragraphs,
      textPreview: text.slice(0, 420),
      wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
      ctas: ctas.slice(0, 8),
      prices,
      priceSignals: prices,
      images: images.slice(0, 8),
      links: links.slice(0, 10),
      forms: forms.slice(0, 3),
      trustSignals,
      rawEvidence: [
        title ? 'Titre détecté: ' + title : null,
        headings.length ? headings.length + ' heading(s)' : null,
        paragraphs.length ? paragraphs.length + ' paragraphe(s)' : null,
        ctas.length ? ctas.length + ' CTA' : null,
        prices.length ? prices.length + ' prix/signal prix' : null,
        images.length ? images.length + ' image(s)' : null,
        links.length ? links.length + ' lien(s)' : null
      ].filter(Boolean),
      extractionSource: 'railway-dom-section-scan',
      confidence: title || text || ctas.length ? 'HIGH' : 'MEDIUM'
    });
  });

  return blocks.slice(0, 50);
}

`;

  return source.replace(anchor, helper + anchor);
}

function injectSectionExtractionCalls(source) {
  return source.replace(
    /const paginationSignals = extractPaginationSignals\(\$, url\);/g,
    'const paginationSignals = extractPaginationSignals($, url);\n  const sectionRawBlocks = extractLandingSectionRawBlocks($, url);'
  );
}

function injectSectionFieldsInPageResults(source) {
  return source.replace(
    /(\n\s*faq,\n)(\s*cmsSignals,)/g,
    '$1    sectionRawBlocks,\n    sectionBlocks: sectionRawBlocks,\n    sectionsDetailed: sectionRawBlocks,\n$2'
  );
}

function injectSummaryCounter(source) {
  if (source.includes('sectionRawBlocksFound:')) return source;
  return source.replace(
    /(faqBlocksFound:\s*allPages\.reduce\(\(sum, page\) => sum \+ \(Array\.isArray\(page\?\.faq\?\.detectedBlocks\) \? page\.faq\.detectedBlocks\.length : 0\), 0\),)/,
    '$1\n        sectionRawBlocksFound: allPages.reduce((sum, page) => sum + (Array.isArray(page?.sectionRawBlocks) ? page.sectionRawBlocks.length : 0), 0),'
  );
}
