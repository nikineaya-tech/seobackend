'use strict';

const ANGLE_TYPES = {
  security_trust: {
    angleType: 'security',
    icon: 'fa-shield-halved',
    tone: '34,197,94',
    groups: ['risk', 'trust'],
    channels: ['SEO', 'comparison page', 'WhatsApp', 'reviews'],
    hooks: ['prove the result before asking for the sale', 'make risk and guarantees visible']
  },
  savings_budget: {
    angleType: 'saving',
    icon: 'fa-coins',
    tone: '245,158,11',
    groups: ['price', 'budget'],
    channels: ['SEO', 'price comparison', 'retargeting', 'offer page'],
    hooks: ['show total cost and savings clearly', 'make the low-risk entry offer obvious']
  },
  proof_outcome: {
    angleType: 'performance',
    icon: 'fa-circle-check',
    tone: '34,211,238',
    groups: ['proof', 'result'],
    channels: ['landing page', 'UGC', 'case study', 'demo video'],
    hooks: ['show the visible outcome', 'turn proof into the first screen']
  },
  comparison_alternative: {
    angleType: 'other',
    icon: 'fa-scale-balanced',
    tone: '139,92,246',
    groups: ['comparison', 'alternatives'],
    channels: ['SERP', 'comparison page', 'FAQ', 'search ads'],
    hooks: ['compare against the current alternatives', 'explain the difference without vague claims']
  },
  local_speed: {
    angleType: 'convenience',
    icon: 'fa-location-dot',
    tone: '59,130,246',
    groups: ['local', 'speed'],
    channels: ['local SEO', 'Maps', 'WhatsApp', 'local partnerships'],
    hooks: ['win with local availability and faster response', 'make delivery or access concrete']
  },
  expertise_method: {
    angleType: 'status',
    icon: 'fa-user-graduate',
    tone: '236,72,153',
    groups: ['expertise', 'method'],
    channels: ['LinkedIn', 'expert content', 'case study', 'direct outreach'],
    hooks: ['make the expert method visible', 'sell the process, not only the service']
  },
  convenience_comfort: {
    angleType: 'comfort',
    icon: 'fa-face-smile',
    tone: '20,184,166',
    groups: ['comfort', 'ease'],
    channels: ['social content', 'landing page', 'WhatsApp', 'email'],
    hooks: ['remove effort from the decision', 'make the easy path obvious']
  },
  reliability_risk: {
    angleType: 'reliability',
    icon: 'fa-triangle-exclamation',
    tone: '248,113,113',
    groups: ['reliability', 'risk'],
    channels: ['FAQ', 'reviews', 'technical proof', 'support'],
    hooks: ['reduce failure anxiety', 'show what happens if it does not work']
  },
  offgrid_autonomy: {
    angleType: 'off_grid',
    icon: 'fa-solar-panel',
    tone: '34,197,94',
    groups: ['autonomy', 'availability'],
    channels: ['SEO', 'community groups', 'marketplace', 'local demo'],
    hooks: ['sell autonomy where access is uncertain', 'show use without dependence on infrastructure']
  },
  installation_ease: {
    angleType: 'installation',
    icon: 'fa-screwdriver-wrench',
    tone: '34,211,238',
    groups: ['setup', 'ease'],
    channels: ['how-to content', 'video demo', 'FAQ', 'WhatsApp'],
    hooks: ['remove setup fear', 'show installation in simple steps']
  }
};

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-').slice(0, 80);
}

const TYPE_LABELS = {
  fr: {
    security_trust: 'Confiance et risque',
    savings_budget: 'Budget et valeur',
    proof_outcome: 'Preuve du resultat',
    comparison_alternative: 'Comparaison des alternatives',
    local_speed: 'Acces local rapide',
    expertise_method: 'Expertise et methode',
    convenience_comfort: 'Facilite et confort',
    reliability_risk: 'Fiabilite et garantie',
    offgrid_autonomy: 'Autonomie hors reseau',
    installation_ease: 'Installation simple'
  },
  en: {
    security_trust: 'Trust and risk',
    savings_budget: 'Budget and value',
    proof_outcome: 'Outcome proof',
    comparison_alternative: 'Alternative comparison',
    local_speed: 'Fast local access',
    expertise_method: 'Expertise and method',
    convenience_comfort: 'Ease and comfort',
    reliability_risk: 'Reliability and guarantee',
    offgrid_autonomy: 'Off-grid autonomy',
    installation_ease: 'Simple installation'
  },
  ar: {
    security_trust: 'الثقة وتقليل المخاطر',
    savings_budget: 'الميزانية والقيمة',
    proof_outcome: 'إثبات النتيجة',
    comparison_alternative: 'مقارنة البدائل',
    local_speed: 'وصول محلي سريع',
    expertise_method: 'الخبرة والمنهجية',
    convenience_comfort: 'السهولة والراحة',
    reliability_risk: 'الموثوقية والضمان',
    offgrid_autonomy: 'استقلالية خارج الشبكة',
    installation_ease: 'سهولة التركيب'
  }
};

function safeText(value, max = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeArray(value, max = 8) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  raw.flat(Infinity).forEach(item => {
    const text = typeof item === 'object' && item ? safeText(item.text || item.name || item.title || item.query || item.url || item.domain || item.snippet || '') : safeText(item);
    if (text && !out.some(x => normalizeText(x) === normalizeText(text))) out.push(text);
  });
  return out.slice(0, max);
}

function normalizeText(value) {
  return safeText(value, 500)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value) {
  const stop = new Set(['the', 'and', 'for', 'avec', 'pour', 'dans', 'les', 'des', 'une', 'على', 'عن', 'في', 'من', 'الى', 'إلى']);
  return new Set(normalizeText(value).split(' ').filter(t => t.length > 2 && !stop.has(t)));
}

function overlapScore(a, b) {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  aa.forEach(t => { if (bb.has(t)) overlap += 1; });
  return overlap / Math.min(aa.size, bb.size);
}

function localLabel(type, lang = 'fr') {
  const pack = TYPE_LABELS[lang] || TYPE_LABELS.fr;
  return pack[type] || TYPE_LABELS.fr[type] || type;
}

function localizeSubjectForLang(value = '', lang = 'fr') {
  const raw = safeText(value, 180);
  if (!raw || lang !== 'ar') return raw;
  if (/[\u0600-\u06FF]/.test(raw) && !/[a-zA-Z]/.test(raw)) return raw;
  let text = raw.toLowerCase();
  const replacements = [
    [/agence\s+marketing\s+ia|ai\s+marketing\s+agency/g, 'وكالة تسويق بالذكاء الاصطناعي'],
    [/projecteurs?\s+solaires?|solar\s+projectors?|solar\s+lights?/g, 'كشاف شمسي'],
    [/lampe\s+solaire|eclairage\s+solaire|éclairage\s+solaire/g, 'إضاءة شمسية'],
    [/logiciel|software|outil/g, 'برنامج'],
    [/competitors?|concurrents?/g, 'منافسين'],
    [/marketing/g, 'تسويق'],
    [/agency|agence/g, 'وكالة'],
    [/seo/g, 'تحسين محركات البحث'],
    [/blackheads?|points?\s+noirs?|الرؤوس السوداء/g, 'الرؤوس السوداء'],
    [/extratecteur|extracteur|extractor|remover|مستخرج/g, 'مزيل'],
    [/\bde\s+(?=الرؤوس السوداء)/g, '']
  ];
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text.replace(/\s+/g, ' ').trim() || raw;
}

function localizeMarketForLang(value = '', lang = 'fr') {
  const raw = safeText(value, 80);
  if (!raw || lang !== 'ar') return raw;
  const normalized = normalizeText(raw);
  const map = {
    morocco: 'المغرب',
    maroc: 'المغرب',
    ma: 'المغرب',
    libya: 'ليبيا',
    libye: 'ليبيا',
    ly: 'ليبيا',
    tunisia: 'تونس',
    tunisie: 'تونس',
    tn: 'تونس',
    algeria: 'الجزائر',
    algerie: 'الجزائر',
    dz: 'الجزائر',
    egypt: 'مصر',
    egypte: 'مصر',
    eg: 'مصر',
    saudi: 'السعودية',
    'saudi arabia': 'السعودية',
    uae: 'الإمارات',
    emirates: 'الإمارات',
    france: 'فرنسا',
    usa: 'الولايات المتحدة',
    'united states': 'الولايات المتحدة'
  };
  return map[normalized] || raw;
}

function localizePersonaNeed(value = '', { lang = 'fr', subject = '', angleType = '' } = {}) {
  const raw = safeText(value, 240);
  if (!raw || lang !== 'ar') return raw;
  const subjectText = safeText(subject, 120);
  const localized = localizeSubjectForLang(raw, lang);
  if (!/[a-zA-Z]/.test(localized)) return localized;
  const label = localLabel(angleType, lang);
  return subjectText
    ? `يريد ${subjectText} بزاوية ${label}`
    : `يريد حلا واضحا بزاوية ${label}`;
}

function localizedTrigger(type = 'proof_outcome', lang = 'fr') {
  const packs = {
    fr: {
      security_trust: 'Risque perçu ou garantie peu claire',
      savings_budget: 'Pression prix ou budget limité',
      proof_outcome: 'Besoin de voir le résultat avant de croire',
      comparison_alternative: 'Choix entre plusieurs alternatives',
      local_speed: 'Besoin de disponibilité locale ou de réponse rapide',
      expertise_method: 'Besoin d une méthode crédible',
      convenience_comfort: 'Besoin d un parcours simple',
      reliability_risk: 'Crainte de panne ou mauvais après-vente',
      offgrid_autonomy: 'Besoin d autonomie hors réseau',
      installation_ease: 'Crainte d installation compliquée'
    },
    en: {
      security_trust: 'Perceived risk or unclear guarantee',
      savings_budget: 'Price pressure or limited budget',
      proof_outcome: 'Need to see the outcome before believing',
      comparison_alternative: 'Choice between multiple alternatives',
      local_speed: 'Need for local availability or fast response',
      expertise_method: 'Need for a credible method',
      convenience_comfort: 'Need for a simple journey',
      reliability_risk: 'Fear of failure or poor after-sale support',
      offgrid_autonomy: 'Need for off-grid autonomy',
      installation_ease: 'Fear of complex installation'
    },
    ar: {
      security_trust: 'مخاطرة محسوسة أو ضمان غير واضح',
      savings_budget: 'ضغط السعر أو ميزانية محدودة',
      proof_outcome: 'الحاجة لرؤية النتيجة قبل تصديق الوعد',
      comparison_alternative: 'اختيار بين بدائل متعددة',
      local_speed: 'الحاجة إلى توفر محلي أو رد سريع',
      expertise_method: 'الحاجة إلى منهجية موثوقة',
      convenience_comfort: 'الحاجة إلى مسار بسيط',
      reliability_risk: 'الخوف من العطل أو ضعف ما بعد البيع',
      offgrid_autonomy: 'الحاجة إلى استقلالية خارج الشبكة',
      installation_ease: 'الخوف من تركيب معقد'
    }
  };
  return packs[lang]?.[type] || packs.fr[type] || packs.fr.proof_outcome;
}

function localizedProofNeeded(type = 'proof_outcome', lang = 'fr') {
  const packs = {
    fr: {
      security_trust: ['avis clients verifies', 'conditions de garantie', 'preuve de reception ou resultat visible'],
      savings_budget: ['prix final', 'frais inclus', 'conditions de paiement'],
      proof_outcome: ['demonstration reelle', 'avant/apres', 'cas client ou usage reel'],
      comparison_alternative: ['tableau comparatif', 'differences avec concurrents', 'criteres objectifs'],
      local_speed: ['zone de livraison', 'delai de reponse', 'contact local'],
      expertise_method: ['methode', 'cas client', 'preuves d expertise'],
      convenience_comfort: ['etapes simples', 'demo usage', 'process support'],
      reliability_risk: ['garantie', 'politique SAV', 'preuve technique'],
      offgrid_autonomy: ['autonomie mesuree', 'batterie ou capacite', 'cas usage reel'],
      installation_ease: ['etapes installation', 'video montage', 'contenu de la boite']
    },
    en: {
      security_trust: ['verified customer reviews', 'warranty terms', 'visible delivery or result proof'],
      savings_budget: ['final price', 'included fees', 'payment terms'],
      proof_outcome: ['real demonstration', 'before-after proof', 'customer or real-use case'],
      comparison_alternative: ['comparison table', 'competitor differences', 'objective criteria'],
      local_speed: ['delivery area', 'response time', 'local contact'],
      expertise_method: ['method', 'customer case', 'expert proof'],
      convenience_comfort: ['simple steps', 'usage demo', 'support process'],
      reliability_risk: ['warranty', 'support policy', 'technical proof'],
      offgrid_autonomy: ['measured autonomy', 'battery or capacity', 'real-use case'],
      installation_ease: ['installation steps', 'setup video', 'box contents']
    },
    ar: {
      security_trust: ['آراء عملاء موثقة', 'شروط ضمان واضحة', 'دليل استلام أو نتيجة مرئية'],
      savings_budget: ['السعر النهائي', 'ما يشمله السعر', 'شروط الدفع'],
      proof_outcome: ['تجربة حقيقية', 'قبل/بعد', 'حالة استخدام أو عميل حقيقي'],
      comparison_alternative: ['جدول مقارنة', 'الفروق مع المنافسين', 'معايير اختيار موضوعية'],
      local_speed: ['منطقة التوصيل', 'مدة الرد أو التوصيل', 'تواصل محلي واضح'],
      expertise_method: ['المنهجية', 'حالة عميل', 'دليل خبرة'],
      convenience_comfort: ['خطوات بسيطة', 'شرح الاستخدام', 'مسار الدعم'],
      reliability_risk: ['الضمان', 'سياسة ما بعد البيع', 'دليل تقني'],
      offgrid_autonomy: ['مدة استقلالية مقاسة', 'البطارية أو السعة', 'حالة استخدام واقعية'],
      installation_ease: ['خطوات التركيب', 'فيديو تركيب', 'محتويات العلبة']
    }
  };
  return packs[lang]?.[type] || packs.fr[type] || packs.fr.proof_outcome;
}

function localizedChannelName(value = '', lang = 'fr') {
  const raw = safeText(value, 90);
  if (!raw) return '';
  const normalized = normalizeText(raw);
  const maps = {
    fr: {
      seo: 'SEO',
      'local seo': 'SEO local',
      serp: 'SERP',
      maps: 'Google Maps',
      whatsapp: 'WhatsApp',
      reviews: 'Avis clients',
      ugc: 'UGC',
      faq: 'FAQ',
      'comparison page': 'Page comparative',
      'price comparison': 'Comparatif prix',
      'search ads': 'Search Ads',
      retargeting: 'Retargeting',
      'offer page': 'Page offre',
      'landing page': 'Landing page',
      marketplace: 'Marketplace',
      marketplaces: 'Marketplaces',
      'google shopping': 'Google Shopping',
      'meta ads': 'Meta Ads',
      content: 'Contenu',
      'case study': 'Cas client',
      'demo video': 'Video demo',
      support: 'Support',
      'technical proof': 'Preuve technique',
      'local partnerships': 'Partenariats locaux',
      'expert content': 'Contenu expert',
      'direct outreach': 'Prospection directe',
      'social content': 'Contenu social',
      email: 'Email',
      'community groups': 'Groupes communautaires',
      'local demo': 'Demo locale',
      'how to content': 'Tutoriel',
      'video demo': 'Video demo'
    },
    ar: {
      seo: 'تحسين محركات البحث',
      'local seo': 'تحسين البحث المحلي',
      serp: 'نتائج البحث',
      maps: 'خرائط Google',
      whatsapp: 'واتساب',
      reviews: 'آراء العملاء',
      ugc: 'محتوى العملاء',
      faq: 'الأسئلة الشائعة',
      'comparison page': 'صفحة مقارنة',
      'price comparison': 'مقارنة الأسعار',
      'search ads': 'إعلانات البحث',
      retargeting: 'إعادة الاستهداف',
      'offer page': 'صفحة العرض',
      'landing page': 'صفحة هبوط',
      marketplace: 'السوق الإلكتروني',
      marketplaces: 'الأسواق الإلكترونية',
      'google shopping': 'تسوق Google',
      'meta ads': 'إعلانات Meta',
      content: 'محتوى توضيحي',
      'case study': 'دراسة حالة',
      'demo video': 'فيديو توضيحي',
      support: 'الدعم',
      'technical proof': 'دليل تقني',
      'local partnerships': 'شراكات محلية',
      'expert content': 'محتوى خبرة',
      'direct outreach': 'تواصل مباشر',
      'social content': 'محتوى اجتماعي',
      email: 'البريد الإلكتروني',
      'community groups': 'مجموعات محلية',
      'local demo': 'تجربة محلية',
      'how to content': 'شرح عملي',
      'video demo': 'فيديو شرح'
    }
  };
  return maps[lang]?.[normalized] || raw;
}

function localizedHookText(value = '', lang = 'fr') {
  const raw = safeText(value, 220);
  if (!raw) return raw;
  const normalized = normalizeText(raw);
  const maps = {
    fr: {
      'prove the result before asking for the sale': 'prouver le resultat avant de demander l achat',
      'make risk and guarantees visible': 'rendre les risques et garanties visibles',
      'show total cost and savings clearly': 'montrer le cout total et l economie clairement',
      'make the low risk entry offer obvious': 'rendre l offre d entree faible risque evidente',
      'show the visible outcome': 'montrer le resultat visible',
      'turn proof into the first screen': 'mettre la preuve dans le premier ecran',
      'compare against the current alternatives': 'comparer avec les alternatives actuelles',
      'explain the difference without vague claims': 'expliquer la difference sans promesse vague',
      'win with local availability and faster response': 'gagner avec disponibilite locale et reponse rapide',
      'make delivery or access concrete': 'rendre livraison ou acces concret',
      'make the expert method visible': 'rendre la methode experte visible',
      'sell the process not only the service': 'vendre le processus, pas seulement le service',
      'remove effort from the decision': 'retirer l effort de la decision',
      'make the easy path obvious': 'rendre le chemin simple evident',
      'reduce failure anxiety': 'reduire la peur de l echec',
      'show what happens if it does not work': 'montrer ce qui se passe si cela ne marche pas',
      'sell autonomy where access is uncertain': 'vendre l autonomie quand l acces est incertain',
      'show use without dependence on infrastructure': 'montrer l usage sans dependance a l infrastructure',
      'remove setup fear': 'retirer la peur de l installation',
      'show installation in simple steps': 'montrer l installation en etapes simples'
    },
    ar: {
      'prove the result before asking for the sale': 'أثبت النتيجة قبل طلب الشراء',
      'make risk and guarantees visible': 'اجعل المخاطر والضمانات واضحة',
      'show total cost and savings clearly': 'أظهر التكلفة النهائية والتوفير بوضوح',
      'make the low risk entry offer obvious': 'اجعل عرض البداية منخفض المخاطر واضحا',
      'show the visible outcome': 'أظهر النتيجة المرئية',
      'turn proof into the first screen': 'اجعل الدليل في أول شاشة',
      'compare against the current alternatives': 'قارن بوضوح مع البدائل الموجودة',
      'explain the difference without vague claims': 'اشرح الفرق دون وعود غامضة',
      'win with local availability and faster response': 'اربح بالتوفر المحلي والرد الأسرع',
      'make delivery or access concrete': 'اجعل التوصيل أو الوصول محددا',
      'make the expert method visible': 'أظهر المنهجية الخبيرة',
      'sell the process not only the service': 'بع المنهج وليس الخدمة فقط',
      'remove effort from the decision': 'أزل الجهد من قرار الشراء',
      'make the easy path obvious': 'اجعل الطريق السهل واضحا',
      'reduce failure anxiety': 'خفف الخوف من الفشل',
      'show what happens if it does not work': 'وضح ماذا يحدث إذا لم يعمل المنتج',
      'sell autonomy where access is uncertain': 'بع الاستقلالية عندما يكون الوصول غير مضمون',
      'show use without dependence on infrastructure': 'أظهر الاستخدام دون الاعتماد على البنية التحتية',
      'remove setup fear': 'أزل خوف التركيب',
      'show installation in simple steps': 'أظهر التركيب بخطوات بسيطة'
    }
  };
  return maps[lang]?.[normalized] || raw;
}

function localizeVisibleArray(values = [], lang = 'fr', kind = 'detail', max = 6) {
  const mapper = kind === 'channel' ? localizedChannelName : localizedHookText;
  return safeArray(values, max * 2)
    .map(item => mapper(item, lang))
    .filter(Boolean)
    .slice(0, max);
}

function inferTypesFromText(value) {
  const text = normalizeText(value);
  const types = new Set();
  if (/trust|proof|preuve|avis|review|garantie|return|refund|ثقة|دليل|ضمان|استرجاع|مراجعة/.test(text)) types.add('security_trust');
  if (/price|prix|budget|cheap|cost|saving|econom|سعر|ميزانية|توفير|رخيص/.test(text)) types.add('savings_budget');
  if (/result|outcome|before after|demo|case|نتيجة|تجربة|قبل|بعد/.test(text)) types.add('proof_outcome');
  if (/compar|alternative|versus|vs|competitor|مقارنة|بديل|منافس/.test(text)) types.add('comparison_alternative');
  if (/local|near|delivery|maps|city|maroc|libya|tunisia|morocco|محلي|قريب|توصيل/.test(text)) types.add('local_speed');
  if (/expert|agency|b2b|method|consult|audit|خبير|وكالة|منهج|استشارة/.test(text)) types.add('expertise_method');
  if (/easy|simple|comfort|convenient|سهل|راحة|بسيط/.test(text)) types.add('convenience_comfort');
  if (/reliable|risk|failure|broken|maintenance|موثوق|عطل|خطر|صيانة/.test(text)) types.add('reliability_risk');
  if (/solar|solaire|projecteur|off.?grid|power|energy|شمسي|طاقة|كاشف|اضاءة/.test(text)) {
    types.add('offgrid_autonomy');
    types.add('installation_ease');
    types.add('reliability_risk');
  }
  return [...types];
}

function buildEvidenceCatalog({ query = '', segments = [], competitorData = {} } = {}) {
  const catalog = [];
  const push = (source, label, value) => {
    const text = safeText(value, 320);
    if (!text) return;
    catalog.push({ id: `ev_${catalog.length + 1}`, source, label: safeText(label, 80), text });
  };
  push('input', 'query', query);
  (segments || []).slice(0, 8).forEach(segment => {
    push('segment', segment.id || segment.name, `${segment.name || ''} ${segment.need || ''} ${safeArray(segment.buyingTriggers, 4).join(' ')}`);
  });
  (competitorData.top10Competitors || competitorData.competitors || []).slice(0, 10).forEach(c => {
    push('competitor', c.domain || c.displayed_link || c.title || c.url || c.link, `${c.title || ''} ${c.snippet || ''} ${c.url || c.link || ''}`);
  });
  const kw = competitorData.keywordStrategy || {};
  [...safeArray(kw.primary, 8), ...safeArray(kw.longTail, 8), ...safeArray(kw.questions, 8)].forEach(item => push('keyword', 'keyword', item));
  const insights = competitorData.marketInsights || {};
  ['painPoint', 'dominantOffer', 'mainRisk', 'winningCriteria'].forEach(key => push('market', key, insights[key]));
  const audit = competitorData.productServiceAudit || {};
  ['weakestProductFeature', 'killShotFeature', 'missingProof', 'risk'].forEach(key => push('product', key, audit[key]));
  return catalog;
}

function isWeakStpDetail(value = '') {
  const text = safeText(value, 500);
  if (!text) return true;
  const norm = normalizeText(text);
  if (!norm) return true;
  if (/^(null|undefined|nan|n a|na|none|empty|not available|non disponible|غير متوفر|لا يوجد|aucun|nothing|---|--|-)$/.test(norm)) return true;
  if (/^ev_\d+$/i.test(text)) return true;
  if (/^(proof|evidence|hook|channel|experiment|persona|angle|offer|market|result|demo|case|cta)$/i.test(text)) return true;
  if (/^(daka stp layer|same id from input|same or sharper angle name)$/i.test(norm)) return true;
  if (/^(clear offer proof|price or terms clarity|proof source or proof need|short evidence from input)$/i.test(norm)) return true;
  if (/^(دليل|القناة|الشخصية|العرض|السوق|hook|cta)$/i.test(text.trim())) return true;
  if (norm.split(' ').length <= 2 && norm.length < 15 && !/https?:|www\.|[0-9]/i.test(text)) return true;
  return false;
}

function detailQualityScore(value = '', context = {}) {
  const text = safeText(value, 700);
  if (isWeakStpDetail(text)) return 0;
  const norm = normalizeText(text);
  let score = 20;
  if (safeText(context.query) && overlapScore(text, context.query) >= 0.25) score += 18;
  if (safeText(context.market) && overlapScore(text, context.market) >= 0.4) score += 8;
  if (/(price|prix|سعر|guarantee|garantie|ضمان|delivery|livraison|توصيل|install|تركيب|battery|batterie|بطارية|review|avis|آراء|proof|preuve|دليل|compare|مقارنة|seo|whatsapp)/i.test(text)) score += 16;
  if (norm.split(' ').length >= 6) score += 14;
  if (/(verify|verifier|vérifier|تأكد|avant de promettre|قبل الوعد|without|sans|بدون)/i.test(text)) score += 10;
  if (/^(improve|améliorer|ameliorer|تحسين|make better|better solution|حل أفضل)/i.test(norm)) score -= 14;
  return Math.max(0, Math.min(100, score));
}

function cleanDetailArray(value, { max = 6, query = '', market = '' } = {}) {
  return safeArray(value, max * 3)
    .map(item => safeText(item, 240))
    .filter(item => detailQualityScore(item, { query, market }) >= 22)
    .slice(0, max);
}

function cleanChannelArray(value, max = 6) {
  return safeArray(value, max * 2)
    .map(item => safeText(item, 90))
    .filter(item => item && !/^(null|undefined|not available|non disponible|غير متوفر|experiment)$/i.test(item))
    .slice(0, max);
}

function cleanVisibleText(value = '', { query = '', market = '', minScore = 18 } = {}) {
  const text = safeText(value, 520);
  return detailQualityScore(text, { query, market }) >= minScore ? text : '';
}

function angleForPersonaDisplay(angle = {}, { lang = 'fr', query = '', market = '' } = {}) {
  if (!angle || typeof angle !== 'object') return null;
  const displayPromise = safeText(angle.corePromise || localizedHookText(angle.promise, lang) || angle.primaryBenefit || '', 220);
  const displayOutcome = safeText(angle.corePromise || angle.desiredOutcome || displayPromise, 220);
  const displayBenefit = safeText(angle.primaryBenefit && lang !== 'ar' ? angle.primaryBenefit : (angle.name || angle.label || displayPromise), 180);
  return {
    id: angle.id,
    slug: angle.slug,
    type: angle.type,
    angleType: angle.angleType,
    name: angle.name,
    label: angle.label,
    icon: angle.icon,
    tone: angle.tone,
    score: angle.score,
    opportunityScore: angle.opportunityScore,
    coreProblem: angle.coreProblem,
    context: angle.context,
    trigger: localizedTrigger(angle.type, lang) || angle.trigger,
    desiredOutcome: displayOutcome,
    primaryBenefit: displayBenefit,
    problem: angle.problem,
    jobToBeDone: angle.jobToBeDone,
    promise: displayPromise,
    proofNeeded: cleanDetailArray(angle.proofNeeded, { max: 5, query: query || angle.context || angle.jobToBeDone, market: market || angle.context }),
    hooks: cleanDetailArray(localizeVisibleArray(angle.hooks, lang, 'hook', 4), { max: 4, query: query || angle.context || angle.jobToBeDone, market: market || angle.context }),
    channels: cleanChannelArray(localizeVisibleArray(angle.channels, lang, 'channel', 6), 6),
    evidenceStatus: angle.evidenceStatus,
    productFamily: angle.productFamily,
    angleFormula: angle.angleFormula,
    corePromise: angle.corePromise,
    proofToShow: angle.proofToShow,
    objectionToNeutralize: angle.objectionToNeutralize,
    offerMove: angle.offerMove,
    channelFit: angle.channelFit,
    landingPageSection: angle.landingPageSection,
    hookExamples: cleanDetailArray(angle.hookExamples, { max: 4, query: query || angle.context || angle.jobToBeDone, market: market || angle.context }),
    antiHallucinationChecks: cleanDetailArray(angle.antiHallucinationChecks, { max: 5, query: query || angle.context || angle.jobToBeDone, market: market || angle.context }),
    specificityScore: angle.specificityScore,
    qualityWarnings: safeArray(angle.qualityWarnings, 3),
    isActionable: Boolean(angle.isActionable)
  };
}

function structuredAngleParts(type, { label = '', query = '', market = '', reason = '', lang = 'fr' } = {}) {
  const q = safeText(query || 'offer', 120);
  const place = market
    ? (lang === 'ar' ? ` في ${safeText(market, 80)}` : lang === 'fr' ? ` en ${safeText(market, 80)}` : ` in ${safeText(market, 80)}`)
    : '';
  const base = {
    coreProblem: safeText(reason || `${label} need around ${q}`, 180),
    context: safeText(`${q}${place}`, 160),
    trigger: 'active search or visible need',
    desiredOutcome: safeText(`solve ${label || type} without unnecessary risk`, 180),
    primaryBenefit: safeText(label || type, 120),
    emotionalDriver: 'clarity and confidence',
    proofNeeded: localizedProofNeeded(type, lang),
    keywords: safeArray([q, label], 5)
  };
  const byType = {
    security_trust: {
      trigger: 'fear of risk, loss, fraud or unclear guarantee',
      desiredOutcome: 'feel safe enough to act',
      primaryBenefit: 'lower perceived risk',
      emotionalDriver: 'reassurance',
      proofNeeded: localizedProofNeeded('security_trust', lang)
    },
    savings_budget: {
      trigger: 'price pressure or budget constraint',
      desiredOutcome: 'get the needed outcome at a controlled total cost',
      primaryBenefit: 'better value for money',
      emotionalDriver: 'control',
      proofNeeded: localizedProofNeeded('savings_budget', lang)
    },
    proof_outcome: {
      trigger: 'doubt that the product or service really works',
      desiredOutcome: 'see the outcome before committing',
      primaryBenefit: 'proof-led confidence',
      emotionalDriver: 'certainty',
      proofNeeded: localizedProofNeeded('proof_outcome', lang)
    },
    comparison_alternative: {
      trigger: 'choice between multiple alternatives',
      desiredOutcome: 'understand the best fit quickly',
      primaryBenefit: 'faster decision through comparison',
      emotionalDriver: 'avoid regret',
      proofNeeded: localizedProofNeeded('comparison_alternative', lang)
    },
    local_speed: {
      trigger: 'need for local access, delivery or response',
      desiredOutcome: 'get the solution locally and quickly',
      primaryBenefit: 'faster access',
      emotionalDriver: 'urgency relief',
      proofNeeded: localizedProofNeeded('local_speed', lang)
    },
    expertise_method: {
      trigger: 'need for a credible expert path',
      desiredOutcome: 'choose the provider with the clearest method',
      primaryBenefit: 'expert confidence',
      emotionalDriver: 'status and competence',
      proofNeeded: localizedProofNeeded('expertise_method', lang)
    },
    convenience_comfort: {
      trigger: 'friction, fatigue or desire for easier use',
      desiredOutcome: 'reach the result with less effort',
      primaryBenefit: 'simplicity',
      emotionalDriver: 'comfort',
      proofNeeded: localizedProofNeeded('convenience_comfort', lang)
    },
    reliability_risk: {
      trigger: 'fear of failure, breakdown or bad after-sale',
      desiredOutcome: 'trust the solution will keep working',
      primaryBenefit: 'reliability',
      emotionalDriver: 'peace of mind',
      proofNeeded: localizedProofNeeded('reliability_risk', lang)
    },
    offgrid_autonomy: {
      trigger: 'lack of grid access or unstable infrastructure',
      desiredOutcome: 'operate without dependency on the grid',
      primaryBenefit: 'autonomy',
      emotionalDriver: 'independence',
      proofNeeded: localizedProofNeeded('offgrid_autonomy', lang)
    },
    installation_ease: {
      trigger: 'fear of wiring, electrician cost or complex setup',
      desiredOutcome: 'install or start using without hassle',
      primaryBenefit: 'easy setup',
      emotionalDriver: 'relief',
      proofNeeded: localizedProofNeeded('installation_ease', lang)
    }
  };
  const merged = { ...base, ...(byType[type] || {}) };
  merged.proofNeeded = localizedProofNeeded(type, lang);
  return merged;
}

function makeAngle(type, { lang = 'fr', query = '', market = '', evidence = [], reason = '' } = {}) {
  const def = ANGLE_TYPES[type] || ANGLE_TYPES.proof_outcome;
  const label = localLabel(type, lang);
  const structured = structuredAngleParts(type, { label, query, market, reason, lang });
  const base = {
    id: `angle-${type}`,
    slug: slugify(`${type}-${label}`),
    type,
    angleType: def.angleType || 'other',
    name: label,
    label,
    coreProblem: structured.coreProblem,
    context: structured.context,
    trigger: structured.trigger,
    desiredOutcome: structured.desiredOutcome,
    primaryBenefit: structured.primaryBenefit,
    emotionalDriver: structured.emotionalDriver,
    problem: safeText(reason || `${label}: ${query}`, 220),
    jobToBeDone: safeText(`${label} - ${query}${market ? ` - ${market}` : ''}`, 220),
    promise: safeText((def.hooks || [])[0] || label, 180),
    proofNeeded: safeArray(structured.proofNeeded, 5),
    keywords: safeArray(structured.keywords, 8),
    hooks: localizeVisibleArray(def.hooks, lang, 'hook', 4),
    channels: localizeVisibleArray(def.channels, lang, 'channel', 5),
    tone: def.tone,
    icon: def.icon,
    evidenceIds: safeArray(evidence.map(e => e.id), 8),
    evidenceStatus: evidence.length ? 'observed_or_inferred' : 'hypothesis',
    confidence: evidence.length ? 0.72 : 0.48
  };
  return addUltimateAttackAngleBlueprint(base, { lang, query, market, evidence });
}

function detectProductFamily(query = '') {
  const text = normalizeText(query);
  if (/solar|solaire|projecteur|شمسي|طاقة|كشاف|اضاءة|إضاءة/.test(text)) return 'solar_lighting';
  if (/blackhead|comedon|points noirs|extracteur|extratecteur|مزيل|مستخرج|رؤوس سوداء|الرؤوس السوداء|beauty|skin|peau|بشرة/.test(text)) return 'beauty_skin';
  if (/saas|logiciel|software|crm|erp|outil|app|platform|منصة|برنامج|ادارة|إدارة/.test(text)) return 'software_saas';
  if (/agency|agence|marketing|consult|وكالة|تسويق|استشارة/.test(text)) return 'service_agency';
  if (/formation|course|coach|دورة|تكوين|تعلم|تعليم/.test(text)) return 'education';
  return 'general_offer';
}

function attackLangPack(lang = 'fr') {
  const packs = {
    fr: {
      formula: 'Persona + tension immediate + promesse specifique + preuve visible + risque retire + canal prioritaire',
      corePromise: 'Promesse coeur',
      proofToShow: 'Preuve a montrer',
      objection: 'Objection a neutraliser',
      offerMove: 'Mouvement offre',
      channelFit: 'Canal prioritaire',
      landingPageSection: 'Section landing a creer',
      checks: ['verifier le prix reel', 'verifier la disponibilite locale', 'verifier la garantie ou condition de retour', 'verifier que la preuve existe avant de promettre'],
      hooksPrefix: 'Hook',
      noProof: 'hypothese a valider'
    },
    en: {
      formula: 'Persona + urgent tension + specific promise + visible proof + removed risk + priority channel',
      corePromise: 'Core promise',
      proofToShow: 'Proof to show',
      objection: 'Objection to neutralize',
      offerMove: 'Offer move',
      channelFit: 'Priority channel',
      landingPageSection: 'Landing section to create',
      checks: ['verify real price', 'verify local availability', 'verify warranty or return terms', 'verify proof exists before promising'],
      hooksPrefix: 'Hook',
      noProof: 'hypothesis to validate'
    },
    ar: {
      formula: 'الشخصية + التوتر العاجل + وعد محدد + دليل مرئي + إزالة المخاطرة + القناة الأولى',
      corePromise: 'الوعد الأساسي',
      proofToShow: 'الدليل المطلوب إظهاره',
      objection: 'الاعتراض المطلوب كسره',
      offerMove: 'حركة العرض',
      channelFit: 'القناة الأولى',
      landingPageSection: 'قسم الهبوط المطلوب',
      checks: ['تأكد من السعر الحقيقي', 'تأكد من التوفر المحلي', 'تأكد من الضمان أو شروط الإرجاع', 'لا تعد بنتيجة قبل وجود دليل'],
      hooksPrefix: 'Hook',
      noProof: 'فرضية تحتاج تحقق'
    }
  };
  return packs[lang] || packs.fr;
}

function familyAngleTemplates(family = 'general_offer', lang = 'fr') {
  const q = attackLangPack(lang);
  const common = {
    security_trust: {
      corePromise: { fr: 'acheter sans zone grise', en: 'buy without unclear risk', ar: 'شراء بدون مخاطرة غامضة' },
      objection: { fr: 'peur de perdre de l argent ou de recevoir une offre differente', en: 'fear of losing money or receiving a different offer', ar: 'الخوف من خسارة المال أو استلام عرض مختلف' },
      offerMove: { fr: 'mettre garantie, retour, paiement et preuve avant le CTA', en: 'place guarantee, return, payment and proof before the CTA', ar: 'إظهار الضمان والإرجاع والدفع والدليل قبل زر الطلب' },
      landingPageSection: { fr: 'Bloc confiance avant commande', en: 'Trust block before checkout', ar: 'قسم الثقة قبل الطلب' }
    },
    savings_budget: {
      corePromise: { fr: 'obtenir le resultat avec un cout total clair', en: 'get the outcome with clear total cost', ar: 'الحصول على النتيجة بتكلفة واضحة' },
      objection: { fr: 'prix final, frais caches ou valeur pas claire', en: 'final price, hidden fees or unclear value', ar: 'السعر النهائي أو المصاريف الخفية أو قيمة غير واضحة' },
      offerMove: { fr: 'afficher prix final, inclusions, comparaison et option budget', en: 'show final price, inclusions, comparison and budget option', ar: 'إظهار السعر النهائي وما يشمله والمقارنة وخيار مناسب للميزانية' },
      landingPageSection: { fr: 'Comparatif valeur/prix', en: 'Value/price comparison', ar: 'مقارنة القيمة والسعر' }
    },
    proof_outcome: {
      corePromise: { fr: 'voir le resultat avant de croire la promesse', en: 'see the outcome before trusting the claim', ar: 'رؤية النتيجة قبل تصديق الوعد' },
      objection: { fr: 'doute que l offre fonctionne vraiment', en: 'doubt that the offer really works', ar: 'الشك في أن العرض يحقق النتيجة فعلا' },
      offerMove: { fr: 'ouvrir avec demonstration, avant/apres, cas ou preuve client', en: 'lead with demo, before/after, case or customer proof', ar: 'ابدأ بعرض توضيحي أو قبل/بعد أو حالة عميل' },
      landingPageSection: { fr: 'Preuve de resultat en premier ecran', en: 'Outcome proof in first screen', ar: 'دليل النتيجة في الشاشة الأولى' }
    },
    comparison_alternative: {
      corePromise: { fr: 'choisir vite entre les alternatives sans regret', en: 'choose fast between alternatives without regret', ar: 'اختيار البديل الأنسب بسرعة وبدون ندم' },
      objection: { fr: 'ne pas comprendre pourquoi cette option est meilleure', en: 'not understanding why this option is better', ar: 'عدم فهم لماذا هذا الخيار أفضل' },
      offerMove: { fr: 'creer une comparaison honnete criteres/prix/preuves', en: 'create an honest criteria/price/proof comparison', ar: 'إنشاء مقارنة واضحة بين المعايير والسعر والأدلة' },
      landingPageSection: { fr: 'Tableau comparatif', en: 'Comparison table', ar: 'جدول مقارنة' }
    },
    local_speed: {
      corePromise: { fr: 'resoudre le besoin localement et plus vite', en: 'solve the need locally and faster', ar: 'حل الحاجة محليا وبسرعة أكبر' },
      objection: { fr: 'delai, livraison, support ou disponibilite incertains', en: 'unclear delay, delivery, support or availability', ar: 'غموض مدة التوصيل أو الدعم أو التوفر' },
      offerMove: { fr: 'montrer zone servie, delai, contact local et suivi', en: 'show served area, delay, local contact and follow-up', ar: 'إظهار المنطقة والمدة والتواصل المحلي والمتابعة' },
      landingPageSection: { fr: 'Disponibilite locale', en: 'Local availability', ar: 'التوفر المحلي' }
    },
    expertise_method: {
      corePromise: { fr: 'choisir une methode claire, pas une promesse vague', en: 'choose a clear method, not a vague promise', ar: 'اختيار منهج واضح وليس وعدا غامضا' },
      objection: { fr: 'expertise non prouvee ou methode floue', en: 'unproven expertise or unclear method', ar: 'خبرة غير مثبتة أو منهجية غير واضحة' },
      offerMove: { fr: 'packager methode, etapes, livrables et cas', en: 'package method, steps, deliverables and cases', ar: 'تغليف المنهج والخطوات والمخرجات والحالات' },
      landingPageSection: { fr: 'Methode et livrables', en: 'Method and deliverables', ar: 'المنهج والمخرجات' }
    },
    convenience_comfort: {
      corePromise: { fr: 'obtenir le resultat sans complexite', en: 'get the result without complexity', ar: 'تحقيق النتيجة بدون تعقيد' },
      objection: { fr: 'peur que ce soit complique ou fatigant', en: 'fear that it is complex or tiring', ar: 'الخوف من التعقيد أو التعب' },
      offerMove: { fr: 'simplifier le parcours en 3 etapes visibles', en: 'simplify the journey into 3 visible steps', ar: 'تبسيط الرحلة في 3 خطوات واضحة' },
      landingPageSection: { fr: 'Comment ca marche', en: 'How it works', ar: 'كيف يعمل' }
    },
    reliability_risk: {
      corePromise: { fr: 'eviter la panne, le mauvais choix et le silence apres achat', en: 'avoid failure, wrong choice and silence after purchase', ar: 'تجنب العطل والاختيار الخاطئ وغياب الدعم بعد الشراء' },
      objection: { fr: 'produit fragile, support absent ou garantie floue', en: 'fragile product, missing support or vague warranty', ar: 'منتج غير موثوق أو دعم غائب أو ضمان غامض' },
      offerMove: { fr: 'mettre garanties, SAV, specifications et limites visibles', en: 'show guarantees, support, specs and limits', ar: 'إظهار الضمان والدعم والمواصفات والحدود' },
      landingPageSection: { fr: 'Garantie et limites', en: 'Warranty and limits', ar: 'الضمان والحدود' }
    },
    offgrid_autonomy: {
      corePromise: { fr: 'avoir de la lumiere sans dependance au reseau', en: 'get light without depending on the grid', ar: 'الحصول على إضاءة دون الاعتماد على الكهرباء' },
      objection: { fr: 'autonomie, batterie ou performance solaire incertaines', en: 'unclear autonomy, battery or solar performance', ar: 'غموض الاستقلالية أو البطارية أو الأداء الشمسي' },
      offerMove: { fr: 'prouver autonomie, zones d usage et conditions reelles', en: 'prove autonomy, use areas and real conditions', ar: 'إثبات الاستقلالية ومناطق الاستخدام والظروف الحقيقية' },
      landingPageSection: { fr: 'Test autonomie en conditions reelles', en: 'Real autonomy test', ar: 'اختبار الاستقلالية في ظروف حقيقية' }
    },
    installation_ease: {
      corePromise: { fr: 'installer rapidement sans technicien ni stress', en: 'install quickly without technician or stress', ar: 'تركيب سريع بدون تقني وبدون توتر' },
      objection: { fr: 'cablage, outils, fixation ou notice peu claire', en: 'wiring, tools, mounting or unclear guide', ar: 'الخوف من الأسلاك أو الأدوات أو طريقة التركيب' },
      offerMove: { fr: 'filmer installation, contenu boite et temps reel', en: 'show installation, box contents and real time needed', ar: 'عرض التركيب ومحتويات العلبة والمدة الحقيقية' },
      landingPageSection: { fr: 'Installation en 3 minutes', en: '3-minute installation', ar: 'التركيب في 3 دقائق' }
    }
  };
  const familyBoost = {
    solar_lighting: {
      proof_outcome: { proof: { fr: 'video nuit avant/apres, distance eclairee et mode detecteur', en: 'night before/after video, lit distance and sensor mode', ar: 'فيديو ليلي قبل/بعد ومسافة الإضاءة ووضع الحساس' } },
      reliability_risk: { proof: { fr: 'indice etancheite, batterie, garantie et test pluie', en: 'waterproof rating, battery, warranty and rain test', ar: 'درجة مقاومة الماء والبطارية والضمان وتجربة المطر' } },
      offgrid_autonomy: { proof: { fr: 'duree d eclairage, temps de charge solaire et scenario sans prise', en: 'lighting duration, solar charging time and no-plug use case', ar: 'مدة الإضاءة ووقت الشحن الشمسي وسيناريو بدون مقبس' } },
      installation_ease: { proof: { fr: 'video montage mur/jardin avec outils inclus', en: 'wall/garden setup video with included tools', ar: 'فيديو تركيب على الحائط أو الحديقة مع الأدوات' } }
    },
    beauty_skin: {
      proof_outcome: { proof: { fr: 'demo sur peau reelle, avant/apres et avis verifie', en: 'real-skin demo, before/after and verified review', ar: 'تجربة على بشرة حقيقية وقبل/بعد ورأي موثق' } },
      security_trust: { proof: { fr: 'mode d emploi, precautions, retour et hygiene', en: 'instructions, precautions, return and hygiene', ar: 'طريقة الاستعمال والاحتياطات والإرجاع والنظافة' } },
      local_speed: { proof: { fr: 'zone livree, delai annonce et contact local', en: 'served area, announced delivery time and local contact', ar: 'منطقة التوصيل ومدة التسليم والتواصل المحلي' } },
      comparison_alternative: { proof: { fr: 'tableau usage/prix/garantie contre alternatives', en: 'usage/price/warranty table against alternatives', ar: 'جدول يقارن طريقة الاستخدام والسعر والضمان مع البدائل' } },
      savings_budget: { proof: { fr: 'prix final, contenu du pack et frais inclus', en: 'final price, pack contents and included fees', ar: 'السعر النهائي ومحتوى العرض وما يشمله' } },
      reliability_risk: { proof: { fr: 'precautions peau, garantie et politique retour', en: 'skin precautions, warranty and return policy', ar: 'احتياطات البشرة والضمان وسياسة الإرجاع' } },
      convenience_comfort: { proof: { fr: 'mode usage court, etapes et hygiene apres usage', en: 'short usage guide, steps and post-use hygiene', ar: 'شرح استعمال قصير وخطوات واضحة ونظافة بعد الاستخدام' } }
    },
    software_saas: {
      proof_outcome: { proof: { fr: 'capture demo, workflow reel et resultat mesurable', en: 'demo screen, real workflow and measurable result', ar: 'لقطة ديمو وسير عمل حقيقي ونتيجة قابلة للقياس' } },
      expertise_method: { proof: { fr: 'process, templates, integrations et cas client', en: 'process, templates, integrations and customer case', ar: 'العملية والقوالب والتكاملات وحالة عميل' } }
    },
    service_agency: {
      expertise_method: { proof: { fr: 'audit exemple, methode, livrables et preuve de croissance', en: 'sample audit, method, deliverables and growth proof', ar: 'مثال تدقيق ومنهج ومخرجات ودليل نمو' } },
      comparison_alternative: { proof: { fr: 'comparatif agence/freelance/interne avec livrables', en: 'agency/freelance/in-house comparison with deliverables', ar: 'مقارنة وكالة/مستقل/داخلي مع المخرجات' } }
    }
  };
  const pack = { ...common };
  Object.entries(familyBoost[family] || {}).forEach(([type, extra]) => {
    pack[type] = { ...(pack[type] || {}), ...extra };
  });
  Object.keys(pack).forEach(type => {
    const item = pack[type];
    item.corePromise = item.corePromise?.[lang] || item.corePromise?.fr || item.corePromise || q.noProof;
    item.objection = item.objection?.[lang] || item.objection?.fr || item.objection || q.noProof;
    item.offerMove = item.offerMove?.[lang] || item.offerMove?.fr || item.offerMove || q.noProof;
    item.landingPageSection = item.landingPageSection?.[lang] || item.landingPageSection?.fr || item.landingPageSection || q.noProof;
    item.proof = item.proof?.[lang] || item.proof?.fr || item.proof || '';
  });
  return pack;
}

function buildHookExamples(angle = {}, { lang = 'fr', query = '', market = '', template = {} } = {}) {
  const subject = safeText(query || angle.context || 'offer', 120);
  const place = safeText(market, 80);
  if (lang === 'ar') {
    return safeArray([
      `${subject}: ${template.corePromise}`,
      `قبل أن تشتري ${subject}، تحقق من: ${template.proof || safeArray(angle.proofNeeded, 1)[0] || 'الدليل'}`,
      place ? `${subject} في ${place}: ${template.objection}` : `${subject}: ${template.objection}`
    ], 3);
  }
  if (lang === 'en') {
    return safeArray([
      `${subject}: ${template.corePromise}`,
      `Before buying ${subject}, check: ${template.proof || safeArray(angle.proofNeeded, 1)[0] || 'proof'}`,
      place ? `${subject} in ${place}: ${template.objection}` : `${subject}: ${template.objection}`
    ], 3);
  }
  return safeArray([
    `${subject} : ${template.corePromise}`,
    `Avant d'acheter ${subject}, verifiez : ${template.proof || safeArray(angle.proofNeeded, 1)[0] || 'la preuve'}`,
    place ? `${subject} en ${place} : ${template.objection}` : `${subject} : ${template.objection}`
  ], 3);
}

function addUltimateAttackAngleBlueprint(angle = {}, { lang = 'fr', query = '', market = '', evidence = [] } = {}) {
  const normalizedType = angle.type || 'proof_outcome';
  const family = detectProductFamily(query || angle.context || angle.jobToBeDone || angle.problem);
  const pack = attackLangPack(lang);
  const templates = familyAngleTemplates(family, lang);
  const template = templates[normalizedType] || templates.proof_outcome || {};
  const channel = safeArray(angle.channels, 1)[0] || pack.channelFit;
  const proof = template.proof || safeArray(angle.proofNeeded, 1)[0] || pack.noProof;
  const formula = `${pack.formula}: ${safeText(query || angle.context, 120)} -> ${template.corePromise} -> ${proof} -> ${template.objection} -> ${channel}`;
  const cleanHooks = cleanDetailArray(buildHookExamples(angle, { lang, query, market, template }), { max: 3, query, market });
  const specificityScore = detailQualityScore(formula, { query, market });
  return {
    ...angle,
    productFamily: family,
    angleFormula: safeText(formula, 420),
    corePromise: safeText(template.corePromise || angle.primaryBenefit || angle.promise, 220),
    proofToShow: safeText(proof, 240),
    objectionToNeutralize: safeText(template.objection || angle.trigger, 220),
    offerMove: safeText(template.offerMove || angle.promise, 240),
    channelFit: safeText(channel, 90),
    landingPageSection: safeText(template.landingPageSection, 140),
    hookExamples: cleanHooks.length ? cleanHooks : cleanDetailArray(angle.hooks, { max: 3, query, market }),
    antiHallucinationChecks: cleanDetailArray(pack.checks, { max: 5, query, market }),
    specificityScore,
    qualityWarnings: specificityScore < 40 ? safeArray([lang === 'ar' ? 'هذه الزاوية تحتاج دليلا أكثر قبل التوسيع' : lang === 'en' ? 'This angle needs stronger proof before scaling' : 'Cet angle demande plus de preuve avant scaling'], 1) : [],
    isActionable: specificityScore >= 28,
    evidenceStatus: evidence.length || safeArray(angle.evidenceIds, 5).length ? (angle.evidenceStatus || 'observed_or_inferred') : 'inferred_without_direct_evidence'
  };
}

function generateMarketingAngleCandidates({ query = '', geo = '', lang = 'fr', segments = [], competitorData = {} } = {}) {
  const evidenceCatalog = buildEvidenceCatalog({ query, segments, competitorData });
  const allText = [
    query,
    geo,
    ...(segments || []).map(s => `${s.name || ''} ${s.need || ''} ${safeArray(s.buyingTriggers, 4).join(' ')}`),
    JSON.stringify(competitorData.keywordStrategy || {}),
    JSON.stringify(competitorData.marketInsights || {}),
    JSON.stringify(competitorData.productServiceAudit || {}),
    ...(competitorData.top10Competitors || competitorData.competitors || []).slice(0, 8).map(c => `${c.title || ''} ${c.snippet || ''} ${c.domain || c.url || c.link || ''}`)
  ].join(' ');
  const types = new Set(inferTypesFromText(allText));
  ['security_trust', 'proof_outcome', 'comparison_alternative', 'savings_budget'].forEach(t => types.add(t));

  const market = safeText(geo, 80);
  const candidates = [...types].flatMap(type => {
    const matchedEvidence = evidenceCatalog
      .filter(e => inferTypesFromText(e.text).includes(type) || overlapScore(e.text, `${query} ${localLabel(type, lang)}`) >= 0.32)
      .slice(0, 6);
    const base = makeAngle(type, {
      lang,
      query,
      market,
      evidence: matchedEvidence,
      reason: matchedEvidence[0]?.text || ''
    });
    const lexicalVariant = {
      ...base,
      id: `${base.id}-variant`,
      name: `${base.name} · variant`,
      label: base.label,
      coreProblem: base.coreProblem,
      problem: `${base.problem} ${base.primaryBenefit}`,
      trigger: base.trigger,
      desiredOutcome: base.desiredOutcome,
      primaryBenefit: base.primaryBenefit
    };
    return [base, lexicalVariant];
  });
  return candidates.slice(0, 20);
}

function classifyAngleRelation(a = {}, b = {}) {
  const at = a.type || '';
  const bt = b.type || '';
  if (at && bt && at === bt) return 'SAME_ANGLE';
  if ([at, bt].includes('installation_ease')) return 'DISTINCT';
  if ([at, bt].includes('offgrid_autonomy')) return 'DISTINCT';
  const ag = new Set((ANGLE_TYPES[at]?.groups || []));
  const bg = new Set((ANGLE_TYPES[bt]?.groups || []));
  const sharedGroup = [...ag].some(g => bg.has(g));
  const overlap = overlapScore(`${a.name || ''} ${a.problem || ''} ${a.promise || ''}`, `${b.name || ''} ${b.problem || ''} ${b.promise || ''}`);
  if (sharedGroup && overlap >= 0.72) return 'SAME_ANGLE';
  if (sharedGroup && overlap >= 0.42) return 'RELATED_BUT_DISTINCT';
  return 'DISTINCT';
}

function normalizeAngle(angle = {}) {
  const type = angle.type || inferTypesFromText(`${angle.name || ''} ${angle.problem || ''} ${angle.promise || ''}`)[0] || 'proof_outcome';
  const def = ANGLE_TYPES[type] || ANGLE_TYPES.proof_outcome;
  const normalized = {
    ...angle,
    id: safeText(angle.id || `angle-${type}`, 80),
    slug: safeText(angle.slug || slugify(angle.name || angle.label || type), 80),
    type,
    angleType: safeText(angle.angleType || def.angleType || 'other', 40),
    name: safeText(angle.name || angle.label || localLabel(type, angle.lang || 'fr'), 120),
    label: safeText(angle.label || angle.name || localLabel(type, angle.lang || 'fr'), 120),
    coreProblem: safeText(angle.coreProblem || angle.problem || angle.need || '', 220),
    context: safeText(angle.context || angle.market || '', 180),
    trigger: safeText(angle.trigger || '', 180),
    desiredOutcome: safeText(angle.desiredOutcome || angle.outcome || '', 180),
    primaryBenefit: safeText(angle.primaryBenefit || angle.benefit || '', 160),
    corePromise: safeText(angle.corePromise || angle.promise || angle.primaryBenefit || def.hooks?.[0] || '', 220),
    emotionalDriver: safeText(angle.emotionalDriver || '', 120),
    problem: safeText(angle.problem || angle.need || angle.jobToBeDone || '', 260),
    jobToBeDone: safeText(angle.jobToBeDone || angle.problem || angle.name || '', 260),
    promise: safeText(angle.promise || angle.attackAngle || def.hooks?.[0] || '', 220),
    proofNeeded: safeArray(angle.proofNeeded, 6),
    proofToShow: safeText(angle.proofToShow || safeArray(angle.proofNeeded, 1)[0] || '', 240),
    objectionToNeutralize: safeText(angle.objectionToNeutralize || angle.objection || '', 220),
    offerMove: safeText(angle.offerMove || '', 240),
    channelFit: safeText(angle.channelFit || safeArray(angle.channels || def.channels, 1)[0] || '', 90),
    landingPageSection: safeText(angle.landingPageSection || '', 140),
    angleFormula: safeText(angle.angleFormula || '', 420),
    hookExamples: safeArray(angle.hookExamples, 4),
    antiHallucinationChecks: safeArray(angle.antiHallucinationChecks, 5),
    keywords: safeArray(angle.keywords, 10),
    hooks: safeArray(angle.hooks || def.hooks, 5),
    channels: safeArray(angle.channels || def.channels, 6),
    tone: safeText(angle.tone || def.tone, 40),
    icon: safeText(angle.icon || def.icon, 40),
    evidenceIds: safeArray(angle.evidenceIds, 10),
    score: Number.isFinite(Number(angle.score)) ? Math.round(Number(angle.score)) : 0
  };
  return normalized.angleFormula
    ? normalized
    : addUltimateAttackAngleBlueprint(normalized, { lang: angle.lang || 'fr', query: normalized.context || normalized.jobToBeDone, market: normalized.context });
}

function dedupeMarketingAngles(candidates = []) {
  const accepted = [];
  const rejected = [];
  candidates.map(normalizeAngle).forEach(angle => {
    const duplicate = accepted.find(existing => classifyAngleRelation(existing, angle) === 'SAME_ANGLE');
    if (duplicate) {
      rejected.push({ id: angle.id, duplicateOf: duplicate.id, reason: classifyAngleRelation(duplicate, angle) });
      duplicate.evidenceIds = safeArray([...(duplicate.evidenceIds || []), ...(angle.evidenceIds || [])], 10);
      duplicate.hooks = safeArray([...(duplicate.hooks || []), ...(angle.hooks || [])], 5);
      duplicate.keywords = safeArray([...(duplicate.keywords || []), ...(angle.keywords || [])], 10);
      duplicate.proofNeeded = safeArray([...(duplicate.proofNeeded || []), ...(angle.proofNeeded || [])], 6);
      return;
    }
    accepted.push(angle);
  });
  return { angles: accepted, rejected };
}

function scoreMarketingAngle(angle = {}, evidence = {}, context = {}) {
  const normalized = normalizeAngle(angle);
  const evidenceCount = safeArray(normalized.evidenceIds, 10).length;
  const budget = normalizeText(context.budget || '');
  const leanBoost = budget && /lean|small|petit|low|faible|قليل|صغير/.test(budget) && ['savings_budget', 'local_speed', 'comparison_alternative'].includes(normalized.type) ? 8 : 0;
  const solarBoost = /solar|solaire|شمسي|projecteur/.test(normalizeText(context.query || '')) && ['offgrid_autonomy', 'installation_ease', 'reliability_risk'].includes(normalized.type) ? 10 : 0;
  const score = 48 + Math.min(22, evidenceCount * 4) + leanBoost + solarBoost + (normalized.type === 'security_trust' ? 7 : 0);
  return Math.max(35, Math.min(96, Math.round(score)));
}

function sanitizeEvidenceIds(ids = [], evidenceCatalog = []) {
  const valid = new Set((evidenceCatalog || []).map(e => e.id));
  const kept = safeArray(ids, 12).filter(id => valid.has(id));
  return {
    ids: kept,
    removed: safeArray(ids, 12).filter(id => !valid.has(id))
  };
}

function personaDiversitySignature(persona = {}) {
  const details = persona.details || {};
  return normalizeText([
    persona.primaryAngle?.type || persona.angleType || '',
    details.primaryJobToBeDone || persona.summary || '',
    details.buyingBehavior || '',
    details.searchBehavior || '',
    safeArray(details.pains, 3).join(' '),
    safeArray(details.buyingTriggers, 3).join(' ')
  ].join(' '));
}

function personaStructuralDimensions(persona = {}) {
  const details = persona.details || {};
  return {
    purchaseContext: safeText(details.purchaseContext || details.context || persona.market || ''),
    primaryJobToBeDone: safeText(details.primaryJobToBeDone || details.need || persona.summary || ''),
    mainPain: safeText(details.mainPain || safeArray(details.pains, 1)[0] || ''),
    trigger: safeText(details.trigger || safeArray(details.buyingTriggers, 1)[0] || ''),
    desiredOutcome: safeText(details.desiredOutcome || persona.primaryAngle?.desiredOutcome || ''),
    decisionCriteria: safeText(details.decisionCriteria || safeArray(details.proofNeeded, 2).join(' ')),
    objections: safeText(safeArray(details.objections, 3).join(' ')),
    environment: safeText(details.environment || details.segmentName || persona.segmentName || ''),
    buyingBehavior: safeText(details.buyingBehavior || ''),
    informationBehavior: safeText(details.informationBehavior || details.searchBehavior || '')
  };
}

function countStructuralDifferences(a = {}, b = {}) {
  const aa = personaStructuralDimensions(a);
  const bb = personaStructuralDimensions(b);
  return Object.keys(aa).reduce((count, key) => {
    if (!aa[key] || !bb[key]) return count;
    return overlapScore(aa[key], bb[key]) < 0.55 ? count + 1 : count;
  }, 0);
}

function arePersonasStructurallyDuplicate(a = {}, b = {}) {
  if ((a.primaryAngle?.type || a.angleType) && (b.primaryAngle?.type || b.angleType) && (a.primaryAngle?.type || a.angleType) !== (b.primaryAngle?.type || b.angleType)) return false;
  if (countStructuralDifferences(a, b) >= 2) return false;
  const sigA = personaDiversitySignature(a);
  const sigB = personaDiversitySignature(b);
  if (!sigA || !sigB) return false;
  return overlapScore(sigA, sigB) >= 0.66;
}

function dedupePersonas(personas = []) {
  const accepted = [];
  const rejected = [];
  personas.forEach(persona => {
    const dup = accepted.find(existing => arePersonasStructurallyDuplicate(existing, persona));
    if (dup) rejected.push({ id: persona.id, duplicateOf: dup.id, reason: 'same_context_jtbd_pain_trigger_behavior' });
    else accepted.push(persona);
  });
  return { personas: accepted, rejected };
}

function deriveChannelsFromBehavior(persona = {}, angle = {}, lang = 'fr') {
  const details = persona.details || {};
  const text = normalizeText(`${persona.summary || ''} ${details.searchBehavior || ''} ${details.buyingBehavior || ''} ${safeArray(details.buyingTriggers, 4).join(' ')}`);
  const channels = [...safeArray(angle.channels, 5), ...safeArray(details.channels, 5)];
  if (/urgent|near|local|قريب|عاجل/.test(text)) channels.push('local SEO', 'WhatsApp');
  if (/compare|price|budget|سعر|مقارنة/.test(text)) channels.push('comparison page', 'search ads');
  if (/proof|review|trust|دليل|ثقة/.test(text)) channels.push('reviews', 'UGC');
  if (/expert|b2b|method|خبير/.test(text)) channels.push('LinkedIn', 'case study');
  return localizeVisibleArray(channels, lang, 'channel', 7);
}

function priorityFromScore(score = 0) {
  if (score >= 76) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function personaAttackLangPack(lang = 'fr') {
  const packs = {
    fr: {
      wants: 'Je veux',
      attack: 'Attaquer avec',
      because: 'car',
      prove: 'Prouver avec',
      remove: 'Retirer le risque',
      channel: 'Canal',
      formula: 'Formule d attaque'
    },
    en: {
      wants: 'I want',
      attack: 'Attack with',
      because: 'because',
      prove: 'Prove with',
      remove: 'Remove risk',
      channel: 'Channel',
      formula: 'Attack formula'
    },
    ar: {
      wants: 'أريد',
      attack: 'الهجوم عبر',
      because: 'لأن',
      prove: 'أثبت ذلك عبر',
      remove: 'أزل المخاطرة',
      channel: 'القناة',
      formula: 'صيغة الهجوم'
    }
  };
  return packs[lang] || packs.fr;
}

function buildPersonaAttackBlueprint(persona = {}, angle = {}, { lang = 'fr', query = '', market = '' } = {}) {
  const labels = personaAttackLangPack(lang);
  const details = persona.details || {};
  const name = safeText(persona.displayName || persona.name || persona.title || persona.segmentName || '', 80);
  const subject = safeText(query || angle.context || details.product || 'offre', 120);
  const need = localizePersonaNeed(details.primaryJobToBeDone || details.need || persona.summary || angle.jobToBeDone || '', { lang, subject, angleType: angle.type });
  const pain = safeText(details.mainPain || safeArray(details.pains, 1)[0] || angle.objectionToNeutralize || angle.trigger || '', 180);
  const proof = safeText(angle.proofToShow || safeArray(angle.proofNeeded || details.proofNeeded, 1)[0] || '', 220);
  const channel = safeText(angle.channelFit || safeArray(angle.channels || details.channels, 1)[0] || '', 90);
  const promise = safeText(angle.corePromise || angle.promise || angle.primaryBenefit || '', 220);
  const objection = safeText(angle.objectionToNeutralize || safeArray(details.objections, 1)[0] || pain, 220);
  let want;
  let attackAngle;
  if (lang === 'ar') {
    want = `${labels.wants} ${subject} يحقق "${promise}" بدون ${objection}`;
    attackAngle = `${labels.attack} ${promise}: ${labels.prove} ${proof || 'دليل قابل للتحقق'}، ${labels.remove} "${objection}"، ${labels.channel}: ${channel || 'SEO/WhatsApp'}.`;
  } else if (lang === 'en') {
    want = `${labels.wants} ${subject} that delivers "${promise}" without ${objection}`;
    attackAngle = `${labels.attack} ${promise}: ${labels.prove} ${proof || 'verifiable proof'}, ${labels.remove} "${objection}", ${labels.channel}: ${channel || 'SEO/WhatsApp'}.`;
  } else {
    want = `${labels.wants} ${subject} qui livre "${promise}" sans ${objection}`;
    attackAngle = `${labels.attack} ${promise} : ${labels.prove} ${proof || 'une preuve verifiable'}, ${labels.remove} "${objection}", ${labels.channel} : ${channel || 'SEO/WhatsApp'}.`;
  }
  const formula = [
    name || 'Persona',
    need,
    promise,
    proof || labels.prove,
    objection,
    channel || labels.channel
  ].filter(Boolean).join(' -> ');
  return {
    want: safeText(want, 320),
    attackAngle: safeText(attackAngle, 420),
    attackFormula: safeText(`${labels.formula}: ${formula}`, 520),
    proofToShow: proof,
    objectionToNeutralize: objection,
    corePromise: promise,
    channelFit: channel,
    hookExamples: cleanDetailArray(angle.hookExamples, { max: 4, query, market }),
    offerMove: safeText(angle.offerMove, 240),
    landingPageSection: safeText(angle.landingPageSection, 140),
    why: safeText(`${pain}${pain && promise ? ' -> ' : ''}${promise}`, 260)
  };
}

function sanitizePersonaForDisplay(persona = {}, { query = '', market = '', lang = 'fr' } = {}) {
  const details = persona.details || {};
  const primaryAngle = persona.primaryAngle || {};
  const cleanSummary = cleanVisibleText(persona.summary || details.primaryJobToBeDone, { query, market, minScore: 20 });
  const cleanAttack = cleanVisibleText(persona.attackAngle || details.attackAngle || details.stp?.positioning, { query, market, minScore: 24 });
  const cleanFormula = cleanVisibleText(details.attackFormula || primaryAngle.angleFormula, { query, market, minScore: 28 });
  const cleanProof = cleanVisibleText(details.proofToShow || primaryAngle.proofToShow, { query, market, minScore: 18 });
  const cleanObjection = cleanVisibleText(details.objectionToNeutralize || primaryAngle.objectionToNeutralize, { query, market, minScore: 18 });
  const cleanPromise = cleanVisibleText(details.corePromise || primaryAngle.corePromise, { query, market, minScore: 16 });
  const cleanOfferMove = cleanVisibleText(details.offerMove || primaryAngle.offerMove, { query, market, minScore: 18 });
  const cleanLanding = cleanVisibleText(details.landingPageSection || primaryAngle.landingPageSection, { query, market, minScore: 10 });
  const proofNeeded = cleanDetailArray([cleanProof, ...(details.proofNeeded || []), ...(primaryAngle.proofNeeded || [])], { max: 5, query, market });
  const trustSources = cleanDetailArray([cleanProof, ...(details.trustSources || []), cleanOfferMove], { max: 5, query, market });
  const hookExamples = cleanDetailArray(details.hookExamples || primaryAngle.hookExamples, { max: 4, query, market });
  const qualitySignals = [
    cleanSummary,
    cleanAttack,
    cleanFormula,
    cleanProof,
    cleanObjection,
    cleanPromise,
    cleanOfferMove
  ].filter(Boolean);
  const qualityScore = Math.round(qualitySignals.reduce((sum, item) => sum + detailQualityScore(item, { query, market }), 0) / Math.max(1, qualitySignals.length));
  const fallbackNote = lang === 'ar'
    ? 'هذه البطاقة تعرض فقط الزوايا التي تملك قيمة عملية؛ التفاصيل الضعيفة تم حذفها.'
    : lang === 'en'
      ? 'This card only keeps actionable angle details; weak filler was removed.'
      : 'Cette carte garde seulement les détails actionnables; le remplissage faible a été supprimé.';
  return {
    ...persona,
    primaryAngle: angleForPersonaDisplay(persona.primaryAngle, { lang, query, market }),
    secondaryAngles: (persona.secondaryAngles || []).map(angle => angleForPersonaDisplay(angle, { lang, query, market })).filter(Boolean).slice(0, 2),
    summary: cleanSummary || persona.summary,
    attackAngle: cleanAttack || persona.attackAngle,
    qualityScore,
    qualityWarnings: qualityScore < 38 ? safeArray([fallbackNote], 1) : [],
    details: {
      ...details,
      primaryJobToBeDone: cleanSummary || details.primaryJobToBeDone,
      attackAngle: cleanAttack || details.attackAngle,
      attackFormula: cleanFormula || undefined,
      corePromise: cleanPromise || undefined,
      proofToShow: cleanProof || undefined,
      objectionToNeutralize: cleanObjection || undefined,
      offerMove: cleanOfferMove || undefined,
      landingPageSection: cleanLanding || undefined,
      hookExamples,
      proofNeeded,
      trustSources,
      buyingTriggers: cleanDetailArray(details.buyingTriggers, { max: 5, query, market }),
      pains: cleanDetailArray(details.pains, { max: 5, query, market }),
      objections: cleanDetailArray(details.objections, { max: 5, query, market }),
      constraints: cleanDetailArray(details.constraints, { max: 4, query, market }),
      channels: cleanChannelArray(details.channels, 6),
      socialPlan: details.socialPlan ? {
        ...details.socialPlan,
        platforms: cleanChannelArray(details.socialPlan.platforms || details.channels, 5),
        contentAngles: cleanDetailArray(details.socialPlan.contentAngles, { max: 5, query, market }),
        approach: cleanVisibleText(details.socialPlan.approach, { query, market, minScore: 18 })
      } : undefined,
      stp: {
        ...(details.stp || {}),
        positioning: cleanAttack || details.stp?.positioning
      }
    }
  };
}

function mapPersonasToAngles(personas = [], angles = [], lang = 'fr') {
  const normalizedAngles = angles.map(normalizeAngle);
  const usedPrimaryIds = new Set();
  return personas.map((persona, index) => {
    const text = `${persona.summary || ''} ${persona.attackAngle || ''} ${JSON.stringify(persona.details || {})}`;
    const ranked = normalizedAngles
      .map(angle => ({
        angle,
        rawScore: overlapScore(text, `${angle.name} ${angle.coreProblem} ${angle.trigger} ${angle.desiredOutcome} ${angle.primaryBenefit} ${angle.problem} ${angle.promise} ${angle.hooks?.join(' ')}`),
        score: overlapScore(text, `${angle.name} ${angle.coreProblem} ${angle.trigger} ${angle.desiredOutcome} ${angle.primaryBenefit} ${angle.problem} ${angle.promise} ${angle.hooks?.join(' ')}`) + (angle.score || 0) / 200
      }))
      .sort((a, b) => b.score - a.score);
    const uniquePrimary = ranked.find(item => item.angle?.id && !usedPrimaryIds.has(item.angle.id))?.angle;
    const fallbackPrimary = normalizedAngles.find(angle => angle?.id && !usedPrimaryIds.has(angle.id)) || normalizedAngles[index % Math.max(1, normalizedAngles.length)];
    const primary = uniquePrimary || ranked[0]?.angle || fallbackPrimary;
    if (primary?.id) usedPrimaryIds.add(primary.id);
    const secondary = ranked
      .map(item => item.angle)
      .filter(angle => angle && angle.id !== primary?.id)
      .slice(0, 2);
    return {
      ...persona,
      angleType: primary?.type,
      primaryAngle: primary || null,
      secondaryAngles: secondary,
      angleMappings: [primary, ...secondary].filter(Boolean).map((angle, rank) => {
        const rankedItem = ranked.find(item => item.angle.id === angle.id) || { rawScore: 0, score: 0 };
        const relevanceScore = Math.max(35, Math.min(100, Math.round((rankedItem.rawScore * 58) + ((angle.score || 0) * 0.42))));
        return {
        angleId: angle.id,
        type: angle.type,
        angleType: angle.angleType,
        name: angle.name,
        relevanceScore,
        priority: priorityFromScore(relevanceScore),
        rank: rank + 1,
        role: rank === 0 ? 'primary_attack_angle' : 'secondary_support_angle',
        rationale: safeText(`${angle.coreProblem || angle.problem} -> ${angle.corePromise || angle.desiredOutcome || angle.promise}`, 240),
        message: safeText(angle.corePromise || localizedHookText(angle.promise, lang) || angle.primaryBenefit || angle.name, 180),
        hooks: localizeVisibleArray(angle.hooks, lang, 'hook', 4),
        objections: safeArray(persona.details?.objections, 4),
        proofPoints: safeArray(angle.proofNeeded || persona.details?.proofNeeded, 5).filter(item => !/^ev_\d+$/i.test(item)),
        confidence: Number(angle.confidence || 0.5)
      };
      })
    };
  });
}

function buildAngleDrivenStpModel({ query = '', geo = '', lang = 'fr', segments = [], personaCards = [], competitorData = {}, beachheadMarket = {}, budget = '' } = {}) {
  const subjectQuery = localizeSubjectForLang(query, lang);
  const subjectGeo = localizeMarketForLang(geo, lang);
  const evidenceCatalog = buildEvidenceCatalog({ query: subjectQuery, segments, competitorData });
  const generated = generateMarketingAngleCandidates({ query: subjectQuery, geo: subjectGeo, lang, segments, competitorData });
  let { angles, rejected } = dedupeMarketingAngles(generated);
  angles = angles.map(angle => {
    const evidence = sanitizeEvidenceIds(angle.evidenceIds, evidenceCatalog);
    const scored = addUltimateAttackAngleBlueprint(
      { ...angle, evidenceIds: evidence.ids, removedEvidenceIds: evidence.removed },
      {
        lang,
        query: subjectQuery,
        market: subjectGeo,
        evidence: evidenceCatalog.filter(item => evidence.ids.includes(item.id))
      }
    );
    scored.score = scoreMarketingAngle(scored, evidenceCatalog, { query: subjectQuery, budget });
    scored.opportunityScore = scored.score;
    scored.confidence = evidence.ids.length ? Math.max(Number(scored.confidence || 0), 0.68) : Number(scored.confidence || 0.48);
    return scored;
  }).sort((a, b) => b.score - a.score);

  const beachheadType = angles[0]?.type || 'security_trust';
  const enrichedPersonas = mapPersonasToAngles(personaCards, angles, lang).map((persona, index) => {
    const angle = persona.primaryAngle || angles[index % Math.max(1, angles.length)] || null;
    const channels = deriveChannelsFromBehavior(persona, angle || {}, lang);
    const details = persona.details || {};
    const isFirst = index === 0 || angle?.type === beachheadType;
    const personaAttack = buildPersonaAttackBlueprint(persona, angle || {}, { lang, query: subjectQuery, market: subjectGeo });
    const personaNeed = safeText(personaAttack.want || details.primaryJobToBeDone || details.need || persona.summary || '', 320);
    const combinedAttack = personaAttack.attackAngle || safeText([personaNeed, angle?.corePromise || angle?.promise || angle?.primaryBenefit || angle?.name].filter(Boolean).join(' -> '), 420);
    return {
      ...persona,
      icon: angle?.icon || persona.icon,
      tone: angle?.tone || persona.tone,
      priorityScore: Math.max(Number(persona.priorityScore || 0), angle?.score || 0),
      attackAngle: combinedAttack || persona.attackAngle,
      summary: personaNeed || persona.summary,
      beachheadPriority: {
        ...(persona.beachheadPriority || {}),
        firstToAttack: isFirst,
        reason: isFirst ? (beachheadMarket?.rationale || angle?.problem || persona.beachheadPriority?.reason) : (angle?.problem || persona.beachheadPriority?.reason)
      },
      details: {
        ...details,
        primaryMarketingAngle: angle?.name || '',
        primaryJobToBeDone: personaNeed || angle?.jobToBeDone || persona.summary,
        attackFormula: personaAttack.attackFormula,
        corePromise: personaAttack.corePromise,
        proofToShow: personaAttack.proofToShow,
        objectionToNeutralize: personaAttack.objectionToNeutralize,
        offerMove: personaAttack.offerMove,
        landingPageSection: personaAttack.landingPageSection,
        hookExamples: personaAttack.hookExamples,
        whyThisAngle: personaAttack.why,
        informationBehavior: details.informationBehavior || inferBehavior('information', angle, lang),
        buyingBehavior: details.buyingBehavior || inferBehavior('buying', angle, lang),
        searchBehavior: details.searchBehavior || inferBehavior('search', angle, lang),
        trustSources: safeArray([personaAttack.proofToShow, ...(details.trustSources || []), ...(details.proofNeeded || []), ...(angle?.proofNeeded || [])], 5),
        proofNeeded: safeArray([personaAttack.proofToShow, ...(details.proofNeeded || []), ...(angle?.proofNeeded || [])], 6),
        discoveryBehavior: details.discoveryBehavior || inferBehavior('discovery', angle, lang),
        channels,
        socialPlan: {
          ...(details.socialPlan || {}),
          platforms: safeArray((details.socialPlan || {}).platforms || channels, 5),
          contentAngles: safeArray([personaAttack.attackAngle, ...(personaAttack.hookExamples || []), ...safeArray((details.socialPlan || {}).contentAngles, 4).map(item => localizedHookText(item, lang))], 6)
        },
        stp: {
          ...(details.stp || {}),
          positioning: combinedAttack || details.stp?.positioning || persona.attackAngle
        }
      },
      evidenceStatus: angle?.evidenceStatus || 'inferred_without_direct_evidence'
    };
  });

  const sanitizedPersonas = enrichedPersonas.map(persona => sanitizePersonaForDisplay(persona, { query: subjectQuery, market: subjectGeo, lang }));
  const deduped = dedupePersonas(sanitizedPersonas);
  const displayAngles = angles.map(angle => angleForPersonaDisplay(angle, { lang, query: subjectQuery, market: subjectGeo })).filter(Boolean);
  return {
    productUnderstanding: {
      query: safeText(subjectQuery, 160),
      geo: safeText(subjectGeo, 80),
      source: 'competitor_serp_market_layers'
    },
    problemsJtbdUseCases: displayAngles.map(angle => ({
      angleId: angle.id,
      coreProblem: angle.coreProblem,
      trigger: angle.trigger,
      desiredOutcome: angle.desiredOutcome,
      primaryBenefit: angle.primaryBenefit,
      jobToBeDone: angle.jobToBeDone,
      evidenceStatus: angle.evidenceStatus
    })),
    marketingAngles: displayAngles,
    ultimateAttackAngles: angles.map(angle => ({
      id: angle.id,
      name: angle.name,
      type: angle.type,
      score: angle.score,
      formula: angle.angleFormula,
      corePromise: angle.corePromise,
      proofToShow: angle.proofToShow,
      objectionToNeutralize: angle.objectionToNeutralize,
      offerMove: angle.offerMove,
      channelFit: angle.channelFit,
      landingPageSection: angle.landingPageSection,
      hookExamples: angle.hookExamples,
      antiHallucinationChecks: angle.antiHallucinationChecks,
      evidenceStatus: angle.evidenceStatus
    })),
    personaCards: deduped.personas,
    personaAngleMappings: deduped.personas.map(persona => ({
      personaId: persona.id,
      personaName: persona.displayName || persona.title,
      primaryAngleId: persona.primaryAngle?.id || null,
      secondaryAngleIds: safeArray((persona.secondaryAngles || []).map(a => a.id), 4),
      mappings: persona.angleMappings || []
    })),
    angleDeduplication: rejected,
    personaDeduplication: deduped.rejected,
    evidenceCatalog,
    observability: [
      `[AngleEngine] candidates=${generated.length}`,
      `[AngleEngine] accepted_angles=${angles.length}`,
      `[AngleEngine] rejected_angles=${rejected.length}`,
      `[AngleEngine] accepted_personas=${deduped.personas.length}`,
      `[AngleEngine] rejected_personas=${deduped.rejected.length}`
    ]
  };
}

function inferBehavior(kind, angle = {}, lang = 'fr') {
  const name = angle?.name || '';
  const map = {
    fr: {
      information: `Lit les preuves et compare avant d'avancer: ${name}`,
      buying: `Achete quand le risque percu baisse et que l'action devient simple.`,
      search: `Cherche des requetes concretes liees au probleme, prix, avis et alternatives.`,
      discovery: `Decouvre via recherche, contenu utile, preuve sociale et retargeting leger.`
    },
    en: {
      information: `Reads proof and compares before moving forward: ${name}`,
      buying: `Buys when perceived risk drops and the next action is simple.`,
      search: `Searches concrete problem, price, review and alternative queries.`,
      discovery: `Discovers through search, useful content, social proof and light retargeting.`
    },
    ar: {
      information: `يقارن الأدلة قبل القرار: ${name}`,
      buying: `يشتري عندما تنخفض المخاطرة ويصبح الإجراء التالي واضحا.`,
      search: `يبحث عن المشكلة والسعر والآراء والبدائل بصيغة عملية.`,
      discovery: `يكتشف العرض عبر البحث والمحتوى المفيد والدليل الاجتماعي وإعادة الاستهداف.`
    }
  };
  return map[lang]?.[kind] || map.fr[kind] || '';
}

module.exports = {
  ANGLE_TYPES,
  normalizeText,
  normalizeAngle,
  classifyAngleRelation,
  dedupeMarketingAngles,
  scoreMarketingAngle,
  sanitizeEvidenceIds,
  personaDiversitySignature,
  personaStructuralDimensions,
  countStructuralDifferences,
  arePersonasStructurallyDuplicate,
  dedupePersonas,
  deriveChannelsFromBehavior,
  mapPersonasToAngles,
  buildEvidenceCatalog,
  generateMarketingAngleCandidates,
  buildAngleDrivenStpModel
};
