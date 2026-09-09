'use strict';

const MAX_CAMPAIGNS = 1000;
const MAX_LABEL_LENGTH = 180;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numberValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim().replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  if (!raw) return 0;
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.replace(/,/g, '')
    : (/^-?\d{1,3}(?:,\d{3})+$/.test(raw)
      ? raw.replace(/,/g, '')
      : raw.replace(',', '.'));
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pick(row, aliases) {
  const keys = Object.keys(row || {});
  const key = keys.find(candidate => aliases.includes(candidate.toLowerCase().trim()));
  return key ? row[key] : undefined;
}

function textValue(value, fallback) {
  const text = String(value ?? '').trim();
  return (text || fallback).slice(0, MAX_LABEL_LENGTH);
}

function normalizeCampaign(row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const spend = numberValue(pick(row, ['spend', 'amount spent', 'cost', 'dépenses', 'depenses', 'montant dépensé', 'montant depense']));
  const impressions = numberValue(pick(row, ['impressions', 'impression']));
  const clicks = numberValue(pick(row, ['clicks', 'link clicks', 'clics', 'clics sur le lien']));
  const conversions = numberValue(pick(row, ['conversions', 'purchases', 'purchase', 'results', 'achats', 'commandes', 'résultats', 'resultats']));
  const revenue = numberValue(pick(row, ['revenue', 'purchase conversion value', 'conversion value', 'sales', 'chiffre d’affaires', "chiffre d'affaires", 'valeur de conversion']));
  const ctrInput = numberValue(pick(row, ['ctr', 'ctr (link click-through rate)', 'taux de clic']));
  const cpmInput = numberValue(pick(row, ['cpm', 'cost per 1,000 impressions', 'coût pour 1 000 impressions', 'cout pour 1 000 impressions']));
  const cpcInput = numberValue(pick(row, ['cpc', 'cost per link click', 'coût par clic', 'cout par clic']));
  const roasInput = numberValue(pick(row, ['roas', 'purchase roas', 'return on ad spend']));
  const name = textValue(pick(row, ['campaign name', 'campaign', 'campaign_name', 'nom de campagne', 'ad set name', 'adset']), `Campaign ${index + 1}`);
  return {
    name,
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : ctrInput,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : cpmInput,
    cpc: clicks > 0 ? spend / clicks : cpcInput,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: spend > 0 ? revenue / spend : roasInput,
  };
}

function summarizeCampaigns(rows) {
  const campaigns = rows.slice(0, MAX_CAMPAIGNS).map(normalizeCampaign).filter(Boolean);
  if (!campaigns.length) throw new Error('CAMPAIGN_DATA_EMPTY');
  const totals = campaigns.reduce((acc, item) => ({
    spend: acc.spend + item.spend,
    impressions: acc.impressions + item.impressions,
    clicks: acc.clicks + item.clicks,
    conversions: acc.conversions + item.conversions,
    revenue: acc.revenue + item.revenue,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
  const metrics = {
    ...totals,
    ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0,
    cpm: totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : 0,
    cpa: totals.conversions ? totals.spend / totals.conversions : null,
    roas: totals.spend ? totals.revenue / totals.spend : 0,
    campaignCount: campaigns.length,
  };
  const bySpend = [...campaigns].sort((a, b) => b.spend - a.spend);
  const scored = campaigns.filter(item => item.spend > 0).map(item => ({
    ...item,
    efficiency: item.roas > 0 ? item.roas : (item.conversions > 0 ? 1 / item.cpa : 0),
  }));
  return { metrics, campaigns, topCampaigns: [...scored].sort((a, b) => b.efficiency - a.efficiency).slice(0, 5), underperformers: [...scored].sort((a, b) => a.efficiency - b.efficiency).slice(0, 5), highestSpend: bySpend.slice(0, 5) };
}

function localAnalysis(summary, language = 'fr') {
  const { metrics, underperformers, topCampaigns } = summary;
  const hasRevenue = metrics.revenue > 0;
  const alerts = underperformers.filter(item => item.spend > 0 && (!item.roas || item.roas < 1)).slice(0, 3).map(item => ({
    severity: 'high', campaign: item.name,
    message: hasRevenue ? `ROAS ${item.roas.toFixed(2)} pour ${item.spend.toFixed(2)} de dépenses.` : `Dépenses ${item.spend.toFixed(2)} sans valeur de revenu mesurée.`,
    action: 'Vérifier le tracking et réduire le budget jusqu’à validation des créas et de l’audience.'
  }));
  return {
    executive_summary: `Analyse basée sur ${metrics.campaignCount} campagnes et ${metrics.spend.toFixed(2)} de dépenses mesurées.`,
    alerts,
    insights: {
      strengths: topCampaigns.slice(0, 3).map(item => `${item.name}: ${item.roas ? `ROAS ${item.roas.toFixed(2)}` : `${item.conversions} conversions`}`),
      critical_issues: alerts.map(item => item.message),
      quick_wins: ['Concentrer les tests sur les campagnes avec données de conversion fiables.', 'Ne pas augmenter un budget avant vérification du tracking et de la marge.'],
      scaling_opportunities: topCampaigns.filter(item => item.roas > 1).slice(0, 2).map(item => `Tester une hausse graduelle du budget sur ${item.name}.`),
    },
    roadmap: [
      { priority: 1, timeframe: 'Aujourd’hui', action: 'Vérifier les événements de conversion et les données de revenu.' },
      { priority: 2, timeframe: '48 heures', action: 'Réallouer progressivement le budget après validation des résultats.' },
    ],
    data_note: language === 'fr' ? 'Les recommandations financières restent conditionnelles : elles ne remplacent pas la marge, l’attribution et le jugement humain.' : 'Recommendations are conditional on tracking, margin, attribution and human review.'
  };
}

function productEconomics(input = {}) {
  const price = numberValue(input.price ?? input.sellingPrice ?? input.sale_price);
  const cogs = numberValue(input.cogs ?? input.productCost ?? input.product_cost);
  const shipping = numberValue(input.shipping ?? input.shippingCost ?? input.delivery_cost);
  const fees = numberValue(input.fees ?? input.paymentFees ?? input.adjacentCosts);
  const returnRate = clamp(numberValue(input.returnRate ?? input.refundRate) / 100, 0, 0.95);
  const targetCpa = numberValue(input.targetCpa ?? input.targetCPA);
  const contributionBeforeReturns = price - cogs - shipping - fees;
  const expectedContribution = contributionBeforeReturns * (1 - returnRate);
  const breakEvenRoas = expectedContribution > 0 ? price / expectedContribution : null;
  return { price, cogs, shipping, fees, returnRatePercent: returnRate * 100, targetCpa, contributionBeforeReturns, expectedContribution, breakEvenRoas, configured: price > 0 && expectedContribution > 0 };
}

function decideCampaign(summary, economics) {
  const { metrics } = summary;
  const hasSalesData = metrics.conversions > 0 || metrics.revenue > 0;
  if (!economics.configured) {
    return {
      verdict: 'TEST_UNDER_CONDITIONS', confidence: 'LOW',
      reason: 'Coûts du produit incomplets : aucun seuil de rentabilité fiable ne peut être calculé.',
      requiredInputs: ['prix de vente', 'coût produit', 'livraison', 'frais de paiement/emballage', 'taux de retours estimé'],
      nextAction: 'Renseigner les coûts puis analyser à nouveau avant toute hausse de budget.',
      breakEvenRoas: null, targetCpa: economics.targetCpa || null, observedRoas: metrics.roas, observedCpa: metrics.cpa, estimatedAdProfit: null
    };
  }
  const targetCpa = economics.targetCpa > 0 ? economics.targetCpa : economics.expectedContribution;
  const estimatedAdProfit = hasSalesData ? (metrics.conversions * economics.expectedContribution) - metrics.spend : null;
  const enoughVolume = metrics.conversions >= 5 || metrics.spend >= targetCpa * 3;
  const isProfitable = (metrics.roas >= economics.breakEvenRoas) && (metrics.cpa === null || metrics.cpa <= targetCpa);
  const materialLoss = metrics.spend >= targetCpa * 2 && ((!metrics.roas || metrics.roas < economics.breakEvenRoas * 0.65) || (metrics.cpa !== null && metrics.cpa > targetCpa * 1.5));
  if (isProfitable && enoughVolume) {
    return {
      verdict: 'CONTINUE_AND_SCALE', confidence: 'HIGH',
      reason: 'Les résultats mesurés dépassent le seuil de rentabilité avec un volume suffisant.',
      nextAction: 'Augmenter le budget progressivement de 15–20 % toutes les 48 h tout en surveillant CPA et ROAS.',
      breakEvenRoas: economics.breakEvenRoas, targetCpa, observedRoas: metrics.roas, observedCpa: metrics.cpa, estimatedAdProfit
    };
  }
  if (materialLoss) {
    return {
      verdict: 'STOP_OR_REBUILD', confidence: 'HIGH',
      reason: 'La campagne a consommé assez de budget pour montrer un écart important sous le seuil de rentabilité.',
      nextAction: 'Stopper les ensembles déficitaires. Corriger offre, créa, ciblage ou page avant un nouveau test limité.',
      breakEvenRoas: economics.breakEvenRoas, targetCpa, observedRoas: metrics.roas, observedCpa: metrics.cpa, estimatedAdProfit
    };
  }
  return {
    verdict: 'TEST_UNDER_CONDITIONS', confidence: hasSalesData ? 'MEDIUM' : 'LOW',
    reason: hasSalesData ? 'Les données ne confirment pas encore une rentabilité durable ou le volume est trop faible.' : 'Aucune vente ou valeur de conversion fiable n’est disponible.',
    nextAction: hasSalesData ? 'Continuer uniquement avec un budget-test plafonné et prioriser les créas/audiences les plus prometteuses.' : 'Vérifier le pixel/CAPI et obtenir des données de conversion avant de juger le produit.',
    breakEvenRoas: economics.breakEvenRoas, targetCpa, observedRoas: metrics.roas, observedCpa: metrics.cpa, estimatedAdProfit
  };
}

function metricsFromCampaign(campaign) {
  return {
    spend: campaign.spend,
    impressions: campaign.impressions,
    clicks: campaign.clicks,
    conversions: campaign.conversions,
    revenue: campaign.revenue,
    ctr: campaign.ctr,
    cpm: campaign.cpm,
    cpc: campaign.cpc,
    cpa: campaign.cpa,
    roas: campaign.roas,
    campaignCount: 1,
  };
}

function decideCampaignRows(summary, economics) {
  return summary.campaigns.map(campaign => ({
    name: campaign.name,
    metrics: metricsFromCampaign(campaign),
    decision: decideCampaign({ metrics: metricsFromCampaign(campaign) }, economics),
  }));
}

function analysisPrompt(summary, platform, language, decision) {
  const compact = {
    metrics: summary.metrics,
    topCampaigns: summary.topCampaigns,
    underperformers: summary.underperformers,
    highestSpend: summary.highestSpend,
  };
  return `Analyse ces performances publicitaires ${platform || 'multi-plateforme'} en ${language === 'ar' ? 'arabe' : language === 'en' ? 'anglais' : 'français'}. Utilise exclusivement les chiffres fournis. Ne fabrique aucune donnée, marge, audience ou causalité. Si revenu/conversion manque, dis-le explicitement. Le verdict déterministe du moteur est ${decision.verdict}; ne le contredis pas et explique ses conditions. Retourne strictement un JSON valide avec: executive_summary (string), alerts (array de {severity,campaign,message,action}), insights ({strengths:string[],critical_issues:string[],quick_wins:string[],scaling_opportunities:string[]}), creative_strategy ({hooks_to_test:string[],angles_to_explore:string[],creative_refresh_priority:string}), budget_recommendations ({reallocation:string,daily_budget_suggestion:string,bid_strategy:string}), roadmap (array de {priority:number,timeframe:string,action:string}), data_note (string). Données agrégées: ${JSON.stringify(compact)}`;
}

function createCampaignAnalysisHandler({ callOpenRouterAPI }) {
  return async (req, res) => {
    const startedAt = Date.now();
    try {
      const rows = Array.isArray(req.body?.campaigns) ? req.body.campaigns : (Array.isArray(req.body?.data) ? req.body.data : []);
      if (rows.length > MAX_CAMPAIGNS) return res.status(400).json({ success: false, error: 'CAMPAIGN_LIMIT_EXCEEDED', message: `Maximum ${MAX_CAMPAIGNS} campaigns per analysis.` });
      const language = ['fr', 'en', 'ar'].includes(req.body?.language) ? req.body.language : 'fr';
      const platform = textValue(req.body?.platform, 'multi-platform');
      const summary = summarizeCampaigns(rows);
      const economics = productEconomics(req.body?.product || req.body?.economics || {});
      const decision = decideCampaign(summary, economics);
      const campaignDecisions = decideCampaignRows(summary, economics);
      const fallback = localAnalysis(summary, language);
      const ai = await callOpenRouterAPI(analysisPrompt(summary, platform, language, decision), {
        expectedFormat: 'json', context: 'Campaign analysis', task: 'ads-analysis', maxTokens: 2200, temperature: 0.2, useCache: false,
        systemPrompt: 'You are a cautious paid-media analyst. Give actionable analysis based only on the supplied campaign metrics.'
      });
      const analysis = ai?.success && ai.response && typeof ai.response === 'object' ? { ...fallback, ...ai.response } : fallback;
      return res.json({
        success: true,
        platform,
        language,
        metrics: summary.metrics,
        productEconomics: economics,
        decision,
        campaignDecisions,
        campaigns: summary.campaigns,
        topCampaigns: summary.topCampaigns,
        underperformers: summary.underperformers,
        highestSpend: summary.highestSpend,
        analysis,
        ai: { used: Boolean(ai?.success), model: ai?.success ? ai.model : null },
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      const status = error.message === 'CAMPAIGN_DATA_EMPTY' ? 400 : 500;
      return res.status(status).json({ success: false, error: error.message === 'CAMPAIGN_DATA_EMPTY' ? 'CAMPAIGN_DATA_EMPTY' : 'CAMPAIGN_ANALYSIS_FAILED', message: error.message });
    }
  };
}

module.exports = { createCampaignAnalysisHandler, summarizeCampaigns, productEconomics, decideCampaign, decideCampaignRows };
