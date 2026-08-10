import { SeededRandom } from './random'
import { commissionForNotional } from './buy-side-market'
import { MACRO_ASSETS, MACRO_ASSET_MAP, MACRO_SCENARIOS } from './macro'
import type { MacroAssetConfig, MacroAssetId, MacroAttribution, MacroPosition, MacroRiskSnapshot, MacroScore, PortfolioFactor } from './macro-types'
import type {
  LiveMacroCalendarEvent,
  LiveMacroDealerQuote,
  LiveMacroDealerRfq,
  LiveMacroHistoryPoint,
  LiveMacroMarketColour,
  LiveMacroMarketPhase,
  LiveMacroRiskManagerMessage,
  LiveMacroSessionOptions,
  LiveMacroSessionSnapshot,
  LiveMacroThesis,
  LiveMacroTrade,
  LiveMacroTradeIntent,
  LiveMacroWorkingOrder,
  LiveMacroWorkingStyle,
  LiveMacroStressResult,
} from './live-macro-types'

const FACTORS: PortfolioFactor[] = ['growth', 'inflation', 'policy', 'risk', 'energy', 'usd']

interface LiveEventTemplate {
  id: string
  title: string
  factor: PortfolioFactor
  unit: string
  consensus: number
  surpriseStd: number
  factorShockPerStd: number
  higherMeansPositiveFactor: boolean
  detail: string
}

const EVENT_TEMPLATES: readonly LiveEventTemplate[] = [
  { id: 'us-cpi', title: 'US CPI m/m', factor: 'inflation', unit: '%', consensus: 0.2, surpriseStd: 0.12, factorShockPerStd: 0.0044, higherMeansPositiveFactor: true, detail: 'Inflation surprise can rapidly reprice real yields, duration and equity multiples.' },
  { id: 'nfp', title: 'US payrolls', factor: 'growth', unit: 'k', consensus: 180, surpriseStd: 70, factorShockPerStd: 0.0035, higherMeansPositiveFactor: true, detail: 'Labour-market surprise shifts growth and policy expectations.' },
  { id: 'fomc', title: 'Fed policy rate', factor: 'policy', unit: '%', consensus: 5.25, surpriseStd: 0.18, factorShockPerStd: 0.0042, higherMeansPositiveFactor: true, detail: 'A hawkish policy surprise is represented as a positive tightening shock.' },
  { id: 'retail-sales', title: 'US retail sales m/m', factor: 'growth', unit: '%', consensus: 0.3, surpriseStd: 0.45, factorShockPerStd: 0.0028, higherMeansPositiveFactor: true, detail: 'Consumer-demand surprise changes the near-term growth path.' },
  { id: 'eia', title: 'US crude inventories', factor: 'energy', unit: 'm bbl', consensus: 1.2, surpriseStd: 3.0, factorShockPerStd: 0.0058, higherMeansPositiveFactor: false, detail: 'A larger draw than expected is treated as a positive energy-price shock.' },
  { id: 'fed-path', title: 'Fed year-end rate projection', factor: 'policy', unit: '%', consensus: 4.75, surpriseStd: 0.20, factorShockPerStd: 0.0035, higherMeansPositiveFactor: true, detail: 'A higher projected policy path tightens financial conditions and pressures duration.' },
]

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
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function emptyFactorRecord(): Record<PortfolioFactor, number> {
  return { growth: 0, inflation: 0, policy: 0, risk: 0, energy: 0, usd: 0 }
}

function createInitialPrices(): Record<MacroAssetId, number> {
  return Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, asset.initialPrice])) as Record<MacroAssetId, number>
}

function createInitialPositions(): Record<MacroAssetId, MacroPosition> {
  return Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, { assetId: asset.id, units: 0, lastTradePrice: asset.initialPrice }])) as Record<MacroAssetId, MacroPosition>
}

function createAssetPnl(): Record<MacroAssetId, number> {
  return Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, 0])) as Record<MacroAssetId, number>
}

function createAttribution(): MacroAttribution {
  return { byAsset: createAssetPnl(), byFactor: { ...emptyFactorRecord(), idiosyncratic: 0, 'transaction-costs': 0 } }
}

function resolveScenario(scenario: LiveMacroSessionOptions['scenario'], rng: SeededRandom): LiveMacroSessionSnapshot['resolvedScenario'] {
  if (scenario !== 'random') return scenario
  return rng.pick(['soft-landing', 'inflation-resurgence', 'recession', 'policy-error', 'commodity-shock', 'risk-off'] as const)
}

function portfolioWeight(snapshot: LiveMacroSessionSnapshot, assetId: MacroAssetId): number {
  if (!snapshot.nav) return 0
  return snapshot.positions[assetId].units * snapshot.prices[assetId] / snapshot.nav
}

function computeNav(snapshot: Pick<LiveMacroSessionSnapshot, 'cash' | 'positions' | 'prices'>): number {
  return snapshot.cash + MACRO_ASSETS.reduce((sum, asset) => sum + snapshot.positions[asset.id].units * snapshot.prices[asset.id], 0)
}

function computeRisk(snapshot: LiveMacroSessionSnapshot): MacroRiskSnapshot {
  const nav = Math.max(1, Math.abs(snapshot.nav))
  let grossExposure = 0
  let netExposure = 0
  let concentration = 0
  const factorExposure = emptyFactorRecord()
  for (const asset of MACRO_ASSETS) {
    const weight = snapshot.positions[asset.id].units * snapshot.prices[asset.id] / nav
    grossExposure += Math.abs(weight)
    netExposure += weight
    concentration = Math.max(concentration, Math.abs(weight))
    for (const factor of FACTORS) factorExposure[factor] += weight * asset.factorLoadings[factor]
  }
  const factorUtil = Math.max(...FACTORS.map((factor) => Math.abs(factorExposure[factor]) / 0.75))
  const grossUtil = grossExposure / 1.5
  const concentrationUtil = concentration / 0.35
  return {
    grossExposure,
    netExposure,
    cashWeight: snapshot.cash / nav,
    concentration,
    factorExposure,
    riskUtilisation: Math.max(grossUtil, factorUtil, concentrationUtil),
  }
}

function scenarioBias(scenario: LiveMacroSessionSnapshot['resolvedScenario'], factor: PortfolioFactor): number {
  const drift = MACRO_SCENARIOS[scenario].drift[factor]
  return clamp(drift / 0.0005, -1.4, 1.4) * 0.45
}

function buildCalendar(options: LiveMacroSessionOptions, scenario: LiveMacroSessionSnapshot['resolvedScenario'], rng: SeededRandom): LiveMacroCalendarEvent[] {
  const fractions = options.durationSeconds >= 30 * 60 ? [0.12, 0.28, 0.45, 0.63, 0.80, 0.92] : [0.14, 0.33, 0.52, 0.72, 0.88]
  return fractions.map((fraction, index) => {
    const template = EVENT_TEMPLATES[index % EVENT_TEMPLATES.length]
    const factorBias = scenarioBias(scenario, template.factor)
    const rawBias = template.higherMeansPositiveFactor ? factorBias : -factorBias
    const surpriseZ = rng.normal(rawBias, 0.86)
    const actual = template.consensus + surpriseZ * template.surpriseStd
    const decimals = template.unit === 'k' || template.unit === 'm bbl' ? 1 : 2
    return {
      id: `${template.id}-live-${index}`,
      title: template.title,
      factor: template.factor,
      unit: template.unit,
      consensus: template.consensus,
      releaseAtSeconds: Math.round(options.durationSeconds * fraction),
      actual: Number(actual.toFixed(decimals)),
      surpriseZ: Number(surpriseZ.toFixed(2)),
      revealed: false,
      detail: template.detail,
    }
  })
}


function macroOvernightBias(scenario: LiveMacroSessionSnapshot['resolvedScenario'], asset: MacroAssetConfig): number {
  const drift = MACRO_SCENARIOS[scenario].drift
  let score = 0
  for (const factor of FACTORS) score += asset.factorLoadings[factor] * drift[factor]
  return clamp(score / .0007, -1.8, 1.8)
}

export function createLiveMacroPremarketBriefing(options: LiveMacroSessionOptions) {
  const rng = new SeededRandom(options.seed)
  const resolvedScenario = resolveScenario(options.scenario, rng)
  const calendar = buildCalendar(options, resolvedScenario, rng)
  const assets = Object.fromEntries(MACRO_ASSETS.map((asset) => {
    const overnightChangePct = clamp(macroOvernightBias(resolvedScenario, asset) * .65 + rng.normal(0, asset.annualVolatility * 2.1), -4.5, 4.5)
    const colour = overnightChangePct > .35
      ? `${asset.symbol} is bid pre-open; positioning is leaning with the overnight move.`
      : overnightChangePct < -.35
        ? `${asset.symbol} is offered pre-open; the market is carrying defensive flow into the session.`
        : `${asset.symbol} is little changed; liquidity is normal but conviction is light ahead of scheduled data.`
    return [asset.id, { assetId: asset.id, previousClose: asset.initialPrice, overnightChangePct, marketColour: colour }]
  })) as Record<MacroAssetId, import('./live-macro-types').LiveMacroPreMarketAssetBrief>
  const first = calendar[0]
  const marketOverview = [
    `${first.title} is the first scheduled release at T+${Math.round(first.releaseAtSeconds / 60)}m; consensus ${first.consensus}${first.unit ? ` ${first.unit}` : ''}.`,
    `Cross-asset overnight tape: ES ${assets['es-macro'].overnightChangePct >= 0 ? '+' : ''}${assets['es-macro'].overnightChangePct.toFixed(1)}%, TY ${assets['ty-macro'].overnightChangePct >= 0 ? '+' : ''}${assets['ty-macro'].overnightChangePct.toFixed(1)}%, Brent ${assets['brn-macro'].overnightChangePct >= 0 ? '+' : ''}${assets['brn-macro'].overnightChangePct.toFixed(1)}%.`,
    'Markets are frozen until you open the session. Starting positions are inherited at the opening mark and do not incur transaction cost.',
  ]
  return { resolvedScenario, marketOverview, assets, calendar: calendar.map(({ id, title, factor, unit, consensus, releaseAtSeconds, detail }) => ({ id, title, factor, unit, consensus, releaseAtSeconds, detail })) }
}

function applyInitialLiveMacroPortfolio(options: LiveMacroSessionOptions, prices: Record<MacroAssetId, number>, positions: Record<MacroAssetId, MacroPosition>) {
  const weights = Object.fromEntries(MACRO_ASSETS.map((asset) => {
    let weight = Number(options.initialWeights?.[asset.id] ?? 0)
    if (!Number.isFinite(weight)) weight = 0
    return [asset.id, clamp(weight, -asset.maxAbsWeight, asset.maxAbsWeight)]
  })) as Record<MacroAssetId, number>
  let gross = MACRO_ASSETS.reduce((sum, asset) => sum + Math.abs(weights[asset.id]), 0)
  let net = MACRO_ASSETS.reduce((sum, asset) => sum + weights[asset.id], 0)
  if (gross > 1.501) {
    for (const asset of MACRO_ASSETS) weights[asset.id] = 0
    gross = 0; net = 0
  }
  for (const asset of MACRO_ASSETS) {
    positions[asset.id].units = weights[asset.id] * options.initialNav / prices[asset.id]
    positions[asset.id].lastTradePrice = prices[asset.id]
  }
  return { weights, gross, net, cash: options.initialNav * (1 - net) }
}

function dealerColour(axe: 'buy' | 'sell' | 'neutral', strength: number, asset: MacroAssetConfig): string {
  if (axe === 'neutral') return `Neutral · normal liquidity in ${asset.symbol}`
  const adjective = strength > 0.72 ? 'Strong' : 'Moderate'
  return axe === 'buy' ? `${adjective} bid wanted` : `${adjective} axe to sell`
}

function scoreLive(snapshot: LiveMacroSessionSnapshot): MacroScore {
  const totalReturn = snapshot.nav / snapshot.options.initialNav - 1
  const drawdownMagnitude = Math.abs(snapshot.maxDrawdown)
  const returnScore = clamp(52 + totalReturn * 1000 - drawdownMagnitude * 110, 0, 100)
  const riskScore = clamp(100 - Math.max(0, drawdownMagnitude - 0.025) * 900 - Math.max(0, snapshot.peakGrossExposure - 1.05) * 62 - Math.max(0, snapshot.peakConcentration - 0.22) * 180, 0, 100)
  const sizingScore = clamp(96 - Math.max(0, snapshot.peakConcentration - 0.18) * 160 - Math.max(0, snapshot.peakRiskUtilisation - 0.85) * 60, 0, 100)
  const journalledTrades = snapshot.trades.filter((trade) => trade.thesisId).length
  const thesisCoverage = snapshot.trades.length === 0 ? 0 : journalledTrades / snapshot.trades.length
  const thesisScore = clamp(58 + thesisCoverage * 38, 0, 100)
  const costBps = snapshot.transactionCosts / Math.max(1, snapshot.options.initialNav) * 10_000
  const efficiencyScore = clamp(100 - snapshot.turnover * 11 - costBps * 4.2, 0, 100)
  const factorConcentration = Math.max(...FACTORS.map((factor) => Math.abs(snapshot.risk.factorExposure[factor])))
  const adaptabilityScore = clamp(94 - factorConcentration * 58 - Math.max(0, drawdownMagnitude - 0.045) * 320, 0, 100)
  const overall = returnScore * 0.30 + riskScore * 0.25 + sizingScore * 0.15 + thesisScore * 0.10 + efficiencyScore * 0.10 + adaptabilityScore * 0.10
  const rating = overall >= 85 ? 'Strong macro process' : overall >= 70 ? 'Controlled' : overall >= 55 ? 'Inconsistent' : overall >= 40 ? 'Risk-heavy' : 'Poorly controlled'
  return { overall, rating, return: returnScore, risk: riskScore, sizing: sizingScore, thesis: thesisScore, efficiency: efficiencyScore, adaptability: adaptabilityScore }
}



function livePhaseSettings(elapsedSeconds: number, durationSeconds: number, calendar: LiveMacroCalendarEvent[]): { phase: LiveMacroMarketPhase; liquidityCostMultiplier: number; volatilityMultiplier: number } {
  const fraction = durationSeconds > 0 ? elapsedSeconds / durationSeconds : 0
  const nextDistance = calendar.filter((event) => !event.revealed).reduce((best, event) => Math.min(best, Math.abs(event.releaseAtSeconds - elapsedSeconds)), Number.POSITIVE_INFINITY)
  const recentDistance = calendar.filter((event) => event.revealed).reduce((best, event) => Math.min(best, Math.abs(event.releaseAtSeconds - elapsedSeconds)), Number.POSITIVE_INFINITY)
  if (Math.min(nextDistance, recentDistance) <= Math.max(12, durationSeconds * .018)) return { phase: 'event-window', liquidityCostMultiplier: 1.55, volatilityMultiplier: 1.65 }
  if (fraction < .10) return { phase: 'opening', liquidityCostMultiplier: 1.22, volatilityMultiplier: 1.32 }
  if (fraction < .45) return { phase: 'morning', liquidityCostMultiplier: .90, volatilityMultiplier: .96 }
  if (fraction < .70) return { phase: 'midday', liquidityCostMultiplier: 1.18, volatilityMultiplier: .80 }
  return { phase: 'closing', liquidityCostMultiplier: .86, volatilityMultiplier: 1.15 }
}

function computeLiveStressTests(snapshot: LiveMacroSessionSnapshot): LiveMacroStressResult[] {
  const nav = Math.max(1, snapshot.nav)
  const calc = (id: string, label: string, detail: string, shocks: Partial<Record<PortfolioFactor, number>>): LiveMacroStressResult => {
    let pnl = 0
    for (const asset of MACRO_ASSETS) {
      const weight = portfolioWeight(snapshot, asset.id)
      let ret = 0
      for (const factor of FACTORS) ret += asset.factorLoadings[factor] * (shocks[factor] ?? 0)
      pnl += nav * weight * ret
    }
    return { id, label, detail, pnl, pnlPct: pnl / nav }
  }
  return [
    calc('hawkish', 'Hawkish rates shock', 'Policy + inflation repricing; duration and long-duration risk assets are most exposed.', { policy: .035, inflation: .020, risk: -.010, usd: .010 }),
    calc('growth-scare', 'Growth scare / risk-off', 'Growth and risk factors fall together while safe-haven rates exposure benefits.', { growth: -.040, risk: -.045, policy: -.012 }),
    calc('oil-shock', 'Energy +12%', 'Commodity supply shock raises energy and inflation while tightening financial conditions.', { energy: .085, inflation: .018, risk: -.010 }),
    calc('usd-rally', 'USD +4%', 'Broad dollar rally tests FX and cross-asset dollar sensitivity.', { usd: .040, risk: -.008 }),
  ]
}

function livePhaseLabel(phase: LiveMacroMarketPhase): string {
  if (phase === 'opening') return 'Opening'
  if (phase === 'morning') return 'Morning liquidity'
  if (phase === 'midday') return 'Midday / thin'
  if (phase === 'event-window') return 'Event window'
  return 'Closing liquidity'
}

function stableAssetSalt(assetId: MacroAssetId): number {
  return MACRO_ASSETS.findIndex((asset) => asset.id === assetId) + 1
}

export class LiveMacroEngine {
  private rng: SeededRandom
  private state: LiveMacroSessionSnapshot
  private lastHistoryAt = 0
  private nextHeadlineAt = 0
  private executionMemory: Partial<Record<MacroAssetId, { side: 'buy' | 'sell'; at: number; pressure: number }>> = {}

  constructor(options: LiveMacroSessionOptions) {
    this.rng = new SeededRandom(options.seed)
    const resolvedScenario = resolveScenario(options.scenario, this.rng)
    const prices = createInitialPrices()
    const positions = createInitialPositions()
    const calendar = buildCalendar(options, resolvedScenario, this.rng)
    const briefing = options.preMarketBriefing ?? createLiveMacroPremarketBriefing(options)
    const starting = applyInitialLiveMacroPortfolio(options, prices, positions)
    const effectiveOptions: LiveMacroSessionOptions = { ...options, preMarketBriefing: briefing }
    const openingPhase = livePhaseSettings(0, options.durationSeconds, calendar)
    const state: LiveMacroSessionSnapshot = {
      options: effectiveOptions,
      resolvedScenario,
      elapsedSeconds: 0,
      status: 'running',
      nav: options.initialNav,
      cash: starting.cash,
      peakNav: options.initialNav,
      maxDrawdown: 0,
      prices,
      previousPrices: { ...prices },
      positions,
      calendar,
      headlines: [{ id: 'live-open', timestamp: 0, severity: 'info', title: 'Live macro mandate opened', detail: `Markets are moving continuously with the ${(options.startingPortfolio ?? 'flat').replace(/-/g, ' ')} starting portfolio. Initial holdings are inherited at the opening mark with no simulated transaction cost.` }],
      trades: [],
      theses: [],
      history: [{ elapsedSeconds: 0, nav: options.initialNav, drawdown: 0, prices: { ...prices } }],
      attribution: createAttribution(),
      risk: { grossExposure: starting.gross, netExposure: starting.net, cashWeight: starting.cash / options.initialNav, concentration: 0, factorExposure: emptyFactorRecord(), riskUtilisation: 0 },
      peakGrossExposure: starting.gross,
      peakRiskUtilisation: 0,
      peakConcentration: Math.max(...Object.values(starting.weights).map(Math.abs)),
      turnover: 0,
      transactionCosts: 0,
      commissions: 0,
      dealerRfqs: [],
      dealerTrades: 0,
      dealerSavings: 0,
      workingOrders: [],
      factorPulse: emptyFactorRecord(),
      marketPhase: openingPhase.phase,
      liquidityCostMultiplier: openingPhase.liquidityCostMultiplier,
      volatilityMultiplier: openingPhase.volatilityMultiplier,
      stressTests: [],
      riskManagerMessages: [],
      marketColour: [],
    }
    state.risk = computeRisk(state)
    state.peakRiskUtilisation = state.risk.riskUtilisation
    state.peakConcentration = Math.max(state.peakConcentration, state.risk.concentration)
    this.state = state
    this.state.stressTests = computeLiveStressTests(this.state)
    this.pushRiskMessage('info', 'Opening risk check', `Gross ${(this.state.risk.grossExposure * 100).toFixed(0)}%, net ${(this.state.risk.netExposure * 100).toFixed(0)}%, concentration ${(this.state.risk.concentration * 100).toFixed(0)}%.`)
    this.nextHeadlineAt = this.rng.range(55, 105)
  }

  snapshot(): LiveMacroSessionSnapshot {
    return structuredClone(this.state)
  }


  private registerExecution(assetId: MacroAssetId, side: 'buy' | 'sell', sizePct: number, venue: LiveMacroTrade['executionVenue']): void {
    const prior = this.executionMemory[assetId]
    const ageSeconds = prior ? Math.max(0, this.state.elapsedSeconds - prior.at) : Infinity
    const recentSameSide = Boolean(prior && prior.side === side && ageSeconds <= 32)
    const venuePressure = venue === 'direct-market' ? 1 : venue === 'worked-order' ? .30 : .12
    const decayedPressure = prior ? prior.pressure * Math.exp(-ageSeconds / 14) : 0
    const basePressure = recentSameSide ? decayedPressure : decayedPressure * .18
    this.executionMemory[assetId] = {
      side,
      at: this.state.elapsedSeconds,
      pressure: clamp(basePressure + venuePressure * (.16 + Math.pow(Math.max(.002, sizePct) / .025, .72) * .30), 0, 3),
    }
  }

  private pushRiskMessage(severity: LiveMacroRiskManagerMessage['severity'], title: string, detail: string): void {
    const latest = this.state.riskManagerMessages[0]
    if (latest && latest.title === title && this.state.elapsedSeconds - latest.timestamp < 20) return
    this.state.riskManagerMessages.unshift({ id: `macro-risk-${this.state.elapsedSeconds.toFixed(2)}-${this.rng.int(100,999)}`, timestamp: this.state.elapsedSeconds, severity, title, detail })
    if (this.state.riskManagerMessages.length > 18) this.state.riskManagerMessages.pop()
  }

  private updateRiskOversight(): void {
    const risk = this.state.risk
    if (risk.riskUtilisation > 1) this.pushRiskMessage('critical', 'Risk utilisation breached', `Portfolio risk utilisation is ${(risk.riskUtilisation * 100).toFixed(0)}%. Reduce gross, factor or concentration risk.`)
    else if (risk.riskUtilisation > .86) this.pushRiskMessage('warning', 'Risk utilisation elevated', `Risk utilisation is ${(risk.riskUtilisation * 100).toFixed(0)}%. New trades should improve the portfolio rather than simply add gross.`)
    if (risk.concentration > .29) this.pushRiskMessage('warning', 'Concentration elevated', `Largest macro position is ${(risk.concentration * 100).toFixed(1)}% NAV.`)
    const factor = FACTORS.map((name) => ({ name, value: risk.factorExposure[name] })).sort((a,b) => Math.abs(b.value)-Math.abs(a.value))[0]
    if (factor && Math.abs(factor.value) > .58) this.pushRiskMessage('warning', `${factor.name.toUpperCase()} factor dominates`, `Factor exposure is ${factor.value >= 0 ? '+' : ''}${factor.value.toFixed(2)}. Consider whether several positions are expressing the same macro view.`)
    const worst = [...this.state.stressTests].sort((a,b)=>a.pnl-b.pnl)[0]
    if (worst && worst.pnlPct < -.06) this.pushRiskMessage('warning', 'Stress loss elevated', `${worst.label} implies ${(worst.pnlPct * 100).toFixed(1)}% NAV in the synthetic stress test.`)
  }

  private maybeMarketColour(dt: number): void {
    this.state.marketColour = this.state.marketColour.filter((item) => item.expiresAtSeconds > this.state.elapsedSeconds)
    if (this.state.elapsedSeconds < 8 || !this.rng.chance(.010 * dt)) return
    const dealer = this.rng.pick(BUY_SIDE_DEALERS)
    const candidates = MACRO_ASSETS.filter((asset) => dealer.strengths.includes(asset.assetClass))
    const asset = this.rng.pick(candidates.length ? candidates : [...MACRO_ASSETS])
    const pulse = Object.entries(asset.factorLoadings).reduce((sum,[factor,loading]) => sum + loading * this.state.factorPulse[factor as PortfolioFactor], 0)
    const direction = pulse > .05 ? 'buyers' : pulse < -.05 ? 'sellers' : this.rng.pick(['buyers','sellers','two-way'] as const)
    const text = this.rng.pick([
      `${asset.symbol}: ${direction === 'buyers' ? 'real money better buyers' : direction === 'sellers' ? 'macro funds better sellers' : 'two-way flow'}; liquidity is ${this.state.marketPhase === 'event-window' ? 'fragile into the release' : this.state.marketPhase === 'midday' ? 'thin' : 'orderly'}.`,
      `${dealer.name} shows ${direction === 'buyers' ? 'a bid-side axe' : direction === 'sellers' ? 'an offer-side axe' : 'balanced inventory'} in ${asset.symbol}; colour may reflect dealer inventory as much as end-user conviction.`,
      `${asset.symbol} flow has accelerated across ${dealer.name}'s desk. ${direction === 'buyers' ? 'Offers are being lifted' : direction === 'sellers' ? 'Bids are being hit' : 'No dominant side yet'}.`,
    ])
    const item: LiveMacroMarketColour = { id: `macro-colour-${this.state.elapsedSeconds}-${this.rng.int(100,999)}`, timestamp: this.state.elapsedSeconds, source: dealer.name, assetId: asset.id, message: text, expiresAtSeconds: this.state.elapsedSeconds + this.rng.range(45,110), reliability: this.rng.range(.45,.86) }
    this.state.marketColour.unshift(item)
    if (this.state.marketColour.length > 8) this.state.marketColour.pop()
  }

  pause(): void {
    if (this.state.status === 'running') this.state.status = 'paused'
  }

  resume(): void {
    if (this.state.status === 'paused') this.state.status = 'running'
  }

  private prepareIntent(intent: LiveMacroTradeIntent): { accepted: boolean; reason: string; asset: MacroAssetConfig; currentWeight: number; targetWeight: number; deltaValue: number; deltaUnits: number; side: 'buy' | 'sell' } {
    const asset = MACRO_ASSET_MAP[intent.assetId]
    if (this.state.status !== 'running') {
      return { accepted: false, reason: this.state.status === 'paused' ? 'Resume the live market before trading.' : 'Session is finished.', asset, currentWeight: portfolioWeight(this.state, intent.assetId), targetWeight: intent.targetWeight, deltaValue: 0, deltaUnits: 0, side: 'buy' }
    }
    const targetWeight = clamp(intent.targetWeight, -asset.maxAbsWeight, asset.maxAbsWeight)
    const currentWeight = portfolioWeight(this.state, intent.assetId)
    const targetMarketValue = targetWeight * this.state.nav
    const currentMarketValue = this.state.positions[intent.assetId].units * this.state.prices[intent.assetId]
    const deltaValue = targetMarketValue - currentMarketValue
    const deltaUnits = deltaValue / this.state.prices[intent.assetId]
    const side = deltaValue >= 0 ? 'buy' : 'sell'
    if (Math.abs(deltaValue) < this.state.nav * 0.001) return { accepted: false, reason: 'Target is too close to the current weight.', asset, currentWeight, targetWeight, deltaValue, deltaUnits, side }
    const provisional = this.snapshot()
    provisional.positions[intent.assetId].units += deltaUnits
    provisional.risk = computeRisk(provisional)
    if (provisional.risk.grossExposure > 1.55) return { accepted: false, reason: 'Trade would breach the 150% gross exposure mandate.', asset, currentWeight, targetWeight, deltaValue, deltaUnits, side }
    if (provisional.risk.riskUtilisation > 1.28) return { accepted: false, reason: 'Trade would create excessive factor or concentration risk.', asset, currentWeight, targetWeight, deltaValue, deltaUnits, side }
    return { accepted: true, reason: '', asset, currentWeight, targetWeight, deltaValue, deltaUnits, side }
  }

  private directEstimate(intent: LiveMacroTradeIntent, costMultiplier = 1): { accepted: boolean; reason: string; price: number; cost: number; oneWayBps: number } {
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) return { accepted: false, reason: prepared.reason, price: this.state.prices[intent.assetId], cost: 0, oneWayBps: 0 }
    const mid = this.state.prices[intent.assetId]
    const deltaWeight = Math.abs(prepared.deltaValue) / Math.max(1, this.state.nav)
    const sizeMultiplier = 1 + .38 * Math.sqrt(deltaWeight / .02) + 1.45 * Math.pow(deltaWeight / .09, 1.5)
    const stressMultiplier = this.state.resolvedScenario === 'risk-off' || this.state.resolvedScenario === 'policy-error' ? 1.22 : 1
    const memory = this.executionMemory[intent.assetId]
    const ageSeconds = memory ? Math.max(0, this.state.elapsedSeconds - memory.at) : Infinity
    const recentSameSide = Boolean(memory && memory.side === prepared.side && ageSeconds <= 32)
    const effectivePressure = recentSameSide ? (memory?.pressure ?? 0) * Math.exp(-ageSeconds / 13) : 0
    const aggressionWeight = costMultiplier >= .9 ? 1 : .32
    const leakageMultiplier = recentSameSide ? 1 + effectivePressure * 1.45 * aggressionWeight : 1
    const oneWayBps = prepared.asset.transactionCostBps * 1.16 * sizeMultiplier * stressMultiplier * this.state.liquidityCostMultiplier * costMultiplier * leakageMultiplier
    const sign = prepared.side === 'buy' ? 1 : -1
    const price = mid * (1 + sign * oneWayBps / 10_000)
    const marketCost = Math.abs(prepared.deltaUnits) * Math.abs(price - mid)
    const commission = commissionForNotional(prepared.asset, price, Math.abs(prepared.deltaValue), 'direct-market')
    return { accepted: true, reason: '', price, cost: marketCost + commission, oneWayBps }
  }

  estimateDirect(intent: LiveMacroTradeIntent): { accepted: boolean; reason: string; price: number; cost: number; oneWayBps: number } {
    return this.directEstimate(intent)
  }

  private createThesis(intent: LiveMacroTradeIntent, previousWeight: number, targetWeight: number, entryPrice: number): string | undefined {
    if (!intent.recordThesis) return undefined
    const thesisId = `live-thesis-${Math.round(this.state.elapsedSeconds * 10)}-${this.state.theses.length + 1}`
    const thesis: LiveMacroThesis = {
      id: thesisId,
      timestamp: this.state.elapsedSeconds,
      assetId: intent.assetId,
      targetWeight,
      previousWeight,
      tag: intent.tag ?? 'growth',
      horizon: intent.horizon ?? 'days',
      conviction: clamp(intent.conviction ?? 3, 1, 5),
      invalidation: intent.invalidation ?? '',
      entryPrice,
    }
    this.state.theses.push(thesis)
    return thesisId
  }

  private executeDelta(
    assetId: MacroAssetId,
    deltaUnits: number,
    executionPrice: number,
    venue: LiveMacroTrade['executionVenue'],
    benchmarkPrice: number,
    targetWeight: number,
    previousWeight: number,
    dealerName?: string,
    thesisId?: string,
  ): { transactionCost: number; tradedNotional: number } {
    const mid = this.state.prices[assetId]
    const tradedNotional = Math.abs(deltaUnits * mid)
    const marketCost = Math.abs(deltaUnits) * Math.abs(executionPrice - mid)
    const asset = MACRO_ASSET_MAP[assetId]
    const commission = commissionForNotional(asset, executionPrice, tradedNotional, venue)
    const transactionCost = marketCost + commission
    const side: 'buy' | 'sell' = deltaUnits >= 0 ? 'buy' : 'sell'
    const sizePct = tradedNotional / Math.max(1, this.state.nav)
    const effectiveBps = mid > 0 ? Math.abs(executionPrice - mid) / mid * 10_000 : 0
    this.state.cash -= deltaUnits * executionPrice + commission
    this.state.positions[assetId].units += deltaUnits
    this.state.positions[assetId].lastTradePrice = executionPrice
    this.state.transactionCosts += transactionCost
    this.state.commissions += commission
    this.state.turnover += tradedNotional / this.state.options.initialNav
    this.state.attribution.byFactor['transaction-costs'] -= transactionCost
    const trade: LiveMacroTrade = {
      id: `live-trade-${Math.round(this.state.elapsedSeconds * 10)}-${this.state.trades.length + 1}`,
      timestamp: this.state.elapsedSeconds,
      assetId,
      price: executionPrice,
      previousWeight,
      targetWeight,
      tradedNotional,
      transactionCost,
      commission,
      marketCost,
      executionVenue: venue,
      benchmarkPrice,
      executionSlippage: executionPrice - mid,
      dealerName,
      thesisId,
    }
    this.state.trades.unshift(trade)
    this.registerExecution(assetId, side, sizePct, venue)
    if (venue === 'direct-market') {
      const sign = side === 'buy' ? 1 : -1
      const persistentShare = clamp(.10 + sizePct * .85, .10, .25)
      const impactedPrice = Math.max(.01, mid * (1 + sign * effectiveBps * persistentShare / 10_000))
      const selfImpactMarkPnl = this.state.positions[assetId].units * (impactedPrice - mid)
      this.state.prices[assetId] = impactedPrice
      this.state.attribution.byAsset[assetId] += selfImpactMarkPnl
      this.state.attribution.byFactor.idiosyncratic += selfImpactMarkPnl
    }
    this.state.nav = computeNav(this.state)
    this.state.risk = computeRisk(this.state)
    this.updatePeaks()
    return { transactionCost, tradedNotional }
  }

  executeTarget(intent: LiveMacroTradeIntent): { accepted: boolean; reason: string } {
    if (this.state.status === 'finished') return { accepted: false, reason: 'Session is finished.' }
    if (this.state.activeDealerRfq?.status === 'open') return { accepted: false, reason: 'A dealer RFQ is live. Execute or cancel it first.' }
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) return { accepted: false, reason: prepared.reason }
    const estimate = this.directEstimate(intent)
    if (!estimate.accepted) return { accepted: false, reason: estimate.reason }
    const thesisId = this.createThesis(intent, prepared.currentWeight, prepared.targetWeight, estimate.price)
    this.executeDelta(intent.assetId, prepared.deltaUnits, estimate.price, 'direct-market', estimate.price, prepared.targetWeight, prepared.currentWeight, undefined, thesisId)
    return { accepted: true, reason: `${prepared.asset.symbol} target moved to ${(prepared.targetWeight * 100).toFixed(1)}% via direct market.` }
  }

  startWorkingOrder(intent: LiveMacroTradeIntent, style: LiveMacroWorkingStyle, durationSeconds = 45): { accepted: boolean; reason: string } {
    if (this.state.status === 'finished') return { accepted: false, reason: 'Session is finished.' }
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) return { accepted: false, reason: prepared.reason }
    const existing = this.state.workingOrders.find((order) => order.assetId === intent.assetId && (order.status === 'working' || order.status === 'paused'))
    if (existing) return { accepted: false, reason: `A ${prepared.asset.symbol} working order is already active.` }
    const thesisId = this.createThesis(intent, prepared.currentWeight, prepared.targetWeight, this.state.prices[intent.assetId])
    const order: LiveMacroWorkingOrder = {
      id: `work-${Math.round(this.state.elapsedSeconds * 10)}-${intent.assetId}`,
      assetId: intent.assetId,
      side: prepared.side,
      style,
      startedAtSeconds: this.state.elapsedSeconds,
      targetWeight: prepared.targetWeight,
      startingWeight: prepared.currentWeight,
      totalNotional: Math.abs(prepared.deltaValue),
      remainingNotional: Math.abs(prepared.deltaValue),
      executedNotional: 0,
      averageExecutionPrice: 0,
      durationSeconds: clamp(durationSeconds, 20, 120),
      nextSliceAtSeconds: this.state.elapsedSeconds + 1,
      status: 'working',
      intent: { ...intent, recordThesis: false },
      thesisId,
    }
    this.state.workingOrders.unshift(order)
    this.state.headlines.unshift({ id: `work-start-${order.id}`, timestamp: this.state.elapsedSeconds, severity: 'info', title: `${prepared.asset.symbol} ${style === 'twap' ? 'TWAP' : 'liquidity-sensitive'} order started`, detail: `${prepared.side.toUpperCase()} $${(order.totalNotional / 1_000_000).toFixed(1)}m over roughly ${order.durationSeconds}s while the market continues moving.` })
    return { accepted: true, reason: `${prepared.asset.symbol} working order started.` }
  }

  pauseWorkingOrder(orderId: string): void {
    const order = this.state.workingOrders.find((item) => item.id === orderId)
    if (order?.status === 'working') order.status = 'paused'
  }

  resumeWorkingOrder(orderId: string): void {
    const order = this.state.workingOrders.find((item) => item.id === orderId)
    if (order?.status === 'paused') { order.status = 'working'; order.nextSliceAtSeconds = this.state.elapsedSeconds + 1 }
  }

  cancelWorkingOrder(orderId: string): void {
    const order = this.state.workingOrders.find((item) => item.id === orderId)
    if (order && (order.status === 'working' || order.status === 'paused')) order.status = 'cancelled'
  }

  crossWorkingOrder(orderId: string): { accepted: boolean; reason: string } {
    const order = this.state.workingOrders.find((item) => item.id === orderId)
    if (!order || (order.status !== 'working' && order.status !== 'paused')) return { accepted: false, reason: 'Working order is not active.' }
    const currentWeight = portfolioWeight(this.state, order.assetId)
    const intent: LiveMacroTradeIntent = { ...order.intent, targetWeight: order.targetWeight, recordThesis: false }
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) { order.status = 'completed'; return { accepted: true, reason: 'Target is already effectively reached.' } }
    const estimate = this.directEstimate(intent, 1.05)
    this.executeDelta(order.assetId, prepared.deltaUnits, estimate.price, 'worked-order', estimate.price, order.targetWeight, currentWeight, undefined, order.thesisId)
    order.executedNotional += order.remainingNotional
    order.remainingNotional = 0
    order.status = 'completed'
    return { accepted: true, reason: `Crossed the remaining ${MACRO_ASSET_MAP[order.assetId].symbol} working order.` }
  }

  requestDealerQuotes(intent: LiveMacroTradeIntent, dealerCount = 3): { accepted: boolean; reason: string } {
    if (this.state.activeDealerRfq?.status === 'open') return { accepted: false, reason: 'A dealer RFQ is already live.' }
    const prepared = this.prepareIntent(intent)
    if (!prepared.accepted) return { accepted: false, reason: prepared.reason }
    const direct = this.directEstimate(intent)
    if (!direct.accepted) return { accepted: false, reason: direct.reason }
    const asset = prepared.asset
    const rng = this.rng.fork(Math.round(this.state.elapsedSeconds * 100) + stableAssetSalt(asset.id) * 12_911)
    const shuffled = [...BUY_SIDE_DEALERS].sort(() => rng.range(-1, 1)).slice(0, clamp(Math.round(dealerCount), 3, 5))
    const requestedNotional = Math.abs(prepared.deltaValue)
    const mid = this.state.prices[asset.id]
    const directBps = Math.max(asset.transactionCostBps, direct.oneWayBps)
    const quotes: LiveMacroDealerQuote[] = shuffled.map((dealer, index) => {
      const strength = dealer.strengths.includes(asset.assetClass) ? 0.82 : 0.48
      let axe: 'buy' | 'sell' | 'neutral' = 'neutral'
      if (rng.chance(0.58)) axe = rng.chance(0.5) ? 'buy' : 'sell'
      const axeStrength = axe === 'neutral' ? 0 : rng.range(0.42, 0.94)
      const aligned = (prepared.side === 'buy' && axe === 'sell') || (prepared.side === 'sell' && axe === 'buy')
      const opposed = (prepared.side === 'buy' && axe === 'buy') || (prepared.side === 'sell' && axe === 'sell')
      let quoteBps = directBps * dealer.spreadMultiplier * (1.05 - strength * 0.18) * rng.range(0.78, 1.12)
      if (aligned) quoteBps *= 1 - axeStrength * 0.28
      if (opposed) quoteBps *= 1 + axeStrength * 0.20
      quoteBps = Math.max(asset.transactionCostBps * 0.35, quoteBps)
      const half = mid * quoteBps / 10_000
      return {
        id: `live-dq-${Math.round(this.state.elapsedSeconds * 10)}-${dealer.id}-${index}`,
        dealerId: dealer.id,
        dealerName: dealer.name,
        bid: mid - half,
        offer: mid + half,
        maxNotional: requestedNotional * rng.range(0.75, 1.45),
        axe,
        axeStrength,
        colour: dealerColour(axe, axeStrength, asset),
        expiresAtSeconds: this.state.elapsedSeconds + rng.range(10, 16),
      }
    })
    const rfq: LiveMacroDealerRfq = {
      id: `live-rfq-${Math.round(this.state.elapsedSeconds * 10)}-${asset.id}`,
      timestamp: this.state.elapsedSeconds,
      assetId: asset.id,
      side: prepared.side,
      currentWeight: prepared.currentWeight,
      targetWeight: prepared.targetWeight,
      requestedNotional,
      requestedUnits: Math.abs(prepared.deltaUnits),
      intent: { ...intent, targetWeight: prepared.targetWeight },
      directBenchmarkPrice: direct.price,
      directCost: direct.cost,
      quotes,
      status: 'open',
    }
    this.state.activeDealerRfq = rfq
    return { accepted: true, reason: `${quotes.length} firm dealer quotes received for ${asset.symbol}. Quotes are live for only a few seconds.` }
  }

  acceptDealerQuote(quoteId: string, fillFraction = 1): { accepted: boolean; reason: string } {
    const rfq = this.state.activeDealerRfq
    if (!rfq || rfq.status !== 'open') return { accepted: false, reason: 'There is no live dealer RFQ.' }
    const quote = rfq.quotes.find((item) => item.id === quoteId)
    if (!quote) return { accepted: false, reason: 'Dealer quote not found.' }
    if (this.state.elapsedSeconds > quote.expiresAtSeconds) { this.expireDealerRfq(); return { accepted: false, reason: 'That dealer quote has expired.' } }
    const maxFraction = Math.min(1, quote.maxNotional / Math.max(1, rfq.requestedNotional))
    const fraction = Math.min(clamp(fillFraction, 0.1, 1), maxFraction)
    const partialTarget = rfq.currentWeight + (rfq.targetWeight - rfq.currentWeight) * fraction
    const partialIntent: LiveMacroTradeIntent = { ...rfq.intent, targetWeight: partialTarget }
    const prepared = this.prepareIntent(partialIntent)
    if (!prepared.accepted) return { accepted: false, reason: prepared.reason }
    const executionPrice = rfq.side === 'buy' ? quote.offer : quote.bid
    const direct = this.directEstimate(partialIntent)
    const thesisId = this.createThesis(partialIntent, prepared.currentWeight, prepared.targetWeight, executionPrice)
    const executed = this.executeDelta(rfq.assetId, prepared.deltaUnits, executionPrice, 'dealer-rfq', direct.price, prepared.targetWeight, prepared.currentWeight, quote.dealerName, thesisId)
    const savingsVsDirect = direct.cost - executed.transactionCost
    const completed: LiveMacroDealerRfq = { ...rfq, status: 'executed', selectedQuoteId: quote.id, executionPrice, dealerName: quote.dealerName, dealerCost: executed.transactionCost, savingsVsDirect, filledNotional: rfq.requestedNotional * fraction }
    this.state.dealerRfqs.unshift(completed)
    this.state.activeDealerRfq = undefined
    this.state.dealerTrades += 1
    this.state.dealerSavings += savingsVsDirect
    return { accepted: true, reason: `${MACRO_ASSET_MAP[rfq.assetId].symbol} ${Math.round(fraction * 100)}% filled with ${quote.dealerName}. ${savingsVsDirect >= 0 ? 'Saved' : 'Paid'} $${Math.abs(savingsVsDirect).toFixed(0)} versus direct.` }
  }

  cancelDealerRfq(): { accepted: boolean; reason: string } {
    const rfq = this.state.activeDealerRfq
    if (!rfq || rfq.status !== 'open') return { accepted: false, reason: 'There is no live dealer RFQ.' }
    this.state.dealerRfqs.unshift({ ...rfq, status: 'cancelled' })
    this.state.activeDealerRfq = undefined
    return { accepted: true, reason: 'Dealer RFQ cancelled.' }
  }

  private expireDealerRfq(): void {
    const rfq = this.state.activeDealerRfq
    if (!rfq || rfq.status !== 'open') return
    const latestExpiry = Math.max(...rfq.quotes.map((quote) => quote.expiresAtSeconds))
    if (this.state.elapsedSeconds <= latestExpiry) return
    this.state.dealerRfqs.unshift({ ...rfq, status: 'expired' })
    this.state.activeDealerRfq = undefined
    this.state.headlines.unshift({ id: `live-rfq-exp-${rfq.id}`, timestamp: this.state.elapsedSeconds, severity: 'warning', title: `${MACRO_ASSET_MAP[rfq.assetId].symbol} dealer quotes expired`, detail: 'The market kept moving while you considered the block. Request fresh liquidity to trade with dealers.' })
  }

  private processWorkingOrders(): void {
    for (const order of this.state.workingOrders) {
      if (order.status !== 'working' || this.state.elapsedSeconds < order.nextSliceAtSeconds) continue
      const currentWeight = portfolioWeight(this.state, order.assetId)
      const deltaToTarget = order.targetWeight - currentWeight
      if (Math.abs(deltaToTarget) < 0.001 || order.remainingNotional < this.state.nav * 0.0005) {
        order.status = 'completed'
        order.remainingNotional = 0
        continue
      }
      const elapsed = this.state.elapsedSeconds - order.startedAtSeconds
      const timeFractionRemaining = clamp(1 - elapsed / order.durationSeconds, 0.05, 1)
      const baseFraction = order.style === 'twap' ? 0.16 : this.rng.range(0.10, 0.22)
      const urgencyBoost = elapsed > order.durationSeconds * 0.75 ? 1.65 : 1
      const clipNotional = Math.min(order.remainingNotional, Math.max(this.state.nav * 0.003, order.totalNotional * baseFraction * urgencyBoost * Math.max(0.6, 1 - timeFractionRemaining * 0.2)))
      const sign = deltaToTarget > 0 ? 1 : -1
      const deltaUnits = sign * clipNotional / this.state.prices[order.assetId]
      const resultingWeight = currentWeight + sign * clipNotional / this.state.nav
      const styleCost = order.style === 'liquidity-sensitive' ? 0.50 : 0.66
      const pseudoIntent: LiveMacroTradeIntent = { assetId: order.assetId, targetWeight: resultingWeight }
      const estimate = this.directEstimate(pseudoIntent, styleCost)
      if (!estimate.accepted) { order.status = 'cancelled'; continue }
      const executed = this.executeDelta(order.assetId, deltaUnits, estimate.price, 'worked-order', estimate.price, resultingWeight, currentWeight, undefined, order.thesisId)
      const previousExecuted = order.executedNotional
      order.executedNotional += executed.tradedNotional
      order.remainingNotional = Math.max(0, order.totalNotional - order.executedNotional)
      order.averageExecutionPrice = previousExecuted <= 0 ? estimate.price : (order.averageExecutionPrice * previousExecuted + estimate.price * executed.tradedNotional) / Math.max(1, order.executedNotional)
      order.nextSliceAtSeconds = this.state.elapsedSeconds + (order.style === 'liquidity-sensitive' ? this.rng.range(4, 9) : Math.max(3, order.durationSeconds / 8))
      if (order.remainingNotional <= this.state.nav * 0.0006 || this.state.elapsedSeconds >= order.startedAtSeconds + order.durationSeconds * 1.25) order.status = 'completed'
    }
  }

  private revealEvents(previousElapsed: number): Record<PortfolioFactor, number> {
    const eventShock = emptyFactorRecord()
    for (const event of this.state.calendar) {
      if (event.revealed || event.releaseAtSeconds <= previousElapsed || event.releaseAtSeconds > this.state.elapsedSeconds) continue
      event.revealed = true
      const template = EVENT_TEMPLATES.find((item) => event.id.startsWith(item.id))
      const higherMeansPositive = template?.higherMeansPositiveFactor ?? true
      const signedZ = higherMeansPositive ? (event.surpriseZ ?? 0) : -(event.surpriseZ ?? 0)
      const shock = signedZ * (template?.factorShockPerStd ?? 0.0035)
      eventShock[event.factor] += shock
      this.state.headlines.unshift({
        id: `live-release-${event.id}`,
        timestamp: this.state.elapsedSeconds,
        severity: Math.abs(event.surpriseZ ?? 0) > 1 ? 'critical' : 'warning',
        title: `${event.title}: ${event.actual}${event.unit ? ` ${event.unit}` : ''} vs ${event.consensus}${event.unit ? ` ${event.unit}` : ''}`,
        detail: `${event.detail} Surprise: ${(event.surpriseZ ?? 0).toFixed(1)}σ.`,
        factor: event.factor,
      })
    }
    return eventShock
  }

  private maybeHeadline(): Record<PortfolioFactor, number> {
    const shock = emptyFactorRecord()
    if (this.state.elapsedSeconds < this.nextHeadlineAt) return shock
    const scenario = this.state.resolvedScenario
    const templates: Record<LiveMacroSessionSnapshot['resolvedScenario'], { title: string; detail: string; factor: PortfolioFactor; direction: 1 | -1 }[]> = {
      'soft-landing': [{ title: 'Survey data points to resilient activity', detail: 'Growth expectations firm without an obvious inflation reacceleration.', factor: 'growth', direction: 1 }],
      'inflation-resurgence': [{ title: 'Input-cost pressures reappear', detail: 'Market participants debate whether disinflation has stalled.', factor: 'inflation', direction: 1 }],
      recession: [{ title: 'Corporate hiring plans weaken', detail: 'A broad hiring survey reinforces downside growth concerns.', factor: 'growth', direction: -1 }],
      'policy-error': [{ title: 'Financial conditions tighten abruptly', detail: 'Funding stress raises concern that restrictive policy is biting faster than expected.', factor: 'risk', direction: -1 }],
      'commodity-shock': [{ title: 'Unexpected supply disruption hits energy complex', detail: 'Physical-market concern drives a sharp energy-risk premium.', factor: 'energy', direction: 1 }],
      'risk-off': [{ title: 'Cross-asset deleveraging accelerates', detail: 'Volatility rises as leveraged investors cut risk.', factor: 'risk', direction: -1 }],
    }
    const item = this.rng.pick(templates[scenario])
    const magnitude = this.rng.range(0.0012, 0.0036)
    shock[item.factor] += item.direction * magnitude
    this.state.headlines.unshift({ id: `live-headline-${Math.round(this.state.elapsedSeconds)}-${this.rng.int(100, 999)}`, timestamp: this.state.elapsedSeconds, severity: magnitude > 0.0027 ? 'critical' : 'warning', title: item.title, detail: item.detail, factor: item.factor })
    this.nextHeadlineAt = this.state.elapsedSeconds + this.rng.range(55, 110)
    return shock
  }

  private updatePeaks(): void {
    this.state.peakNav = Math.max(this.state.peakNav, this.state.nav)
    const drawdown = this.state.peakNav > 0 ? this.state.nav / this.state.peakNav - 1 : 0
    this.state.maxDrawdown = Math.min(this.state.maxDrawdown, drawdown)
    this.state.risk = computeRisk(this.state)
    this.state.peakGrossExposure = Math.max(this.state.peakGrossExposure, this.state.risk.grossExposure)
    this.state.peakRiskUtilisation = Math.max(this.state.peakRiskUtilisation, this.state.risk.riskUtilisation)
    this.state.peakConcentration = Math.max(this.state.peakConcentration, this.state.risk.concentration)
  }

  tick(dtSeconds: number): void {
    if (this.state.status !== 'running') return
    const dt = clamp(dtSeconds, 0.02, 1)
    const previousElapsed = this.state.elapsedSeconds
    this.state.elapsedSeconds = Math.min(this.state.options.durationSeconds, this.state.elapsedSeconds + dt)
    const phase = livePhaseSettings(this.state.elapsedSeconds, this.state.options.durationSeconds, this.state.calendar)
    const phaseChanged = phase.phase !== this.state.marketPhase
    this.state.marketPhase = phase.phase; this.state.liquidityCostMultiplier = phase.liquidityCostMultiplier; this.state.volatilityMultiplier = phase.volatilityMultiplier
    if (phaseChanged) this.state.headlines.unshift({ id: `macro-phase-${Math.round(this.state.elapsedSeconds)}-${this.rng.int(100,999)}`, timestamp: this.state.elapsedSeconds, severity: phase.phase === 'event-window' ? 'warning' : 'info', title: `Market phase: ${livePhaseLabel(phase.phase)}`, detail: `Synthetic execution cost ${phase.liquidityCostMultiplier.toFixed(2)}x and volatility ${phase.volatilityMultiplier.toFixed(2)}x.` })
    this.expireDealerRfq()
    this.processWorkingOrders()

    const eventShock = this.revealEvents(previousElapsed)
    const headlineShock = this.maybeHeadline()
    const factorPulse = emptyFactorRecord()
    const scenarioDrift = MACRO_SCENARIOS[this.state.resolvedScenario].drift
    const noiseScale = this.state.options.difficulty === 'learning' ? 0.82 : this.state.options.difficulty === 'assessment' ? 1.18 : 1
    for (const factor of FACTORS) {
      const driftPerSecond = scenarioDrift[factor] * 3.5 / Math.max(300, this.state.options.durationSeconds)
      const microNoise = this.rng.normal(0, 0.000035 * noiseScale * this.state.volatilityMultiplier) * Math.sqrt(dt)
      factorPulse[factor] = driftPerSecond * dt + microNoise + eventShock[factor] + headlineShock[factor]
      this.state.factorPulse[factor] = this.state.factorPulse[factor] * Math.pow(0.90, dt) + (eventShock[factor] + headlineShock[factor]) * 18 + driftPerSecond * this.state.options.durationSeconds * 0.35
    }

    const previousPrices = { ...this.state.prices }
    const previousNav = this.state.nav
    const startWeights = Object.fromEntries(MACRO_ASSETS.map((asset) => [asset.id, portfolioWeight(this.state, asset.id)])) as Record<MacroAssetId, number>
    for (const asset of MACRO_ASSETS) {
      let factorReturn = 0
      for (const factor of FACTORS) factorReturn += asset.factorLoadings[factor] * factorPulse[factor]
      const targetSessionVol = asset.annualVolatility / Math.sqrt(252) * 0.80
      const perSecondIdio = targetSessionVol / Math.sqrt(Math.max(300, this.state.options.durationSeconds)) * 0.64
      const idio = this.rng.normal(0, perSecondIdio * noiseScale * this.state.volatilityMultiplier) * Math.sqrt(dt)
      const returnMove = clamp(factorReturn + idio, -0.06, 0.06)
      this.state.prices[asset.id] = Math.max(asset.initialPrice * 0.15, this.state.prices[asset.id] * (1 + returnMove))
      const assetPnl = this.state.positions[asset.id].units * (this.state.prices[asset.id] - previousPrices[asset.id])
      this.state.attribution.byAsset[asset.id] += assetPnl
      let explained = 0
      for (const factor of FACTORS) {
        const contributionReturn = asset.factorLoadings[factor] * factorPulse[factor]
        explained += contributionReturn
        this.state.attribution.byFactor[factor] += previousNav * startWeights[asset.id] * contributionReturn
      }
      this.state.attribution.byFactor.idiosyncratic += previousNav * startWeights[asset.id] * (returnMove - explained)
    }
    this.state.previousPrices = previousPrices
    this.state.nav = computeNav(this.state)
    this.updatePeaks()
    this.state.stressTests = computeLiveStressTests(this.state)
    this.updateRiskOversight()
    this.maybeMarketColour(dt)

    if (this.state.elapsedSeconds - this.lastHistoryAt >= 2 || this.state.elapsedSeconds >= this.state.options.durationSeconds) {
      this.lastHistoryAt = this.state.elapsedSeconds
      const point: LiveMacroHistoryPoint = { elapsedSeconds: this.state.elapsedSeconds, nav: this.state.nav, drawdown: this.state.maxDrawdown, prices: { ...this.state.prices } }
      this.state.history.push(point)
      if (this.state.history.length > 900) this.state.history.shift()
    }

    if (this.state.maxDrawdown <= -0.10) {
      this.state.headlines.unshift({ id: `live-dd-stop-${Math.round(this.state.elapsedSeconds)}`, timestamp: this.state.elapsedSeconds, severity: 'critical', title: 'Mandate drawdown limit breached', detail: 'The portfolio breached the 10% hard drawdown limit. The live mandate is terminated.' })
      this.finish()
    } else if (this.state.elapsedSeconds >= this.state.options.durationSeconds) {
      this.finish()
    }
  }

  finish(): void {
    if (this.state.status === 'finished') return
    if (this.state.activeDealerRfq?.status === 'open') {
      this.state.dealerRfqs.unshift({ ...this.state.activeDealerRfq, status: 'cancelled' })
      this.state.activeDealerRfq = undefined
    }
    for (const order of this.state.workingOrders) if (order.status === 'working' || order.status === 'paused') order.status = 'cancelled'
    this.state.status = 'finished'
    this.state.nav = computeNav(this.state)
    this.updatePeaks()
    this.state.stressTests = computeLiveStressTests(this.state)
    this.updateRiskOversight()
    for (const thesis of this.state.theses) {
      if (thesis.closedTimestamp !== undefined) continue
      thesis.closedTimestamp = this.state.elapsedSeconds
      const endPrice = this.state.prices[thesis.assetId]
      const direction = thesis.targetWeight >= thesis.previousWeight ? 1 : -1
      thesis.outcomeReturn = direction * (endPrice / thesis.entryPrice - 1)
    }
    this.state.score = scoreLive(this.state)
  }
}

export function createLiveMacroEngine(options: LiveMacroSessionOptions): LiveMacroEngine {
  return new LiveMacroEngine(options)
}
