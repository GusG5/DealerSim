import { SeededRandom } from './random'
import type {
  MacroAssetConfig,
  MacroAssetId,
  MacroAttribution,
  MacroCalendarEvent,
  MacroDailyPoint,
  MacroDealerQuote,
  MacroDealerRfq,
  MacroEventTemplate,
  MacroHeadline,
  MacroRiskSnapshot,
  MacroScenarioFamily,
  MacroScore,
  MacroSessionOptions,
  MacroSessionSnapshot,
  MacroThesis,
  MacroTrade,
  MacroTradeIntent,
  MacroExecutionVenue,
  PortfolioFactor,
} from './macro-types'

const FACTORS: PortfolioFactor[] = ['growth', 'inflation', 'policy', 'risk', 'energy', 'usd']

export const MACRO_ASSETS: readonly MacroAssetConfig[] = [
  {
    id: 'es-macro', symbol: 'ES', displayName: 'S&P 500 Future', assetClass: 'equity-index', initialPrice: 5400, priceDecimals: 2,
    annualVolatility: 0.17, transactionCostBps: 0.7, maxAbsWeight: 0.35,
    description: 'Broad US equity beta. Sensitive to growth, real-rate repricing and risk sentiment.',
    factorLoadings: { growth: 0.85, inflation: -0.24, policy: -0.72, risk: 1.05, energy: -0.12, usd: -0.08 },
  },
  {
    id: 'ty-macro', symbol: 'TY', displayName: 'US 10Y Treasury Future', assetClass: 'rates', initialPrice: 111.5, priceDecimals: 3,
    annualVolatility: 0.075, transactionCostBps: 0.45, maxAbsWeight: 0.35,
    description: 'US duration exposure. Benefits from weaker growth and easier policy; vulnerable to inflation surprises.',
    factorLoadings: { growth: -0.38, inflation: -0.82, policy: -0.95, risk: -0.30, energy: -0.18, usd: 0.04 },
  },
  {
    id: 'fgbl-macro', symbol: 'FGBL', displayName: 'Euro-Bund Future', assetClass: 'rates', initialPrice: 132.4, priceDecimals: 2,
    annualVolatility: 0.068, transactionCostBps: 0.55, maxAbsWeight: 0.30,
    description: 'European duration. Strongly exposed to inflation and central-bank repricing.',
    factorLoadings: { growth: -0.30, inflation: -0.68, policy: -0.80, risk: -0.24, energy: -0.20, usd: -0.12 },
  },
  {
    id: 'brn-macro', symbol: 'BRN', displayName: 'Brent Crude Future', assetClass: 'commodities', initialPrice: 78.5, priceDecimals: 2,
    annualVolatility: 0.34, transactionCostBps: 1.4, maxAbsWeight: 0.25,
    description: 'Global crude exposure. Dominated by energy supply, growth and geopolitical risk.',
    factorLoadings: { growth: 0.46, inflation: 0.16, policy: -0.10, risk: 0.18, energy: 1.28, usd: -0.24 },
  },
  {
    id: 'gold-macro', symbol: 'XAU', displayName: 'Gold', assetClass: 'commodities', initialPrice: 2390, priceDecimals: 1,
    annualVolatility: 0.19, transactionCostBps: 1.0, maxAbsWeight: 0.25,
    description: 'Macro hedge sensitive to real rates, USD and risk-off demand.',
    factorLoadings: { growth: -0.10, inflation: 0.25, policy: -0.58, risk: -0.52, energy: 0.06, usd: -0.72 },
  },
  {
    id: 'eurusd-macro', symbol: 'EUR/USD', displayName: 'EUR/USD', assetClass: 'fx', initialPrice: 1.085, priceDecimals: 4,
    annualVolatility: 0.095, transactionCostBps: 0.35, maxAbsWeight: 0.30,
    description: 'Synthetic EUR/USD exposure. Most sensitive to USD and relative policy repricing.',
    factorLoadings: { growth: 0.12, inflation: -0.08, policy: -0.20, risk: -0.12, energy: -0.08, usd: -1.08 },
  },
] as const

export const MACRO_ASSET_MAP = Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, asset])) as Record<MacroAssetId, MacroAssetConfig>

export const MACRO_SCENARIOS: Record<Exclude<MacroScenarioFamily, 'random'>, { label: string; description: string; drift: Record<PortfolioFactor, number> }> = {
  'soft-landing': {
    label: 'Soft landing', description: 'Growth remains positive while inflation cools and policy slowly becomes less restrictive.',
    drift: { growth: 0.00035, inflation: -0.00028, policy: -0.00018, risk: 0.00038, energy: 0.00002, usd: -0.00005 },
  },
  'inflation-resurgence': {
    label: 'Inflation resurgence', description: 'Inflation reaccelerates, easing expectations unwind and duration comes under pressure.',
    drift: { growth: 0.00005, inflation: 0.00058, policy: 0.00036, risk: -0.00024, energy: 0.00022, usd: 0.00024 },
  },
  recession: {
    label: 'Recession', description: 'Growth deteriorates, risk assets weaken and markets increasingly price policy easing.',
    drift: { growth: -0.00072, inflation: -0.00016, policy: -0.00032, risk: -0.00062, energy: -0.00036, usd: 0.00012 },
  },
  'policy-error': {
    label: 'Policy error', description: 'Restrictive policy persists into weakening growth, increasing cross-asset stress.',
    drift: { growth: -0.00030, inflation: 0.00010, policy: 0.00046, risk: -0.00048, energy: -0.00008, usd: 0.00028 },
  },
  'commodity-shock': {
    label: 'Commodity shock', description: 'Energy supply disruption raises inflation pressure while weakening broader risk sentiment.',
    drift: { growth: -0.00018, inflation: 0.00034, policy: 0.00014, risk: -0.00030, energy: 0.00110, usd: 0.00008 },
  },
  'risk-off': {
    label: 'Risk-off crisis', description: 'A confidence shock drives deleveraging, safe-haven demand and unstable correlations.',
    drift: { growth: -0.00024, inflation: -0.00006, policy: -0.00012, risk: -0.00100, energy: -0.00022, usd: 0.00042 },
  },
}

const EVENT_TEMPLATES: readonly MacroEventTemplate[] = [
  { id: 'us-cpi', title: 'US CPI m/m', factor: 'inflation', unit: '%', consensus: 0.2, surpriseStd: 0.12, factorShockPerStd: 0.0044, higherMeansPositiveFactor: true, detail: 'Inflation surprise can rapidly reprice real yields, duration and equity multiples.' },
  { id: 'nfp', title: 'US payrolls', factor: 'growth', unit: 'k', consensus: 180, surpriseStd: 70, factorShockPerStd: 0.0035, higherMeansPositiveFactor: true, detail: 'Labour-market surprise shifts growth and policy expectations.' },
  { id: 'fomc', title: 'Fed policy rate', factor: 'policy', unit: '%', consensus: 5.25, surpriseStd: 0.18, factorShockPerStd: 0.0042, higherMeansPositiveFactor: true, detail: 'A hawkish policy surprise is represented as a positive tightening shock.' },
  { id: 'retail-sales', title: 'US retail sales m/m', factor: 'growth', unit: '%', consensus: 0.3, surpriseStd: 0.45, factorShockPerStd: 0.0028, higherMeansPositiveFactor: true, detail: 'Consumer-demand surprise changes the near-term growth path.' },
  { id: 'eia', title: 'US crude inventories', factor: 'energy', unit: 'm bbl', consensus: 1.2, surpriseStd: 3.0, factorShockPerStd: 0.0058, higherMeansPositiveFactor: false, detail: 'A larger draw than expected is treated as a positive energy-price shock.' },
  { id: 'fed-path', title: 'Fed year-end rate projection', factor: 'policy', unit: '%', consensus: 4.75, surpriseStd: 0.20, factorShockPerStd: 0.0035, higherMeansPositiveFactor: true, detail: 'A higher projected policy path tightens financial conditions and pressures duration.' },
  { id: 'ism', title: 'US ISM manufacturing', factor: 'growth', unit: '', consensus: 50.2, surpriseStd: 2.2, factorShockPerStd: 0.0025, higherMeansPositiveFactor: true, detail: 'A broad activity surprise alters the market growth narrative.' },
  { id: 'core-pce', title: 'US core PCE m/m', factor: 'inflation', unit: '%', consensus: 0.2, surpriseStd: 0.10, factorShockPerStd: 0.0037, higherMeansPositiveFactor: true, detail: 'The Fed-focused inflation measure can reinforce or challenge the prevailing rates narrative.' },
]

function emptyFactorRecord(): Record<PortfolioFactor, number> {
  return { growth: 0, inflation: 0, policy: 0, risk: 0, energy: 0, usd: 0 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number, decimals = 6): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

function resolveScenario(scenario: MacroScenarioFamily, rng: SeededRandom): Exclude<MacroScenarioFamily, 'random'> {
  if (scenario !== 'random') return scenario
  return rng.pick(Object.keys(MACRO_SCENARIOS) as Exclude<MacroScenarioFamily, 'random'>[])
}

function eventScenarioBias(scenario: Exclude<MacroScenarioFamily, 'random'>, factor: PortfolioFactor): number {
  const drift = MACRO_SCENARIOS[scenario].drift[factor]
  return clamp(drift / 0.0005, -1.2, 1.2) * 0.45
}

function buildCalendar(days: number, scenario: Exclude<MacroScenarioFamily, 'random'>, rng: SeededRandom): MacroCalendarEvent[] {
  const slots = [3, 6, 9, 12, 16, 20, 24, 27].filter((day) => day <= days)
  return slots.map((day, index) => {
    const template = EVENT_TEMPLATES[index % EVENT_TEMPLATES.length]
    const factorBias = eventScenarioBias(scenario, template.factor)
    const rawBias = template.higherMeansPositiveFactor ? factorBias : -factorBias
    const surpriseZ = rng.normal(rawBias, 0.85)
    const signedZ = template.higherMeansPositiveFactor ? surpriseZ : -surpriseZ
    const actual = template.consensus + surpriseZ * template.surpriseStd
    return {
      ...template,
      id: `${template.id}-${day}`,
      day,
      actual: round(actual, template.unit === 'k' || template.unit === 'm bbl' ? 1 : 2),
      surpriseZ: round(surpriseZ, 3),
      factorShock: round(signedZ * template.factorShockPerStd, 6),
      revealed: false,
      scheduled: true,
    }
  })
}

function createInitialPositions(): Record<MacroAssetId, { assetId: MacroAssetId; units: number; lastTradePrice: number }> {
  return Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, { assetId: asset.id, units: 0, lastTradePrice: asset.initialPrice }])) as Record<MacroAssetId, { assetId: MacroAssetId; units: number; lastTradePrice: number }>
}

function createInitialPrices(): Record<MacroAssetId, number> {
  return Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, asset.initialPrice])) as Record<MacroAssetId, number>
}

function createEmptyAssetAttribution(): Record<MacroAssetId, number> {
  return Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, 0])) as Record<MacroAssetId, number>
}

function createAttribution(): MacroAttribution {
  return {
    byAsset: createEmptyAssetAttribution(),
    byFactor: { growth: 0, inflation: 0, policy: 0, risk: 0, energy: 0, usd: 0, idiosyncratic: 0, 'transaction-costs': 0 },
  }
}

function computeNav(snapshot: Pick<MacroSessionSnapshot, 'cash' | 'positions' | 'prices'>): number {
  return snapshot.cash + MACRO_ASSETS.reduce((sum, asset) => sum + snapshot.positions[asset.id].units * snapshot.prices[asset.id], 0)
}

export function computeMacroRisk(snapshot: Pick<MacroSessionSnapshot, 'nav' | 'cash' | 'positions' | 'prices'>): MacroRiskSnapshot {
  const nav = Math.max(1, Math.abs(snapshot.nav))
  let gross = 0
  let net = 0
  let concentration = 0
  const factorExposure = emptyFactorRecord()
  for (const asset of MACRO_ASSETS) {
    const weight = snapshot.positions[asset.id].units * snapshot.prices[asset.id] / nav
    gross += Math.abs(weight)
    net += weight
    concentration = Math.max(concentration, Math.abs(weight))
    for (const factor of FACTORS) factorExposure[factor] += weight * asset.factorLoadings[factor]
  }
  const cashWeight = snapshot.cash / nav
  const grossUtil = gross / 1.5
  const concentrationUtil = concentration / 0.35
  const factorUtil = Math.max(...FACTORS.map((factor) => Math.abs(factorExposure[factor]) / 0.75))
  return {
    grossExposure: gross,
    netExposure: net,
    cashWeight,
    concentration,
    factorExposure,
    riskUtilisation: Math.max(grossUtil, concentrationUtil, factorUtil),
  }
}

function portfolioWeight(snapshot: MacroSessionSnapshot, assetId: MacroAssetId): number {
  return snapshot.nav === 0 ? 0 : snapshot.positions[assetId].units * snapshot.prices[assetId] / snapshot.nav
}

function markThesisOutcomes(snapshot: MacroSessionSnapshot): MacroThesis[] {
  return snapshot.theses.map((thesis) => {
    const endPrice = snapshot.prices[thesis.assetId]
    const rawReturn = thesis.entryPrice === 0 ? 0 : endPrice / thesis.entryPrice - 1
    const direction = thesis.targetWeight >= 0 ? 1 : -1
    return { ...thesis, closedDay: snapshot.day, outcomeReturn: rawReturn * direction }
  })
}

function scoreMacro(snapshot: MacroSessionSnapshot): MacroScore {
  const totalReturn = snapshot.nav / snapshot.options.initialNav - 1
  const drawdownMagnitude = Math.abs(snapshot.maxDrawdown)
  const returnScore = clamp(52 + totalReturn * 900 - drawdownMagnitude * 120, 0, 100)
  const riskScore = clamp(100 - Math.max(0, drawdownMagnitude - 0.03) * 800 - Math.max(0, snapshot.peakGrossExposure - 1.1) * 65 - Math.max(0, snapshot.peakConcentration - 0.22) * 180, 0, 100)
  const sizingScore = clamp(96 - Math.max(0, snapshot.peakConcentration - 0.18) * 150 - Math.max(0, snapshot.peakRiskUtilisation - 0.85) * 55, 0, 100)
  const finishedTheses = markThesisOutcomes(snapshot)
  const thesisHitRate = finishedTheses.length === 0 ? 0.5 : finishedTheses.filter((item) => (item.outcomeReturn ?? 0) > 0).length / finishedTheses.length
  const invalidationRate = finishedTheses.length === 0 ? 0.5 : finishedTheses.filter((item) => item.invalidation.trim().length >= 8).length / finishedTheses.length
  const thesisScore = clamp(35 + thesisHitRate * 45 + invalidationRate * 20, 0, 100)
  const costBps = snapshot.transactionCosts / snapshot.options.initialNav * 10_000
  const efficiencyScore = clamp(100 - snapshot.turnover * 14 - costBps * 4, 0, 100)
  const factorConcentration = Math.max(...FACTORS.map((factor) => Math.abs(snapshot.risk.factorExposure[factor])))
  const adaptabilityScore = clamp(92 - factorConcentration * 60 - Math.max(0, drawdownMagnitude - 0.05) * 350, 0, 100)
  const overall = returnScore * 0.30 + riskScore * 0.25 + sizingScore * 0.15 + thesisScore * 0.15 + efficiencyScore * 0.10 + adaptabilityScore * 0.05
  const rating = overall >= 85 ? 'Strong macro process' : overall >= 70 ? 'Controlled' : overall >= 55 ? 'Inconsistent' : overall >= 40 ? 'Risk-heavy' : 'Poorly controlled'
  return { overall, rating, return: returnScore, risk: riskScore, sizing: sizingScore, thesis: thesisScore, efficiency: efficiencyScore, adaptability: adaptabilityScore }
}

function generateHeadline(day: number, scenario: Exclude<MacroScenarioFamily, 'random'>, rng: SeededRandom): (MacroHeadline & { shockDirection: 1 | -1 }) | undefined {
  const probability = scenario === 'risk-off' || scenario === 'commodity-shock' ? 0.20 : 0.10
  if (!rng.chance(probability)) return undefined
  const templates: Record<Exclude<MacroScenarioFamily, 'random'>, { title: string; detail: string; factor: PortfolioFactor; direction: 1 | -1 }[]> = {
    'soft-landing': [{ title: 'Survey data points to resilient activity', detail: 'Growth expectations firm without an obvious inflation reacceleration.', factor: 'growth', direction: 1 }],
    'inflation-resurgence': [{ title: 'Input-cost pressures reappear', detail: 'Market participants debate whether disinflation has stalled.', factor: 'inflation', direction: 1 }],
    recession: [{ title: 'Corporate hiring plans weaken', detail: 'A broad hiring survey reinforces downside growth concerns.', factor: 'growth', direction: -1 }],
    'policy-error': [{ title: 'Financial conditions tighten abruptly', detail: 'Funding stress raises concern that restrictive policy is biting faster than expected.', factor: 'risk', direction: -1 }],
    'commodity-shock': [{ title: 'Unexpected supply disruption hits energy complex', detail: 'Physical-market concern drives a sharp energy-risk premium.', factor: 'energy', direction: 1 }],
    'risk-off': [{ title: 'Cross-asset deleveraging accelerates', detail: 'Volatility rises as leveraged investors cut risk.', factor: 'risk', direction: -1 }],
  }
  const item = rng.pick(templates[scenario])
  const { direction, ...headline } = item
  return { id: `headline-${day}-${rng.int(1000, 9999)}`, day, severity: 'warning', ...headline, shockDirection: direction }
}

interface BuySideDealerProfile {
  id: string
  name: string
  strengths: MacroAssetConfig['assetClass'][]
  spreadMultiplier: number
}

const BUY_SIDE_DEALERS: readonly BuySideDealerProfile[] = [
  { id: 'northbank', name: 'Northbank Markets', strengths: ['rates', 'fx'], spreadMultiplier: 0.92 },
  { id: 'mercator', name: 'Mercator Securities', strengths: ['equity-index', 'commodities'], spreadMultiplier: 0.96 },
  { id: 'albion', name: 'Albion Capital Markets', strengths: ['rates', 'equity-index'], spreadMultiplier: 0.94 },
  { id: 'kestrel', name: 'Kestrel Markets', strengths: ['commodities', 'fx'], spreadMultiplier: 0.90 },
  { id: 'helix', name: 'Helix Securities', strengths: ['equity-index', 'fx'], spreadMultiplier: 1.00 },
] as const

function dealerColour(axe: 'buy' | 'sell' | 'neutral', strength: number, asset: MacroAssetConfig): string {
  if (axe === 'neutral') return `Neutral · normal liquidity in ${asset.symbol}`
  const adjective = strength > 0.72 ? 'Strong' : 'Moderate'
  return axe === 'buy' ? `${adjective} bid wanted` : `${adjective} axe to sell`
}

function stableAssetSalt(assetId: MacroAssetId): number {
  return MACRO_ASSETS.findIndex((asset) => asset.id === assetId) + 1
}

export class MacroPortfolioEngine {
  private rng: SeededRandom
  private state: MacroSessionSnapshot

  constructor(options: MacroSessionOptions) {
    this.rng = new SeededRandom(options.seed)
    const resolvedScenario = resolveScenario(options.scenario, this.rng)
    const prices = createInitialPrices()
    const positions = createInitialPositions()
    const base: MacroSessionSnapshot = {
      options,
      resolvedScenario,
      day: 0,
      status: 'running',
      nav: options.initialNav,
      cash: options.initialNav,
      peakNav: options.initialNav,
      maxDrawdown: 0,
      prices,
      previousPrices: { ...prices },
      positions,
      calendar: buildCalendar(options.days, resolvedScenario, this.rng),
      headlines: [{ id: 'opening', day: 0, severity: 'info', title: 'Portfolio mandate opened', detail: 'Build the book around your macro thesis while respecting gross, concentration and drawdown constraints.' }],
      trades: [],
      theses: [],
      history: [],
      attribution: createAttribution(),
      risk: { grossExposure: 0, netExposure: 0, cashWeight: 1, concentration: 0, factorExposure: emptyFactorRecord(), riskUtilisation: 0 },
      peakGrossExposure: 0,
      peakRiskUtilisation: 0,
      peakConcentration: 0,
      turnover: 0,
      transactionCosts: 0,
      dealerRfqs: [],
      dealerTrades: 0,
      dealerSavings: 0,
    }
    base.risk = computeMacroRisk(base)
    base.peakGrossExposure = base.risk.grossExposure
    base.peakRiskUtilisation = base.risk.riskUtilisation
    base.peakConcentration = base.risk.concentration
    this.state = base
  }

  snapshot(): MacroSessionSnapshot {
    return structuredClone(this.state)
  }

  private prepareIntent(intent: MacroTradeIntent): {
    accepted: boolean
    reason: string
    asset: MacroAssetConfig
    targetWeight: number
    currentWeight: number
    deltaValue: number
    deltaUnits: number
    side: 'buy' | 'sell'
  } {
    const asset = MACRO_ASSET_MAP[intent.assetId]
    const targetWeight = clamp(intent.targetWeight, -asset.maxAbsWeight, asset.maxAbsWeight)
    const currentWeight = portfolioWeight(this.state, intent.assetId)
    const targetMarketValue = targetWeight * this.state.nav
    const currentMarketValue = this.state.positions[intent.assetId].units * this.state.prices[intent.assetId]
    const deltaValue = targetMarketValue - currentMarketValue
    const deltaUnits = deltaValue / this.state.prices[intent.assetId]
    const side = deltaValue >= 0 ? 'buy' : 'sell'
    if (Math.abs(deltaValue) < this.state.nav * 0.001) return { accepted: false, reason: 'Target is too close to the current weight.', asset, targetWeight, currentWeight, deltaValue, deltaUnits, side }

    const provisional = this.snapshot()
    provisional.positions[intent.assetId].units += deltaUnits
    provisional.nav = this.state.nav
    provisional.risk = computeMacroRisk(provisional)
    if (provisional.risk.grossExposure > 1.55) return { accepted: false, reason: 'Trade would breach the 150% gross exposure mandate.', asset, targetWeight, currentWeight, deltaValue, deltaUnits, side }
    if (provisional.risk.riskUtilisation > 1.25) return { accepted: false, reason: 'Trade would create excessive factor or concentration risk.', asset, targetWeight, currentWeight, deltaValue, deltaUnits, side }
    return { accepted: true, reason: '', asset, targetWeight, currentWeight, deltaValue, deltaUnits, side }
  }

  private directExecutionEstimate(intent: MacroTradeIntent): { price: number; cost: number; oneWayBps: number } {
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) return { price: this.state.prices[intent.assetId], cost: 0, oneWayBps: 0 }
    const mid = this.state.prices[intent.assetId]
    const deltaWeight = Math.abs(prepared.deltaValue) / Math.max(1, this.state.nav)
    const sizeMultiplier = 1 + clamp(Math.sqrt(deltaWeight / 0.05) * 0.22, 0, 0.85)
    const stressMultiplier = this.state.resolvedScenario === 'risk-off' || this.state.resolvedScenario === 'policy-error' ? 1.12 : 1
    const oneWayBps = prepared.asset.transactionCostBps * sizeMultiplier * stressMultiplier
    const sign = prepared.side === 'buy' ? 1 : -1
    const price = mid * (1 + sign * oneWayBps / 10_000)
    return { price, cost: Math.abs(prepared.deltaUnits) * Math.abs(price - mid), oneWayBps }
  }

  private executePrepared(
    intent: MacroTradeIntent,
    executionPrice: number,
    executionVenue: MacroExecutionVenue,
    benchmarkPrice: number,
    dealerName?: string,
  ): { accepted: boolean; reason: string; transactionCost?: number } {
    if (this.state.status !== 'running') return { accepted: false, reason: 'Session is finished.' }
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) return { accepted: false, reason: prepared.reason }
    const mid = this.state.prices[intent.assetId]
    const tradedNotional = Math.abs(prepared.deltaValue)
    const transactionCost = Math.abs(prepared.deltaUnits) * Math.abs(executionPrice - mid)

    this.state.cash -= prepared.deltaUnits * executionPrice
    this.state.positions[intent.assetId].units += prepared.deltaUnits
    this.state.positions[intent.assetId].lastTradePrice = executionPrice
    this.state.transactionCosts += transactionCost
    this.state.turnover += tradedNotional / this.state.options.initialNav
    this.state.attribution.byFactor['transaction-costs'] -= transactionCost

    const thesisId = `thesis-${this.state.day}-${this.state.trades.length + 1}`
    const thesis: MacroThesis = {
      id: thesisId,
      day: this.state.day,
      assetId: intent.assetId,
      targetWeight: prepared.targetWeight,
      previousWeight: prepared.currentWeight,
      tag: intent.tag,
      horizon: intent.horizon,
      conviction: clamp(intent.conviction, 1, 5),
      invalidation: intent.invalidation,
      entryPrice: executionPrice,
    }
    this.state.theses.push(thesis)
    const trade: MacroTrade = {
      id: `macro-trade-${this.state.day}-${this.state.trades.length + 1}`,
      day: this.state.day,
      assetId: intent.assetId,
      price: executionPrice,
      previousWeight: prepared.currentWeight,
      targetWeight: prepared.targetWeight,
      tradedNotional,
      transactionCost,
      thesisId,
      executionVenue,
      benchmarkPrice,
      executionSlippage: executionPrice - mid,
      dealerName,
    }
    this.state.trades.unshift(trade)
    this.state.nav = computeNav(this.state)
    this.state.risk = computeMacroRisk(this.state)
    this.state.peakGrossExposure = Math.max(this.state.peakGrossExposure, this.state.risk.grossExposure)
    this.state.peakRiskUtilisation = Math.max(this.state.peakRiskUtilisation, this.state.risk.riskUtilisation)
    this.state.peakConcentration = Math.max(this.state.peakConcentration, this.state.risk.concentration)
    return { accepted: true, reason: `Target ${prepared.asset.symbol} weight set to ${(prepared.targetWeight * 100).toFixed(1)}%.`, transactionCost }
  }

  executeTarget(intent: MacroTradeIntent): { accepted: boolean; reason: string } {
    if (this.state.activeDealerRfq?.status === 'open') return { accepted: false, reason: 'An RFQ is live. Execute or cancel it before trading directly.' }
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) return { accepted: false, reason: prepared.reason }
    const direct = this.directExecutionEstimate(intent)
    const result = this.executePrepared(intent, direct.price, 'direct-market', direct.price)
    if (result.accepted) {
      this.state.headlines.unshift({
        id: `direct-execution-${this.state.day}-${this.state.trades.length}`,
        day: this.state.day,
        severity: 'info',
        title: `${prepared.asset.symbol} executed directly`,
        detail: `${prepared.side.toUpperCase()} ${Math.abs(prepared.targetWeight - prepared.currentWeight).toFixed(2)} NAV weight change through the synthetic market at ${direct.price.toFixed(prepared.asset.priceDecimals)}.`,
      })
    }
    return result
  }

  requestDealerQuotes(intent: MacroTradeIntent, dealerCount = 3): { accepted: boolean; reason: string } {
    if (this.state.status !== 'running') return { accepted: false, reason: 'Session is finished.' }
    if (this.state.activeDealerRfq?.status === 'open') return { accepted: false, reason: 'A dealer RFQ is already live. Execute or cancel it first.' }
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) return { accepted: false, reason: prepared.reason }

    const direct = this.directExecutionEstimate(intent)
    const quoteCount = clamp(Math.round(dealerCount), 3, 5)
    const salt = (this.state.day + 1) * 1009 + stableAssetSalt(intent.assetId) * 7919 + (this.state.dealerRfqs.length + this.state.dealerTrades + 1) * 131
    const quoteRng = new SeededRandom((this.state.options.seed ^ salt) >>> 0)
    const dealerPool = BUY_SIDE_DEALERS.map((profile) => ({ profile, order: quoteRng.next() })).sort((a, b) => a.order - b.order).slice(0, quoteCount)
    const mid = this.state.prices[intent.assetId]
    const deltaWeight = Math.abs(prepared.deltaValue) / Math.max(1, this.state.nav)
    const sizeMultiplier = 1 + clamp(Math.sqrt(deltaWeight / 0.05) * 0.18, 0, 0.70)
    const quotes: MacroDealerQuote[] = dealerPool.map(({ profile }, index) => {
      const expertiseMultiplier = profile.strengths.includes(prepared.asset.assetClass) ? 0.84 : 1.04
      const halfSpreadBps = Math.max(0.08, prepared.asset.transactionCostBps * 0.88 * profile.spreadMultiplier * expertiseMultiplier * sizeMultiplier * quoteRng.range(0.88, 1.14))
      const axeDraw = quoteRng.next()
      const axe: 'buy' | 'sell' | 'neutral' = axeDraw < 0.29 ? 'buy' : axeDraw < 0.58 ? 'sell' : 'neutral'
      const axeStrength = axe === 'neutral' ? 0 : quoteRng.range(0.35, 0.95)
      const centreShiftBps = axe === 'buy' ? halfSpreadBps * 0.42 * axeStrength : axe === 'sell' ? -halfSpreadBps * 0.42 * axeStrength : 0
      const dealerNoiseBps = quoteRng.normal(0, halfSpreadBps * 0.07)
      let bid = mid * (1 + (centreShiftBps - halfSpreadBps + dealerNoiseBps) / 10_000)
      let offer = mid * (1 + (centreShiftBps + halfSpreadBps + dealerNoiseBps) / 10_000)
      if (bid >= offer) {
        const gap = mid * Math.max(0.01, halfSpreadBps) / 10_000
        bid = mid - gap
        offer = mid + gap
      }
      return {
        id: `dealer-quote-${this.state.day}-${index}-${profile.id}`,
        dealerId: profile.id,
        dealerName: profile.name,
        bid,
        offer,
        maxNotional: Math.abs(prepared.deltaValue),
        axe,
        axeStrength,
        colour: dealerColour(axe, axeStrength, prepared.asset),
        spreadBps: (offer - bid) / mid * 10_000,
        expiresDay: this.state.day,
      }
    })

    // Every displayed quote is firm for the requested block in this first buy-side RFQ implementation.
    for (const quote of quotes) quote.maxNotional = Math.abs(prepared.deltaValue) * quoteRng.range(1.02, 1.55)

    const rfq: MacroDealerRfq = {
      id: `macro-rfq-${this.state.day}-${intent.assetId}-${this.state.dealerRfqs.length + 1}`,
      day: this.state.day,
      assetId: intent.assetId,
      side: prepared.side,
      currentWeight: prepared.currentWeight,
      targetWeight: prepared.targetWeight,
      requestedNotional: Math.abs(prepared.deltaValue),
      requestedUnits: Math.abs(prepared.deltaUnits),
      intent: { ...intent, targetWeight: prepared.targetWeight },
      directBenchmarkPrice: direct.price,
      directCost: direct.cost,
      quotes,
      status: 'open',
    }
    this.state.activeDealerRfq = rfq
    this.state.headlines.unshift({
      id: `dealer-rfq-request-${rfq.id}`,
      day: this.state.day,
      severity: 'info',
      title: `${prepared.asset.symbol} RFQ sent to ${quotes.length} dealers`,
      detail: `${prepared.side.toUpperCase()} block of $${(rfq.requestedNotional / 1_000_000).toFixed(1)}m. Compare firm dealer liquidity with the direct-market benchmark before executing.`,
    })
    return { accepted: true, reason: `${quotes.length} firm dealer quotes received for ${prepared.asset.symbol}.` }
  }

  acceptDealerQuote(quoteId: string, fillFraction = 1): { accepted: boolean; reason: string } {
    const rfq = this.state.activeDealerRfq
    if (!rfq || rfq.status !== 'open') return { accepted: false, reason: 'There is no live dealer RFQ.' }
    if (rfq.day !== this.state.day) return { accepted: false, reason: 'Those quotes have expired. Request fresh dealer liquidity.' }
    const quote = rfq.quotes.find((item) => item.id === quoteId)
    if (!quote) return { accepted: false, reason: 'Dealer quote not found.' }
    const executionPrice = rfq.side === 'buy' ? quote.offer : quote.bid
    const fraction = clamp(fillFraction, 0.10, 1)
    const partialTargetWeight = rfq.currentWeight + (rfq.targetWeight - rfq.currentWeight) * fraction
    const partialIntent: MacroTradeIntent = { ...rfq.intent, targetWeight: partialTargetWeight }
    const partialDirect = this.directExecutionEstimate(partialIntent)
    const result = this.executePrepared(partialIntent, executionPrice, 'dealer-rfq', partialDirect.price, quote.dealerName)
    if (!result.accepted) return result

    const dealerCost = result.transactionCost ?? 0
    const savingsVsDirect = partialDirect.cost - dealerCost
    const filledNotional = rfq.requestedNotional * fraction
    const completed: MacroDealerRfq = {
      ...rfq,
      status: 'executed',
      selectedQuoteId: quote.id,
      executionPrice,
      dealerName: quote.dealerName,
      dealerCost,
      savingsVsDirect,
      filledNotional,
    }
    this.state.dealerRfqs.unshift(completed)
    this.state.activeDealerRfq = undefined
    this.state.dealerTrades += 1
    this.state.dealerSavings += savingsVsDirect
    this.state.headlines.unshift({
      id: `dealer-rfq-fill-${completed.id}`,
      day: this.state.day,
      severity: 'info',
      title: `${MACRO_ASSET_MAP[rfq.assetId].symbol} block executed with ${quote.dealerName}`,
      detail: `${rfq.side.toUpperCase()} ${fraction < 0.999 ? `${Math.round(fraction * 100)}% of the block ` : ''}at ${executionPrice.toFixed(MACRO_ASSET_MAP[rfq.assetId].priceDecimals)}. ${savingsVsDirect >= 0 ? 'Estimated saving' : 'Estimated premium'} versus direct execution: $${Math.abs(savingsVsDirect).toFixed(0)}.`,
    })
    return { accepted: true, reason: `Executed ${fraction < 0.999 ? `${Math.round(fraction * 100)}% with` : 'with'} ${quote.dealerName}. ${savingsVsDirect >= 0 ? 'Saved' : 'Paid'} $${Math.abs(savingsVsDirect).toFixed(0)} versus the direct benchmark.` }
  }

  cancelDealerRfq(): { accepted: boolean; reason: string } {
    const rfq = this.state.activeDealerRfq
    if (!rfq || rfq.status !== 'open') return { accepted: false, reason: 'There is no live dealer RFQ.' }
    this.state.dealerRfqs.unshift({ ...rfq, status: 'cancelled' })
    this.state.activeDealerRfq = undefined
    return { accepted: true, reason: 'Dealer RFQ cancelled.' }
  }

  advanceDay(): void {
    if (this.state.status !== 'running') return
    if (this.state.activeDealerRfq?.status === 'open') {
      const expired = { ...this.state.activeDealerRfq, status: 'expired' as const }
      this.state.dealerRfqs.unshift(expired)
      this.state.activeDealerRfq = undefined
      this.state.headlines.unshift({ id: `rfq-expired-${expired.id}`, day: this.state.day, severity: 'warning', title: `${MACRO_ASSET_MAP[expired.assetId].symbol} dealer quotes expired`, detail: 'Dealer liquidity was not executed before the portfolio advanced to the next trading day.' })
    }
    if (this.state.day >= this.state.options.days) { this.finish(); return }

    const nextDay = this.state.day + 1
    const previousNav = this.state.nav
    const previousPrices = { ...this.state.prices }
    const startWeights = Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, portfolioWeight(this.state, asset.id)])) as Record<MacroAssetId, number>
    const factorShocks = emptyFactorRecord()
    const drift = MACRO_SCENARIOS[this.state.resolvedScenario].drift
    const noiseScale = this.state.options.difficulty === 'learning' ? 0.75 : this.state.options.difficulty === 'assessment' ? 1.2 : 1
    for (const factor of FACTORS) factorShocks[factor] = drift[factor] + this.rng.normal(0, 0.00055 * noiseScale)

    const eventIndex = this.state.calendar.findIndex((event) => event.day === nextDay)
    if (eventIndex >= 0) {
      const event = this.state.calendar[eventIndex]
      this.state.calendar[eventIndex] = { ...event, revealed: true }
      factorShocks[event.factor] += event.factorShock ?? 0
      const surpriseText = `${event.actual}${event.unit ? ` ${event.unit}` : ''} vs ${event.consensus}${event.unit ? ` ${event.unit}` : ''}`
      this.state.headlines.unshift({
        id: `release-${event.id}`,
        day: nextDay,
        severity: Math.abs(event.surpriseZ ?? 0) > 1 ? 'critical' : 'warning',
        title: `${event.title}: ${surpriseText}`,
        detail: `${event.detail} Surprise: ${(event.surpriseZ ?? 0).toFixed(1)}σ.`,
        factor: event.factor,
      })
    }

    const surpriseHeadline = generateHeadline(nextDay, this.state.resolvedScenario, this.rng)
    if (surpriseHeadline) {
      const { shockDirection, ...publicHeadline } = surpriseHeadline
      this.state.headlines.unshift(publicHeadline)
      if (surpriseHeadline.factor) factorShocks[surpriseHeadline.factor] += shockDirection * this.rng.range(0.0012, 0.0038)
    }

    const dailyReturns = {} as Record<MacroAssetId, number>
    for (const asset of MACRO_ASSETS) {
      let factorReturn = 0
      for (const factor of FACTORS) factorReturn += asset.factorLoadings[factor] * factorShocks[factor]
      const dailyVol = asset.annualVolatility / Math.sqrt(252)
      const idio = this.rng.normal(0, dailyVol * 0.55 * noiseScale)
      const totalReturn = clamp(factorReturn + idio, -0.12, 0.12)
      dailyReturns[asset.id] = totalReturn
      this.state.prices[asset.id] = Math.max(asset.initialPrice * 0.15, this.state.prices[asset.id] * (1 + totalReturn))

      const assetPnl = this.state.positions[asset.id].units * (this.state.prices[asset.id] - previousPrices[asset.id])
      this.state.attribution.byAsset[asset.id] += assetPnl
      let explainedReturn = 0
      for (const factor of FACTORS) {
        const contributionReturn = asset.factorLoadings[factor] * factorShocks[factor]
        explainedReturn += contributionReturn
        this.state.attribution.byFactor[factor] += previousNav * startWeights[asset.id] * contributionReturn
      }
      this.state.attribution.byFactor.idiosyncratic += previousNav * startWeights[asset.id] * (totalReturn - explainedReturn)
    }

    this.state.previousPrices = previousPrices
    this.state.day = nextDay
    this.state.nav = computeNav(this.state)
    this.state.peakNav = Math.max(this.state.peakNav, this.state.nav)
    const drawdown = this.state.peakNav > 0 ? this.state.nav / this.state.peakNav - 1 : 0
    this.state.maxDrawdown = Math.min(this.state.maxDrawdown, drawdown)
    this.state.risk = computeMacroRisk(this.state)
    this.state.peakGrossExposure = Math.max(this.state.peakGrossExposure, this.state.risk.grossExposure)
    this.state.peakRiskUtilisation = Math.max(this.state.peakRiskUtilisation, this.state.risk.riskUtilisation)
    this.state.peakConcentration = Math.max(this.state.peakConcentration, this.state.risk.concentration)
    const point: MacroDailyPoint = {
      day: nextDay,
      nav: this.state.nav,
      drawdown,
      prices: { ...this.state.prices },
      dailyReturns,
      factorShocks: { ...factorShocks },
    }
    this.state.history.push(point)

    if (drawdown <= -0.10) {
      this.state.headlines.unshift({ id: `risk-stop-${nextDay}`, day: nextDay, severity: 'critical', title: 'Mandate drawdown limit breached', detail: 'The portfolio has breached the 10% hard drawdown limit. The session is terminated.' })
      this.finish()
    } else if (nextDay >= this.state.options.days) {
      this.finish()
    }
  }

  advanceToNextEvent(): void {
    if (this.state.status !== 'running') return
    const nextEvent = this.state.calendar.find((event) => !event.revealed && event.day > this.state.day)
    const target = nextEvent?.day ?? this.state.options.days
    while (this.state.status === 'running' && this.state.day < target) this.advanceDay()
  }

  finish(): void {
    if (this.state.status === 'finished') return
    if (this.state.activeDealerRfq?.status === 'open') {
      this.state.dealerRfqs.unshift({ ...this.state.activeDealerRfq, status: 'cancelled' })
      this.state.activeDealerRfq = undefined
    }
    this.state.status = 'finished'
    this.state.nav = computeNav(this.state)
    this.state.risk = computeMacroRisk(this.state)
    this.state.peakGrossExposure = Math.max(this.state.peakGrossExposure, this.state.risk.grossExposure)
    this.state.peakRiskUtilisation = Math.max(this.state.peakRiskUtilisation, this.state.risk.riskUtilisation)
    this.state.peakConcentration = Math.max(this.state.peakConcentration, this.state.risk.concentration)
    this.state.theses = markThesisOutcomes(this.state)
    this.state.score = scoreMacro(this.state)
  }
}

export function createMacroEngine(options: MacroSessionOptions): MacroPortfolioEngine {
  return new MacroPortfolioEngine(options)
}
