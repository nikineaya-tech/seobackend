'use strict';

const crypto = require('crypto');

const PROVIDER_GROQ = 'groq';
const DEFAULT_GROQ_MODEL = process.env.GROQ_PROMPT_TO_CODE_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function groqHeader(headers, name) {
  return headers?.get?.(name) || null;
}

function groqRateLimitFromHeaders(headers) {
  const rateLimit = {
    limitRequests: groqHeader(headers, 'x-ratelimit-limit-requests'),
    remainingRequests: groqHeader(headers, 'x-ratelimit-remaining-requests'),
    resetRequests: groqHeader(headers, 'x-ratelimit-reset-requests'),
    limitTokens: groqHeader(headers, 'x-ratelimit-limit-tokens'),
    remainingTokens: groqHeader(headers, 'x-ratelimit-remaining-tokens'),
    resetTokens: groqHeader(headers, 'x-ratelimit-reset-tokens'),
    retryAfter: groqHeader(headers, 'retry-after')
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

function purifyGroqUserInput(value) {
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

function parseGroqUserSignals(prompt) {
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

function buildGroqSystemPrompt(signals) {
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

Quality bar:
- Premium SaaS/e-commerce aesthetics.
- Mobile-first.
- Accessible contrast and focus.
- Clean class names.
- No hidden backend URLs, secrets, internal logs, or technical infrastructure details.`;
}

function buildGroqPersonalizedPrompt(rawPrompt, signals) {
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

function validateGroqKey(apiKey) {
  const value = String(apiKey || '').trim();
  if (!/^gsk_[A-Za-z0-9_-]{20,}$/.test(value)) {
    const error = new Error('INVALID_GROQ_API_KEY');
    error.status = 400;
    throw error;
  }
  return value;
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

async function getUserProviderKey(supabase, userId, provider = PROVIDER_GROQ) {
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

  app.get('/api/user-api-keys/groq/status', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const row = await getUserProviderKey(supabase, req.user.id);
      res.json({
        success: true,
        connected: Boolean(row && row.status === 'active'),
        provider: PROVIDER_GROQ,
        maskedKey: row ? maskKey(row.key_last4) : null,
        updatedAt: row?.updated_at || null,
        model: DEFAULT_GROQ_MODEL
      });
    } catch (error) {
      console.error('[UserKeys] status failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_STATUS_FAILED');
      if (setup.error === 'USER_API_KEYS_TABLE_MISSING') {
        return res.json({
          success: true,
          connected: false,
          provider: PROVIDER_GROQ,
          setupRequired: true,
          error: setup.error,
          message: setup.message,
          model: DEFAULT_GROQ_MODEL
        });
      }
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.post('/api/user-api-keys/groq', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const apiKey = validateGroqKey(req.body?.apiKey);
      const encrypted = encryptSecret(apiKey);
      const record = {
        user_id: req.user.id,
        provider: PROVIDER_GROQ,
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
        provider: PROVIDER_GROQ,
        maskedKey: maskKey(data.key_last4),
        updatedAt: data.updated_at
      });
    } catch (error) {
      console.error('[UserKeys] save failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_SAVE_FAILED');
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.delete('/api/user-api-keys/groq', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', req.user.id)
        .eq('provider', PROVIDER_GROQ);
      if (error) throw error;
      res.json({ success: true, connected: false, provider: PROVIDER_GROQ });
    } catch (error) {
      console.error('[UserKeys] delete failed:', error.message);
      const setup = userKeySetupError(error, 'USER_KEY_DELETE_FAILED');
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });

  app.post('/api/prompt-to-code/groq', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const prompt = purifyGroqUserInput(req.body?.prompt || '');
      if (prompt.length < 80) return res.status(400).json({ success: false, error: 'PROMPT_TOO_SHORT' });
      const promptSignals = parseGroqUserSignals(prompt);
      const systemPrompt = buildGroqSystemPrompt(promptSignals);
      const personalizedPrompt = buildGroqPersonalizedPrompt(prompt, promptSignals);
      const row = await getUserProviderKey(supabase, req.user.id);
      if (!row || row.status !== 'active') return res.status(400).json({ success: false, error: 'GROQ_KEY_NOT_CONNECTED' });
      const apiKey = decryptSecret(row);
      const model = String(req.body?.model || DEFAULT_GROQ_MODEL).trim();
      const maxTokens = Math.min(4096, Math.max(512, Number(req.body?.maxTokens || 2200)));
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          temperature: Number.isFinite(Number(req.body?.temperature)) ? Number(req.body.temperature) : 0.25,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            { role: 'user', content: personalizedPrompt }
          ]
        })
      });
      const payload = await response.json().catch(() => ({}));
      const rateLimit = groqRateLimitFromHeaders(response.headers);
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: payload?.error?.message || 'GROQ_REQUEST_FAILED',
          rateLimit
        });
      }
      res.json({
        success: true,
        provider: PROVIDER_GROQ,
        model,
        content: payload?.choices?.[0]?.message?.content || '',
        promptMeta: {
          task: promptSignals.task,
          language: promptSignals.language,
          constraints: promptSignals.constraints,
          codeTargets: promptSignals.codeTargets,
          isAnswerToPreviousQuestions: promptSignals.isAnswerToPreviousQuestions
        },
        usage: payload?.usage || null,
        rateLimit
      });
    } catch (error) {
      console.error('[Groq] prompt-to-code failed:', error.message);
      const setup = userKeySetupError(error, 'GROQ_PROMPT_FAILED');
      res.status(setup.status).json({ success: false, error: setup.error, message: setup.message });
    }
  });
}

module.exports = { registerUserApiKeyRoutes };
