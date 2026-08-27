'use strict';

const crypto = require('crypto');
const { evidenceRowsFrom, topicFor } = require('./signal-engine');

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanText(value, max = 1000) {
  return String(value == null ? '' : value)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function parseDate(value) {
  const raw = cleanText(value, 100);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function daysAgo(dateIso, now) {
  const ms = Date.parse(dateIso || '');
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (now.getTime() - ms) / 86400000);
}

function windowFor(row = {}, now = new Date()) {
  const dateIso = parseDate(row.publishedAt) || parseDate(row.collectedAt);
  if (!dateIso) return 'undated';
  const age = daysAgo(dateIso, now);
  if (age == null) return 'undated';
  if (age <= 7) return 'last7d';
  if (age <= 30) return 'last30d';
  if (age <= 90) return 'last90d';
  return 'older';
}

function classifyTemporalSignal(row = {}) {
  const claim = cleanText(row.claimType, 120).toLowerCase();
  const text = cleanText(`${row.claimType || ''} ${row.title || ''} ${row.value || ''}`, 1200).toLowerCase();
  if (/competitor|seller|brand|store|shop|concurrent|vendeur|متجر|منافس/.test(text)) return 'COMPETITOR_ACTIVITY';
  if (/feature|led|usb|level|niveau|mode|خاصية|ميزة|شفط|اضاءة|إضاءة/.test(text)) return 'FEATURE_ACTIVITY';
  if (/hook|headline|message|promise|angle|وعد|رسالة|عنوان/.test(text)) return 'MESSAGE_ACTIVITY';
  if (/pain|problem|complaint|objection|fear|question|review|مشكلة|شكوى|اعتراض|سؤال|خوف/.test(text)) return 'CUSTOMER_VOICE_ACTIVITY';
  if (/offer|price|discount|bundle|delivery|guarantee|refund|عرض|سعر|خصم|توصيل|ضمان/.test(text)) return 'OFFER_ACTIVITY';
  if (/rss|news|trend|temporal/.test(claim)) return 'FRESH_CONTENT_ACTIVITY';
  return 'MARKET_SAMPLE_ACTIVITY';
}

function compactRow(row = {}) {
  return {
    id: cleanText(row.id, 120),
    claimType: cleanText(row.claimType, 100),
    value: cleanText(row.value || row.title, 260),
    sourcePlatform: cleanText(row.sourcePlatform || 'unknown', 80).toLowerCase(),
    sourceUrl: cleanText(row.sourceUrl, 700) || null,
    publishedAt: parseDate(row.publishedAt),
    collectedAt: parseDate(row.collectedAt),
    confidence: cleanText(row.confidence || 'LOW', 20).toUpperCase(),
    verificationStatus: cleanText(row.verificationStatus || 'NOT_VERIFIED', 80).toUpperCase()
  };
}

function sourceDiversity(rows = []) {
  return new Set(rows.map(row => row.sourcePlatform || row.sourceUrl || row.id).filter(Boolean)).size;
}

function countsFor(rows = [], now = new Date()) {
  return rows.reduce((acc, row) => {
    const bucket = windowFor(row, now);
    acc[bucket] += 1;
    if (bucket !== 'undated') acc.dated += 1;
    return acc;
  }, { last7d: 0, last30d: 0, last90d: 0, older: 0, undated: 0, dated: 0 });
}

function buildSampleShift(type, topic, rows, now) {
  const counts = countsFor(rows, now);
  const recentCount = counts.last7d + counts.last30d;
  if (recentCount < 2 || counts.dated < 2) return null;
  const compactRows = rows.map(compactRow);
  return {
    id: `temporal_${hash(`${type}|${topic}|${rows.map(row => row.id).join('|')}`)}`,
    type,
    topic,
    status: 'OBSERVED_SAMPLE',
    statement: `Recent ${type.toLowerCase().replace(/_/g, ' ')} observed in the collected sample around ${topic}.`,
    evidenceIds: compactRows.map(row => row.id).filter(Boolean).slice(0, 12),
    sourceUrls: [...new Set(compactRows.map(row => row.sourceUrl).filter(Boolean))].slice(0, 8),
    sourcePlatforms: [...new Set(compactRows.map(row => row.sourcePlatform).filter(Boolean))].slice(0, 6),
    counts,
    confidence: sourceDiversity(rows) >= 2 && recentCount >= 3 ? 'MEDIUM' : 'LOW',
    limitations: [
      'This is a fresh-sample observation, not proof of market, demand or sales expansion.',
      'Compare with more independent dated sources before making a trend claim.'
    ],
    sample: compactRows.slice(0, 5)
  };
}

function buildTemporalIntelligence(input = {}) {
  const now = input.now ? new Date(input.now) : new Date();
  const rows = evidenceRowsFrom(input);
  const counts = countsFor(rows, now);
  const grouped = {};
  rows.forEach(row => {
    const type = classifyTemporalSignal(row);
    const topic = topicFor(row);
    const key = `${type}::${topic}`;
    grouped[key] = grouped[key] || [];
    grouped[key].push(row);
  });
  const sampleShifts = Object.entries(grouped)
    .map(([key, group]) => {
      const [type, topic] = key.split('::');
      return buildSampleShift(type, topic, group, now);
    })
    .filter(Boolean)
    .sort((a, b) => {
      const recentA = a.counts.last7d + a.counts.last30d;
      const recentB = b.counts.last7d + b.counts.last30d;
      return recentB - recentA;
    })
    .slice(0, 8);

  return {
    version: 'temporal-intelligence-v1',
    generatedAt: now.toISOString(),
    windows: counts,
    sampleShifts,
    unknowns: [
      ...(counts.dated ? [] : ['No dated evidence available for temporal comparison.']),
      ...(sampleShifts.length ? [] : ['No repeated recent signal found inside the dated evidence sample.'])
    ],
    quality: {
      datedEvidenceCount: counts.dated,
      sampleShiftCount: sampleShifts.length,
      noDemandGrowthClaim: true,
      boundedToObservedSample: sampleShifts.every(shift => /collected sample/i.test(shift.statement)),
      allShiftsTraceable: sampleShifts.every(shift => asArray(shift.evidenceIds).length >= 2),
      limitations: [
        'Temporal intelligence compares collected evidence windows only.',
        'It must not be used to claim market expansion unless dedicated temporal demand data confirms it.'
      ]
    }
  };
}

module.exports = {
  buildTemporalIntelligence,
  classifyTemporalSignal,
  windowFor
};
