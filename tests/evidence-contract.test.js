'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  auditMarketEvidenceContract,
  walkClaims
} = require('../lib/market-intelligence/evidence-contract');

const NOW = '2026-08-27T12:00:00.000Z';

test('evidence contract approves traceable observed inferred and recommended outputs', () => {
  const audit = auditMarketEvidenceContract({
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_1',
          claimType: 'offer',
          value: 'The page shows price and COD terms.',
          sourcePlatform: 'serp',
          sourceUrl: 'https://shop.example/product',
          verificationStatus: 'CONFIRMED',
          collectedAt: NOW
        },
        {
          id: 'ev_2',
          claimType: 'not_found',
          value: 'Return terms were not found on the inspected page.',
          sourcePlatform: 'inspected_page',
          sourceUrl: 'https://shop.example/product',
          verificationStatus: 'NOT_FOUND_ON_INSPECTED_PAGE',
          collectedAt: NOW
        }
      ]
    },
    marketSignalModel: {
      signals: [
        {
          id: 'sig_1',
          status: 'OBSERVED',
          statement: 'Price and COD are observed in the sample.',
          evidenceIds: ['ev_1']
        },
        {
          id: 'sig_2',
          status: 'INFERRED',
          statement: 'Return clarity may be a gap on the inspected page.',
          confidence: 'LOW',
          evidenceIds: ['ev_2'],
          limitations: ['Not found on inspected page is not confirmed market absence.']
        }
      ]
    },
    decisionReportV2: {
      mainReport: {
        priorityActions: [
          {
            status: 'RECOMMENDED_TEST',
            action: 'Test a proof block before scaling.',
            signalIds: ['sig_1'],
            evidenceIds: ['ev_1']
          }
        ]
      }
    }
  });

  assert.equal(audit.status, 'approved');
  assert.equal(audit.summary.high, 0);
  assert.equal(audit.quality.noObservedWithoutEvidence, true);
  assert.equal(audit.quality.recommendationsRemainTests, true);
  assert.equal(audit.quality.notFoundDoesNotBecomeAbsence, true);
});

test('evidence contract flags observed claims without evidence and fact-like recommendations', () => {
  const audit = auditMarketEvidenceContract({
    evidenceRegistry: {
      evidence: [
        {
          id: 'ev_bad_absence',
          claimType: 'delivery',
          value: 'Delivery is absent everywhere.',
          sourcePlatform: 'inspected_page',
          sourceUrl: 'https://shop.example/product',
          verificationStatus: 'NOT_FOUND'
        }
      ]
    },
    decisionReportV2: {
      mainReport: {
        marketIn60Seconds: [
          {
            status: 'OBSERVED',
            insight: 'This competitor dominates the market.',
            evidenceIds: []
          }
        ],
        opportunityGaps: [
          {
            status: 'INFERRED',
            statement: 'No one offers guarantees.',
            confidence: '',
            evidenceIds: []
          }
        ],
        priorityActions: [
          {
            status: 'RECOMMENDED',
            action: 'Scale paid ads now.',
            evidenceIds: ['ev_bad_absence']
          }
        ]
      }
    }
  });

  assert.equal(audit.status, 'failed');
  assert.ok(audit.issues.some(item => item.code === 'OBSERVED_CLAIM_WITHOUT_EVIDENCE'));
  assert.ok(audit.issues.some(item => item.code === 'INFERRED_CLAIM_WITHOUT_EVIDENCE'));
  assert.ok(audit.issues.some(item => item.code === 'INFERRED_CLAIM_WITHOUT_LIMITATION'));
  assert.ok(audit.issues.some(item => item.code === 'RECOMMENDATION_NOT_MARKED_AS_TEST'));
  assert.ok(audit.issues.some(item => item.code === 'NOT_FOUND_STATUS_ON_FACT_CLAIM'));
});

test('claim walker tolerates cycles and skips raw evidence payloads', () => {
  const payload = {
    status: 'OBSERVED',
    statement: 'Observed from evidence.',
    evidenceIds: ['ev_1'],
    rawEvidence: [{ status: 'OBSERVED', value: 'Raw row without ids is not a report claim.' }]
  };
  payload.self = payload;

  const issues = walkClaims(payload);
  assert.deepEqual(issues, []);
});
