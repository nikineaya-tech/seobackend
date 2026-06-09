'use strict';

// ═══════════════════════════════════════════════════════════════════
// SCRAPER ORCHESTRATOR — Multi-Agent Parallel Exploration
// ═══════════════════════════════════════════════════════════════════
// Architecture:
//   BOT PRINCIPAL → home → détecte candidats → N vagues de 3 sub-bots
//   Chaque sub-bot : 1 tab | 5s max | verdict YES / NO / MAYBE
//   1 browser unique (compatible Render Free 512MB)
// ═══════════════════════════════════════════════════════════════════

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(StealthPlugin());

// ── CONFIGURATION ─────────────────────────────────────────────────
const PARALLEL_CONFIG = {
    maxConcurrentTabs:  3,       // jamais plus de 3 onglets simultanés
    maxTimePerTab:      5000,    // 5s max par sub-bot
    maxCandidates:      8,       // candidats max à explorer
    batchSize:          3,       // sub-bots par vague
    totalBudgetMs:      20000,   // 20s budget total
    scrollDelay:        400,
    domTimeout:         10000,
    subTimeout:         5000,
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── HELPERS ────────────────────────────────────────────────────────
function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
}

async function safeScroll(page, ratio = 0.5) {
    try {
        await page.evaluate((r) => window.scrollTo(0, document.body.scrollHeight * r), ratio);
        await new Promise((res) => setTimeout(res, PARALLEL_CONFIG.scrollDelay));
    } catch { /* ignore */ }
}

async function launchOrchestBrowser() {
    return chromium.launch({
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-gpu', '--no-zygote', '--single-process',
            '--disable-extensions', '--disable-background-networking',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--js-flags=--max-old-space-size=256',
            '--window-size=1280,720',
        ],
    });
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 1 — DÉTECTION CANDIDATS (Bot Principal)
// Score chaque lien interne selon sa probabilité d'être une page commerciale
// ═══════════════════════════════════════════════════════════════════

async function detectAllCandidates(page) {
    return page.evaluate(() => {
        const candidates = [];
        const seen = new Set();

        const add = (href, text, elType, scoreBoost = 0) => {
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
            if (/mailto:|tel:|\.pdf|\.zip|\.jpg|\.png/i.test(href)) return;
            try {
                const u = new URL(href, window.location.href).href;
                if (!u.startsWith(window.location.origin)) return;
                if (seen.has(u)) return;
                seen.add(u);

                const t = (text || '').toLowerCase();
                let score = 50 + scoreBoost;

                // Pricing keywords → +40
                if (/prix|tarif|plan|formule|pack|offre|abonnement|pricing|subscription/i.test(t)) score += 40;
                // Plan names → +30
                if (/starter|pro|basic|premium|essential|standard|business|enterprise/i.test(t)) score += 30;
                // Price values in text → +35
                if (/\d+\s*(mad|dh|€|\$|درهم)/i.test(t)) score += 35;
                // Product/service → +20
                if (/produit|service|solution|programme|formation|coaching/i.test(t)) score += 20;
                // CTA → +15
                if (/commencer|démarrer|essayer|acheter|rejoindre|s'inscrire|voir/i.test(t)) score += 15;

                // Penalties
                if (/blog|article|news|conseil|astuce|actualité/i.test(t)) score -= 40;
                if (/contact|about|équipe|carrière|mention|legal|privacy|cookie/i.test(t)) score -= 30;
                if (/login|connexion|compte|dashboard|admin/i.test(t)) score -= 25;

                // Slug bonus
                const slug = new URL(u).pathname;
                if (/\/(prix|tarif|plan|offre|pack|produit|service|programme|rejoindre|commencer)/i.test(slug)) score += 25;
                if (slug.split('/').filter(Boolean).length <= 1) score += 10;

                candidates.push({
                    href: u,
                    text: (text || '').slice(0, 80).trim(),
                    score: Math.max(0, Math.min(100, score)),
                    type: elType,
                    slug,
                });
            } catch { /* ignore malformed URLs */ }
        };

        // Liens <a>
        document.querySelectorAll('a[href]').forEach((a) =>
            add(a.href, a.innerText || a.getAttribute('aria-label') || '', 'link')
        );

        // Boutons avec data-href
        document.querySelectorAll('[data-href],[role="button"][data-url]').forEach((btn) => {
            const h = btn.getAttribute('data-href') || btn.getAttribute('data-url');
            add(h, btn.innerText || '', 'button', 5);
        });

        return candidates.sort((a, b) => b.score - a.score).slice(0, 12);
    });
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACTORS — Données structurées depuis texte brut
// ═══════════════════════════════════════════════════════════════════

function extractPricesFromText(text) {
    const prices = [];
    const seen = new Set();

    // Pattern: 149 MAD, 299 DH, 199€, $49, 1 500 MAD
    const rx = /(\d{1,3}(?:[\s,.]?\d{3})*(?:\.\d{1,2})?)\s*(MAD|DH|DHS|€|\$|USD|EUR|GBP|LYD|درهم|د\.م\.?)/gi;
    let m;
    while ((m = rx.exec(text)) !== null) {
        const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
        const cur = m[2].toUpperCase().replace('DHS', 'MAD').replace('DH', 'MAD').replace('د.م.', 'MAD');
        const key = `${val}-${cur}`;
        if (!seen.has(key) && val > 0 && val < 1_000_000) {
            seen.add(key);
            // Get surrounding context
            const ctx = text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ');
            prices.push({ value: val, currency: cur, context: ctx });
        }
    }

    // Pattern with period: "149/mois", "299 par mois", "49/month"
    const rxPeriod = /(\d{1,3}(?:[\s,.]?\d{3})*)\s*(?:MAD|DH|€|\$)?\s*[/\s]?(mois|mo|month|an|year|jour|day)/gi;
    while ((m = rxPeriod.exec(text)) !== null) {
        const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
        const period = /mo|mois|month/i.test(m[2]) ? 'mois' : /an|year/i.test(m[2]) ? 'an' : 'jour';
        const key = `${val}-period-${period}`;
        if (!seen.has(key) && val > 0 && val < 1_000_000) {
            seen.add(key);
            prices.push({ value: val, currency: 'MAD', period, context: m[0] });
        }
    }

    return prices;
}

function extractPlans(text) {
    const names = ['starter','pro','basic','premium','essential','standard','business','enterprise','gratuit','free','lite','plus','max','gold','silver'];
    const found = [];
    names.forEach((p) => {
        if (new RegExp(`\\b${p}\\b`, 'i').test(text)) found.push(p.charAt(0).toUpperCase() + p.slice(1));
    });
    return [...new Set(found)];
}

function extractCTAs(text) {
    const list = ['commencer','démarrer','essayer','gratuit','acheter',"s'inscrire",'rejoindre','choisir','souscrire','commander','contactez','réserver'];
    return [...new Set(list.filter((c) => text.toLowerCase().includes(c)).map((c) => c.charAt(0).toUpperCase() + c.slice(1)))];
}

function extractTrustSignals(html, text) {
    const t = (text || '').toLowerCase();
    const h = (html  || '').toLowerCase();
    return {
        hasGuarantee:   /garantie|satisfait|remboursé|30 jours|money.back|ضمان/.test(t),
        hasDelivery:    /livraison|expédition|shipping|توصيل|شحن/.test(t),
        hasReviews:     /avis|review|étoile|star|note|notation|témoignage|تقييم/.test(t),
        hasSecurity:    /sécurisé|ssl|https|paiement sécurisé|3d secure/i.test(h),
        hasSocialProof: /([\d,]+)\s*(clients|utilisateurs|membres|abonnés)/i.test(t),
        hasContact:     /téléphone|whatsapp|email|contact|support/.test(t),
        hasPhone:       /\+\d{6,}|0[56789]\d{8}/.test(t),
        hasWhatsApp:    /whatsapp|wa\.me/.test(h),
        hasFAQ:         /\bfaq\b|foire.aux.questions|أسئلة.شائعة/.test(t),
    };
}

function detectPageType(text, html) {
    const t = (text || '').toLowerCase();
    if (/\d+\s*(mad|dh|€|\$|درهم)/.test(t) && /(plan|formule|pack|starter|pro|premium|abonnement|pricing)/i.test(t)) return 'pricing';
    if (/(payer|paiement|carte|iban|checkout|payment|cvv)/i.test(t)) return 'checkout';
    if (/(ajouter au panier|add to cart|acheter maintenant|buy now|commander)/i.test(t)) return 'product';
    if (/(programme|formation|coaching|accompagnement|solution|service)/i.test(t)) return 'landing';
    if (/(article|lire la suite|publié le|rédigé par|auteur|blog)/i.test(t)) return 'content';
    if (/(contact|about|équipe|carrière|mention|legal|privacy)/i.test(t)) return 'info';
    return 'unknown';
}

function buildSummary(prices, pageType, text) {
    if (!prices.length) return `Page ${pageType}. Aucun prix détecté.`;
    const vals = prices.map((p) => p.value);
    const cur  = prices[0]?.currency || 'MAD';
    const range = vals.length > 1 ? `${Math.min(...vals)}–${Math.max(...vals)}` : vals[0];
    return `Page ${pageType} : ${prices.length} prix trouvé(s) — ${range} ${cur}`;
}

function buildNegativeSummary(pageType) {
    const map = {
        content: 'Article de blog. Aucun prix. Aucun plan. Hors scope.',
        info:    'Page info (contact, about, legal). Hors scope.',
        unknown: 'Page non catégorisée. Aucun signal commercial.',
    };
    return map[pageType] || `Page ${pageType}. Aucune donnée commerciale.`;
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 2 — SUB-BOT (1 tab = 1 page = 1 verdict)
// Budget: 5s max | scroll x1 | texte + HTML | YES/NO/MAYBE
// ═══════════════════════════════════════════════════════════════════

async function runSubBot(tab, candidate) {
    const startMs = Date.now();

    try {
        await tab.goto(candidate.href, { waitUntil: 'domcontentloaded', timeout: PARALLEL_CONFIG.subTimeout });
        await safeScroll(tab, 0.5);

        const text    = await tab.evaluate(() => document.body?.innerText || '');
        const html    = await tab.content();
        const elapsed = Date.now() - startMs;

        const prices   = extractPricesFromText(text);
        const trust    = extractTrustSignals(html, text);
        const pageType = detectPageType(text, html);

        // ── YES ──────────────────────────────────────────────────
        if (prices.length > 0 || pageType === 'pricing' || pageType === 'checkout') {
            return {
                verdict:    'YES',
                url:        candidate.href,
                score:      candidate.score,
                type:       pageType,
                confidence: prices.length >= 2 ? 'high' : 'medium',
                elapsed,
                data: {
                    prices,
                    plans:   extractPlans(text),
                    trust,
                    ctas:    extractCTAs(text),
                    summary: buildSummary(prices, pageType, text),
                },
            };
        }

        // ── MAYBE ─────────────────────────────────────────────────
        if (pageType === 'landing' || pageType === 'product' || /tarif|prix|coût|investissement/i.test(text)) {
            return {
                verdict:    'MAYBE',
                url:        candidate.href,
                score:      candidate.score,
                type:       pageType,
                confidence: 'medium',
                elapsed,
                data: {
                    prices:      [],
                    partialText: text.slice(0, 300),
                    summary:     `Page ${pageType} sans prix chiffré — contact ou tarif sur demande probable.`,
                },
            };
        }

        // ── NO ────────────────────────────────────────────────────
        return {
            verdict:    'NO',
            url:        candidate.href,
            score:      candidate.score,
            type:       pageType,
            confidence: 'high',
            elapsed,
            data:       null,
            summary:    buildNegativeSummary(pageType),
        };

    } catch (err) {
        return {
            verdict:    'NO',
            url:        candidate.href,
            score:      candidate.score,
            type:       'error',
            confidence: 'low',
            elapsed:    Date.now() - startMs,
            data:       null,
            summary:    `Inaccessible: ${String(err.message).slice(0, 80)}`,
        };
    }
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 3 — ORCHESTRATEUR PRINCIPAL
// home → candidats → vagues de 3 sub-bots → synthèse
// ═══════════════════════════════════════════════════════════════════

async function orchestrateFunnelExploration(url, options = {}) {
    const cfg       = { ...PARALLEL_CONFIG, ...options };
    const startTime = Date.now();
    const allResults = [];

    console.log(`[Orchestrator] ▶ START → ${url}`);

    const browser = await launchOrchestBrowser();

    try {
        // ── BOT PRINCIPAL : lit la home ───────────────────────────
        const mainContext = await browser.newContext({
            userAgent: USER_AGENT, locale: 'fr-FR',
            timezoneId: 'Africa/Casablanca',
            viewport: { width: 1280, height: 800 },
            ignoreHTTPSErrors: true,
        });

        // Block images/media to speed up
        await mainContext.route('**/*', (route) => {
            if (['image', 'media', 'font'].includes(route.request().resourceType())) return route.abort();
            return route.continue();
        });

        const mainTab = await mainContext.newPage();
        await mainTab.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.domTimeout });
        await safeScroll(mainTab, 0.3);

        const allCandidates  = await detectAllCandidates(mainTab);
        const topCandidates  = allCandidates.slice(0, cfg.maxCandidates);
        await mainTab.close();

        console.log(`[Orchestrator] ${topCandidates.length} candidats détectés`);
        topCandidates.forEach((c, i) => console.log(`  [${i+1}] score=${c.score} → ${c.slug} "${c.text}"`));

        // ── SUB-BOTS : vagues de 3 tabs ───────────────────────────
        const batches = chunkArray(topCandidates, cfg.batchSize);

        for (let bi = 0; bi < batches.length; bi++) {
            const elapsed = Date.now() - startTime;
            if (elapsed > cfg.totalBudgetMs) {
                console.log(`[Orchestrator] Budget temps épuisé (${elapsed}ms / ${cfg.totalBudgetMs}ms)`);
                break;
            }

            const batch = batches[bi];
            console.log(`[Orchestrator] Vague ${bi + 1}/${batches.length} → ${batch.length} sub-bots`);

            // Créer N tabs dans le MÊME context (1 browser = mémoire contrôlée)
            const subContext = await browser.newContext({
                userAgent: USER_AGENT, locale: 'fr-FR',
                timezoneId: 'Africa/Casablanca',
                viewport: { width: 1280, height: 800 },
                ignoreHTTPSErrors: true,
            });
            await subContext.route('**/*', (route) => {
                if (['image', 'media', 'font'].includes(route.request().resourceType())) return route.abort();
                return route.continue();
            });

            const tabs = await Promise.all(batch.map(() => subContext.newPage()));

            const batchResults = await Promise.allSettled(
                batch.map((candidate, i) => runSubBot(tabs[i], candidate))
            );

            // Fermer tous les tabs + context de la vague
            await Promise.all(tabs.map((t) => t.close().catch(() => {})));
            await subContext.close().catch(() => {});

            batchResults.forEach((r, idx) => {
                if (r.status === 'fulfilled') {
                    allResults.push(r.value);
                    const v = r.value;
                    console.log(`  [SubBot] ${v.verdict} (${v.confidence}) → ${batch[idx].slug} | prices=${v.data?.prices?.length || 0} | ${v.elapsed}ms`);
                } else {
                    const crashResult = {
                        verdict: 'NO', url: batch[idx].href, score: batch[idx].score,
                        type: 'crash', confidence: 'low', elapsed: 0, data: null,
                        summary: `Crash: ${String(r.reason?.message || 'unknown').slice(0, 60)}`,
                    };
                    allResults.push(crashResult);
                    console.log(`  [SubBot] CRASH → ${batch[idx].slug}: ${r.reason?.message}`);
                }
            });
        }

        // ── SYNTHÈSE ──────────────────────────────────────────────
        const totalElapsed = Date.now() - startTime;
        const synthesis = synthesizeResults(allResults, url, totalElapsed);

        console.log(`[Orchestrator] ✅ DONE in ${totalElapsed}ms | YES=${synthesis.yesCount} MAYBE=${synthesis.maybeCount} NO=${synthesis.noCount} | prices=${synthesis.funnelAnalysis.prices.length}`);

        return synthesis;

    } finally {
        await browser.close().catch(() => {});
    }
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 4 — SYNTHÈSE FINALE
// Remplit DEUX couches: funnelAnalysis + commerceExploration
// ═══════════════════════════════════════════════════════════════════

function mergedTrustSignals(trustArray) {
    const merged = { hasGuarantee: false, hasDelivery: false, hasReviews: false, hasSecurity: false, hasSocialProof: false, hasContact: false, hasPhone: false, hasWhatsApp: false, hasFAQ: false };
    (trustArray || []).forEach((t) => {
        if (!t) return;
        Object.keys(merged).forEach((k) => { if (t[k]) merged[k] = true; });
    });
    return merged;
}

function synthesizeResults(results, originUrl, totalElapsed) {
    const YES   = results.filter((r) => r.verdict === 'YES');
    const MAYBE = results.filter((r) => r.verdict === 'MAYBE');
    const NO    = results.filter((r) => r.verdict === 'NO');

    const allPrices = YES.flatMap((r) => r.data?.prices || []);
    const allTrust  = mergedTrustSignals(YES.map((r) => r.data?.trust));

    // Price stats
    const priceValues = allPrices.map((p) => p.value).filter((v) => v > 0).sort((a, b) => a - b);
    const priceStats = priceValues.length ? {
        min:       priceValues[0],
        max:       priceValues[priceValues.length - 1],
        avg:       Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length),
        median:    priceValues[Math.floor(priceValues.length / 2)],
        count:     priceValues.length,
        currencies: [...new Set(allPrices.map((p) => p.currency))],
    } : null;

    const positioning = priceStats
        ? priceStats.avg < 200  ? 'low-cost'
        : priceStats.avg < 500  ? 'mid-range'
        : 'premium'
        : 'unknown';

    return {
        success:       true,
        originUrl,

        exploration: {
            pagesExplored:  results.length,
            pagesWithData:  YES.length,
            pagesUncertain: MAYBE.length,
            pagesEmpty:     NO.length,
            totalElapsedMs: totalElapsed,
        },

        // Couche 1 — directement consommable par l'IA d'analyse
        funnelAnalysis: {
            prices:       allPrices,
            priceStats,
            positioning,
            confidence:   YES.length >= 2 ? 'high' : YES.length === 1 ? 'medium' : 'low',
            trustSignals: allTrust,
            plansFound:   [...new Set(YES.flatMap((r) => r.data?.plans || []))],
            ctasFound:    [...new Set(YES.flatMap((r) => r.data?.ctas  || []))],
        },

        // Couche 2 — traçabilité complète + signaux MAYBE pour l'IA
        commerceExploration: {
            evidenceLinks: YES.map((r) => ({
                url:        r.url,
                type:       r.type,
                confidence: r.confidence,
                priceCount: r.data?.prices?.length || 0,
                prices:     r.data?.prices || [],
                plans:      r.data?.plans  || [],
                ctas:       r.data?.ctas   || [],
                trust:      r.data?.trust  || {},
                elapsedMs:  r.elapsed,
                summary:    r.data?.summary,
            })),
            uncertainLinks: MAYBE.map((r) => ({
                url:         r.url,
                type:        r.type,
                confidence:  r.confidence,
                partialText: r.data?.partialText,
                summary:     r.data?.summary,
            })),
            negativeSummaries: NO.map((r) => ({
                url:    r.url,
                type:   r.type,
                reason: r.summary,
            })),
        },

        yesCount:   YES.length,
        maybeCount: MAYBE.length,
        noCount:    NO.length,
    };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    orchestrateFunnelExploration,
    synthesizeResults,
    extractPricesFromText,
    extractPlans,
    extractCTAs,
    extractTrustSignals,
    detectPageType,
    PARALLEL_CONFIG,
};
