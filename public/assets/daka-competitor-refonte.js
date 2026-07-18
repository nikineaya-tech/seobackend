(function () {
  const MODULE_ID = 'daka-competitor-refonte';
  if (window.__dakaCompetitorRefonteLoaded) return;
  window.__dakaCompetitorRefonteLoaded = true;

  const LANGS = ['fr', 'en', 'ar'];
  const COUNTRIES = [
    { value: 'Morocco', code: 'MA', labels: { fr: 'Maroc', en: 'Morocco', ar: 'المغرب' } },
    { value: 'Libya', code: 'LY', labels: { fr: 'Libye', en: 'Libya', ar: 'ليبيا' } },
    { value: 'Tunisia', code: 'TN', labels: { fr: 'Tunisie', en: 'Tunisia', ar: 'تونس' } },
    { value: 'Algeria', code: 'DZ', labels: { fr: 'Algérie', en: 'Algeria', ar: 'الجزائر' } },
    { value: 'Egypt', code: 'EG', labels: { fr: 'Égypte', en: 'Egypt', ar: 'مصر' } },
    { value: 'Saudi Arabia', code: 'SA', labels: { fr: 'Arabie saoudite', en: 'Saudi Arabia', ar: 'السعودية' } },
    { value: 'United Arab Emirates', code: 'AE', labels: { fr: 'Émirats arabes unis', en: 'United Arab Emirates', ar: 'الإمارات' } },
    { value: 'Qatar', code: 'QA', labels: { fr: 'Qatar', en: 'Qatar', ar: 'قطر' } },
    { value: 'Kuwait', code: 'KW', labels: { fr: 'Koweït', en: 'Kuwait', ar: 'الكويت' } },
    { value: 'Bahrain', code: 'BH', labels: { fr: 'Bahreïn', en: 'Bahrain', ar: 'البحرين' } },
    { value: 'Oman', code: 'OM', labels: { fr: 'Oman', en: 'Oman', ar: 'عمان' } },
    { value: 'Jordan', code: 'JO', labels: { fr: 'Jordanie', en: 'Jordan', ar: 'الأردن' } },
    { value: 'Lebanon', code: 'LB', labels: { fr: 'Liban', en: 'Lebanon', ar: 'لبنان' } },
    { value: 'France', code: 'FR', labels: { fr: 'France', en: 'France', ar: 'فرنسا' } },
    { value: 'United States', code: 'US', labels: { fr: 'États-Unis', en: 'United States', ar: 'الولايات المتحدة' } },
    { value: 'Global English', code: 'GL', labels: { fr: 'Global (English)', en: 'Global (English)', ar: 'الإنجليزية العالمية' } }
  ];

  const COPY = {
    fr: {
      moduleTitle: 'Daka Market Insight Intelligence',
      moduleHighlight: 'Concurrents',
      moduleSubtitle: 'Voyez qui capte la demande, pourquoi il gagne et où votre vraie ouverture existe.',
      queryLabel: 'Marché, niche ou requête à analyser',
      queryPlaceholder: 'Ex: logiciel de veille concurrentielle Maroc',
      urlLabel: 'Votre site pour benchmark direct',
      urlPlaceholder: 'https://votre-site.com',
      countryLabel: 'Pays et marché cible',
      languageLabel: 'Langue du rapport',
      countryNote: 'Le marché ciblé reste le même. Seul le libellé visible du pays suit la langue du rapport.',
      submit: "Lancer l'extraction stratégique",
      loading: 'Daka lit le marché, trie les signaux, puis reconstruit un dossier business lisible.',
      opening: 'Ouverture stratégique',
      openingHook: 'Ce premier bloc doit suffire à comprendre la tension du marché et donner envie de lire la suite.',
      executive: 'Résumé exécutif · lecture 3 minutes',
      executiveTitle: 'Ce qu’il faut comprendre et décider maintenant',
      marketReading: 'Lecture du marché',
      marketVerdict: 'Verdict marché',
      positioning: 'Position stratégique recommandée',
      actionPlan: 'Plan d’attaque prioritaire',
      directCompetitors: 'Concurrents directs',
      sourceDeck: 'Benchmarks, canaux et sources',
      productStudy: 'Étude produit / catégorie',
      missingProofs: 'Preuves manquantes',
      finalAnswers: 'Réponses finales',
      close: 'Fermer',
      open: 'Ouvrir',
      whoCaptures: 'Qui capte la demande',
      whyWinning: 'Pourquoi il avance',
      weakSpot: 'Où il est attaquable',
      nextMove: 'Quoi faire maintenant',
      decision: 'Décision',
      lever: 'Levier principal',
      risk: 'Risque immédiat',
      move: 'Move recommandé',
      opportunities: 'Opportunités',
      weaknesses: 'Faiblesses exploitables',
      actions: 'Actions immédiates',
      observedDemand: 'Demande observée',
      dominantOffer: 'Nature de l’offre dominante',
      decisionFactors: 'Critères de décision',
      visibleObjections: 'Objections visibles',
      geoNote: 'Note pays / requête',
      leader: 'Leader observé',
      leaderStatus: 'Statut',
      confidence: 'Confiance',
      confidenceToCheck: 'Points à confirmer',
      whatSell: 'Ce qu’il vend',
      promise: 'Promesse',
      strength: 'Force',
      weakness: 'Faiblesse exploitable',
      angle: 'Angle d’attaque',
      concreteAction: 'Action concrète',
      proof: 'Preuves',
      whatMarketSells: 'Ce que le marché vend',
      weakProof: 'Ce qu’il prouve mal',
      promiseToTake: 'Promesse à prendre',
      positionToTake: 'Position à occuper',
      proofsToAdd: 'Preuves à ajouter',
      now: 'Maintenant',
      week: 'Sous 7 jours',
      month: 'Sous 30 jours',
      directType: 'Direct',
      benchmarkType: 'Benchmark',
      distributionType: 'Distribution',
      socialType: 'Social',
      marketType: 'Source marché',
      noData: 'Bloc masqué faute de matière défendable.',
      reportReady: 'Rapport Competitor prêt.',
      errorPrefix: 'Erreur Competitor',
      localLeader: 'Leader local',
      regionalBenchmark: 'Benchmark régional',
      serviceDecision: 'Prenez une position plus claire, plus crédible et plus facile à comparer.',
      productDecision: 'Construisez une offre plus claire, plus rassurante et plus facile à valider.',
      serviceMove: 'Clarifiez la promesse, le résultat attendu et les preuves dès la première vue.',
      productMove: 'Affichez prix, contenu, preuve et réassurance avant le premier CTA.',
      finalWhoWins: 'Qui gagne',
      finalWhyWins: 'Pourquoi',
      finalAttack: 'Où attaquer',
      finalPosition: 'Quelle position prendre',
      finalWeek: 'Que faire cette semaine',
      finalMonth: 'Que construire sous 30 jours',
      finalProofs: 'Quelles preuves manquent',
      role: 'Rôle',
      use: 'Utilité',
      dataWarning: 'Des signaux riches existent, mais certains blocs restent trop faibles pour une conclusion forte.'
    },
    en: {
      moduleTitle: 'Daka Market Insight Intelligence',
      moduleHighlight: 'Competitors',
      moduleSubtitle: 'See who captures demand, why they win, and where your clean opening exists.',
      queryLabel: 'Market, niche, or query to analyze',
      queryPlaceholder: 'Ex: competitor intelligence software Morocco',
      urlLabel: 'Your website for direct benchmark',
      urlPlaceholder: 'https://your-site.com',
      countryLabel: 'Target country and market',
      languageLabel: 'Report language',
      countryNote: 'The target market stays the same. Only the visible country label follows the report language.',
      submit: 'Launch strategic extraction',
      loading: 'Daka is reading the market, sorting the signals, and rebuilding a decision-grade brief.',
      opening: 'Strategic opening',
      openingHook: 'This first block should reveal the market tension and create momentum for the rest of the report.',
      executive: 'Executive summary · 3-minute read',
      executiveTitle: 'What you need to understand and decide now',
      marketReading: 'Market reading',
      marketVerdict: 'Market verdict',
      positioning: 'Recommended strategic position',
      actionPlan: 'Priority attack plan',
      directCompetitors: 'Direct competitors',
      sourceDeck: 'Benchmarks, channels, and sources',
      productStudy: 'Product / category study',
      missingProofs: 'Missing proof',
      finalAnswers: 'Final answers',
      close: 'Close',
      open: 'Open',
      whoCaptures: 'Who captures demand',
      whyWinning: 'Why they advance',
      weakSpot: 'Where they are vulnerable',
      nextMove: 'What to do now',
      decision: 'Decision',
      lever: 'Main lever',
      risk: 'Immediate risk',
      move: 'Recommended move',
      opportunities: 'Opportunities',
      weaknesses: 'Exploitable weaknesses',
      actions: 'Immediate actions',
      observedDemand: 'Observed demand',
      dominantOffer: 'Dominant offer pattern',
      decisionFactors: 'Decision factors',
      visibleObjections: 'Visible objections',
      geoNote: 'Country / query note',
      leader: 'Observed leader',
      leaderStatus: 'Status',
      confidence: 'Confidence',
      confidenceToCheck: 'Points to confirm',
      whatSell: 'What they sell',
      promise: 'Promise',
      strength: 'Strength',
      weakness: 'Exploitable weakness',
      angle: 'Attack angle',
      concreteAction: 'Concrete action',
      proof: 'Proof',
      whatMarketSells: 'What the market sells',
      weakProof: 'What it proves poorly',
      promiseToTake: 'Promise to take',
      positionToTake: 'Position to own',
      proofsToAdd: 'Proof to add',
      now: 'Now',
      week: 'Within 7 days',
      month: 'Within 30 days',
      directType: 'Direct',
      benchmarkType: 'Benchmark',
      distributionType: 'Distribution',
      socialType: 'Social',
      marketType: 'Market source',
      noData: 'Section hidden because the material is too weak to defend.',
      reportReady: 'Competitor report ready.',
      errorPrefix: 'Competitor error',
      localLeader: 'Local leader',
      regionalBenchmark: 'Regional benchmark',
      serviceDecision: 'Own a clearer, more trusted position that is easier to compare.',
      productDecision: 'Build a clearer, more trusted offer that is easier to validate.',
      serviceMove: 'Tighten the promise, expected result, and proof in the first screen.',
      productMove: 'Show price, contents, proof, and reassurance before the first CTA.',
      finalWhoWins: 'Who wins',
      finalWhyWins: 'Why',
      finalAttack: 'Where to attack',
      finalPosition: 'What position to take',
      finalWeek: 'What to do this week',
      finalMonth: 'What to build in 30 days',
      finalProofs: 'What proof is missing',
      role: 'Role',
      use: 'Use',
      dataWarning: 'Strong signals exist, but some blocks remain too thin for a definitive conclusion.'
    },
    ar: {
      moduleTitle: 'Daka Market Insight Intelligence',
      moduleHighlight: 'المنافسون',
      moduleSubtitle: 'اعرف من يلتقط الطلب، ولماذا يفوز، وأين توجد الفتحة النظيفة التي يمكنك دخولها.',
      queryLabel: 'السوق أو النيش أو عبارة البحث',
      queryPlaceholder: 'مثال: برنامج ذكاء المنافسين في المغرب',
      urlLabel: 'موقعك للمقارنة المباشرة',
      urlPlaceholder: 'https://your-site.com',
      countryLabel: 'البلد والسوق المستهدف',
      languageLabel: 'لغة التقرير',
      countryNote: 'يبقى السوق المستهدف نفسه. فقط اسم البلد الظاهر يتبع لغة التقرير.',
      submit: 'ابدأ الاستخراج الاستراتيجي',
      loading: 'يقرأ Daka السوق الآن، ويرتب الإشارات، ثم يبني ملفا تجاريا قابلا للاستعمال.',
      opening: 'الفتحة الاستراتيجية',
      openingHook: 'هذا أول بلوك يجب أن يكشف توتر السوق ويجعل قراءة بقية التقرير منطقية ومغرية.',
      executive: 'الملخص التنفيذي · قراءة 3 دقائق',
      executiveTitle: 'ما يجب فهمه واتخاذه الآن',
      marketReading: 'قراءة السوق',
      marketVerdict: 'حكم السوق',
      positioning: 'التموضع الاستراتيجي الموصى به',
      actionPlan: 'خطة الهجوم ذات الأولوية',
      directCompetitors: 'المنافسون المباشرون',
      sourceDeck: 'المراجع والقنوات والمصادر',
      productStudy: 'دراسة المنتج / الفئة',
      missingProofs: 'الأدلة الناقصة',
      finalAnswers: 'الإجابات الحاسمة',
      close: 'إغلاق',
      open: 'فتح',
      whoCaptures: 'من يلتقط الطلب',
      whyWinning: 'لماذا يتقدم',
      weakSpot: 'أين توجد الثغرة',
      nextMove: 'ماذا نفعل الآن',
      decision: 'القرار',
      lever: 'الرافعة الأقوى',
      risk: 'الخطر الفوري',
      move: 'الحركة الموصى بها',
      opportunities: 'الفرص',
      weaknesses: 'الثغرات القابلة للاستغلال',
      actions: 'الإجراءات الفورية',
      observedDemand: 'الطلب المرصود',
      dominantOffer: 'طبيعة العرض المهيمن',
      decisionFactors: 'معايير القرار',
      visibleObjections: 'الاعتراضات الظاهرة',
      geoNote: 'ملاحظة البلد / الاستفسار',
      leader: 'المتصدر المرصود',
      leaderStatus: 'الصفة',
      confidence: 'الثقة',
      confidenceToCheck: 'ما يجب تأكيده',
      whatSell: 'ماذا يبيع',
      promise: 'الوعد',
      strength: 'القوة',
      weakness: 'الثغرة المستغلة',
      angle: 'زاوية الهجوم',
      concreteAction: 'الخطوة العملية',
      proof: 'الأدلة',
      whatMarketSells: 'ماذا يبيع السوق',
      weakProof: 'ما الذي يثبته بشكل ضعيف',
      promiseToTake: 'الوعد الذي يجب أخذه',
      positionToTake: 'الموقع الذي يجب شغله',
      proofsToAdd: 'الأدلة التي يجب إضافتها',
      now: 'الآن',
      week: 'خلال 7 أيام',
      month: 'خلال 30 يوما',
      directType: 'مباشر',
      benchmarkType: 'مرجع',
      distributionType: 'توزيع',
      socialType: 'اجتماعي',
      marketType: 'مصدر سوق',
      noData: 'تم إخفاء هذا البلوك لأن المادة غير كافية للدفاع عن استنتاج واضح.',
      reportReady: 'أصبح تقرير Competitor جاهزا.',
      errorPrefix: 'خطأ في Competitor',
      localLeader: 'قائد محلي',
      regionalBenchmark: 'مرجع إقليمي',
      serviceDecision: 'اشغل موقعا أوضح وأكثر موثوقية وأسهل مقارنة.',
      productDecision: 'ابنِ عرضا أوضح وأكثر طمأنة وأسهل تحققاً.',
      serviceMove: 'وضح الوعد والنتيجة المتوقعة والدليل في الشاشة الأولى.',
      productMove: 'اعرض السعر وما يصل للعميل وأدلة الثقة قبل أول CTA.',
      finalWhoWins: 'من يربح',
      finalWhyWins: 'لماذا',
      finalAttack: 'أين تهاجم',
      finalPosition: 'أي موقع تأخذ',
      finalWeek: 'ماذا تفعل هذا الأسبوع',
      finalMonth: 'ماذا تبني خلال 30 يوما',
      finalProofs: 'ما الأدلة الناقصة',
      role: 'الدور',
      use: 'الفائدة',
      dataWarning: 'هناك إشارات قوية، لكن بعض البلوكات ما زالت أضعف من أن تعطي حكما نهائيا.'
    }
  };

  const STATE = { inFlight: false };

  function lang() {
    const value = document.getElementById('analysisLang')?.value || window.STATE?.currentLang || 'fr';
    return LANGS.includes(value) ? value : 'fr';
  }

  function copy(key) {
    return fixText(COPY[lang()]?.[key] || COPY.fr[key] || key);
  }

  function looksBroken(value) {
    return /(?:Ãƒ|Ã‚|Ã¢|Ã˜|Ã™|Ã°|Å“|Æ’|â€™|â€“|â€”|â€œ|â€|Â·)/.test(String(value || ''));
  }

  function fixText(value) {
    if (value === null || value === undefined) return '';
    let text = String(value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (typeof window.repairMojibakeString === 'function') {
      const repaired = window.repairMojibakeString(text);
      if (repaired) text = repaired;
    }
    if (looksBroken(text) && typeof TextDecoder !== 'undefined') {
      try {
        const bytes = new Uint8Array(Array.from(text).map((char) => char.charCodeAt(0) & 255));
        const decoded = new TextDecoder('utf-8').decode(bytes).replace(/\s+/g, ' ').trim();
        if (decoded) text = decoded;
      } catch (_) {}
    }
    return text.replace(/\uFFFD/g, '').trim();
  }

  function esc(value) {
    return fixText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function useful(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some(useful);
    const text = fixText(value).replace(/[.*_`#]/g, '').trim();
    if (!text) return false;
    return !/^(?:null|undefined|none|n\/a|no data|insufficient data|not detected|non detecte|aucun|aucune|donnees insuffisantes|—|-|--|0)$/.test(text.toLowerCase());
  }

  function offerTypeFromInput(intel) {
    const source = [
      document.getElementById('keyword')?.value || '',
      document.getElementById('compOffer')?.value || '',
      intel?.productMarketStudy?.subject || '',
      intel?.recommendedAttackAngle?.positioningStatement || ''
    ].map(fixText).join(' ').toLowerCase();
    const serviceHints = ['saas', 'logiciel', 'software', 'service', 'agence', 'consulting', 'consultant', 'audit', 'formation', 'coaching', 'crm', 'automation', 'marketing'];
    const productHints = ['prix', 'stock', 'livraison', 'retour', 'produit', 'acheter', 'commande', 'pack', 'bundle', 'cosmetique', 'skincare', 'sensor', 'ip68', 'couleur', 'taille'];
    const serviceScore = serviceHints.filter((hint) => source.includes(hint)).length;
    const productScore = productHints.filter((hint) => source.includes(hint)).length;
    if (serviceScore > productScore) return 'service';
    if (productScore > serviceScore) return 'product';
    return 'hybrid';
  }

  function mixedLanguageNoise(text) {
    const value = fixText(text);
    if (!value) return false;
    const hasArabic = /[\u0600-\u06FF]/.test(value);
    const hasLatin = /[A-Za-zÀ-ÿ]/.test(value);
    if (!(hasArabic && hasLatin)) return false;
    return /(avec une preuve claire|positionne|expliquer ce qui est vendu|مقارنة بـ|compared? to|which elements remain to confirm)/i.test(value);
  }

  function genericCompetitorNoise(text) {
    const value = fixText(text);
    if (!value) return true;
    return /(guide concret|commentaires clients \(0\)|positionnementmedium|preuve(?:high|medium|low)|impact(?:high|medium|low)|plan de recherche|this week|next 30 days)/i.test(value);
  }

  function cleanInsight(value, fallback = '') {
    const text = fixText(value);
    if (!useful(text) || mixedLanguageNoise(text) || genericCompetitorNoise(text)) return fixText(fallback);
    return text;
  }

  function normalizeItem(item) {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string' || typeof item === 'number') return cleanInsight(String(item));
    return cleanInsight(
      item.action ||
      item.title ||
      item.reason ||
      item.statement ||
      item.promise ||
      item.label ||
      item.value ||
      item.domain ||
      item.url ||
      ''
    );
  }

  function list(items, limit = 5) {
    const values = (Array.isArray(items) ? items : [items])
      .map(normalizeItem)
      .filter((item, index, arr) => useful(item) && arr.indexOf(item) === index);
    return values.slice(0, limit);
  }

  function bullets(items, tone) {
    const values = list(items);
    if (!values.length) return '';
    return `<ul class="daka-comp-bullets tone-${tone || 'neutral'}">${values.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  function paragraph(text, className) {
    const value = cleanInsight(text);
    if (!useful(value)) return '';
    return `<p class="${className || ''}">${esc(value)}</p>`;
  }

  function linkItems(items, limit) {
    const values = (Array.isArray(items) ? items : [])
      .map((item) => {
        const url = typeof item === 'string' ? item : item?.url;
        const label = typeof item === 'string' ? item : (item?.label || item?.title || item?.domain || item?.url);
        if (!useful(url)) return null;
        return { url: String(url), label: cleanInsight(label) || String(url) };
      })
      .filter(Boolean)
      .slice(0, limit || 4);
    if (!values.length) return '';
    return `<div class="daka-comp-links">${values.map((item) => `<a href="${esc(item.url)}" target="_blank" rel="noopener" data-no-collapse="true">${esc(item.label || copy('open'))}</a>`).join('')}</div>`;
  }

  function countryLabel(item, currentLang) {
    return `${item.code} ${item.labels[currentLang] || item.labels.fr}`;
  }

  function hydrateCountries() {
    const select = document.getElementById('country');
    if (!select) return;
    const currentLang = lang();
    const currentValue = select.value || window.STATE?.lastInputs?.country || 'Morocco';
    select.innerHTML = COUNTRIES.map((item) => {
      const selected = item.value === currentValue ? ' selected' : '';
      return `<option value="${item.value}"${selected}>${esc(countryLabel(item, currentLang))}</option>`;
    }).join('');
    select.value = COUNTRIES.some((item) => item.value === currentValue) ? currentValue : 'Morocco';
    const note = document.getElementById('countrySelectNote');
    if (note) {
      note.textContent = copy('countryNote');
      note.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    }
  }

  function rewriteChrome() {
    const tab = document.getElementById('competitorsTab');
    if (!tab) return;
    const titleMain = tab.querySelector('[data-i18n="tab1_title"]');
    const titleHighlight = tab.querySelector('[data-i18n="tab1_title_highlight"]');
    const subtitle = tab.querySelector('[data-i18n="tab1_subtitle"]');
    if (titleMain) titleMain.textContent = copy('moduleTitle');
    if (titleHighlight) titleHighlight.textContent = copy('moduleHighlight');
    if (subtitle) subtitle.textContent = copy('moduleSubtitle');

    const labels = tab.querySelectorAll('.form-group .form-label');
    if (labels[0]) labels[0].textContent = copy('queryLabel');
    if (labels[1]) labels[1].textContent = copy('urlLabel');
    if (labels[2]) labels[2].textContent = copy('countryLabel');
    if (labels[3]) labels[3].textContent = copy('languageLabel');

    const keyword = document.getElementById('keyword');
    const url = document.getElementById('url');
    if (keyword) keyword.placeholder = copy('queryPlaceholder');
    if (url) url.placeholder = copy('urlPlaceholder');

    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
      const span = analyzeBtn.querySelector('span');
      if (span) span.textContent = copy('submit');
    }

    const legacyExport = document.getElementById('btn-export-competitors');
    if (legacyExport) legacyExport.style.display = 'none';

    hydrateCountries();
  }

  function collectContext() {
    const read = (id) => document.getElementById(id)?.value?.trim() || '';
    return {
      offer: read('compOffer'),
      audience: read('compAudience'),
      objective: read('compObjective'),
      priceRange: read('compPriceRange'),
      knownCompetitors: read('compKnownCompetitors')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5),
      cityOrRegion: read('compCityRegion')
    };
  }

  function fallbackDecision(intel, offerType) {
    const subject = cleanInsight(intel?.productMarketStudy?.subject || document.getElementById('keyword')?.value || '');
    const market = cleanInsight(intel?.geoInterpretation?.market || document.getElementById('country')?.value || '');
    if (lang() === 'ar') {
      const core = offerType === 'service' ? copy('serviceDecision') : copy('productDecision');
      return `${core}${subject ? ` حول "${subject}"` : ''}${market ? ` في ${market}` : ''}.`;
    }
    if (lang() === 'en') {
      const core = offerType === 'service' ? copy('serviceDecision') : copy('productDecision');
      return `${core}${subject ? ` around "${subject}"` : ''}${market ? ` in ${market}` : ''}.`;
    }
    const core = offerType === 'service' ? copy('serviceDecision') : copy('productDecision');
    return `${core}${subject ? ` autour de "${subject}"` : ''}${market ? ` en ${market}` : ''}.`;
  }

  function fallbackMove(offerType) {
    return offerType === 'service' ? copy('serviceMove') : copy('productMove');
  }

  function openingCards(intel, offerType) {
    const verdict = intel.marketVerdict || {};
    const attack = intel.recommendedAttackAngle || {};
    const answers = intel.finalAnswers || {};
    const actions = Array.isArray(intel.priorityActions) ? intel.priorityActions : [];
    const firstAction = actions.find((item) => useful(item?.action || item)) || list(answers.thisWeek, 1)[0] || list(answers.next30Days, 1)[0] || fallbackMove(offerType);
    return [
      {
        title: copy('whoCaptures'),
        value: cleanInsight(verdict.currentLeader || answers.whoWins),
        note: cleanInsight(verdict.marketPattern)
      },
      {
        title: copy('whyWinning'),
        value: list(verdict.whyTheyWin, 1)[0],
        note: cleanInsight(verdict.confidenceExplanation)
      },
      {
        title: copy('weakSpot'),
        value: list(answers.weaknesses || attack.whatTheyDoNotProve, 1)[0],
        note: cleanInsight(attack.promiseToMake)
      },
      {
        title: copy('nextMove'),
        value: normalizeItem(firstAction?.action || firstAction),
        note: cleanInsight(firstAction?.why || fallbackMove(offerType))
      }
    ].filter((item) => useful(item.value));
  }

  function executiveModel(intel, offerType) {
    const verdict = intel.marketVerdict || {};
    const attack = intel.recommendedAttackAngle || {};
    const answers = intel.finalAnswers || {};
    const actions = Array.isArray(intel.priorityActions) ? intel.priorityActions : [];
    const immediate = actions.filter((item) => !item.horizon || item.horizon === 'NOW').slice(0, 3);
    return {
      decision: cleanInsight(attack.positioningStatement || answers.positionToTake, fallbackDecision(intel, offerType)),
      lever: list(verdict.whyTheyWin, 1)[0],
      risk: list(answers.missingProofs || attack.proofsToAdd || answers.weaknesses, 1)[0],
      move: normalizeItem(immediate[0]?.action || immediate[0]) || fallbackMove(offerType),
      opportunities: list(intel.productMarketStudy?.exploitableOpenings, 3),
      weaknesses: list(answers.weaknesses || attack.whatTheyDoNotProve, 3),
      actions: immediate.map((item) => normalizeItem(item.action || item)).filter(useful).slice(0, 3)
    };
  }

  function splitStat(label, value) {
    const clean = cleanInsight(value);
    if (!useful(clean)) return '';
    return `<article class="daka-comp-stat-card"><span>${esc(label)}</span><strong>${esc(clean)}</strong></article>`;
  }

  function detailsSection(id, title, body, openByDefault) {
    if (!body) return '';
    return `
      <details class="daka-comp-section" id="${id}" ${openByDefault ? 'open' : ''}>
        <summary>
          <div class="daka-comp-section-head">
            <strong>${esc(title)}</strong>
          </div>
          <span class="daka-comp-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="daka-comp-section-body">
          ${body}
          <div class="daka-comp-section-footer">
            <button type="button" class="daka-comp-close" data-close-parent="${id}" data-no-collapse="true">${esc(copy('close'))}</button>
          </div>
        </div>
      </details>`;
  }

  function renderOpening(intel, offerType) {
    const cards = openingCards(intel, offerType);
    if (!cards.length) return '';
    const subject = cleanInsight(intel?.productMarketStudy?.subject || document.getElementById('keyword')?.value || '');
    const market = cleanInsight(intel?.geoInterpretation?.market || document.getElementById('country')?.value || '');
    const title = subject && market
      ? (lang() === 'ar'
        ? `من يهيمن على "${subject}" في ${market}؟`
        : lang() === 'en'
          ? `Who controls "${subject}" in ${market}?`
          : `Qui domine "${subject}" en ${market} ?`)
      : copy('moduleTitle');
    const geoNote = cleanInsight(intel?.geoInterpretation?.mismatchNote);
    return `
      <section class="daka-comp-opening" dir="${lang() === 'ar' ? 'rtl' : 'ltr'}">
        <div class="daka-comp-opening-top">
          <span class="daka-comp-kicker">${esc(copy('opening'))}</span>
          <h2>${esc(title)}</h2>
          <p>${esc(copy('openingHook'))}</p>
          ${geoNote ? `<div class="daka-comp-warning">${esc(geoNote)}</div>` : ''}
        </div>
        <div class="daka-comp-opening-grid">
          ${cards.map((card) => `
            <article class="daka-comp-pulse-card">
              <span>${esc(card.title)}</span>
              <strong>${esc(card.value)}</strong>
              ${card.note ? `<p>${esc(card.note)}</p>` : ''}
            </article>`).join('')}
        </div>
      </section>`;
  }

  function renderExecutive(intel, offerType) {
    const model = executiveModel(intel, offerType);
    const summaryCards = [
      splitStat(copy('decision'), model.decision),
      splitStat(copy('lever'), model.lever),
      splitStat(copy('risk'), model.risk),
      splitStat(copy('move'), model.move)
    ].filter(Boolean).join('');
    const columns = [
      model.opportunities.length ? `<article><h4>${esc(copy('opportunities'))}</h4>${bullets(model.opportunities, 'positive')}</article>` : '',
      model.weaknesses.length ? `<article><h4>${esc(copy('weaknesses'))}</h4>${bullets(model.weaknesses, 'alert')}</article>` : '',
      model.actions.length ? `<article><h4>${esc(copy('actions'))}</h4>${bullets(model.actions, 'neutral')}</article>` : ''
    ].filter(Boolean).join('');
    if (!summaryCards && !columns) return '';
    return `
      <section class="daka-comp-executive" dir="${lang() === 'ar' ? 'rtl' : 'ltr'}">
        <div class="daka-comp-summary-top">
          <span class="daka-comp-kicker">${esc(copy('executive'))}</span>
          <h3>${esc(copy('executiveTitle'))}</h3>
        </div>
        <div class="daka-comp-stat-grid">${summaryCards}</div>
        <div class="daka-comp-column-grid">${columns}</div>
      </section>`;
  }

  function renderMarketReading(intel) {
    const study = intel.productMarketStudy || {};
    const blocks = [
      list(study.observedDemandSignals).length ? `<article><h4>${esc(copy('observedDemand'))}</h4>${bullets(study.observedDemandSignals, 'positive')}</article>` : '',
      list(study.observedOfferPatterns).length ? `<article><h4>${esc(copy('dominantOffer'))}</h4>${bullets(study.observedOfferPatterns, 'neutral')}</article>` : '',
      list(study.buyerDecisionFactors).length ? `<article><h4>${esc(copy('decisionFactors'))}</h4>${bullets(study.buyerDecisionFactors, 'neutral')}</article>` : '',
      list(study.exploitableOpenings).length ? `<article><h4>${esc(copy('visibleObjections'))}</h4>${bullets(study.exploitableOpenings, 'alert')}</article>` : '',
      useful(intel.geoInterpretation?.mismatchNote) ? `<article class="daka-comp-note-card"><h4>${esc(copy('geoNote'))}</h4>${paragraph(intel.geoInterpretation.mismatchNote)}</article>` : ''
    ].filter(Boolean).join('');
    return detailsSection('comp-market-reading', copy('marketReading'), blocks, false);
  }

  function renderVerdict(intel) {
    const verdict = intel.marketVerdict || {};
    const leaderProfile = (intel.competitorProfiles || []).find((item) => useful(item?.domain)) || {};
    const header = [
      splitStat(copy('leader'), verdict.currentLeader),
      splitStat(copy('leaderStatus'), leaderProfile.geoMatched ? copy('localLeader') : copy('regionalBenchmark')),
      splitStat(copy('confidence'), verdict.confidence)
    ].filter(Boolean).join('');
    const detail = [
      header ? `<div class="daka-comp-stat-grid">${header}</div>` : '',
      list(verdict.whyTheyWin).length ? `<article><h4>${esc(copy('whyWinning'))}</h4>${bullets(verdict.whyTheyWin, 'positive')}</article>` : '',
      useful(verdict.confidenceExplanation) ? `<article class="daka-comp-note-card"><h4>${esc(copy('confidenceToCheck'))}</h4>${paragraph(verdict.confidenceExplanation)}</article>` : '',
      linkItems(verdict.evidenceLinks)
    ].filter(Boolean).join('');
    return detailsSection('comp-market-verdict', copy('marketVerdict'), detail, false);
  }

  function renderPositioning(intel) {
    const attack = intel.recommendedAttackAngle || {};
    const body = [
      list(attack.whatCompetitorsSell).length ? `<article><h4>${esc(copy('whatMarketSells'))}</h4>${bullets(attack.whatCompetitorsSell, 'neutral')}</article>` : '',
      list(attack.whatTheyDoNotProve).length ? `<article><h4>${esc(copy('weakProof'))}</h4>${bullets(attack.whatTheyDoNotProve, 'alert')}</article>` : '',
      useful(attack.promiseToMake) ? `<article><h4>${esc(copy('promiseToTake'))}</h4>${paragraph(attack.promiseToMake, 'daka-comp-emphasis')}</article>` : '',
      useful(attack.positioningStatement) || useful(fallbackDecision(intel, offerTypeFromInput(intel)))
        ? `<article><h4>${esc(copy('positionToTake'))}</h4>${paragraph(cleanInsight(attack.positioningStatement, fallbackDecision(intel, offerTypeFromInput(intel))), 'daka-comp-emphasis')}</article>` : '',
      list(attack.proofsToAdd).length ? `<article><h4>${esc(copy('proofsToAdd'))}</h4>${bullets(attack.proofsToAdd, 'neutral')}</article>` : ''
    ].filter(Boolean).join('');
    return detailsSection('comp-positioning', copy('positioning'), body, false);
  }

  function actionCard(item) {
    const title = normalizeItem(item?.action || item);
    if (!useful(title)) return '';
    const why = cleanInsight(item?.why);
    const meta = [item?.impact, item?.effort, item?.confidence]
      .map(cleanInsight)
      .filter(useful)
      .map((value) => `<span>${esc(value)}</span>`)
      .join('');
    return `
      <article class="daka-comp-action-card">
        <strong>${esc(title)}</strong>
        ${why ? `<p>${esc(why)}</p>` : ''}
        ${meta ? `<footer>${meta}</footer>` : ''}
      </article>`;
  }

  function renderActionPlan(intel, offerType) {
    const actions = Array.isArray(intel.priorityActions) ? intel.priorityActions : [];
    const groups = {
      NOW: actions.filter((item) => !item.horizon || item.horizon === 'NOW').slice(0, 3),
      DAYS7: actions.filter((item) => item.horizon === '7_DAYS').slice(0, 3),
      DAYS30: actions.filter((item) => item.horizon === '30_DAYS').slice(0, 3)
    };
    if (!groups.NOW.length && useful(fallbackMove(offerType))) {
      groups.NOW = [{ action: fallbackMove(offerType) }];
    }
    const body = [
      groups.NOW.length ? `<section><h4>${esc(copy('now'))}</h4><div class="daka-comp-card-grid">${groups.NOW.map(actionCard).join('')}</div></section>` : '',
      groups.DAYS7.length ? `<section><h4>${esc(copy('week'))}</h4><div class="daka-comp-card-grid">${groups.DAYS7.map(actionCard).join('')}</div></section>` : '',
      groups.DAYS30.length ? `<section><h4>${esc(copy('month'))}</h4><div class="daka-comp-card-grid">${groups.DAYS30.map(actionCard).join('')}</div></section>` : ''
    ].filter(Boolean).join('');
    return detailsSection('comp-action-plan', copy('actionPlan'), body, false);
  }

  function renderCompetitors(intel) {
    const profiles = (Array.isArray(intel.competitorProfiles) ? intel.competitorProfiles : [])
      .filter((item) => useful(item?.domain || item?.title))
      .slice(0, 5);
    if (!profiles.length) return '';
    const body = profiles.map((item, index) => {
      const evidence = linkItems(item.evidenceLinks);
      const grid = [
        splitStat(copy('whatSell'), item.whatTheySell),
        splitStat(copy('promise'), item.primaryPromise),
        splitStat(copy('strength'), list(item.observedStrengths, 1)[0]),
        splitStat(copy('weakness'), list(item.deducedWeaknesses, 1)[0]),
        splitStat(copy('angle'), item.attackAngle),
        splitStat(copy('proofsToAdd'), list(item.missingProofs, 1)[0])
      ].filter(Boolean).join('');
      return `
        <article class="daka-comp-profile">
          <header>
            <div class="daka-comp-profile-head">
              <span class="daka-comp-rank">${String(index + 1).padStart(2, '0')}</span>
              <div>
                <h4>${esc(item.domain || item.title || '')}</h4>
                <small>${esc(item.geoMatched ? copy('directType') : copy('benchmarkType'))}</small>
              </div>
            </div>
            ${useful(item.confidence) ? `<span class="daka-comp-badge">${esc(item.confidence)}</span>` : ''}
          </header>
          <div class="daka-comp-stat-grid">${grid}</div>
          ${evidence}
        </article>`;
    }).join('');
    return detailsSection('comp-direct-competitors', copy('directCompetitors'), body, false);
  }

  function sourceGroups(intel) {
    const surveillance = intel.surveillance || {};
    return [
      { title: copy('benchmarkType'), items: surveillance.competitors || [] },
      { title: copy('distributionType'), items: surveillance.distributionChannels || [] },
      { title: copy('socialType'), items: surveillance.socialSources || [] },
      { title: copy('marketType'), items: surveillance.marketSources || [] }
    ];
  }

  function renderSources(intel) {
    const blocks = sourceGroups(intel).map((group) => {
      const items = (Array.isArray(group.items) ? group.items : [])
        .map((item) => ({
          domain: cleanInsight(item.domain || item.title || item.url || ''),
          url: item.url,
          role: cleanInsight(item.role || item.typeLabel || ''),
          use: cleanInsight(item.recommendedUse || item.rejectionReason || '')
        }))
        .filter((item) => useful(item.domain));
      if (!items.length) return '';
      return `
        <section class="daka-comp-source-group">
          <h4>${esc(group.title)} <span>${items.length}</span></h4>
          <div class="daka-comp-card-grid">
            ${items.map((item) => `
              <article class="daka-comp-source-card">
                <strong>${esc(item.domain)}</strong>
                ${useful(item.role) ? `<p><span>${esc(copy('role'))}</span> ${esc(item.role)}</p>` : ''}
                ${useful(item.use) ? `<p><span>${esc(copy('use'))}</span> ${esc(item.use)}</p>` : ''}
                ${useful(item.url) ? `<a href="${esc(item.url)}" target="_blank" rel="noopener" data-no-collapse="true">${esc(copy('open'))}</a>` : ''}
              </article>`).join('')}
          </div>
        </section>`;
    }).filter(Boolean).join('');
    return detailsSection('comp-source-deck', copy('sourceDeck'), blocks, false);
  }

  function renderProductStudy(intel) {
    const study = intel.productMarketStudy || {};
    const body = [
      list(study.observedDemandSignals).length ? `<article><h4>${esc(copy('observedDemand'))}</h4>${bullets(study.observedDemandSignals, 'positive')}</article>` : '',
      list(study.observedOfferPatterns).length ? `<article><h4>${esc(copy('dominantOffer'))}</h4>${bullets(study.observedOfferPatterns, 'neutral')}</article>` : '',
      list(study.buyerDecisionFactors).length ? `<article><h4>${esc(copy('decisionFactors'))}</h4>${bullets(study.buyerDecisionFactors, 'neutral')}</article>` : '',
      linkItems(study.evidenceLinks)
    ].filter(Boolean).join('');
    return detailsSection('comp-product-study', copy('productStudy'), body, false);
  }

  function renderMissingProofs(intel) {
    const missing = list(intel?.finalAnswers?.missingProofs || intel?.recommendedAttackAngle?.proofsToAdd, 6);
    if (!missing.length) return '';
    return detailsSection('comp-missing-proofs', copy('missingProofs'), bullets(missing, 'alert'), false);
  }

  function renderFinalAnswers(intel) {
    const answers = intel.finalAnswers || {};
    const rows = [
      { title: copy('finalWhoWins'), value: answers.whoWins },
      { title: copy('finalWhyWins'), value: answers.whyTheyWin },
      { title: copy('finalAttack'), value: answers.weaknesses },
      { title: copy('finalPosition'), value: answers.positionToTake },
      { title: copy('finalWeek'), value: answers.thisWeek },
      { title: copy('finalMonth'), value: answers.next30Days },
      { title: copy('finalProofs'), value: answers.missingProofs }
    ].filter((item) => useful(item.value) || list(item.value).length);
    if (!rows.length) return '';
    const body = rows.map((item) => `
      <article class="daka-comp-answer-card">
        <strong>${esc(item.title)}</strong>
        ${Array.isArray(item.value) ? bullets(item.value, 'neutral') : paragraph(item.value)}
      </article>`).join('');
    return detailsSection('comp-final-answers', copy('finalAnswers'), body, true);
  }

  function injectStyles() {
    if (document.getElementById(`${MODULE_ID}-styles`)) return;
    const style = document.createElement('style');
    style.id = `${MODULE_ID}-styles`;
    style.textContent = `
      #resultsCompetitors {
        display: none;
        margin-top: 24px;
      }
      #resultsCompetitors .daka-comp-opening,
      #resultsCompetitors .daka-comp-executive,
      #resultsCompetitors .daka-comp-section {
        border: 1px solid rgba(96, 165, 250, 0.18);
        background:
          radial-gradient(circle at top left, rgba(34, 211, 238, 0.10), transparent 26%),
          radial-gradient(circle at top right, rgba(139, 92, 246, 0.12), transparent 22%),
          linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(8, 14, 29, 0.98));
        box-shadow: 0 28px 70px rgba(2, 6, 23, 0.44);
        border-radius: 26px;
        overflow: hidden;
        margin: 22px 0;
      }
      #resultsCompetitors .daka-comp-opening,
      #resultsCompetitors .daka-comp-executive {
        padding: 28px;
      }
      #resultsCompetitors .daka-comp-kicker {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(34, 211, 238, 0.18);
        color: #67e8f9;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.03em;
      }
      #resultsCompetitors h2,
      #resultsCompetitors h3,
      #resultsCompetitors h4,
      #resultsCompetitors strong,
      #resultsCompetitors span,
      #resultsCompetitors small,
      #resultsCompetitors p,
      #resultsCompetitors li,
      #resultsCompetitors a {
        letter-spacing: 0;
      }
      #resultsCompetitors .daka-comp-opening h2,
      #resultsCompetitors .daka-comp-executive h3 {
        margin: 18px 0 8px;
        color: #f8fafc;
        font-size: clamp(1.42rem, 2vw, 2.4rem);
        line-height: 1.14;
      }
      #resultsCompetitors .daka-comp-opening p,
      #resultsCompetitors .daka-comp-executive p,
      #resultsCompetitors .daka-comp-section-body p,
      #resultsCompetitors .daka-comp-bullets li {
        color: #cbd5e1;
        line-height: 1.78;
        font-size: 0.97rem;
      }
      #resultsCompetitors .daka-comp-opening-grid,
      #resultsCompetitors .daka-comp-stat-grid,
      #resultsCompetitors .daka-comp-column-grid,
      #resultsCompetitors .daka-comp-card-grid {
        display: grid;
        gap: 16px;
      }
      #resultsCompetitors .daka-comp-opening-grid,
      #resultsCompetitors .daka-comp-stat-grid,
      #resultsCompetitors .daka-comp-card-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      #resultsCompetitors .daka-comp-column-grid {
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        margin-top: 22px;
      }
      #resultsCompetitors .daka-comp-pulse-card,
      #resultsCompetitors .daka-comp-stat-card,
      #resultsCompetitors .daka-comp-action-card,
      #resultsCompetitors .daka-comp-profile,
      #resultsCompetitors .daka-comp-source-card,
      #resultsCompetitors .daka-comp-answer-card,
      #resultsCompetitors .daka-comp-note-card {
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(15, 23, 42, 0.7);
        border-radius: 20px;
        padding: 18px;
        min-height: 100%;
        transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
      }
      @media (hover: hover) {
        #resultsCompetitors .daka-comp-pulse-card:hover,
        #resultsCompetitors .daka-comp-stat-card:hover,
        #resultsCompetitors .daka-comp-action-card:hover,
        #resultsCompetitors .daka-comp-profile:hover,
        #resultsCompetitors .daka-comp-source-card:hover,
        #resultsCompetitors .daka-comp-answer-card:hover,
        #resultsCompetitors .daka-comp-note-card:hover {
          transform: translateY(-2px);
          border-color: rgba(34, 211, 238, 0.34);
          box-shadow: 0 16px 40px rgba(2, 6, 23, 0.25);
        }
      }
      #resultsCompetitors .daka-comp-pulse-card span,
      #resultsCompetitors .daka-comp-stat-card span,
      #resultsCompetitors .daka-comp-source-card span,
      #resultsCompetitors .daka-comp-answer-card span {
        display: inline-block;
        color: #67e8f9;
        font-size: 0.78rem;
        font-weight: 800;
        margin-bottom: 10px;
      }
      #resultsCompetitors .daka-comp-pulse-card strong,
      #resultsCompetitors .daka-comp-stat-card strong,
      #resultsCompetitors .daka-comp-action-card strong,
      #resultsCompetitors .daka-comp-profile strong,
      #resultsCompetitors .daka-comp-answer-card strong {
        display: block;
        color: #f8fafc;
        font-size: 1rem;
        line-height: 1.5;
      }
      #resultsCompetitors .daka-comp-warning {
        margin-top: 16px;
        border: 1px solid rgba(245, 158, 11, 0.25);
        background: rgba(120, 53, 15, 0.22);
        color: #fde68a;
        border-radius: 18px;
        padding: 14px 16px;
      }
      #resultsCompetitors .daka-comp-bullets {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 10px;
      }
      #resultsCompetitors .daka-comp-bullets li {
        position: relative;
        padding: 12px 14px 12px 18px;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(15, 23, 42, 0.58);
      }
      #resultsCompetitors .daka-comp-bullets li::before {
        content: '';
        position: absolute;
        top: 18px;
        left: 8px;
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #67e8f9;
      }
      #resultsCompetitors [dir="rtl"] .daka-comp-bullets li {
        padding: 12px 18px 12px 14px;
      }
      #resultsCompetitors [dir="rtl"] .daka-comp-bullets li::before {
        left: auto;
        right: 8px;
      }
      #resultsCompetitors .tone-positive li::before { background: #22c55e; }
      #resultsCompetitors .tone-alert li::before { background: #f59e0b; }
      #resultsCompetitors .daka-comp-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }
      #resultsCompetitors .daka-comp-links a,
      #resultsCompetitors .daka-comp-source-card a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 0 14px;
        border-radius: 12px;
        border: 1px solid rgba(34, 211, 238, 0.22);
        background: rgba(15, 23, 42, 0.9);
        color: #67e8f9;
        text-decoration: none;
        font-weight: 700;
      }
      #resultsCompetitors .daka-comp-section summary {
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 20px 24px;
        cursor: pointer;
      }
      #resultsCompetitors .daka-comp-section summary::-webkit-details-marker {
        display: none;
      }
      #resultsCompetitors .daka-comp-section-head strong {
        color: #f8fafc;
        font-size: 1.06rem;
      }
      #resultsCompetitors .daka-comp-chevron {
        color: #94a3b8;
        font-size: 1.5rem;
        line-height: 1;
        transition: transform 180ms ease;
      }
      #resultsCompetitors .daka-comp-section[open] .daka-comp-chevron {
        transform: rotate(180deg);
      }
      #resultsCompetitors .daka-comp-section-body {
        padding: 0 24px 22px;
        display: grid;
        gap: 16px;
      }
      #resultsCompetitors .daka-comp-section-footer {
        display: flex;
        justify-content: flex-end;
      }
      #resultsCompetitors .daka-comp-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        background: rgba(15, 23, 42, 0.92);
        color: #e2e8f0;
        font-weight: 800;
        cursor: pointer;
      }
      #resultsCompetitors .daka-comp-profile header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 18px;
      }
      #resultsCompetitors .daka-comp-profile-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #resultsCompetitors .daka-comp-rank,
      #resultsCompetitors .daka-comp-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 42px;
        min-height: 42px;
        border-radius: 14px;
        background: rgba(34, 211, 238, 0.12);
        border: 1px solid rgba(34, 211, 238, 0.18);
        color: #67e8f9;
        font-weight: 900;
      }
      #resultsCompetitors .daka-comp-profile h4,
      #resultsCompetitors .daka-comp-source-group h4 {
        margin: 0;
        color: #f8fafc;
        font-size: 1rem;
      }
      #resultsCompetitors .daka-comp-profile small,
      #resultsCompetitors .daka-comp-source-card p,
      #resultsCompetitors .daka-comp-profile p {
        color: #94a3b8;
      }
      #resultsCompetitors .daka-comp-source-group h4 span {
        color: #67e8f9;
      }
      #resultsCompetitors .daka-comp-emphasis {
        color: #f8fafc;
        font-weight: 700;
      }
      #resultsCompetitors .daka-comp-empty {
        border: 1px dashed rgba(148, 163, 184, 0.2);
        border-radius: 20px;
        padding: 18px;
        color: #94a3b8;
      }
      @media (max-width: 720px) {
        #resultsCompetitors .daka-comp-opening,
        #resultsCompetitors .daka-comp-executive {
          padding: 20px;
        }
        #resultsCompetitors .daka-comp-section summary,
        #resultsCompetitors .daka-comp-section-body {
          padding-left: 18px;
          padding-right: 18px;
        }
        #resultsCompetitors .daka-comp-opening-grid,
        #resultsCompetitors .daka-comp-stat-grid,
        #resultsCompetitors .daka-comp-card-grid,
        #resultsCompetitors .daka-comp-column-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #resultsCompetitors * {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderCompetitorReport(data) {
    const container = document.getElementById('resultsCompetitors');
    if (!container) return;
    const repaired = typeof window.deepRepairMojibake === 'function' ? window.deepRepairMojibake(data || {}) : (data || {});
    const intel = repaired.competitorIntelligence || {};
    const offerType = offerTypeFromInput(intel);
    const html = [
      renderOpening(intel, offerType),
      renderExecutive(intel, offerType),
      renderMarketReading(intel),
      renderVerdict(intel),
      renderPositioning(intel),
      renderActionPlan(intel, offerType),
      renderCompetitors(intel),
      renderSources(intel),
      renderProductStudy(intel),
      renderMissingProofs(intel),
      renderFinalAnswers(intel)
    ].filter(Boolean).join('');

    container.innerHTML = html || `<section class="daka-comp-executive"><div class="daka-comp-empty">${esc(copy('noData'))}</div></section>`;
    container.style.display = 'block';
    container.dir = lang() === 'ar' ? 'rtl' : 'ltr';
    container.setAttribute('lang', lang());
    container.querySelectorAll('[data-close-parent]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const id = button.getAttribute('data-close-parent');
        const parent = id ? document.getElementById(id) : button.closest('details');
        if (parent) parent.open = false;
      });
    });
  }

  async function requestCompetitorReport(payload) {
    if (typeof window.api?.request === 'function') {
      return window.api.request('/api/competitors', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeout: 180000
      });
    }
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    if (STATE.inFlight) return;

    const keyword = document.getElementById('keyword')?.value?.trim() || '';
    const url = document.getElementById('url')?.value?.trim() || '';
    const country = document.getElementById('country')?.value || 'Morocco';
    if (!keyword && !url) {
      window.toast?.warning(lang() === 'ar' ? 'أدخل عبارة بحث أو رابطا على الأقل.' : lang() === 'en' ? 'Add at least a query or a URL.' : 'Ajoute au moins une requête ou une URL.');
      return;
    }

    STATE.inFlight = true;
    if (window.STATE) window.STATE.competitorAnalysisInFlight = true;
    const button = document.getElementById('analyzeBtn');
    const exportButton = document.getElementById('btn-export-competitors-pdf');
    const container = document.getElementById('resultsCompetitors');

    try {
      if (typeof window.resetAnalysis === 'function') window.resetAnalysis('competitors');
      if (typeof window.setButtonLoading === 'function') window.setButtonLoading('analyzeBtn', true);
      else if (button) button.disabled = true;

      if (typeof window.showDakaLoader === 'function') window.showDakaLoader('competitors');
      if (container) {
        container.style.display = 'block';
        container.dir = lang() === 'ar' ? 'rtl' : 'ltr';
        container.innerHTML = `<section class="daka-comp-executive"><span class="daka-comp-kicker">${esc(copy('opening'))}</span><h3>${esc(copy('loading'))}</h3></section>`;
      }
      if (exportButton) exportButton.style.display = 'none';

      const response = await requestCompetitorReport({
        query: keyword || url,
        url: url || null,
        geo: country,
        lang: lang(),
        context: collectContext(),
        forceRefresh: false
      });

      if (!response || response.success === false) {
        throw new Error(response?.message || response?.details || response?.error || 'COMPETITOR_FAILED');
      }

      response.analysisLang = lang();
      if (window.STATE) {
        window.STATE.currentLang = lang();
        window.STATE.lastAnalysisResults = response;
        window.STATE.lastActiveModule = 'competitors';
        window.STATE.lastInputs = window.STATE.lastInputs || {};
        window.STATE.lastInputs.keyword = keyword;
        window.STATE.lastInputs.url = url;
        window.STATE.lastInputs.country = country;
        window.STATE.lastInputs.compLang = lang();
      }

      renderCompetitorReport(response);
      if (exportButton) exportButton.style.display = 'inline-flex';
      window.toast?.success(copy('reportReady'));
    } catch (error) {
      console.error('[competitor-refonte]', error);
      if (container) {
        container.style.display = 'block';
        container.innerHTML = `<section class="daka-comp-executive"><span class="daka-comp-kicker">${esc(copy('opening'))}</span><h3>${esc(copy('errorPrefix'))}</h3><p>${esc(fixText(error?.message || 'Unknown error'))}</p></section>`;
      }
      window.toast?.error(`${copy('errorPrefix')}: ${fixText(error?.message || 'Unknown error')}`);
    } finally {
      STATE.inFlight = false;
      if (window.STATE) window.STATE.competitorAnalysisInFlight = false;
      if (typeof window.hideDakaLoader === 'function') window.hideDakaLoader();
      if (typeof window.setButtonLoading === 'function') window.setButtonLoading('analyzeBtn', false);
      else if (button) button.disabled = false;
    }
  }

  function bind() {
    injectStyles();
    rewriteChrome();

    const form = document.getElementById('competitorsForm');
    if (form) {
      form.onsubmit = null;
      form.addEventListener('submit', handleSubmit, true);
    }

    document.getElementById('analysisLang')?.addEventListener('change', () => {
      if (window.STATE) window.STATE.currentLang = lang();
      rewriteChrome();
    });
    document.getElementById('country')?.addEventListener('change', hydrateCountries);

    window.displayCompetitorsResults = renderCompetitorReport;
    window.analyzeCompetitors = handleSubmit;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
