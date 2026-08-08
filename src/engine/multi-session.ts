import type {
  ClientFlowSignal,
  EventItem,
  FactorStateSnapshot,
  InstrumentConfig,
  MacroCalendarEvent,
  MacroFactor,
  MultiSessionOptions,
  MultiSessionSnapshot,
  PnlAttribution,
  PortfolioSnapshot,
  ScoreBreakdown,
  SessionSnapshot,
  TradeSide,
  WorkingHedgeStrategy,
} from '../types'
import { DealerSimEngine } from './session'
import { SeededRandom } from './random'

interface CalendarPlan extends MacroCalendarEvent {
  standardDeviation: number
  volatilityMultiplier: number
  liquidityMultiplier: number
  persistenceSeconds: number
  warned: boolean
}

const SHARED_FACTORS: Exclude<MacroFactor, 'company'>[] = ['inflation', 'growth', 'policy', 'risk', 'energy']

export class MultiDealerSimEngine {
  private readonly engines: DealerSimEngine[]
  private readonly options: MultiSessionOptions
  private readonly calendarPlan: CalendarPlan[]
  private readonly sharedEvents: EventItem[] = []
  private readonly factorRng: SeededRandom
  private status: MultiSessionSnapshot['status'] = 'ready'
  private elapsedSeconds = 0
  private eventCounter = 1
  private peakGrossRiskUtilisation = 0
  private factorStepAccumulator = 0
  private factorState: FactorStateSnapshot = { inflation: 0, growth: 0, policy: 0, risk: 0, energy: 0 }

  constructor(options: MultiSessionOptions) {
    if (options.instruments.length < 2 || options.instruments.length > 3) {
      throw new Error('Cross-asset desk mode supports two or three instruments.')
    }
    const unique = new Set(options.instruments.map((instrument) => instrument.id))
    if (unique.size !== options.instruments.length) throw new Error('Each desk instrument must be unique.')

    this.options = { ...options, instruments: [...options.instruments] }
    this.factorRng = new SeededRandom(options.seed).fork(9_901)
    this.engines = options.instruments.map((instrument, index) => new DealerSimEngine({
      seed: options.seed + (index + 1) * 10_007,
      scenario: options.scenario,
      difficulty: options.difficulty,
      durationSeconds: options.durationSeconds,
      instrument,
      coachingMode: options.coachingMode,
      sharedNewsMode: true,
      clientMemory: options.clientMemory,
    }))
    this.calendarPlan = createMacroCalendar(options, new SeededRandom(options.seed).fork(7_707))
    this.addSharedEvent(
      'system',
      `${options.instruments.length === 3 ? 'Three' : 'Two'}-market desk ready`,
      `${options.instruments.map((instrument) => instrument.symbol).join(', ')} share one macro tape and factor environment.`,
      'info',
    )
  }

  start(): MultiSessionSnapshot {
    if (this.status === 'ready' || this.status === 'paused') {
      this.status = 'running'
      this.engines.forEach((engine) => engine.start())
      this.addSharedEvent('system', 'Cross-asset session live', 'All markets, RFQ clocks and working orders are active.', 'positive')
    }
    return this.getSnapshot()
  }

  pause(): MultiSessionSnapshot {
    if (this.status === 'running') {
      this.status = 'paused'
      this.engines.forEach((engine) => engine.pause())
      this.addSharedEvent('system', 'Desk paused', 'All market clocks and RFQ deadlines are frozen.', 'warning')
    }
    return this.getSnapshot()
  }

  tick(dtSeconds: number, cloneResult = true): MultiSessionSnapshot {
    if (this.status !== 'running') return this.getSnapshot()
    const dt = Math.max(0, Math.min(1, dtSeconds))
    if (dt <= 0) return this.getSnapshot()

    const previousElapsed = this.elapsedSeconds
    const targetElapsed = Math.min(this.options.durationSeconds, previousElapsed + dt)
    this.processCalendar(previousElapsed, targetElapsed)
    this.processSharedFactors(dt)
    this.engines.forEach((engine) => engine.tick(dt, false))
    this.elapsedSeconds = targetElapsed
    this.updatePortfolioPeak()

    if (this.elapsedSeconds >= this.options.durationSeconds || this.engines.every((engine) => engine.getStatus() === 'finished')) {
      this.status = 'finished'
    }
    return cloneResult ? this.getSnapshot() : this.getSnapshot()
  }

  finishEarly(): MultiSessionSnapshot {
    if (this.status !== 'finished') {
      this.engines.forEach((engine) => engine.finishEarly())
      this.status = 'finished'
      this.addSharedEvent('system', 'Cross-asset session ended', 'Portfolio attribution and coaching are ready.', 'positive')
    }
    return this.getSnapshot()
  }

  submitQuote(instrumentId: string, bid?: number, ask?: number): MultiSessionSnapshot {
    this.findEngine(instrumentId).submitQuote(bid, ask)
    return this.getSnapshot()
  }

  passRfq(instrumentId: string): MultiSessionSnapshot {
    this.findEngine(instrumentId).passRfq()
    return this.getSnapshot()
  }

  hedgeMarket(instrumentId: string, side: TradeSide, sizeM: number): MultiSessionSnapshot {
    this.findEngine(instrumentId).hedgeMarket(side, sizeM)
    return this.getSnapshot()
  }

  startWorkingHedge(
    instrumentId: string,
    side: TradeSide,
    sizeM: number,
    strategy: WorkingHedgeStrategy,
    clipSizeM: number,
    intervalSeconds: number,
  ): MultiSessionSnapshot {
    this.findEngine(instrumentId).startWorkingHedge(side, sizeM, strategy, clipSizeM, intervalSeconds)
    return this.getSnapshot()
  }

  cancelWorkingHedge(instrumentId: string, orderId: string): MultiSessionSnapshot {
    this.findEngine(instrumentId).cancelWorkingHedge(orderId)
    return this.getSnapshot()
  }

  pauseWorkingHedge(instrumentId: string, orderId: string): MultiSessionSnapshot {
    this.findEngine(instrumentId).pauseWorkingHedge(orderId)
    return this.getSnapshot()
  }

  resumeWorkingHedge(instrumentId: string, orderId: string): MultiSessionSnapshot {
    this.findEngine(instrumentId).resumeWorkingHedge(orderId)
    return this.getSnapshot()
  }

  modifyWorkingHedge(instrumentId: string, orderId: string, clipSizeM: number, intervalSeconds: number): MultiSessionSnapshot {
    this.findEngine(instrumentId).modifyWorkingHedge(orderId, clipSizeM, intervalSeconds)
    return this.getSnapshot()
  }

  crossWorkingHedge(instrumentId: string, orderId: string): MultiSessionSnapshot {
    this.findEngine(instrumentId).crossWorkingHedge(orderId)
    return this.getSnapshot()
  }

  placePassiveOrder(instrumentId: string, side: TradeSide, price: number, sizeM: number): MultiSessionSnapshot {
    this.findEngine(instrumentId).placePassiveOrder(side, price, sizeM)
    return this.getSnapshot()
  }

  cancelPassiveOrder(instrumentId: string, orderId: string): MultiSessionSnapshot {
    this.findEngine(instrumentId).cancelPassiveOrder(orderId)
    return this.getSnapshot()
  }

  getStatus(): MultiSessionSnapshot['status'] { return this.status }
  getResolvedScenarios(): string[] { return this.engines.map((engine) => engine.getResolvedScenario()) }

  getSnapshot(): MultiSessionSnapshot {
    const legs = this.engines.map((engine) => engine.getSnapshot())
    const portfolio = buildPortfolioSnapshot(legs, this.peakGrossRiskUtilisation)
    const events = mergeDeskEvents(this.sharedEvents, legs)
    return {
      status: this.status,
      options: { ...this.options, instruments: [...this.options.instruments] },
      elapsedSeconds: this.elapsedSeconds,
      remainingSeconds: Math.max(0, this.options.durationSeconds - this.elapsedSeconds),
      legs,
      events,
      calendar: this.calendarPlan.map(({ standardDeviation: _sd, volatilityMultiplier: _v, liquidityMultiplier: _l, persistenceSeconds: _p, warned: _w, ...event }) => ({ ...event })),
      factors: { ...this.factorState },
      flowSignals: buildFlowSignals(legs),
      portfolio,
      attribution: this.status === 'finished' ? buildPortfolioAttribution(legs) : undefined,
      score: this.status === 'finished' ? buildPortfolioScore(legs, portfolio) : undefined,
    }
  }

  private processSharedFactors(dt: number): void {
    this.factorStepAccumulator += dt
    if (this.factorStepAccumulator < 0.5) return
    const step = this.factorStepAccumulator
    this.factorStepAccumulator = 0
    const scenarioVol = this.options.scenario === 'fast-market' || this.options.scenario === 'news-shock' ? 1.25 : this.options.scenario === 'illiquid' ? 1.1 : 1

    for (const factor of SHARED_FACTORS) {
      const previous = this.factorState[factor]
      const innovation = this.factorRng.normal(0, 0.075 * scenarioVol * Math.sqrt(step / 0.5))
      this.factorState[factor] = previous * 0.93 + innovation
    }

    this.engines.forEach((engine, index) => {
      const instrument = this.options.instruments[index]
      const move = SHARED_FACTORS.reduce((sum, factor) => sum + factorBeta(instrument, factor) * this.factorState[factor], 0)
      engine.applyExternalFactorImpulse(move * 0.055 * instrument.volatilityScale)
    })
  }

  private processCalendar(previousElapsed: number, targetElapsed: number): void {
    for (const event of this.calendarPlan) {
      if (!event.warned && previousElapsed < event.announceAt && targetElapsed >= event.announceAt) {
        event.warned = true
        const seconds = Math.max(0, Math.round(event.triggerAt - event.announceAt))
        this.addSharedEvent('news', `${event.name} in ${formatCountdown(seconds)}`, `Consensus ${formatRelease(event.consensus, event.unit)}.`, 'warning')
      }
      if (event.status === 'upcoming' && previousElapsed < event.triggerAt && targetElapsed >= event.triggerAt) {
        event.status = 'released'
        const z = event.surpriseZ ?? 0
        this.factorState[event.factor as Exclude<MacroFactor, 'company'>] += z * 0.75
        const direction = z >= 0 ? 1 : -1
        const magnitude = Math.min(16, 2.5 + Math.abs(z) * 4.2) * (this.options.scenario === 'news-shock' ? 1.35 : 1)
        const reactions: string[] = []
        this.engines.forEach((engine, index) => {
          const instrument = this.options.instruments[index]
          const beta = factorBeta(instrument, event.factor)
          const positioningNoise = this.factorRng.normal(0, Math.abs(beta) < 0.45 ? 0.28 : 0.14)
          const effectiveBeta = beta + positioningNoise
          const signed = effectiveBeta === 0 ? direction : (Math.sign(effectiveBeta * z || effectiveBeta) as -1 | 1)
          const sensitivity = Math.max(0.15, instrument.eventSensitivity[event.factor])
          engine.applyExternalNewsShock({
            id: `${event.id}-${instrument.id}`,
            headline: releaseHeadline(event),
            detail: event.detail,
            impactPips: magnitude * sensitivity * Math.max(0.35, Math.abs(effectiveBeta)),
            volatilityMultiplier: event.volatilityMultiplier,
            liquidityMultiplier: event.liquidityMultiplier,
            persistenceSeconds: event.persistenceSeconds,
            direction: signed,
            macroFactor: event.factor,
          })
          reactions.push(`${instrument.symbol} ${signed > 0 ? '↑' : '↓'}`)
        })
        this.addSharedEvent('news', releaseHeadline(event), `${event.detail} · ${Math.abs(z).toFixed(1)}σ surprise · ${reactions.join(' · ')}`, 'critical')
      }
    }
  }

  private updatePortfolioPeak(): void {
    const current = calculateGrossRiskUtilisation(this.engines.map((engine) => engine.getSnapshot()))
    this.peakGrossRiskUtilisation = Math.max(this.peakGrossRiskUtilisation, current)
  }

  private findEngine(instrumentId: string): DealerSimEngine {
    const index = this.options.instruments.findIndex((instrument) => instrument.id === instrumentId)
    if (index < 0) throw new Error(`Instrument ${instrumentId} is not active on this desk.`)
    return this.engines[index]
  }

  private addSharedEvent(category: EventItem['category'], headline: string, detail: string, severity: EventItem['severity']): void {
    this.sharedEvents.unshift({ id: `shared-event-${this.eventCounter++}`, timestamp: this.elapsedSeconds, headline, detail, severity, category })
    if (this.sharedEvents.length > 140) this.sharedEvents.length = 140
  }
}

function createMacroCalendar(options: MultiSessionOptions, rng: SeededRandom): CalendarPlan[] {
  const duration = options.durationSeconds
  const hasBrent = options.instruments.some((instrument) => instrument.assetClass === 'commodities')
  const hasRates = options.instruments.some((instrument) => instrument.assetClass === 'rates')
  const templates = [
    { name: 'US CPI', factor: 'inflation' as MacroFactor, consensus: rng.range(2.6, 3.6), sd: 0.18, unit: '%', detail: 'Inflation surprise changes the expected policy path and valuation discount rates.' },
    hasBrent
      ? { name: 'US crude inventories', factor: 'energy' as MacroFactor, consensus: rng.range(-2.5, 2.5), sd: 2.2, unit: 'm bbl', detail: 'Inventory surprise changes the near-term crude balance and energy risk premium.' }
      : hasRates
        ? { name: 'Central-bank policy rate', factor: 'policy' as MacroFactor, consensus: rng.pick([2.0, 2.25, 2.5, 3.0, 3.25]), sd: 0.18, unit: '%', detail: 'Policy surprise reprices duration and risk assets across the desk.' }
        : { name: 'US retail sales', factor: 'growth' as MacroFactor, consensus: rng.range(-0.2, 0.7), sd: 0.35, unit: '% m/m', detail: 'Demand surprise changes growth expectations and risk appetite.' },
    { name: 'US payrolls', factor: 'growth' as MacroFactor, consensus: rng.range(120, 220), sd: 55, unit: 'k', detail: 'Labour-market surprise alters both growth and policy expectations.' },
  ]
  const triggerFractions = [rng.range(0.27, 0.34), rng.range(0.56, 0.66), rng.range(0.80, 0.88)]
  return templates.map((template, index) => {
    const surpriseZ = Math.max(-2.8, Math.min(2.8, rng.normal(0, 1)))
    const actual = template.consensus + surpriseZ * template.sd
    const triggerAt = duration * triggerFractions[index]
    return {
      id: `calendar-${index + 1}`,
      name: template.name,
      factor: template.factor,
      announceAt: Math.max(5, triggerAt - (index === 0 ? 60 : 45)),
      triggerAt,
      consensus: roundRelease(template.consensus, template.unit),
      actual: roundRelease(actual, template.unit),
      unit: template.unit,
      surpriseZ,
      status: 'upcoming',
      detail: template.detail,
      standardDeviation: template.sd,
      volatilityMultiplier: Math.abs(surpriseZ) > 1.5 ? 2.15 : 1.7,
      liquidityMultiplier: Math.abs(surpriseZ) > 1.5 ? 0.52 : 0.68,
      persistenceSeconds: Math.abs(surpriseZ) > 1.5 ? 34 : 22,
      warned: false,
    }
  })
}

function factorBeta(instrument: InstrumentConfig, factor: MacroFactor): number {
  const stockSpecific: Partial<Record<string, Partial<Record<MacroFactor, number>>>> = {
    'apex-equity': { inflation: -0.8, growth: 0.8, policy: -0.75, risk: -0.9, energy: -0.15 },
    'mega-equity': { inflation: -0.65, growth: 0.85, policy: -0.7, risk: -0.9, energy: -0.1 },
    'nova-equity': { inflation: -1.1, growth: 1.15, policy: -1.05, risk: -1.2, energy: -0.12 },
    'heli-equity': { inflation: -0.3, growth: 0.35, policy: -0.25, risk: -0.35, energy: -0.05 },
  }
  const specific = stockSpecific[instrument.id]?.[factor]
  if (specific !== undefined) return specific
  if (factor === 'inflation') return instrument.assetClass === 'rates' ? -1.25 : instrument.assetClass === 'commodities' ? 0.15 : -0.75
  if (factor === 'growth') return instrument.assetClass === 'rates' ? -0.55 : instrument.assetClass === 'commodities' ? 0.95 : 0.95
  if (factor === 'policy') return instrument.assetClass === 'rates' ? -1.35 : instrument.assetClass === 'commodities' ? -0.2 : -0.8
  if (factor === 'risk') return instrument.assetClass === 'rates' ? 0.9 : instrument.assetClass === 'commodities' ? -0.45 : -1.0
  if (factor === 'energy') return instrument.assetClass === 'commodities' ? 1.65 : instrument.assetClass === 'rates' ? -0.15 : -0.18
  return 0
}

function buildFlowSignals(legs: SessionSnapshot[]): ClientFlowSignal[] {
  return legs.map((leg) => {
    const recent = leg.trades.filter((trade) => trade.source === 'client' && leg.elapsedSeconds - trade.timestamp <= 180)
    const buyVolumeM = recent.filter((trade) => trade.side === 'sell').reduce((sum, trade) => sum + trade.sizeM, 0)
    const sellVolumeM = recent.filter((trade) => trade.side === 'buy').reduce((sum, trade) => sum + trade.sizeM, 0)
    const netVolumeM = buyVolumeM - sellVolumeM
    const gross = buyVolumeM + sellVolumeM
    const strength = gross > 0 ? Math.abs(netVolumeM) / gross : 0
    const byType = new Map<string, number>()
    for (const trade of recent) {
      const rfq = leg.quoteHistory.find((record) => record.rfq.id === trade.rfqId)?.rfq
      const label = rfq ? clientTypeLabel(rfq.clientType) : 'Institutional'
      const clientSigned = trade.side === 'sell' ? trade.sizeM : -trade.sizeM
      byType.set(label, (byType.get(label) ?? 0) + clientSigned)
    }
    const dominant = [...byType.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
    return {
      instrumentId: leg.options.instrument.id,
      symbol: leg.options.instrument.symbol,
      buyVolumeM,
      sellVolumeM,
      netVolumeM,
      bias: strength < 0.18 ? 'balanced' : netVolumeM > 0 ? 'buying' : 'selling',
      strength,
      dominantClientLabel: dominant?.[0],
      dominantClientBias: dominant ? (dominant[1] >= 0 ? 'buying' : 'selling') : undefined,
      dominantClientNetM: dominant ? Math.abs(dominant[1]) : undefined,
    }
  })
}

function clientTypeLabel(type: SessionSnapshot['quoteHistory'][number]['rfq']['clientType']): string {
  if (type === 'asset-manager') return 'Asset managers'
  if (type === 'hedge-fund') return 'Hedge funds'
  if (type === 'fast-money') return 'Fast money'
  if (type === 'corporate') return 'Corporates'
  return 'Aggregators'
}

function buildPortfolioAttribution(legs: SessionSnapshot[]): PnlAttribution {
  const commission = legs.reduce((sum, leg) => sum + convertToUsd(leg.position.grossCommission, leg.options.instrument), 0)
  const clientPriceEdge = legs.reduce((sum, leg) => sum + convertToUsd(leg.metrics.clientPriceEdgePnl, leg.options.instrument), 0)
  const exchangeSlippage = -legs.reduce((sum, leg) => sum + convertToUsd(leg.metrics.exchangeSlippageCost, leg.options.instrument), 0)
  const marketImpact = -legs.reduce((sum, leg) => sum + convertToUsd(leg.metrics.marketImpactCost, leg.options.instrument), 0)
  const netPnl = legs.reduce((sum, leg) => sum + convertToUsd(leg.currentEquity, leg.options.instrument), 0)
  const inventoryAndTiming = netPnl - commission - clientPriceEdge - exchangeSlippage - marketImpact
  const adverseSelectionDiagnostic = legs.reduce((sum, leg) => sum + convertToUsd(leg.metrics.adverseSelectionPnl, leg.options.instrument), 0)
  const grossClientNotional = legs.reduce((sum, leg) => sum + approximateUsdNotional(leg.metrics.grossClientVolumeM, leg.options.instrument), 0)
  const internalisedNotional = legs.reduce((sum, leg) => sum + approximateUsdNotional(leg.metrics.internalisedVolumeM, leg.options.instrument), 0)
  const impactAvoidedEstimate = legs.reduce((sum, leg) => {
    if (leg.metrics.exchangeHedgeVolumeM <= 0 || leg.metrics.internalisedVolumeM <= 0) return sum
    const impactPerUnitUsd = convertToUsd(leg.metrics.marketImpactCost, leg.options.instrument) / leg.metrics.exchangeHedgeVolumeM
    return sum + impactPerUnitUsd * leg.metrics.internalisedVolumeM
  }, 0)
  return {
    commission,
    clientPriceEdge,
    exchangeSlippage,
    marketImpact,
    inventoryAndTiming,
    adverseSelectionDiagnostic,
    netPnl,
    internalisationRate: grossClientNotional > 0 ? internalisedNotional / grossClientNotional : 0,
    impactAvoidedEstimate: Math.max(0, impactAvoidedEstimate),
  }
}

function buildPortfolioSnapshot(legs: SessionSnapshot[], peakGrossRiskUtilisation: number): PortfolioSnapshot {
  return {
    totalPnl: legs.reduce((total, leg) => total + convertToUsd(leg.currentEquity, leg.options.instrument), 0),
    totalCommission: legs.reduce((total, leg) => total + convertToUsd(leg.position.grossCommission, leg.options.instrument), 0),
    grossRiskUtilisation: calculateGrossRiskUtilisation(legs),
    concentration: legs.reduce((max, leg) => Math.max(max, Math.abs(leg.position.quantityM) / Math.max(1, leg.hardLimitM)), 0),
    peakGrossRiskUtilisation,
    rfqsReceived: legs.reduce((total, leg) => total + leg.metrics.rfqsReceived, 0),
    quotesSubmitted: legs.reduce((total, leg) => total + leg.metrics.quotesSubmitted, 0),
    quotesAccepted: legs.reduce((total, leg) => total + leg.metrics.quotesAccepted, 0),
    rfqsExpired: legs.reduce((total, leg) => total + leg.metrics.rfqsExpired, 0),
  }
}

function approximateUsdNotional(sizeM: number, instrument: InstrumentConfig): number {
  const quoteNotional = sizeM * instrument.unitsPerSize * instrument.initialPrice
  return convertToUsd(quoteNotional, instrument)
}

function convertToUsd(value: number, instrument: InstrumentConfig): number {
  const fx = instrument.quoteCurrency === 'EUR' ? 1.085 : instrument.quoteCurrency === 'GBP' ? 1.27 : instrument.quoteCurrency === 'JPY' ? 0.0068 : 1
  return value * fx
}

function calculateGrossRiskUtilisation(legs: SessionSnapshot[]): number {
  if (legs.length === 0) return 0
  const sumSquares = legs.reduce((total, leg) => {
    const utilisation = Math.abs(leg.position.quantityM) / Math.max(1, leg.hardLimitM)
    return total + utilisation * utilisation
  }, 0)
  return Math.sqrt(sumSquares / legs.length)
}

function buildPortfolioScore(legs: SessionSnapshot[], portfolio: PortfolioSnapshot): ScoreBreakdown | undefined {
  const scored = legs.map((leg) => leg.score).filter((score): score is ScoreBreakdown => Boolean(score))
  if (scored.length !== legs.length || scored.length === 0) return undefined
  const average = (key: keyof Pick<ScoreBreakdown, 'pnl' | 'commission' | 'inventory' | 'quoteQuality' | 'adverseSelection' | 'execution'>) => scored.reduce((total, score) => total + score[key], 0) / scored.length
  const baseOverall = scored.reduce((total, score) => total + score.overall, 0) / scored.length
  const expiryRate = portfolio.rfqsReceived > 0 ? portfolio.rfqsExpired / portfolio.rfqsReceived : 0
  const attentionPenalty = Math.max(0, expiryRate - (legs.length === 3 ? 0.22 : 0.18)) * 20
  const concentrationPenalty = Math.max(0, portfolio.peakGrossRiskUtilisation - 0.82) * 14
  const overloadPenalty = legs.length === 3 ? Math.max(0, portfolio.peakGrossRiskUtilisation - 0.72) * 6 : 0
  const overall = clamp(baseOverall - attentionPenalty - concentrationPenalty - overloadPenalty, 0, 100)
  const rating = overall >= 84 ? 'Cross-asset controlled' : overall >= 72 ? 'Commercial multi-market desk' : overall >= 60 ? 'Inconsistent attention' : overall >= 46 ? 'Portfolio risk needs work' : 'Overloaded desk'
  const attribution = buildPortfolioAttribution(legs)
  const feedback = [
    `Peak portfolio risk utilisation was ${(portfolio.peakGrossRiskUtilisation * 100).toFixed(0)}%.`,
    `You missed ${(expiryRate * 100).toFixed(0)}% of incoming RFQs across ${legs.length} markets.`,
    portfolio.concentration > 0.75 ? 'One market carried most of the active inventory risk. Rebalance attention before accepting more flow.' : 'Risk was reasonably distributed across the active markets.',
  ]
  if (attribution.internalisationRate >= 0.35) feedback.push(`You internalised ${(attribution.internalisationRate * 100).toFixed(0)}% of client flow, reducing the amount sent back to the exchange.`)
  else if (legs.reduce((sum, leg) => sum + leg.metrics.grossClientVolumeM, 0) > 0) feedback.push('Internalisation was limited. Where risk limits allow, consider holding manageable residuals for offsetting client flow.')
  if (Math.abs(attribution.marketImpact) > Math.max(250, attribution.commission * 0.3)) feedback.push('Exchange market impact consumed a material share of client revenue. Smaller or liquidity-sensitive clips would have preserved more edge.')
  if (attribution.inventoryAndTiming < -Math.max(500, attribution.commission * 0.35)) feedback.push('Inventory and timing were a major drag. Review whether residual risk was warehoused for too long around macro or flow shifts.')
  else if (attribution.inventoryAndTiming > Math.max(500, attribution.commission * 0.25)) feedback.push('Inventory timing added meaningful P&L, but check the replay to distinguish deliberate warehousing from directional luck.')
  return { overall, rating, pnl: average('pnl'), commission: average('commission'), inventory: average('inventory'), quoteQuality: average('quoteQuality'), adverseSelection: average('adverseSelection'), execution: average('execution'), feedback: feedback.slice(0, 6) }
}

function mergeDeskEvents(sharedEvents: EventItem[], legs: SessionSnapshot[]): EventItem[] {
  const legEvents = legs.flatMap((leg) => leg.events.filter((event) => event.category === 'client' || event.category === 'risk' || event.category === 'market' || (event.category === 'news' && !event.headline.includes(' in '))).map((event) => ({ ...event, id: `${leg.options.instrument.id}-${event.id}`, headline: `[${leg.options.instrument.symbol}] ${event.headline}` })))
  return [...sharedEvents, ...legEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200)
}

function releaseHeadline(event: MacroCalendarEvent): string {
  return `${event.name} ${formatRelease(event.actual ?? event.consensus, event.unit)} vs ${formatRelease(event.consensus, event.unit)} expected`
}

function formatRelease(value: number, unit: string): string {
  if (unit === 'k') return `${Math.round(value)}k`
  if (unit === 'm bbl') return `${value >= 0 ? '+' : ''}${value.toFixed(1)}m bbl`
  return `${value.toFixed(1)}${unit.startsWith('%') ? '%' : ` ${unit}`}`
}

function roundRelease(value: number, unit: string): number {
  if (unit === 'k') return Math.round(value)
  return Math.round(value * 10) / 10
}

function formatCountdown(seconds: number): string {
  if (seconds >= 60) { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return remainder ? `${minutes}m ${remainder}s` : `${minutes}m` }
  return `${seconds}s`
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)) }
