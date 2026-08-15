'use strict';

const crypto = require('crypto');

const PROVIDER_GEMINI = 'gemini';
const PROVIDER_OPENROUTER = 'openrouter';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_PROMPT_TO_CODE_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_CODE_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro'
]);
const GEMINI_FALLBACK_MODELS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_PROMPT_TO_CODE_MODEL || process.env.OPENROUTER_MODEL || 'cohere/north-mini-code';
const OPENROUTER_CODE_MODELS = new Set([
  'cohere/north-mini-code',
  'z-ai/glm-5.2',
  'nvidia/nemotron-3-ultra:free',
  'moonshotai/kimi-k2.7-code',
  'qwen/qwen3.7-plus',
  'qwen/qwen3.7-max',
  'minimax/minimax-m3',
  'stepfun/step-3.7-flash'
]);
const OPENROUTER_FALLBACK_MODELS = [
  DEFAULT_OPENROUTER_MODEL,
  'cohere/north-mini-code',
  'z-ai/glm-5.2',
  'nvidia/nemotron-3-ultra:free'
];

function responseHeader(headers, name) {
  return headers?.get?.(name) || null;
}

function openRouterRateLimitFromHeaders(headers) {
  const rateLimit = {
    limitRequests: responseHeader(headers, 'x-ratelimit-limit-requests') || responseHeader(headers, 'x-ratelimit-limit'),
    remainingRequests: responseHeader(headers, 'x-ratelimit-remaining-requests') || responseHeader(headers, 'x-ratelimit-remaining'),
    resetRequests: responseHeader(headers, 'x-ratelimit-reset-requests') || responseHeader(headers, 'x-ratelimit-reset'),
    limitTokens: responseHeader(headers, 'x-ratelimit-limit-tokens'),
    remainingTokens: responseHeader(headers, 'x-ratelimit-remaining-tokens'),
    resetTokens: responseHeader(headers, 'x-ratelimit-reset-tokens'),
    retryAfter: responseHeader(headers, 'retry-after')
  };
  return Object.fromEntries(Object.entries(rateLimit).filter(([, value]) => value !== null && value !== undefined && value !== ''));
}

function clampText(value, max = 32000) {
  const text = String(value || '');
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.72));
  const tail = text.slice(-Math.floor(max * 0.24));
  return `${head}\n\n[...CONTENU REDUIT PAR DAKA POUR TENIR LE CONTEXTE...]\n\n${tail}`;
}

function purifyCodeUserInput(value) {
  return clampText(String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{5,}/g, '\n\n\n')
    .trim(), 32000);
}

function detectPromptLanguage(text) {
  const value = String(text || '');
  const arCount = (value.match(/[\u0600-\u06FF]/g) || []).length;
  if (arCount > 12) return 'ar';
  if (/\b(francais|français|en français|langue\s*fr|reponds?\s+en\s+francais|réponds?\s+en\s+français)\b/i.test(value)) return 'fr';
  if (/\b(english|anglais|respond\s+in\s+english|reply\s+in\s+english)\b/i.test(value)) return 'en';
  return 'fr';
}

function extractLabeledBlock(text, labels) {
  const value = String(text || '');
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*:\\s*([\\s\\S]{0,2400}?)(?:\\n[A-ZÀ-Ü _-]{4,}\\s*:|$)`, 'i');
    const match = value.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function compactList(items, max = 12) {
  return [...new Set(items.map(item => String(item || '').trim()).filter(Boolean))].slice(0, max);
}

function parseCodeUserSignals(prompt) {
  const text = String(prompt || '');
  const lower = text.toLowerCase();
  const latestUserAsk = extractLabeledBlock(text, ['DEMANDE UTILISATEUR', 'USER REQUEST', 'QUESTION UTILISATEUR', 'INSTRUCTION UTILISATEUR SUPPLEMENTAIRE']);
  const terseAnswers = latestUserAsk
    .split(/[,;|•\n]+/)
    .map(part => part.trim())
    .filter(part => part.length >= 2 && part.length <= 80);
  const countries = compactList([
    ...(text.match(/\b(?:maroc|morocco|libye|libya|france|global english|uae|emirats|émirats|saudi|arabie saoudite)\b/gi) || []),
    ...(text.match(/(?:المغرب|ليبيا|فرنسا|الإمارات|السعودية)/g) || [])
  ], 6);
  const constraints = compactList([
    /cod|cash\s*on\s*delivery|paiement\s+à\s+la\s+livraison|الدفع\s+عند\s+الاستلام/i.test(text) ? 'paiement COD / paiement à la livraison' : '',
    /\b(?:24\s*[-/]?\s*48\s*h|48\s*h|24h|48h|delivery|livraison|توصيل)\b/i.test(text) ? 'délai de livraison à afficher clairement' : '',
    /\b(?:logo\s*trust|trust|confiance|preuve|avis|review|testimonial|témoignage|ضمان|ثقة|تقييم)\b/i.test(text) ? 'preuves de confiance visibles' : '',
    /\b(?:mobile|responsive|android|iphone|هاتف)\b/i.test(text) ? 'mobile-first' : '',
    /\b(?:galaxy|3d|premium|wow|lovable|machine\s*ia)\b/i.test(text) ? 'design premium immersif' : ''
  ]);
  const codeTargets = compactList([
    /\bhtml\b/i.test(text) ? 'HTML' : '',
    /\bcss\b/i.test(text) ? 'CSS' : '',
    /\b(?:js|javascript)\b/i.test(text) ? 'JavaScript' : '',
    /\b(?:page complète|full page|single file|fichier unique)\b/i.test(text) ? 'page complète en fichier unique' : ''
  ]);
  const task = /\b(?:corrige|fix|bug|erreur|ne fonctionne pas|does not work)\b/i.test(lower)
    ? 'debug_fix'
    : /\b(?:genere|génère|build|code|html|css|javascript|reconstruire|refaire)\b/i.test(lower)
      ? 'code_generation'
      : /\b(?:ameliore|améliore|optimise|rends|make|improve)\b/i.test(lower)
        ? 'improvement'
        : 'guided_iteration';
  return {
    language: detectPromptLanguage(text),
    task,
    latestUserAsk: latestUserAsk || terseAnswers.join(', '),
    isAnswerToPreviousQuestions: /\b(?:voici|reponses?|réponses?|mes réponses|answers?|libye|libya|maroc|morocco|cod|48\s*h|logo)\b/i.test(latestUserAsk || text),
    countries,
    constraints,
    codeTargets,
    terseAnswers: compactList(terseAnswers, 10),
    hasExistingCode: /```|<html|<section|<style|function\s+\w+|const\s+\w+|class=/i.test(text),
    wantsPreviewReadyHtml: /\b(?:preview|aperçu|lovable|page complète|single file|fichier unique|html css js)\b/i.test(text)
  };
}

function buildOpenRouterSystemPrompt(signals) {
  const languageName = signals.language === 'ar' ? 'Arabic' : signals.language === 'en' ? 'English' : 'French';
  return `You are Daka AI Code Machine, an elite X10 senior product builder: UI/UX designer, CRO strategist, direct-response copywriter, and frontend HTML/CSS/JS engineer.

Operate in ${languageName}. Be decisive, practical, and implementation-focused.

Core rules:
- Treat short user answers as real project constraints. If the user answers previous questions, do not ask those questions again.
- Ask clarification questions only when a missing detail blocks the work. Maximum 3 questions.
- If enough information exists, produce the plan or code immediately.
- Never invent reviews, prices, guarantees, certifications, stock, delivery, or legal claims. Mark missing proof as "à confirmer" / "to confirm" / "للتأكيد".
- Convert vague inputs into clean builder requirements: market, audience, offer, CTA, trust, delivery, design, mobile, code output.
- For code: prefer a complete, paste-ready, responsive HTML/CSS/JS solution when requested. Keep dependencies light.
- For redesign: preserve proven facts from the source analysis, improve layout, hierarchy, copy, trust, CTA, and mobile UX.
- Return structured sections with clear headings. Avoid generic advice. Avoid repeating questions.
- When the user asks for a Lovable-like result, behave like a focused code builder: brief plan, then code or exact patch.

Output contract for code generation:
- If the request is code generation, return the deliverable first. Do not start with diagnosis, strategy, plan, table, or explanation.
- For complete pages, return exactly one fenced \`\`\`html block containing a full document: <!DOCTYPE html>, <html>, <head>, <style>, <body>, optional <script>, closing </body></html>.
- For split output, use fenced \`\`\`html, \`\`\`css, and \`\`\`javascript blocks.
- Keep commentary after the code only, maximum 3 short bullets, and only when useful.
- Never return raw unformatted code without Markdown fences.
- If the page may exceed the token budget, produce a compact but complete first version. Never cut code in the middle of a CSS rule, HTML tag, or JavaScript function.

Quality bar:
- Premium SaaS/e-commerce aesthetics.
- Mobile-first.
- Accessible contrast and focus.
- Clean class names.
- No hidden backend URLs, secrets, internal logs, or technical infrastructure details.`;
}

function buildOpenRouterPersonalizedPrompt(rawPrompt, signals) {
  const extracted = JSON.stringify({
    task: signals.task,
    language: signals.language,
    latestUserAsk: signals.latestUserAsk,
    isAnswerToPreviousQuestions: signals.isAnswerToPreviousQuestions,
    countries: signals.countries,
    constraints: signals.constraints,
    codeTargets: signals.codeTargets,
    terseAnswers: signals.terseAnswers,
    hasExistingCode: signals.hasExistingCode,
    wantsPreviewReadyHtml: signals.wantsPreviewReadyHtml
  }, null, 2);
  return clampText(`DAKA PROMPT PROCESSOR - INPUT PURIFIE ET PERSONNALISE

Signaux extraits automatiquement:
${extracted}

Instructions de décision:
- Si latestUserAsk contient des réponses concrètes, exploite-les comme réponses aux questions précédentes.
- Si isAnswerToPreviousQuestions=true, ne remercie pas longuement et ne redemande pas les mêmes informations.
- Si codeTargets contient HTML/CSS/JavaScript ou page complète, livre du code exploitable.
- Si le prompt demande de générer sans questions, passe en mode exécution: un seul fichier HTML complet, sans diagnostic avant le code.
- Mode Lovable attendu: produire une page directement prévisualisable en HTML/CSS/JS pur, compacte mais terminée, avec images placeholders propres si les vraies images ne sont pas fournies.
- Si constraints contient livraison/COD/trust/mobile/design, intègre ces contraintes dans la solution.
- Si le prompt contient du code existant, améliore ce code au lieu de repartir en théorie.

Prompt utilisateur nettoyé:
${rawPrompt}`, 30000);
}

function getEncryptionKey() {
  const secret = process.env.USER_SECRET_ENCRYPTION_KEY || process.env.API_KEY_ENCRYPTION_SECRET || '';
  if (!secret || secret.length < 24) {
    const error = new Error('USER_SECRET_ENCRYPTION_KEY_MISSING');
    error.status = 500;
    throw error;
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted_key: encrypted.toString('base64'),
    key_iv: iv.toString('base64'),
    key_tag: tag.toString('base64')
  };
}

function decryptSecret(row) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(row.key_iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(row.key_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_key, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function maskKey(last4) {
  return last4 ? `gsk_****${last4}` : null;
}

function maskOpenRouterKey(last4) {
  return last4 ? `sk-or-v1-****${last4}` : null;
}

function maskGeminiKey(last4) {
  return last4 ? `AIza****${last4}` : null;
}

function validateOpenRouterKey(apiKey) {
  const value = String(apiKey || '').trim();
  if (!/^(sk-or-v1-|sk-)[A-Za-z0-9_-]{20,}$/.test(value)) {
    const error = new Error('INVALID_OPENROUTER_API_KEY');
    error.status = 400;
    throw error;
  }
  return value;
}

function validateGeminiKey(apiKey) {
  const value = String(apiKey || '').trim();
  if (!/^AIza[A-Za-z0-9_-]{20,}$/.test(value) && value.length < 30) {
    const error = new Error('INVALID_GEMINI_API_KEY');
    error.status = 400;
    throw error;
  }
  return value;
}

function resolveGeminiModel(input) {
  const requested = String(input || '').trim();
  if (!requested) return DEFAULT_GEMINI_MODEL;
  return GEMINI_CODE_MODELS.has(requested) ? requested : DEFAULT_GEMINI_MODEL;
}

function buildGeminiModelChain(primary) {
  return [...new Set([resolveGeminiModel(primary), ...GEMINI_FALLBACK_MODELS].filter(Boolean))];
}

function resolveOpenRouterModel(input) {
  const requested = String(input || '').trim();
  if (!requested) return DEFAULT_OPENROUTER_MODEL;
  return OPENROUTER_CODE_MODELS.has(requested) ? requested : DEFAULT_OPENROUTER_MODEL;
}

function buildOpenRouterModelChain(primary) {
  return [...new Set([resolveOpenRouterModel(primary), ...OPENROUTER_FALLBACK_MODELS].filter(Boolean))];
}

async function callGeminiWithFallback({ apiKey, models, systemPrompt, prompt, maxTokens, temperature }) {
  const failures = [];
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.GEMINI_MODEL_TIMEOUT_MS || 60000));
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        failures.push({ model, error: payload?.error?.message || `HTTP_${response.status}` });
        continue;
      }
      const content = (payload?.candidates?.[0]?.content?.parts || [])
        .map(part => part?.text || '')
        .join('')
        .trim();
      if (!content) {
        failures.push({ model, error: payload?.promptFeedback?.blockReason || 'EMPTY_MODEL_RESPONSE' });
        continue;
      }
      return { payload, model, content, fallbacksTried: failures };
    } catch (error) {
      failures.push({ model, error: error?.name === 'AbortError' ? 'MODEL_TIMEOUT_ABORTED' : (error?.message || 'MODEL_REQUEST_FAILED') });
    } finally {
      clearTimeout(timer);
    }
  }
  const error = new Error('GEMINI_ALL_MODELS_FAILED');
  error.status = 502;
  error.failures = failures;
  throw error;
}

async function callOpenRouterWithFallback({ apiKey, models, messages, maxTokens, temperature }) {
  const failures = [];
  let lastRateLimit = {};
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.OPENROUTER_MODEL_TIMEOUT_MS || 45000));
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.PUBLIC_APP_URL || 'https://seo.mktnstrategix.com',
          'X-Title': 'Daka Market Intelligence Spyer'
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages
        })
      });
      const payload = await response.json().catch(() => ({}));
      lastRateLimit = openRouterRateLimitFromHeaders(response.headers);
      if (!response.ok) {
        failures.push({ model, error: payload?.error?.message || `HTTP_${response.status}` });
        continue;
      }
      const content = payload?.choices?.[0]?.message?.content || '';
      if (!String(content).trim()) {
        failures.push({ model, error: 'EMPTY_MODEL_RESPONSE' });
        continue;
      }
      return { payload, model, rateLimit: lastRateLimit, fallbacksTried: failures };
    } catch (error) {
      failures.push({ model, error: error?.name === 'AbortError' ? 'MODEL_TIMEOUT_ABORTED' : (error?.message || 'MODEL_REQUEST_FAILED') });
    } finally {
      clearTimeout(timer);
    }
  }
  const error = new Error('OPENROUTER_ALL_MODELS_FAILED');
  error.status = 502;
  error.failures = failures;
  error.rateLimit = lastRateLimit;
  throw error;
}

function isMissingTableError(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
  return /42P01|PGRST\d+|user_api_keys|relation .* does not exist|schema cache/i.test(text);
}

function userKeySetupError(error, fallback = 'USER_KEY_OPERATION_FAILED') {
  if (isMissingTableError(error)) return {
    status: 503,
    error: 'USER_API_KEYS_TABLE_MISSING',
    message: 'La table Supabase user_api_keys n’est pas encore créée.'
  };
  if (error?.message === 'USER_SECRET_ENCRYPTION_KEY_MISSING') return {
    status: 503,
    error: 'USER_SECRET_ENCRYPTION_KEY_MISSING',
    message: 'La variable Render USER_SECRET_ENCRYPTION_KEY manque ou est trop courte.'
  };
  return {
    status: error?.status || 500,
    error: error?.message || fallback,
    message: null
  };
}

async function getUserProviderKey(supabase, userId, provider = PROVIDER_OPENROUTER) {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('id,provider,encrypted_key,key_iv,key_tag,key_last4,status,updated_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function registerUserApiKeyRoutes(app, { supabase, requireAuth }) {
  const ensureStore = (res) => {
    if (!supabase) {
      res.status(503).json({ success: false, error: 'USER_KEY_STORE_UNAVAILABLE' });
      return false;
    }
    return true;
  };

  app.get('/api/user-api-keys/gemini/status', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const row = await getUserProviderKey(supabase, req.user.id, PROVIDER_GEMINI);
      res.json({
        success: true,
        connected: Boolean(row && row.status === 'active'),
        provider: PROVIDER_GEMINI,
        maskedKey: row ? maskGeminiKey(row.key_last4) : null,
        updatedAt: row?.updated_at || null,
        model: DEFAULT_GEMINI_MODEL,
        models: [...GEMINI_CODE_MODELS]
      });
    } catch (error) {
      console.error('[GeminiKeys] status failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_STATUS_FAILED');
      if (setup.error === 'USER_API_KEYS_TABLE_MISSING') {
        return res.json({
          success: true,
          connected: false,
          provider: PROVIDER_GEMINI,
          setupRequired: true,
          error: setup.error,
          message: setup.message,
          model: DEFAULT_GEMINI_MODEL,
          models: [...GEMINI_CODE_MODELS]
        });
      }
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.post('/api/user-api-keys/gemini', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const apiKey = validateGeminiKey(req.body?.apiKey);
      const encrypted = encryptSecret(apiKey);
      const record = {
        user_id: req.user.id,
        provider: PROVIDER_GEMINI,
        ...encrypted,
        key_last4: apiKey.slice(-4),
        status: 'active',
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('user_api_keys')
        .upsert(record, { onConflict: 'user_id,provider' })
        .select('key_last4,updated_at,status')
        .single();
      if (error) throw error;
      res.json({
        success: true,
        connected: true,
        provider: PROVIDER_GEMINI,
        maskedKey: maskGeminiKey(data.key_last4),
        updatedAt: data.updated_at,
        model: DEFAULT_GEMINI_MODEL,
        models: [...GEMINI_CODE_MODELS]
      });
    } catch (error) {
      console.error('[GeminiKeys] save failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_SAVE_FAILED');
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.delete('/api/user-api-keys/gemini', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', req.user.id)
        .eq('provider', PROVIDER_GEMINI);
      if (error) throw error;
      res.json({ success: true, connected: false, provider: PROVIDER_GEMINI });
    } catch (error) {
      console.error('[GeminiKeys] delete failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_DELETE_FAILED');
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.post('/api/prompt-to-code/gemini', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const prompt = purifyCodeUserInput(req.body?.prompt || '');
      if (prompt.length < 80) return res.status(400).json({ success: false, error: 'PROMPT_TOO_SHORT' });
      const promptSignals = parseCodeUserSignals(prompt);
      const systemPrompt = buildOpenRouterSystemPrompt(promptSignals);
      const personalizedPrompt = buildOpenRouterPersonalizedPrompt(prompt, promptSignals);
      const row = await getUserProviderKey(supabase, req.user.id, PROVIDER_GEMINI);
      if (!row || row.status !== 'active') return res.status(400).json({ success: false, error: 'GEMINI_KEY_NOT_CONNECTED' });
      const apiKey = decryptSecret(row);
      const models = buildGeminiModelChain(req.body?.model);
      const maxTokens = Math.min(65536, Math.max(512, Number(req.body?.maxTokens || 8192)));
      const temperature = Number.isFinite(Number(req.body?.temperature)) ? Number(req.body.temperature) : 0.22;
      const result = await callGeminiWithFallback({
        apiKey,
        models,
        maxTokens,
        temperature,
        systemPrompt,
        prompt: personalizedPrompt
      });
      res.json({
        success: true,
        provider: PROVIDER_GEMINI,
        model: result.model,
        attemptedModels: models,
        fallbacksTried: result.fallbacksTried,
        content: result.content,
        promptMeta: {
          task: promptSignals.task,
          language: promptSignals.language,
          constraints: promptSignals.constraints,
          codeTargets: promptSignals.codeTargets,
          isAnswerToPreviousQuestions: promptSignals.isAnswerToPreviousQuestions
        },
        usage: result.payload?.usageMetadata || null,
        rateLimit: null
      });
    } catch (error) {
      console.error('[Gemini] prompt-to-code failed:', error.message);
      const setup = userKeySetupError(error, 'GEMINI_PROMPT_FAILED');
      res.status(setup.status).json({
        success: false,
        error: setup.error,
        message: setup.message,
        failures: error.failures || null,
        rateLimit: null
      });
    }
  });

  app.get('/api/user-api-keys/openrouter/status', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const row = await getUserProviderKey(supabase, req.user.id, PROVIDER_OPENROUTER);
      res.json({
        success: true,
        connected: Boolean(row && row.status === 'active'),
        provider: PROVIDER_OPENROUTER,
        maskedKey: row ? maskOpenRouterKey(row.key_last4) : null,
        updatedAt: row?.updated_at || null,
        model: DEFAULT_OPENROUTER_MODEL,
        models: [...OPENROUTER_CODE_MODELS]
      });
    } catch (error) {
      console.error('[OpenRouterKeys] status failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_STATUS_FAILED');
      if (setup.error === 'USER_API_KEYS_TABLE_MISSING') {
        return res.json({
          success: true,
          connected: false,
          provider: PROVIDER_OPENROUTER,
          setupRequired: true,
          error: setup.error,
          message: setup.message,
          model: DEFAULT_OPENROUTER_MODEL,
          models: [...OPENROUTER_CODE_MODELS]
        });
      }
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.post('/api/user-api-keys/openrouter', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const apiKey = validateOpenRouterKey(req.body?.apiKey);
      const encrypted = encryptSecret(apiKey);
      const record = {
        user_id: req.user.id,
        provider: PROVIDER_OPENROUTER,
        ...encrypted,
        key_last4: apiKey.slice(-4),
        status: 'active',
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('user_api_keys')
        .upsert(record, { onConflict: 'user_id,provider' })
        .select('key_last4,updated_at,status')
        .single();
      if (error) throw error;
      res.json({
        success: true,
        connected: true,
        provider: PROVIDER_OPENROUTER,
        maskedKey: maskOpenRouterKey(data.key_last4),
        updatedAt: data.updated_at,
        model: DEFAULT_OPENROUTER_MODEL,
        models: [...OPENROUTER_CODE_MODELS]
      });
    } catch (error) {
      console.error('[OpenRouterKeys] save failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_SAVE_FAILED');
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.delete('/api/user-api-keys/openrouter', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', req.user.id)
        .eq('provider', PROVIDER_OPENROUTER);
      if (error) throw error;
      res.json({ success: true, connected: false, provider: PROVIDER_OPENROUTER });
    } catch (error) {
      console.error('[OpenRouterKeys] delete failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_DELETE_FAILED');
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.post('/api/prompt-to-code/openrouter', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const prompt = purifyCodeUserInput(req.body?.prompt || '');
      if (prompt.length < 80) return res.status(400).json({ success: false, error: 'PROMPT_TOO_SHORT' });
      const promptSignals = parseCodeUserSignals(prompt);
      const systemPrompt = buildOpenRouterSystemPrompt(promptSignals);
      const personalizedPrompt = buildOpenRouterPersonalizedPrompt(prompt, promptSignals);
      const row = await getUserProviderKey(supabase, req.user.id, PROVIDER_OPENROUTER);
      if (!row || row.status !== 'active') return res.status(400).json({ success: false, error: 'OPENROUTER_KEY_NOT_CONNECTED' });
      const apiKey = decryptSecret(row);
      const models = buildOpenRouterModelChain(req.body?.model);
      const maxTokens = Math.min(64000, Math.max(512, Number(req.body?.maxTokens || 4096)));
      const temperature = Number.isFinite(Number(req.body?.temperature)) ? Number(req.body.temperature) : 0.22;
      const result = await callOpenRouterWithFallback({
        apiKey,
        models,
        maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: personalizedPrompt }
        ]
      });
      res.json({
        success: true,
        provider: PROVIDER_OPENROUTER,
        model: result.model,
        attemptedModels: models,
        fallbacksTried: result.fallbacksTried,
        content: result.payload?.choices?.[0]?.message?.content || '',
        promptMeta: {
          task: promptSignals.task,
          language: promptSignals.language,
          constraints: promptSignals.constraints,
          codeTargets: promptSignals.codeTargets,
          isAnswerToPreviousQuestions: promptSignals.isAnswerToPreviousQuestions
        },
        usage: result.payload?.usage || null,
        rateLimit: result.rateLimit
      });
    } catch (error) {
      console.error('[OpenRouter] prompt-to-code failed:', error.message);
      const setup = userKeySetupError(error, 'OPENROUTER_PROMPT_FAILED');
      res.status(setup.status).json({
        success: false,
        error: setup.error,
        message: setup.message,
        failures: error.failures || null,
        rateLimit: error.rateLimit || null
      });
    }
  });

}

module.exports = { registerUserApiKeyRoutes };
