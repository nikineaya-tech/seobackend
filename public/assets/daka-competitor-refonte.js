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
      analyzeAction: 'Analyser',
      auditAction: 'Audit technique',
      keywordsAction: 'G\u00e9n\u00e9rer des mots-cl\u00e9s',
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
      analyzeAction: 'Analyze',
      auditAction: 'Technical audit',
      keywordsAction: 'Generate keywords',
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
      analyzeAction: '\u062a\u062d\u0644\u064a\u0644',
      auditAction: '\u062a\u062f\u0642\u064a\u0642 \u062a\u0642\u0646\u064a',
      keywordsAction: '\u062a\u0648\u0644\u064a\u062f \u0627\u0644\u0643\u0644\u0645\u0627\u062a \u0627\u0644\u0645\u0641\u062a\u0627\u062d\u064a\u0629',
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

  const EXTRA_COPY = {
    fr: {
      userBenchmark: 'Votre site : benchmark direct',
      userBenchmarkNote: 'Ce site a ete lu et integre a la comparaison sans etre classe comme concurrent.',
      sameProducts: 'Pages du meme produit ou de la meme offre',
      suppliers: 'Fournisseurs et distributeurs locaux',
      marketplaces: 'Marketplaces et revendeurs locaux',
      videos: 'Videos produit du marche cible',
      fieldProof: 'Sources et preuves du marche cible',
      foreignBenchmarks: 'Benchmarks etrangers (aucune source locale confirmee)',
      strategicStudies: 'Etudes strategiques approfondies',
      reverseEngineering: 'Reverse engineering du Top 3',
      grandSlam: 'Architecture de l offre',
      productAudit: 'Audit produit ou service',
      mastering: 'Techniques d acquisition et de retention',
      duel: 'Duel strategique, JTBD, Kano et AARRR',
      swot: 'SWOT offensif',
      blueOcean: 'Strategie Blue Ocean et matrice ERRC',
      comparison: 'Rapport de forces',
      semantic: 'Ecarts semantiques exploitables',
      keywordStrategy: 'Strategie de recherche et de contenu',
      roadmap: 'Feuille de route historique restauree',
      marketIntelStudies: 'Etudes marche, preuves et signaux terrain',
      marketInsights: 'Lecture factuelle du marche',
      marketDynamics: 'Dynamiques et tensions du marche',
      winningMove: 'Mouvement strategique gagnant',
      leaderMoat: 'Charte de puissance du leader',
      knowledgeGraph: 'Graphe de connaissance du marche',
      proofModel: 'Registre des preuves',
      fieldSignals: 'Publicites, avis et signaux terrain',
      googleSignals: 'Signaux Google et demande observee',
      localConfirmed: 'Local confirme',
      localProbable: 'Local probable',
      foreignBenchmark: 'Benchmark etranger',
      excludedGeo: 'Sources etrangeres isolees',
      openSource: 'Consulter la source',
      observedEvidence: 'Preuve observee'
    },
    en: {
      userBenchmark: 'Your website: direct benchmark',
      userBenchmarkNote: 'This website was read and included in the comparison without being classified as a competitor.',
      sameProducts: 'Same-product or same-offer pages',
      suppliers: 'Local suppliers and distributors',
      marketplaces: 'Local marketplaces and resellers',
      videos: 'Product videos in the target market',
      fieldProof: 'Target-market sources and proof',
      foreignBenchmarks: 'Foreign benchmarks (no local source confirmed)',
      strategicStudies: 'Deep strategic studies',
      reverseEngineering: 'Top 3 reverse engineering',
      grandSlam: 'Offer architecture',
      productAudit: 'Product or service audit',
      mastering: 'Acquisition and retention techniques',
      duel: 'Strategic duel, JTBD, Kano, and AARRR',
      swot: 'Offensive SWOT',
      blueOcean: 'Blue Ocean strategy and ERRC matrix',
      comparison: 'Competitive balance of power',
      semantic: 'Exploitable semantic gaps',
      keywordStrategy: 'Search and content strategy',
      roadmap: 'Restored historical roadmap',
      marketIntelStudies: 'Market studies, proof, and field signals',
      marketInsights: 'Evidence-based market reading',
      marketDynamics: 'Market dynamics and tensions',
      winningMove: 'Winning strategic move',
      leaderMoat: 'Leader power charter',
      knowledgeGraph: 'Market knowledge graph',
      proofModel: 'Proof register',
      fieldSignals: 'Ads, reviews, and field signals',
      googleSignals: 'Google signals and observed demand',
      localConfirmed: 'Confirmed local',
      localProbable: 'Probable local',
      foreignBenchmark: 'Foreign benchmark',
      excludedGeo: 'Foreign sources isolated',
      openSource: 'Open source',
      observedEvidence: 'Observed evidence'
    },
    ar: {
      userBenchmark: '\u0645\u0648\u0642\u0639\u0643: \u0645\u0631\u062c\u0639 \u0644\u0644\u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629',
      userBenchmarkNote: '\u062a\u0645\u062a \u0642\u0631\u0627\u0621\u0629 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0642\u0639 \u0648\u0625\u062f\u0645\u0627\u062c\u0647 \u0641\u064a \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629 \u062f\u0648\u0646 \u062a\u0635\u0646\u064a\u0641\u0647 \u0643\u0645\u0646\u0627\u0641\u0633.',
      sameProducts: '\u0635\u0641\u062d\u0627\u062a \u0627\u0644\u0645\u0646\u062a\u062c \u0623\u0648 \u0627\u0644\u0639\u0631\u0636 \u0646\u0641\u0633\u0647',
      suppliers: '\u0627\u0644\u0645\u0648\u0631\u062f\u0648\u0646 \u0648\u0627\u0644\u0645\u0648\u0632\u0639\u0648\u0646 \u0627\u0644\u0645\u062d\u0644\u064a\u0648\u0646',
      marketplaces: '\u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0629 \u0648\u0627\u0644\u0628\u0627\u0626\u0639\u0648\u0646 \u0627\u0644\u0645\u062d\u0644\u064a\u0648\u0646',
      videos: '\u0641\u064a\u062f\u064a\u0648\u0647\u0627\u062a \u0627\u0644\u0645\u0646\u062a\u062c \u0641\u064a \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641',
      fieldProof: '\u0645\u0635\u0627\u062f\u0631 \u0648\u0623\u062f\u0644\u0629 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641',
      foreignBenchmarks: '\u0645\u0631\u0627\u062c\u0639 \u0623\u062c\u0646\u0628\u064a\u0629 (\u0644\u0645 \u064a\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0645\u0635\u062f\u0631 \u0645\u062d\u0644\u064a)',
      strategicStudies: '\u062f\u0631\u0627\u0633\u0627\u062a \u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0645\u0639\u0645\u0642\u0629',
      reverseEngineering: '\u062a\u0641\u0643\u064a\u0643 \u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0623\u0642\u0648\u0649 3 \u0645\u0646\u0627\u0641\u0633\u064a\u0646',
      grandSlam: '\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0639\u0631\u0636',
      productAudit: '\u062a\u062f\u0642\u064a\u0642 \u0627\u0644\u0645\u0646\u062a\u062c \u0623\u0648 \u0627\u0644\u062e\u062f\u0645\u0629',
      mastering: '\u062a\u0642\u0646\u064a\u0627\u062a \u0627\u0644\u0627\u0643\u062a\u0633\u0627\u0628 \u0648\u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638',
      duel: '\u0627\u0644\u0645\u0648\u0627\u062c\u0647\u0629 \u0627\u0644\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0648 JTBD \u0648 Kano \u0648 AARRR',
      swot: '\u062a\u062d\u0644\u064a\u0644 SWOT \u0627\u0644\u0647\u062c\u0648\u0645\u064a',
      blueOcean: '\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0627\u0644\u0645\u062d\u064a\u0637 \u0627\u0644\u0623\u0632\u0631\u0642 \u0648\u0645\u0635\u0641\u0648\u0641\u0629 ERRC',
      comparison: '\u0645\u064a\u0632\u0627\u0646 \u0627\u0644\u0642\u0648\u0649 \u0627\u0644\u062a\u0646\u0627\u0641\u0633\u064a',
      semantic: '\u0627\u0644\u0641\u062c\u0648\u0627\u062a \u0627\u0644\u062f\u0644\u0627\u0644\u064a\u0629 \u0627\u0644\u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u063a\u0644\u0627\u0644',
      keywordStrategy: '\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0627\u0644\u0628\u062d\u062b \u0648\u0627\u0644\u0645\u062d\u062a\u0648\u0649',
      roadmap: '\u062e\u0627\u0631\u0637\u0629 \u0627\u0644\u0637\u0631\u064a\u0642 \u0627\u0644\u062a\u0627\u0631\u064a\u062e\u064a\u0629 \u0627\u0644\u0645\u0633\u062a\u0639\u0627\u062f\u0629',
      marketIntelStudies: '\u062f\u0631\u0627\u0633\u0627\u062a \u0627\u0644\u0633\u0648\u0642 \u0648\u0627\u0644\u0623\u062f\u0644\u0629 \u0648\u0627\u0644\u0625\u0634\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u064a\u062f\u0627\u0646\u064a\u0629',
      marketInsights: '\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0628\u0646\u064a\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629',
      marketDynamics: '\u062f\u064a\u0646\u0627\u0645\u064a\u0643\u064a\u0627\u062a \u0627\u0644\u0633\u0648\u0642 \u0648\u062a\u0648\u062a\u0631\u0627\u062a\u0647',
      winningMove: '\u0627\u0644\u062d\u0631\u0643\u0629 \u0627\u0644\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0627\u0644\u0631\u0627\u0628\u062d\u0629',
      leaderMoat: '\u0645\u064a\u062b\u0627\u0642 \u0642\u0648\u0629 \u0627\u0644\u0645\u062a\u0635\u062f\u0631',
      knowledgeGraph: '\u062e\u0631\u064a\u0637\u0629 \u0645\u0639\u0631\u0641\u0629 \u0627\u0644\u0633\u0648\u0642',
      proofModel: '\u0633\u062c\u0644 \u0627\u0644\u0623\u062f\u0644\u0629',
      fieldSignals: '\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062a \u0648\u0627\u0644\u0622\u0631\u0627\u0621 \u0648\u0627\u0644\u0625\u0634\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u064a\u062f\u0627\u0646\u064a\u0629',
      googleSignals: '\u0625\u0634\u0627\u0631\u0627\u062a Google \u0648\u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u0631\u0635\u0648\u062f',
      localConfirmed: '\u0645\u062d\u0644\u064a \u0645\u0624\u0643\u062f',
      localProbable: '\u0645\u062d\u0644\u064a \u0645\u0631\u062c\u062d',
      foreignBenchmark: '\u0645\u0631\u062c\u0639 \u0623\u062c\u0646\u0628\u064a',
      excludedGeo: '\u0645\u0635\u0627\u062f\u0631 \u0623\u062c\u0646\u0628\u064a\u0629 \u062a\u0645 \u0639\u0632\u0644\u0647\u0627',
      openSource: '\u0641\u062a\u062d \u0627\u0644\u0645\u0635\u062f\u0631',
      observedEvidence: '\u0627\u0644\u062f\u0644\u064a\u0644 \u0627\u0644\u0645\u0631\u0635\u0648\u062f'
    }
  };

  const STATE = { inFlight: false, renderToken: null };

  function lang() {
    const value = document.getElementById('analysisLang')?.value || window.STATE?.currentLang || 'fr';
    return LANGS.includes(value) ? value : 'fr';
  }

  function copy(key) {
    return fixText(COPY[lang()]?.[key] || COPY.fr[key] || key);
  }

  function extraCopy(key) {
    return fixText(EXTRA_COPY[lang()]?.[key] || EXTRA_COPY.fr[key] || key);
  }

  function looksBroken(value) {
    if (/(?:\u00c3.|\u00c2.|\u00e2.|\u00f0.|\u00d8.|\u00d9.)/.test(String(value || ''))) return true;
    return /(?:Ã|Â|â|Ø|Ù|ð|Å“|Æ’|’|–|—|“|”|·)/.test(String(value || ''));
  }

  function fixText(value) {
    if (value === null || value === undefined) return '';
    let text = String(value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (typeof window.repairMojibakeString === 'function') {
      const repaired = window.repairMojibakeString(text);
      if (repaired) text = repaired;
    }
    if (typeof TextDecoder !== 'undefined') {
      for (let pass = 0; pass < 3 && looksBroken(text); pass += 1) {
        try {
          const bytes = new Uint8Array(Array.from(text).map((char) => char.charCodeAt(0) & 255));
          const decoded = new TextDecoder('utf-8').decode(bytes).replace(/\s+/g, ' ').trim();
          if (!decoded || decoded === text) break;
          text = decoded;
        } catch (_) {
          break;
        }
      }
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
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (typeof value === 'boolean') return value;
    const text = fixText(value).replace(/[.*_`#]/g, '').trim();
    if (!text) return false;
    if (/^(?:non trouve|non detecte|indisponible|\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631|\u0644\u0627 \u064a\u0648\u062c\u062f|\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631|false)$/i.test(text)) return false;
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

  function matchesReportLanguage(text) {
    const value = fixText(text);
    if (!value || /^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(value)) return true;
    if (value.length < 28) return true;
    const arabicLetters = (value.match(/[\u0600-\u06ff]/g) || []).length;
    const latinLetters = (value.match(/[A-Za-z\u00c0-\u024f]/g) || []).length;
    if (lang() === 'ar') return arabicLetters > 0 || latinLetters < 18;
    return arabicLetters < Math.max(8, latinLetters * 0.35);
  }

  function cleanInsight(value, fallback = '') {
    const text = fixText(value);
    if (!useful(text) || mixedLanguageNoise(text) || genericCompetitorNoise(text) || !matchesReportLanguage(text)) return fixText(fallback);
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

  function openingCards(intel, offerType) {
    const verdict = intel.marketVerdict || {};
    const attack = intel.recommendedAttackAngle || {};
    const answers = intel.finalAnswers || {};
    const actions = Array.isArray(intel.priorityActions) ? intel.priorityActions : [];
    const firstAction = actions.find((item) => useful(item?.action || item)) || list(answers.thisWeek, 1)[0] || list(answers.next30Days, 1)[0] || '';
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
        note: cleanInsight(firstAction?.why || '')
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
      decision: cleanInsight(attack.positioningStatement || answers.positionToTake),
      lever: list(verdict.whyTheyWin, 1)[0],
      risk: list(answers.missingProofs || attack.proofsToAdd || answers.weaknesses, 1)[0],
      move: normalizeItem(immediate[0]?.action || immediate[0]),
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

  function openingHook(intel) {
    const subject = cleanInsight(intel?.productMarketStudy?.subject || document.getElementById('keyword')?.value || '');
    const market = cleanInsight(intel?.geoInterpretation?.market || document.getElementById('country')?.value || '');
    const leader = cleanInsight(intel?.marketVerdict?.currentLeader);
    if (lang() === 'ar') {
      return subject && market
        ? `قراءة مركزة لـ «${subject}» في ${market}: من يجذب الطلب، ما الذي يثبته، وما الفرصة القابلة للاختبار الآن${leader ? ` أمام ${leader}` : ''}.`
        : 'قراءة مركزة لإشارات الطلب والعرض والأدلة التي يمكن تحويلها إلى قرار عملي.';
    }
    if (lang() === 'en') {
      return subject && market
        ? `A focused read of “${subject}” in ${market}: who captures demand, what is actually proven, and which opening can be tested now${leader ? ` against ${leader}` : ''}.`
        : 'A focused read of demand, offer, and proof signals that can become a practical decision.';
    }
    return subject && market
      ? `Lecture ciblée de « ${subject} » au ${market} : qui capte la demande, ce qui est réellement prouvé et l’ouverture à tester maintenant${leader ? ` face à ${leader}` : ''}.`
      : 'Lecture ciblée des signaux de demande, d’offre et de preuve qui peuvent devenir une décision concrète.';
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
           <p>${esc(openingHook(intel))}</p>
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
    const leaderProfiles = Array.isArray(intel.competitorProfiles) && intel.competitorProfiles.length
      ? intel.competitorProfiles
      : (Array.isArray(intel.top10Competitors) ? intel.top10Competitors : []);
    const leaderProfile = leaderProfiles.find((item) => useful(item?.domain)) || {};
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
      useful(attack.positioningStatement)
        ? `<article><h4>${esc(copy('positionToTake'))}</h4>${paragraph(cleanInsight(attack.positioningStatement), 'daka-comp-emphasis')}</article>` : '',
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
    const body = [
      groups.NOW.length ? `<section><h4>${esc(copy('now'))}</h4><div class="daka-comp-card-grid">${groups.NOW.map(actionCard).join('')}</div></section>` : '',
      groups.DAYS7.length ? `<section><h4>${esc(copy('week'))}</h4><div class="daka-comp-card-grid">${groups.DAYS7.map(actionCard).join('')}</div></section>` : '',
      groups.DAYS30.length ? `<section><h4>${esc(copy('month'))}</h4><div class="daka-comp-card-grid">${groups.DAYS30.map(actionCard).join('')}</div></section>` : ''
    ].filter(Boolean).join('');
    return detailsSection('comp-action-plan', copy('actionPlan'), body, false);
  }

  function competitorGeoLabel(item) {
    if (item?.geoTier === 'LOCAL_CONFIRMED' || item?.geoConfirmed === true) return extraCopy('localConfirmed');
    if (item?.geoTier === 'LOCAL_PROBABLE' || item?.geoMatched === true) return extraCopy('localProbable');
    if (item?.geoTier === 'FOREIGN_BENCHMARK') return extraCopy('foreignBenchmark');
    return copy('benchmarkType');
  }

  function renderCompetitors(intel) {
    const profiles = (Array.isArray(intel.competitorProfiles) && intel.competitorProfiles.length
      ? intel.competitorProfiles
      : (Array.isArray(intel.top10Competitors) ? intel.top10Competitors : []))
      .filter((item) => useful(item?.domain || item?.title))
      .slice(0, 10);
    if (!profiles.length) return '';
    const body = profiles.map((item, index) => {
      const evidence = linkItems(item.evidenceLinks);
      const competitorUrl = fixText(item.url || item.pageUrl || item.link || (item.domain ? 'https://' + item.domain : ''));
      const competitorSeed = fixText(item.domain || item.title || item.primaryPromise || '');
      const actions = competitorUrl ? [
        '<div class="daka-comp-profile-actions" data-no-collapse="true">',
        '<button type="button" class="daka-comp-action-btn daka-comp-action-primary" data-no-collapse="true" data-competitor-action="funnel" data-url="' + esc(competitorUrl) + '" data-competitor-seed="' + esc(competitorSeed) + '" aria-label="' + esc(copy('analyzeAction')) + '">',
        '<i class="fas fa-chart-line" aria-hidden="true"></i><span>' + esc(copy('analyzeAction')) + '</span></button>',
        '<button type="button" class="daka-comp-action-btn" data-no-collapse="true" data-competitor-action="tech" data-url="' + esc(competitorUrl) + '" aria-label="' + esc(copy('auditAction')) + '">',
        '<i class="fas fa-microscope" aria-hidden="true"></i><span>' + esc(copy('auditAction')) + '</span></button>',
        '<button type="button" class="daka-comp-action-btn" data-no-collapse="true" data-competitor-action="keywords" data-url="' + esc(competitorUrl) + '" data-competitor-seed="' + esc(competitorSeed) + '" aria-label="' + esc(copy('keywordsAction')) + '">',
        '<i class="fas fa-key" aria-hidden="true"></i><span>' + esc(copy('keywordsAction')) + '</span></button>',
        '</div>'
      ].join('') : '';
      const grid = [
        actions,
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
                <small>${esc(competitorGeoLabel(item))}</small>
              </div>
            </div>
            ${useful(item.confidence) ? `<span class="daka-comp-badge">${esc(item.confidence)}</span>` : ''}
          </header>
          <div class="daka-comp-stat-grid">${grid}</div>
          ${evidence}
        </article>`;
    }).join('');
    return detailsSection('comp-direct-competitors', copy('directCompetitors'), `<div class="daka-comp-profile-grid">${body}</div>`, false);
  }

  function renderUserBenchmark(data, intel) {
    const benchmark = data?.userBenchmark || data?.marketProductSources?.userBenchmark || intel?.userBenchmark;
    if (!benchmark || !useful(benchmark.url)) return '';
    const body = `
      <article class="daka-comp-benchmark-card">
        <div>
          <span class="daka-comp-eyebrow">${esc(extraCopy('userBenchmark'))}</span>
          <h4>${esc(benchmark.title || benchmark.domain || benchmark.url)}</h4>
          <p>${esc(extraCopy('userBenchmarkNote'))}</p>
          ${useful(benchmark.observedEvidence) ? `<p><strong>${esc(extraCopy('observedEvidence'))}:</strong> ${esc(benchmark.observedEvidence)}</p>` : ''}
        </div>
        <a href="${esc(benchmark.url)}" target="_blank" rel="noopener" data-no-collapse="true">${esc(extraCopy('openSource'))}</a>
      </article>`;
    return detailsSection('comp-user-benchmark', extraCopy('userBenchmark'), body, true);
  }

  function sourceGroups(intel, data) {
    const surveillance = intel.surveillance || {};
    const marketGroups = data?.marketProductSources?.groups || intel?.marketProductSources?.groups || {};
    return [
      { title: extraCopy('sameProducts'), items: marketGroups.sameProductPage || [] },
      { title: extraCopy('suppliers'), items: marketGroups.supplierSource || [] },
      { title: extraCopy('marketplaces'), items: marketGroups.marketplaceProduct || [] },
      { title: extraCopy('videos'), items: marketGroups.youtubeVideo || [] },
      { title: extraCopy('fieldProof'), items: marketGroups.contentProof || [] },
      { title: extraCopy('foreignBenchmarks'), items: marketGroups.foreignBenchmark || [] },
      { title: copy('benchmarkType'), items: surveillance.competitors || [] },
      { title: copy('distributionType'), items: surveillance.distributionChannels || [] },
      { title: copy('socialType'), items: surveillance.socialSources || [] },
      { title: copy('marketType'), items: surveillance.marketSources || [] }
    ];
  }

  function renderSources(intel, data) {
    const seen = new Set();
    const blocks = sourceGroups(intel, data).map((group) => {
      const items = (Array.isArray(group.items) ? group.items : [])
        .map((item) => ({
          domain: cleanInsight(item.domain || item.title || item.url || ''),
          url: item.url,
          role: cleanInsight(item.role || item.typeLabel || ''),
          use: cleanInsight(item.recommendedUse || item.whyRelevant || item.observedEvidence || item.rejectionReason || '')
        }))
        .filter((item) => {
          if (!useful(item.domain)) return false;
          const key = item.url || item.domain;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
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

  const STUDY_FIELD_LABELS = {
    fr: {
      commonSuccessFactors: 'Facteurs de succes communs', glaringWeaknesses: 'Faiblesses visibles', trafficStrategyGuess: 'Acquisition probable',
      strengths: 'Forces', weaknesses: 'Faiblesses', opportunities: 'Opportunites', threats: 'Menaces',
      trafficSources: 'Sources de trafic', retentionLoop: 'Boucle de retention', monetizationHack: 'Monetisation',
      competitor: 'Concurrent', user: 'Votre position', killShot: 'Action decisive',
      offerAndRisk: 'Offre, risque et garantie', jtbdPsychology: 'Psychologie client (JTBD)', kanoDelighter: 'Effet remarquable (Kano)', activationAARRR: 'Activation et friction (AARRR)',
      flankingStrategy: 'Strategie de contournement', pricingBundling: 'Prix et bundles', valueLadder: 'Echelle de valeur', uxTeardown: 'Demontage UX',
      dreamOutcome: 'Resultat recherche', perceivedLikelihood: 'Credibilite percue', timeDelay: 'Delai de resultat', effortAndSacrifice: 'Effort demande', theIrresistibleOffer: 'Offre finale',
      coreOffering: 'Offre principale', pricingStrategy: 'Strategie de prix', uniqueValueProposition: 'Proposition de valeur', weakestProductFeature: 'Faiblesse observee', killShotFeature: 'Contre-proposition',
      mainMoat: 'Avantage principal', summary: 'Synthese', contentStrategy: 'Strategie de contenu', technicalMoat: 'Avantage technique', brandAuthority: 'Autorite de marque',
      eliminate: 'Eliminer', reduce: 'Reduire', raise: 'Renforcer', create: 'Creer', currentRedOcean: 'Ocean rouge', blueOceanMoves: 'Mouvements Ocean bleu', positioningMap: 'Carte de positionnement'
    },
    en: {
      commonSuccessFactors: 'Shared success factors', glaringWeaknesses: 'Visible weaknesses', trafficStrategyGuess: 'Likely acquisition',
      strengths: 'Strengths', weaknesses: 'Weaknesses', opportunities: 'Opportunities', threats: 'Threats',
      trafficSources: 'Traffic sources', retentionLoop: 'Retention loop', monetizationHack: 'Monetization',
      competitor: 'Competitor', user: 'Your position', killShot: 'Decisive move',
      offerAndRisk: 'Offer, risk, and guarantee', jtbdPsychology: 'Customer psychology (JTBD)', kanoDelighter: 'Delighter effect (Kano)', activationAARRR: 'Activation and friction (AARRR)',
      flankingStrategy: 'Flanking strategy', pricingBundling: 'Pricing and bundles', valueLadder: 'Value ladder', uxTeardown: 'UX teardown',
      dreamOutcome: 'Desired outcome', perceivedLikelihood: 'Perceived credibility', timeDelay: 'Time to result', effortAndSacrifice: 'Required effort', theIrresistibleOffer: 'Final offer',
      coreOffering: 'Core offer', pricingStrategy: 'Pricing strategy', uniqueValueProposition: 'Value proposition', weakestProductFeature: 'Observed weakness', killShotFeature: 'Counter-proposition',
      mainMoat: 'Main advantage', summary: 'Summary', contentStrategy: 'Content strategy', technicalMoat: 'Technical advantage', brandAuthority: 'Brand authority',
      eliminate: 'Eliminate', reduce: 'Reduce', raise: 'Raise', create: 'Create', currentRedOcean: 'Red ocean', blueOceanMoves: 'Blue Ocean moves', positioningMap: 'Positioning map'
    },
    ar: {
      commonSuccessFactors: '\u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u0646\u062c\u0627\u062d \u0627\u0644\u0645\u0634\u062a\u0631\u0643\u0629', glaringWeaknesses: '\u0627\u0644\u062b\u063a\u0631\u0627\u062a \u0627\u0644\u0638\u0627\u0647\u0631\u0629', trafficStrategyGuess: '\u0627\u0644\u0627\u0643\u062a\u0633\u0627\u0628 \u0627\u0644\u0645\u0631\u062c\u062d',
      strengths: '\u0646\u0642\u0627\u0637 \u0627\u0644\u0642\u0648\u0629', weaknesses: '\u0646\u0642\u0627\u0637 \u0627\u0644\u0636\u0639\u0641', opportunities: '\u0627\u0644\u0641\u0631\u0635', threats: '\u0627\u0644\u062a\u0647\u062f\u064a\u062f\u0627\u062a',
      trafficSources: '\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a', retentionLoop: '\u062d\u0644\u0642\u0629 \u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638', monetizationHack: '\u062a\u062d\u0642\u064a\u0642 \u0627\u0644\u062f\u062e\u0644',
      competitor: '\u0627\u0644\u0645\u0646\u0627\u0641\u0633', user: '\u0645\u0648\u0642\u0639\u0643', killShot: '\u0627\u0644\u062d\u0631\u0643\u0629 \u0627\u0644\u062d\u0627\u0633\u0645\u0629',
      offerAndRisk: '\u0627\u0644\u0639\u0631\u0636 \u0648\u0627\u0644\u0645\u062e\u0627\u0637\u0631 \u0648\u0627\u0644\u0636\u0645\u0627\u0646', jtbdPsychology: '\u0633\u064a\u0643\u0648\u0644\u0648\u062c\u064a\u0629 \u0627\u0644\u0639\u0645\u064a\u0644 (JTBD)', kanoDelighter: '\u0639\u0627\u0645\u0644 \u0627\u0644\u0625\u0628\u0647\u0627\u0631 (Kano)', activationAARRR: '\u0627\u0644\u062a\u0641\u0639\u064a\u0644 \u0648\u0627\u0644\u0627\u062d\u062a\u0643\u0627\u0643 (AARRR)',
      flankingStrategy: '\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0627\u0644\u0627\u0644\u062a\u0641\u0627\u0641', pricingBundling: '\u0627\u0644\u0633\u0639\u0631 \u0648\u0627\u0644\u062d\u0632\u0645', valueLadder: '\u0633\u0644\u0645 \u0627\u0644\u0642\u064a\u0645\u0629', uxTeardown: '\u062a\u0641\u0643\u064a\u0643 \u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645',
      dreamOutcome: '\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0645\u0631\u063a\u0648\u0628\u0629', perceivedLikelihood: '\u0627\u0644\u0645\u0635\u062f\u0627\u0642\u064a\u0629 \u0627\u0644\u0645\u062f\u0631\u0643\u0629', timeDelay: '\u0645\u062f\u0629 \u062a\u062d\u0642\u064a\u0642 \u0627\u0644\u0646\u062a\u064a\u062c\u0629', effortAndSacrifice: '\u0627\u0644\u062c\u0647\u062f \u0627\u0644\u0645\u0637\u0644\u0648\u0628', theIrresistibleOffer: '\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u0646\u0647\u0627\u0626\u064a',
      coreOffering: '\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u0623\u0633\u0627\u0633\u064a', pricingStrategy: '\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0627\u0644\u0633\u0639\u0631', uniqueValueProposition: '\u0642\u064a\u0645\u0629 \u0627\u0644\u0639\u0631\u0636', weakestProductFeature: '\u0627\u0644\u0636\u0639\u0641 \u0627\u0644\u0645\u0631\u0635\u0648\u062f', killShotFeature: '\u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u0645\u0636\u0627\u062f',
      mainMoat: '\u0627\u0644\u0623\u0641\u0636\u0644\u064a\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629', summary: '\u0627\u0644\u062e\u0644\u0627\u0635\u0629', contentStrategy: '\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0627\u0644\u0645\u062d\u062a\u0648\u0649', technicalMoat: '\u0627\u0644\u0623\u0641\u0636\u0644\u064a\u0629 \u0627\u0644\u062a\u0642\u0646\u064a\u0629', brandAuthority: '\u0633\u0644\u0637\u0629 \u0627\u0644\u0639\u0644\u0627\u0645\u0629',
      eliminate: '\u062d\u0630\u0641', reduce: '\u062a\u0642\u0644\u064a\u0635', raise: '\u0631\u0641\u0639', create: '\u0627\u0628\u062a\u0643\u0627\u0631', currentRedOcean: '\u0627\u0644\u0645\u062d\u064a\u0637 \u0627\u0644\u0623\u062d\u0645\u0631', blueOceanMoves: '\u062d\u0631\u0643\u0627\u062a \u0627\u0644\u0645\u062d\u064a\u0637 \u0627\u0644\u0623\u0632\u0631\u0642', positioningMap: '\u062e\u0631\u064a\u0637\u0629 \u0627\u0644\u062a\u0645\u0648\u0636\u0639'
    }
  };

  function studyFieldLabel(key) {
    return fixText(STUDY_FIELD_LABELS[lang()]?.[key] || '');
  }

  const STUDY_META_KEYS = new Set(['status', 'type', 'confidence', 'confidenceExplanation', 'evidenceLinks']);

  function studyHasValue(value) {
    if (Array.isArray(value)) return value.some(studyHasValue);
    if (value && typeof value === 'object') {
      return Object.entries(value)
        .filter(([key]) => !STUDY_META_KEYS.has(key))
        .some(([, item]) => studyHasValue(item));
    }
    if (typeof value === 'boolean') return false;
    return useful(value);
  }

  function renderStudyValue(value, depth = 0) {
    if (!studyHasValue(value) || depth > 4) return '';
    if (Array.isArray(value)) {
      const primitives = value.filter((item) => typeof item !== 'object' && useful(item));
      const objects = value.filter((item) => item && typeof item === 'object' && studyHasValue(item));
      return [primitives.length ? bullets(primitives.slice(0, 8), 'neutral') : '', objects.map((item) => `<div class="daka-comp-study-subcard">${renderStudyValue(item, depth + 1)}</div>`).join('')].join('');
    }
    if (value && typeof value === 'object') {
      return Object.entries(value)
        .filter(([key, item]) => !STUDY_META_KEYS.has(key) && studyHasValue(item))
        .slice(0, 12).map(([key, item]) => {
        const label = studyFieldLabel(key);
        const content = renderStudyValue(item, depth + 1);
        if (!content) return '';
        return `<div class="daka-comp-study-field">${label ? `<strong>${esc(label)}</strong>` : ''}${content}</div>`;
      }).join('');
    }
    const text = cleanInsight(value);
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) {
      return `<a href="${esc(text)}" target="_blank" rel="noopener" data-no-collapse="true">${esc(extraCopy('openSource'))}</a>`;
    }
    return paragraph(text);
  }

  function renderStrategicStudies(data) {
    const studies = [
      ['top3ReverseEngineering', extraCopy('reverseEngineering')],
      ['grandSlamOfferBlueprint', extraCopy('grandSlam')],
      ['productServiceAudit', extraCopy('productAudit')],
      ['masteringTechniques', extraCopy('mastering')],
      ['duelComparison', extraCopy('duel')],
      ['swot', extraCopy('swot')],
      ['blueOceanStrategy', extraCopy('blueOcean')],
      ['comparisonScores', extraCopy('comparison')],
      ['semanticDifferences', extraCopy('semantic')],
      ['keywordStrategy', extraCopy('keywordStrategy')],
      ['actionRoadmap', extraCopy('roadmap')]
    ].filter(([key]) => studyHasValue(data?.[key]));
    if (!studies.length) return '';
    const body = `<div class="daka-comp-study-grid">${studies.map(([key, title]) => `
      <article class="daka-comp-study-card">
        <h4>${esc(title)}</h4>
        ${renderStudyValue(data[key])}
      </article>`).join('')}</div>`;
    return detailsSection('comp-strategic-studies', extraCopy('strategicStudies'), body, false);
  }

  function renderMarketIntelligenceStudies(data) {
    const apifyIntel = data?.apify?.apifyIntel || {};
    const fieldSignals = {
      ads: Array.isArray(apifyIntel.ads) ? apifyIntel.ads.slice(0, 6) : [],
      posts: Array.isArray(apifyIntel.posts) ? apifyIntel.posts.slice(0, 6) : [],
      comments: Array.isArray(apifyIntel.comments) ? apifyIntel.comments.slice(0, 6) : [],
      reviews: Array.isArray(apifyIntel.reviews) ? apifyIntel.reviews.slice(0, 6) : [],
      links: Array.isArray(data?.apify?.links?.all) ? data.apify.links.all.slice(0, 10) : []
    };
    const studies = [
      [data?.marketInsights, extraCopy('marketInsights')],
      [data?.marketDynamics, extraCopy('marketDynamics')],
      [data?.winningMove, extraCopy('winningMove')],
      [data?.leaderMoat, extraCopy('leaderMoat')],
      [data?.knowledgeGraph, extraCopy('knowledgeGraph')],
      [data?.proofModel, extraCopy('proofModel')],
      [data?.googleRealData, extraCopy('googleSignals')],
      [fieldSignals, extraCopy('fieldSignals')]
    ].filter(([value]) => studyHasValue(value));
    if (!studies.length) return '';
    const body = `<div class="daka-comp-study-grid">${studies.map(([value, title]) => `
      <article class="daka-comp-study-card">
        <h4>${esc(title)}</h4>
        ${renderStudyValue(value)}
      </article>`).join('')}</div>`;
    return detailsSection('comp-market-intelligence-studies', extraCopy('marketIntelStudies'), body, false);
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
      #resultsCompetitors .daka-comp-note-card,
      #resultsCompetitors .daka-comp-study-card,
      #resultsCompetitors .daka-comp-benchmark-card {
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
        min-width: 0;
      }
      #resultsCompetitors .daka-comp-profile-actions {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 7px;
        flex-wrap: wrap;
        margin-bottom: 2px;
      }
      #resultsCompetitors .daka-comp-action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 36px;
        padding: 0 10px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.82);
        color: #cbd5e1;
        font: inherit;
        font-size: 0.68rem;
        font-weight: 850;
        line-height: 1;
        cursor: pointer;
        white-space: nowrap;
        transition: transform 160ms ease, border-color 160ms ease, color 160ms ease, background 160ms ease;
      }
      #resultsCompetitors .daka-comp-action-btn:hover,
      #resultsCompetitors .daka-comp-action-btn:focus-visible {
        transform: translateY(-1px);
        border-color: rgba(103, 232, 249, 0.58);
        color: #f8fafc;
        background: rgba(14, 116, 144, 0.26);
        outline: none;
      }
      #resultsCompetitors .daka-comp-action-btn i {
        color: #67e8f9;
        font-size: 0.78rem;
      }
      #resultsCompetitors .daka-comp-action-primary {
        border-color: rgba(139, 92, 246, 0.42);
        color: #ddd6fe;
        background: rgba(91, 33, 182, 0.2);
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
      #resultsCompetitors .daka-comp-benchmark-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        border-color: rgba(34, 197, 94, 0.28);
        background: linear-gradient(135deg, rgba(6, 78, 59, 0.22), rgba(15, 23, 42, 0.82));
      }
      #resultsCompetitors .daka-comp-benchmark-card h4,
      #resultsCompetitors .daka-comp-study-card h4 {
        margin: 0 0 10px;
        color: #f8fafc;
      }
      #resultsCompetitors .daka-comp-benchmark-card a {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 12px;
        color: #bbf7d0;
        border: 1px solid rgba(34, 197, 94, 0.28);
        text-decoration: none;
        font-weight: 800;
      }
      #resultsCompetitors .daka-comp-study-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }
      #resultsCompetitors .daka-comp-profile-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      #resultsCompetitors .daka-comp-study-card {
        min-width: 0;
      }
      #resultsCompetitors .daka-comp-study-field {
        display: grid;
        gap: 7px;
        margin-top: 10px;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.13);
        background: rgba(2, 6, 23, 0.22);
      }
      #resultsCompetitors .daka-comp-study-field > strong {
        color: #67e8f9;
        font-size: 0.78rem;
      }
      #resultsCompetitors .daka-comp-study-subcard {
        margin-top: 10px;
        padding: 10px;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.55);
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
        #resultsCompetitors .daka-comp-study-grid {
          grid-template-columns: 1fr;
        }
        #resultsCompetitors .daka-comp-profile-grid {
          grid-template-columns: 1fr;
        }
        #resultsCompetitors .daka-comp-benchmark-card {
          align-items: stretch;
          flex-direction: column;
        }
      }
      @media (max-width: 760px) {
        #resultsCompetitors .daka-comp-profile header {
          align-items: flex-start;
          flex-direction: column;
        }
        #resultsCompetitors .daka-comp-profile-actions {
          width: 100%;
          justify-content: flex-start;
        }
        #resultsCompetitors .daka-comp-action-btn {
          flex: 1 1 auto;
          min-width: 0;
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
      renderUserBenchmark(repaired, intel),
      renderCompetitors(intel),
      renderSources(intel, repaired),
      renderMarketIntelligenceStudies(repaired),
      renderProductStudy(intel),
      renderStrategicStudies(repaired),
      renderMissingProofs(intel),
      renderFinalAnswers(intel)
    ].filter(Boolean).join('');

    container.innerHTML = html || `<section class="daka-comp-executive"><div class="daka-comp-empty">${esc(copy('noData'))}</div></section>`;
    container.style.display = 'block';
    container.dir = lang() === 'ar' ? 'rtl' : 'ltr';
    container.setAttribute('lang', lang());

    if (container.dataset.interactionGuard !== 'true') {
      container.dataset.interactionGuard = 'true';
      container.addEventListener('click', (event) => {
        const interactive = event.target.closest('a, button, input, select, textarea, [data-no-collapse]');
        if (interactive && !interactive.closest('summary')) event.stopPropagation();
      });
    }
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
    if (typeof api !== 'undefined' && typeof api.request === 'function') {
      return api.request('/api/competitors', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeout: 180000
      });
    }
    const apiBase = window.DAKA_API_BASE_URL || 'https://seobackend-f81n.onrender.com';
    const res = await fetch(`${apiBase}/api/competitors`, {
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

    const runToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    STATE.inFlight = true;
    STATE.renderToken = runToken;
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
        container.replaceChildren();
        container.dataset.renderer = MODULE_ID;
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

      if (STATE.renderToken !== runToken) return;
      renderCompetitorReport(response);
      if (exportButton) exportButton.style.display = 'inline-flex';
      window.toast?.success(copy('reportReady'));
    } catch (error) {
      console.error('[competitor-refonte]', error);
      if (STATE.renderToken !== runToken) return;
      if (container) {
        container.style.display = 'block';
        container.innerHTML = `<section class="daka-comp-executive"><span class="daka-comp-kicker">${esc(copy('opening'))}</span><h3>${esc(copy('errorPrefix'))}</h3><p>${esc(fixText(error?.message || 'Unknown error'))}</p></section>`;
      }
      window.toast?.error(`${copy('errorPrefix')}: ${fixText(error?.message || 'Unknown error')}`);
    } finally {
      if (STATE.renderToken !== runToken) return;
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
    if (form && form.dataset.dakaCompetitorRefonteBound !== 'true') {
      form.dataset.dakaCompetitorRefonteBound = 'true';
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
    window.__dakaCompetitorRefonteRender = renderCompetitorReport;
    window.__dakaCompetitorRefonteSubmit = handleSubmit;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
