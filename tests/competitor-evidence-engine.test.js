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
  assert.equal(clean.recommendedBenchmark.status, STATUS.RECOMMENDED);
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

test('unsupported channel sanitizer does not corrupt product names or URLs', () => {
  const report = sampleReport();
  report.competitors[0].title = 'Blackhead-Remover price';
  report.competitors[0].url = 'https://m.shein.com/Blackhead-Remover-product.html';
  report.masteringTechniques = {
    trafficSources: 'Blackhead-Remover from https://m.shein.com/Blackhead-Remover-product.html with ads and influencers claimed.'
  };
  const clean = sanitizeCompetitorReport(report, { lang: 'en', userSiteAudited: false });
  const text = JSON.stringify(clean);
  assert.match(text, /Blackhead-Remover/);
  assert.match(text, /m\.shein\.com\/Blackhead-Remover-product\.html/);
  assert.doesNotMatch(text, /Blackheunverified channel/i);
  assert.doesNotMatch(text, /unverified channel|ads and influencers/i);
});

test('price-only values are removed from promise fields', () => {
  const report = sampleReport();
  report.competitors[0].businessProfile.primaryPromise = '٢١٩ دينار ليبي';
  report.competitorIntelligence = {
    recommendedAttackAngle: {
      promiseToMake: '219 LYD'
    },
    competitorProfiles: [
      {
        domain: 'aelastore.shop',
        primaryPromise: '٢١٩ دينار ليبي'
      }
    ]
  };
  const clean = sanitizeCompetitorReport(report, { lang: 'ar', userSiteAudited: false });
  const text = JSON.stringify(clean);
  assert.equal(clean.competitors[0].businessProfile.primaryPromise, '');
  assert.equal(clean.competitorIntelligence.recommendedAttackAngle.promiseToMake, '');
  assert.equal(clean.competitorIntelligence.competitorProfiles[0].primaryPromise, '');
  assert.doesNotMatch(text, /"primaryPromise":"٢١٩ دينار ليبي"|"promiseToMake":"219 LYD"/);
  assert.match(text, /PRICE_VALUE_REMOVED_FROM_PROMISE_FIELD/);
});

test('advanced frameworks are suppressed when market coverage is thin', () => {
  const report = sampleReport();
  report.marketInsights.sophisticationLevel = '2';
  report.marketDynamics = {
    porterVerdict: 'Competition is moderate and supplier power is high.',
    threatLevel: 'Medium',
    barrierToEntry: 'Entry requires strong product quality.'
  };
  report.swot = {
    strengths: ['Advanced LED and suction features'],
    weaknesses: ['Limited social proof'],
    opportunities: ['Influencer marketing and SEO'],
    threats: ['Many similar sellers']
  };
  report.blueOceanStrategy = {
    blueOceanMoves: ['Create a unique skincare education experience'],
    create: ['New premium category']
  };

  const clean = sanitizeCompetitorReport(report, { lang: 'en', userSiteAudited: false });
  const text = JSON.stringify(clean);
  assert.equal(clean.marketInsights.sophisticationLevel, undefined);
  assert.equal(clean.marketInsights.sophisticationStatus, STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(clean.marketDynamics.frameworkStatus, STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(clean.swot.status, STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(clean.blueOceanStrategy.status, STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(clean.frameworkPolicy.workshopMode, true);
  assert.equal(clean.frameworkWorkshops.mode, 'PROJECTED_WORKSHOP');
  assert.equal(clean.frameworkWorkshops.status, STATUS.RECOMMENDED);
  assert.deepEqual(clean.frameworkWorkshops.workshops.map(item => item.key), ['swot', 'blue_ocean', 'porter', 'jtbd_kano_aarrr']);
  assert.match(clean.frameworkWorkshops.disclaimer, /workshops|not proven market facts/i);
  assert.ok(clean.frameworkWorkshops.workshops.every(workshop => workshop.cards.every(card => card.question && card.answer)));
  assert.match(clean.frameworkWorkshops.workshops[0].cards[0].answer, /proven|page|proof/i);
  assert.doesNotMatch(text, /Competition is moderate|supplier power is high|unique skincare education experience/i);
});

test('legacy strategic studies are removed when frameworks are not evidence-supported', () => {
  const report = sampleReport();
  report.competitorIntelligence = {
    legacyStudies: {
      grandSlamOfferBlueprint: { theIrresistibleOffer: '30 days money-back offer' },
      masteringTechniques: {
        trafficSources: 'SEO and influencer marketing',
        retentionLoop: 'Build loyalty with recurring skincare advice.',
        monetizationHack: 'Sell complementary accessories after purchase.'
      },
      swot: { opportunities: ['Influencer marketing and SEO'] },
      blueOceanStrategy: { create: ['New premium category'] },
      comparisonScores: { competitor: [100, 100, 100] }
    },
    strategicStudiesAvailability: {
      grandSlamOfferBlueprint: true,
      masteringTechniques: true,
      swot: true,
      blueOceanStrategy: true,
      comparisonScores: true
    }
  };

  const clean = sanitizeCompetitorReport(report, { lang: 'en', userSiteAudited: false });
  const text = JSON.stringify(clean);
  assert.equal(clean.competitorIntelligence.legacyStudies.frameworkStatus, STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(clean.competitorIntelligence.strategicStudiesAvailability.masteringTechniques, false);
  assert.equal(clean.competitorIntelligence.strategicStudiesAvailability.swot, false);
  assert.doesNotMatch(text, /influencer marketing|recurring skincare advice|complementary accessories|premium category|30 days money-back/i);
});

test('unsupported retention upsell and refund claims become unknown instead of strategy', () => {
  const report = sampleReport();
  report.masteringTechniques = {
    retentionLoop: 'Build loyalty with recurring skincare advice.',
    monetizationHack: 'Sell complementary accessories after purchase.'
  };
  report.grandSlamOfferBlueprint = {
    timeDelay: 'delivery in 24h',
    perceivedLikelihood: '30 days refund guarantee',
    theIrresistibleOffer: '30 days money-back offer'
  };

  const clean = sanitizeCompetitorReport(report, { lang: 'en', userSiteAudited: false });
  const text = JSON.stringify(clean);
  assert.equal(clean.masteringTechniques.retentionLoop.status, STATUS.UNKNOWN);
  assert.equal(clean.masteringTechniques.monetizationHack.status, STATUS.UNKNOWN);
  assert.match(text, /Retention or loyalty loop is not verified/);
  assert.match(text, /Accessories, upsell or monetization mechanics are not verified/);
  assert.doesNotMatch(text, /recurring skincare advice|complementary accessories|30 days refund guarantee|30 days money-back offer/i);
  assert.match(text, /refund policy not verified/);
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

test('market leader wording is rejected without market-share evidence', () => {
  const report = sampleReport();
  report.competitorIntelligence = {
    marketVerdict: {
      currentLeader: 'aelastore.shop',
      marketPattern: 'من يتصدر السوق ولماذا؟ هذا المنافس هو market leader.'
    }
  };
  const audit = validateCompetitorClaims(report, createEvidenceRegistry(report), { lang: 'ar', userSiteAudited: false });
  assert.ok(audit.issues.some(issue => issue.code === 'UNSUPPORTED_MARKET_LEADER_CLAIM'));

  const clean = sanitizeCompetitorReport(report, { lang: 'ar', userSiteAudited: false });
  assert.doesNotMatch(JSON.stringify(clean), /من يتصدر السوق|market leader|leader du marché|domine le marché/i);
});

test('sanitized report exposes competitor geo groups separately', () => {
  const report = sampleReport();
  report.competitors.push({
    title: 'Foreign benchmark',
    domain: 'amazingegp.com',
    url: 'https://amazingegp.com/product',
    snippet: 'Egypt store',
    geoTier: 'FOREIGN_BENCHMARK',
    geoConfirmed: false
  });
  const clean = sanitizeCompetitorReport(report, { lang: 'ar', userSiteAudited: false });
  assert.equal(clean.competitorGeoGroups.probableLocalCompetitors.length, 1);
  assert.equal(clean.competitorGeoGroups.foreignBenchmarks.length, 1);
});
