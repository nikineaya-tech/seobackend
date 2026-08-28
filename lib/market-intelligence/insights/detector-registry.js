const DETECTOR_SEQUENCE = [
  {
    key: 'customerCompetitorContradictions',
    type: 'CUSTOMER_COMPETITOR_CONTRADICTION',
    relationship: 'CUSTOMER vs COMPETITOR/MESSAGE',
    dimensions: ['CUSTOMER', 'COMPETITOR', 'MESSAGE'],
    evidencePolicy: 'requires_customer_and_competitor_evidence'
  },
  {
    key: 'customerOfferGaps',
    type: 'CUSTOMER_OFFER_GAP',
    relationship: 'CUSTOMER vs OFFER/PROOF',
    dimensions: ['CUSTOMER', 'OFFER', 'PROOF'],
    evidencePolicy: 'requires_customer_need_and_offer_coverage'
  },
  {
    key: 'proofGaps',
    type: 'PROOF_GAP',
    relationship: 'CUSTOMER uncertainty vs COMPETITOR proof',
    dimensions: ['CUSTOMER', 'PROOF', 'OFFER'],
    evidencePolicy: 'requires_customer_uncertainty_and_observed_offer_records'
  },
  {
    key: 'trustGaps',
    type: 'TRUST_GAP',
    relationship: 'CUSTOMER risk vs returns/guarantees/payment/seller identity',
    dimensions: ['CUSTOMER', 'TRUST', 'OFFER'],
    evidencePolicy: 'requires_risk_evidence_and_trust_mechanism_coverage'
  },
  {
    key: 'priceValueAsymmetry',
    type: 'PRICE_VALUE_ASYMMETRY',
    relationship: 'PRICE vs VALUE/PROOF',
    dimensions: ['PRICE', 'VALUE', 'PROOF'],
    evidencePolicy: 'requires_observed_price_and_value_proof_evidence'
  },
  {
    key: 'saturation',
    type: 'SATURATION',
    relationship: 'COMPETITOR/OFFER pattern vs differentiation value',
    dimensions: ['COMPETITOR', 'OFFER', 'MESSAGE'],
    evidencePolicy: 'requires_multi_seller_pattern'
  },
  {
    key: 'localGlobalAsymmetry',
    type: 'LOCAL_GLOBAL_ASYMMETRY',
    relationship: 'LOCAL vs REGIONAL/GLOBAL benchmark',
    dimensions: ['LOCAL_MARKET', 'REGIONAL_BENCHMARK', 'GLOBAL_BENCHMARK'],
    evidencePolicy: 'requires_local_and_benchmark_evidence'
  },
  {
    key: 'socialContentGaps',
    type: 'SOCIAL_CONTENT_GAP',
    relationship: 'SOCIAL content theme vs COMPETITOR message',
    dimensions: ['SOCIAL_CONTENT', 'COMPETITOR', 'CUSTOMER'],
    evidencePolicy: 'requires_social_theme_and_competitor_content'
  },
  {
    key: 'substituteRisks',
    type: 'SUBSTITUTE_RISK',
    relationship: 'CUSTOMER objection vs SUBSTITUTE discussion',
    dimensions: ['CUSTOMER', 'SUBSTITUTE', 'PRODUCT'],
    evidencePolicy: 'requires_substitute_and_customer_pain_evidence'
  },
  {
    key: 'supplierLocalGaps',
    type: 'SUPPLIER_LOCAL_GAP',
    relationship: 'SUPPLIER availability vs LOCAL offer absence',
    dimensions: ['SUPPLIER', 'LOCAL_MARKET', 'OFFER'],
    evidencePolicy: 'requires_verified_supplier_evidence'
  },
  {
    key: 'temporalOpportunities',
    type: 'TEMPORAL_OPPORTUNITY',
    relationship: 'RECENT sample vs OLDER observed sample',
    dimensions: ['TEMPORAL_SAMPLE', 'CONTENT', 'COMPETITOR'],
    evidencePolicy: 'forbids_demand_growth_claims'
  }
];

function runRegisteredDetectors(ctx = {}, detectors = {}) {
  return DETECTOR_SEQUENCE.flatMap(item => {
    const detector = detectors[item.key];
    if (typeof detector !== 'function') return [];
    return detector(ctx).map(insight => ({
      ...insight,
      detectorKey: item.key,
      detectorPolicy: item.evidencePolicy,
      detectorRelationship: item.relationship
    }));
  });
}

module.exports = {
  DETECTOR_SEQUENCE,
  runRegisteredDetectors
};
