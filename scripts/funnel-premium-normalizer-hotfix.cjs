'use strict';

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const marker = 'DAKA_FUNNEL_SURGERY_NORMALIZER_HOTFIX';

if (!fs.existsSync(indexPath)) process.exit(0);
let html = fs.readFileSync(indexPath, 'utf8');
if (html.includes(marker)) {
  console.log('[FunnelNormalizerHotfix] already present.');
  process.exit(0);
}

const patch = `
<!-- ${marker} -->
<script id="daka-funnel-surgery-normalizer-hotfix">
(function(){
  if (window.__DAKA_FUNNEL_SURGERY_NORMALIZER_HOTFIX__) return;
  window.__DAKA_FUNNEL_SURGERY_NORMALIZER_HOTFIX__ = true;

  const A = v => Array.isArray(v) ? v.filter(Boolean) : [];
  const S = v => (v == null ? '' : String(v)).trim();
  const clean = v => S(v).replace(/non identifié|non identifie|unknown|undefined|null/ig, '').trim();
  const hasUseful = v => clean(v).length > 1;
  const pick = (...v) => clean(v.find(hasUseful) || '');
  const textOf = obj => { try { return JSON.stringify(obj || {}).toLowerCase().slice(0, 90000); } catch { return ''; } };
  const uniq = arr => [...new Set(A(arr).map(clean).filter(hasUseful))].slice(0, 12);

  function item(section, present, decision, action, priority, confidence, state) {
    return { section, present: present ? 'Oui' : 'Non', currentState: state || (present ? 'Détectée' : 'Non détectée dans les pages accessibles'), decision, action, priority: priority || (present ? 'Moyenne' : 'Haute'), confidence: confidence || 'MEDIUM' };
  }

  function buildFunnelSurgery(data) {
    if (data && data.funnelSurgery && Array.isArray(data.funnelSurgery.surgeryMatrix) && data.funnelSurgery.surgeryMatrix.length) {
      return data.funnelSurgery;
    }

    const allText = textOf(data);
    const headings = uniq([
      ...(A(data?.rawIntel?.h1)), ...(A(data?.rawIntel?.headlines?.h1)),
      ...(A(data?.copyIntel?.headlines?.h1)), ...(A(data?.scrape?.copyIntel?.headlines?.h1)),
      data?.funnel?.attention?.headline, data?.copywritingDeep?.rewriteSuggestions?.newH1
    ]);
    const ctas = uniq([
      ...(A(data?.rawIntel?.ctas)), ...(A(data?.copyIntel?.realCTAs)), ...(A(data?.scrape?.copyIntel?.realCTAs)),
      data?.funnel?.action?.primaryCTA, data?.copywritingDeep?.rewriteSuggestions?.newCTA
    ].map(x => typeof x === 'object' ? (x.text || x.label || x.value) : x));

    const sectionHints = A(data?.rawIntel?.sectionsDetailed)
      .concat(A(data?.copyIntel?.pageSections), A(data?.scrape?.copyIntel?.pageSections), A(data?.pageArchitecture?.arborescence), A(data?.sections))
      .map((s, i) => ({
        section: pick(s.label, s.title, s.type, 'Section ' + (i + 1)),
        present: 'Oui',
        currentState: pick(s.state, s.status, s.textSample, 'Détectée'),
        decision: Number(s.score || 0) >= 75 ? 'Garder' : 'Améliorer',
        action: pick(s.action, s.upgradeCopy, s.weakness, s.conversionRole, 'Clarifier le rôle conversion et rapprocher preuve + CTA.'),
        priority: Number(s.score || 0) >= 75 ? 'Moyenne' : 'Haute',
        confidence: 'MEDIUM'
      }))
      .filter(x => hasUseful(x.section));

    const hasHero = headings.length > 0 || /hero|h1|headline|titre principal/.test(allText);
    const hasCTA = ctas.length > 0 || /commander|acheter|contact|whatsapp|devis|cta/.test(allText);
    const hasPrice = Boolean(data?.price || data?.priceIntel?.primaryPrice || data?.rawIntel?.price || data?.offerPriceValue?.price) || /prix|price|mad|eur|€|dh/.test(allText);
    const hasTrust = /avis|review|testimonial|témoignage|garantie|paiement sécurisé|ssl|whatsapp/.test(allText);
    const hasDelivery = /livraison|delivery|retour|refund|shipping/.test(allText);
    const hasFAQ = /faq|question|réponse|frequently/.test(allText);
    const hasMobile = /mobile|responsive|viewport|sticky/.test(allText);

    const matrix = [
      item('Hero / H1', hasHero, hasHero ? 'Améliorer' : 'Ajouter', hasHero ? 'Reformuler autour du bénéfice principal et ajouter une preuve visible.' : 'Créer un hero clair avec produit, promesse, preuve rapide et CTA.', 'Haute', headings.length ? 'HIGH' : 'MEDIUM', headings[0] || undefined),
      item('CTA principal', hasCTA, hasCTA ? 'Améliorer' : 'Ajouter', hasCTA ? 'Rendre le CTA plus direct et répéter près du prix.' : 'Ajouter un CTA principal visible au-dessus de la ligne de flottaison.', 'Haute', ctas.length ? 'HIGH' : 'MEDIUM', ctas[0] || undefined),
      item('Offre / Prix', hasPrice, hasPrice ? 'Améliorer' : 'Ajouter', hasPrice ? 'Clarifier devise, contenu reçu, garantie et conditions.' : 'Ajouter un bloc offre + prix + ce que le client reçoit.', 'Haute', data?.priceIntel?.confidenceBand || data?.priceIntel?.priceConfidence || 'MEDIUM'),
      item('Preuves et confiance', hasTrust, hasTrust ? 'Déplacer' : 'Ajouter', hasTrust ? 'Placer les preuves avant le CTA et autour du prix.' : 'Ajouter avis, garantie, paiement sécurisé, WhatsApp/adresse si disponibles.', 'Haute', 'MEDIUM'),
      item('Livraison / Retours / Garantie', hasDelivery, hasDelivery ? 'Améliorer' : 'Ajouter', hasDelivery ? 'Préciser délais, zones, frais, retours et garantie.' : 'Ajouter un bloc livraison claire + retours + garantie avant la FAQ.', 'Haute', 'MEDIUM'),
      item('FAQ avant achat', hasFAQ, hasFAQ ? 'Déplacer' : 'Ajouter', hasFAQ ? 'Remonter la FAQ près du prix pour traiter les objections.' : 'Ajouter une FAQ courte : livraison, paiement, garantie, utilisation, retours.', 'Moyenne', 'MEDIUM'),
      item('Expérience mobile', hasMobile, hasMobile ? 'Améliorer' : 'Ajouter', hasMobile ? 'Vérifier lisibilité, CTA sticky et longueur des blocs.' : 'Ajouter/valider un CTA sticky mobile et réduire les blocs longs.', 'Moyenne', 'LOW')
    ];

    const missing = matrix.filter(x => x.present === 'Non').map(x => ({ section: x.section, action: x.action, priority: x.priority, confidence: x.confidence }));
    const improve = matrix.filter(x => x.present === 'Oui' && x.decision !== 'Garder').map(x => ({ section: x.section, action: x.action, problem: x.currentState, priority: x.priority, confidence: x.confidence }));
    const keep = matrix.filter(x => x.present === 'Oui').slice(0, 4).map(x => ({ section: x.section, action: 'Garder, mais relier clairement à la conversion.', priority: 'Moyenne', confidence: x.confidence }));

    return {
      verdict: { section: 'Verdict Funnel', action: pick(data?.auditSummary?.verdict, data?.summary, 'Analyse structurée selon les signaux réellement observés.'), priority: 'Haute', confidence: 'MEDIUM' },
      offerDetected: { section: 'Offre détectée', action: pick(data?.projectIdentity?.niche, data?.projectIdentity?.siteType, data?.offer, data?.url, 'Offre à confirmer avec les données de la page.'), priority: 'Moyenne', confidence: 'MEDIUM' },
      sectionDiagnosis: { keep, improve, add: missing, removeOrMerge: [] },
      surgeryMatrix: sectionHints.length ? sectionHints.concat(matrix).slice(0, 32) : matrix,
      missingSections: missing,
      removeOrMergeSections: [],
      recommendedOrder: { recommendedOrder: ['Header simple','Hero avec promesse + CTA','Preuves rapides','Bénéfices principaux','Offre + prix + ce que vous recevez','Avis / preuves sociales','Livraison + retours + garantie','FAQ avant achat','CTA final','Footer légal'] },
      frictions: (A(data?.auditIssues).slice(0,5).map(x => ({ section: pick(x.title, x.section, 'Friction'), action: pick(x.recommendedFix, x.action, x.impact), priority: pick(x.severity, 'Haute'), confidence: pick(x.confidence, 'MEDIUM') }))).concat(missing.slice(0,3)),
      proofTrust: { present: keep.map(x => x.section), missing: missing.map(x => x.section) },
      offerPriceValue: { section: 'Offre, prix et valeur perçue', action: hasPrice ? 'Prix ou offre détecté : clarifier devise, garantie, livraison et contenu.' : 'Prix non confirmé : ajouter un bloc offre/prix vérifiable.', priority: 'Haute', confidence: data?.priceIntel?.confidenceBand || 'MEDIUM' },
      messagePromiseCta: { section: 'Message, promesse et CTA', action: 'H1 proposé : ' + pick(data?.copywritingDeep?.rewriteSuggestions?.newH1, headings[0], 'promesse claire orientée résultat') + ' · CTA : ' + pick(data?.copywritingDeep?.rewriteSuggestions?.newCTA, ctas[0], 'Commander maintenant'), priority: 'Haute', confidence: 'MEDIUM' },
      mobileUx: { risks: hasMobile ? ['Vérifier CTA sticky, lisibilité et longueur des sections.'] : ['CTA sticky mobile non confirmé', 'Lisibilité mobile à vérifier'] },
      priorityPlan: { now: missing.slice(0,3).map(x => ({ action: x.action })), sevenDays: improve.slice(0,3).map(x => ({ action: x.action })), thirtyDays: [{ action: 'Collecter preuves clients et tester un nouvel ordre de page.' }] },
      copyReadySections: { H1: pick(data?.copywritingDeep?.rewriteSuggestions?.newH1, headings[0], 'Promesse claire orientée bénéfice'), CTA: pick(data?.copywritingDeep?.rewriteSuggestions?.newCTA, ctas[0], 'Commander maintenant'), Microcopy: 'Livraison claire · Paiement sécurisé · Garantie disponible' },
      observedLimits: { section: 'Données observées et limites', action: 'Les mentions non détectées sont classées comme “Non détecté dans les pages accessibles”, pas comme fait absent définitif.' }
    };
  }

  function install() {
    if (typeof window.renderDakaFunnelPremium !== 'function' || window.renderDakaFunnelPremium.__normalizedHotfix) return false;
    const original = window.renderDakaFunnelPremium;
    window.renderDakaFunnelPremium = function(data) {
      try {
        if (data && (!data.funnelSurgery || !Array.isArray(data.funnelSurgery.surgeryMatrix) || !data.funnelSurgery.surgeryMatrix.length)) {
          data.funnelSurgery = buildFunnelSurgery(data);
        }
      } catch (e) { console.warn('[FunnelNormalizerHotfix]', e); }
      return original(data);
    };
    window.renderDakaFunnelPremium.__normalizedHotfix = true;
    return true;
  }

  const t = setInterval(() => { if (install()) clearInterval(t); }, 200);
  document.addEventListener('DOMContentLoaded', install);
})();
</script>`;

html = html.includes('</body>') ? html.replace('</body>', patch + '\n</body>') : html + patch;
fs.writeFileSync(indexPath, html, 'utf8');
console.log('[FunnelNormalizerHotfix] index.html patched: section surgery normalization fallback.');
