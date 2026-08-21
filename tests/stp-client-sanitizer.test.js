'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeStpDecisionForClient } = require('../lib/stp-client-sanitizer');

test('final STP client sanitizer removes weak placeholders after overlays', () => {
  const dirty = {
    success: true,
    type: 'stp_decision',
    productUnderstanding: {
      query: 'extratecteur de الرؤوس السوداء',
      geo: 'Libya'
    },
    personaCards: [{
      id: 'p1',
      displayName: 'Persona 1',
      summary: 'أريد extratecteur de الرؤوس السوداء بسرعة',
      details: {
        proofNeeded: ['delivery area', 'ev_1', 'مدة التوصيل واضحة'],
        trustSources: ['verified reviews', 'ضمان واضح'],
        socialPlan: {
          contentAngles: ['win with local availability and faster response', 'أظهر التوفر المحلي']
        }
      }
    }],
    marketingAngles: [{
      id: 'angle-local_speed',
      name: 'وصول محلي سريع',
      proofNeeded: ['delivery area', 'response time'],
      hooks: ['win with local availability and faster response', 'أظهر التوفر المحلي']
    }],
    actionPlan: [{
      priority: 1,
      action: 'clear offer proof',
      impact: 'HIGH'
    }, {
      priority: 2,
      action: 'حوّل الوعد إلى دليل واضح',
      proofRequired: 'ev_2'
    }]
  };

  const clean = sanitizeStpDecisionForClient(dirty, 'ar');
  const visible = JSON.stringify(clean);
  assert.doesNotMatch(visible, /\bev_\d+\b|delivery area|response time|verified reviews|win with local availability|clear offer proof/i);
  assert.match(visible, /مزيل الرؤوس السوداء/);
  assert.match(visible, /ليبيا/);
  assert.match(visible, /مدة التوصيل واضحة|ضمان واضح|أظهر التوفر المحلي|حوّل الوعد إلى دليل واضح/);
});
