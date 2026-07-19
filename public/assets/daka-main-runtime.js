// Daka main runtime served as a backend asset to prevent inline-code leakage in embedded hosts.
// ═══════════════════════════════════════════════════════════════════
        // 🌍 CONFIGURATION GLOBALE
        // ═══════════════════════════════════════════════════════════════════

        const CONFIG = {
    API_BASE_URL: window.location.hostname.includes('localhost')
        ? 'http://localhost:10000'
        : 'https://seobackend-f81n.onrender.com',  // 🔥 NOUVELLE URL
    TIMEOUT_SHORT: 15000,
    TIMEOUT_MEDIUM: 45000, // Passe à 45 secondes pour les analyses simples
    TIMEOUT_LONG: 90000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    TOAST_DURATION: 5000,
    // ... reste identique
};
/* ═══════════════════════════════════════════════════════════════════
   STATE GLOBAL — V2 MAJ COMPLÈTE
   Remplace l'ancien const STATE = { ... }
═══════════════════════════════════════════════════════════════════ */
const STATE = {
    /* ── Préférences ─────────────────────────────────────────────── */
    currentLang:          localStorage.getItem('preferredLang') || 'fr',
    currentTab:           'competitors',
    serverStatus:         'checking',

    /* ── Résultats des 4 analyses ────────────────────────────────── */
    lastAnalysisResults:  null,   // Tab 1 — Concurrents
    lastFunnelResults:    null,   // Tab 2 — Funnel AIDA
    lastTechnicalResults: null,   // Tab 3 — SEO Technique
    lastKeywords:         null,   // Tab 4 - Keywords (objet complet)

    /* ── Inputs sauvegardés (utilisés par exportFullAnalysisToPDF) ── */
    lastInputs: {
        keyword:     '',
        url:         '',
        country:     '',
        funnelUrl:   '',
        techUrl:     '',
        seedKeyword: '',
        kwLangs:     [],
        kwGeo:       'auto',
        kwCount:     20,
    },

    /* ── Métriques runtime ───────────────────────────────────────── */
    requestsCount: 0,
    errors:        [],

    /* ── Flags UI (anti double-clic) ─────────────────────────────── */
    isExporting:   false,
    isAnalyzing:   false,
};
const DAKA_COMPETITOR_COUNTRIES = [
    { value: 'Morocco', code: 'MA', flag: 'MA', labels: { fr: 'Maroc', en: 'Morocco', ar: '\u0627\u0644\u0645\u063a\u0631\u0628' } },
    { value: 'Libya', code: 'LY', flag: 'LY', labels: { fr: 'Libye', en: 'Libya', ar: '\u0644\u064a\u0628\u064a\u0627' } },
    { value: 'Tunisia', code: 'TN', flag: 'TN', labels: { fr: 'Tunisie', en: 'Tunisia', ar: '\u062a\u0648\u0646\u0633' } },
    { value: 'Algeria', code: 'DZ', flag: 'DZ', labels: { fr: 'Alg\u00e9rie', en: 'Algeria', ar: '\u0627\u0644\u062c\u0632\u0627\u0626\u0631' } },
    { value: 'Egypt', code: 'EG', flag: 'EG', labels: { fr: '\u00c9gypte', en: 'Egypt', ar: '\u0645\u0635\u0631' } },
    { value: 'Saudi Arabia', code: 'SA', flag: 'SA', labels: { fr: 'Arabie saoudite', en: 'Saudi Arabia', ar: '\u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629' } },
    { value: 'United Arab Emirates', code: 'AE', flag: 'AE', labels: { fr: '\u00c9mirats arabes unis', en: 'United Arab Emirates', ar: '\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a' } },
    { value: 'Qatar', code: 'QA', flag: 'QA', labels: { fr: 'Qatar', en: 'Qatar', ar: '\u0642\u0637\u0631' } },
    { value: 'Kuwait', code: 'KW', flag: 'KW', labels: { fr: 'Kowe\u00eft', en: 'Kuwait', ar: '\u0627\u0644\u0643\u0648\u064a\u062a' } },
    { value: 'Bahrain', code: 'BH', flag: 'BH', labels: { fr: 'Bahre\u00efn', en: 'Bahrain', ar: '\u0627\u0644\u0628\u062d\u0631\u064a\u0646' } },
    { value: 'Oman', code: 'OM', flag: 'OM', labels: { fr: 'Oman', en: 'Oman', ar: '\u0639\u0645\u0627\u0646' } },
    { value: 'Jordan', code: 'JO', flag: 'JO', labels: { fr: 'Jordanie', en: 'Jordan', ar: '\u0627\u0644\u0623\u0631\u062f\u0646' } },
    { value: 'Lebanon', code: 'LB', flag: 'LB', labels: { fr: 'Liban', en: 'Lebanon', ar: '\u0644\u0628\u0646\u0627\u0646' } },
    { value: 'France', code: 'FR', flag: 'FR', labels: { fr: 'France', en: 'France', ar: '\u0641\u0631\u0646\u0633\u0627' } },
    { value: 'United States', code: 'US', flag: 'US', labels: { fr: '\u00c9tats-Unis', en: 'United States', ar: '\u0627\u0644\u0648\u0644\u0627\u064a\u0627\u062a \u0627\u0644\u0645\u062a\u062d\u062f\u0629' } },
    { value: 'Global English', code: 'GL', flag: 'GL', labels: { fr: 'Global (English)', en: 'Global (English)', ar: '\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 \u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0629' } }
];

function getDakaCountryOptionLabel(option, lang = 'fr') {
    const locale = ['fr', 'en', 'ar'].includes(lang) ? lang : 'fr';
    const label = option?.labels?.[locale] || option?.labels?.fr || option?.value || '';
    return [option?.code || '', label].filter(Boolean).join(' ');
}

function getDakaCountryHelperText(lang = 'fr') {
    if (lang === 'ar') return '\u064a\u062a\u0628\u0639 \u0627\u0633\u0645 \u0627\u0644\u0628\u0644\u062f \u0627\u0644\u0638\u0627\u0647\u0631 \u0644\u063a\u0629 \u0627\u0644\u062a\u0642\u0631\u064a\u0631\u060c \u0645\u0639 \u0628\u0642\u0627\u0621 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641 \u062f\u0648\u0646 \u062a\u063a\u064a\u064a\u0631.';
    if (lang === 'en') return 'The visible country label follows the report language, while the selected market stays the same.';
    return 'Le libell\u00e9 du pays suit la langue du rapport, sans modifier le march\u00e9 cibl\u00e9.';
}

function looksLikeMojibake(value = '') {
    if (/(?:\u00c3.|\u00c2.|\u00e2.|\u00f0.|\u00d8.|\u00d9.)/.test(String(value || ''))) return true;
    return /(?:Ã|Â|â|Ø|Ù|ð|œ|ƒ)/.test(String(value || ''));
}

function repairMojibakeString(value) {
    if (typeof value !== 'string' || !looksLikeMojibake(value)) return value;
    let text = value;
    for (let index = 0; index < 3; index += 1) {
        try {
            const repaired = decodeURIComponent(escape(text));
            if (!repaired || repaired === text) break;
            text = repaired;
            if (!looksLikeMojibake(text)) break;
        } catch (_) {
            break;
        }
    }
    return text;
}

function deepRepairMojibake(input, seen = new WeakSet()) {
    if (!input || typeof input !== 'object') return input;
    if (seen.has(input)) return input;
    seen.add(input);

    if (Array.isArray(input)) {
        for (let index = 0; index < input.length; index += 1) {
            const value = input[index];
            if (typeof value === 'string') input[index] = repairMojibakeString(value);
            else if (value && typeof value === 'object') deepRepairMojibake(value, seen);
        }
        return input;
    }

    Object.keys(input).forEach((key) => {
        const value = input[key];
        if (typeof value === 'string') input[key] = repairMojibakeString(value);
        else if (value && typeof value === 'object') deepRepairMojibake(value, seen);
    });
    return input;
}

function repairVisibleMojibake(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|PRE|CODE|TEXTAREA)$/i.test(parent.tagName)) return;
        const original = String(node.nodeValue || '');
        const repaired = repairMojibakeString(original);
        if (repaired !== original) node.nodeValue = repaired;
    });
}
window.repairVisibleMojibake = repairVisibleMojibake;

function hydrateCompetitorCountrySelect(preferredValue = null, lang = null) {
    const select = document.getElementById('country');
    if (!select) return;
    const locale = ['fr', 'en', 'ar'].includes(lang) ? lang : (STATE.currentLang || 'fr');
    const rawValue = preferredValue || select.value || STATE.lastInputs?.country || 'Morocco';
    const currentValue = rawValue === 'Global' ? 'Global English' : rawValue;
    select.innerHTML = DAKA_COMPETITOR_COUNTRIES.map((option) => {
        const selected = option.value === currentValue ? ' selected' : '';
        return `<option value="${option.value}"${selected}>${getDakaCountryOptionLabel(option, locale)}</option>`;
    }).join('');
    if (DAKA_COMPETITOR_COUNTRIES.some((option) => option.value === currentValue)) {
        select.value = currentValue;
    }
    select.dataset.locale = locale;
    const note = document.getElementById('countrySelectNote');
    if (note) {
        note.textContent = getDakaCountryHelperText(locale);
        note.dir = locale === 'ar' ? 'rtl' : 'ltr';
    }
}
/* ══════════════════════════════════════════════════════════════
   PATCH — RESET COMPLET AVANT CHAQUE NOUVELLE ANALYSE
   À ajouter une seule fois, juste après la définition du STATE
   ══════════════════════════════════════════════════════════════ */

/* ── Helper reset universel ───────────────────────────────── */
function resetAnalysis(type) {
    // 1. Vider STATE
    if (type === 'competitors' || type === 'all') {
        STATE.lastAnalysisResults = null;
        document.getElementById('btn-export-competitors-pdf')?.style
    && (document.getElementById('btn-export-competitors-pdf').style.display = 'inline-flex');
        window.currentCompetitorKeywords = [];
        if (window.compRadarInstance instanceof Chart) {
            window.compRadarInstance.destroy();
            window.compRadarInstance = null;
        }
        if (window.benchmarkChartInstance instanceof Chart) {
            window.benchmarkChartInstance.destroy();
            window.benchmarkChartInstance = null;
        }
        const el = document.getElementById('resultsCompetitors');
        if (el) { el.innerHTML = ''; el.classList.remove('active'); el.style.display = 'none'; }
    }
    if (type === 'funnel' || type === 'all') {
        STATE.lastFunnelResults = null;
        document.getElementById('btn-export-funnel-pdf')?.style
    && (document.getElementById('btn-export-funnel-pdf').style.display = 'inline-flex');
        if (window.funnelChartInstance instanceof Chart) {
            window.funnelChartInstance.destroy();
            window.funnelChartInstance = null;
        }
        const el = document.getElementById('resultsFunnel');
        if (el) { el.innerHTML = ''; el.classList.remove('active'); el.style.display = 'none'; }
    }
    if (type === 'technical' || type === 'all') {
        STATE.lastTechnicalResults = null;
        window.currentSeoContext = null;
        const el = document.getElementById('resultsTechnical');
        if (el) { el.innerHTML = ''; el.classList.remove('active'); el.style.display = 'none'; }
        const genOut = document.getElementById('tech-gen-output');
        if (genOut) { genOut.innerHTML = ''; genOut.style.display = 'none'; }
    }
    if (type === 'keywords' || type === 'all') {
        STATE.lastKeywords = null;
        const el = document.getElementById('resultsKeywords');
        if (el) { el.innerHTML = ''; el.classList.remove('active'); el.style.display = 'none'; }
        const countEl = document.getElementById('kwFilterCount');
        if (countEl) countEl.textContent = '0';
    }
}

/* ═══════════════════════════════════════════════════════════════════
   AUTO-SYNC INPUTS → STATE.lastInputs
   À placer juste après le STATE, avant les fonctions
═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

    /* Sync champs texte / select ─────────────────────────────────── */
    const _inputMap = {
        'keywordInput':  'keyword',
        'urlInput':      'url',
        'url':           'url',          // alias si id="url"
        'keyword':       'keyword',      // alias si id="keyword"
        'countrySelect': 'country',
        'country':       'country',      // alias si id="country"
        'funnelUrl':     'funnelUrl',
        'techUrl':       'techUrl',
        'seedKeyword':   'seedKeyword',
        'kwGeo':         'kwGeo',
        'kwCount':       'kwCount',
    };
    Object.entries(_inputMap).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (!el) return;
        // Init depuis valeur actuelle si déjà remplie
        if (el.value?.trim()) STATE.lastInputs[key] = el.value.trim();
        el.addEventListener('input',  () => STATE.lastInputs[key] = el.value?.trim() || '');
        el.addEventListener('change', () => STATE.lastInputs[key] = el.value?.trim() || '');
    });

    /* Sync checkboxes langues keywords ───────────────────────────── */
    const _syncKwLangs = () => {
        STATE.lastInputs.kwLangs = ['langFR', 'langAR', 'langEN']
            .filter(id => document.getElementById(id)?.checked)
            .map(id => id.replace('lang', '').toLowerCase());
    };
    ['langFR', 'langAR', 'langEN'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', _syncKwLangs);
    });
    _syncKwLangs(); // Init au chargement

    /* Sync all report language controls ───────────────────────────── */
    const syncReportLanguage = (lang) => {
        if (!lang || !['fr', 'ar', 'en'].includes(lang)) return;
        STATE.currentLang = lang;
        localStorage.setItem('preferredLang', lang);
        localStorage.setItem('preferred_lang', lang);
        document.querySelectorAll('#analysisLang, #funnelLang, #langSelector').forEach(el => {
            if (el && el.value !== lang) el.value = lang;
        });
        document.querySelectorAll('input[name="techLang"]').forEach(el => {
            el.checked = el.value === lang;
        });
        if (window.i18n && typeof window.i18n.setLanguage === 'function' && window.i18n.currentLang !== lang) {
            window.i18n.setLanguage(lang);
        }
    };

    document.querySelectorAll('#analysisLang, #funnelLang, #langSelector').forEach(el => {
        el.addEventListener('change', () => syncReportLanguage(el.value));
    });

    document.querySelectorAll('input[name="techLang"]').forEach(el => {
        el.addEventListener('change', () => {
            if (el.checked) syncReportLanguage(el.value);
        });
    });

    /* Persist lang dans localStorage ─────────────────────────────── */
    document.querySelectorAll('[data-lang-switch]').forEach(btn => {
        btn.addEventListener('click', () => {
            const l = btn.dataset.langSwitch;
            if (l) syncReportLanguage(l);
        });
    });

    hydrateCompetitorCountrySelect(null, STATE.currentLang || 'fr');

});

/* ═══════════════════════════════════════════════════════════════════
   MAJ exportFullAnalysisToPDF — inject keywords dans payload
   Remplace uniquement le bloc "1. APPEL BACKEND" dans ta fonction
═══════════════════════════════════════════════════════════════════ */
// Dans exportFullAnalysisToPDF, remplace :
// const resp = await api.post('/api/prepare-global-report', { ... })
// Par :





        class I18n {
            constructor() {
                this.translations = TRANSLATIONS;
                this.currentLang = localStorage.getItem('preferredLang')
                    || localStorage.getItem('preferred_lang')
                    || STATE.currentLang
                    || 'fr';
                this.init();
            }

            init() {
                this.setLanguage(this.currentLang);

                // Language selector event
                document.getElementById('langSelector')?.addEventListener('change', (e) => {
                    this.setLanguage(e.target.value);
                });
            }

            setLanguage(lang) {
                if (!this.translations[lang]) {
                    console.warn(`Language ${lang} not found, defaulting to fr`);
                    lang = 'fr';
                }

                this.currentLang = lang;
                STATE.currentLang = lang;
                localStorage.setItem('preferred_lang', lang);
                localStorage.setItem('preferredLang', lang);

                // Update HTML lang attribute
                document.documentElement.lang = lang;

                // Set RTL for Arabic
                if (lang === 'ar') {
                    document.documentElement.setAttribute('dir', 'rtl');
                } else {
                    document.documentElement.setAttribute('dir', 'ltr');
                }

                // Update all i18n elements
                this.translatePage();

                // Update language selector
                document.getElementById('langSelector') && (document.getElementById('langSelector').value = lang);
                document.getElementById('analysisLang') && (document.getElementById('analysisLang').value = lang);
                document.getElementById('funnelLang') && (document.getElementById('funnelLang').value = lang);
                document.querySelectorAll('input[name="techLang"]').forEach(el => {
                    el.checked = el.value === lang;
                });

                this.translateRuntimeChrome();
                hydrateCompetitorCountrySelect(STATE.lastInputs?.country || null, lang);

                if (CONFIG.DEBUG_MODE) console.log(`✅ Language changed to: ${lang}`);
            }

            translateRuntimeChrome() {
                const lang = this.currentLang;
                const footer = document.querySelector('.footer');
                if (footer) {
                    const copy = lang === 'ar'
                        ? {
                            powered: 'مشغل بواسطة',
                            engine: 'محرك Daka للذكاء التسويقي',
                            made: 'من طرف',
                            author: 'فريق Daka',
                            rights: 'كل الحقوق محفوظة',
                            privacy: 'الخصوصية',
                            terms: 'الشروط'
                        }
                        : lang === 'en'
                        ? {
                            powered: 'Powered by',
                            engine: 'Daka market intelligence engine',
                            made: 'Built by',
                            author: 'Daka Team',
                            rights: 'All rights reserved',
                            privacy: 'Privacy',
                            terms: 'Terms'
                        }
                        : {
                            powered: 'Propulsé par',
                            engine: 'moteur Daka d’intelligence marché',
                            made: 'Créé par',
                            author: 'Daka Team',
                            rights: 'Tous droits réservés',
                            privacy: 'Confidentialité',
                            terms: 'Conditions'
                        };

                    footer.innerHTML = `
                        <div class="container">
                            <p>
                                <strong>Daka All-in-One v5.0.0</strong> |
                                ${copy.powered}
                                <span style="background: var(--gradient-cosmic); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800;">${copy.engine}</span> |
                                ${copy.made} <strong>${copy.author}</strong>
                            </p>
                            <p style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                                &copy; 2026 ${copy.rights} |
                                <a href="#" style="color: var(--accent-primary);">${copy.privacy}</a> |
                                <a href="#" style="color: var(--accent-primary);">${copy.terms}</a>
                            </p>
                        </div>`;
                    repairVisibleMojibake(footer);
                }
            }

            translatePage() {
                // Translate text content
                document.querySelectorAll('[data-i18n]').forEach(element => {
                    const key = element.getAttribute('data-i18n');
                    const translation = this.t(key);
                    if (translation) {
                        element.textContent = translation;
                    }
                });

                // Translate placeholders
                document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
                    const key = element.getAttribute('data-i18n-placeholder');
                    const translation = this.t(key);
                    if (translation) {
                        element.placeholder = translation;
                    }
                });
            }

            t(key) {
                const keys = key.split('.');
                let value = this.translations[this.currentLang];

                for (const k of keys) {
                    if (value && typeof value === 'object') {
                        value = value[k];
                    } else {
                        return key; // Return key if translation not found
                    }
                }

                return typeof value === 'string' ? (repairMojibakeString(value) || key) : (value || key);
            }
        }

        function applyPremiumMicrocopy() {
            const premiumCopy = {
                fr: {
                    appbadge: 'MARKET INTEL',
                    tab1_title: 'Lecture du marché',
                    tab1_title_highlight: 'Concurrents',
                    tab1_subtitle: 'Comprenez qui gagne, pourquoi il gagne, et quelle action concrète peut vous faire prendre sa place.',
                    label_keyword: 'Marché, niche ou requête à analyser',
                    placeholder_keyword: 'Ex: SaaS marketing all-in-one Maroc',
                    label_url: 'Votre site pour benchmark direct',
                    placeholder_url: 'https://votre-site.com',
                    label_country: 'Pays et marché cible',
                    label_analysis_lang: 'Langue du rapport',
                    btn_analyze: 'RÉVÉLER LES OPPORTUNITÉS',
                    loading_comp_title: 'Daka prépare votre avantage',
                    loading_comp_sub: 'Le temps de votre café, les signaux du marché deviennent des décisions claires.',
                    phase_comp_1: 'Top concurrents géo',
                    phase_comp_2: 'Failles et objections',
                    phase_comp_3: 'Plan de conquête',
                    context_comp_title: 'Rendez le rapport 3x plus concret',
                    context_comp_sub: 'Ajoutez votre offre, votre cible et votre objectif pour recevoir des actions adaptées à votre vraie situation.',
                    context_comp_badge: 'Optionnel - recommandé',
                    context_offer_label: 'Offre exacte',
                    context_offer_ph: 'Ex: SaaS marketing + formation intégrée',
                    context_audience_label: 'Client idéal',
                    context_audience_ph: 'Ex: PME marocaines, coachs, e-commerçants',
                    context_objective_label: 'Objectif prioritaire',
                    context_objective_ph: 'Ex: vendre, générer des leads, prendre des RDV',
                    context_price_label: 'Prix, panier ou budget',
                    context_price_ph: 'Ex: 499 DH/mois, panier 900 DH, budget 200 DH/j',
                    context_known_comp_label: 'Concurrents déjà connus',
                    context_known_comp_ph: 'Ex: site1.com, marque2, page Instagram',
                    context_geo_label: 'Zone à gagner',
                    context_geo_ph: 'Ex: Maroc, Casablanca, MENA francophone',
                    tab2_title: 'Corriger une page qui vend',
                    tab2_subtitle: 'Changements concrets, preuves observées et textes prêts à tester.',
                    label_funnel_url: 'URL du site ou de la landing page',
                    placeholder_funnel_url: 'https://concurrent.com/landing-page',
                    label_funnel_style: 'Angle de recommandation',
                    funnel_power_engine: 'Analyse conversion active:',
                    btn_funnel: 'AUDITER LE FUNNEL',
                    loading_funnel_title: 'Daka révèle les points de friction',
                    loading_funnel_sub: 'Pendant votre pause, les pertes invisibles deviennent des corrections concrètes.',
                    context_funnel_title: 'Donnez le contexte de la page',
                    context_funnel_sub: 'Plus vous précisez l’offre et l’objectif, plus les corrections seront concrètes: textes, preuves, prix, boutons et objections.',
                    context_funnel_badge: 'Pour un plan réaliste',
                    context_funnel_offer_label: 'Offre ou promesse',
                    context_funnel_offer_ph: 'Ex: audit marketing, formation, produit e-commerce',
                    context_funnel_audience_label: 'Audience visée',
                    context_funnel_audience_ph: 'Ex: entrepreneurs débutants, PME, agences',
                    context_funnel_objective_label: 'Action attendue',
                    context_funnel_objective_ph: 'Ex: achat, appel, formulaire, WhatsApp, démo',
                    context_funnel_price_label: 'Prix ou fourchette actuelle',
                    context_funnel_price_ph: 'Ex: 149 MAD ou 179-199 MAD',
                    context_funnel_known_comp_label: 'Pages à comparer',
                    context_funnel_known_comp_ph: 'Ex: concurrent.com, page de référence, marque',
                    context_funnel_geo_label: 'Marché cible',
                    context_funnel_geo_ph: 'Ex: Maroc, France, Casablanca, GCC',
                    tab3_title: 'Vérifier les bases du site',
                    tab3_highlight: 'Priorités claires',
                    tab3_subtitle: 'Détectez ce qui bloque confiance, lecture, vitesse et structure.',
                    label_tech_url: 'URL à diagnostiquer',
                    btn_technical: 'LANCER LE DIAGNOSTIC',
                    tab4_title: 'Idées de recherche',
                    tab4_highlight: 'rentables',
                    tab4_subtitle: 'Trouvez les demandes qui mélangent intention, rentabilité et facilité d’exécution.',
                    label_seed: 'Mot-clé de départ',
                    placeholder_seed: 'Ex: formation marketing SaaS',
                    btn_keywords: 'TROUVER LES MOTS-CLÉS GAGNANTS'
                },
                en: {
                    tab1_title: 'Market Intelligence',
                    tab1_title_highlight: 'Competitors',
                    tab1_subtitle: 'See who wins, why they win, and the exact move that can help you take the market.',
                    label_keyword: 'Market, niche, or search query',
                    placeholder_keyword: 'Ex: all-in-one marketing SaaS Morocco',
                    label_url: 'Your website for direct benchmark',
                    placeholder_url: 'https://your-site.com',
                    appbadge: 'MARKET INTEL',
                    label_country: 'Target country and market',
                    label_analysis_lang: 'Report language',
                    btn_analyze: 'REVEAL MARKET OPPORTUNITIES',
                    loading_comp_title: 'Daka is shaping your advantage',
                    loading_comp_sub: 'While you enjoy your coffee, market signals turn into clear decisions.',
                    phase_comp_1: 'Geo top competitors',
                    phase_comp_2: 'Weaknesses and objections',
                    phase_comp_3: 'Conquest plan',
                    tab2_title: 'Fix a page that sells',
                    tab2_subtitle: 'Concrete changes, observed proof, and copy examples ready to test.',
                    label_funnel_url: 'Website or landing page URL',
                    placeholder_funnel_url: 'https://competitor.com/landing-page',
                    label_funnel_style: 'Recommendation angle',
                    funnel_power_engine: 'Conversion analysis active:',
                    btn_funnel: 'AUDIT THE FUNNEL',
                    loading_funnel_title: 'Daka reveals the friction points',
                    loading_funnel_sub: 'During your pause, invisible losses become concrete fixes.',
                    context_comp_title: 'Make the report 3x more concrete',
                    context_comp_sub: 'Add your offer, audience, and goal to get actions adapted to your real situation.',
                    context_comp_badge: 'Optional - recommended',
                    context_offer_label: 'Exact offer',
                    context_offer_ph: 'Ex: marketing SaaS + integrated training',
                    context_audience_label: 'Ideal customer',
                    context_audience_ph: 'Ex: Moroccan SMEs, coaches, e-commerce owners',
                    context_objective_label: 'Priority goal',
                    context_objective_ph: 'Ex: sell, generate leads, book calls',
                    context_price_label: 'Price, basket, or budget',
                    context_price_ph: 'Ex: 499 DH/month, 900 DH basket, 200 DH/day budget',
                    context_known_comp_label: 'Known competitors',
                    context_known_comp_ph: 'Ex: site1.com, brand2, Instagram page',
                    context_geo_label: 'Area to win',
                    context_geo_ph: 'Ex: Morocco, Casablanca, English-speaking MENA',
                    context_funnel_title: 'Give page context',
                    context_funnel_sub: 'The clearer your offer and goal, the more practical the fixes become: copy, proof, price, buttons, and objections.',
                    context_funnel_badge: 'For a realistic plan',
                    context_funnel_offer_label: 'Offer or promise',
                    context_funnel_offer_ph: 'Ex: marketing audit, training, e-commerce product',
                    context_funnel_audience_label: 'Target audience',
                    context_funnel_audience_ph: 'Ex: new founders, SMEs, agencies',
                    context_funnel_objective_label: 'Expected action',
                    context_funnel_objective_ph: 'Ex: purchase, call, form, WhatsApp, demo',
                    context_funnel_price_label: 'Current price or price range',
                    context_funnel_price_ph: 'Example: 149 MAD or 179-199 MAD',
                    context_funnel_known_comp_label: 'Pages to compare',
                    context_funnel_known_comp_ph: 'Ex: competitor.com, reference page, brand',
                    context_funnel_geo_label: 'Target market',
                    context_funnel_geo_ph: 'Ex: Morocco, France, Casablanca, GCC',
                    tab3_title: 'Check site foundations',
                    tab3_highlight: 'Clear priorities',
                    tab3_subtitle: 'Find what blocks trust, reading, speed, and structure.',
                    label_tech_url: 'URL to diagnose',
                    btn_technical: 'RUN THE DIAGNOSIS',
                    tab4_title: 'Keyword Opportunity',
                    tab4_highlight: 'Engine',
                    tab4_subtitle: 'Find queries that combine intent, profitability, and execution ease.',
                    label_seed: 'Seed keyword',
                    placeholder_seed: 'Ex: SaaS marketing training',
                    btn_keywords: 'FIND WINNING KEYWORDS'
                },
                ar: {
                    appbadge: 'ذكاء السوق',
                    tab1_title: 'ذكاء السوق',
                    tab1_title_highlight: 'المنافسون',
                    tab1_subtitle: 'افهم من يربح في السوق، لماذا يربح، وما الحركة العملية التي تقربك منه.',
                    label_keyword: 'السوق أو المجال أو كلمة البحث',
                    placeholder_keyword: 'مثال: SaaS marketing Maroc',
                    label_url: 'موقعك للمقارنة المباشرة',
                    label_country: 'البلد ونتائج البحث المستهدفة',
                    label_analysis_lang: 'لغة التقرير',
                    btn_analyze: 'اكشف فرص السوق',
                    tab2_title: 'صحح صفحة البيع',
                    tab2_subtitle: 'تغييرات عملية، أدلة مرصودة، ونصوص جاهزة للاختبار.',
                    label_funnel_url: 'رابط الموقع أو صفحة الهبوط',
                    label_funnel_style: 'زاوية التوصية',
                    funnel_power_engine: 'تحليل التحويل مفعل:',
                    btn_funnel: 'تدقيق الفانل',
                    tab3_title: 'افحص أساس الموقع',
                    tab3_highlight: 'أولويات واضحة',
                    tab3_subtitle: 'اعرف ما يضعف الثقة والقراءة والسرعة والبنية.',
                    tab4_title: 'فرص البحث',
                    tab4_highlight: 'الرابحة',
                    tab4_subtitle: 'اكتشف الكلمات التي تجمع بين النية، الربحية، وسهولة التنفيذ.',
                    loading_comp_title: 'داكا يجهز ميزتك القادمة...',
                    loading_comp_sub: 'بينما تستمتع بقهوتك، تتحول إشارات السوق إلى قرارات واضحة.',
                    loading_funnel_title: 'داكا يكشف نقاط الاحتكاك...',
                    loading_funnel_sub: 'أثناء استراحتك، تتحول الخسائر الخفية إلى تصحيحات عملية.',
                    context_comp_title: 'اجعل التقرير أكثر واقعية بثلاث مرات',
                    context_comp_sub: 'أضف عرضك، جمهورك، وهدفك حتى تحصل على خطوات مناسبة لوضعك الحقيقي.',
                    context_comp_badge: 'اختياري - موصى به',
                    context_offer_label: 'العرض الدقيق',
                    context_offer_ph: 'مثال: برنامج تسويق مع تكوين مدمج',
                    context_audience_label: 'العميل المثالي',
                    context_audience_ph: 'مثال: شركات مغربية صغيرة، مدربون، متاجر إلكترونية',
                    context_objective_label: 'الهدف الأول',
                    context_objective_ph: 'مثال: بيع، جلب عملاء، حجز مواعيد',
                    context_price_label: 'السعر أو الميزانية',
                    context_price_ph: 'مثال: 499 درهم/شهر، سلة 900 درهم، ميزانية 200 درهم/يوم',
                    context_known_comp_label: 'منافسون معروفون',
                    context_known_comp_ph: 'مثال: site1.com، علامة تجارية، صفحة إنستغرام',
                    context_geo_label: 'المنطقة المستهدفة',
                    context_geo_ph: 'مثال: المغرب، الدار البيضاء، الشرق الأوسط',
                    context_funnel_title: 'أضف سياق الصفحة',
                    context_funnel_sub: 'كلما كان العرض والهدف أوضح، أصبحت التوصيات عملية أكثر: نصوص، ثقة، سعر، أزرار، واعتراضات.',
                    context_funnel_badge: 'لخطة واقعية',
                    context_funnel_offer_label: 'العرض أو الوعد',
                    context_funnel_offer_ph: 'مثال: تدقيق تسويقي، تكوين، منتج متجر إلكتروني',
                    context_funnel_audience_label: 'الجمهور المستهدف',
                    context_funnel_audience_ph: 'مثال: رواد أعمال، شركات صغيرة، وكالات',
                    context_funnel_objective_label: 'الفعل المطلوب',
                    context_funnel_objective_ph: 'مثال: شراء، مكالمة، نموذج، واتساب، عرض تجريبي',
                    context_funnel_price_label: 'السعر أو نطاق السعر الحالي',
                    context_funnel_price_ph: 'مثال: 149 درهم أو 179-199 درهم',
                    context_funnel_known_comp_label: 'صفحات للمقارنة',
                    context_funnel_known_comp_ph: 'مثال: competitor.com، صفحة مرجعية، علامة تجارية',
                    context_funnel_geo_label: 'السوق المستهدف',
                    context_funnel_geo_ph: 'مثال: المغرب، فرنسا، الدار البيضاء، الخليج',
                    btn_keywords: 'اكتشف الكلمات الرابحة'
                }
            };

            Object.keys(premiumCopy).forEach(lang => {
                TRANSLATIONS[lang] = { ...(TRANSLATIONS[lang] || {}), ...premiumCopy[lang] };
            });
            deepRepairMojibake(TRANSLATIONS);
        }

        const i18n = new I18n();
        window.i18n = i18n;
        applyPremiumMicrocopy();
        Object.assign(TRANSLATIONS.fr, {
            appname: 'Daka Market Intelligence Spyer',
            appbadge: 'MARKET INTEL',
            navkeywords: 'Demande marché',
            navtechnical: 'Audit site',
            tab1_title: 'Lecture du marché',
            tab1_title_highlight: 'Concurrents',
            tab1_subtitle: 'Comprenez qui gagne, pourquoi il gagne, et quelle action concrète peut vous faire prendre sa place.',
            tab2_title: 'Corriger une page qui vend',
            tab3_title: 'Vérifier les bases du site',
            tab3_highlight: 'Priorités claires',
            tab4_title: 'Opportunités de',
            tab4_highlight: 'recherche',
            label_analysis_lang: 'Langue du rapport',
            funnel_power_engine: 'Analyse active:',
            loading_comp_title: 'Daka prépare votre avantage',
            loading_comp_sub: 'Le temps de votre café, les signaux du marché deviennent des décisions claires.',
            loading_funnel_title: 'Daka révèle les points de friction',
            loading_funnel_sub: 'Pendant votre pause, les pertes invisibles deviennent des corrections concrètes.',
            loading_tech_title: 'Daka sécurise les fondations',
            loading_tech_sub: 'Pendant que la sphère analyse, les blocages se rangent par urgence.',
            loading_kw_title: 'Daka fait remonter les meilleures demandes',
            loading_kw_sub: 'Pendant que vous respirez, les demandes utiles remontent à la surface.',
            phase_tech_3: 'Compatibilité lecture',
            btn_keywords: 'TROUVER LES MOTS-CLÉS GAGNANTS'
        });
        Object.assign(TRANSLATIONS.en, {
            appname: 'Daka Market Intelligence Spyer',
            appbadge: 'MARKET INTEL',
            navkeywords: 'Market demand',
            navtechnical: 'Site audit',
            tab1_title: 'Market Intelligence',
            tab1_title_highlight: 'Competitors',
            tab1_subtitle: 'See who wins, why they win, and the exact move that can help you take the market.',
            tab2_title: 'Fix a page that sells',
            tab3_title: 'Check site foundations',
            tab3_highlight: 'Clear priorities',
            tab4_title: 'Keyword',
            tab4_highlight: 'Opportunity',
            label_analysis_lang: 'Report language',
            funnel_power_engine: 'Analysis active:',
            loading_comp_title: 'Daka is shaping your advantage',
            loading_comp_sub: 'While you enjoy your coffee, market signals turn into clear decisions.',
            loading_funnel_title: 'Daka reveals the friction points',
            loading_funnel_sub: 'During your pause, invisible losses become concrete fixes.',
            loading_tech_title: 'Daka secures the foundations',
            loading_tech_sub: 'While the orb studies the page, blockers are ranked by urgency.',
            loading_kw_title: 'Daka surfaces the best demand',
            loading_kw_sub: 'While you take a breath, useful demand rises to the surface.',
            phase_tech_3: 'Readability compatibility',
            btn_keywords: 'FIND WINNING KEYWORDS'
        });
        Object.assign(TRANSLATIONS.ar, {
            appname: 'داكا لاستخبارات السوق',
            appbadge: 'ذكاء السوق',
            navkeywords: 'طلب السوق',
            navtechnical: 'فحص الموقع',
            tab1_title: 'ذكاء السوق',
            tab1_title_highlight: 'المنافسون',
            tab1_subtitle: 'افهم من يربح، لماذا يربح، وما الحركة العملية التي تقربك من السوق.',
            tab2_title: 'إصلاح صفحة البيع',
            tab3_title: 'فحص أساس الموقع',
            tab3_highlight: 'أولويات واضحة',
            tab4_title: 'فرص البحث',
            tab4_highlight: 'الرابحة',
            label_analysis_lang: 'لغة التقرير',
            funnel_power_engine: 'التحليل مفعل:',
            loading_comp_title: 'داكا يجهز ميزتك القادمة',
            loading_comp_sub: 'بينما تستمتع بقهوتك، تتحول إشارات السوق إلى قرارات واضحة.',
            loading_funnel_title: 'داكا يكشف نقاط الاحتكاك',
            loading_funnel_sub: 'أثناء استراحتك، تتحول الخسائر الخفية إلى تصحيحات عملية.',
            loading_tech_title: 'داكا يثبت الأساس',
            loading_tech_sub: 'بينما تتحرك الكرة، تُرتّب العوائق حسب درجة الاستعجال.',
            loading_kw_title: 'داكا يرفع أفضل الطلبات',
            loading_kw_sub: 'بينما تأخذ نفسا هادئا، تصعد الطلبات المفيدة إلى السطح.',
            phase_tech_3: 'توافق القراءة',
            btn_keywords: 'اكتشف الكلمات الرابحة'
        });
        deepRepairMojibake(TRANSLATIONS);
        i18n.setLanguage(i18n.currentLang || STATE.currentLang || 'fr');

        // ═══════════════════════════════════════════════════════════════════
        // 🍞 TOAST NOTIFICATION SYSTEM
        // ═══════════════════════════════════════════════════════════════════

        class ToastManager {
            constructor() {
                this.container = document.getElementById('toastContainer');
                this.toasts = [];
            }

            show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;

                const icon = {
                    success: 'fa-check-circle',
                    error: 'fa-exclamation-circle',
                    warning: 'fa-exclamation-triangle',
                    info: 'fa-info-circle'
                }[type] || 'fa-info-circle';

                toast.innerHTML = `
                    <i class="fas ${icon}"></i>
                    <div style="flex: 1;">
                        <strong>${i18n.t(`toast_${type}`)}</strong>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;">${message}</p>
                    </div>
                `;

                this.container.appendChild(toast);

                // Animate in
                setTimeout(() => toast.classList.add('show'), 10);

                // Auto remove
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, CONFIG.ANIMATION_DURATION);
                }, duration);

                this.toasts.push(toast);
            }

            success(message) { this.show(message, 'success'); }
            error(message) { this.show(message, 'error'); }
            warning(message) { this.show(message, 'warning'); }
            info(message) { this.show(message, 'info'); }
        }

        const toast = new ToastManager();

        // ═══════════════════════════════════════════════════════════════════
        // 🔌 API CLIENT - WITH RETRY LOGIC
        // ═══════════════════════════════════════════════════════════════════

        class APIClient {
            constructor(baseURL) {
                this.baseURL = baseURL;
                this.retryCount = 0;
            }

            async request(endpoint, options = {}) {
                const url = `${this.baseURL}${endpoint}`;
                const defaultOptions = {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: CONFIG.TIMEOUT_MEDIUM
                };

                const mergedOptions = { ...defaultOptions, ...options };
                const authToken = typeof getAuthAccessToken === 'function'
                    ? await getAuthAccessToken()
                    : null;
                mergedOptions.headers = {
                    ...defaultOptions.headers,
                    ...(options.headers || {}),
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                };

                STATE.requestsCount++;

                if (CONFIG.DEBUG_MODE) {
                    console.log(`🔌 API Request [${STATE.requestsCount}]:`, url, mergedOptions);
                }

                try {
                    const controller = new AbortController();
                    const externalSignal = mergedOptions.signal || window.dakaCurrentAbortController?.signal;
                    const abortFromExternal = () => controller.abort();
                    if (externalSignal) {
                        if (externalSignal.aborted) controller.abort();
                        else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
                    }
                    const timeoutId = setTimeout(() => controller.abort(), mergedOptions.timeout);

                    const response = await fetch(url, {
                        ...mergedOptions,
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);
                    externalSignal?.removeEventListener?.('abort', abortFromExternal);

                    if (!response.ok) {
                        let errorData = null;
                        try { errorData = await response.json(); } catch {}
                        const requestError = new Error(
                            errorData?.message || errorData?.error || `HTTP ${response.status}: ${response.statusText}`
                        );
                        requestError.status = response.status;
                        requestError.data = errorData;
                        if (response.status === 401 && typeof openAuthModal === 'function') openAuthModal();
                        throw requestError;
                    }

                    const data = await response.json();

                    if (CONFIG.DEBUG_MODE) {
                        console.log(`✅ API Response [${STATE.requestsCount}]:`, data);
                    }

                    this.retryCount = 0; // Reset on success
                    return data;

                } catch (error) {
                    if (CONFIG.DEBUG_MODE) {
                        console.error(`❌ API Error [${STATE.requestsCount}]:`, error);
                    }

                    // Never replay analysis POST requests: the server may still be processing
                    // after a client timeout, and retrying would create a second Railway job.
                    const requestMethod = String(mergedOptions.method || 'GET').toUpperCase();
                    const canRetrySafely = ['GET', 'HEAD'].includes(requestMethod);
                    const isRetryableNetworkError =
                        error.name === 'AbortError' || error.message.includes('Failed to fetch');

                    if (!window.dakaAnalysisCancelled &&
                        canRetrySafely &&
                        this.retryCount < CONFIG.MAX_RETRIES &&
                        isRetryableNetworkError) {

                        this.retryCount++;
                        console.warn(`⏳ Retry ${this.retryCount}/${CONFIG.MAX_RETRIES} for ${endpoint}`);

                        await new Promise(resolve =>
                            setTimeout(resolve, CONFIG.RETRY_DELAY * this.retryCount)
                        );

                        return this.request(endpoint, options);
                    }

                    // Log error
                    STATE.errors.push({
                        timestamp: new Date().toISOString(),
                        endpoint,
                        error: error.message
                    });

                    throw error;
                }
            }

            async post(endpoint, data, timeout = CONFIG.TIMEOUT_MEDIUM, extraOptions = {}) {
                return this.request(endpoint, {
                    method: 'POST',
                    body: JSON.stringify(data),
                    timeout,
                    ...extraOptions
                });
            }

            async get(endpoint, timeout = CONFIG.TIMEOUT_SHORT) {
                return this.request(endpoint, {
                    method: 'GET',
                    timeout
                });
            }
        }

        const api = new APIClient(CONFIG.API_BASE_URL);

let dakaAuthClient = null;
let currentAuthUser = null;
let authConfigured = false;
let authRedirectUrl = `${window.location.origin}${window.location.pathname}`;
const authReady = new Promise(resolve => { resolveAuthReady = resolve; });

function authCopy() {
    const lang = STATE.currentLang || 'fr';
    if (lang === 'ar') return {
        login: 'تسجيل الدخول',
        title: 'احتفظ بتقاريرك أينما كنت',
        subtitle: 'سجّل الدخول لبدء التحليل وحفظ السجل ومشاركة التقارير.',
        google: 'المتابعة باستخدام Google',
        email: 'إرسال رابط الدخول',
        reports: 'تقاريرك',
        reportsSub: 'السجل وتتبع الأسعار وروابط المشاركة.',
        empty: 'لا توجد تقارير محفوظة بعد.',
        configuredError: 'تسجيل الدخول غير مفعّل بعد.',
        emailSent: 'تم إرسال رابط الدخول إلى بريدك.',
        saved: 'تم حفظ التقرير في حسابك.',
        saveError: 'تعذر حفظ التقرير.',
        view: 'عرض التقرير',
        pdf: 'تنزيل DOCX',
        share: 'مشاركة',
        shareCopied: 'تم نسخ رابط المشاركة.',
        shareUnavailable: 'تعذر إنشاء رابط المشاركة.',
        loadingReport: 'جارٍ فتح التقرير...',
        groqTitle: 'ربط OpenRouter',
        groqSubtitle: 'أضف مفتاح OpenRouter لاستخدام مولد code prompt عبر حصتك الخاصة.',
        groqConnected: 'OpenRouter متصل',
        groqDisconnected: 'OpenRouter غير متصل',
        groqMask: 'يبقى المفتاح مشفرا على الخادم.',
        groqLabel: 'مفتاح OpenRouter API',
        groqSave: 'حفظ مشفر',
        groqDelete: 'حذف',
        groqNote: 'لا يعرض Daka مفتاحك أبدا. يستخدم فقط في طلبات OpenRouter التي تطلقها.',
        groqSaved: 'تم حفظ مفتاح OpenRouter بشكل مشفر.',
        groqDeleted: 'تم حذف مفتاح OpenRouter.',
        groqInvalid: 'مفتاح OpenRouter غير صالح.'
    };
    if (lang === 'en') return {
        login: 'Sign in',
        title: 'Keep every report within reach',
        subtitle: 'Sign in to run analyses, preserve history and share reports.',
        google: 'Continue with Google',
        email: 'Send sign-in link',
        reports: 'Your reports',
        reportsSub: 'History, price tracking and shareable links.',
        empty: 'No saved reports yet.',
        configuredError: 'Sign-in is not configured yet.',
        emailSent: 'A sign-in link was sent to your email.',
        saved: 'Report saved to your account.',
        saveError: 'The report could not be saved.',
        view: 'View report',
        pdf: 'Download DOCX',
        share: 'Share',
        shareCopied: 'Share link copied.',
        shareUnavailable: 'Unable to create the share link.',
        loadingReport: 'Opening report...',
        groqTitle: 'Connect OpenRouter',
        groqSubtitle: 'Add your OpenRouter key to use the Daka prompt-to-code machine with your own quota.',
        groqConnected: 'OpenRouter connected',
        groqDisconnected: 'OpenRouter not connected',
        groqMask: 'Your key stays encrypted on the server.',
        groqLabel: 'OpenRouter API key',
        groqSave: 'Save encrypted',
        groqDelete: 'Delete',
        groqNote: 'Daka never displays your key. It is only used for OpenRouter calls you trigger.',
        groqSaved: 'OpenRouter key saved encrypted.',
        groqDeleted: 'OpenRouter key deleted.',
        groqInvalid: 'Invalid OpenRouter key.'
    };
    return {
        login: 'Connexion',
        title: 'Retrouvez vos rapports partout',
        subtitle: 'Connectez-vous pour lancer une analyse, conserver l’historique et partager vos rapports.',
        google: 'Continuer avec Google',
        email: 'Recevoir un lien',
        reports: 'Vos rapports',
        reportsSub: 'Historique, suivi des prix et liens partageables.',
        empty: 'Aucun rapport enregistré pour le moment.',
        configuredError: 'La connexion n’est pas encore configurée.',
        emailSent: 'Un lien de connexion a été envoyé par email.',
        saved: 'Rapport enregistré dans votre compte.',
        saveError: 'Le rapport n’a pas pu être enregistré.',
        view: 'Voir le rapport',
        pdf: 'Télécharger le DOCX',
        share: 'Partager',
        shareCopied: 'Lien de partage copié.',
        shareUnavailable: 'Impossible de créer le lien de partage.',
        loadingReport: 'Ouverture du rapport...',
        groqTitle: 'Connecter OpenRouter',
        groqSubtitle: 'Ajoutez votre clé OpenRouter pour utiliser le prompt-to-code avec votre propre quota.',
        groqConnected: 'OpenRouter connecté',
        groqDisconnected: 'OpenRouter non connecté',
        groqMask: 'Votre clé reste chiffrée côté serveur.',
        groqLabel: 'Clé API OpenRouter',
        groqSave: 'Enregistrer chiffré',
        groqDelete: 'Supprimer',
        groqNote: 'Daka n’affiche jamais votre clé. Elle sert uniquement aux appels OpenRouter que vous déclenchez.',
        groqSaved: 'Clé OpenRouter enregistrée et chiffrée.',
        groqDeleted: 'Clé OpenRouter supprimée.',
        groqInvalid: 'Clé OpenRouter invalide.'
    };
}

async function getAuthAccessToken() {
    await Promise.race([authReady, new Promise(resolve => setTimeout(resolve, 2500))]);
    if (!dakaAuthClient) return null;
    const { data } = await dakaAuthClient.auth.getSession();
    return data?.session?.access_token || null;
}

function refreshAuthCopy() {
    const copy = authCopy();
    const loginLabel = document.querySelector('.auth-login-label');
    if (loginLabel) loginLabel.textContent = copy.login;
    document.getElementById('auth-modal-title') && (document.getElementById('auth-modal-title').textContent = copy.title);
    document.getElementById('auth-modal-subtitle') && (document.getElementById('auth-modal-subtitle').textContent = copy.subtitle);
    document.getElementById('auth-google-label') && (document.getElementById('auth-google-label').textContent = copy.google);
    document.getElementById('auth-email-label') && (document.getElementById('auth-email-label').textContent = copy.email);
    document.getElementById('reports-modal-title') && (document.getElementById('reports-modal-title').textContent = copy.reports);
    document.getElementById('reports-modal-subtitle') && (document.getElementById('reports-modal-subtitle').textContent = copy.reportsSub);
    document.getElementById('groq-key-title') && (document.getElementById('groq-key-title').textContent = copy.groqTitle);
    document.getElementById('groq-key-subtitle') && (document.getElementById('groq-key-subtitle').textContent = copy.groqSubtitle);
    document.getElementById('groq-key-label') && (document.getElementById('groq-key-label').textContent = copy.groqLabel);
    document.getElementById('groq-save-label') && (document.getElementById('groq-save-label').textContent = copy.groqSave);
    document.getElementById('groq-delete-label') && (document.getElementById('groq-delete-label').textContent = copy.groqDelete);
    document.getElementById('groq-key-note') && (document.getElementById('groq-key-note').textContent = copy.groqNote);
}

async function updateAuthUI(user, disabled = false) {
    currentAuthUser = user || null;
    refreshAuthCopy();

    const loginBtn = document.getElementById('btn-google-login');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const avatar = document.getElementById('user-avatar');

    if (loginBtn) {
        loginBtn.style.display = user ? 'none' : 'inline-flex';
        loginBtn.disabled = disabled;
        loginBtn.title = disabled ? authCopy().configuredError : authCopy().login;
    }
    if (userInfo) userInfo.style.display = user ? 'flex' : 'none';
    if (userName) userName.textContent = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '';
    if (avatar) {
        avatar.src = user?.user_metadata?.avatar_url || user?.user_metadata?.picture ||
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" rx="32" fill="%238b5cf6"/%3E%3Ctext x="32" y="40" text-anchor="middle" font-size="28" fill="white"%3ED%3C/text%3E%3C/svg%3E';
    }

    if (user) {
        await refreshQuotaBadge();
        refreshOpenRouterKeyStatus().catch(() => {});
    } else {
        updateOpenRouterKeyUI({ connected: false });
    }
}

async function initSupabaseAuth() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/config`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        const config = await response.json();
        if (!response.ok) {
    throw new Error(`AUTH_CONFIG_HTTP_${response.status}`);
}

authRedirectUrl = config?.redirectUrl || authRedirectUrl;
        authConfigured = Boolean(config?.enabled && config?.supabaseUrl && config?.anonKey && window.supabase?.createClient);

        if (!authConfigured) {
            await updateAuthUI(null, true);
            return;
        }

        dakaAuthClient = window.supabase.createClient(config.supabaseUrl, config.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: 'pkce'
            }
        });

        const { data } = await dakaAuthClient.auth.getSession();
        await updateAuthUI(data?.session?.user || null);
        dakaAuthClient.auth.onAuthStateChange((_event, session) => {
            updateAuthUI(session?.user || null);
        });
    } catch (error) {
        console.warn('[Auth] initialization failed:', error.message);
        await updateAuthUI(null, true);
    } finally {
        resolveAuthReady();
    }
}

function openAuthModal() {
    if (!authConfigured) {
        toast.warning(authCopy().configuredError);
        return;
    }
    refreshAuthCopy();
    document.getElementById('auth-modal')?.classList.add('active');
    document.body.classList.add('modal-open');
}

function closeAuthModal() {
    document.getElementById('auth-modal')?.classList.remove('active');
    document.body.classList.remove('modal-open');
}

async function loginWithGoogle() {
    if (!dakaAuthClient) return openAuthModal();
   const redirectTo = authRedirectUrl || `${window.location.origin}${window.location.pathname}`;
    const { error } = await dakaAuthClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });
    if (error) toast.error(error.message);
}

async function loginWithEmail() {
    const email = document.getElementById('auth-email')?.value?.trim();
    if (!email || !dakaAuthClient) return toast.warning('Email requis.');
    const redirectTo = authRedirectUrl || `${window.location.origin}${window.location.pathname}`;
    const { error } = await dakaAuthClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
    });
    if (error) return toast.error(error.message);
    toast.success(authCopy().emailSent);
    closeAuthModal();
}

async function logout() {
    if (dakaAuthClient) await dakaAuthClient.auth.signOut();
    await updateAuthUI(null);
}

async function refreshQuotaBadge(quotaOverride = null) {
    if (!currentAuthUser) return;
    try {
        const quota = quotaOverride || (await api.get('/api/reports/quota', 15000))?.quota;
        const badge = document.getElementById('auth-quota');
        if (badge && quota) badge.textContent = `${quota.used}/${quota.unlimited ? '∞' : quota.limit}`;
    } catch (error) {
        console.warn('[Reports] quota unavailable:', error.message);
    }
}

function updateOpenRouterKeyUI(status = {}) {
    const copy = authCopy();
    const statusNode = document.getElementById('groq-key-status');
    const maskNode = document.getElementById('groq-key-mask');
    if (statusNode) statusNode.textContent = status.connected ? copy.groqConnected : status.setupRequired ? 'Configuration requise' : copy.groqDisconnected;
    if (maskNode) maskNode.textContent = status.message || status.maskedKey || copy.groqMask;
}

async function refreshOpenRouterKeyStatus() {
    if (!currentAuthUser) return updateOpenRouterKeyUI({ connected: false });
    try {
        const status = await api.get('/api/user-api-keys/openrouter/status', 15000);
        updateOpenRouterKeyUI(status);
        return status;
    } catch (error) {
        console.warn('[OpenRouter] status unavailable:', error.message);
        updateOpenRouterKeyUI({ connected: false });
        return null;
    }
}

function openOpenRouterKeyModal() {
    if (!currentAuthUser) return openAuthModal();
    refreshAuthCopy();
    document.getElementById('groq-key-modal')?.classList.add('active');
    document.body.classList.add('modal-open');
    refreshOpenRouterKeyStatus();
    setTimeout(() => document.getElementById('groq-api-key-input')?.focus(), 80);
}

function closeOpenRouterKeyModal() {
    document.getElementById('groq-key-modal')?.classList.remove('active');
    document.body.classList.remove('modal-open');
    const input = document.getElementById('groq-api-key-input');
    if (input) input.value = '';
}

async function saveOpenRouterKey() {
    const copy = authCopy();
    const input = document.getElementById('groq-api-key-input');
    const apiKey = String(input?.value || '').trim();
    if (!/^(sk-or-v1-|sk-)[A-Za-z0-9_-]{20,}$/.test(apiKey)) return toast.warning(copy.groqInvalid);
    try {
        const status = await api.request('/api/user-api-keys/openrouter', {
            method: 'POST',
            body: JSON.stringify({ apiKey }),
            timeout: 20000
        });
        if (input) input.value = '';
        updateOpenRouterKeyUI(status);
        toast.success(copy.groqSaved);
    } catch (error) {
        toast.error(error.message || copy.groqInvalid);
        updateOpenRouterKeyUI(error.data || { connected: false, message: error.message });
    }
}

async function deleteOpenRouterKey() {
    const copy = authCopy();
    try {
        const status = await api.request('/api/user-api-keys/openrouter', {
            method: 'DELETE',
            timeout: 20000
        });
        updateOpenRouterKeyUI(status);
        toast.success(copy.groqDeleted);
    } catch (error) {
        toast.error(error.message || copy.shareUnavailable);
    }
}

function closeReportDashboard() {
    document.getElementById('reports-modal')?.classList.remove('active');
    document.body.classList.remove('modal-open');
}

function openReportsOrAuth() {
    if (currentAuthUser) return openReportDashboard();
    openAuthModal();
}

async function openReportDashboard() {
    const modal = document.getElementById('reports-modal');
    const list = document.getElementById('report-history-list');
    if (!modal || !list) return;
    refreshAuthCopy();
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    list.innerHTML = '<div style="color:#94a3b8;padding:16px"><i class="fas fa-circle-notch fa-spin"></i></div>';

    try {
        const response = await api.get('/api/reports?limit=50', 20000);
        await refreshQuotaBadge(response.quota);
        const reports = Array.isArray(response.reports) ? response.reports : [];
        const copy = authCopy();
        list.innerHTML = reports.length ? reports.map(report => `
            <article class="report-history-item" role="button" tabindex="0"
                onclick="displaySavedReport('${report.id}')"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();displaySavedReport('${report.id}')}">
                <div>
                    <strong>${escapeHtml(report.title || report.type)}</strong>
                    <small>${escapeHtml(report.type)} · ${new Date(report.created_at).toLocaleDateString()}</small>
                </div>
                <div class="report-history-actions">
                    <button type="button" onclick="event.stopPropagation();displaySavedReport('${report.id}')" title="${escapeHtml(copy.view)}" aria-label="${escapeHtml(copy.view)}"><i class="fas fa-eye"></i></button>
                    <button type="button" onclick="event.stopPropagation();downloadSavedReport('${report.id}')" title="${escapeHtml(copy.pdf)}" aria-label="${escapeHtml(copy.pdf)}"><i class="fas fa-file-word"></i></button>
                    <button type="button" class="report-share-button" onclick="event.stopPropagation();shareSavedReport('${report.id}')" title="${escapeHtml(copy.share)}" aria-label="${escapeHtml(copy.share)}"><i class="fas fa-share-nodes"></i><span>${escapeHtml(copy.share)}</span></button>
                </div>
            </article>`).join('') : `<div style="color:#94a3b8;padding:16px">${authCopy().empty}</div>`;
    } catch (error) {
        list.innerHTML = `<div style="color:#fca5a5;padding:16px">${escapeHtml(error.message)}</div>`;
    }
}

function normalizeSavedReportType(type) {
    const value = String(type || '').toLowerCase();
    if (value === 'competitor' || value === 'competition') return 'competitors';
    if (value === 'seo' || value === 'audit') return 'technical';
    if (value === 'keyword') return 'keywords';
    return value;
}

async function getSavedReport(id) {
    const response = await api.get(`/api/reports/${encodeURIComponent(id)}`, 20000);
    if (!response?.report?.result) throw new Error('REPORT_DATA_UNAVAILABLE');
    return response.report;
}

async function displaySavedReport(id, options = {}) {
    try {
        toast.info(authCopy().loadingReport);
        const report = await getSavedReport(id);
        const type = normalizeSavedReportType(report.type);
        const data = report.result;
        const tab = type === 'technical' ? 'technical' : type;

        if (options.exportDoc || options.exportPdf) {
            STATE.lastAnalysisResults = null;
            STATE.lastFunnelResults = null;
            STATE.lastTechnicalResults = null;
            STATE.lastKeywords = null;
            ['resultsCompetitors', 'resultsFunnel', 'resultsTechnical', 'resultsKeywords'].forEach(resultId => {
                const resultNode = document.getElementById(resultId);
                if (resultNode) resultNode.innerHTML = '';
            });
        }

        closeReportDashboard();
        tabManager.switchTab(tab, { scroll: false });
        STATE.currentLang = data.lang || data.userLang || STATE.currentLang;

        if (type === 'competitors') {
            STATE.lastAnalysisResults = data;
            displayCompetitorsResults(data);
        } else if (type === 'funnel') {
            STATE.lastFunnelResults = data;
            displayFunnelResults(data);
        } else if (type === 'technical') {
            STATE.lastTechnicalResults = data;
            displayTechnicalResults(data);
        } else if (type === 'keywords') {
            displayKeywordsResults(data);
        } else {
            throw new Error('REPORT_TYPE_UNSUPPORTED');
        }

        const target = document.getElementById(`results${type === 'competitors' ? 'Competitors' : type === 'funnel' ? 'Funnel' : type === 'technical' ? 'Technical' : 'Keywords'}`);
        requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

        if (options.exportDoc || options.exportPdf) {
            setTimeout(() => {
                if (typeof window.exportFullAnalysisToWord === 'function') {
                    window.exportFullAnalysisToWord();
                } else {
                    window.exportFullAnalysisToPDF?.();
                }
            }, 650);
        }
        return report;
    } catch (error) {
        console.error('[Reports] unable to open saved report:', error);
        toast.error(error.message || 'REPORT_UNAVAILABLE');
        return null;
    }
}

async function downloadSavedReport(id) {
    await displaySavedReport(id, { exportDoc: true });
}

async function shareSavedReport(id) {
    const copy = authCopy();
    let shareWindow = null;
    try {
        shareWindow = window.open('', '_blank');
        if (shareWindow) {
            shareWindow.document.title = 'Daka';
            shareWindow.document.body.style.cssText = 'margin:0;background:#0f172a;color:#f8fafc;font-family:Inter,Arial,sans-serif;display:grid;place-items:center;min-height:100vh';
            const main = shareWindow.document.createElement('main');
            main.style.cssText = 'text-align:center;padding:24px';
            const title = shareWindow.document.createElement('h1');
            title.textContent = 'Daka';
            title.style.cssText = 'font-size:22px;margin:0 0 8px';
            const paragraph = shareWindow.document.createElement('p');
            paragraph.textContent = `${copy.share}...`;
            paragraph.style.cssText = 'color:#c4b5fd;margin:0';
            main.append(title, paragraph);
            shareWindow.document.body.replaceChildren(main);
        }
    } catch (_) {
        shareWindow = null;
    }
    try {
        const response = await api.request(`/api/reports/${encodeURIComponent(id)}/share`, {
            method: 'PATCH',
            body: JSON.stringify({ isPublic: true }),
            timeout: 20000
        });
        const sharePath = response?.sharePath || response?.shareUrl;
        if (!sharePath) throw new Error(copy.shareUnavailable);
        const shareUrl = /^https?:\/\//i.test(String(sharePath))
            ? String(sharePath)
            : new URL(sharePath, window.location.origin).href;
        if (shareWindow && !shareWindow.closed) {
            shareWindow.location.href = shareUrl;
        }
        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch (_) {
            if (!shareWindow || shareWindow.closed) window.prompt(copy.share, shareUrl);
        }
        toast.success(copy.shareCopied);
        return shareUrl;
    } catch (error) {
        if (shareWindow && !shareWindow.closed) shareWindow.close();
        console.error('[Reports] share failed:', error);
        toast.error(error.message || copy.shareUnavailable);
        return null;
    }
}

function getSharedReportTokenFromLocation() {
    const pathMatch = window.location.pathname.match(/\/shared-report\/([^/?#]+)/i);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);
    const params = new URLSearchParams(window.location.search);
    return params.get('sharedReport') || params.get('reportToken') || '';
}

function renderSharedReportGate(message, mode = 'login') {
    const copy = authCopy();
    document.body.classList.add('modal-open');
    document.body.innerHTML = `
    <main class="shared-report-gate" style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#020617;color:#f8fafc;font-family:Inter,Arial,sans-serif">
        <section style="width:min(760px,100%);padding:28px;border:1px solid rgba(125,211,252,.24);border-radius:24px;background:radial-gradient(circle at 8% 0%,rgba(34,211,238,.16),transparent 34%),linear-gradient(145deg,#0f172a,#050816);box-shadow:0 24px 72px rgba(0,0,0,.35)">
            <span style="display:block;color:#7dd3fc;font-size:.75rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase">Daka Market Intelligence Spyer</span>
            <h1 style="margin:12px 0 8px;font-size:clamp(1.7rem,4vw,3rem);line-height:1.08">${mode === 'subscribe' ? 'Rapport réservé aux abonnés' : 'Connexion requise'}</h1>
            <p style="margin:0;color:#cbd5e1;line-height:1.7">${escapeHtml(message || 'Connectez-vous avec un compte abonné pour consulter ce rapport partagé.')}</p>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:20px">
                <button type="button" onclick="location.href='/'" style="min-height:44px;padding:10px 16px;border:0;border-radius:999px;background:linear-gradient(135deg,#22c55e,#06b6d4);color:#03111c;font-weight:950;cursor:pointer">${mode === 'subscribe' ? 'Voir les offres' : escapeHtml(copy.login)}</button>
                <button type="button" onclick="location.href='/'" style="min-height:44px;padding:10px 16px;border:1px solid rgba(125,211,252,.24);border-radius:999px;background:#10213a;color:#e0f2fe;font-weight:900;cursor:pointer">Retour à Daka</button>
            </div>
        </section>
    </main>`;
}

async function initSharedReportRoute() {
    const token = getSharedReportTokenFromLocation();
    if (!token) return;
    await Promise.race([authReady, new Promise(resolve => setTimeout(resolve, 3500))]);
    const accessToken = await getAuthAccessToken();
    if (!accessToken) {
        renderSharedReportGate('Connectez-vous avec un compte abonné pour ouvrir ce rapport partagé.', 'login');
        return;
    }
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/public/reports/${encodeURIComponent(token)}`, {
            headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
            cache: 'no-store'
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 402) {
            renderSharedReportGate(payload.message || 'Ce rapport partagé est réservé aux comptes abonnés Daka.', 'subscribe');
            return;
        }
        if (!response.ok || !payload.html) throw new Error(payload.message || 'Rapport indisponible.');
        document.open();
        document.write(payload.html);
        document.close();
    } catch (error) {
        renderSharedReportGate(error.message || 'Impossible de charger ce rapport partagé.', 'login');
    }
}

document.addEventListener('DOMContentLoaded', initSupabaseAuth);
document.addEventListener('DOMContentLoaded', initSharedReportRoute);
document.getElementById('langSelector')?.addEventListener('change', refreshAuthCopy);

window.DAKA_FRONTEND_BUILD = '2026-06-21-evidence-loaders';

function loaderTypeFromEndpoint(endpoint = '') {
    const value = String(endpoint || '').toLowerCase();
    if (value.includes('funnel')) return 'funnel';
    if (value.includes('technical') || value.includes('audit')) return 'technical';
    if (value.includes('keyword')) return 'keywords';
    return 'competitors';
}

function ensureAnalysisLoader(endpoint) {
    const loader = document.getElementById('daka-global-loader');
    const type = loaderTypeFromEndpoint(endpoint);
    if (!loader?.classList.contains('active')) return showDakaLoader(type);

    const copy = DAKA_LOADER_COPY[type] || DAKA_LOADER_COPY.competitors;
    document.getElementById('daka-loader-kicker').textContent = copy.kicker;
    document.getElementById('daka-loader-title').textContent = copy.title;
    document.getElementById('daka-loader-subtitle').textContent = copy.subtitle;
    document.getElementById('daka-loader-hooks').innerHTML = copy.hooks
        .map(hook => `<span>${escapeHtml(hook)}</span>`).join('');
    enforceMutedLoaderVideos();
    document.getElementById('daka-global-loader-video')?.play().catch(() => {});
    return window.dakaActiveAnalysisId;
}

async function analyzeWithPolling(endpoint, payload, resultsHandler) {
    const stableStringify = (value) => {
        if (value === null || typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    };
    const stablePayload = (() => {
        try {
            return stableStringify(payload || {});
        } catch (_) {
            return String(Date.now());
        }
    })();
    const lockKey = `${endpoint}:${stablePayload}`;
    const existing = window.dakaAnalysisInFlight?.get(lockKey);
    if (existing && !window.dakaAnalysisCancelled) {
        ensureAnalysisLoader(endpoint);
        toast.info(STATE.currentLang === 'ar'
            ? 'التحليل قيد التنفيذ بالفعل.'
            : STATE.currentLang === 'en'
                ? 'This analysis is already running.'
                : 'Cette analyse est déjà en cours.');
        return Promise.race([
            existing,
            new Promise((_, reject) => setTimeout(() => reject(new Error(
                STATE.currentLang === 'ar'
                    ? 'التحليل السابق لا يجيب. أعد المحاولة الآن.'
                    : STATE.currentLang === 'en'
                        ? 'The previous analysis stopped responding. Please try again now.'
                        : 'L’analyse précédente ne répond plus. Relancez maintenant.'
            )), 125000))
        ]).then(data => {
            if (typeof resultsHandler === 'function' && data) resultsHandler(data);
            return data;
        }).catch(error => {
            window.dakaAnalysisInFlight?.delete(lockKey);
            hideDakaLoader();
            throw error;
        });
    }

    const runPromise = (async () => {
    ensureAnalysisLoader(endpoint);
    const analysisId = window.dakaActiveAnalysisId;
    const assertActive = () => {
        if (window.dakaAnalysisCancelled || analysisId !== window.dakaActiveAnalysisId) {
            throw new DOMException('Analysis cancelled', 'AbortError');
        }
    };
    const wait = (ms) => new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        window.dakaCurrentAbortController?.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Analysis cancelled', 'AbortError'));
        }, { once: true });
    });

    const initial = await api.post(
        endpoint,
        { ...(payload || {}) },
        CONFIG.TIMEOUTLONG || CONFIG.TIMEOUT_LONG || 120000,
        { signal: window.dakaCurrentAbortController?.signal }
    );
    assertActive();

    const deliver = (data) => {
        if (data?.savedReport || data?.reportQuota) {
            refreshQuotaBadge(data.reportQuota || null).catch(() => {});
        }
        if (data?.savedReport) toast.success(authCopy().saved);
        if (data?.reportPersistence?.saved === false) toast.warning(authCopy().saveError);
        if (typeof resultsHandler === 'function') resultsHandler(data);
        return data;
    };

    // When Supabase is unavailable, the API executes the existing direct path.
    if (!initial?.jobId) return deliver(initial);

    const stepsByLang = {
        fr: ['Collecte des données...', 'Analyse du marché...', 'Construction du rapport...', 'Finalisation...'],
        en: ['Collecting data...', 'Analyzing the market...', 'Building the report...', 'Finalizing...'],
        ar: ['جمع البيانات...', 'تحليل السوق...', 'إعداد التقرير...', 'اللمسات الأخيرة...']
    };
    const steps = stepsByLang[STATE.currentLang] || stepsByLang.fr;
    const startedAt = Date.now();
    let stepIndex = 0;

    while (Date.now() - startedAt < 120000) {
        document.querySelectorAll('.loading-step-text').forEach(node => {
            node.textContent = steps[stepIndex % steps.length];
        });
        stepIndex++;

        await wait(2500);
        assertActive();
        const job = await api.get(`/api/job/${encodeURIComponent(initial.jobId)}`, 15000);
        assertActive();

        if (job?.status === 'done') return deliver(job.result);
        if (job?.status === 'error') {
            throw new Error(job.error || 'Analyse interrompue par le serveur.');
        }
    }

    throw new Error(
        STATE.currentLang === 'ar'
            ? 'انتهت المهلة — أعد المحاولة بعد بضع ثوان.'
            : STATE.currentLang === 'en'
                ? 'Timeout — try again in a few seconds.'
                : 'Timeout — réessaie dans quelques secondes.'
    );
    })();

    window.dakaAnalysisInFlight?.set(lockKey, runPromise);
    try {
        return await runPromise;
    } finally {
        if (window.dakaAnalysisInFlight?.get(lockKey) === runPromise) {
            window.dakaAnalysisInFlight.delete(lockKey);
        }
    }
}

const DakaSound = (() => {
    let ctx = null;
    let enabled = localStorage.getItem('dakaSound') !== 'off';
    let ambient = null;
    let activeLoaders = 0;
    const LOADER_MASTER_VOLUME = 0.18;
    const LOADER_PAD_VOLUME = 0.3;
    const LOADER_ARP_BUS_VOLUME = 0.52;
    const LOADER_ARP_NOTE_VOLUME = 0.24;

    const ensure = () => {
        if (!enabled) return null;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        if (!ctx) ctx = new AudioContext();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
    };

    const updateButton = () => {
        const btn = document.getElementById('soundToggle');
        if (!btn) return;
        btn.classList.toggle('muted', !enabled);
        btn.innerHTML = `<i class="fas ${enabled ? 'fa-volume-high' : 'fa-volume-xmark'}"></i>`;
        btn.setAttribute('aria-pressed', String(enabled));
    };

    const tone = (freq, start, duration, gainValue, type = 'sine', destination = null) => {
        const c = ensure();
        if (!c) return;
        const gain = c.createGain();
        const osc = c.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime + start);
        gain.gain.setValueAtTime(0.0001, c.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(gainValue, c.currentTime + start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(destination || c.destination);
        osc.start(c.currentTime + start);
        osc.stop(c.currentTime + start + duration + 0.03);
    };

    const click = (kind = 'soft') => {
        if (!enabled) return;
        const c = ensure();
        if (!c) return;
        const master = c.createGain();
        master.gain.value = kind === 'primary' ? 0.18 : 0.1;
        master.connect(c.destination);
        tone(kind === 'primary' ? 660 : 520, 0, 0.09, 0.8, 'sine', master);
        tone(kind === 'primary' ? 990 : 780, 0.035, 0.11, 0.45, 'triangle', master);
    };

    const startAmbient = () => {
        if (!enabled || ambient) return;
        const c = ensure();
        if (!c) return;

        const master = c.createGain();
        master.gain.setValueAtTime(0.0001, c.currentTime);
        master.gain.exponentialRampToValueAtTime(LOADER_MASTER_VOLUME, c.currentTime + 0.9);

        const lfo = c.createOscillator();
        const lfoGain = c.createGain();
        const filter = c.createBiquadFilter();
        lfo.type = 'sine';
        lfo.frequency.value = 0.055;
        lfoGain.gain.value = 18;
        filter.type = 'lowpass';
        filter.frequency.value = 840;
        filter.Q.value = 0.7;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        filter.connect(master);
        master.connect(c.destination);

        const freqs = [174.61, 220, 261.63, 329.63, 392];
        const oscs = freqs.map((freq, i) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = i % 2 ? 'triangle' : 'sine';
            osc.frequency.value = freq;
            gain.gain.value = LOADER_PAD_VOLUME / freqs.length;
            osc.connect(gain);
            gain.connect(filter);
            osc.start();
            return osc;
        });

        lfo.start();
        const arpGain = c.createGain();
        arpGain.gain.value = LOADER_ARP_BUS_VOLUME;
        arpGain.connect(filter);
        // Progression classique lente, pensée comme une ambiance d'étude discrète.
        const arpNotes = [261.63, 329.63, 392, 493.88, 440, 349.23, 293.66, 220];
        let arpStep = 0;
        const arpTimer = setInterval(() => {
            if (!ambient || !enabled) return;
            tone(arpNotes[arpStep % arpNotes.length], 0, 0.68, LOADER_ARP_NOTE_VOLUME, 'triangle', arpGain);
            arpStep += 1;
        }, 920);

        ambient = { master, lfo, oscs, arpGain, arpTimer };
    };

    const stopAmbient = () => {
        if (!ambient || !ctx) return;
        const current = ambient;
        current.master.gain.cancelScheduledValues(ctx.currentTime);
        current.master.gain.setValueAtTime(Math.max(current.master.gain.value, 0.0001), ctx.currentTime);
        current.master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
        setTimeout(() => {
            if (current.arpTimer) clearInterval(current.arpTimer);
            current.oscs.forEach(o => { try { o.stop(); } catch {} });
            try { current.lfo.stop(); } catch {}
            try { current.arpGain?.disconnect(); } catch {}
            try { current.master.disconnect(); } catch {}
            if (ambient === current) ambient = null;
        }, 760);
    };

    const loaderStart = () => {
        activeLoaders += 1;
        click('primary');
        startAmbient();
    };

    const loaderStop = () => {
        activeLoaders = Math.max(0, activeLoaders - 1);
        if (activeLoaders === 0) stopAmbient();
    };

    const setEnabled = (value) => {
        enabled = Boolean(value);
        localStorage.setItem('dakaSound', enabled ? 'on' : 'off');
        if (!enabled) {
            activeLoaders = 0;
            stopAmbient();
        }
        updateButton();
    };

    document.addEventListener('DOMContentLoaded', () => {
        updateButton();
        const primeAudio = () => {
            const c = ensure();
            if (!c) return;
            const gain = c.createGain();
            const osc = c.createOscillator();
            gain.gain.value = 0.0001;
            osc.frequency.value = 220;
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start();
            osc.stop(c.currentTime + 0.02);
        };
        document.addEventListener('pointerdown', primeAudio, { once: true, capture: true });
        document.getElementById('soundToggle')?.addEventListener('click', () => {
            setEnabled(!enabled);
            if (enabled) click('primary');
        });
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button, .btn, .nav-btn, .expert-card, .pill-checkbox, a.expert-card, summary, .report-section');
            if (!target || target.id === 'soundToggle') return;
            click(target.matches('.btn-lg, .btn-cosmic, .btn-success, .btn-cyber') ? 'primary' : 'soft');
        }, true);
    });

    return { click, loaderStart, loaderStop, setEnabled };
})();
window.DakaSound = DakaSound;
 // ═══════════════════════════════════════════════════════════════════
// 🎯 TAB MANAGEMENT - VERSION BLINDÉE (DYNAMIQUE)
// ═══════════════════════════════════════════════════════════════════
class TabManager {
    constructor() {
        this.navButtons = document.querySelectorAll('.nav-btn');
        this.init();
    }

    init() {
        this.navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = btn.getAttribute('data-tab');
                this.switchTab(tabName, { scroll: true });
            });
        });
    }

    switchTab(tabName, options = {}) {
        const safeTabName = String(tabName || '').trim();
        const targetTab = document.getElementById(safeTabName + 'Tab');

        if (!targetTab) {
            console.error(`❌ Onglet introuvable: ${safeTabName}Tab`);
            if (typeof toast !== 'undefined') toast.error(STATE.currentLang === 'ar' ? 'القسم غير موجود' : 'Onglet introuvable.');
            return null;
        }

        document.body.classList.add('tab-switching');

        // Masquer TOUS les contenus sans animation fragile
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-hidden', 'true');
        });

        // Retirer 'active' de TOUS les boutons
        this.navButtons = document.querySelectorAll('.nav-btn');
        this.navButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });

        // Activer l'onglet ciblé
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-hidden', 'false');

        const activeBtn = document.querySelector(`.nav-btn[data-tab="${safeTabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.setAttribute('aria-selected', 'true');
        }

        if (typeof STATE !== 'undefined') STATE.currentTab = safeTabName;

        requestAnimationFrame(() => {
            document.body.classList.remove('tab-switching');
            if (options.scroll !== false) {
                const mainEl = document.querySelector('main') || targetTab;
                const top = Math.max(0, mainEl.getBoundingClientRect().top + window.scrollY - 88);
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });

        return targetTab;
    }
}
const tabManager = new TabManager();
window.tabManager = tabManager;

        // ═══════════════════════════════════════════════════════════════════
        // 🔍 SERVER STATUS CHECKER
        // ═══════════════════════════════════════════════════════════════════

        async function checkServerStatus() {
            const statusEl = document.getElementById('serverStatus');

            try {
                const response = await api.get('/health', CONFIG.TIMEOUT_SHORT);

                if (response.success && response.status === 'healthy') {
                    statusEl.className = 'server-status online';
                    statusEl.innerHTML = `
                        <i class="fas fa-circle"></i>
                        <span>${i18n.t('serveronline')}</span>
                    `;
                    STATE.serverStatus = 'online';
                } else {
                    throw new Error('Server unhealthy');
                }
            } catch (error) {
                statusEl.className = 'server-status offline';
                statusEl.innerHTML = `
                    <i class="fas fa-circle"></i>
                    <span>${i18n.t('serveroffline')}</span>
                `;
                STATE.serverStatus = 'offline';
                console.error('Server status check failed:', error);
            }
        }

// ═══════════════════════════════════════════════════════════════════
// 🛸 MOTEUR DE CHARGEMENT DEEP INTEL (STEPS & PHASES DYNAMIQUES)
// ═══════════════════════════════════════════════════════════════════
window.dakaCurrentAbortController = null;
window.dakaAnalysisCancelled = false;
window.dakaActiveAnalysisId = 0;
window.dakaFunnelAnalysisInFlight = null;
window.dakaAnalysisInFlight = new Map();

const DAKA_LOADER_COPY = {
  competitors: {
    kicker: 'Analyse concurrentielle',
    title: 'Daka cartographie vos vrais adversaires',
    subtitle: 'Nous repérons les concurrents utiles, leurs angles faibles et les opportunités à exploiter.',
    hooks: ['Concurrents réels', 'Angles d’attaque', 'Plan de conquête']
  },
  funnel: {
    kicker: 'Analyse funnel',
    title: 'Daka révèle les pertes invisibles',
    subtitle: 'Nous suivons le parcours, les frictions et les signaux qui bloquent la conversion.',
    hooks: ['Parcours client', 'Friction', 'Conversion']
  },
  technical: {
    kicker: 'Audit de présence digitale',
    title: 'Daka inspecte les fondations de votre marché',
    subtitle: 'Structure, performance et signaux de confiance sont classés selon leur impact business.',
    hooks: ['Fondations', 'Confiance', 'Priorités business']
  },
  keywords: {
    kicker: 'Lecture de la demande marché',
    title: 'Daka fait remonter les demandes rentables',
    subtitle: 'Nous filtrons les intentions utiles pour révéler les sujets qui peuvent attirer une audience qualifiée.',
    hooks: ['Intentions', 'Demande utile', 'Opportunités']
  }
};

function enforceMutedLoaderVideos() {
  document.querySelectorAll('.daka-global-loader video, .daka-fullscreen-loader video, .daka-loader-video, .daka-header-logo-video').forEach(video => {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.controls = false;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
  });
}

function showDakaLoader(type = 'competitors') {
  const loader = document.getElementById('daka-global-loader');
  const copy = DAKA_LOADER_COPY[type] || DAKA_LOADER_COPY.competitors;
  if (!loader) return 0;

  window.dakaCurrentAbortController?.abort();
  window.dakaCurrentAbortController = new AbortController();
  window.dakaAnalysisCancelled = false;
  window.dakaActiveAnalysisId += 1;

  document.getElementById('daka-loader-kicker').textContent = copy.kicker;
  document.getElementById('daka-loader-title').textContent = copy.title;
  document.getElementById('daka-loader-subtitle').textContent = copy.subtitle;
  document.getElementById('daka-loader-hooks').innerHTML = copy.hooks.map(hook => `<span>${escapeHtml(hook)}</span>`).join('');
  enforceMutedLoaderVideos();
  loader.hidden = false;
  loader.style.display = 'grid';
  loader.classList.add('active');
  if (typeof loader.showPopover === 'function' && !loader.matches(':popover-open')) {
    try { loader.showPopover(); } catch (_) {}
  }
  document.body.classList.add('loading-active');
  document.getElementById('daka-global-loader-video')?.play().catch(() => {});
  DakaSound.loaderStop();
  DakaSound.loaderStart();
  return window.dakaActiveAnalysisId;
}

function hideDakaLoader() {
  const loader = document.getElementById('daka-global-loader');
  loader?.classList.remove('active');
  if (loader?.matches?.(':popover-open') && typeof loader.hidePopover === 'function') {
    try { loader.hidePopover(); } catch (_) {}
  }
  if (loader) {
    loader.style.display = '';
    loader.hidden = true;
  }
  document.body.classList.remove('loading-active');
  enforceMutedLoaderVideos();
  DakaSound.loaderStop();
}

function cancelDakaAnalysis() {
  window.dakaAnalysisCancelled = true;
  window.dakaActiveAnalysisId += 1;
  window.dakaCurrentAbortController?.abort();
  window.dakaFunnelAnalysisInFlight = null;
  window.dakaAnalysisInFlight?.clear();
  hideDakaLoader();
  toast.info(STATE.currentLang === 'ar' ? 'تم إلغاء التحليل.' : STATE.currentLang === 'en' ? 'Analysis cancelled.' : 'Analyse annulée.');
}

function dakaHasRequiredAnalysisInput(buttonId = '') {
  if (buttonId === 'funnelBtn') return Boolean(document.getElementById('funnelUrl')?.value?.trim());
  if (buttonId === 'technicalBtn') return Boolean(document.getElementById('techUrl')?.value?.trim());
  if (buttonId === 'kwBtn') return Boolean(document.getElementById('seedKeyword')?.value?.trim());
  if (buttonId === 'analyzeBtn') {
    return Boolean(document.getElementById('keyword')?.value?.trim() || document.getElementById('url')?.value?.trim());
  }
  return true;
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest?.('#analyzeBtn, #funnelBtn, #technicalBtn, #kwBtn, [data-analysis-loader]');
  if (!trigger || trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;
  if (!dakaHasRequiredAnalysisInput(trigger.id)) return;
  const type = trigger.id === 'funnelBtn' ? 'funnel'
    : trigger.id === 'technicalBtn' ? 'technical'
    : trigger.id === 'kwBtn' ? 'keywords'
    : trigger.dataset.analysisLoader || 'competitors';
  showDakaLoader(type);
}, true);

function loaderTypeFromId(elementId) {
  return elementId === 'loadingFunnel' ? 'funnel'
    : elementId === 'loadingTechnical' ? 'technical'
    : elementId === 'loadingKeywords' ? 'keywords'
    : 'competitors';
}

function getLoaderTips(elementId) {
  const lang = STATE.currentLang || 'fr';
  const tips = {
    fr: {
      loadingState: [
        '☕ Le temps de savourer votre café, Daka sépare le bruit du marché des vraies opportunités.',
        '✨ Pendant que la sphère respire, les forces concurrentes deviennent des choix clairs.',
        '🎯 Dans quelques instants, vous verrez quoi garder, quoi corriger et quoi attaquer.'
      ],
      loadingFunnel: [
        '☕ Pendant votre pause, Daka repère les moments où le visiteur hésite.',
        '💎 Les preuves, les objections et les appels à l’action se remettent en ordre.',
        '🎯 Vous récupérez bientôt des corrections simples à tester sans deviner.'
      ],
      loadingTechnical: [
        '☕ Pendant votre café, Daka inspecte les bases qui donnent confiance.',
        '🛡️ Les blocages invisibles se rangent du plus urgent au plus utile.',
        '⚡ Vous obtenez bientôt une liste courte pour rendre le site plus clair et plus fiable.'
      ],
      loadingKeywords: [
        '☕ Pendant que vous respirez, Daka laisse remonter les demandes qui comptent.',
        '💡 Les mots utiles montent à la surface, le bruit redescend.',
        '🎯 Vous verrez bientôt les sujets que votre audience comprend déjà.'
      ]
    },
    en: {
      loadingState: [
        '☕ While you enjoy your coffee, Daka separates market noise from real opportunity.',
        '✨ As the orb breathes, competitor signals become clearer choices.',
        '🎯 In a moment, you will see what to keep, fix, and attack.'
      ],
      loadingFunnel: [
        '☕ During your pause, Daka finds the moments where visitors hesitate.',
        '💎 Proof, objections, and calls to action are being put back in order.',
        '🎯 You will soon get simple fixes to test without guessing.'
      ],
      loadingTechnical: [
        '☕ While your coffee cools, Daka checks the foundations that build trust.',
        '🛡️ Hidden blockers are ranked from most urgent to most useful.',
        '⚡ You will soon get a short list to make the site clearer and more reliable.'
      ],
      loadingKeywords: [
        '☕ While you take a breath, Daka lets the demand that matters rise.',
        '💡 Useful words rise to the surface, noise falls away.',
        '🎯 You will soon see topics your audience already understands.'
      ]
    },
    ar: {
      loadingState: [
        '☕ بينما تستمتع بقهوتك، يفصل داكا ضجيج السوق عن الفرص الحقيقية.',
        '✨ ومع تنفس الكرة، تتحول إشارات المنافسين إلى اختيارات أوضح.',
        '🎯 بعد لحظات سترى ما يجب الحفاظ عليه، تصحيحه، والهجوم عليه.'
      ],
      loadingFunnel: [
        '☕ أثناء استراحتك، يبحث داكا عن لحظات تردد الزائر.',
        '💎 يتم ترتيب الأدلة والاعتراضات والدعوات للفعل بما يقرب القرار.',
        '🎯 ستحصل قريبا على تصحيحات بسيطة يمكن اختبارها بدون تخمين.'
      ],
      loadingTechnical: [
        '☕ بينما قهوتك أمامك، يفحص داكا الأساس الذي يصنع الثقة.',
        '🛡️ العوائق الخفية تُرتّب من الأكثر استعجالا إلى الأكثر فائدة.',
        '⚡ ستحصل قريبا على قائمة قصيرة تجعل الموقع أوضح وأكثر ثقة.'
      ],
      loadingKeywords: [
        '☕ بينما تأخذ نفسا هادئا، يرفع داكا الطلبات التي تستحق الاهتمام.',
        '💡 الكلمات المفيدة تصعد إلى السطح، والضجيج يهبط.',
        '🎯 سترى قريبا مواضيع يفهمها جمهورك بالفعل.'
      ]
    }
  };
  const byLang = tips[lang] || tips.fr;
  return byLang[elementId] || byLang.loadingState;
}

window._loaderTimers = {};

function showLoading(elementId) {
  const endpointType = loaderTypeFromId(elementId);
  const loader = document.getElementById('daka-global-loader');
  if (loader?.classList.contains('active')) {
    const copy = DAKA_LOADER_COPY[endpointType] || DAKA_LOADER_COPY.competitors;
    document.getElementById('daka-loader-kicker').textContent = copy.kicker;
    document.getElementById('daka-loader-title').textContent = copy.title;
    document.getElementById('daka-loader-subtitle').textContent = copy.subtitle;
    document.getElementById('daka-loader-hooks').innerHTML = copy.hooks.map(hook => `<span>${escapeHtml(hook)}</span>`).join('');
    return window.dakaActiveAnalysisId;
  }
  return showDakaLoader(endpointType);
}

function hideLoading(elementId) {
  hideDakaLoader();
}

// Fonction utilisée par Funnel/Competitors/Tech pour avancer la barre selon l'API
function setLoaderPhase(elementId, index) {
  const wrap = document.getElementById(elementId);
  if (!wrap) return;
  const phases = wrap.querySelectorAll('.loading-phase');
  const bar    = wrap.querySelector('.loading-progress-bar');

  phases.forEach((p, i) => {
    p.classList.remove('active', 'done');
    if (i < index)  p.classList.add('done');
    if (i === index) p.classList.add('active');
  });
  if (bar) bar.style.width = `${Math.round(((index + 0.5) / (phases.length || 1)) * 100)}%`;
}




// Garde ton setLoaderPhase EXISTANT tel quel — il est correct
// Juste ajouter le reset steps quand on avance manuellement :
function setLoaderPhase(elementId, index) {
  const wrap = document.getElementById(elementId);
  if (!wrap) return;
  const phases = wrap.querySelectorAll('.loading-phase');
  const bar    = wrap.querySelector('.loading-progress-bar');

  // Stoppe les timers auto des phases (on prend le contrôle manuellement)
  (_loaderTimers[elementId]?.phases || []).forEach(t => clearTimeout(t));

  phases.forEach((p, i) => {
    p.classList.remove('active','done');
    if (i < index)  p.classList.add('done');
    if (i === index) p.classList.add('active');
  });
  if (bar) bar.style.width = `${Math.round(((index + 0.5) / (phases.length || 1)) * 100)}%`;
}

        function showResults(elementId) {
            const results = document.getElementById(elementId);
            if (results) {
                results.classList.add('active');
            }
        }

        function hideResults(elementId) {
            const results = document.getElementById(elementId);
            if (results) {
                results.classList.remove('active');
            }
        }

        function setButtonLoading(buttonId, loading) {
            const btn = document.getElementById(buttonId);
            if (!btn) return;

            if (loading) {
                btn.classList.add('loading');
                btn.disabled = true;
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-spinner';
                }
            } else {
                btn.classList.remove('loading');
                btn.disabled = false;
                const icon = btn.querySelector('i');
                if (icon) {
                    // Restore original icon based on button
                    if (buttonId === 'analyzeBtn') icon.className = 'fas fa-rocket';
                    else if (buttonId === 'funnelBtn') icon.className = 'fas fa-filter';
                    else if (buttonId === 'technicalBtn') icon.className = 'fas fa-wrench';
                }
            }
        }

        function getScoreColor(score) {
            if (score >= 80) return 'var(--accent-success)';
            if (score >= 60) return 'var(--accent-info)';
            if (score >= 40) return 'var(--accent-warning)';
            return 'var(--accent-danger)';
        }

        function getScoreBadgeClass(score) {
            if (score >= 80) return 'badge-success';
            if (score >= 60) return 'badge-warning';
            return 'badge-danger';
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🎯 TAB 1: COMPETITORS ANALYSIS
        // ═══════════════════════════════════════════════════════════════════

      // Graphique Radar spécifique pour les 4 piliers AIDA
// Graphique Radar spécifique pour les 4 piliers AIDA


// Graphique de Benchmark (Barres)
function renderBenchmarkChart(data) {
    const ctx = document.getElementById('benchmarkChart')?.getContext('2d');
    if (!ctx || typeof Chart === 'undefined') return; // 🔥 FIX SÉCURITÉ

    if (window.benchmarkChartInstance) window.benchmarkChartInstance.destroy();

    const industryAvg = 65;
    const top10 = 88;

    window.benchmarkChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Vous', 'Moyenne', 'Top 10%'],
            datasets: [{
                data: [data.globalScore || 0, industryAvg, top10],
                backgroundColor: ['#8b5cf6', '#4b5563', '#10b981']
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { display: false } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Graphique de Flux
function renderFunnelChart(flowData) {
    const canvas = document.getElementById('funnelChart');
    if (!canvas || typeof Chart === 'undefined') return; // 🔥 FIX SÉCURITÉ

    if (window.funnelChartInstance) window.funnelChartInstance.destroy();

    const ctx = canvas.getContext('2d');
    const isAr = STATE.currentLang === 'ar';

    window.funnelChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: isAr
                ? ['الزوار', 'الانتباه', 'الاهتمام', 'الرغبة', 'العمل']
                : ['Visiteurs', 'Attention', 'Intérêt', 'Désir', 'Action'],
            datasets: [{
                label: 'Volume estimé',
                data: [flowData.visitors, flowData.attention, flowData.interest, flowData.desire, flowData.action],
                backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'],
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // Barres horizontales pour simuler un funnel
            responsive: true,
            scales: {
                x: { display: false },
                y: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// 🎯 TAB 1: COMPETITORS ANALYSIS — VERSION FIXÉE + FILTRAGE V2
// ═══════════════════════════════════════════════════════════════════
function renderCompetitorDecisionLayer(data, { isAr = false, isEn = false } = {}) {
    const intel = data?.competitorIntelligence;
    if (!intel || typeof intel !== 'object') return '';
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (v => String(v || ''));
    const dir = isAr ? 'rtl' : 'ltr';
    const labels = isAr ? {
        kicker: 'قرار السوق', verdict: 'من يتصدر السوق ولماذا؟', attack: 'زاوية الهجوم الموصى بها',
        actions: 'خطة التنفيذ ذات الأولوية', week: 'هذا الأسبوع', month: 'خلال 30 يوما',
        profiles: 'ملفات المنافسين الخمسة الرئيسيين', watch: 'مراقبة السوق',
        observed: 'ملاحظ', deduced: 'مستنتج', recommended: 'موصى به', confidence: 'الثقة',
        strengths: 'نقاط القوة الملاحظة', weaknesses: 'الثغرات المستنتجة', missing: 'الأدلة غير الواضحة',
        sell: 'ما الذي يبيعه', promise: 'وعده الرئيسي', angle: 'فرصة الهجوم', proof: 'مصادر قابلة للتحقق',
        position: 'عبارة التموضع', answers: 'الإجابات الحاسمة السبع', study: 'دراسة العرض والسوق المحلي', demand: 'إشارات الطلب', patterns: 'أنماط العروض المرصودة', factors: 'عوامل قرار الشراء', noData: 'لا توجد بيانات كافية'
    } : isEn ? {
        kicker: 'Market decision', verdict: 'Who leads the market, and why?', attack: 'Recommended attack angle',
        actions: 'Priority execution plan', week: 'This week', month: 'Next 30 days',
        profiles: 'Top 5 competitor business profiles', watch: 'Market watch',
        observed: 'Observed', deduced: 'Deduced', recommended: 'Recommended', confidence: 'Confidence',
        strengths: 'Observed strengths', weaknesses: 'Deduced openings', missing: 'Insufficiently proven',
        sell: 'What they sell', promise: 'Primary promise', angle: 'Attack opening', proof: 'Verifiable sources',
        position: 'Positioning statement', answers: 'Seven decisive answers', study: 'Offer and local market study', demand: 'Demand signals', patterns: 'Observed offer patterns', factors: 'Purchase decision factors', noData: 'Insufficient data'
    } : {
        kicker: 'Decision marche', verdict: 'Qui domine le marche, et pourquoi ?', attack: "Angle d'attaque recommande",
        actions: "Plan d'execution prioritaire", week: 'Cette semaine', month: 'Dans les 30 prochains jours',
        profiles: 'Fiches business des 5 concurrents principaux', watch: 'Surveillance du marche',
        observed: 'Observe', deduced: 'Deduit', recommended: 'Recommande', confidence: 'Confiance',
        strengths: 'Forces observees', weaknesses: 'Ouvertures deduites', missing: 'Preuves insuffisantes',
        sell: 'Ce qu’il vend', promise: 'Promesse principale', angle: "Angle d'attaque", proof: 'Sources consultables',
        position: 'Phrase de positionnement', answers: 'Les sept reponses decisives', study: "Etude de l'offre et du marche local", demand: 'Signaux de demande', patterns: "Formats d'offre observes", factors: "Facteurs de decision d'achat", noData: 'Donnees insuffisantes'
    };
    const list = (items, tone = 'observed') => {
        const arr = Array.isArray(items) ? items.filter(Boolean) : [];
        return arr.length ? `<ul class="business-intel-list business-intel-${tone}">${arr.map(x => `<li>${esc(typeof x === 'string' ? x : x.action || x.title || '')}</li>`).join('')}</ul>` : `<p class="business-intel-empty">${esc(labels.noData)}</p>`;
    };
    const evidence = (links) => {
        const arr = Array.isArray(links) ? links.filter(Boolean) : [];
        return arr.length ? `<div class="business-intel-evidence">${arr.slice(0, 5).map((link, i) => {
            const url = typeof link === 'string' ? link : link.url;
            let name = typeof link === 'string' ? link : (link.label || link.url);
            try { if (typeof link === 'string') name = new URL(link).hostname; } catch (_) {}
            return `<a href="${esc(url)}" target="_blank" rel="noopener" data-no-collapse="true"><i class="fas fa-arrow-up-right-from-square"></i>${esc(name || `Source ${i + 1}`)}</a>`;
        }).join('')}</div>` : '';
    };
    const verdict = intel.marketVerdict || {};
    const whyDetails = Array.isArray(verdict.whyTheyWinDetails) ? verdict.whyTheyWinDetails : [];
    const categoryLabels = isAr
        ? { positionnement:'التموضع', preuve:'الدليل', offre:'العرض', conversion:'التحويل', acquisition:'الاكتساب', confiance:'الثقة' }
        : isEn
            ? { positionnement:'Positioning', preuve:'Proof', offre:'Offer', conversion:'Conversion', acquisition:'Acquisition', confiance:'Trust' }
            : { positionnement:'Positionnement', preuve:'Preuve', offre:'Offre', conversion:'Conversion', acquisition:'Acquisition', confiance:'Confiance' };
    const scopeLabels = isAr
        ? { brand_site:'الموقع والعلامة', market_visibility:'الحضور في السوق', commercial_journey:'المسار التجاري' }
        : isEn
            ? { brand_site:'Site and brand', market_visibility:'Market visibility', commercial_journey:'Commercial journey' }
            : { brand_site:'Site et marque', market_visibility:'Visibilite marche', commercial_journey:'Parcours commercial' };
    const attack = intel.recommendedAttackAngle || {};
    const normalizeDecisionText = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const attackPromise = normalizeDecisionText(attack.promiseToMake) !== normalizeDecisionText(attack.positioningStatement)
        ? attack.promiseToMake
        : '';
    const attackProofs = Array.isArray(attack.proofsToAdd) ? attack.proofsToAdd.filter(Boolean) : [];
    const actions = Array.isArray(intel.priorityActions) ? intel.priorityActions : [];
    const actionCards = (horizon) => actions.filter(x => x.horizon === horizon).map(action => `
        <article class="business-action-card">
            <div><span class="business-category">${esc(categoryLabels[action.category] || action.category || labels.recommended)}</span><span class="business-confidence">${esc(action.confidence || 'MEDIUM')}</span></div>
            <strong>${esc(action.action)}</strong>
            <p>${esc(action.why || '')}</p>
            <footer><span>Impact: ${esc(action.impact || 'MEDIUM')}</span><span>Effort: ${esc(action.effort || 'MEDIUM')}</span></footer>
        </article>`).join('');
    const profiles = (intel.competitorProfiles || []).map((p, index) => `
        <article class="business-profile-card">
            <header>
                <span class="business-rank">#${index + 1}</span>
                <div><h4>${esc(p.domain || p.title)}</h4><small>${esc(labels.confidence)}: ${esc(p.confidence || 'LOW')}</small></div>
                ${p.url ? `<a class="business-profile-link" href="${esc(p.url)}" target="_blank" rel="noopener" data-no-collapse="true" aria-label="${esc(labels.proof)}"><i class="fas fa-arrow-up-right-from-square"></i></a>` : ''}
            </header>
            <div class="business-profile-summary">
                <div><span>${esc(labels.sell)}</span><strong>${esc(p.whatTheySell || labels.noData)}</strong></div>
                <div><span>${esc(labels.promise)}</span><strong>${esc(p.primaryPromise || labels.noData)}</strong></div>
                <div class="business-profile-angle"><span>${esc(labels.angle)}</span><strong>${esc(p.attackAngle || labels.noData)}</strong></div>
            </div>
            <details>
                <summary>${esc(isAr ? 'عرض الأدلة والتفاصيل' : isEn ? 'View evidence and details' : 'Voir les preuves et details')}</summary>
                <div class="business-profile-details">
                    <section><h5>${esc(labels.observed)} · ${esc(labels.strengths)}</h5>${list(p.observedStrengths, 'observed')}</section>
                    <section><h5>${esc(labels.deduced)} · ${esc(labels.weaknesses)}</h5>${list(p.deducedWeaknesses, 'deduced')}</section>
                    <section><h5>${esc(labels.missing)}</h5>${list(p.missingProofs, 'recommended')}</section>
                    ${evidence(p.evidenceLinks)}
                </div>
            </details>
        </article>`).join('');
    const surveillance = intel.surveillance || {};
    const watchItems = [...(surveillance.competitors || []), ...(surveillance.marketSources || [])].slice(0, 10);
    const finalAnswers = intel.finalAnswers || {};
    const study = intel.productMarketStudy || {};
    const answerRows = [
        [isAr ? 'من يتصدر؟' : isEn ? 'Who wins?' : 'Qui gagne ?', finalAnswers.whoWins],
        [isAr ? 'لماذا؟' : isEn ? 'Why do they win?' : 'Pourquoi ?', finalAnswers.whyTheyWin],
        [isAr ? 'أين نقاط الضعف؟' : isEn ? 'Where are the openings?' : 'Ou sont les faiblesses ?', finalAnswers.weaknesses],
        [isAr ? 'ما الموقع الذي يجب اتخاذه؟' : isEn ? 'What position should you take?' : 'Quelle position prendre ?', finalAnswers.positionToTake],
        [isAr ? 'ماذا تفعل هذا الأسبوع؟' : isEn ? 'What should happen this week?' : 'Que faire cette semaine ?', (finalAnswers.thisWeek || []).map(x => x.action)],
        [isAr ? 'ماذا تبني خلال 30 يوما؟' : isEn ? 'What should be built in 30 days?' : 'Que construire sous 30 jours ?', (finalAnswers.next30Days || []).map(x => x.action)],
        [isAr ? 'ما الأدلة الناقصة؟' : isEn ? 'Which proof is still missing?' : 'Quelles preuves manquent ?', finalAnswers.missingProofs]
    ];
    return `
    <section class="business-intel-shell" data-export-feature="summary" dir="${dir}">
        <div class="business-intel-kicker"><i class="fas fa-chess-queen"></i>${esc(labels.kicker)}</div>
        ${(hasVerdictCard || hasAttackCard) ? `<div class="business-verdict-grid">` : ''}
            ${hasVerdictCard ? `<article class="business-verdict-card">` : ''}
                <span class="business-type business-type-deduced">${esc(labels.deduced)}</span>
                <h2>${esc(labels.verdict)}</h2>
                <strong class="business-leader">${esc(verdict.currentLeader || labels.noData)}</strong>
                ${whyDetails.length ? `<div class="business-why-details">${whyDetails.map(item => `<article><span>${esc(scopeLabels[item.scope] || item.scope || labels.deduced)} · ${esc(item.confidence || 'LOW')}</span><p>${esc(item.reason || '')}</p></article>`).join('')}</div>` : list(verdict.whyTheyWin, 'observed')}
                <p>${esc(verdict.marketPattern || '')}</p>
                ${evidence(verdict.evidenceLinks)}
            ${hasVerdictCard ? `</article>` : ''}
            ${hasAttackCard ? `<article class="business-attack-card">` : ''}
                <span class="business-type business-type-recommended">${esc(labels.recommended)}</span>
                <h2>${esc(labels.attack)}</h2>
                <strong>${esc(attack.positioningStatement || labels.noData)}</strong>
                ${attackPromise ? `<p>${esc(attackPromise)}</p>` : ''}
                ${attackProofs.length ? `<h5>${esc(labels.missing)}</h5>${list(attackProofs, 'recommended')}` : ''}
            ${hasAttackCard ? `</article>` : ''}
        ${(hasVerdictCard || hasAttackCard) ? `</div>` : ''}
        ${hasStudy ? `<article class="business-study-card">` : ''}
            <header><span class="business-type business-type-deduced">${esc(labels.deduced)}</span><h3>${esc(labels.study)} · ${esc(study.subject || '')} · ${esc(study.geo || '')}</h3></header>
            <div class="business-study-grid">
                <section><h5>${esc(labels.demand)}</h5>${list(study.observedDemandSignals, 'observed')}</section>
                <section><h5>${esc(labels.patterns)}</h5>${list(study.observedOfferPatterns, 'observed')}</section>
                <section><h5>${esc(labels.factors)}</h5>${list(study.buyerDecisionFactors, 'deduced')}</section>
                <section><h5>${esc(labels.weaknesses)}</h5>${list(study.exploitableOpenings, 'recommended')}</section>
            </div>
            ${evidence(study.evidenceLinks)}
        ${hasStudy ? `</article>` : ''}
        ${hasPlan ? `<div class="business-plan">` : ''}
            <h3><i class="fas fa-list-check"></i>${esc(labels.actions)}</h3>
            <div class="business-plan-column"><h4>${esc(labels.week)}</h4><div class="business-actions-grid">${actionCards('7_DAYS') || `<p class="business-intel-empty">${esc(labels.noData)}</p>`}</div></div>
            <div class="business-plan-column"><h4>${esc(labels.month)}</h4><div class="business-actions-grid">${actionCards('30_DAYS') || `<p class="business-intel-empty">${esc(labels.noData)}</p>`}</div></div>
        </div>
        <div class="business-profiles"><h3><i class="fas fa-building"></i>${esc(labels.profiles)}</h3><div class="business-profiles-grid">${profiles}</div></div>
        <details class="business-watch business-final-answers"><summary><i class="fas fa-circle-check"></i>${esc(labels.answers)}</summary><div class="business-answer-grid">${answerRows.map(([question, answer]) => `<article><strong>${esc(question)}</strong>${Array.isArray(answer) ? list(answer, 'deduced') : `<p>${esc(answer || labels.noData)}</p>`}</article>`).join('')}</div></details>
        ${watchItems.length ? `<details class="business-watch"><summary><i class="fas fa-binoculars"></i>${esc(labels.watch)} (${watchItems.length})</summary><div>${watchItems.map(x => `<a href="${esc(x.url || '#')}" target="_blank" rel="noopener" data-no-collapse="true"><strong>${esc(x.domain || x.title || x.url)}</strong><small>${esc(x.role || x.rejectionReason || '')}</small><small>${esc(x.recommendedUse || '')}</small></a>`).join('')}</div></details>` : ''}
    </section>`;
}

function getCompetitorRenderLabels(langCode = 'fr') {
    if (langCode === 'ar') {
        return {
            kicker: '\u0627\u0633\u062a\u062e\u0628\u0627\u0631\u0627\u062a Daka \u0644\u0644\u0633\u0648\u0642 \u0648\u0627\u0644\u0642\u0631\u0627\u0631',
            opening: '\u0627\u0644\u0641\u062a\u062d\u0629 \u0627\u0644\u0623\u0648\u0644\u0649',
            openingSub: '\u0646\u0638\u0631\u0629 \u0633\u0631\u064a\u0639\u0629 \u0648\u062f\u0642\u064a\u0642\u0629 \u0644\u0645\u0627 \u064a\u062c\u0631\u064a \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0633\u0648\u0642.',
            whoCaptures: '\u0645\u0646 \u064a\u0642\u062a\u0646\u0635 \u0627\u0644\u0637\u0644\u0628\u061f',
            whyAdvance: '\u0644\u0645\u0627\u0630\u0627 \u064a\u062a\u0642\u062f\u0645\u061f',
            whereAttack: '\u0623\u064a\u0646 \u0646\u0636\u0631\u0628\u061f',
            whatNow: '\u0645\u0627\u0630\u0627 \u0646\u0641\u0639\u0644 \u0627\u0644\u0622\u0646\u061f',
            verdict: '\u0645\u0646 \u064a\u062a\u0635\u062f\u0631 \u0627\u0644\u0633\u0648\u0642\u061f',
            attack: '\u0627\u0644\u062a\u0645\u0648\u0636\u0639 \u0627\u0644\u0645\u0642\u062a\u0631\u062d',
            study: '\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0633\u0648\u0642',
            actions: '\u062e\u0637\u0629 \u0627\u0644\u0647\u062c\u0648\u0645 \u0627\u0644\u0623\u0648\u0644\u0648\u064a\u0629',
            profiles: '\u0627\u0644\u0645\u0646\u0627\u0641\u0633\u0648\u0646 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0648\u0646',
            sources: '\u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0648\u0627\u0644\u0642\u0646\u0648\u0627\u062a',
            answers: '\u0627\u0644\u062e\u0644\u0627\u0635\u0629 \u0627\u0644\u0646\u0647\u0627\u0626\u064a\u0629',
            positioning: '\u0627\u0644\u062a\u0645\u0648\u0636\u0639 \u0627\u0644\u0630\u064a \u0646\u0646\u0635\u062d \u0628\u0647',
            demand: '\u0625\u0634\u0627\u0631\u0627\u062a \u0627\u0644\u0637\u0644\u0628',
            patterns: '\u0623\u0646\u0645\u0627\u0637 \u0627\u0644\u0639\u0631\u0636',
            factors: '\u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u0642\u0631\u0627\u0631',
            openings: '\u0627\u0644\u062b\u063a\u0631\u0627\u062a \u0627\u0644\u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u063a\u0644\u0627\u0644',
            sell: '\u0645\u0627 \u0627\u0644\u0630\u064a \u064a\u0628\u064a\u0639\u0647',
            promise: '\u0627\u0644\u0648\u0639\u062f \u0627\u0644\u0631\u0626\u064a\u0633\u064a',
            strength: '\u0646\u0642\u0637\u0629 \u0627\u0644\u0642\u0648\u0629',
            weakness: '\u0627\u0644\u0636\u0639\u0641 \u0627\u0644\u0642\u0627\u0628\u0644 \u0644\u0644\u0627\u0633\u062a\u063a\u0644\u0627\u0644',
            angle: '\u0632\u0627\u0648\u064a\u0629 \u0627\u0644\u0647\u062c\u0648\u0645',
            action: '\u0627\u0644\u0625\u062c\u0631\u0627\u0621 \u0627\u0644\u0645\u0642\u062a\u0631\u062d',
            confidence: '\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062b\u0642\u0629',
            proofs: '\u0639\u0631\u0636 \u0627\u0644\u0623\u062f\u0644\u0629',
            watch: '\u0645\u0627 \u064a\u062c\u0628 \u0645\u0631\u0627\u0642\u0628\u062a\u0647',
            social: '\u0645\u0635\u0627\u062f\u0631 \u0627\u062c\u062a\u0645\u0627\u0639\u064a\u0629',
            distribution: '\u0642\u0646\u0648\u0627\u062a \u0627\u0644\u062a\u0648\u0632\u064a\u0639',
            directCount: '\u0645\u0646\u0627\u0641\u0633 \u0645\u0628\u0627\u0634\u0631',
            signalCount: '\u0625\u0634\u0627\u0631\u0629 \u0645\u0641\u064a\u062f\u0629',
            sourceCount: '\u0645\u0635\u062f\u0631 \u0633\u0648\u0642\u064a',
            actionCount: '\u062d\u0631\u0643\u0629 \u0641\u0648\u0631\u064a\u0629',
            week: '\u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639',
            month: '\u062e\u0644\u0627\u0644 30 \u064a\u0648\u0645\u0627',
            why: '\u0644\u0645\u0627\u0630\u0627 \u064a\u0641\u0648\u0632\u061f',
            where: '\u0623\u064a\u0646 \u0627\u0644\u062b\u063a\u0631\u0629\u061f',
            position: '\u0645\u0627 \u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0630\u064a \u0646\u0623\u062e\u0630\u0647\u061f',
            missing: '\u0645\u0627 \u0627\u0644\u0623\u062f\u0644\u0629 \u0627\u0644\u0646\u0627\u0642\u0635\u0629\u061f',
            evidence: '\u0623\u062f\u0644\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u062d\u0642\u0642',
            observed: '\u0645\u0631\u0635\u0648\u062f',
            deduced: '\u0645\u0633\u062a\u0646\u062a\u062c',
            recommended: '\u0645\u0648\u0635\u0649 \u0628\u0647',
            impact: '\u0627\u0644\u0623\u062b\u0631',
            effort: '\u0627\u0644\u062c\u0647\u062f',
            noData: '\u0644\u0627 \u0634\u064a\u0621 \u0642\u0627\u0628\u0644 \u0644\u0644\u062f\u0641\u0627\u0639 \u0644\u0639\u0631\u0636\u0647 \u0647\u0646\u0627.'
        };
    }
    if (langCode === 'en') {
        return {
            kicker: 'Daka Market Insight Intelligence',
            opening: 'The strategic opening',
            openingSub: 'A short, evidence-led read of who owns the demand and where the opening really is.',
            whoCaptures: 'Who captures demand?',
            whyAdvance: 'Why are they ahead?',
            whereAttack: 'Where can you attack?',
            whatNow: 'What should move now?',
            verdict: 'Who leads this market?',
            attack: 'Recommended strategic position',
            study: 'Market reading',
            actions: 'Priority attack plan',
            profiles: 'Direct competitors',
            sources: 'Benchmarks, channels and market sources',
            answers: 'Final business answers',
            positioning: 'Recommended position',
            demand: 'Observed demand',
            patterns: 'Offer patterns',
            factors: 'Decision factors',
            openings: 'Exploitable openings',
            sell: 'What they sell',
            promise: 'Primary promise',
            strength: 'Why they are strong',
            weakness: 'Exploitable weakness',
            angle: 'Attack angle',
            action: 'Concrete action',
            confidence: 'Confidence',
            proofs: 'View proof',
            watch: 'Watch list',
            social: 'Social sources',
            distribution: 'Distribution channels',
            directCount: 'direct competitors',
            signalCount: 'useful signals',
            sourceCount: 'market sources',
            actionCount: 'immediate moves',
            week: 'This week',
            month: 'Next 30 days',
            why: 'Why do they win?',
            where: 'Where is the opening?',
            position: 'Which position should you take?',
            missing: 'Which proof is still missing?',
            evidence: 'Verifiable sources',
            observed: 'Observed',
            deduced: 'Deduced',
            recommended: 'Recommended',
            impact: 'Impact',
            effort: 'Effort',
            noData: 'No defensible data to surface here yet.'
        };
    }
    return {
        kicker: 'Daka Market Insight Intelligence',
        opening: 'L\'ouverture strat\u00e9gique',
        openingSub: 'Une lecture courte, concr\u00e8te et fond\u00e9e sur les signaux qui montrent qui capte la demande et o\u00f9 frapper.',
        whoCaptures: 'Qui capte la demande ?',
        whyAdvance: 'Pourquoi il avance ?',
        whereAttack: 'O\u00f9 attaquer ?',
        whatNow: 'Quoi faire maintenant ?',
        verdict: 'Qui domine ce march\u00e9 ?',
        attack: 'Position strat\u00e9gique recommand\u00e9e',
        study: 'Lecture du march\u00e9',
        actions: 'Plan d\'attaque prioritaire',
        profiles: 'Concurrents directs',
        sources: 'Benchmarks, canaux et sources march\u00e9',
        answers: 'R\u00e9ponses business finales',
        positioning: 'Position \u00e0 prendre',
        demand: 'Demande observ\u00e9e',
        patterns: 'Patterns d\'offre',
        factors: 'Crit\u00e8res de d\u00e9cision',
        openings: 'Faiblesses exploitables',
        sell: 'Ce qu\'il vend',
        promise: 'Promesse principale',
        strength: 'Pourquoi il est fort',
        weakness: 'Faiblesse exploitable',
        angle: 'Angle d\'attaque',
        action: 'Action concr\u00e8te',
        confidence: 'Confiance',
        proofs: 'Voir les preuves',
        watch: '\u00c0 surveiller',
        social: 'Sources sociales',
        distribution: 'Canaux de distribution',
        directCount: 'concurrents directs',
        signalCount: 'signaux utiles',
        sourceCount: 'sources march\u00e9',
        actionCount: 'actions imm\u00e9diates',
        week: 'Cette semaine',
        month: 'Sous 30 jours',
        why: 'Pourquoi gagne-t-il ?',
        where: 'O\u00f9 se trouve l\'ouverture ?',
        position: 'Quelle position prendre ?',
        missing: 'Quelles preuves manquent ?',
        evidence: 'Sources v\u00e9rifiables',
        observed: 'Observ\u00e9',
        deduced: 'D\u00e9duit',
        recommended: 'Recommand\u00e9',
        impact: 'Impact',
        effort: 'Effort',
        noData: 'Aucune mati\u00e8re vraiment d\u00e9fendable \u00e0 afficher ici.'
    };
}

function initCompetitorShowcaseMotion(root) {
    if (!root || typeof window === 'undefined' || !window.gsap) return;
    if (root._competitorGsapContext && typeof root._competitorGsapContext.revert === 'function') {
        root._competitorGsapContext.revert();
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
    root._competitorGsapContext = window.gsap.context(() => {
        window.gsap.from('.business-intel-hero-copy > *', {
            y: 18,
            opacity: 0,
            duration: 0.55,
            stagger: 0.06,
            ease: 'power2.out'
        });
        window.gsap.from('.business-pulse-card', {
            y: 20,
            opacity: 0,
            duration: 0.48,
            stagger: 0.07,
            ease: 'power2.out'
        });
        if (!window.ScrollTrigger) return;
        root.querySelectorAll('.business-verdict-card, .business-attack-card, .business-study-grid section, .business-action-card, .business-profile-card, .business-source-group, .business-answer-grid article, .business-intel-positioning-card').forEach((node, index) => {
            window.gsap.from(node, {
                y: 22,
                opacity: 0,
                duration: 0.48,
                delay: Math.min(index * 0.015, 0.16),
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: node,
                    start: 'top 88%',
                    once: true
                }
            });
        });
    }, root);
}

function renderCompetitorDecisionLayerV2(data, { isAr = false, isEn = false } = {}) {
    const intel = data?.competitorIntelligence;
    if (!intel || typeof intel !== 'object') return '';

    const langCode = isAr ? 'ar' : isEn ? 'en' : 'fr';
    const labels = getCompetitorRenderLabels(langCode);
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (v => String(v || ''));
    const dir = isAr ? 'rtl' : 'ltr';

    const toText = (value) => {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        if (typeof value === 'object') {
            return value.action || value.reason || value.title || value.label || value.text || value.value || value.name || value.url || '';
        }
        return String(value || '');
    };

    const normalizeText = (value) => toText(value).replace(/\s+/g, ' ').replace(/^[\-\u2014\s]+|[\-\u2014\s]+$/g, '').trim();
    const isUseful = (value) => {
        const clean = normalizeText(value).toLowerCase();
        return !!clean && !['null', 'undefined', '-', '\u2014', 'n/a', 'na'].includes(clean);
    };
    const cleanItems = (items, limit = 5) => {
        const seen = new Set();
        const source = Array.isArray(items) ? items : [items];
        const out = [];
        source.forEach((item) => {
            const text = normalizeText(item);
            const key = text.toLowerCase();
            if (!text || seen.has(key)) return;
            seen.add(key);
            out.push(text);
        });
        return out.slice(0, limit);
    };
    const list = (items, tone = 'observed', limit = 5) => {
        const arr = cleanItems(items, limit);
        if (!arr.length) return '';
        return `<ul class="business-intel-list business-intel-${tone}">${arr.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
    };
    const paragraph = (value, className = '') => isUseful(value) ? `<p${className ? ` class="${className}"` : ''}>${esc(normalizeText(value))}</p>` : '';
    const evidence = (links, limit = 5) => {
        const items = (Array.isArray(links) ? links : []).filter(Boolean).slice(0, limit);
        if (!items.length) return '';
        return `<div class="business-intel-evidence">${items.map((item, index) => {
            const url = typeof item === 'string' ? item : item.url;
            if (!url) return '';
            let label = typeof item === 'string' ? '' : item.label;
            if (!label) {
                try { label = new URL(url).hostname.replace(/^www\./, ''); } catch (_) { label = `${labels.evidence} ${index + 1}`; }
            }
            return `<a href="${esc(url)}" target="_blank" rel="noopener" type="button" data-no-collapse="true"><i class="fas fa-arrow-up-right-from-square"></i>${esc(label)}</a>`;
        }).join('')}</div>`;
    };
    const confidenceBadge = (value) => isUseful(value) ? `<span class="business-confidence">${esc(normalizeText(value))}</span>` : '';

    const verdict = intel.marketVerdict || {};
    const attack = intel.recommendedAttackAngle || {};
    const study = intel.productMarketStudy || {};
    const finalAnswers = intel.finalAnswers || {};
    const surveillance = intel.surveillance || {};
    const priorityActions = Array.isArray(intel.priorityActions) ? intel.priorityActions : [];
    const profilesSource = Array.isArray(intel.competitorProfiles) ? intel.competitorProfiles : [];

    const directProfiles = profilesSource.filter((profile) => cleanItems([profile?.domain, profile?.whatTheySell, profile?.primaryPromise, profile?.attackAngle, profile?.concreteAction]).length).slice(0, 5);
    const weekActions = priorityActions.filter((item) => String(item?.horizon || '').toUpperCase() === '7_DAYS').slice(0, 3);
    const monthActions = priorityActions.filter((item) => String(item?.horizon || '').toUpperCase() === '30_DAYS').slice(0, 3);
    const nowActions = priorityActions.filter((item) => !String(item?.horizon || '').trim() || String(item?.horizon || '').toUpperCase() === 'NOW').slice(0, 3);

    const sourceGroups = [
        { title: labels.watch, items: surveillance.competitors },
        { title: labels.distribution, items: surveillance.distributionChannels },
        { title: labels.social, items: surveillance.socialSources },
        { title: labels.sources, items: surveillance.marketSources }
    ].map((group) => ({ ...group, items: (Array.isArray(group.items) ? group.items : []).filter(Boolean).slice(0, 8) })).filter((group) => group.items.length);

    const metricCards = [
        { value: directProfiles.length, label: labels.directCount },
        { value: cleanItems([...(study.observedDemandSignals || []), ...(study.observedOfferPatterns || []), ...(study.buyerDecisionFactors || []), ...(study.exploitableOpenings || [])], 20).length, label: labels.signalCount },
        { value: sourceGroups.reduce((sum, group) => sum + group.items.length, 0), label: labels.sourceCount },
        { value: cleanItems(priorityActions.map((item) => item?.action), 20).length, label: labels.actionCount }
    ].filter((item) => item.value > 0);

    const pulseCards = [
        {
            title: labels.whoCaptures,
            value: verdict.currentLeader || directProfiles[0]?.domain || finalAnswers.whoWins,
            note: cleanItems(verdict.whyTheyWin, 1)[0] || normalizeText(verdict.marketPattern || '')
        },
        {
            title: labels.whyAdvance,
            value: cleanItems(verdict.whyTheyWin, 1)[0] || directProfiles[0]?.primaryPromise || study.observedOfferPatterns?.[0],
            note: normalizeText(verdict.confidenceExplanation || '')
        },
        {
            title: labels.whereAttack,
            value: cleanItems(finalAnswers.weaknesses, 1)[0] || cleanItems(study.exploitableOpenings, 1)[0] || cleanItems(attack.proofsToAdd, 1)[0],
            note: cleanItems(study.exploitableOpenings, 2)[1] || ''
        },
        {
            title: labels.whatNow,
            value: normalizeText(nowActions[0]?.action || weekActions[0]?.action || finalAnswers.thisWeek?.[0]?.action || attack.positioningStatement || ''),
            note: normalizeText(nowActions[0]?.why || weekActions[0]?.why || '')
        }
    ].filter((item) => isUseful(item.value));

    const geoNote = normalizeText(intel.geoInterpretation?.mismatchNote || '');
    const positioningText = normalizeText(intel.positioning || attack.positioningStatement || finalAnswers.positionToTake || '');
    const editorialTitle = normalizeText(intel.editorialTitle || verdict.currentLeader || finalAnswers.whoWins || [data.keyword, intel.geoInterpretation?.market].filter(Boolean).join(' ? ') || labels.verdict);
    const editorialSubtitle = normalizeText(intel.editorialSubtitle || verdict.marketPattern || cleanItems(study.observedDemandSignals, 1)[0] || cleanItems(study.buyerDecisionFactors, 1)[0] || attack.promiseToMake || study.subject || labels.openingSub);

    const actionCard = (item) => {
        if (!item || !isUseful(item.action)) return '';
        return `
            <article class="business-action-card">
                <div>
                    <span class="business-category">${esc(normalizeText(item.category || labels.recommended))}</span>
                    ${confidenceBadge(item.confidence || 'MEDIUM')}
                </div>
                <strong>${esc(normalizeText(item.action))}</strong>
                ${paragraph(item.why)}
                <footer>
                    ${isUseful(item.impact) ? `<span>${esc(labels.impact)}: ${esc(normalizeText(item.impact))}</span>` : ''}
                    ${isUseful(item.effort) ? `<span>${esc(labels.effort)}: ${esc(normalizeText(item.effort))}</span>` : ''}
                </footer>
            </article>`;
    };

    const profileCards = directProfiles.map((profile, index) => {
        const strengths = cleanItems(profile.observedStrengths, 2);
        const weaknesses = cleanItems(profile.deducedWeaknesses, 2);
        const proofs = cleanItems(profile.missingProofs, 2);
        const detailsVisible = strengths.length || weaknesses.length || proofs.length || (Array.isArray(profile.evidenceLinks) && profile.evidenceLinks.length);
        return `
            <article class="business-profile-card">
                <header>
                    <span class="business-rank">#${index + 1}</span>
                    <div>
                        <h4>${esc(normalizeText(profile.domain || profile.title || ''))}</h4>
                        <div class="business-profile-meta">
                            ${isUseful(profile.typeLabel || profile.category) ? `<span>${esc(normalizeText(profile.typeLabel || profile.category))}</span>` : ''}
                            ${isUseful(profile.confidence) ? `<span>${esc(normalizeText(profile.confidence))}</span>` : ''}
                        </div>
                    </div>
                    ${profile.url ? `<a class="business-profile-link" href="${esc(profile.url)}" target="_blank" rel="noopener" type="button" data-no-collapse="true" aria-label="${esc(labels.proofs)}"><i class="fas fa-arrow-up-right-from-square"></i></a>` : ''}
                </header>
                <div class="business-profile-summary">
                    ${isUseful(profile.whatTheySell) ? `<div><span>${esc(labels.sell)}</span><strong>${esc(normalizeText(profile.whatTheySell))}</strong></div>` : ''}
                    ${isUseful(profile.primaryPromise) ? `<div><span>${esc(labels.promise)}</span><strong>${esc(normalizeText(profile.primaryPromise))}</strong></div>` : ''}
                    ${strengths.length ? `<div><span>${esc(labels.strength)}</span><strong>${esc(strengths[0])}</strong></div>` : ''}
                    ${weaknesses.length ? `<div><span>${esc(labels.weakness)}</span><strong>${esc(weaknesses[0])}</strong></div>` : ''}
                    ${isUseful(profile.attackAngle) ? `<div class="business-profile-angle"><span>${esc(labels.angle)}</span><strong>${esc(normalizeText(profile.attackAngle))}</strong></div>` : ''}
                    ${isUseful(profile.concreteAction) ? `<div class="business-profile-action"><span>${esc(labels.action)}</span><strong>${esc(normalizeText(profile.concreteAction))}</strong></div>` : ''}
                </div>
                ${paragraph(profile.confidenceExplanation || (profile.confidence ? `${labels.confidence}: ${profile.confidence}` : ''), 'business-profile-confidence')}
                ${detailsVisible ? `<details><summary>${esc(labels.proofs)}</summary><div class="business-profile-details">${list(profile.observedStrengths, 'observed', 3)}${list(profile.deducedWeaknesses, 'deduced', 3)}${list(profile.missingProofs, 'recommended', 3)}${evidence(profile.evidenceLinks, 4)}</div></details>` : ''}
            </article>`;
    }).join('');

    const studySections = [
        cleanItems(study.observedDemandSignals).length ? `<section><h5>${esc(labels.demand)}</h5>${list(study.observedDemandSignals, 'observed')}</section>` : '',
        cleanItems(study.observedOfferPatterns).length ? `<section><h5>${esc(labels.patterns)}</h5>${list(study.observedOfferPatterns, 'observed')}</section>` : '',
        cleanItems(study.buyerDecisionFactors).length ? `<section><h5>${esc(labels.factors)}</h5>${list(study.buyerDecisionFactors, 'deduced')}</section>` : '',
        cleanItems(study.exploitableOpenings).length ? `<section><h5>${esc(labels.openings)}</h5>${list(study.exploitableOpenings, 'recommended')}</section>` : ''
    ].filter(Boolean).join('');

    const answerRows = [
        { question: labels.why, answer: finalAnswers.whyTheyWin },
        { question: labels.where, answer: finalAnswers.weaknesses },
        { question: labels.position, answer: finalAnswers.positionToTake },
        { question: labels.week, answer: (finalAnswers.thisWeek || []).map((item) => item.action) },
        { question: labels.month, answer: (finalAnswers.next30Days || []).map((item) => item.action) },
        { question: labels.missing, answer: finalAnswers.missingProofs }
    ].filter((row) => cleanItems(row.answer).length).map((row) => `<article><strong>${esc(row.question)}</strong>${Array.isArray(row.answer) ? list(row.answer, 'deduced') : paragraph(row.answer)}</article>`).join('');

    const sourceSectionHtml = sourceGroups.map((group) => `
        <section class="business-source-group">
            <h4>${esc(group.title)} (${group.items.length})</h4>
            <div class="business-source-list">
                ${group.items.map((item) => `
                    <a href="${esc(item.url || '#')}" target="_blank" rel="noopener" type="button" data-no-collapse="true">
                        <strong>${esc(normalizeText(item.domain || item.title || item.url || ''))}</strong>
                        ${isUseful(item.typeLabel || item.role) ? `<small>${esc(normalizeText(item.typeLabel || item.role))}</small>` : ''}
                        ${isUseful(item.recommendedUse || item.rejectionReason) ? `<small>${esc(normalizeText(item.recommendedUse || item.rejectionReason))}</small>` : ''}
                    </a>`).join('')}
            </div>
        </section>`).join('');

    return `
    <section class="business-intel-shell" data-export-feature="summary" dir="${dir}">
        <div class="business-intel-cinematic">
            <div class="business-intel-kicker"><i class="fas fa-chess-queen"></i>${esc(labels.kicker)}</div>
            <div class="business-intel-hero">
                <article class="business-intel-hero-copy">
                    <span class="business-type business-type-deduced">${esc(labels.opening)}</span>
                    <h2 class="business-intel-headline">${esc(editorialTitle)}</h2>
                    <p class="business-intel-subtitle">${esc(editorialSubtitle)}</p>
                    ${geoNote ? `<p class="business-intel-geo-note">${esc(geoNote)}</p>` : ''}
                    ${metricCards.length ? `<div class="business-intel-metrics">${metricCards.map((item) => `<article><strong>${esc(String(item.value))}</strong><span>${esc(item.label)}</span></article>`).join('')}</div>` : ''}
                </article>
                ${pulseCards.length ? `<aside class="business-intel-pulse-grid">${pulseCards.map((item, index) => `<article class="business-pulse-card" style="--pulse-rgb:${['34,211,238','59,130,246','168,85,247','34,197,94'][index % 4]};"><span>${esc(item.title)}</span><strong>${esc(normalizeText(item.value))}</strong>${item.note ? `<p>${esc(normalizeText(item.note))}</p>` : ''}</article>`).join('')}</aside>` : ''}
            </div>
            ${positioningText ? `<article class="business-intel-positioning-card"><strong>${esc(labels.positioning)}</strong><p>${esc(positioningText)}</p></article>` : ''}
        </div>
        ${(isUseful(verdict.currentLeader) || cleanItems(verdict.whyTheyWin).length || isUseful(verdict.marketPattern) || isUseful(verdict.confidenceExplanation) || evidence(verdict.evidenceLinks)) || (isUseful(attack.positioningStatement) || isUseful(attack.promiseToMake) || cleanItems(attack.proofsToAdd).length) ? `<div class="business-verdict-grid">` : ''}
            ${(isUseful(verdict.currentLeader) || cleanItems(verdict.whyTheyWin).length || isUseful(verdict.marketPattern) || isUseful(verdict.confidenceExplanation) || evidence(verdict.evidenceLinks)) ? `<article class="business-verdict-card"><span class="business-type business-type-deduced">${esc(labels.observed)}</span><h2>${esc(labels.verdict)}</h2>${isUseful(verdict.currentLeader) ? `<strong class="business-leader">${esc(normalizeText(verdict.currentLeader))}</strong>` : ''}${list(verdict.whyTheyWin, 'observed', 3)}${paragraph(verdict.marketPattern)}${paragraph(verdict.confidenceExplanation, 'business-profile-confidence')}${evidence(verdict.evidenceLinks, 4)}</article>` : ''}
            ${(isUseful(attack.positioningStatement) || isUseful(attack.promiseToMake) || cleanItems(attack.proofsToAdd).length) ? `<article class="business-attack-card"><span class="business-type business-type-recommended">${esc(labels.recommended)}</span><h2>${esc(labels.attack)}</h2>${isUseful(attack.positioningStatement) ? `<strong>${esc(normalizeText(attack.positioningStatement))}</strong>` : ''}${isUseful(attack.promiseToMake) && normalizeText(attack.promiseToMake) !== normalizeText(attack.positioningStatement) ? `<p>${esc(normalizeText(attack.promiseToMake))}</p>` : ''}${list(attack.proofsToAdd, 'recommended', 3)}</article>` : ''}
        ${(isUseful(verdict.currentLeader) || cleanItems(verdict.whyTheyWin).length || isUseful(verdict.marketPattern) || isUseful(verdict.confidenceExplanation) || evidence(verdict.evidenceLinks)) || (isUseful(attack.positioningStatement) || isUseful(attack.promiseToMake) || cleanItems(attack.proofsToAdd).length) ? `</div>` : ''}
        ${studySections ? `<article class="business-study-card"><header><span class="business-type business-type-deduced">${esc(labels.observed)}</span><h3>${esc(labels.study)}</h3></header><div class="business-study-grid">${studySections}</div>${evidence(study.evidenceLinks, 4)}</article>` : ''}
        ${(nowActions.length || weekActions.length || monthActions.length) ? `<div class="business-plan"><h3><i class="fas fa-list-check"></i>${esc(labels.actions)}</h3>${nowActions.length ? `<div class="business-plan-column"><h4>${esc(labels.whatNow)}</h4><div class="business-actions-grid">${nowActions.map(actionCard).join('')}</div></div>` : ''}${weekActions.length ? `<div class="business-plan-column"><h4>${esc(labels.week)}</h4><div class="business-actions-grid">${weekActions.map(actionCard).join('')}</div></div>` : ''}${monthActions.length ? `<div class="business-plan-column"><h4>${esc(labels.month)}</h4><div class="business-actions-grid">${monthActions.map(actionCard).join('')}</div></div>` : ''}</div>` : ''}
        ${profileCards ? `<div class="business-profiles"><h3><i class="fas fa-building"></i>${esc(labels.profiles)}</h3><div class="business-profiles-grid">${profileCards}</div></div>` : ''}
        ${sourceSectionHtml ? `<div class="business-watch"><div class="business-source-groups">${sourceSectionHtml}</div></div>` : ''}
        ${answerRows ? `<details class="business-watch business-final-answers" open><summary><i class="fas fa-circle-check"></i>${esc(labels.answers)}</summary><div class="business-answer-grid">${answerRows}</div></details>` : ''}
    </section>`;
}

async function displayCompetitorsResults(data) {

    // Competitor Refonte is the single source of truth for this report DOM.
    // Keep the legacy function callable for compatibility, but never let it
    // append the old layout after the refonte has loaded.
    if (window.__dakaCompetitorRefonteLoaded && typeof window.__dakaCompetitorRefonteRender === 'function') {
        return window.__dakaCompetitorRefonteRender(data);
    }

    const container = document.getElementById('resultsCompetitors');
    if (!container) return;

    if (!data || typeof data !== 'object') data = {};

    container.style.display = 'block';

    const resultLang = data.analysisLang || STATE.lastInputs?.compLang || STATE.currentLang || 'fr';
    const isAr = resultLang === 'ar';
    const isEn = resultLang === 'en';
    const isFr = resultLang === 'fr';

    container.dir = isAr ? 'rtl' : 'ltr';
    container.setAttribute('lang', resultLang);
    const verifiedSocialChannels = synchronizeLeaderSocialProof(data);
    const fieldIntelModel = buildFieldIntelModel(data?.apify || null, data?.leaderMoat || {});
const fieldGuideTopHtml = renderFieldGuideTop(fieldIntelModel, {
    isAr, isEn, dir: (isAr ? 'rtl' : 'ltr'), esc: escapeHtml
});
const fieldStudiesBottomHtml = renderFieldStudiesBottom(fieldIntelModel, {
    isAr, isEn, dir: (isAr ? 'rtl' : 'ltr'), esc: escapeHtml
});
const decisionProofHtml = renderDecisionProofPanel(data, {
    isAr,
    isEn,
    dir: (isAr ? 'rtl' : 'ltr'),
    esc: escapeHtml
});

    // ─── HELPERS ───────────────────────────────────────────────────
    const safe = (v, fallback = '—') => {
        if (v === null || v === undefined) return fallback;
        if (typeof v === 'boolean') return v ? '✓' : '✗';
        return String(v);
    };

    const safeText = (v, fallback = '—') => {
        const val = safe(v, fallback);
        return typeof val === 'string' ? val.trim() || fallback : val;
    };

    const bSide  = isAr ? 'right' : 'left';
    const tAlign = isAr ? 'right' : 'left';

    const renderList = (items, color) => {
        const arr = Array.isArray(items) ? items.filter(Boolean) : [];
        if (arr.length === 0)
            return `<li style="list-style:none;font-size:0.8rem;color:rgba(255,255,255,0.25);padding:2px 0;">—</li>`;
        return arr.map(item => `
            <li style="display:flex;align-items:flex-start;gap:8px;list-style:none;
                        margin-bottom:7px;font-size:0.82rem;color:#cbd5e1;line-height:1.5;">
                <i class="fas fa-check-circle" style="color:${color};font-size:0.65rem;margin-top:4px;flex-shrink:0;"></i>
                <span dir="auto">${safe(item)}</span>
            </li>`).join('');
    };

    const card = (content, opts = {}) => `
        <div class="result-card fade-in-up" style="
            margin-bottom:${opts.mb || 25}px;
            ${opts.borderColor ? `border-top:4px solid ${opts.borderColor};` : ''}
            ${opts.borderLeft  ? `border-left:4px solid ${opts.borderLeft};`  : ''}
            ${opts.boxShadow   ? `box-shadow:${opts.boxShadow};`               : ''}
            ${opts.bg          ? `background:${opts.bg};`                      : ''}
        ">${content}</div>`;

    const sectionTitle = (icon, text, color = 'var(--accent-secondary)') => `
        <h3 style="margin-bottom:20px;font-family:'Cairo',sans-serif;color:white;font-size:1.2rem;display:flex;align-items:center;gap:10px;">
            <i class="fas ${icon}" style="color:${color};font-size:1rem;"></i> ${text}
        </h3>`;

    // ─── LABELS I18N ───────────────────────────────────────────────
    const t = {
        // Titres de sections
        battlePlan:        isAr ? 'خطة المعركة الاستراتيجية'  : (isEn ? 'STRATEGIC BATTLE PLAN'       : 'PLAN DE BATAILLE STRATÉGIQUE'),
        roadmap:           isAr ? 'خارطة الهجوم'              : (isEn ? 'ATTACK ROADMAP'               : "ROADMAP D'ATTAQUE"),
        competitorsTitle:  isAr ? 'قائمة الأهداف (المنافسون)' : (isEn ? 'IDENTIFIED TARGETS'           : 'CIBLES IDENTIFIÉES'),
        marketDyn:         isAr ? 'ديناميكيات السوق'           : (isEn ? 'Market Dynamics (Porter)'     : 'Dynamiques de Marché (Porter)'),
        gscTitle:          isAr ? 'بيانات Google Search Console': (isEn ? 'Google Search Console Data'  : 'Données Google Search Console'),
        paaTitle:          isAr ? 'يسأل الناس أيضاً'           : (isEn ? 'People Also Ask'              : 'People Also Ask'),
        relatedTitle:      isAr ? 'بحث ذات صلة'               : (isEn ? 'Related Searches'             : 'Recherches Associées'),
        gslTitle:          isAr ? 'مخطط العرض الذي لا يُقاوم' : (isEn ? 'Grand Slam Offer Blueprint'   : 'Grand Slam Offer Blueprint'),
        revEngTitle:       isAr ? 'هندسة عكسية Top 3'          : (isEn ? 'Top 3 Reverse Engineering'    : 'Reverse Engineering Top 3'),
        masterTitle:       isAr ? 'تقنيات إتقان السوق'         : (isEn ? 'Mastering Techniques'         : 'Techniques de Maîtrise Marché'),
        moatTitle:         isAr ? 'تحليل الحصن الرقمي للقائد' : (isEn ? 'Leader Digital Moat Analysis' : 'Analyse Moat du Leader'),
        productKill:       isAr ? 'الضربة القاضية للمنتج'      : (isEn ? 'Product Kill Shot'            : 'Action produit decisive'),
        powerBalance:      isAr ? 'ميزان القوى'                : (isEn ? 'Power Balance'                : 'Balance des Forces'),
        swotTitle:         isAr ? 'تحليل SWOT'                 : (isEn ? 'SWOT Analysis'                : 'Analyse SWOT du Leader'),
        kwTitle:           isAr ? 'فجوة المحتوى الذكية'        : (isEn ? 'Content Gap Intelligence'     : 'Content Gap Intelligence'),
        duelTitle:         isAr ? '⚔️ المواجهة المباشرة'       : (isEn ? '⚔️ STRATEGIC DIRECT DUEL'    : '⚔️ DUEL STRATÉGIQUE INTÉGRAL'),
        // Labels champs
        difficulty:        isAr ? 'صعوبة السوق'    : (isEn ? 'Market Difficulty' : 'Difficulté Marché'),
        volume:            isAr ? 'حجم البحث'       : (isEn ? 'Search Volume'     : 'Volume Recherche'),
        coreKw:            isAr ? 'الكلمات الرئيسية': (isEn ? 'Core Keywords'     : 'Mots-clés clés'),
        serpIntent:        isAr ? 'نية العميل'       : (isEn ? 'Buyer intent'       : 'Intention client'),
        trend:             isAr ? 'الاتجاه'          : (isEn ? 'Trend'             : 'Tendance'),
        sophistication:    isAr ? 'مستوى التطور'    : (isEn ? 'Sophistication Lvl' : 'Niveau Sophistication'),
        awareness:         isAr ? 'مستوى الوعي'     : (isEn ? 'Awareness Level'   : "Niveau d'Awareness"),
        porterVerdict:     isAr ? 'حكم بورتر'       : (isEn ? 'Porter Verdict'    : 'Verdict Porter'),
        threatLevel:       isAr ? 'مستوى التهديد'   : (isEn ? 'Threat Level'      : 'Niveau de Menace'),
        barrier:           isAr ? 'حاجز الدخول'     : (isEn ? 'Barrier to Entry'  : "Barrière à l'Entrée"),
        weakest:           isAr ? 'نقطة الضعف القاتلة'     : (isEn ? "Competitor's Achilles Heel" : "Talon d'Achille Concurrent"),
        killShot:          isAr ? 'استراتيجية الهجوم'     : (isEn ? 'Counter-Action'             : 'Action de Contournement'),
        coreOffering:      isAr ? 'ماذا يبيع؟'             : (isEn ? 'What They Sell'            : "Ce Qu'il Vend"),
        pricing:           isAr ? 'استراتيجية التسعير'     : (isEn ? 'Pricing Strategy'          : 'Stratégie de Prix'),
        uvp:               isAr ? 'عرض القيمة الفريد'      : (isEn ? 'Unique Value Prop.'        : 'Proposition de Valeur Unique'),
        trafficSrc:        isAr ? 'مصادر الحركة'           : (isEn ? 'Traffic Sources'           : 'Sources de Trafic'),
        retention:         isAr ? 'حلقة الاحتفاظ'          : (isEn ? 'Retention Loop'            : 'Boucle de Rétention'),
        monetization:      isAr ? 'اختراق التحقيق من الدخل': (isEn ? 'Monetization Hack'        : 'Hack de Monétisation'),
        dreamOutcome:      isAr ? 'النتيجة المرغوبة'        : (isEn ? 'Dream Outcome'            : 'Résultat de Rêve'),
        likelihood:        isAr ? 'الاحتمال المُدرَك'       : (isEn ? 'Perceived Likelihood'     : 'Probabilité Perçue'),
        timeDelay:         isAr ? 'الإطار الزمني'           : (isEn ? 'Time to Result'           : 'Délai de Résultat'),
        effort:            isAr ? 'الجهد والتضحية'          : (isEn ? 'Effort & Sacrifice'       : 'Effort & Sacrifice'),
        irresistible:      isAr ? 'العرض الذي لا يُقاوم'   : (isEn ? 'The Irresistible Offer'   : "L'Offre Irrésistible"),
        successFactors:    isAr ? 'عوامل النجاح المشتركة'   : (isEn ? 'Common Success Factors'   : 'Facteurs de Succès Communs'),
        weaknesses:        isAr ? 'نقاط العمى'              : (isEn ? 'Glaring Weaknesses'       : 'Angles Morts Flagrants'),
        trafficGuess:      isAr ? 'استنتاج قناة الاكتساب'  : (isEn ? 'Traffic Strategy Guess'   : "Déduction Canal d'Acquisition"),
        copyAll:           isAr ? 'نسخ الكل'                : (isEn ? 'Copy all'                 : 'Copier tout'),
        dominance:         isAr ? 'الهيمنة'                 : (isEn ? 'DOMINANCE'                : 'DOMINANCE'),
        spyFunnel:         isAr ? 'فحص القمع'               : (isEn ? 'Website & Funnel Audit Funnel'               : 'Website & Funnel Audit Funnel'),
        spyTech:           isAr ? 'فحص تقني'                : (isEn ? 'Website & Funnel Audit Tech'                 : 'Website & Funnel Audit Tech'),
        stepLabel:         isAr ? 'الخطوة'                  : (isEn ? 'STEP'                     : 'ÉTAPE'),
        him:               isAr ? 'المنافس'                 : (isEn ? 'The Leader'               : 'Le Leader'),
        you:               isAr ? 'موقعك'                   : (isEn ? 'Your Site'                : 'Ton Site'),
        kill:              isAr ? 'تكتيك الضربة القاضية'   : (isEn ? 'THE KILL SHOT'             : 'LE KILL SHOT'),
        noKw:              isAr ? 'لا توجد كلمات مفتاحية'  : (isEn ? 'No keywords found'        : 'Aucun mot-clé trouvé'),
        filterAll:         isAr ? 'الكل'     : (isEn ? 'All'      : 'Tous'),
        filterPrimary:     isAr ? 'رئيسية'   : (isEn ? 'Primary'  : 'Primaires'),
        filterLongTail:    isAr ? 'ذيل طويل' : (isEn ? 'Long Tail': 'Long Tail'),
        filterGaps:        isAr ? 'فرص'      : (isEn ? 'Gaps'     : 'Opportunités'),
        noComp:            isAr ? 'لم يتم العثور على منافسين' : (isEn ? 'No competitors found' : 'Aucun concurrent trouvé'),
        targets:           isAr ? 'هدف' : (isEn ? 'targets' : 'cibles'),
        kwLabel:           isAr ? 'كلمة' : (isEn ? 'keywords' : 'mots-clés'),
        totalClicks:       isAr ? 'إجمالي النقرات'       : (isEn ? 'Total Clicks'      : 'Clics Totaux'),
        totalImpr:         isAr ? 'إجمالي الظهور'        : (isEn ? 'Total Impressions' : 'Impressions Totales'),
        avgPos:            isAr ? 'متوسط الترتيب'        : (isEn ? 'Avg. Position'     : 'Position Moy.'),
        query:             isAr ? 'الاستعلام'             : (isEn ? 'Query'             : 'Requête'),
        pos:               isAr ? 'الترتيب' : (isEn ? 'Pos.' : 'Pos.'),
        clicks:            isAr ? 'نقرات'   : (isEn ? 'Clicks' : 'Clics'),
        ctr:               'CTR',
    };
    Object.assign(t, {
        battlePlan: isAr ? 'الخلاصة العملية' : (isEn ? 'What matters now' : 'Ce qui compte maintenant'),
        roadmap: isAr ? 'خطوات التنفيذ' : (isEn ? 'Execution steps' : 'Actions a executer'),
        competitorsTitle: isAr ? 'المنافسون الذين يجب مراقبتهم' : (isEn ? 'Competitors to watch' : 'Concurrents a surveiller'),
        marketDyn: isAr ? 'ضغط السوق' : (isEn ? 'Market pressure' : 'Pression du marché'),
        gslTitle: isAr ? 'العرض الذي ينتظره السوق' : (isEn ? 'The offer people expect' : 'L’offre que le marché attend'),
        revEngTitle: isAr ? 'ما ينجح عند الافضل' : (isEn ? 'What works for the best' : 'Ce qui marche chez les meilleurs'),
        masterTitle: isAr ? 'كيف تربح السوق' : (isEn ? 'How to win the market' : 'Comment gagner le marché'),
        moatTitle: isAr ? 'لماذا القائد يربح' : (isEn ? 'Why the leader wins' : 'Pourquoi le leader gagne'),
        productKill: isAr ? 'اجعل عرضك اقوى' : (isEn ? 'Make your offer stronger' : 'Rendre votre offre plus forte'),
        powerBalance: isAr ? 'ميزان القوة' : (isEn ? 'Power balance' : 'Rapport de force'),
        swotTitle: isAr ? 'فرص وفجوات' : (isEn ? 'Opportunities and gaps' : 'Opportunites et failles'),
        kwTitle: isAr ? 'كلمات يستخدمها السوق' : (isEn ? 'Words your market uses' : 'Mots utilisés par le marché'),
        duelTitle: isAr ? 'مقارنة مباشرة' : (isEn ? 'Direct comparison' : 'Comparaison directe'),
        serpIntent: isAr ? 'نية العميل' : (isEn ? 'Buyer intent' : 'Intention client'),
        volume: isAr ? 'طلب السوق' : (isEn ? 'Market demand' : 'Demande marché'),
        coreKw: isAr ? 'لغة السوق' : (isEn ? 'Market language' : 'Langage marché'),
        spyFunnel: isAr ? 'افحص صفحة البيع' : (isEn ? 'Audit sales page' : 'Auditer la page'),
        spyTech: isAr ? 'افحص الموقع' : (isEn ? 'Check site foundations' : 'Verifier le site'),
        spyKeywords: isAr ? 'استخرج الكلمات' : (isEn ? 'Generate keywords' : 'Generer les mots-cles')
    });

    // ══════════════════════════════════════════════════════════════
    // §1 — MARKET INSIGHTS (étendu)
    // ══════════════════════════════════════════════════════════════
    let insightsHtml = '';
    if (data.marketInsights) {
        const mi    = data.marketInsights;
        const vocab = Array.isArray(mi.vocabulary) ? mi.vocabulary.slice(0, 4).join(', ') : '—';

        const threatColor = {
            Low: '#10b981', low: '#10b981',
            Medium: '#f59e0b', medium: '#f59e0b',
            High: '#ef4444', high: '#ef4444',
            Critical: '#dc2626', critical: '#dc2626'
        };

        insightsHtml = card(`
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:18px;margin-bottom:${mi.notes || mi.trend || mi.sophisticationLevel || mi.awarenessLevel ? '20px' : '0'}">
                <div>
                    <small style="color:var(--accent-danger);font-weight:800;letter-spacing:1px;text-transform:uppercase;">${t.difficulty}</small>
                    <div style="font-size:1.4rem;font-weight:900;color:white;margin-top:5px;">${safe(mi.difficulty, '—')}</div>
                </div>
                <div style="border-${bSide}:1px solid rgba(255,255,255,0.1);padding-${bSide}:18px;">
                    <small style="color:var(--accent-info);font-weight:800;letter-spacing:1px;text-transform:uppercase;">${t.volume}</small>
                    <div style="font-size:1rem;font-weight:900;color:white;margin-top:5px;">${safe(mi.volume, 'N/A')}</div>
                </div>
                <div style="border-${bSide}:1px solid rgba(255,255,255,0.1);padding-${bSide}:18px;">
                    <small style="color:var(--accent-warning);font-weight:800;letter-spacing:1px;text-transform:uppercase;">${t.coreKw}</small>
                    <div style="color:#b4b9d0;font-size:0.85rem;margin-top:5px;font-weight:600;" dir="auto">${vocab}</div>
                </div>
                ${mi.serpIntent ? `
                <div style="border-${bSide}:1px solid rgba(255,255,255,0.1);padding-${bSide}:18px;">
                    <small style="color:var(--accent-success);font-weight:800;letter-spacing:1px;text-transform:uppercase;">${t.serpIntent}</small>
                    <div style="color:#b4b9d0;font-size:0.85rem;margin-top:5px;font-weight:600;" dir="auto">${safe(mi.serpIntent)}</div>
                </div>` : ''}
                ${mi.sophisticationLevel ? `
                <div style="border-${bSide}:1px solid rgba(255,255,255,0.1);padding-${bSide}:18px;">
                    <small style="color:#a78bfa;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${t.sophistication}</small>
                    <div style="color:#c4b5fd;font-size:1.3rem;font-weight:900;margin-top:5px;">${safe(mi.sophisticationLevel)}/5</div>
                </div>` : ''}
                ${mi.awarenessLevel ? `
                <div style="border-${bSide}:1px solid rgba(255,255,255,0.1);padding-${bSide}:18px;">
                    <small style="color:#06b6d4;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${t.awareness}</small>
                    <div style="color:#67e8f9;font-size:0.8rem;font-weight:700;margin-top:5px;padding:4px 10px;background:rgba(6,182,212,0.1);border-radius:6px;display:inline-block;" dir="auto">${safe(mi.awarenessLevel)}</div>
                </div>` : ''}
                ${mi.trend ? `
                <div style="border-${bSide}:1px solid rgba(255,255,255,0.1);padding-${bSide}:18px;">
                    <small style="color:#34d399;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${t.trend}</small>
                    <div style="color:#6ee7b7;font-size:0.85rem;font-weight:700;margin-top:5px;font-family:monospace;" dir="auto">${safe(mi.trend)}</div>
                </div>` : ''}
            </div>
            ${mi.notes ? `
            <div style="margin-top:14px;padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:10px;border-${bSide}:3px solid rgba(255,255,255,0.12);">
                <small style="color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">
                    <i class="fas fa-robot" style="margin-${bSide === 'left' ? 'right' : 'left'}:5px;"></i>
                    ${isAr ? 'قراءة السوق' : (isEn ? 'Market reading' : 'Lecture du marché')}
                </small>
                <p style="font-size:0.88rem;color:#94a3b8;margin:0;line-height:1.7;" dir="auto">${safe(mi.notes)}</p>
            </div>` : ''}
            ${(Array.isArray(mi.peopleAlsoAsk) && mi.peopleAlsoAsk.length > 0) ? `
            <div style="margin-top:14px;">
                <small style="color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px;">
                    <i class="fas fa-question-circle" style="color:#f59e0b;margin-${bSide === 'left' ? 'right' : 'left'}:5px;"></i>${t.paaTitle}
                </small>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    ${mi.peopleAlsoAsk.slice(0, 4).map(p => `
                        <span style="font-size:0.78rem;padding:5px 12px;border-radius:8px;
                                     background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);
                                     color:#fcd34d;line-height:1.4;" dir="auto">
                            ${safe(p.question || p)}
                        </span>`).join('')}
                </div>
            </div>` : ''}
            ${(Array.isArray(mi.relatedSearches) && mi.relatedSearches.length > 0) ? `
            <div style="margin-top:12px;">
                <small style="color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px;">
                    <i class="fas fa-link" style="color:#3b82f6;margin-${bSide === 'left' ? 'right' : 'left'}:5px;"></i>${t.relatedTitle}
                </small>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                    ${mi.relatedSearches.slice(0, 4).map(r => `
                        <span style="font-size:0.76rem;padding:4px 10px;border-radius:6px;
                                     background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.18);
                                     color:#93c5fd;" dir="auto">
                            ${safe(r.query || r)}
                        </span>`).join('')}
                </div>
            </div>` : ''}
        `, { bg: 'rgba(255,255,255,0.02)', mb: 18 });
    }

    // ══════════════════════════════════════════════════════════════
    // §1b — MARKET DYNAMICS (Porter) — NOUVEAU
    // ══════════════════════════════════════════════════════════════
    let marketDynHtml = '';
    if (data.marketDynamics) {
        const md = data.marketDynamics;
        const lvlColor = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444', Critical: '#dc2626' };
        const tColor   = lvlColor[md.threatLevel] || '#94a3b8';
        marketDynHtml = card(`
            ${sectionTitle('fa-chess-king', t.marketDyn, '#f59e0b')}
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;">
                ${md.porterVerdict ? `
                <div style="padding:14px;background:rgba(245,158,11,0.05);border-radius:10px;border:1px solid rgba(245,158,11,0.12);">
                    <small style="color:#f59e0b;font-weight:800;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">
                        <i class="fas fa-balance-scale"></i> ${t.porterVerdict}
                    </small>
                    <p style="font-size:0.88rem;color:#fcd34d;font-weight:600;margin:0;line-height:1.6;" dir="auto">${safe(md.porterVerdict)}</p>
                </div>` : ''}
                ${md.threatLevel ? `
                <div style="padding:14px;background:rgba(239,68,68,0.04);border-radius:10px;border:1px solid ${tColor}30;">
                    <small style="color:${tColor};font-weight:800;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px;">
                        <i class="fas fa-fire"></i> ${t.threatLevel}
                    </small>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
                            <div style="height:100%;background:${tColor};width:${
                                md.threatLevel === 'Low' ? '25' :
                                md.threatLevel === 'Medium' ? '55' :
                                md.threatLevel === 'High' ? '80' : '100'}%;transition:width 1.2s ease;"></div>
                        </div>
                        <span style="color:${tColor};font-weight:900;font-size:0.85rem;">${safe(md.threatLevel)}</span>
                    </div>
                </div>` : ''}
                ${md.barrierToEntry ? `
                <div style="padding:14px;background:rgba(139,92,246,0.04);border-radius:10px;border:1px solid rgba(139,92,246,0.12);">
                    <small style="color:#a78bfa;font-weight:800;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">
                        <i class="fas fa-lock"></i> ${t.barrier}
                    </small>
                    <p style="font-size:0.85rem;color:#c4b5fd;margin:0;line-height:1.6;" dir="auto">${safe(md.barrierToEntry)}</p>
                </div>` : ''}
            </div>
        `, { borderColor: '#f59e0b', mb: 20 });
    }

    // ══════════════════════════════════════════════════════════════
    // §1c — GSC INSIGHTS — NOUVEAU
    // ══════════════════════════════════════════════════════════════
    let gscHtml = '';
    if (data.gscInsights?.available && data.gscInsights.topQueries?.length > 0) {
        const gsc = data.gscInsights;
        const sum = gsc.summary || {};
        gscHtml = card(`
            ${sectionTitle('fa-google', t.gscTitle, '#4ade80')}
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
                <div style="text-align:center;padding:12px;background:rgba(74,222,128,0.06);border-radius:10px;border:1px solid rgba(74,222,128,0.12);">
                    <div style="font-size:1.5rem;font-weight:900;color:#4ade80;">${(sum.totalClicks||0).toLocaleString()}</div>
                    <small style="color:#64748b;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;">${t.totalClicks}</small>
                </div>
                <div style="text-align:center;padding:12px;background:rgba(59,130,246,0.06);border-radius:10px;border:1px solid rgba(59,130,246,0.12);">
                    <div style="font-size:1.5rem;font-weight:900;color:#60a5fa;">${(sum.totalImpressions||0).toLocaleString()}</div>
                    <small style="color:#64748b;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;">${t.totalImpr}</small>
                </div>
                <div style="text-align:center;padding:12px;background:rgba(245,158,11,0.06);border-radius:10px;border:1px solid rgba(245,158,11,0.12);">
                    <div style="font-size:1.5rem;font-weight:900;color:#fcd34d;">${sum.avgPosition||'—'}</div>
                    <small style="color:#64748b;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;">${t.avgPos}</small>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                    <thead>
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                            <th style="text-align:${tAlign};padding:8px 10px;color:#64748b;font-weight:700;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;">${t.query}</th>
                            <th style="text-align:center;padding:8px 10px;color:#64748b;font-weight:700;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;">${t.pos}</th>
                            <th style="text-align:center;padding:8px 10px;color:#64748b;font-weight:700;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;">${t.clicks}</th>
                            <th style="text-align:center;padding:8px 10px;color:#64748b;font-weight:700;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;">${t.ctr}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gsc.topQueries.slice(0, 8).map((r, i) => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.04);${i % 2 === 0 ? 'background:rgba(255,255,255,0.01);' : ''}">
                            <td style="padding:8px 10px;color:#cbd5e1;font-weight:600;" dir="auto">${safe(r.query)}</td>
                            <td style="padding:8px 10px;text-align:center;color:${parseFloat(r.position) <= 3 ? '#4ade80' : parseFloat(r.position) <= 10 ? '#fcd34d' : '#94a3b8'};font-weight:800;">${safe(r.position)}</td>
                            <td style="padding:8px 10px;text-align:center;color:#93c5fd;font-weight:700;">${safe(r.clicks)}</td>
                            <td style="padding:8px 10px;text-align:center;color:#a78bfa;">${safe(r.ctr)}%</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `, { borderColor: '#4ade80', mb: 20 });
    }

    // ══════════════════════════════════════════════════════════════
    // §2 — WINNING MOVE & ROADMAP
    // ══════════════════════════════════════════════════════════════
    let winningMoveHtml = '';
    if (data.winningMove) {
        const roadmapArr = Array.isArray(data.actionRoadmap) ? data.actionRoadmap : [];
        winningMoveHtml = `
        <div class="magic-box fade-in-up" style="
            border-${bSide}:5px solid var(--accent-secondary);
            background:linear-gradient(135deg,rgba(139,92,246,0.18) 0%,rgba(30,36,66,0.9) 100%);
            margin-bottom:22px;padding:22px;border-radius:16px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <div style="background:var(--accent-secondary);width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-chess-knight" style="color:white;font-size:1.1rem;"></i>
                </div>
                <h3 style="margin:0;font-family:'Cairo';color:white;font-size:1.2rem;">${t.battlePlan}</h3>
            </div>
            <div style="font-size:1.2rem;color:#fcd34d;font-weight:800;line-height:1.6;text-align:${tAlign};" dir="auto">
                "<bdi>${safe(data.winningMove)}</bdi>"
            </div>
            ${roadmapArr.length > 0 ? `
            <div style="margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;" dir="${isAr?'rtl':'ltr'}">
                ${roadmapArr.map((step, i) => `
                <div style="background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);text-align:${tAlign};">
                    <small style="color:var(--accent-secondary);font-weight:900;display:block;margin-bottom:6px;">${t.stepLabel} ${i + 1}</small>
                    <div style="font-size:0.83rem;color:white;line-height:1.6;" dir="auto"><bdi>${safe(step)}</bdi></div>
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    }

    // ══════════════════════════════════════════════════════════════
    // §2b — GRAND SLAM OFFER BLUEPRINT — NOUVEAU
    // ══════════════════════════════════════════════════════════════
    let gslHtml = '';
    if (data.grandSlamOfferBlueprint) {
        const gsl = data.grandSlamOfferBlueprint;
        const gslItems = [
            { key: 'dreamOutcome',        label: t.dreamOutcome,  icon: 'fa-star',        color: '#fcd34d' },
            { key: 'perceivedLikelihood', label: t.likelihood,    icon: 'fa-shield-alt',  color: '#34d399' },
            { key: 'timeDelay',           label: t.timeDelay,     icon: 'fa-bolt',        color: '#60a5fa' },
            { key: 'effortAndSacrifice',  label: t.effort,        icon: 'fa-fire',        color: '#f87171' },
            { key: 'theIrresistibleOffer',label: t.irresistible,  icon: 'fa-gem',         color: '#c084fc' },
        ].filter(item => gsl[item.key] && gsl[item.key] !== '—');

        if (gslItems.length > 0) {
            gslHtml = card(`
                ${sectionTitle('fa-gem', t.gslTitle, '#c084fc')}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
                    ${gslItems.map(item => `
                    <div style="padding:14px;border-radius:12px;background:rgba(192,132,252,0.04);border:1px solid rgba(192,132,252,0.12);">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <div style="width:28px;height:28px;border-radius:7px;background:${item.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                <i class="fas ${item.icon}" style="color:${item.color};font-size:0.75rem;"></i>
                            </div>
                            <small style="color:${item.color};font-weight:800;font-size:0.67rem;text-transform:uppercase;letter-spacing:1px;">${item.label}</small>
                        </div>
                        <p style="font-size:0.86rem;color:white;font-weight:600;margin:0;line-height:1.6;" dir="auto">${safe(gsl[item.key])}</p>
                    </div>`).join('')}
                </div>
            `, { borderColor: '#c084fc', mb: 20 });
        }
    }

    // ══════════════════════════════════════════════════════════════
    // §3 — PRODUCT AUDIT (étendu)
    // ══════════════════════════════════════════════════════════════
    let productAuditHtml = '';
    let productOpportunitySummary = '';
    if (data.productServiceAudit) {
        const prod = data.productServiceAudit;
        const weakness = prod.weakestProductFeature || '—';
        const counterMove = prod.killShotFeature || '—';
        const coreOffering = prod.coreOffering || '—';
        const pricing = prod.pricingStrategy || '—';
        const uvp = prod.uniqueValueProposition || '—';

        const productOpportunityTitle = isAr
            ? 'أفضل فرصة لديك لتجاوز هذا المنافس'
            : isEn
                ? 'Your strongest opening to pass this competitor'
                : 'Votre meilleure ouverture pour dépasser ce concurrent';

        const productOpportunityLead = isAr
            ? `نقطة ضعفه حول "${weakness}" تخلق فرصة لوضع عرضك كحل أبسط، أوضح، وأسهل في التبني.`
            : isEn
                ? `Their weakness around "${weakness}" creates an opening to position your offer as simpler, more connected, and easier to adopt.`
                : `Sa faiblesse autour de "${weakness}" crée une opportunité pour positionner votre offre comme plus connectée, plus flexible et plus simple à adopter.`;

        productOpportunitySummary = isAr
            ? `هذا المنافس يبيع ${coreOffering}. تعتمد قيمته على ${uvp}، لكن حدّه الرئيسي هو ${weakness}. زاوية الهجوم الأقوى هي ${counterMove}.`
            : isEn
                ? `This competitor sells ${coreOffering}. Their value relies on ${uvp}, but their main limit is ${weakness}. Your strongest attack angle is ${counterMove}.`
                : `Ce concurrent vend ${coreOffering}. Sa valeur repose sur ${uvp}, mais sa limite principale concerne ${weakness}. Votre angle d’attaque doit être ${counterMove}.`;

        const detailRows = [
            [t.weakest, weakness],
            [t.killShot, counterMove],
            [t.coreOffering, coreOffering],
            [t.pricing, pricing],
            [t.uvp, uvp]
        ].filter(row => row[1] && row[1] !== '—');

        productAuditHtml = card(`
            ${sectionTitle('fa-crosshairs', productOpportunityTitle, 'var(--accent-success)')}
            <p style="margin:0 0 14px;color:#bbf7d0;font-size:0.95rem;line-height:1.7;font-weight:700;" dir="auto">
                ${safe(productOpportunityLead)}
            </p>
            <div style="padding:16px;border-radius:14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);margin-bottom:14px;">
                <strong style="display:block;color:#34d399;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
                    ${isAr ? 'الخلاصة العملية' : isEn ? 'Visible summary' : 'Résumé visible'}
                </strong>
                <p style="margin:0;color:#e2e8f0;font-size:0.93rem;line-height:1.75;font-weight:650;" dir="auto">
                    ${safe(productOpportunitySummary)}
                </p>
            </div>
            <details class="micro-details">
                <summary>${isAr ? 'عرض التفاصيل' : isEn ? 'View details' : 'Voir les détails'}</summary>
                <ul style="list-style:none;margin:12px 0 0;padding:0;display:grid;gap:9px;">
                    ${detailRows.map(([label, value]) => `
                        <li style="padding:11px 12px;border-radius:10px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);">
                            <strong style="color:#a7f3d0;font-size:0.74rem;text-transform:uppercase;letter-spacing:.04em;">${safe(label)}</strong>
                            <div style="margin-top:5px;color:#dbeafe;font-size:0.86rem;line-height:1.6;" dir="auto">${safe(value)}</div>
                        </li>
                    `).join('')}
                </ul>
            </details>
        `, { bg: 'rgba(239,68,68,0.02)', borderColor: 'var(--accent-danger)', mb: 20 });
    }

    // ══════════════════════════════════════════════════════════════
    // §3b — TOP 3 REVERSE ENGINEERING — NOUVEAU
    // ══════════════════════════════════════════════════════════════
    let revEngHtml = '';
    if (data.top3ReverseEngineering) {
        const rev = data.top3ReverseEngineering;
        const hasData = (Array.isArray(rev.commonSuccessFactors) && rev.commonSuccessFactors.length) ||
                        (Array.isArray(rev.glaringWeaknesses)    && rev.glaringWeaknesses.length)    ||
                        rev.trafficStrategyGuess;

        if (hasData) {
            revEngHtml = card(`
                ${sectionTitle('fa-microscope', t.revEngTitle, '#34d399')}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
                    ${Array.isArray(rev.commonSuccessFactors) && rev.commonSuccessFactors.length ? `
                    <div style="padding:14px;border-radius:12px;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.12);">
                        <strong style="color:#10b981;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:10px;">
                            <i class="fas fa-trophy"></i> ${t.successFactors}
                        </strong>
                        <ul style="margin:0;padding:0;">${renderList(rev.commonSuccessFactors, '#10b981')}</ul>
                    </div>` : ''}
                    ${Array.isArray(rev.glaringWeaknesses) && rev.glaringWeaknesses.length ? `
                    <div style="padding:14px;border-radius:12px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.12);">
                        <strong style="color:#ef4444;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:10px;">
                            <i class="fas fa-crosshairs"></i> ${t.weaknesses}
                        </strong>
                        <ul style="margin:0;padding:0;">${renderList(rev.glaringWeaknesses, '#ef4444')}</ul>
                    </div>` : ''}
                    ${rev.trafficStrategyGuess ? `
                    <div style="padding:14px;border-radius:12px;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.12);">
                        <strong style="color:#3b82f6;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px;">
                            <i class="fas fa-chart-line"></i> ${t.trafficGuess}
                        </strong>
                        <p style="font-size:0.86rem;color:#93c5fd;font-weight:600;margin:0;line-height:1.6;" dir="auto">${safe(rev.trafficStrategyGuess)}</p>
                    </div>` : ''}
                </div>
            `, { borderColor: '#34d399', mb: 20 });
        }
    }

    // ══════════════════════════════════════════════════════════════
    // §3c — MASTERING TECHNIQUES — NOUVEAU
    // ══════════════════════════════════════════════════════════════
    let masteringHtml = '';
    if (data.masteringTechniques) {
        const mt = data.masteringTechniques;
        const hasData = (mt.trafficSources && mt.trafficSources !== '—') ||
                        (mt.retentionLoop   && mt.retentionLoop   !== '—') ||
                        (mt.monetizationHack && mt.monetizationHack !== '—');
        if (hasData) {
            masteringHtml = card(`
                ${sectionTitle('fa-rocket', t.masterTitle, '#f87171')}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
                    ${mt.trafficSources && mt.trafficSources !== '—' ? `
                    <div style="padding:14px;border-radius:12px;background:rgba(248,113,113,0.05);border:1px solid rgba(248,113,113,0.12);">
                        <small style="color:#f87171;font-weight:800;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">
                            <i class="fas fa-satellite-dish"></i> ${t.trafficSrc}
                        </small>
                        <p style="font-size:0.86rem;color:#fca5a5;font-weight:600;margin:0;line-height:1.6;" dir="auto">${safe(mt.trafficSources)}</p>
                    </div>` : ''}
                    ${mt.retentionLoop && mt.retentionLoop !== '—' ? `
                    <div style="padding:14px;border-radius:12px;background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.12);">
                        <small style="color:#22d3ee;font-weight:800;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">
                            <i class="fas fa-sync-alt"></i> ${t.retention}
                        </small>
                        <p style="font-size:0.86rem;color:#67e8f9;font-weight:600;margin:0;line-height:1.6;" dir="auto">${safe(mt.retentionLoop)}</p>
                    </div>` : ''}
                    ${mt.monetizationHack && mt.monetizationHack !== '—' ? `
                    <div style="padding:14px;border-radius:12px;background:rgba(250,204,21,0.05);border:1px solid rgba(250,204,21,0.12);">
                        <small style="color:#facc15;font-weight:800;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">
                            <i class="fas fa-coins"></i> ${t.monetization}
                        </small>
                        <p style="font-size:0.86rem;color:#fde68a;font-weight:600;margin:0;line-height:1.6;" dir="auto">${safe(mt.monetizationHack)}</p>
                    </div>` : ''}
                </div>
            `, { borderColor: '#f87171', mb: 20 });
        }
    }

    // ══════════════════════════════════════════════════════════════
    // §4 — DUEL STRATÉGIQUE (duelConfig étendu + fix valueLadder/uxTeardown)
    // ══════════════════════════════════════════════════════════════
    let duelHtml = '';
    if (data.duelComparison && typeof data.duelComparison === 'object') {
        const duel = data.duelComparison;
        const validDuelKeys = Object.keys(duel).filter(k =>
            duel[k] && typeof duel[k] === 'object' && duel[k].competitor
        );

        if (validDuelKeys.length > 0) {
            // FIX : ajout des 2 clés manquantes valueLadder + uxTeardown
            const duelConfig = {
                offerAndRisk:     { title: isAr ? 'العرض والمخاطرة'         : (isEn ? 'Offer & Risk (Allan Dib)'   : 'Offre & Risque (Allan Dib)'),   icon: 'fa-shield-alt',    color: '#f59e0b' },
                jtbdPsychology:   { title: isAr ? 'علم النفس (JTBD)'        : (isEn ? 'Psychology (JTBD)'          : 'Psychologie (JTBD)'),            icon: 'fa-brain',         color: '#8b5cf6' },
                kanoDelighter:    { title: isAr ? 'ميزة الإبهار (Kano)'     : (isEn ? 'Delighter (Kano)'           : 'Effet Wahou (Kano)'),            icon: 'fa-magic',         color: '#ec4899' },
                activationAARRR:  { title: isAr ? 'الاحتكاك (AARRR)'        : (isEn ? 'UX Friction (AARRR)'        : 'Friction UX (AARRR)'),           icon: 'fa-bolt',          color: '#06b6d4' },
                flankingStrategy: { title: isAr ? 'استراتيجية التطويق'      : (isEn ? 'Flanking Strategy'          : 'Attaque de Flanc'),              icon: 'fa-chess-knight',  color: '#10b981' },
                pricingBundling:  { title: isAr ? 'هندسة الأسعار'           : (isEn ? 'Pricing Architecture'       : 'Architecture Prix (Leurre)'),    icon: 'fa-tags',          color: '#3b82f6' },
                valueLadder:      { title: isAr ? 'سلم القيمة'              : (isEn ? 'Value Ladder (Upsell)'      : 'Value Ladder (Upsell)'),         icon: 'fa-layer-group',   color: '#a78bfa' },
                uxTeardown:       { title: isAr ? 'تفكيك تجربة المستخدم'   : (isEn ? 'UX Teardown'                : 'UX Teardown (Friction)'),        icon: 'fa-mobile-alt',    color: '#f472b6' },
            };

            const renderDuelCard = (key, dataObj) => {
                if (!dataObj || !dataObj.competitor) return '';
                const conf = duelConfig[key] || { title: key, icon: 'fa-crosshairs', color: '#a78bfa' };
                return `
                <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);
                            border-radius:14px;padding:18px;transition:all 0.3s ease;"
                     onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='${conf.color}44';"
                     onmouseout="this.style.transform='translateY(0)';this.style.borderColor='rgba(255,255,255,0.05)';">
                    <h4 style="margin:0 0 12px;color:white;font-family:'Cairo',sans-serif;font-size:0.95rem;display:flex;align-items:center;gap:8px;">
                        <div style="background:${conf.color}18;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:7px;flex-shrink:0;">
                            <i class="fas ${conf.icon}" style="color:${conf.color};font-size:0.75rem;"></i>
                        </div>
                        ${conf.title}
                    </h4>
                    <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
                        <div style="flex:1;min-width:120px;background:rgba(239,68,68,0.05);border-${bSide}:3px solid #ef4444;padding:9px;border-radius:8px;text-align:${tAlign};">
                            <small style="color:#ef4444;font-weight:900;font-size:0.62rem;text-transform:uppercase;display:block;margin-bottom:3px;">${t.him}</small>
                            <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.5;" dir="auto"><bdi>${safe(dataObj.competitor)}</bdi></div>
                        </div>
                        <div style="flex:1;min-width:120px;background:rgba(59,130,246,0.05);border-${bSide}:3px solid #3b82f6;padding:9px;border-radius:8px;text-align:${tAlign};">
                            <small style="color:#3b82f6;font-weight:900;font-size:0.62rem;text-transform:uppercase;display:block;margin-bottom:3px;">${t.you}</small>
                            <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.5;" dir="auto"><bdi>${safe(dataObj.user)}</bdi></div>
                        </div>
                    </div>
                    ${dataObj.killShot ? `
                    <div style="background:linear-gradient(90deg,rgba(16,185,129,0.12),rgba(16,185,129,0.03));border:1px solid rgba(16,185,129,0.25);padding:10px;border-radius:9px;text-align:${tAlign};">
                        <strong style="color:#34d399;font-size:0.68rem;text-transform:uppercase;display:flex;align-items:center;gap:6px;margin-bottom:5px;">
                            <i class="fas fa-crosshairs"></i> ${t.kill}
                        </strong>
                        <div style="font-size:0.88rem;font-weight:800;color:white;line-height:1.5;font-family:'Almarai',sans-serif;" dir="auto">
                            "<bdi>${safe(dataObj.killShot)}</bdi>"
                        </div>
                    </div>` : ''}
                </div>`;
            };

            duelHtml = card(`
                ${sectionTitle('fa-chess-board', t.duelTitle, 'var(--accent-secondary)')}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;">
                    ${validDuelKeys.map(key => renderDuelCard(key, duel[key])).join('')}
                </div>
            `, { borderColor: 'var(--accent-secondary)', boxShadow: '0 10px 30px -5px rgba(139,92,246,0.15)', mb: 25 });
        }
    }

    // ══════════════════════════════════════════════════════════════
    // §5 — WAR ROOM : Radar + SWOT + Blue Ocean COMPLET
    // ══════════════════════════════════════════════════════════════
    let warRoomHtml = '';
    if (data.swot || data.comparisonScores || data.blueOceanStrategy) {
        const swot         = data.swot || {};
        const strengths    = Array.isArray(swot.strengths)     ? swot.strengths     : [];
        const weaknesses   = Array.isArray(swot.weaknesses)    ? swot.weaknesses    : [];
        const opportunities= Array.isArray(swot.opportunities) ? swot.opportunities : [];
        const threats      = Array.isArray(swot.threats)       ? swot.threats       : [];

        const bo = data.blueOceanStrategy || {};
        const boFields = [
            { key: 'eliminate',      label: isAr ? 'حذف'        : (isEn ? 'Eliminate'    : 'Éliminer'),   color: '#ef4444' },
            { key: 'reduce',         label: isAr ? 'تقليص'      : (isEn ? 'Reduce'       : 'Réduire'),    color: '#f59e0b' },
            { key: 'raise',          label: isAr ? 'رفع'        : (isEn ? 'Raise'        : 'Augmenter'),  color: '#3b82f6' },
            { key: 'create',         label: isAr ? 'ابتكار'     : (isEn ? 'Create'       : 'Créer'),      color: '#10b981' },
            { key: 'currentRedOcean',label: isAr ? 'المحيط الأحمر': (isEn ? 'Red Ocean'  : 'Océan Rouge'),color: '#dc2626' },
            { key: 'blueOceanMoves', label: isAr ? 'حركة المحيط الأزرق': (isEn ? 'Blue Ocean Move': 'Mouvement Blue Ocean'), color: '#60a5fa' },
            { key: 'positioningMap', label: isAr ? 'خريطة التموضع': (isEn ? 'Positioning'  : 'Positionnement'), color: '#a78bfa' },
        ].filter(f => {
            const v = bo[f.key];
            return Array.isArray(v) ? v.length > 0 : (v && v !== '—');
        });

        const boHasData = boFields.length > 0;

        warRoomHtml = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-bottom:25px;" class="fade-in-up">

            ${data.comparisonScores ? `
            <div class="result-card" style="display:flex;flex-direction:column;min-height:360px;">
                <h4 style="text-align:center;margin-bottom:12px;font-family:'Cairo';color:white;">
                    <i class="fas fa-chart-area" style="color:var(--accent-primary);"></i> ${t.powerBalance}
                </h4>
                <div style="flex-grow:1;position:relative;min-height:270px;">
                    <canvas id="competitorRadarChart"></canvas>
                </div>
            </div>` : ''}

            <div class="result-card">
                <h4 style="margin-bottom:16px;font-family:'Cairo';color:white;">
                    <i class="fas fa-shield-virus" style="color:var(--accent-warning);"></i> ${t.swotTitle}
                </h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div style="background:rgba(16,185,129,0.05);padding:12px;border-radius:10px;border:1px solid rgba(16,185,129,0.12);">
                        <strong style="color:#10b981;font-size:0.68rem;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:8px;">💪 ${isAr ? 'نقاط القوة' : 'STRENGTHS'}</strong>
                        <ul style="margin:0;padding:0;">${renderList(strengths, '#10b981')}</ul>
                    </div>
                    <div style="background:rgba(239,68,68,0.05);padding:12px;border-radius:10px;border:1px solid rgba(239,68,68,0.12);">
                        <strong style="color:#ef4444;font-size:0.68rem;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:8px;">🔴 ${isAr ? 'نقاط الضعف' : 'WEAKNESSES'}</strong>
                        <ul style="margin:0;padding:0;">${renderList(weaknesses, '#ef4444')}</ul>
                    </div>
                    ${opportunities.length > 0 ? `
                    <div style="background:rgba(59,130,246,0.05);padding:12px;border-radius:10px;border:1px solid rgba(59,130,246,0.12);">
                        <strong style="color:#3b82f6;font-size:0.68rem;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:8px;">🚀 ${isAr ? 'الفرص' : 'OPPORTUNITIES'}</strong>
                        <ul style="margin:0;padding:0;">${renderList(opportunities, '#3b82f6')}</ul>
                    </div>` : ''}
                    ${threats.length > 0 ? `
                    <div style="background:rgba(245,158,11,0.05);padding:12px;border-radius:10px;border:1px solid rgba(245,158,11,0.12);">
                        <strong style="color:#f59e0b;font-size:0.68rem;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:8px;">⚠️ ${isAr ? 'التهديدات' : 'THREATS'}</strong>
                        <ul style="margin:0;padding:0;">${renderList(threats, '#f59e0b')}</ul>
                    </div>` : ''}
                </div>
            </div>
        </div>

        ${boHasData ? `
        <div class="result-card fade-in-up" style="margin-bottom:20px;border-top:3px solid #60a5fa;">
            <h4 style="margin-bottom:16px;font-family:'Cairo';color:white;">
                <i class="fas fa-water" style="color:#60a5fa;"></i>
                ${isAr ? 'استراتيجية المحيط الأزرق (ERRC)' : (isEn ? 'Blue Ocean Strategy (ERRC Grid)' : 'Stratégie Océan Bleu (Grille ERRC)')}
            </h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
                ${boFields.map(f => {
                    const val = bo[f.key];
                    const items = Array.isArray(val) ? val : [val];
                    return `
                    <div style="padding:12px;border-radius:10px;background:${f.color}0a;border:1px solid ${f.color}22;">
                        <strong style="color:${f.color};font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px;">
                            <i class="fas fa-circle" style="font-size:0.45rem;margin-${bSide === 'left' ? 'right' : 'left'}:5px;"></i>${f.label}
                        </strong>
                        <ul style="margin:0;padding:0;">${renderList(items, f.color)}</ul>
                    </div>`;
                }).join('')}
            </div>
        </div>` : ''}`;

        if (data.comparisonScores) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (typeof renderCompetitorRadar === 'function')
                    renderCompetitorRadar(data.comparisonScores);
            }));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // §5b — LEADER MOAT — NOUVEAU
    // ══════════════════════════════════════════════════════════════
    let moatHtml = '';
    if (data.leaderMoat && typeof data.leaderMoat === 'object' && data.leaderMoat.status !== 'error') {
        const m  = data.leaderMoat;
        const ba = m.brandAuthority  || {};
        const tm = m.technicalMoat   || {};
        const cs = m.contentStrategy || {};

        const hasAnything = ba.socialLinksCount !== undefined || tm.schemaTagsCount !== undefined || cs.hasBlog !== undefined;

        if (hasAnything) {
            const verifiedSocialHtml = verifiedSocialChannels.length
                ? verifiedSocialChannels.map(item => `
                    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"
                       data-no-collapse="true"
                       style="color:#93c5fd;text-decoration:none;font-weight:800;display:inline-flex;align-items:center;gap:4px;margin-inline-end:7px;">
                        <i class="fas fa-arrow-up-right-from-square" style="font-size:.58rem;"></i>${escapeHtml(item.platform)}
                    </a>`).join('')
                : `${ba.socialLinksCount || 0} ${isAr ? 'روابط' : (isEn ? 'links' : 'liens')}`;
            const moatItems = [
                { label: isAr ? 'روابط Wikipedia' : (isEn ? 'Wikipedia links' : 'Liens Wikipedia'), val: ba.hasWikipediaLinks,     icon: 'fa-wikipedia-w', color: '#94a3b8' },
                { label: isAr ? 'شبكات اجتماعية موثقة' : (isEn ? 'Verified social networks' : 'Réseaux sociaux vérifiés'), val: verifiedSocialHtml, icon: 'fa-share-alt', color: '#60a5fa' },
                { label: isAr ? 'Trustpilot/Avis'  : (isEn ? 'Reviews/Trustpilot' : 'Trustpilot/Avis'), val: ba.hasTrustpilotOrReviews, icon: 'fa-star',      color: '#fcd34d' },
                { label: isAr ? 'Schema Markup'    : (isEn ? 'Schema tags'      : 'Balises Schema'),   val: (tm.schemaTagsCount||0) + ' tags',  icon: 'fa-code',      color: '#a78bfa' },
                { label: isAr ? 'Section FAQ'      : (isEn ? 'FAQ section'      : 'Section FAQ'),      val: tm.hasFaqSection,      icon: 'fa-question-circle', color: '#34d399' },
                { label: isAr ? 'Blog/Actualités'  : (isEn ? 'Blog/News'        : 'Blog/Actualités'),  val: cs.hasBlog,            icon: 'fa-newspaper',   color: '#fb923c' },
            ].filter(i => i.val !== undefined && i.val !== null);

            const getValDisplay = (val) => {
                if (typeof val === 'boolean') return val
                    ? `<span style="color:#34d399;font-weight:800;">✓ ${isAr ? 'نعم' : 'Oui'}</span>`
                    : `<span style="color:#ef4444;font-weight:600;">✗ ${isAr ? 'لا' : 'Non'}</span>`;
                return `<span style="color:#cbd5e1;font-weight:700;">${val}</span>`;
            };

            moatHtml = card(`
                ${sectionTitle('fa-fort-awesome', t.moatTitle, '#fb923c')}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                    ${moatItems.map(item => `
                    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);">
                        <i class="fas ${item.icon}" style="color:${item.color};font-size:0.9rem;width:18px;text-align:center;flex-shrink:0;"></i>
                        <div>
                            <small style="color:#64748b;font-size:0.68rem;display:block;">${item.label}</small>
                            <div style="font-size:0.82rem;margin-top:2px;">${getValDisplay(item.val)}</div>
                        </div>
                    </div>`).join('')}
                </div>
                ${cs.semanticCloud ? `
                <div style="margin-top:12px;padding:12px;border-radius:9px;background:rgba(251,146,60,0.04);border:1px solid rgba(251,146,60,0.12);">
                    <small style="color:#fb923c;font-weight:700;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">
                        <i class="fas fa-cloud"></i> ${isAr ? 'السحابة الدلالية' : (isEn ? 'Semantic Cloud' : 'Nuage Sémantique')}
                    </small>
                    <p style="font-size:0.78rem;color:#94a3b8;margin:0;line-height:1.7;font-style:italic;" dir="auto">${safe(cs.semanticCloud)}</p>
                </div>` : ''}
            `, { borderColor: '#fb923c', mb: 20 });
        }
    }

    // ══════════════════════════════════════════════════════════════
    // §6 — KEYWORDS AVEC FILTRAGE
    // ══════════════════════════════════════════════════════════════
    let keywordsHtml = '';
    if (data.keywordStrategy) {
        const ks = data.keywordStrategy;
        const primaryKws  = Array.isArray(ks.primary)     ? ks.primary     : [];
        const longTailKws = Array.isArray(ks.longTail)    ? ks.longTail    : [];
        const gapKws      = Array.isArray(ks.missingGaps) ? ks.missingGaps : [];

        const allKws = [
            ...primaryKws.map(k  => ({ kw: k, type: 'primary'  })),
            ...longTailKws.map(k => ({ kw: k, type: 'longtail' })),
            ...gapKws.map(k      => ({ kw: k, type: 'gap'      }))
        ].filter(item => item.kw);

        const badgeStyle = {
            primary:  'background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);color:#93c5fd;',
            longtail: 'background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.25);color:#c4b5fd;',
            gap:      'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);color:#fcd34d;'
        };

        const renderKwBadges = (items, filterType = 'all') => {
            const filtered = filterType === 'all' ? items : items.filter(item => item.type === filterType);
            if (filtered.length === 0)
                return `<div style="opacity:0.4;font-size:0.85rem;padding:10px;">${t.noKw}</div>`;
            return filtered.map(item => `
                <span class="result-badge kw-badge" data-type="${item.type}"
                      style="${badgeStyle[item.type]||''} margin:3px;padding:5px 10px;border-radius:999px;
                             font-size:0.78rem;font-weight:700;display:inline-block;cursor:default;transition:transform 0.15s;"
                      onmouseover="this.style.transform='scale(1.05)'"
                      onmouseout="this.style.transform='scale(1)'">
                    ${safe(item.kw)}
                </span>`).join('');
        };

        const filterBtnStyle = (active) => `
            padding:5px 13px;border-radius:999px;font-size:0.74rem;font-weight:800;
            cursor:pointer;border:1px solid rgba(255,255,255,0.15);transition:all 0.2s;
            ${active
                ? 'background:var(--accent-primary);color:white;border-color:var(--accent-primary);'
                : 'background:transparent;color:#94a3b8;'}`;

        const kwContainerId = 'kw-badges-' + Date.now();

        keywordsHtml = card(`
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
                <h4 style="margin:0;font-family:'Cairo';">
                    <i class="fas fa-key" style="color:var(--accent-info);"></i>
                    ${t.kwTitle}
                    <span style="font-size:0.74rem;color:#64748b;font-weight:400;margin-${bSide}:8px;">(${allKws.length} ${t.kwLabel})</span>
                </h4>
                <button onclick="window.copyCompetitorKeywords(this)"
                        class="btn-copy-mini"
                        style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;
                               background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                               color:#94a3b8;cursor:pointer;font-size:0.78rem;transition:all 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    <i class="fas fa-copy"></i> ${t.copyAll}
                </button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;">
                <button style="${filterBtnStyle(true)}"  onclick="window._kwFilter('${kwContainerId}','all',this)">${t.filterAll} (${allKws.length})</button>
                <button style="${filterBtnStyle(false)}" onclick="window._kwFilter('${kwContainerId}','primary',this)">
                    <i class="fas fa-circle" style="color:#93c5fd;font-size:0.45rem;"></i> ${t.filterPrimary} (${primaryKws.length})
                </button>
                <button style="${filterBtnStyle(false)}" onclick="window._kwFilter('${kwContainerId}','longtail',this)">
                    <i class="fas fa-circle" style="color:#c4b5fd;font-size:0.45rem;"></i> ${t.filterLongTail} (${longTailKws.length})
                </button>
                <button style="${filterBtnStyle(false)}" onclick="window._kwFilter('${kwContainerId}','gap',this)">
                    <i class="fas fa-circle" style="color:#fcd34d;font-size:0.45rem;"></i> ${t.filterGaps} (${gapKws.length})
                </button>
            </div>
            <div id="${kwContainerId}" style="line-height:2.2;">${renderKwBadges(allKws, 'all')}</div>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);">
                <span style="font-size:0.7rem;color:#64748b;">
                    <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#3b82f6;margin-${bSide}:4px;"></span>
                    ${isAr ? 'رئيسية' : (isEn ? 'Primary (high volume)' : 'Primaires (fort volume)')}
                </span>
                <span style="font-size:0.7rem;color:#64748b;">
                    <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#8b5cf6;margin-${bSide}:4px;"></span>
                    ${isAr ? 'ذيل طويل' : (isEn ? 'Long tail (conversion)' : 'Long tail (conversion)')}
                </span>
                <span style="font-size:0.7rem;color:#64748b;">
                    <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#f59e0b;margin-${bSide}:4px;"></span>
                    ${isAr ? 'فرص غير مستغلة' : (isEn ? 'Untapped gaps' : 'Gaps non exploités')}
                </span>
            </div>
        `, { borderColor: 'var(--accent-info)', mb: 25 });
    }

    // ══════════════════════════════════════════════════════════════
    // §7 — LISTE CONCURRENTS
    // ══════════════════════════════════════════════════════════════
    const competitors = Array.isArray(data.competitors) ? data.competitors : [];
    const competitorsList = competitors.map((comp, idx) => {
        const dom      = Math.min(100, Math.max(0, parseInt(comp.dominance) || 0));
        const domColor = dom > 70 ? '#ef4444' : (dom > 40 ? '#f59e0b' : '#10b981');
        const safeUrl  = escapeHtml(comp.url || '');
        return `
        <div class="result-card fade-in-up" style="border-${bSide}:5px solid ${domColor};margin-bottom:16px;animation-delay:${idx * 0.07}s;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;">
                <div style="flex:1;min-width:200px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
                        <span style="background:#0f172a;color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:900;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;">
                            #${idx + 1}
                        </span>
                        <h4 style="margin:0;font-size:1rem;color:white;line-height:1.3;" dir="auto">
                            ${safe(comp.title, comp.domain || 'Site #' + (idx + 1))}
                        </h4>
                    </div>
                    <p style="color:var(--text-secondary);font-size:0.85rem;line-height:1.6;margin-bottom:10px;" dir="auto">
                        ${safe(comp.snippet, '—')}
                    </p>
                    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                        ${comp.url ? `
                        <a href="${comp.url}" target="_blank" rel="noopener"
                           style="color:var(--accent-primary);font-size:0.78rem;text-decoration:none;display:flex;align-items:center;gap:4px;"
                           onmouseover="this.style.textDecoration='underline'"
                           onmouseout="this.style.textDecoration='none'">
                            <i class="fas fa-external-link-alt" style="font-size:0.65rem;"></i>
                            ${safe(comp.domain, comp.url)}
                        </a>` : ''}
                        <div style="display:flex;align-items:center;gap:7px;">
                            <small style="font-weight:800;color:var(--text-muted);font-size:0.62rem;letter-spacing:1px;">${t.dominance}</small>
                            <div style="width:75px;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
                                <div style="width:${dom}%;height:100%;background:${domColor};transition:width 1s ease;"></div>
                            </div>
                            <small style="color:${domColor};font-weight:800;font-size:0.73rem;">${dom}%</small>
                        </div>
                        ${comp.type ? `
                        <span style="font-size:0.68rem;padding:2px 7px;border-radius:5px;background:rgba(255,255,255,0.05);color:#94a3b8;">
                            ${safe(comp.type)}
                        </span>` : ''}
                        ${comp.estimatedAuthority ? `
                        <span style="font-size:0.68rem;padding:2px 7px;border-radius:5px;background:rgba(139,92,246,0.08);color:#c4b5fd;border:1px solid rgba(139,92,246,0.15);">
                            ${safe(comp.estimatedAuthority)}
                        </span>` : ''}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:7px;" class="no-print competitor-action-stack">
                    <button type="button" data-competitor-action="funnel" data-url="${safeUrl}"
                            class="btn-gen btn-cosmic"
                            style="padding:6px 13px;font-size:0.7rem;border-radius:8px;white-space:nowrap;">
                        <i class="fas fa-filter"></i> ${t.spyFunnel}
                    </button>
                    <button type="button" data-competitor-action="tech" data-url="${safeUrl}"
                            class="btn-gen btn-cyber"
                            style="padding:6px 13px;font-size:0.7rem;border-radius:8px;white-space:nowrap;">
                        <i class="fas fa-microchip"></i> ${t.spyTech}
                    </button>
                    <button type="button"
                            data-competitor-action="keywords"
                            data-url="${safeUrl}"
                            data-domain="${escapeHtml(comp.domain || '')}"
                            data-title="${escapeHtml(comp.title || '')}"
                            class="btn-gen"
                            style="padding:6px 13px;font-size:0.7rem;border-radius:8px;white-space:nowrap;background:linear-gradient(135deg, rgba(6,182,212,0.22), rgba(139,92,246,0.24));border:1px solid rgba(34,211,238,0.28);color:#dffbff;">
                        <i class="fas fa-key"></i> ${t.spyKeywords}
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');

    // ══════════════════════════════════════════════════════════════
    // §8 — KNOWLEDGE GRAPH — NOUVEAU (si disponible)
    // ══════════════════════════════════════════════════════════════
    let kgHtml = '';
    if (data.knowledgeGraph && typeof data.knowledgeGraph === 'object') {
        const kg = data.knowledgeGraph;
        const kgTitle = kg.title || kg.name;
        if (kgTitle) {
            kgHtml = card(`
                <div style="display:flex;align-items:center;gap:12px;">
                    ${kg.thumbnail?.src ? `<img src="${kg.thumbnail.src}" alt="" style="width:60px;height:60px;border-radius:10px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                            <i class="fab fa-google" style="color:#4ade80;font-size:0.85rem;"></i>
                            <small style="color:#4ade80;font-weight:800;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;">Knowledge Graph</small>
                        </div>
                        <h4 style="margin:0;color:white;font-size:1rem;" dir="auto">${safe(kgTitle)}</h4>
                        ${kg.type || kg.description ? `<p style="font-size:0.82rem;color:#94a3b8;margin:4px 0 0;line-height:1.5;" dir="auto">${safe(kg.type || '')}${kg.type && kg.description ? ' · ' : ''}${safe(kg.description||'').substring(0, 120)}${(kg.description||'').length > 120 ? '…' : ''}</p>` : ''}
                    </div>
                </div>
            `, { bg: 'rgba(74,222,128,0.02)', mb: 20 });
        }
    }
// 8.5 DECISION LAYER — RENDER ONLY
let decisionLayerHtml = '';

const elite = data?.competitorIntelligence ? null : (data?.decisionLayer || null);

if (elite) {
  const proofItems = Array.isArray(elite.proofItems)
    ? elite.proofItems.filter(Boolean).slice(0, 3)
    : [];

  const actionItems = Array.isArray(elite.actionItems)
    ? elite.actionItems.filter(Boolean).slice(0, 3)
    : [];

  const eliteCard = ({ icon, label, main, sub = '', micro = '', color = '#8b5cf6', extra = '' }) => `
    <div style="
      position:relative;
      background:linear-gradient(180deg, rgba(15,23,42,.96) 0%, rgba(2,6,23,.95) 100%);
      border:1px solid rgba(255,255,255,.08);
      border-top:4px solid ${color};
      border-radius:18px;
      padding:18px;
      min-height:220px;
      box-shadow:0 14px 34px rgba(0,0,0,.22);
      overflow:hidden;
    ">
      <div style="
        position:absolute;top:-25px;${isAr ? 'left' : 'right'}:-25px;
        width:90px;height:90px;border-radius:50%;
        background:radial-gradient(circle, ${color}20 0%, transparent 70%);
        pointer-events:none;
      "></div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <div style="
          width:38px;height:38px;border-radius:12px;
          display:flex;align-items:center;justify-content:center;
          background:${color}1c;border:1px solid ${color}3d;flex-shrink:0;
        ">
          <i class="fas ${icon}" style="color:${color};font-size:.9rem;"></i>
        </div>
        <div style="font-size:.72rem;font-weight:900;letter-spacing:1px;color:#fff;text-transform:uppercase;">
          ${safe(label, '')}
        </div>
      </div>

      <div style="font-size:1rem;line-height:1.55;color:#fff;font-weight:800;margin-bottom:10px;" dir="auto">
        ${main}
      </div>

      ${sub ? `
        <div style="font-size:.84rem;line-height:1.65;color:#cbd5e1;margin-bottom:12px;" dir="auto">
          ${safe(sub, '')}
        </div>
      ` : ''}

      ${extra}

      ${micro ? `
        <div style="
          margin-top:14px;
          padding-top:12px;
          border-top:1px solid rgba(255,255,255,.06);
          font-size:.74rem;
          line-height:1.55;
          color:#94a3b8;
          font-style:italic;
        ">
          ${safe(micro, '')}
        </div>
      ` : ''}
    </div>
  `;

  const proofHtml = proofItems.length ? `
    <ul style="margin:0;padding-${bSide}:18px;color:#cbd5e1;line-height:1.7;">
      ${proofItems.map(item => `
        <li style="margin-bottom:8px;font-size:.82rem;" dir="auto">${safe(item, '')}</li>
      `).join('')}
    </ul>
  ` : '';

  const actionsHtml = `
    <div style="font-size:.92rem;color:#fff;font-weight:800;margin-bottom:12px;">
      ${safe(elite.actionsTitle, '')}
    </div>
    <ol style="margin:0;padding-${bSide}:18px;color:#e2e8f0;line-height:1.75;">
      ${actionItems.map(step => `
        <li style="margin-bottom:10px;font-size:.84rem;" dir="auto">${safe(step, '')}</li>
      `).join('')}
    </ol>
  `;

  decisionLayerHtml = `
    <div class="result-card fade-in-up" style="
      margin-bottom:24px;
      border:1px solid rgba(139,92,246,.18);
      background:linear-gradient(135deg, rgba(139,92,246,.07) 0%, rgba(6,182,212,.04) 100%);
      box-shadow:0 0 0 1px rgba(255,255,255,.03) inset;
      overflow:hidden;
    ">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:18px;">
        <div>
          <div style="
            font-size:.68rem;
            font-weight:900;
            letter-spacing:1.4px;
            color:#a78bfa;
            text-transform:uppercase;
            margin-bottom:8px;
          ">
            ${safe(elite.topLabel, '')}
          </div>

          <h3 style="
            margin:0 0 8px 0;
            font-family:Cairo,sans-serif;
            font-size:1.45rem;
            color:#fff;
            line-height:1.25;
          ">
            ${safe(elite.title, '')}
          </h3>

          <div style="
            max-width:760px;
            font-size:.92rem;
            line-height:1.65;
            color:#94a3b8;
          ">
            ${safe(elite.subtitle, '')}
          </div>
        </div>

        <div style="
          font-size:.72rem;
          font-weight:800;
          color:#c4b5fd;
          background:rgba(139,92,246,.12);
          border:1px solid rgba(139,92,246,.24);
          padding:6px 10px;
          border-radius:999px;
          white-space:nowrap;
        ">
          ${safe(elite.snapshot, '')}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
        ${eliteCard({
          icon: 'fa-chart-line',
          label: elite.verdictLabel,
          main: safe(elite.verdictMain, ''),
          sub: safe(elite.verdictSub, ''),
          micro: safe(elite.verdictMicro, ''),
          color: '#06b6d4'
        })}

        ${eliteCard({
          icon: 'fa-crown',
          label: elite.leaderLabel,
          main: safe(elite.leaderMain, ''),
          extra: proofHtml,
          micro: safe(elite.leaderMicro, ''),
          color: '#8b5cf6'
        })}

        ${eliteCard({
          icon: 'fa-crosshairs',
          label: elite.gapLabel,
          main: safe(elite.gapMain, ''),
          sub: safe(elite.gapSub, ''),
          micro: safe(elite.gapMicro, ''),
          color: '#ef4444'
        })}

        ${eliteCard({
          icon: 'fa-location-arrow',
          label: elite.moveLabel,
          main: safe(elite.moveMain, ''),
          sub: safe(elite.moveSub, ''),
          micro: safe(elite.moveMicro, ''),
          color: '#10b981'
        })}

        ${eliteCard({
          icon: 'fa-list-check',
          label: elite.actionsLabel,
          main: actionsHtml,
          micro: safe(elite.actionsMicro, ''),
          color: '#f59e0b'
        })}
      </div>

      <div style="
        margin-top:18px;
        padding-top:16px;
        border-top:1px solid rgba(255,255,255,.06);
        text-align:center;
      ">
        <div style="
          font-size:.74rem;
          color:#c4b5fd;
          font-weight:800;
          letter-spacing:1px;
          text-transform:uppercase;
          margin-bottom:6px;
        ">
          ${safe(elite.closingDivider, '')}
        </div>
        <div style="font-size:.84rem;color:#94a3b8;">
          ${safe(elite.closingText, '')}
        </div>
      </div>
    </div>
  `;
}

console.log('DECISION LAYER HTML LENGTH:', decisionLayerHtml?.length || 0);
console.log('DECISION LAYER PREVIEW:', decisionLayerHtml?.slice(0, 300));
const reportLabels = getReportLabels({ isAr, isEn });
    container.innerHTML = `
        ${renderExecutiveSummary(data, 'competitors', { isAr, isEn })}
        ${renderCompetitorDecisionLayerV2(data, { isAr, isEn })}
        ${renderReportSection('market', reportLabels.market, reportLabels.marketSub, 'fa-compass', `
            ${kgHtml}
            ${decisionProofHtml}
            ${decisionLayerHtml}
            ${fieldGuideTopHtml}
            ${insightsHtml}
            ${marketDynHtml}
            ${gscHtml}
        `, { isAr, isEn })}

        ${renderReportSection('plan', reportLabels.plan, reportLabels.planSub, 'fa-list-check', `
            ${winningMoveHtml}
            ${gslHtml}
            ${productAuditHtml}
            ${revEngHtml}
            ${masteringHtml}
            ${duelHtml}
            ${warRoomHtml}
            ${moatHtml}
            ${keywordsHtml}
        `, { isAr, isEn })}

        ${renderReportSection('competitors', reportLabels.competitors, `${competitors.length} ${t.targets} - ${reportLabels.competitorsSub}`, 'fa-crosshairs', `
            ${competitors.length ? competitorsList : `
    <div class="result-card fade-in-up" style="text-align:center;padding:26px;">
        <div style="font-size:0.95rem;color:#94a3b8;">${t.noComp}</div>
    </div>
`}
        `, { isAr, isEn })}

        ${renderExpertDock('competitors', { isAr, isEn })}
        ${renderReportSection('proof', reportLabels.proof, reportLabels.proofSub, 'fa-link', fieldStudiesBottomHtml, { isAr, isEn })}
    `;
    cleanRenderedOutput(container);
    container.classList.add('active');
    requestAnimationFrame(() => initCompetitorShowcaseMotion(container));

    // ── Radar chart (double rAF pour garantir le rendu DOM) ─────
    if (data.comparisonScores) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (typeof renderCompetitorRadar === 'function')
                renderCompetitorRadar(data.comparisonScores);
        }));
    }

    // ── Bouton export ────────────────────────────────────────────
    const exportBtn = document.getElementById('btn-export-competitors');
    if (exportBtn) exportBtn.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════════
// 🔍 FILTRE KEYWORDS
// ═══════════════════════════════════════════════════════════════════
window._kwFilter = function(containerId, filterType, btnEl) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const btnGroup = btnEl.closest('#kw-filter-btns') || btnEl.parentElement;
    if (btnGroup) {
        btnGroup.querySelectorAll('button').forEach(b => {
            b.style.background  = 'transparent';
            b.style.color       = '#94a3b8';
            b.style.borderColor = 'rgba(255,255,255,0.15)';
        });
    }
    btnEl.style.background  = 'var(--accent-primary)';
    btnEl.style.color       = 'white';
    btnEl.style.borderColor = 'var(--accent-primary)';

    const badges = container.querySelectorAll('.kw-badge');
    badges.forEach(badge => {
        badge.style.display = (filterType === 'all' || badge.dataset.type === filterType)
            ? 'inline-block'
            : 'none';
    });

    const visible = [...badges].filter(b => b.style.display !== 'none');
    let emptyMsg  = container.querySelector('.kw-empty-msg');
    if (visible.length === 0) {
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.className = 'kw-empty-msg';
            emptyMsg.style.cssText = 'opacity:0.4;font-size:0.85rem;padding:10px;';
            container.appendChild(emptyMsg);
        }
        emptyMsg.textContent = '—';
    } else {
        if (emptyMsg) emptyMsg.remove();
    }
};

// ═══════════════════════════════════════════════════════════════════
// 📋 COPY COMPETITOR KEYWORDS
// ═══════════════════════════════════════════════════════════════════
window.copyCompetitorKeywords = function(btnElement) {
    const allBadges = document.querySelectorAll('.kw-badge');
    const kws = [...allBadges]
        .filter(b => b.style.display !== 'none')
        .map(b => b.textContent.trim())
        .filter(Boolean);

    if (kws.length === 0) {
        if (typeof toast !== 'undefined') toast.error('Aucun mot-clé à copier.');
        return;
    }

    const text        = kws.join(', ');
    const isAr        = STATE && STATE.currentLang === 'ar';
    const originalHtml = btnElement ? btnElement.innerHTML : '';

    const onSuccess = () => {
        if (btnElement) {
            btnElement.innerHTML        = `<i class="fas fa-check"></i> ${isAr ? 'تم!' : 'Copié!'}`;
            btnElement.style.background = 'rgba(16,185,129,0.2)';
            btnElement.style.color      = '#34d399';
            setTimeout(() => {
                btnElement.innerHTML        = originalHtml;
                btnElement.style.background = '';
                btnElement.style.color      = '';
            }, 2000);
        }
        if (typeof toast !== 'undefined')
            toast.success(isAr
                ? `${kws.length} كلمة تم نسخها!`
                : `${kws.length} mots-clés copiés !`);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
    } else {
        fallbackCopy(text, onSuccess);
    }
};







function renderCompetitorRadar(scores) {
    const canvas = document.getElementById('competitorRadarChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');

    // 🛡️ Destruction propre de l'ancienne instance
    if (window.compRadarInstance instanceof Chart) {
        window.compRadarInstance.destroy();
    }

    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';

    // Labels dynamiques selon la langue
    const labels = scores.labels || (isAr
        ? ['السلطة', 'المحتوى', 'التقني', 'التحويل', 'تجربة المستخدم', 'الظهور']
        : ['Autorité', 'Contenu', 'Technique', 'Conversion', 'UX', 'Visibilité']);

    window.compRadarInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
          datasets: [
                {
                    label: isAr ? 'موقعك' : (isEn ? 'Your Site' : 'Votre Site'),
                    data: scores.user || [],
                    backgroundColor: 'rgba(59, 130, 246, 0.25)', // Bleu plus profond
                    borderColor: '#3b82f6',
                    pointBackgroundColor: '#0f172a', // Centre sombre (thème dark)
                    pointBorderColor: '#3b82f6',     // Bordure lumineuse
                    pointBorderWidth: 2,
                    pointRadius: 4,                  // Points plus visibles
                    pointHoverRadius: 6,             // Animation au survol
                    borderWidth: 2,
                    fill: true
                },
                {
                    label: isAr ? 'المنافس القائد' : (isEn ? 'Market Leader' : 'Leader Marché'),
                    data: scores.competitor || scores.leader || [],
                    backgroundColor: 'rgba(239, 68, 68, 0.15)', // Rouge un peu plus transparent pour laisser voir ton site
                    borderColor: '#ef4444',
                    pointBackgroundColor: '#0f172a',
                    pointBorderColor: '#ef4444',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: {
                        color: '#94a3b8',
                        font: { size: 11, family: 'Cairo, Inter', weight: 'bold' }
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false, stepSize: 20 }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#ffffff', font: { size: 12 }, padding: 15 }
                }
            }
        }
    });
}

/* ══════════════════════════════════════════════════════════════
   ANALYZE COMPETITORS — Fix loader + Export button
   ══════════════════════════════════════════════════════════════ */
async function analyzeCompetitors(e) {
    if (window.__dakaCompetitorRefonteLoaded && typeof window.__dakaCompetitorRefonteSubmit === 'function') {
        return window.__dakaCompetitorRefonteSubmit(e);
    }

    if (e) e.preventDefault();
    if (STATE.competitorAnalysisInFlight) return;

    const keyword = document.getElementById('keyword')?.value.trim();
    const url     = document.getElementById('url')?.value.trim();
    const country = document.getElementById('country')?.value || 'Morocco';
    const lang    = document.getElementById('analysisLang')?.value || 'fr';

    hydrateCompetitorCountrySelect(country, lang);
    STATE.lastInputs.country = country;
    STATE.currentLang = lang;
    const isAr = lang === 'ar';
    const isEn = lang === 'en';

    // ── Validation ────────────────────────────────────────────
    if (!keyword && !url) {
        return toast.warning(
            isAr ? 'يرجى ملء حقل واحد على الأقل.'
            : isEn ? 'Please fill in at least one field.'
            : 'Remplissez au moins un champ.'
        );
    }

    // ── RESET complet avant nouvelle analyse ──────────────────
    STATE.lastAnalysisResults = null;
    resetAnalysis('competitors');

    setButtonLoading('analyzeBtn', true);
    showLoading('loadingState');
    hideResults('resultsCompetitors');
    STATE.competitorAnalysisInFlight = true;

    // ── Cacher bouton export pendant l'analyse ────────────────
    const exportBtn = document.getElementById('btn-export-competitors-pdf')
                   || document.getElementById('btn-export-competitors');
    if (exportBtn) exportBtn.style.display = 'none';

    try {
        const response = await analyzeWithPolling('/api/competitors', {
            query: keyword || url,
            url: url || null,
            geo: country,
            lang,
            context: collectBusinessContext('comp'),
            forceRefresh: true
        });

        if (!response || !response.success) {
            throw new Error(response?.error || 'Analyse échouée — réponse invalide.');
        }

        // ── Patch 1 : binder la langue réelle du résultat ──────
        response.analysisLang = lang;

        // ── Patch 2 : enrichissement Decision Layer via API ────
        try {
            const dlResp = await api.post('/api/decision-layer', {
                lang,
                keyword: keyword || url || '',
                marketInsights: response.marketInsights || {},
                marketDynamics: response.marketDynamics || {},
                leaderMoat: response.leaderMoat || {},
                productServiceAudit: response.productServiceAudit || {},
                top3ReverseEngineering: response.top3ReverseEngineering || {},
                swot: response.swot || {},
                strategicBlueprint: response.strategicBlueprint || {},
                winningMove: response.winningMove || '',
                actionRoadmap: Array.isArray(response.actionRoadmap) ? response.actionRoadmap : []
            }, 8000);

            if (dlResp?.success && dlResp.decisionLayer) {
                response.decisionLayer = dlResp.decisionLayer;
            }
        } catch (decisionErr) {
            console.warn('[decision-layer] fallback local render:', decisionErr);
        }

        // ── Persistance STATE complète ────────────────────────
        STATE.lastAnalysisResults   = response;
        STATE.lastInputs            = STATE.lastInputs || {};
        STATE.lastInputs.keyword    = keyword;
        STATE.lastInputs.url        = url;
        STATE.lastInputs.country    = country;
        STATE.lastInputs.compLang   = lang;

        // ── Affichage résultats ───────────────────────────────
        displayCompetitorsResults(response);

        // ── Afficher bouton export après succès ───────────────
        if (exportBtn) exportBtn.style.display = 'inline-flex';

        // ── Toast succès ──────────────────────────────────────
        const total = response.totalFound || response.competitors?.length || 0;
        toast.success(
            isAr ? `✅ تم تحليل ${total} منافس بنجاح!`
            : isEn ? `✅ ${total} competitors analyzed successfully!`
            : `✅ ${total} concurrents analysés avec succès !`
        );

    } catch (error) {
        if (error?.name === 'AbortError' || window.dakaAnalysisCancelled) return;
        console.error('[analyzeCompetitors]', error);

        toast.error(
            isAr ? 'خطأ في التحليل: ' + (error.message || 'خطأ غير معروف')
            : isEn ? 'Analysis error: ' + (error.message || 'Unknown error')
            : 'Erreur analyse : ' + (error.message || 'Erreur inconnue')
        );

        if (exportBtn) exportBtn.style.display = 'none';

    } finally {
        STATE.competitorAnalysisInFlight = false;
        setButtonLoading('analyzeBtn', false);
        hideLoading('loadingState');
    }
}
// =================================================================
// ☢️ MODULE TECHNIQUE : GESTIONNAIRE DE SCAN ET GÉNÉRATION
// =================================================================

// État local pour les générateurs
window.currentSeoContext = null;
window.currentSeoUrl = null;

// =================================================================
// ☢️ MODULE TECHNIQUE : GESTIONNAIRE DE SCAN ET GÉNÉRATION (DEEP)
// =================================================================

// Etat local persistant
window.currentSeoContext = null;
window.currentSeoUrl = null;

function collectBusinessContext(prefix = 'comp') {
    const read = (suffix) => document.getElementById(`${prefix}${suffix}`)?.value?.trim() || '';
    return {
        offer: read('Offer'),
        audience: read('Audience'),
        objective: read('Objective'),
        priceRange: read('PriceRange'),
        knownCompetitors: read('KnownCompetitors').split(',').map(x => x.trim()).filter(Boolean).slice(0, 4),
        cityOrRegion: read('CityRegion')
    };
}


async function analyzeTechnical(e) {
  if (e) e.preventDefault();

  const urlInput  = document.getElementById('techUrl');
  const langInput = document.querySelector('input[name="techLang"]:checked');
  const url  = urlInput?.value.trim();
  const lang = langInput?.value || 'fr';

  if (!url)
    return toast.error(STATE.currentLang === 'ar'
      ? 'أدخل URL الهدف.'
      : 'URL cible manquante.');

  /* ── RESET avant nouvelle analyse ────────────────────────── */
  resetAnalysis('technical');

  setButtonLoading('technicalBtn', true);
  showLoading('loadingTechnical');
  hideResults('resultsTechnical');

  try {
    const response = await analyzeWithPolling('/api/technical-seo', {
      url,
      lang,
      context: collectBusinessContext('tech'),
      options: {
        checkMeta:        document.getElementById('checkMeta')?.checked        ?? true,
        checkPerformance: document.getElementById('checkPerformance')?.checked ?? true,
        checkLlms:        document.getElementById('checkLlms')?.checked        ?? false,
        checkRobots:      document.getElementById('checkRobots')?.checked      ?? false,
      }
    });

    if (response.success) {
      /* ── Persistance STATE ──────────────────────────────── */
      STATE.lastTechnicalResults = response;
      STATE.lastInputs.techUrl   = url;
      STATE.currentLang          = lang;
      window.currentSeoContext   = response;
      window.currentSeoUrl       = url;

      displayTechnicalResults(response);
      toast.success(lang === 'ar'
        ? '✅ اكتمل الفحص التقني!'
        : '✅ Audit SEO technique terminé !');
    } else {
      throw new Error(response.error || 'Échec audit technique');
    }
  } catch (err) {
    if (err?.name === 'AbortError' || window.dakaAnalysisCancelled) return;
    console.error('Technical SEO Error:', err);
    toast.error(err.message || 'Erreur de connexion au serveur.');
  } finally {
    setButtonLoading('technicalBtn', false);
    hideLoading('loadingTechnical');
  }
}



function normalizeText(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, '');
}

// ═══════════════════════════════════════════════════════════════════
// 🪄 AFFICHEUR DES ASSETS GÉNÉRÉS (100% MULTILINGUE)
// ═══════════════════════════════════════════════════════════════════
window.displayGeneratedAsset = function(data) {
    const outputArea = document.getElementById('tech-gen-output');
    if (!outputArea) return;

    outputArea.style.display = 'block';

    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';
    const ts   = Date.now();

    // 🌍 Dictionnaire de traduction des étiquettes générées
    const labels = {
        meta: isAr ? 'حزمة HTML الميتا (العلامات الوصفية)' : isEn ? 'META HTML PACK' : 'PACK MÉTA HTML',
        aeo:  isAr ? 'استراتيجية AEO (إجابات الذكاء الاصطناعي)'   : isEn ? 'AEO STRATEGY'   : 'STRATÉGIE AEO',
        geo:  isAr ? 'استراتيجية GEO (محركات البحث التوليدية)'   : isEn ? 'GEO STRATEGY'   : 'STRATÉGIE GEO',
        sys:  isAr ? 'ملفات النظام'      : isEn ? 'SYSTEM FILES'   : 'FICHIERS SYSTÈME',
        copy: isAr ? 'نسخ الكود'         : isEn ? 'COPY CODE'      : 'COPIER LE CODE',
        verdict: isAr ? 'رأي الخبير' : isEn ? 'EXPERT VERDICT' : 'VERDICT EXPERT',
        faqLabel: isAr ? '(الأسئلة الشائعة JSON-LD)' : '(FAQ JSON-LD)',
        sgeLabel: isAr ? '(محتوى SGE)' : '(SGE Content)'
    };

    let blockId = '';
    const container = document.createElement('div');
    container.className = 'result-card fade-in-up';
    container.style.marginBottom = '25px';
    container.style.padding = '25px';
    container.style.position = 'relative';
    container.dir = isAr ? 'rtl' : 'ltr';

    // ─── VERDICT EXPERT ───
    let verdictHtml = '';
    if (data.auditComment) {
        verdictHtml = `
            <div style="background: rgba(168, 85, 247, 0.08); border-${isAr?'right':'left'}: 4px solid #a855f7; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
                <strong style="color: #c4b5fd; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 5px;">
                    <i class="fas fa-brain"></i> ${labels.verdict}
                </strong>
                <p style="color: #e2e8f0; font-size: 0.9rem; margin: 0; line-height: 1.6; font-style: italic;" dir="auto">"${data.auditComment}"</p>
            </div>
        `;
    }

    // ─── CAS 1 : META HTML ───
    if (data.htmlHeader) {
        blockId = 'block-meta-pack';
        const uniqueId = `asset-meta-${ts}`;
        container.style.borderTop = '4px solid #10b981';
        container.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(10,14,39,0.9) 100%)';

        const cleanHtml = data.htmlHeader.replace(/<\/?head>/gi, '').trim();

        container.innerHTML = `
            ${verdictHtml}
            <h4 style="color:#10b981; margin-bottom:15px; font-family:'Cairo';"><i class="fas fa-code"></i> ${labels.meta}</h4>
            <div style="position: relative; background: #05071a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden;">
                <button onclick="copyToClipboard('${uniqueId}', this)" style="position: absolute; top: 12px; ${isAr?'left':'right'}: 12px; background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer; z-index: 10;">
                    <i class="fas fa-copy"></i> ${labels.copy}
                </button>
                <pre id="${uniqueId}" style="margin: 0; padding: 45px 20px 20px 20px; font-family: monospace; font-size: 0.85rem; color: #a5b4fc; max-height: 300px; overflow: auto; white-space: pre-wrap; direction: ltr; text-align: left;"></pre>
            </div>
        `;
        setTimeout(() => document.getElementById(uniqueId).textContent = cleanHtml, 0);
    }

    // ─── CAS 2 : AEO + GEO ───
    else if (data.aeoCode || data.geoCode) {
        blockId = 'block-aeo-geo';
        const aeoId = `asset-aeo-${ts}`;
        const geoId = `asset-geo-${ts}`;
        container.style.borderTop = '4px solid #06b6d4';
        container.style.background = 'linear-gradient(135deg, rgba(6,182,212,0.05) 0%, rgba(10,14,39,0.9) 100%)';

        container.innerHTML = `
            ${verdictHtml}
            <h4 style="color:#06b6d4; margin-bottom:20px; font-family:'Cairo';"><i class="fas fa-robot"></i> ${labels.aeo} & ${labels.geo}</h4>

            <div style="margin-bottom: 20px;">
                <strong style="color:#67e8f9; font-size:0.75rem; text-transform:uppercase; margin-bottom:8px; display:block;">${labels.aeo} <span style="opacity:0.7">${labels.faqLabel}</span></strong>
                <div style="position: relative; background: #05071a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden;">
                    <button onclick="copyToClipboard('${aeoId}', this)" style="position: absolute; top: 12px; ${isAr?'left':'right'}: 12px; background: #06b6d4; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer; z-index: 10;">
                        <i class="fas fa-copy"></i> ${labels.copy}
                    </button>
                    <pre id="${aeoId}" style="margin: 0; padding: 45px 20px 20px 20px; font-family: monospace; font-size: 0.85rem; color: #a5b4fc; max-height: 250px; overflow: auto; white-space: pre-wrap; direction: ltr; text-align: left;"></pre>
                </div>
            </div>

            <div>
                <strong style="color:#fcd34d; font-size:0.75rem; text-transform:uppercase; margin-bottom:8px; display:block;">${labels.geo} <span style="opacity:0.7">${labels.sgeLabel}</span></strong>
                <div style="position: relative; background: #05071a; border: 1px solid #78350f; border-radius: 12px; overflow: hidden;">
                    <button onclick="copyToClipboard('${geoId}', this)" style="position: absolute; top: 12px; ${isAr?'left':'right'}: 12px; background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer; z-index: 10;">
                        <i class="fas fa-copy"></i> ${labels.copy}
                    </button>
                    <pre id="${geoId}" style="margin: 0; padding: 45px 20px 20px 20px; font-family: monospace; font-size: 0.85rem; color: #fef3c7; max-height: 250px; overflow: auto; white-space: pre-wrap; direction: ltr; text-align: left;"></pre>
                </div>
            </div>
        `;
        setTimeout(() => {
            if (data.aeoCode) document.getElementById(aeoId).textContent = data.aeoCode;
            if (data.geoCode) document.getElementById(geoId).textContent = data.geoCode;
        }, 0);
    }

    // ─── CAS 3 : FICHIERS SYSTÈME ───
    else {
        const key   = Object.keys(data).find(k => k !== 'auditComment') || 'file';
        const val   = data[key];
        blockId     = `block-sys-${key}`;
        const sysId = `asset-sys-${ts}`;
        container.style.borderTop = '4px solid #ec4899';
        container.style.background = 'linear-gradient(135deg, rgba(236,72,153,0.05) 0%, rgba(10,14,39,0.9) 100%)';

        container.innerHTML = `
            ${verdictHtml}
            <h4 style="color:#ec4899; margin-bottom:15px; font-family:'Cairo'; text-transform:uppercase;"><i class="fas fa-file-code"></i> ${labels.sys} — ${key}</h4>
            <div style="position: relative; background: #05071a; border: 1px solid #500732; border-radius: 12px; overflow: hidden;">
                <button onclick="copyToClipboard('${sysId}', this)" style="position: absolute; top: 12px; ${isAr?'left':'right'}: 12px; background: #ec4899; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer; z-index: 10;">
                    <i class="fas fa-copy"></i> ${labels.copy}
                </button>
                <pre id="${sysId}" style="margin: 0; padding: 45px 20px 20px 20px; font-family: monospace; font-size: 0.85rem; color: #fbcfe8; max-height: 300px; overflow: auto; white-space: pre-wrap; direction: ltr; text-align: left;"></pre>
            </div>
        `;
        setTimeout(() => document.getElementById(sysId).textContent = val, 0);
    }

    // ─── REMPLACEMENT INTELLIGENT DU BLOC ───
    if (blockId) container.id = blockId;
    const existing = document.getElementById(blockId);

    if (existing) {
        outputArea.replaceChild(container, existing);
    } else {
        outputArea.appendChild(container);
    }

    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
};
// ═══════════════════════════════════════════════════════════════════
// 🚀 DÉCLENCHEUR DES GÉNÉRATEURS (TRADUIT)
// ═══════════════════════════════════════════════════════════════════
function buildDakaRecommendationReadiness(ctx = {}) {
    const extraction = ctx.extraction || {};
    const title = extraction.title || '';
    const description = extraction.description || extraction.metaDescription || '';
    const h1s = extraction.h1_all || extraction.h1all || (extraction.h1 ? [extraction.h1] : []);
    const entity = ctx.globalReport?.detectedEntity || ctx.detectedEntity || '';
    const hasSchema = !!(ctx.structuredData?.schemas?.length || ctx.schemaIntel?.types?.length || ctx.structuredData?.length);
    const hasLlms = !!(ctx.seoOpportunities?.llmsTxtAdvice && !/absent|missing|non/i.test(String(ctx.seoOpportunities.llmsTxtAdvice)));
    const hasRobots = !!(ctx.robotsTxtAdvice || ctx.robots?.status);
    const hasTrust = !!(ctx.trustIntel?.signals?.length || ctx.decisionLayer?.proofs?.length || ctx.extraction?.socialLinks?.length);
    const signals = [
        { key: 'identity', ready: !!(title && h1s.length), weight: 18 },
        { key: 'snippet', ready: !!(title && description), weight: 18 },
        { key: 'entity', ready: !!entity, weight: 12 },
        { key: 'schema', ready: hasSchema, weight: 18 },
        { key: 'machine', ready: hasLlms || hasRobots, weight: 16 },
        { key: 'proof', ready: hasTrust, weight: 18 }
    ];
    const score = Math.max(12, Math.min(100, signals.reduce((sum, item) => sum + (item.ready ? item.weight : 0), 0)));
    return { score, signals, title, description, entity, h1s };
}

function renderDakaReadinessSignal(signal, labels) {
    const state = signal.ready ? labels.ready : labels.todo;
    const cls = signal.ready ? 'is-ready' : 'is-todo';
    return `<span class="daka-readiness-chip ${cls}"><i class="fas ${signal.ready ? 'fa-check' : 'fa-circle-exclamation'}"></i>${escapeHtml(labels[signal.key] || signal.key)} · ${state}</span>`;
}

function renderRealResultsEngine(ctx = {}, opts = {}) {
    const isAr = !!opts.isAr;
    const isEn = !!opts.isEn;
    const dir = isAr ? 'rtl' : 'ltr';
    const readiness = buildDakaRecommendationReadiness(ctx);
    const labels = {
        title: isAr ? 'محرك Daka Real Results' : isEn ? 'Daka Real Results Engine' : 'Daka Real Results Engine',
        subtitle: isAr ? 'حوّل أدلة الصفحة إلى إشارات قابلة للفهم والاستشهاد والتثبيت.' : isEn ? 'Turn page evidence into installable, verifiable recommendation signals.' : 'Transformer les preuves de la page en signaux installables, vérifiables et recommandables.',
        score: isAr ? 'جاهزية توصية الذكاء الاصطناعي' : isEn ? 'AI recommendation readiness' : 'Recommandabilité IA',
        ready: isAr ? 'جاهز' : isEn ? 'ready' : 'prêt',
        todo: isAr ? 'ناقص' : isEn ? 'missing' : 'à renforcer',
        identity: isAr ? 'هوية الصفحة' : isEn ? 'Page identity' : 'Identité page',
        snippet: isAr ? 'مقتطف البحث' : isEn ? 'Search snippet' : 'Snippet recherche',
        entity: isAr ? 'كيان العلامة' : isEn ? 'Brand entity' : 'Entité marque',
        schema: isAr ? 'بيانات منظمة' : isEn ? 'Structured proof' : 'Preuves structurées',
        machine: isAr ? 'وصول الآلات' : isEn ? 'Machine access' : 'Accès machine',
        proof: isAr ? 'أدلة ثقة' : isEn ? 'Trust proofs' : 'Preuves de confiance',
        launch: isAr ? 'بناء الحزمة' : isEn ? 'Build pack' : 'Construire le pack',
        install: isAr ? 'مكان التثبيت' : isEn ? 'Install target' : 'Zone d’installation',
        verify: isAr ? 'التحقق' : isEn ? 'Validation' : 'Validation',
        evidence: isAr ? 'أدلة مستخدمة' : isEn ? 'Evidence used' : 'Preuves utilisées'
    };
    const cards = [
        {
            type: 'markdown',
            icon: 'fa-magnifying-glass-chart',
            title: isAr ? 'إشارة الظهور والهوية' : isEn ? 'Search Snippet & Brand Signal' : 'Search Snippet & Brand Signal',
            desc: isAr ? 'عنوان ووصف وروابط اجتماعية تجعل الصفحة مفهومة قبل الزيارة.' : isEn ? 'Title, meta and social previews that make the offer clear before the click.' : 'Title, meta et aperçus sociaux pour rendre l’offre claire avant le clic.',
            target: '<head>',
            validation: isAr ? 'معاينة المقتطف والبطاقات الاجتماعية' : isEn ? 'Snippet and social preview checks' : 'Aperçu snippet et cartes sociales'
        },
        {
            type: 'aeo_geo',
            icon: 'fa-robot',
            title: isAr ? 'جاهزية إجابات الذكاء الاصطناعي' : isEn ? 'AI Answer & Citation Readiness' : 'AI Answer & Citation Readiness',
            desc: isAr ? 'أسئلة، أجوبة وكتل مرئية يمكن للذكاء الاصطناعي فهمها دون اختراع.' : isEn ? 'Visible answers and FAQ schema that models can understand without guessing.' : 'Réponses visibles et FAQ schema que les modèles peuvent comprendre sans deviner.',
            target: isAr ? 'محتوى مرئي + JSON-LD' : isEn ? 'Visible content + JSON-LD' : 'Contenu visible + JSON-LD',
            validation: isAr ? 'اقرأ النص كعميل وتحقق من كل وعد' : isEn ? 'Read as a buyer and verify each claim' : 'Lire comme un acheteur et vérifier chaque promesse'
        },
        {
            type: 'system',
            icon: 'fa-shield-halved',
            title: isAr ? 'ملفات الوصول والثقة' : isEn ? 'Machine Access & Trust Files' : 'Machine Access & Trust Files',
            desc: isAr ? 'robots.txt و llms.txt و security.txt بدون وعود كاذبة أو بيانات مخترعة.' : isEn ? 'robots.txt, llms.txt and security.txt without false claims or invented contacts.' : 'robots.txt, llms.txt et security.txt sans promesses ni contacts inventés.',
            target: '/',
            validation: isAr ? 'اختبار URLs العامة وقراءة robots' : isEn ? 'Check public URLs and robots reading' : 'Tester URLs publiques et lecture robots'
        }
    ];
    return `
    <div class="daka-real-results no-print" dir="${dir}">
        <div class="daka-real-hero">
            <div>
                <span class="daka-real-kicker">${isAr ? 'نظام توصية أبيض وآمن' : isEn ? 'White-hat recommendation system' : 'Système de recommandation white-hat'}</span>
                <h3>${labels.title}</h3>
                <p>${labels.subtitle}</p>
            </div>
            <div class="daka-score-orb" aria-label="${labels.score}: ${readiness.score}/100">
                <strong>${readiness.score}</strong><span>/100</span>
                <small>${labels.score}</small>
            </div>
        </div>
        <div class="daka-readiness-strip">
            ${readiness.signals.map(signal => renderDakaReadinessSignal(signal, labels)).join('')}
        </div>
        <div class="daka-real-journey" aria-label="Real Results workflow">
            ${(isAr ? ['افهم', 'نظّم', 'ثبّت', 'تحقق'] : isEn ? ['Understand', 'Structure', 'Install', 'Verify'] : ['Comprendre', 'Structurer', 'Installer', 'Vérifier']).map((step, i) => `
                <div class="daka-journey-step"><span>0${i + 1}</span><strong>${step}</strong></div>
            `).join('')}
        </div>
        <div class="daka-real-pack-grid">
            ${cards.map(card => `
                <article class="daka-real-pack-card">
                    <div class="daka-real-pack-icon"><i class="fas ${card.icon}"></i></div>
                    <h4>${card.title}</h4>
                    <p>${card.desc}</p>
                    <div class="daka-pack-meta">
                        <span><strong>${labels.install}</strong>${escapeHtml(card.target)}</span>
                        <span><strong>${labels.verify}</strong>${escapeHtml(card.validation)}</span>
                    </div>
                    <button type="button" class="btn-gen daka-real-action" data-no-collapse="true" data-gen-type="${card.type}">
                        <i class="fas fa-wand-magic-sparkles"></i>
                        <span>${labels.launch}</span>
                    </button>
                </article>
            `).join('')}
        </div>
        <div id="tech-gen-output" class="daka-real-output" style="display:none;"></div>
    </div>`;
}

function renderRealResultsGeneratedAsset(data) {
    const outputArea = document.getElementById('tech-gen-output');
    if (!outputArea) return false;
    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';
    const dir = isAr ? 'rtl' : 'ltr';
    const labels = {
        title: isAr ? 'حزمة Real Results جاهزة' : isEn ? 'Real Results pack ready' : 'Pack Real Results prêt',
        verdict: isAr ? 'قرار قابل للتنفيذ' : isEn ? 'Actionable verdict' : 'Verdict exploitable',
        copy: isAr ? 'نسخ' : isEn ? 'Copy' : 'Copier',
        evidence: isAr ? 'الأدلة المستخدمة' : isEn ? 'Evidence used' : 'Preuves utilisées',
        steps: isAr ? 'خطوات التثبيت والتحقق' : isEn ? 'Install and validation steps' : 'Étapes d’installation et de validation',
        install: isAr ? 'مكان التثبيت' : isEn ? 'Install target' : 'Zone d’installation',
        validation: isAr ? 'التحقق' : isEn ? 'Validation' : 'Validation',
        strengthen: isAr ? 'أدلة يجب تقويتها' : isEn ? 'Proofs to strengthen' : 'Preuves à renforcer'
    };
    const ts = Date.now();
    const deliverables = data.deliverables || {};
    const pick = (...values) => values.find(value => String(value || '').trim());
    const codeBlocks = [
        pick(data.htmlHeader, data.headCode, deliverables.headCode) ? { id: `rr-meta-${ts}`, title: 'Head code', value: pick(data.htmlHeader, data.headCode, deliverables.headCode), tone: 'green' } : null,
        pick(data.bodyCode, deliverables.bodyCode, data.geoCode) ? { id: `rr-body-${ts}`, title: 'Body visible block', value: pick(data.bodyCode, deliverables.bodyCode, data.geoCode), tone: 'violet' } : null,
        pick(data.aeoCode, data.schemaJsonLd, deliverables.schemaJsonLd) ? { id: `rr-aeo-${ts}`, title: 'JSON-LD / AEO schema', value: pick(data.aeoCode, data.schemaJsonLd, deliverables.schemaJsonLd), tone: 'cyan' } : null,
        pick(data.sitemapXml, deliverables.sitemapXml) ? { id: `rr-sitemap-${ts}`, title: 'sitemap.xml', value: pick(data.sitemapXml, deliverables.sitemapXml), tone: 'blue' } : null,
        pick(data.robotsTxt, deliverables.robotsTxt) ? { id: `rr-robots-${ts}`, title: 'robots.txt', value: pick(data.robotsTxt, deliverables.robotsTxt), tone: 'blue' } : null,
        pick(data.llmsTxt, deliverables.llmsTxt) ? { id: `rr-llms-${ts}`, title: 'llms.txt', value: pick(data.llmsTxt, deliverables.llmsTxt), tone: 'amber' } : null,
        pick(data.securityTxt, deliverables.securityTxt) ? { id: `rr-security-${ts}`, title: 'security.txt', value: pick(data.securityTxt, deliverables.securityTxt), tone: 'pink' } : null
    ].filter(Boolean);
    const list = value => Array.isArray(value) ? value.filter(Boolean).slice(0, 5) : [];
    const steps = list(data.readinessSteps || data.installChecklist);
    const evidence = list(data.evidenceUsed);
    const citations = list(data.citationsNeeded);
    outputArea.style.display = 'block';
    outputArea.innerHTML = `
        <section class="daka-generated-real-pack result-card fade-in-up" dir="${dir}">
            <div class="daka-generated-head">
                <div>
                    <span class="daka-real-kicker">${labels.verdict}</span>
                    <h3>${labels.title}</h3>
                    ${data.auditComment ? `<p>${escapeHtml(data.auditComment)}</p>` : ''}
                </div>
                <span class="daka-generated-badge">Real Results</span>
            </div>
            <div class="daka-generated-meta-grid">
                ${data.installTarget ? `<div><strong>${labels.install}</strong><span>${escapeHtml(data.installTarget)}</span></div>` : ''}
                ${data.validation ? `<div><strong>${labels.validation}</strong><span>${escapeHtml(data.validation)}</span></div>` : ''}
            </div>
            ${(steps.length || evidence.length || citations.length) ? `
                <div class="daka-generated-insights">
                    ${steps.length ? `<div><h4>${labels.steps}</h4><ol>${steps.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol></div>` : ''}
                    ${evidence.length ? `<div><h4>${labels.evidence}</h4><ul>${evidence.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
                    ${citations.length ? `<div><h4>${labels.strengthen}</h4><ul>${citations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
                </div>` : ''}
            <div class="daka-generated-code-grid">
                ${codeBlocks.map(block => `
                    <div class="daka-code-panel ${block.tone}">
                        <div class="daka-code-panel-head">
                            <strong>${escapeHtml(block.title)}</strong>
                            <button type="button" data-no-collapse="true" onclick="copyToClipboard('${block.id}', this)"><i class="fas fa-copy"></i>${labels.copy}</button>
                        </div>
                        <pre id="${block.id}"></pre>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
    setTimeout(() => {
        codeBlocks.forEach(block => {
            const node = document.getElementById(block.id);
            if (node) node.textContent = block.value;
        });
        outputArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
    return true;
}

window.displayGeneratedAsset = function(data) {
    if (renderRealResultsGeneratedAsset(data || {})) return;
};

function dakaClientAssetText(value, limit = 220) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function dakaClientAssetUrlParts(url) {
    try {
        const parsed = new URL(url);
        return {
            origin: parsed.origin,
            canonical: parsed.href,
            domain: parsed.hostname.replace(/^www\./, '')
        };
    } catch (_) {
        return { origin: 'https://example.com', canonical: String(url || ''), domain: 'example.com' };
    }
}

function dakaClientAssetList(value, limit = 6) {
    const out = [];
    const push = item => {
        if (out.length >= limit || item === null || item === undefined) return;
        if (Array.isArray(item)) return item.forEach(push);
        if (typeof item === 'object') {
            ['text', 'label', 'title', 'description', 'name', 'url', 'href', 'value'].forEach(key => push(item[key]));
            return;
        }
        const clean = dakaClientAssetText(item, 180);
        if (clean && !out.some(existing => existing.toLowerCase() === clean.toLowerCase())) out.push(clean);
    };
    push(value);
    return out;
}

function buildDakaClientTechnicalPack(url, type, ctx = {}) {
    const lang = STATE.currentLang || 'fr';
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    const parts = dakaClientAssetUrlParts(url);
    const extraction = ctx.extraction || {};
    const h1 = dakaClientAssetList(extraction.h1_all || extraction.h1 || ctx.h1 || [], 1)[0] || '';
    const title = dakaClientAssetText(extraction.title || h1 || parts.domain, 68);
    const description = dakaClientAssetText(extraction.description || h1 || title, 160);
    const ctas = dakaClientAssetList(extraction.ctas || ctx.copyIntel?.realCTAs || [], 6);
    const proofs = dakaClientAssetList([ctx.decisionProofs, ctx.trustIntel, extraction.socialLinks, extraction.pricingSignals], 8);
    const offer = dakaClientAssetText(description || title || parts.domain, 180);
    const questionIntro = isAr ? 'ما الذي يقدمه هذا الموقع؟' : isEn ? 'What does this page offer?' : 'Que propose cette page ?';
    const proofIntro = isAr ? 'ما الدليل المتاح؟' : isEn ? 'What proof is available?' : 'Quelle preuve est disponible ?';
    const answer = isAr
        ? `${parts.domain} يعرض ${offer}. يجب إبقاء أي سعر أو ضمان أو نتيجة غير مؤكدة بصيغة "قابل للتحقق".`
        : isEn
            ? `${parts.domain} presents ${offer}. Any price, warranty or result not observed must stay marked as "to confirm".`
            : `${parts.domain} présente ${offer}. Tout prix, garantie ou résultat non observé doit rester indiqué comme "à confirmer".`;
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            { '@type': 'Question', name: questionIntro, acceptedAnswer: { '@type': 'Answer', text: answer } },
            { '@type': 'Question', name: proofIntro, acceptedAnswer: { '@type': 'Answer', text: proofs[0] || (isAr ? 'لا توجد أدلة إضافية مؤكدة في السياق.' : isEn ? 'No additional proof confirmed in the context.' : 'Aucune preuve additionnelle confirmée dans le contexte.') } }
        ]
    };
    const schemaJsonLd = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
    const headCode = [
        `<title>${escapeHtml(title)}</title>`,
        `<meta name="description" content="${escapeHtml(description)}">`,
        `<link rel="canonical" href="${escapeHtml(parts.canonical || parts.origin + '/')}">`,
        `<meta property="og:type" content="website">`,
        `<meta property="og:title" content="${escapeHtml(title)}">`,
        `<meta property="og:description" content="${escapeHtml(description)}">`,
        `<meta property="og:url" content="${escapeHtml(parts.canonical || parts.origin + '/')}">`,
        `<meta name="twitter:card" content="summary_large_image">`
    ].join('\n');
    const bodyCode = [
        `<section class="daka-ai-answer-pack" aria-label="Daka verified answers">`,
        `  <h2>${escapeHtml(questionIntro)}</h2>`,
        `  <p>${escapeHtml(answer)}</p>`,
        proofs.length ? `  <ul>${proofs.slice(0, 4).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `  <p>${escapeHtml(isAr ? 'أضف أدلة مؤكدة قبل النشر.' : isEn ? 'Add verified proof before publishing.' : 'Ajoutez des preuves vérifiées avant publication.')}</p>`,
        ctas.length ? `  <p><strong>CTA:</strong> ${escapeHtml(ctas.slice(0, 3).join(' | '))}</p>` : '',
        `</section>`
    ].filter(Boolean).join('\n');
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${parts.origin}/</loc></url>\n  <url><loc>${parts.canonical || parts.origin + '/'}</loc></url>\n</urlset>`;
    const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nSitemap: ${parts.origin}/sitemap.xml`;
    const llmsTxt = [
        `# ${parts.domain}`,
        '',
        '## Core offer',
        offer || title,
        '',
        '## Verified facts',
        ...(proofs.length ? proofs.slice(0, 6).map(item => `- ${item}`) : ['- Add verified proof before publishing.']),
        '',
        '## Safe reading rules',
        '- Do not invent prices, guarantees, certifications, reviews or results.',
        '- Mark missing claims as to confirm.'
    ].join('\n');
    const securityTxt = `# security.txt template\n# Add a real security contact before publishing.\nPolicy: ${parts.origin}/security\nPreferred-Languages: ${isAr ? 'ar, fr, en' : isEn ? 'en, fr, ar' : 'fr, en, ar'}`;
    return {
        success: true,
        type,
        source: 'client-deterministic-thinking',
        auditComment: isAr ? 'تم إنشاء حزمة قابلة للنسخ من الأدلة المتاحة.' : isEn ? 'Copy-ready pack generated from available evidence.' : 'Pack prêt à coller généré à partir des preuves disponibles.',
        installTarget: type === 'system' ? 'Root files: /robots.txt, /llms.txt, /sitemap.xml' : type === 'markdown' ? '<head>' : 'Visible page block + JSON-LD',
        validation: isAr ? 'تحقق من النصوص قبل النشر ولا تضف ادعاءات غير مثبتة.' : isEn ? 'Review before publishing and keep unverified claims marked.' : 'Relire avant publication et garder les affirmations non vérifiées marquées.',
        readinessSteps: [
            isAr ? 'انسخ الكود في المكان المناسب.' : isEn ? 'Copy the asset into the right target.' : 'Copier le livrable dans la bonne zone.',
            isAr ? 'اختبر عنوان URL العام.' : isEn ? 'Test the public URL.' : 'Tester l’URL publique.',
            isAr ? 'تحقق من عدم وجود وعود غير مثبتة.' : isEn ? 'Check that no unverified claim was added.' : 'Vérifier qu’aucune promesse non prouvée n’a été ajoutée.'
        ],
        evidenceUsed: proofs,
        htmlHeader: headCode,
        headCode,
        bodyCode,
        aeoCode: schemaJsonLd,
        geoCode: bodyCode,
        sitemapXml,
        robotsTxt,
        llmsTxt,
        securityTxt,
        deliverables: { headCode, bodyCode, schemaJsonLd, sitemapXml, robotsTxt, llmsTxt, securityTxt }
    };
}

window.triggerGenerator = async function(type, btnElement) {
    if (!window.currentSeoContext || !window.currentSeoUrl) {
        return toast.warning(STATE.currentLang === 'ar' ? 'يرجى تشغيل التحليل التقني أولاً.' : 'Lancez d\'abord l\'analyse technique.');
    }

    const originalHTML = btnElement.innerHTML;
    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';

    // 🌍 Traduction du texte de chargement
    const loadingText = isAr ? 'جاري التوليد...' : isEn ? 'Generating...' : 'Generation...';

    btnElement.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${loadingText}`;
    btnElement.disabled = true;
    document.querySelectorAll('[data-gen-type]').forEach(b => b.disabled = true);

    try {
        const ctx = window.currentSeoContext;
        const slimContext = {
            extraction: {
                title: ctx.extraction?.title || '',
                description: ctx.extraction?.description || '',
                h1_all: ctx.extraction?.h1all || ctx.extraction?.h1_all || [ctx.extraction?.h1] || [],
                ctas: ctx.extraction?.ctas || ctx.copyIntel?.realCTAs || [],
                socialLinks: ctx.extraction?.socialLinks || [],
                pricingSignals: ctx.extraction?.pricingSignals || ctx.priceIntel?.evidence || []
            },
            globalReport: { detectedEntity: ctx.globalReport?.detectedEntity || '' },
            spyReport: { siteType: ctx.conversion?.siteType || 'Website' },
            intelligenceLayer: {
                financialIntel: { averageBasket: ctx.extraction?.estimatedAOV || null }
            },
            structuredData: ctx.structuredData || ctx.schemaIntel || null,
            trustIntel: ctx.trustIntel || ctx.trust || null,
            seoOpportunities: {
                llmsTxtAdvice: ctx.seoOpportunities?.llmsTxtAdvice || ctx.llmsTxtAdvice || '',
                schemaOpportunity: ctx.seoOpportunities?.schemaOpportunity || ''
            },
            robotsTxtAdvice: ctx.robotsTxtAdvice || ctx.robots?.advice || '',
            decisionProofs: ctx.decisionLayer?.proofs || ctx.marketProofs || [],
            businessContext: collectBusinessContext('tech'),
            deterministicThinking: buildDakaClientTechnicalPack(window.currentSeoUrl, type, ctx)
        };

        const response = await api.post('/api/generate-seo-assets', {
            url: window.currentSeoUrl,
            lang: STATE.currentLang || 'fr',
            type: type,
            analysisContext: slimContext
        }, CONFIG.TIMEOUT_LONG);

        if (response && response.success) {
            const outputArea = document.getElementById('tech-gen-output');
            if (outputArea) {
                outputArea.style.display = 'block';
                outputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            window.displayGeneratedAsset(response.data || response);
            toast.success(isAr ? '✅ تم التوليد بنجاح!' : '✅ Généré avec succès !');
        } else {
            throw new Error(response?.error || 'Réponse invalide du serveur');
        }
    } catch (err) {
        console.error('triggerGenerator Error:', err);
        const fallback = buildDakaClientTechnicalPack(window.currentSeoUrl, type, window.currentSeoContext || {});
        window.displayGeneratedAsset(fallback);
        toast.warning(isAr ? 'تم إنشاء حزمة محلية قابلة للنسخ.' : isEn ? 'Local copy-ready pack generated.' : 'Pack local prêt à coller généré.');
        return;
        toast.error(isAr ? 'خطأ في التوليد: ' + err.message : 'Erreur de generation : ' + err.message);
    } finally {
        btnElement.innerHTML = originalHTML;
        btnElement.disabled = false;
        document.querySelectorAll('[data-gen-type]').forEach(b => b.disabled = false);
    }
};

// ════════════════════════════════════════════════════════════════
// PARTIE 1/5 — DATA MAPPING V7 (lecture des bons champs)
// ════════════════════════════════════════════════════════════════
function renderBacklinkPortfolio(data = {}, opts = {}) {
    const isAr = !!opts.isAr;
    const isEn = !!opts.isEn;
    const esc = typeof escapeHtml === 'function' ? escapeHtml : value => String(value || '');
    const asArray = value => Array.isArray(value) ? value : [];
    const inboundSources = [
        ...asArray(data.linkIntelligence?.inboundLinks),
        ...asArray(data.seoAudit?.links?.inboundLinks),
        ...asArray(data.backlinks),
        ...asArray(data.backlinkIntel?.links),
        ...asArray(data.backlinkIntel?.backlinks),
        ...asArray(data.offPage?.backlinks),
        ...asArray(data.offPageIntel?.backlinks)
    ];
    const outboundSources = [
        ...asArray(data.linkIntelligence?.outboundLinks),
        ...asArray(data.seoAudit?.links?.outboundLinks),
        ...asArray(data.contentIntel?.externalOutboundLinkObjects),
        ...asArray(data.contentIntel?.externalOutboundLinks),
        ...asArray(data.contentIntel?.externalLinks),
        ...asArray(data.copyIntel?.externalOutboundLinkObjects),
        ...asArray(data.copyIntel?.externalOutboundLinks),
        ...asArray(data.extraction?.externalOutboundLinkObjects)
    ];
    const brokenSources = [
        ...asArray(data.linkIntelligence?.brokenLinks),
        ...asArray(data.brokenLinks),
        ...asArray(data.linkAudit?.brokenLinks),
        ...asArray(data.seoAudit?.links?.brokenLinks),
        ...asArray(data.contentIntel?.brokenLinks),
        ...asArray(data.extraction?.brokenLinks),
        ...asArray(data.extraction?.brokenLinkObjects)
    ];
    const normalize = (item, kind) => {
        const url = typeof item === 'string'
            ? item.trim()
            : String(
                kind === 'broken'
                    ? (item?.targetUrl || item?.url || item?.normalized || item?.link || item?.sourceUrl || item?.href || '')
                    : (item?.url || item?.normalized || item?.href || item?.link || item?.sourceUrl || item?.targetUrl || '')
            ).trim();
        if (!/^https?:\/\//i.test(url)) return null;
        let domain = '';
        try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        return {
            url,
            domain,
            anchor: String(item?.anchor || item?.text || item?.title || item?.label || domain || url).trim(),
            kind,
            authority: item?.authority || item?.domainAuthority || item?.dr || item?.da || null,
            status: item?.status || item?.statusCode || item?.httpStatus || null,
            statusCode: item?.statusCode || item?.httpStatus || null,
            source: String(item?.sourceUrl || item?.from || '').trim(),
            target: String(item?.targetUrl || item?.normalized || item?.href || '').trim(),
            rel: Array.isArray(item?.rel) ? item.rel.filter(Boolean) : String(item?.rel || '').split(/\s+/).filter(Boolean),
            context: String(item?.context || item?.sourceSnippet || '').trim()
        };
    };
    const uniqueLinks = (sources, kind) => {
        const seen = new Set();
        return sources.map(item => normalize(item, kind)).filter(item => {
            const uniqueKey = item ? `${item.url}|${kind === 'broken' ? item.anchor : ''}`.toLowerCase() : '';
            if (!item || seen.has(uniqueKey)) return false;
            seen.add(uniqueKey);
            return true;
        }).slice(0, 60);
    };
    const groups = {
        inbound: uniqueLinks(inboundSources, 'inbound'),
        outbound: uniqueLinks(outboundSources, 'outbound'),
        broken: uniqueLinks(brokenSources, 'broken')
    };
    const labels = {
        title: isAr ? 'الروابط القابلة للفحص والعمل' : isEn ? 'Links ready to inspect and act on' : 'Liens visibles et directement exploitables',
        intro: isAr
            ? 'افتح كل رابط، تحقق من مصدره، ثم نفّذ الإجراء المقترح. لا نعرض أي رابط وارد لم تتم ملاحظته.'
            : isEn
                ? 'Open each link, verify its source, then execute the recommended action. Unobserved inbound links are never invented.'
                : 'Ouvrez chaque lien, vérifiez sa source, puis exécutez l’action recommandée. Aucun lien entrant non observé n’est inventé.',
        inbound: isAr ? 'روابط واردة موثقة' : isEn ? 'Verified inbound links' : 'Liens entrants vérifiés',
        outbound: isAr ? 'روابط صادرة من الموقع' : isEn ? 'Outbound links from the site' : 'Liens sortants du site',
        broken: isAr ? 'روابط مكسورة يجب إصلاحها' : isEn ? 'Broken links to fix' : 'Liens cassés à corriger',
        open: isAr ? 'فتح الرابط' : isEn ? 'Open link' : 'Consulter',
        inboundAction: isAr ? 'تحقق من جودة المصدر وحافظ على الرابط.' : isEn ? 'Verify source quality and preserve the link.' : 'Vérifier la qualité de la source et préserver le lien.',
        outboundAction: isAr ? 'تحقق من الصلة والوجهة ووسم الرابط.' : isEn ? 'Verify relevance, destination and link attributes.' : 'Vérifier la pertinence, la destination et les attributs du lien.',
        brokenAction: isAr ? 'استبدل الرابط أو أعد توجيهه أو احذفه.' : isEn ? 'Replace, redirect or remove this link.' : 'Remplacer, rediriger ou supprimer ce lien.',
        emptyInbound: isAr ? 'لم يتم رصد رابط وارد موثّق.' : isEn ? 'No verified inbound link observed.' : 'Aucun lien entrant vérifié observé.',
        emptyOutbound: isAr ? 'لم يتم رصد رابط صادر قابل للفحص.' : isEn ? 'No reviewable outbound link observed.' : 'Aucun lien sortant consultable observé.',
        emptyBroken: isAr ? 'لم يتم توفير عنوان URL مكسور قابل للفحص.' : isEn ? 'No reviewable broken URL was provided.' : 'Aucune URL cassée consultable n’a été fournie.',
        source: isAr ? 'المصدر' : isEn ? 'Source' : 'Source',
        destination: isAr ? 'الوجهة' : isEn ? 'Destination' : 'Destination',
        attributes: isAr ? 'خصائص الرابط' : isEn ? 'Link attributes' : 'Attributs du lien',
        status: isAr ? 'الحالة' : isEn ? 'Status' : 'Statut',
        action: isAr ? 'الإجراء' : isEn ? 'Action' : 'Action'
    };
    const groupMeta = {
        inbound: { title: labels.inbound, icon: 'fa-arrow-right-to-bracket', action: labels.inboundAction, empty: labels.emptyInbound },
        outbound: { title: labels.outbound, icon: 'fa-arrow-up-right-from-square', action: labels.outboundAction, empty: labels.emptyOutbound },
        broken: { title: labels.broken, icon: 'fa-link-slash', action: labels.brokenAction, empty: labels.emptyBroken }
    };
    const renderGroup = (key) => {
        const meta = groupMeta[key];
        const items = groups[key];
        return `
        <section class="backlink-group backlink-group-${key}">
            <header class="backlink-group-head">
                <span class="backlink-group-icon"><i class="fas ${meta.icon}"></i></span>
                <div><strong>${meta.title}</strong><small>${meta.action}</small></div>
            </header>
            <div class="backlink-list">
                ${items.length ? items.map(item => `
                    <article class="backlink-item">
                        <div class="backlink-copy">
                            <strong dir="auto">${esc(item.anchor || item.domain)}</strong>
                            <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-no-collapse="true">${esc(item.url)}</a>
                            ${/^https?:\/\//i.test(item.source) && item.source !== item.url ? `<a class="backlink-source" href="${esc(item.source)}" target="_blank" rel="noopener noreferrer" data-no-collapse="true">${labels.source}: ${esc(item.source)}</a>` : ''}
                            ${/^https?:\/\//i.test(item.target) && item.target !== item.url ? `<a class="backlink-source" href="${esc(item.target)}" target="_blank" rel="noopener noreferrer" data-no-collapse="true">${labels.destination}: ${esc(item.target)}</a>` : ''}
                            ${item.context ? `<small dir="auto">${esc(item.context)}</small>` : ''}
                            <small>${item.status ? `${labels.status}: ${esc(item.status)}${item.statusCode ? ` (${esc(item.statusCode)})` : ''} · ` : ''}${item.rel.length ? `${labels.attributes}: ${esc(item.rel.join(', '))} · ` : ''}${labels.action}: ${meta.action}</small>
                        </div>
                        <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-no-collapse="true" class="backlink-open" aria-label="${labels.open}">
                            <span>${labels.open}</span><i class="fas fa-arrow-up-right-from-square"></i>
                        </a>
                    </article>`).join('') : `<div class="backlink-empty"><i class="fas fa-circle-info"></i><span>${meta.empty}</span></div>`}
            </div>
        </section>`;
    };
    return `
    <div class="backlink-portfolio result-card" dir="${isAr ? 'rtl' : 'ltr'}">
        <div class="backlink-portfolio-head">
            <div>
                <span class="backlink-kicker"><i class="fas fa-link"></i>${labels.title}</span>
                <p>${labels.intro}</p>
            </div>
        </div>
        <div class="backlink-groups">
            ${renderGroup('inbound')}
            ${renderGroup('outbound')}
            ${renderGroup('broken')}
        </div>
    </div>`;
}

function displayTechnicalResults(data) {
    const container = document.getElementById('resultsTechnical');
    if (!container) return;

    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';

    // ── V7 : seoAudit contient schema/images/links/security ──────
    const seoAudit = data.seoAudit || {};

    // ── Mapping complet avec fallback double (V6 → V7) ───────────
    const extract   = data.extraction      || {};
    const report    = data.globalReport    || { score: 0, grade: 'N/A', verdict: '---', businessOpportunity: '---' };

    // ✅ FIX V7 — h1check sans underscore
    const audit = data.structureAudit || {};
    const h1Check        = audit.h1check        || audit.h1_check        || '---';
    const headingStruct  = audit.heading_structure || audit.headingStructure || '---';
    const semanticDepth  = audit.semantic_depth  || audit.semanticDepth  || '---';
    const quickWins      = audit.quickWins       || [];

    const traffic   = data.traffic         || { monthlyTraffic: '---' };
    const metrics   = data.metrics         || { lcp: '---', tbt: '---', cls: '---', fcp: '---', ttfb: '---', speedIndex: '---' };

    // ── SEO Intelligence — vient de seoAudit.keywordDensity en V7 ─
    const rawKw     = data.seoIntelligence?.topKeywords   || seoAudit.keywordDensity || [];
    const rawLsi    = data.seoIntelligence?.lsiKeywords   || [];
    const rawGaps   = data.seoIntelligence?.semanticGaps  || [];
    const contentScore = data.seoIntelligence?.contentScore || 0;
    const seo = { topKeywords: rawKw, lsiKeywords: rawLsi, semanticGaps: rawGaps, contentScore };

    const aeo = data.aeoScore || { overall: 0, breakdown: {} };

    // ✅ FIX V7 — schema/images/links/security lus depuis seoAudit
    const schema = seoAudit.schema   || data.schemaMarkup  || { exists: false, types: [] };
    const images = {
        total      : seoAudit.images?.total      ?? extract.totalImages  ?? 0,
        missingAlt : seoAudit.images?.missingAlt ?? extract.missingAlt   ?? 0,
        oversized  : seoAudit.images?.oversized  ?? 0,
        lazy       : seoAudit.images?.lazyImages ?? extract.lazyImages   ?? 0,
        webp       : seoAudit.images?.webpImages ?? extract.webpImages   ?? 0,
    };
    const security = {
        https : seoAudit.security?.hasSSL  ?? extract.hasSSL  ?? false,
        hsts  : seoAudit.security?.hsts    ?? false,
        csp   : seoAudit.security?.csp     ?? false,
    };

    // ── Tech stack ────────────────────────────────────────────────
    const tech = data.techStack || seoAudit.techStack || {};

    // ── Issues — criticalIssues V7 ou issuesList seoAudit ─────────
    const issues = data.criticalIssues || seoAudit.issuesList || [];

    // ── Action Roadmap ────────────────────────────────────────────
    const roadmap = data.actionRoadmap || [];

    // ── Opportunities ─────────────────────────────────────────────
    const opportunities = data.seoOpportunities || {};

    // ── System files ─────────────────────────────────────────────
    const llmsTxt    = data.llmsTxtContent  || data.llmsTxt   || null;
    const robotsTxt  = data.robotsTxtAdvice || data.robotsTxt || null;

    // ── Generated Assets ──────────────────────────────────────────
    const assets = data.generatedAssets || {};

    // ════════════════════════════════════════════════════════════════
    // PARTIE 2/5 — HELPERS
    // ════════════════════════════════════════════════════════════════

    const h1List     = Array.isArray(extract.h1all) ? extract.h1all
                     : Array.isArray(extract.h1_all) ? extract.h1_all
                     : extract.h1 ? [extract.h1] : [];
    const h1Color    = (extract.h1count || extract.h1_count || 0) > 1 ? '#ef4444' : '#8b5cf6';
    const scoreColor = report.score >= 80 ? '#10b981' : report.score >= 50 ? '#f59e0b' : '#ef4444';
    const gradeColor = { A:'#10b981', B:'#3b82f6', C:'#f59e0b', D:'#ef4444', 'N/A':'#6b7280' };

    const sevColor = s => s==='HIGH'||s==='CRITIQUE' ? '#ef4444' : s==='MEDIUM' ? '#f59e0b' : '#3b82f6';
    const sevIcon  = s => s==='HIGH'||s==='CRITIQUE' ? 'fa-times-circle' : s==='MEDIUM' ? 'fa-exclamation-triangle' : 'fa-info-circle';

    // ✅ FIX — nettoie les unités avant parseFloat (évite CLS "0.56s" → NaN)
    const pf = v => parseFloat(String(v || '0').replace(/[^0-9.]/g, '')) || 0;
    const lcpColor = v => pf(v) <= 2.5 ? '#10b981' : pf(v) <= 4   ? '#f59e0b' : '#ef4444';
    const clsColor = v => pf(v) <= 0.1 ? '#10b981' : pf(v) <= 0.25? '#f59e0b' : '#ef4444';
    const tbtColor = v => pf(v) <= 200 ? '#10b981' : pf(v) <= 600  ? '#f59e0b' : '#ef4444';

    const titleLen   = extract.titleLength  || (extract.title||'').replace('❌ Manquant','').replace('❌ مفقود','').length || 0;
    const descLen    = extract.descLength   || (extract.description||'').replace('❌ Manquante','').replace('❌ مفقودة','').length || 0;
    const titleColor = titleLen > 65 ? '#ef4444' : titleLen < 30 ? '#f59e0b' : '#10b981';
    const descColor  = descLen  > 165? '#ef4444' : descLen  < 70 ? '#f59e0b' : '#10b981';

    // ════════════════════════════════════════════════════════════════
    // PARTIE 3/5 — HTML SECTIONS (KPI, Verdict, Issues, Meta, Vitals, Headings)
    // ════════════════════════════════════════════════════════════════

    const sectionKPI = `
    <div class="result-card fade-in-up"
         style="border:1px solid #3b82f6;
                background:linear-gradient(90deg,rgba(59,130,246,0.12)0%,rgba(16,185,129,0.05)100%);
                margin-bottom:25px; padding:25px; border-radius:18px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:20px; text-align:center;">

            <div>
                <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
                    🎯 ${isAr ? 'النتيجة' : 'Score Global'}
                </div>
                <div style="display:flex; align-items:center; justify-content:center; gap:10px;">
                    <div class="score-circle-mini" style="border-color:${scoreColor}; color:${scoreColor}; width:52px; height:52px; font-size:1.1rem;">
                        ${report.score}
                    </div>
                    <div style="font-size:2rem; font-weight:900; color:${gradeColor[report.grade]||'#6b7280'};">
                        ${report.grade || 'N/A'}
                    </div>
                </div>
            </div>

            <div style="border-inline-start:1px solid rgba(255,255,255,0.08); padding-inline-start:20px;">
                <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
                    📈 ${isAr ? 'حركة المرور' : 'Trafic Est.'}
                </div>
                <div style="font-size:1.6rem; font-weight:900; color:#3b82f6;">
                    ${traffic.monthlyTraffic} <small style="font-size:0.7rem;">v/m</small>
                </div>
                ${traffic.seoMaturityScore ? `<div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Maturité SEO: ${traffic.seoMaturityScore}/100</div>` : ''}
            </div>

            <div style="border-inline-start:1px solid rgba(255,255,255,0.08); padding-inline-start:20px;">
                <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
                    💰 ${isAr ? 'متوسط السلة' : 'Panier Moyen'}
                </div>
                <div style="font-size:1.6rem; font-weight:900; color:#10b981;">
                    ${extract.estimatedAOV || '---'} <small style="font-size:0.7rem;">MAD</small>
                </div>
                ${traffic.monthlyRevenueLoss ? `<div style="font-size:0.7rem; color:#ef4444; margin-top:4px;">Perte: ${traffic.monthlyRevenueLoss} MAD/m</div>` : ''}
            </div>

            <div style="border-inline-start:1px solid rgba(255,255,255,0.08); padding-inline-start:20px;">
                <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
                    🚀 ${isAr ? 'فرصة' : 'Opportunité'}
                </div>
                <div style="font-size:0.88rem; color:#fcd34d; font-weight:800; margin-top:4px; line-height:1.4;" dir="auto">
                    ${report.businessOpportunity}
                </div>
            </div>
        </div>
    </div>`;

    const sectionVerdict = `
    <div class="result-card" style="border-${isAr?'right':'left'}:6px solid ${scoreColor}; background:rgba(255,255,255,0.02); margin-bottom:25px;">
        <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
            <div class="score-circle" style="width:75px; height:75px; font-size:1.8rem; border-color:${scoreColor}; color:${scoreColor}; flex-shrink:0;">
                ${report.score}
            </div>
            <div style="flex:1;">
                <h4 style="color:#94a3b8; margin:0 0 8px 0; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px;">
                    ${report.detectedEntity || 'SEO Analysis'}
                    ${report.detectedNiche ? `<span style="color:#8b5cf6; margin-${isAr?'right':'left'}:8px;">· ${report.detectedNiche}</span>` : ''}
                </h4>
                <p style="font-size:1rem; color:white; margin:0; line-height:1.6; font-style:italic;" dir="auto">
                    "${report.verdict}"
                </p>
                ${report.priorityLevel ? `
                <div style="margin-top:10px;">
                    <span style="background:${sevColor(report.priorityLevel)}20; color:${sevColor(report.priorityLevel)};
                                 padding:3px 12px; border-radius:20px; font-size:0.72rem; font-weight:700;">
                        ${report.priorityLevel}
                    </span>
                </div>` : ''}
            </div>
        </div>
        ${(report.topStrengths?.length > 0 || report.topWeaknesses?.length > 0) ? `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:20px;">
            ${report.topStrengths?.length > 0 ? `
            <div style="padding:12px; background:rgba(16,185,129,0.05); border-radius:10px; border:1px solid rgba(16,185,129,0.15);">
                <div style="font-size:0.68rem; color:#10b981; text-transform:uppercase; margin-bottom:8px; font-weight:700;">✅ Forces</div>
                ${report.topStrengths.map(s => `<div style="font-size:0.8rem; color:#cbd5e1; margin-bottom:4px;" dir="auto">· ${s}</div>`).join('')}
            </div>` : ''}
            ${report.topWeaknesses?.length > 0 ? `
            <div style="padding:12px; background:rgba(239,68,68,0.05); border-radius:10px; border:1px solid rgba(239,68,68,0.15);">
                <div style="font-size:0.68rem; color:#ef4444; text-transform:uppercase; margin-bottom:8px; font-weight:700;">⚠️ Faiblesses</div>
                ${report.topWeaknesses.map(s => `<div style="font-size:0.8rem; color:#cbd5e1; margin-bottom:4px;" dir="auto">· ${s}</div>`).join('')}
            </div>` : ''}
        </div>` : ''}
    </div>`;

    const sectionIssues = issues.length > 0 ? `
    <div class="result-card" style="border-top:4px solid #ef4444; margin-bottom:25px;">
        <h3 style="color:#ef4444; margin-bottom:18px; font-family:'Cairo'; font-size:1.1rem;">
            <i class="fas fa-bug"></i>
            ${isAr ? 'المشاكل الحرجة' : isEn ? 'Critical Issues' : 'Problèmes Critiques'}
            <span style="background:#ef444420; color:#ef4444; font-size:0.72rem; padding:3px 10px; border-radius:20px; margin-${isAr?'right':'left'}:10px;">
                ${issues.length}
            </span>
        </h3>
        <div style="display:grid; gap:10px;">
            ${issues.map(issue => `
            <div style="display:flex; align-items:flex-start; gap:12px; padding:12px 15px;
                         background:rgba(255,255,255,0.02); border-radius:12px;
                         border:1px solid ${sevColor(issue.severity)}30;">
                <i class="fas ${sevIcon(issue.severity)}" style="color:${sevColor(issue.severity)}; margin-top:2px; flex-shrink:0;"></i>
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:0.88rem; color:#e2e8f0;">
                        ${issue.field || issue.type || ''}
                        <span style="color:${sevColor(issue.severity)}; font-size:0.7rem;
                                     background:${sevColor(issue.severity)}15; padding:2px 8px;
                                     border-radius:10px; margin-${isAr?'right':'left'}:8px;">
                            ${issue.severity}
                        </span>
                        ${issue.effort ? `<span style="color:#64748b; font-size:0.68rem; margin-${isAr?'right':'left'}:6px;">⏱ ${issue.effort}</span>` : ''}
                    </div>
                    <div style="font-size:0.83rem; color:#94a3b8; margin-top:4px;" dir="auto">${issue.issue || issue.message || ''}</div>
                    ${issue.fix ? `<div style="font-size:0.8rem; color:#10b981; margin-top:5px;" dir="auto">
                        <i class="fas fa-wrench" style="margin-${isAr?'left':'right'}:5px;"></i>${issue.fix}</div>` : ''}
                </div>
            </div>`).join('')}
        </div>
    </div>` : '';

    const sectionMeta = `
    <div class="result-card" style="border-top:4px solid #06b6d4; margin-bottom:25px;">
        <h3 style="color:#06b6d4; margin-bottom:15px; font-family:'Cairo'; font-size:1.1rem;">
            <i class="fas fa-align-left"></i>
            ${isAr ? 'بيانات الميتا' : 'Metadata Discovery'}
        </h3>
        <div style="display:grid; gap:12px;">
            <div class="diff-box">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="color:#3b82f6; font-size:0.72rem; text-transform:uppercase;">Title</strong>
                    <span style="font-size:0.7rem; color:${titleColor};">${titleLen} chars · ${extract.titleStatus||'---'}</span>
                </div>
                <div style="font-weight:700; color:#e2e8f0; font-size:0.95rem;" dir="auto">${extract.title || '---'}</div>
                ${assets.optimizedTitle ? `<div style="margin-top:8px; font-size:0.8rem; color:#10b981;" dir="auto">
                    <i class="fas fa-magic" style="margin-${isAr?'left':'right'}:5px;"></i>
                    ${isAr?'مقترح':'Suggestion'}: ${assets.optimizedTitle}</div>` : ''}
            </div>

            <div class="diff-box">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="color:#10b981; font-size:0.72rem; text-transform:uppercase;">Meta Description</strong>
                    <span style="font-size:0.7rem; color:${descColor};">${descLen} chars · ${extract.descStatus||'---'}</span>
                </div>
                <div style="font-size:0.88rem; line-height:1.5; color:#cbd5e1;" dir="auto">${extract.description || '---'}</div>
                ${assets.optimizedDescription ? `<div style="margin-top:8px; font-size:0.8rem; color:#10b981;" dir="auto">
                    <i class="fas fa-magic" style="margin-${isAr?'left':'right'}:5px;"></i>
                    ${isAr?'مقترح':'Suggestion'}: ${assets.optimizedDescription}</div>` : ''}
            </div>

            ${extract.canonical ? `
            <div class="diff-box">
                <strong style="color:#8b5cf6; font-size:0.72rem; text-transform:uppercase;">Canonical</strong>
                <div style="font-size:0.8rem; color:#94a3b8; margin-top:5px; word-break:break-all;">${extract.canonical}</div>
            </div>` : ''}

            ${extract.ogTitle || extract.ogImage ? `
            <div class="diff-box" style="border:1px solid rgba(59,130,246,0.15);">
                <strong style="color:#3b82f6; font-size:0.72rem; text-transform:uppercase;">Open Graph</strong>
                <div style="margin-top:8px; display:grid; gap:5px;">
                    ${extract.ogTitle ? `<div style="font-size:0.82rem; color:#94a3b8;" dir="auto"><span style="color:#3b82f6;">og:title</span> → ${extract.ogTitle}</div>` : ''}
                    ${extract.ogDescription ? `<div style="font-size:0.82rem; color:#94a3b8;" dir="auto"><span style="color:#3b82f6;">og:desc</span> → ${extract.ogDescription.substring(0,100)}</div>` : ''}
                    <div style="font-size:0.82rem; color:#94a3b8;"><span style="color:#3b82f6;">og:image</span> → ${extract.ogImage ? '✅' : '❌ Absent'}</div>
                </div>
            </div>` : ''}
        </div>
    </div>`;

    const sectionVitals = `
    <div class="result-card" style="border-top:4px solid #8b5cf6; margin-bottom:25px;">
        <h3 style="color:#8b5cf6; margin-bottom:18px; font-family:'Cairo'; font-size:1.1rem;">
            <i class="fas fa-bolt"></i>
            ${isAr ? 'مقاييس الأداء' : 'Core Web Vitals'}
        </h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:12px;">
            ${[
                { label:'LCP',   val: metrics.lcp,        color: lcpColor(metrics.lcp),  desc:'≤2.5s ✓' },
                { label:'TBT',   val: metrics.tbt,        color: tbtColor(metrics.tbt),  desc:'≤200ms ✓' },
                { label:'CLS',   val: metrics.cls,        color: clsColor(metrics.cls),  desc:'≤0.1 ✓' },
                { label:'FCP',   val: metrics.fcp,        color: '#3b82f6',              desc:'First Paint' },
                { label:'TTFB',  val: metrics.ttfb,       color: '#06b6d4',              desc:'Server Speed' },
                { label:'Speed', val: metrics.speedIndex, color: '#a855f7',              desc:'Speed Index' },
            ].map(v => `
            <div class="diff-box" style="text-align:center; border-bottom:3px solid ${v.color};">
                <div style="font-size:0.62rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;">${v.label}</div>
                <div style="font-size:1.3rem; font-weight:900; color:${v.color}; margin:5px 0;">${v.val || '---'}</div>
                <div style="font-size:0.6rem; color:#64748b;">${v.desc}</div>
            </div>`).join('')}
        </div>
    </div>`;

    const sectionHeadings = `
    <div class="result-card" style="border-top:4px solid ${h1Color}; margin-bottom:25px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <h3 style="color:${h1Color}; margin:0; font-family:'Cairo'; font-size:1.1rem;">
                <i class="fas fa-layer-group"></i>
                ${isAr ? 'بنية العناوين' : isEn ? 'Heading Structure' : 'Structure des Titres'}
            </h3>
            <span class="result-badge" style="background:${h1Color}20; color:${h1Color}; border:1px solid ${h1Color}40;">
                ${extract.h1count || extract.h1_count || 0} H1
                ${extract.h2count || extract.h2_count ? ` · ${extract.h2count||extract.h2_count} H2` : ''}
                ${extract.h3count || extract.h3_count ? ` · ${extract.h3count||extract.h3_count} H3` : ''}
            </span>
        </div>
        <div style="display:grid; gap:8px; margin-bottom:15px;">
            ${h1List.length > 0
                ? h1List.map(h => `
                <div class="diff-box" style="display:flex; align-items:center; gap:12px;">
                    <i class="fas fa-terminal" style="color:${h1Color}; font-size:0.72rem; opacity:0.5; flex-shrink:0;"></i>
                    <span style="font-size:0.92rem; color:#e2e8f0;" dir="auto">${h}</span>
                </div>`).join('')
                : '<p style="color:#ef4444; text-align:center; margin:0;">❌ Aucun H1 détecté</p>'
            }
        </div>

        <div style="font-size:0.88rem; color:#cbd5e1; padding:14px; background:rgba(0,0,0,0.25); border-radius:12px; border:1px solid rgba(255,255,255,0.05);" dir="auto">
            <i class="fas fa-robot" style="color:#8b5cf6; margin-${isAr?'left':'right'}:8px;"></i>
            ${h1Check}
        </div>

        ${headingStruct && headingStruct !== '---' ? `
        <div style="margin-top:12px; font-size:0.82rem; color:#94a3b8; padding:10px 14px; background:rgba(255,255,255,0.02); border-radius:10px;" dir="auto">
            <i class="fas fa-sitemap" style="margin-${isAr?'left':'right'}:6px; color:#06b6d4;"></i>
            ${headingStruct}
        </div>` : ''}

        ${quickWins.length > 0 ? `
        <div style="margin-top:12px; padding:14px; background:rgba(16,185,129,0.04); border-radius:10px; border:1px solid rgba(16,185,129,0.12);">
            <div style="font-size:0.68rem; color:#10b981; text-transform:uppercase; font-weight:700; margin-bottom:10px;">
                ⚡ Quick Wins
            </div>
            ${quickWins.map(w => `<div style="font-size:0.82rem; color:#cbd5e1; margin-bottom:6px;" dir="auto">
                <i class="fas fa-check-circle" style="color:#10b981; margin-${isAr?'left':'right'}:6px; font-size:0.72rem;"></i>${w}
            </div>`).join('')}
        </div>` : ''}
    </div>`;

    // ════════════════════════════════════════════════════════════════
    // PARTIE 4/5 — HTML SECTIONS (Keywords, AEO, Grid, Roadmap, Files)
    // ════════════════════════════════════════════════════════════════

    const sectionKeywords = (seo.topKeywords.length > 0 || seo.lsiKeywords.length > 0) ? `
    <div class="result-card" style="border-top:4px solid #10b981; margin-bottom:25px;">
        <h3 style="color:#10b981; margin-bottom:18px; font-family:'Cairo'; font-size:1.1rem;">
            <i class="fas fa-brain"></i>
            ${isAr ? 'ذكاء الكلمات المفتاحية' : isEn ? 'Site Intelligence' : 'Intelligence Mots-clés'}
            ${seo.contentScore ? `<span style="color:#fcd34d; font-size:0.8rem; margin-${isAr?'right':'left'}:10px;">Score contenu: ${seo.contentScore}/100</span>` : ''}
        </h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            ${seo.topKeywords.length > 0 ? `
            <div>
                <div style="font-size:0.72rem; color:#10b981; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">🔑 Top Keywords</div>
                <div style="display:flex; flex-wrap:wrap; gap:7px;">
                    ${seo.topKeywords.slice(0,12).map(k => `
                    <span style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:#6ee7b7; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:600;" dir="auto">
                        ${typeof k==='object' ? (k.keyword||k.word||'') : k}
                        ${typeof k==='object' && (k.density||k.count) ? `<span style="opacity:0.6;"> ${k.density||k.count}${k.density?'%':''}</span>` : ''}
                    </span>`).join('')}
                </div>
            </div>` : ''}
            ${seo.lsiKeywords.length > 0 ? `
            <div>
                <div style="font-size:0.72rem; color:#8b5cf6; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">🧠 LSI / Sémantique</div>
                <div style="display:flex; flex-wrap:wrap; gap:7px;">
                    ${seo.lsiKeywords.slice(0,10).map(k => `
                    <span style="background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.25); color:#c4b5fd; padding:4px 12px; border-radius:20px; font-size:0.78rem;" dir="auto">
                        ${typeof k==='object' ? (k.keyword||k.word||'') : k}
                    </span>`).join('')}
                </div>
            </div>` : ''}
        </div>
        ${seo.semanticGaps.length > 0 ? `
        <div style="margin-top:18px; padding:14px; background:rgba(239,68,68,0.05); border-radius:12px; border:1px solid rgba(239,68,68,0.15);">
            <div style="font-size:0.72rem; color:#ef4444; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">⚠️ Gaps Sémantiques Manquants</div>
            <div style="display:flex; flex-wrap:wrap; gap:7px;">
                ${seo.semanticGaps.slice(0,8).map(g => `
                <span style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:#fca5a5; padding:4px 12px; border-radius:20px; font-size:0.78rem;" dir="auto">${g}</span>`).join('')}
            </div>
        </div>` : ''}
    </div>` : '';

    const sectionAEO = aeo.overall > 0 ? `
    <div class="result-card" style="border-top:4px solid #f59e0b; margin-bottom:25px;">
        <h3 style="color:#f59e0b; margin-bottom:18px; font-family:'Cairo'; font-size:1.1rem;">
            <i class="fas fa-comments"></i>
            AEO Score — ${isAr ? 'تحسين محركات الإجابة' : 'Answer Engine Optimization'}
            <span style="background:#f59e0b20; color:#f59e0b; font-size:0.8rem; padding:3px 12px; border-radius:20px; margin-${isAr?'right':'left'}:10px;">
                ${aeo.overall}/100
            </span>
        </h3>
        <div class="aeo-progress-container">
            ${Object.entries(aeo.breakdown || {}).map(([key, val]) => `
            <div class="aeo-bar-wrapper">
                <div class="aeo-bar-label">
                    <span>${key}</span>
                    <span style="color:#f59e0b; font-weight:700;">${val}/100</span>
                </div>
                <div class="aeo-progress">
                    <div class="aeo-progress-fill" style="width:${val}%; background:${val>=70?'#10b981':val>=40?'#f59e0b':'#ef4444'};"></div>
                </div>
            </div>`).join('')}
        </div>
        ${opportunities.aeoAnalysis ? `
        <div style="margin-top:14px; font-size:0.83rem; color:#94a3b8; padding:12px; background:rgba(245,158,11,0.04); border-radius:10px;" dir="auto">
            <i class="fas fa-robot" style="color:#f59e0b; margin-${isAr?'left':'right'}:6px;"></i>
            ${opportunities.aeoAnalysis}
        </div>` : ''}
    </div>` : '';

    const sectionGrid = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:15px; margin-bottom:25px;">

        <div class="diff-box" style="border-bottom:3px solid ${schema.exists ? '#10b981' : '#ef4444'};">
            <div style="font-size:0.72rem; color:#94a3b8; text-transform:uppercase; margin-bottom:10px;">
                <i class="fas fa-code" style="margin-${isAr?'left':'right'}:6px;"></i>Schema Markup
            </div>
            <div style="font-size:1rem; font-weight:800; color:${schema.exists?'#10b981':'#ef4444'}; margin-bottom:8px;">
                ${schema.exists ? '✅ Présent' : '❌ Absent'}
            </div>
            ${schema.types?.length > 0 ? `
            <div style="display:flex; flex-wrap:wrap; gap:5px;">
                ${schema.types.map(t => `<span style="background:rgba(16,185,129,0.1); color:#6ee7b7; padding:2px 8px; border-radius:10px; font-size:0.72rem;">${t}</span>`).join('')}
            </div>` : ''}
        </div>

        <div class="diff-box" style="border-bottom:3px solid ${images.missingAlt > 0 ? '#f59e0b' : '#10b981'};">
            <div style="font-size:0.72rem; color:#94a3b8; text-transform:uppercase; margin-bottom:10px;">
                <i class="fas fa-images" style="margin-${isAr?'left':'right'}:6px;"></i>Images Audit
            </div>
            <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:6px; text-align:center;">
                ${[
                    { val: images.total,      label: 'Total',   color: '#3b82f6' },
                    { val: images.missingAlt, label: 'ALT ❌',  color: images.missingAlt > 0 ? '#f59e0b' : '#10b981' },
                    { val: images.lazy,       label: 'Lazy',    color: '#8b5cf6' },
                    { val: images.webp,       label: 'WebP',    color: '#06b6d4' },
                    { val: images.oversized,  label: 'Heavy',   color: images.oversized > 0 ? '#ef4444' : '#10b981' },
                ].map(i => `<div>
                    <div style="font-size:1.1rem; font-weight:900; color:${i.color};">${i.val}</div>
                    <div style="font-size:0.58rem; color:#64748b;">${i.label}</div>
                </div>`).join('')}
            </div>
        </div>

        <div class="diff-box" style="border-bottom:3px solid ${security.https ? '#10b981' : '#ef4444'};">
            <div style="font-size:0.72rem; color:#94a3b8; text-transform:uppercase; margin-bottom:10px;">
                <i class="fas fa-shield-alt" style="margin-${isAr?'left':'right'}:6px;"></i>Security + Tracking
            </div>
            <div style="display:flex; flex-direction:column; gap:5px;">
                ${[
                    { label:'HTTPS',     val: security.https },
                    { label:'HSTS',      val: security.hsts },
                    { label:'CSP',       val: security.csp },
                    { label:'GA4',       val: extract.hasGA4 },
                    { label:'GTM',       val: extract.hasGTM },
                    { label:'Meta Pixel',val: extract.hasPixelMeta },
                ].map(s => `
                <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
                    <span style="color:#94a3b8;">${s.label}</span>
                    <span style="color:${s.val ? '#10b981' : '#ef4444'}; font-weight:700;">${s.val ? '✅' : '❌'}</span>
                </div>`).join('')}
            </div>
        </div>
    </div>`;

    const sectionRoadmap = roadmap.length > 0 ? `
    <div class="result-card" style="border-top:4px solid #8b5cf6; margin-bottom:25px;">
        <h3 style="color:#8b5cf6; margin-bottom:18px; font-family:'Cairo'; font-size:1.1rem;">
            <i class="fas fa-map-signs"></i>
            ${isAr ? 'خارطة الطريق' : isEn ? 'Action Roadmap' : 'Plan d\'Action'}
        </h3>
        <div style="display:grid; gap:12px;">
            ${roadmap.map((step, i) => {
                const pColor = step.priority==='URGENT' ? '#ef4444' : step.priority==='IMPORTANT' ? '#f59e0b' : '#3b82f6';
                return `
                <div style="display:flex; gap:15px; align-items:flex-start; padding:14px; background:rgba(255,255,255,0.02); border-radius:12px; border:1px solid ${pColor}20;">
                    <div style="width:28px; height:28px; background:${pColor}20; border:1px solid ${pColor}40; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:900; color:${pColor}; flex-shrink:0;">${i+1}</div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; flex-wrap:wrap; gap:5px;">
                            <span style="background:${pColor}20; color:${pColor}; font-size:0.68rem; padding:2px 8px; border-radius:10px; font-weight:700;">${step.priority}</span>
                            ${step.effort ? `<span style="color:#64748b; font-size:0.68rem;">⏱ ${step.effort}</span>` : ''}
                        </div>
                        <div style="font-size:0.88rem; color:#e2e8f0; font-weight:600; margin-bottom:4px;" dir="auto">${step.task}</div>
                        ${step.roi ? `<div style="font-size:0.78rem; color:#10b981;" dir="auto">📈 ${step.roi}</div>` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>
    </div>` : '';

    const sectionTech = Object.keys(tech).length > 0 ? `
    <div class="result-card" style="border-top:4px solid #6366f1; margin-bottom:25px;">
        <h3 style="color:#6366f1; margin-bottom:15px; font-family:'Cairo'; font-size:1.1rem;">
            <i class="fas fa-microchip"></i>
            ${isAr ? 'التقنيات المستخدمة' : isEn ? 'Tech Stack' : 'Stack Technologique'}
        </h3>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
            ${Object.entries(tech).flatMap(([cat, items]) =>
                (Array.isArray(items) ? items : [items]).map(item => `
                <span style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); color:#a5b4fc; padding:6px 14px; border-radius:20px; font-size:0.8rem; font-weight:600;">
                    <span style="opacity:0.5; font-size:0.7rem;">${cat} ·</span> ${item}
                </span>`)
            ).join('')}
        </div>
    </div>` : '';

    const sectionFiles = (llmsTxt || robotsTxt) ? `
    <div class="result-card" style="border-top:4px solid #06b6d4; margin-bottom:25px;">
        <h3 style="color:#06b6d4; margin-bottom:15px; font-family:'Cairo'; font-size:1.1rem;">
            <i class="fas fa-file-code"></i>
            ${isAr ? 'ملفات النظام المقترحة' : 'Fichiers Système Générés'}
        </h3>
        ${llmsTxt ? `
        <div style="margin-bottom:15px;">
            <div style="font-size:0.72rem; color:#06b6d4; text-transform:uppercase; margin-bottom:8px; font-weight:700;">🤖 LLMs.txt</div>
            <div class="code-block-dark" style="max-height:180px; overflow-y:auto; position:relative;">
                <button class="btn-copy-mini" onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent)">Copy</button>
                <pre style="margin:0;">${llmsTxt}</pre>
            </div>
        </div>` : ''}
        ${robotsTxt ? `
        <div>
            <div style="font-size:0.72rem; color:#8b5cf6; text-transform:uppercase; margin-bottom:8px; font-weight:700;">🤖 Robots.txt Advice</div>
            <div class="code-block-dark" style="max-height:180px; overflow-y:auto; position:relative;">
                <button class="btn-copy-mini" onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent)">Copy</button>
                <pre style="margin:0;">${robotsTxt}</pre>
            </div>
        </div>` : ''}
    </div>` : '';

   const sectionGenerators = renderRealResultsEngine(data, { isAr, isEn });

    const decisionProofHtml = renderDecisionProofPanel(data, {
        isAr,
        isEn,
        dir: isAr ? 'rtl' : 'ltr',
        esc: escapeHtml
    });
    const backlinkPortfolioHtml = renderBacklinkPortfolio(data, { isAr, isEn });
    const techReportLabels = getReportLabels({ isAr, isEn });

    // ── Assemblage HTML complet ───────────────────────────────────
    container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;" class="no-print">
        <h2 style="margin:0; font-family:'Cairo'; font-size:1.1rem; color:#3b82f6;">
            <i class="fas fa-microscope"></i>
            ${isAr ? 'تحليل العمق التقني' : isEn ? 'DEEP TECHNICAL AUDIT' : 'AUDIT TECHNIQUE DEEP'}
        </h2>
        <span style="font-size:0.72rem; color:#64748b; font-weight:600;">
            ${data.analyzedUrl || data.url || ''} · v${data.version || 'V7'} · ${data.meta?.processingMs ? data.meta.processingMs+'ms' : ''}
        </span>
    </div>
    ${renderExecutiveSummary(data, 'technical', { isAr, isEn })}
    ${renderReportSection('technical', techReportLabels.technical, techReportLabels.technicalSub, 'fa-gauge-high', `
        ${decisionProofHtml}
        ${sectionKPI}
        ${sectionVerdict}
        ${sectionIssues}
    `, { isAr, isEn })}

    ${renderReportSection('page', techReportLabels.page, techReportLabels.pageSub, 'fa-file-lines', `
        ${sectionMeta}
        ${sectionVitals}
        ${sectionHeadings}
        ${sectionKeywords}
        ${sectionAEO}
    `, { isAr, isEn })}

    ${renderReportSection(
        'backlinks',
        isAr ? 'الروابط الواردة والصادرة والمكسورة' : isEn ? 'Inbound, outbound and broken links' : 'Liens entrants, sortants et cassés',
        isAr ? 'روابط مرئية قابلة للفحص مع الإجراء المطلوب لكل رابط.' : isEn ? 'Visible, reviewable links with the required action for each one.' : 'Des liens visibles et consultables, avec l’action requise pour chacun.',
        'fa-link',
        backlinkPortfolioHtml,
        { isAr, isEn }
    )}

    ${renderReportSection('plan', techReportLabels.plan, techReportLabels.planSub, 'fa-list-check', `
        ${sectionGrid}
        ${sectionRoadmap}
        ${sectionTech}
        ${sectionFiles}
        ${sectionGenerators}
    `, { isAr, isEn })}

    ${renderExpertDock('audit', { isAr, isEn })}
    `;

    showResults('resultsTechnical');

    // ── Event listeners boutons générateurs ──────────────────────
    container.querySelectorAll('[data-gen-type]').forEach(btn => {
        btn.addEventListener('click', function () {
            const genType = this.getAttribute('data-gen-type');
            if (typeof window.triggerGenerator === 'function') {
                window.triggerGenerator(genType, this);
            } else {
                toast.error("Erreur d'initialisation des générateurs.");
            }
        });
    });

    if (typeof window.updateExportBadges === 'function') {
        window.updateExportBadges();
    }
}
const SEOGEN_BRAND = {
  BG:        [10, 15, 30],   // fond global
  CARD:      [15, 23, 42],   // surfaces / cartes
  PRIMARY:   [108, 99, 255], // violet principal
  ACCENT:    [6, 182, 212],  // cyan
  SUCCESS:   [16, 185, 129], // vert
  WARNING:   [245, 158, 11], // orange
  DANGER:    [239, 68, 68],  // rouge
  TEXT:      [226, 232, 240],// texte principal
  MUTED:     [148, 163, 184],// texte secondaire
  BORDER:    [51, 65, 85],   // bordures
};

const SEOGEN_BRAND_HEX = {
  BG:      '#0a0f1e',
  CARD:    '#0f172a',
  PRIMARY: '#6c63ff',
  ACCENT:  '#06b6d4',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  DANGER:  '#ef4444',
  TEXT:    '#e2e8f0',
  MUTED:   '#94a3b8',
  BORDER:  '#1e293b',
};

function getExportableReportText(el) {
    if (!el) return '';
    return String(el.innerText || el.textContent || '')
        .replace(/\b(null|undefined|NaN)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isDakaInsufficientExportText(value) {
    const text = String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    if (!text) return true;
    if (/^les positions exactes des sections peuvent necessiter une verification visuelle manuelle\.?$/.test(text)) return true;
    const exact = [
        'donnees insuffisantes', 'donnée insuffisante', 'donnee insuffisante',
        'non disponible', 'aucune donnee', 'aucun resultat', 'n/a',
        'insufficient data', 'not available', 'no data', 'no results',
        'لا توجد بيانات كافية', 'غير متوفر', 'لا توجد نتائج'
    ];
    return exact.some(function (label) {
        const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return text === normalized || (text.length < 90 && text.includes(normalized));
    });
}

function dakaPdfHumanLabel(value, lang = STATE.currentLang || 'fr') {
    const raw = String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const key = raw.toLowerCase();
    const labels = {
        ar: {
            hero: 'الشاشة الأولى', pricing: 'السعر والعرض', price: 'السعر', primary_cta: 'زر القرار الرئيسي',
            cta: 'زر القرار', product: 'المنتج', features: 'الخصائص', returns: 'الإرجاع', delivery: 'التوصيل',
            trust: 'الثقة', social_proof: 'الدليل الاجتماعي', testimonials: 'آراء العملاء', reviews: 'آراء العملاء',
            faq: 'الأسئلة الشائعة', guarantee: 'الضمان', content: 'المحتوى', product_visuals: 'صور المنتج',
            offer: 'العرض', benefits: 'الفوائد', footer: 'التذييل', legal: 'الصفحات القانونية'
        },
        en: {
            hero: 'First screen', pricing: 'Price and offer', price: 'Price', primary_cta: 'Primary action button',
            cta: 'Action button', product: 'Product', features: 'Product features', returns: 'Returns', delivery: 'Delivery',
            trust: 'Trust proof', social_proof: 'Social proof', testimonials: 'Customer testimonials', reviews: 'Customer reviews',
            faq: 'FAQ', guarantee: 'Guarantee', content: 'Content', product_visuals: 'Product visuals',
            offer: 'Offer', benefits: 'Benefits', footer: 'Footer', legal: 'Legal pages'
        },
        fr: {
            hero: 'Premier écran', pricing: 'Prix et offre', price: 'Prix', primary_cta: 'Bouton d’action principal',
            cta: 'Bouton d’action', product: 'Produit', features: 'Caractéristiques produit', returns: 'Retours', delivery: 'Livraison',
            trust: 'Preuves de confiance', social_proof: 'Preuve sociale', testimonials: 'Témoignages clients', reviews: 'Avis clients',
            faq: 'FAQ', guarantee: 'Garantie', content: 'Contenu', product_visuals: 'Visuels produit',
            offer: 'Offre', benefits: 'Bénéfices', footer: 'Pied de page', legal: 'Pages légales'
        }
    };
    return labels[lang]?.[key] || labels.fr[key] || raw;
}

function dakaPdfSanitizeClientText(value, lang = STATE.currentLang || 'fr') {
    let text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    text = text
        .replace(/\b(?:click|cliquez|cliquer|voir les détails|view details|open section|onclick|data-export-feature)\b/gi, ' ')
        .replace(/\b(?:primary_cta|social_proof|product_visuals)\b/gi, function (match) { return dakaPdfHumanLabel(match, lang); })
        .replace(/\b(?:hero|pricing|features|returns|delivery|trust|testimonials|reviews|faq|guarantee|product)\b/gi, function (match) {
            const human = dakaPdfHumanLabel(match, lang);
            return human || match;
        })
        .replace(/\s+/g, ' ')
        .trim();
    return text;
}

function dakaPdfPrepareSemanticText(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (STATE.currentLang !== 'ar') {
        const arabicChars = (text.match(/[\u0600-\u06ff]/g) || []).length;
        if (arabicChars >= 4 && arabicChars / Math.max(text.length, 1) > 0.18) {
            return STATE.currentLang === 'en'
                ? 'Arabic source copy detected. Review the original wording in the web report.'
                : 'Texte source en arabe détecté. Consulter la formulation originale dans le rapport web.';
        }
    }
    return dakaPdfSanitizeClientText(text, STATE.currentLang || 'fr');
}

function cloneReportHtmlForExport(el, exportOptions = {}) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    const featureKeys = Array.isArray(exportOptions.featureKeys) ? exportOptions.featureKeys : [];
    if (featureKeys.length) {
        clone.querySelectorAll('[data-export-feature]').forEach(function (node) {
            if (!featureKeys.includes(node.getAttribute('data-export-feature'))) node.remove();
        });
    }
    clone.querySelectorAll('details').forEach(function (details) {
        details.setAttribute('open', 'open');
    });
    if (exportOptions.includeDetails === false) {
        clone.querySelectorAll('.report-section:not(.report-section-direct) .report-section-body').forEach(function (node) {
            node.remove();
        });
    }
    clone.querySelectorAll(
        'button, .btn-gen, .no-print, .kw-filter-btn, #kwFilterBar, ' +
        '.loading-state, .toast-container, .export-bubble-wrapper, ' +
        '.btn-export-pdf, .btn-copy-mini, [data-gen-type], iframe, ' +
        '.daka-global-loader, .auth-modal, .report-feature-nav, ' +
        '.expert-dock, .generator-grid, .global-expert-bubble, ' +
        '.groq-code-builder, .mega-copy-grid, .mega-copy-source, ' +
        '.report-section-toggle, .report-section-close-row, ' +
        '.mega-prompt-shell > summary, input, select, textarea'
    ).forEach(function (node) {
        node.remove();
    });
    clone.querySelectorAll('[hidden], .hidden').forEach(function (node) {
        node.remove();
    });
    clone.querySelectorAll('script, style, template, noscript, video, audio').forEach(function (node) {
        node.remove();
    });
    clone.querySelectorAll('.business-intel-empty').forEach(function (node) {
        node.remove();
    });
    clone.querySelectorAll('article, section, .result-card, .card, .executive-block, .executive-action, .decision-proof-panel').forEach(function (node) {
        if (!node.querySelector('a[href], img, canvas, svg, table') && isDakaInsufficientExportText(getExportableReportText(node))) {
            node.remove();
        }
    });
    if (typeof sanitizeDakaBusinessVocabularyForContext === 'function') {
        const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (node) {
            node.nodeValue = sanitizeDakaBusinessVocabularyForContext(node.nodeValue);
        });
    }
    return clone.innerHTML;
}

function createFixedPdfClone(el, exportOptions = {}) {
    const shell = document.createElement('section');
    shell.className = 'daka-pdf-fixed-clone';
    shell.setAttribute('aria-hidden', 'true');
    shell.setAttribute('dir', STATE.currentLang === 'ar' ? 'rtl' : 'ltr');
    shell.style.cssText = [
        'position:fixed', 'left:-12000px', 'top:0', 'width:794px',
        'min-height:1123px', 'padding:64px 56px', 'box-sizing:border-box',
        'overflow:visible', 'background:#ffffff', 'color:#0f172a',
        'font-family:Inter,Cairo,Arial,sans-serif', 'line-height:1.55',
        'z-index:-1'
    ].join(';');
    const reportTitle = String(exportOptions.title || 'Daka Decision Report');
    const chapterTitles = Array.isArray(exportOptions.featureTitles) ? exportOptions.featureTitles : [];
    shell.innerHTML = `
        <style>
            .daka-pdf-fixed-clone, .daka-pdf-fixed-clone * {
                box-sizing: border-box !important;
                max-width: 100% !important;
                font-family: Arial, "Helvetica Neue", sans-serif !important;
                letter-spacing: normal !important;
                word-spacing: normal !important;
                writing-mode: horizontal-tb !important;
                text-orientation: mixed !important;
                text-rendering: optimizeLegibility !important;
                -webkit-font-smoothing: antialiased !important;
                filter: none !important;
                text-shadow: none !important;
            }
            .daka-pdf-fixed-clone > * { width: 100% !important; }
            .daka-pdf-fixed-clone *::before,
            .daka-pdf-fixed-clone *::after { animation: none !important; content: none !important; }
            .daka-pdf-fixed-clone {
                font-size: 14px !important;
                line-height: 1.62 !important;
            }
            .daka-pdf-fixed-clone h1 { font-size: 25px !important; line-height: 1.22 !important; margin: 0 0 12px !important; }
            .daka-pdf-fixed-clone h2 { font-size: 19px !important; line-height: 1.3 !important; margin: 0 0 10px !important; }
            .daka-pdf-fixed-clone h3 { font-size: 16px !important; line-height: 1.4 !important; margin: 0 0 8px !important; }
            .daka-pdf-fixed-clone h4,
            .daka-pdf-fixed-clone h5,
            .daka-pdf-fixed-clone h6 { font-size: 14px !important; line-height: 1.42 !important; }
            .daka-pdf-fixed-clone p,
            .daka-pdf-fixed-clone li,
            .daka-pdf-fixed-clone td,
            .daka-pdf-fixed-clone th { font-size: 11.6px !important; line-height: 1.58 !important; }
            .daka-pdf-fixed-clone p { margin: 0 0 9px !important; }
            .daka-pdf-fixed-clone ul,
            .daka-pdf-fixed-clone ol { margin: 8px 0 10px !important; padding-inline-start: 22px !important; }
            .daka-pdf-fixed-clone li { margin-bottom: 5px !important; }
            .daka-pdf-fixed-clone small { font-size: 10px !important; line-height: 1.5 !important; }
            .daka-pdf-fixed-clone .report-section {
                margin: 0 0 24px !important;
                padding: 0 !important;
                border: 0 !important;
                border-radius: 0 !important;
                background: #ffffff !important;
                color: #0f172a !important;
                box-shadow: none !important;
                overflow: visible !important;
            }
            .daka-pdf-fixed-clone .executive-summary,
            .daka-pdf-fixed-clone .result-card,
            .daka-pdf-fixed-clone .card,
            .daka-pdf-fixed-clone .competitor-card,
            .daka-pdf-fixed-clone .executive-block,
            .daka-pdf-fixed-clone .executive-action,
            .daka-pdf-fixed-clone .decision-proof-panel,
            .daka-pdf-fixed-clone .funnel-v2-hero,
            .daka-pdf-fixed-clone .funnel-v2-action,
            .daka-pdf-fixed-clone .funnel-v2-order > div,
            .daka-pdf-fixed-clone .funnel-v2-facts > div,
            .daka-pdf-fixed-clone .funnel-v2-copy-stack > div,
            .daka-pdf-fixed-clone .funnel-v2-missing-architecture,
            .daka-pdf-fixed-clone #magicPromptPlaceholder > .result-card {
                margin: 0 0 18px !important;
                padding: 16px 18px !important;
                border-radius: 8px !important;
                border: 1px solid #dbe4ef !important;
                border-left: 4px solid #0ea5e9 !important;
                background: #ffffff !important;
                color: #0f172a !important;
                box-shadow: none !important;
                overflow: visible !important;
            }
            .daka-pdf-fixed-clone .funnel-surgery-shell {
                margin: 0 0 20px !important;
                padding: 0 !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 8px !important;
                background: #ffffff !important;
                color: #0f172a !important;
                box-shadow: none !important;
                overflow: visible !important;
            }
            .daka-pdf-fixed-clone .funnel-surgery-hero {
                display: grid !important;
                grid-template-columns: 1fr auto !important;
                gap: 12px !important;
                padding: 16px 18px !important;
                border-bottom: 1px solid #dbe4ef !important;
                background: #eaf4fb !important;
            }
            .daka-pdf-fixed-clone .funnel-surgery-hero h2,
            .daka-pdf-fixed-clone .funnel-surgery-item-head strong { color: #0f172a !important; }
            .daka-pdf-fixed-clone .funnel-surgery-hero p,
            .daka-pdf-fixed-clone .funnel-surgery-item p { color: #334155 !important; }
            .daka-pdf-fixed-clone .funnel-surgery-grid,
            .daka-pdf-fixed-clone .funnel-surgery-list { display: block !important; padding: 12px !important; }
            .daka-pdf-fixed-clone .funnel-surgery-category {
                display: block !important;
                margin: 0 0 12px !important;
                border: 1px solid #dbe4ef !important;
                border-radius: 6px !important;
                background: #ffffff !important;
                break-inside: avoid !important;
            }
            .daka-pdf-fixed-clone .funnel-surgery-category > summary {
                display: grid !important;
                grid-template-columns: auto 1fr !important;
                padding: 10px 12px !important;
                border-bottom: 1px solid #e2e8f0 !important;
                background: #f8fafc !important;
                list-style: none !important;
            }
            .daka-pdf-fixed-clone .funnel-surgery-chevron { display: none !important; }
            .daka-pdf-fixed-clone #magicPromptPlaceholder {
                display: block !important;
                margin: 22px 0 !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }
            .daka-pdf-fixed-clone #magicPromptPlaceholder button,
            .daka-pdf-fixed-clone #magicPromptPlaceholder .btn-copy-mini,
            .daka-pdf-fixed-clone #magicPromptPlaceholder .copy-badge {
                display: none !important;
            }
            .daka-pdf-fixed-clone #magicPromptRawText,
            .daka-pdf-fixed-clone #rawPromptText,
            .daka-pdf-fixed-clone .funnel-mega-prompt {
                display: block !important;
                max-height: none !important;
                overflow: visible !important;
                white-space: pre-wrap !important;
                word-break: normal !important;
                overflow-wrap: break-word !important;
                padding: 14px 16px !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 8px !important;
                background: #f8fafc !important;
                color: #0f172a !important;
                font-family: "Courier New", monospace !important;
                font-size: 9.4px !important;
                line-height: 1.48 !important;
            }
            .daka-pdf-fixed-clone .funnel-order-insights > div {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 10px !important;
            }
            .daka-pdf-fixed-clone .funnel-order-board-grid {
                display: grid !important;
                grid-template-columns: 1fr 150px !important;
                gap: 12px !important;
            }
            .daka-pdf-fixed-clone .funnel-order-wireframe {
                min-height: 190px !important;
                border: 1px solid #cbd5e1 !important;
                background: #f8fafc !important;
            }
            .daka-pdf-fixed-clone .funnel-surgery-item {
                margin: 0 0 8px !important;
                padding: 10px 12px !important;
                border: 1px solid #e2e8f0 !important;
                border-left: 4px solid #0ea5e9 !important;
                border-radius: 5px !important;
                background: #ffffff !important;
                color: #0f172a !important;
                break-inside: avoid !important;
            }
            .daka-pdf-fixed-clone .report-section-head {
                display: block !important;
                margin: 0 0 13px !important;
                padding: 13px 16px !important;
                border: 0 !important;
                border-left: 5px solid #0ea5e9 !important;
                border-radius: 4px !important;
                background: #f1f5f9 !important;
            }
            .daka-pdf-fixed-clone .report-section-body {
                display: block !important;
                padding: 0 !important;
                border: 0 !important;
            }
            .daka-pdf-fixed-clone .daka-pdf-chapter-label {
                display: block !important;
                width: 100% !important;
                margin: 20px 0 14px !important;
                padding: 13px 16px !important;
                border: 1px solid #cbd5e1 !important;
                border-left: 6px solid #0369a1 !important;
                border-radius: 6px !important;
                background: #eaf4fb !important;
                color: #0f172a !important;
            }
            .daka-pdf-fixed-clone .daka-pdf-chapter-label small {
                display: block !important;
                margin-bottom: 3px !important;
                color: #0369a1 !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
            }
            .daka-pdf-fixed-clone .daka-pdf-chapter-label strong {
                display: block !important;
                font-size: 18px !important;
                line-height: 1.35 !important;
                color: #0f172a !important;
            }
            .daka-pdf-fixed-clone .executive-summary-head,
            .daka-pdf-fixed-clone .decision-proof-panel > div,
            .daka-pdf-fixed-clone .report-section-head {
                display: grid !important;
                grid-template-columns: 1fr !important;
                gap: 10px !important;
            }
            .daka-pdf-fixed-clone .executive-grid,
            .daka-pdf-fixed-clone .executive-actions {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 10px !important;
            }
            .daka-pdf-fixed-clone .executive-block-wide { grid-column: 1 / -1 !important; }
            .daka-pdf-fixed-clone .report-section-icon,
            .daka-pdf-fixed-clone .executive-score {
                width: auto !important;
                min-width: 0 !important;
                justify-self: start !important;
            }
            .daka-pdf-fixed-clone table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
            .daka-pdf-fixed-clone th,
            .daka-pdf-fixed-clone td { padding: 8px !important; border: 1px solid #dbe4ef !important; vertical-align: top !important; }
            .daka-pdf-fixed-clone a { color: #0369a1 !important; text-decoration: underline !important; }
            .daka-pdf-table-cards { display: grid !important; grid-template-columns: 1fr !important; gap: 12px !important; }
            .daka-pdf-table-card { width: 100% !important; border: 1px solid #dbe4ef !important; border-left: 4px solid #0369a1 !important; border-radius: 7px !important; padding: 13px 15px !important; background: #ffffff !important; }
            .daka-pdf-table-field { display: grid !important; grid-template-columns: 170px minmax(0, 1fr) !important; gap: 14px !important; padding: 8px 0 !important; border-bottom: 1px solid #eef2f7 !important; }
            .daka-pdf-table-field:last-child { border-bottom: 0 !important; }
            .daka-pdf-table-label { color: #475569 !important; font-size: 10px !important; font-weight: 800 !important; text-transform: uppercase !important; }
            .daka-pdf-table-value { min-width: 0 !important; color: #0f172a !important; font-size: 12px !important; font-weight: 600 !important; overflow-wrap: break-word !important; word-break: normal !important; }
            .daka-pdf-fixed-clone .badge,
            .daka-pdf-fixed-clone [class*="badge"],
            .daka-pdf-fixed-clone [class*="pill"] {
                display: inline-block !important;
                width: auto !important;
                padding: 3px 7px !important;
                border-radius: 4px !important;
                background: #e2e8f0 !important;
                color: #334155 !important;
                font-size: 9px !important;
                font-weight: 800 !important;
            }
        </style>
        <header style="margin-bottom:26px;padding:22px 24px;border-radius:12px;background:#071426;color:#fff;border-top:5px solid #06b6d4;">
            <div style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:#67e8f9;font-weight:800;">DAKA · DECISION REPORT</div>
            <h1 style="margin:7px 0 5px;font-size:25px;color:#fff;">${escapeHtml(reportTitle)}</h1>
            <p style="margin:0;color:#cbd5e1;font-size:11px;">${STATE.currentLang === 'en' ? 'Evidence, decisions and actions selected for this delivery.' : 'Preuves, décisions et actions sélectionnées pour cette livraison.'}</p>
            ${chapterTitles.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:13px;">${chapterTitles.map(title => `<span style="padding:5px 8px;border:1px solid rgba(103,232,249,.25);border-radius:5px;color:#cffafe;font-size:8px;font-weight:700;">${escapeHtml(title)}</span>`).join('')}</div>` : ''}
        </header>
        ${cloneReportHtmlForExport(el, exportOptions)}`;

    shell.querySelectorAll('*').forEach(function (node) {
        node.style.setProperty('animation', 'none', 'important');
        node.style.setProperty('transition', 'none', 'important');
        node.style.setProperty('transform', 'none', 'important');
        node.style.setProperty('position', 'static', 'important');
        node.style.setProperty('inset', 'auto', 'important');
        node.style.setProperty('float', 'none', 'important');
        node.style.setProperty('max-width', '100%', 'important');
        node.style.setProperty('box-sizing', 'border-box', 'important');
        node.style.setProperty('writing-mode', 'horizontal-tb', 'important');
        node.style.setProperty('text-orientation', 'mixed', 'important');
    });
    shell.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,td,th,small,strong,span').forEach(function (node) {
        node.style.setProperty('color', '#0f172a', 'important');
        node.style.setProperty('text-shadow', 'none', 'important');
        node.style.setProperty('overflow-wrap', 'break-word', 'important');
        node.style.setProperty('word-break', 'normal', 'important');
        node.style.setProperty('white-space', 'normal', 'important');
    });
    shell.querySelectorAll('#magicPromptRawText,#rawPromptText,.funnel-mega-prompt').forEach(function (node) {
        node.style.setProperty('white-space', 'pre-wrap', 'important');
        node.style.setProperty('font-family', '"Courier New", monospace', 'important');
        node.style.setProperty('font-size', '9.4px', 'important');
        node.style.setProperty('line-height', '1.48', 'important');
        node.style.setProperty('background', '#f8fafc', 'important');
        node.style.setProperty('color', '#0f172a', 'important');
        node.style.setProperty('max-height', 'none', 'important');
        node.style.setProperty('overflow', 'visible', 'important');
    });
    shell.querySelectorAll('div,section,article,aside,main').forEach(function (node) {
        if (node.classList.contains('funnel-color-preview')) return;
        node.style.setProperty('background-color', 'transparent', 'important');
        node.style.setProperty('background-image', 'none', 'important');
    });
    shell.querySelectorAll('.result-card,.competitor-card,.card,.executive-summary,.executive-block,.executive-action,.executive-pulse-grid article,.funnel-color-swatch,.funnel-visual-details,.decision-proof-panel').forEach(function (card) {
        card.style.setProperty('background', '#ffffff', 'important');
        card.style.setProperty('background-image', 'none', 'important');
        card.style.setProperty('color', '#0f172a', 'important');
        card.style.setProperty('border', '1px solid #dbe4ef', 'important');
        card.style.setProperty('box-shadow', 'none', 'important');
        card.style.setProperty('overflow', 'visible', 'important');
    });
    shell.querySelector(':scope > header')?.style.setProperty('background', '#071426', 'important');
    shell.querySelectorAll(':scope > header, :scope > header *').forEach(function (node) {
        node.style.setProperty('color', '#ffffff', 'important');
    });
    shell.querySelectorAll('details').forEach(function (details) {
        details.open = true;
    });
    shell.querySelectorAll('img,canvas,svg,video').forEach(function (media) {
        media.style.maxWidth = '100%';
        media.style.height = 'auto';
    });
    shell.querySelectorAll('table').forEach(function (table) {
        table.style.width = '100%';
        table.style.tableLayout = 'auto';
        const rows = Array.from(table.querySelectorAll('tr'));
        const headers = Array.from(table.querySelectorAll('thead th')).map(function (cell, index) {
            return String(cell.innerText || cell.textContent || ('Colonne ' + (index + 1))).trim();
        });
        const maxColumns = rows.reduce(function (max, row) {
            return Math.max(max, row.children.length);
        }, 0);
        if (maxColumns >= 4 && rows.length) {
            const cards = document.createElement('div');
            cards.className = 'daka-pdf-table-cards';
            rows.filter(function (row) { return !row.closest('thead'); }).forEach(function (row, rowIndex) {
                const cells = Array.from(row.children);
                if (!cells.length) return;
                const card = document.createElement('article');
                card.className = 'daka-pdf-table-card';
                cells.forEach(function (cell, cellIndex) {
                    const value = String(cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim();
                    if (!value) return;
                    const field = document.createElement('div');
                    field.className = 'daka-pdf-table-field';
                    field.innerHTML = '<strong class="daka-pdf-table-label">'
                        + escapeHtml(headers[cellIndex] || ('Champ ' + (cellIndex + 1)))
                        + '</strong><span class="daka-pdf-table-value">'
                        + escapeHtml(value)
                        + '</span>';
                    card.appendChild(field);
                });
                if (card.children.length) cards.appendChild(card);
            });
            if (cards.children.length) table.replaceWith(cards);
        }
    });
    const chapterTitlesByKey = {};
    const featureKeys = Array.isArray(exportOptions.featureKeys) ? exportOptions.featureKeys : [];
    featureKeys.forEach(function (key, index) {
        chapterTitlesByKey[key] = chapterTitles[index] || key;
    });
    shell.querySelectorAll('[data-export-feature]').forEach(function (chapter, index) {
        chapter.classList.add('daka-pdf-chapter');
        chapter.style.setProperty('width', '100%', 'important');
        const key = chapter.getAttribute('data-export-feature') || '';
        const heading = chapter.querySelector('h1,h2,h3,.report-section-title,.executive-summary-kicker');
        const title = chapterTitlesByKey[key]
            || String(heading?.innerText || heading?.textContent || '').replace(/\s+/g, ' ').trim()
            || (STATE.currentLang === 'en' ? 'Decision chapter' : 'Chapitre décisionnel');
        const label = document.createElement('div');
        label.className = 'daka-pdf-chapter-label';
        label.innerHTML = '<small>'
            + escapeHtml(STATE.currentLang === 'en' ? ('Chapter ' + (index + 1)) : ('Chapitre ' + (index + 1)))
            + '</small><strong>' + escapeHtml(title) + '</strong>';
        chapter.prepend(label);
    });
    shell.querySelectorAll('[style*="grid-template-columns"], [style*="display:grid"], [style*="display: grid"], .grid-2, .grid-3, .grid-4, .metrics-grid, .section-grid').forEach(function (grid) {
        grid.style.setProperty('display', 'grid', 'important');
        grid.style.setProperty('grid-template-columns', '1fr', 'important');
        grid.style.setProperty('gap', '12px', 'important');
    });
    shell.querySelectorAll('[style*="display:flex"], [style*="display: flex"]').forEach(function (flex) {
        flex.style.setProperty('display', 'flex', 'important');
        flex.style.setProperty('flex-wrap', 'wrap', 'important');
        flex.style.setProperty('align-items', 'flex-start', 'important');
        flex.style.setProperty('gap', '10px', 'important');
    });
    document.body.appendChild(shell);
    shell.querySelectorAll(':scope > *, .daka-pdf-chapter, .daka-pdf-chapter > *, .report-section-body > *, .executive-grid > *, .executive-actions > *').forEach(function (node) {
        node.style.setProperty('width', '100%', 'important');
        node.style.setProperty('min-width', '0', 'important');
    });
    shell.querySelectorAll('*').forEach(function (node) {
        const computed = window.getComputedStyle(node);
        if (computed.display === 'grid' && computed.gridTemplateColumns.split(' ').length > 2) {
            node.style.setProperty('grid-template-columns', '1fr', 'important');
        }
        if (computed.display === 'flex' && node.scrollWidth > node.clientWidth) {
            node.style.setProperty('flex-wrap', 'wrap', 'important');
        }
    });
    return shell;
}

function getDakaPdfCaptureBlocks(root) {
    const blocks = [];
    const maxBlockHeight = 1850;
    function collect(node, depth) {
        if (!node || node.nodeType !== 1 || node.tagName === 'STYLE') return;
        if (getExportableReportText(node).length === 0 && !node.querySelector('img,canvas,svg')) return;
        const children = Array.from(node.children).filter(function (child) {
            return child.tagName !== 'STYLE' && (getExportableReportText(child).length > 0 || child.querySelector('img,canvas,svg'));
        });
        const isChapter = node.classList.contains('daka-pdf-chapter');
        const isBody = node.classList.contains('report-section-body');
        if ((node.scrollHeight || 0) <= maxBlockHeight || !children.length || depth >= 5) {
            blocks.push(node);
            return;
        }
        if (isChapter || isBody || node.scrollHeight > 3000) {
            children.forEach(function (child) { collect(child, depth + 1); });
            return;
        }
        blocks.push(node);
    }
    Array.from(root.children).forEach(function (node) { collect(node, 0); });
    return blocks;
}

function getDakaPdfSemanticBlocks(root) {
    const seenBlocks = new Set();
    const seenParagraphs = new Set();
    return getDakaPdfCaptureBlocks(root)
        .filter(function (node) { return !(node.tagName === 'HEADER' && node.parentElement === root); })
        .map(function (node) {
            const heading = node.querySelector('.daka-pdf-chapter-label strong, h1, h2, h3, h4, h5');
            const title = String(heading?.innerText || heading?.textContent || '').replace(/\s+/g, ' ').trim();
            const seenText = new Set();
            const paragraphs = [];
            node.querySelectorAll('p, li, .daka-pdf-table-field, .business-profile-summary > div, .business-answer-grid article, a[href]').forEach(function (item) {
                if (
                    item.matches('p, li, a[href]')
                    && item.closest('.daka-pdf-table-field, .business-profile-summary > div, .business-answer-grid article')
                ) return;
                const text = dakaPdfPrepareSemanticText(getExportableReportText(item));
                const normalized = text.toLowerCase();
                if (!text || isDakaInsufficientExportText(text) || normalized === title.toLowerCase() || seenText.has(normalized) || seenParagraphs.has(normalized)) return;
                seenText.add(normalized);
                seenParagraphs.add(normalized);
                paragraphs.push({
                    text,
                    bullet: item.tagName === 'LI',
                    url: item.matches('a[href]') ? item.href : ''
                });
            });
            if (!paragraphs.length) {
                const fallback = dakaPdfPrepareSemanticText(getExportableReportText(node));
                if (fallback && !isDakaInsufficientExportText(fallback) && fallback.toLowerCase() !== title.toLowerCase()) {
                    paragraphs.push({ text: fallback, bullet: false, url: '' });
                }
            }
            const identity = (title + '|' + paragraphs.map(function (item) { return item.text; }).join('|')).toLowerCase();
            if (!identity || seenBlocks.has(identity)) return null;
            seenBlocks.add(identity);
            return {
                title,
                paragraphs,
                chapter: node.classList.contains('daka-pdf-chapter-label') || node.classList.contains('daka-pdf-chapter')
            };
        })
        .filter(function (block) {
            return block && block.paragraphs.length > 0;
        });
}

function saveDakaPdfFile(pdf, filename, downloadWindow = null) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 640;
    if (!isMobile) {
        pdf.save(filename);
        return;
    }
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (downloadWindow && !downloadWindow.closed) {
        try { downloadWindow.location.href = url; } catch (_) {}
    }
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
}

window.exportFullAnalysisToWord = async function (exportOptions = null) {
    const lang = STATE.currentLang || 'fr';
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    if (!exportOptions?.prepared) {
        openDakaExportStudio();
        return;
    }
    const selectedSectionKeys = new Set(exportOptions.sections || []);
    const selectedFeatures = exportOptions.features || {};
    const selectedModules = getDakaExportModules().filter(module => module.available && selectedSectionKeys.has(module.key));
    if (!selectedModules.length) {
        return toast.warning(isAr ? 'لا يوجد تقرير جاهز للتصدير.' : isEn ? 'No report is ready to export.' : 'Aucun rapport prêt à exporter.');
    }
    const model = getDakaPdfDecisionModel(selectedModules);
    const sectionHtml = selectedModules.map(function (module) {
        const el = document.getElementById(module.id);
        if (!el || getExportableReportText(el).length < 40) return '';
        return '<section class="word-chapter"><h2>' + escapeHtml(module.title) + '</h2>' +
            cloneReportHtmlForExport(el, {
                includeDetails: exportOptions.includeDetails !== false,
                featureKeys: selectedFeatures[module.key] || [],
                featureTitles: (module.features || [])
                    .filter(function (feature) { return (selectedFeatures[module.key] || []).includes(feature.key); })
                    .map(function (feature) { return feature.title; })
            }) + '</section>';
    }).filter(Boolean).join('');
    if (!sectionHtml) {
        return toast.warning(isAr ? 'المحتوى غير جاهز للتصدير.' : isEn ? 'Content is not ready to export.' : 'Le contenu n’est pas prêt pour l’export.');
    }
    const title = isAr ? 'تقرير Daka التنفيذي' : isEn ? 'Daka Executive Report' : 'Rapport exécutif Daka';
    const slug = (model.domain || 'report').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 34);
    const filename = 'Daka-Editable-Report-' + slug + '-' + Date.now() + '.docx';
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/export/word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            lang,
            title,
            filename,
            logoDataUrl: window.dakaExportLogoDataUrl || '',
            model: {
                siteTitle: model.siteTitle || model.domain || '',
                domain: model.domain || '',
                reportUrl: model.reportUrl || '',
                date: model.date || '',
                score: model.score,
                verdict: model.verdict || '',
                priorityDecision: model.priorityDecision || '',
                opportunities: model.opportunities || [],
                weaknesses: model.weaknesses || [],
                actions: model.actions || [],
                quickWins: model.quickWins || [],
                plan30: model.plan30 || [],
                after30: model.after30 || [],
                branches: model.branches || [],
                modules: model.modules || [],
                geo: model.geo || '',
                objective: model.objective || ''
            },
            sectionHtml
        })
    });
    if (!response.ok) throw new Error(isAr ? 'تعذر إنشاء ملف DOCX.' : isEn ? 'DOCX export failed.' : 'Export DOCX impossible.');
    const fileData = await response.blob();
    const url = URL.createObjectURL(fileData);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast.success(isAr ? 'تم تحميل ملف DOCX.' : isEn ? 'DOCX file downloaded.' : 'Fichier DOCX téléchargé.');
};

function restorePdfExportDom(hiddenEls, openedDetails) {
    (hiddenEls || []).forEach(function (item) {
        if (item && item.el) item.el.style.display = item.orig;
    });
    (openedDetails || []).forEach(function (details) {
        if (details) details.open = false;
    });
}

function getDakaExportModules() {
    const lang = STATE.currentLang || 'fr';
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    const keywords = Array.isArray(STATE.lastKeywords) ? STATE.lastKeywords : (STATE.lastKeywords?.keywords || []);
    const feature = (key, icon, fr, en, ar) => ({ key, icon, title: isAr ? ar : isEn ? en : fr });
    return [
        {
            key: 'competitors', id: 'resultsCompetitors', icon: 'fa-chess-queen',
            available: !!STATE.lastAnalysisResults,
            title: isAr ? 'المنافسون والسوق' : isEn ? 'Competitors & Market' : 'Concurrents & marché',
            subtitle: isAr ? 'الفرص والتهديدات وخطة التقدم' : isEn ? 'Opportunities, threats and attack plan' : 'Opportunités, menaces et plan d’attaque',
            team: isAr ? 'فريق Daka لاستخبارات السوق' : isEn ? 'Daka Market Intelligence Team' : 'Équipe Daka Intelligence Marché',
            features: [
                feature('summary', 'fa-gauge-high', 'Résumé exécutif · lecture 3 minutes', 'Executive summary · 3-minute read', 'الملخص التنفيذي · قراءة 3 دقائق'),
                feature('market', 'fa-compass', 'Lecture du marché et preuves', 'Market reading and evidence', 'قراءة السوق والأدلة'),
                feature('plan', 'fa-list-check', 'Plan d’attaque prioritaire', 'Priority attack plan', 'خطة الهجوم ذات الأولوية'),
                feature('competitors', 'fa-crosshairs', 'Fiches des concurrents', 'Competitor profiles', 'ملفات المنافسين'),
                feature('proof', 'fa-link', 'Sources et liens à consulter', 'Sources and links to review', 'المصادر والروابط للفحص')
            ]
        },
        {
            key: 'funnel', id: 'resultsFunnel', icon: 'fa-filter-circle-dollar',
            available: !!STATE.lastFunnelResults,
            title: isAr ? 'العرض ومسار التحويل' : isEn ? 'Offer & Conversion Path' : 'Offre & parcours de conversion',
            subtitle: isAr ? 'الثقة والسعر ونقاط فقدان العملاء' : isEn ? 'Trust, pricing and conversion leaks' : 'Confiance, prix et pertes de conversion',
            team: isAr ? 'فريق Daka للتحويل والعرض' : isEn ? 'Daka Conversion & Offer Team' : 'Équipe Daka Conversion & Offre',
            features: [
                feature('summary', 'fa-gauge-high', 'Résumé exécutif · lecture 3 minutes', 'Executive summary · 3-minute read', 'الملخص التنفيذي · قراءة 3 دقائق'),
                feature('page', 'fa-layer-group', 'Architecture de la page', 'Page architecture', 'بنية الصفحة'),
                feature('page-order', 'fa-arrow-down-1-9', 'Nouvel ordre recommandé', 'Recommended page order', 'الترتيب المقترح للصفحة'),
                feature('frictions', 'fa-triangle-exclamation', 'Frictions de conversion', 'Conversion blockers', 'عوائق التحويل'),
                feature('money', 'fa-hand-holding-dollar', 'Offre, prix et confiance', 'Offer, price and trust', 'العرض والسعر والثقة'),
                feature('message', 'fa-bullseye', 'Message, promesse et CTA', 'Message, promise and CTA', 'الرسالة والوعد وCTA'),
                feature('plan', 'fa-list-check', 'Plan de reconstruction', 'Reconstruction plan', 'خطة إعادة البناء'),
                feature('details', 'fa-database', 'Données observées et limites', 'Observed data and limits', 'البيانات المرصودة والحدود'),
                feature('aida-journey', 'fa-route', 'Parcours AIDA', 'AIDA journey', 'مسار AIDA'),
                feature('customer-psychology', 'fa-brain', 'Psychologie client', 'Customer psychology', 'سيكولوجية العميل'),
                feature('funnel-score', 'fa-gauge-high', 'Score stratégique', 'Strategic score', 'النتيجة الاستراتيجية'),
                feature('financial-cta', 'fa-coins', 'Prix, offre et CTA', 'Price, offer and CTA', 'السعر والعرض وCTA'),
                feature('strategic-blueprint', 'fa-compass-drafting', 'Blueprint stratégique', 'Strategic blueprint', 'المخطط الاستراتيجي'),
                feature('visual-identity', 'fa-palette', 'Identité visuelle', 'Visual identity', 'الهوية البصرية'),
                feature('technical-signals', 'fa-microchip', 'Signaux techniques', 'Technical signals', 'الإشارات التقنية'),
                feature('copy-signals', 'fa-quote-left', 'Signaux copywriting', 'Copywriting signals', 'إشارات النص'),
                feature('page-metrics', 'fa-chart-column', 'Métriques de page', 'Page metrics', 'مقاييس الصفحة'),
                feature('attack-opportunities', 'fa-crosshairs', 'Angles d’attaque', 'Attack angles', 'زوايا الهجوم'),
                feature('ready-copy', 'fa-pen-ruler', 'Textes prêts à utiliser', 'Ready-to-use copy', 'نصوص جاهزة'),
                feature('trust-mobile', 'fa-shield-heart', 'Confiance et mobile', 'Trust and mobile', 'الثقة والهاتف'),
                feature('prioritized-actions', 'fa-list-check', 'Plan d’action priorisé', 'Prioritized action plan', 'خطة العمل'),
                feature('mega-redesign', 'fa-wand-magic-sparkles', 'Mega AI Redesign Prompt', 'Mega AI Redesign Prompt', 'أمر إعادة التصميم')
            ]
        },
        {
            key: 'technical', id: 'resultsTechnical', icon: 'fa-gauge-high',
            available: !!STATE.lastTechnicalResults,
            title: isAr ? 'أداء الموقع' : isEn ? 'Site Performance' : 'Performance du site',
            subtitle: isAr ? 'الأساس التقني والأولويات العملية' : isEn ? 'Technical foundations and practical priorities' : 'Fondations techniques et priorités pratiques',
            team: isAr ? 'فريق Daka لأداء المواقع' : isEn ? 'Daka Site Performance Team' : 'Équipe Daka Performance Site',
            features: [
                feature('summary', 'fa-gauge-high', 'Résumé exécutif · lecture 3 minutes', 'Executive summary · 3-minute read', 'الملخص التنفيذي · قراءة 3 دقائق'),
                feature('technical', 'fa-gauge-high', 'Diagnostic technique', 'Technical diagnosis', 'التشخيص التقني'),
                feature('page', 'fa-file-lines', 'Contenu et structure de page', 'Page content and structure', 'محتوى وبنية الصفحة'),
                feature('backlinks', 'fa-link', 'Liens entrants, sortants et cassés', 'Inbound, outbound and broken links', 'الروابط الواردة والصادرة والمكسورة'),
                feature('plan', 'fa-list-check', 'Plan d’amélioration', 'Improvement plan', 'خطة التحسين')
            ]
        },
        {
            key: 'keywords', id: 'resultsKeywords', icon: 'fa-key',
            available: Array.isArray(keywords) && keywords.length > 0,
            title: isAr ? 'فرص الطلب' : isEn ? 'Demand Opportunities' : 'Opportunités de demande',
            subtitle: isAr ? 'الطلبات والمواضيع ذات القيمة' : isEn ? 'Valuable searches and topics' : 'Recherches et sujets à forte valeur',
            team: isAr ? 'فريق Daka لأبحاث النمو' : isEn ? 'Daka Growth Research Team' : 'Équipe Daka Recherche Croissance',
            features: [
                feature('summary', 'fa-gauge-high', 'Résumé exécutif · lecture 3 minutes', 'Executive summary · 3-minute read', 'الملخص التنفيذي · قراءة 3 دقائق'),
                feature('keywords', 'fa-key', 'Mots-clés, intentions et potentiel', 'Keywords, intent and potential', 'الكلمات والنية والإمكانات')
            ]
        }
    ];
}

function closeDakaExportStudio() {
    document.getElementById('export-studio-modal')?.classList.remove('active');
    document.body.classList.remove('modal-open');
}

window.dakaExportLogoDataUrl = window.dakaExportLogoDataUrl || '';

function handleDakaExportLogoUpload(event) {
    const file = event?.target?.files?.[0];
    const lang = STATE.currentLang || 'fr';
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 2_000_000) {
        event.target.value = '';
        toast.warning(isAr ? 'استخدم صورة PNG أو JPG أقل من 2 ميغابايت.' : isEn ? 'Use a PNG or JPG image under 2 MB.' : 'Utilisez une image PNG ou JPG de moins de 2 Mo.');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        window.dakaExportLogoDataUrl = String(reader.result || '');
        const preview = document.querySelector('#export-logo-preview img');
        if (preview && window.dakaExportLogoDataUrl) preview.src = window.dakaExportLogoDataUrl;
        toast.success(isAr ? 'تم تحديث شعار التقرير.' : isEn ? 'Report logo updated.' : 'Logo du rapport mis à jour.');
    };
    reader.readAsDataURL(file);
}

function resetDakaExportLogo() {
    window.dakaExportLogoDataUrl = '';
    const input = document.getElementById('export-logo-input');
    const preview = document.querySelector('#export-logo-preview img');
    if (input) input.value = '';
    if (preview) preview.src = DAKA_PUBLIC_LOGO_URL;
}

function setAllDakaExportSections(value) {
    document.querySelectorAll('#export-studio-sections input:not(:disabled)').forEach(input => {
        input.checked = !!value;
        input.closest('.export-pack-card')?.classList.toggle('selected', !!value);
    });
}

function openDakaExportStudio(preselect = null) {
    const modal = document.getElementById('export-studio-modal');
    const list = document.getElementById('export-studio-sections');
    if (!modal || !list) return;
    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';
    const modules = getDakaExportModules();
    list.innerHTML = modules.map(module => {
        const selected = module.available && (!preselect || preselect === module.key);
        const root = document.getElementById(module.id);
        const features = module.features.map(item => ({
            ...item,
            available: !!root?.querySelector(`[data-export-feature="${item.key}"]`)
        }));
        return `
        <article class="export-pack-card ${selected ? 'selected' : ''} ${module.available ? '' : 'unavailable'}" data-export-module="${module.key}">
            <label class="export-pack-main">
                <input type="checkbox" data-export-section value="${module.key}" ${selected ? 'checked' : ''} ${module.available ? '' : 'disabled'}>
                <span class="export-pack-icon"><i class="fas ${module.icon}"></i></span>
                <span class="export-pack-copy">
                    <strong>${module.title}</strong>
                    <small>${module.available ? module.subtitle : (isAr ? 'أطلق هذا التحليل أولاً' : isEn ? 'Run this analysis first' : 'Lancez d’abord cette analyse')}</small>
                </span>
                <i class="fas fa-circle-check export-pack-check"></i>
            </label>
            <div class="export-feature-list">
                ${features.map(item => `
                    <label class="export-feature-option ${item.available ? '' : 'unavailable'}">
                        <input type="checkbox" data-export-feature-choice="${item.key}" data-export-parent="${module.key}"
                            ${selected && item.available ? 'checked' : ''} ${item.available ? '' : 'disabled'}>
                        <i class="fas ${item.icon}"></i><span>${item.title}</span>
                    </label>`).join('')}
            </div>
        </article>`;
    }).join('');
    list.querySelectorAll('input[data-export-section]').forEach(input => {
        input.addEventListener('change', () => {
            const card = input.closest('.export-pack-card');
            card?.querySelectorAll('input[data-export-feature-choice]:not(:disabled)').forEach(child => { child.checked = input.checked; });
            card?.classList.toggle('selected', input.checked);
        });
    });
    list.querySelectorAll('input[data-export-feature-choice]').forEach(input => {
        input.addEventListener('change', () => {
            const card = input.closest('.export-pack-card');
            const parent = card?.querySelector('input[data-export-section]');
            const anySelected = !!card?.querySelector('input[data-export-feature-choice]:checked');
            if (parent) parent.checked = anySelected;
            card?.classList.toggle('selected', anySelected);
        });
    });
    document.getElementById('export-studio-title').textContent = isAr ? 'كوّن تقريرك التنفيذي' : isEn ? 'Build your decision report' : 'Composez votre dossier décisionnel';
    document.getElementById('export-studio-subtitle').textContent = isAr ? 'اختر الوحدات والشعار قبل إنشاء ملف DOCX قابل للتحرير.' : isEn ? 'Choose modules and logo before generating the editable DOCX.' : 'Choisissez les modules et le logo avant de générer le DOCX éditable.';
    document.getElementById('export-feature-help').textContent = isAr
        ? 'اختر الفصول المفيدة فقط. سيتم إنشاء ملف Word حديث بصيغة DOCX.'
        : isEn ? 'Select only useful chapters. A modern DOCX file will be generated.'
            : 'Cochez uniquement les chapitres utiles. Un vrai fichier Word DOCX sera généré.';
    document.getElementById('export-confirm-label').textContent = isAr ? 'تأكيد وتصدير DOCX' : isEn ? 'Confirm and export DOCX' : 'Valider et exporter DOCX';
    const logoTitle = document.getElementById('export-logo-title');
    const logoHelp = document.getElementById('export-logo-help');
    const logoReset = document.getElementById('export-logo-reset-label');
    if (logoTitle) logoTitle.textContent = isAr ? 'شعار التقرير' : isEn ? 'Report logo' : 'Logo du rapport';
    if (logoHelp) logoHelp.textContent = isAr ? 'ارفع PNG/JPG ليظهر في ملف Word. إذا لم ترفع شيئا سنستخدم شعار Daka.' : isEn ? 'Upload a PNG/JPG for the Word file. If empty, Daka uses its official logo.' : 'Ajoutez un PNG/JPG pour le fichier Word. Sans image, Daka utilise son logo officiel.';
    if (logoReset) logoReset.textContent = isAr ? 'شعار Daka' : isEn ? 'Daka logo' : 'Logo Daka';
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

async function confirmDakaExportStudio(format = 'word') {
    const sections = [...document.querySelectorAll('#export-studio-sections input[data-export-section]:checked')].map(input => input.value);
    if (!sections.length) {
        return toast.warning(STATE.currentLang === 'ar' ? 'اختر قسماً واحداً على الأقل.' : STATE.currentLang === 'en' ? 'Select at least one section.' : 'Sélectionnez au moins une section.');
    }
    const features = {};
    sections.forEach(section => {
        features[section] = [...document.querySelectorAll(`#export-studio-sections input[data-export-parent="${section}"]:checked`)]
            .map(input => input.dataset.exportFeatureChoice);
    });
    if (!Object.values(features).some(items => items.length)) {
        return toast.warning(STATE.currentLang === 'ar' ? 'اختر فصلاً واحداً على الأقل.' : STATE.currentLang === 'en' ? 'Select at least one chapter.' : 'Sélectionnez au moins un chapitre.');
    }
    const confirmButton = document.getElementById('export-studio-confirm');
    const confirmLabel = document.getElementById('export-confirm-label');
    const originalLabel = confirmLabel?.textContent || '';
    const isMobileExport = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 640;
    let downloadWindow = null;
    if (isMobileExport && STATE.currentLang !== 'ar') {
        try { downloadWindow = window.open('', '_blank'); } catch (_) {}
    }
    if (confirmButton) confirmButton.disabled = true;
    if (confirmLabel) {
        confirmLabel.textContent = STATE.currentLang === 'ar'
            ? 'جارٍ إعداد الملف...'
            : STATE.currentLang === 'en' ? 'Preparing download...' : 'Préparation du téléchargement...';
    }
    closeDakaExportStudio();
    try {
        if (typeof window.exportFullAnalysisToWord === 'function') {
            await window.exportFullAnalysisToWord({ prepared: true, sections, features, includeDetails: true });
        } else {
            await window.exportFullAnalysisToPDF({ prepared: true, sections, features, includeDetails: true, downloadWindow });
        }
    } finally {
        if (confirmButton) confirmButton.disabled = false;
        if (confirmLabel) confirmLabel.textContent = originalLabel;
    }
}

var dakaPdfLogoDataUrlCache = '';
const DAKA_PUBLIC_APP_URL = 'https://seo.mktnstrategix.com/seodaka4444';
const DAKA_PUBLIC_LOGO_URL = 'https://seobackend-f81n.onrender.com/assets/daka-report-logo.png';

function inferDakaReportOfferType() {
    const source = [
        STATE.lastInputs?.objective,
        STATE.lastInputs?.keyword,
        document.getElementById('compObjective')?.value,
        document.getElementById('funnelObjective')?.value,
        STATE.lastFunnelResults?.funnelSurgery?.userContext?.offerType,
        STATE.lastFunnelResults?.commerceExploration?.deduced?.offerType,
        STATE.lastFunnelResults?.productServiceAudit?.offerType,
        STATE.lastAnalysisResults?.competitorIntelligence?.businessArchetype
    ].filter(Boolean).join(' ').toLowerCase();
    const serviceScore = [
        /agence|agency|service|consulting|conseil|saas|software|logiciel|formation|marketing|ia|ai|b2b|prestation|accompagnement|audit|diagnostic|devis|rendez|livrable|révision|revision|support|coaching/.test(source),
        /portfolio|projet|client|campagne|automatisation|création|creation|design|développement|developpement/.test(source),
        !/panier|checkout|stock|livraison produit|shipping|delivery|retour colis|fiche produit/.test(source)
    ].filter(Boolean).length;
    const productScore = [
        /produit|product|e-?commerce|boutique|shop|store|retail|acheter|commande|panier|stock|livraison|delivery|retour|returns|cosmétique|serum|lampe|led|ordinateur|pc gamer|accessoire/.test(source),
        /prix|price/.test(source) && /acheter|commande|panier|stock|livraison|produit|product/.test(source)
    ].filter(Boolean).length;
    if (serviceScore >= 2 && serviceScore >= productScore) return 'service';
    if (productScore > serviceScore) return 'product';
    return 'unknown';
}

function sanitizeDakaBusinessVocabularyForContext(text) {
    let value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value || inferDakaReportOfferType() !== 'service') return value;
    value = value
        .replace(/prix,\s*stock,\s*livraison,\s*retours?\s*et\s*preuve forte/gi, 'méthode de prix, périmètre, délais, preuves client et prochaine action')
        .replace(/prix,\s*stock,\s*livraison,\s*retours?\s*et\s*preuves?/gi, 'méthode de prix, périmètre, délais et preuves client')
        .replace(/stock,\s*livraison,\s*retours?/gi, 'périmètre, délais et conditions de collaboration')
        .replace(/livraison\s*\/\s*retours?/gi, 'livrables / délais')
        .replace(/\bstock\b/gi, 'capacité disponible')
        .replace(/\blivraison\b/gi, 'délai de réalisation')
        .replace(/\bretours?\b/gi, 'révisions')
        .replace(/المخزون والتوصيل والإرجاع والأدلة/g, 'نطاق العمل والآجال وطريقة التسعير والأدلة')
        .replace(/السعر والمخزون والتوصيل والإرجاع والأدلة/g, 'طريقة التسعير ونطاق العمل والآجال والأدلة')
        .replace(/المخزون والتوصيل والضمان/g, 'نطاق العمل والآجال وشروط المتابعة')
        .replace(/التوصيل والإرجاع/g, 'الآجال والمراجعات')
        .replace(/المخزون/g, 'القدرة المتاحة')
        .replace(/التوصيل/g, 'مدة الإنجاز')
        .replace(/الإرجاع/g, 'المراجعات')
        .replace(/stock, delivery, returns?,? and proof/gi, 'scope, timeline, client proof, and next step')
        .replace(/price, stock, delivery, returns?/gi, 'pricing method, scope, timeline')
        .replace(/\bstock\b/gi, 'available capacity')
        .replace(/\bdelivery\b/gi, 'delivery timeline')
        .replace(/\breturns?\b/gi, 'revisions');
    return value;
}

function dakaPdfCleanList(values, limit = 5) {
    const result = [];
    const visit = function (value) {
        if (result.length >= limit || value === null || value === undefined) return;
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        const text = sanitizeDakaBusinessVocabularyForContext(executiveText(value)).replace(/\s+/g, ' ').trim();
        const normalized = text.toLowerCase();
        if (!text || isDakaInsufficientExportText(text)) return;
        if (result.some(function (item) { return item.toLowerCase() === normalized; })) return;
        result.push(text);
    };
    visit(values);
    return result.slice(0, limit);
}

function getDakaPdfReportUrl() {
    const candidates = [
        STATE.lastInputs?.techUrl,
        STATE.lastInputs?.funnelUrl,
        STATE.lastInputs?.url,
        STATE.lastTechnicalResults?.analyzedUrl,
        STATE.lastFunnelResults?.analyzedUrl,
        STATE.lastAnalysisResults?.analyzedUrl
    ];
    return String(candidates.find(Boolean) || '').trim();
}

function getDakaPdfModuleData(key) {
    if (key === 'competitors') return STATE.lastAnalysisResults || {};
    if (key === 'funnel') return STATE.lastFunnelResults || {};
    if (key === 'technical') return STATE.lastTechnicalResults || {};
    if (key === 'keywords') return STATE.lastKeywords || {};
    return {};
}

function getDakaPdfDecisionModel(selectedModules) {
    const lang = STATE.currentLang || 'fr';
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    const reportUrl = getDakaPdfReportUrl();
    let domain = reportUrl;
    try { domain = new URL(reportUrl).hostname.replace(/^www\./, ''); } catch (_) {}
    domain = domain || (isAr ? 'الموقع محل الدراسة' : isEn ? 'Analyzed site' : 'Site analysé');

    const moduleModels = selectedModules.map(function (module) {
        const data = getDakaPdfModuleData(module.key);
        return {
            key: module.key,
            title: module.title,
            team: module.team,
            data: data,
            summary: buildExecutiveSummaryModel(data, module.key)
        };
    });
    const scores = moduleModels
        .map(function (entry) { return entry.summary.score; })
        .filter(function (value) { return Number.isFinite(Number(value)); })
        .map(Number);
    const actions = [];
    const meaningfulMeta = function (value) {
        const text = executiveText(value).trim();
        return text && !/^(?:—|-|a confirmer|à confirmer|a estimer|à estimer|n\/a)$/i.test(text) ? text : '';
    };
    moduleModels.forEach(function (entry) {
        (entry.summary.actions || []).forEach(function (action) {
            const title = executiveText(action?.title || action);
            if (!title || isDakaInsufficientExportText(title)) return;
            if (actions.some(function (item) { return item.title.toLowerCase() === title.toLowerCase(); })) return;
            actions.push({
                title: title,
                impact: meaningfulMeta(action?.impact) || (isAr ? 'مرتفع' : isEn ? 'High' : 'Élevé'),
                effort: meaningfulMeta(action?.effort) || (isAr ? 'متوسط' : isEn ? 'Medium' : 'Moyen'),
                priority: executiveText(action?.priority) || String(actions.length + 1)
            });
        });
    });

    const opportunities = dakaPdfCleanList(moduleModels.map(function (entry) { return entry.summary.opportunities; }), 3);
    const weaknesses = dakaPdfCleanList(moduleModels.map(function (entry) { return entry.summary.weaknesses; }), 3);
    const rawQuickWins = dakaPdfCleanList(moduleModels.map(function (entry) { return entry.summary.quickWins; }), 6);
    const rawPlan30 = dakaPdfCleanList(moduleModels.map(function (entry) { return entry.summary.plan30; }), 7);
    const verdict = dakaPdfCleanList(moduleModels.map(function (entry) { return entry.summary.verdict; }), 1)[0]
        || actions[0]?.title
        || opportunities[0]
        || weaknesses[0]
        || '';
    actions.forEach(function (action, index) {
        action.justification = weaknesses[index % Math.max(weaknesses.length, 1)]
            || opportunities[index % Math.max(opportunities.length, 1)]
            || verdict;
    });
    const priorityDecision = actions[0]?.title || rawQuickWins[0] || verdict;
    const phaseKeys = new Set();
    const phaseKey = function (value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
    };
    if (priorityDecision) phaseKeys.add(phaseKey(priorityDecision));
    const uniquePhase = function (items, limit) {
        return (items || []).filter(function (item) {
            const key = phaseKey(item);
            if (!key || phaseKeys.has(key)) return false;
            phaseKeys.add(key);
            return true;
        }).slice(0, limit);
    };
    const quickWins = uniquePhase(rawQuickWins, 4);
    const plan30 = uniquePhase(rawPlan30, 5);
    const after30 = uniquePhase(dakaPdfCleanList(actions.slice(5).map(function (action) { return action.title; }), 5), 3);

    const titleCandidates = [
        STATE.lastTechnicalResults?.extraction?.title,
        STATE.lastTechnicalResults?.meta?.title,
        STATE.lastFunnelResults?.extraction?.title,
        STATE.lastFunnelResults?.meta?.title,
        STATE.lastAnalysisResults?.knowledgeGraph?.title
    ];
    const siteTitle = dakaPdfCleanList(titleCandidates, 1)[0] || domain;
    const selectedModuleKeys = new Set(selectedModules.map(function (module) { return module.key; }));
    const geo = String(
        (selectedModuleKeys.has('funnel') && (
            STATE.lastFunnelResults?.funnelSurgery?.userContext?.cityOrRegion ||
            STATE.lastFunnelResults?.userContext?.cityOrRegion
        )) ||
        (selectedModuleKeys.has('competitors') && (STATE.lastAnalysisResults?.geo || STATE.lastInputs?.country)) ||
        (selectedModuleKeys.has('keywords') && STATE.lastKeywords?.geoInput) ||
        ''
    ).trim();
    const objective = String(
        STATE.lastInputs?.objective ||
        document.getElementById('compObjective')?.value ||
        document.getElementById('funnelObjective')?.value ||
        STATE.lastInputs?.keyword ||
        STATE.lastKeywords?.seed ||
        ''
    ).trim();

    const competitors = getDakaPdfModuleData('competitors');
    const funnel = getDakaPdfModuleData('funnel');
    const keywords = getDakaPdfModuleData('keywords');
    const branches = [
        {
            key: 'market',
            title: isAr ? 'السوق' : isEn ? 'Market' : 'Marché',
            items: dakaPdfCleanList([
                competitors.competitorIntelligence?.marketVerdict?.whyTheyWin,
                competitors.competitorIntelligence?.marketVerdict?.marketPattern,
                moduleModels.find(function (m) { return m.key === 'competitors'; })?.summary.opportunities,
                opportunities
            ], 2)
        },
        {
            key: 'offer',
            title: isAr ? 'العرض' : isEn ? 'Offer' : 'Offre',
            items: dakaPdfCleanList([
                funnel.commerceExploration?.deduced?.offerType,
                funnel.productServiceAudit?.uniqueValueProposition,
                funnel.commerceExploration?.recommended?.pricingRationale,
                actions.filter(function (a) { return /offre|offer|prix|price|produit|product|عرض|سعر/i.test(a.title); }).map(function (a) { return a.title; })
            ], 2)
        },
        {
            key: 'trust',
            title: isAr ? 'الثقة' : isEn ? 'Trust' : 'Confiance',
            items: dakaPdfCleanList([
                funnel.commerceExploration?.observed?.trustSignals,
                funnel.commerceExploration?.recommended?.nextActions,
                weaknesses.filter(function (item) { return /preuve|confiance|garantie|avis|trust|proof|review|ضمان|ثقة/i.test(item); })
            ], 2)
        },
        {
            key: 'acquisition',
            title: isAr ? 'الاكتساب' : isEn ? 'Acquisition' : 'Acquisition',
            items: dakaPdfCleanList([
                keywords.clusters,
                keywords.paaQuestions,
                actions.filter(function (a) { return /acquisition|visibil|demande|keyword|contenu|content|trafic|طلب|محتوى/i.test(a.title); }).map(function (a) { return a.title; })
            ], 2)
        },
        {
            key: 'conversion',
            title: isAr ? 'التحويل' : isEn ? 'Conversion' : 'Conversion',
            items: dakaPdfCleanList([
                funnel.auditQuickWins,
                funnel.quickWins,
                actions.filter(function (a) { return /conversion|cta|parcours|funnel|friction|checkout|تحويل/i.test(a.title); }).map(function (a) { return a.title; })
            ], 2)
        }
    ].filter(function (branch) { return branch.items.length; });

    return {
        lang: lang,
        isAr: isAr,
        isEn: isEn,
        reportUrl: reportUrl,
        domain: domain,
        siteTitle: siteTitle,
        geo: geo,
        objective: objective,
        date: new Date().toLocaleDateString(isAr ? 'ar-MA' : isEn ? 'en-GB' : 'fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric'
        }),
        score: scores.length ? Math.round(scores.reduce(function (sum, value) { return sum + value; }, 0) / scores.length) : null,
        verdict: verdict,
        opportunities: opportunities,
        weaknesses: weaknesses,
        priorityDecision: priorityDecision,
        actions: actions.slice(0, 7),
        quickWins: quickWins,
        plan30: plan30,
        after30: after30,
        branches: branches,
        modules: moduleModels.map(function (entry) {
            return { key: entry.key, title: entry.title, team: entry.team };
        })
    };
}

async function loadDakaPdfLogoDataUrl() {
    if (dakaPdfLogoDataUrlCache) return dakaPdfLogoDataUrlCache;
    try {
        let response = await fetch(DAKA_PUBLIC_LOGO_URL, { cache: 'force-cache' })
            .catch(function () { return null; });
        if (!response || !response.ok) {
            response = await fetch('assets/daka-report-logo.png', { cache: 'force-cache' }).catch(function () { return null; });
        }
        if (!response || !response.ok) return '';
        const blob = await response.blob();
        dakaPdfLogoDataUrlCache = await new Promise(function (resolve) {
            const reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { resolve(''); };
            reader.readAsDataURL(blob);
        });
    } catch (_) {
        dakaPdfLogoDataUrlCache = '';
    }
    return dakaPdfLogoDataUrlCache;
}

function dakaPdfDrawPageFrame(pdf, model, pageW, pageH, margin, pageLabel) {
    pdf.setFillColor(248, 250, 252);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageW, 4, 'F');
    pdf.setFillColor(202, 138, 4);
    pdf.rect(0, 4, pageW, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(3, 105, 161);
    pdf.text(model.isAr ? 'DAKA · تقرير قرار' : model.isEn ? 'DAKA · DECISION REPORT' : 'DAKA · RAPPORT DÉCISIONNEL', margin, 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(String(model.domain || '').substring(0, 55), pageW - margin, 11, { align: 'right' });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageH - 11, pageW - margin, pageH - 11);
    pdf.setFontSize(6.2);
    pdf.setTextColor(100, 116, 139);
    pdf.text(pageLabel || '', margin, pageH - 6);
    pdf.text(
        (model.isAr ? 'Made by Daka · ' : 'Made by Daka · ') + String(pdf.internal.getCurrentPageInfo().pageNumber),
        pageW - margin, pageH - 6, { align: 'right' }
    );
}

function dakaPdfDrawWrappedText(pdf, text, x, y, width, options = {}) {
    let safeText = String(text || '').replace(/\s+/g, ' ').trim();
    if (!safeText) return y;
    if (STATE.currentLang === 'ar' && typeof pdf.processArabic === 'function' && /[\u0600-\u06ff]/.test(safeText)) {
        try { safeText = pdf.processArabic(safeText); } catch (_) {}
    }
    const maxLines = options.maxLines || 4;
    let lines = pdf.splitTextToSize(safeText, width);
    if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = String(lines[maxLines - 1]).replace(/[.,;:\s]+$/, '') + '…';
    }
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
    pdf.setFontSize(options.size || 8);
    pdf.setTextColor.apply(pdf, options.color || [51, 65, 85]);
    pdf.text(lines, x, y, options.align ? { align: options.align } : undefined);
    return y + lines.length * (options.lineHeight || 4.3);
}

function dakaPdfDrawListCard(pdf, title, items, x, y, width, height, accent) {
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(x, y, width, height, 3, 3, 'FD');
    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.roundedRect(x, y, 3, height, 2, 2, 'F');
    dakaPdfDrawWrappedText(pdf, title, x + 7, y + 9, width - 12, {
        size: 9, bold: true, color: [15, 23, 42], maxLines: 1
    });
    let cursor = y + 17;
    (items || []).slice(0, 3).forEach(function (item) {
        pdf.setFillColor(accent[0], accent[1], accent[2]);
        pdf.circle(x + 8, cursor - 1.2, 0.8, 'F');
        cursor = dakaPdfDrawWrappedText(pdf, item, x + 12, cursor, width - 18, {
            size: 7.2, color: [51, 65, 85], maxLines: 2, lineHeight: 3.8
        }) + 2;
    });
}

function drawDakaPdfExecutivePage(pdf, model, validSections, logoDataUrl, pageW, pageH, margin) {
    dakaPdfDrawPageFrame(pdf, model, pageW, pageH, margin, model.isAr ? 'الملخص التنفيذي' : model.isEn ? 'Executive brief' : 'Fiche sommaire exécutive');
    if (logoDataUrl) {
        try { pdf.addImage(logoDataUrl, logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG', margin, 17, 25, 25, undefined, 'FAST'); } catch (_) {}
    } else {
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, 17, 25, 25, 5, 5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text('DAKA', margin + 12.5, 32, { align: 'center' });
    }
    if (typeof pdf.link === 'function') {
        try { pdf.link(margin, 17, 25, 25, { url: DAKA_PUBLIC_APP_URL }); } catch (_) {}
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42);
    pdf.text(model.isAr ? 'ملف القرار التنفيذي' : model.isEn ? 'Executive Decision Brief' : 'Fiche sommaire décisionnelle', margin + 32, 25);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.setTextColor(71, 85, 105);
    pdf.text(
        model.isAr ? 'تقرير أعدته فرق Daka المتخصصة' : model.isEn ? 'Report prepared by Daka specialist teams' : 'Rapport préparé par les équipes Daka',
        margin + 32, 31
    );
    pdf.setFontSize(6.3);
    pdf.setTextColor(3, 105, 161);
    pdf.textWithLink
        ? pdf.textWithLink(DAKA_PUBLIC_APP_URL.replace(/^https?:\/\//, ''), margin + 32, 36.3, { url: DAKA_PUBLIC_APP_URL })
        : pdf.text(DAKA_PUBLIC_APP_URL.replace(/^https?:\/\//, ''), margin + 32, 36.3);
    pdf.setFontSize(6.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(model.date, margin + 32, 41);

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(203, 213, 225);
    pdf.roundedRect(margin, 49, pageW - margin * 2, 30, 3, 3, 'FD');
    pdf.setFillColor(3, 105, 161);
    pdf.roundedRect(margin, 49, 4, 30, 2, 2, 'F');
    dakaPdfDrawWrappedText(pdf, model.siteTitle, margin + 9, 59, 112, {
        size: 11, bold: true, color: [15, 23, 42], maxLines: 2, lineHeight: 5
    });
    dakaPdfDrawWrappedText(pdf, model.reportUrl || model.domain, margin + 9, 71, 112, {
        size: 6.5, color: [3, 105, 161], maxLines: 1
    });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6);
    pdf.setTextColor(100, 116, 139);
    pdf.text(model.isAr ? 'السوق / اللغة' : model.isEn ? 'MARKET / LANGUAGE' : 'MARCHÉ / LANGUE', pageW - margin - 48, 58);
    dakaPdfDrawWrappedText(pdf, [model.geo, model.lang.toUpperCase()].filter(Boolean).join(' · '), pageW - margin - 48, 66, 43, {
        size: 8, bold: true, color: [15, 23, 42], maxLines: 2
    });

    pdf.setFillColor(15, 23, 42);
    pdf.roundedRect(margin, 86, pageW - margin * 2, 37, 4, 4, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(125, 211, 252);
    pdf.text(model.isAr ? 'الخلاصة العامة' : model.isEn ? 'GLOBAL VERDICT' : 'VERDICT GLOBAL', margin + 8, 96);
    dakaPdfDrawWrappedText(pdf, model.verdict || model.priorityDecision, margin + 8, 105, pageW - margin * 2 - 48, {
        size: 10, bold: true, color: [255, 255, 255], maxLines: 3, lineHeight: 5
    });
    if (model.score !== null) {
        pdf.setDrawColor(202, 138, 4);
        pdf.setLineWidth(1);
        pdf.circle(pageW - margin - 22, 104, 13, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.setTextColor(255, 255, 255);
        pdf.text(String(model.score), pageW - margin - 22, 104, { align: 'center' });
        pdf.setFontSize(5.5);
        pdf.setTextColor(253, 230, 138);
        pdf.text('/100', pageW - margin - 22, 110, { align: 'center' });
    }

    const gap = 5;
    const cardW = (pageW - margin * 2 - gap) / 2;
    if (model.opportunities.length && model.weaknesses.length) {
        dakaPdfDrawListCard(
            pdf,
            model.isAr ? 'أهم الفرص' : model.isEn ? 'Top opportunities' : 'Top 3 opportunités',
            model.opportunities,
            margin, 130, cardW, 55, [5, 150, 105]
        );
        dakaPdfDrawListCard(
            pdf,
            model.isAr ? 'نقاط الخطر' : model.isEn ? 'Critical weaknesses' : 'Faiblesses critiques',
            model.weaknesses,
            margin + cardW + gap, 130, cardW, 55, [220, 38, 38]
        );
    } else if (model.opportunities.length || model.weaknesses.length) {
        const hasOpportunities = model.opportunities.length > 0;
        dakaPdfDrawListCard(
            pdf,
            hasOpportunities ? (model.isAr ? 'أهم الفرص' : model.isEn ? 'Top opportunities' : 'Top opportunités') : (model.isAr ? 'نقاط الخطر' : model.isEn ? 'Critical weaknesses' : 'Faiblesses critiques'),
            hasOpportunities ? model.opportunities : model.weaknesses,
            margin, 130, pageW - margin * 2, 55, hasOpportunities ? [5, 150, 105] : [220, 38, 38]
        );
    }

    pdf.setFillColor(255, 251, 235);
    pdf.setDrawColor(253, 230, 138);
    pdf.roundedRect(margin, 192, pageW - margin * 2, 34, 3, 3, 'FD');
    pdf.setFillColor(202, 138, 4);
    pdf.rect(margin, 192, 4, 34, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(146, 64, 14);
    pdf.text(model.isAr ? 'القرار ذو الأولوية' : model.isEn ? 'PRIORITY DECISION' : 'DÉCISION PRIORITAIRE', margin + 9, 202);
    dakaPdfDrawWrappedText(pdf, model.priorityDecision, margin + 9, 211, pageW - margin * 2 - 18, {
        size: 9.2, bold: true, color: [15, 23, 42], maxLines: 3, lineHeight: 4.8
    });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(model.isAr ? 'الفصول المدرجة في التقرير' : model.isEn ? 'INCLUDED EXPERTISES' : 'EXPERTISES INCLUSES', margin, 238);
    const links = [];
    validSections.slice(0, 4).forEach(function (section, index) {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = margin + col * (cardW + gap);
        const y = 245 + row * 16;
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(x, y, cardW, 12, 2, 2, 'FD');
        pdf.setFillColor(3, 105, 161);
        pdf.circle(x + 6, y + 6, 1.5, 'F');
        dakaPdfDrawWrappedText(pdf, section.label, x + 11, y + 7.5, cardW - 15, {
            size: 7, bold: true, color: [15, 23, 42], maxLines: 1
        });
        links.push({ x: x, y: y, w: cardW, h: 12 });
    });
    return links;
}

function drawDakaPdfRoadmapPage(pdf, model, pageW, pageH, margin) {
    const phases = [
        {
            label: model.isAr ? 'الآن' : model.isEn ? 'Now' : 'Maintenant',
            items: dakaPdfCleanList([model.priorityDecision], 1),
            accent: [202, 138, 4]
        },
        {
            label: model.isAr ? '7 أيام' : model.isEn ? '7 days' : '7 jours',
            items: model.quickWins.slice(0, 2),
            accent: [5, 150, 105]
        },
        {
            label: model.isAr ? '30 يوما' : model.isEn ? '30 days' : '30 jours',
            items: model.plan30.slice(0, 2),
            accent: [3, 105, 161]
        },
        {
            label: model.isAr ? 'بعد 30 يوما' : model.isEn ? 'After 30 days' : 'Après 30 jours',
            items: model.after30.slice(0, 2),
            accent: [71, 85, 105]
        }
    ].filter(function (phase) { return phase.items.length; });
    if (!phases.length) return false;
    pdf.addPage();
    dakaPdfDrawPageFrame(pdf, model, pageW, pageH, margin, model.isAr ? 'خطة العمل' : model.isEn ? 'Action plan and roadmap' : 'Plan d’action et roadmap');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42);
    pdf.text(model.isAr ? 'خطة العمل والجدول الزمني' : model.isEn ? 'Action plan and roadmap' : 'Plan d’action et roadmap', margin, 25);
    dakaPdfDrawWrappedText(
        pdf,
        model.isAr ? 'خطة مرتبة مبنية فقط على الملاحظات القابلة للاستعمال.' : model.isEn ? 'A sequenced plan built only from usable findings.' : 'Un plan séquencé construit uniquement à partir des constats exploitables.',
        margin, 34, pageW - margin * 2, { size: 8, color: [71, 85, 105], maxLines: 2 }
    );
    const startY = 52;
    const phaseH = Math.min(68, (pageH - startY - 22) / phases.length - 5);
    const lineX = margin + 10;
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(1);
    pdf.line(lineX, startY + 4, lineX, startY + phases.length * (phaseH + 5) - 8);
    phases.forEach(function (phase, index) {
        const y = startY + index * (phaseH + 5);
        pdf.setFillColor(phase.accent[0], phase.accent[1], phase.accent[2]);
        pdf.circle(lineX, y + 9, 3, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin + 20, y, pageW - margin * 2 - 20, phaseH, 3, 3, 'FD');
        pdf.setFillColor(phase.accent[0], phase.accent[1], phase.accent[2]);
        pdf.roundedRect(margin + 20, y, 27, 10, 2, 2, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(phase.label.toUpperCase(), margin + 33.5, y + 6.8, { align: 'center' });
        let cursor = y + 18;
        phase.items.forEach(function (item, itemIndex) {
            const matching = model.actions.find(function (action) { return action.title === item; }) || {
                impact: model.isAr ? 'قابل للتأكيد' : model.isEn ? 'To confirm' : 'À confirmer',
                effort: model.isAr ? 'قابل للتقدير' : model.isEn ? 'To estimate' : 'À estimer',
                priority: phase.label,
                justification: model.weaknesses[itemIndex] || model.opportunities[itemIndex] || model.verdict
            };
            cursor = dakaPdfDrawWrappedText(pdf, (itemIndex + 1) + '. ' + item, margin + 27, cursor, pageW - margin * 2 - 48, {
                size: 7.3, bold: true, color: [15, 23, 42], maxLines: 3, lineHeight: 3.8
            });
            const meta = (model.isAr ? 'الأثر' : model.isEn ? 'Impact' : 'Impact') + ': ' + matching.impact + ' · ' +
                (model.isAr ? 'الجهد' : model.isEn ? 'Effort' : 'Effort') + ': ' + matching.effort + ' · ' +
                (model.isAr ? 'الأولوية' : model.isEn ? 'Priority' : 'Priorité') + ': ' + matching.priority;
            cursor = dakaPdfDrawWrappedText(pdf, meta, margin + 31, cursor, pageW - margin * 2 - 39, {
                size: 6.1, color: [100, 116, 139], maxLines: 1, lineHeight: 3.4
            }) + 2;
            if (matching?.justification) {
                cursor = dakaPdfDrawWrappedText(
                    pdf,
                    (model.isAr ? 'السبب: ' : model.isEn ? 'Why: ' : 'Pourquoi : ') + matching.justification,
                    margin + 31,
                    cursor,
                    pageW - margin * 2 - 39,
                    { size: 5.8, color: [71, 85, 105], maxLines: 1, lineHeight: 3.2 }
                ) + 1;
            }
        });
    });
    return true;
}

function drawDakaPdfMindMapPage(pdf, model, pageW, pageH, margin) {
    if (!model.branches.length) return false;
    pdf.addPage();
    dakaPdfDrawPageFrame(pdf, model, pageW, pageH, margin, model.isAr ? 'الخريطة الذهنية' : model.isEn ? 'Strategic mind map' : 'Carte mentale stratégique');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42);
    pdf.text(model.isAr ? 'خريطة القرار الاستراتيجي' : model.isEn ? 'Strategic decision tree' : 'Carte mentale stratégique', margin, 25);
    dakaPdfDrawWrappedText(
        pdf,
        model.isAr ? 'هدف مركزي واحد وخمسة محاور قرار.' : model.isEn ? 'One objective, five decision branches.' : 'Un objectif central, cinq branches de décision.',
        margin, 34, pageW - margin * 2, { size: 8, color: [71, 85, 105], maxLines: 1 }
    );
    const rootX = margin;
    const rootY = 125;
    const rootW = 43;
    const rootH = 48;
    pdf.setFillColor(15, 23, 42);
    pdf.roundedRect(rootX, rootY, rootW, rootH, 4, 4, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text(pdf.splitTextToSize(model.domain, rootW - 8), rootX + rootW / 2, rootY + 15, { align: 'center' });
    if (model.objective) {
        dakaPdfDrawWrappedText(pdf, model.objective, rootX + rootW / 2, rootY + 31, rootW - 8, {
            size: 5.8, color: [203, 213, 225], align: 'center', maxLines: 3, lineHeight: 3
        });
    }
    const branchX = margin + 57;
    const branchW = pageW - margin - branchX;
    const branchH = 38;
    const gap = 8;
    const totalH = model.branches.length * branchH + (model.branches.length - 1) * gap;
    const firstY = Math.max(45, (pageH - totalH) / 2);
    const accents = [[3,105,161], [202,138,4], [5,150,105], [124,58,237], [220,38,38]];
    model.branches.slice(0, 5).forEach(function (branch, index) {
        const y = firstY + index * (branchH + gap);
        const accent = accents[index] || [3,105,161];
        pdf.setDrawColor(148, 163, 184);
        pdf.setLineWidth(0.45);
        pdf.line(rootX + rootW, rootY + rootH / 2, branchX - 7, y + branchH / 2);
        pdf.line(branchX - 7, y + branchH / 2, branchX, y + branchH / 2);
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(branchX, y, branchW, branchH, 3, 3, 'FD');
        pdf.setFillColor(accent[0], accent[1], accent[2]);
        pdf.rect(branchX, y, 4, branchH, 'F');
        dakaPdfDrawWrappedText(pdf, branch.title, branchX + 9, y + 10, branchW - 14, {
            size: 8.5, bold: true, color: [15, 23, 42], maxLines: 1
        });
        let cursor = y + 19;
        branch.items.slice(0, 2).forEach(function (item) {
            pdf.setFillColor(accent[0], accent[1], accent[2]);
            pdf.circle(branchX + 10, cursor - 1, 0.7, 'F');
            cursor = dakaPdfDrawWrappedText(pdf, item, branchX + 14, cursor, branchW - 19, {
                size: 6.6, color: [51, 65, 85], maxLines: 2, lineHeight: 3.4
            }) + 1;
        });
    });
    return true;
}

function buildDakaArabicDecisionPages(model) {
    const safe = typeof escapeHtml === 'function' ? escapeHtml : String;
    const list = function (items) {
        return (items || []).map(function (item) { return '<li>' + safe(item) + '</li>'; }).join('');
    };
    const phases = [
        { title: 'الآن', items: dakaPdfCleanList([model.priorityDecision], 1) },
        { title: 'خلال 7 أيام', items: model.quickWins.slice(0, 3) },
        { title: 'خلال 30 يوماً', items: model.plan30.slice(0, 4) },
        { title: 'بعد 30 يوماً', items: model.after30.slice(0, 3) }
    ].filter(function (phase) { return phase.items.length; });
    const insightCards = [
        model.opportunities.length ? `<article><h2>أهم الفرص</h2><ul>${list(model.opportunities)}</ul></article>` : '',
        model.weaknesses.length ? `<article><h2>نقاط الضعف الحرجة</h2><ul>${list(model.weaknesses)}</ul></article>` : ''
    ].filter(Boolean).join('');
    return `
        <section class="daka-ar-decision-page">
            <header class="daka-ar-report-brand">
                <img src="assets/daka-loader-logo.jpg" alt="Daka">
                <div><strong>الملف التنفيذي لاتخاذ القرار</strong><span>تقرير أعدته فرق Daka المتخصصة</span></div>
            </header>
            <div class="daka-ar-site-card"><strong>${safe(model.siteTitle)}</strong><span>${safe(model.reportUrl || model.domain)}</span><small>${safe([model.geo, model.date].filter(Boolean).join(' · '))}</small></div>
            <div class="daka-ar-verdict"><small>الخلاصة العامة</small><strong>${safe(model.verdict || model.priorityDecision)}</strong>${model.score !== null ? `<b>${model.score}/100</b>` : ''}</div>
            ${insightCards ? `<div class="daka-ar-two-columns">${insightCards}</div>` : ''}
            ${model.priorityDecision ? `<article class="daka-ar-priority"><h2>القرار ذو الأولوية</h2><p>${safe(model.priorityDecision)}</p></article>` : ''}
            <div class="daka-ar-modules">${model.modules.map(function (module) { return '<span>' + safe(module.title) + '</span>'; }).join('')}</div>
        </section>
        ${phases.length ? `<section class="daka-ar-decision-page"><h1>خطة العمل والجدول الزمني</h1><div class="daka-ar-roadmap">${phases.map(function (phase) { return `<article><h2>${safe(phase.title)}</h2><ul>${list(phase.items)}</ul></article>`; }).join('')}</div></section>` : ''}
        ${model.branches.length ? `<section class="daka-ar-decision-page"><h1>الخريطة الذهنية الاستراتيجية</h1><div class="daka-ar-tree"><div class="daka-ar-tree-root">${safe(model.domain)}<small>${safe(model.objective)}</small></div><div class="daka-ar-tree-branches">${model.branches.map(function (branch) { return `<article><h2>${safe(branch.title)}</h2><ul>${list(branch.items)}</ul></article>`; }).join('')}</div></div></section>` : ''}
    `;
}


window.exportFullAnalysisToPDF = async function (exportOptions = null) {
    if (typeof window.exportFullAnalysisToWord === 'function') {
        return window.exportFullAnalysisToWord(exportOptions);
    }
    const isAr = STATE.currentLang === 'ar';

    // ══════════════════════════════════════════════════════════════
    // GARDE-FOUS
    // ══════════════════════════════════════════════════════════════
    const hasSeo    = !!STATE.lastTechnicalResults;
    const hasComp   = !!STATE.lastAnalysisResults;
    const hasFunnel = !!STATE.lastFunnelResults;
    const exportKeywords = Array.isArray(STATE.lastKeywords)
        ? STATE.lastKeywords
        : (STATE.lastKeywords?.keywords || []);
    const hasKw     = Array.isArray(exportKeywords) && exportKeywords.length > 0;

    if (!hasSeo && !hasComp && !hasFunnel && !hasKw) {
        return toast.warning(
            STATE.currentLang === 'ar'
                ? 'أطلق تحليلاً واحداً على الأقل قبل التصدير.'
                : STATE.currentLang === 'en'
                    ? 'Run at least one analysis before exporting.'
                    : 'Lancez au moins une analyse avant d\'exporter.'
        );
    }

    if (!exportOptions?.prepared) {
        openDakaExportStudio();
        return;
    }
    const selectedSectionKeys = new Set(exportOptions.sections || []);
    const includeDetails = exportOptions.includeDetails !== false;
    const selectedFeatures = exportOptions.features || {};
    const selectedModules = getDakaExportModules().filter(module => module.available && selectedSectionKeys.has(module.key));
    const pdfDecisionModel = getDakaPdfDecisionModel(selectedModules);

    if (STATE.isExporting) return;
    STATE.isExporting = true;

    const btn      = document.getElementById('btn-export-global');
    const origHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> '
            + (STATE.currentLang === 'ar' ? 'جارٍ التصدير...' : STATE.currentLang === 'en' ? 'Exporting...' : 'Export en cours...');
        btn.disabled = true;
    }

    // ══════════════════════════════════════════════════════════════
    // CAS ARABE — window.print() dans popup (PATCH THEME DARK)
    // ══════════════════════════════════════════════════════════════
    if (false && STATE.currentLang === 'ar') {
        try {
            var arSections = selectedModules
                .map(function (module) {
                    var el = document.getElementById(module.id);
                    return el && getExportableReportText(el).length > 40
                        ? { el: el, module: module }
                        : null;
                })
                .filter(Boolean);

            if (!arSections.length) {
                toast.warning('التقرير غير جاهز للتصدير بعد.');
                return;
            }

            var arContent = arSections
                .map(function (entry) {
                    return cloneReportHtmlForExport(entry.el, {
                        includeDetails: includeDetails,
                        featureKeys: selectedFeatures[entry.module.key] || []
                    });
                })
                .join('<hr style="margin:30px 0;border:none;border-top:2px dashed rgba(255,255,255,0.1);">');
            var arDecisionPages = buildDakaArabicDecisionPages(pdfDecisionModel);

            var pw = window.open('', '_blank');
            if (!pw) {
                toast.error('Popup bloqué — autorisez les popups pour ce site.');
                STATE.isExporting = false;
                if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
                return;
            }

            var arDate = new Date().toLocaleDateString('ar-MA', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            // Mise en page d'impression stable et lisible.
            var cssRules = [
                '* { font-family: Cairo, Arial, sans-serif !important; direction: rtl; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',
                'body { background-color:#ffffff !important; color:#0f172a !important; padding:15px !important; font-size:12px; line-height:1.75; margin:0; }',
                'h1,h2,h3,h4,h5 { color:#0f172a !important; font-weight:800; line-height:1.35 !important; }',
                'button, .btn, .btn-gen, .no-print, .nav-tabs, .header, .footer,',
                '.export-bubble-wrapper, #btn-export-global, .loading-state,',
                '.loading-orb, .toast-container, iframe,', /* ⚠️ Le mot "canvas" a été retiré d'ici pour afficher le Radar */
                '.copy-badge, .btn-copy-mini, .btn-cosmic, .btn-cyber, .btn-system,',
                '.generator-grid, #tech-gen-output, .kw-filter-btn, #kwFilterBar,',
                '[data-gen-type], .btn-export-pdf, .expert-dock, .report-feature-nav { display:none !important; }',
                '#magicPromptPlaceholder button, #magicPromptPlaceholder .btn-copy-mini, #magicPromptPlaceholder .copy-badge { display:none !important; }',
                '#magicPromptPlaceholder { display:block !important; margin:22px 0 !important; page-break-inside:avoid; }',
                '#magicPromptRawText, #rawPromptText { display:block !important; max-height:none !important; overflow:visible !important; white-space:pre-wrap !important; background:#f8fafc !important; color:#0f172a !important; border:1px solid #cbd5e1 !important; border-radius:8px !important; padding:14px !important; font-family:"Courier New", monospace !important; font-size:9.4px !important; line-height:1.5 !important; direction:ltr !important; text-align:left !important; }',
                '.report-section { border:0 !important; padding:0 !important; margin:0 0 24px !important; background:#fff !important; }',
                '.report-section-head { padding:13px 16px !important; margin-bottom:13px !important; border:0 !important; border-right:5px solid #0369a1 !important; border-radius:5px !important; background:#f1f5f9 !important; }',
                '.report-section-body { display:block !important; padding:0 !important; }',
                '.result-card, .card, .magic-box, .diff-box, .executive-block, .executive-action, .decision-proof-panel {',
                '  border:1px solid #dbe4ef !important; border-right:4px solid #0369a1 !important; border-radius:8px !important;',
                '  padding:15px 17px !important; margin-bottom:16px !important;',
                '  background-color:#ffffff !important; color:#0f172a !important;',
                '  page-break-inside:avoid; box-shadow:none !important; width:100% !important; min-width:0 !important; max-width:100% !important; overflow:visible !important; }',
                'span, div, p, small { color:inherit !important; background-color:transparent !important; }',
                'p, li, td, th, span, strong { overflow-wrap:break-word !important; word-break:normal !important; white-space:normal !important; }',
                'table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; }',
                'th { background-color:#f1f5f9 !important; color:#334155 !important;',
                '     padding:8px; border:1px solid #dbe4ef !important; text-align:right; }',
                'td { padding:8px; border:1px solid #dbe4ef !important; color:#0f172a !important; background-color:#ffffff !important; }',
                '.print-header { text-align:center; padding:20px; border-top:5px solid #06b6d4; margin-bottom:30px; background-color:#071426 !important; color:#ffffff !important; border-radius:10px; }',
                '.print-header * { color:#ffffff !important; }',
                'a { color:#0369a1 !important; text-decoration:underline; }',
                'div[style*="display:flex"] { flex-wrap:wrap !important; }',
                'div[style*="display:grid"] { grid-template-columns:1fr !important; }',
                'canvas { max-width: 100% !important; height: auto !important; margin: 0 auto !important; display: block !important; }',
                'body::before { content:"Made by Daka"; position:fixed; inset:45% auto auto 18%; transform:rotate(-28deg); font-size:52px; font-weight:900; color:rgba(15,23,42,.045); pointer-events:none; z-index:9999; }',
                '.daka-ar-decision-page { min-height:267mm; padding:14mm; page-break-after:always; background:#f8fafc !important; color:#0f172a !important; }',
                '.daka-ar-decision-page h1 { font-size:24px; margin:0 0 22px; padding-bottom:12px; border-bottom:3px solid #0369a1; }',
                '.daka-ar-report-brand { display:flex; align-items:center; gap:16px; padding-bottom:18px; border-bottom:1px solid #cbd5e1; }',
                '.daka-ar-report-brand img { width:64px; height:64px; object-fit:contain; border-radius:14px; }',
                '.daka-ar-report-brand strong,.daka-ar-report-brand span { display:block; }',
                '.daka-ar-report-brand strong { font-size:24px; } .daka-ar-report-brand span { color:#475569 !important; margin-top:5px; }',
                '.daka-ar-site-card,.daka-ar-priority { margin-top:20px; padding:18px; border:1px solid #cbd5e1; border-right:5px solid #0369a1; border-radius:10px; background:#fff !important; }',
                '.daka-ar-site-card strong,.daka-ar-site-card span,.daka-ar-site-card small { display:block; margin-bottom:5px; }',
                '.daka-ar-site-card strong { font-size:19px; } .daka-ar-site-card span { color:#0369a1 !important; }',
                '.daka-ar-verdict { position:relative; margin-top:20px; padding:22px; border-radius:12px; background:#0f172a !important; color:#fff !important; }',
                '.daka-ar-verdict * { color:#fff !important; display:block; } .daka-ar-verdict small { color:#7dd3fc !important; }',
                '.daka-ar-verdict strong { font-size:19px; margin-top:10px; padding-left:65px; } .daka-ar-verdict b { position:absolute; left:20px; top:27px; color:#fde68a !important; font-size:18px; }',
                '.daka-ar-two-columns { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:18px; }',
                '.daka-ar-two-columns article,.daka-ar-roadmap article,.daka-ar-tree-branches article { padding:16px; border:1px solid #dbe4ef; border-radius:9px; background:#fff !important; page-break-inside:avoid; }',
                '.daka-ar-two-columns article:first-child { border-right:5px solid #059669; } .daka-ar-two-columns article:last-child { border-right:5px solid #dc2626; }',
                '.daka-ar-priority { border-color:#fde68a; border-right-color:#ca8a04; background:#fffbeb !important; }',
                '.daka-ar-modules { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; } .daka-ar-modules span { padding:7px 10px; border:1px solid #cbd5e1; border-radius:7px; background:#fff !important; }',
                '.daka-ar-roadmap { display:grid; gap:14px; } .daka-ar-roadmap article { border-right:5px solid #0369a1; }',
                '.daka-ar-tree { display:grid; grid-template-columns:150px 1fr; align-items:center; gap:24px; }',
                '.daka-ar-tree-root { padding:24px 14px; border-radius:12px; background:#0f172a !important; color:#fff !important; text-align:center; font-weight:800; }',
                '.daka-ar-tree-root small { display:block; margin-top:8px; color:#cbd5e1 !important; font-weight:400; }',
                '.daka-ar-tree-branches { display:grid; gap:10px; } .daka-ar-tree-branches article { border-right:5px solid #0369a1; }',
                '@page { margin:10mm; size:A4; }',
                '@media print {',
                '  body { background-color:#ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',
                '}'
            ].join('\n');

            var htmlParts = [
                '<!DOCTYPE html>',
                '<html dir="rtl" lang="ar">',
                '<head>',
                '<meta charset="UTF-8">',
                '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
                '<title>Daka Market Intelligence Spyer \u2014 \u062a\u0642\u0631\u064a\u0631 \u0634\u0627\u0645\u0644<\/title>',
                // 🔥 CHANGEMENT 2 : Réparation de la balise <link> de la police (erreur de syntaxe)

                '<style>', cssRules, '<\/style>',
                '<\/head>',
                '<body>',
                arDecisionPages,
                '<div class="print-header">',
                '  <h1 style="font-size:1.6rem;margin:0;color:#c4b5fd;">DAKA — تقرير استخبارات الأعمال<\/h1>',
                '  <p style="color:#94a3b8;margin:5px 0;font-size:0.9rem;">قرارات عملية أعدتها فرق Daka المتخصصة<\/p>',
                '  <p style="color:#64748b;font-size:0.75rem;margin:0;">' + arDate + '<\/p>',
                '  <p style="color:#c4b5fd;font-size:0.72rem;margin:8px 0 0;">' + selectedModules.map(function (m) { return m.team; }).join(' · ') + '<\/p>',
                '<\/div>',
                arContent.length
                    ? arContent
                    : '<p style="text-align:center;color:#94a3b8;padding:40px;">\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0644\u062a\u0635\u062f\u064a\u0631<\/p>',
                '<\/body>',
                '<\/html>'
            ];

            pw.document.open();
            pw.document.write(htmlParts.join('\n'));
            pw.document.close();

            // 🔥 CORRECTION RADAR CHART : Transforme le graphique en image PNG pour l'impression
            var originalCanvas = document.getElementById('competitorRadarChart');
            if (originalCanvas) {
                var popupCanvasContainer = pw.document.getElementById('competitorRadarChart');
                if (popupCanvasContainer && popupCanvasContainer.parentNode) {
                    var img = pw.document.createElement('img');
                    img.src = originalCanvas.toDataURL("image/png");
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.margin = '0 auto';
                    img.style.display = 'block';
                    popupCanvasContainer.parentNode.replaceChild(img, popupCanvasContainer);
                }
            }

            // Script de lancement de l'impression...
            var fixScript = pw.document.createElement('script');

            // 🔥 CHANGEMENT 3 : Suppression du script de "color/background replacement" qui rendait la page blanche
            var fixScript = pw.document.createElement('script');
            fixScript.textContent = [
                'window.onload = function () {',
                '  setTimeout(function () { window.print(); }, 1400);',
                '};'
            ].join('\n');
            pw.document.head.appendChild(fixScript);

            toast.success('\u062a\u0645 \u0641\u062a\u062d \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u2014 \u0627\u062e\u062a\u0631 \u062d\u0641\u0638 \u0643\u0640 PDF');

        } catch (err) {
            console.error('[PDF AR]', err);
            toast.error('\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u062a\u0635\u062f\u064a\u0631: ' + err.message);
        } finally {
            STATE.isExporting = false;
            if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
        }
        return;
    }

    // ══════════════════════════════════════════════════════════════
    // CAS FR / EN — document PDF natif jsPDF (100% client, zéro serveur)
    // ══════════════════════════════════════════════════════════════
    const isEn = STATE.currentLang === 'en';

    // Vérifier libs
    if (typeof window.jspdf === 'undefined') {
        toast.error(
            isEn
                ? 'PDF library is not loaded. Please reload the page.'
                : 'La librairie PDF n’est pas chargée. Rechargez la page.'
        );
        STATE.isExporting = false;
        if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
        return;
    }

    toast.info(isAr ? 'يتم بناء ملف PDF...' : isEn ? 'Building PDF — please wait...' : 'Construction du PDF — patientez...');
    await new Promise(function (r) { setTimeout(r, 120); });

    let hiddenEls = [];
    let openedDetails = [];

    try {
        const { jsPDF } = window.jspdf;

        // ── Sections à exporter ───────────────────────────────────
        const sectionDefs = [
            { key: 'competitors', id: 'resultsCompetitors', label: isAr ? 'المنافسة والسوق' : isEn ? 'Competitor Report' : 'Concurrence', has: hasComp },
            { key: 'funnel', id: 'resultsFunnel', label: isAr ? 'مسار التحويل' : isEn ? 'Conversion Path' : 'Parcours de conversion', has: hasFunnel },
            { key: 'technical', id: 'resultsTechnical', label: isAr ? 'تدقيق الموقع' : isEn ? 'Site Audit' : 'Audit site', has: hasSeo },
            { key: 'keywords', id: 'resultsKeywords', label: isAr ? 'إشارات الطلب' : isEn ? 'Demand signals' : 'Signaux de demande', has: hasKw },
        ];

        const validSections = sectionDefs
            .filter(function (s) { return s.has && selectedSectionKeys.has(s.key); })
            .map(function (s) {
                const el = document.getElementById(s.id);
                const module = selectedModules.find(function (item) { return item.key === s.key; });
                const selectedKeys = selectedFeatures[s.key] || [];
                return (el && getExportableReportText(el).length > 40)
                    ? {
                        el: el,
                        label: s.label,
                        key: s.key,
                        featureKeys: selectedKeys,
                        featureTitles: (module?.features || [])
                            .filter(function (feature) { return selectedKeys.includes(feature.key); })
                            .map(function (feature) { return feature.title; })
                    }
                    : null;
            })
            .filter(Boolean);

        if (!validSections.length) {
            throw new Error(isEn ? 'No visible results to export.' : 'Aucun résultat visible à exporter.');
        }

        // ── Ouvrir les détails et masquer les éléments non imprimables ──
        openedDetails = [];
        validSections.forEach(function (section) {
            section.el.querySelectorAll('details').forEach(function (details) {
                if (!details.open) {
                    openedDetails.push(details);
                    details.open = true;
                }
            });
        });

        const hideSelectors = [
            '.no-print', '.btn-export-pdf', '#btn-export-global',
            '.btn-copy-mini', '.kw-filter-btn', '#kwFilterBar',
            '.loading-state', '.toast-container', '.generator-grid',
            '#tech-gen-output', '[data-gen-type]', '.export-bubble-wrapper',
            'button', '.btn-gen', '.nav-tabs', '.header', '.footer',
            '#loadingCompetitors', '#loadingFunnel', '#loadingTechnical', '#loadingKeywords'
        ].join(',');

        hiddenEls = [];
        document.querySelectorAll(hideSelectors).forEach(function (el) {
            if (el.style.display !== 'none') {
                hiddenEls.push({ el: el, orig: el.style.display });
                el.style.display = 'none';
            }
        });
        await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });

        // ── Init PDF A4 ───────────────────────────────────────────
        const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW   = pdf.internal.pageSize.getWidth();   // 210
        const pageH   = pdf.internal.pageSize.getHeight();  // 297
        const margin  = 18;
        const contentW = pageW - margin * 2;

        // Three decision-first pages precede the selected detailed chapters.
        var reportUrl = pdfDecisionModel.reportUrl;
        var dakaLogoDataUrl = await loadDakaPdfLogoDataUrl();
        var coverSectionLinks = drawDakaPdfExecutivePage(
            pdf, pdfDecisionModel, validSections, dakaLogoDataUrl, pageW, pageH, margin
        );
        drawDakaPdfRoadmapPage(pdf, pdfDecisionModel, pageW, pageH, margin);
        drawDakaPdfMindMapPage(pdf, pdfDecisionModel, pageW, pageH, margin);

        // ════════════════════════════════════════════════════════
        // CAPTURE html2canvas — une page par section
        // ════════════════════════════════════════════════════════
        var capturedSections = 0;
        var sectionStartPages = [];
        for (var si = 0; si < validSections.length; si++) {
            var section = validSections[si];

            // Each selected expertise starts directly with useful content.
            sectionStartPages[si] = pdf.internal.getNumberOfPages() + 1;
            var sectionColors = [
                [108, 99, 255],   // Competitors — violet
                [16,  185, 129],  // Funnel      — vert
                [59,  130, 246],  // Technical   — bleu
                [6,   182, 212],  // Keywords    — cyan
            ];
            var sc = sectionColors[si] || [108, 99, 255];
            // Build a stable document clone, then compose native PDF text.
            var fixedClone = createFixedPdfClone(section.el, {
                includeDetails: includeDetails,
                featureKeys: section.featureKeys,
                featureTitles: section.featureTitles,
                title: section.label
            });
            await document.fonts?.ready?.catch(function () {});
            await new Promise(function (resolve) {
                requestAnimationFrame(function () { requestAnimationFrame(resolve); });
            });

            var printableH = pageH - margin * 2;
            var currentY = margin;
            var contentPage = 0;
            var sectionCaptured = false;

            function preparePdfContentPage(addPage) {
                if (addPage) pdf.addPage();
                contentPage++;
                currentY = margin + 11;
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pageW, pageH, 'F');
                pdf.setFillColor(sc[0], sc[1], sc[2]);
                pdf.rect(0, 0, pageW, 2, 'F');
                pdf.setFillColor(sc[0], sc[1], sc[2]);
                pdf.rect(0, pageH - 2, pageW, 2, 'F');
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(6.5);
                pdf.setTextColor(71, 85, 105);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.setTextColor(15, 23, 42);
                pdf.text(section.label, margin, margin + 2);
                pdf.setDrawColor(226, 232, 240);
                pdf.setLineWidth(0.25);
                pdf.line(margin, margin + 5, pageW - margin, margin + 5);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(6.5);
                pdf.setTextColor(71, 85, 105);
                pdf.text(
                    'Made by Daka  \u2014  ' + section.label,
                    margin, pageH - 4
                );
                pdf.text(
                    String(pdf.internal.getCurrentPageInfo().pageNumber),
                    pageW - margin, pageH - 4,
                    { align: 'right' }
                );
            }

            // Start directly on a content page: no empty separator page.
            var semanticBlocks = getDakaPdfSemanticBlocks(fixedClone);
            if (!semanticBlocks.length) {
                sectionStartPages[si] = null;
                fixedClone.remove();
                continue;
            }
            preparePdfContentPage(true);

            try {
                for (var bi = 0; bi < semanticBlocks.length; bi++) {
                    var block = semanticBlocks[bi];
                    if (block.title) {
                        var titleLines = pdf.splitTextToSize(block.title, contentW - 14);
                        var titleHeight = titleLines.length * (block.chapter ? 7 : 5.6) + 8;
                        if (currentY + titleHeight > pageH - margin - 9) preparePdfContentPage(true);
                        pdf.setFillColor(block.chapter ? 234 : 248, block.chapter ? 244 : 250, block.chapter ? 251 : 252);
                        pdf.setDrawColor(block.chapter ? 3 : 203, block.chapter ? 105 : 213, block.chapter ? 161 : 225);
                        pdf.roundedRect(margin, currentY, contentW, titleHeight, 2, 2, 'FD');
                        pdf.setFillColor(sc[0], sc[1], sc[2]);
                        pdf.rect(margin, currentY, 2.2, titleHeight, 'F');
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(block.chapter ? 13 : 10);
                        pdf.setTextColor(15, 23, 42);
                        pdf.text(titleLines, margin + 7, currentY + (block.chapter ? 8 : 6.5));
                        currentY += titleHeight + 3;
                    }
                    for (var pi = 0; pi < block.paragraphs.length; pi++) {
                        var paragraph = block.paragraphs[pi];
                        var prefix = paragraph.bullet ? '\u2022  ' : '';
                        var paragraphLines = pdf.splitTextToSize(prefix + paragraph.text, contentW - 12);
                        var lineHeightMm = 4.6;
                        var paragraphHeight = paragraphLines.length * lineHeightMm + 3;
                        if (currentY + paragraphHeight > pageH - margin - 8) preparePdfContentPage(true);
                        pdf.setFont('helvetica', paragraph.bullet ? 'normal' : 'normal');
                        pdf.setFontSize(8.5);
                        pdf.setTextColor(paragraph.url ? 3 : 51, paragraph.url ? 105 : 65, paragraph.url ? 161 : 85);
                        pdf.text(paragraphLines, margin + 5, currentY + 4);
                        if (paragraph.url && typeof pdf.link === 'function') {
                            pdf.link(margin + 4, currentY, contentW - 8, paragraphHeight, { url: paragraph.url });
                        }
                        currentY += paragraphHeight;
                    }
                    sectionCaptured = true;
                    currentY += 3;
                }
            } catch (captureErr) {
                console.warn('[PDF] Composition du document échouée pour ' + section.label, captureErr);
            } finally {
                fixedClone.remove();
            }
            if (sectionCaptured) capturedSections++;
        }

        if (!capturedSections) {
            throw new Error(isEn ? 'Report content is not ready for export.' : 'Le rapport n’est pas encore prêt pour l’export.');
        }

        // Rendre le sommaire de couverture cliquable après calcul des pages.
        if (typeof pdf.link === 'function') {
            var lastContentPage = pdf.internal.getNumberOfPages();
            pdf.setPage(1);
            coverSectionLinks.forEach(function (rect, i) {
                if (sectionStartPages[i]) {
                    pdf.link(rect.x, rect.y, rect.w, rect.h, { pageNumber: sectionStartPages[i] });
                }
            });
            pdf.setPage(lastContentPage);
        }

        // Fallback appendix only when the selected keyword chapter could not be composed.
        if (
            hasKw &&
            selectedSectionKeys.has('keywords') &&
            exportKeywords.length &&
            !validSections.some(function (section) { return section.key === 'keywords'; })
        ) {
        pdf.addPage();
        pdf.setFillColor(10, 15, 30);
        pdf.rect(0, 0, pageW, pageH, 'F');
        pdf.setFillColor(108, 99, 255);
        pdf.rect(0, 0, pageW, 4, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(255, 255, 255);
        pdf.text(
            isEn ? 'Summary & Top Keywords' : 'Récapitulatif & Top Mots-Clés',
            pageW / 2, 22, { align: 'center' }
        );

        pdf.setDrawColor(108, 99, 255);
        pdf.setLineWidth(0.4);
        pdf.line(margin, 27, pageW - margin, 27);

        var summaryY = 35;

        // Récap sections analysées
        validSections.forEach(function (s, i) {
            pdf.setFillColor(20, 28, 50);
            pdf.setDrawColor(50, 60, 100);
            pdf.setLineWidth(0.2);
            pdf.roundedRect(margin, summaryY + i * 12, contentW, 10, 2, 2, 'FD');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.setTextColor(180, 175, 255);
            pdf.text('\u2713  ' + s.label, margin + 5, summaryY + i * 12 + 6.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            pdf.text(isEn ? 'Open section' : 'Ouvrir la section', pageW - margin - 5, summaryY + i * 12 + 6.5, { align: 'right' });
            if (typeof pdf.link === 'function' && sectionStartPages[i]) {
                pdf.link(margin, summaryY + i * 12, contentW, 10, { pageNumber: sectionStartPages[i] });
            }
        });

        // Top 20 Keywords si disponibles
        if (hasKw && selectedSectionKeys.has('keywords') && exportKeywords.length) {
            var kwStartY = summaryY + validSections.length * 12 + 15;

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(6, 182, 212);
            pdf.text(
                isEn ? 'Top 20 Keywords' : 'Top 20 Mots-Clés',
                margin, kwStartY
            );

            // En-tête tableau keywords
            var kwTableY = kwStartY + 8;
            var colKw    = margin;
            var colVol   = margin + 80;
            var colKd    = margin + 110;
            var colCpc   = margin + 135;
            var colInt   = margin + 158;

            pdf.setFillColor(20, 35, 65);
            pdf.rect(margin, kwTableY, contentW, 8, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(6.5);
            pdf.setTextColor(100, 116, 139);
            pdf.text(isEn ? 'KEYWORD'  : 'MOT-CLÉ',  colKw  + 2, kwTableY + 5.5);
            pdf.text('VOLUME',                         colVol + 2, kwTableY + 5.5);
            pdf.text('KD',                             colKd  + 2, kwTableY + 5.5);
            pdf.text('CPC',                            colCpc + 2, kwTableY + 5.5);
            pdf.text('INTENT',                         colInt + 2, kwTableY + 5.5);

            // Lignes keywords
            var top20 = exportKeywords.slice(0, 20);
            top20.forEach(function (kw, ki) {
                var rowY  = kwTableY + 8 + ki * 8;
                var isEven = ki % 2 === 0;

                // Fond alterné
                pdf.setFillColor(isEven ? 15 : 20, isEven ? 22 : 28, isEven ? 42 : 52);
                pdf.rect(margin, rowY, contentW, 8, 'F');

                // Flag langue
                var langFlag = kw.language === 'fr' ? 'FR' : kw.language === 'ar' ? 'AR' : 'EN';
                pdf.setFontSize(5.5);
                pdf.setFillColor(30, 40, 80);
                pdf.roundedRect(colKw + 1, rowY + 1.5, 8, 5, 1, 1, 'F');
                pdf.setTextColor(148, 163, 184);
                pdf.text(langFlag, colKw + 5, rowY + 5.5, { align: 'center' });

                // Keyword text
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                pdf.setTextColor(226, 232, 240);
                var kwText = (kw.keyword || '').substring(0, 32);
                pdf.text(kwText, colKw + 11, rowY + 5.5);

                // Quick win badge
                if (kw.quickWin) {
                    pdf.setFillColor(16, 185, 129);
                    pdf.setFontSize(4.5);
                    pdf.setTextColor(255, 255, 255);
                    var kwTextW = pdf.getTextWidth(kwText);
                    pdf.roundedRect(colKw + 12 + kwTextW, rowY + 1.5, 8, 5, 1, 1, 'F');
                    pdf.text('WIN', colKw + 16 + kwTextW, rowY + 5.5, { align: 'center' });
                }

                // Volume
                var vol = parseInt(kw.volume) || 0;
                var volStr = vol >= 1000000
                    ? (vol / 1000000).toFixed(1) + 'M'
                    : vol >= 1000
                        ? (vol / 1000).toFixed(1) + 'K'
                        : vol > 0 ? String(vol) : '—';
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);
                pdf.setTextColor(255, 255, 255);
                pdf.text(volStr, colVol + 2, rowY + 5.5);

                // KD avec couleur
                var kdVal = parseInt(kw.kd) || 0;
                var kdColor = kdVal <= 29
                    ? [16, 185, 129]
                    : kdVal <= 69
                        ? [245, 158, 11]
                        : [239, 68, 68];
                pdf.setFillColor(kdColor[0], kdColor[1], kdColor[2]);
                pdf.setFontSize(5);
                pdf.roundedRect(colKd + 1, rowY + 1.5, 12, 5, 1.5, 1.5, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.text(String(kdVal), colKd + 7, rowY + 5.5, { align: 'center' });

                // CPC
                var cpcVal = parseFloat(kw.cpc) || 0;
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);
                pdf.setTextColor(148, 163, 184);
                pdf.text(cpcVal > 0 ? '$' + cpcVal.toFixed(2) : '—', colCpc + 2, rowY + 5.5);

                // Intent badge
                var intent = (kw.intent || 'Info').substring(0, 6);
                var intentColor = intent.toLowerCase().includes('trans')
                    ? [16, 185, 129]
                    : intent.toLowerCase().includes('comm')
                        ? [59, 130, 246]
                        : intent.toLowerCase().includes('nav')
                            ? [139, 92, 246]
                            : [100, 116, 139];
                pdf.setFillColor(intentColor[0], intentColor[1], intentColor[2]);
                pdf.setFontSize(5);
                pdf.roundedRect(colInt + 1, rowY + 1.5, 16, 5, 1.5, 1.5, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.text(intent, colInt + 9, rowY + 5.5, { align: 'center' });
            });

            // Ligne total keywords
            var totalY = kwTableY + 8 + top20.length * 8 + 5;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(7.5);
            pdf.setTextColor(6, 182, 212);
            pdf.text(
                (isEn ? 'Total: ' : 'Total : ')
                + exportKeywords.length
                + (isEn ? ' keywords extracted' : ' mots-clés extraits'),
                margin, totalY
            );

            // Quick Wins count
            var qwCount = exportKeywords.filter(function (k) { return k.quickWin; }).length;
            if (qwCount > 0) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);
                pdf.setTextColor(16, 185, 129);
                pdf.text(
                    '\u26A1 ' + qwCount + (isEn ? ' Quick Wins identified' : ' Quick Wins identifiés'),
                    margin, totalY + 8
                );
            }
        }

        // ── Pied de page finale ───────────────────────────────────
        pdf.setFillColor(108, 99, 255);
        pdf.rect(0, pageH - 4, pageW, 4, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
            'Made by Daka  |  ' + (isEn ? 'Built for clearer decisions' : 'Conçu pour décider avec clarté'),
            pageW / 2, pageH - 7, { align: 'center' }
        );
        }

        // Filigrane discret sur chaque page.
        var totalPdfPages = pdf.internal.getNumberOfPages();
        for (var watermarkPage = 1; watermarkPage <= totalPdfPages; watermarkPage++) {
            pdf.setPage(watermarkPage);
            try {
                pdf.setGState(new pdf.GState({ opacity: 0.055 }));
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(28);
                pdf.setTextColor(148, 163, 184);
                pdf.text('Made by Daka', pageW / 2, pageH / 2, { align: 'center', angle: 35 });
                pdf.setGState(new pdf.GState({ opacity: 1 }));
            } catch (watermarkError) {
                console.warn('[PDF] Watermark unavailable', watermarkError);
            }
        }

        // ════════════════════════════════════════════════════════
        // RESTAURER éléments masqués
        // ════════════════════════════════════════════════════════
        restorePdfExportDom(hiddenEls, openedDetails);
        hiddenEls = [];
        openedDetails = [];

        // ════════════════════════════════════════════════════════
        // TÉLÉCHARGEMENT
        // ════════════════════════════════════════════════════════
        var slug = reportUrl
            ? reportUrl.replace(/https?:\/\//i, '').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
            : 'report';
        var filename = 'Daka-Decision-Report-' + slug + '-' + Date.now() + '.pdf';

        saveDakaPdfFile(pdf, filename, exportOptions?.downloadWindow || null);

        toast.success(
            isAr
                ? '\u2705 تم تحميل PDF بنجاح!'
                : isEn
                ? '\u2705 DOCX downloaded successfully!'
                : '\u2705 DOCX téléchargé avec succès !'
        );

    } catch (err) {
        console.error('[PDF FR/EN]', err);
        if (exportOptions?.downloadWindow && !exportOptions.downloadWindow.closed) {
            try { exportOptions.downloadWindow.close(); } catch (_) {}
        }

        restorePdfExportDom(hiddenEls, openedDetails);
        hiddenEls = [];
        openedDetails = [];

        toast.error(
            (isAr ? 'فشل تصدير DOCX: ' : isEn ? 'DOCX export failed: ' : 'Export DOCX échoué : ')
            + (err.message || 'Erreur inconnue')
        );

    } finally {
        STATE.isExporting = false;
        if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
    }

};



/**
 * 🚀 AFFICHAGE GÉNÉRATEURS (VERSION DEEP INTEL V5.9)
 * Règle les erreurs d'ID/Name pour le PDF et sécurise la copie multilingue.
 */

window.copyToClipboard = function(elementId, btn) {
    const textElement = document.getElementById(elementId);
    if (!textElement || !btn) return;

    // Récupération du texte brut
    const textToCopy = textElement.innerText || textElement.textContent;
    const isAr = STATE.currentLang === 'ar';
    const originalHtml = btn.innerHTML;

    // --- FONCTION DE SUCCESS UI ---
    const showSuccess = () => {
        btn.innerHTML = `<i class="fas fa-check"></i> ${isAr ? 'تم النسخ' : 'Copié !'}`;
        btn.style.background = "#10b981";
        btn.style.color = "white";
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.background = "";
            btn.style.color = "";
        }, 2000);
    };

    // --- MÉTHODE 1 : API MODERNE (Si autorisée) ---
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy)
            .then(showSuccess)
            .catch(() => fallbackCopy(textToCopy, showSuccess));
    } else {
        // --- MÉTHODE 2 : FALLBACK (Navigateurs Internes / Non-sécurisés) ---
        fallbackCopy(textToCopy, showSuccess);
    }
};

// Fonction de secours qui crée un champ invisible pour copier
function fallbackCopy(text, callback) {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // On le rend invisible et hors de vue
        Object.assign(textArea.style, {
            position: "fixed",
            left: "-9999px",
            top: "0",
            opacity: "0"
        });

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) callback();
    } catch (err) {
        console.error('Erreur fatale de copie:', err);
        alert("Action bloquée : veuillez copier le texte manuellement.");
    }
}

/**
 * 🚀 AFFICHAGE GÉNÉRATEURS (VERSION DEEP & PDF-READY)
 * Règle les erreurs d'ID/Name pour le PDF et sécurise la copie.
 */

window.exportTechToPDF = async function() {
    openDakaExportStudio('technical');
    return;
    const auditContainer = document.getElementById('resultsTechnical');
    if (!auditContainer || auditContainer.innerHTML.trim() === "") {
        return toast.error("Rapport vide.");
    }

    const btn = document.querySelector('button[onclick="exportTechToPDF()"]');
    const originalText = btn.innerHTML;

    // 1. UI Feedback & Verrouillage
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Génération...';

    try {
        // 2. Création d'une zone de rendu temporaire
        const worker = document.createElement('div');
        worker.style.position = 'absolute';
        worker.style.left = '-9999px';
        worker.style.top = '0';
        worker.style.width = '800px'; // Largeur fixe pour stabiliser le rendu
        worker.style.background = '#0a0e27'; // On force le fond sombre
        worker.style.color = 'white';

        // 3. Clone et Nettoyage
        const clone = auditContainer.cloneNode(true);
        // Supprimer les éléments qui ne doivent pas être dans le PDF (boutons, etc.)
        clone.querySelectorAll('button, .generator-grid, .no-print').forEach(el => el.remove());

        worker.appendChild(clone);
        document.body.appendChild(worker);

        // 4. Conversion forcée des Canvas (Graphiques) en Images
        // html2canvas rate souvent les canvas live, on les fige en PNG
        const originalCanvases = auditContainer.querySelectorAll('canvas');
        const clonedCanvases = worker.querySelectorAll('canvas');
        originalCanvases.forEach((canv, i) => {
            if (clonedCanvases[i]) {
                const img = document.createElement('img');
                img.src = canv.toDataURL("image/png");
                img.style.width = "100%";
                clonedCanvases[i].parentNode.replaceChild(img, clonedCanvases[i]);
            }
        });

        // 5. Configuration HTML2PDF
        const opt = {
            margin: 10,
            filename: `Audit_SEO_Expert_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true, // Crucial pour les icônes et fonts
                backgroundColor: '#0a0e27',
                logging: false,
                letterRendering: true
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // 6. Lancement avec délai pour laisser les polices se charger
        await html2pdf().set(opt).from(worker).toPdf().get('pdf').then(function (pdf) {
            // Optionnel : ajouter des numéros de page ici
        }).save();

        // 7. Nettoyage final
        document.body.removeChild(worker);
        toast.success("Rapport exporté !");

    } catch (err) {
        console.error("Erreur export legacy:", err);
        toast.error("Erreur lors de la génération.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};
/**
/**
 * 🛠️ RENDU DES CARTES DE FICHIERS SYSTÈMES (Version Corrigée)
 */
function renderSystemFileCard(title, id, content, icon, color, isAr) {
    return `
        <div class="result-card" style="margin-bottom:0; border-top: 4px solid ${color};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="margin:0; color:white; font-family:'Cairo';"><i class="fas ${icon}" style="color:${color}"></i> ${title}</h4>
                <i class="fas fa-toggle-on" style="color:var(--accent-primary); font-size:1.2rem;"></i>
            </div>
            <div id="${id}" style="height:140px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:12px; font-family:monospace; font-size:0.75rem; color:${color}; overflow-y:auto; direction:ltr; text-align:left; white-space: pre-wrap;">${escapeHtml(content)}</div>

            <button onclick="copyToClipboard('${id}', this)" class="btn" style="width:100%; margin-top:12px; background:${color}; color:black; font-weight:bold; border:none; font-size:0.8rem; cursor:pointer;">
                <i class="fas fa-copy"></i> ${isAr ? 'نسخ الملف' : 'COPIER LE FICHIER'}
            </button>
        </div>
    `;
}



/* ═══════════════════════════════════════════════════════════════════
   🛠️ 1. LE TEMPLATE (Génère le HTML du rapport instantanément)
   ═══════════════════════════════════════════════════════════════════ */
function generateLocalReportHtml(data) {
    const keyword = STATE.lastInputs?.keyword || 'Analyse SEO';
    const date = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    return `
    <div style="font-family: sans-serif; background: #020617; color: white; padding: 30px; width: 750px;">
        <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 25px; border-radius: 12px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 22px;">SEO Intelligence Report</h1>
            <p style="margin: 5px 0 0; opacity: 0.8; font-size: 13px;">Mot-clé : ${keyword} | ${date}</p>
        </div>

        <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid #8b5cf6; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #a78bfa; font-size: 14px; text-transform: uppercase; margin: 0 0 10px 0;">💡 Stratégie Gagnante</h2>
            <p style="font-style: italic; font-size: 15px; margin: 0; line-height: 1.5;">"${data.winningMove || 'Analyse en cours...'}"</p>
        </div>

        <h2 style="color: #3b82f6; font-size: 18px; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">🚀 Plan d'Action</h2>
        <div style="margin-top: 15px;">
            ${(data.actionRoadmap || []).map((step, i) => `
                <div style="background: #0f172a; border: 1px solid #1e293b; padding: 12px; border-radius: 8px; margin-bottom: 8px; font-size: 13px;">
                    <strong style="color: #8b5cf6;">${i + 1}.</strong> ${step}
                </div>
            `).join('')}
        </div>

        <div style="text-align: center; font-size: 10px; color: #475569; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 15px;">
            Généré localement par Daka Market Intelligence Spyer
        </div>
    </div>`;
}

window.exportCompetitorsPDF = async function () {
    openDakaExportStudio('competitors');
    return;
    const results = STATE.lastAnalysisResults;
    if (!results) return toast.error("Lancez d'abord une analyse Concurrents.");

    // ✅ FIX 1 : Feedback visuel pendant la génération
    const btn = document.getElementById('btn-export-global');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`;
        btn.disabled = true;
    }
    toast.info("⏳ Génération PDF en cours (10-30s)...");

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/export/competitors-pro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: results,
                keyword: STATE.lastInputs?.keyword || 'SEO'
            })
        });

        // ✅ FIX 2 : Vérification correcte avant blob()
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Erreur serveur ${response.status}: ${errText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/pdf')) {
            throw new Error("La réponse n'est pas un PDF valide");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SEO-Competitors-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // ✅ FIX 3 : Libération mémoire
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);

        toast.success("✅ Rapport DOCX téléchargé !");

    } catch (err) {
        console.error("Legacy export error:", err);
        toast.error(`Export échoué: ${err.message}`);
    } finally {
        // ✅ FIX 4 : Toujours restaurer le bouton
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
};

/* ═══════════════════════════════════════════════════════════════════
   🛠️ UTILS & HELPERS
   ═══════════════════════════════════════════════════════════════════ */

// Chargement asynchrone de la librairie d'export
async function ensureHtml2PdfLoaded() {
    if (typeof html2pdf !== 'undefined') return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error("Impossible de charger html2pdf.js"));
        document.head.appendChild(script);
    });
}

// Système de copie robuste (Fallback inclus)
window.copyToClipboard = function(elementId, btn) {
    const textEl = document.getElementById(elementId);
    if (!textEl) return;
    const text = textEl.innerText || textEl.textContent;

    const originalHTML = btn.innerHTML;
    const success = () => {
        btn.innerHTML = '<i class="fas fa-check"></i> Copié !';
        btn.style.background = "#10b981";
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = "";
        }, 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(success).catch(() => fallbackCopy(text, success));
    } else {
        fallbackCopy(text, success);
    }
};

function fallbackCopy(text, cb) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch(e) {}
    document.body.removeChild(ta);
}

// Tracking des inputs pour l'export
document.addEventListener('input', (e) => {
    if (e.target.id === 'keyword') STATE.lastInputs.keyword = e.target.value;
    if (e.target.id === 'url') STATE.lastInputs.url = e.target.value;
    if (e.target.id === 'country') STATE.lastInputs.country = e.target.value;
});




/**
 * 📊 FONCTION CHART.JS TECHNIQUE
 */
function renderTechDoughnut(ctx, score, color) {
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [color, 'rgba(255,255,255,0.05)'],
                borderWidth: 0
            }]
        },
        options: {
            cutout: '85%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { animateScale: true }
        }
    });
}

// Count display
document.getElementById('kwCount')?.addEventListener('input', (e) => {
    document.getElementById('kwCountDisplay').textContent = e.target.value;
    const langs = ['langFR','langAR','langEN'].filter(id => document.getElementById(id).checked).length;
    document.getElementById('totalKws').textContent = e.target.value * langs;
});

async function analyzeKeywords(e) {
  if (e) e.preventDefault();

  const seed  = document.getElementById('seedKeyword')?.value.trim();
  const count = parseInt(document.getElementById('kwCount')?.value) || 20;
  const geo   = document.getElementById('kwGeo')?.value || 'auto';
  const isAr  = STATE.currentLang === 'ar';
  const isEn  = STATE.currentLang === 'en';

  const langs = [];
  if (document.getElementById('langFR')?.checked) langs.push('fr');
  if (document.getElementById('langAR')?.checked) langs.push('ar');
  if (document.getElementById('langEN')?.checked) langs.push('en');

  if (!seed)
    return toast.error(isAr ? 'أدخل كلمة مفتاحية.' : 'Veuillez entrer un mot-clé racine.');
  if (!langs.length)
    return toast.warning(isAr ? 'اختر لغة واحدة على الأقل.' : 'Veuillez sélectionner au moins une langue.');

  /* ── RESET avant nouvelle analyse ────────────────────────── */
  resetAnalysis('keywords');

  setButtonLoading('kwBtn', true);
  showLoading('loadingKeywords');
  hideResults('resultsKeywords');

  try {
    const response = await analyzeWithPolling('/api/generate-keywords', {
      seedKeyword:      seed,
      languages:        langs,
      countPerLanguage: count,
      geo
    });

    if (response.success) {
      /* ── Persistance STATE COMPLÈTE ─────────────────────── */
      STATE.lastKeywords = {
        ...response,                    // toutes les data serveur
        seed,                           // input utilisateur
        languages:        langs,
        countPerLanguage: count,
        geoInput:         geo,
      };
      STATE.lastInputs.seedKeyword = seed;
      STATE.lastInputs.kwLangs     = langs;
      STATE.lastInputs.kwCount     = count;
      STATE.lastInputs.kwGeo       = geo;

      displayKeywordsResults(response); // displayKeywordsResults gère showResults en interne
      const total = response.totalKeywords || response.keywords?.length || 0;
      toast.success(
        isAr ? `✅ تم توليد ${total} كلمة مفتاحية!`
        : isEn ? `✅ Found ${total} high-potential keywords.`
        : `✅ ${total} mots-clés stratégiques extraits.`
      );
    } else {
      throw new Error(response.error || 'Génération échouée');
    }
  } catch (err) {
    if (err?.name === 'AbortError' || window.dakaAnalysisCancelled) return;
    console.error('Keywords Engine Error:', err);
    toast.error(err.message || 'Erreur lors de la génération.');
  } finally {
    setButtonLoading('kwBtn', false);
    hideLoading('loadingKeywords');
  }
}


function displayKeywordsResults(data) {
    const container = document.getElementById('resultsKeywords');
    if (!container) return;

    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';
    const dir  = isAr ? 'rtl' : 'ltr';

    const t = {
        title:  isAr ? '📊 داتا الكلمات المفتاحية الاستراتيجية' : (isEn ? '📊 Strategic Keyword Data' : '📊 Data Mots-clés Stratégiques'),
        copy:   isAr ? 'نسخ الكل' : (isEn ? 'COPY ALL' : 'COPIER TOUT'),
        kw:     isAr ? 'الكلمة المفتاحية' : 'Keyword',
        intent: isAr ? 'النية' : 'Intent',
        volume: isAr ? 'حجم البحث' : 'Volume',
        kd:     isAr ? 'صعوبة (KD)' : 'KD %',
        cpc:    isAr ? 'سعر النقرة' : 'CPC ($)',
        trend:  isAr ? 'الترند' : 'Trend',
        source: isAr ? 'المصدر' : 'Source',
        geo:    isAr ? 'البلد' : 'Pays',
        noData: isAr ? 'لا توجد نتائج' : (isEn ? 'No results' : 'Aucun résultat')
    };

    container.style.display = 'block';

    /* ══════════════════════════════════════════════════════
       MAJ 1 — Sauvegarde COMPLÈTE dans STATE
       (seed, languages, geo, count en plus du tableau)
    ══════════════════════════════════════════════════════ */
    STATE.lastKeywords = {
        // Données brutes de la réponse serveur
        keywords:       data.keywords        || [],
        clusters:       data.clusters        || [],
        paaQuestions:   data.paaQuestions    || [],
        quickWins:      data.quickWins       || [],
        stats:          data.stats           || {},
        geo:            data.geo             || 'auto',
        geoResolved:    data.geoResolved     || '',
        generationTime: data.generationTime  || '',
        totalKeywords:  data.totalKeywords   || data.keywords?.length || 0,
        // Inputs utilisateur au moment de la génération
        seed:           document.getElementById('seedKeyword')?.value?.trim() || '',
        languages:      ['langFR','langAR','langEN']
                            .filter(id => document.getElementById(id)?.checked)
                            .map(id => id.replace('lang','').toLowerCase()),
        countPerLanguage: parseInt(document.getElementById('kwCount')?.value) || 20,
        geoInput:       document.getElementById('kwGeo')?.value || 'auto',
    };

    const kwList = STATE.lastKeywords.keywords;
    const stats  = STATE.lastKeywords.stats;
    const geo    = (STATE.lastKeywords.geo || 'auto').toUpperCase();

    /* ── Breakdown par langue ─────────────────────────────────── */
    const byLang = kwList.reduce((acc, k) => {
        acc[k.language] = (acc[k.language] || 0) + 1;
        return acc;
    }, {});
    const langBreakdown = Object.entries(byLang)
        .map(([l, n]) => `${l==='fr'?'🇫🇷':l==='ar'?'🇸🇦':'🇬🇧'} <strong>${n}</strong>`)
        .join('<span style="color:rgba(255,255,255,0.15);margin:0 6px;">|</span>');

    /* ── Helpers ──────────────────────────────────────────────── */
    const getKdColor = (kd) => {
        const v = parseInt(kd) || 0;
        if (v <= 29) return { bg:'rgba(16,185,129,0.1)',  text:'#10b981', border:'rgba(16,185,129,0.3)'  };
        if (v <= 69) return { bg:'rgba(245,158,11,0.1)',  text:'#f59e0b', border:'rgba(245,158,11,0.3)'  };
        return               { bg:'rgba(239,68,68,0.1)',  text:'#ef4444', border:'rgba(239,68,68,0.3)'   };
    };

    const getIntentBadge = (intentStr) => {
        const i = (intentStr || '').toLowerCase();
        if (i.includes('trans')) return `<span style="background:#10b98120;color:#10b981;padding:3px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;border:1px solid #10b98130;">${isAr?'شراء':'Trans.'}</span>`;
        if (i.includes('comm'))  return `<span style="background:#3b82f620;color:#3b82f6;padding:3px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;border:1px solid #3b82f630;">${isAr?'تجاري':'Comm.'}</span>`;
        if (i.includes('nav'))   return `<span style="background:#8b5cf620;color:#a78bfa;padding:3px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;border:1px solid #8b5cf630;">${isAr?'تصفح':'Nav.'}</span>`;
        return                          `<span style="background:#64748b20;color:#94a3b8;padding:3px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;border:1px solid #64748b30;">${isAr?'معلومة':'Info'}</span>`;
    };

    const getTrendBadge = (trend, score) => {
        const s = parseInt(score) || 50;
        if (trend === 'rising')    return `<span style="color:#10b981;font-size:0.75rem;font-weight:700;">📈 ${s}</span>`;
        if (trend === 'declining') return `<span style="color:#ef4444;font-size:0.75rem;font-weight:700;">📉 ${s}</span>`;
        return                            `<span style="color:#64748b;font-size:0.75rem;">➡️ ${s}</span>`;
    };

    const formatVol = (vol) => {
        const v = parseInt(vol) || 0;
        if (v >= 1000000) return (v/1000000).toFixed(1)+'M';
        if (v >= 1000)    return (v/1000).toFixed(1)+'K';
        return v > 0 ? v : '<span style="color:rgba(255,255,255,0.2);">—</span>';
    };

    /* ══════════════════════════════════════════════════════
       MAJ 2 — Stats bar + seed affiché
    ══════════════════════════════════════════════════════ */
    const statsBadges = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px;background:rgba(0,0,0,0.15);border-bottom:1px solid rgba(255,255,255,0.05);align-items:center;">
            ${STATE.lastKeywords.seed ? `<span style="font-size:0.72rem;background:rgba(139,92,246,0.12);color:#a78bfa;border:1px solid rgba(139,92,246,0.25);padding:2px 10px;border-radius:20px;font-weight:700;">🌱 ${STATE.lastKeywords.seed}</span>` : ''}
            <span style="font-size:0.72rem;color:#64748b;">${langBreakdown}</span>
            <span style="color:rgba(255,255,255,0.1);margin:0 4px;">|</span>
            <span style="font-size:0.72rem;color:#94a3b8;">🌍 ${geo}</span>
            ${stats.avgKD !== undefined ? `<span style="color:rgba(255,255,255,0.1);margin:0 4px;">·</span><span style="font-size:0.72rem;color:#94a3b8;">Moy. KD <strong style="color:white;">${stats.avgKD}</strong></span>` : ''}
            ${stats.avgVolume ? `<span style="color:rgba(255,255,255,0.1);margin:0 4px;">·</span><span style="font-size:0.72rem;color:#94a3b8;">Moy. Vol <strong style="color:white;">${formatVol(stats.avgVolume)}</strong></span>` : ''}
            ${stats.risingCount ? `<span style="color:rgba(255,255,255,0.1);margin:0 4px;">·</span><span style="font-size:0.72rem;color:#10b981;">📈 <strong>${stats.risingCount}</strong> rising</span>` : ''}
            ${stats.quickWins ? `<span style="color:rgba(255,255,255,0.1);margin:0 4px;">·</span><span style="font-size:0.72rem;color:#10b981;">⚡ <strong>${stats.quickWins}</strong> quick wins</span>` : ''}
            ${STATE.lastKeywords.generationTime ? `<span style="color:rgba(255,255,255,0.1);margin:0 4px;">·</span><span style="font-size:0.72rem;color:#64748b;">⚡ ${STATE.lastKeywords.generationTime}</span>` : ''}
        </div>`;

    /* ── Experts utiles ───────────────────────────────────────── */
    const assistantsBarHtml = `
        <div style="padding:10px 20px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(15,23,42,0.9);display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <span style="font-size:0.72rem;color:#64748b;font-weight:700;text-transform:uppercase;">Experts pour aller + loin</span>
            <a href="https://chatgpt.com/g/g-JD4pcYCTP-max-content-planner-gpt" target="_blank" rel="noopener"
               style="font-size:0.72rem;color:#e5e7eb;background:rgba(37,99,235,0.18);border:1px solid rgba(37,99,235,0.4);padding:4px 10px;border-radius:999px;text-decoration:none;display:flex;align-items:center;gap:6px;">
                <span style="width:6px;height:6px;border-radius:999px;background:#22c55e;"></span>
                Max · Content Planner
            </a>
            <a href="https://chatgpt.com/g/g-jqfRmKj9D-echo-pitch-perfect-gpt" target="_blank" rel="noopener"
               style="font-size:0.72rem;color:#e5e7eb;background:rgba(234,179,8,0.18);border:1px solid rgba(234,179,8,0.4);padding:4px 10px;border-radius:999px;text-decoration:none;display:flex;align-items:center;gap:6px;">
                <span style="width:6px;height:6px;border-radius:999px;background:#facc15;"></span>
                Echo · Pitch Perfect
            </a>
            <a href="https://chatgpt.com/g/g-lUtrX9s5k-cody-copywriting-bot" target="_blank" rel="noopener"
               style="font-size:0.72rem;color:#e5e7eb;background:rgba(147,51,234,0.18);border:1px solid rgba(147,51,234,0.4);padding:4px 10px;border-radius:999px;text-decoration:none;display:flex;align-items:center;gap:6px;">
                <span style="width:6px;height:6px;border-radius:999px;background:#a855f7;"></span>
                Cody · Copywriting
            </a>
            <a href="https://chatgpt.com/g/g-S0N82XvQh-sebo-seo-optimisation-bot" target="_blank" rel="noopener"
               style="font-size:0.72rem;color:#e5e7eb;background:rgba(16,185,129,0.18);border:1px solid rgba(16,185,129,0.4);padding:4px 10px;border-radius:999px;text-decoration:none;display:flex;align-items:center;gap:6px;">
                <span style="width:6px;height:6px;border-radius:999px;background:#10b981;"></span>
                Sebo · SEO Optimisation
            </a>
        </div>`;

    /* ── Filter bar ───────────────────────────────────────────── */
    const filterBarHtml = `
        <div id="kwFilterBar" style="padding:10px 20px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(15,23,42,0.85);display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
            <!-- KD -->
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.7rem;color:#64748b;font-weight:700;text-transform:uppercase;">KD</span>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    <button onclick="kwFilter('kd','all',this)" class="kw-filter-btn kw-filter-active" data-filter="kd" data-val="all"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:white;font-size:0.7rem;font-weight:700;cursor:pointer;">Tous</button>
                    <button onclick="kwFilter('kd','easy',this)" class="kw-filter-btn" data-filter="kd" data-val="easy"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(16,185,129,0.4);background:rgba(16,185,129,0.08);color:#10b981;font-size:0.7rem;font-weight:700;cursor:pointer;">≤29</button>
                    <button onclick="kwFilter('kd','medium',this)" class="kw-filter-btn" data-filter="kd" data-val="medium"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.08);color:#f59e0b;font-size:0.7rem;font-weight:700;cursor:pointer;">30–69</button>
                    <button onclick="kwFilter('kd','hard',this)" class="kw-filter-btn" data-filter="kd" data-val="hard"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:#ef4444;font-size:0.7rem;font-weight:700;cursor:pointer;">≥70</button>
                </div>
            </div>
            <span style="color:rgba(255,255,255,0.08);font-size:1.1rem;">|</span>
            <!-- Lang -->
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.7rem;color:#64748b;font-weight:700;text-transform:uppercase;">${isAr?'اللغة':'Lang'}</span>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    <button onclick="kwFilter('lang','all',this)" class="kw-filter-btn kw-filter-active" data-filter="lang" data-val="all"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:white;font-size:0.7rem;font-weight:700;cursor:pointer;">Tous</button>
                    <button onclick="kwFilter('lang','fr',this)" class="kw-filter-btn" data-filter="lang" data-val="fr"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#94a3b8;font-size:0.7rem;cursor:pointer;">🇫🇷 FR</button>
                    <button onclick="kwFilter('lang','ar',this)" class="kw-filter-btn" data-filter="lang" data-val="ar"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#94a3b8;font-size:0.7rem;cursor:pointer;">🇸🇦 AR</button>
                    <button onclick="kwFilter('lang','en',this)" class="kw-filter-btn" data-filter="lang" data-val="en"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#94a3b8;font-size:0.7rem;cursor:pointer;">🇬🇧 EN</button>
                </div>
            </div>
            <span style="color:rgba(255,255,255,0.08);font-size:1.1rem;">|</span>
            <!-- Intent -->
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.7rem;color:#64748b;font-weight:700;text-transform:uppercase;">${isAr?'النية':'Intent'}</span>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    <button onclick="kwFilter('intent','all',this)" class="kw-filter-btn kw-filter-active" data-filter="intent" data-val="all"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:white;font-size:0.7rem;font-weight:700;cursor:pointer;">${isAr?'الكل':'Tous'}</button>
                    <button onclick="kwFilter('intent','Transactional',this)" class="kw-filter-btn" data-filter="intent" data-val="Transactional"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(16,185,129,0.4);background:rgba(16,185,129,0.08);color:#10b981;font-size:0.7rem;font-weight:700;cursor:pointer;">💰 Trans.</button>
                    <button onclick="kwFilter('intent','Commercial',this)" class="kw-filter-btn" data-filter="intent" data-val="Commercial"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(59,130,246,0.4);background:rgba(59,130,246,0.08);color:#3b82f6;font-size:0.7rem;font-weight:700;cursor:pointer;">🛒 Comm.</button>
                    <button onclick="kwFilter('intent','Informational',this)" class="kw-filter-btn" data-filter="intent" data-val="Informational"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(100,116,139,0.4);background:rgba(100,116,139,0.08);color:#94a3b8;font-size:0.7rem;font-weight:700;cursor:pointer;">ℹ️ Info</button>
                    <button onclick="kwFilter('intent','Navigational',this)" class="kw-filter-btn" data-filter="intent" data-val="Navigational"
                        style="padding:3px 9px;border-radius:6px;border:1px solid rgba(139,92,246,0.4);background:rgba(139,92,246,0.08);color:#a78bfa;font-size:0.7rem;font-weight:700;cursor:pointer;">🔍 Nav.</button>
                </div>
            </div>
            <span style="color:rgba(255,255,255,0.08);font-size:1.1rem;">|</span>
            <!-- ══ MAJ 3 — Filtre Quick Wins ══ -->
            <div style="display:flex;align-items:center;gap:6px;">
                <button onclick="kwFilter('quickwin','true',this)" class="kw-filter-btn" data-filter="quickwin" data-val="true"
                    style="padding:3px 9px;border-radius:6px;border:1px solid rgba(16,185,129,0.4);background:rgba(16,185,129,0.08);color:#10b981;font-size:0.7rem;font-weight:700;cursor:pointer;">
                    ⚡ Quick Wins seulement
                </button>
            </div>
            <div style="margin-left:auto;font-size:0.75rem;color:#64748b;">
                <span id="kwFilterCount" style="color:#22d3ee;font-weight:700;">${kwList.length}</span>
                ${isAr?' نتيجة':' résultats'}
            </div>
        </div>`;

    /* ── Rows ─────────────────────────────────────────────────── */
    const listHtml = kwList.map((kw) => {
        const langFlag = kw.language === 'fr' ? '🇫🇷' : (kw.language === 'ar' ? '🇸🇦' : '🇬🇧');
        const kdVal    = parseInt(kw.kd) || 0;
        const kdColors = getKdColor(kdVal);
        const cpcVal   = parseFloat(kw.cpc) || 0;
        const source   = kw.fromSerpRelated ? 'terrain' : 'synthese';
        const isQuick  = kw.quickWin;

        return `
        <tr data-kd="${kdVal}" data-lang="${kw.language}" data-intent="${kw.intent || 'Informational'}" data-source="${source}" data-quickwin="${isQuick ? 'true' : 'false'}"
            style="border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.2s;${isQuick ? 'background:rgba(16,185,129,0.03);' : ''}"
            onmouseover="this.style.background='rgba(255,255,255,0.03)'"
            onmouseout="this.style.background='${isQuick ? 'rgba(16,185,129,0.03)' : 'transparent'}'">
            <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:1.1rem;opacity:0.8;flex-shrink:0;">${langFlag}</span>
                    <div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <strong style="color:#e2e8f0;font-size:0.95rem;font-family:'Almarai',sans-serif;word-break:break-word;">${kw.keyword}</strong>
                            ${isQuick ? '<span style="background:rgba(16,185,129,0.18);color:#10b981;padding:1px 6px;border-radius:4px;font-size:0.62rem;font-weight:800;">WIN</span>' : ''}
                            ${kw.seasonality && kw.seasonality !== 'evergreen' ? `<span style="background:rgba(245,158,11,0.12);color:#f59e0b;padding:1px 6px;border-radius:4px;font-size:0.62rem;font-weight:700;">📅 ${kw.seasonality}</span>` : ''}
                        </div>
                        ${kw.painPoint ? `<div style="font-size:0.7rem;color:#64748b;margin-top:2px;">💊 ${kw.painPoint}</div>` : ''}
                    </div>
                </div>
            </td>
            <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${getIntentBadge(kw.intent)}</td>
            <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;color:white;font-weight:700;font-family:monospace;font-size:0.9rem;">${formatVol(kw.volume)}</td>
            <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:${kdColors.bg};border:1px solid ${kdColors.border};color:${kdColors.text};font-weight:800;font-size:0.8rem;">${kdVal}</div>
            </td>
            <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${getTrendBadge(kw.trend, kw.trendScore)}</td>
            <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;color:#94a3b8;font-family:monospace;font-size:0.85rem;">
                ${cpcVal > 0 ? '$' + cpcVal.toFixed(2) : '<span style="color:rgba(255,255,255,0.2);">—</span>'}
            </td>
            <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
                ${source === 'terrain'
                    ? '<span style="background:rgba(6,182,212,0.15);color:#22d3ee;padding:2px 7px;border-radius:4px;font-size:0.65rem;font-weight:700;">Terrain</span>'
                    : '<span style="background:rgba(148,163,184,0.15);color:#cbd5e1;padding:2px 7px;border-radius:4px;font-size:0.65rem;font-weight:700;">Synthese</span>'}
            </td>
            <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;color:#94a3b8;font-size:0.78rem;">${geo}</td>
        </tr>`;
    }).join('');

    /* ══════════════════════════════════════════════════════
       MAJ 4 — Section Clusters PAA (si données disponibles)
    ══════════════════════════════════════════════════════ */
    const clustersHtml = STATE.lastKeywords.clusters?.length ? `
        <div style="padding:16px 20px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.1);">
            <div style="font-size:0.72rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:10px;">
                🗂️ ${isAr ? 'المجموعات' : isEn ? 'Clusters' : 'Clusters Sémantiques'} — ${STATE.lastKeywords.clusters.length}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${STATE.lastKeywords.clusters.map(c => `
                    <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:8px 14px;max-width:260px;">
                        <div style="font-size:0.78rem;font-weight:700;color:#a78bfa;margin-bottom:4px;">${c.name || c.intent || 'Cluster'}</div>
                        <div style="font-size:0.7rem;color:#64748b;">${Array.isArray(c.keywords) ? c.keywords.slice(0,4).join(', ') : ''}</div>
                        ${c.opportunity ? `<div style="font-size:0.65rem;color:#10b981;margin-top:3px;">💡 ${c.opportunity}</div>` : ''}
                    </div>`).join('')}
            </div>
        </div>` : '';

    const paaHtml = STATE.lastKeywords.paaQuestions?.length ? `
        <div style="padding:16px 20px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.08);">
            <div style="font-size:0.72rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:10px;">
                ❓ ${isAr ? 'أسئلة الناس' : isEn ? 'People Also Ask' : 'Questions PAA'} — ${STATE.lastKeywords.paaQuestions.length}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                ${STATE.lastKeywords.paaQuestions.slice(0, 8).map(q => `
                    <div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:rgba(6,182,212,0.05);border:1px solid rgba(6,182,212,0.12);border-radius:8px;">
                        <span style="color:#22d3ee;font-size:0.72rem;flex-shrink:0;">?</span>
                        <span style="font-size:0.82rem;color:#cbd5e1;">${typeof q === 'object' ? q.question : q}</span>
                        ${typeof q === 'object' && q.answerFormat ? `<span style="margin-left:auto;font-size:0.65rem;color:#64748b;flex-shrink:0;">${q.answerFormat}</span>` : ''}
                    </div>`).join('')}
            </div>
        </div>` : '';

    /* ── Container HTML final ─────────────────────────────────── */
    const keywordReportLabels = getReportLabels({ isAr, isEn });
    const keywordsCoreHtml = `
        <div class="result-card fade-in-up" style="border-top:3px solid var(--accent-info);padding:0;overflow:hidden;" dir="${dir}">

            <!-- HEADER -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:20px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.2);">
                <div>
                    <h3 style="margin:0;font-family:'Cairo';color:white;font-size:1.15rem;display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-database" style="color:var(--accent-info);"></i>
                        ${t.title}
                        <span style="background:rgba(6,182,212,0.15);color:#22d3ee;padding:2px 8px;border-radius:20px;font-size:0.75rem;">${kwList.length}</span>
                    </h3>
                    ${STATE.lastKeywords.seed ? `<div style="font-size:0.72rem;color:#64748b;margin-top:4px;">Seed : <strong style="color:#a78bfa;">${STATE.lastKeywords.seed}</strong> · ${STATE.lastKeywords.languages?.join(', ')} · ${STATE.lastKeywords.geoInput}</div>` : ''}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                    <button class="btn btn-secondary" type="button" data-no-collapse="true" onclick="event.stopPropagation();window.copyKwsSafely()" style="padding:7px 14px;font-size:0.75rem;border-radius:8px;flex-shrink:0;">
                        <i class="fas fa-copy"></i> ${t.copy}
                    </button>
                    <button class="btn btn-secondary" type="button" data-no-collapse="true" onclick="event.stopPropagation();window.exportKeywordsToExcel()" style="padding:7px 14px;font-size:0.75rem;border-radius:8px;flex-shrink:0;background:rgba(16,185,129,.14);border-color:rgba(16,185,129,.35);color:#bbf7d0;">
                        <i class="fas fa-file-excel"></i> ${isAr ? 'Excel' : isEn ? 'Export Excel' : 'Exporter Excel'}
                    </button>
                </div>
            </div>

            ${statsBadges}
            ${assistantsBarHtml}
            ${filterBarHtml}

            <!-- TABLE -->
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;min-width:720px;">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.02);">
                            <th style="padding:12px;text-align:${isAr?'right':'left'};color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);">${t.kw}</th>
                            <th style="padding:12px;text-align:center;color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);">${t.intent}</th>
                            <th style="padding:12px;text-align:center;color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);">${t.volume}</th>
                            <th style="padding:12px;text-align:center;color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);">${t.kd}</th>
                            <th style="padding:12px;text-align:center;color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);">${t.trend}</th>
                            <th style="padding:12px;text-align:center;color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);">${t.cpc}</th>
                            <th style="padding:12px;text-align:center;color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);">${t.source}</th>
                            <th style="padding:12px;text-align:center;color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.08);">${t.geo}</th>
                        </tr>
                    </thead>
                    <tbody id="kwTableBody">
                        ${listHtml || `<tr><td colspan="8" style="text-align:center;padding:40px;color:#64748b;font-size:0.9rem;">${t.noData}</td></tr>`}
                    </tbody>
                </table>
            </div>

            ${clustersHtml}
            ${paaHtml}
        </div>`;

    container.innerHTML = `
        ${renderExecutiveSummary(data, 'keywords', { isAr, isEn })}
        ${renderReportSection('keywords', keywordReportLabels.keywords, keywordReportLabels.keywordsSub, 'fa-key', keywordsCoreHtml, { isAr, isEn, noCollapse: true })}
        ${renderExpertDock('social', { isAr, isEn })}
    `;

    /* ══════════════════════════════════════════════════════
       MAJ 5 — kwFilter : ajout du filtre quickwin + reset visuel
    ══════════════════════════════════════════════════════ */
    window.kwFilter = function(type, val, btn) {
        // ── Mettre à jour le bouton actif AVANT de filtrer (fix double-clic) ──
        document.querySelectorAll(`.kw-filter-btn[data-filter="${type}"]`).forEach(b => {
            b.classList.remove('kw-filter-active');
            b.style.background = 'transparent';
            b.style.color      = '#64748b';
            b.style.fontWeight = '600';
        });
        if (btn) {
            btn.classList.add('kw-filter-active');
            btn.style.background  = 'rgba(255,255,255,0.1)';
            btn.style.color       = 'white';
            btn.style.fontWeight  = '800';
        }

        // Lire l'état actif maintenant que les classes sont à jour
        const activKd     = document.querySelector('.kw-filter-btn[data-filter="kd"].kw-filter-active')?.dataset.val     || 'all';
        const activLang   = document.querySelector('.kw-filter-btn[data-filter="lang"].kw-filter-active')?.dataset.val   || 'all';
        const activIntent = document.querySelector('.kw-filter-btn[data-filter="intent"].kw-filter-active')?.dataset.val || 'all';
        const activQw     = document.querySelector('.kw-filter-btn[data-filter="quickwin"].kw-filter-active')?.dataset.val;

        const rows = document.querySelectorAll('#kwTableBody tr');
        let visible = 0;
        rows.forEach(row => {
            const kd       = parseInt(row.dataset.kd)      || 0;
            const lang     = row.dataset.lang              || '';
            const intent   = (row.dataset.intent          || '').toLowerCase();
            const quickwin = row.dataset.quickwin          === 'true';

            const matchKd     = activKd     === 'all' || (activKd === 'easy' && kd <= 29) || (activKd === 'medium' && kd >= 30 && kd <= 69) || (activKd === 'hard' && kd >= 70);
            const matchLang   = activLang   === 'all' || lang    === activLang;
            const matchIntent = activIntent === 'all' || intent.includes(activIntent.toLowerCase());
            const matchQw     = !activQw    || activQw !== 'true' || quickwin;

            const show = matchKd && matchLang && matchIntent && matchQw;
            row.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        const countEl = document.getElementById('kwFilterCount');
        if (countEl) countEl.textContent = visible;
    };

    /* ══════════════════════════════════════════════════════
       MAJ 6 — copyKwsSafely robuste (copie toutes les kws)
    ══════════════════════════════════════════════════════ */
    window.copyKwsSafely = function() {
        const kws = STATE.lastKeywords?.keywords || [];
        if (!kws.length) return toast?.warning?.('Aucun mot-clé à copier') || alert('Aucun mot-clé');
        const text = kws.map(k => k.keyword).filter(Boolean).join('\n');
        const fallback = () => {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                toast?.success?.(`${kws.length} mots-clés copiés !`);
            }).catch(fallback);
        } else { fallback(); toast?.success?.(`${kws.length} mots-clés copiés !`); }
    };

    if (typeof showResults === 'function') showResults('resultsKeywords');
}

// ═══════════════════════════════════════════════════════════════════
// 📋 COPIE ENRICHIE — keyword | intent | volume
// ═══════════════════════════════════════════════════════════════════
window.copyKwsSafely = function() {
    if (!STATE.lastKeywords?.length) return;

    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';

    // Format: "keyword | intent | vol:1.2K | KD:35 | $1.20"
    const txt = STATE.lastKeywords.map(k => {
        const vol = k.volume >= 1000 ? (k.volume/1000).toFixed(1)+'K' : (k.volume || 0);
        return `${k.keyword} | ${k.intent || 'Info'} | vol:${vol} | KD:${k.kd ?? 0} | $${parseFloat(k.cpc||0).toFixed(2)}`;
    }).join('\n');

    navigator.clipboard.writeText(txt).then(() => {
        const msg = isAr ? `تم نسخ ${STATE.lastKeywords.length} كلمة!`
                  : isEn ? `${STATE.lastKeywords.length} keywords copied!`
                  :        `${STATE.lastKeywords.length} mots-clés copiés !`;
        if (typeof toast !== 'undefined') toast.success(msg);

        const btn = document.querySelector('button[onclick="window.copyKwsSafely()"]');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> ✓';
            btn.style.color = '#10b981';
            setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
        }
    }).catch(() => {
        if (typeof toast !== 'undefined') toast.error('Clipboard error');
    });
};

// Nouvelle fonction de copie qui ne fait pas planter le navigateur
// ═══════════════════════════════════════════════════════════════════
// 📋 COPIE SÉCURISÉE ET ANIMÉE DES MOTS-CLÉS
// ═══════════════════════════════════════════════════════════════════

window.copyKwsSafely = function() {
    // 1. Vérification de la présence de données
    if (!STATE.lastKeywords || STATE.lastKeywords.length === 0) {
        return;
    }

    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';

    // 2. Préparation du texte (uniquement les mots-clés, un par ligne)
    const txt = STATE.lastKeywords.map(k => k.keyword).join('\n');

    // 3. Utilisation de l'API Clipboard
    navigator.clipboard.writeText(txt).then(() => {
        // A. Notification Toast Multilingue
        const successMsg = isAr
            ? 'تم نسخ قائمة الكلمات بنجاح!'
            : (isEn ? 'Keyword list copied to clipboard!' : 'Liste de mots-clés copiée avec succès !');

        if (typeof toast !== 'undefined') {
            toast.success(successMsg);
        }

        // B. Animation visuelle du bouton (Feedback Chirurgical)
        const btn = document.querySelector('button[onclick="window.copyKwsSafely()"]');
        if (btn) {
            const originalHtml = btn.innerHTML;
            const originalBg = btn.style.background;

            // État "Succès"
            btn.innerHTML = `<i class="fas fa-check"></i> ${isAr ? 'تم النسخ' : (isEn ? 'COPIED' : 'COPIÉ')}`;
            btn.style.background = 'var(--accent-success)';
            btn.style.pointerEvents = 'none'; // Évite le double clic pendant l'animation

            // Retour à l'état initial après 2.5 secondes
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = originalBg;
                btn.style.pointerEvents = 'auto';
            }, 2500);
        }
    }).catch(err => {
        console.error('❌ Erreur lors de la copie:', err);
        const errorMsg = isAr ? 'خطأ في النسخ' : 'Erreur lors de la copie';
        if (typeof toast !== 'undefined') toast.error(errorMsg);
    });
};

function getDakaKeywordExportRows() {
    const raw = STATE.lastKeywords || {};
    const data = Array.isArray(raw) ? { keywords: raw } : raw;
    const keywords = Array.isArray(data.keywords) ? data.keywords : [];
    return keywords.map((kw, index) => ({
        rank: index + 1,
        keyword: String(kw.keyword || kw.query || '').trim(),
        language: String(kw.language || kw.lang || '').trim(),
        intent: String(kw.intent || '').trim(),
        volume: kw.volume ?? '',
        kd: kw.kd ?? kw.difficulty ?? '',
        cpc: kw.cpc ?? '',
        trend: String(kw.trend || '').trim(),
        trendScore: kw.trendScore ?? '',
        quickWin: kw.quickWin ? 'YES' : 'NO',
        source: kw.fromSerpRelated ? 'Terrain' : (kw.source || 'Synthese'),
        geo: data.geoResolved || data.geo || data.geoInput || '',
        cluster: String(kw.cluster || kw.clusterName || '').trim(),
        painPoint: String(kw.painPoint || '').trim(),
        seasonality: String(kw.seasonality || '').trim()
    })).filter(row => row.keyword);
}

function escapeExcelCell(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.exportKeywordsToExcel = function () {
    const lang = STATE.currentLang || 'fr';
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    const rows = getDakaKeywordExportRows();
    if (!rows.length) {
        return toast.warning(isAr ? 'لا توجد كلمات للتصدير.' : isEn ? 'No keywords to export.' : 'Aucun mot-clé à exporter.');
    }
    const headers = [
        'Rank', 'Keyword', 'Language', 'Intent', 'Volume', 'KD', 'CPC',
        'Trend', 'Trend Score', 'Quick Win', 'Source', 'Geo', 'Cluster',
        'Pain Point', 'Seasonality'
    ];
    const htmlRows = rows.map(row => `
        <tr>
            <td>${escapeExcelCell(row.rank)}</td>
            <td>${escapeExcelCell(row.keyword)}</td>
            <td>${escapeExcelCell(row.language)}</td>
            <td>${escapeExcelCell(row.intent)}</td>
            <td>${escapeExcelCell(row.volume)}</td>
            <td>${escapeExcelCell(row.kd)}</td>
            <td>${escapeExcelCell(row.cpc)}</td>
            <td>${escapeExcelCell(row.trend)}</td>
            <td>${escapeExcelCell(row.trendScore)}</td>
            <td>${escapeExcelCell(row.quickWin)}</td>
            <td>${escapeExcelCell(row.source)}</td>
            <td>${escapeExcelCell(row.geo)}</td>
            <td>${escapeExcelCell(row.cluster)}</td>
            <td>${escapeExcelCell(row.painPoint)}</td>
            <td>${escapeExcelCell(row.seasonality)}</td>
        </tr>`).join('');
    const workbook = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
body{font-family:Calibri,Arial,sans-serif}
table{border-collapse:collapse;width:100%}
th{background:#0f172a;color:#fff;font-weight:700}
td,th{border:1px solid #d9e2ef;padding:8px;mso-number-format:"\\@";}
tr:nth-child(even) td{background:#f8fafc}
.yes{color:#047857;font-weight:700}
</style>
</head>
<body>
<h1>Daka Keywords Intelligence</h1>
<p>${escapeExcelCell(isAr ? 'جدول الكلمات المفتاحية قابل للفرز والتحليل.' : isEn ? 'Keyword table ready for sorting and analysis.' : 'Tableau mots-clés prêt pour tri et analyse.')}</p>
<table>
<thead><tr>${headers.map(h => `<th>${escapeExcelCell(h)}</th>`).join('')}</tr></thead>
<tbody>${htmlRows}</tbody>
</table>
</body>
</html>`;
    const blob = new Blob(['\ufeff', workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const slug = String(STATE.lastKeywords?.seed || STATE.lastInputs?.seedKeyword || 'keywords')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 34) || 'keywords';
    const a = document.createElement('a');
    a.href = url;
    a.download = `Daka-Keywords-${slug}-${Date.now()}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast.success(isAr ? 'تم تحميل ملف Excel.' : isEn ? 'Excel file downloaded.' : 'Fichier Excel téléchargé.');
};

window.copyKwsSafely = function() {
    const rows = getDakaKeywordExportRows();
    if (!rows.length) return toast?.warning?.('Aucun mot-clé à copier') || alert('Aucun mot-clé à copier');
    const text = rows.map(row => `${row.keyword}\t${row.intent}\t${row.volume}\t${row.kd}\t${row.cpc}`).join('\n');
    const successMsg = STATE.currentLang === 'ar'
        ? `تم نسخ ${rows.length} كلمة.`
        : STATE.currentLang === 'en'
            ? `${rows.length} keywords copied.`
            : `${rows.length} mots-clés copiés.`;
    const done = () => toast?.success?.(successMsg);
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            done();
        });
    }
};
function getScoreColor(score) {
    if (score >= 80) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
}

function getScoreBadgeClass(score) {
    if (score >= 80) return 'badge-success';
    if (score >= 50) return 'badge-warning';
    return 'badge-danger';
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    if (typeof text === 'number') return Number.isFinite(text) ? String(text) : '';
    if (typeof text === 'boolean') return text ? 'true' : 'false';
    if (typeof text === 'object') {
        try {
            text = JSON.stringify(text);
        } catch {
            return '';
        }
    }
    text = repairMojibakeString(String(text));
    if (/^\s*(null|undefined|nan|\[object object\])\s*$/i.test(text)) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function cleanRenderedOutput(root) {
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const dirtyToken = /(\bnull\b|\bundefined\b|\bNaN\b|\[object Object\])/gi;
    const emptyDash = /^\s*(?:[-–—:|/()\[\]{}.,;]+)?\s*$/;
    const leakedRuntimePattern = /(const\s+blob\s*=\s*new\s+Blob|function\s+(?:animateLoadingSteps|getReportLabels|renderGroqCodePreview|renderOpenRouterCodePreview|getDakaExportModules)|window\.exportFullAnalysisTo(?:PDF|Word)|\$\{safe\(|\$\{model\.score|pulseItems\.map|dashboardItems\.map|mindItems\.map|const\s+headerHtml\s*=|Daka report runtime served by the backend|STATE GLOBAL|CONFIGURATION GLOBALE|ANALYZE COMPETITORS)/i;
    const textNodes = [];

    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(node => {
        const original = node.nodeValue || '';
        if (original.length > 140 && leakedRuntimePattern.test(original)) {
            node.remove();
            return;
        }
        const cleaned = repairMojibakeString(original.replace(dirtyToken, '').replace(/\s{2,}/g, ' '));
        node.nodeValue = cleaned;

        const parent = node.parentElement;
        if (parent && emptyDash.test(parent.textContent || '') && !parent.querySelector('img,canvas,svg,a,button,input,select,textarea')) {
            parent.style.display = 'none';
        }
    });
    repairVisibleMojibake(root);
    requestAnimationFrame(() => enhanceReportNavigation(root));
}

function setButtonLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.disabled = loading;
        btn.innerHTML = loading ? '<i class="fas fa-spinner fa-spin"></i> Analyse...' : '<i class="fas fa-search"></i> Analyser';
    }
}


// ── Steps automatiques ────────────────────────────────────────
function animateLoadingSteps(loaderId, delays = [1200, 2800, 5000]) {
  if (!window._loadingTimers) window._loadingTimers = {};
  window._loadingTimers[loaderId] = [];
  const el = document.getElementById(loaderId);
  if (!el) return;

  delays.forEach((delay, idx) => {
    const t = setTimeout(() => {
      const stepNum = idx + 2;
      el.querySelectorAll('.loading-step').forEach(s => {
        const n = parseInt(s.dataset.step);
        if (n < stepNum)  { s.classList.add('done');   s.classList.remove('active'); }
        if (n === stepNum){ s.classList.add('active'); s.classList.remove('done');  }
        if (n > stepNum)  { s.classList.remove('active', 'done'); }
      });
    }, delay);
    window._loadingTimers[loaderId].push(t);
  });
}

// ── Helpers résultats ──────────────────────────────────────────
function showResults(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'block';
    requestAnimationFrame(() => enhanceReportNavigation(el));
  }
}

function hideResults(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ── setLoaderPhase (phases depuis fetch) ──────────────────────
function setLoaderPhase(elementId, index) {
  const wrap = document.getElementById(elementId);
  if (!wrap) return;
  const phases = wrap.querySelectorAll('.loading-phase');
  const bar    = wrap.querySelector('.loading-progress-bar');
  phases.forEach((p, i) => {
    p.classList.remove('active', 'done');
    if (i < index)  p.classList.add('done');
    if (i === index) p.classList.add('active');
  });
  if (bar) bar.style.width = `${Math.round((index + 0.5) / phases.length * 100)}%`;
}


function getReportLabels(opts = {}) {
    const isAr = opts.isAr ?? STATE.currentLang === 'ar';
    const isEn = opts.isEn ?? STATE.currentLang === 'en';
    return isAr ? {
        openHint: 'عرض التفاصيل',
        closeHint: 'إغلاق',
        market: 'افهم لماذا يربح المنافسون — وكيف تتجاوزهم',
        marketSub: 'القيمة الأساسية ظاهرة هنا أولا، والتفاصيل تبقى متاحة عند الحاجة.',
        plan: 'الخطوة الأقوى لجعل عرضك أفضل',
        planSub: 'ملخص عملي لما يجب تغييره في العرض، الرسالة، والثقة.',
        competitors: 'المنافسون الذين يكشفون فرصة السوق',
        competitorsSub: 'من يربح الآن، أين قوته، وأين توجد الثغرة التي يمكنك استغلالها.',
        proof: 'الأدلة والمصادر',
        proofSub: 'روابط ودراسات تساعد على التحقق والتعمق.',
        audit: 'تشخيص الصفحة',
        auditSub: 'النقاط القوية، الضعف، والمشاكل التي تؤثر على القرار.',
        money: 'العرض والسعر والثقة',
        moneySub: 'ما يجعل الزائر يقتنع أو يتردد قبل اتخاذ القرار.',
        page: 'الأقسام والنصوص',
        pageSub: 'ما يجب تغييره في بنية الصفحة والكلمات والأزرار.',
        technical: 'الأولويات التقنية',
        technicalSub: 'المشاكل التي تؤثر على الثقة، القراءة، السرعة، والبنية.',
        keywords: 'فرص البحث والمحتوى',
        keywordsSub: 'طلبات الجمهور والأسئلة والمواضيع التي يمكن تحويلها إلى محتوى.',
        expertsSub: 'اختر خبيرا حسب حاجتك: تلخيص، زاوية سوق، صفحة بيع أو محتوى.',
        openExpert: 'فتح الخبير'
    } : isEn ? {
        openHint: 'View details',
        closeHint: 'Close',
        market: 'Understand why competitors win — and how to pass them',
        marketSub: 'The core value is visible first; deeper evidence stays one click away.',
        plan: 'Your strongest opening to improve the offer',
        planSub: 'A practical summary of what to change in offer, message, and trust.',
        competitors: 'Competitors that reveal the market opportunity',
        competitorsSub: 'Who wins now, where they are strong, and where you can attack.',
        proof: 'Proof and sources',
        proofSub: 'Links and studies to verify and go deeper.',
        audit: 'Page diagnosis',
        auditSub: 'Strengths, weaknesses, and problems that influence the decision.',
        money: 'Offer, price, and trust',
        moneySub: 'What convinces visitors or makes them hesitate before acting.',
        page: 'Sections and copy',
        pageSub: 'What to change in page structure, words, and buttons.',
        technical: 'Technical priorities',
        technicalSub: 'Issues affecting trust, reading, speed, and structure.',
        keywords: 'Search and content opportunities',
        keywordsSub: 'Audience requests, questions, and topics that can become content.',
        expertsSub: 'Choose an expert for summary, market angle, sales page, or content.',
        openExpert: 'Open expert'
    } : {
        openHint: 'Voir les détails',
        closeHint: 'Fermer',
        market: 'Comprenez pourquoi vos concurrents gagnent — et comment les dépasser',
        marketSub: 'La valeur principale est visible tout de suite; les preuves restent accessibles en un clic.',
        plan: 'Votre meilleure ouverture pour rendre l’offre plus forte',
        planSub: 'Le résumé opérationnel de ce qu’il faut changer dans l’offre, le message et la confiance.',
        competitors: 'Les concurrents qui révèlent votre opportunité',
        competitorsSub: 'Qui gagne maintenant, où ils sont forts, et où vous pouvez attaquer.',
        proof: 'Preuves et sources',
        proofSub: 'Liens et études pour vérifier et approfondir.',
        audit: 'Diagnostic de la page',
        auditSub: 'Forces, faiblesses et problèmes qui influencent la décision.',
        money: 'Offre, prix et confiance',
        moneySub: 'Ce qui convainc ou fait hésiter avant de passer à l’action.',
        page: 'Sections et textes',
        pageSub: 'Ce qu’il faut changer dans la structure, les mots et les boutons.',
        technical: 'Priorités techniques',
        technicalSub: 'Problèmes qui touchent confiance, lecture, vitesse et structure.',
        keywords: 'Opportunités de recherche et contenu',
        keywordsSub: 'Demandes, questions et sujets du public à transformer en contenu.',
        expertsSub: 'Choisissez un expert pour résumer, trouver l’angle, corriger la page ou créer du contenu.',
        openExpert: 'Ouvrir l’expert'
    };
}

function getAnalysisDisplayLang(data = {}, fallback = STATE.currentLang || 'fr') {
    const raw = String(
        data?.analysisLang ||
        data?.userLang ||
        data?.lang ||
        data?.language ||
        data?.request?.lang ||
        fallback ||
        'fr'
    ).toLowerCase().slice(0, 2);
    return ['fr', 'en', 'ar'].includes(raw) ? raw : 'fr';
}

function summarizeReportHtml(html, fallback = '') {
    const scriptTagPattern = new RegExp('<' + 'script[\\s\\S]*?<\\/' + 'script>', 'gi');
    const styleTagPattern = new RegExp('<' + 'style[\\s\\S]*?<\\/' + 'style>', 'gi');
    const raw = String(html || '')
        .replace(scriptTagPattern, ' ')
        .replace(styleTagPattern, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\b(null|undefined|NaN)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const source = raw || String(fallback || '').trim();
    return source.length > 280 ? source.slice(0, 277).trim() + '...' : source;
}

function executiveText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (Array.isArray(value)) return executiveText(value[0]);
    if (typeof value === 'object') {
        return executiveText(
            value.action || value.changeNow || value.recommendation || value.howTo ||
            value.title || value.name || value.opportunity || value.issue ||
            value.problem || value.weakness || value.keyword || value.value || value.description
        );
    }
    return '';
}

function executiveFingerprint(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

function executiveIsUsefulText(value) {
    const text = executiveText(value);
    if (!text) return false;
    if (/^(?:—|-|_|n\/a|null|undefined|non trouvé|not found|غير مؤكد)$/i.test(text.trim())) return false;
    if (/\b(?:html|css|script|class=|onclick|undefined|null)\b/i.test(text)) return false;
    return text.trim().length > 2;
}

function executiveDedupList(values, limit = 5) {
    const items = [];
    const seen = new Set();
    const visit = (value) => {
        if (items.length >= limit || value === null || value === undefined) return;
        if (Array.isArray(value)) return value.forEach(visit);
        const text = sanitizeDakaBusinessVocabularyForContext(executiveText(value)).replace(/\s+/g, ' ').trim();
        const key = executiveFingerprint(text);
        if (!executiveIsUsefulText(text) || seen.has(key)) return;
        seen.add(key);
        items.push(text);
    };
    visit(values);
    return items.slice(0, limit);
}

function executiveList(sources, limit = 5) {
    return executiveDedupList(sources, limit);
}

function executiveActions(data) {
    const raw = [
        data.concreteActionPlan,
        data.actionRoadmap,
        data.auditQuickWins,
        data.quickWins,
        data.executiveBrief?.actions,
        data.roadmap,
        data.recommendations,
        data.criticalIssues,
        data.auditIssues,
        data.semanticDifferences,
        data.keywordStrategy?.missingGaps,
        data.clusters
    ].flatMap(value => Array.isArray(value) ? value : value ? [value] : []);

    const seen = new Set();
    return raw.map((item, index) => ({
        title: sanitizeDakaBusinessVocabularyForContext(executiveText(item)),
        impact: executiveText(item?.impact || item?.expectedGain),
        effort: executiveText(item?.effort || item?.timeline || item?.delay),
        priority: executiveText(item?.priority || item?.rank) || String(index + 1)
    })).filter(item => {
        const key = executiveFingerprint(item.title);
        if (!executiveIsUsefulText(item.title) || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 7);
}

function executiveScore(data, type) {
    const candidates = [
        data.auditSummary?.overallScore,
        data.globalScoring?.overall,
        data.globalReport?.score,
        data.seoScore,
        data.score,
        data.overallScore,
        data.stats?.opportunityScore
    ];
    const direct = candidates.find(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
    if (direct !== undefined) return Math.max(0, Math.min(100, Math.round(Number(direct))));
    if (type === 'competitors' && Array.isArray(data.comparisonScores?.competitor)) {
        const values = data.comparisonScores.competitor.map(Number).filter(Number.isFinite);
        if (values.length) return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }
    return null;
}

function executiveKeywordCloud(data, limit = 10) {
    const raw = [
        data?.rawIntel?.title,
        data?.rawIntel?.h1,
        data?.rawIntel?.metaDescription,
        data?.rawIntel?.bodyText,
        data?.rawIntel?.text,
        data?.evidencePayload?.evidenceText,
        data?.funnelEvidenceSynthesis?.evidenceText,
        data?.copyIntel?.realCTAs?.map(item => item.text || item),
        data?.rawIntel?.headings?.map(item => item.text || item),
        data?.rawIntel?.ctas?.map(item => item.text || item)
    ].flat().filter(Boolean).join(' ');
    const stop = new Set('le la les des de du un une et ou pour avec dans sur au aux ce cette ces est sont votre vos vous nous que qui plus moins now the and for with from this that are your vous votre الصفحة على من في الى إلى هذا هذه التي ما عن مع'.split(/\s+/));
    const counts = new Map();
    String(raw || '')
        .replace(/[^\p{L}\p{N}\s#€$%.-]/gu, ' ')
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length >= 3 && word.length <= 28 && !stop.has(word.toLowerCase()))
        .forEach(word => {
            const key = word.toLowerCase();
            counts.set(key, { label: word, count: (counts.get(key)?.count || 0) + 1 });
        });
    return [...counts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(item => item.label);
}

function buildFunnelExecutiveSummaryModel(data, lang = STATE.currentLang || 'fr') {
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    const t = isAr ? {
        fallback: 'الصفحة قابلة للتحويل، لكن القرار يحتاج وضوحا أقوى في الوعد والدليل والإجراء.',
        verdictStrong: 'الصفحة تملك إشارات بيع حقيقية، والفرصة الآن هي تحويلها إلى مسار قرار أسرع وأكثر ثقة.',
        verdictMedium: 'الصفحة تبيع جزئيا، لكن بعض الإشارات الحاسمة ما زالت تحتاج ترتيبا أو دليلا أو وضوحا قبل الزر.',
        verdictRisk: 'القراءة غير كافية للحكم النهائي. يجب تقوية الأدلة المرصودة قبل إصدار قرار استراتيجي.',
        observed: 'ما تم إثباته',
        missing: 'ما يهدد القرار',
        action: 'الحركة التالية',
        high: 'مرتفع',
        medium: 'متوسط',
        low: 'منخفض',
        rewrite: 'حوّل الشاشة الأولى إلى وعد واضح + دليل سريع + زر قرار واحد.',
        proof: 'ضع أقوى دليل اجتماعي أو ضمان قبل أول زر قرار.',
        cta: 'وحّد فعل CTA في الأعلى والسعر والنهاية حتى لا يتردد الزائر.',
        order: 'أعد ترتيب الصفحة: وعد، دليل، عرض، سعر، اعتراضات، ثم CTA نهائي.',
        verify: 'ثبّت كل ادعاء بدليل مرئي: تقييم، صورة، ضمان، سعر أو شرط واضح.'
    } : isEn ? {
        fallback: 'The page can convert, but the decision path needs stronger promise, proof, and action clarity.',
        verdictStrong: 'The page already has real selling signals. The opportunity is to turn them into a faster, more trusted decision path.',
        verdictMedium: 'The page sells partially, but key decision signals still need better order, proof, or clarity before the CTA.',
        verdictRisk: 'The read is not strong enough for a final strategic judgment. Evidence must be strengthened first.',
        observed: 'What is proven',
        missing: 'What threatens the decision',
        action: 'Next move',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        rewrite: 'Turn the first screen into one clear promise + fast proof + one decision CTA.',
        proof: 'Place the strongest social proof or guarantee before the first decision button.',
        cta: 'Use the same CTA verb in the hero, pricing block, and final section.',
        order: 'Rebuild the sequence: promise, proof, offer, price, objections, final CTA.',
        verify: 'Attach each claim to visible proof: review, image, guarantee, price, or clear condition.'
    } : {
        fallback: 'La page peut convertir, mais le chemin de décision doit rendre la promesse, la preuve et l’action plus évidentes.',
        verdictStrong: 'La page possède déjà de vrais signaux de vente. L’opportunité est de les transformer en parcours de décision plus rapide et plus rassurant.',
        verdictMedium: 'La page vend partiellement, mais les signaux décisifs doivent être mieux ordonnés, prouvés ou clarifiés avant le CTA.',
        verdictRisk: 'La lecture n’est pas assez solide pour un verdict stratégique définitif. Les preuves doivent être renforcées avant de trancher.',
        observed: 'Ce qui est prouvé',
        missing: 'Ce qui menace la décision',
        action: 'Mouvement suivant',
        high: 'Élevé',
        medium: 'Moyen',
        low: 'Faible',
        rewrite: 'Transformer le premier écran en promesse claire + preuve rapide + un seul CTA de décision.',
        proof: 'Placer la preuve sociale ou la garantie la plus forte avant le premier bouton de décision.',
        cta: 'Utiliser le même verbe CTA dans le hero, le prix et la fin de page.',
        order: 'Reconstruire la séquence : promesse, preuve, offre, prix, objections, CTA final.',
        verify: 'Attacher chaque promesse à une preuve visible : avis, image, garantie, prix ou condition claire.'
    };
    const score = executiveScore(data, 'funnel');
    const source = data.funnelSurgery || data.funnelSectionSurgery || {};
    const primary = data.funnelPrimaryAnalysis || data.funnelEvidenceSynthesis || {};
    const normalized = normalizeFunnelSurgeryForRender(data);
    const present = executiveDedupList([
        primary.present?.map(item => item.sectionType || item.section || item.name || item.title || item),
        data.auditSummary?.topStrengths,
        normalized.keep.map(item => item.section || item.sectionType || item.name),
        source.proofTrust?.present
    ], 6);
    const weak = executiveDedupList([
        primary.weak?.map(item => item.sectionType || item.section || item.problem || item.reason || item),
        normalized.improve.map(item => item.problem || item.action || item.section || item.sectionType),
        data.auditSummary?.topWeaknesses,
        source.frictions
    ], 6);
    const missing = executiveDedupList([
        primary.missing?.map(item => item.sectionType || item.section || item.reason || item),
        normalized.add.map(item => item.section || item.sectionType || item.action),
        normalized.unconfirmed.map(item => item.section || item.sectionType || item.reason)
    ], 6);
    const socialPresent = present.some(item => /testimonial|review|rating|avis|t[ée]moignage|preuve sociale|social proof|تقييم|آراء|مراجعات|شهادات/i.test(item));
    const filteredWeak = weak.filter(item => !(socialPresent && /aucune preuve sociale|absence de preuve sociale|no social proof|missing social proof|لا توجد أدلة اجتماعية/i.test(item)));
    const filteredMissing = missing.filter(item => !(socialPresent && /testimonial|review|avis|preuve sociale|social proof|تقييم|آراء|مراجعات|شهادات/i.test(item)));
    const actions = executiveDedupList([
        normalized.improve.map(item => item.action || item.correction || item.improvement),
        normalized.add.map(item => item.action || item.recommendedSection?.title || item.suggestedContent?.title),
        source.priorityPlan?.now,
        source.priorityPlan?.sevenDays,
        data.concreteActionPlan?.map(item => item.changeNow),
        data.auditQuickWins?.map(item => item.title || item.howTo)
    ], 5);
    const actionTitles = executiveDedupList([actions, [t.rewrite, t.proof, t.cta, t.order, t.verify]], 5);
    const verdict = source.pageQuality?.message || source.verdict?.summary ||
        (score !== null && score >= 70 ? t.verdictStrong : score !== null && score < 45 ? t.verdictRisk : t.verdictMedium);
    const opportunities = executiveDedupList([
        present.map(item => `${t.observed}: ${item}`),
        source.sectionsToKeep?.map(item => item.section || item.sectionType),
        data.auditSummary?.topStrengths
    ], 3);
    const weaknesses = executiveDedupList([
        filteredWeak,
        filteredMissing.map(item => `${t.missing}: ${item}`)
    ], 3);
    return {
        score,
        verdict: sanitizeDakaBusinessVocabularyForContext(executiveText(verdict)) || t.fallback,
        opportunities: opportunities.length ? opportunities : present.slice(0, 3),
        weaknesses: weaknesses.length ? weaknesses : filteredMissing.slice(0, 3),
        actions: actionTitles.map((title, index) => ({
            title,
            impact: index < 2 ? t.high : t.medium,
            effort: index === 0 ? t.medium : index < 3 ? t.low : t.medium,
            priority: String(index + 1)
        })),
        quickWins: executiveDedupList([source.priorityPlan?.sevenDays, data.auditQuickWins?.map(item => item.title || item.howTo), actionTitles.slice(0, 3)], 3),
        plan30: executiveDedupList([source.priorityPlan?.thirtyDays, data.actionRoadmap, actionTitles], 5),
        pulse: {
            decision: actionTitles[0] || t.rewrite,
            leverage: opportunities[0] || present[0] || t.observed,
            risk: weaknesses[0] || filteredMissing[0] || t.missing,
            move: actionTitles[0] || t.rewrite
        },
        dashboard: {
            present: present.length,
            weak: filteredWeak.length,
            missing: filteredMissing.length,
            actions: actionTitles.length,
            confidence: source.verdict?.confidence || source.observedDataLimits?.confidence || data.scrapeReliability?.confidence || 'MEDIUM'
        },
        keywords: executiveKeywordCloud(data, 10)
    };
}

function buildExecutiveSummaryModel(data, type, lang = STATE.currentLang || 'fr') {
    if (type === 'funnel') return buildFunnelExecutiveSummaryModel(data || {}, lang);
    const actions = executiveActions(data);
    const opportunities = executiveList([
        data.swot?.opportunities,
        data.keywordStrategy?.missingGaps,
        data.semanticDifferences,
        data.top3ReverseEngineering?.glaringWeaknesses,
        data.auditSummary?.topStrengths,
        data.quickWins,
        data.clusters
    ], 3);
    const weaknesses = executiveList([
        data.swot?.weaknesses,
        data.auditSummary?.topWeaknesses,
        data.criticalIssues,
        data.auditIssues,
        data.top3ReverseEngineering?.glaringWeaknesses,
        data.techAudit?.criticalIssues
    ], 3);
    return {
        score: executiveScore(data, type),
        verdict: executiveText(
            data.executiveBrief?.priority || data.executiveBrief?.why ||
            data.auditSummary?.verdict || data.globalScoring?.verdict ||
            data.globalReport?.verdict || data.winningMove ||
            opportunities[0] || weaknesses[0]
        ),
        opportunities,
        weaknesses,
        actions: actions.slice(0, 5),
        quickWins: executiveList([data.auditQuickWins, data.quickWins, actions.slice(0, 3)], 3),
        plan30: executiveList([data.actionRoadmap, data.concreteActionPlan, actions.slice(3)], 5)
    };
}

function navigateReportView(button, mode) {
    const root = button?.closest('.executive-summary')?.parentElement || document;
    const sections = [...root.querySelectorAll('.report-section')];
    if (mode === 'summary') {
        button.closest('.executive-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    if (mode === 'analysis') sections.slice(0, 2).forEach(section => setReportSectionOpen(section, true));
    if (mode === 'full') sections.forEach(section => setReportSectionOpen(section, true));
    sections[0]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderExecutiveSummary(data, type, opts = {}) {
    const isAr = opts.isAr ?? STATE.currentLang === 'ar';
    const isEn = opts.isEn ?? STATE.currentLang === 'en';
    const summaryLang = isAr ? 'ar' : isEn ? 'en' : 'fr';
    const model = buildExecutiveSummaryModel(data || {}, type, summaryLang);
    const safe = typeof escapeHtml === 'function' ? escapeHtml : String;
    const fallback = isAr ? 'لا توجد بيانات موثوقة كافية بعد.' : isEn ? 'Not enough reliable data yet.' : 'Données fiables encore insuffisantes.';
    const t = isAr ? {
        kicker: 'الملخص التنفيذي · قراءة 3 دقائق', title: 'ما يجب معرفته واتخاذه الآن',
        score: 'النتيجة العامة', opportunities: 'أفضل 3 فرص', weaknesses: 'أهم 3 نقاط ضعف',
        actions: '5 إجراءات ذات أولوية', quick: 'مكاسب سريعة خلال 7 أيام', plan: 'خطة 30 يوما',
        summary: 'ملخص 3 دقائق', analysis: 'تحليل 30 دقيقة', full: 'عرض الملف الكامل',
        impact: 'الأثر', effort: 'الجهد', priority: 'الأولوية', keywords: 'كلمات حقيقية من الصفحة'
    } : isEn ? {
        kicker: 'Executive summary · 3-minute read', title: 'What to know and do now',
        score: 'Global score', opportunities: 'Top 3 opportunities', weaknesses: 'Top 3 critical weaknesses',
        actions: '5 priority actions', quick: 'Quick wins · 7 days', plan: '30-day plan',
        summary: '3-minute summary', analysis: '30-minute analysis', full: 'View full dossier',
        impact: 'Impact', effort: 'Effort', priority: 'Priority', keywords: 'Real words from the page'
    } : {
        kicker: 'Résumé exécutif · lecture 3 minutes', title: 'Ce qu’il faut comprendre et décider maintenant',
        score: 'Score global', opportunities: 'Top 3 opportunités', weaknesses: 'Top 3 faiblesses critiques',
        actions: '5 actions prioritaires', quick: 'Quick wins · 7 jours', plan: 'Plan 30 jours',
        summary: 'Résumé 3 min', analysis: 'Analyse 30 min', full: 'Voir le dossier complet',
        impact: 'Impact', effort: 'Effort', priority: 'Priorité', keywords: 'Mots réels du site'
    };
    const list = (items) => `<ul>${(items.length ? items : [fallback]).map(item => `<li>${safe(executiveText(item))}</li>`).join('')}</ul>`;
    const defaultImpact = isAr ? 'متوسط' : isEn ? 'Medium' : 'Moyen';
    const defaultEffort = isAr ? 'منخفض' : isEn ? 'Low' : 'Faible';
    const actions = (model.actions.length ? model.actions : [{ title: fallback, impact: defaultImpact, effort: defaultEffort, priority: '1' }])
        .map((action, index) => ({
            ...action,
            impact: executiveIsUsefulText(action.impact) ? action.impact : defaultImpact,
            effort: executiveIsUsefulText(action.effort) ? action.effort : defaultEffort,
            priority: executiveIsUsefulText(action.priority) ? action.priority : String(index + 1)
        }));
    const pulse = isAr ? {
        verdict: 'القرار', leverage: 'الرافعة الأقوى', risk: 'الخطر الفوري', move: 'الخطوة التالية',
        proof: 'خلاصة مبنية على الأدلة المرصودة في الصفحة',
        chart: 'لوحة القرار', mind: 'خريطة التفكير'
    } : isEn ? {
        verdict: 'Decision', leverage: 'Strongest lever', risk: 'Immediate risk', move: 'Next move',
        proof: 'A synthesis grounded in observed page evidence',
        chart: 'Decision dashboard', mind: 'Thinking map'
    } : {
        verdict: 'Décision', leverage: 'Levier le plus fort', risk: 'Risque immédiat', move: 'Prochaine action',
        proof: 'Une synthèse fondée sur les preuves réellement observées',
        chart: 'Dashboard décisionnel', mind: 'Carte mentale'
    };
    const pulseData = model.pulse || {};
    const pulseItems = [
        ['fa-compass', pulse.verdict, pulseData.decision || model.verdict || fallback, '#22d3ee'],
        ['fa-arrow-trend-up', pulse.leverage, pulseData.leverage || model.opportunities[0] || fallback, '#22c55e'],
        ['fa-triangle-exclamation', pulse.risk, pulseData.risk || model.weaknesses[0] || fallback, '#fb7185'],
        ['fa-bolt', pulse.move, pulseData.move || actions[0]?.title || fallback, '#a78bfa']
    ];
    const dashboard = model.dashboard || {};
    const dashboardItems = [
        ['fa-eye', isAr ? 'مرصود' : isEn ? 'Observed' : 'Observé', dashboard.present],
        ['fa-wand-magic-sparkles', isAr ? 'للتقوية' : isEn ? 'To strengthen' : 'À renforcer', dashboard.weak],
        ['fa-circle-question', isAr ? 'للتحقق' : isEn ? 'To verify' : 'À vérifier', dashboard.missing],
        ['fa-list-check', isAr ? 'إجراءات' : isEn ? 'Actions' : 'Actions', dashboard.actions],
        ['fa-shield-halved', isAr ? 'الثقة' : isEn ? 'Confidence' : 'Confiance', dashboard.confidence]
    ].filter(([, , value]) => value !== null && value !== undefined && value !== '');
    const mindItems = [
        [pulse.verdict, pulseData.decision || model.verdict],
        [pulse.leverage, pulseData.leverage || model.opportunities[0]],
        [pulse.risk, pulseData.risk || model.weaknesses[0]],
        [pulse.move, pulseData.move || actions[0]?.title]
    ].filter(([, value]) => executiveIsUsefulText(value));

    return `
    <section class="executive-summary fade-in-up" data-export-feature="summary" dir="${isAr ? 'rtl' : 'ltr'}">
        <div class="executive-summary-head">
            <div>
                <span class="executive-summary-kicker">${safe(t.kicker)}</span>
                <h2>${safe(t.title)}</h2>
                <p class="executive-verdict">${safe(model.verdict || fallback)}</p>
            </div>
            <div class="executive-score"><strong>${model.score === null ? '—' : `${model.score}/100`}</strong><small>${safe(t.score)}</small></div>
        </div>
        <div class="executive-decision-pulse">
            <p class="executive-proof-line"><i class="fas fa-circle-check"></i>${safe(pulse.proof)}</p>
            <div class="executive-pulse-grid">${pulseItems.map(([icon, label, value, accent]) => `
                <article style="--pulse-accent:${accent}">
                    <span><i class="fas ${icon}"></i></span>
                    <div><small>${safe(label)}</small><strong dir="auto">${safe(executiveText(value))}</strong></div>
                </article>`).join('')}</div>
        </div>
        ${dashboardItems.length ? `<div class="executive-insight-board" aria-label="${safe(pulse.chart)}">
            ${dashboardItems.map(([icon, label, value]) => `<article><i class="fas ${icon}"></i><strong>${safe(value)}</strong><small>${safe(label)}</small></article>`).join('')}
        </div>` : ''}
        ${mindItems.length ? `<div class="executive-mindmap" aria-label="${safe(pulse.mind)}">
            <div class="executive-mindmap-core"><small>${safe(pulse.mind)}</small><strong>Daka</strong></div>
            <div class="executive-mindmap-branches">${mindItems.map(([label, value], index) => `
                <article style="--branch:${index + 1}"><small>${safe(label)}</small><span dir="auto">${safe(executiveText(value))}</span></article>`).join('')}</div>
        </div>` : ''}
        ${model.keywords?.length ? `<div class="executive-keyword-ribbon"><strong>${safe(t.keywords)}</strong><div>${model.keywords.map(word => `<span dir="auto">${safe(word)}</span>`).join('')}</div></div>` : ''}
        <nav class="executive-nav no-print" aria-label="${safe(t.kicker)}">
            <button type="button" onclick="navigateReportView(this,'summary')">${safe(t.summary)}</button>
            <button type="button" onclick="navigateReportView(this,'analysis')">${safe(t.analysis)}</button>
            <button type="button" onclick="navigateReportView(this,'full')">${safe(t.full)}</button>
        </nav>
        <div class="executive-grid">
            <div class="executive-block" style="--executive-color:#10b981"><h3>${safe(t.opportunities)}</h3>${list(model.opportunities)}</div>
            <div class="executive-block" style="--executive-color:#ef4444"><h3>${safe(t.weaknesses)}</h3>${list(model.weaknesses)}</div>
            <div class="executive-block executive-block-wide" style="--executive-color:#8b5cf6">
                <h3>${safe(t.actions)}</h3>
                <div class="executive-actions">${actions.map(action => `
                    <div class="executive-action">
                        <strong>${safe(action.title)}</strong>
                        <div class="executive-action-meta">
                            <span>${safe(t.impact)}: ${safe(action.impact)}</span>
                            <span>${safe(t.effort)}: ${safe(action.effort)}</span>
                            <span>${safe(t.priority)}: ${safe(action.priority)}</span>
                        </div>
                    </div>`).join('')}
                </div>
            </div>
            <div class="executive-block" style="--executive-color:#22d3ee"><h3>${safe(t.quick)}</h3>${list(model.quickWins)}</div>
            <div class="executive-block" style="--executive-color:#f59e0b"><h3>${safe(t.plan)}</h3>${list(model.plan30)}</div>
        </div>
    </section>`;
}

/* Daka report runtime moved to /assets/daka-report-runtime.js to avoid inline-code leakage. */

function initEventListeners() {
    // 🔥 FIX FORM SUBMITS - CENTRALISATION DES 4 MODULES (Zéro Refresh)

    // 1. Module Concurrents
    const formCompetitors = document.getElementById('competitorsForm');
    if (formCompetitors) {
        formCompetitors.removeEventListener('submit', analyzeCompetitors); // Nettoyage préventif
        formCompetitors.addEventListener('submit', analyzeCompetitors);
    }

    // 2. Module Funnel AIDA
    const formFunnel = document.getElementById('funnelForm');
    if (formFunnel) {
        formFunnel.removeEventListener('submit', analyzeFunnel);
        formFunnel.addEventListener('submit', analyzeFunnel);
    }

    // 3. Module Technique
    const formTechnical = document.getElementById('technicalForm');
    if (formTechnical) {
        formTechnical.removeEventListener('submit', analyzeTechnical);
        formTechnical.addEventListener('submit', analyzeTechnical);
    }

    // 4. Module Keywords (L'Ajout Manquant)
    const formKeywords = document.getElementById('keywordsForm');
    if (formKeywords) {
        formKeywords.removeEventListener('submit', analyzeKeywords);
        formKeywords.addEventListener('submit', analyzeKeywords);
    }

    // ⌨️ Raccourcis Clavier Global (Ctrl+E / Cmd+E pour Export)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            if (typeof exportResults === 'function') exportResults('json');
        }
    });

    console.log('✅ Event listeners OK - 4 forms câblés & sécurisés');
}


async function analyzeFunnel(e) {
  if (e) {
    e.preventDefault();
    e.stopImmediatePropagation?.();
  }

  const elUrl = document.getElementById('funnelUrl');
  const url   = elUrl?.value.trim();
  const lang  = document.getElementById('funnelLang')?.value  || 'fr';
  const angle = document.getElementById('funnelAngle')?.value || 'aggressive';
  STATE.currentLang = lang;
  if (window.i18n && typeof window.i18n.setLanguage === 'function' && window.i18n.currentLang !== lang) {
    window.i18n.setLanguage(lang);
  }

  if (!url)
    return toast.warning(STATE.currentLang === 'ar'
      ? 'أدخل URL الهدف.'
      : 'Entrez l\'URL de la cible.');

  // Validation URL
  try {
    const testUrl = url.startsWith('http') ? url : 'https://' + url;
    new URL(testUrl);
    if (!elUrl.value.trim().includes('.')) throw new Error('Invalid');
  } catch {
    return toast.error(
      STATE.currentLang === 'ar' ? 'URL غير صالح'
      : STATE.currentLang === 'en' ? 'Invalid URL format.'
      : 'Format URL invalide. Ex: https://concurrent.com'
    );
  }

  const requestKey = (() => {
    try {
      const normalized = new URL(url.startsWith('http') ? url : `https://${url}`);
      normalized.hash = '';
      normalized.hostname = normalized.hostname.toLowerCase().replace(/^www\./, '');
      normalized.pathname = normalized.pathname.replace(/\/+$/, '') || '/';
      return `${normalized.toString()}|${lang}|${angle}`;
    } catch (_) {
      return `${url.toLowerCase()}|${lang}|${angle}`;
    }
  })();
  if (window.dakaFunnelAnalysisInFlight) {
    const message = STATE.currentLang === 'ar'
      ? 'تحليل Funnel جار بالفعل. انتظر النتيجة أو ألغ التحليل الحالي.'
      : STATE.currentLang === 'en'
        ? 'A Funnel analysis is already running. Wait for it or cancel it first.'
        : 'Une analyse Funnel est déjà en cours. Attendez le résultat ou annulez-la.';
    toast.info(message);
    return;
  }
  const runToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.dakaFunnelAnalysisInFlight = { token: runToken, requestKey, startedAt: Date.now() };

  /* ── RESET avant nouvelle analyse ────────────────────────── */
  resetAnalysis('funnel');

  setButtonLoading('funnelBtn', true);
  showLoading('loadingFunnel');
  hideResults('resultsFunnel');

  try {
    const response = await analyzeWithPolling('/api/analyze-funnel', {
      url,
      clientAnalysisId: runToken,
      userLang:   lang,
      salesAngle: angle,
      context: collectBusinessContext('funnel')
    });

    if (!response || typeof response !== 'object')
      throw new Error('Réponse serveur invalide');

    if (response.success) {
      response.analysisLang = lang;
      response.lang = response.lang || lang;
      response.userLang = response.userLang || lang;
      /* ── Persistance STATE ──────────────────────────────── */
      STATE.lastFunnelResults   = response;
      STATE.lastInputs.funnelUrl = url;
      STATE.lastInputs.funnelLang = lang;
      STATE.lastInputs.funnelPriceRange = collectBusinessContext('funnel').priceRange || '';
      STATE.currentLang          = lang;

      displayFunnelResults(response);
      toast.success(STATE.currentLang === 'ar'
        ? '✅ تحليل القمع اكتمل!'
        : '✅ Analyse Funnel AIDA terminée !');
    } else {
      throw new Error(response.error || 'Échec analyse funnel');
    }
  } catch (error) {
    if (error?.name === 'AbortError' || window.dakaAnalysisCancelled) return;
    console.error('Funnel Error:', error);

    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';
    const status = Number(error?.status || error?.data?.status || 0);
    const authError = status === 401 || /AUTH_REQUIRED|INVALID_SESSION|Connectez-vous/i.test(String(error?.message || ''));
    const quotaError = status === 429 || /QUOTA|quota/i.test(String(error?.message || ''));
    const title = authError
      ? (isAr ? 'يجب تسجيل الدخول' : isEn ? 'Sign-in required' : 'Connexion requise')
      : quotaError
        ? (isAr ? 'تم بلوغ حد التقارير' : isEn ? 'Report quota reached' : 'Quota de rapports atteint')
        : (isAr ? 'تعذر إكمال التحليل' : isEn ? 'Analysis could not be completed' : 'L’analyse n’a pas pu être terminée');
    const message = String(
      error?.data?.message ||
      error?.message ||
      (isAr ? 'تحقق من الاتصال ثم أعد المحاولة.' : isEn ? 'Check the connection and try again.' : 'Vérifiez la connexion puis relancez.')
    );

    const results = document.getElementById('resultsFunnel');
    if (results) {
      results.innerHTML = `<section class="funnel-v2-render-error" dir="${isAr ? 'rtl' : 'ltr'}">
        <i class="fas fa-triangle-exclamation"></i>
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p dir="auto">${escapeHtml(message)}</p>
          ${authError ? `<button type="button" data-no-collapse="true" class="btn-primary" onclick="event.stopPropagation();openAuthModal()">
            <i class="fas fa-right-to-bracket"></i> ${isAr ? 'تسجيل الدخول' : isEn ? 'Sign in' : 'Se connecter'}
          </button>` : ''}
        </div>
      </section>`;
      showResults('resultsFunnel');
    }
    if (authError) openAuthModal();
    toast.error(message);
  } finally {
    if (window.dakaFunnelAnalysisInFlight?.token === runToken) {
      window.dakaFunnelAnalysisInFlight = null;
    }
    setButtonLoading('funnelBtn', false);
    hideLoading('loadingFunnel');
  }
}

function renderBundleSuggested(bundleSuggested) {
  if (!bundleSuggested) return '<div style="opacity:.6">—</div>';

  if (typeof bundleSuggested === 'string') {
    return `<div>${escapeHtml(bundleSuggested)}</div>`;
  }

  if (Array.isArray(bundleSuggested)) {
    const html = bundleSuggested.map((item, index) => {
      if (typeof item === 'string') {
        return `<li>${escapeHtml(item)}</li>`;
      }

      if (item && typeof item === 'object') {
        const name = item.name || item.title || `Bundle ${index + 1}`;
        const price = item.price !== undefined && item.price !== null && item.price !== ''
          ? `${escapeHtml(String(item.price))}`
          : '—';
        const items = Array.isArray(item.items)
          ? item.items.map(x => `<li>${escapeHtml(String(x))}</li>`).join('')
          : '';

        return `
          <div style="margin-bottom:14px;padding:14px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.03)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
              <strong style="color:white">${escapeHtml(name)}</strong>
              <span style="color:#10b981;font-weight:800">${price}</span>
            </div>
            ${items ? `<ul style="margin:8px 0 0 18px;padding:0;color:#cbd5e1">${items}</ul>` : ''}
          </div>
        `;
      }

      return '';
    }).join('');

    return html || '<div style="opacity:.6">—</div>';
  }

  if (typeof bundleSuggested === 'object') {
    return `
      <div style="padding:12px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.03);color:#cbd5e1">
        ${Object.entries(bundleSuggested)
          .map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</div>`)
          .join('')}
      </div>
    `;
  }

  return `<div>${escapeHtml(String(bundleSuggested))}</div>`;
}
// ─────────────────────────────────────────────
// PATCH FRONT A — Normalisation audit backend V12
// À mettre en haut de displayFunnelResults(data)
// ─────────────────────────────────────────────
// ===================== DATA TERRAIN UI (sans nom provider) =====================
function getVerifiedSocialChannels(leaderMoat = {}) {
    const authority = leaderMoat?.brandAuthority || {};
    const evidence = [
        ...(Array.isArray(authority.channelEvidence) ? authority.channelEvidence : []),
        ...(Array.isArray(authority.socialLinks) ? authority.socialLinks : []),
        ...(Array.isArray(authority.socialProfiles) ? authority.socialProfiles : []),
        ...(Array.isArray(leaderMoat.socialLinks) ? leaderMoat.socialLinks : []),
        ...(Array.isArray(leaderMoat.socialProfiles) ? leaderMoat.socialProfiles : [])
    ];
    const seen = new Set();
    const platformFromUrl = url => {
        try {
            const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
            const known = [
                ['facebook.com', 'Facebook'], ['fb.com', 'Facebook'],
                ['instagram.com', 'Instagram'], ['linkedin.com', 'LinkedIn'],
                ['x.com', 'X'], ['twitter.com', 'X'],
                ['youtube.com', 'YouTube'], ['youtu.be', 'YouTube'],
                ['tiktok.com', 'TikTok'], ['pinterest.com', 'Pinterest'],
                ['snapchat.com', 'Snapchat'], ['wa.me', 'WhatsApp'],
                ['whatsapp.com', 'WhatsApp'], ['t.me', 'Telegram'],
                ['telegram.me', 'Telegram'], ['threads.net', 'Threads'],
                ['reddit.com', 'Reddit'], ['discord.gg', 'Discord'],
                ['discord.com', 'Discord'], ['medium.com', 'Medium'],
                ['twitch.tv', 'Twitch'], ['vimeo.com', 'Vimeo']
            ];
            return known.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1]
                || host.split('.')[0].replace(/(^\w|[-_]\w)/g, value => value.replace(/[-_]/, '').toUpperCase());
        } catch {
            return '';
        }
    };
    return evidence.map(item => {
        const url = typeof item === 'string'
            ? item.trim()
            : String(item?.url || item?.href || item?.link || item?.profileUrl || item?.sourceUrl || '').trim();
        if (!/^https?:\/\//i.test(url)) return null;
        const platform = String(item?.channel || item?.platform || item?.network || item?.name || item?.text || platformFromUrl(url)).trim();
        const key = `${platform.toLowerCase()}|${url.toLowerCase()}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return { platform, url };
    }).filter(Boolean);
}

function synchronizeLeaderSocialProof(data = {}) {
    const channels = getVerifiedSocialChannels(data.leaderMoat);
    if (!channels.length) return channels;
    const lang = data.analysisLang || data.lang || STATE.currentLang || 'fr';
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    data.proofModel = data.proofModel && typeof data.proofModel === 'object' ? data.proofModel : {};
    data.proofModel.observed = Array.isArray(data.proofModel.observed) ? data.proofModel.observed : [];
    data.proofModel.unavailable = Array.isArray(data.proofModel.unavailable) ? data.proofModel.unavailable : [];
    const socialPattern = /(social proof links|verified social|social networks|réseaux sociaux|liens sociaux|روابط اجتماعية|شبكات اجتماعية)/i;
    data.proofModel.unavailable = data.proofModel.unavailable.filter(item =>
        !socialPattern.test(String(typeof item === 'string' ? item : item?.title || item?.value || ''))
    );
    const existingSocialFact = data.proofModel.observed.find(item => socialPattern.test(String(item?.title || '')));
    if (existingSocialFact) {
        existingSocialFact.value = channels.map(item => item.platform).join(', ');
        existingSocialFact.confidence = 'HIGH';
        existingSocialFact.evidence = channels.map(item => ({ url: item.url, label: item.platform }));
    } else {
        data.proofModel.observed.push({
            type: 'observed',
            title: isAr ? 'روابط اجتماعية موثقة' : isEn ? 'Verified social channels' : 'Réseaux sociaux vérifiés',
            value: channels.map(item => item.platform).join(', '),
            source: isAr ? 'الموقع الرسمي للمتصدر' : isEn ? 'Leader official website' : 'Site officiel du leader',
            confidence: 'HIGH',
            evidence: channels.map(item => ({ url: item.url, label: item.platform }))
        });
    }
    return channels;
}

function buildFieldIntelModel(raw, leaderMoat = {}) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const links = r.links || {};
    const intel = r.apifyIntel && typeof r.apifyIntel === 'object' ? r.apifyIntel : {};
    const asArray = value => Array.isArray(value) ? value : [];
    const pickLink = item => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        return item.sourceUrl || item.url || item.link || item.postUrl || item.adUrl || item.commentUrl || item.reviewUrl || item.landingPageUrl || '';
    };
    const pickText = item => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        return item.text || item.quote || item.caption || item.hook || item.headline || item.title || item.comment || item.reviewText || '';
    };
    const mergeLinks = (bucket) => {
        const direct = asArray(links[bucket]);
        const fromIntel = asArray(intel[bucket]).map(pickLink).filter(Boolean);
        return [...new Set([...direct, ...fromIntel])].filter(Boolean);
    };
    const verifiedChannels = getVerifiedSocialChannels(leaderMoat);
    const studiesFromIntel = ['ads', 'posts', 'comments', 'reviews'].flatMap(bucket =>
        asArray(intel[bucket]).map(item => ({
            source: item.platform || item.source || bucket,
            text: pickText(item),
            link: pickLink(item)
        }))
    ).filter(item => item.text || item.link);

    const hasFieldData = ['ads', 'posts', 'comments', 'reviews'].some(bucket =>
        mergeLinks(bucket).length || asArray(intel[bucket]).length
    ) || asArray(r.studiesBottom).length;
    const intentionallyDisabled = ['APIFY_DISABLED', 'APIFY_COMPETITORS_ONLY', 'MISSING_APIFY_API_TOKEN', 'PREFLIGHT_BLOCKED'].includes(r.reason || '');

    return {
        triggered: (!!r.triggered || hasFieldData) && !intentionallyDisabled,
        actorTriggered: r.actorTriggered !== false && !!r.triggered,
        collectionSkipped: !!r.collectionSkipped,
        reason: r.reason || '',
        guideTop: r.guideTop || { title: 'Guide concret', steps: [] },
        studiesBottom: [
            ...(Array.isArray(r.studiesBottom) ? r.studiesBottom : []),
            ...studiesFromIntel,
            ...verifiedChannels.map(item => ({ source: item.platform, text: item.platform, link: item.url }))
        ],
        runs: Array.isArray(r.runs) ? r.runs : [],
        searchPlan: r.searchPlan || null,
        socialListeningIntel: r.socialListeningIntel || null,
        customerVoiceVerdict: r.customerVoiceVerdict || null,
        links: {
            ads: mergeLinks('ads'),
            posts: mergeLinks('posts'),
            comments: mergeLinks('comments'),
            reviews: mergeLinks('reviews'),
            all: [...new Set([
                ...(Array.isArray(links.all) ? links.all : []),
                ...mergeLinks('ads'),
                ...mergeLinks('posts'),
                ...mergeLinks('comments'),
                ...mergeLinks('reviews'),
                ...verifiedChannels.map(item => item.url)
            ])]
        },
        verifiedChannels
    };
}

function renderFieldLinksBlock(items = [], color = '#94a3b8', esc = escapeHtml) {
    if (!items.length) return `<div style="font-size:.75rem;color:#64748b;">—</div>`;
    return items.slice(0, 25).map((u, i) => `
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;">
            <span style="color:${color};font-size:.72rem;min-width:18px;">${i + 1}.</span>
            <a href="${esc(u)}" target="_blank" rel="noopener noreferrer"
               style="color:#cbd5e1;font-size:.76rem;line-height:1.5;word-break:break-all;text-decoration:none;">
               ${esc(u)}
            </a>
        </div>
    `).join('');
}

function renderFieldGuideTop(model, { isAr = false, isEn = false, dir = 'ltr', esc = escapeHtml } = {}) {
    if (!model || !model.triggered) return '';

    const t = {
        title: isAr ? '\u0627\u0644\u062F\u0644\u064A\u0644 \u0627\u0644\u0639\u0645\u0644\u064A' : isEn ? 'Concrete guide' : 'Guide concret',
        links: isAr ? 'تعليقات وروابط ميدانية' : isEn ? 'Field links and comments' : 'Commentaires et liens terrain',
        comments: isAr ? 'تعليقات العملاء' : isEn ? 'Customer comments' : 'Commentaires clients',
        voice: isAr ? 'صوت السوق' : isEn ? 'Market voice' : 'Voix du marché',
        search: isAr ? 'خطة البحث' : isEn ? 'Search plan' : 'Plan de recherche'
    };

    const steps = Array.isArray(model.guideTop?.steps) ? model.guideTop.steps.filter(Boolean).slice(0, 5) : [];
    const verdict = model.customerVoiceVerdict || {};
    const social = model.socialListeningIntel || {};
    const postsIntel = social.postsIntel || {};
    const commentsIntel = social.commentsIntel || {};
    const languageBank = social.marketLanguageBank || {};
    const commentLinks = Array.isArray(model?.links?.comments) ? model.links.comments.filter(Boolean) : [];
    const line = (label, value, color = '#94a3b8') => value ? `
        <div style="font-size:.78rem;color:#cbd5e1;line-height:1.55;margin-bottom:6px;" dir="auto">
            <strong style="color:${color};">${esc(label)}:</strong> ${esc(Array.isArray(value) ? value.slice(0, 4).join(' | ') : value)}
        </div>
    ` : '';
    const intelSummaryHtml = [
        line(isAr ? 'الألم الرئيسي' : isEn ? 'Main pain' : 'Douleur principale', verdict.mainPain, '#ef4444'),
        line(isAr ? 'الاعتراض الرئيسي' : isEn ? 'Main objection' : 'Objection principale', verdict.mainObjection, '#f59e0b'),
        line(isAr ? 'زاوية الإعلان' : isEn ? 'Ad hook' : 'Hook ads', verdict.adHook || verdict.copyAngle, '#3b82f6'),
        line(isAr ? 'تصحيح العرض' : isEn ? 'Offer fix' : 'Correction offre', verdict.offerFix, '#10b981'),
        line(isAr ? 'مواضيع متكررة' : isEn ? 'Dominant topics' : 'Sujets dominants', postsIntel.dominantTopics, '#a78bfa'),
        line(isAr ? 'أسئلة الشراء' : isEn ? 'Purchase questions' : 'Questions achat', commentsIntel.purchaseQuestions, '#ec4899'),
        line(isAr ? 'عبارات للاستخدام' : isEn ? 'Phrases to reuse' : 'Phrases à réutiliser', languageBank.phrasesToUseInAds || languageBank.objectionPhrases, '#22c55e')
    ].join('');
    const searchTerms = Array.isArray(model.searchPlan?.variants) ? model.searchPlan.variants.filter(Boolean).slice(0, 8) : [];
    const searchPlanHtml = searchTerms.length ? `
        <div style="margin-bottom:12px;background:rgba(59,130,246,.035);border:1px solid rgba(59,130,246,.12);border-radius:10px;padding:10px;">
            <div style="font-size:.68rem;color:#93c5fd;font-weight:800;text-transform:uppercase;margin-bottom:8px;">
                ${t.search}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${searchTerms.map(term => `
                    <span style="font-size:.72rem;color:#cbd5e1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:3px 8px;" dir="auto">
                        ${esc(term)}
                    </span>
                `).join('')}
            </div>
        </div>
    ` : '';

    const commentsHtml = commentLinks.length ? `
        <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px;">
            <div style="font-size:.68rem;color:#94a3b8;font-weight:800;text-transform:uppercase;margin-bottom:8px;">
                ${t.links}
            </div>
            <div style="display:grid;grid-template-columns:1fr;gap:10px;">
                <div><small style="color:#ec4899;font-weight:700;">${t.comments} (${commentLinks.length})</small>${renderFieldLinksBlock(commentLinks, '#ec4899', esc)}</div>
            </div>
        </div>
    ` : '';

    if (!steps.length && !intelSummaryHtml && !searchPlanHtml && !commentsHtml) return '';

    return `
    <div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #22c55e;" dir="${dir}">
        <h3 style="margin-bottom:12px;color:white;font-size:1rem;display:flex;align-items:center;gap:10px;">
            <i class="fas fa-route" style="color:#22c55e"></i>
            ${esc(model.guideTop?.title || t.title)}
        </h3>

        ${steps.length ? `
        <div style="margin-bottom:12px;">
            ${steps.map((s, i) => `
                <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;">
                    <span style="color:#22c55e;font-weight:800;font-size:.78rem;">${i + 1}.</span>
                    <span style="color:#e2e8f0;font-size:.82rem;line-height:1.55;" dir="auto">${esc(s)}</span>
                </div>
            `).join('')}
        </div>` : ''}

        ${intelSummaryHtml ? `
        <div style="margin-bottom:12px;background:rgba(34,197,94,.035);border:1px solid rgba(34,197,94,.12);border-radius:10px;padding:10px;">
            <div style="font-size:.68rem;color:#86efac;font-weight:800;text-transform:uppercase;margin-bottom:8px;">
                ${t.voice}
            </div>
            ${intelSummaryHtml}
        </div>` : ''}

        ${searchPlanHtml}
        ${commentsHtml}
    </div>`;
}

function renderFieldStudiesBottom(model, { isAr = false, isEn = false, dir = 'ltr', esc = escapeHtml } = {}) {
    if (!model || !model.triggered || !model.studiesBottom.length) return '';

    const title = isAr ? 'دراسات وملاحظات ميدانية' : isEn ? 'Field Studies' : 'Études Terrain';

    return `
    <div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #6366f1;" dir="${dir}">
        <h3 style="margin-bottom:12px;color:white;font-size:1rem;display:flex;align-items:center;gap:10px;">
            <i class="fas fa-flask" style="color:#6366f1"></i> ${title}
        </h3>
        <div style="display:grid;gap:8px;">
            ${model.studiesBottom.slice(0, 20).map((s, i) => `
                <div style="padding:10px;border-radius:10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);">
                    <div style="font-size:.66rem;color:#94a3b8;margin-bottom:5px;">
                        #${i + 1} • ${esc(s.source || 'source')}
                    </div>
                    ${s.text ? `<div style="font-size:.79rem;color:#e2e8f0;line-height:1.55;margin-bottom:6px;" dir="auto">${esc(s.text)}</div>` : ''}
                    ${s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer" style="font-size:.75rem;color:#93c5fd;word-break:break-all;text-decoration:none;">${esc(s.link)}</a>` : ''}
                </div>
            `).join('')}
        </div>
    </div>`;
}
// =================== END DATA TERRAIN UI ===================

function renderDecisionProofPanel(data = {}, opts = {}) {
    const isAr = !!opts.isAr;
    const isEn = !!opts.isEn;
    const dir = opts.dir || (isAr ? 'rtl' : 'ltr');
    const esc = opts.esc || escapeHtml;
    const brief = data.executiveBrief || {};
    const proof = data.proofModel || {};
    const labels = proof.labels || {};
    const integrity = data.dataIntegrity || {};
    const reliable = data.scrapeReliability || {};
    const concrete = Array.isArray(data.concreteActionPlan) ? data.concreteActionPlan : [];

    const title = brief.title || (isAr ? 'ما يجب فعله الآن' : isEn ? 'What to do now' : 'Ce qu il faut faire maintenant');
    const proofTitle = proof.title || (isAr ? 'أدلة القرار' : isEn ? 'Decision evidence' : 'Preuves de décision');
    const observedLabel = labels.observed || (isAr ? 'مرصود' : isEn ? 'Observed' : 'Observe');
    const deducedLabel = labels.deduced || (isAr ? 'مستنتج' : isEn ? 'Deduced' : 'Deduit');
    const recommendedLabel = labels.recommended || (isAr ? 'موصى به' : isEn ? 'Recommended' : 'Recommande');
    const unavailableLabel = labels.unavailable || (isAr ? 'غير متاح' : isEn ? 'Unavailable' : 'Non disponible');

    const clean = (v, fallback = '') => {
        if (v === null || v === undefined) return fallback;
        if (Array.isArray(v)) return v.filter(Boolean).join(', ');
        if (typeof v === 'object') return Object.entries(v).filter(([, val]) => val !== null && val !== '').map(([k, val]) => `${k}: ${Array.isArray(val) ? val.join(', ') : val}`).join(' | ');
        return String(v).trim() || fallback;
    };

    const renderFact = (fact, color) => `
        <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.075);min-height:96px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;">
                <strong style="color:#fff;font-size:.82rem;line-height:1.35;" dir="auto">${esc(clean(fact.title, 'Insight'))}</strong>
                <span style="font-size:.62rem;font-weight:900;color:${color};background:${color}18;border:1px solid ${color}38;border-radius:999px;padding:3px 7px;">
                    ${esc(clean(fact.confidence, 'MEDIUM'))}
                </span>
            </div>
            <div style="color:#dbeafe;font-size:.84rem;line-height:1.5;margin-bottom:6px;" dir="auto">${esc(clean(fact.value, unavailableLabel))}</div>
            ${fact.formula ? `<div style="color:#94a3b8;font-size:.72rem;line-height:1.45;"><b>${isAr ? 'طريقة:' : isEn ? 'Method:' : 'Methode:'}</b> ${esc(fact.formula)}</div>` : ''}
            ${fact.source ? `<div style="color:#64748b;font-size:.7rem;margin-top:6px;">${esc(fact.source)}</div>` : ''}
            ${Array.isArray(fact.evidence) && fact.evidence.length ? `
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                    ${fact.evidence.slice(0,12).map(ev => {
                        const evidenceUrl = typeof ev === 'object' ? clean(ev.url || ev.href, '') : clean(ev, '');
                        const evidenceLabel = typeof ev === 'object' ? clean(ev.label || ev.platform, evidenceUrl) : evidenceUrl;
                        const isUrl = /^https?:\/\//i.test(evidenceUrl);
                        return isUrl
                            ? `<a href="${esc(evidenceUrl)}" target="_blank" rel="noopener noreferrer" data-no-collapse="true" style="font-size:.68rem;color:#93c5fd;text-decoration:none;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(evidenceLabel)}</a>`
                            : `<span style="font-size:.68rem;color:#93c5fd;">${esc(evidenceLabel)}</span>`;
                    }).join('')}
                </div>` : ''}
        </div>`;

    const renderFactGroup = (label, items, color, icon) => `
        <div>
            <h4 style="margin:0 0 10px;color:#fff;font-size:.86rem;display:flex;align-items:center;gap:8px;">
                <i class="fas ${icon}" style="color:${color}"></i>${label}
            </h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;">
                ${(items || []).slice(0,3).map(x => renderFact(x, color)).join('') || `<div style="color:#64748b;font-size:.8rem;">${esc(unavailableLabel)}</div>`}
            </div>
        </div>`;

    const actions = concrete.length
        ? concrete.slice(0, 4).map((x, i) => `
            <div style="padding:14px;border-radius:14px;background:linear-gradient(180deg,rgba(16,185,129,.075),rgba(255,255,255,.025));border:1px solid rgba(16,185,129,.16);">
                <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;">
                    <strong style="color:#fff;font-size:.84rem;">${i + 1}. ${esc(clean(x.zone, isEn ? 'Area' : 'Zone'))}</strong>
                    <span style="font-size:.64rem;color:#34d399;font-weight:900;">${esc(clean(x.confidence, 'MEDIUM'))}</span>
                </div>
                <div style="color:#cbd5e1;font-size:.8rem;line-height:1.55;margin-bottom:7px;" dir="auto">${esc(clean(x.changeNow, ''))}</div>
                ${x.replacementExample ? `<div style="color:#a7f3d0;font-size:.78rem;line-height:1.5;background:rgba(16,185,129,.08);padding:9px;border-radius:10px;" dir="auto">${esc(x.replacementExample)}</div>` : ''}
            </div>`).join('')
        : (brief.actions || []).slice(0, 4).map((x, i) => `
            <div style="padding:12px;border-radius:12px;background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.14);color:#d1fae5;font-size:.82rem;line-height:1.55;" dir="auto">
                <b>${i + 1}.</b> ${esc(clean(x, ''))}
            </div>`).join('');

    return `
    <section class="result-card fade-in-up decision-proof-panel" style="margin-bottom:24px;padding:0;overflow:hidden;border:1px solid rgba(99,102,241,.22);background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(30,41,59,.92));box-shadow:0 20px 55px rgba(0,0,0,.25);" dir="${dir}">
        <div style="padding:22px;border-bottom:1px solid rgba(255,255,255,.07);display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.9fr);gap:18px;align-items:stretch;">
            <div>
                <div style="color:#a5b4fc;font-size:.68rem;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:8px;">${esc(title)}</div>
                <h2 style="margin:0 0 10px;color:white;font-size:clamp(1.25rem,2vw,1.85rem);line-height:1.22;font-family:Cairo,sans-serif;" dir="auto">${esc(clean(brief.priority, isAr ? 'ابدأ بالتحسين الاكثر تأثيرا.' : isEn ? 'Start with the highest-impact improvement.' : 'Commencez par l amelioration la plus impactante.'))}</h2>
                ${brief.why ? `<p style="margin:0;color:#94a3b8;line-height:1.65;font-size:.92rem;" dir="auto">${esc(brief.why)}</p>` : ''}
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;">
                    <span style="color:#c4b5fd;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.24);padding:5px 10px;border-radius:999px;font-size:.72rem;font-weight:800;">${esc(clean(brief.confidence, 'MEDIUM'))}</span>
                    <span style="color:#93c5fd;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.22);padding:5px 10px;border-radius:999px;font-size:.72rem;font-weight:800;">${Number(brief.evidenceCount || 0)} ${isAr ? 'دليل' : isEn ? 'proofs' : 'preuves'}</span>
                </div>
            </div>
            <div style="display:grid;gap:9px;">
                ${actions || `<div style="color:#64748b;font-size:.82rem;">${esc(unavailableLabel)}</div>`}
            </div>
        </div>
        <div style="padding:20px;display:grid;gap:18px;">
            <h3 style="margin:0;color:#fff;font-size:1rem;display:flex;align-items:center;gap:9px;">
                <i class="fas fa-shield-check" style="color:#60a5fa"></i>${esc(proofTitle)}
            </h3>
            ${renderFactGroup(observedLabel, proof.observed, '#60a5fa', 'fa-eye')}
            ${renderFactGroup(deducedLabel, proof.deduced, '#f59e0b', 'fa-calculator')}
            ${renderFactGroup(recommendedLabel, proof.recommended, '#10b981', 'fa-list-check')}
            ${(proof.unavailable || []).length ? renderFactGroup(unavailableLabel, proof.unavailable, '#ef4444', 'fa-circle-exclamation') : ''}
            ${integrity.counts ? `<div style="color:#64748b;font-size:.72rem;border-top:1px solid rgba(255,255,255,.06);padding-top:12px;">${isAr ? 'فصل البيانات:' : isEn ? 'Data separation:' : 'Separation des donnees:'} ${observedLabel} ${integrity.counts.observed || 0} / ${deducedLabel} ${integrity.counts.deduced || 0} / ${recommendedLabel} ${integrity.counts.recommended || 0}</div>` : ''}
        </div>
    </section>`;
}

function repairFunnelSurgeryText(value) {
    const text = String(value ?? '');
    if (!/[ÃÂØÙ]/.test(text)) return text;
    try { return decodeURIComponent(escape(text)); } catch (_) { return text; }
}

function normalizeFunnelSurgeryForRender(data = {}) {
    const source = data.funnelSurgery || data.funnelSectionSurgery || data.sectionSurgery || data.funnelSectionScanner || data.spyReport?.funnelSurgery || data.spyReport?.funnelSectionSurgery || {};
    const diagnosis = source.sectionDiagnosis || source.scanner || {};
    const matrix = Array.isArray(source.surgeryMatrix) ? source.surgeryMatrix : [];
    const itemKey = item => [
        item?.section || item?.sectionType || item?.name || item?.label || '',
        item?.action || item?.correction || item?.recommendedPosition || item?.decision || ''
    ].map(value => repairFunnelSurgeryText(value).toLowerCase().replace(/\s+/g, ' ').trim()).join('|');
    const list = (...values) => {
        const seen = new Set();
        return values.flatMap(value => Array.isArray(value) ? value : []).filter(item => {
            const key = itemKey(item);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };
    const rowsFor = pattern => matrix.filter(row => pattern.test(repairFunnelSurgeryText(row?.decision).toLowerCase()));
    return {
        matrix,
        keep: list(diagnosis.keep, source.keepSections, rowsFor(/garder|keep|إبقاء/)),
        improve: list(diagnosis.improve, source.improveSections, source.updateSections, source.sectionsToModify, rowsFor(/améliorer|ameliorer|improve|modify|modifier|تحسين/)),
        move: list(diagnosis.move, source.moveSections, rowsFor(/déplacer|deplacer|move|نقل/)),
        remove: list(diagnosis.removeOrMerge, source.removeOrMergeSections, source.sectionsToRemoveOrMerge, source.sectionsToRemove, rowsFor(/supprimer|fusionner|remove|merge|حذف|دمج/)),
        add: list(diagnosis.add, source.missingSections, source.sectionsToAdd, rowsFor(/ajouter|add|missing|إضافة/)),
        unconfirmed: list(diagnosis.unconfirmed, source.unconfirmedSections, rowsFor(/non confirmé|unconfirmed|غير مؤكد/)),
        reconciliation: source.reconciliation || {}
    };
}

function renderFunnelSectionSurgery(data, opts = {}) {
    const isAr = Boolean(opts.isAr), isEn = Boolean(opts.isEn), dir = isAr ? 'rtl' : 'ltr';
    const safe = typeof escapeHtml === 'function' ? escapeHtml : value => String(value || '');
    const model = normalizeFunnelSurgeryForRender(data);
    if (!(model.matrix.length || model.keep.length || model.improve.length || model.move.length || model.remove.length || model.add.length)) return '';
    const copy = isAr ? {
        eyebrow: 'تشريح صفحة التحويل', title: 'بنية الصفحة المكتشفة', subtitle: 'ما يجب الحفاظ عليه أو تعديله أو نقله أو حذفه أو إضافته، بناء على العناصر المرصودة.',
        keep: 'أقسام يجب الحفاظ عليها', improve: 'أقسام يجب تعديلها', move: 'أقسام يجب نقلها', remove: 'أقسام يجب حذفها أو دمجها', add: 'أقسام غائبة يجب إضافتها',
        evidence: 'الدليل المرصود', action: 'الإجراء الدقيق', confidence: 'الثقة', problem: 'المشكلة', impact: 'أثر التحويل', source: 'مصدر القرار', empty: 'لا توجد توصية موثوقة في هذه الفئة.', checked: 'عنصرا تم فحصه', coverage: 'تغطية الأدلة', items: 'عناصر'
    } : isEn ? {
        eyebrow: 'Conversion page surgery', title: 'Detected page architecture', subtitle: 'What to keep, modify, move, remove, merge, or add from observed page signals.',
        keep: 'Sections to keep', improve: 'Sections to modify', move: 'Sections to move', remove: 'Sections to remove or merge', add: 'Missing sections to add',
        evidence: 'Observed evidence', action: 'Exact action', confidence: 'Confidence', problem: 'Problem', impact: 'Conversion impact', source: 'Decision source', empty: 'No reliable recommendation in this category.', checked: 'items checked', coverage: 'Evidence coverage', items: 'items'
    } : {
        eyebrow: 'Chirurgie de la page de vente', title: 'Architecture de page détectée', subtitle: 'Ce qu’il faut garder, modifier, déplacer, supprimer, fusionner ou ajouter à partir des éléments observés.',
        keep: 'Sections présentes à garder', improve: 'Sections présentes à modifier', move: 'Sections à déplacer', remove: 'Sections à supprimer ou fusionner', add: 'Sections absentes à ajouter',
        evidence: 'Preuve observée', action: 'Action exacte', confidence: 'Confiance', problem: 'Problème', impact: 'Impact conversion', source: 'Source de décision', empty: 'Aucune recommandation fiable dans cette catégorie.', checked: 'éléments vérifiés', coverage: 'Couverture des preuves', items: 'éléments'
    };
    const valueFor = (item, keys, fallback = '') => {
        for (const key of keys) {
            const value = item?.[key];
            if (value !== null && value !== undefined && String(value).trim()) return repairFunnelSurgeryText(Array.isArray(value) ? value.join(' · ') : value).trim();
        }
        return fallback;
    };
    const definitions = [
        ['improve', copy.improve, 'fa-pen-ruler', '#f59e0b'], ['add', copy.add, 'fa-circle-plus', '#a78bfa'],
        ['move', copy.move, 'fa-arrows-up-down-left-right', '#38bdf8'], ['remove', copy.remove, 'fa-code-merge', '#fb7185'],
        ['keep', copy.keep, 'fa-circle-check', '#22c55e'], ['unconfirmed', isAr ? 'عناصر غير مؤكدة' : isEn ? 'Unconfirmed items' : 'Éléments non confirmés', 'fa-circle-question', '#60a5fa']
    ];
    const renderItem = (item, index) => {
        const name = valueFor(item, ['section', 'sectionType', 'name', 'label'], `Section ${index + 1}`);
        const evidence = valueFor(item, ['evidence', 'observedEvidence', 'detectedText', 'currentEvidence', 'reason', 'evidenceOfAbsence']);
        const action = valueFor(item, ['action', 'correction', 'improvement', 'newRecommendation', 'recommendedPosition', 'suggestedPlacement', 'currentProblem']);
        const problem = valueFor(item, ['problem', 'currentProblem']);
        const impact = valueFor(item, ['conversionImpact', 'impact']);
        const source = valueFor(item, ['decisionSource', 'evidenceSource']);
        const priority = valueFor(item, ['priority'], 'MEDIUM'), confidence = valueFor(item, ['confidence'], 'MEDIUM');
        return `<article class="funnel-surgery-item" dir="${dir}"><div class="funnel-surgery-item-head"><strong dir="auto">${safe(name)}</strong><div><span>${safe(priority)}</span><span class="confidence">${safe(confidence)}</span></div></div>
            <div class="funnel-surgery-item-body">
                ${evidence ? `<p class="evidence"><i class="fas fa-eye"></i><span><b>${safe(copy.evidence)}</b><em dir="auto">${safe(evidence)}</em></span></p>` : ''}
                ${problem ? `<p><i class="fas fa-circle-exclamation"></i><span><b>${safe(copy.problem)}</b><em dir="auto">${safe(problem)}</em></span></p>` : ''}
                ${action ? `<p class="action"><i class="fas fa-arrow-right"></i><span><b>${safe(copy.action)}</b><em dir="auto">${safe(action)}</em></span></p>` : ''}
                ${impact ? `<p><i class="fas fa-chart-line"></i><span><b>${safe(copy.impact)}</b><em dir="auto">${safe(impact)}</em></span></p>` : ''}
            </div>${source ? `<small class="funnel-surgery-source"><i class="fas fa-database"></i>${safe(copy.source)}: ${safe(source)}</small>` : ''}</article>`;
    };
    const activeDefinitions = definitions.filter(([key]) => (model[key] || []).length);
    const categories = activeDefinitions.map(([key, label, icon, color], categoryIndex) => {
        const items = model[key] || [];
        return `<details class="funnel-surgery-category" style="--surgery-accent:${color}" ${categoryIndex === 0 ? 'open' : ''}><summary data-no-collapse="true"><span class="funnel-surgery-category-icon"><i class="fas ${icon}"></i></span><span><strong>${safe(label)}</strong><small>${items.length} ${safe(copy.items)}</small></span><i class="fas fa-chevron-down funnel-surgery-chevron"></i></summary><div class="funnel-surgery-list">${items.slice(0, 12).map(renderItem).join('')}</div></details>`;
    }).join('');
    const total = model.matrix.length || definitions.reduce((sum, def) => sum + (model[def[0]] || []).length, 0);
    const overview = definitions.slice(0, 5).map(([key, label, icon, color]) => `<div style="--surgery-accent:${color}"><i class="fas ${icon}"></i><span><strong>${(model[key] || []).length}</strong><small>${safe(label)}</small></span></div>`).join('');
    return `<section class="funnel-surgery-shell" data-export-feature="page" dir="${dir}"><header class="funnel-surgery-hero"><div><span>${safe(copy.eyebrow)}</span><h2>${safe(copy.title)}</h2><p>${safe(copy.subtitle)}</p></div><div class="funnel-surgery-total"><strong>${total}</strong><small>${safe(copy.checked)}</small></div></header>
        <div class="funnel-surgery-overview">${overview}${model.reconciliation?.evidenceCoverage !== undefined ? `<div class="coverage"><i class="fas fa-shield-halved"></i><span><strong>${safe(model.reconciliation.evidenceCoverage)}%</strong><small>${safe(copy.coverage)}</small></span></div>` : ''}</div>
        <div class="funnel-surgery-grid">${categories || `<p class="funnel-surgery-empty">${safe(copy.empty)}</p>`}</div></section>`;
}
function displayFunnelResultsLegacy(data) {
    const container = document.getElementById('resultsFunnel');
    if (!container) return;
    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';
    const dir  = isAr ? 'rtl' : 'ltr';
// ===== AUDIT MODEL (single source of truth) =====
const auditSummary = data.auditSummary || data.spyReport?.auditSummary || {
  title: 'Website & Funnel Audit',
  overallScore: data.scoringMatrix?.global || data.globalScoring?.overall || 0,
  grade: null,
  confidence: null,
  verdict: null,
  topStrengths: [],
  topWeaknesses: []
};


const auditQuickWins = Array.isArray(data.auditQuickWins)
  ? data.auditQuickWins
  : (Array.isArray(data.spyReport?.auditQuickWins) ? data.spyReport.auditQuickWins : []);
const pickScore = (...vals) => {
  for (const val of vals) {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) return Math.max(0, Math.min(100, Math.round(n)));
  }
  return null;
};

const auditScorecard = data.auditScorecard || data.spyReport?.auditScorecard || {
  structure: pickScore(data.pageArchitecture?.structureScore, data.rawIntel?.localScore),
  clarity: pickScore(data.aidaAnalysis?.attention?.score, data.aidaAnalysis?.interest?.score),
  trust: pickScore(data.globalScoring?.breakdown?.trust?.score, data.trustAudit?.trustScore),
  offer: pickScore(data.offerAnalysis?.score, data.pricingPsychology?.score),
  cta: pickScore(data.ctaAnalysis?.score, data.aidaAnalysis?.action?.score),
  friction: pickScore(data.frictionAnalysis?.score, data.conversionFriction?.score)
};

const auditIssues = Array.isArray(data.auditIssues)
  ? data.auditIssues
  : (Array.isArray(data.spyReport?.auditIssues) ? data.spyReport.auditIssues : []);




const auditSectionMap = Array.isArray(data.auditSectionMap) && data.auditSectionMap.length
    ? data.auditSectionMap
    : (data.rawIntel?.sectionsDetailed || []).map(s => ({
        type: s.type,
        label: s.label || s.type,
        status: s.present ? 'present' : 'missing',
        present: s.present !== false,
        score: typeof s.score === 'number' ? s.score : null
    }));


const auditEvidence = data.auditEvidence || data.rawIntel?.evidence || {};
const decisionProofHtml = renderDecisionProofPanel(data, { isAr, isEn, dir, esc: escapeHtml });
const funnelSurgeryHtml = renderFunnelSectionSurgery(data, { isAr, isEn });
    // ══════════════════════════════════════════════════
    // ✅ NORMALISATION V12 → V9/V10 RÉTRO-COMPAT
    // ══════════════════════════════════════════════════

    // ── scoringMatrix ─────────────────────────────────
    // BUG-FIX : seo = breakdown.seo.score (et non neuromarketing)
    //           trust = breakdown.trust.score (et non neuromarketing.score)
    if (!data.scoringMatrix && data.globalScoring) {
        data.scoringMatrix = {
            global     : data.globalScoring.overall                              || 0,
            seo        : data.globalScoring.breakdown?.seo?.score                || 0,
            trust      : data.globalScoring.breakdown?.trust?.score
                      || data.globalScoring.breakdown?.neuromarketing?.trustScore || 0,
            conversion : data.globalScoring.breakdown?.conversion?.score         || 0,
            performance: data.globalScoring.breakdown?.technical?.score          || 0,
            funnel     : data.globalScoring.breakdown?.copywriting?.score        || 0,
        };
    }

    // ── projectIdentity ───────────────────────────────
    if (!data.projectIdentity && data.rawIntel) {
        data.projectIdentity = {
            siteType        : data.rawIntel.techStack ? Object.keys(data.rawIntel.techStack).join(', ') : 'N/A',
            niche           : data.chainOfThought?.agent1?.reasoning?.substring(0, 60) || 'N/A',
            subNiche        : null,
            productOrService: null,
            pricePoint      : data.rawIntel.detectedPrice
                            ? `${data.rawIntel.detectedPrice} ${data.rawIntel.currency}`
                            : null,
            targetMarket    : null,
            businessModel   : data.projectIdentity?.businessModel || null,
        };
    }
    if (data.projectIdentity && !data.projectIdentity.siteType && data.projectIdentity.businessModel) {
        data.projectIdentity.siteType = data.projectIdentity.businessModel;
    }

    // ── strategicBlueprint ────────────────────────────
    if (data.strategicBlueprint) {
        data.strategicBlueprint.killShotName     = data.strategicBlueprint.killShotName
                                                || data.strategicBlueprint.killShot || null;
        data.strategicBlueprint.coreHook        = data.strategicBlueprint.coreHook
                                                || data.strategicBlueprint.salesAngleRecommended || null;
        data.strategicBlueprint.executionPlan   = data.strategicBlueprint.executionPlan
                                                || data.strategicBlueprint.counterAttackStrategy || null;
        data.strategicBlueprint.unfairAdvantage = data.strategicBlueprint.unfairAdvantage
                                                || data.strategicBlueprint.competitiveAdvantage  || null;
        data.strategicBlueprint.opportunityGap  = data.strategicBlueprint.opportunityGap
                                                || data.strategicBlueprint.globalVerdict         || null;
        data.strategicBlueprint.weakPoints      = data.strategicBlueprint.weakPoints
                                                || data.chainOfThought?.agent3?.fatalFlaws       || [];
        if (!data.strategicBlueprint.quickWins || !data.strategicBlueprint.quickWins.length) {
            data.strategicBlueprint.quickWins = (data.quickWins || [])
                .map(qw => typeof qw === 'string' ? qw : `${qw.action} (${qw.effort} — +${qw.expectedGain})`);
        } else if (typeof data.strategicBlueprint.quickWins[0] === 'object') {
            data.strategicBlueprint.quickWins = data.strategicBlueprint.quickWins
                .map(qw => `${qw.action} (${qw.effort} — +${qw.expectedGain})`);
        }
    }

    // ── financialIntel ────────────────────────────────
    if (!data.financialIntel) {
        const fp  = data.financialProjection || {};
        const fa  = data.financialAudit      || {};
        const ri  = data.rawIntel            || {};
        data.financialIntel = {
            estimatedMonthlyTraffic : fp.monthlyVisitorsEstimate || null,
            averageBasket           : fp.detectedPrice   || ri.detectedPrice   || null,
            estimatedMargin         : null,
            estimatedCPA            : null,
            estimatedMRR            : fp.currentMonthlyRevenue  || null,
            revenueModel            : null,
            confidence              : fp.currentConversionRate ? 'MEDIUM' : 'LOW',
            reasoning               : fp.roiVerdict             || null,
            currency                : fp.currency || ri.currency || fa.currency || 'MAD',
            traffic                 : fp.monthlyVisitorsEstimate || null,
            basket                  : fp.detectedPrice  || ri.detectedPrice  || null,
            margin                  : null,
            cpa                     : null,
            mrr                     : fp.currentMonthlyRevenue  || null,
        };
    }
    if (!data.financialAudit) {
        data.financialAudit = {
            monthlyStealPotential : data.financialProjection?.potentialGain
                                 || data.financialAudit?.potentialRevenueIncrease || null,
            annualOpportunity     : data.financialProjection?.potentialGain
                                  ? data.financialProjection.potentialGain * 12 : null,
            currency              : data.rawIntel?.currency || 'MAD',
        };
    }

    // ── deepScrapeData ────────────────────────────────
    if (!data.deepScrapeData) {
        const ri = data.rawIntel || {};
        data.deepScrapeData = {
            visualDNA    : {
                computedColors  : ri.colors    || [],
                dominantColors  : ri.colors    || [],
                gradients       : [],
                computedFonts   : [],
                googleFonts     : [],
                fontSizes       : [],
                layoutSignals   : {}
            },
            priceIntel   : {
                bestPrice       : ri.detectedPrice || 0,
                currency        : ri.currency      || 'MAD',
                all             : [],
                struckPrices    : [],
                discountRate    : null,
                schemaPrices    : []
            },
            copyIntel    : {
                headlines       : { h1: [ri.h1], h2: ri.h2s || [], h3: ri.h3s || [] },
                realCTAs        : ri.ctas       || [],
                topKeywords     : [],
                phones          : ri.phones     || [],
                emails          : ri.emails     || [],
                whatsappLinks   : ri.hasWhatsApp ? ['https://wa.me/'] : [],
                socialLinks     : [],
                heroText        : null,
                guarantees      : [],
                testimonials    : [],
                faq             : []
            },
            trustSignals : {
                hasSSL              : ri.hasSSL      || false,
                hasWhatsApp         : ri.hasWhatsApp || false,
                hasReviews          : false,
                hasMoneyBackGuarantee: false,
                hasPhoneNumber      : (ri.phones || []).length > 0,
                hasEmail            : (ri.emails || []).length > 0,
                hasLegalPages       : false,
                hasCOD              : false,
                hasCertifications   : false,
                hasPaymentLogos     : false,
                hasMap              : false,
                hasChatWidget       : ri.hasWhatsApp || false,
                trustScore          : Math.round((data.scoringMatrix?.trust || 0) / 10),
            },
            trackingIntel: {
                hasGoogleAnalytics  : false,
                hasGTM              : false,
                hasFacebookPixel    : false,
                hasTikTokPixel      : false,
                hasHotjar           : false,
                hasClarity          : false,
                hasCrisp            : false,
                hasTidio            : false,
                hasStripe           : false,
                hasPaypal           : false,
                hasShopify          : !!(ri.techStack?.cms?.includes?.('Shopify')),
                hasWordPress        : !!(ri.techStack?.cms?.includes?.('WordPress')),
                hasNextJS           : false,
                hasMailchimp        : false,
                hasKlaviyo          : false,
            },
            formIntel    : { count: 0, hasCheckout: false, hasNewsletter: false, details: [] },
            performanceIntel: {
                ttfb            : null,
                lcpApprox       : null,
                loadEvent       : null,
                transferSize    : null,
                resourceCount   : null,
                totalElements   : null,
                isHeavyPage     : false,
                heavyResources  : []
            },
            media        : {
                totalImages     : 0,
                missingAltCount : 0,
                lazyLoadImages  : 0,
                webpImages      : 0,
                hasVideo        : false
            },
            conversion   : {
                hasPopup        : false,
                hasCountdown    : false,
                hasExitIntent   : false,
                hasStickyHeader : false,
                hasChatWidget   : false,
            },
            rawPlaywright: {
                phones          : ri.phones  || [],
                emails          : ri.emails  || [],
                whatsappLinks   : ri.hasWhatsApp ? ['https://wa.me/'] : [],
                socialLinks     : [],
                topKeywords     : [],
                vitals          : {},
                pageGlobal      : {
                    wordCount       : ri.wordCount || 0,
                    totalLinks      : 0,
                    hasCountdown    : false,
                    hasExitIntent   : false,
                    hasStickyHeader : false,
                    hasChatWidget   : false,
                },
                detailedSections: [],
                schemas         : ri.schemaTypes || []
            }
        };
    }

    // ── psychTriggers ─────────────────────────────────
    if (!data.psychTriggers) {
        data.psychTriggers = {
            urgency     : [],
            scarcity    : [],
            socialproof : [],
            ctabuttons  : data.rawIntel?.ctas || [],
            guarantees  : [],
            authority   : [],
            fearloss    : [],
            priceanchors: []
        };
    }

    // ── webCharte ─────────────────────────────────────
    // BUG-FIX : typography peut être un string (ex: "Arial, sans-serif") → normaliser en objet
    if (!data.webCharte) {
        const ri = data.rawIntel || {};
        data.webCharte = {
            colorPalette: {
                primary     : ri.primaryColor      || ri.colors?.[0] || null,
                secondary   : ri.colors?.[1]       || null,
                accent      : ri.colors?.[2]       || null,
                allDetected : ri.colors            || [],
            },
            typography  : { primaryFont: null, secondaryFont: null, googleFonts: [] },
            layout      : { framework: null, isMobile: true, structure: null, maxWidth: null, borderRadius: [] },
            designStyle : data.aidaAnalysis?.attention?.visualImpact || null,
            emotionalAtmosphere: null,
            designScore : 0,
        };
    } else {
        // Patch typo string → objet
        if (typeof data.webCharte.typography === 'string') {
            const rawFont = data.webCharte.typography;
            data.webCharte.typography = {
                primaryFont   : rawFont.split(',')[0]?.trim() || rawFont,
                secondaryFont : rawFont.split(',')[1]?.trim() || null,
                googleFonts   : [],
            };
        }
        if (!data.webCharte.typography) {
            data.webCharte.typography = { primaryFont: null, secondaryFont: null, googleFonts: [] };
        }
        const observedColors = Array.isArray(data.rawIntel?.colors) ? data.rawIntel.colors.filter(Boolean) : [];
        data.webCharte.colorPalette = data.webCharte.colorPalette && typeof data.webCharte.colorPalette === 'object'
            ? data.webCharte.colorPalette
            : {};
        data.webCharte.colorPalette.primary = data.webCharte.colorPalette.primary || data.rawIntel?.primaryColor || observedColors[0] || null;
        data.webCharte.colorPalette.secondary = data.webCharte.colorPalette.secondary || data.rawIntel?.secondColor || observedColors[1] || null;
        data.webCharte.colorPalette.accent = data.webCharte.colorPalette.accent || data.rawIntel?.accentColor || observedColors[2] || null;
        data.webCharte.colorPalette.allDetected = observedColors.length
            ? observedColors
            : (Array.isArray(data.webCharte.colorPalette.allDetected) ? data.webCharte.colorPalette.allDetected : []);
        // Patch designScore à 0 → essayer de le récupérer depuis globalScoring
        if (!data.webCharte.designScore && data.globalScoring?.breakdown?.design?.score) {
            data.webCharte.designScore = data.globalScoring.breakdown.design.score;
        }
    }

    // ── pageArchitecture ──────────────────────────────
    // BUG-FIX CRITIQUE : backend retourne sectionsAudit, pas pageArchitecture.arborescence
   if (!data.pageArchitecture) {
    const sectionsSource =
        data.rawIntel?.sectionsDetailed ||
        data.sectionsAudit ||
        data.rawIntel?.sectionsDetected ||
        data.rawIntel?.pageSections ||
        [];

    const mapSection = (s, i) => {
        if (typeof s === 'string') {
            return {
                sectionType     : s,
                title           : null,
                content         : null,
                hasCTA          : ['CTA', 'HERO', 'PRICING', 'CHECKOUT'].includes(s),
                conversionImpact: ['HERO', 'CTA', 'PRICING', 'CHECKOUT'].includes(s) ? 'HIGH' : 'MEDIUM',
                conversionRole  : null,
                ctaText         : null,
                weakness        : null,
                missingElement  : null,
                upgradeCopy     : null,
                score           : null,
                label           : s,
                present         : true,
            };
        }

        const type = s.sectionType || s.type || `SECTION_${i + 1}`;

        return {
            sectionType     : type,
            title           : s.title || s.label || null,
            content         : s.content || null,
            hasCTA          : s.hasCTA ?? ['CTA', 'HERO', 'PRICING', 'CHECKOUT'].includes(type),
            conversionImpact: s.conversionImpact || (['HERO', 'CTA', 'PRICING', 'CHECKOUT'].includes(type) ? 'HIGH' : 'MEDIUM'),
            conversionRole  : s.conversionRole || null,
            ctaText         : s.ctaText || null,
            weakness        : s.weakness || s.issues?.[0] || null,
            missingElement  : s.missingElement || null,
            upgradeCopy     : s.upgradeCopy || s.suggestion || null,
            score           : typeof s.score === 'number' ? s.score : null,
            label           : s.label || type,
            present         : s.present !== false,
        };
    };

    data.pageArchitecture = {
        arborescence           : Array.isArray(sectionsSource) ? sectionsSource.map(mapSection) : [],
        totalSections          : Array.isArray(sectionsSource) ? sectionsSource.length : 0,
        missingCriticalSections: data.rawIntel?.missingCriticalSections || [],
        funnelFlow             : data.funnelMapping?.dropOffStage || null,
        funnelGaps             : [],
    };
}

    // ── counter attack copy ───────────────────────────
    if (!data.funnel) {
        const rw = data.copywritingDeep?.rewriteSuggestions || {};
        data.funnel = {
            counterAttackCopy: {
                adHeadline     : rw.newH1          || null,
                whatsappMessage: rw.urgencyLine    || null,
                emailSubject   : rw.newSubheadline || null,
                smsText        : rw.guaranteeLine  || null,
            }
        };
    }

    // ── competitiveCounterStrategy ────────────────────
    if (!data.competitiveCounterStrategy) {
        data.competitiveCounterStrategy = {
            howToBeatThem  : data.strategicBlueprint?.howToBeatThem
                          || data.strategicBlueprint?.counterAttackStrategy || null,
            yourPositioning: data.strategicBlueprint?.yourPositioning       || null,
            uniqueAngle    : data.strategicBlueprint?.salesAngleRecommended || null,
        };
    }

    // ── copywritingAnalysis ───────────────────────────
    if (!data.copywritingAnalysis) {
        const cd = data.copywritingDeep || {};
        data.copywritingAnalysis = {
            bigIdea          : cd.currentAngle          || null,
            overallTone      : cd.toneOfVoice           || null,
            copyFormula      : cd.missingFormulas?.[0]  || null,
            headlineStrength : cd.headlineScore         || 0,
            ctaStrength      : cd.ctaStrength === 'Fort' || cd.ctaStrength === 'Excellent' ? 80
                             : cd.ctaStrength === 'Moyen' ? 55 : 30,
            socialProofScore : data.rawIntel?.socialProofsCount > 2 ? 75
                             : data.rawIntel?.socialProofsCount > 0 ? 45 : 20,
            urgencyScore     : data.funnelMapping?.stages?.find(s => s.stage === 'DESIRE')?.score || 0,
            topCopyLines     : [
                data.rawIntel?.h1,
                ...(data.rawIntel?.h2s || []).slice(0, 2)
            ].filter(Boolean),
        };
    }

    // ── funnelDNA ─────────────────────────────────────
    if (!data.funnelDNA) {
        data.funnelDNA = {
            funnelType            : data.funnelMapping?.funnelType           || null,
            conversionSequence    : data.funnelMapping?.stages?.map(s => s.stage) || [],
            retargeting           : false,
            emailSequenceDetected : (data.rawIntel?.emails || []).length > 0,
            checkoutDetected      : !!(data.rawIntel?.techStack?.payment?.length),
        };
    }

    // ── trustAndSocialProof ───────────────────────────
    if (!data.trustAndSocialProof) {
        data.trustAndSocialProof = {
            trustGaps: data.neuromarketing?.trustBuilding?.missing || [],
        };
    }

    // ── threatLevel ───────────────────────────────────
    if (!data.threatLevel) {
        const g = data.globalScoring?.overall || data.scoringMatrix?.global || 0;
        data.threatLevel = g >= 80 ? 'CRITICAL' : g >= 60 ? 'HIGH' : g >= 40 ? 'MEDIUM' : 'LOW';
    }

    // ── analysisDepth ─────────────────────────────────
    if (!data.analysisDepth) {
        data.analysisDepth = `V12 GOD TIER — ${data.meta?.agents || 5} Agents CoT`;
    }

    // ── magicPrompt ───────────────────────────────────
    data.magicPrompt = data.magicPrompt || data.aiRewritePrompt || null;

    // ══════════════════════════════════════════════════
    // ✅ FIN NORMALISATION — Lecture des données unifiées
    // ══════════════════════════════════════════════════

    const identity     = data.projectIdentity           || {};
    const scores       = data.scoringMatrix             || {};
    const blueprint    = data.strategicBlueprint        || {};
    const finraw       = data.financialIntel            || {};
    const audit        = data.financialAudit            || {};
    const charte       = data.webCharte                 || {};
    const arch         = data.pageArchitecture          || {};
    const ds           = data.deepScrapeData            || {};
    const rawPW        = ds.rawPlaywright               || {};
    const counter      = data.funnel?.counterAttackCopy || {};
    const psych        = data.psychTriggers             || {};
    const copyA        = data.copywritingAnalysis       || {};
    const funnelDNA    = data.funnelDNA                 || {};
    const trustA       = data.trustAndSocialProof       || {};
    const counterStrat = data.competitiveCounterStrategy || {};
    const magicPrompt  = data.magicPrompt || data.aiRewritePrompt || null;

    // ── NOUVELLES DONNÉES V12 perdues ─────────────────
    const aarrr      = data.aarrMetrics          || data.aarrr          || {};
    const pricing    = data.pricingPsychology    || {};
    const commerce   = data.commerceExploration || data.rawIntel?.commerceExploration || {};
    const techAudit  = data.technicalAudit       || {};
    const neuro      = data.neuromarketing        || {};
    const aidaData   = data.aidaAnalysis          || {};

    // Deep Scrape shortcuts
    const vis  = ds.visualDNA        || {};
    const cop  = ds.copyIntel        || {};
    const pri  = ds.priceIntel       || {};
    const tru  = ds.trustSignals     || {};
    const trk  = ds.trackingIntel    || {};
    const frm  = ds.formIntel        || {};
    const prf  = ds.performanceIntel || {};
    const med  = ds.media            || {};
    const conv = ds.conversion       || {};

    // Scores
    // BUG-FIX seoScore : lire depuis scoringMatrix.seo (clé corrigée dans la normalisation)
    const score      = pickScore(scores.global, data.globalScore) || 0;
    const seoScore   = pickScore(scores.seo, data.globalScoring?.breakdown?.seo?.score);
    const trustScore = pickScore(scores.trust, tru.trustScore);
    const convScore  = pickScore(scores.conversion);
    const perfScore  = pickScore(scores.performance);
    const funScore   = pickScore(scores.funnel);

    // Identity
    const siteType  = identity.siteType         || data.siteType  || null;
    const niche     = identity.niche            || null;
    const subNiche  = identity.subNiche         || null;
    const product   = identity.productOrService || null;
    const pricePoint= identity.pricePoint       || null;
    const targetMkt = identity.targetMarket     || null;
    const bizModel  = identity.businessModel    || null;

    // Financial
    const fin = {
        traffic   : finraw.estimatedMonthlyTraffic || finraw.traffic    || 0,
        basket    : finraw.averageBasket           || finraw.basket     || 0,
        margin    : finraw.estimatedMargin         || finraw.margin     || null,
        cpa       : finraw.estimatedCPA            || finraw.cpa        || null,
        mrr       : finraw.estimatedMRR            || null,
        netProfit : audit.monthlyStealPotential    || finraw.netProfit  || null,
        annual    : audit.annualOpportunity        || null,
        currency  : audit.currency || pri.currency || 'MAD',
        reasoning : finraw.reasoning               || null,
        confidence: finraw.confidence              || null,
        cr        : data.financialProjection?.currentConversionRate || null,
        targetCr  : data.financialProjection?.targetConversionRate  || null,
    };

    // Design
    // BUG-FIX : typography déjà normalisée en objet ci-dessus, lecture sécurisée
    const typo = (typeof charte.typography === 'object' && charte.typography !== null)
               ? charte.typography : {};
    const design = {
        primary      : charte.colorPalette?.primary      || vis.computedColors?.[0] || null,
        secondary    : charte.colorPalette?.secondary    || vis.computedColors?.[1] || null,
        accent       : charte.colorPalette?.accent       || vis.computedColors?.[2] || null,
        bg           : charte.colorPalette?.background   || vis.layoutSignals?.bodyBackground || null,
        allColors    : charte.colorPalette?.allDetected  || vis.dominantColors || [],
        computedColors: vis.computedColors               || [],
        gradients    : vis.gradients                     || [],
        fontMain     : typo.primaryFont                  || vis.computedFonts?.[0]  || null,
        fontSec      : typo.secondaryFont                || vis.computedFonts?.[1]  || null,
        googleFonts  : typo.googleFonts                  || vis.googleFonts          || [],
        fontSizes    : typo.fontSizes                    || vis.fontSizes            || [],
        framework    : charte.layout?.framework          || null,
        structure    : charte.layout?.structure          || null,
        maxWidth     : charte.layout?.maxWidth           || vis.layoutSignals?.maxWidth || null,
        borderRadius : charte.layout?.borderRadius       || vis.layoutSignals?.dominantBorderRadius?.join(', ') || null,
        isMobile     : charte.layout?.isMobile          ?? true,
        hasGradient  : charte.layout?.hasGradient       || vis.layoutSignals?.hasGradient   || false,
        hasAnim      : charte.layout?.hasAnimations     || vis.layoutSignals?.hasTransitions || false,
        style        : charte.designStyle               || null,
        atmo         : charte.emotionalAtmosphere       || null,
        // BUG-FIX designScore : fallback sur globalScoring.breakdown.design si 0
        score        : charte.designScore
                    || data.globalScoring?.breakdown?.design?.score
                    || data.globalScoring?.breakdown?.ux?.score
                    || 0,
        colorPsychology : neuro.colorPsychology          || null,
        visualHierarchy : neuro.visualHierarchy          || null,
    };

    // Sections (BUG-FIX CRITIQUE : arch.arborescence alimenté par sectionsAudit)
    const sections      = arch.arborescence   || data.sections || [];
    const rawSections   = rawPW.detailedSections || [];
    const funnelFlow    = arch.funnelFlow     || null;
    const funnelGaps    = arch.funnelGaps     || [];
    const totalSections = arch.totalSections  || sections.length;
    const sectionsNoCTA = sections.filter(s => !s.hasCTA);
    const sectionsCTA   = sections.filter(s =>  s.hasCTA);
    const sectionsHigh  = sections.filter(s =>  s.conversionImpact === 'HIGH');

    // Keywords & Contact
    const topKeywords   = rawPW.topKeywords   || cop.topKeywords   || [];
    const phones        = rawPW.phones        || cop.phones        || [];
    const emails        = rawPW.emails        || cop.emails        || [];
    const whatsappLinks = rawPW.whatsappLinks || cop.whatsappLinks || [];
    const socialLinks   = rawPW.socialLinks   || cop.socialLinks   || [];
    const pageGlobal    = rawPW.pageGlobal    || {};
    const vitals        = rawPW.vitals        || {};

    // ══════════════════════════════════════════════════
    // 🌍 I18N — Labels multilingues FR / AR / EN
    // ══════════════════════════════════════════════════
    const i18n = {
        // Header
        reportTitle      : isAr ? 'تقرير الاستخبارات الاستراتيجية'
                         : isEn ? 'Strategic Intelligence Report'
                         :        'Rapport Intelligence Stratégique',
        // Financial
        financialTitle   : isAr ? 'الاستخبارات المالية'
                         : isEn ? 'Financial Intelligence'
                         :        'Financial Intelligence',
        trafficLabel     : isAr ? 'الزيارات/شهر'   : isEn ? 'Traffic/Mo'      : 'Trafic/Mois',
        basketLabel      : isAr ? 'متوسط السلة'     : isEn ? 'Avg Basket'      : 'Panier Moy.',
        marginLabel      : isAr ? 'الهامش'          : isEn ? 'Margin'          : 'Marge',
        mrrLabel         : isAr ? 'الإيرادات المتكررة': isEn ? 'Est. MRR'      : 'MRR Estimé',
        stealLabel       : isAr ? 'إمكانية السرقة'  : isEn ? 'Steal Potential' : 'Steal Potential',
        annualLabel      : isAr ? 'السنوي'          : isEn ? 'Annual'          : 'Annuel',
        confidenceLabel  : isAr ? 'الثقة'           : isEn ? 'Confidence'      : 'Confiance',
        reasoningLabel   : isAr ? 'التحليل المالي'  : isEn ? 'Financial Reasoning' : 'Raisonnement Financier',
        crLabel          : isAr ? 'معدل التحويل'    : isEn ? 'Conv. Rate'      : 'Taux Conv.',
        // AARRR
        aarrTitle        : isAr ? 'مقاييس AARRR'
                         : isEn ? 'AARRR Metrics'
                         :        'Métriques AARRR',
        acquisitionLabel : isAr ? 'الاستحواذ'       : isEn ? 'Acquisition'     : 'Acquisition',
        activationLabel  : isAr ? 'التفعيل'         : isEn ? 'Activation'      : 'Activation',
        retentionLabel   : isAr ? 'الاحتفاظ'        : isEn ? 'Retention'       : 'Rétention',
        revenueLabel     : isAr ? 'الإيراد'         : isEn ? 'Revenue'         : 'Revenue',
        referralLabel    : isAr ? 'الإحالة'         : isEn ? 'Referral'        : 'Referral',
        scoreLabel       : isAr ? 'نقاط'            : isEn ? 'Score'           : 'Score',
        issuesLabel      : isAr ? 'مشاكل'           : isEn ? 'Issues'          : 'Problèmes',
        fixLabel         : isAr ? 'إصلاح'           : isEn ? 'Fix'             : 'Correction',
        // Pricing Psychology
        pricingTitle     : isAr ? 'سيكولوجية التسعير'
                         : isEn ? 'Pricing Psychology'
                         :        'Psychologie du Prix',
        bundleLabel      : isAr ? 'اقتراح الحزمة'   : isEn ? 'Bundle Suggestion' : 'Bundle Suggéré',
        anchoringLabel   : isAr ? 'تثبيت السعر'     : isEn ? 'Price Anchoring'   : 'Ancrage Prix',
        verdictLabel     : isAr ? 'حكم السعر'       : isEn ? 'Price Verdict'     : 'Verdict Prix',
        // Blueprint
        blueprintTitle   : isAr ? 'المخطط الاستراتيجي'
                         : isEn ? 'Strategic Blueprint'
                         :        'Blueprint Stratégique',
        coreHookLabel    : isAr ? 'الخطاف الأساسي'  : isEn ? 'Core Hook'           : 'Core Hook',
        execPlanLabel    : isAr ? 'خطة التنفيذ'     : isEn ? 'Execution Plan'      : "Plan d'Exécution",
        unfairAdvLabel   : isAr ? 'الميزة غير العادلة': isEn ? 'Unfair Advantage'  : 'Avantage Déloyal',
        oppGapLabel      : isAr ? 'فجوة الفرصة'     : isEn ? 'Opportunity Gap'    : 'Opportunity Gap',
        weakPointsLabel  : isAr ? 'نقاط الضعف'      : isEn ? 'Weak Points'        : 'Weak Points',
        quickWinsLabel   : isAr ? 'انتصارات سريعة'  : isEn ? 'Quick Wins'         : 'Quick Wins',
        counterStratLabel: isAr ? 'استراتيجية المواجهة': isEn ? 'Counter Strategy' : 'Stratégie Concurrentielle',
        // Neuro / Psych
        neuroTitle       : isAr ? 'التسويق العصبي والمحفزات'
                         : isEn ? 'Neuromarketing & Psych Triggers'
                         :        'Neuromarketing & Déclencheurs Psy',
        biasesLabel      : isAr ? 'التحيزات المعرفية' : isEn ? 'Cognitive Biases'   : 'Biais Cognitifs',
        readingLabel     : isAr ? 'نمط القراءة'       : isEn ? 'Reading Pattern'    : 'Pattern Lecture',
        colorPsyLabel    : isAr ? 'سيكولوجية اللون'   : isEn ? 'Color Psychology'   : 'Psychologie Couleur',
        hierarchyLabel   : isAr ? 'التسلسل البصري'    : isEn ? 'Visual Hierarchy'   : 'Hiérarchie Visuelle',
        psychTriggersLabel: isAr ? 'محفزات نفسية'     : isEn ? 'Psych Triggers'    : 'Déclencheurs Psy',
        urgencyLabel     : isAr ? 'الإلحاح'           : isEn ? 'Urgency'            : 'Urgence',
        scarcityLabel    : isAr ? 'الندرة'            : isEn ? 'Scarcity'           : 'Rareté',
        socialProofLabel : isAr ? 'الدليل الاجتماعي'  : isEn ? 'Social Proof'       : 'Preuve Sociale',
        authorityLabel   : isAr ? 'السلطة'            : isEn ? 'Authority'          : 'Autorité',
        fearLossLabel    : isAr ? 'الخوف من الخسارة'  : isEn ? 'Fear of Loss'       : 'Peur de Perdre',
        // Technical Audit
        techAuditTitle   : isAr ? 'المراجعة التقنية'
                         : isEn ? 'Technical SEO Audit'
                         :        'Audit Technique SEO',
        schemaLabel      : isAr ? 'Schema.org'        : isEn ? 'Schema.org'         : 'Schema.org',
        criticalLabel    : isAr ? 'مشاكل حرجة'        : isEn ? 'Critical Issues'    : 'Problèmes Critiques',
        seoIssuesLabel   : isAr ? 'مشاكل SEO'         : isEn ? 'SEO Issues'         : 'Problèmes SEO',
        // Design
        designTitle      : isAr ? 'الهوية البصرية'
                         : isEn ? 'Visual Identity'
                         :        'Identité Visuelle — Charte Web',
        // Performance
        perfTitle        : isAr ? 'الأداء، الثقة وتقنية الموقع'
                         : isEn ? 'Performance, Trust & Tech Stack'
                         :        'Performance, Trust & Tech Stack',
        // Copy
        copyTitle        : isAr ? 'استخبارات النص والتسويق العصبي'
                         : isEn ? 'Copy Intelligence & Neuromarketing'
                         :        'Copy Intelligence & Neuromarketing',
        // Indicators
        indicatorsTitle  : isAr ? 'مؤشرات الصفحة'    : isEn ? 'Page Indicators'    : 'Indicateurs de Page',
        // Autopsy
        autopsyTitle     : isAr ? 'تشريح الصفحة — خريطة AIDA'
                         : isEn ? 'Page Autopsy — AIDA Map'
                         :        'Autopsie & Arborescence AIDA',
        // Counter Attack
        counterTitle     : isAr ? 'نسخة الهجوم المضاد'
                         : isEn ? 'Counter Attack Copy'
                         :        'Counter-Attack Copy',
        adHeadlineLabel  : isAr ? 'عنوان الإعلان'    : isEn ? 'Ad Headline'        : 'Ad Headline',
        whatsappLabel    : isAr ? 'واتساب'            : isEn ? 'WhatsApp'           : 'WhatsApp',
        emailLabel       : isAr ? 'موضوع البريد'      : isEn ? 'Email Subject'      : 'Email Subject',
        smsLabel         : isAr ? 'رسالة SMS'         : isEn ? 'SMS'               : 'SMS',
        // Magic Prompt
        magicTitle       : isAr ? 'موجه إعادة التصميم السحري'
                         : isEn ? 'Magic Redesign Prompt'
                         :        'Magic Redesign Prompt',
        magicSub         : isAr ? 'انسخ إلى أداة التحرير'
                         : isEn ? 'Copy to your editing tool'
                         :        'Copiez dans votre outil de generation',
        copyBtn          : isAr ? 'نسخ'               : isEn ? 'Copy'              : 'Copier',
        copiedBtn        : isAr ? 'تم النسخ!'         : isEn ? 'Copied!'           : 'Copié !',
        // Sections
        ctaLabel         : isAr ? 'زر الدعوة'         : isEn ? 'CTA'               : 'CTA',
        noCTALabel       : isAr ? 'بدون CTA'          : isEn ? 'no CTA'            : 'sans CTA',
        highLabel        : isAr ? 'تأثير عالٍ'        : isEn ? 'HIGH impact'       : 'HIGH impact',
        weaknessLabel    : isAr ? 'نقطة ضعف'          : isEn ? 'Weakness'          : 'Faiblesse',
        missingLabel     : isAr ? 'عنصر ناقص'         : isEn ? 'Missing'           : 'Manquant',
        upgradeLabel     : isAr ? 'نسخة محسّنة'       : isEn ? 'Upgrade Copy'      : 'Upgrade Copy',
        titleLabel       : isAr ? 'العنوان'           : isEn ? 'Title'             : 'Titre',
        // AIDA phases
        attentionLabel   : isAr ? 'انتباه'            : isEn ? 'Attention'         : 'Attention',
        interestLabel    : isAr ? 'اهتمام'            : isEn ? 'Interest'          : 'Intérêt',
        desireLabel      : isAr ? 'رغبة'              : isEn ? 'Desire'            : 'Désir',
        actionLabel      : isAr ? 'فعل'               : isEn ? 'Action'            : 'Action',
        aidaAttFix       : isAr ? 'إصلاح الانتباه'   : isEn ? 'Attention Fix'      : 'Fix Attention',
        aidaIntFix       : isAr ? 'إصلاح الاهتمام'   : isEn ? 'Interest Fix'       : 'Fix Intérêt',
        aidaDesFix       : isAr ? 'إصلاح الرغبة'     : isEn ? 'Desire Fix'         : 'Fix Désir',
        aidaActFix       : isAr ? 'إصلاح الفعل'      : isEn ? 'Action Fix'         : 'Fix Action',
        // Score labels
        nicheLabel       : isAr ? 'المجال'            : isEn ? 'Niche'             : 'Niche',
        productLabel     : isAr ? 'المنتج'            : isEn ? 'Product'           : 'Produit',
        priceLabel       : isAr ? 'نقطة السعر'        : isEn ? 'Price Point'       : 'Price Point',
        marketLabel      : isAr ? 'السوق'             : isEn ? 'Market'            : 'Marché',
        // Trust
        trustTitle       : isAr ? 'إشارات الثقة'      : isEn ? 'Trust Signals'    : 'Trust Signals',
        // Sections counter
        sectionsLabel    : isAr ? 'أقسام'             : isEn ? 'sections'          : 'sections',
        wordsLabel       : isAr ? 'كلمة'              : isEn ? 'words'             : 'mots',
        // Score levels
        excellentLabel   : isAr ? 'ممتاز'             : isEn ? 'Excellent'         : 'Excellent',
        averageLabel     : isAr ? 'متوسط'             : isEn ? 'Average'           : 'Moyen',
        weakLabel        : isAr ? 'ضعيف'              : isEn ? 'Weak'              : 'Faible',
        // Funnel Flow
        funnelFlowLabel  : isAr ? 'تدفق القمع'        : isEn ? 'Funnel Flow'       : 'Funnel Flow',
        funnelGapsLabel  : isAr ? 'ثغرات القمع'       : isEn ? 'Funnel Gaps'       : 'Funnel Gaps',
        // Copy
        bigIdeaLabel     : isAr ? 'الفكرة الكبرى'     : isEn ? 'Big Idea'          : 'Big Idea',
        copyScoresLabel  : isAr ? 'درجات النص'        : isEn ? 'Copy Scores'       : 'Copy Scores',
        toneLabel        : isAr ? 'النبرة'            : isEn ? 'Tone'              : 'Ton',
        formulaLabel     : isAr ? 'الصيغة'            : isEn ? 'Formula'           : 'Formule',
        topCopyLabel     : isAr ? 'أفضل عبارات النص'  : isEn ? 'Top Copy Lines'    : 'Top Copy Lines',
        // Tech
        techTitle        : isAr ? 'التقنيات المستخدمة': isEn ? 'Tech Stack'        : 'Tech Stack',
        noneDetected     : isAr ? 'لم يتم اكتشاف أي شيء': isEn ? 'None detected'  : 'Aucun détecté',
        // Performance vitals
        vitalsLabel      : isAr ? 'مؤشرات الأداء'    : isEn ? 'Vitals'            : 'Vitals',
        topResLabel      : isAr ? 'أثقل الموارد'      : isEn ? 'Top Resources'     : 'Top Ressources',
        // Conversion signals
        convSignalsLabel : isAr ? 'إشارات التحويل'    : isEn ? 'Conversion Signals': 'Conversion Signals',
        // Keywords
        topKwLabel       : isAr ? 'أهم الكلمات المفتاحية'
                         : isEn ? 'Top Keywords — real frequency'
                         :        'Top Keywords — fréquence réelle',
        // Public report labels
        cotLabel         : isAr ? 'منطق التقرير'       : isEn ? 'Report reasoning'       : 'Raisonnement du rapport',
        agent1Label      : isAr ? 'هوية الصفحة'         : isEn ? 'Page identity'           : 'Identite de la page',
        agent2Label      : isAr ? 'مسار البيع'          : isEn ? 'Sales journey'           : 'Parcours de vente',
        agent3Label      : isAr ? 'خطة التحسين'          : isEn ? 'Improvement plan'        : 'Plan d amelioration',
        agent4Label      : isAr ? 'محفزات القرار'      : isEn ? 'Decision triggers'       : 'Declencheurs de decision',
    };

        // ══════════════════════════════════════════════════
    // 🎨 COULEURS & HELPERS
    // ══════════════════════════════════════════════════
    const threatLevel  = data.threatLevel || 'MEDIUM';
    const threatColor  = threatLevel === 'CRITICAL' ? 'ef4444'
                       : threatLevel === 'HIGH'     ? 'f97316'
                       : threatLevel === 'MEDIUM'   ? 'f59e0b' : '10b981';
    const scoreColor   = score >= 80 ? '10b981' : score >= 60 ? 'f59e0b' : 'ef4444';
    const scoreBg      = score >= 80 ? 'rgba(16,185,129,0.1)'
                       : score >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
    const scoreLabel   = score >= 80 ? i18n.excellentLabel
                       : score >= 60 ? i18n.averageLabel : i18n.weakLabel;

    const toRgb = hex => {
        const h = (hex || '888888').replace('#', '');
        return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
    };
    const esc = s => (s || '').toString()
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const fieldIntelModel = buildFieldIntelModel(data?.apify || null);
const fieldGuideTopHtml = renderFieldGuideTop(fieldIntelModel, { isAr, isEn, dir, esc });
const fieldStudiesBottomHtml = renderFieldStudiesBottom(fieldIntelModel, { isAr, isEn, dir, esc });


     const renderKvObject = (obj, items = []) => {
      if (!obj || typeof obj !== 'object') return '';


      return items.map(item => {
            const val = obj[item.key];
            if (val === null || val === undefined || val === '') return '';


            return `
                  <div style="margin-bottom:6px;" dir="auto">
                        <small style="color:${item.color || '#94a3b8'};font-size:0.58rem;font-weight:700;text-transform:uppercase;">
                              ${item.label}:
                        </small>
                        <div style="font-size:0.76rem;color:#e2e8f0;line-height:1.6;margin-top:2px;">
                              ${esc(String(val))}
                        </div>
                  </div>
            `;
      }).join('');
};


const colorPsychologyHtml =
    design.colorPsychology && typeof design.colorPsychology === 'object'
        ? renderKvObject(design.colorPsychology, [
            { key: 'primary', label: isAr ? 'اللون' : isEn ? 'Primary' : 'Couleur', color: '#ec4899' },
            { key: 'emotion', label: isAr ? 'العاطفة' : isEn ? 'Emotion' : 'Émotion', color: '#ec4899' },
            { key: 'conversionImpact', label: isAr ? 'الأثر' : isEn ? 'Impact' : 'Impact conversion', color: '#ec4899' },
            { key: 'recommendation', label: isAr ? 'التوصية' : isEn ? 'Recommendation' : 'Recommandation', color: '#ec4899' },
        ])
        : (design.colorPsychology ? `<div dir="auto">${esc(String(design.colorPsychology))}</div>` : '');

const visualHierarchyHtml =
    design.visualHierarchy && typeof design.visualHierarchy === 'object'
        ? renderKvObject(design.visualHierarchy, [
            { key: 'score', label: 'Score', color: '#06b6d4' },
            { key: 'eyeFlow', label: isAr ? 'مسار العين' : isEn ? 'Eye Flow' : 'Parcours visuel', color: '#06b6d4' },
            { key: 'recommendation', label: isAr ? 'التوصية' : isEn ? 'Recommendation' : 'Recommandation', color: '#06b6d4' },
            { key: 'ctaVisibility', label: isAr ? 'وضوح CTA' : isEn ? 'CTA Visibility' : 'Visibilité CTA', color: '#06b6d4' },
            { key: 'fix', label: isAr ? 'Correction' : isEn ? 'Fix' : 'Correction', color: '#06b6d4' },
        ])
        : (design.visualHierarchy ? `<div dir="auto">${esc(String(design.visualHierarchy))}</div>` : '');
    // ══════════════════════════════════════════════════
    // Bloc raisonnement du rapport
    // ══════════════════════════════════════════════════
    const cot     = data.chainOfThought || {};
    const cotHtml = (cot.agent1 || cot.agent2 || cot.agent3 || cot.agent4) ? `
    <div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #6366f1;" dir="${dir}">
        <h3 style="margin-bottom:14px;font-family:Cairo;display:flex;align-items:center;gap:10px;color:white;font-size:1rem;">
            <i class="fas fa-brain" style="color:#6366f1"></i>
            ${i18n.cotLabel} — V12 GOD TIER
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
            ${[
                { label: i18n.agent1Label, cot: cot.agent1, color: '#3b82f6', icon: 'fa-user-tie'     },
                { label: i18n.agent2Label, cot: cot.agent2, color: '#10b981', icon: 'fa-funnel-dollar' },
                { label: i18n.agent3Label, cot: cot.agent3, color: '#f59e0b', icon: 'fa-chess-knight'  },
                { label: i18n.agent4Label, cot: cot.agent4, color: '#a855f7', icon: 'fa-brain'         },
            ].filter(a => a.cot && Object.keys(a.cot).length > 0).map(a => {
                const txt = a.cot.reasoning || a.cot.funnelReasoning || a.cot.neuroReasoning
                         || Object.values(a.cot).find(v => typeof v === 'string') || '';
                return `
                <div style="background:rgba(255,255,255,0.02);border:1px solid ${a.color}22;
                            border-radius:10px;padding:12px;">
                    <small style="color:${a.color};font-weight:800;font-size:0.6rem;
                                  text-transform:uppercase;letter-spacing:1px;
                                  display:block;margin-bottom:6px;">
                        <i class="fas ${a.icon}"></i> ${a.label}
                    </small>
                    <p style="margin:0;font-size:0.8rem;color:#cbd5e1;line-height:1.6;
                              font-style:italic;" dir="auto">${esc(txt)}</p>
                </div>`;
            }).join('')}
        </div>
    </div>` : '';

    // ══════════════════════════════════════════════════
    // 📦 BLOC 0 — HEADER DASHBOARD
    // ══════════════════════════════════════════════════
    const headerHtml = `
    <div class="result-card fade-in-up" style="margin-bottom:22px;padding:26px;
         border-top:4px solid #${scoreColor};position:relative;overflow:hidden;" dir="${dir}">
        <div style="position:absolute;top:-60px;${isAr?'left':'right'}:-60px;width:220px;height:220px;
             background:radial-gradient(circle,#${scoreColor}18 0,transparent 70%);
             pointer-events:none;"></div>
        <div style="display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;">

            <!-- Score Circle -->
            <div style="text-align:center;background:${scoreBg};border:2px solid #${scoreColor};
                 border-radius:50%;width:86px;height:86px;display:flex;flex-direction:column;
                 align-items:center;justify-content:center;flex-shrink:0;">
                <div style="font-size:1.75rem;font-weight:900;color:#${scoreColor};line-height:1;">${score}</div>
                <div style="font-size:0.58rem;color:#${scoreColor};text-transform:uppercase;font-weight:700;">/100</div>
            </div>

            <!-- Info centrale -->
            <div>
                <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;flex-wrap:wrap;">
                    ${siteType ? `<span style="background:rgba(139,92,246,0.15);color:#c4b5fd;
                        padding:3px 11px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        border:1px solid rgba(139,92,246,0.3);">${esc(siteType)}</span>` : ''}
                    ${bizModel ? `<span style="background:rgba(6,182,212,0.1);color:#67e8f9;
                        padding:3px 11px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        border:1px solid rgba(6,182,212,0.2);">${esc(bizModel)}</span>` : ''}
                    <span style="background:${scoreBg};color:#${scoreColor};
                        padding:3px 11px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        border:1px solid #${scoreColor}40;">${scoreLabel}</span>
                    ${threatLevel ? `<span style="background:#${threatColor}15;color:#${threatColor};
                        padding:3px 11px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        border:1px solid #${threatColor}35;">${threatLevel}</span>` : ''}
                    ${data.analysisDepth ? `<span style="background:rgba(168,85,247,0.1);color:#a78bfa;
                        padding:3px 11px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        border:1px solid rgba(168,85,247,0.2);">${esc(data.analysisDepth)}</span>` : ''}
                    ${data.fetchLayer ? `<span style="background:rgba(255,255,255,0.04);color:#475569;
                        padding:3px 11px;border-radius:20px;font-size:0.62rem;font-weight:600;
                        border:1px solid rgba(255,255,255,0.06);">
                        Layer: ${esc(data.fetchLayer)}</span>` : ''}
                </div>

                <div style="font-size:1.2rem;font-weight:800;color:white;margin-bottom:8px;
                     font-family:Cairo;">${i18n.reportTitle}</div>

                <div style="display:flex;flex-wrap:wrap;gap:12px;">
                    ${[
                        { label: i18n.nicheLabel,   val: niche     },
                        { label: i18n.productLabel, val: product   },
                        { label: i18n.priceLabel,   val: pricePoint},
                        { label: i18n.marketLabel,  val: targetMkt },
                    ].filter(x => x.val && x.val !== '—').map(x => `
                        <div style="font-size:0.72rem;color:#64748b;">
                            <span style="color:#94a3b8;font-weight:600;">${x.label}: </span>
                            ${esc(x.val)}
                        </div>`).join('')}
                </div>

                <!-- Contact rapide -->
                ${phones.length || emails.length || whatsappLinks.length ? `
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:9px;">
                    ${phones[0] ? `<a href="tel:${phones[0]}"
                        style="font-size:0.68rem;color:#10b981;text-decoration:none;">
                        📞 ${phones[0]}</a>` : ''}
                    ${emails[0] ? `<a href="mailto:${emails[0]}"
                        style="font-size:0.68rem;color:#3b82f6;text-decoration:none;">
                        ✉️ ${emails[0]}</a>` : ''}
                    ${whatsappLinks[0] ? `<a href="${whatsappLinks[0]}" target="_blank"
                        style="font-size:0.68rem;color:#25d366;text-decoration:none;">
                        WhatsApp</a>` : ''}
                    ${socialLinks.slice(0,3).map(l => {
                        const icon = /instagram/i.test(l) ? 'fa-instagram'
                                   : /facebook/i.test(l)  ? 'fa-facebook'
                                   : /tiktok/i.test(l)    ? 'fa-tiktok'
                                   : /youtube/i.test(l)   ? 'fa-youtube'
                                   : /twitter/i.test(l)   ? 'fa-twitter' : 'fa-link';
                        return `<a href="${l}" target="_blank"
                            style="font-size:0.68rem;color:#94a3b8;text-decoration:none;">
                            <i class="fab ${icon}"></i></a>`;
                    }).join('')}
                </div>` : ''}

                <div style="font-size:0.78rem;color:#475569;margin-top:8px;">
                    ${totalSections} ${i18n.sectionsLabel}
                    <span style="color:#ef4444;font-weight:700;">
                        ${sectionsNoCTA.length} ${i18n.noCTALabel}
                    </span>
                    ${sectionsHigh.length ? `<span style="color:#f59e0b;font-weight:700;">
                        — ${sectionsHigh.length} HIGH impact</span>` : ''}
                    ${pageGlobal.wordCount ? `<span style="color:#64748b;">
                        — ${pageGlobal.wordCount.toLocaleString()} ${i18n.wordsLabel}</span>` : ''}
                </div>
            </div>

            <div style="flex-shrink:0;">
                <canvas id="scoreDonut" width="78" height="78"></canvas>
            </div>
        </div>

        <!-- Sub-scores -->
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;
             margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05);">
            ${[
                { label: 'SEO',    v: seoScore,   c: '#3b82f6' },
                { label: 'Trust',  v: trustScore, c: '#10b981' },
                { label: isAr ? 'تحويل' : 'Conv.',  v: convScore, c: '#f59e0b' },
                { label: isAr ? 'أداء'  : 'Perf.',  v: perfScore, c: '#ef4444' },
                { label: 'Funnel', v: funScore,   c: '#8b5cf6' },
                { label: 'Global', v: score,      c: `#${scoreColor}` },
            ].map(s => `
                <div style="text-align:center;">
                    ${(() => {
                        const n = Number(s.v);
                        const hasScore = Number.isFinite(n);
                        const label = hasScore ? n : (isAr ? 'للفحص' : isEn ? 'Check' : 'À vérifier');
                        const width = hasScore ? Math.max(0, Math.min(100, n)) : 0;
                        const color = hasScore ? s.c : '#64748b';
                        return `
                    <div style="font-size:0.78rem;font-weight:800;color:${color};">${label}</div>
                    <div style="height:3px;background:rgba(255,255,255,0.05);
                         border-radius:3px;margin:3px 0;overflow:hidden;">
                        <div style="height:100%;width:${width}%;background:${color};
                             border-radius:3px;transition:width 1.5s ease;"></div>
                    </div>
                        `;
                    })()}
                    <div style="font-size:0.58rem;color:#475569;text-transform:uppercase;
                         letter-spacing:0.5px;">${s.label}</div>
                </div>`).join('')}
        </div>
    </div>`;

    // ══════════════════════════════════════════════════
    // 💰 BLOC 1 — FINANCIAL INTELLIGENCE (enrichi V12)
    // ══════════════════════════════════════════════════
    const fKpis = [
        { label: i18n.trafficLabel, val: fin.traffic  ? fin.traffic.toLocaleString()                       : null, c: '#3b82f6', icon: 'fa-users'        },
        { label: i18n.basketLabel,  val: fin.basket   ? `${fin.basket} ${fin.currency}`                    : null, c: '#f59e0b', icon: 'fa-shopping-cart' },
        { label: i18n.marginLabel,  val: fin.margin   ? fin.margin                                         : null, c: '#10b981', icon: 'fa-chart-line'    },
        { label: 'CPA',             val: fin.cpa      ? `${fin.cpa} ${fin.currency}`                       : null, c: '#ef4444', icon: 'fa-bullseye'      },
        { label: i18n.mrrLabel,     val: fin.mrr      ? `${fin.mrr.toLocaleString()} ${fin.currency}`      : null, c: '#8b5cf6', icon: 'fa-coins'         },
        { label: i18n.stealLabel,   val: fin.netProfit? `${fin.netProfit.toLocaleString()} ${fin.currency}`: null, c: '#ec4899', icon: 'fa-crosshairs'    },
        { label: i18n.crLabel,      val: fin.cr       ? `${fin.cr}%`                                       : null, c: '#06b6d4', icon: 'fa-percent'       },
    ].filter(k => k.val);

    const financialHtml = fKpis.length || fin.reasoning ? `
    <div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #10b981;" dir="${dir}">
        <div style="display:flex;justify-content:space-between;align-items:center;
             margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-family:Cairo;display:flex;align-items:center;
                 gap:10px;color:white;font-size:1rem;">
                <i class="fas fa-brain" style="color:#10b981"></i>
                ${i18n.financialTitle}
            </h3>
            <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
                ${fin.confidence ? `<span style="background:rgba(16,185,129,0.1);color:#10b981;
                    padding:2px 10px;border-radius:20px;font-size:0.65rem;font-weight:700;
                    border:1px solid rgba(16,185,129,0.2);">
                    ${fin.confidence} ${i18n.confidenceLabel}</span>` : ''}
                ${fin.annual ? `<span style="background:rgba(139,92,246,0.1);color:#a78bfa;
                    padding:2px 10px;border-radius:20px;font-size:0.65rem;font-weight:700;
                    border:1px solid rgba(139,92,246,0.2);">
                    ${i18n.annualLabel}: ${fin.annual.toLocaleString()} ${fin.currency}</span>` : ''}
                ${fin.targetCr ? `<span style="background:rgba(6,182,212,0.1);color:#67e8f9;
                    padding:2px 10px;border-radius:20px;font-size:0.65rem;font-weight:700;
                    border:1px solid rgba(6,182,212,0.2);">
                    Target CR: ${fin.targetCr}%</span>` : ''}
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));
             gap:10px;${fin.reasoning ? 'margin-bottom:16px;' : ''}">
            ${fKpis.map(k => {
                const rgb = toRgb(k.c);
                return `
                <div style="background:rgba(${rgb},0.07);border:1px solid rgba(${rgb},0.18);
                     border-radius:12px;padding:13px;text-align:center;">
                    <i class="fas ${k.icon}" style="color:${k.c};font-size:0.95rem;
                       margin-bottom:5px;display:block;"></i>
                    <div style="font-size:1.15rem;font-weight:900;color:${k.c};
                         line-height:1;">${k.val}</div>
                    <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;
                         letter-spacing:1px;margin-top:4px;">${k.label}</div>
                </div>`;
            }).join('')}
        </div>

        ${fin.reasoning ? `
        <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);
             border-radius:10px;padding:13px;">
            <small style="color:#10b981;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                   letter-spacing:1px;display:block;margin-bottom:5px;">
                <i class="fas fa-lightbulb"></i> ${i18n.reasoningLabel}
            </small>
            <p style="margin:0;font-size:0.82rem;color:#cbd5e1;line-height:1.7;" dir="auto">
                ${esc(fin.reasoning)}
            </p>
        </div>` : ''}
    </div>` : '';

    // ══════════════════════════════════════════════════
    // 📊 BLOC 1B — AARRR METRICS (NOUVEAU V12)
    // ══════════════════════════════════════════════════
    const hasAarrr = aarrr && (aarrr.acquisition || aarrr.activation || aarrr.retention
                            || aarrr.revenue     || aarrr.referral);

    const aarrHtml = hasAarrr ? (() => {
        const aarrItems = [
            {
                key   : 'acquisition',
                label : i18n.acquisitionLabel,
                icon  : 'fa-magnet',
                color : '#3b82f6',
                data  : aarrr.acquisition || {},
            },
            {
                key   : 'activation',
                label : i18n.activationLabel,
                icon  : 'fa-bolt',
                color : '#f59e0b',
                data  : aarrr.activation  || {},
            },
            {
                key   : 'retention',
                label : i18n.retentionLabel,
                icon  : 'fa-redo',
                color : '#10b981',
                data  : aarrr.retention   || {},
            },
            {
                key   : 'revenue',
                label : i18n.revenueLabel,
                icon  : 'fa-dollar-sign',
                color : '#ec4899',
                data  : aarrr.revenue     || {},
            },
            {
                key   : 'referral',
                label : i18n.referralLabel,
                icon  : 'fa-share-alt',
                color : '#8b5cf6',
                data  : aarrr.referral    || {},
            },
        ].filter(a => a.data && (a.data.score !== undefined || a.data.issues?.length || a.data.fix));

        return `
    <div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #3b82f6;" dir="${dir}">
        <h3 style="margin-bottom:14px;font-family:Cairo;display:flex;align-items:center;
             gap:10px;color:white;font-size:1rem;">
            <i class="fas fa-chart-pie" style="color:#3b82f6"></i>
            ${i18n.aarrTitle}
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;">
            ${aarrItems.map(a => {
                const sc      = typeof a.data.score === 'number' ? a.data.score : null;
                const issues  = Array.isArray(a.data.issues)  ? a.data.issues  : (a.data.issues  ? [a.data.issues]  : []);
                const fixes   = Array.isArray(a.data.fix)     ? a.data.fix     : (a.data.fix     ? [a.data.fix]     : []);
                const rgb     = toRgb(a.color);
                const scColor = sc !== null ? (sc >= 70 ? '#10b981' : sc >= 40 ? '#f59e0b' : '#ef4444') : a.color;
                return `
                <div style="background:rgba(${rgb},0.05);border:1px solid rgba(${rgb},0.2);
                     border-radius:12px;padding:13px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;
                         margin-bottom:9px;">
                        <small style="color:${a.color};font-weight:800;font-size:0.62rem;
                               text-transform:uppercase;letter-spacing:1px;">
                            <i class="fas ${a.icon}"></i> ${a.label}
                        </small>
                        ${sc !== null ? `
                        <span style="background:rgba(${toRgb(scColor)},0.15);color:${scColor};
                              padding:1px 8px;border-radius:20px;font-size:0.65rem;font-weight:800;
                              border:1px solid rgba(${toRgb(scColor)},0.3);">
                            ${sc}/100
                        </span>` : ''}
                    </div>
                    ${sc !== null ? `
                    <div style="height:4px;background:rgba(255,255,255,0.06);
                         border-radius:4px;overflow:hidden;margin-bottom:9px;">
                        <div style="height:100%;width:${sc}%;background:${scColor};
                             border-radius:4px;transition:width 1.5s ease;"></div>
                    </div>` : ''}
                    ${issues.length ? `
                    <div style="margin-bottom:7px;">
                        <small style="color:#ef4444;font-size:0.58rem;font-weight:700;
                               text-transform:uppercase;">${i18n.issuesLabel}:</small>
                        ${issues.slice(0,2).map(iss => `
                        <div style="font-size:0.72rem;color:#fca5a5;margin-top:3px;
                             display:flex;gap:5px;align-items:flex-start;" dir="auto">
                            <i class="fas fa-times-circle" style="color:#ef4444;font-size:0.6rem;
                               margin-top:2px;flex-shrink:0;"></i>
                            ${esc(iss)}
                        </div>`).join('')}
                    </div>` : ''}
                    ${fixes.length ? `
                    <div>
                        <small style="color:#10b981;font-size:0.58rem;font-weight:700;
                               text-transform:uppercase;">${i18n.fixLabel}:</small>
                        ${fixes.slice(0,2).map(fx => `
                        <div style="font-size:0.72rem;color:#6ee7b7;margin-top:3px;
                             display:flex;gap:5px;align-items:flex-start;" dir="auto">
                            <i class="fas fa-check-circle" style="color:#10b981;font-size:0.6rem;
                               margin-top:2px;flex-shrink:0;"></i>
                            ${esc(fx)}
                        </div>`).join('')}
                    </div>` : ''}
                    ${a.data.description ? `
                    <p style="margin:7px 0 0;font-size:0.73rem;color:#94a3b8;
                       line-height:1.6;font-style:italic;" dir="auto">
                        ${esc(a.data.description)}
                    </p>` : ''}
                </div>`;
            }).join('')}
        </div>
    </div>`;
    })() : '';
const commerceObserved = commerce.observed || {};
const commerceRecommended = commerce.recommended || {};
const commerceDeduced = commerce.deduced || {};
const commerceProducts = Array.isArray(commerceObserved.products) ? commerceObserved.products : [];
const commercePricingPages = Array.isArray(commerceObserved.pricingPages) ? commerceObserved.pricingPages : [];
const commerceEvidenceLinks = Array.isArray(commerceObserved.evidenceLinks) ? commerceObserved.evidenceLinks : [];
const commerceTrust = commerceObserved.trustSignals || {};
const commerceStats = commerceObserved.priceStats || {};
const userPriceRange = commerce.userContext?.userPriceRange || STATE.lastInputs?.funnelPriceRange || '';
const commerceCurrency = commerceRecommended.currency || commerceStats.currency || pri.currency || fin.currency || '';
const moneyValue = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `${n.toLocaleString(isAr ? 'ar-MA' : isEn ? 'en-US' : 'fr-FR')} ${commerceCurrency || ''}`.trim();
};
const rangeValue = (range) => {
    if (!range || (!range.min && !range.max)) return '—';
    return `${moneyValue(range.min)} - ${moneyValue(range.max)}`;
};
const trustSignalsList = [
    [isAr ? 'اتصال آمن' : isEn ? 'Secure access' : 'Accès sécurisé', commerceTrust.hasSSL || tru.hasSSL],
    ['WhatsApp', commerceTrust.hasWhatsApp || tru.hasWhatsApp],
    [isAr ? 'آراء العملاء' : isEn ? 'Customer reviews' : 'Avis clients', commerceTrust.hasReviews || tru.hasReviews],
    [isAr ? 'ضمان' : isEn ? 'Guarantee' : 'Garantie', commerceTrust.hasGuarantee || commerceTrust.hasMoneyBackGuarantee || tru.hasMoneyBackGuarantee],
    [isAr ? 'توصيل' : isEn ? 'Delivery' : 'Livraison', commerceTrust.hasDelivery || tru.hasCOD],
    [isAr ? 'أسئلة شائعة' : isEn ? 'FAQ' : 'FAQ', commerceTrust.hasFAQ],
    [isAr ? 'الدفع' : isEn ? 'Payment proof' : 'Preuves paiement', commerceTrust.hasPaymentLogos || tru.hasPaymentLogos]
];
const visibleTrustCount = trustSignalsList.filter(([, ok]) => ok).length;
const offerSummary = (() => {
    const productName = commerceProducts[0]?.name || product || niche || siteType;
    const priceText = commerceStats.count ? `${moneyValue(commerceStats.min)} - ${moneyValue(commerceStats.max)}` : (userPriceRange || '—');
    if (isAr) return `تم رصد ${commerceProducts.length || 0} منتج أو عرض، مع نطاق سعر ${priceText}. مستوى الثقة مبني على ${visibleTrustCount} إشارات ظاهرة.`;
    if (isEn) return `${commerceProducts.length || 0} product or offer signals were found, with a price range of ${priceText}. Confidence is based on ${visibleTrustCount} visible trust signals.`;
    return `${commerceProducts.length || 0} produit ou offre détecté, avec une fourchette de prix ${priceText}. La confiance est basée sur ${visibleTrustCount} signaux visibles.`;
})();
const hasCommerceMoney = commerce.success || commerceProducts.length || commercePricingPages.length || commerceStats.count || userPriceRange || commerceRecommended.recommendedRange || pricing.priceVerdict;

const pricingHtml = hasCommerceMoney ? `
<div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #f59e0b;" dir="${dir}">
    <h3 style="margin-bottom:8px;font-family:Cairo;display:flex;align-items:center;gap:10px;color:white;font-size:1rem;">
        <i class="fas fa-hand-holding-dollar" style="color:#f59e0b"></i>
        ${isAr ? 'العرض والسعر والثقة' : isEn ? 'Offer, price, and trust' : 'Offre, prix et confiance'}
    </h3>
    <p style="margin:0 0 14px;color:#cbd5e1;font-size:0.88rem;line-height:1.7;" dir="auto">${esc(offerSummary)}</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px;">
        <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.18);border-radius:12px;padding:13px;">
            <small style="display:block;color:#fbbf24;font-weight:900;font-size:.62rem;text-transform:uppercase;margin-bottom:6px;">
                ${isAr ? 'السعر الذي أدخلته' : isEn ? 'User price' : 'Prix utilisateur'}
            </small>
            <strong style="color:white;font-size:.96rem;overflow-wrap:anywhere;">${esc(userPriceRange || '—')}</strong>
        </div>
        <div style="background:rgba(6,182,212,0.07);border:1px solid rgba(6,182,212,0.18);border-radius:12px;padding:13px;">
            <small style="display:block;color:#67e8f9;font-weight:900;font-size:.62rem;text-transform:uppercase;margin-bottom:6px;">
                ${isAr ? 'الأسعار المرصودة' : isEn ? 'Observed range' : 'Fourchette observée'}
            </small>
            <strong style="color:white;font-size:.96rem;">${commerceStats.count ? `${moneyValue(commerceStats.min)} - ${moneyValue(commerceStats.max)}` : '—'}</strong>
        </div>
        <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.18);border-radius:12px;padding:13px;">
            <small style="display:block;color:#6ee7b7;font-weight:900;font-size:.62rem;text-transform:uppercase;margin-bottom:6px;">
                ${isAr ? 'السعر الموصى به' : isEn ? 'Recommended range' : 'Prix recommandé'}
            </small>
            <strong style="color:white;font-size:.96rem;">${rangeValue(commerceRecommended.recommendedRange)}</strong>
        </div>
        <div style="background:rgba(139,92,246,0.07);border:1px solid rgba(139,92,246,0.18);border-radius:12px;padding:13px;">
            <small style="display:block;color:#c4b5fd;font-weight:900;font-size:.62rem;text-transform:uppercase;margin-bottom:6px;">
                ${isAr ? 'مستوى الثقة' : isEn ? 'Confidence' : 'Confiance'}
            </small>
            <strong style="color:white;font-size:.96rem;">${esc(commerceRecommended.confidence || commerceDeduced.pricingConfidence || 'LOW')}</strong>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:12px;">
        <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:13px;">
            <small style="color:#fbbf24;font-weight:900;font-size:.62rem;text-transform:uppercase;display:block;margin-bottom:7px;">
                ${isAr ? 'قرار السعر' : isEn ? 'Pricing decision' : 'Décision prix'}
            </small>
            <p style="margin:0;color:#fde68a;font-size:.84rem;line-height:1.65;" dir="auto">${esc(commerceRecommended.pricingRationale || pricing.priceVerdict || (isAr ? 'لا توجد بيانات سعرية كافية.' : isEn ? 'Not enough reliable price data.' : 'Données prix fiables insuffisantes.'))}</p>
            <div style="margin-top:8px;color:#94a3b8;font-size:.72rem;line-height:1.5;" dir="auto">
                ${esc(commerceRecommended.formula || (isAr ? 'السعر الموصى = الأسعار المرصودة + سعر المستخدم + الثقة + الضمان/التوصيل' : isEn ? 'recommended price = observed median + optional user price + trust + guarantee/delivery' : 'prix recommandé = médiane observée + prix utilisateur optionnel + confiance + garantie/livraison'))}
            </div>
        </div>
        <div style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.12);border-radius:12px;padding:13px;">
            <small style="color:#6ee7b7;font-weight:900;font-size:.62rem;text-transform:uppercase;display:block;margin-bottom:8px;">
                ${isAr ? 'إشارات الثقة' : isEn ? 'Trust signals' : 'Signaux de confiance'}
            </small>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${trustSignalsList.map(([label, ok]) => `
                    <span style="border:1px solid rgba(${ok ? '16,185,129' : '148,163,184'},.22);background:rgba(${ok ? '16,185,129' : '148,163,184'},.07);color:${ok ? '#6ee7b7' : '#94a3b8'};padding:4px 8px;border-radius:999px;font-size:.68rem;font-weight:800;">
                        ${ok ? '✓' : '•'} ${esc(label)}
                    </span>
                `).join('')}
            </div>
        </div>
    </div>

    <details class="report-details" style="border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,0.02);">
        <summary style="cursor:pointer;color:#c4b5fd;font-weight:900;font-size:.78rem;">
            ${isAr ? 'عرض التفاصيل والأدلة' : isEn ? 'View details and proof' : 'Voir les détails et preuves'}
        </summary>
        <div style="margin-top:12px;display:grid;gap:12px;">
            ${commerceProducts.length ? `
            <div>
                <strong style="color:white;font-size:.82rem;">${isAr ? 'منتجات أو عروض مرصودة' : isEn ? 'Observed products or offers' : 'Produits ou offres observés'}</strong>
                <div style="display:grid;gap:8px;margin-top:8px;">
                    ${commerceProducts.slice(0,6).map(p => `
                    <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border-top:1px solid rgba(255,255,255,.06);padding-top:8px;">
                        <div style="min-width:0;">
                            <div style="color:#e2e8f0;font-size:.78rem;font-weight:800;overflow-wrap:anywhere;">${esc(p.name || '—')}</div>
                            ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:#38bdf8;font-size:.68rem;overflow-wrap:anywhere;">${esc(p.url)}</a>` : ''}
                        </div>
                        <strong style="color:#10b981;font-size:.76rem;">${p.price ? moneyValue(p.price) : '—'}</strong>
                    </div>`).join('')}
                </div>
            </div>` : ''}

            ${commercePricingPages.length ? `
            <div>
                <strong style="color:white;font-size:.82rem;">${isAr ? 'صفحات السعر التي تم فحصها' : isEn ? 'Pricing pages checked' : 'Pages prix vérifiées'}</strong>
                ${commercePricingPages.map(p => `
                    <div style="margin-top:7px;color:#94a3b8;font-size:.72rem;">
                        <a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:#38bdf8;">${esc(p.url)}</a>
                        <span style="color:#fbbf24;"> · ${p.priceCount || 0} ${isAr ? 'أسعار' : isEn ? 'prices' : 'prix'}</span>
                    </div>
                `).join('')}
            </div>` : ''}

            ${commerceEvidenceLinks.length ? `
            <div>
                <strong style="color:white;font-size:.82rem;">${isAr ? 'روابط الأدلة' : isEn ? 'Proof links' : 'Liens de preuve'}</strong>
                <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;">
                    ${commerceEvidenceLinks.slice(0,10).map(l => `
                    <a href="${esc(l.url)}" target="_blank" rel="noopener" style="color:#93c5fd;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.16);padding:5px 9px;border-radius:999px;font-size:.68rem;text-decoration:none;">
                        ${esc(l.label || l.type || 'link')}
                    </a>`).join('')}
                </div>
            </div>` : ''}
        </div>
    </details>
</div>` : '';

    // ══════════════════════════════════════════════════
    // ♟️ BLOC 2 — STRATEGIC BLUEPRINT
    // ══════════════════════════════════════════════════
    const blueprintHtml = blueprint.killShotName || blueprint.executionPlan || blueprint.coreHook ? `
    <div class="magic-box fade-in-up" style="margin-bottom:22px;border-left:5px solid var(--accent-secondary);" dir="${dir}">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
            <div style="background:var(--accent-secondary);width:40px;height:40px;border-radius:11px;
                 display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-chess-knight" style="color:white;font-size:1.1rem;"></i>
            </div>
            <div>
                <h3 style="margin:0;font-family:Cairo;color:white;font-size:1.05rem;">
                    ${i18n.blueprintTitle}
                </h3>
                ${blueprint.killShotName ? `
                <div style="font-size:0.75rem;color:#fcd34d;margin-top:3px;font-weight:700;">
                    Kill Shot: ${esc(blueprint.killShotName)}
                </div>` : ''}
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;">
            ${blueprint.coreHook ? `
            <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:13px;
                 border:1px solid rgba(252,211,77,0.18);">
                <small style="color:#fcd34d;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:6px;">
                    <i class="fas fa-quote-left"></i> ${i18n.coreHookLabel}
                </small>
                <p style="margin:0;font-size:0.85rem;color:#fef9c3;line-height:1.65;font-weight:600;"
                   dir="auto">${esc(blueprint.coreHook)}</p>
            </div>` : ''}

            ${blueprint.executionPlan ? `
            <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:13px;
                 border:1px solid rgba(139,92,246,0.18);">
                <small style="color:#8b5cf6;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:6px;">
                    <i class="fas fa-map-signs"></i> ${i18n.execPlanLabel}
                </small>
                <p style="margin:0;font-size:0.83rem;color:#e2e8f0;line-height:1.65;"
                   dir="auto">${esc(blueprint.executionPlan)}</p>
            </div>` : ''}

            ${blueprint.unfairAdvantage ? `
            <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:13px;
                 border:1px solid rgba(16,185,129,0.18);">
                <small style="color:#10b981;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:6px;">
                    <i class="fas fa-rocket"></i> ${i18n.unfairAdvLabel}
                </small>
                <p style="margin:0;font-size:0.83rem;color:#e2e8f0;line-height:1.65;"
                   dir="auto">${esc(blueprint.unfairAdvantage)}</p>
            </div>` : ''}

            ${blueprint.opportunityGap ? `
            <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:13px;
                 border:1px solid rgba(251,191,36,0.18);">
                <small style="color:#fbbf24;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:6px;">
                    <i class="fas fa-search-dollar"></i> ${i18n.oppGapLabel}
                </small>
                <p style="margin:0;font-size:0.83rem;color:#fde68a;line-height:1.65;"
                   dir="auto">${esc(blueprint.opportunityGap)}</p>
            </div>` : ''}
        </div>

        ${blueprint.weakPoints?.length || blueprint.quickWins?.length ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
            ${blueprint.weakPoints?.length ? `
            <div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);
                 border-radius:10px;padding:12px;">
                <small style="color:#ef4444;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:7px;">
                    <i class="fas fa-exclamation-triangle"></i> ${i18n.weakPointsLabel}
                </small>
                ${blueprint.weakPoints.slice(0,3).map(w => `
                <div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:5px;">
                    <i class="fas fa-times-circle" style="color:#ef4444;font-size:0.65rem;
                       margin-top:3px;flex-shrink:0;"></i>
                    <span style="font-size:0.8rem;color:#fca5a5;" dir="auto">${esc(w)}</span>
                </div>`).join('')}
            </div>` : ''}

            ${blueprint.quickWins?.length ? `
            <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);
                 border-radius:10px;padding:12px;">
                <small style="color:#10b981;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:7px;">
                    <i class="fas fa-bolt"></i> ${i18n.quickWinsLabel}
                </small>
                ${blueprint.quickWins.slice(0,3).map(w => `
                <div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:5px;">
                    <i class="fas fa-check-circle" style="color:#10b981;font-size:0.65rem;
                       margin-top:3px;flex-shrink:0;"></i>
                    <span style="font-size:0.8rem;color:#6ee7b7;" dir="auto">${esc(w)}</span>
                </div>`).join('')}
            </div>` : ''}
        </div>` : ''}

        ${counterStrat.howToBeatThem ? `
        <div style="margin-top:12px;background:rgba(239,68,68,0.04);
             border:1px solid rgba(239,68,68,0.12);border-radius:10px;padding:12px;">
            <small style="color:#ef4444;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                   letter-spacing:1px;display:block;margin-bottom:8px;">
                <i class="fas fa-chess"></i> ${i18n.counterStratLabel}
            </small>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
                ${counterStrat.howToBeatThem ? `
                <div style="font-size:0.8rem;color:#fca5a5;" dir="auto">
                    <strong style="color:#ef4444;">
                        ${isAr ? 'كيف تتغلب' : 'Beat'}: </strong>
                    ${esc(counterStrat.howToBeatThem)}
                </div>` : ''}
                ${counterStrat.yourPositioning ? `
                <div style="font-size:0.8rem;color:#fde68a;" dir="auto">
                    <strong style="color:#f59e0b;">
                        ${isAr ? 'تموضعك' : 'Position'}: </strong>
                    ${esc(counterStrat.yourPositioning)}
                </div>` : ''}
                ${counterStrat.uniqueAngle ? `
                <div style="font-size:0.8rem;color:#a5b4fc;" dir="auto">
                    <strong style="color:#818cf8;">
                        ${isAr ? 'الزاوية' : 'Angle'}: </strong>
                    ${esc(counterStrat.uniqueAngle)}
                </div>` : ''}
            </div>
        </div>` : ''}
    </div>` : '';
const renderObjectLines = (obj, fields = []) => {
    if (!obj || typeof obj !== 'object') return '';

    const lines = fields
        .map(({ key, label, color = '#94a3b8' }) => {
            const value = obj[key];
            if (value === null || value === undefined || value === '') return '';
            return `
                <div style="margin-bottom:6px;" dir="auto">
                    <span style="color:${color};font-size:0.68rem;font-weight:700;">${label}: </span>
                    <span style="color:#e2e8f0;font-size:0.78rem;line-height:1.6;">${esc(String(value))}</span>
                </div>
            `;
        })
        .filter(Boolean)
        .join('');

    return lines || '';
};
// ══════════════════════════════════════════════════
// 🎨 BLOC 3 — WEB CHARTE + COLOR PSYCHOLOGY (corrigé UI/UX)
// ══════════════════════════════════════════════════

const normalizeCssColor = (value) => {
    const raw = typeof value === 'object' && value
        ? (value.color || value.hex || value.value || '')
        : value;

    const color = String(raw || '').trim();
    if (!color) return '';

    if (/^(rgb|hsl|var\(|linear-gradient|radial-gradient|transparent)/i.test(color)) {
        return color;
    }

    return `#${color.replace(/^#+/, '')}`;
};

const visualPair = (label, value, color = '#94a3b8') => {
    if (value === null || value === undefined || value === '') return '';
    return `
        <div class="vc-row">
            <div class="vc-label" style="color:${color};">${esc(label)}</div>
            <div class="vc-value" dir="auto">${esc(String(value))}</div>
        </div>`;
};

const visualObject = (obj, fields) => {
    if (!obj) return '';
    if (typeof obj !== 'object') {
        return `<div class="vc-value" dir="auto">${esc(String(obj))}</div>`;
    }
    return fields.map(f => visualPair(f.label, obj[f.key], f.color)).join('');
};

const paletteMain = [
    { label: 'P', value: design.primary },
    { label: 'S', value: design.secondary },
    { label: 'A', value: design.accent },
    { label: 'BG', value: design.bg },
].filter(c => normalizeCssColor(c.value));

const allPalette = [...new Set([
    ...paletteMain.map(c => normalizeCssColor(c.value)),
    ...(design.allColors || []).map(normalizeCssColor)
].filter(Boolean))].slice(0, 10);

const colorPsychologyBlock = visualObject(design.colorPsychology, [
    { key: 'primary', label: isAr ? 'اللون' : isEn ? 'Primary' : 'Couleur', color: '#f472b6' },
    { key: 'emotion', label: isAr ? 'العاطفة' : isEn ? 'Emotion' : 'Émotion', color: '#f472b6' },
    { key: 'conversionImpact', label: isAr ? 'الأثر' : isEn ? 'Impact' : 'Impact conversion', color: '#f472b6' },
    { key: 'recommendation', label: isAr ? 'التوصية' : isEn ? 'Recommendation' : 'Recommandation', color: '#f472b6' },
]);

const visualHierarchyBlock = visualObject(design.visualHierarchy, [
    { key: 'score', label: 'Score', color: '#22d3ee' },
    { key: 'eyeFlow', label: isAr ? 'مسار العين' : isEn ? 'Eye Flow' : 'Parcours visuel', color: '#22d3ee' },
    { key: 'ctaVisibility', label: isAr ? 'وضوح CTA' : isEn ? 'CTA Visibility' : 'Visibilité CTA', color: '#22d3ee' },
    { key: 'fix', label: isAr ? 'Correction' : isEn ? 'Fix' : 'Correction', color: '#22d3ee' },
    { key: 'recommendation', label: isAr ? 'التوصية' : isEn ? 'Recommendation' : 'Recommandation', color: '#22d3ee' },
]);

const designHtml = design.primary || design.fontMain || design.style ? `
<style>
    .vc-grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 14px;
        align-items: start;
    }
    .vc-card {
        grid-column: span 4;
        min-height: 0;
        padding: 16px;
        border-radius: 14px;
        background: rgba(255,255,255,0.025);
        border: 1px solid rgba(255,255,255,0.07);
    }
    .vc-wide { grid-column: span 6; }
    .vc-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: .72rem;
        font-weight: 900;
        letter-spacing: .8px;
        text-transform: uppercase;
    }
    .vc-row {
        display: grid;
        grid-template-columns: 120px minmax(0, 1fr);
        gap: 10px;
        padding: 8px 0;
        border-top: 1px solid rgba(255,255,255,0.06);
    }
    .vc-row:first-of-type {
        border-top: 0;
        padding-top: 0;
    }
    .vc-label {
        font-size: .62rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .6px;
    }
    .vc-value {
        color: #e2e8f0;
        font-size: .82rem;
        line-height: 1.55;
        overflow-wrap: anywhere;
    }
    .vc-swatch {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.16);
        flex-shrink: 0;
    }
    .vc-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
    }
    .vc-color-line {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-bottom: 8px;
        font-size: .78rem;
        color: #cbd5e1;
        font-family: monospace;
    }
    @media (max-width: 1000px) {
        .vc-card,
        .vc-wide {
            grid-column: 1 / -1;
        }
        .vc-row {
            grid-template-columns: 1fr;
            gap: 4px;
        }
    }
</style>

<div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #ec4899;" dir="${dir}">
    <h3 style="margin-bottom:14px;font-family:Cairo;display:flex;align-items:center;gap:10px;color:white;font-size:1rem;">
        <i class="fas fa-palette" style="color:#ec4899"></i>
        ${i18n.designTitle}
    </h3>

    <div class="vc-grid">
        <div class="vc-card">
            <div class="vc-title" style="color:#f472b6;">
                <i class="fas fa-droplet"></i> Palette
            </div>

            ${paletteMain.map(c => {
                const color = normalizeCssColor(c.value);
                return `
                    <div class="vc-color-line">
                        <span class="vc-swatch" style="background:${color};"></span>
                        <strong>${c.label}</strong>
                        <span>${color}</span>
                    </div>`;
            }).join('')}

            ${allPalette.length ? `
                <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">
                    <div style="font-size:.62rem;color:#64748b;font-weight:800;text-transform:uppercase;margin-bottom:8px;">
                        All Colors (${allPalette.length})
                    </div>
                    <div class="vc-chip-row">
                        ${allPalette.map(color => `
                            <span class="vc-swatch" style="background:${color};" title="${color}"></span>
                        `).join('')}
                    </div>
                </div>` : ''}
        </div>

        <div class="vc-card">
            <div class="vc-title" style="color:#a78bfa;">
                <i class="fas fa-font"></i> Typography
            </div>
            ${visualPair(isAr ? 'الخط الرئيسي' : isEn ? 'Primary Font' : 'Police principale', design.fontMain || 'Non détectée', '#a78bfa')}
            ${visualPair(isAr ? 'خط ثانوي' : isEn ? 'Secondary Font' : 'Police secondaire', design.fontSec, '#a78bfa')}
            ${design.googleFonts?.length ? visualPair('Google Fonts', design.googleFonts.slice(0, 4).join(', '), '#a78bfa') : ''}
        </div>

        <div class="vc-card">
            <div class="vc-title" style="color:#67e8f9;">
                <i class="fas fa-layer-group"></i> Layout & Style
            </div>
            ${visualPair(isAr ? 'الأسلوب' : isEn ? 'Style' : 'Style', design.style || '—', '#67e8f9')}
            ${visualPair('Mobile', design.isMobile ? 'Oui ✓' : 'Non ✗', design.isMobile ? '#10b981' : '#ef4444')}
            ${visualPair(isAr ? 'نقاط التصميم' : isEn ? 'Design Score' : 'Design Score', `${design.score || 0}/100`, '#f59e0b')}
        </div>

        ${design.colorPsychology ? `
        <div class="vc-card vc-wide">
            <div class="vc-title" style="color:#f472b6;">
                <i class="fas fa-brain"></i> ${i18n.colorPsyLabel}
            </div>
            ${colorPsychologyBlock}
        </div>` : ''}

        ${design.visualHierarchy ? `
        <div class="vc-card vc-wide">
            <div class="vc-title" style="color:#22d3ee;">
                <i class="fas fa-eye"></i> ${i18n.hierarchyLabel}
            </div>
            ${visualHierarchyBlock}
        </div>` : ''}
    </div>

    ${funnelFlow ? `
    <div style="margin-top:12px;background:rgba(6,182,212,0.04);
         border:1px solid rgba(6,182,212,0.15);border-radius:9px;padding:11px;">
        <small style="color:#67e8f9;font-weight:800;font-size:0.6rem;text-transform:uppercase;
               letter-spacing:1px;display:block;margin-bottom:4px;">
            <i class="fas fa-route"></i> ${i18n.funnelFlowLabel}
        </small>
        <p style="margin:0;font-size:0.82rem;color:#cbd5e1;font-style:italic;line-height:1.6;"
           dir="auto">${esc(funnelFlow)}</p>
    </div>` : ''}

    ${funnelGaps?.length ? `
    <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
        <small style="color:#ef4444;font-size:0.62rem;font-weight:800;text-transform:uppercase;">
            ${i18n.funnelGapsLabel}:
        </small>
        ${funnelGaps.map(g => `
        <span style="background:rgba(239,68,68,0.08);color:#fca5a5;padding:2px 9px;
              border-radius:20px;font-size:0.68rem;border:1px solid rgba(239,68,68,0.2);">
            ${esc(g)}
        </span>`).join('')}
    </div>` : ''}
</div>` : '';

    // ══════════════════════════════════════════════════
    // ⚡ BLOC 4 — PERFORMANCE, TRUST & TECH STACK
    //            + TECHNICAL SEO AUDIT (NOUVEAU V12)
    // ══════════════════════════════════════════════════
    const hasPerf     = prf && (prf.ttfb || prf.loadEvent || prf.totalElements);
    const hasTrust    = tru && Object.keys(tru).length > 0;
    const hasTracking = trk && Object.keys(trk).length > 0;
    const hasTechAudit = techAudit && (techAudit.schemaRecommended || techAudit.criticalIssues?.length
                                    || techAudit.seoIssues?.length  || techAudit.score !== undefined);

    const perfTrustHtml = hasPerf || hasTrust || hasTracking || hasTechAudit ? `
    <div class="result-card fade-in-up" style="margin-bottom:22px;" dir="${dir}">
        <h3 style="margin-bottom:14px;font-family:Cairo;display:flex;align-items:center;
             gap:10px;color:white;font-size:1rem;">
            <i class="fas fa-shield-alt" style="color:#06b6d4"></i>
            ${i18n.perfTitle}
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">

            <!-- Performance Vitals -->
            ${hasPerf ? `
            <div style="background:rgba(6,182,212,0.05);border:1px solid rgba(6,182,212,0.15);
                 border-radius:12px;padding:13px;">
                <small style="color:#67e8f9;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    <i class="fas fa-tachometer-alt"></i> ${i18n.vitalsLabel}
                </small>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                    ${[
                        { label:'TTFB',      val: prf.ttfb,          bad: v => parseInt(v) > 600  },
                        { label:'LCP',       val: prf.lcpApprox,     bad: v => parseInt(v) > 2500 },
                        { label:'Load',      val: prf.loadEvent,     bad: v => parseInt(v) > 4000 },
                        { label:'Transfer',  val: prf.transferSize,  bad: () => false             },
                        { label:'Resources', val: prf.resourceCount, bad: v => v > 100            },
                        { label: isAr ? 'عناصر DOM' : 'DOM Size',
                                             val: prf.totalElements ? `${prf.totalElements} els` : null,
                                             bad: () => prf.isHeavyPage                           },
                    ].filter(x => x.val).map(x => {
                        const isBad = x.bad(x.val);
                        const c = isBad ? '#ef4444' : '#10b981';
                        return `
                        <div style="text-align:center;background:rgba(${isBad?'239,68,68':'16,185,129'},0.07);
                             border-radius:7px;padding:6px;">
                            <div style="font-size:0.78rem;font-weight:800;color:${c};">${x.val}</div>
                            <div style="font-size:0.56rem;color:#475569;text-transform:uppercase;">
                                ${x.label}</div>
                        </div>`;
                    }).join('')}
                </div>
                ${prf.heavyResources?.length ? `
                <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.04);padding-top:7px;">
                    <small style="color:#475569;font-size:0.58rem;">${i18n.topResLabel}</small>
                    ${prf.heavyResources.slice(0,3).map(r => `
                    <div style="font-size:0.65rem;color:#64748b;margin-top:2px;
                         display:flex;justify-content:space-between;">
                        <span style="color:#94a3b8;">${(r.name||'').split('/').pop()?.substring(0,25) || '—'}</span>
                        <span style="color:${parseInt(r.size)>200?'#ef4444':'#64748b'};">${r.size}</span>
                    </div>`).join('')}
                </div>` : ''}
            </div>` : ''}

            <!-- Trust Signals -->
            ${hasTrust ? `
            <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);
                 border-radius:12px;padding:13px;">
                <small style="color:#10b981;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    <i class="fas fa-shield-alt"></i> ${i18n.trustTitle}
                    ${tru.trustScore ? ` ${tru.trustScore}/13` : ''}
                </small>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    ${[
                        ['SSL',          tru.hasSSL,                ''],
                        ['WhatsApp',     tru.hasWhatsApp,           ''],
                        ['COD',          tru.hasCOD,                ''],
                        [isAr?'آراء':'Avis',  tru.hasReviews,       ''],
                        ['MoneyBack',    tru.hasMoneyBackGuarantee, ''],
                        [isAr?'هاتف':'Phone', tru.hasPhoneNumber,   ''],
                        ['Email',        tru.hasEmail,              ''],
                        ['Chat',         tru.hasChatWidget,         ''],
                        [isAr?'بطاقة':'Carte', tru.hasPaymentLogos,''],
                        [isAr?'قانوني':'Légal', tru.hasLegalPages,  ''],
                        [isAr?'شهادة':'Certif', tru.hasCertifications,''],
                        ['Map',          tru.hasMap,                ''],
                    ].map(([label, val]) => `
                    <span style="background:rgba(${val?'16,185,129':'239,68,68'},0.08);
                          color:${val?'#6ee7b7':'#94a3b8'};padding:3px 7px;border-radius:8px;
                          font-size:0.62rem;border:1px solid rgba(${val?'16,185,129':'239,68,68'},0.15);">
                        ${val ? '✓' : '✗'} ${label}
                    </span>`).join('')}
                </div>
                ${trustA.trustGaps?.length ? `
                <div style="margin-top:9px;border-top:1px solid rgba(255,255,255,0.04);padding-top:7px;">
                    <small style="color:#ef4444;font-size:0.6rem;font-weight:700;">
                        ${isAr ? 'ثغرات الثقة' : 'Trust Gaps'}:
                    </small>
                    ${trustA.trustGaps.slice(0,2).map(g => `
                    <div style="font-size:0.72rem;color:#fca5a5;margin-top:3px;"
                         dir="auto">${esc(g)}</div>`).join('')}
                </div>` : ''}
            </div>` : ''}

            <!-- Tech Stack -->
            ${hasTracking ? `
            <div style="background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);
                 border-radius:12px;padding:13px;">
                <small style="color:#818cf8;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    <i class="fas fa-layer-group"></i> ${i18n.techTitle}
                </small>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    ${[
                        ['GA4',       trk.hasGoogleAnalytics, '#f59e0b'],
                        ['GTM',       trk.hasGTM,             '#f59e0b'],
                        ['FB Pixel',  trk.hasFacebookPixel,   '#3b82f6'],
                        ['TikTok',    trk.hasTikTokPixel,     '#ec4899'],
                        ['Hotjar',    trk.hasHotjar,          '#f97316'],
                        ['Clarity',   trk.hasClarity,         '#0ea5e9'],
                        ['Crisp',     trk.hasCrisp,           '#10b981'],
                        ['Tidio',     trk.hasTidio,           '#10b981'],
                        ['Stripe',    trk.hasStripe,          '#818cf8'],
                        ['PayPal',    trk.hasPaypal,          '#818cf8'],
                        ['Shopify',   trk.hasShopify,         '#10b981'],
                        ['WordPress', trk.hasWordPress,       '#3b82f6'],
                        ['Next.js',   trk.hasNextJS,          '#e2e8f0'],
                        ['Mailchimp', trk.hasMailchimp,       '#f59e0b'],
                        ['Klaviyo',   trk.hasKlaviyo,         '#22d3ee'],
                    ].filter(([,val]) => val).map(([label,,c]) => `
                    <span style="background:${c}15;color:${c};padding:3px 8px;border-radius:8px;
                          font-size:0.62rem;font-weight:700;border:1px solid ${c}25;">
                        ${label}
                    </span>`).join('') || `<span style="font-size:0.75rem;color:#475569;">
                        ${i18n.noneDetected}</span>`}
                </div>
                ${trk.cookieCount ? `
                <div style="margin-top:7px;font-size:0.65rem;color:#64748b;">
                    ${trk.cookieCount} cookies —
                    localStorage: ${trk.localStorageKeys?.length || 0} cls
                </div>` : ''}
            </div>` : ''}

            <!-- Conversion Signals -->
            ${frm.count || pageGlobal.hasCountdown || pageGlobal.hasExitIntent ? `
            <div style="background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);
                 border-radius:12px;padding:13px;">
                <small style="color:#fbbf24;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    <i class="fas fa-funnel-dollar"></i> ${i18n.convSignalsLabel}
                </small>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    ${[
                        [`${frm.count||0} Forms`,                    frm.count > 0,               ''],
                        [isAr?'دفع':'Checkout',                      frm.hasCheckout,             ''],
                        [isAr?'نشرة بريدية':'Newsletter',            frm.hasNewsletter,           ''],
                        [isAr?'عداد تنازلي':'Countdown',             pageGlobal.hasCountdown,     ''],
                        [isAr?'نية الخروج':'Exit Intent',            pageGlobal.hasExitIntent,    ''],
                        [isAr?'رأس ثابت':'Sticky Header',            pageGlobal.hasStickyHeader,  ''],
                        [isAr?'دردشة':'Chat Widget',                 pageGlobal.hasChatWidget,    ''],
                        [isAr?'نافذة منبثقة':'Popup',                conv.hasPopup,               ''],
                        [isAr?'فيديو':'Video',                       med.hasVideo,                ''],
                    ].map(([label, val]) => `
                    <span style="background:rgba(${val?'245,158,11':'100,116,139'},0.08);
                          color:${val?'#fbbf24':'#64748b'};padding:3px 7px;border-radius:8px;
                          font-size:0.62rem;border:1px solid rgba(${val?'245,158,11':'100,116,139'},0.15);">
                        ${val ? '✓' : '✗'} ${label}
                    </span>`).join('')}
                </div>
                <div style="margin-top:8px;font-size:0.65rem;color:#64748b;
                     display:flex;gap:10px;flex-wrap:wrap;">
                    ${med.totalImages     ? `<span>${med.totalImages} ${isAr?'صورة':'imgs'}</span>` : ''}
                    ${med.missingAltCount ? `<span style="color:#ef4444;">
                        ${med.missingAltCount} ${isAr?'بدون alt':'sans alt'}</span>` : ''}
                    ${med.lazyLoadImages  ? `<span style="color:#10b981;">
                        ${med.lazyLoadImages} lazy</span>` : ''}
                    ${med.webpImages      ? `<span style="color:#3b82f6;">
                        ${med.webpImages} WebP</span>` : ''}
                    ${pageGlobal.totalLinks ? `<span>
                        ${pageGlobal.totalLinks} ${isAr?'رابط':'liens'}</span>` : ''}
                </div>
            </div>` : ''}

            <!-- Technical SEO Audit (NOUVEAU V12) -->
            ${hasTechAudit ? `
            <div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);
                 border-radius:12px;padding:13px;">
                <small style="color:#f87171;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    <i class="fas fa-bug"></i> ${i18n.techAuditTitle}
                    ${techAudit.score !== undefined ? `
                    <span style="margin-left:6px;background:rgba(239,68,68,0.15);color:#fca5a5;
                          padding:1px 7px;border-radius:20px;font-size:0.6rem;">
                        ${techAudit.score}/100</span>` : ''}
                </small>

                ${techAudit.schemaRecommended ? `
                <div style="margin-bottom:8px;padding:7px 9px;background:rgba(99,102,241,0.08);
                     border-radius:8px;border:1px solid rgba(99,102,241,0.18);">
                    <small style="color:#818cf8;font-size:0.58rem;font-weight:700;
                           text-transform:uppercase;">${i18n.schemaLabel}:</small>
                    <div style="font-size:0.75rem;color:#c4b5fd;margin-top:3px;" dir="auto">
                        ${esc(typeof techAudit.schemaRecommended === 'object'
                            ? JSON.stringify(techAudit.schemaRecommended)
                            : techAudit.schemaRecommended)}
                    </div>
                </div>` : ''}

                ${techAudit.criticalIssues?.length ? `
                <div style="margin-bottom:8px;">
                    <small style="color:#ef4444;font-size:0.58rem;font-weight:700;
                           text-transform:uppercase;">${i18n.criticalLabel}:</small>
                    ${techAudit.criticalIssues.slice(0,3).map(iss => `
                    <div style="display:flex;gap:5px;align-items:flex-start;margin-top:4px;">
                        <i class="fas fa-exclamation-circle" style="color:#ef4444;font-size:0.6rem;
                           margin-top:2px;flex-shrink:0;"></i>
                        <span style="font-size:0.73rem;color:#fca5a5;" dir="auto">${esc(iss)}</span>
                    </div>`).join('')}
                </div>` : ''}

                ${techAudit.seoIssues?.length ? `
                <div>
                    <small style="color:#f59e0b;font-size:0.58rem;font-weight:700;
                           text-transform:uppercase;">${i18n.seoIssuesLabel}:</small>
                    ${techAudit.seoIssues.slice(0,3).map(iss => `
                    <div style="display:flex;gap:5px;align-items:flex-start;margin-top:4px;">
                        <i class="fas fa-search" style="color:#f59e0b;font-size:0.6rem;
                           margin-top:2px;flex-shrink:0;"></i>
                        <span style="font-size:0.73rem;color:#fde68a;" dir="auto">${esc(typeof iss === 'object' ? (iss.issue || iss.description || JSON.stringify(iss)) : iss)}</span>
                    </div>`).join('')}
                </div>` : ''}
            </div>` : ''}

        </div>
    </div>` : '';

    // ══════════════════════════════════════════════════
    // ✍️ BLOC 5 — COPY INTELLIGENCE + NEUROMARKETING
    //             + PSYCH TRIGGERS (enrichi V12)
    // ══════════════════════════════════════════════════
    const hasCopy = copyA.overallTone || copyA.bigIdea ||
                    copyA.topCopyLines?.length || funnelDNA.funnelType;
    const hasNeuro = neuro && (neuro.cognitiveBiases?.length || neuro.readingPattern
                            || neuro.colorPsychology         || neuro.visualHierarchy);
    const hasPsychTriggers = psych && (
        psych.urgency?.length     || psych.scarcity?.length   ||
        psych.socialproof?.length || psych.guarantees?.length ||
        psych.authority?.length   || psych.fearloss?.length   ||
        psych.ctabuttons?.length  || psych.priceanchors?.length
    );

    const copyHtml = hasCopy || hasNeuro || hasPsychTriggers ? `
    <div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #f97316;" dir="${dir}">
        <h3 style="margin-bottom:14px;font-family:Cairo;display:flex;align-items:center;
             gap:10px;color:white;font-size:1rem;">
            <i class="fas fa-pen-nib" style="color:#f97316"></i>
            ${i18n.copyTitle}
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">

            ${copyA.bigIdea ? `
            <div style="background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.2);
                 border-radius:11px;padding:12px;">
                <small style="color:#f97316;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:6px;">
                    ${i18n.bigIdeaLabel}
                </small>
                <p style="margin:0;font-size:0.85rem;color:#fed7aa;font-weight:600;line-height:1.6;"
                   dir="auto">${esc(copyA.bigIdea)}</p>
            </div>` : ''}

            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
                 border-radius:11px;padding:12px;">
                <small style="color:#94a3b8;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    ${i18n.copyScoresLabel}
                </small>
                ${[
                    { label: isAr?'العنوان':'Headline', val: copyA.headlineStrength, c: '#3b82f6' },
                    { label: 'CTA',                     val: copyA.ctaStrength,      c: '#10b981' },
                    { label: isAr?'دليل اجتماعي':'Proof', val: copyA.socialProofScore, c: '#f59e0b' },
                    { label: isAr?'إلحاح':'Urgency',    val: copyA.urgencyScore,     c: '#ef4444' },
                ].filter(x => x.val).map(x => `
                <div style="margin-bottom:7px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                        <small style="color:#64748b;font-size:0.68rem;font-weight:600;">${x.label}</small>
                        <small style="color:${x.c};font-weight:700;">${x.val}/100</small>
                    </div>
                    <div style="height:4px;background:rgba(255,255,255,0.05);
                         border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${x.val}%;background:${x.c};
                             border-radius:4px;transition:width 1.5s ease;"></div>
                    </div>
                </div>`).join('')}
                ${copyA.overallTone ? `<div style="font-size:0.7rem;color:#94a3b8;margin-top:6px;">
                    ${i18n.toneLabel}: <strong style="color:#e2e8f0;">${esc(copyA.overallTone)}</strong></div>` : ''}
                ${copyA.copyFormula ? `<div style="font-size:0.7rem;color:#94a3b8;">
                    ${i18n.formulaLabel}: <strong style="color:#e2e8f0;">${esc(copyA.copyFormula)}</strong></div>` : ''}
            </div>

            ${copyA.topCopyLines?.length ? `
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
                 border-radius:11px;padding:12px;">
                <small style="color:#94a3b8;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:8px;">
                    ${i18n.topCopyLabel}
                </small>
                ${copyA.topCopyLines.slice(0,3).map(line => `
                <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.5;margin-bottom:6px;
                     padding-left:8px;border-left:2px solid #f97316;" dir="auto">
                    ${esc(line)}
                </div>`).join('')}
            </div>` : ''}

            ${funnelDNA.funnelType ? `
            <div style="background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);
                 border-radius:11px;padding:12px;">
                <small style="color:#818cf8;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:8px;">
                    Funnel DNA
                </small>
                <div style="font-size:0.85rem;color:#c4b5fd;font-weight:700;margin-bottom:7px;">
                    ${esc(funnelDNA.funnelType)}
                </div>
                ${funnelDNA.conversionSequence?.length ? `
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px;">
                    ${funnelDNA.conversionSequence.map((step, i) => `
                    <span style="font-size:0.65rem;color:#94a3b8;background:rgba(255,255,255,0.04);
                          padding:2px 7px;border-radius:6px;">${i+1}. ${esc(step)}</span>`).join('')}
                </div>` : ''}
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    ${[
                        [isAr?'إعادة استهداف':'Retargeting',  funnelDNA.retargeting           ],
                        [isAr?'تسلسل بريد':'Email Seq.',      funnelDNA.emailSequenceDetected ],
                        [isAr?'دفع':'Checkout',               funnelDNA.checkoutDetected       ],
                    ].map(([label, val]) => `
                    <span style="font-size:0.62rem;color:${val?'#10b981':'#475569'};
                          background:rgba(${val?'16,185,129':'100,116,139'},0.08);
                          padding:2px 7px;border-radius:6px;">
                        ${val ? '✓' : '✗'} ${label}
                    </span>`).join('')}
                </div>
            </div>` : ''}

            <!-- Cognitive Biases & Reading Pattern (NOUVEAU V12) -->
            ${hasNeuro ? `
            <div style="background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.2);
                 border-radius:11px;padding:12px;">
                <small style="color:#a855f7;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    <i class="fas fa-brain"></i> ${i18n.neuroTitle}
                </small>

                ${neuro.readingPattern ? `
                <div style="margin-bottom:8px;padding:6px 9px;background:rgba(168,85,247,0.07);
                     border-radius:7px;">
                    <small style="color:#c4b5fd;font-size:0.58rem;font-weight:700;
                           text-transform:uppercase;">${i18n.readingLabel}:</small>
                    <div style="font-size:0.75rem;color:#e9d5ff;margin-top:2px;" dir="auto">
                        ${esc(typeof neuro.readingPattern === 'object'
                            ? (neuro.readingPattern.pattern || neuro.readingPattern.description || JSON.stringify(neuro.readingPattern))
                            : neuro.readingPattern)}
                    </div>
                </div>` : ''}

                ${neuro.cognitiveBiases?.length ? `
                <div style="margin-bottom:8px;">
                    <small style="color:#c4b5fd;font-size:0.58rem;font-weight:700;
                           text-transform:uppercase;">${i18n.biasesLabel}:</small>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">
                        ${neuro.cognitiveBiases.slice(0,6).map(b => {
                            const label = typeof b === 'object' ? (b.name || b.bias || JSON.stringify(b)) : b;
                            const desc  = typeof b === 'object' ? (b.description || b.tip || '') : '';
                            return `<span style="background:rgba(168,85,247,0.1);color:#d8b4fe;
                                padding:2px 9px;border-radius:20px;font-size:0.65rem;
                                border:1px solid rgba(168,85,247,0.2);cursor:default;"
                                title="${esc(desc)}">${esc(label)}</span>`;
                        }).join('')}
                    </div>
                </div>` : ''}

                ${neuro.trustBuilding?.present?.length ? `
                <div style="margin-bottom:6px;">
                    <small style="color:#10b981;font-size:0.58rem;font-weight:700;
                           text-transform:uppercase;">Trust Present:</small>
                    <div style="font-size:0.7rem;color:#6ee7b7;margin-top:2px;" dir="auto">
                        ${neuro.trustBuilding.present.slice(0,3).join(' · ')}
                    </div>
                </div>` : ''}
                ${neuro.trustBuilding?.missing?.length ? `
                <div>
                    <small style="color:#ef4444;font-size:0.58rem;font-weight:700;
                           text-transform:uppercase;">Trust Missing:</small>
                    ${neuro.trustBuilding.missing.slice(0,2).map(m => `
                    <div style="font-size:0.7rem;color:#fca5a5;margin-top:2px;" dir="auto">
                        ✗ ${esc(m)}</div>`).join('')}
                </div>` : ''}
            </div>` : ''}

            <!-- Psych Triggers (NOUVEAU V12 — était ignoré) -->
            ${hasPsychTriggers ? `
            <div style="background:rgba(236,72,153,0.05);border:1px solid rgba(236,72,153,0.2);
                 border-radius:11px;padding:12px;">
                <small style="color:#ec4899;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    <i class="fas fa-bolt"></i> ${i18n.psychTriggersLabel}
                </small>
                ${[
                    { key: 'urgency',     label: i18n.urgencyLabel,     color: '#ef4444', data: psych.urgency     },
                    { key: 'scarcity',    label: i18n.scarcityLabel,    color: '#f97316', data: psych.scarcity    },
                    { key: 'socialproof', label: i18n.socialProofLabel, color: '#3b82f6', data: psych.socialproof },
                    { key: 'authority',   label: i18n.authorityLabel,   color: '#8b5cf6', data: psych.authority   },
                    { key: 'guarantees',  label: isAr?'ضمانات':'Guarantees', color: '#10b981', data: psych.guarantees },
                    { key: 'fearloss',    label: i18n.fearLossLabel,    color: '#f43f5e', data: psych.fearloss    },
                    { key: 'priceanchors',label: isAr?'تثبيت سعر':'Price Anchors', color: '#f59e0b', data: psych.priceanchors },
                ].filter(t => t.data?.length).map(t => {
                    const items = t.data.slice(0,2);
                    return `
                    <div style="margin-bottom:7px;">
                        <small style="color:${t.color};font-size:0.58rem;font-weight:700;
                               text-transform:uppercase;">${t.label} (${t.data.length}):</small>
                        ${items.map(item => `
                        <div style="font-size:0.72rem;color:#e2e8f0;margin-top:2px;
                             padding-left:6px;border-left:2px solid ${t.color}60;" dir="auto">
                            ${esc(typeof item === 'object' ? (item.text || item.value || item.copy || JSON.stringify(item)) : item)}
                        </div>`).join('')}
                    </div>`;
                }).join('')}
                ${psych.ctabuttons?.length ? `
                <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.05);padding-top:7px;">
                    <small style="color:#10b981;font-size:0.58rem;font-weight:700;
                           text-transform:uppercase;">CTAs (${psych.ctabuttons.length}):</small>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">
                        ${psych.ctabuttons.slice(0,5).map(c => `
                        <span style="background:rgba(16,185,129,0.1);color:#6ee7b7;
                              padding:2px 9px;border-radius:20px;font-size:0.65rem;
                              border:1px solid rgba(16,185,129,0.2);">
                            ${esc(typeof c === 'object' ? (c.text || c.label || JSON.stringify(c)) : c)}
                        </span>`).join('')}
                    </div>
                </div>` : ''}
            </div>` : ''}

            ${topKeywords.length ? `
            <div style="background:rgba(255,255,255,0.02);
                 border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:12px;">
                <small style="color:#64748b;font-weight:800;font-size:0.6rem;text-transform:uppercase;
                       letter-spacing:1px;display:block;margin-bottom:9px;">
                    ${i18n.topKwLabel}
                </small>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    ${topKeywords.slice(0,20).map(k => {
                        const cnt  = typeof k === 'object' ? (k.count || 1) : 1;
                        const word = typeof k === 'object' ? (k.word  || k) : k;
                        const size = Math.min(14, 9 + Math.floor(cnt / 3));
                        return `<span style="background:rgba(99,102,241,0.08);color:#a5b4fc;
                            padding:3px 9px;border-radius:20px;font-size:${size}px;
                            border:1px solid rgba(99,102,241,0.15);cursor:default;" title="${cnt}x">
                            ${esc(word)}<sup style="font-size:8px;color:#6366f1;">${cnt}</sup>
                        </span>`;
                    }).join('')}
                </div>
            </div>` : ''}

        </div>
    </div>` : '';

    // ══════════════════════════════════════════════════
    // 📊 BLOC 6 — CHART INDICATEURS
    // ══════════════════════════════════════════════════
    const ctaRatio = totalSections > 0
        ? Math.round((sectionsCTA.length / totalSections) * 100) : 0;

    const chartHtml = `
    <div class="result-card fade-in-up" style="margin-bottom:22px;" dir="${dir}">
        <h3 style="margin-bottom:14px;font-family:Cairo;display:flex;align-items:center;
             gap:10px;color:white;font-size:1rem;">
            <i class="fas fa-chart-bar" style="color:#6366f1"></i>
            ${i18n.indicatorsTitle}
        </h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:center;">
            <div><canvas id="funnelBarChart" height="155"></canvas></div>
            <div style="display:grid;gap:10px;">
                ${[
                    { label: isAr?'تغطية CTA':'CTA Coverage',    val: ctaRatio,      suffix: '%',
                      c: ctaRatio >= 60 ? '#10b981' : '#ef4444' },
                    { label: isAr?'النتيجة الإجمالية':'Global Score', val: score,     suffix: '/100',
                      c: `#${scoreColor}` },
                    { label: isAr?'نتيجة الثقة':'Trust Score',   val: trustScore,    suffix: '/13',
                      c: '#3b82f6' },
                    { label: isAr?'نتيجة التحويل':'Conv. Score', val: convScore,     suffix: '/100',
                      c: '#f59e0b' },
                    { label: isAr?'نتيجة التصميم':'Design Score',val: design.score,  suffix: '/100',
                      c: '#ec4899' },
                ].map(b => `
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                        <small style="color:#64748b;font-size:0.7rem;font-weight:600;">${b.label}</small>
                        <small style="color:${b.c};font-weight:700;">${b.val}${b.suffix}</small>
                    </div>
                    <div style="height:5px;background:rgba(255,255,255,0.05);
                         border-radius:8px;overflow:hidden;">
                        <div style="height:100%;width:${b.val}%;background:${b.c};
                             border-radius:8px;transition:width 1.5s ease;"></div>
                    </div>
                </div>`).join('')}
            </div>
        </div>

        <div style="background:rgba(255,255,255,0.02);border-radius:9px;padding:10px;
             border:1px solid rgba(255,255,255,0.05);display:grid;
             grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;margin-top:14px;">
            <div>
                <div style="font-size:1.3rem;font-weight:900;color:#6366f1;">
                    ${totalSections}
                </div>
                <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;">
                    ${i18n.sectionsLabel}
                </div>
            </div>
            <div>
                <div style="font-size:1.1rem;font-weight:900;color:#ec4899;">
                    ${fin.netProfit ? fin.netProfit.toLocaleString() : '—'}
                </div>
                <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;">
                    Steal ${fin.currency}
                </div>
            </div>
            <div>
                <div style="font-size:1.1rem;font-weight:900;color:#f59e0b;">
                    ${med.totalImages || 0}
                </div>
                <div style="font-size:0.6rem;color:#64748b;text-transform:uppercase;">
                    ${isAr ? 'صور' : 'Images'}
                </div>
            </div>
        </div>
    </div>`;

    // ══════════════════════════════════════════════════
    // 🔬 BLOC 7 — AUTOPSIE AIDA + ARBORESCENCE
    //             (BUG-FIX critique + enrichi aidaAnalysis)
    // ══════════════════════════════════════════════════

    // Extraction sécurisée des fixes AIDA depuis aidaAnalysis
    const aidaFixes = {
        attention : aidaData.attention?.fix  || aidaData.attention?.recommendation  || null,
        interest  : aidaData.interest?.fix   || aidaData.interest?.weaknesses?.[0]  || null,
        desire    : aidaData.desire?.fix     || aidaData.desire?.recommendation     || null,
        action    : aidaData.action?.fix     || aidaData.action?.recommendation     || null,
    };
    const aidaScores = {
        attention : aidaData.attention?.score || null,
        interest  : aidaData.interest?.score  || null,
        desire    : aidaData.desire?.score    || null,
        action    : aidaData.action?.score    || null,
    };
    const aidaPhases = [
        { key: 'attention', label: i18n.attentionLabel, fixLabel: i18n.aidaAttFix, color: '#3b82f6', icon: 'fa-eye'        },
        { key: 'interest',  label: i18n.interestLabel,  fixLabel: i18n.aidaIntFix, color: '#f59e0b', icon: 'fa-fire'       },
        { key: 'desire',    label: i18n.desireLabel,    fixLabel: i18n.aidaDesFix, color: '#ec4899', icon: 'fa-heart'      },
        { key: 'action',    label: i18n.actionLabel,    fixLabel: i18n.aidaActFix, color: '#10b981', icon: 'fa-mouse-pointer'},
    ];

    const aidaSummaryHtml = (Object.values(aidaFixes).some(v => v) || Object.values(aidaScores).some(v => v !== null)) ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;
         margin-bottom:14px;padding:12px;background:rgba(255,255,255,0.02);
         border-radius:11px;border:1px solid rgba(255,255,255,0.06);">
        ${aidaPhases.map(p => {
            const sc  = aidaScores[p.key];
            const fix = aidaFixes[p.key];
            if (!sc && !fix) return '';
            const scColor = sc !== null ? (sc >= 70 ? '#10b981' : sc >= 40 ? '#f59e0b' : '#ef4444') : p.color;
            return `
            <div style="padding:9px;background:rgba(${toRgb(p.color)},0.04);
                 border-radius:9px;border:1px solid rgba(${toRgb(p.color)},0.15);">
                <div style="display:flex;align-items:center;justify-content:space-between;
                     margin-bottom:6px;">
                    <small style="color:${p.color};font-weight:800;font-size:0.6rem;
                           text-transform:uppercase;">
                        <i class="fas ${p.icon}"></i> ${p.label}
                    </small>
                    ${sc !== null ? `<span style="color:${scColor};font-size:0.7rem;
                        font-weight:800;">${sc}/100</span>` : ''}
                </div>
                ${sc !== null ? `
                <div style="height:3px;background:rgba(255,255,255,0.06);
                     border-radius:3px;overflow:hidden;margin-bottom:7px;">
                    <div style="height:100%;width:${sc}%;background:${scColor};
                         border-radius:3px;transition:width 1.5s ease;"></div>
                </div>` : ''}
                ${fix ? `
                <div style="display:flex;gap:5px;align-items:flex-start;">
                    <i class="fas fa-wrench" style="color:${p.color};font-size:0.55rem;
                       margin-top:3px;flex-shrink:0;"></i>
                    <span style="font-size:0.72rem;color:#cbd5e1;line-height:1.5;"
                          dir="auto">${esc(fix)}</span>
                </div>` : ''}
            </div>`;
        }).join('')}
    </div>` : '';

   const sectionsHtml = sections.length ? `
    <div class="result-card fade-in-up" style="margin-bottom:22px;" dir="${dir}">
        <h3 style="margin-bottom:14px;font-family:Cairo;display:flex;align-items:center;
             gap:10px;color:white;font-size:1rem;flex-wrap:wrap;">
            <i class="fas fa-microscope" style="color:#06b6d4"></i>
            ${i18n.autopsyTitle}
            <span style="background:rgba(6,182,212,0.1);color:#67e8f9;padding:2px 9px;
                  border-radius:20px;font-size:0.65rem;font-weight:700;
                  border:1px solid rgba(6,182,212,0.2);">
                ${totalSections} ${i18n.sectionsLabel}
            </span>
        </h3>

        ${missingSectionsHtml}
        ${aidaSummaryHtml}

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">
            ${sections.map((s, idx) => {
                const type = s.sectionType || s.type || `Section ${idx+1}`;
                const label = s.label || type;
                const isPresent = s.present !== false;
                const hasCTA = s.hasCTA !== false;
                const impact = s.conversionImpact || 'MEDIUM';
                const impactC = impact === 'HIGH' ? '#f59e0b' : impact === 'LOW' ? '#64748b' : '#06b6d4';
                const ctaC = hasCTA ? '#10b981' : '#ef4444';
                const sc = typeof s.score === 'number' ? s.score : null;
                const scColor = sc !== null ? (sc >= 70 ? '#10b981' : sc >= 40 ? '#f59e0b' : '#ef4444') : '#64748b';

                const aidaPhaseMap = {
                    'HERO': 'attention',
                    'HEADER': 'attention',
                    'VALUE_PROP': 'attention',

                    'PROBLEM': 'interest',
                    'SOLUTION': 'interest',
                    'FEATURES': 'interest',
                    'BENEFITS': 'interest',
                    'PROCESS': 'interest',
                    'DEMO': 'interest',
                    'USE_CASES': 'interest',
                    'ABOUT': 'interest',
                    'TRUST': 'interest',
                    'LOGOS': 'interest',

                    'TESTIMONIALS': 'desire',
                    'SOCIAL_PROOF': 'desire',
                    'SOCIAL_PROOF': 'desire',
                    'CASE_STUDIES': 'desire',
                    'COMPARISON': 'desire',
                    'PRICING': 'desire',
                    'OFFER': 'desire',
                    'FAQ': 'desire',
                    'OBJECTIONS': 'desire',
                    'GUARANTEE': 'desire',

                    'CTA': 'action',
                    'FORM': 'action',
                    'CONTACT': 'action',
                    'CHECKOUT': 'action',
                    'FOOTER': 'action',
                };

                const aidaPhaseKey = aidaPhaseMap[String(type).toUpperCase()] || null;
                const aidaPhaseObj = aidaPhaseKey ? aidaPhases.find(p => p.key === aidaPhaseKey) : null;

                return `
                <div style="background:rgba(255,255,255,0.02);border-radius:11px;padding:12px;
                     border:1px solid rgba(255,255,255,0.06);
                     border-top:2px solid ${impactC};
                     opacity:${isPresent ? '1' : '0.72'};">
                    <div style="display:flex;align-items:center;justify-content:space-between;
                         margin-bottom:8px;gap:5px;flex-wrap:wrap;">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                            <span style="font-size:0.7rem;font-weight:800;color:${impactC};
                                  text-transform:uppercase;letter-spacing:0.5px;">
                                ${esc(label)}
                            </span>
                            ${aidaPhaseObj ? `
                            <span style="background:rgba(${toRgb(aidaPhaseObj.color)},0.12);
                                  color:${aidaPhaseObj.color};padding:1px 6px;
                                  border-radius:6px;font-size:0.55rem;font-weight:700;">
                                ${aidaPhaseObj.label}
                            </span>` : ''}
                            ${!isPresent ? `
                            <span style="background:rgba(100,116,139,0.12);color:#94a3b8;
                                  padding:1px 6px;border-radius:6px;font-size:0.55rem;font-weight:700;">
                                ${isAr ? 'غير موجود' : isEn ? 'ABSENT' : 'ABSENT'}
                            </span>` : ''}
                        </div>

                        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                            ${sc !== null ? `
                            <span style="background:rgba(${toRgb(scColor)},0.12);color:${scColor};
                                  padding:1px 6px;border-radius:6px;font-size:0.6rem;font-weight:700;">
                                ${sc}/100
                            </span>` : ''}
                            <span style="background:rgba(${hasCTA ? '16,185,129' : '239,68,68'},0.1);
                                  color:${ctaC};padding:1px 7px;border-radius:6px;
                                  font-size:0.6rem;font-weight:700;">
                                ${hasCTA ? `✓ ${i18n.ctaLabel}` : `✗ ${i18n.noCTALabel}`}
                            </span>
                            ${impact === 'HIGH' ? `
                            <span style="background:rgba(245,158,11,0.1);color:#f59e0b;
                                  padding:1px 6px;border-radius:6px;font-size:0.6rem;
                                  font-weight:700;">⚡ HIGH</span>` : ''}
                        </div>
                    </div>

                    ${s.title ? `
                    <div style="font-size:0.75rem;color:#e2e8f0;font-weight:600;margin-bottom:5px;" dir="auto">
                        <span style="color:#64748b;font-size:0.6rem;">${i18n.titleLabel}: </span>
                        ${esc(s.title)}
                    </div>` : ''}

                    ${s.content ? `
                    <div style="font-size:0.72rem;color:#94a3b8;line-height:1.5;margin-bottom:6px;" dir="auto">
                        ${esc(s.content.substring(0,120))}${s.content.length > 120 ? '…' : ''}
                    </div>` : ''}

                    ${s.ctaText ? `
                    <div style="margin-bottom:5px;">
                        <span style="background:rgba(16,185,129,0.1);color:#6ee7b7;
                              padding:2px 8px;border-radius:6px;font-size:0.65rem;
                              border:1px solid rgba(16,185,129,0.2);" dir="auto">
                            → ${esc(s.ctaText)}
                        </span>
                    </div>` : ''}

                    ${s.weakness ? `
                    <div style="display:flex;gap:5px;align-items:flex-start;margin-bottom:4px;">
                        <i class="fas fa-exclamation-triangle" style="color:#ef4444;
                           font-size:0.58rem;margin-top:3px;flex-shrink:0;"></i>
                        <span style="font-size:0.7rem;color:#fca5a5;line-height:1.5;" dir="auto">
                            ${esc(s.weakness)}
                        </span>
                    </div>` : ''}

                    ${s.missingElement ? `
                    <div style="display:flex;gap:5px;align-items:flex-start;margin-bottom:4px;">
                        <i class="fas fa-puzzle-piece" style="color:#f59e0b;
                           font-size:0.58rem;margin-top:3px;flex-shrink:0;"></i>
                        <span style="font-size:0.7rem;color:#fde68a;line-height:1.5;" dir="auto">
                            ${esc(s.missingElement)}
                        </span>
                    </div>` : ''}

                    ${s.upgradeCopy ? `
                    <div style="margin-top:6px;padding:6px 8px;
                         background:rgba(99,102,241,0.07);border-radius:7px;
                         border:1px solid rgba(99,102,241,0.15);">
                        <small style="color:#818cf8;font-size:0.58rem;font-weight:700;
                               text-transform:uppercase;">${i18n.upgradeLabel}:</small>
                        <div style="font-size:0.72rem;color:#c4b5fd;margin-top:2px;
                             font-style:italic;" dir="auto">
                            ${esc(s.upgradeCopy)}
                        </div>
                    </div>` : ''}

                    ${s.conversionRole ? `
                    <div style="margin-top:5px;font-size:0.65rem;color:#64748b;" dir="auto">
                        ${esc(s.conversionRole)}
                    </div>` : ''}
                </div>`;
            }).join('')}
        </div>
    </div>` : '';

    // ══════════════════════════════════════════════════
    // 📡 BLOC 8 — COUNTER ATTACK COPY
    // ══════════════════════════════════════════════════
    const hasCounter = counter.adHeadline || counter.whatsappMessage
                    || counter.emailSubject || counter.smsText;

    const counterHtml = hasCounter ? `
    <div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #ef4444;" dir="${dir}">
        <h3 style="margin-bottom:14px;font-family:Cairo;display:flex;align-items:center;
             gap:10px;color:white;font-size:1rem;">
            <i class="fas fa-crosshairs" style="color:#ef4444"></i>
            ${i18n.counterTitle}
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;">
            ${[
                { label: i18n.adHeadlineLabel, val: counter.adHeadline,      icon: 'fa-ad',        color: '#ef4444' },
                { label: i18n.whatsappLabel,   val: counter.whatsappMessage, icon: 'fa-whatsapp',  color: '#25d366' },
                { label: i18n.emailLabel,      val: counter.emailSubject,    icon: 'fa-envelope',  color: '#3b82f6' },
                { label: i18n.smsLabel,        val: counter.smsText,         icon: 'fa-sms',       color: '#f59e0b' },
            ].filter(x => x.val).map(x => `
            <div style="background:rgba(${toRgb(x.color)},0.05);
                 border:1px solid rgba(${toRgb(x.color)},0.2);border-radius:11px;padding:12px;">
                <small style="color:${x.color};font-weight:800;font-size:0.6rem;
                       text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">
                    <i class="fas ${x.icon}"></i> ${x.label}
                </small>
                <p style="margin:0;font-size:0.83rem;color:#e2e8f0;font-weight:600;
                   line-height:1.6;" dir="auto">${esc(x.val)}</p>
                <button onclick="navigator.clipboard.writeText('${esc(x.val)}')"
                    style="margin-top:8px;background:rgba(${toRgb(x.color)},0.1);
                           color:${x.color};border:1px solid rgba(${toRgb(x.color)},0.25);
                           border-radius:6px;padding:3px 10px;font-size:0.62rem;
                           cursor:pointer;font-weight:700;">
                    <i class="fas fa-copy"></i> ${i18n.copyBtn}
                </button>
            </div>`).join('')}
        </div>
    </div>` : '';

    // ══════════════════════════════════════════════════
    // 🪄 MAGIC PROMPT
    // ══════════════════════════════════════════════════
    const magicPromptText = data.aiRewritePrompt
                         || data.magicPrompt
                         || data.spyReport?.aiRewritePrompt
                         || data.strategicBlueprint?.aiRewritePrompt
                         || null;

    // ══════════════════════════════════════════════════
    // 🏗️ ASSEMBLAGE FINAL
    // ══════════════════════════════════════════════════

    const scorePill = (label, value, color) => {
        const n = Number(value);
        const hasScore = Number.isFinite(n);
        const shown = hasScore ? `${Math.max(0, Math.min(100, Math.round(n)))}/100` : (isAr ? 'للفحص' : isEn ? 'To verify' : 'À vérifier');
        return `
<div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07)">
    <div style="font-size:0.72rem;color:#64748b;margin-bottom:6px;">${escapeHtml(label)}</div>
    <div style="font-size:1.05rem;font-weight:800;color:${hasScore ? color : '#64748b'};">${shown}</div>
</div>`;
    };
// --- Audit blocks: init BEFORE any template uses them ---




const auditSummaryHtml = `
<div class="result-card fade-in-up" style="margin-bottom:22px" dir="${dir}">
    <h3 style="margin-bottom:12px;color:white;font-size:1rem;display:flex;align-items:center;gap:10px;">
        <i class="fas fa-shield-halved" style="color:#10b981"></i>
        ${escapeHtml(auditSummary.title || 'Website & Funnel Audit')}
    </h3>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <span style="background:rgba(16,185,129,0.12);color:#34d399;padding:6px 12px;border-radius:999px;font-size:0.75rem;font-weight:800;">
            Score ${auditSummary.overallScore || 0}/100
        </span>
        ${auditSummary.grade ? `
        <span style="background:rgba(59,130,246,0.12);color:#93c5fd;padding:6px 12px;border-radius:999px;font-size:0.75rem;font-weight:800;">
            Grade ${escapeHtml(auditSummary.grade)}
        </span>` : ''}
        ${auditSummary.confidence ? `
        <span style="background:rgba(245,158,11,0.12);color:#fbbf24;padding:6px 12px;border-radius:999px;font-size:0.75rem;font-weight:800;">
            Confidence ${escapeHtml(auditSummary.confidence)}
        </span>` : ''}
    </div>
    <p style="color:#cbd5e1;font-size:0.9rem;line-height:1.65;margin-bottom:14px;">
        ${escapeHtml(auditSummary.verdict || 'No audit verdict available.')}
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div style="padding:14px;border:1px solid rgba(16,185,129,0.16);background:rgba(16,185,129,0.05);border-radius:12px;">
            <div style="font-size:0.72rem;color:#34d399;font-weight:800;margin-bottom:8px;">TOP STRENGTHS</div>
            ${(auditSummary.topStrengths || []).length
                ? auditSummary.topStrengths.map(x => `<div style="color:#e2e8f0;font-size:0.82rem;margin-bottom:6px;">• ${escapeHtml(x)}</div>`).join('')
                : `<div style="color:#64748b;font-size:0.82rem;">No strengths detected.</div>`}
        </div>
        <div style="padding:14px;border:1px solid rgba(239,68,68,0.16);background:rgba(239,68,68,0.05);border-radius:12px;">
            <div style="font-size:0.72rem;color:#f87171;font-weight:800;margin-bottom:8px;">TOP WEAKNESSES</div>
            ${(auditSummary.topWeaknesses || []).length
                ? auditSummary.topWeaknesses.map(x => `<div style="color:#e2e8f0;font-size:0.82rem;margin-bottom:6px;">• ${escapeHtml(x)}</div>`).join('')
                : `<div style="color:#64748b;font-size:0.82rem;">No weaknesses detected.</div>`}
        </div>
    </div>
</div>`;

const auditScorecardHtml = `
<div class="result-card fade-in-up" style="margin-bottom:22px" dir="${dir}">
    <h3 style="margin-bottom:14px;color:white;font-size:1rem;display:flex;align-items:center;gap:10px;">
        <i class="fas fa-chart-column" style="color:#6366f1"></i>
        Audit Scorecard
    </h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
        ${scorePill('Structure', auditScorecard.structure, '#10b981')}
        ${scorePill('Clarity', auditScorecard.clarity, '#3b82f6')}
        ${scorePill('Trust', auditScorecard.trust, '#8b5cf6')}
        ${scorePill('Offer', auditScorecard.offer, '#f59e0b')}
        ${scorePill('CTA', auditScorecard.cta, '#ec4899')}
        ${scorePill('Friction', auditScorecard.friction, '#ef4444')}
    </div>
</div>`;

const auditIssuesHtml = `
<div class="result-card fade-in-up" style="margin-bottom:22px" dir="${dir}">
    <h3 style="margin-bottom:14px;color:white;font-size:1rem;display:flex;align-items:center;gap:10px;">
        <i class="fas fa-triangle-exclamation" style="color:#f59e0b"></i>
        Priority Issues
    </h3>
    <div style="display:grid;gap:10px;">
        ${(auditIssues || []).slice(0,5).map(issue => `
            <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07)">
                <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
                    <strong style="color:white;font-size:0.88rem;">${escapeHtml(issue.title || issue.key || 'Issue')}</strong>
                    <span style="font-size:0.68rem;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(239,68,68,0.12);color:#f87171;">
                        ${escapeHtml(issue.severity || 'MEDIUM')}
                    </span>
                </div>
                ${issue.impact ? `<div style="color:#cbd5e1;font-size:0.8rem;margin-bottom:6px;">${escapeHtml(issue.impact)}</div>` : ''}
                ${issue.recommendedFix ? `<div style="color:#94a3b8;font-size:0.78rem;">Fix: ${escapeHtml(issue.recommendedFix)}</div>` : ''}
            </div>
        `).join('') || `<div style="color:#64748b;">No audit issues available.</div>`}
    </div>

    <h3 style="margin:20px 0 14px;color:white;font-size:1rem;display:flex;align-items:center;gap:10px;">
        <i class="fas fa-bolt" style="color:#10b981"></i>
        Quick Wins
    </h3>
    <div style="display:grid;gap:10px;">
        ${(auditQuickWins || []).slice(0,5).map(win => `
            <div style="padding:14px;border-radius:12px;background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.12)">
                <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
                    <strong style="color:white;font-size:0.88rem;">#${win.priority || '-'} — ${escapeHtml(win.title || 'Quick Win')}</strong>
                    <span style="font-size:0.68rem;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(59,130,246,0.12);color:#93c5fd;">
                        ${escapeHtml(win.impact || 'MEDIUM')}
                    </span>
                </div>
                ${win.expectedGain ? `<div style="color:#34d399;font-size:0.8rem;margin-bottom:6px;">Expected gain: ${escapeHtml(win.expectedGain)}</div>` : ''}
                ${win.howTo ? `<div style="color:#cbd5e1;font-size:0.78rem;">${escapeHtml(win.howTo)}</div>` : ''}
            </div>
        `).join('') || `<div style="color:#64748b;">No quick wins available.</div>`}
    </div>
</div>`;
const funnelReportLabels = getReportLabels({ isAr, isEn });
   container.innerHTML = `
  <div id="funnelReport" dir="${dir}">
    ${renderExecutiveSummary(data, 'funnel', { isAr, isEn })}
    ${funnelSurgeryHtml}
    ${renderReportSection('audit', funnelReportLabels.audit, funnelReportLabels.auditSub, 'fa-shield-halved', `
        ${cotHtml}
        ${headerHtml}
        ${decisionProofHtml}
        ${fieldGuideTopHtml}
        ${auditSummaryHtml}
        ${auditScorecardHtml}
        ${auditIssuesHtml}
    `, { isAr, isEn })}

    ${renderReportSection('money', funnelReportLabels.money, funnelReportLabels.moneySub, 'fa-hand-holding-dollar', `
        ${financialHtml}
        ${aarrHtml}
        ${pricingHtml}
        ${blueprintHtml}
    `, { isAr, isEn })}

    ${renderReportSection('page', funnelReportLabels.page, funnelReportLabels.pageSub, 'fa-pen-nib', `
        ${designHtml}
        ${perfTrustHtml}
        ${copyHtml}
        ${chartHtml}
        ${sectionsHtml}
        ${counterHtml}
    `, { isAr, isEn })}

    ${renderExpertDock('funnel', { isAr, isEn })}
    ${renderReportSection('proof', funnelReportLabels.proof, funnelReportLabels.proofSub, 'fa-link', fieldStudiesBottomHtml, { isAr, isEn })}
    <div id="magicPromptPlaceholder"></div>
  </div>`;
    cleanRenderedOutput(container);

    showResults('resultsFunnel');

    // Injection Magic Prompt via fonction dédiée
    if (magicPromptText) {
        if (typeof window.displayMagicPrompt === 'function') {
            window.displayMagicPrompt(magicPromptText);
        } else {
            const ph = document.getElementById('magicPromptPlaceholder');
            if (ph) ph.innerHTML = `
            <div class="result-card fade-in-up" style="margin-bottom:22px;border-left:4px solid #a855f7;" dir="${dir}">
                <h3 style="margin-bottom:10px;font-family:Cairo;display:flex;align-items:center;
                     gap:10px;color:white;font-size:1rem;">
                    <i class="fas fa-magic" style="color:#a855f7"></i>
                    ${i18n.magicTitle}
                </h3>
                <p style="font-size:0.75rem;color:#64748b;margin-bottom:10px;">${i18n.magicSub}</p>
                <textarea readonly style="width:100%;height:120px;background:rgba(0,0,0,0.3);
                    border:1px solid rgba(168,85,247,0.2);border-radius:9px;padding:10px;
                    color:#e2e8f0;font-size:0.78rem;resize:vertical;
                    font-family:monospace;line-height:1.6;">${esc(magicPromptText)}</textarea>
                <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value);
                                 this.textContent='${i18n.copiedBtn}';
                                 setTimeout(()=>this.textContent='${i18n.copyBtn}',2000)"
                    style="margin-top:8px;background:rgba(168,85,247,0.15);color:#c4b5fd;
                           border:1px solid rgba(168,85,247,0.3);border-radius:8px;
                           padding:6px 16px;font-size:0.72rem;cursor:pointer;font-weight:700;">
                    <i class="fas fa-copy"></i> ${i18n.copyBtn}
                </button>
            </div>`;
        }
    }

    // ══════════════════════════════════════════════════
    // 📈 CHARTS
    // ══════════════════════════════════════════════════
    setTimeout(() => {

        // Donut Score Global
        const donutCtx = document.getElementById('scoreDonut')?.getContext('2d');
        if (donutCtx && typeof Chart !== 'undefined') {
            if (window.scoreDonut) window.scoreDonut.destroy();
            window.scoreDonut = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [score, 100 - score],
                        backgroundColor: [`#${scoreColor}`, 'rgba(255,255,255,0.04)'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '80%',
                    responsive: false,
                    maintainAspectRatio: false,
                    plugins: {
                        legend:  { display: false },
                        tooltip: { enabled: false }
                    },
                    animation: { animateScale: true }
                }
            });
        }

        // Bar Chart Sections (CTA vs no CTA)
        const barCtx = document.getElementById('funnelBarChart')?.getContext('2d');
        if (barCtx && typeof Chart !== 'undefined' && sections.length) {
            if (window.funnelBarChart) window.funnelBarChart.destroy();
            const sliced = sections.slice(0, 7);
            window.funnelBarChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: sliced.map(s =>
                        (s.sectionType || s.type || '?').substring(0, 10)),
                    datasets: [{
                        data: sliced.map(s => s.hasCTA !== false ? 1 : 0),
                        backgroundColor: sliced.map(s =>
                            s.hasCTA !== false ? '#10b981' : '#ef4444'),
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { display: false, max: 1.4 },
                        x: {
                            grid:  { display: false },
                            ticks: { color: '#64748b', font: { size: 9 } }
                        }
                    },
                    plugins: {
                        legend:  { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => ctx.raw === 1
                                    ? '✓ CTA'
                                    : isAr ? 'بدون CTA'
                                    : isEn ? 'No CTA' : 'Pas de CTA'
                            }
                        }
                    }
                }
            });
        }

    }, 200);

    // ── STATE & EXPORT ────────────────────────────────
    STATE.lastFunnelResults = data;

    if (typeof window.updateExportBadges === 'function') {
        window.updateExportBadges();
    }

    toast.success(
        isAr ? '✅ التحليل مكتمل!'
      : isEn ? '✅ Analysis complete!'
      :        '✅ Analyse complète !'
    );
}
function funnelV2Text(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' || typeof value === 'number') {
        const text = repairFunnelSurgeryText(value).trim();
        return text && !/^(null|undefined|n\/a|na)$/i.test(text) ? text : fallback;
    }
    if (Array.isArray(value)) return value.map(item => funnelV2Text(item)).filter(Boolean).join(' · ') || fallback;
    if (typeof value === 'object') {
        for (const key of ['action', 'title', 'summary', 'verdict', 'section', 'friction', 'name', 'value', 'text', 'label']) {
            const text = funnelV2Text(value[key]);
            if (text) return text;
        }
    }
    return fallback;
}

function funnelV2Array(...values) {
    const selected = values.find(value => Array.isArray(value) && value.length) || [];
    const seen = new Set();
    return selected.filter(item => {
        const key = funnelV2Text(item).toLowerCase().replace(/\s+/g, ' ').slice(0, 180);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function funnelClientLabel(raw, opts = {}) {
    const isAr = opts.isAr;
    const isEn = opts.isEn;
    const source = funnelV2Text(raw, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!source) return isAr ? 'قسم' : isEn ? 'Section' : 'Section';
    const key = source.toLowerCase();
    const label = (fr, en, ar) => isAr ? ar : isEn ? en : fr;
    const rules = [
        [/^(hero|h1|above the fold|first screen)$/i, label('Premier écran', 'First screen', 'الشاشة الأولى')],
        [/primary cta|cta principal|main cta/i, label('Bouton principal', 'Primary action button', 'زر القرار الرئيسي')],
        [/^(cta|button|call to action)$/i, label('Appel à l’action', 'Call to action', 'دعوة لاتخاذ إجراء')],
        [/pricing|price|prix|tarif/i, label('Prix et offre', 'Price and offer', 'السعر والعرض')],
        [/offer|bundle|pack/i, label('Offre et pack', 'Offer and package', 'العرض والباقة')],
        [/social proof|testimonial|review|avis|t[ée]moignage|rating/i, label('Preuve sociale', 'Social proof', 'الدليل الاجتماعي')],
        [/features?|specs?|specification|caract[ée]ristique/i, label('Caractéristiques utiles', 'Useful features', 'الخصائص المهمة')],
        [/product visuals?|media|images?|video|gallery/i, label('Visuels produit', 'Product visuals', 'صور المنتج')],
        [/product|produit/i, label('Produit ou service', 'Product or service', 'المنتج أو الخدمة')],
        [/returns?|refund|retours?|remboursement/i, label('Retours et réassurance', 'Returns and reassurance', 'الإرجاع والطمأنة')],
        [/delivery|shipping|livraison/i, label('Livraison', 'Delivery', 'التوصيل')],
        [/trust|guarantee|warranty|garantie|preuve/i, label('Confiance et garanties', 'Trust and guarantees', 'الثقة والضمانات')],
        [/faq|questions?/i, label('Questions avant décision', 'Pre-purchase questions', 'أسئلة قبل القرار')],
        [/content|copy|message|texte/i, label('Contenu de vente', 'Sales copy', 'محتوى البيع')],
        [/payment|paiement/i, label('Paiement', 'Payment', 'الدفع')],
        [/mission/i, label('Analyse spécialisée', 'Specialized analysis', 'تحليل متخصص')],
        [/zone/i, label('Zone de page', 'Page area', 'منطقة الصفحة')]
    ];
    const found = rules.find(([pattern]) => pattern.test(key));
    if (found) return found[1];
    return source
        .replace(/\bcta\b/ig, 'CTA')
        .replace(/\bseo\b/ig, isEn ? 'SEO' : 'audit site')
        .replace(/^./, char => char.toUpperCase());
}

function funnelPriorityLabel(value, opts = {}) {
    const isAr = opts.isAr;
    const isEn = opts.isEn;
    const raw = funnelV2Text(value, '').toUpperCase();
    if (/CRITICAL|URGENT|HIGH|HAUTE|ELEV|ÉLEV/.test(raw)) return isAr ? 'Haute' : isEn ? 'High' : 'Haute';
    if (/LOW|BASSE|FAIBLE/.test(raw)) return isAr ? 'منخفضة' : isEn ? 'Low' : 'Faible';
    if (/MEDIUM|MOYEN|MOYENNE|متوسط/.test(raw)) return isAr ? 'متوسطة' : isEn ? 'Medium' : 'Moyenne';
    return funnelV2Text(value, isAr ? 'متوسطة' : isEn ? 'Medium' : 'Moyenne');
}

function renderFunnelV2Cards(items, opts = {}) {
    const safe = typeof escapeHtml === 'function' ? escapeHtml : value => String(value || '');
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return '';
    return `<div class="funnel-v2-card-grid">${list.slice(0, opts.limit || 6).map((item, index) => {
        const object = item && typeof item === 'object' ? item : { title: item };
        const title = funnelClientLabel(object.section || object.sectionType || object.friction || object.title || object.action || object.name, opts) || `${opts.itemLabel || 'Action'} ${index + 1}`;
        const observation = funnelV2Text(object.observedEvidence || object.evidence || object.detectedText || object.currentEvidence || object.problem || object.reason || object.why);
        const action = funnelV2Text(object.correction || object.action || object.improvement || object.newRecommendation || object.recommendedPosition || object.howTo);
        const priority = funnelPriorityLabel(object.priority || object.impact, opts);
        const confidence = funnelPriorityLabel(object.confidence, opts);
        return `<article class="funnel-v2-action" style="--funnel-v2-accent:${safe(opts.accent || '#22d3ee')}">
            <div class="funnel-v2-action-head"><strong dir="auto">${safe(title)}</strong><span>${safe(priority)}</span></div>
            ${observation ? `<p dir="auto"><b>${safe(opts.observationLabel || 'Observation')}:</b> ${safe(observation)}</p>` : ''}
            ${action && action !== title ? `<p dir="auto"><b>${safe(opts.actionLabel || 'Action')}:</b> ${safe(action)}</p>` : ''}
            <small>${safe(opts.confidenceLabel || 'Confiance')}: ${safe(confidence)}</small>
        </article>`;
    }).join('')}</div>`;
}


function funnelLegacyHasData(value, depth = 0) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
        const text = value.trim();
        return Boolean(text) && !/^(?:null|undefined|n\/a|na|—|-)$/i.test(text);
    }
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.some(item => funnelLegacyHasData(item, depth + 1));
    if (typeof value === 'object' && depth < 4) {
        return Object.entries(value).some(([key, item]) =>
            !/^(?:chainOfThought|rawHtml|html|logs?|debug|scripts?|styles?|svg)$/i.test(key) &&
            funnelLegacyHasData(item, depth + 1)
        );
    }
    return false;
}

function funnelLegacyLabel(key, opts = {}) {
    const isAr = opts.isAr;
    const isEn = opts.isEn;
    const labels = {
        overall: isAr ? 'النتيجة الإجمالية' : isEn ? 'Overall score' : 'Score global',
        score: isAr ? 'النتيجة' : isEn ? 'Score' : 'Score',
        verdict: isAr ? 'الخلاصة' : isEn ? 'Verdict' : 'Verdict',
        strengths: isAr ? 'نقاط القوة' : isEn ? 'Strengths' : 'Forces',
        weaknesses: isAr ? 'نقاط الضعف' : isEn ? 'Weaknesses' : 'Faiblesses',
        problems: isAr ? 'المشكلات' : isEn ? 'Problems' : 'Problèmes',
        recommendations: isAr ? 'التوصيات' : isEn ? 'Recommendations' : 'Recommandations',
        opportunities: isAr ? 'الفرص' : isEn ? 'Opportunities' : 'Opportunités',
        action: isAr ? 'الإجراء' : isEn ? 'Action' : 'Action',
        impact: isAr ? 'الأثر' : isEn ? 'Impact' : 'Impact',
        effort: isAr ? 'الجهد' : isEn ? 'Effort' : 'Effort',
        priority: isAr ? 'الأولوية' : isEn ? 'Priority' : 'Priorité',
        confidence: isAr ? 'الثقة' : isEn ? 'Confidence' : 'Confiance',
        primaryCta: isAr ? 'CTA الرئيسي' : isEn ? 'Primary CTA' : 'CTA principal',
        detectedCtas: isAr ? 'CTA المرصودة' : isEn ? 'Detected CTAs' : 'CTA détectés',
        strongCtas: isAr ? 'CTA القوية' : isEn ? 'Strong CTAs' : 'CTA forts',
        genericCtas: isAr ? 'CTA العامة' : isEn ? 'Generic CTAs' : 'CTA génériques',
        coverage: isAr ? 'تغطية CTA' : isEn ? 'CTA coverage' : 'Couverture CTA',
        wordCount: isAr ? 'عدد الكلمات' : isEn ? 'Word count' : 'Nombre de mots',
        sectionsDetected: isAr ? 'الأقسام المرصودة' : isEn ? 'Detected sections' : 'Sections détectées',
        imagesCount: isAr ? 'الصور' : isEn ? 'Images' : 'Images',
        ctaCount: isAr ? 'عدد CTA' : isEn ? 'CTA count' : 'Nombre de CTA',
        socialProofsCount: isAr ? 'أدلة الثقة' : isEn ? 'Social proofs' : 'Preuves sociales',
        hasSSL: 'SSL',
        hasWhatsApp: 'WhatsApp'
    };
    if (labels[key]) return labels[key];
    return funnelClientLabel(String(key || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'), opts);
}

function renderFunnelLegacyValue(value, opts = {}, depth = 0) {
    if (!funnelLegacyHasData(value) || depth > 3) return '';
    const safe = typeof escapeHtml === 'function' ? escapeHtml : text => String(text || '');
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const text = typeof value === 'boolean'
            ? (opts.isAr ? (value ? 'نعم' : 'لا') : opts.isEn ? (value ? 'Yes' : 'No') : (value ? 'Oui' : 'Non'))
            : String(value);
        return '<p class="funnel-legacy-text" dir="auto">' + safe(text.slice(0, 2400)) + '</p>';
    }
    if (Array.isArray(value)) {
        const rows = value.filter(item => funnelLegacyHasData(item)).slice(0, 10);
        if (!rows.length) return '';
        if (rows.every(item => typeof item !== 'object' || item === null)) {
            return '<ul class="funnel-legacy-list">' + rows.map(item => '<li dir="auto">' + safe(String(item).slice(0, 700)) + '</li>').join('') + '</ul>';
        }
        return '<div class="funnel-legacy-cards">' + rows.map((item, index) => {
            const body = renderFunnelLegacyValue(item, opts, depth + 1);
            return body ? '<article class="funnel-legacy-card"><span>' + safe(String(index + 1).padStart(2, '0')) + '</span>' + body + '</article>' : '';
        }).join('') + '</div>';
    }
    const ignored = /^(?:chainOfThought|rawHtml|html|logs?|debug|scripts?|styles?|svg|promptTokens|completionTokens)$/i;
    const entries = Object.entries(value)
        .filter(([key, item]) => !ignored.test(key) && funnelLegacyHasData(item))
        .slice(0, 14);
    if (!entries.length) return '';
    return '<div class="funnel-legacy-data">' + entries.map(([key, item]) => {
        const body = renderFunnelLegacyValue(item, opts, depth + 1);
        return body ? '<section class="funnel-legacy-row"><small>' + safe(funnelLegacyLabel(key, opts)) + '</small><div>' + body + '</div></section>' : '';
    }).join('') + '</div>';
}

function renderFunnelAidaJourney(value, opts = {}) {
    if (!value || typeof value !== 'object') return renderFunnelLegacyValue(value, opts);
    const safe = typeof escapeHtml === 'function' ? escapeHtml : text => String(text || '');
    const text = (fr, en, ar) => opts.isAr ? ar : opts.isEn ? en : fr;
    const phases = [
        ['attention', text('Attention', 'Attention', 'الانتباه'), 'fa-eye', '#22d3ee'],
        ['interest', text('Intérêt', 'Interest', 'الاهتمام'), 'fa-lightbulb', '#60a5fa'],
        ['desire', text('Désir', 'Desire', 'الرغبة'), 'fa-heart', '#a78bfa'],
        ['action', text('Action', 'Action', 'الإجراء'), 'fa-bolt', '#22c55e']
    ];
    const recommendationPattern = /fix|recommend|improv|suggest|correction|action|solution|recommand|am[ée]lior|اقتراح|توصي|إجراء/i;
    const ignored = /^(?:score|chainOfThought)$/i;
    const renderRows = entries => entries.length
        ? `<div class="funnel-aida-rows">${entries.slice(0, 7).map(([key, item]) => `<div><small>${safe(funnelLegacyLabel(key, opts))}</small>${renderFunnelLegacyValue(item, opts, 1)}</div>`).join('')}</div>`
        : `<p class="funnel-aida-empty">${safe(text('Aucun signal exploitable dans cette réponse.', 'No usable signal in this response.', 'لا توجد إشارة قابلة للاستخدام في هذه الاستجابة.'))}</p>`;
    const cards = phases.map(([key, label, icon, accent]) => {
        const phase = value[key];
        if (!funnelLegacyHasData(phase)) return '';
        const source = phase && typeof phase === 'object' && !Array.isArray(phase) ? phase : { verdict: phase };
        const entries = Object.entries(source).filter(([entryKey, item]) => !ignored.test(entryKey) && funnelLegacyHasData(item));
        const observed = entries.filter(([entryKey]) => !recommendationPattern.test(entryKey));
        const recommended = entries.filter(([entryKey]) => recommendationPattern.test(entryKey));
        const score = Number(source.score);
        const scoreHtml = Number.isFinite(score) ? `<span class="funnel-aida-score"><b>${Math.max(0, Math.min(100, Math.round(score)))}</b>/100</span>` : '';
        return `<article class="funnel-aida-card" style="--aida-accent:${accent}">
            <header><span class="funnel-aida-icon"><i class="fas ${icon}"></i></span><div><small>${safe(text('Étape du parcours', 'Journey stage', 'مرحلة المسار'))}</small><h4>${safe(label)}</h4></div>${scoreHtml}</header>
            <div class="funnel-aida-columns">
                <section><h5><i class="fas fa-magnifying-glass"></i>${safe(text('Observé', 'Observed', 'مرصود'))}</h5>${renderRows(observed)}</section>
                <section class="recommended"><h5><i class="fas fa-wand-magic-sparkles"></i>${safe(text('Recommandé', 'Recommended', 'موصى به'))}</h5>${renderRows(recommended)}</section>
            </div>
        </article>`;
    }).join('');
    return cards ? `<div class="funnel-aida-grid">${cards}</div>` : renderFunnelLegacyValue(value, opts);
}

function renderFunnelVisualIdentity(value, opts = {}) {
    if (!value || typeof value !== 'object') return renderFunnelLegacyValue(value, opts);
    const safe = typeof escapeHtml === 'function' ? escapeHtml : text => String(text || '');
    const text = (fr, en, ar) => opts.isAr ? ar : opts.isEn ? en : fr;
    const palette = value.colorPalette && typeof value.colorPalette === 'object' ? value.colorPalette : {};
    const rawColor = item => String(item?.color || item?.hex || item || '').trim();
    const validColor = item => {
        const color = rawColor(item);
        return /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/]+\))$/i.test(color) ? color : '';
    };
    const candidates = [palette.primary, palette.secondary, palette.accent, palette.background, ...(palette.allDetected || [])]
        .map(validColor)
        .filter(Boolean);
    const colors = [...new Set(candidates.map(color => color.toLowerCase()))].slice(0, 8);
    const roles = [
        text('Primaire observée', 'Observed primary', 'اللون الأساسي المرصود'),
        text('Secondaire observée', 'Observed secondary', 'اللون الثانوي المرصود'),
        text('Accent observé', 'Observed accent', 'لون الإبراز المرصود'),
        text('Fond observé', 'Observed background', 'لون الخلفية المرصود')
    ];
    const paletteHtml = colors.length ? `<section class="funnel-color-section">
        <header><div><small>${safe(text('ADN VISUEL RÉEL', 'REAL VISUAL DNA', 'الهوية البصرية الفعلية'))}</small><h4>${safe(text('Couleurs observées sur la page', 'Colors observed on the page', 'الألوان المرصودة في الصفحة'))}</h4></div><span>${colors.length}</span></header>
        <div class="funnel-color-grid">${colors.map((color, index) => `<article class="funnel-color-swatch">
            <div class="funnel-color-preview" style="background:${safe(color)}"></div>
            <div><small>${safe(roles[index] || text(`Couleur observée ${index + 1}`, `Observed color ${index + 1}`, `لون مرصود ${index + 1}`))}</small><strong>${safe(color.toUpperCase())}</strong></div>
            <button type="button" data-no-collapse="true" title="${safe(text('Copier la couleur', 'Copy color', 'نسخ اللون'))}" aria-label="${safe(text('Copier la couleur', 'Copy color', 'نسخ اللون'))}" onclick="event.stopPropagation();navigator.clipboard?.writeText('${safe(color)}')"><i class="fas fa-copy"></i></button>
        </article>`).join('')}</div>
        <p><i class="fas fa-circle-info"></i>${safe(text('Palette extraite des styles réellement rendus, sans couleur inventée.', 'Palette extracted from rendered styles, with no invented color.', 'تم استخراج اللوحة من الأنماط المعروضة فعليا دون اختراع ألوان.'))}</p>
    </section>` : `<p class="funnel-aida-empty">${safe(text('Aucune couleur fiable observée dans les pages accessibles.', 'No reliable color observed in accessible pages.', 'لم يتم رصد لون موثوق في الصفحات المتاحة.'))}</p>`;
    const remainder = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'colorPalette'));
    const details = funnelLegacyHasData(remainder) ? renderFunnelLegacyValue(remainder, opts) : '';
    return `<div class="funnel-visual-identity">${paletteHtml}${details ? `<section class="funnel-visual-details"><h4>${safe(text('Lecture de la hiérarchie', 'Hierarchy reading', 'قراءة التسلسل البصري'))}</h4>${details}</section>` : ''}</div>`;
}

function renderFunnelPrioritizedActions(value, opts = {}) {
    const safe = typeof escapeHtml === 'function' ? escapeHtml : text => String(text || '');
    const isAr = opts.isAr;
    const isEn = opts.isEn;
    const text = (fr, en, ar) => isAr ? ar : isEn ? en : fr;
    const source = Array.isArray(value) ? value : (value && typeof value === 'object' ? Object.values(value).flat() : [value]);
    const actions = source
        .filter(item => funnelLegacyHasData(item))
        .map((item, index) => {
            const object = item && typeof item === 'object' ? item : { action: item };
            return {
                index: index + 1,
                zone: funnelClientLabel(object.zone || object.section || object.sectionType || object.area || object.title || text('Action', 'Action', 'إجراء'), opts),
                problem: funnelV2Text(object.problemObserved || object.problem || object.issue || object.why || object.observation || object.reason),
                action: funnelV2Text(object.changeNow || object.action || object.fix || object.howTo || object.recommendation || object.task || object.title),
                impact: funnelPriorityLabel(object.impact || object.expectedGain || object.roi, opts),
                effort: funnelPriorityLabel(object.effort || object.timeline || object.delay, opts),
                priority: funnelV2Text(object.priority || object.rank || index + 1, String(index + 1)),
                confidence: funnelPriorityLabel(object.confidence || 'MEDIUM', opts)
            };
        })
        .filter(item => item.action || item.problem)
        .slice(0, 9);
    if (!actions.length) return renderFunnelLegacyValue(value, opts);
    return `<div class="funnel-priority-actions">
        <div class="funnel-priority-lead">
            <small>${safe(text('Plan lisible', 'Readable plan', 'خطة واضحة'))}</small>
            <strong>${safe(text('Chaque carte dit quoi changer, pourquoi et avec quel effort.', 'Each card states what to change, why, and with what effort.', 'كل بطاقة توضح ما يجب تغييره ولماذا وبأي جهد.'))}</strong>
        </div>
        ${actions.map(item => `<article class="funnel-priority-card">
            <div class="funnel-priority-index">${safe(String(item.priority).padStart(2, '0'))}</div>
            <div class="funnel-priority-main">
                <span>${safe(item.zone)}</span>
                ${item.problem ? `<p class="funnel-priority-problem" dir="auto"><b>${safe(text('Constat', 'Observation', 'الملاحظة'))}</b>${safe(item.problem)}</p>` : ''}
                ${item.action ? `<p class="funnel-priority-fix" dir="auto"><b>${safe(text('À faire', 'Change now', 'ما يجب فعله'))}</b>${safe(item.action)}</p>` : ''}
                <div class="funnel-priority-meta">
                    <em>${safe(text('Impact', 'Impact', 'الأثر'))}: ${safe(item.impact)}</em>
                    <em>${safe(text('Effort', 'Effort', 'الجهد'))}: ${safe(item.effort)}</em>
                    <em>${safe(text('Confiance', 'Confidence', 'الثقة'))}: ${safe(item.confidence)}</em>
                </div>
            </div>
        </article>`).join('')}
    </div>`;
}

function buildDakaMegaPromptPackage(rawPrompt, opts = {}) {
    const isAr = opts.isAr;
    const isEn = opts.isEn;
    const data = STATE.lastFunnelResults || {};
    const text = (fr, en, ar) => isAr ? ar : isEn ? en : fr;
    const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
    const toText = value => typeof funnelV2Text === 'function' ? funnelV2Text(value) : String(value || '');
    const stripConflictingRoles = value => String(value || '')
        .replace(/tu es un expert growth engineer[\s\S]{0,260}?(?=(mission|sources|objectif|contexte|$))/ig, '')
        .replace(/you are an expert growth engineer[\s\S]{0,260}?(?=(mission|sources|objective|context|$))/ig, '')
        .replace(/expert growth engineer/ig, 'expert UI/UX, CRO et frontend')
        .replace(/\bSEO\b/g, 'visibilité marché')
        .replace(/articles?\s+SEO/ig, 'pages d’acquisition')
        .replace(/mots-cl[eé]s/ig, 'signaux de demande');
    const clip = (value, max = 900) => {
        const out = clean(value);
        return out.length > max ? `${out.slice(0, max).trim()}...` : out;
    };
    const arr = (...values) => values.flatMap(value => Array.isArray(value) ? value : (value ? [value] : []))
        .map(item => clean(toText(item?.title || item?.action || item?.sectionType || item?.section || item?.text || item)))
        .filter(Boolean);
    const url = data.url || data.targetUrl || data.analyzedUrl || STATE.lastInputs?.funnelUrl || 'URL A COLLER';
    const surgery = data.funnelSectionSurgery || data.sectionSurgery || {};
    const primary = data.funnelPrimaryAnalysis || data.funnelEvidenceSynthesis || {};
    const legacy = data.legacyFunnel || {};
    const offer = surgery.offerDetected || data.offerDetected || {};
    const h1 = offer.h1 || data.h1 || data.siteData?.h1 || 'A confirmer';
    const priceConfidence = String(data.priceIntel?.priceConfidence || data.priceIntel?.confidenceBand || data.priceIntel?.confidence || '').toUpperCase();
    const confirmedPrice = data.priceIntel?.primaryPrice && ['HIGH', 'MEDIUM'].includes(priceConfidence) ? data.priceIntel.primaryPrice : null;
    const price = offer.price || confirmedPrice || 'Prix a confirmer';
    const ctas = arr(data.ctaIntelligence?.detectedCtas, data.copySignals?.ctas, legacy.ctaIntelligence?.detectedCtas).slice(0, 8);
    const present = arr(primary.present, surgery.keep, surgery.presentSections).slice(0, 10);
    const weak = arr(primary.weak, surgery.improve, surgery.weakSections).slice(0, 10);
    const missing = arr(primary.missing, surgery.add, surgery.missingSections).slice(0, 10);
    const actions = arr(data.concreteActionPlan, data.prioritizedActionPlan, legacy.concreteActionPlan, legacy.quickWins).slice(0, 10);
    const proof = arr(primary.proofUsed, data.proofModel?.observed, data.funnelEvidenceSynthesis?.proofUsed).slice(0, 8);
    const offerType = clean(offer.offerType || data.offerType || data.projectIdentity?.offerType || data.projectIdentity?.businessModel || legacy.offerType || '');
    const offerContextText = `${offerType} ${url} ${h1} ${present.join(' ')} ${ctas.join(' ')}`.toLowerCase();
    const isPhysicalProduct = /e-?commerce|shop|boutique|produit|product|panier|cart|checkout|livraison|stock|retour|serum|s[ée]rum|lotion|huile|parapharmacie|cosm[eé]tique/.test(offerContextText);
    const isServiceOffer = !isPhysicalProduct && /service|agence|consulting|formation|saas|software|logiciel|audit|devis|rdv|appointment|livrable|accompagnement/.test(offerContextText);
    const originalPrompt = clip(stripConflictingRoles(rawPrompt), 1800);
    const vocabularyRules = isPhysicalProduct
        ? text(
            '- Vocabulaire adapté : produit, bénéfices, ingrédients/composition, usage, prix, stock, livraison, retour, garantie, avis, preuve produit, sécurité paiement.\n- Interdit ici sauf preuve : livrables, révisions, accompagnement, diagnostic, prestation.',
            '- Use product vocabulary: product, benefits, ingredients/composition, usage, price, stock, delivery, returns, guarantee, reviews, product proof, secure payment.\n- Do not use service vocabulary unless proven: deliverables, revisions, support package, diagnostic, consulting.',
            '- استعمل مفردات المنتج: المنتج، الفوائد، التركيبة، طريقة الاستخدام، السعر، المخزون، التوصيل، الإرجاع، الضمان، الآراء، دليل المنتج، أمان الدفع.\n- لا تستعمل مفردات الخدمات إلا بدليل: مخرجات، مراجعات، مرافقة، تشخيص، استشارة.'
        )
        : isServiceOffer
            ? text(
                '- Vocabulaire adapté : livrables, délais, révisions, conditions de paiement, preuve résultat, cas clients, accompagnement, support.\n- N’utilise pas livraison/retours/stock sauf si la page vend un produit physique.',
                '- Use service vocabulary: deliverables, timeline, revisions, payment terms, result proof, case studies, support.\n- Do not use delivery/returns/stock unless the page sells a physical product.',
                '- استعمل مفردات الخدمة: المخرجات، المدة، المراجعات، شروط الدفع، إثبات النتائج، حالات العملاء، الدعم.\n- لا تستعمل التوصيل والإرجاع والمخزون إلا إذا كانت الصفحة تبيع منتجا ماديا.'
            )
            : text(
                '- Adapte le vocabulaire au modèle réellement observé. Si tu n’es pas sûr, marque “à confirmer”.',
                '- Adapt vocabulary to the actually observed business model. If unsure, mark “to confirm”.',
                '- كيّف المفردات حسب نموذج العمل المرصود فعلا. إذا لم تكن متأكدا، اكتب “يجب التأكيد”.'
            );
    const bullet = list => list.length ? list.map(item => `- ${item}`).join('\n') : '- A confirmer';
    const commonData = `
URL / PAGE :
- ${url}

CONTEXTE DISPONIBLE :
- Objectif : ameliorer ou reconstruire une page HTML/CSS/JS orientee conversion.
- Type d'offre detecte : ${clean(offer.offerType || legacy.auditSummary?.title || 'A confirmer')}
- H1 actuel : ${clean(h1)}
- Prix detecte : ${clean(price)}
- CTA detectes :
${bullet(ctas)}
- Sections presentes a conserver :
${bullet(present)}
- Sections faibles a ameliorer :
${bullet(weak)}
- Sections manquantes a ajouter :
${bullet(missing)}
- Actions prioritaires Daka :
${bullet(actions)}
- Preuves textuelles disponibles :
${bullet(proof)}
- Notes du rapport Daka :
${originalPrompt || '- A confirmer'}

REGLES DE VOCABULAIRE MARCHE :
${vocabularyRules}
`.trim();

    const full = `${text(
`Tu es un expert X10 en UI/UX, CRO, copywriting et frontend HTML/CSS/JS. Ta mission est de m'aider a ameliorer ou reconstruire ma page a partir des preuves Funnel fournies.

CONTEXTE
Je veux une page claire, responsive, credible et orientee conversion. L'utilisateur final n'est pas technique. Tu dois m'aider et me guider par etapes.

DONNEES DISPONIBLES
${commonData}

QUESTIONS DE CLARIFICATION
Avant de coder, analyse les donnees. Si une information manque ou semble contradictoire, pose 3 a 7 questions maximum. Si tout est suffisant, dis "Les donnees sont suffisantes" et passe au plan.

PLAN D'EXECUTION
1. Analyse les preuves fournies.
2. Resume ce qu'il faut garder, ameliorer, ajouter, supprimer ou fusionner.
3. Propose l'ordre ideal de la page.
4. Genere le code par blocs : HTML, puis CSS, puis JS.
5. Si le contexte est limite, ne genere pas tout en une seule reponse. Termine par "Tape GO pour recevoir la suite."
6. Demande confirmation avant un gros changement de structure.

REGLES ANTI-HALLUCINATION
- N'invente pas d'avis clients, notes, resultats, logos, certifications, prix, livraison, garantie ou stock.
- Si une preuve manque, marque clairement "A confirmer".
- Utilise seulement les preuves fournies dans le rapport.
- Si la page est deja forte sur un point, dis-le et garde l'element.
- Ne transforme jamais une recommandation en fait observe.

SI JE VEUX M'INSPIRER D'UNE PAGE CONCURRENTE
- Ne copie pas la marque, les textes exacts, les images privees, le logo ou le code proprietaire.
- Reproduis uniquement la structure UX, la logique des sections et les patterns de conversion.
- Cree une version originale adaptee a mon produit/service.

REGLES DE CODE
- HTML/CSS/JS simple, sans framework sauf demande explicite.
- Mobile-first, aucun scroll horizontal, boutons faciles a cliquer.
- CSS lisible avec classes claires.
- JS minimal : menu mobile, FAQ accordéon, sticky CTA si utile, micro-interactions.
- Pas de dependances lourdes.
- Code facile a coller dans un hebergeur simple.
- Commente les sections importantes.

SECTIONS A GENERER
Hero clair, benefices, preuve sociale, offre/prix, garanties, FAQ, comparaison si utile, urgence/scarcity seulement si prouvee, CTA final, sticky CTA mobile si utile.

METHODE DE LIVRAISON
Reponds en etapes :
1. Diagnostic court.
2. Questions si necessaire.
3. Plan de page.
4. HTML.
5. CSS.
6. JS.
7. Checklist de test mobile.

FORMAT ATTENDU
Donne du code propre et directement exploitable. Si la reponse est trop longue, coupe en parties et attends mon GO.`,
`You are an X10 expert in UI/UX, CRO, direct-response copywriting, and frontend HTML/CSS/JS. Your mission is to help me improve or rebuild my page from the Funnel evidence provided.

CONTEXT
I need a clear, responsive, credible conversion page. The end user is non-technical, so guide me step by step.

AVAILABLE DATA
${commonData}

CLARIFICATION QUESTIONS
First analyze the data. If anything is missing or contradictory, ask 3 to 7 questions maximum. If enough data is available, say "The data is sufficient" and move to the plan.

EXECUTION PLAN
1. Analyze the evidence.
2. Summarize what to keep, improve, add, remove, or merge.
3. Propose the ideal page order.
4. Generate code in blocks: HTML, then CSS, then JS.
5. If context is limited, do not generate everything in one answer. End with "Type GO to receive the next part."
6. Ask for confirmation before large structural changes.

ANTI-HALLUCINATION RULES
- Do not invent reviews, ratings, results, logos, certifications, prices, delivery, guarantees, or stock.
- If proof is missing, mark it as "To confirm".
- Use only the evidence provided.
- If the page is strong on a point, say so and keep it.
- Never present a recommendation as an observed fact.

COMPETITOR INSPIRATION RULES
- Do not copy brand, exact protected text, private images, logo, or proprietary code.
- Recreate only the UX structure, section logic, and conversion patterns.
- Build an original version adapted to my product/service.

CODE RULES
- Simple HTML/CSS/JS, no framework unless requested.
- Mobile-first, no horizontal scroll, easy-to-click buttons.
- Clear CSS classes.
- Minimal JS: mobile menu, FAQ accordion, sticky CTA if useful, micro-interactions.
- No heavy dependencies.
- Easy to paste into basic hosting.
- Comment important sections.

SECTIONS TO GENERATE
Clear hero, benefits, social proof, offer/price, guarantees, FAQ, comparison if useful, urgency/scarcity only if proven, final CTA, mobile sticky CTA if useful.

DELIVERY METHOD
Answer in steps:
1. Short diagnosis.
2. Questions if needed.
3. Page plan.
4. HTML.
5. CSS.
6. JS.
7. Mobile test checklist.

EXPECTED OUTPUT
Give clean usable code. If the answer is too long, split into parts and wait for my GO.`,
`أنت خبير X10 في UI/UX وCRO وكتابة الإقناع وHTML/CSS/JS. مهمتك مساعدتي على تحسين أو إعادة بناء صفحتي اعتمادا على أدلة Funnel المقدمة.

السياق
أحتاج صفحة واضحة، متجاوبة، موثوقة وموجهة للتحويل. المستخدم غير تقني، لذلك أرشدني خطوة بخطوة.

البيانات المتاحة
${commonData}

أسئلة التوضيح
حلل البيانات أولا. إذا كانت معلومة ناقصة أو متناقضة، اطرح من 3 إلى 7 أسئلة فقط. إذا كانت البيانات كافية، قل "البيانات كافية" ثم انتقل إلى الخطة.

خطة التنفيذ
1. حلل الأدلة.
2. لخص ما يجب الحفاظ عليه أو تحسينه أو إضافته أو حذفه أو دمجه.
3. اقترح الترتيب المثالي للصفحة.
4. أنشئ الكود على دفعات: HTML ثم CSS ثم JS.
5. إذا كان السياق محدودا، لا تولد كل شيء في رد واحد. اختم بعبارة "اكتب GO للحصول على الجزء التالي."
6. اطلب التأكيد قبل تغيير كبير في الهيكل.

قواعد منع الهلوسة
- لا تخترع آراء أو تقييمات أو نتائج أو شعارات أو شهادات أو أسعارا أو توصيلا أو ضمانات أو مخزونا.
- إذا كان الدليل ناقصا اكتب "يجب التأكيد".
- استخدم الأدلة المقدمة فقط.
- إذا كانت الصفحة قوية في نقطة ما فاذكر ذلك وحافظ عليها.
- لا تقدم التوصية كحقيقة مرصودة.

قواعد الاستلهام من منافس
- لا تنسخ العلامة أو النصوص المحمية أو الصور الخاصة أو الشعار أو الكود المملوك.
- استلهم فقط بنية UX ومنطق الأقسام وأنماط التحويل.
- أنشئ نسخة أصلية مناسبة لمنتجي أو خدمتي.

قواعد الكود
- HTML/CSS/JS بسيط دون إطار عمل إلا إذا طلبت ذلك.
- Mobile-first، دون تمرير أفقي، وأزرار سهلة النقر.
- أسماء CSS واضحة.
- JS قليل ومفيد: قائمة الهاتف، FAQ، CTA ثابت عند الحاجة، تفاعلات خفيفة.
- لا تعتمد على مكتبات ثقيلة.
- سهل اللصق في استضافة بسيطة.

الأقسام المطلوبة
Hero واضح، فوائد، دليل اجتماعي، عرض/سعر، ضمانات، FAQ، مقارنة عند الحاجة، ندرة فقط إذا كانت مثبتة، CTA نهائي، CTA ثابت للهاتف عند الحاجة.

طريقة التسليم
أجب بالترتيب:
1. تشخيص قصير.
2. أسئلة عند الحاجة.
3. خطة الصفحة.
4. HTML.
5. CSS.
6. JS.
7. قائمة اختبار للهاتف.

المخرجات
قدم كودا نظيفا قابلا للاستخدام. إذا كان الرد طويلا، قسمه وانتظر GO.`
)}`.trim();

    const short = `${text(
`Tu es un expert X10 UI/UX + CRO + HTML/CSS/JS. Ameliore ou reconstruis ma page avec les preuves ci-dessous. Commence par verifier les donnees, puis pose 3 a 7 questions si quelque chose manque. Si c'est suffisant, propose un plan puis code par blocs.

DONNEES
${commonData}

REGLES
- Ne pas inventer avis, prix, garanties, livraison, resultats, logos ou certifications.
- Marquer "A confirmer" si une preuve manque.
- Garder uniquement ce qui est prouve.
- Si modele limite : donne HTML puis attends GO, ensuite CSS, ensuite JS.
- Code simple, responsive mobile-first, sans framework, sans dependance lourde.
- Si inspiration concurrente : ne copie ni marque, ni texte exact, ni image privee, ni code proprietaire.

SORTIE
1. Diagnostic court.
2. Questions si necessaire.
3. Ordre des sections.
4. HTML.
5. CSS.
6. JS.
7. Tests mobile.`,
`You are an X10 UI/UX + CRO + HTML/CSS/JS expert. Improve or rebuild my page using the evidence below. First check the data, then ask 3 to 7 questions if anything is missing. If enough, propose a plan and code in blocks.

DATA
${commonData}

RULES
- Do not invent reviews, prices, guarantees, delivery, results, logos, or certifications.
- Mark missing proof as "To confirm".
- Keep only proven elements.
- If the model is limited: give HTML, wait for GO, then CSS, then JS.
- Simple mobile-first responsive code, no framework, no heavy dependency.
- If inspired by a competitor: copy no brand, exact text, private image, or proprietary code.

OUTPUT
1. Short diagnosis.
2. Questions if needed.
3. Section order.
4. HTML.
5. CSS.
6. JS.
7. Mobile tests.`,
`أنت خبير X10 في UI/UX وCRO وHTML/CSS/JS. حسّن أو أعد بناء الصفحة اعتمادا على الأدلة أدناه. افحص البيانات أولا ثم اطرح 3 إلى 7 أسئلة إذا نقص شيء. إذا كانت كافية، قدم خطة ثم الكود على دفعات.

البيانات
${commonData}

القواعد
- لا تخترع آراء أو أسعارا أو ضمانات أو توصيلا أو نتائج أو شعارات أو شهادات.
- اكتب "يجب التأكيد" عند نقص الدليل.
- حافظ فقط على العناصر المثبتة.
- إذا كان النموذج محدودا: أعط HTML ثم انتظر GO ثم CSS ثم JS.
- كود بسيط متجاوب، دون إطار عمل أو تبعيات ثقيلة.
- عند الاستلهام من منافس: لا تنسخ العلامة أو النص أو الصور أو الكود.

المخرجات
1. تشخيص قصير.
2. أسئلة عند الحاجة.
3. ترتيب الأقسام.
4. HTML.
5. CSS.
6. JS.
7. اختبار الهاتف.`
)}`.trim();

    const htmlOnly = `${text('Genere uniquement le HTML semantique mobile-first pour cette page. Ne donne pas le CSS ni le JS maintenant. Utilise les preuves suivantes et marque les donnees manquantes "A confirmer".', 'Generate only the mobile-first semantic HTML for this page. Do not output CSS or JS yet. Use the following evidence and mark missing data as "To confirm".', 'أنشئ HTML فقط للصفحة بشكل semantic وmobile-first. لا تكتب CSS أو JS الآن. استخدم الأدلة التالية واكتب "يجب التأكيد" عند نقص البيانات.')}\n\n${commonData}`;
    const cssOnly = `${text('Genere uniquement le CSS premium mobile-first pour le HTML de cette page. Aucun framework, aucune dependance lourde, aucun scroll horizontal. Structure les styles par section.', 'Generate only premium mobile-first CSS for this page HTML. No framework, no heavy dependency, no horizontal scroll. Organize styles by section.', 'أنشئ CSS فقط بتصميم premium وmobile-first. دون إطار عمل أو تبعيات ثقيلة أو تمرير أفقي. نظم الأنماط حسب الأقسام.')}\n\n${commonData}`;
    const jsOnly = `${text('Genere uniquement le JavaScript utile pour cette page : menu mobile, FAQ accordéon, sticky CTA mobile si pertinent, micro-interactions. Pas de tracking agressif, aucune erreur console.', 'Generate only useful JavaScript: mobile menu, FAQ accordion, mobile sticky CTA if relevant, micro-interactions. No aggressive tracking, no console errors.', 'أنشئ JavaScript المفيد فقط: قائمة الهاتف، FAQ، CTA ثابت للهاتف عند الحاجة، وتفاعلات خفيفة. دون تتبع مزعج ودون أخطاء console.')}\n\n${commonData}`;
    const questions = `${text('Avant de coder, pose ces questions si les reponses ne sont pas dans les donnees :', 'Before coding, ask these questions if answers are not in the data:', 'قبل كتابة الكود، اطرح هذه الأسئلة إذا لم تكن الإجابات موجودة في البيانات:')}
1. ${text('Quel est l’objectif principal : achat, lead, appel, WhatsApp, demo ?', 'What is the main goal: purchase, lead, call, WhatsApp, demo?', 'ما الهدف الرئيسي: شراء، عميل محتمل، مكالمة، واتساب، تجربة؟')}
2. ${text('Quelle langue exacte doit utiliser la page ?', 'What exact language should the page use?', 'ما اللغة الدقيقة للصفحة؟')}
3. ${text('Quel prix ou pack est confirme ?', 'Which price or package is confirmed?', 'ما السعر أو الباقة المؤكدة؟')}
4. ${text('Quelles preuves sont reelles : avis, photos, garanties, livraison, resultats ?', 'Which proof is real: reviews, photos, guarantees, delivery, results?', 'ما الأدلة الحقيقية: آراء، صور، ضمانات، تسليم، نتائج؟')}
5. ${text('Quelles contraintes design ou marque faut-il respecter ?', 'What design or brand constraints must be respected?', 'ما قيود التصميم أو العلامة التي يجب احترامها؟')}`;
    return { full, short, htmlOnly, cssOnly, jsOnly, questions };
}

function renderMegaRedesignPromptBlock(value, opts = {}) {
    const safe = typeof escapeHtml === 'function' ? escapeHtml : text => String(text || '');
    const isAr = opts.isAr;
    const isEn = opts.isEn;
    const labels = {
        full: isAr ? 'نسخ البرومبت الكامل' : isEn ? 'Copy full Mega Prompt' : 'Copier Mega Prompt complet',
        short: isAr ? 'نسخ النسخة القصيرة' : isEn ? 'Copy free trial short prompt' : 'Copier version courte free trial',
        html: isAr ? 'نسخ HTML فقط' : isEn ? 'Copy HTML only' : 'Copier prompt HTML seulement',
        css: isAr ? 'نسخ CSS فقط' : isEn ? 'Copy CSS only' : 'Copier prompt CSS seulement',
        js: isAr ? 'نسخ JS فقط' : isEn ? 'Copy JS only' : 'Copier prompt JS seulement',
        q: isAr ? 'نسخ الأسئلة' : isEn ? 'Copy clarification questions' : 'Copier questions de clarification',
        toggle: isAr ? 'Déplier / replier le prompt' : isEn ? 'Expand / collapse prompt' : 'Déplier / replier le prompt'
    };
    const help = isAr
        ? 'برومبت عملي قابل للنسخ لنماذج الكود والتصميم، مع قواعد تمنع اختراع الأدلة.'
        : isEn ? 'A practical prompt for external code/design AIs, structured to avoid hallucinated proof.'
        : 'Un vrai prompt de travail pour IA de code/design, structuré pour éviter les preuves inventées.';
    const raw = String(value || '');
    const pack = buildDakaMegaPromptPackage(raw, opts);
    const suffix = Math.random().toString(36).slice(2, 8);
    const ids = {
        full: `funnelMegaPromptFull_${suffix}`,
        short: `funnelMegaPromptShort_${suffix}`,
        html: `funnelMegaPromptHtml_${suffix}`,
        css: `funnelMegaPromptCss_${suffix}`,
        js: `funnelMegaPromptJs_${suffix}`,
        q: `funnelMegaPromptQuestions_${suffix}`
    };
    const builderIds = {
        custom: `groqCodeBuilderCustom_${suffix}`,
        output: `groqCodeBuilderOutput_${suffix}`,
        preview: `groqCodeBuilderPreview_${suffix}`,
        previewEmpty: `groqCodeBuilderPreviewEmpty_${suffix}`,
        quota: `groqCodeBuilderQuota_${suffix}`,
        chat: `groqCodeBuilderChat_${suffix}`,
        chatInput: `groqCodeBuilderChatInput_${suffix}`,
        model: `openRouterModel_${suffix}`
    };
    const promptByKey = {
        full: pack.full,
        short: pack.short,
        html: pack.htmlOnly,
        css: pack.cssOnly,
        js: pack.jsOnly,
        q: pack.questions
    };
    const hiddenSources = Object.entries(ids).map(([key, id]) =>
        `<textarea id="${id}" class="mega-copy-source">${safe(promptByKey[key] || '')}</textarea>`
    ).join('');
    const builderLabels = {
        title: isAr ? 'Daka AI Code Machine' : isEn ? 'Daka AI Code Machine' : 'Daka AI Code Machine',
        sub: isAr ? 'استخدم مفتاح OpenRouter المتصل لتوليد كود داخل Daka.' : isEn ? 'Use your connected OpenRouter key to generate code inside Daka.' : 'Utilise ta clé OpenRouter connectée pour générer du code directement dans Daka.',
        note: isAr ? 'Describe the app, market, offer, CTA, trust, colors...' : isEn ? 'Describe what to build: market, offer, CTA, trust, colors, constraints...' : 'D?cris ce que tu veux construire : march?, offre, CTA, confiance, couleurs, contraintes...',
        full: isAr ? 'توليد صفحة كاملة' : isEn ? 'Generate full page' : 'Générer page HTML complète',
        html: isAr ? 'توليد HTML' : isEn ? 'Generate HTML' : 'Générer HTML seul',
        css: isAr ? 'توليد CSS' : isEn ? 'Generate CSS' : 'Générer CSS seul',
        js: isAr ? 'توليد JS' : isEn ? 'Generate JS' : 'Générer JS seul',
        result: isAr ? 'Generated code' : isEn ? 'Generated code' : 'Code g?n?r?',
        preview: isAr ? 'معاينة مباشرة' : isEn ? 'Live preview' : 'Aperçu live',
        refreshPreview: isAr ? 'تحديث المعاينة' : isEn ? 'Refresh preview' : 'Actualiser aperçu',
        copy: isAr ? 'نسخ النتيجة' : isEn ? 'Copy result' : 'Copier le résultat',
        waiting: isAr ? 'اختر نوع الكود ثم اضغط على توليد.' : isEn ? 'Choose a code type, then generate.' : 'Choisis un type de code, puis lance la génération.',
        previewWaiting: isAr ? 'ولّد صفحة HTML كاملة لرؤية المعاينة هنا.' : isEn ? 'Generate a full HTML page to see the preview here.' : 'Génère une page HTML complète pour voir l’aperçu ici.',
        quotaReq: isAr ? 'الطلبات المتبقية' : isEn ? 'Requests left' : 'Requêtes restantes',
        quotaTokens: isAr ? 'التوكنات المتبقية' : isEn ? 'Tokens left' : 'Tokens restants',
        quotaReset: isAr ? 'إعادة الضبط' : isEn ? 'Reset' : 'Reset',
        quotaWaiting: isAr ? 'يظهر بعد أول توليد' : isEn ? 'Shown after first generation' : 'Visible après la première génération',
        chat: isAr ? 'Builder chat' : isEn ? 'Builder chat' : 'Chat de construction',
        chatIntro: isAr ? 'اسأل عن تعديل، قسم أقوى، أو تبسيط الكود الناتج.' : isEn ? 'Ask for a change, a stronger section, or simpler generated code.' : 'Pose une question, demande une variante ou fais modifier le code généré.',
        chatPlaceholder: isAr ? 'مثال: اجعل الهيرو أقوى وأعطني HTML/CSS فقط...' : isEn ? 'Example: make the hero stronger and return only HTML/CSS...' : 'Exemple : rends le hero plus premium et donne seulement HTML/CSS...',
        send: isAr ? 'إرسال' : isEn ? 'Send' : 'Envoyer',
        step1: isAr ? '1. Prompt' : isEn ? '1. Prompt' : '1. Prompt',
        step2: isAr ? '2. Build' : isEn ? '2. Build' : '2. Build',
        step3: isAr ? '3. Preview' : isEn ? '3. Preview' : '3. Aperçu',
        step4: isAr ? '4. Iterate' : isEn ? '4. Iterate' : '4. Itérer',
        quickHero: isAr ? 'Hero أقوى' : isEn ? 'Stronger hero' : 'Hero plus fort',
        quickMobile: isAr ? 'Mobile premium' : isEn ? 'Premium mobile' : 'Mobile premium',
        quickTrust: isAr ? 'إضافة الثقة' : isEn ? 'Add trust' : 'Ajouter confiance',
        quickShort: isAr ? 'اختصر الكود' : isEn ? 'Shorten code' : 'Raccourcir le code'
    };
    return `<div class="funnel-mega-redesign">
        <header>
            <div><small>Mega AI Redesign Prompt</small><strong>${safe(help)}</strong></div>
            <button type="button" data-no-collapse="true" onclick="event.stopPropagation();copyToClipboard('${ids.full}', this)">
                <i class="fas fa-copy"></i><span>${safe(labels.full)}</span>
            </button>
        </header>
        <div class="mega-copy-grid mega-copy-grid-single" data-no-collapse="true" onclick="event.stopPropagation()">
            <span><i class="fas fa-shield-halved"></i>${safe(isAr ? 'نسخة واحدة نظيفة، بلا تكرار' : isEn ? 'One clean prompt, no duplicates' : 'Un seul prompt propre, sans doublons')}</span>
            <span><i class="fas fa-code"></i>${safe(isAr ? 'جاهز للكود HTML/CSS/JS' : isEn ? 'Ready for HTML/CSS/JS code' : 'Prêt pour coder HTML/CSS/JS')}</span>
            <span><i class="fas fa-eye"></i>${safe(isAr ? 'يعتمد فقط على الأدلة' : isEn ? 'Evidence-based only' : 'Basé uniquement sur les preuves')}</span>
        </div>
        <section class="groq-code-builder" data-no-collapse="true" onclick="event.stopPropagation()">
            <header>
                <div><small>${safe(builderLabels.title)}</small><strong>${safe(builderLabels.sub)}</strong></div>
                <button type="button" data-no-collapse="true" onclick="event.stopPropagation();openOpenRouterKeyModal()">
                    <i class="fas fa-key"></i><span>OpenRouter</span>
                </button>
            </header>
            <div id="${builderIds.quota}" class="groq-quota-strip" data-no-collapse="true">
                <div><small>${safe(builderLabels.quotaReq)}</small><strong>—</strong></div>
                <div><small>${safe(builderLabels.quotaTokens)}</small><strong>—</strong></div>
                <div><small>${safe(builderLabels.quotaReset)}</small><strong>${safe(builderLabels.quotaWaiting)}</strong></div>
            </div>
            <div class="groq-machine-steps" data-no-collapse="true">
                <span>${safe(builderLabels.step1)}</span>
                <span>${safe(builderLabels.step2)}</span>
                <span>${safe(builderLabels.step3)}</span>
                <span>${safe(builderLabels.step4)}</span>
            </div>

            <label class="groq-model-row" data-no-collapse="true" onclick="event.stopPropagation()">
                <span>${safe(isAr ? 'OpenRouter model' : isEn ? 'OpenRouter model' : 'Modele OpenRouter')}</span>
                <select id="${builderIds.model}" data-no-collapse="true">
                    <option value="cohere/north-mini-code">Cohere North Mini Code (free)</option>
                    <option value="z-ai/glm-5.2">Z.ai GLM 5.2 (free)</option>
                    <option value="nvidia/nemotron-3-ultra:free">NVIDIA Nemotron 3 Ultra (free)</option>
                    <option value="moonshotai/kimi-k2.7-code">Kimi K2.7 Code</option>
                    <option value="qwen/qwen3.7-plus">Qwen3.7 Plus</option>
                </select>
            </label>
            <div class="groq-builder-quick" data-no-collapse="true">
                <button type="button" data-no-collapse="true" onclick="event.stopPropagation();setOpenRouterBuilderInstruction('${builderIds.custom}', this.textContent)">${safe(builderLabels.quickHero)}</button>
                <button type="button" data-no-collapse="true" onclick="event.stopPropagation();setOpenRouterBuilderInstruction('${builderIds.custom}', this.textContent)">${safe(builderLabels.quickMobile)}</button>
                <button type="button" data-no-collapse="true" onclick="event.stopPropagation();setOpenRouterBuilderInstruction('${builderIds.custom}', this.textContent)">${safe(builderLabels.quickTrust)}</button>
                <button type="button" data-no-collapse="true" onclick="event.stopPropagation();setOpenRouterBuilderInstruction('${builderIds.custom}', this.textContent)">${safe(builderLabels.quickShort)}</button>
            </div>
            <textarea id="${builderIds.custom}" class="groq-builder-note" data-no-collapse="true" placeholder="${safe(builderLabels.note)}"></textarea>
            <div class="groq-builder-actions">
                <button type="button" class="primary" data-no-collapse="true" onclick="event.stopPropagation();runOpenRouterCodeBuilder('full','${ids.full}','${builderIds.output}','${builderIds.custom}','${builderIds.quota}','${builderIds.preview}','${builderIds.previewEmpty}',this,'${builderIds.model}')"><i class="fas fa-wand-magic-sparkles"></i>${safe(builderLabels.full)}</button>
                <button type="button" data-no-collapse="true" onclick="event.stopPropagation();runOpenRouterCodeBuilder('html','${ids.html}','${builderIds.output}','${builderIds.custom}','${builderIds.quota}','${builderIds.preview}','${builderIds.previewEmpty}',this,'${builderIds.model}')"><i class="fab fa-html5"></i>${safe(builderLabels.html)}</button>
                <button type="button" data-no-collapse="true" onclick="event.stopPropagation();runOpenRouterCodeBuilder('css','${ids.css}','${builderIds.output}','${builderIds.custom}','${builderIds.quota}','${builderIds.preview}','${builderIds.previewEmpty}',this,'${builderIds.model}')"><i class="fab fa-css3-alt"></i>${safe(builderLabels.css)}</button>
                <button type="button" data-no-collapse="true" onclick="event.stopPropagation();runOpenRouterCodeBuilder('js','${ids.js}','${builderIds.output}','${builderIds.custom}','${builderIds.quota}','${builderIds.preview}','${builderIds.previewEmpty}',this,'${builderIds.model}')"><i class="fab fa-js"></i>${safe(builderLabels.js)}</button>
            </div>
            <div class="groq-workbench-grid">
                <div class="groq-builder-output-wrap">
                    <div class="groq-builder-output-head">
                        <span>${safe(builderLabels.result)}</span>
                        <button type="button" data-no-collapse="true" onclick="event.stopPropagation();copyToClipboard('${builderIds.output}', this)"><i class="fas fa-copy"></i>${safe(builderLabels.copy)}</button>
                    </div>
                    <pre id="${builderIds.output}" class="groq-builder-output" dir="ltr">${safe(builderLabels.waiting)}</pre>
                </div>
                <div class="groq-builder-output-wrap">
                    <div class="groq-builder-output-head">
                        <span>${safe(builderLabels.preview)}</span>
                        <button type="button" data-no-collapse="true" onclick="event.stopPropagation();renderOpenRouterCodePreview('${builderIds.output}','${builderIds.preview}','${builderIds.previewEmpty}')"><i class="fas fa-eye"></i>${safe(builderLabels.refreshPreview)}</button>
                    </div>
                    <div id="${builderIds.previewEmpty}" class="groq-preview-empty">${safe(builderLabels.previewWaiting)}</div>
                    <iframe id="${builderIds.preview}" class="groq-preview-frame" title="Daka AI preview" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" style="display:none"></iframe>
                </div>
            </div>
            <div class="groq-chat-panel" data-no-collapse="true" onclick="event.stopPropagation()">
                <div class="groq-builder-output-head">
                    <span>${safe(builderLabels.chat)}</span>
                </div>
                <div id="${builderIds.chat}" class="groq-chat-log">
                    <div class="groq-chat-message assistant">${safe(builderLabels.chatIntro)}</div>
                </div>
                <div class="groq-chat-input-row">
                    <textarea id="${builderIds.chatInput}" data-no-collapse="true" placeholder="${safe(builderLabels.chatPlaceholder)}"></textarea>
                    <button type="button" data-no-collapse="true" onclick="event.stopPropagation();sendOpenRouterCodeBuilderMessage('${ids.short}','${builderIds.output}','${builderIds.chat}','${builderIds.chatInput}','${builderIds.quota}','${builderIds.preview}','${builderIds.previewEmpty}',this,'${builderIds.model}')"><i class="fas fa-paper-plane"></i>${safe(builderLabels.send)}</button>
                </div>
            </div>
        </section>
        <details class="mega-prompt-shell" open data-no-collapse="true">
            <summary data-no-collapse="true" onclick="event.stopPropagation()"><span>${safe(labels.toggle)}</span><i class="fas fa-chevron-down"></i></summary>
            <pre class="funnel-mega-prompt" dir="auto">${safe(pack.full.slice(0, 26000))}</pre>
        </details>
        ${hiddenSources}
    </div>`;
}

function renderFunnelLegacyModules(data = {}, opts = {}) {
    const isAr = opts.isAr;
    const isEn = opts.isEn;
    const legacy = data.legacyFunnel || data.legacyFunnelAnalysis || {};
    const expert = data.funnelExpertAnalysis || legacy.funnelExpertAnalysis || {};
    const select = (...values) => values.find(value => funnelLegacyHasData(value));
    const text = (fr, en, ar) => isAr ? ar : isEn ? en : fr;
    const finance = {
        pricing: select(data.pricingPsychology, legacy.pricingPsychology, expert.offerAndValue),
        financialProjection: select(data.financialProjection, legacy.financialProjection),
        priceIntel: select(data.priceIntel, legacy.priceIntel),
        ctaIntelligence: select(data.ctaIntelligence, legacy.ctaIntelligence, expert.ctaIntelligence)
    };
    const copyIntel = {
        signals: select(data.copySignals, legacy.copySignals, expert.copySignals),
        recommendations: select(data.copywritingDeep, legacy.copywritingDeep),
        readyToUseCopy: select(data.readyToUseCopy, legacy.readyToUseCopy, expert.readyToUseCopy)
    };
    const trustMobile = select(expert.additionalAnalyses, legacy.funnelExpertAnalysis?.additionalAnalyses);
    const observedEvidence = [
        ...(data.funnelPrimaryAnalysis?.present || []),
        ...(data.funnelEvidenceSynthesis?.present || [])
    ];
    const socialProofObserved = observedEvidence.some(item => /testimonial|review|rating|avis|t[ée]moignage|social.?proof|تقييم|آراء|مراجعات|شهادات/i.test(
        funnelV2Text(item?.sectionType || item?.section || item?.name || item)
    ));
    const reconcileHistoricalSocialProof = value => {
        if (!socialProofObserved) return value;
        const replacement = text(
            'Preuve sociale observée. Recommandation : rapprocher un témoignage vérifiable de l’offre et du CTA.',
            'Social proof observed. Recommendation: move one verified testimonial closer to the offer and CTA.',
            'تم رصد دليل اجتماعي. التوصية: تقريب شهادة عميل موثوقة من العرض وCTA.'
        );
        const absencePattern = /(?:aucun(?:e)?|absence|absent(?:e)?|sans|non\s+d[ée]tect[ée]e?|no|missing|لا\s*(?:يوجد|توجد|وجود)).{0,55}(?:preuve\s*sociale|avis|t[ée]moignages?|social\s*proof|reviews?|testimonials?|تقييمات|آراء|مراجعات|شهادات)/i;
        if (typeof value === 'string') return absencePattern.test(value) ? replacement : value;
        if (Array.isArray(value)) return value.map(reconcileHistoricalSocialProof);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reconcileHistoricalSocialProof(item)]));
        return value;
    };
    const modules = [
        {
            key: 'aida-journey', icon: 'fa-route',
            title: text('Funnel AIDA et parcours de conversion', 'AIDA funnel and conversion journey', 'مسار AIDA والتحويل'),
            subtitle: text('Attention, intérêt, désir et action confrontés aux preuves de la page.', 'Attention, interest, desire and action mapped to page evidence.', 'تحليل الانتباه والاهتمام والرغبة والإجراء حسب أدلة الصفحة.'),
            value: reconcileHistoricalSocialProof(select(data.aidaAnalysis, legacy.aidaAnalysis, data.funnelMapping, legacy.funnelMapping, expert.journey))
        },
        {
            key: 'customer-psychology', icon: 'fa-brain',
            title: text('Psychologie client, objections et freins', 'Customer psychology, objections and blockers', 'سيكولوجية العميل والاعتراضات والعوائق'),
            subtitle: text('Ce qui rassure, ce qui crée le doute et ce qui retarde la décision.', 'What reassures, creates doubt, or delays the decision.', 'ما يطمئن العميل وما يخلق الشك أو يؤخر القرار.'),
            value: select(data.neuromarketing, legacy.neuromarketing, expert.customerPsychology, data.psychTriggers, legacy.psychTriggers)
        },
        {
            key: 'funnel-score', icon: 'fa-gauge-high',
            title: text('Score stratégique Funnel', 'Strategic Funnel score', 'النتيجة الاستراتيجية لمسار التحويل'),
            subtitle: text('Lecture synthétique de la préparation à convertir, avec ses facteurs.', 'Conversion readiness with the factors behind the score.', 'جاهزية الصفحة للتحويل والعوامل المؤثرة في النتيجة.'),
            value: select(data.globalScoring, legacy.globalScoring, expert.readinessScore, data.auditScorecard, legacy.auditScorecard)
        },
        {
            key: 'financial-cta', icon: 'fa-coins',
            title: text('Intelligence financière, offre et CTA', 'Financial, offer and CTA intelligence', 'ذكاء السعر والعرض وCTA'),
            subtitle: text('Prix observé, valeur perçue, bundles et qualité du chemin d’action.', 'Observed price, perceived value, bundles and action-path quality.', 'السعر المرصود والقيمة والباقات وجودة مسار الإجراء.'),
            value: finance
        },
        {
            key: 'strategic-blueprint', icon: 'fa-compass-drafting',
            title: text('Blueprint stratégique', 'Strategic blueprint', 'المخطط الاستراتيجي'),
            subtitle: text('Quoi garder, améliorer, déplacer, ajouter ou supprimer.', 'What to keep, improve, move, add, or remove.', 'ما يجب الحفاظ عليه أو تحسينه أو نقله أو إضافته أو حذفه.'),
            value: select(data.strategicBlueprint, legacy.strategicBlueprint, expert.attackAngles, data.pageArchitecture, legacy.pageArchitecture)
        },
        {
            key: 'visual-identity', icon: 'fa-palette',
            title: text('Identité visuelle et hiérarchie', 'Visual identity and hierarchy', 'الهوية البصرية والتسلسل المرئي'),
            subtitle: text('Lisibilité, cohérence, couleurs, densité et capacité à guider le regard.', 'Readability, consistency, color, density, and visual guidance.', 'الوضوح والاتساق والألوان وقدرة التصميم على توجيه النظر.'),
            value: select(data.webCharte, legacy.webCharte, expert.visualIdentity)
        },
        {
            key: 'technical-signals', icon: 'fa-microchip',
            title: text('Analyse technique orientée conversion', 'Conversion-focused technical analysis', 'التحليل التقني الموجه للتحويل'),
            subtitle: text('Performance, stabilité, sécurité et obstacles techniques observés.', 'Performance, stability, security, and observed technical blockers.', 'الأداء والاستقرار والأمان والعوائق التقنية المرصودة.'),
            value: select(data.technicalAudit, legacy.technicalAudit, expert.technicalSignals, data.performanceSignals, legacy.performanceSignals)
        },
        {
            key: 'copy-signals', icon: 'fa-quote-left',
            title: text('Signaux textuels et copywriting', 'Copy signals and messaging', 'إشارات النص والرسائل'),
            subtitle: text('CTA, promesse, PAS, AIDA, bénéfices et cohérence du message.', 'CTAs, promise, PAS, AIDA, benefits, and message consistency.', 'CTA والوعد وPAS وAIDA والفوائد واتساق الرسالة.'),
            value: copyIntel
        },
        {
            key: 'page-metrics', icon: 'fa-chart-column',
            title: text('Métriques de page', 'Page metrics', 'مقاييس الصفحة'),
            subtitle: text('Volume de contenu, sections, médias, CTA et preuves mesurés.', 'Measured content, sections, media, CTAs, and proof.', 'قياس المحتوى والأقسام والوسائط وCTA وأدلة الثقة.'),
            value: select(data.pageMetrics, legacy.pageMetrics, expert.pageMetrics, data.aarrMetrics, legacy.aarrMetrics)
        },
        {
            key: 'attack-opportunities', icon: 'fa-crosshairs',
            title: text('Angles d’attaque et opportunités', 'Attack angles and opportunities', 'زوايا الهجوم والفرص'),
            subtitle: text('Les leviers différenciants à tester sans présenter une hypothèse comme un fait.', 'Differentiation levers to test without presenting hypotheses as facts.', 'رافعات التميز التي يجب اختبارها دون تقديم الفرضيات كحقائق.'),
            value: select(data.attackAngles, legacy.attackAngles, expert.attackAngles, data.quickWins, legacy.quickWins)
        },
        {
            key: 'ready-copy', icon: 'fa-pen-ruler',
            title: text('Copywriting prêt à utiliser', 'Ready-to-use copywriting', 'نصوص جاهزة للاستخدام'),
            subtitle: text('Titres, CTA, microcopy et blocs de réassurance directement exploitables.', 'Headlines, CTAs, microcopy, and reassurance blocks ready to use.', 'عناوين وCTA ونصوص طمأنة جاهزة للاستخدام.'),
            value: copyIntel.readyToUseCopy
        },
        {
            key: 'trust-mobile', icon: 'fa-shield-heart',
            title: text('Confiance, mobile et risques de décision', 'Trust, mobile, and decision risks', 'الثقة وتجربة الهاتف ومخاطر القرار'),
            subtitle: text('Preuves, objections, expérience mobile et fiabilité des conclusions.', 'Proof, objections, mobile experience, and conclusion reliability.', 'الأدلة والاعتراضات وتجربة الهاتف وموثوقية الاستنتاجات.'),
            value: trustMobile
        },
        {
            key: 'prioritized-actions', icon: 'fa-list-check',
            title: text('Plan d’action priorisé', 'Prioritized action plan', 'خطة العمل حسب الأولوية'),
            subtitle: text('Actions ordonnées par impact, effort et horizon d’exécution.', 'Actions ordered by impact, effort, and execution horizon.', 'إجراءات مرتبة حسب الأثر والجهد والأفق الزمني.'),
            value: select(data.concreteActionPlan, legacy.concreteActionPlan, data.prioritizedActionPlan, legacy.prioritizedActionPlan, expert.prioritizedPlan)
        },
        {
            key: 'mega-redesign', icon: 'fa-wand-magic-sparkles',
            title: text('Mega AI Redesign Prompt', 'Mega AI Redesign Prompt', 'أمر إعادة التصميم الشامل بالذكاء الاصطناعي'),
            subtitle: text('Brief final structuré pour reconstruire la page sans perdre les preuves.', 'Structured final brief to rebuild the page without losing evidence.', 'موجّه نهائي منظم لإعادة بناء الصفحة دون فقدان الأدلة.'),
            value: select(data.aiRewritePrompt, legacy.megaRedesignPrompt, legacy.aiRewritePrompt)
        }
    ];

    return modules
        .filter(module => funnelLegacyHasData(module.value))
        .map(module => {
            const isPrompt = module.key === 'mega-redesign';
            const body = isPrompt
                ? renderMegaRedesignPromptBlock(module.value, { isAr, isEn })
                : module.key === 'prioritized-actions'
                    ? renderFunnelPrioritizedActions(module.value, { isAr, isEn })
                : module.key === 'aida-journey'
                    ? renderFunnelAidaJourney(module.value, { isAr, isEn })
                    : module.key === 'visual-identity'
                        ? renderFunnelVisualIdentity(module.value, { isAr, isEn })
                        : renderFunnelLegacyValue(module.value, { isAr, isEn });
            return body ? renderReportSection(module.key, module.title, module.subtitle, module.icon, body, { isAr, isEn }) : '';
        })
        .join('');
}

function renderFunnelPrimaryEvidence(data = {}, { isAr = false, isEn = false } = {}) {
    const primary = data.funnelPrimaryAnalysis || data.funnelEvidenceSynthesis || {};
    const safe = typeof escapeHtml === 'function' ? escapeHtml : value => String(value || '');
    const sourceLabel = isAr ? 'دليل عام' : isEn ? 'Global evidence' : 'Preuve globale';
    const fallbackLabel = isAr
        ? 'تم استخدام الأدلة العامة عندما لم تتوفر مطابقة متخصصة.'
        : isEn ? 'Global evidence was used when no specialized match was available.'
        : 'Les preuves globales ont été utilisées lorsqu’aucune correspondance spécialisée n’était disponible.';
    const groups = [
        ['present', isAr ? 'أقسام مثبتة' : isEn ? 'Observed sections' : 'Sections observées', '#22c55e', 'fa-circle-check'],
        ['weak', isAr ? 'أقسام تحتاج تحسين' : isEn ? 'Sections to improve' : 'Sections à améliorer', '#f59e0b', 'fa-wand-magic-sparkles'],
        ['missing', isAr ? 'أقسام غائبة مؤكدة' : isEn ? 'Confirmed missing sections' : 'Sections absentes confirmées', '#fb7185', 'fa-circle-minus'],
        ['unconfirmed', isAr ? 'عناصر تحتاج تحقق' : isEn ? 'Items to confirm' : 'Éléments à confirmer', '#60a5fa', 'fa-circle-question']
    ];
    const html = groups.map(([key, title, accent, icon]) => {
        const items = Array.isArray(primary[key]) ? primary[key].slice(0, 8) : [];
        if (!items.length) return '';
        return `<section class="funnel-primary-evidence-group" style="--funnel-v2-accent:${accent}">
            <h4><i class="fas ${icon}"></i><span>${safe(title)}</span><b>${items.length}</b></h4>
            ${items.map(item => {
                const rawLabel = funnelV2Text(item.sectionType || item.section || item.name || item.title || item.text, 'Section');
                const label = /^mission$/i.test(rawLabel)
                    ? (isAr ? 'تحليل متخصص' : isEn ? 'Specialized analysis' : 'Analyse spécialisée')
                    : funnelClientLabel(rawLabel, { isAr, isEn });
                const detail = funnelV2Text(item.detectedText || item.reason || item.problem || item.verdict || item.status, '');
                return `<article class="funnel-v2-action-card"><div><strong dir="auto">${safe(label)}</strong>${item.evidenceSource === 'global-corpus-fallback' ? `<small>${safe(sourceLabel)}</small>` : ''}</div>${detail ? `<p dir="auto">${safe(detail)}</p>` : ''}</article>`;
            }).join('')}
        </section>`;
    }).join('');
    const proofs = Array.isArray(primary.proofUsed) ? primary.proofUsed.slice(0, 8) : [];
    const proofTitle = isAr ? 'الأدلة النصية المستخدمة' : isEn ? 'Text evidence used' : 'Preuves textuelles utilisées';
    return `<div class="funnel-primary-evidence-shell">
        ${primary.evidenceFallbackUsed ? `<p class="funnel-primary-fallback"><i class="fas fa-layer-group"></i>${safe(fallbackLabel)}</p>` : ''}
        <div class="funnel-v2-plan funnel-primary-evidence-grid">${html}</div>
        ${proofs.length ? `<details class="funnel-primary-proofs"><summary data-no-collapse="true"><i class="fas fa-quote-left"></i>${safe(proofTitle)}<span>${proofs.length}</span></summary><div>${proofs.map(proof => `<p dir="auto">${safe(funnelV2Text(proof.text || proof))}</p>`).join('')}</div></details>` : ''}
    </div>`;
}

function renderFunnelPipelineDiagnostic(data = {}, { isAr = false, isEn = false } = {}) {
    const debug = data.debugFunnelPipeline || {};
    const safe = typeof escapeHtml === 'function' ? escapeHtml : value => String(value || '');
    const message = isAr
        ? 'الأدلة غير كافية: لا يمكن الحكم على هذه الصفحة بشكل موثوق.'
        : isEn ? 'Insufficient evidence: this page cannot be judged reliably.'
        : 'Preuves insuffisantes : impossible de juger correctement cette page.';
    const rows = [
        [isAr ? 'النص المقروء' : isEn ? 'Readable text' : 'Texte exploitable', debug.bodyTextLength],
        [isAr ? 'الأدلة' : isEn ? 'Evidence' : 'Preuves', debug.evidenceBlocksCount],
        [isAr ? 'الأقسام' : isEn ? 'Sections' : 'Sections', debug.sectionRawBlocksCount],
        [isAr ? 'الصفحات' : isEn ? 'Pages' : 'Pages', debug.pagesExploredCount],
        ['CTA', debug.ctaCount]
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');
    return `<section class="funnel-v2-render-error funnel-pipeline-diagnostic" dir="${isAr ? 'rtl' : 'ltr'}">
        <i class="fas fa-triangle-exclamation"></i><div><strong>${safe(message)}</strong>
        <div class="funnel-v2-facts">${rows.map(([label, value]) => `<div><small>${safe(label)}</small><strong>${safe(value)}</strong></div>`).join('')}</div>
        ${(debug.warnings || []).length ? `<ul>${debug.warnings.map(item => `<li>${safe(item)}</li>`).join('')}</ul>` : ''}</div>
    </section>`;
}

function funnelOrderHumanLabel(raw, { isAr = false, isEn = false } = {}) {
    const value = funnelV2Text(raw).replace(/[_-]+/g, ' ').trim();
    const lower = value.toLowerCase();
    const map = [
        [/hero|h1|above.?the.?fold|premier/i, ['Premier écran', 'First screen', 'الشاشة الأولى', 'Promesse principale + preuve rapide', 'Main promise + fast proof', 'الوعد الرئيسي + دليل سريع']],
        [/cta|button|bouton|action/i, ['Bouton d’action', 'Action button', 'زر الإجراء', 'Ce que le visiteur doit faire', 'What the visitor must do', 'ما يجب أن يفعله الزائر']],
        [/benefit|bénéfice|benefice|avantage/i, ['Bénéfices', 'Benefits', 'الفوائد', 'Pourquoi c’est utile maintenant', 'Why it is useful now', 'لماذا يفيد الآن']],
        [/feature|fonction|caractéristique|spec|specification/i, ['Fonctionnalités', 'Features', 'الخصائص', 'Ce que le produit/service contient', 'What the product/service includes', 'ما يحتويه المنتج أو الخدمة']],
        [/pricing|price|prix|tarif|offre|pack|bundle/i, ['Prix et offre', 'Price and offer', 'السعر والعرض', 'Ce que le client reçoit et paie', 'What the customer gets and pays', 'ما يحصل عليه العميل وما يدفعه']],
        [/trust|proof|preuve|avis|review|testimonial|social/i, ['Preuves de confiance', 'Trust proof', 'أدلة الثقة', 'Ce qui rassure avant décision', 'What reassures before decision', 'ما يطمئن قبل القرار']],
        [/faq|question|objection/i, ['Questions fréquentes', 'FAQ', 'الأسئلة الشائعة', 'Réponses aux doutes avant achat', 'Answers to doubts before purchase', 'إجابات على الشكوك قبل الشراء']],
        [/delivery|livraison|shipping|retour|return|garantie|warranty/i, ['Livraison / garantie', 'Delivery / guarantee', 'التسليم / الضمان', 'Conditions qui réduisent le risque', 'Conditions that reduce risk', 'شروط تقلل المخاطر']],
        [/demo|screenshot|image|visual|media|video|galerie/i, ['Démonstration visuelle', 'Visual demo', 'عرض مرئي', 'Voir le résultat avant de décider', 'See the result before deciding', 'رؤية النتيجة قبل القرار']],
        [/case|usage|use.?case/i, ['Cas d’usage', 'Use cases', 'حالات الاستخدام', 'À quoi ça sert concrètement', 'What it is used for concretely', 'فيم يستخدم بشكل واضح']],
        [/footer|legal|contact|whatsapp|form/i, ['Contact et légal', 'Contact and legal', 'الاتصال والقانوني', 'Derniers repères de confiance', 'Final trust markers', 'آخر مؤشرات الثقة']]
    ];
    const found = map.find(([pattern]) => pattern.test(lower));
    if (!found) return {
        label: value || (isAr ? 'قسم' : isEn ? 'Section' : 'Section'),
        helper: isAr ? 'دوره في قرار العميل' : isEn ? 'Its role in the customer decision' : 'Son rôle dans la décision client'
    };
    return {
        label: isAr ? found[1][2] : isEn ? found[1][1] : found[1][0],
        helper: isAr ? found[1][5] : isEn ? found[1][4] : found[1][3],
        original: value
    };
}

function funnelOrderRank(raw) {
    const value = funnelV2Text(raw).toLowerCase();
    const rules = [
        [/hero|h1|above.?the.?fold|premier/, 10],
        [/problem|probl[eè]me|désir|desir|pain|need|besoin|objection/, 18],
        [/case|usage|use.?case|audience|cible/, 24],
        [/trust|proof|preuve|avis|review|testimonial|rating|social/, 30],
        [/benefit|bénéfice|benefice|avantage|result|résultat/, 38],
        [/demo|screenshot|image|visual|media|video|galerie/, 44],
        [/feature|fonction|caract[ée]ristique|spec|specification/, 52],
        [/pricing|price|prix|tarif|offre|pack|bundle|value|valeur/, 62],
        [/delivery|livraison|shipping|retour|return|garantie|warranty|payment|paiement|security|sécurité/, 72],
        [/faq|question|objection/, 82],
        [/cta|button|bouton|action|whatsapp|contact|form/, 92],
        [/footer|legal|privacy|terms|mentions/, 98]
    ];
    return rules.find(([pattern]) => pattern.test(value))?.[1] || 70;
}

function prioritizeFunnelRecommendedOrder(items = []) {
    const seen = new Set();
    return items
        .map((item, index) => ({ item, index, rank: funnelOrderRank(item) }))
        .filter(entry => {
            const key = executiveFingerprint(funnelV2Text(entry.item));
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
        .map(entry => entry.item);
}

function renderFunnelOrderInsights(surgery = {}, { isAr = false, isEn = false } = {}) {
    const safe = typeof escapeHtml === 'function' ? escapeHtml : value => String(value || '');
    const labels = isAr ? {
        title: 'الملاحظات التي تغير ترتيب الصفحة',
        add: 'أضف',
        move: 'انقل',
        improve: 'قوّ',
        remove: 'اختصر'
    } : isEn ? {
        title: 'Observations that change the page order',
        add: 'Add',
        move: 'Move',
        improve: 'Strengthen',
        remove: 'Simplify'
    } : {
        title: 'Observations qui changent l’ordre de la page',
        add: 'Ajouter',
        move: 'Déplacer',
        improve: 'Renforcer',
        remove: 'Simplifier'
    };
    const rows = [
        ...funnelV2Array(surgery.add).slice(0, 2).map(item => [labels.add, item, '#22c55e']),
        ...funnelV2Array(surgery.move).slice(0, 2).map(item => [labels.move, item, '#38bdf8']),
        ...funnelV2Array(surgery.improve).slice(0, 2).map(item => [labels.improve, item, '#f59e0b']),
        ...funnelV2Array(surgery.remove).slice(0, 2).map(item => [labels.remove, item, '#fb7185'])
    ].filter(([, item]) => executiveIsUsefulText(funnelV2Text(item)));
    if (!rows.length) return '';
    return `<aside class="funnel-order-insights">
        <strong>${safe(labels.title)}</strong>
        <div>${rows.slice(0, 6).map(([label, item, color]) => `<span style="--insight:${color}"><b>${safe(label)}</b>${safe(funnelV2Text(item.section || item.sectionType || item.action || item.problem || item))}</span>`).join('')}</div>
    </aside>`;
}

function renderFunnelOrderColumn(title, items, { isAr = false, isEn = false, recommended = false } = {}) {
    const safe = typeof escapeHtml === 'function' ? escapeHtml : value => String(value || '');
    const visible = items.slice(0, 12);
    const empty = isAr ? 'لا يوجد ترتيب موثوق.' : isEn ? 'No reliable order available.' : 'Aucun ordre fiable disponible.';
    const caption = recommended
        ? (isAr ? 'المسار الذي يقلل التردد ويدفع نحو القرار.' : isEn ? 'The path that reduces hesitation and moves toward action.' : 'Le parcours qui réduit l’hésitation et rapproche du passage à l’action.')
        : (isAr ? 'ما يراه الزائر حاليا، مع نقاط القوة وفراغات القراءة.' : isEn ? 'What visitors currently see, with strengths and reading gaps.' : 'Ce que le visiteur voit aujourd’hui, avec les forces et les trous de lecture.');
    const itemHtml = visible.map((item, index) => {
        const label = funnelOrderHumanLabel(item, { isAr, isEn });
        return `<li style="--order-step:${index + 1}">
            <span class="funnel-order-step-index">${index + 1}</span>
            <div>
                <strong>${safe(label.label)}</strong>
                <small>${safe(label.helper || '')}</small>
                ${label.original && label.original.toLowerCase() !== label.label.toLowerCase() ? `<em>${safe(label.original)}</em>` : ''}
            </div>
        </li>`;
    }).join('');
    return `<article class="funnel-order-board ${recommended ? 'recommended' : 'observed'}">
        <header><span>${safe(title)}</span><p>${safe(caption)}</p></header>
        <div class="funnel-order-board-grid">
            <ol class="funnel-order-readable">${itemHtml || `<li class="empty">${safe(empty)}</li>`}</ol>
            <div class="funnel-order-wireframe" aria-hidden="true">
                ${(visible.length ? visible : ['hero', 'proof', 'offer', 'cta']).slice(0, 6).map((item, index) => {
                    const label = funnelOrderHumanLabel(item, { isAr, isEn });
                    return `<span style="--wire:${index + 1}"><b>${safe(label.label)}</b></span>`;
                }).join('')}
            </div>
        </div>
    </article>`;
}

function displayFunnelResults(data = {}) {
    const container = document.getElementById('resultsFunnel');
    if (!container) return;
    const resultLang = getAnalysisDisplayLang(data, STATE.lastInputs?.funnelLang || document.getElementById('funnelLang')?.value || STATE.currentLang || 'fr');
    const isAr = resultLang === 'ar';
    const isEn = resultLang === 'en';
    const dir = isAr ? 'rtl' : 'ltr';
    container.dir = dir;
    container.setAttribute('lang', resultLang);
    const safe = typeof escapeHtml === 'function' ? escapeHtml : value => String(value || '');
    const copy = isAr ? {
        kicker: 'قرار التحويل', title: 'ما الذي يمنع الصفحة من البيع الآن؟', partial: 'تم استلام بيانات جزئية. يعرض Daka فقط الإشارات القابلة للتحقق.',
        checked: 'قسم تم فحصه', fixes: 'إجراءات ذات أولوية', confidence: 'الثقة', architecture: 'هندسة الصفحة', architectureSub: 'الأقسام الموجودة والناقصة وما يجب تغييره.',
        order: 'الترتيب الجديد للصفحة', orderSub: 'تسلسل يقلل التردد قبل الإجراء الرئيسي.', current: 'الترتيب المرصود', recommended: 'الترتيب المقترح',
        frictions: 'العوائق التي تمنع التحويل', frictionsSub: 'مشكلات مثبتة وتأثيرها والإصلاح الدقيق.', offer: 'العرض والسعر والثقة', offerSub: 'وضوح القيمة والسعر والأدلة التي تقلل المخاطر.',
        message: 'الرسالة والوعد وCTA', messageSub: 'النصوص الحاسمة التي يجب عرضها قبل القرار.', plan: 'خطة إعادة البناء', planSub: 'الآن، خلال 7 أيام، وخلال 30 يوما.',
        now: 'الآن', seven: 'خلال 7 أيام', thirty: 'خلال 30 يوما', observed: 'الملاحظة', action: 'الإجراء', details: 'البيانات المرصودة والحدود', detailsSub: 'جودة التشخيص ومستوى الثقة وما يجب التحقق منه.',
        noData: 'لم تصل بنية أقسام كافية في هذه الاستجابة. أعد التحليل بعد فتح الصفحة بالكامل.', expert: 'خبير Funnel'
    } : isEn ? {
        kicker: 'Conversion decision', title: 'What prevents this page from selling now?', partial: 'Partial data received. Daka shows only verifiable signals.',
        checked: 'sections checked', fixes: 'priority fixes', confidence: 'Confidence', architecture: 'Page architecture', architectureSub: 'What exists, what is missing, and what must change.',
        order: 'Recommended page order', orderSub: 'A sequence that reduces hesitation before the primary action.', current: 'Observed order', recommended: 'Recommended order',
        frictions: 'Conversion blockers', frictionsSub: 'Observed problems, impact, and exact correction.', offer: 'Offer, price and trust', offerSub: 'Value clarity, pricing, and proof that lowers risk.',
        message: 'Message, promise and CTA', messageSub: 'Decision copy to place before the action.', plan: 'Reconstruction plan', planSub: 'Now, within 7 days, and within 30 days.',
        now: 'Now', seven: 'Within 7 days', thirty: 'Within 30 days', observed: 'Observation', action: 'Action', details: 'Observed data and limits', detailsSub: 'Diagnosis quality, confidence, and useful checks.',
        noData: 'No reliable section architecture arrived in this response. Run the analysis again after opening the page fully.', expert: 'Funnel expert'
    } : {
        kicker: 'Décision conversion', title: 'Ce qui empêche cette page de vendre maintenant', partial: 'Données partielles reçues. Daka affiche uniquement les signaux vérifiables.',
        checked: 'sections vérifiées', fixes: 'corrections prioritaires', confidence: 'Confiance', architecture: 'Architecture de la page', architectureSub: 'Ce qui existe, ce qui manque et ce qu’il faut changer.',
        order: 'Nouvel ordre recommandé', orderSub: 'Un parcours qui réduit l’hésitation avant l’action principale.', current: 'Ordre observé', recommended: 'Ordre recommandé',
        frictions: 'Frictions qui bloquent la conversion', frictionsSub: 'Problèmes observés, impact et correction exacte.', offer: 'Offre, prix et confiance', offerSub: 'Clarté de la valeur, prix et preuves qui réduisent le risque.',
        message: 'Message, promesse et CTA', messageSub: 'Les textes décisifs à placer avant l’action.', plan: 'Plan de reconstruction', planSub: 'Maintenant, sous 7 jours et sous 30 jours.',
        now: 'Maintenant', seven: 'Sous 7 jours', thirty: 'Sous 30 jours', observed: 'Observation', action: 'Action', details: 'Données observées et limites', detailsSub: 'Qualité du diagnostic, confiance et vérifications utiles.',
        noData: 'Aucune architecture fiable de sections n’est arrivée dans cette réponse. Relancez après ouverture complète de la page.', expert: 'Expert Funnel'
    };

    try {
        const debugPipeline = data.debugFunnelPipeline || {};
        const primaryAnalysis = data.funnelPrimaryAnalysis || {};
        if (debugPipeline.scrapeInsufficient || primaryAnalysis.status === 'insufficient') {
            container.innerHTML = `<div id="funnelReport" class="funnel-v2-report" dir="${dir}">${renderFunnelPipelineDiagnostic(data, { isAr, isEn })}</div>`;
            cleanRenderedOutput(container);
            showResults('resultsFunnel');
            STATE.lastFunnelResults = data;
            window.updateExportBadges?.();
            return;
        }
        const surgerySource = data.funnelSurgery || data.funnelSectionSurgery || data.sectionSurgery || data.funnelSectionScanner || {};
        const surgery = normalizeFunnelSurgeryForRender(data);
        const verdict = surgerySource.verdict || {};
        const sectionTotal = Number(surgery.matrix.length || (surgery.keep.length + surgery.improve.length + surgery.move.length + surgery.remove.length + surgery.add.length) || data.rawIntel?.sectionsDetailed?.length || data.rawIntel?.sectionsDetected?.length || 0);
        const priorityTotal = Number((surgery.improve?.length || 0) + (surgery.remove?.length || 0) + (surgery.add?.length || 0));
        const confidence = funnelV2Text(verdict.confidence || surgerySource.observedDataLimits?.confidence || data.scrapeReliability?.confidence, 'LOW');
        const pageQuality = surgerySource.pageQuality || {};
        const verdictText = funnelV2Text(pageQuality.message || verdict.summary || data.auditSummary?.verdict || data.executiveBrief?.priority, copy.partial);
        const surgeryHtml = renderFunnelSectionSurgery(data, { isAr, isEn });
        const order = surgerySource.recommendedOrder || {};
        const currentOrder = funnelV2Array(order.currentOrder, data.rawIntel?.sectionsDetected);
        const recommendedOrder = prioritizeFunnelRecommendedOrder(funnelV2Array(order.recommendedOrder, surgerySource.finalPageBlueprint));
        const observedSections = [
            ...(data.funnelPrimaryAnalysis?.present || []),
            ...(data.funnelEvidenceSynthesis?.present || [])
        ];
        const socialProofObserved = observedSections.some(item => /testimonial|review|rating|avis|t[ée]moignage|social.?proof|تقييم|آراء|مراجعات|شهادات/i.test(
            funnelV2Text(item?.sectionType || item?.section || item?.name || item)
        ));
        const frictions = funnelV2Array(surgerySource.frictions, data.auditIssues, data.conversionFriction?.frictions)
            .filter(item => !(socialProofObserved && /preuve sociale absente|aucune preuve sociale|no social proof|missing social proof|لا توجد أدلة اجتماعية/i.test(funnelV2Text(item))));
        const offer = surgerySource.offerPriceValue || {};
        const offerDetected = surgerySource.offerDetected || {};
        const message = surgerySource.messagePromiseCta || {};
        const proof = surgerySource.proofTrust || {};
        const plan = surgerySource.priorityPlan || {};
        const limits = surgerySource.observedDataLimits || {};
        const legacyModulesHtml = renderFunnelLegacyModules(data, { isAr, isEn });

        const orderHtml = (currentOrder.length || recommendedOrder.length) ? `
            ${renderFunnelOrderInsights(surgery, { isAr, isEn })}
            <div class="funnel-v2-order funnel-v2-order-visual">
                ${currentOrder.length ? renderFunnelOrderColumn(copy.current, currentOrder, { isAr, isEn }) : ''}
                ${recommendedOrder.length ? renderFunnelOrderColumn(copy.recommended, recommendedOrder, { isAr, isEn, recommended: true }) : ''}
            </div>` : `<p class="funnel-v2-empty">${safe(copy.noData)}</p>`;

        const offerRows = [
            [isAr ? 'نوع العرض' : isEn ? 'Offer type' : 'Type d’offre', offerDetected.offerType],
            [isAr ? 'H1 المرصود' : isEn ? 'Observed H1' : 'H1 observé', offerDetected.h1 || message.currentH1],
            [isAr ? 'السعر' : isEn ? 'Price' : 'Prix', offer.price ? `${offer.price} ${offer.currency || ''}` : (isAr ? 'غير مؤكد' : isEn ? 'Unconfirmed' : 'Non confirmé')],
            [isAr ? 'وضوح العرض' : isEn ? 'Offer clarity' : 'Clarté de l’offre', offer.offerClarity],
            [isAr ? 'القيمة المدركة' : isEn ? 'Perceived value' : 'Valeur perçue', offer.valuePerception],
            [isAr ? 'الإجراء' : isEn ? 'Action' : 'Action', offer.action]
        ].filter(([, value]) => funnelV2Text(value));
        const offerHtml = `<div class="funnel-v2-facts">${offerRows.map(([label, value]) => `<div><small>${safe(label)}</small><strong dir="auto">${safe(funnelV2Text(value))}</strong></div>`).join('')}</div>
            ${(proof.present?.length || proof.weak?.length || proof.missing?.length) ? `<div class="funnel-v2-proof-row">${funnelV2Array(proof.present, proof.weak, proof.missing).slice(0, 8).map(item => `<span>${safe(funnelV2Text(item))}</span>`).join('')}</div>` : ''}`;
        const messageRows = [
            [isAr ? 'H1 مقترح' : isEn ? 'Proposed H1' : 'H1 proposé', message.proposedH1],
            [isAr ? 'العنوان الفرعي' : isEn ? 'Proposed subtitle' : 'Sous-titre proposé', message.proposedSubtitle],
            ['CTA', message.proposedCta],
            ['Microcopy', message.microcopy],
            [isAr ? 'طمأنة' : isEn ? 'Reassurance' : 'Réassurance', message.reassurance]
        ].filter(([, value]) => funnelV2Text(value));
        const messageHtml = messageRows.length ? `<div class="funnel-v2-copy-stack">${messageRows.map(([label, value]) => `<div><small>${safe(label)}</small><p dir="auto">${safe(funnelV2Text(value))}</p></div>`).join('')}</div>` : `<p class="funnel-v2-empty">${safe(copy.noData)}</p>`;
        const planColumn = (title, items, accent) => `<div class="funnel-v2-plan-column" style="--funnel-v2-accent:${accent}"><h4>${safe(title)}</h4>${renderFunnelV2Cards(items, { accent, limit: 3, observationLabel: copy.observed, actionLabel: copy.action, confidenceLabel: copy.confidence }) || `<p class="funnel-v2-empty">—</p>`}</div>`;
        const planHtml = `<div class="funnel-v2-plan">${planColumn(copy.now, funnelV2Array(plan.now), '#fb7185')}${planColumn(copy.seven, funnelV2Array(plan.sevenDays), '#f59e0b')}${planColumn(copy.thirty, funnelV2Array(plan.thirtyDays), '#22c55e')}</div>`;
        const detailRows = [
            [isAr ? 'الصفحات المحللة' : isEn ? 'Pages analyzed' : 'Pages analysées', limits.pagesAnalyzed],
            [copy.confidence, limits.confidence || confidence],
            [isAr ? 'السعر مؤكد' : isEn ? 'Price confirmed' : 'Prix confirmé', limits.priceConfirmed === true ? (isAr ? 'نعم' : isEn ? 'Yes' : 'Oui') : (isAr ? 'لا' : isEn ? 'No' : 'Non')]
        ].filter(([, value]) => value !== null && value !== undefined && value !== '');
        const detailsHtml = `<div class="funnel-v2-facts">${detailRows.map(([label, value]) => `<div><small>${safe(label)}</small><strong dir="auto">${safe(funnelV2Text(value))}</strong></div>`).join('')}</div>
            ${funnelV2Array(limits.limits, limits.inaccessibleElements).length ? `<ul class="funnel-v2-limit-list">${funnelV2Array(limits.limits, limits.inaccessibleElements).map(item => `<li>${safe(funnelV2Text(item))}</li>`).join('')}</ul>` : ''}`;

        const executiveHtml = renderExecutiveSummary(data, 'funnel', { isAr, isEn });
        const primaryEvidenceHtml = renderFunnelPrimaryEvidence(data, { isAr, isEn });
        const verdictPanel = `<section class="funnel-v2-hero" data-export-feature="summary">
                <div class="funnel-v2-hero-copy"><span>${safe(copy.kicker)}</span><h2>${safe(copy.title)}</h2><p dir="auto">${safe(verdictText)}</p></div>
                <div class="funnel-v2-metrics"><div><strong>${sectionTotal}</strong><small>${safe(copy.checked)}</small></div><div><strong>${priorityTotal}</strong><small>${safe(copy.fixes)}</small></div><div><strong>${safe(confidence)}</strong><small>${safe(copy.confidence)}</small></div></div>
            </section>`;
        container.innerHTML = `<div id="funnelReport" class="funnel-v2-report" dir="${dir}">
            ${executiveHtml}
            ${renderReportSection('page-order', copy.order, copy.orderSub, 'fa-arrow-down-1-9', orderHtml, { isAr, isEn, open: true })}
            ${renderReportSection('architecture', copy.architecture, copy.architectureSub, 'fa-sitemap', surgeryHtml || `<section class="funnel-v2-missing-architecture" data-export-feature="page"><i class="fas fa-triangle-exclamation"></i><p>${safe(copy.noData)}</p></section>`, { isAr, isEn })}
            ${renderReportSection('message', copy.message, copy.messageSub, 'fa-bullseye', messageHtml, { isAr, isEn })}
            ${renderReportSection('money', copy.offer, copy.offerSub, 'fa-tags', offerHtml, { isAr, isEn })}
            ${renderReportSection('frictions', copy.frictions, copy.frictionsSub, 'fa-triangle-exclamation', renderFunnelV2Cards(frictions, { accent: '#fb7185', limit: 5, observationLabel: copy.observed, actionLabel: copy.action, confidenceLabel: copy.confidence }) || `<p class="funnel-v2-empty">${safe(copy.partial)}</p>`, { isAr, isEn })}
            ${renderReportSection('plan', copy.plan, copy.planSub, 'fa-list-check', planHtml, { isAr, isEn })}
            ${primaryEvidenceHtml ? renderReportSection('funnel-primary-evidence', isAr ? 'التحليل القائم على الأدلة' : isEn ? 'Evidence-first analysis' : 'Analyse fondée sur les preuves', isAr ? 'ما تم رصده فعليا قبل أي توصية.' : isEn ? 'What was actually observed before any recommendation.' : 'Ce qui a réellement été observé avant toute recommandation.', 'fa-magnifying-glass-chart', primaryEvidenceHtml, { isAr, isEn }) : ''}
            ${renderReportSection('details', copy.details, copy.detailsSub, 'fa-database', detailsHtml, { isAr, isEn })}
            ${legacyModulesHtml}
            ${renderExpertDock('funnel', { isAr, isEn })}
        </div>`;
        cleanRenderedOutput(container);
        showResults('resultsFunnel');
        STATE.lastFunnelResults = data;
        window.updateExportBadges?.();
    } catch (error) {
        console.error('[FunnelV2] Render failed:', error);
        container.innerHTML = `<section class="funnel-v2-render-error" dir="${dir}"><i class="fas fa-triangle-exclamation"></i><div><strong>${safe(copy.partial)}</strong><p>${safe(copy.noData)}</p></div></section>`;
        showResults('resultsFunnel');
        STATE.lastFunnelResults = data;
    }
}
// ════════════════════════════════════════════════════════════════
// MAGIC PROMPT - Redesign Prompt Display
// (définie AVANT displayFunnelResults)
// ════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════
// ESCAPE HTML — utilitaire sécurité (si pas déjà présent)
// ════════════════════════════════════════════════════════════════

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str === 'number') return Number.isFinite(str) ? String(str) : '';
    if (typeof str === 'boolean') return str ? 'true' : 'false';
    if (typeof str === 'object') {
        try {
            str = JSON.stringify(str);
        } catch {
            return '';
        }
    }
    str = repairMojibakeString(String(str));
    if (/^\s*(null|undefined|nan|\[object object\])\s*$/i.test(str)) return '';
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}




// ─────────────────────────────────────────────────────
// HELPER : Copy to clipboard universel
// ─────────────────────────────────────────────────────
function copyToClipboard(text, btn) {
    const sourceNode = typeof text === 'string' ? document.getElementById(text) : null;
    if (sourceNode) text = 'value' in sourceNode ? sourceNode.value : sourceNode.innerText || sourceNode.textContent || '';
    const original = btn?.innerHTML;
    const success = () => {
        if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Copié !'; btn.style.background='#10b981'; }
        toast.success('Copié !');
        setTimeout(() => { if(btn){btn.innerHTML=original;btn.style.background='';} }, 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(success).catch(() => fallbackCopy(text, success));
    } else { fallbackCopy(text, success); }
}
function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText='position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); cb?.(); } catch(e) { toast.error('Erreur copie'); }
    document.body.removeChild(ta);
}

function updateOpenRouterQuotaUI(quotaId, payload = {}) {
    const node = document.getElementById(quotaId);
    if (!node) return;
    const lang = STATE.currentLang || 'fr';
    const rate = payload?.rateLimit || payload || {};
    const usage = payload?.usage || {};
    const labels = lang === 'ar'
        ? { req: 'الطلبات المتبقية', tokens: 'التوكنات المتبقية', reset: 'إعادة الضبط', unknown: 'غير متاح', used: 'مستخدمة' }
        : lang === 'en'
            ? { req: 'Requests left', tokens: 'Tokens left', reset: 'Reset', unknown: 'Not exposed', used: 'used' }
            : { req: 'Requêtes restantes', tokens: 'Tokens restants', reset: 'Reset', unknown: 'Non exposé', used: 'utilisés' };
    const clean = value => (value !== null && value !== undefined && String(value).trim() !== '') ? String(value).trim() : '—';
    const requestValue = clean(rate.remainingRequests || rate.requestsRemaining);
    const tokenValue = clean(rate.remainingTokens || rate.tokensRemaining || (usage.total_tokens ? `${usage.total_tokens} ${labels.used}` : null));
    const resetValue = clean(rate.resetRequests || rate.resetTokens || rate.retryAfter || labels.unknown);
    node.innerHTML = `
        <div><small>${escapeHtml(labels.req)}</small><strong>${escapeHtml(requestValue)}</strong></div>
        <div><small>${escapeHtml(labels.tokens)}</small><strong>${escapeHtml(tokenValue)}</strong></div>
        <div><small>${escapeHtml(labels.reset)}</small><strong>${escapeHtml(resetValue)}</strong></div>
    `;
}

function appendOpenRouterChatMessage(chatId, role, text) {
    const node = document.getElementById(chatId);
    if (!node) return;
    const message = document.createElement('div');
    message.className = `groq-chat-message ${role === 'user' ? 'user' : 'assistant'}`;
    message.textContent = String(text || '').trim();
    node.appendChild(message);
    node.scrollTop = node.scrollHeight;
}

function setOpenRouterBuilderInstruction(customId, text) {
    const node = document.getElementById(customId);
    if (!node) return;
    const lang = STATE.currentLang || 'fr';
    const instruction = String(text || '').trim();
    const map = {
        fr: {
            'Hero plus fort': 'Rends le hero plus premium, plus clair et plus orienté conversion. Ne repose pas de questions si les données sont suffisantes.',
            'Mobile premium': 'Optimise la version mobile : sections courtes, CTA visible, textes lisibles, aucune largeur qui déborde.',
            'Ajouter confiance': 'Ajoute une couche confiance : preuves visibles, garantie si elle est fournie, FAQ objections, sans inventer d’avis.',
            'Raccourcir le code': 'Rends le code plus court, propre, commenté par sections, sans framework lourd.'
        },
        en: {
            'Stronger hero': 'Make the hero more premium, clearer, and more conversion-focused. Do not ask more questions if the data is sufficient.',
            'Premium mobile': 'Optimize mobile: short sections, visible CTA, readable text, no horizontal overflow.',
            'Add trust': 'Add a trust layer: visible proof, guarantee only if provided, objection FAQ, without inventing reviews.',
            'Shorten code': 'Make the code shorter, clean, section-commented, without heavy frameworks.'
        },
        ar: {
            'Hero أقوى': 'اجعل قسم Hero أقوى وأكثر وضوحا وموجها للتحويل. لا تعيد طرح الأسئلة إذا كانت البيانات كافية.',
            'Mobile premium': 'حسن تجربة الهاتف: أقسام قصيرة، CTA واضح، نصوص مقروءة، بدون تجاوز عرض الشاشة.',
            'إضافة الثقة': 'أضف طبقة ثقة: أدلة واضحة، ضمان فقط إذا كان مذكورا، FAQ للاعتراضات، بدون اختراع تقييمات.',
            'اختصر الكود': 'اختصر الكود واجعله نظيفا ومقسما بتعليقات، بدون frameworks ثقيلة.'
        }
    };
    const resolved = map[lang]?.[instruction] || instruction;
    node.value = node.value ? `${node.value}\n${resolved}` : resolved;
    node.focus();
}

function extractHtmlForPreview(text) {
    const raw = String(text || '').trim();
    const fenced = raw.match(/```html\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
    const candidate = (fenced?.[1] || raw).trim();
    const lt = String.fromCharCode(60);
    const gt = String.fromCharCode(62);
    const fullDocPattern = new RegExp(lt + '!doctype\\s+html|' + lt + 'html[\\s' + gt + ']', 'i');
    const partialHtmlPattern = new RegExp(lt + '(section|main|header|div|style|script|body)[\\s' + gt + ']', 'i');
    if (fullDocPattern.test(candidate)) return candidate;
    if (partialHtmlPattern.test(candidate)) {
        const open = name => lt + name + gt;
        const close = name => lt + '/' + name + gt;
        const metaCharset = lt + 'meta charset="utf-8"' + gt;
        const metaViewport = lt + 'meta name="viewport" content="width=device-width,initial-scale=1"' + gt;
        const style = lt + 'style' + gt + 'body{margin:0;font-family:Inter,Arial,sans-serif;background:#0f172a;color:#f8fafc}' + close('style');
        return lt + '!doctype html' + gt + open('html') + open('head') + metaCharset + metaViewport + style + close('head') + open('body') + candidate + close('body') + close('html');
    }
    return '';
}

function renderOpenRouterCodePreview(outputId, previewId, emptyId) {
    const output = document.getElementById(outputId);
    const iframe = document.getElementById(previewId);
    const empty = document.getElementById(emptyId);
    if (!iframe) return;
    const html = extractHtmlForPreview(output?.textContent || '');
    if (!html) {
        if (empty) {
            empty.style.display = 'grid';
            empty.textContent = STATE.currentLang === 'ar'
                ? 'لا توجد صفحة HTML كاملة للمعاينة بعد.'
                : STATE.currentLang === 'en'
                    ? 'No complete HTML page available for preview yet.'
                    : 'Aucune page HTML complète disponible pour l’aperçu.';
        }
        iframe.style.display = 'none';
        return;
    }
    iframe.srcdoc = html;
    iframe.style.display = 'block';
    if (empty) empty.style.display = 'none';
}

async function runOpenRouterCodeBuilder(kind, promptId, outputId, customId, quotaId, previewId, emptyId, btn, modelId) {
    const original = btn?.innerHTML;
    const output = document.getElementById(outputId);
    const promptNode = document.getElementById(promptId);
    const custom = document.getElementById(customId);
    const basePrompt = String(promptNode?.value || promptNode?.textContent || '').trim();
    const extra = String(custom?.value || '').trim();
    const lang = STATE.currentLang || 'fr';
    const labels = lang === 'ar'
        ? {
            login: 'سجل الدخول أولا.',
            running: 'OpenRouter يكتب الكود...',
            ready: 'تم توليد الكود.',
            connect: 'اربط مفتاح OpenRouter أولا.',
            empty: 'لا يوجد prompt كاف للتوليد.'
        }
        : lang === 'en'
            ? {
                login: 'Sign in first.',
                running: 'OpenRouter is writing the code...',
                ready: 'Code generated.',
                connect: 'Connect your OpenRouter key first.',
                empty: 'No prompt available for generation.'
            }
            : {
                login: 'Connecte-toi d’abord.',
                running: 'OpenRouter écrit le code...',
                ready: 'Code généré.',
                connect: 'Connecte ta clé OpenRouter d’abord.',
                empty: 'Aucun prompt suffisant pour générer.'
            };
    if (!currentAuthUser) {
        toast.warning(labels.login);
        return openAuthModal();
    }
    if (basePrompt.length < 80) return toast.warning(labels.empty);
    const taskLine = {
        full: 'Genere une premiere version exploitable en un seul fichier HTML avec CSS et JS integres. Reponds en Markdown avec un seul bloc Markdown html complet. Si c?est trop long, donne Partie 1 et termine par GO.',
        html: 'Genere uniquement le HTML semantique dans un bloc Markdown html. Ne donne pas le CSS ni le JS.',
        css: 'Genere uniquement le CSS premium mobile-first dans un bloc Markdown css. Ne donne pas le HTML complet ni le JS.',
        js: 'Genere uniquement le JavaScript utile dans un bloc Markdown javascript. Ne donne pas le HTML complet ni le CSS.'
    }[kind] || '';
    const prompt = `${basePrompt}

MODE DAKA CODE BUILDER LIGHT :
${taskLine}
${extra ? `\nINSTRUCTION UTILISATEUR SUPPLEMENTAIRE :\n${extra}` : ''}

Réponds directement avec le livrable demandé, sans blabla inutile.`;
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> IA...';
        }
        if (output) output.textContent = labels.running;
        const response = await api.request('/api/prompt-to-code/openrouter', {
            method: 'POST',
            body: JSON.stringify({
                prompt,
                maxTokens: kind === 'full' ? 4096 : 3000,
                temperature: 0.22,
                model: document.getElementById(modelId)?.value || undefined
            }),
            timeout: 90000
        });
        if (output) output.textContent = response?.content || '';
        updateOpenRouterQuotaUI(quotaId, response);
        if (kind === 'full') renderOpenRouterCodePreview(outputId, previewId, emptyId);
        toast.success(labels.ready);
    } catch (error) {
        updateOpenRouterQuotaUI(quotaId, error?.data || {});
        if (/OPENROUTER_KEY_NOT_CONNECTED|USER_SECRET_ENCRYPTION_KEY|USER_API_KEYS_TABLE/i.test(error.message || error.data?.error || '')) {
            toast.warning(error.data?.message || labels.connect);
            openOpenRouterKeyModal();
        } else {
            toast.error(error.message || 'OpenRouter error');
        }
        if (output) output.textContent = error.data?.message || error.message || 'OpenRouter error';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}

async function sendOpenRouterCodeBuilderMessage(promptId, outputId, chatId, inputId, quotaId, previewId, emptyId, btn, modelId) {
    const original = btn?.innerHTML;
    const input = document.getElementById(inputId);
    const output = document.getElementById(outputId);
    const promptNode = document.getElementById(promptId);
    const basePrompt = String(promptNode?.value || promptNode?.textContent || '').trim();
    const message = String(input?.value || '').trim();
    const currentCode = String(output?.textContent || '').trim();
    const chatNode = document.getElementById(chatId);
    const chatHistory = [...(chatNode?.querySelectorAll('.groq-chat-message') || [])]
        .slice(-10)
        .map(node => `${node.classList.contains('user') ? 'USER' : 'ASSISTANT'}: ${String(node.textContent || '').trim()}`)
        .filter(Boolean)
        .join('\n\n');
    const lang = STATE.currentLang || 'fr';
    const labels = lang === 'ar'
        ? { login: 'سجل الدخول أولا.', empty: 'اكتب رسالتك أولا.', running: 'OpenRouter يفكر...', connect: 'اربط مفتاح OpenRouter أولا.' }
        : lang === 'en'
            ? { login: 'Sign in first.', empty: 'Write your message first.', running: 'OpenRouter is thinking...', connect: 'Connect your OpenRouter key first.' }
            : { login: 'Connecte-toi d’abord.', empty: 'Écris ton message d’abord.', running: 'OpenRouter réfléchit...', connect: 'Connecte ta clé OpenRouter d’abord.' };
    if (!currentAuthUser) {
        toast.warning(labels.login);
        return openAuthModal();
    }
    if (!message) return toast.warning(labels.empty);
    appendOpenRouterChatMessage(chatId, 'user', message);
    if (input) input.value = '';
    const prompt = `${basePrompt}

DAKA CODE BUILDER - CHAT DE TRAVAIL :
L'utilisateur veut continuer à travailler le code dans l'interface Daka.

HISTORIQUE RECENT DU CHAT :
${chatHistory}

DEMANDE UTILISATEUR :
${message}

CODE OU REPONSE ACTUELLE A AMELIORER :
${currentCode.slice(0, 14000)}

REGLES SPECIALES IMPORTANTES :
- Si le message utilisateur contient des réponses à tes questions précédentes, considère ces réponses comme les données manquantes.
- Ne repose pas les mêmes questions si l'utilisateur vient d'y répondre.
- Si les réponses sont suffisantes, passe directement au plan ou au code demandé.
- Si une réponse est courte comme "Libye, 48h, logo trust, COD", transforme-la en contraintes de projet exploitables.
- Si tu dois encore poser des questions, pose uniquement les questions réellement bloquantes, maximum 3.

Réponds en ${lang === 'ar' ? 'arabe' : lang === 'en' ? 'anglais' : 'français'}.
Si tu fournis du code, utilise uniquement des blocs Markdown nomm?s html, css ou javascript.
Si une information manque, pose les questions nécessaires avant d'inventer.`;
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        }
        appendOpenRouterChatMessage(chatId, 'assistant', labels.running);
        const response = await api.request('/api/prompt-to-code/openrouter', {
            method: 'POST',
            body: JSON.stringify({
                prompt,
                maxTokens: 3200,
                temperature: 0.22,
                model: document.getElementById(modelId)?.value || undefined
            }),
            timeout: 90000
        });
        const chat = document.getElementById(chatId);
        const last = chat?.querySelector('.groq-chat-message.assistant:last-child');
        if (last && last.textContent === labels.running) last.textContent = response?.content || '';
        else appendOpenRouterChatMessage(chatId, 'assistant', response?.content || '');
        if (output && response?.content) output.textContent = response.content;
        renderOpenRouterCodePreview(outputId, previewId, emptyId);
        updateOpenRouterQuotaUI(quotaId, response);
    } catch (error) {
        updateOpenRouterQuotaUI(quotaId, error?.data || {});
        if (/OPENROUTER_KEY_NOT_CONNECTED|USER_SECRET_ENCRYPTION_KEY|USER_API_KEYS_TABLE/i.test(error.message || error.data?.error || '')) {
            toast.warning(error.data?.message || labels.connect);
            openOpenRouterKeyModal();
        } else {
            toast.error(error.message || 'OpenRouter error');
        }
        appendOpenRouterChatMessage(chatId, 'assistant', error.data?.message || error.message || 'OpenRouter error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}


// ═══════════════════════════════════════════════════════════════════
// 🧩 COMPOSANTS MANQUANTS (À AJOUTER POUR ÉVITER LES CRASHS)
// ═══════════════════════════════════════════════════════════════════

// 1. Le constructeur des blocs AIDA

// 2. Le Graphique "Funnel Chart" manquant


async function initApp() {
    try {
        console.log('Daka Market Intelligence Spyer v5.0.0 - Initializing...');
        await checkServerStatus();
        initEventListeners();
        setInterval(checkServerStatus, 30000);
        console.log('App ready');
        setTimeout(() => toast.success('Daka Market Intelligence Spyer pret !'), 500);
    } catch (error) {
        console.error('Init error:', error);
        toast.error('Erreur initialisation');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (CONFIG.ENABLE_ERROR_TRACKING) {
        STATE.errors.push({
            timestamp: new Date().toISOString(),
            message: e.error?.message || 'Unknown',
            stack: e.error?.stack
        });
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
});

if (CONFIG.DEBUG_MODE) {
    window.SEO_GEN_PRO = {
        version: '5.0.0',
        state: STATE,
        config: CONFIG,
        api,
        toast,
        i18n,
        // 🔥 FIX : J'ai supprimé "exportResults" qui faisait crasher l'initialisation
        checkServerStatus
    };
    console.log('DAKA MARKET INTELLIGENCE SPYER READY - ON ECRASE GEMINI !');
}
function buildUpscaledMegaRedesignPrompt(rawPrompt) {
    const lang = STATE.currentLang || 'fr';
    const isAr = lang === 'ar';
    const isEn = lang === 'en';
    if (typeof buildDakaMegaPromptPackage === 'function') {
        return buildDakaMegaPromptPackage(rawPrompt, { isAr, isEn }).full;
    }

    const lastData = STATE.lastFunnelResults || {};
    const url =
        lastData.url ||
        lastData.targetUrl ||
        STATE.lastInputs?.funnelUrl ||
        STATE.lastInputs?.competitorUrl ||
        'URL À COLLER ICI';

    const offerType =
        lastData.funnelSectionSurgery?.offerDetected?.offerType ||
        lastData.sectionSurgery?.offerDetected?.offerType ||
        lastData.offerDetected?.offerType ||
        lastData.spyReport?.siteType ||
        'Donnée non confirmée';

    const price =
        lastData.funnelSectionSurgery?.offerDetected?.price ||
        lastData.sectionSurgery?.offerDetected?.price ||
        lastData.priceIntel?.primaryPrice ||
        lastData.detectedPrice ||
        'Donnée non confirmée';

    const currency =
        lastData.funnelSectionSurgery?.offerDetected?.currency ||
        lastData.sectionSurgery?.offerDetected?.currency ||
        lastData.priceIntel?.currencyDetected ||
        lastData.priceIntel?.currency ||
        '';

    const h1 =
        lastData.funnelSectionSurgery?.offerDetected?.h1 ||
        lastData.sectionSurgery?.offerDetected?.h1 ||
        lastData.h1 ||
        lastData.siteData?.h1 ||
        'Non détecté dans les pages accessibles';

    const basePrompt = String(rawPrompt || '').trim();

    const intro = isAr
        ? `أنت Senior UI/UX Designer و Growth Engineer و Front-End Engineer و Conversion Strategist متخصص في Market Intelligence Spyer.`
        : isEn
            ? `You are a Senior UI/UX Designer, Growth Engineer, Front-End Engineer and Conversion Strategist specialized in Market Intelligence Spyer.`
            : `Tu es un Senior UI/UX Designer, Growth Engineer, Front-End Engineer et Conversion Strategist spécialisé Market Intelligence Spyer.`;

    const langInstruction = isAr
        ? `اكتب الصفحة بلغة السوق المستهدف فقط. إذا كانت الصفحة عربية فكل العناوين والشرح بالعربية، مع الحفاظ على أسماء المنتجات أو المصطلحات الأصلية عند الضرورة.`
        : isEn
            ? `Write the page strictly in the target market language. Keep product names or original terms only when necessary.`
            : `Rédige la page strictement dans la langue du marché cible. Garde les noms de produits ou termes originaux seulement quand c'est utile.`;

    return `
MEGA AI REDESIGN PROMPT — MARKET INTELLIGENCE SPYER
URL + IMAGE JOINTE + RAPPORT DAKA + CODE HTML/CSS/JS PRÊT À HÉBERGER

${intro}

MISSION :
Reconstruire la page fournie comme une vraie page de vente premium, moderne, crédible et orientée conversion.
Tu peux travailler sur :
- mon site actuel ;
- une page concurrente ou adverse ;
- une capture d'écran jointe ;
- une page inspirationnelle.

IMPORTANT :
Si la page est celle d'un concurrent, ne copie jamais sa marque, ses textes protégés ni ses assets privés. Utilise uniquement sa structure comme inspiration stratégique.

SOURCES OBLIGATOIRES :
1. URL de la page à analyser :
${url}

2. Image / capture d’écran jointe :
Analyse obligatoirement l’image jointe. Ne te base pas uniquement sur l’URL.
La capture montre l’état réel de la page, le design actuel, la hiérarchie visuelle, les frictions UX, les sections visibles, la confiance perçue et les problèmes d’interface.

3. Données issues du rapport Daka :
- Type d’offre détecté : ${offerType}
- H1 actuel : ${h1}
- Prix détecté ou statut prix : ${price}${currency ? ' ' + currency : ''}
- Recommandations existantes :
${basePrompt || 'Donnée non confirmée'}

OBJECTIF BUSINESS :
Créer une page qui donne envie, rassure vite, explique clairement l'offre, rend le risque faible, fait monter le désir et pousse vers l'action.
La page doit donner une impression de produit bien vendu : esthétique, copywriting tendu, preuve visible, CTA clair, objections traitées.

IMPORTANT :
Ne te base pas uniquement sur l’URL.
Compare l’URL, l’image jointe et les informations du rapport Daka.
Si l’URL et l’image montrent des informations différentes, considère l’image comme preuve visuelle importante.

RÈGLES DE VÉRITÉ :
- Ne pas inventer de témoignages, notes, clients, logos, garanties, prix ou résultats.
- Si une preuve manque, créer un emplacement propre marqué "À remplacer par une preuve réelle".
- Si un prix est non confirmé, écrire "Prix à confirmer" et ne pas l'utiliser comme preuve.
- Si une garantie est recommandée mais non observée, écrire clairement "Recommandation : ajouter une garantie".
- Garder les preuves observées : CTA, prix, bénéfices, avis, villes, livraison, specs, images, FAQ, conditions.
- Ne jamais transformer une hypothèse en fait.

LIVRABLE ATTENDU :
Fournis du code front-end directement exploitable en :
- HTML
- CSS
- JavaScript

Format prioritaire :
Un seul fichier HTML complet avec CSS et JS intégrés.

Format alternatif si demandé :
- index.html
- style.css
- script.js

Contraintes techniques :
- Pas de React.
- Pas de Vue.
- Pas de backend obligatoire.
- Pas de dépendance complexe.
- Code prêt à héberger sur un simple serveur HTML/CSS/JS.
- Aucune erreur console.
- Responsive mobile-first.
- Aucun overflow horizontal.
- Boutons larges et cliquables.
- CTA visible rapidement.
- Design premium, crédible et non générique.
- Score Lighthouse visé : rapide, propre, accessible.
- Aucun texte caché derrière un composant non utilisable sur mobile.

SI UNE SEULE RÉPONSE NE SUFFIT PAS :
Si le code est trop long pour une seule réponse, découpe-le en plusieurs parties.

Règle stricte :
À la fin de chaque partie, écris exactement :
“Tape GO pour recevoir la suite.”

La partie suivante ne doit commencer que lorsque je tape :
GO

Chaque partie doit continuer exactement où la précédente s’est arrêtée.
Ne recommence pas depuis zéro.
Ne saute pas de code.
Ne résume pas.

Découpage recommandé :
- Partie 1 : diagnostic + stratégie + début HTML.
- Partie 2 : suite HTML + CSS principal.
- Partie 3 : CSS responsive + animations.
- Partie 4 : JavaScript + interactions + finalisation.
- Partie 5 si nécessaire : instructions d’intégration.

ANALYSE À FAIRE AVANT CODAGE :
Avant de coder, fais un mini diagnostic :
1. Ce que montre l’image.
2. Ce que montre l’URL.
3. Ce que vend réellement la page.
4. Les problèmes UI/UX visibles.
5. Les sections présentes à garder.
6. Les sections présentes à améliorer.
7. Les sections absentes à ajouter.
8. Les sections à supprimer ou fusionner.
9. Le nouvel ordre recommandé de la page.
10. Le positionnement de conversion.

ARCHITECTURE OBLIGATOIRE À PRODUIRE :
1. Header simple, lisible, non envahissant.
2. Hero : résultat promis + produit/service + preuve rapide + CTA principal.
3. Ligne de réassurance : livraison, garantie, paiement, contact, avis ou preuve disponible.
4. Problème / désir client : ce que l'utilisateur veut éviter ou obtenir.
5. Bénéfices principaux : 3 à 5 bénéfices concrets, pas des slogans.
6. Démonstration visuelle : images, vidéo, galerie ou simulation.
7. Caractéristiques / livrables : specs produit ou livrables service.
8. Offre : pack, prix, ce que l'utilisateur reçoit, bonus éventuels.
9. Preuves de confiance : avis, cas clients, badges, villes, photos, conditions.
10. Objections / FAQ : questions avant achat ou prise de contact.
11. CTA final : rappel de la promesse + action simple.
12. Footer propre : contact, légal, réseaux, conditions.

ORDRE PSYCHOLOGIQUE À RESPECTER :
- D'abord faire comprendre.
- Ensuite faire ressentir le problème ou le désir.
- Ensuite montrer la preuve.
- Ensuite rendre l'offre concrète.
- Ensuite enlever le risque.
- Enfin demander l'action.

EXIGENCES DESIGN :
- Mobile-first.
- Responsive desktop/mobile.
- Lisible.
- Premium.
- Contraste fort.
- Hiérarchie visuelle claire.
- Espacement propre.
- Animations légères.
- Pas de design générique.
- Pas de rendu “fait par IA”.
- Pas de surcharge visuelle.
- Pas de faux témoignages trompeurs.
- Interface 360px, 390px, 430px impeccable.
- Cards stables : aucun texte ne doit déborder.
- Éviter les gros blocs fatigants : utiliser cartes, bandeaux, tableaux courts, étapes, preuves et schémas simples.
- Utiliser un style premium adapté au marché : SaaS, e-commerce, service, formation ou produit physique.

EXIGENCES COPYWRITING :
- H1 orienté bénéfice.
- Sous-titre clair.
- CTA principal fort.
- Microcopy rassurante sous CTA.
- FAQ utile.
- Texte naturel.
- Promesses réalistes.
- Langage adapté au pays cible.
- Éviter les phrases vagues comme “améliorer votre expérience”.
- Chaque section doit avoir un but commercial.
- Chaque CTA doit être spécifique : acheter, commander, réserver, demander un devis, lancer l'audit, discuter sur WhatsApp.
- Pour un produit physique : parler prix, stock, livraison, retour, garantie, paiement, avis, photos réelles.
- Pour un service : parler livrables, délai, résultat attendu, accompagnement, révisions, preuve client, appel découverte.
- Pour SaaS : parler démonstration, cas d'usage, onboarding, intégrations, sécurité, pricing.

${langInstruction}

EXIGENCES JAVASCRIPT :
Inclure seulement le JS utile :
- menu mobile si nécessaire ;
- FAQ accordéon ;
- sticky CTA mobile si utile ;
- scroll doux ;
- micro-interactions ;
- aucune erreur console.

IMAGES :
Utilise l’image jointe comme référence visuelle.
Si elle contient le produit, reprends son esprit dans le design.
Si une image produit doit être remplacée plus tard, utilise un chemin clair comme :
assets/product-main.jpg

SCHÉMAS / SECTIONS VISUELLES À INCLURE :
- Une section "Pourquoi cette page doit convertir" avec 3 cartes : désir, preuve, action.
- Une mini roadmap visuelle du parcours utilisateur.
- Une section "Avant / Après" si la page actuelle est confuse.
- Une section FAQ en accordéon.
- Un sticky CTA mobile discret si pertinent.

ACCESSIBILITÉ ET QUALITÉ :
- Balises sémantiques.
- Boutons accessibles au clavier.
- Focus visible.
- Alt text sur les images.
- Pas de scroll horizontal.
- Pas de popup agressive.
- Pas d'animations lourdes.

SORTIE ATTENDUE :
Répondre dans cet ordre :
1. Mini diagnostic URL + image.
2. Nouvelle stratégie de page.
3. Code complet HTML/CSS/JS.

PHRASE DIRECTRICE :
Redesign = Market Intelligence + preuve réelle + psychologie commerciale + UI/UX premium + code HTML/CSS/JS prêt à héberger.
`.trim();
}

// ═══════════════════════════════════════════════════════════════════
// ✨ MAGIC PROMPT RENDERER (VERSION BLINDÉE ANTI-CRASH)
// ═══════════════════════════════════════════════════════════════════
window.displayMagicPrompt = function(promptText) {
    let container = document.getElementById('magicPromptPlaceholder');

    // 🛡️ SÉCURITÉ : Si le innerHTML a écrasé la div, on la recrée à la volée !
    if (!container) {
        container = document.createElement('div');
        container.id = 'magicPromptPlaceholder';
        const funnelContainer = document.getElementById('resultsFunnel');
        if (funnelContainer) funnelContainer.appendChild(container);
    }

    if (!promptText) return;
promptText = buildUpscaledMegaRedesignPrompt(promptText);
    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';

    const title   = 'Mega Redesign Prompt';
    const copyBtn = isAr ? 'نسخ' : (isEn ? 'COPY' : 'COPIER');
const subText = isAr
    ? 'برومبت كامل يستعمل الرابط والصورة المرفقة وتقرير Daka لتوليد صفحة HTML/CSS/JS.'
    : isEn
    ? 'Complete prompt using the URL, attached screenshot and Daka report to generate HTML/CSS/JS.'
    : 'Prompt complet basé sur URL + image jointe + rapport Daka pour générer du HTML/CSS/JS.';

    // 📊 Calcul des statistiques du prompt
    const lineCount  = (promptText.match(/\n/g) || []).length + 1;
    const wordCount  = promptText.trim().split(/\s+/).length;

    container.innerHTML = `
    <div class="result-card fade-in-up" style="margin-top:30px; border:2px solid #8b5cf6; background:#05071a; border-radius:20px; padding:25px; position:relative; overflow:hidden">
        <div style="position:absolute; top:-60px; right:-60px; width:200px; height:200px; background:radial-gradient(circle,rgba(139,92,246,0.12),transparent 70%); pointer-events:none"></div>

        <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:18px; flex-wrap:wrap; gap:12px">
            <div>
                <h3 style="color:white; margin:0 0 5px; font-size:1.1rem; font-family:'Cairo'; font-weight:900; display:flex; align-items:center; gap:8px">
                    <div style="background:var(--accent-secondary); width:35px; height:35px; border-radius:10px; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-wand-magic-sparkles" style="color:white"></i>
                    </div>
                    ${title}
                    <span style="background:rgba(139,92,246,0.2); color:#c4b5fd; border:1px solid rgba(139,92,246,0.3); padding:2px 8px; border-radius:6px; font-size:0.6rem; font-weight:800;">GÉNÉRÉ</span>
                </h3>
                <p style="color:#64748b; font-size:0.75rem; margin:0;">${subText}</p>
            </div>

            <button onclick="copyToClipboard('magicPromptRawText', this)" class="btn-copy-mini" style="background:rgba(139,92,246,0.2); color:#c4b5fd; border:1px solid rgba(139,92,246,0.3); padding:8px 15px; border-radius:8px; font-size:0.75rem; cursor:pointer; font-weight:800; display:flex; align-items:center; gap:6px;">
                <i class="fas fa-copy"></i> ${copyBtn}
            </button>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:15px">
            <span style="background:#8b5cf615; color:#a5b4fc; padding:3px 10px; border-radius:20px; font-size:0.65rem; font-weight:800;"><i class="fas fa-align-left"></i> ${lineCount} lignes</span>
            <span style="background:#3b82f615; color:#93c5fd; padding:3px 10px; border-radius:20px; font-size:0.65rem; font-weight:800;"><i class="fas fa-font"></i> ${wordCount.toLocaleString()} mots</span>
        </div>

        <div style="position:relative; background:#000510; border:1px solid #1e293b; border-radius:12px; overflow:hidden">
            <div style="background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899,#f59e0b); height:2px; width:100%"></div>
            <pre id="magicPromptRawText" style="direction:ltr; text-align:left; font-family:monospace; font-size:0.8rem; color:#a5b4fc; white-space:pre-wrap; max-height:350px; overflow-y:auto; padding:20px; margin:0;">${escapeHtml(promptText)}</pre>
        </div>
    </div>`;
};
// ═══════════════════════════════════════════════════════════════════
// 🧱 COMPOSANT : GÉNÉRATEUR DE BLOC PHASE AIDA
// ═══════════════════════════════════════════════════════════════════
function copyCounterText(btn) {
    const text = btn.closest('[data-copy]')?.dataset.copy || '';
    navigator.clipboard.writeText(text)
        .then(() => {
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.style.color = '#34d399';
            setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; btn.style.color = ''; }, 2000);
            if (typeof toast !== 'undefined') toast.success('Copié !');
        })
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (typeof toast !== 'undefined') toast.success('Copié !');
        });
}

function renderPhaseBlock(label, phase, icon) {
    // 1. Sécurité et Fallback (CONSERVÉ)
    if (!phase) phase = { score: 0 };

    // 2. Détermination de la couleur (Stricte cohérence avec l'UI - CONSERVÉ)
    const score = phase.score || 0;
    const scoreColor = score >= 80 ? 'var(--accent-success)' : (score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)');

    // 3. I18n & Contextuel (CONSERVÉ + EXTENSION DEEP)
    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';

    const t = {
        critique: isAr ? 'تحليل الخبير' : (isEn ? 'Expert Critique' : 'Critique de l\'Expert'),
        solution: isAr ? 'توصيات التحسين' : (isEn ? 'Strategic Solutions' : 'Solutions Stratégiques'),
        empty: isAr ? 'تحليل أعمق مطلوب' : 'Analyse approfondie requise',
        bias: isAr ? 'العامل النفسي' : (isEn ? 'Psychological Trigger' : 'Levier Psychologique'),
        friction: isAr ? 'عائق التحويل' : (isEn ? 'Conversion Friction' : 'Point de Friction')
    };

    // 4. Extraction intelligente du contenu (Multi-clés backend - CONSERVÉ + PAS SUPPORT)
    // On ajoute le support pour .problem, .agitation, .solution si c'est un bloc PAS
    const critiqueText = phase.headlineCritique || phase.ctaCritique || phase.urgencyHack || phase.problem || phase.agitation || t.empty;
    const proposals = phase.proposedProHeadlines || phase.proposedBenefits || phase.proposedCTAs || (phase.solution ? [phase.solution] : []);

    const proposalsHtml = proposals.length > 0
        ? proposals.map(item => `
            <li style="margin-bottom: 8px; display: flex; align-items: flex-start; gap: 10px;">
                <i class="fas fa-check-circle" style="color: var(--accent-success); font-size: 0.8rem; margin-top: 5px;"></i>
                <span style="font-family: 'Almarai', sans-serif;">${item}</span>
            </li>`).join('')
        : `<li style="opacity:0.5;">${t.empty}</li>`;

    // --- [NOUVEAUTÉ DEEP] : Badge de Biais Cognitif ---
    // Si le moteur renvoie un biais spécifique utilisé (ex: Aversion à la perte), on l'affiche
    const biasTag = phase.detectedBias ? `
        <div style="margin-top: 10px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 6px; font-size: 0.7rem; color: #c4b5fd;">
            <i class="fas fa-brain"></i> <strong>${t.bias}:</strong> ${phase.detectedBias}
        </div>
    ` : '';

    // 5. Rendu HTML Premium (CONSERVÉ + DESIGN DEEP)
    return `
        <div class="result-card" style="border-top: 4px solid ${scoreColor}; display: flex; flex-direction: column; height: 100%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden;">

            <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: ${scoreColor}; opacity: 0.05; border-radius: 50%; filter: blur(30px);"></div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: relative; z-index: 2;">
                <h4 style="margin:0; font-family: 'Cairo', sans-serif; font-size: 1.1rem; color: white; display: flex; align-items: center; gap: 10px;">
                    <i class="fas ${icon}" style="color: ${scoreColor};"></i>
                    ${label}
                </h4>
                <div class="result-badge" style="background: ${scoreColor}15; color: ${scoreColor}; border: 1px solid ${scoreColor}30; font-weight: 800; font-size: 0.9rem; min-width: 65px; text-align: center;">
                    ${score}/100
                </div>
            </div>

            <div style="margin-bottom: 20px; flex-grow: 1; position: relative; z-index: 2;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <span style="width: 15px; height: 2px; background: var(--accent-danger);"></span>
                    <small style="text-transform: uppercase; letter-spacing: 1px; color: var(--accent-danger); font-weight: 800; font-size: 0.65rem;">
                        ${t.critique}
                    </small>
                </div>
                <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; font-family: 'Almarai', sans-serif; font-style: italic; border-right: ${isAr ? '2px solid rgba(239, 68, 68, 0.3)' : 'none'}; border-left: ${!isAr ? '2px solid rgba(239, 68, 68, 0.3)' : 'none'}; padding-${isAr ? 'right' : 'left'}: 12px;">
                    "${critiqueText}"
                </p>
                ${biasTag}
            </div>

            <div style="background: rgba(255,255,255,0.03); padding: 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05); position: relative; z-index: 2; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
                    <span style="width: 15px; height: 2px; background: var(--accent-success);"></span>
                    <small style="text-transform: uppercase; letter-spacing: 1px; color: var(--accent-success); font-weight: 800; font-size: 0.65rem;">
                        ${t.solution}
                    </small>
                </div>
                <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; color: #e2e8f0; line-height: 1.6; font-family: 'Almarai', sans-serif;">
                    ${proposalsHtml}
                </ul>
            </div>

            <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: rgba(255,255,255,0.05);">
                <div style="width: ${score}%; height: 100%; background: ${scoreColor}; box-shadow: 0 0 10px ${scoreColor};"></div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════
// 🕵️‍♂️ ESPIONNAGE CROISÉ (INTERCONNECTIVITÉ DES ONGLETS)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// 📋 COPIE DES FICHIERS GÉNÉRÉS (LLMS.TXT / ROBOTS.TXT / META)



function getActiveTabField(tabKey, inputId) {
    const activeTab = document.getElementById(tabKey + 'Tab');
    const scoped = activeTab?.querySelector(`#${inputId}`);
    if (scoped) return scoped;

    const visible = [...document.querySelectorAll(`#${inputId}`)]
        .find(el => el.offsetParent !== null || el.closest('.tab-content.active'));

    return visible || document.getElementById(inputId);
}

function switchToTab(tabKey, options = {}) {
    if (window.tabManager && typeof window.tabManager.switchTab === 'function') {
        return window.tabManager.switchTab(tabKey, options);
    }
    if (typeof tabManager !== 'undefined' && typeof tabManager.switchTab === 'function') {
        return tabManager.switchTab(tabKey, options);
    }
    document.querySelector(`.nav-btn[data-tab="${tabKey}"]`)?.click();
    return document.getElementById(tabKey + 'Tab') || null;
}

function afterTabVisible(tabKey, callback) {
    let attempts = 0;
    const run = () => {
        const tab = document.getElementById(tabKey + 'Tab');
        attempts += 1;
        if (!tab || attempts > 20) {
            callback(tab || null);
            return;
        }
        if (!tab || !tab.classList.contains('active')) {
            requestAnimationFrame(run);
            return;
        }
        requestAnimationFrame(() => callback(tab));
    };
    requestAnimationFrame(run);
}

function openCompetitorAudit(tabKey, inputId, rawUrl) {
    const targetUrl = String(rawUrl || '').trim();
    if (!targetUrl) {
        if (typeof toast !== 'undefined') toast.warning(STATE.currentLang === 'ar' ? 'رابط المنافس غير موجود.' : 'URL concurrent manquante.');
        return;
    }

    switchToTab(tabKey, { scroll: false });
    afterTabVisible(tabKey, () => {
        const urlInput = getActiveTabField(tabKey, inputId);
        if (urlInput) {
            urlInput.value = targetUrl;
            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
            urlInput.dispatchEvent(new Event('change', { bubbles: true }));
            urlInput.focus();
            urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

window.spyOnCompetitorFunnel = function(url) {
    openCompetitorAudit('funnel', 'funnelUrl', url);
    if (typeof toast !== 'undefined') toast.info(STATE.currentLang === 'ar' ? 'جاهز لتحليل القمع الخاص بهم!' : 'Prêt à analyser leur Funnel ! Cliquez sur Lancer.');
};

window.spyOnCompetitorTech = function(url) {
    openCompetitorAudit('technical', 'techUrl', url);
    if (typeof toast !== 'undefined') toast.info(STATE.currentLang === 'ar' ? 'جاهز للتدقيق التقني!' : 'Prêt pour l\'audit technique ! Cliquez sur Lancer.');
};

window.generateCompetitorKeywords = function(url, domain = '', title = '') {
    const isAr = STATE.currentLang === 'ar';
    const isEn = STATE.currentLang === 'en';
    const rawUrl = String(url || '').trim();
    const cleanDomain = String(domain || '').replace(/^www\./i, '').replace(/\.[a-z]{2,}$/i, '').replace(/[-_]/g, ' ').trim();
    const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim();
    const lastQuery = STATE.lastInputs?.keyword || document.getElementById('keyword')?.value || '';
    const seedParts = [cleanDomain, cleanTitle, lastQuery]
        .map(v => String(v || '').trim())
        .filter(Boolean);
    const seed = [...new Set(seedParts)].join(' ').replace(/\s+/g, ' ').slice(0, 100);

    switchToTab('keywords', { scroll: false });
    afterTabVisible('keywords', () => {
        const seedValue = seed || rawUrl || cleanDomain;
        const activeTab = document.getElementById('keywordsTab');
        const seedInputs = [
            ...(activeTab ? activeTab.querySelectorAll('#seedKeyword') : []),
            ...document.querySelectorAll('#seedKeyword')
        ];
        [...new Set(seedInputs)].forEach(input => {
            input.value = seedValue;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const country = STATE.lastInputs?.country || document.getElementById('country')?.value || '';
        const geoMap = { Morocco: 'ma', France: 'fr', 'United States': 'us', Global: 'us' };
        const kwGeo = geoMap[country] || (String(country).toLowerCase().includes('morocco') ? 'ma' : 'auto');
        const geoSelects = [
            ...(activeTab ? activeTab.querySelectorAll('#kwGeo') : []),
            ...document.querySelectorAll('#kwGeo')
        ];
        [...new Set(geoSelects)].forEach(select => {
            if ([...select.options].some(o => o.value === kwGeo)) select.value = kwGeo;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const firstSeed = getActiveTabField('keywords', 'seedKeyword');
        if (firstSeed) {
            firstSeed.focus();
            firstSeed.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    if (typeof toast !== 'undefined') {
        toast.info(
            isAr ? 'تم تجهيز مولد الكلمات لهذا المنافس. اضغط على زر التوليد.'
            : isEn ? 'Keyword generator is ready for this competitor. Click generate.'
            : 'Le generateur de mots-cles est pret pour ce concurrent. Cliquez sur generer.'
        );
    }
};

document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-competitor-action]');
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const action = btn.dataset.competitorAction;
    const url = btn.dataset.url || '';

    if (action === 'funnel') {
        window.spyOnCompetitorFunnel(url);
    } else if (action === 'tech') {
        window.spyOnCompetitorTech(url);
    } else if (action === 'keywords') {
        window.generateCompetitorKeywords(url, btn.dataset.domain || '', btn.dataset.title || '');
    }
}, true);
// ═══════════════════════════════════════════════════════════════════
// 📱 MEGA PATCH MOBILE (JS UX)
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    // 1. Auto-scroll intelligent vers les résultats
    // On intercepte ta fonction showResults pour y ajouter le scroll
    const originalShowResults = window.showResults;

    window.showResults = function(elementId) {
        // Exécuter le code d'origine (afficher la div)
        if(originalShowResults) {
            originalShowResults(elementId);
        } else {
            const el = document.getElementById(elementId);
            if (el) el.classList.add('active');
        }

        // Si on est sur mobile, on scroll doucement vers les résultats
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                const resultsDiv = document.getElementById(elementId);
                if (resultsDiv) {
                    // Petit décalage pour tenir compte du header sticky
                    const y = resultsDiv.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                }
            }, 300); // On attend que l'animation d'apparition soit finie
        }
    };

    // 2. Anti-Zoom iOS (Évite que l'iPhone zoom sur la page quand on clique sur un input)
    const inputs = document.querySelectorAll('input[type="text"], input[type="url"], select, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            if (window.innerWidth <= 480) {
                // Force la désactivation du zoom temporairement
                const metaViewport = document.querySelector('meta[name=viewport]');
                if(metaViewport) {
                    metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
                    // Rétablit le comportement normal à la sortie du champ
                    setTimeout(() => {
                        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
                    }, 100);
                }
            }
        });
    });

    console.log("📱 Mobile Patch UI/UX Injecté avec succès !");
});


    
