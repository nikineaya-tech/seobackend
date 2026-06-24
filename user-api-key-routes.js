'use strict';

const crypto = require('crypto');

const PROVIDER_GROQ = 'groq';
const DEFAULT_GROQ_MODEL = process.env.GROQ_PROMPT_TO_CODE_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

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
      res.status(500).json({ success: false, error: 'USER_KEY_STATUS_FAILED' });
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
      res.status(error.status || 500).json({ success: false, error: error.message || 'USER_KEY_SAVE_FAILED' });
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
      res.status(500).json({ success: false, error: 'USER_KEY_DELETE_FAILED' });
    }
  });

  app.post('/api/prompt-to-code/groq', requireAuth, async (req, res) => {
    if (!ensureStore(res)) return;
    try {
      const prompt = String(req.body?.prompt || '').trim();
      if (prompt.length < 80) return res.status(400).json({ success: false, error: 'PROMPT_TOO_SHORT' });
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
              content: 'You are a concise senior UI/UX, CRO and frontend HTML/CSS/JS assistant. Ask clarification questions when evidence is missing. Never invent proof, prices, reviews or guarantees.'
            },
            { role: 'user', content: prompt }
          ]
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: payload?.error?.message || 'GROQ_REQUEST_FAILED'
        });
      }
      res.json({
        success: true,
        provider: PROVIDER_GROQ,
        model,
        content: payload?.choices?.[0]?.message?.content || '',
        usage: payload?.usage || null
      });
    } catch (error) {
      console.error('[Groq] prompt-to-code failed:', error.message);
      res.status(error.status || 500).json({ success: false, error: error.message || 'GROQ_PROMPT_FAILED' });
    }
  });
}

module.exports = { registerUserApiKeyRoutes };
