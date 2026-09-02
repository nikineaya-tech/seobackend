/*!
 * Daka Ads Optimizer Client
 * Frontend helper for externally hosted pages.
 * Requires no OpenRouter key in the browser.
 */
(function attachDakaAdsOptimizer(global) {
  'use strict';

  const DEFAULT_API_BASE = 'https://seobackend-f81n.onrender.com';
  const MAX_UPLOAD_ROWS = 1000;

  const VERDICTS = Object.freeze({
    CONTINUE_AND_SCALE: {
      label: 'Continuer / scaler',
      title: 'Le produit et la campagne peuvent être poursuivis.',
      tone: 'success',
      color: '#22c55e'
    },
    TEST_UNDER_CONDITIONS: {
      label: 'Tester sous conditions',
      title: 'La décision n’est pas encore assez prouvée.',
      tone: 'warning',
      color: '#f59e0b'
    },
    STOP_OR_REBUILD: {
      label: 'Stopper / reconstruire',
      title: 'La campagne ne mérite pas d’être poursuivie telle quelle.',
      tone: 'danger',
      color: '#ef4444'
    }
  });

  function cleanApiBase(value) {
    return String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
  }

  function numberOrEmpty(value) {
    if (value === null || value === undefined || value === '') return '';
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function formatMoney(value, locale = 'fr-FR') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(parsed);
  }

  function formatRatio(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    return `${parsed.toFixed(2)}x`;
  }

  function formatPercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    return `${parsed.toFixed(2)}%`;
  }

  function parseCsvLine(line, delimiter = ',') {
    const cells = [];
    let cell = '';
    let insideQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  function parseCsv(text) {
    const lines = String(text || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(line => line.trim());
    if (!lines.length) return [];
    const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const headers = parseCsvLine(lines[0], delimiter).map(header => header.trim());
    return lines.slice(1).map(line => {
      const cells = parseCsvLine(line, delimiter);
      return headers.reduce((row, header, index) => {
        row[header || `column_${index + 1}`] = cells[index] ?? '';
        return row;
      }, {});
    });
  }

  async function parseCampaignFile(file) {
    if (!file) throw new Error('Aucun fichier sélectionné.');
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.csv')) {
      return parseCsv(await file.text()).slice(0, MAX_UPLOAD_ROWS);
    }
    if (!global.XLSX?.read) {
      throw new Error('XLSX non chargé. Ajoute xlsx.full.min.js avant daka-ads-optimizer-client.js.');
    }
    const workbook = global.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    return global.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' }).slice(0, MAX_UPLOAD_ROWS);
  }

  function getVerdictCopy(verdict) {
    return VERDICTS[verdict] || VERDICTS.TEST_UNDER_CONDITIONS;
  }

  function buildProductEconomics(input = {}) {
    return {
      price: numberOrEmpty(input.price ?? input.sellingPrice),
      cogs: numberOrEmpty(input.cogs ?? input.productCost),
      shipping: numberOrEmpty(input.shipping ?? input.shippingCost),
      fees: numberOrEmpty(input.fees ?? input.paymentFees),
      returnRate: numberOrEmpty(input.returnRate ?? input.refundRate),
      targetCpa: numberOrEmpty(input.targetCpa ?? input.targetCPA)
    };
  }

  function assertProductReady(product) {
    const missing = [];
    if (!(Number(product.price) > 0)) missing.push('prix de vente');
    if (!(Number(product.cogs) >= 0)) missing.push('coût produit');
    if (!(Number(product.shipping) >= 0)) missing.push('livraison');
    if (!(Number(product.fees) >= 0)) missing.push('frais');
    if (missing.length) {
      throw new Error(`Champs produit manquants: ${missing.join(', ')}.`);
    }
  }

  async function createSupabaseAuthClient(options = {}) {
    const apiBase = cleanApiBase(options.apiBase || global.DAKA_API_BASE_URL);
    const supabaseFactory = options.supabaseFactory || global.supabase?.createClient;
    if (!supabaseFactory) {
      throw new Error('Supabase JS non chargé. Ajoute @supabase/supabase-js avant ce script.');
    }
    const response = await fetch(`${apiBase}/auth/config`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    const config = await response.json();
    if (!response.ok || !config.enabled || !config.supabaseUrl || !config.anonKey) {
      throw new Error('Authentification Supabase indisponible côté backend.');
    }
    return supabaseFactory(config.supabaseUrl, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
  }

  async function getSupabaseAccessToken(authClient) {
    if (!authClient?.auth?.getSession) return null;
    const { data } = await authClient.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function loginWithGoogle(authClient, redirectTo = global.location?.href) {
    if (!authClient?.auth?.signInWithOAuth) throw new Error('Client Supabase non initialisé.');
    const { error } = await authClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) throw error;
  }

  async function analyzeCampaigns(options = {}) {
    const apiBase = cleanApiBase(options.apiBase || global.DAKA_API_BASE_URL);
    const campaigns = Array.isArray(options.campaigns) ? options.campaigns : [];
    if (!campaigns.length) throw new Error('Aucune campagne à analyser.');
    const product = buildProductEconomics(options.product || {});
    assertProductReady(product);
    const accessToken = options.accessToken || (options.authClient ? await getSupabaseAccessToken(options.authClient) : null);
    if (!accessToken) throw new Error('Connexion requise avant analyse.');
    const response = await fetch(`${apiBase}/api/analyze-campaigns`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        platform: options.platform || 'multi-platform',
        language: options.language || 'fr',
        product,
        campaigns
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || payload.error || `Analyse impossible (${response.status}).`);
    }
    return payload;
  }

  function renderDecisionHtml(result, options = {}) {
    const locale = options.locale || 'fr-FR';
    const decision = result?.decision || {};
    const copy = getVerdictCopy(decision.verdict);
    const campaignRows = Array.isArray(result?.campaignDecisions) ? result.campaignDecisions : [];
    return `
      <section class="daka-ads-result daka-ads-result--${copy.tone}" data-verdict="${escapeHtml(decision.verdict || '')}">
        <div class="daka-ads-verdict" style="border-color:${copy.color};">
          <span class="daka-ads-pill" style="background:${copy.color}22;color:${copy.color};">${escapeHtml(copy.label)} · confiance ${escapeHtml(decision.confidence || '—')}</span>
          <h2>${escapeHtml(copy.title)}</h2>
          <p>${escapeHtml(decision.reason || '')}</p>
          <p><strong>Action :</strong> ${escapeHtml(decision.nextAction || '')}</p>
          <div class="daka-ads-kpis">
            <div><small>Dépense</small><strong>${formatMoney(result?.metrics?.spend, locale)}</strong></div>
            <div><small>ROAS observé</small><strong>${formatRatio(decision.observedRoas)}</strong></div>
            <div><small>ROAS équilibre</small><strong>${formatRatio(decision.breakEvenRoas)}</strong></div>
            <div><small>CPA observé</small><strong>${decision.observedCpa == null ? '—' : formatMoney(decision.observedCpa, locale)}</strong></div>
            <div><small>CPA cible</small><strong>${decision.targetCpa == null ? '—' : formatMoney(decision.targetCpa, locale)}</strong></div>
            <div><small>Profit pub estimé</small><strong>${decision.estimatedAdProfit == null ? '—' : formatMoney(decision.estimatedAdProfit, locale)}</strong></div>
          </div>
        </div>
        <div class="daka-ads-table-wrap">
          <table class="daka-ads-table">
            <thead>
              <tr>
                <th>Campagne</th>
                <th>Décision</th>
                <th>Dépense</th>
                <th>Ventes</th>
                <th>CTR</th>
                <th>CPA</th>
                <th>ROAS</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${campaignRows.map(item => {
                const rowCopy = getVerdictCopy(item?.decision?.verdict);
                return `<tr>
                  <td>${escapeHtml(item?.name || 'Campagne')}</td>
                  <td><span class="daka-ads-pill" style="background:${rowCopy.color}22;color:${rowCopy.color};">${escapeHtml(rowCopy.label)}</span></td>
                  <td>${formatMoney(item?.metrics?.spend, locale)}</td>
                  <td>${formatMoney(item?.metrics?.revenue, locale)}</td>
                  <td>${formatPercent(item?.metrics?.ctr)}</td>
                  <td>${item?.metrics?.cpa == null ? '—' : formatMoney(item.metrics.cpa, locale)}</td>
                  <td>${formatRatio(item?.metrics?.roas)}</td>
                  <td>${escapeHtml(item?.decision?.nextAction || '')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function injectDefaultStyles() {
    if (global.document?.getElementById('daka-ads-optimizer-styles')) return;
    const style = global.document.createElement('style');
    style.id = 'daka-ads-optimizer-styles';
    style.textContent = `
      .daka-ads-result{display:grid;gap:16px;color:#e5eefb;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .daka-ads-verdict{border:1px solid rgba(148,163,184,.22);border-radius:24px;padding:20px;background:rgba(15,23,42,.92)}
      .daka-ads-verdict h2{margin:14px 0 8px;font-size:clamp(1.35rem,3vw,2.1rem);line-height:1.05}
      .daka-ads-verdict p{color:#cbd5e1;line-height:1.55}
      .daka-ads-pill{display:inline-flex;border-radius:999px;padding:6px 10px;font-weight:900;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em}
      .daka-ads-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin-top:16px}
      .daka-ads-kpis div{border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:12px;background:rgba(2,6,23,.36)}
      .daka-ads-kpis small{display:block;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:.66rem}
      .daka-ads-kpis strong{display:block;margin-top:6px}
      .daka-ads-table-wrap{overflow:auto;border:1px solid rgba(148,163,184,.18);border-radius:18px}
      .daka-ads-table{width:100%;min-width:880px;border-collapse:collapse;background:rgba(15,23,42,.75)}
      .daka-ads-table th,.daka-ads-table td{padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.13);text-align:left;font-size:.88rem}
      .daka-ads-table th{color:#cbd5e1;text-transform:uppercase;letter-spacing:.08em;font-size:.7rem;background:rgba(2,6,23,.34)}
      .daka-ads-table tr:last-child td{border-bottom:0}
    `;
    global.document.head.appendChild(style);
  }

  function collectFields(fieldMap = {}) {
    const read = key => {
      const selector = fieldMap[key] || `[data-daka-${key}]`;
      return global.document?.querySelector(selector)?.value ?? '';
    };
    return {
      price: read('price'),
      cogs: read('cogs'),
      shipping: read('shipping'),
      fees: read('fees'),
      returnRate: read('return-rate'),
      targetCpa: read('target-cpa')
    };
  }

  function bindOptimizerUi(options = {}) {
    injectDefaultStyles();
    const state = {
      apiBase: cleanApiBase(options.apiBase || global.DAKA_API_BASE_URL),
      authClient: options.authClient || null,
      campaigns: [],
      lastResult: null
    };
    const selectors = {
      file: options.fileSelector || '[data-daka-file]',
      analyze: options.analyzeSelector || '[data-daka-analyze]',
      login: options.loginSelector || '[data-daka-login]',
      logout: options.logoutSelector || '[data-daka-logout]',
      status: options.statusSelector || '[data-daka-status]',
      output: options.outputSelector || '[data-daka-output]',
      platform: options.platformSelector || '[data-daka-platform]',
      ...options.selectors
    };
    const find = selector => global.document?.querySelector(selector);
    const setStatus = (message, type = '') => {
      const node = find(selectors.status);
      if (node) {
        node.textContent = message || '';
        node.dataset.status = type;
      }
      if (typeof options.onStatus === 'function') options.onStatus(message, type);
    };
    const setAnalyzeState = () => {
      const button = find(selectors.analyze);
      if (button) button.disabled = !state.campaigns.length;
    };

    createSupabaseAuthClient({ apiBase: state.apiBase })
      .then(client => {
        state.authClient = client;
        setStatus('Auth prête.');
      })
      .catch(error => setStatus(error.message, 'error'));

    find(selectors.file)?.addEventListener('change', async event => {
      try {
        const file = event.target.files?.[0];
        state.campaigns = await parseCampaignFile(file);
        setStatus(`${state.campaigns.length} lignes chargées.`, state.campaigns.length ? 'ok' : 'error');
      } catch (error) {
        state.campaigns = [];
        setStatus(error.message, 'error');
      } finally {
        setAnalyzeState();
      }
    });

    find(selectors.login)?.addEventListener('click', async () => {
      try {
        await loginWithGoogle(state.authClient, options.redirectTo || global.location.href.split('#')[0]);
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });

    find(selectors.logout)?.addEventListener('click', async () => {
      await state.authClient?.auth?.signOut?.();
      setStatus('Déconnecté.');
    });

    find(selectors.analyze)?.addEventListener('click', async () => {
      const button = find(selectors.analyze);
      if (button) button.disabled = true;
      setStatus('Analyse backend en cours…');
      try {
        state.lastResult = await analyzeCampaigns({
          apiBase: state.apiBase,
          authClient: state.authClient,
          campaigns: state.campaigns,
          product: collectFields(options.fieldMap),
          platform: find(selectors.platform)?.value || options.platform || 'multi-platform',
          language: options.language || 'fr'
        });
        const output = find(selectors.output);
        if (output) output.innerHTML = renderDecisionHtml(state.lastResult, { locale: options.locale || 'fr-FR' });
        setStatus('Analyse terminée.', 'ok');
        if (typeof options.onResult === 'function') options.onResult(state.lastResult);
      } catch (error) {
        setStatus(error.message, 'error');
      } finally {
        setAnalyzeState();
      }
    });

    setAnalyzeState();
    return state;
  }

  global.DakaAdsOptimizer = {
    VERDICTS,
    analyzeCampaigns,
    bindOptimizerUi,
    buildProductEconomics,
    createSupabaseAuthClient,
    formatMoney,
    formatPercent,
    formatRatio,
    getSupabaseAccessToken,
    getVerdictCopy,
    injectDefaultStyles,
    loginWithGoogle,
    parseCampaignFile,
    parseCsv,
    renderDecisionHtml
  };
})(window);
