'use strict';

function stpText(value, max = 220) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function localizeStpSubjectForReport(value = '', lang = 'fr') {
  const raw = stpText(value, 700);
  if (!raw || lang !== 'ar') return raw;
  if (/[\u0600-\u06FF]/.test(raw) && !/[a-zA-Z]/.test(raw)) return raw;
  let text = raw.toLowerCase();
  const replacements = [
    [/agence\s+marketing\s+ia|ai\s+marketing\s+agency/g, 'وكالة تسويق بالذكاء الاصطناعي'],
    [/agence\s+marketing/g, 'وكالة تسويق'],
    [/marketing\s+ia|ia\s+marketing|ai\s+marketing/g, 'تسويق بالذكاء الاصطناعي'],
    [/intelligence\s+artificielle|artificial\s+intelligence|\bia\b|\bai\b/g, 'الذكاء الاصطناعي'],
    [/projecteur\s+solaire|solar\s+projector|solar\s+flood\s*light/g, 'كشاف شمسي'],
    [/projecteur/g, 'كشاف'],
    [/solaire|solar/g, 'شمسي'],
    [/logiciel\s+de\s+gestion|management\s+software/g, 'برنامج إدارة'],
    [/\bsaas\b/g, 'برنامج ساس'],
    [/e[\s-]?commerce/g, 'تجارة إلكترونية'],
    [/formation|course|training/g, 'تكوين'],
    [/audit/g, 'تدقيق'],
    [/funnel/g, 'مسار البيع'],
    [/seo/g, 'تحسين محركات البحث'],
    [/blackheads?|points?\s+noirs?|الرؤوس السوداء/g, 'الرؤوس السوداء'],
    [/extratecteur|extracteur|extractor|remover|مستخرج/g, 'مزيل'],
    [/delivery\s+area|served\s+area|served\s+cities?|served\s+city\s+list/g, 'منطقة التوصيل'],
    [/response\s+time|announced\s+delivery\s+time|announced\s+delivery\s+window/g, 'مدة التسليم'],
    [/local\s+contact|local\s+support\s+channel|support\s+channel/g, 'قناة الدعم المحلي'],
    [/comparison\s+table/g, 'جدول مقارنة'],
    [/competitor\s+differences/g, 'الفروق مع المنافسين'],
    [/objective\s+criteria/g, 'معايير اختيار موضوعية'],
    [/verified\s+(customer\s+)?reviews/g, 'آراء عملاء موثقة'],
    [/warranty\s+terms|guarantee\s+terms/g, 'شروط الضمان'],
    [/visible\s+(delivery\s+or\s+)?result\s+proof|proof-led\s+confidence/g, 'دليل نتيجة واضح'],
    [/current\s+price|final\s+price/g, 'السعر النهائي'],
    [/win\s+with\s+local\s+availability\s+and\s+faster\s+response/g, 'اربح بالتوفر المحلي والرد الأسرع'],
    [/make\s+delivery\s+or\s+access\s+concrete/g, 'اجعل التوصيل أو الوصول محددا'],
    [/show\s+total\s+cost\s+and\s+savings\s+clearly/g, 'أظهر التكلفة النهائية والتوفير بوضوح'],
    [/compare\s+against\s+the\s+current\s+alternatives/g, 'قارن بوضوح مع البدائل الموجودة'],
    [/\bde\s+(?=الرؤوس السوداء)/g, '']
  ];
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  text = text
    .replace(/\b(tunisie|tunisia)\b/g, 'تونس')
    .replace(/\b(maroc|morocco)\b/g, 'المغرب')
    .replace(/\b(libye|libya)\b/g, 'ليبيا')
    .replace(/\b(france)\b/g, 'فرنسا')
    .replace(/\b(usa|united states|états-unis)\b/g, 'الولايات المتحدة')
    .replace(/[,_|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /[a-z]{3,}/i.test(text) && !/[\u0600-\u06FF]/.test(text) ? raw : text || raw;
}

function isWeakStpClientText(value = '') {
  const text = stpText(value, 700);
  if (!text) return true;
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(null|undefined|---|--|-|n\/a|na|nan|none|empty|non disponible|not available|غير متوفر|لا يوجد|aucun)$/i.test(text)) return true;
  if (/^ev_\d+$/i.test(text)) return true;
  if (/^(proof|evidence|hook|channel|experiment|persona|angle|offer|market|result|demo|case|cta)$/i.test(text)) return true;
  if (/^(clear offer proof|price or terms clarity|proof source or proof need|short evidence from input|same id from input|same or sharper angle name)$/i.test(normalized)) return true;
  if (/^(delivery area|response time|local contact|comparison table|competitor differences|objective criteria|verified reviews|verified customer reviews|warranty terms|visible delivery or result proof|guarantee terms|visible result proof|current price|old price if true|total cost and conditions|before-after|before-after proof|case or customer proof|customer or real-use case|real demonstration|local seo|win with local availability and faster response|make delivery or access concrete|show total cost and savings clearly|compare against the current alternatives)$/i.test(normalized)) return true;
  if (/^(دليل|القناة|الشخصية|العرض|السوق|hook|cta)$/i.test(text)) return true;
  return false;
}

function sanitizeStpClientBranch(value, lang = 'fr', key = '') {
  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeStpClientBranch(item, lang, key))
      .filter(item => {
        if (item === '' || item === null || item === undefined) return false;
        if (Array.isArray(item)) return item.length > 0;
        if (typeof item === 'object') return Object.keys(item).length > 0;
        return true;
      });
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([childKey, childValue]) => {
      const cleaned = sanitizeStpClientBranch(childValue, lang, childKey);
      if (cleaned === '' || cleaned === null || cleaned === undefined) return;
      if (Array.isArray(cleaned) && !cleaned.length) return;
      if (typeof cleaned === 'object' && !Array.isArray(cleaned) && !Object.keys(cleaned).length) return;
      out[childKey] = cleaned;
    });
    return out;
  }
  if (typeof value === 'string') {
    if (isWeakStpClientText(value)) return '';
    const max = ['attackAngle', 'attackFormula', 'summary', 'statement', 'action', 'formula', 'positioning'].includes(key) ? 700 : 260;
    const text = stpText(value, max);
    return lang === 'ar' ? localizeStpSubjectForReport(text, lang) : text;
  }
  return value;
}

function sanitizeStpDecisionForClient(decision = {}, lang = 'fr') {
  const clean = { ...decision };
  [
    'personaCards',
    'marketingAngles',
    'ultimateAttackAngles',
    'problemsJtbdUseCases',
    'personaAngleMappings',
    'actionPlan',
    'decisionCards'
  ].forEach(key => {
    if (clean[key] !== undefined) clean[key] = sanitizeStpClientBranch(clean[key], lang, key);
  });
  if (clean.positioning) clean.positioning = sanitizeStpClientBranch(clean.positioning, lang, 'positioning');
  if (clean.persona) clean.persona = sanitizeStpClientBranch(clean.persona, lang, 'persona');
  if (clean.productUnderstanding) clean.productUnderstanding = sanitizeStpClientBranch(clean.productUnderstanding, lang, 'productUnderstanding');
  return clean;
}

module.exports = {
  sanitizeStpDecisionForClient,
  sanitizeStpClientBranch,
  isWeakStpClientText,
  localizeStpSubjectForReport
};
