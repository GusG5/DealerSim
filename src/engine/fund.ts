import { SeededRandom } from './random'
import type {
  FundAssetConfig,
  FundAssetId,
  FundAttribution,
  FundDecisionAuditEntry,
  FundCatalystEvent,
  FundDealerQuote,
  FundDealerRfq,
  FundDealerRelationship,
  FundExecutionQuality,
  FundFactor,
  FundLocate,
  FundMarketPhase,
  FundMandate,
  FundPosition,
  FundPreMarketCompanyBrief,
  FundRiskManagerMessage,
  FundRiskSnapshot,
  FundResearchSnapshot,
  FundSalesColour,
  FundScenario,
  FundScore,
  FundSessionOptions,
  FundSessionSnapshot,
  FundThesis,
  FundTrade,
  FundTradeIntent,
  FundWorkingOrder,
  FundWorkingStyle,
  FundSector,
  FundStressResult,
} from './fund-types'

const FACTORS: FundFactor[] = ['market', 'growth', 'value', 'quality', 'rates', 'momentum']
const SINGLE_NAMES: FundAssetId[] = ['apex-fund', 'mega-fund', 'nova-fund', 'heli-fund', 'luma-fund', 'orbx-fund']

export const FUND_ASSETS: readonly FundAssetConfig[] = [
  { id: 'apex-fund', symbol: 'APEX', displayName: 'Apex Dynamics', sector: 'Industrials', initialPrice: 250, priceDecimals: 2, annualVolatility: .24, transactionCostBps: 1.8, maxAbsWeight: .22, beta: 1.05, borrowRatePct: 1.2, maxShortWeight: .16, hardToBorrow: false, description: 'Liquid industrial large-cap with balanced cyclicality and company catalysts.', factorLoadings: { market: 1.00, growth: .42, value: .18, quality: .12, rates: -.14, momentum: .10 }, eventSensitivity: .95 },
  { id: 'mega-fund', symbol: 'MEGA', displayName: 'Mega Systems', sector: 'Technology', initialPrice: 418.24, priceDecimals: 2, annualVolatility: .27, transactionCostBps: 1.2, maxAbsWeight: .25, beta: 1.18, borrowRatePct: .6, maxShortWeight: .20, hardToBorrow: false, description: 'Mega-cap technology compounder with deep liquidity and strong growth/quality exposure.', factorLoadings: { market: 1.05, growth: .72, value: -.38, quality: .54, rates: -.36, momentum: .28 }, eventSensitivity: .85 },
  { id: 'nova-fund', symbol: 'NOVA', displayName: 'Nova Digital', sector: 'Technology', initialPrice: 96.71, priceDecimals: 2, annualVolatility: .48, transactionCostBps: 3.0, maxAbsWeight: .18, beta: 1.55, borrowRatePct: 4.8, maxShortWeight: .12, hardToBorrow: true, description: 'High-beta growth stock with thin liquidity, estimate sensitivity and crowding risk.', factorLoadings: { market: 1.20, growth: 1.02, value: -.62, quality: -.18, rates: -.55, momentum: .62 }, eventSensitivity: 1.35 },
  { id: 'heli-fund', symbol: 'HELI', displayName: 'Heli Health', sector: 'Healthcare', initialPrice: 143.08, priceDecimals: 2, annualVolatility: .19, transactionCostBps: 1.6, maxAbsWeight: .20, beta: .63, borrowRatePct: .8, maxShortWeight: .15, hardToBorrow: false, description: 'Defensive healthcare large-cap with quality exposure and episodic regulatory catalysts.', factorLoadings: { market: .62, growth: -.05, value: .22, quality: .58, rates: -.08, momentum: .02 }, eventSensitivity: .80 },
  { id: 'luma-fund', symbol: 'LUMA', displayName: 'Luma Industries', sector: 'Industrials', initialPrice: 184.32, priceDecimals: 2, annualVolatility: .36, transactionCostBps: 4.2, maxAbsWeight: .18, beta: 1.14, borrowRatePct: 3.2, maxShortWeight: .10, hardToBorrow: true, description: 'Less-liquid mid-cap where execution, valuation and estimate revisions matter materially.', factorLoadings: { market: .92, growth: .48, value: .58, quality: .04, rates: -.10, momentum: .16 }, eventSensitivity: 1.20 },
  { id: 'orbx-fund', symbol: 'ORBX', displayName: 'Orbex Bio', sector: 'Biotech', initialPrice: 62.48, priceDecimals: 2, annualVolatility: .72, transactionCostBps: 7.0, maxAbsWeight: .18, beta: 1.32, borrowRatePct: 13.5, maxShortWeight: .06, hardToBorrow: true, description: 'Event-driven biotech with binary catalysts, expensive borrow and squeeze risk.', factorLoadings: { market: .70, growth: .32, value: -.18, quality: -.35, rates: -.08, momentum: .52 }, eventSensitivity: 2.20 },
  { id: 'es-fund', symbol: 'ES', displayName: 'S&P 500 Hedge', sector: 'Index', initialPrice: 5400, priceDecimals: 2, annualVolatility: .17, transactionCostBps: .55, maxAbsWeight: .60, beta: 1.00, borrowRatePct: 0, maxShortWeight: .60, hardToBorrow: false, description: 'Liquid index future used to add or remove market beta without changing single-name positions.', factorLoadings: { market: 1.00, growth: .32, value: .02, quality: .04, rates: -.30, momentum: .12 }, eventSensitivity: .45 },
] as const

export const FUND_ASSET_MAP = Object.fromEntries(FUND_ASSETS.map((asset) => [asset.id, asset])) as Record<FundAssetId, FundAssetConfig>

export const FUND_SCENARIOS: Record<Exclude<FundScenario, 'random'>, { label: string; description: string; drift: Record<FundFactor, number> }> = {
  'earnings-season': { label: 'Earnings season', description: 'Single-name estimate revisions dominate while market beta remains secondary.', drift: { market: .00005, growth: .00005, value: 0, quality: .00005, rates: 0, momentum: .00008 } },
  'growth-rotation': { label: 'Growth rotation', description: 'Long-duration growth and momentum lead as rates ease and risk appetite improves.', drift: { market: .00032, growth: .00058, value: -.00020, quality: .00014, rates: -.00035, momentum: .00036 } },
  'value-rotation': { label: 'Value rotation', description: 'Crowded growth leadership fades while cyclicals and cheaper stocks re-rate.', drift: { market: .00008, growth: -.00042, value: .00062, quality: .00004, rates: .00018, momentum: -.00030 } },
  'risk-off': { label: 'Risk-off', description: 'Market beta falls, high-beta names underperform and defensive quality becomes valuable.', drift: { market: -.00062, growth: -.00032, value: .00002, quality: .00038, rates: -.00030, momentum: -.00012 } },
  'short-squeeze': { label: 'Short squeeze', description: 'Crowded shorts become unstable and hard-to-borrow names can gap sharply higher.', drift: { market: .00018, growth: .00020, value: -.00005, quality: -.00002, rates: 0, momentum: .00055 } },
  'stock-pickers': { label: 'Stock-picker market', description: 'Low index drift but large company-specific dispersion rewards differentiated views.', drift: { market: 0, growth: .00003, value: .00003, quality: .00004, rates: 0, momentum: 0 } },
}

export const BENCHMARK_WEIGHTS: Record<FundAssetId, number> = { 'apex-fund': .20, 'mega-fund': .25, 'nova-fund': .15, 'heli-fund': .20, 'luma-fund': .12, 'orbx-fund': .08, 'es-fund': 0 }

export const FUND_DEALERS = [
  { id: 'northbank', name: 'Northbank Markets', edge: .94, specialties: ['apex-fund', 'mega-fund', 'es-fund'] as FundAssetId[] },
  { id: 'mercator', name: 'Mercator Securities', edge: .98, specialties: ['luma-fund', 'apex-fund'] as FundAssetId[] },
  { id: 'albion', name: 'Albion Capital Markets', edge: .96, specialties: ['heli-fund', 'orbx-fund'] as FundAssetId[] },
  { id: 'kestrel', name: 'Kestrel Markets', edge: .92, specialties: ['nova-fund', 'mega-fund'] as FundAssetId[] },
  { id: 'helix', name: 'Helix Securities', edge: 1.00, specialties: ['es-fund', 'apex-fund', 'luma-fund'] as FundAssetId[] },
] as const

function emptyExecutionQuality(): FundExecutionQuality {
  return { totalNotional: 0, implementationShortfall: 0, implementationShortfallBps: 0, timingCost: 0, timingCostBps: 0, marketImpactCost: 0, marketImpactBps: 0, directNotional: 0, dealerNotional: 0, workedNotional: 0, auctionNotional: 0, dealerSavingBps: 0 }
}

function buildDealerRelationships(memory: FundSessionOptions['dealerMemory']): Record<string, FundDealerRelationship> {
  return Object.fromEntries(FUND_DEALERS.map((dealer) => {
    const prior = memory?.[dealer.id]
    const rfqs = prior?.rfqs ?? 0
    const fills = prior?.fills ?? 0
    const executedNotional = prior?.executedNotional ?? 0
    const cumulativeSavings = prior?.cumulativeSavings ?? 0
    return [dealer.id, { dealerId: dealer.id, dealerName: dealer.name, relationshipScore: prior?.relationshipScore ?? 50, rfqs, fills, executedNotional, cumulativeSavings, lastUsedAt: prior?.lastUsedAt, specialties: [...dealer.specialties], rfqFillRate: rfqs > 0 ? fills / rfqs : 0, averageSavingBps: executedNotional > 0 ? cumulativeSavings / executedNotional * 10000 : 0 }]
  }))
}

function recomputeExecutionQuality(state: FundSessionSnapshot): FundExecutionQuality {
  const q = emptyExecutionQuality()
  for (const trade of state.trades) {
    q.totalNotional += trade.tradedNotional
    q.implementationShortfall += trade.implementationShortfall
    q.timingCost += trade.timingCost
    q.marketImpactCost += trade.marketImpactCost
    if (trade.executionVenue === 'direct-market') q.directNotional += trade.tradedNotional
    else if (trade.executionVenue === 'dealer-rfq') q.dealerNotional += trade.tradedNotional
    else if (trade.executionVenue === 'auction') q.auctionNotional += trade.tradedNotional
    else q.workedNotional += trade.tradedNotional
  }
  const denom = Math.max(1, q.totalNotional)
  q.implementationShortfallBps = q.implementationShortfall / denom * 10000
  q.timingCostBps = q.timingCost / denom * 10000
  q.marketImpactBps = q.marketImpactCost / denom * 10000
  q.dealerSavingBps = state.dealerSavings / Math.max(1, q.dealerNotional) * 10000
  return q
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)) }
function round(value: number, decimals = 6): number { const f = 10 ** decimals; return Math.round(value * f) / f }
function emptyFactors(): Record<FundFactor, number> { return { market: 0, growth: 0, value: 0, quality: 0, rates: 0, momentum: 0 } }
function emptySector(): Record<FundSector, number> { return { Industrials: 0, Technology: 0, Healthcare: 0, Biotech: 0, Index: 0 } }
function resolveScenario(scenario: FundScenario, rng: SeededRandom): Exclude<FundScenario, 'random'> { return scenario === 'random' ? rng.pick(Object.keys(FUND_SCENARIOS) as Exclude<FundScenario, 'random'>[]) : scenario }
function initialPrices(): Record<FundAssetId, number> { return Object.fromEntries(FUND_ASSETS.map((asset) => [asset.id, asset.initialPrice])) as Record<FundAssetId, number> }
function initialPositions(): Record<FundAssetId, FundPosition> { return Object.fromEntries(FUND_ASSETS.map((asset) => [asset.id, { assetId: asset.id, units: 0, lastTradePrice: asset.initialPrice }])) as Record<FundAssetId, FundPosition> }
function emptyByAsset(): Record<FundAssetId, number> { return Object.fromEntries(FUND_ASSETS.map((asset) => [asset.id, 0])) as Record<FundAssetId, number> }
function initialAttribution(): FundAttribution { return { byAsset: emptyByAsset(), byFactor: { market: 0, growth: 0, value: 0, quality: 0, rates: 0, momentum: 0, idiosyncratic: 0, 'transaction-costs': 0, 'borrow-costs': 0 }, betaPnl: 0, alphaPnl: 0 } }

const RESEARCH_BASE: Record<FundAssetId, Omit<FundResearchSnapshot, 'assetId' | 'momentumPct' | 'sectorRelativePct' | 'priorMomentumPct' | 'priorSectorRelativePct' | 'crowding' | 'borrowRatePct' | 'lastUpdatedSeconds'>> = {
  'apex-fund': { forwardPe: 18.6, earningsRevisionPct: 1.2, consensusGrowthPct: 7.5, shortInterestPct: 3.2, qualityScore: 64 },
  'mega-fund': { forwardPe: 31.4, earningsRevisionPct: 4.8, consensusGrowthPct: 18.2, shortInterestPct: 1.4, qualityScore: 88 },
  'nova-fund': { forwardPe: 47.8, earningsRevisionPct: 7.2, consensusGrowthPct: 29.0, shortInterestPct: 10.8, qualityScore: 43 },
  'heli-fund': { forwardPe: 21.2, earningsRevisionPct: 0.8, consensusGrowthPct: 6.2, shortInterestPct: 2.1, qualityScore: 84 },
  'luma-fund': { forwardPe: 14.3, earningsRevisionPct: -2.4, consensusGrowthPct: 4.8, shortInterestPct: 8.7, qualityScore: 56 },
  'orbx-fund': { forwardPe: 0, earningsRevisionPct: -5.5, consensusGrowthPct: 42.0, shortInterestPct: 19.5, qualityScore: 31 },
  'es-fund': { forwardPe: 22.1, earningsRevisionPct: 1.8, consensusGrowthPct: 10.1, shortInterestPct: 0, qualityScore: 71 },
}

function initialResearch(context: FundSessionSnapshot['marketContext']): Record<FundAssetId, FundResearchSnapshot> {
  return Object.fromEntries(FUND_ASSETS.map((asset) => {
    const base = RESEARCH_BASE[asset.id]
    return [asset.id, { ...base, assetId: asset.id, momentumPct: 0, sectorRelativePct: 0, priorMomentumPct: 0, priorSectorRelativePct: 0, crowding: context.crowding[asset.id], borrowRatePct: asset.borrowRatePct, lastUpdatedSeconds: 0 }]
  })) as Record<FundAssetId, FundResearchSnapshot>
}

function computeNav(state: Pick<FundSessionSnapshot, 'cash' | 'positions' | 'prices'>): number {
  return state.cash + FUND_ASSETS.reduce((sum, asset) => sum + state.positions[asset.id].units * state.prices[asset.id], 0)
}

function weightOf(state: Pick<FundSessionSnapshot, 'nav' | 'positions' | 'prices'>, assetId: FundAssetId): number {
  if (!state.nav) return 0
  return state.positions[assetId].units * state.prices[assetId] / state.nav
}

export function computeFundRisk(state: Pick<FundSessionSnapshot, 'nav' | 'cash' | 'positions' | 'prices' | 'options'>): FundRiskSnapshot {
  const nav = Math.max(1, Math.abs(state.nav))
  let gross = 0; let net = 0; let concentration = 0; let beta = 0
  const sectorExposure = emptySector(); const factorExposure = emptyFactors()
  for (const asset of FUND_ASSETS) {
    const weight = state.positions[asset.id].units * state.prices[asset.id] / nav
    gross += Math.abs(weight); net += weight; concentration = Math.max(concentration, Math.abs(weight)); beta += weight * asset.beta
    sectorExposure[asset.sector] += weight
    for (const factor of FACTORS) factorExposure[factor] += weight * asset.factorLoadings[factor]
  }
  const grossLimit = state.options.mandate === 'long-short' ? 2.0 : 1.0
  const concentrationLimit = state.options.mandate === 'long-short' ? .25 : .30
  const netLimit = state.options.mandate === 'long-short' ? .85 : 1.0
  const riskUtilisation = Math.max(gross / grossLimit, concentration / concentrationLimit, Math.abs(net) / netLimit, Math.abs(beta) / 1.25)
  return { grossExposure: gross, netExposure: net, cashWeight: state.cash / nav, concentration, betaExposure: beta, sectorExposure, factorExposure, riskUtilisation }
}



function phaseSettings(elapsedSeconds: number, durationSeconds: number, calendar: FundCatalystEvent[]): { phase: FundMarketPhase; liquidityCostMultiplier: number; volatilityMultiplier: number } {
  const fraction = durationSeconds > 0 ? elapsedSeconds / durationSeconds : 0
  const eventDistance = calendar.filter((event) => !event.revealed).reduce((best, event) => Math.min(best, Math.abs(event.releaseAtSeconds - elapsedSeconds)), Number.POSITIVE_INFINITY)
  const recentEvent = calendar.filter((event) => event.revealed).reduce((best, event) => Math.min(best, Math.abs(event.releaseAtSeconds - elapsedSeconds)), Number.POSITIVE_INFINITY)
  const eventWindow = Math.min(eventDistance, recentEvent) <= Math.max(12, durationSeconds * .018)
  if (eventWindow) return { phase: 'event-window', liquidityCostMultiplier: 1.65, volatilityMultiplier: 1.55 }
  if (fraction < .10) return { phase: 'opening-auction', liquidityCostMultiplier: 1.35, volatilityMultiplier: 1.40 }
  if (fraction < .43) return { phase: 'morning-liquidity', liquidityCostMultiplier: .90, volatilityMultiplier: .95 }
  if (fraction < .68) return { phase: 'midday', liquidityCostMultiplier: 1.22, volatilityMultiplier: .78 }
  return { phase: 'closing-auction', liquidityCostMultiplier: .86, volatilityMultiplier: 1.18 }
}

function computeStressTests(state: Pick<FundSessionSnapshot, 'nav' | 'positions' | 'prices'>): FundStressResult[] {
  const nav = Math.max(1, state.nav)
  const weight = (id: FundAssetId) => state.positions[id].units * state.prices[id] / nav
  const calc = (id: string, label: string, detail: string, shock: (asset: FundAssetConfig) => number): FundStressResult => {
    let pnl = 0
    for (const asset of FUND_ASSETS) pnl += nav * weight(asset.id) * shock(asset)
    return { id, label, detail, pnl, pnlPct: pnl / nav }
  }
  return [
    calc('risk-off', 'Risk-off: equities −5%', 'Broad beta shock with defensive quality cushioning and high-beta amplification.', (asset) => asset.id === 'es-fund' ? -.05 : -.05 * asset.beta + .006 * asset.factorLoadings.quality),
    calc('rates-up', 'US yields +50bp', 'Synthetic duration shock: growth and negative-rates exposures are hit hardest.', (asset) => asset.factorLoadings.rates * .032),
    calc('growth-unwind', 'Growth unwind', 'Growth factor −7%, value +3%; useful for spotting hidden style concentration.', (asset) => asset.factorLoadings.growth * -.07 + asset.factorLoadings.value * .03),
    calc('short-squeeze', 'Crowded shorts +12%', 'Hard-to-borrow single names squeeze sharply while other assets are unchanged.', (asset) => asset.hardToBorrow ? .12 : 0),
  ]
}

function phaseLabel(phase: FundMarketPhase): string {
  if (phase === 'opening-auction') return 'Opening auction'
  if (phase === 'morning-liquidity') return 'Morning liquidity'
  if (phase === 'midday') return 'Midday / thinner tape'
  if (phase === 'event-window') return 'Event window'
  return 'Closing auction'
}

function scoreFund(state: FundSessionSnapshot): FundScore {
  const totalReturn = state.nav / state.options.initialNav - 1
  const benchmarkReturn = state.benchmarkNav / state.options.initialNav - 1
  const alphaReturn = state.options.mandate === 'long-only' ? totalReturn - benchmarkReturn : state.attribution.alphaPnl / state.options.initialNav
  const alphaScore = clamp(50 + alphaReturn * 1100 + totalReturn * 180, 0, 100)
  const dd = Math.abs(state.maxDrawdown)
  const riskScore = clamp(100 - Math.max(0, dd - .025) * 950 - Math.max(0, state.peakGrossExposure - (state.options.mandate === 'long-short' ? 1.65 : .95)) * 85 - Math.max(0, state.peakConcentration - .22) * 190, 0, 100)
  const sizingScore = clamp(98 - Math.max(0, state.peakConcentration - .18) * 210 - Math.max(0, state.peakRiskUtilisation - .9) * 70, 0, 100)
  const q = state.executionQuality
  const dealerBenefit = clamp(q.dealerSavingBps, -5, 10)
  const implementationPenalty = Math.max(0, q.implementationShortfallBps)
  const timingPenalty = Math.max(0, q.timingCostBps)
  const executionScore = q.totalNotional > 0 ? clamp(92 + dealerBenefit * 1.4 - implementationPenalty * 3.2 - timingPenalty * .8, 0, 100) : 62
  const thesisHit = state.theses.length ? state.theses.filter((item) => (item.outcomeReturn ?? 0) > 0).length / state.theses.length : .5
  const thesisQuality = state.theses.length ? state.theses.filter((item) => item.invalidation.trim().length >= 8).length / state.theses.length : .5
  const thesisScore = clamp(35 + thesisHit * 45 + thesisQuality * 20, 0, 100)
  const borrowBps = state.borrowCosts / state.options.initialNav * 10000
  const efficiencyScore = clamp(100 - state.turnover * 12 - borrowBps * 2.5, 0, 100)
  const rawOverall = alphaScore * .30 + riskScore * .25 + sizingScore * .15 + executionScore * .12 + thesisScore * .10 + efficiencyScore * .08
  const inactivityPenalty = state.turnover < .02 ? 24 : state.turnover < .08 ? 10 : state.peakGrossExposure < .08 ? 6 : 0
  const overall = clamp(rawOverall - inactivityPenalty, 0, 100)
  const rating = overall >= 85 ? 'Strong fund process' : overall >= 70 ? 'Controlled alpha process' : overall >= 55 ? 'Inconsistent' : overall >= 40 ? 'Risk-heavy' : 'Poorly controlled'
  return { overall, rating, alpha: alphaScore, risk: riskScore, sizing: sizingScore, execution: executionScore, thesis: thesisScore, efficiency: efficiencyScore }
}

function buildCalendar(durationSeconds: number, rng: SeededRandom, scenario: Exclude<FundScenario, 'random'>): FundCatalystEvent[] {
  const at = (fraction: number) => durationSeconds * fraction
  const events: FundCatalystEvent[] = []
  const primaryPool: FundAssetId[] = scenario === 'growth-rotation'
    ? ['mega-fund', 'nova-fund']
    : scenario === 'value-rotation'
      ? ['apex-fund', 'luma-fund']
      : scenario === 'short-squeeze'
        ? ['orbx-fund', 'nova-fund', 'luma-fund']
        : scenario === 'risk-off'
          ? ['nova-fund', 'orbx-fund', 'heli-fund']
          : SINGLE_NAMES
  const primaryId = rng.pick(primaryPool)
  const primary = FUND_ASSET_MAP[primaryId]
  const chainId = `chain-${primary.symbol.toLowerCase()}-${scenario}`
  const baseEps = round(rng.range(.7, 2.25), 2)
  const revision = round(rng.normal(scenario === 'earnings-season' ? .06 : 0, .10), 2)
  const actualEps = round(baseEps * (1 + revision) + rng.normal(0, .18), 2)
  const revenueConsensus = round(rng.range(3.6, 14.8), 2)
  const revenueActual = round(revenueConsensus * (1 + rng.normal(revision * .35, .025)), 2)
  const marginConsensus = round(rng.range(31, 72), 1)
  const marginActual = round(marginConsensus + rng.normal(revision * 8, 1.8), 1)
  const guidanceConsensus = round(revenueConsensus * 4 * rng.range(.98, 1.05), 1)
  const guidanceActual = round(guidanceConsensus * (1 + rng.normal(revision * .45, .035)), 1)
  const earningsMetrics = [
    { label: 'Revenue', consensus: revenueConsensus, actual: revenueActual, prior: round(revenueConsensus * rng.range(.90, .98), 2), unit: '$bn' },
    { label: 'EPS', consensus: baseEps, actual: actualEps, prior: round(baseEps * rng.range(.88, .97), 2), unit: '$' },
    { label: 'Gross margin', consensus: marginConsensus, actual: marginActual, prior: round(marginConsensus + rng.normal(-.5, 1.2), 1), unit: '%' },
    { label: 'FY revenue guide', consensus: guidanceConsensus, actual: guidanceActual, prior: round(guidanceConsensus * rng.range(.95, .99), 1), unit: '$bn' },
  ]
  const metricSurprises = earningsMetrics.map((m) => (m.actual - m.consensus) / Math.max(.1, Math.abs(m.consensus)))
  const blended = metricSurprises[0] * .25 + metricSurprises[1] * .35 + metricSurprises[2] * .18 + metricSurprises[3] * .22
  const demandTone = blended > .012 ? 'Demand remains resilient, with the strongest momentum in higher-value customers.' : blended < -.012 ? 'Demand softened late in the quarter and management is seeing more cautious customer behaviour.' : 'Demand is broadly tracking plan, with mixed regional trends.'
  const capexTone = marginActual < marginConsensus - .8 ? 'The CFO flags elevated investment and capex, pressuring near-term margins.' : guidanceActual > guidanceConsensus ? 'The CFO says investment remains disciplined despite stronger demand.' : 'The CFO expects spending to remain within the prior planning range.'

  events.push({ id: `${chainId}-1`, assetId: primaryId, title: `${primary.symbol} estimate revision`, type: 'analyst', releaseAtSeconds: at(.13), consensus: 0, actual: round(revision * 100, 1), unit: '% rev', revealed: false, detail: 'An analyst revision changes the setup into the main company catalyst. Treat it as evidence, not the final answer.', chainId, stage: 1, stageLabel: 'Pre-catalyst revision' })
  events.push({ id: `${chainId}-2`, assetId: primaryId, title: `${primary.symbol} earnings`, type: 'earnings', releaseAtSeconds: at(.43), consensus: baseEps, actual: actualEps, unit: 'EPS', revealed: false, detail: 'The headline EPS number is only one part of the release. Revenue, margins and forward guidance can point in different directions.', chainId, stage: 2, stageLabel: 'Primary catalyst', earningsMetrics })
  events.push({ id: `${chainId}-3a`, assetId: primaryId, title: `${primary.symbol} management: demand`, type: 'commentary', releaseAtSeconds: at(.49), consensus: 0, actual: blended > .012 ? .65 : blended < -.012 ? -.65 : .05, unit: 'σ', revealed: false, detail: 'Management commentary adds information after the headline release.', chainId, stage: 3, stageLabel: 'Call: demand', managementCommentary: demandTone })
  events.push({ id: `${chainId}-3b`, assetId: primaryId, title: `${primary.symbol} CFO: investment / margins`, type: 'commentary', releaseAtSeconds: at(.55), consensus: 0, actual: marginActual < marginConsensus - .8 ? -.55 : guidanceActual > guidanceConsensus ? .35 : .05, unit: 'σ', revealed: false, detail: 'The CFO commentary can confirm or reverse the initial earnings interpretation.', chainId, stage: 4, stageLabel: 'Call: margins', managementCommentary: capexTone })
  events.push({ id: `${chainId}-4`, assetId: primaryId, title: `${primary.symbol} guidance follow-through`, type: 'guidance', releaseAtSeconds: at(.62), consensus: guidanceConsensus, actual: guidanceActual, unit: '$bn FY', revealed: false, detail: 'Forward guidance is a separate signal from the headline EPS print. Reassess the thesis rather than anchoring to the first move.', chainId, stage: 5, stageLabel: 'Guidance follow-through' })

  events.push({ id: 'macro-policy-1', title: 'US CPI m/m', type: 'macro', releaseAtSeconds: at(.29), consensus: .2, actual: round(.2 + rng.normal(0, .11), 2), unit: '%', revealed: false, detail: 'Inflation surprise changes discount-rate pressure, growth/value leadership and broad equity beta.', chainId: 'macro-policy', stage: 1, stageLabel: 'Inflation input' })
  events.push({ id: 'macro-policy-2', title: 'Fed policy decision', type: 'macro', releaseAtSeconds: at(.76), consensus: 5.25, actual: round(5.25 + rng.normal(0, .13), 2), unit: '%', revealed: false, detail: 'The policy response can reinforce or offset the earlier inflation signal.', chainId: 'macro-policy', stage: 2, stageLabel: 'Policy response' })

  const remaining = SINGLE_NAMES.filter((id) => id !== primaryId).sort(() => rng.next() - .5).slice(0, 3)
  const slots = [.22, .69, .88]
  remaining.forEach((assetId, index) => {
    const asset = FUND_ASSET_MAP[assetId]
    const type = rng.pick(['guidance', 'analyst', 'mna', 'regulatory'] as const)
    events.push({ id: `event-${assetId}-${index}`, assetId, title: `${asset.symbol} ${type === 'mna' ? 'strategic review' : type}`, type, releaseAtSeconds: at(slots[index]), revealed: false, detail: `${asset.displayName} idiosyncratic catalyst creates cross-sectional dispersion away from the main event chain.` })
  })

  if (scenario === 'short-squeeze') {
    const squeezeId = primary.hardToBorrow ? primaryId : rng.pick(['nova-fund', 'orbx-fund', 'luma-fund'] as FundAssetId[])
    const squeezeAsset = FUND_ASSET_MAP[squeezeId]
    events.push({ id: `squeeze-${squeezeId}`, assetId: squeezeId, title: `${squeezeAsset.symbol} borrow / positioning squeeze`, type: 'squeeze', releaseAtSeconds: at(.84), consensus: 0, actual: round(rng.range(.8, 2.2), 2), unit: 'σ', revealed: false, detail: 'Crowded short positioning meets reduced borrow availability. Price reaction can become nonlinear.', chainId: `squeeze-${squeezeId}`, stage: 2, stageLabel: 'Positioning unwind' })
  }
  return events.sort((a, b) => a.releaseAtSeconds - b.releaseAtSeconds)
}


function initialMarketContext(rng: SeededRandom, scenario: Exclude<FundScenario, 'random'>) {
  const crowding = Object.fromEntries(FUND_ASSETS.map((asset) => {
    let base = rng.range(-.45, .45)
    if (asset.hardToBorrow) base += scenario === 'short-squeeze' ? rng.range(.35, .65) : rng.range(.05, .25)
    if (asset.id === 'mega-fund' && scenario === 'growth-rotation') base -= rng.range(.15, .35)
    return [asset.id, clamp(base, -.9, .9)]
  })) as Record<FundAssetId, number>
  const correlationRegime = scenario === 'stock-pickers' ? 'dispersion' as const : scenario === 'short-squeeze' ? 'factor-squeeze' as const : 'normal' as const
  return { correlationRegime, crowding }
}


function scenarioMomentumBias(scenario: Exclude<FundScenario, 'random'>, assetId: FundAssetId): number {
  if (assetId === 'es-fund') return scenario === 'risk-off' ? -3.2 : scenario === 'growth-rotation' ? 2.4 : scenario === 'value-rotation' ? .8 : 0
  if (scenario === 'growth-rotation') return assetId === 'mega-fund' || assetId === 'nova-fund' ? 5.5 : assetId === 'heli-fund' ? -1.2 : 1.2
  if (scenario === 'value-rotation') return assetId === 'apex-fund' || assetId === 'luma-fund' ? 4.8 : assetId === 'mega-fund' || assetId === 'nova-fund' ? -3.6 : 1.0
  if (scenario === 'risk-off') return assetId === 'heli-fund' ? 2.2 : assetId === 'nova-fund' || assetId === 'orbx-fund' ? -6.0 : -2.5
  if (scenario === 'short-squeeze') return assetId === 'nova-fund' || assetId === 'orbx-fund' || assetId === 'luma-fund' ? 5.2 : .8
  return 0
}

export function createFundPremarketBriefing(options: FundSessionOptions) {
  const rng = new SeededRandom(options.seed)
  const resolvedScenario = resolveScenario(options.scenario, rng)
  const marketContext = initialMarketContext(rng, resolvedScenario)
  const calendar = buildCalendar(options.durationSeconds, rng, resolvedScenario)
  const baseResearch = initialResearch(marketContext)
  const companies = Object.fromEntries(FUND_ASSETS.map((asset) => {
    const priorMomentumPct = clamp(scenarioMomentumBias(resolvedScenario, asset.id) + rng.normal(0, asset.annualVolatility * 13), -14, 14)
    const priorSectorRelativePct = clamp(priorMomentumPct - (asset.beta - 1) * rng.range(1.0, 4.5) + rng.normal(0, 2.2), -12, 12)
    const preMarketChangePct = clamp(priorMomentumPct * .08 + rng.normal(0, Math.max(.35, asset.annualVolatility * 2.4)), -5.5, 5.5)
    const capacityMultiplier = asset.id === 'es-fund' ? 1 : asset.hardToBorrow ? rng.range(.48, .92) : rng.range(.88, 1)
    const borrowCapacityWeight = asset.id === 'es-fund' ? asset.maxShortWeight : asset.maxShortWeight * capacityMultiplier
    const indicativeBorrowRatePct = asset.id === 'es-fund' ? 0 : asset.borrowRatePct * (asset.hardToBorrow ? rng.range(1.02, 1.38) : rng.range(.96, 1.08))
    const knownCatalyst = calendar.find((event) => event.assetId === asset.id)
    const base = baseResearch[asset.id]
    const research: FundResearchSnapshot = {
      ...base,
      momentumPct: priorMomentumPct,
      sectorRelativePct: priorSectorRelativePct,
      priorMomentumPct,
      priorSectorRelativePct,
      borrowRatePct: indicativeBorrowRatePct,
    }
    const headlinePool = asset.id === 'es-fund'
      ? ['Index futures reflect the overnight macro tape; liquidity is normal into the open.', 'US equity futures are active ahead of the scheduled macro calendar.', 'Index liquidity is healthy, but event risk can change depth quickly.']
      : [
          `${asset.symbol} sees ${preMarketChangePct >= 0 ? 'positive' : 'negative'} pre-market interest after overnight institutional flow.`,
          `${asset.symbol} broker commentary is active; positioning remains ${marketContext.crowding[asset.id] > .2 ? 'short-heavy' : marketContext.crowding[asset.id] < -.2 ? 'long-heavy' : 'balanced'}.`,
          `${asset.symbol} opens with attention on ${knownCatalyst ? knownCatalyst.title.toLowerCase() : 'estimate revisions and sector-relative performance'}.`,
        ]
    return [asset.id, {
      assetId: asset.id,
      previousClose: asset.initialPrice,
      preMarketChangePct,
      overnightHeadline: rng.pick(headlinePool),
      benchmarkWeight: BENCHMARK_WEIGHTS[asset.id],
      borrowCapacityWeight,
      indicativeBorrowRatePct,
      research,
      knownCatalyst: knownCatalyst ? { id: knownCatalyst.id, title: knownCatalyst.title, type: knownCatalyst.type, releaseAtSeconds: knownCatalyst.releaseAtSeconds, detail: knownCatalyst.detail, earningsMetrics: knownCatalyst.earningsMetrics } : undefined,
    }]
  })) as Record<FundAssetId, FundPreMarketCompanyBrief>
  const marketOverview = [
    `US equity futures ${companies['es-fund'].preMarketChangePct >= 0 ? '+' : ''}${companies['es-fund'].preMarketChangePct.toFixed(1)}% versus the prior close.`,
    `Rates-sensitive growth positioning is ${marketContext.correlationRegime === 'factor-squeeze' ? 'crowded and unstable' : marketContext.correlationRegime === 'dispersion' ? 'less dominant as dispersion rises' : 'mixed into the open'}.`,
    `First scheduled macro release: ${calendar.find((event) => !event.assetId)?.title ?? 'No broad macro release'}; company catalysts are staged throughout the session.`,
  ]
  return { resolvedScenario, marketOverview, companies }
}


function applyInitialFundPortfolio(options: FundSessionOptions, prices: Record<FundAssetId, number>, positions: Record<FundAssetId, FundPosition>) {
  const requested = options.initialWeights ?? {}
  const weights = Object.fromEntries(FUND_ASSETS.map((asset) => {
    let weight = Number(requested[asset.id] ?? 0)
    if (!Number.isFinite(weight)) weight = 0
    if (options.mandate === 'long-only') weight = clamp(weight, 0, asset.maxAbsWeight)
    else weight = clamp(weight, -asset.maxAbsWeight, asset.maxAbsWeight)
    return [asset.id, weight]
  })) as Record<FundAssetId, number>
  let gross = FUND_ASSETS.reduce((sum, asset) => sum + Math.abs(weights[asset.id]), 0)
  let net = FUND_ASSETS.reduce((sum, asset) => sum + weights[asset.id], 0)
  const invalid = options.mandate === 'long-only' ? net > 1.001 : gross > 2.001 || Math.abs(net) > .851
  if (invalid) for (const asset of FUND_ASSETS) weights[asset.id] = 0
  gross = FUND_ASSETS.reduce((sum, asset) => sum + Math.abs(weights[asset.id]), 0)
  net = FUND_ASSETS.reduce((sum, asset) => sum + weights[asset.id], 0)
  for (const asset of FUND_ASSETS) {
    positions[asset.id].units = weights[asset.id] * options.initialNav / prices[asset.id]
    positions[asset.id].lastTradePrice = prices[asset.id]
  }
  return { weights, cash: options.initialNav * (1 - net), gross, net }
}

function benchmarkValue(prices: Record<FundAssetId, number>, initialNav: number, mandate: FundMandate): number {
  if (mandate === 'long-short') return initialNav * prices['es-fund'] / FUND_ASSET_MAP['es-fund'].initialPrice
  let ratio = 0
  for (const assetId of SINGLE_NAMES) ratio += BENCHMARK_WEIGHTS[assetId] * prices[assetId] / FUND_ASSET_MAP[assetId].initialPrice
  return initialNav * ratio
}

export class EquityFundEngine {
  private readonly rng: SeededRandom
  private readonly resolvedScenario: Exclude<FundScenario, 'random'>
  private state: FundSessionSnapshot
  private lastHeadlineAt = 0

  constructor(options: FundSessionOptions) {
    this.rng = new SeededRandom(options.seed)
    this.resolvedScenario = resolveScenario(options.scenario, this.rng)
    const prices = initialPrices()
    const positions = initialPositions()
    const marketContext = initialMarketContext(this.rng, this.resolvedScenario)
    const calendar = buildCalendar(options.durationSeconds, this.rng, this.resolvedScenario)
    const briefing = options.preMarketBriefing ?? createFundPremarketBriefing(options)
    const research = initialResearch(marketContext)
    for (const asset of FUND_ASSETS) research[asset.id] = { ...briefing.companies[asset.id].research, crowding: marketContext.crowding[asset.id], lastUpdatedSeconds: 0 }
    const starting = applyInitialFundPortfolio(options, prices, positions)
    const initialLocates = structuredClone(options.initialLocates ?? {})
    const portfolioLabel = options.startingPortfolio?.replace(/-/g, ' ') ?? (starting.gross > .001 ? 'custom' : 'flat')
    const effectiveOptions: FundSessionOptions = { ...options, preMarketBriefing: briefing }
    const openingPhase = phaseSettings(0, options.durationSeconds, calendar)
    const base: FundSessionSnapshot = {
      options: effectiveOptions, resolvedScenario: this.resolvedScenario, elapsedSeconds: 0, status: 'running', nav: options.initialNav, benchmarkNav: options.initialNav,
      cash: starting.cash, peakNav: options.initialNav, maxDrawdown: 0, prices, previousPrices: { ...prices }, positions,
      headlines: [{ id: 'open', timestamp: 0, severity: 'info', title: `${options.mandate === 'long-short' ? 'Long/short fund' : 'Long-only mandate'} opened`, detail: `Markets are live with the ${portfolioLabel} starting portfolio. Initial holdings are inherited at the opening mark with no simulated transaction cost.` }],
      calendar, trades: [], theses: [], locates: initialLocates, dealerRfqs: [], dealerTrades: 0, dealerSavings: 0, dealerRelationships: buildDealerRelationships(options.dealerMemory), executionQuality: emptyExecutionQuality(), workingOrders: [], borrowCosts: 0,
      transactionCosts: 0, turnover: 0, peakGrossExposure: starting.gross, peakConcentration: Math.max(...Object.values(starting.weights).map(Math.abs)), peakRiskUtilisation: 0, peakBetaExposure: 0,
      risk: { grossExposure: starting.gross, netExposure: starting.net, cashWeight: starting.cash / options.initialNav, concentration: 0, betaExposure: 0, sectorExposure: emptySector(), factorExposure: emptyFactors(), riskUtilisation: 0 },
      attribution: initialAttribution(), factorPulse: emptyFactors(), marketContext, marketPhase: openingPhase.phase, liquidityCostMultiplier: openingPhase.liquidityCostMultiplier, volatilityMultiplier: openingPhase.volatilityMultiplier, stressTests: [], salesColour: [], riskManagerMessages: [], research, auditTrail: [{ id: 'audit-open', timestamp: 0, type: 'risk', title: 'Mandate opened', detail: `Inherited ${portfolioLabel} portfolio: gross ${(starting.gross * 100).toFixed(0)}%, net ${(starting.net * 100).toFixed(0)}%, cash ${(starting.cash / options.initialNav * 100).toFixed(0)}%. Starting holdings do not count as turnover or transaction cost.`, severity: 'info' }], history: [{ elapsedSeconds: 0, nav: options.initialNav, benchmarkNav: options.initialNav, drawdown: 0, prices: { ...prices } }],
    }
    this.state = base
    this.state.risk = computeFundRisk(this.state)
    this.state.peakRiskUtilisation = this.state.risk.riskUtilisation
    this.state.peakBetaExposure = Math.abs(this.state.risk.betaExposure)
    this.state.stressTests = computeStressTests(this.state)
    this.pushRiskManagerMessage('info', 'Opening risk check', `Opening book: gross ${(this.state.risk.grossExposure * 100).toFixed(0)}%, net ${(this.state.risk.netExposure * 100).toFixed(0)}%, beta ${this.state.risk.betaExposure >= 0 ? '+' : ''}${this.state.risk.betaExposure.toFixed(2)}.`)
  }

  snapshot(): FundSessionSnapshot { return structuredClone(this.state) }

  private audit(entry: Omit<FundDecisionAuditEntry, 'id' | 'timestamp'> & { timestamp?: number }): void {
    this.state.auditTrail.unshift({ id: `audit-${this.state.elapsedSeconds.toFixed(2)}-${this.rng.int(1000, 9999)}`, timestamp: entry.timestamp ?? this.state.elapsedSeconds, ...entry })
    if (this.state.auditTrail.length > 240) this.state.auditTrail.pop()
  }

  private pushRiskManagerMessage(severity: FundRiskManagerMessage['severity'], title: string, detail: string): void {
    const duplicate = this.state.riskManagerMessages[0]
    if (duplicate && duplicate.title === title && this.state.elapsedSeconds - duplicate.timestamp < 20) return
    const message: FundRiskManagerMessage = { id: `risk-msg-${this.state.elapsedSeconds.toFixed(2)}-${this.rng.int(100, 999)}`, timestamp: this.state.elapsedSeconds, severity, title, detail }
    this.state.riskManagerMessages.unshift(message)
    if (this.state.riskManagerMessages.length > 20) this.state.riskManagerMessages.pop()
    this.audit({ type: 'oversight', title, detail, severity })
  }

  private updateOversight(): void {
    const risk = this.state.risk
    if (risk.riskUtilisation > 1) this.pushRiskManagerMessage('critical', 'Risk limit breach', `Risk utilisation is ${(risk.riskUtilisation * 100).toFixed(0)}%. Reduce gross, concentration, net or beta exposure immediately.`)
    else if (risk.riskUtilisation > .86) this.pushRiskManagerMessage('warning', 'Risk utilisation elevated', `Risk utilisation is ${(risk.riskUtilisation * 100).toFixed(0)}%; new positions should be funded by reductions elsewhere.`)
    if (this.state.options.mandate === 'long-short' && Math.abs(risk.betaExposure) > .48) this.pushRiskManagerMessage('warning', 'Portfolio beta outside preferred band', `Estimated beta is ${risk.betaExposure >= 0 ? '+' : ''}${risk.betaExposure.toFixed(2)}. Decide whether this is intentional market risk or unwanted beta.`)
    if (risk.concentration > .215) this.pushRiskManagerMessage('warning', 'Single-name concentration', `Largest position is ${(risk.concentration * 100).toFixed(1)}% NAV. A single catalyst is becoming a material driver of portfolio outcomes.`)
    const worst = [...this.state.stressTests].sort((a, b) => a.pnl - b.pnl)[0]
    if (worst && worst.pnlPct < -.055) this.pushRiskManagerMessage('warning', 'Stress loss elevated', `${worst.label} implies ${worst.pnlPct.toFixed(3)} of NAV (${Math.round(worst.pnl / 1000)}k) in the synthetic stress panel.`)
  }

  private maybeSalesColour(dt: number): void {
    const active = this.state.salesColour.filter((item) => item.expiresAtSeconds > this.state.elapsedSeconds)
    this.state.salesColour = active
    if (this.state.elapsedSeconds < 8 || !this.rng.chance(.012 * dt)) return
    const dealer = this.rng.pick(FUND_DEALERS)
    const assetId = this.rng.pick(dealer.specialties.filter((id) => id !== 'es-fund').length ? dealer.specialties.filter((id) => id !== 'es-fund') : SINGLE_NAMES)
    const asset = FUND_ASSET_MAP[assetId]
    const crowding = this.state.marketContext.crowding[assetId]
    const bias: FundSalesColour['bias'] = crowding > .25 ? 'buying' : crowding < -.25 ? 'selling' : this.rng.pick(['buying', 'selling', 'two-way'] as const)
    const truthSignal = bias === 'buying' ? 'Real money better buyers' : bias === 'selling' ? 'Real money better sellers' : 'Two-way institutional interest'
    const inventoryMessage = this.rng.pick([
      `${truthSignal} in ${asset.symbol}; liquidity is ${this.state.marketPhase === 'event-window' ? 'fragile around the event' : this.state.marketPhase === 'midday' ? 'thin through lunch' : 'orderly for now'}.`,
      `${dealer.name} has ${bias === 'buying' ? 'a bid-side axe' : bias === 'selling' ? 'an axe to sell' : 'balanced inventory'} in ${asset.symbol}; size is available but colour may be inventory-driven.`,
      `${asset.symbol}: fast-money activity has picked up. ${bias === 'buying' ? 'Offers are being lifted' : bias === 'selling' ? 'Bids are being hit' : 'Flow is mixed'} and the next block may move the tape.`,
    ])
    const item: FundSalesColour = { id: `colour-${this.state.elapsedSeconds}-${this.rng.int(100,999)}`, timestamp: this.state.elapsedSeconds, dealerId: dealer.id, dealerName: dealer.name, assetId, message: inventoryMessage, bias, reliability: this.rng.range(.45, .88), expiresAtSeconds: this.state.elapsedSeconds + this.rng.range(45, 110) }
    this.state.salesColour.unshift(item)
    if (this.state.salesColour.length > 10) this.state.salesColour.pop()
    this.audit({ type: 'colour', assetId, title: `${dealer.name} market colour`, detail: inventoryMessage, severity: 'info' })
  }

  private refreshResearch(): void {
    const marketReturn = this.state.prices['es-fund'] / FUND_ASSET_MAP['es-fund'].initialPrice - 1
    for (const asset of FUND_ASSETS) {
      const item = this.state.research[asset.id]
      const ownReturn = this.state.prices[asset.id] / asset.initialPrice - 1
      item.momentumPct = item.priorMomentumPct + ownReturn * 100
      item.sectorRelativePct = item.priorSectorRelativePct + (ownReturn - marketReturn * asset.beta) * 100
      item.crowding = this.state.marketContext.crowding[asset.id]
      const locate = this.state.locates[asset.id]
      item.borrowRatePct = locate?.borrowRatePct ?? asset.borrowRatePct
      item.lastUpdatedSeconds = this.state.elapsedSeconds
    }
  }

  tick(dt: number): FundSessionSnapshot {
    if (this.state.status !== 'running') return this.snapshot()
    const safeDt = clamp(dt, 0, 1)
    this.state.previousPrices = { ...this.state.prices }
    this.state.elapsedSeconds = Math.min(this.state.options.durationSeconds, this.state.elapsedSeconds + safeDt)
    const phase = phaseSettings(this.state.elapsedSeconds, this.state.options.durationSeconds, this.state.calendar)
    const phaseChanged = phase.phase !== this.state.marketPhase
    this.state.marketPhase = phase.phase; this.state.liquidityCostMultiplier = phase.liquidityCostMultiplier; this.state.volatilityMultiplier = phase.volatilityMultiplier
    if (phaseChanged) this.state.headlines.unshift({ id: `phase-${this.state.elapsedSeconds}-${this.rng.int(100,999)}`, timestamp: this.state.elapsedSeconds, severity: phase.phase === 'event-window' ? 'warning' : 'info', title: `Market phase: ${phaseLabel(phase.phase)}`, detail: `Synthetic liquidity cost multiplier ${phase.liquidityCostMultiplier.toFixed(2)}x; volatility multiplier ${phase.volatilityMultiplier.toFixed(2)}x.` })
    const representedDays = 20 * safeDt / Math.max(1, this.state.options.durationSeconds)
    const sqrtDays = Math.sqrt(Math.max(0, representedDays))
    const scenario = FUND_SCENARIOS[this.resolvedScenario]
    const factorPulse = emptyFactors()
    for (const factor of FACTORS) {
      const dailyNoise = this.rng.normal(0, factor === 'market' ? .007 : .0045) * sqrtDays * this.state.volatilityMultiplier
      const drift = scenario.drift[factor] * representedDays
      factorPulse[factor] = drift + dailyNoise
    }
    for (const asset of FUND_ASSETS) {
      const current = this.state.marketContext.crowding[asset.id]
      const driftToNeutral = -current * .0035 * representedDays
      const flowNoise = this.rng.normal(0, .015) * sqrtDays
      const squeezeBias = this.resolvedScenario === 'short-squeeze' && asset.hardToBorrow ? .0025 * representedDays : 0
      this.state.marketContext.crowding[asset.id] = clamp(current + driftToNeutral + flowNoise + squeezeBias, -.95, .95)
    }
    if (this.resolvedScenario === 'stock-pickers') this.state.marketContext.correlationRegime = 'dispersion'
    else if (this.resolvedScenario === 'short-squeeze' || Math.max(...Object.values(this.state.marketContext.crowding)) > .72) this.state.marketContext.correlationRegime = 'factor-squeeze'
    else if (this.rng.chance(.0012 * safeDt)) this.state.marketContext.correlationRegime = this.state.marketContext.correlationRegime === 'normal' ? 'dispersion' : 'normal'

    this.releaseEvents(factorPulse)
    this.state.factorPulse = factorPulse
    this.refreshResearch()

    const preNav = Math.max(1, this.state.nav)
    const preWeights = Object.fromEntries(FUND_ASSETS.map((asset) => [asset.id, weightOf(this.state, asset.id)])) as Record<FundAssetId, number>
    let factorPnlTotal = 0
    for (const asset of FUND_ASSETS) {
      let factorReturn = 0
      const correlationMultiplier = this.state.marketContext.correlationRegime === 'dispersion' ? .72 : this.state.marketContext.correlationRegime === 'factor-squeeze' ? 1.12 : 1
      for (const factor of FACTORS) factorReturn += asset.factorLoadings[factor] * factorPulse[factor] * correlationMultiplier
      const idioMultiplier = this.state.marketContext.correlationRegime === 'dispersion' ? 1.42 : 1
      const idioVol = asset.annualVolatility / Math.sqrt(252) * sqrtDays * idioMultiplier * this.state.volatilityMultiplier
      let idioReturn = this.rng.normal(0, idioVol)
      const crowding = this.state.marketContext.crowding[asset.id]
      if (asset.hardToBorrow && crowding > .35 && factorPulse.momentum > 0) idioReturn += crowding * factorPulse.momentum * .7
      if (this.resolvedScenario === 'short-squeeze' && asset.hardToBorrow && this.rng.chance((.002 + Math.max(0, crowding) * .004) * safeDt)) idioReturn += this.rng.range(.025, .08) * (1 + Math.max(0, crowding) * .55)
      const totalReturn = clamp(factorReturn + idioReturn, -.18, .18)
      this.state.prices[asset.id] = Math.max(.05, this.state.prices[asset.id] * (1 + totalReturn))
      const exposure = preWeights[asset.id] * preNav
      this.state.attribution.byAsset[asset.id] += exposure * totalReturn
      let assetFactorPnl = 0
      for (const factor of FACTORS) {
        const pnl = exposure * asset.factorLoadings[factor] * factorPulse[factor]
        this.state.attribution.byFactor[factor] += pnl
        assetFactorPnl += pnl
      }
      const idioPnl = exposure * idioReturn
      this.state.attribution.byFactor.idiosyncratic += idioPnl
      factorPnlTotal += assetFactorPnl
    }

    const esRet = this.state.previousPrices['es-fund'] ? this.state.prices['es-fund'] / this.state.previousPrices['es-fund'] - 1 : 0
    this.state.attribution.betaPnl += preNav * this.state.risk.betaExposure * esRet

    this.accrueBorrow(representedDays)
    this.processWorkingOrders()
    this.expireDealerRfq()
    this.maybeHeadline(safeDt)
    this.maybeSalesColour(safeDt)
    this.state.nav = computeNav(this.state)
    this.state.benchmarkNav = benchmarkValue(this.state.prices, this.state.options.initialNav, this.state.options.mandate)
    this.state.attribution.alphaPnl = (this.state.nav - this.state.options.initialNav) - this.state.attribution.betaPnl
    this.state.peakNav = Math.max(this.state.peakNav, this.state.nav)
    const drawdown = this.state.nav / Math.max(1, this.state.peakNav) - 1
    this.state.maxDrawdown = Math.min(this.state.maxDrawdown, drawdown)
    this.state.risk = computeFundRisk(this.state)
    this.state.peakGrossExposure = Math.max(this.state.peakGrossExposure, this.state.risk.grossExposure)
    this.state.peakConcentration = Math.max(this.state.peakConcentration, this.state.risk.concentration)
    this.state.peakRiskUtilisation = Math.max(this.state.peakRiskUtilisation, this.state.risk.riskUtilisation)
    this.state.peakBetaExposure = Math.max(this.state.peakBetaExposure, Math.abs(this.state.risk.betaExposure))
    this.state.stressTests = computeStressTests(this.state)
    this.updateOversight()
    if (this.state.history.length === 0 || this.state.elapsedSeconds - this.state.history[this.state.history.length - 1].elapsedSeconds >= 2) {
      this.state.history.push({ elapsedSeconds: this.state.elapsedSeconds, nav: this.state.nav, benchmarkNav: this.state.benchmarkNav, drawdown, prices: { ...this.state.prices } })
      if (this.state.history.length > 1000) this.state.history.shift()
    }
    if (drawdown <= -.12 || this.state.elapsedSeconds >= this.state.options.durationSeconds) this.finish()
    void factorPnlTotal
    return this.snapshot()
  }

  pause(): void { if (this.state.status === 'running') this.state.status = 'paused' }
  resume(): void { if (this.state.status === 'paused') this.state.status = 'running' }
  finish(): void {
    if (this.state.status === 'finished') return
    this.state.nav = computeNav(this.state)
    this.state.risk = computeFundRisk(this.state)
    for (const thesis of this.state.theses) {
      const endPrice = this.state.prices[thesis.assetId]
      const raw = thesis.entryPrice ? endPrice / thesis.entryPrice - 1 : 0
      thesis.outcomeReturn = raw * (thesis.targetWeight >= thesis.previousWeight ? 1 : -1)
    }
    this.state.executionQuality = recomputeExecutionQuality(this.state)
    this.state.status = 'finished'
    this.state.score = scoreFund(this.state)
  }

  requestLocate(assetId: FundAssetId, requestedWeight: number): { accepted: boolean; reason: string } {
    const asset = FUND_ASSET_MAP[assetId]
    if (this.state.options.mandate !== 'long-short') return { accepted: false, reason: 'Long-only mandates cannot establish short positions.' }
    if (assetId === 'es-fund') return { accepted: true, reason: 'Index futures do not require a securities-borrow locate in this simulation.' }
    const desiredShort = Math.abs(Math.min(0, requestedWeight))
    if (desiredShort <= 0) return { accepted: false, reason: 'Enter a negative target weight before requesting a short locate.' }
    const crowdingPenalty = asset.hardToBorrow ? this.rng.range(.55, .95) : this.rng.range(.85, 1.05)
    const capacity = Math.min(asset.maxShortWeight, desiredShort) * crowdingPenalty
    const rejected = asset.hardToBorrow && this.rng.chance(assetId === 'orbx-fund' ? .18 : .08)
    const status: FundLocate['status'] = rejected ? 'rejected' : capacity + .002 < desiredShort ? 'partial' : 'approved'
    const locate: FundLocate = { assetId, requestedWeight, approvedShortWeight: rejected ? 0 : capacity, borrowRatePct: asset.borrowRatePct * (asset.hardToBorrow ? this.rng.range(1, 1.35) : 1), status, timestamp: this.state.elapsedSeconds }
    this.state.locates[assetId] = locate
    this.state.headlines.unshift({ id: `locate-${assetId}-${this.state.elapsedSeconds}`, timestamp: this.state.elapsedSeconds, severity: status === 'rejected' ? 'warning' : 'info', title: `${asset.symbol} locate ${status}`, detail: rejected ? 'Prime broker could not source borrow at the requested size.' : `Borrow available to roughly ${(locate.approvedShortWeight * 100).toFixed(1)}% NAV at ${locate.borrowRatePct.toFixed(1)}% annualised.` , assetId })
    this.audit({ type: 'locate', assetId, title: `${asset.symbol} locate ${status}`, detail: rejected ? 'Borrow unavailable at requested size.' : `${(locate.approvedShortWeight * 100).toFixed(1)}% NAV approved at ${locate.borrowRatePct.toFixed(1)}% annualised.`, severity: status === 'rejected' ? 'warning' : 'info' })
    this.refreshResearch()
    return { accepted: !rejected, reason: rejected ? 'Locate rejected.' : status === 'partial' ? 'Partial locate approved.' : 'Locate approved.' }
  }

  executeTarget(intent: FundTradeIntent): { accepted: boolean; reason: string } { return this.executeTargetInternal(intent, 'direct-market') }

  executeAuction(intent: FundTradeIntent): { accepted: boolean; reason: string } {
    if (this.state.marketPhase !== 'opening-auction' && this.state.marketPhase !== 'closing-auction') return { accepted: false, reason: 'Auction execution is only available during the opening or closing auction window.' }
    if (intent.assetId === 'es-fund') return { accepted: false, reason: 'Use the direct futures market for ES rather than the equity auction route.' }
    return this.executeTargetInternal(intent, 'auction')
  }

  requestDealerQuotes(intent: FundTradeIntent, dealerCount: number): { accepted: boolean; reason: string } {
    if (this.state.activeDealerRfq?.status === 'open') return { accepted: false, reason: 'A dealer RFQ is already live.' }
    const validation = this.validateTarget(intent)
    if (!validation.accepted) return validation
    const asset = FUND_ASSET_MAP[intent.assetId]
    const currentWeight = weightOf(this.state, asset.id)
    const deltaNotional = (intent.targetWeight - currentWeight) * this.state.nav
    if (Math.abs(deltaNotional) < 10_000) return { accepted: false, reason: 'Target is too close to the current position.' }
    const side: 'buy' | 'sell' = deltaNotional > 0 ? 'buy' : 'sell'
    const mid = this.state.prices[asset.id]
    const requestedNotional = Math.abs(deltaNotional)
    const requestedUnits = requestedNotional / mid
    const sizePct = requestedNotional / Math.max(1, this.state.nav)
    const directBps = asset.transactionCostBps * this.state.liquidityCostMultiplier * (1 + Math.pow(sizePct / .05, .7) * .9)
    const directBenchmarkPrice = mid * (1 + (side === 'buy' ? 1 : -1) * directBps / 10000)
    const directCost = Math.abs(directBenchmarkPrice - mid) * requestedUnits
    const selected = [...FUND_DEALERS].sort(() => this.rng.next() - .5).slice(0, clamp(Math.floor(dealerCount), 1, FUND_DEALERS.length))
    const quotes: FundDealerQuote[] = selected.map((dealer) => {
      const relationship = this.state.dealerRelationships[dealer.id]
      relationship.rfqs += 1
      relationship.rfqFillRate = relationship.rfqs > 0 ? relationship.fills / relationship.rfqs : 0
      const axe = this.rng.weighted([{ item: 'neutral' as const, weight: 5 }, { item: side === 'buy' ? 'sell' as const : 'buy' as const, weight: 3 }, { item: side as 'buy' | 'sell', weight: 2 }])
      const favourable = (side === 'buy' && axe === 'sell') || (side === 'sell' && axe === 'buy')
      const unfavourable = axe === side
      const specialist = dealer.specialties.includes(asset.id)
      const relationshipFactor = 1 - clamp((relationship.relationshipScore - 50) / 250, -.08, .08)
      const specialistFactor = specialist ? .88 : 1
      const quoteBps = directBps * dealer.edge * relationshipFactor * specialistFactor * (favourable ? this.rng.range(.48, .78) : unfavourable ? this.rng.range(.95, 1.25) : this.rng.range(.72, .98))
      const half = mid * quoteBps / 10000
      const capacityBoost = specialist ? 1.18 : 1
      const capacity = requestedNotional * clamp(this.rng.range(.45, 1.25) * capacityBoost * (asset.hardToBorrow && side === 'sell' ? .75 : 1), .2, 1)
      const relationshipLabel = relationship.relationshipScore >= 65 ? ' · relationship' : ''
      const specialtyLabel = specialist ? ' · specialist' : ''
      return { id: `${dealer.id}-${this.state.elapsedSeconds}-${this.rng.int(100, 999)}`, dealerId: dealer.id, dealerName: dealer.name, bid: mid - half, offer: mid + half, maxNotional: capacity, axe, colour: `${favourable ? (side === 'buy' ? 'Axe to sell' : 'Bid wanted') : unfavourable ? 'Wrong-way inventory' : 'Neutral'}${specialtyLabel}${relationshipLabel}`, expiresAtSeconds: this.state.elapsedSeconds + this.rng.range(9, 16) }
    })
    const rfq: FundDealerRfq = { id: `rfq-${this.state.elapsedSeconds}-${this.rng.int(1000, 9999)}`, timestamp: this.state.elapsedSeconds, assetId: asset.id, side, currentWeight, targetWeight: intent.targetWeight, requestedNotional, requestedUnits, directBenchmarkPrice, directCost, arrivalPrice: mid, quotes, intent, status: 'open' }
    this.state.activeDealerRfq = rfq; this.state.dealerRfqs.unshift(rfq)
    this.audit({ type: 'rfq', assetId: asset.id, title: `${asset.symbol} dealer RFQ`, detail: `${side.toUpperCase()} ${(requestedNotional / 1_000_000).toFixed(2)}m requested from ${quotes.length} dealers. Direct benchmark ${directBenchmarkPrice.toFixed(asset.priceDecimals)}.`, refId: rfq.id })
    return { accepted: true, reason: `${quotes.length} dealer quotes requested.` }
  }

  acceptDealerQuote(quoteId: string, fillFraction = 1): { accepted: boolean; reason: string } {
    const rfq = this.state.activeDealerRfq
    if (!rfq || rfq.status !== 'open') return { accepted: false, reason: 'No live dealer RFQ.' }
    const quote = rfq.quotes.find((item) => item.id === quoteId)
    if (!quote || quote.expiresAtSeconds < this.state.elapsedSeconds) return { accepted: false, reason: 'That dealer quote has expired.' }
    const asset = FUND_ASSET_MAP[rfq.assetId]
    const maxFraction = Math.min(1, quote.maxNotional / Math.max(1, rfq.requestedNotional))
    const actualFraction = clamp(fillFraction, .01, maxFraction)
    const fillNotional = rfq.requestedNotional * actualFraction
    const targetWeight = rfq.currentWeight + (rfq.targetWeight - rfq.currentWeight) * actualFraction
    const executionPrice = rfq.side === 'buy' ? quote.offer : quote.bid
    const result = this.executeTargetInternal({ ...rfq.intent, targetWeight, recordThesis: rfq.intent.recordThesis && actualFraction >= .95 }, 'dealer-rfq', executionPrice, quote.dealerName, rfq.arrivalPrice)
    if (!result.accepted) return result
    const benchmarkPrice = rfq.directBenchmarkPrice
    const units = fillNotional / Math.max(.01, this.state.prices[asset.id])
    const savings = rfq.side === 'buy' ? (benchmarkPrice - executionPrice) * units : (executionPrice - benchmarkPrice) * units
    rfq.filledNotional = (rfq.filledNotional ?? 0) + fillNotional; rfq.selectedQuoteId = quoteId; rfq.dealerName = quote.dealerName; rfq.savingsVsDirect = (rfq.savingsVsDirect ?? 0) + savings
    this.state.dealerTrades += 1; this.state.dealerSavings += savings
    const relationship = this.state.dealerRelationships[quote.dealerId]
    relationship.fills += 1
    relationship.executedNotional += fillNotional
    relationship.cumulativeSavings += savings
    relationship.rfqFillRate = relationship.rfqs > 0 ? relationship.fills / relationship.rfqs : 0
    relationship.averageSavingBps = relationship.executedNotional > 0 ? relationship.cumulativeSavings / relationship.executedNotional * 10000 : 0
    relationship.relationshipScore = clamp(relationship.relationshipScore + (savings >= 0 ? 1.5 : -.75) + actualFraction * .8, 20, 90)
    relationship.lastUsedAt = `seed ${this.state.options.seed} · ${this.state.elapsedSeconds.toFixed(0)}s`
    this.audit({ type: 'dealer-fill', assetId: asset.id, title: `${asset.symbol} dealer fill`, detail: `${quote.dealerName} filled ${(actualFraction * 100).toFixed(0)}% (${(fillNotional / 1_000_000).toFixed(2)}m) at ${executionPrice.toFixed(asset.priceDecimals)}; ${savings >= 0 ? 'saved' : 'cost'} $${Math.abs(savings).toFixed(0)} versus direct benchmark.`, refId: rfq.id, severity: savings >= 0 ? 'info' : 'warning' })
    if (actualFraction >= .995 || (rfq.filledNotional ?? 0) >= rfq.requestedNotional * .995) { rfq.status = 'executed'; this.state.activeDealerRfq = undefined }
    else { rfq.status = 'executed'; this.state.activeDealerRfq = undefined }
    return { accepted: true, reason: `${quote.dealerName} filled ${(actualFraction * 100).toFixed(0)}% of the block.` }
  }

  cancelDealerRfq(): { accepted: boolean; reason: string } {
    if (!this.state.activeDealerRfq) return { accepted: false, reason: 'No live dealer RFQ.' }
    const cancelled = this.state.activeDealerRfq
    this.audit({ type: 'rfq', assetId: cancelled.assetId, title: `${FUND_ASSET_MAP[cancelled.assetId].symbol} RFQ cancelled`, detail: 'Dealer quotes were cancelled before execution.', refId: cancelled.id })
    cancelled.status = 'cancelled'; this.state.activeDealerRfq = undefined
    return { accepted: true, reason: 'Dealer RFQ cancelled.' }
  }

  startWorkingOrder(intent: FundTradeIntent, style: FundWorkingStyle, durationSeconds: number): { accepted: boolean; reason: string } {
    const validation = this.validateTarget(intent)
    if (!validation.accepted) return validation
    const currentWeight = weightOf(this.state, intent.assetId)
    const deltaNotional = (intent.targetWeight - currentWeight) * this.state.nav
    if (Math.abs(deltaNotional) < 10_000) return { accepted: false, reason: 'Target is too close to the current position.' }
    const order: FundWorkingOrder = { id: `work-${this.state.elapsedSeconds}-${this.rng.int(1000, 9999)}`, assetId: intent.assetId, side: deltaNotional > 0 ? 'buy' : 'sell', style, startedAtSeconds: this.state.elapsedSeconds, targetWeight: intent.targetWeight, startingWeight: currentWeight, totalNotional: Math.abs(deltaNotional), remainingNotional: Math.abs(deltaNotional), executedNotional: 0, averageExecutionPrice: 0, durationSeconds: clamp(durationSeconds, 15, 180), nextSliceAtSeconds: this.state.elapsedSeconds, arrivalPrice: this.state.prices[intent.assetId], status: 'working', intent }
    this.state.workingOrders.push(order)
    this.audit({ type: 'worked-order', assetId: intent.assetId, title: `${FUND_ASSET_MAP[intent.assetId].symbol} ${style} started`, detail: `${(Math.abs(deltaNotional) / 1_000_000).toFixed(2)}m to work over ${order.durationSeconds.toFixed(0)} seconds.`, refId: order.id })
    return { accepted: true, reason: `${style === 'twap' ? 'TWAP' : 'Liquidity-sensitive'} order started.` }
  }

  pauseWorkingOrder(id: string): void { const order = this.state.workingOrders.find((item) => item.id === id); if (order?.status === 'working') order.status = 'paused' }
  resumeWorkingOrder(id: string): void { const order = this.state.workingOrders.find((item) => item.id === id); if (order?.status === 'paused') { order.status = 'working'; order.nextSliceAtSeconds = this.state.elapsedSeconds } }
  cancelWorkingOrder(id: string): void { const order = this.state.workingOrders.find((item) => item.id === id); if (order && order.status !== 'completed') order.status = 'cancelled' }
  crossWorkingOrder(id: string): { accepted: boolean; reason: string } {
    const order = this.state.workingOrders.find((item) => item.id === id)
    if (!order || order.status === 'completed' || order.status === 'cancelled') return { accepted: false, reason: 'Working order is not active.' }
    const currentWeight = weightOf(this.state, order.assetId)
    const remainingWeightDelta = (order.side === 'buy' ? 1 : -1) * order.remainingNotional / Math.max(1, this.state.nav)
    const result = this.executeTargetInternal({ ...order.intent, targetWeight: currentWeight + remainingWeightDelta, recordThesis: false }, 'direct-market', undefined, undefined, order.arrivalPrice)
    if (result.accepted) {
      this.audit({ type: 'worked-order', assetId: order.assetId, title: `${FUND_ASSET_MAP[order.assetId].symbol} residual crossed`, detail: `${(order.remainingNotional / 1_000_000).toFixed(2)}m residual crossed immediately after working the order.`, refId: order.id })
      order.executedNotional += order.remainingNotional; order.remainingNotional = 0; order.status = 'completed'
    }
    return result
  }

  hedgeBeta(): { accepted: boolean; reason: string } {
    if (this.state.options.mandate !== 'long-short') return { accepted: false, reason: 'Beta hedging is available in long/short mode.' }
    const singleNameBeta = SINGLE_NAMES.reduce((sum, id) => sum + weightOf(this.state, id) * FUND_ASSET_MAP[id].beta, 0)
    const target = clamp(-singleNameBeta, -.55, .55)
    const result = this.executeTargetInternal({ assetId: 'es-fund', targetWeight: target, recordThesis: false }, 'direct-market')
    if (result.accepted) this.audit({ type: 'hedge', assetId: 'es-fund', title: 'Portfolio beta hedge', detail: `ES target set to ${(target * 100).toFixed(1)}% NAV against ${singleNameBeta >= 0 ? '+' : ''}${singleNameBeta.toFixed(2)} single-name beta.` })
    return result
  }

  private validateTarget(intent: FundTradeIntent): { accepted: boolean; reason: string } {
    const asset = FUND_ASSET_MAP[intent.assetId]
    if (!asset) return { accepted: false, reason: 'Unknown asset.' }
    if (this.state.status !== 'running') return { accepted: false, reason: 'Session is not running.' }
    if (this.state.options.mandate === 'long-only' && intent.targetWeight < -0.0001) return { accepted: false, reason: 'Long-only mandate cannot short securities.' }
    if (Math.abs(intent.targetWeight) > asset.maxAbsWeight + .0001) return { accepted: false, reason: `${asset.symbol} position limit is ${(asset.maxAbsWeight * 100).toFixed(0)}% NAV.` }
    if (intent.targetWeight < 0 && intent.assetId !== 'es-fund') {
      const locate = this.state.locates[intent.assetId]
      if (!locate || locate.status === 'rejected' || Math.abs(intent.targetWeight) > locate.approvedShortWeight + .0005) return { accepted: false, reason: `Request a sufficient ${asset.symbol} borrow locate before shorting.` }
    }
    const currentWeight = weightOf(this.state, intent.assetId)
    const grossAfter = this.state.risk.grossExposure - Math.abs(currentWeight) + Math.abs(intent.targetWeight)
    const netAfter = this.state.risk.netExposure - currentWeight + intent.targetWeight
    const grossLimit = this.state.options.mandate === 'long-short' ? 2.0 : 1.0
    if (grossAfter > grossLimit + .002) return { accepted: false, reason: `Trade would exceed the ${(grossLimit * 100).toFixed(0)}% gross limit.` }
    if (this.state.options.mandate === 'long-short' && Math.abs(netAfter) > .85) return { accepted: false, reason: 'Trade would exceed the ±85% net exposure limit.' }
    if (this.state.options.mandate === 'long-only' && netAfter > 1.001) return { accepted: false, reason: 'Long-only portfolio cannot invest more than 100% NAV.' }
    return { accepted: true, reason: 'Valid target.' }
  }

  private executeTargetInternal(intent: FundTradeIntent, venue: FundTrade['executionVenue'], forcedPrice?: number, dealerName?: string, arrivalPriceOverride?: number): { accepted: boolean; reason: string } {
    const validation = this.validateTarget(intent)
    if (!validation.accepted) return validation
    const asset = FUND_ASSET_MAP[intent.assetId]
    const currentWeight = weightOf(this.state, asset.id)
    const targetValue = intent.targetWeight * this.state.nav
    const currentValue = this.state.positions[asset.id].units * this.state.prices[asset.id]
    const deltaNotional = targetValue - currentValue
    if (Math.abs(deltaNotional) < 10_000) return { accepted: false, reason: 'Target is too close to the current position.' }
    const side = deltaNotional > 0 ? 1 : -1
    const requested = Math.abs(deltaNotional)
    const mid = this.state.prices[asset.id]
    const sizePct = requested / Math.max(1, this.state.nav)
    const venueMultiplier = venue === 'auction' ? .48 : venue === 'worked-order' ? .55 : venue === 'dealer-rfq' ? .72 : 1
    const bps = asset.transactionCostBps * venueMultiplier * this.state.liquidityCostMultiplier * (1 + Math.pow(sizePct / .05, .65) * .75)
    const executionPrice = forcedPrice ?? mid * (1 + side * bps / 10000)
    const unitsDelta = deltaNotional / executionPrice
    const absoluteUnits = Math.abs(unitsDelta)
    const actualCost = Math.abs(executionPrice - mid) * absoluteUnits
    const benchmarkPrice = mid * (1 + side * asset.transactionCostBps * this.state.liquidityCostMultiplier * (1 + Math.pow(sizePct / .05, .65) * .75) / 10000)
    const arrivalPrice = arrivalPriceOverride ?? mid
    const implementationShortfall = side * (executionPrice - arrivalPrice) * absoluteUnits
    const timingCost = side * (mid - arrivalPrice) * absoluteUnits
    const marketImpactCost = side * (executionPrice - mid) * absoluteUnits
    const implementationShortfallBps = implementationShortfall / Math.max(1, requested) * 10000
    const timingCostBps = timingCost / Math.max(1, requested) * 10000
    const marketImpactBps = marketImpactCost / Math.max(1, requested) * 10000
    this.state.cash -= unitsDelta * executionPrice
    this.state.positions[asset.id].units += unitsDelta
    this.state.positions[asset.id].lastTradePrice = executionPrice
    this.state.transactionCosts += actualCost
    this.state.turnover += requested / Math.max(1, this.state.options.initialNav)
    this.state.attribution.byFactor['transaction-costs'] -= actualCost
    this.state.attribution.byAsset[asset.id] -= actualCost
    let thesisId: string | undefined
    if (intent.recordThesis && intent.tag && intent.horizon && intent.conviction) {
      const thesis: FundThesis = { id: `thesis-${this.state.elapsedSeconds}-${this.rng.int(100, 999)}`, timestamp: this.state.elapsedSeconds, assetId: asset.id, previousWeight: currentWeight, targetWeight: intent.targetWeight, tag: intent.tag, horizon: intent.horizon, conviction: intent.conviction, invalidation: intent.invalidation ?? '', entryPrice: executionPrice }
      this.state.theses.push(thesis); thesisId = thesis.id
    }
    const trade: FundTrade = { id: `trade-${this.state.elapsedSeconds}-${this.rng.int(1000, 9999)}`, timestamp: this.state.elapsedSeconds, assetId: asset.id, price: executionPrice, previousWeight: currentWeight, targetWeight: intent.targetWeight, tradedNotional: requested, transactionCost: actualCost, executionVenue: venue, benchmarkPrice, executionSlippage: side * (executionPrice - mid), arrivalPrice, implementationShortfall, implementationShortfallBps, timingCost, timingCostBps, marketImpactCost, marketImpactBps, dealerName, thesisId }
    this.state.trades.push(trade)
    this.audit({ type: 'trade', assetId: asset.id, title: `${asset.symbol} ${side > 0 ? 'buy' : 'sell'} executed`, detail: `${(requested / 1_000_000).toFixed(2)}m via ${venue.replace(/-/g, ' ')} at ${executionPrice.toFixed(asset.priceDecimals)}; target ${(intent.targetWeight * 100).toFixed(1)}% NAV; IS ${implementationShortfallBps.toFixed(1)}bp.`, refId: trade.id, severity: implementationShortfallBps > 8 ? 'warning' : 'info' })
    this.state.executionQuality = recomputeExecutionQuality(this.state)
    this.state.nav = computeNav(this.state); this.state.risk = computeFundRisk(this.state)
    return { accepted: true, reason: `${asset.symbol} target moved to ${(intent.targetWeight * 100).toFixed(1)}% NAV.` }
  }

  private processWorkingOrders(): void {
    for (const order of this.state.workingOrders) {
      if (order.status !== 'working' || this.state.elapsedSeconds + .001 < order.nextSliceAtSeconds || order.remainingNotional <= 1) continue
      const elapsed = this.state.elapsedSeconds - order.startedAtSeconds
      const remainingTime = Math.max(1, order.durationSeconds - elapsed)
      const interval = order.style === 'twap' ? 5 : this.rng.range(3, 8)
      const plannedSlices = Math.max(1, Math.ceil(remainingTime / interval))
      let slice = Math.min(order.remainingNotional, order.remainingNotional / plannedSlices)
      if (order.style === 'liquidity-sensitive') slice *= this.rng.range(.75, 1.35)
      slice = Math.min(order.remainingNotional, Math.max(10_000, slice))
      const currentWeight = weightOf(this.state, order.assetId)
      const deltaWeight = (order.side === 'buy' ? 1 : -1) * slice / Math.max(1, this.state.nav)
      const beforeTrades = this.state.trades.length
      const result = this.executeTargetInternal({ ...order.intent, targetWeight: currentWeight + deltaWeight, recordThesis: false }, 'worked-order', undefined, undefined, order.arrivalPrice)
      if (!result.accepted) { order.status = 'paused'; continue }
      const latest = this.state.trades[beforeTrades]
      if (latest) order.averageExecutionPrice = order.executedNotional + slice > 0 ? (order.averageExecutionPrice * order.executedNotional + latest.price * slice) / (order.executedNotional + slice) : latest.price
      order.executedNotional += slice; order.remainingNotional = Math.max(0, order.remainingNotional - slice); order.nextSliceAtSeconds = this.state.elapsedSeconds + interval
      if (order.remainingNotional <= 10_000 || this.state.elapsedSeconds - order.startedAtSeconds >= order.durationSeconds) {
        if (order.remainingNotional > 1) this.crossWorkingOrder(order.id)
        order.status = 'completed'
      }
    }
  }

  private accrueBorrow(representedDays: number): void {
    if (this.state.options.mandate !== 'long-short') return
    for (const assetId of SINGLE_NAMES) {
      const position = this.state.positions[assetId]
      if (position.units >= 0) continue
      const asset = FUND_ASSET_MAP[assetId]
      const locate = this.state.locates[assetId]
      const ratePct = locate?.borrowRatePct ?? asset.borrowRatePct
      const shortNotional = Math.abs(position.units * this.state.prices[assetId])
      const cost = shortNotional * (ratePct / 100) * representedDays / 252
      if (cost <= 0) continue
      this.state.cash -= cost; this.state.borrowCosts += cost; this.state.attribution.byFactor['borrow-costs'] -= cost; this.state.attribution.byAsset[assetId] -= cost
    }
  }

  private releaseEvents(factorPulse: Record<FundFactor, number>): void {
    for (const event of this.state.calendar) {
      if (event.revealed || event.releaseAtSeconds > this.state.elapsedSeconds) continue
      event.revealed = true
      if (event.type === 'macro') {
        const surprise = (event.actual ?? event.consensus ?? 0) - (event.consensus ?? 0)
        const direction = Math.sign(surprise)
        factorPulse.rates += direction * .006
        factorPulse.market -= direction * .004
        factorPulse.growth -= direction * .001
        const stage = event.stageLabel ? ` · ${event.stageLabel}` : ''
        this.state.headlines.unshift({ id: `release-${event.id}`, timestamp: this.state.elapsedSeconds, severity: 'critical', title: `${event.title}: ${event.actual}${event.unit ?? ''} vs ${event.consensus}${event.unit ?? ''}`, detail: `${event.detail}${stage}` })
        this.audit({ type: 'catalyst', title: event.title, detail: `${event.actual}${event.unit ?? ''} vs ${event.consensus}${event.unit ?? ''} expected${stage}.`, refId: event.id, severity: 'critical' })
      } else if (event.assetId) {
        const asset = FUND_ASSET_MAP[event.assetId]
        const research = this.state.research[event.assetId]
        let surprise = event.actual !== undefined && event.consensus !== undefined ? (event.actual - event.consensus) / Math.max(.15, Math.abs(event.consensus) * .15) : this.rng.normal(0, 1)
        if (event.type === 'earnings' && event.earningsMetrics?.length) {
          const metricSignals = event.earningsMetrics.map((metric) => (metric.actual - metric.consensus) / Math.max(.1, Math.abs(metric.consensus)))
          surprise = (metricSignals[0] * .25 + metricSignals[1] * .35 + metricSignals[2] * .18 + metricSignals[3] * .22) * 18
        }
        const sign = clamp(surprise, -2.5, 2.5)
        const crowding = this.state.marketContext.crowding[event.assetId]
        const crowdingAmplifier = sign > 0 && crowding > 0 ? 1 + crowding * .55 : sign < 0 && crowding < 0 ? 1 + Math.abs(crowding) * .45 : 1
        const baseShock = event.type === 'squeeze' ? this.rng.range(.035, .075) : event.type === 'commentary' ? this.rng.range(.006, .018) : this.rng.range(.012, .035)
        const shock = sign * baseShock * asset.eventSensitivity * crowdingAmplifier
        this.state.prices[event.assetId] = Math.max(.05, this.state.prices[event.assetId] * (1 + shock))
        if (event.type === 'mna') this.state.prices[event.assetId] *= 1 + Math.abs(this.rng.normal(.035, .025)) * asset.eventSensitivity
        if (event.type === 'analyst' && event.actual !== undefined) research.earningsRevisionPct = clamp(research.earningsRevisionPct + event.actual * .65, -25, 25)
        else if (event.type === 'earnings') research.earningsRevisionPct = clamp(research.earningsRevisionPct + sign * this.rng.range(1.5, 5.5), -25, 25)
        else if (event.type === 'guidance' || event.type === 'commentary') research.earningsRevisionPct = clamp(research.earningsRevisionPct + sign * this.rng.range(.5, 3.5), -25, 25)
        if (event.type === 'squeeze') { research.shortInterestPct = clamp(research.shortInterestPct - Math.abs(sign) * this.rng.range(1.5, 4), 0, 35); this.state.marketContext.crowding[event.assetId] = clamp(crowding + .18, -.95, .95) }
        const stage = event.stageLabel ? ` · ${event.stageLabel}` : ''
        let releaseDetail = event.actual !== undefined ? `${event.title}: ${event.actual}${event.unit ? ` ${event.unit}` : ''}${event.consensus !== undefined ? ` vs ${event.consensus} consensus` : ''}.` : event.detail
        if (event.type === 'earnings' && event.earningsMetrics?.length) releaseDetail = event.earningsMetrics.map((metric) => `${metric.label} ${metric.actual}${metric.unit} vs ${metric.consensus}${metric.unit}`).join(' · ')
        if (event.type === 'commentary' && event.managementCommentary) releaseDetail = event.managementCommentary
        this.state.headlines.unshift({ id: `release-${event.id}`, timestamp: this.state.elapsedSeconds, severity: Math.abs(shock) > .045 ? 'critical' : 'warning', title: `${asset.symbol} ${event.type === 'commentary' ? 'management commentary' : `${event.type} crosses`}`, detail: `${releaseDetail}${stage}`, assetId: event.assetId })
        this.audit({ type: 'catalyst', assetId: event.assetId, title: `${asset.symbol} ${event.type}`, detail: `${releaseDetail}${stage} Price reaction ${(shock * 100).toFixed(1)}%.`, refId: event.id, severity: Math.abs(shock) > .045 ? 'critical' : 'warning' })
      }
    }
  }

  private expireDealerRfq(): void {
    const rfq = this.state.activeDealerRfq
    if (!rfq || rfq.status !== 'open') return
    if (rfq.quotes.every((quote) => quote.expiresAtSeconds <= this.state.elapsedSeconds)) { this.audit({ type: 'rfq', assetId: rfq.assetId, title: `${FUND_ASSET_MAP[rfq.assetId].symbol} RFQ expired`, detail: 'All dealer quotes expired before execution.', refId: rfq.id, severity: 'warning' }); rfq.status = 'expired'; this.state.activeDealerRfq = undefined }
  }

  private maybeHeadline(dt: number): void {
    if (this.state.elapsedSeconds - this.lastHeadlineAt < 25 || !this.rng.chance(.018 * dt)) return
    this.lastHeadlineAt = this.state.elapsedSeconds
    const assetId = this.rng.pick(SINGLE_NAMES); const asset = FUND_ASSET_MAP[assetId]
    const templates = [
      { title: `${asset.symbol} estimate revision hits tape`, detail: 'A broker changes forward estimates, creating incremental single-name flow.' },
      { title: `${asset.symbol} block activity picks up`, detail: 'Unusual institutional flow increases near-term price pressure and liquidity demand.' },
      { title: `${asset.symbol} management commentary circulates`, detail: 'Fresh company colour changes the market debate around the next catalyst.' },
    ]
    const item = this.rng.pick(templates); this.state.headlines.unshift({ id: `headline-${this.state.elapsedSeconds}-${this.rng.int(100, 999)}`, timestamp: this.state.elapsedSeconds, severity: 'info', ...item, assetId })
  }
}

export function createEquityFundEngine(options: FundSessionOptions): EquityFundEngine { return new EquityFundEngine(options) }
