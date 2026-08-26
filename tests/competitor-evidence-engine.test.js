'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STATUS,
  createEvidenceRegistry,
  sanitizeCompetitorReport,
  validateCompetitorClaims,
  noUserMessage
} = require('../lib/competitor-evidence-engine');

function sampleReport() {
  return {
    success: true,
    lang: 'ar',
    query: 'مزيل رؤوس سوداء',
    competitors: [
      {
        title: 'جهاز إزالة الرؤوس السوداء',
        domain: 'www.aelastore.shop',
        url: 'https://www.aelastore.shop/products/ghaz-azal-alroos-alsodaaa',
        snippet: 'جهاز تنظيف الوجه مع إضاءة LED',
        dominance: 100,
        geoTier: 'LOCAL_CONFIRMED',
        geoConfirmed: false,
        businessProfile: {
          whatTheySell: 'جهاز تنظيف الوجه مع إضاءة LED',
          missingProofs: ['الضمان غير ظاهر']
        }
      }
    ],
    marketInsights: {
      notes: 'السوق يواجه طلبا متزايدا على أجهزة إزالة الرؤوس السوداء.',
      trend: 'زيادة الطلب'
    },
    grandSlamOfferBlueprint: {
      timeDelay: 'التسليم خلال 24 ساعة'
    },
    duelComparison: {
      uxTeardown: {
        competitor: 'تجربة مستخدم جيدة',
        user: 'تجربة مستخدم ضعيفة',
        killShot: 'تحسين تجربة المستخدم'
      }
    },
    comparisonScores: { user: [10, 20, 30], competitor: [80, 80, 80] },
    productServiceAudit: {
      pricingStrategy: 'استراتيجية سعر هجومية'
    }
  };
}

test('no user URL means no user comparison claims survive', () => {
  const clean = sanitizeCompetitorReport(sampleReport(), { lang: 'ar', userSiteAudited: false });
  assert.equal(clean.duelComparison, null);
  assert.equal(clean.comparisonScores.user, null);
  assert.deepEqual(clean.userWeaknesses, []);
  assert.equal(clean.userEvaluationNotice, noUserMessage('ar'));
  assert.doesNotMatch(JSON.stringify(clean), /تجربة مستخدم ضعيفة|your site|votre site/i);
});

test('no Trends evidence removes factual demand growth claims', () => {
  const clean = sanitizeCompetitorReport(sampleReport(), { lang: 'ar', userSiteAudited: false });
  assert.equal(clean.marketInsights.trend, null);
  assert.equal(clean.marketInsights.demandTrend.status, STATUS.NOT_VERIFIED);
  assert.doesNotMatch(JSON.stringify(clean), /طلبا متزايدا|زيادة الطلب|growing demand|market is growing/i);
});

test('foreign or unconfirmed local result is not LOCAL_CONFIRMED', () => {
  const clean = sanitizeCompetitorReport(sampleReport(), { lang: 'ar', userSiteAudited: false });
  assert.notEqual(clean.competitors[0].geoTier, 'LOCAL_CONFIRMED');
  assert.equal(clean.competitors[0].geoTier, 'LOCAL_PROBABLE');
});

test('no price evidence makes pricing not verified instead of strategy fact', () => {
  const clean = sanitizeCompetitorReport(sampleReport(), { lang: 'ar', userSiteAudited: false });
  assert.equal(clean.pricing.status, STATUS.NOT_VERIFIED);
  assert.equal(clean.productServiceAudit.pricingStatus, STATUS.NOT_VERIFIED);
  assert.doesNotMatch(JSON.stringify(clean), /استراتيجية سعر هجومية/);
});

test('supplier power remains UNKNOWN without supplier evidence', () => {
  const clean = sanitizeCompetitorReport(sampleReport(), { lang: 'ar', userSiteAudited: false });
  assert.equal(clean.marketDynamics.porter.supplierPower.status, STATUS.UNKNOWN);
});

test('not-found guarantee wording is not treated as confirmed absence', () => {
  const registry = createEvidenceRegistry(sampleReport());
  const missing = registry.evidence.find(ev => ev.claimType === 'not_found');
  assert.equal(missing.verificationStatus, STATUS.NOT_FOUND_ON_INSPECTED_PAGE);
});

test('dominance 100% is renamed to SERP relevance signal', () => {
  const clean = sanitizeCompetitorReport(sampleReport(), { lang: 'ar', userSiteAudited: false });
  assert.equal(clean.competitors[0].dominance, undefined);
  assert.equal(clean.competitors[0].serpRelevanceScore, 100);
  assert.equal(clean.competitors[0].observedVisibilityScore, 100);
});

test('unsupported delivery and acquisition claims are downgraded', () => {
  const report = sampleReport();
  report.masteringTechniques = { trafficSources: 'الإعلانات المدفوعة والمؤثرين' };
  const clean = sanitizeCompetitorReport(report, { lang: 'ar', userSiteAudited: false });
  const text = JSON.stringify(clean);
  assert.doesNotMatch(text, /التسليم خلال 24 ساعة/);
  assert.doesNotMatch(text, /المؤثرين/);
  assert.match(text, /غير مؤكدة/);
});

test('every observed competitor has evidence ids', () => {
  const clean = sanitizeCompetitorReport(sampleReport(), { lang: 'ar', userSiteAudited: false });
  assert.ok(clean.evidenceRegistry.evidence.length >= 3);
  assert.ok(clean.competitors[0].evidenceIds.length >= 2);
});

test('validator flags unsafe legacy output before sanitization', () => {
  const report = sampleReport();
  const audit = validateCompetitorClaims(report, createEvidenceRegistry(report), { lang: 'ar', userSiteAudited: false });
  assert.equal(audit.status, 'downgraded');
  assert.ok(audit.issues.some(issue => issue.code === 'UNSUPPORTED_USER_SITE_CLAIM'));
  assert.ok(audit.issues.some(issue => issue.code === 'UNSUPPORTED_DEMAND_GROWTH'));
});
