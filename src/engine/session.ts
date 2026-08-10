import type {
  ClientProfile,
  DealerMarketPhase,
  EventItem,
  PassiveOrder,
  PricePoint,
  QuoteRecord,
  QuoteSubmission,
  SessionMetrics,
  SessionOptions,
  ScheduledMarketEvent,
  SessionSnapshot,
  Trade,
  TradeSide,
  WorkingHedge,
  WorkingHedgeStrategy,
} from '../types'
import {
  applyTrade,
  emptyPosition,
  estimateBlockExecution,
  executeAgainstBook,
  markPosition,
  netTradingPnl,
} from './accounting'
import {
  addExternalImpulse,
  applyAggressiveExecutionImpact,
  applyRegimeTransition,
  createMarketState,
  createOrderBook,
  createScenarioPlan,
  stepMarket,
  toMarketSnapshot,
  triggerMarketEvent,
  type MarketModelState,
  type ScenarioPlan,
} from './market'
import {
  createClientBook,
  createRfq,
  estimateAdverseSelectionImpulsePips,
  nextRfqDelaySeconds,
  resolveQuote,
} from './rfq'
import { SeededRandom } from './random'
import { computeScore } from './score'


function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }

function dealerPhaseSettings(elapsed: number, duration: number, events: ScheduledMarketEvent[]): { phase: DealerMarketPhase; liquidity: number; volatility: number } {
  const eventWindow = events.some((event) => Math.abs(event.triggerAt - elapsed) <= Math.max(7, duration * 0.025))
  if (eventWindow) return { phase: 'event-window', liquidity: 0.55, volatility: 1.60 }
  const progress = duration > 0 ? elapsed / duration : 0
  if (progress < 0.12) return { phase: 'opening', liquidity: 0.78, volatility: 1.35 }
  if (progress < 0.48) return { phase: 'morning', liquidity: 1.08, volatility: 0.95 }
  if (progress < 0.72) return { phase: 'midday', liquidity: 0.72, volatility: 0.78 }
  if (progress < 0.88) return { phase: 'morning', liquidity: 1.00, volatility: 1.00 }
  return { phase: 'closing', liquidity: 1.15, volatility: 1.20 }
}

function dealerPhaseLabel(phase: DealerMarketPhase): string {
  if (phase === 'opening') return 'Opening flow'
  if (phase === 'morning') return 'Morning liquidity'
  if (phase === 'midday') return 'Midday / thin'
  if (phase === 'event-window') return 'Event window'
  return 'Closing flow'
}

interface PendingMarkout {
  tradeId: string
  dueAt: number
}

export class DealerSimEngine {
  private readonly rng: SeededRandom
  private readonly marketRng: SeededRandom
  private readonly flowRng: SeededRandom
  private readonly plan: ScenarioPlan
  private readonly marketState: MarketModelState
  private snapshot: SessionSnapshot
  private nextRfqAt = 3
  private transitionIndex = 0
  private pendingMarkouts: PendingMarkout[] = []
  private lastPriceSampleAt = -1
  private wasAboveSoftLimit = false
  private wasAboveHardLimit = false
  private eventCounter = 1
  private tradeCounter = 1
  private passiveCounter = 1
  private workingHedgeCounter = 1
  private interdealerPressure = 0
  private lastInterdealerAt = -Infinity

  constructor(options: SessionOptions) {
    this.rng = new SeededRandom(options.seed)
    this.marketRng = this.rng.fork(101)
    this.flowRng = this.rng.fork(202)
    this.plan = createScenarioPlan(
      options.scenario,
      options.difficulty,
      options.durationSeconds,
      options.instrument,
      this.rng.fork(303),
    )
    this.marketState = createMarketState(
      options.instrument,
      this.plan,
      options.difficulty,
      this.marketRng,
    )
    const openingPhase = dealerPhaseSettings(0, options.durationSeconds, this.plan.events)
    this.marketState.timeLiquidityMultiplier = openingPhase.liquidity
    this.marketState.timeVolatilityMultiplier = openingPhase.volatility
    const orderBook = createOrderBook(
      this.marketState,
      options.instrument,
      this.marketRng,
    )
    const market = toMarketSnapshot(this.marketState, options.instrument, orderBook)
    const clients = createClientBook(
      options.difficulty,
      this.plan.scenario,
      options.instrument,
      this.flowRng,
      options.clientMemory,
    )

    this.snapshot = {
      status: 'ready',
      options: {
        ...options,
        scenario: options.scenario,
      },
      elapsedSeconds: 0,
      remainingSeconds: options.durationSeconds,
      market,
      priceHistory: [toPricePoint(market)],
      position: emptyPosition(),
      quoteHistory: [],
      trades: [],
      passiveOrders: [],
      workingHedges: [],
      events: [],
      clients,
      metrics: createEmptyMetrics(),
      softLimitM: this.plan.softLimitM,
      hardLimitM: this.plan.hardLimitM,
      currentEquity: 0,
      marketPhase: openingPhase.phase,
      timeLiquidityMultiplier: openingPhase.liquidity,
      timeVolatilityMultiplier: openingPhase.volatility,
    }

    this.addEvent(
      'system',
      'DealerSim ready',
      `${this.plan.scenario.replace(/-/g, ' ')} scenario · seed ${options.seed}`,
      'info',
    )
  }

  start(): SessionSnapshot {
    if (this.snapshot.status === 'ready' || this.snapshot.status === 'paused') {
      this.snapshot.status = 'running'
      this.addEvent('system', 'Session live', `The ${this.snapshot.options.instrument.symbol} market is open for client flow.`, 'positive')
    }
    return this.getSnapshot()
  }

  pause(): SessionSnapshot {
    if (this.snapshot.status === 'running') {
      this.snapshot.status = 'paused'
      this.addEvent('system', 'Session paused', 'The simulation clock has stopped.', 'warning')
    }
    return this.getSnapshot()
  }

  tick(dtSeconds: number, cloneResult = true): SessionSnapshot {
    if (this.snapshot.status !== 'running') return cloneResult ? this.getSnapshot() : this.snapshot

    const dt = Math.max(0, Math.min(1, dtSeconds))
    if (dt === 0) return cloneResult ? this.getSnapshot() : this.snapshot

    this.snapshot.elapsedSeconds = Math.min(
      this.snapshot.options.durationSeconds,
      this.snapshot.elapsedSeconds + dt,
    )
    this.snapshot.remainingSeconds = Math.max(
      0,
      this.snapshot.options.durationSeconds - this.snapshot.elapsedSeconds,
    )

    const phase = dealerPhaseSettings(this.snapshot.elapsedSeconds, this.snapshot.options.durationSeconds, this.plan.events)
    const phaseChanged = phase.phase !== this.snapshot.marketPhase
    this.snapshot.marketPhase = phase.phase
    this.snapshot.timeLiquidityMultiplier = phase.liquidity
    this.snapshot.timeVolatilityMultiplier = phase.volatility
    this.marketState.timeLiquidityMultiplier = phase.liquidity
    this.marketState.timeVolatilityMultiplier = phase.volatility
    if (phaseChanged) this.addEvent('market', `Market phase: ${dealerPhaseLabel(phase.phase)}`, `Time-of-day liquidity ${phase.liquidity.toFixed(2)}x · volatility ${phase.volatility.toFixed(2)}x.`, phase.phase === 'event-window' ? 'warning' : 'info')

    this.processRegimeTransitions()
    this.processScheduledEvents()
    stepMarket(
      this.marketState,
      dt,
      this.snapshot.options.instrument,
      this.marketRng,
    )

    const orderBook = createOrderBook(
      this.marketState,
      this.snapshot.options.instrument,
      this.marketRng,
    )
    this.snapshot.market = toMarketSnapshot(
      this.marketState,
      this.snapshot.options.instrument,
      orderBook,
    )

    this.processWorkingHedges()
    this.processPassiveOrders(dt)
    this.processPendingQuote()
    this.processRfqExpiry()
    this.spawnRfqIfDue()
    this.processMarkouts()

    this.snapshot.position = markPosition(
      this.snapshot.position,
      this.snapshot.market.mid,
      this.snapshot.options.instrument,
    )
    this.snapshot.currentEquity = netTradingPnl(this.snapshot.position)
    this.updateRiskMetrics(dt)
    this.samplePrice()

    if (this.snapshot.remainingSeconds <= 0) {
      this.finish('Session complete')
    }

    return cloneResult ? this.getSnapshot() : this.snapshot
  }

  submitQuote(bid?: number, ask?: number): SessionSnapshot {
    const rfq = this.snapshot.activeRfq
    if (!rfq || this.snapshot.status !== 'running' || this.snapshot.pendingQuote) {
      return this.getSnapshot()
    }

    const requiresBid = rfq.kind === 'two-way' || rfq.requestedSide === 'sell'
    const requiresAsk = rfq.kind === 'two-way' || rfq.requestedSide === 'buy'
    const validBid = requiresBid && bid !== undefined && Number.isFinite(bid) ? bid : undefined
    const validAsk = requiresAsk && ask !== undefined && Number.isFinite(ask) ? ask : undefined

    // A two-way RFQ must contain both sides. A directional or limit RFQ only
    // transmits the side the client actually requested.
    if ((requiresBid && validBid === undefined) || (requiresAsk && validAsk === undefined)) {
      return this.getSnapshot()
    }

    const submission: QuoteSubmission = {
      rfqId: rfq.id,
      bid: validBid,
      ask: validAsk,
      submittedAt: this.snapshot.elapsedSeconds,
      marketAtSubmission: cloneMarket(this.snapshot.market),
    }

    const isTwoWay = rfq.kind === 'two-way'
    const spread =
      isTwoWay && validBid !== undefined && validAsk !== undefined
        ? (validAsk - validBid) / this.snapshot.options.instrument.pipSize
        : undefined
    const extreme =
      (validBid !== undefined && Math.abs(validBid - this.snapshot.market.mid) / this.snapshot.options.instrument.pipSize > 12) ||
      (validAsk !== undefined && Math.abs(validAsk - this.snapshot.market.mid) / this.snapshot.options.instrument.pipSize > 12) ||
      (isTwoWay && validBid !== undefined && validAsk !== undefined && validBid >= validAsk)

    this.snapshot.metrics.quotesSubmitted += 1
    this.snapshot.metrics.totalResponseTime += submission.submittedAt - rfq.createdAt
    this.snapshot.metrics.responseSamples += 1
    if (spread !== undefined) {
      this.snapshot.metrics.totalQuotedSpreadPips += Math.abs(spread)
      this.snapshot.metrics.quoteSpreadSamples += 1
    }
    if (extreme) {
      this.snapshot.metrics.fatFingerFlags += 1
      this.addEvent(
        'risk',
        'Extreme quote submitted',
        'The price was accepted by the system and may be traded by the client.',
        'critical',
      )
    }
    if (rfq.controlFlag) {
      this.snapshot.metrics.fatFingerFlags += 1
      this.addEvent(
        'risk',
        'Control exception ignored',
        rfq.controlNote ?? 'A flagged RFQ was priced without resolving the control check.',
        'critical',
      )
    }

    this.snapshot.pendingQuote = submission
    this.snapshot.pendingDecisionAt =
      this.snapshot.elapsedSeconds + this.flowRng.range(0.65, 1.8)
    this.snapshot.activeRfq = { ...rfq, status: 'quoted' }
    this.snapshot.quoteHistory.push({
      id: `quote-${rfq.id}`,
      rfq: { ...rfq, status: 'quoted' },
      submission,
    })
    return this.getSnapshot()
  }

  passRfq(): SessionSnapshot {
    const rfq = this.snapshot.activeRfq
    if (!rfq || this.snapshot.pendingQuote) return this.getSnapshot()
    this.snapshot.metrics.rfqsPassed += 1
    this.updateQuoteRecord(rfq.id, {
      rfq: { ...rfq, status: 'rejected' },
    })
    this.addEvent(
      rfq.controlFlag ? 'risk' : 'client',
      rfq.controlFlag ? 'Control check resolved' : `Passed ${rfq.clientName}`,
      rfq.controlFlag ? (rfq.controlNote ?? 'Flagged RFQ was not priced pending clarification.') : `${formatInstrumentSize(rfq.sizeM, this.snapshot.options.instrument)} RFQ declined.`,
      rfq.controlFlag ? 'positive' : 'warning',
    )
    this.snapshot.activeRfq = undefined
    this.nextRfqAt =
      this.snapshot.elapsedSeconds +
      nextRfqDelaySeconds(
        this.plan,
        this.snapshot.options.difficulty,
        this.flowRng,
      )
    return this.getSnapshot()
  }

  hedgeMarket(
    side: TradeSide,
    sizeM: number,
    source: Trade['source'] = 'market-hedge',
    executionStrategy: Trade['executionStrategy'] = source === 'worked-hedge' ? 'twap' : 'immediate',
  ): SessionSnapshot {
    if (this.snapshot.status !== 'running') return this.getSnapshot()
    const requested = Math.max(0, Math.min(this.snapshot.options.instrument.maximumSizeM, sizeM))
    if (requested <= 0) return this.getSnapshot()

    const estimate = estimateBlockExecution(
      side,
      requested,
      this.snapshot.market.orderBook,
      this.snapshot.market,
      this.snapshot.options.instrument,
    )
    const execution = executeAgainstBook(
      side,
      requested,
      this.snapshot.market.orderBook,
      this.snapshot.market,
      this.snapshot.options.instrument,
    )
    if (execution.filledM <= 0) return this.getSnapshot()

    const impactCost = estimate.temporaryImpactPips * this.snapshot.options.instrument.pipSize * execution.filledM * this.snapshot.options.instrument.pnlMultiplier
    const trade: Trade = {
      id: `trade-${this.tradeCounter++}`,
      timestamp: this.snapshot.elapsedSeconds,
      instrument: this.snapshot.options.instrument.symbol,
      side,
      price: execution.averagePrice,
      sizeM: execution.filledM,
      source,
      commission: 0,
      executionCost: execution.executionCost + impactCost,
      temporaryImpactPips: estimate.temporaryImpactPips,
      marketImpactCost: impactCost,
      executionStrategy,
      referenceMid: this.snapshot.market.mid,
      exchangeSlippageCost: execution.executionCost,
    }
    this.recordTrade(trade)
    this.snapshot.metrics.hedgeTrades += 1

    if (this.snapshot.options.instrument.marketStructure === 'central-limit-order-book') {
      const participation = execution.filledM / Math.max(this.snapshot.options.instrument.minimumSizeM, estimate.displayedDepthM)
      applyAggressiveExecutionImpact(
        this.marketState,
        side,
        estimate.temporaryImpactPips,
        participation,
        this.snapshot.options.instrument,
        executionStrategy,
      )
    }

    this.addEvent(
      'market',
      `${side === 'buy' ? 'Bought' : 'Sold'} ${formatInstrumentSize(execution.filledM, this.snapshot.options.instrument)} at market`,
      `${formatPrice(execution.averagePrice, this.snapshot.options.instrument.priceDecimals)} · ${execution.levelsConsumed} depth level${execution.levelsConsumed === 1 ? '' : 's'} consumed${estimate.temporaryImpactPips > 0.1 ? ` · est. ${estimate.temporaryImpactPips.toFixed(1)} tick impact` : ''}.`,
      execution.levelsConsumed > 2 || estimate.temporaryImpactPips > 1.5 ? 'warning' : 'info',
    )
    return this.getSnapshot()
  }


  hedgeInterdealer(side: TradeSide, sizeM: number): SessionSnapshot {
    if (this.snapshot.status !== 'running') return this.getSnapshot()
    const instrument = this.snapshot.options.instrument
    const requested = Math.max(0, Math.min(instrument.maximumSizeM, sizeM))
    if (requested <= 0) return this.getSnapshot()

    const direct = estimateBlockExecution(side, requested, this.snapshot.market.orderBook, this.snapshot.market, instrument)
    const secondsSinceLast = this.snapshot.elapsedSeconds - this.lastInterdealerAt
    const recentPressure = secondsSinceLast <= 30 ? this.interdealerPressure : this.interdealerPressure * 0.24
    const capacityBase = Math.max(instrument.minimumSizeM, this.snapshot.market.displayedDepthM * (0.34 + this.snapshot.market.liquidity * 0.34))
    const capacityWithdrawal = 1 / (1 + recentPressure * 0.34)
    const available = Math.min(requested, capacityBase * capacityWithdrawal * this.flowRng.range(0.72, 1.18))
    if (available <= 0) return this.getSnapshot()

    const staleOrWrongWay = this.flowRng.chance(clamp(0.16 + Math.max(0, 0.58 - this.snapshot.market.liquidity) * 0.18 + recentPressure * 0.075, 0.08, 0.62))
    const quoteQualityBase = staleOrWrongWay ? this.flowRng.range(0.72, 0.96) : this.flowRng.range(0.34, 0.58)
    const quoteQuality = Math.min(1.18, quoteQualityBase + recentPressure * 0.055)
    const blockCostPips = Math.max(
      this.snapshot.market.spreadPips * 0.46,
      this.snapshot.market.spreadPips * 0.36 + direct.temporaryImpactPips * quoteQuality,
    )
    const sign = side === 'buy' ? 1 : -1
    const price = this.snapshot.market.mid + sign * blockCostPips * instrument.pipSize
    const executionCost = Math.abs(price - this.snapshot.market.mid) * available * instrument.pnlMultiplier
    const impactPips = direct.temporaryImpactPips * (staleOrWrongWay ? 0.44 : 0.26)
    const impactCost = impactPips * instrument.pipSize * available * instrument.pnlMultiplier
    const trade: Trade = {
      id: `trade-${this.tradeCounter++}`,
      timestamp: this.snapshot.elapsedSeconds,
      instrument: instrument.symbol,
      side,
      price,
      sizeM: available,
      source: 'interdealer-hedge',
      commission: 0,
      executionCost: executionCost + impactCost,
      temporaryImpactPips: impactPips,
      marketImpactCost: impactCost,
      executionStrategy: 'liquidity-sensitive',
      referenceMid: this.snapshot.market.mid,
      exchangeSlippageCost: executionCost,
    }
    this.recordTrade(trade)
    this.snapshot.metrics.hedgeTrades += 1
    this.interdealerPressure = clamp(recentPressure + 0.28 + available / Math.max(instrument.minimumSizeM, capacityBase) * 0.34, 0, 2.8)
    this.lastInterdealerAt = this.snapshot.elapsedSeconds

    if (instrument.marketStructure === 'central-limit-order-book') {
      const participation = available / Math.max(instrument.minimumSizeM, direct.displayedDepthM)
      applyAggressiveExecutionImpact(this.marketState, side, impactPips, participation * 0.42, instrument, 'liquidity-sensitive')
    }

    this.addEvent(
      'market',
      `${side === 'buy' ? 'Bought' : 'Sold'} ${formatInstrumentSize(available, instrument)} interdealer`,
      `${formatPrice(price, instrument.priceDecimals)} · block liquidity${available + 1e-9 < requested ? ` · only ${formatInstrumentSize(available, instrument)} of ${formatInstrumentSize(requested, instrument)} available` : ''}${staleOrWrongWay ? ' · quote was relatively poor' : ''}${recentPressure > 0.8 ? ' · repeated street inquiry is moving liquidity away' : ''}.`,
      staleOrWrongWay || available + 1e-9 < requested ? 'warning' : 'info',
    )
    return this.getSnapshot()
  }

  startWorkingHedge(
    side: TradeSide,
    sizeM: number,
    strategy: WorkingHedgeStrategy,
    clipSizeM: number,
    intervalSeconds: number,
  ): SessionSnapshot {
    if (this.snapshot.status !== 'running') return this.getSnapshot()
    const total = Math.max(0, Math.min(this.snapshot.options.instrument.maximumSizeM, sizeM))
    const clip = Math.max(this.snapshot.options.instrument.minimumSizeM, Math.min(total, clipSizeM))
    const interval = Math.max(1, Math.min(30, intervalSeconds))
    if (total <= 0) return this.getSnapshot()
    const working: WorkingHedge = {
      id: `worked-${this.workingHedgeCounter++}`,
      side,
      strategy,
      totalSizeM: total,
      remainingM: total,
      clipSizeM: clip,
      intervalSeconds: interval,
      createdAt: this.snapshot.elapsedSeconds,
      nextClipAt: this.snapshot.elapsedSeconds,
      status: 'working',
      executedM: 0,
      averageExecutionPrice: 0,
      executionCost: 0,
      marketImpactCost: 0,
    }
    this.snapshot.workingHedges.push(working)
    this.addEvent(
      'market',
      `${strategy === 'twap' ? 'Evenly worked' : 'Liquidity-sensitive'} hedge started`,
      `${formatInstrumentSize(total, this.snapshot.options.instrument)} in clips of ${formatInstrumentSize(clip, this.snapshot.options.instrument)}.`,
      'info',
    )
    return this.getSnapshot()
  }

  cancelWorkingHedge(orderId: string): SessionSnapshot {
    const order = this.snapshot.workingHedges.find((item) => item.id === orderId)
    if (order?.status === 'working') {
      order.status = 'cancelled'
      this.addEvent('market', 'Worked hedge cancelled', `${formatInstrumentSize(order.remainingM, this.snapshot.options.instrument)} remaining.`, 'warning')
    }
    return this.getSnapshot()
  }

  pauseWorkingHedge(orderId: string): SessionSnapshot {
    const order = this.snapshot.workingHedges.find((item) => item.id === orderId)
    if (order?.status === 'working') {
      order.status = 'paused'
      this.addEvent('market', 'Worked hedge paused', `${formatInstrumentSize(order.remainingM, this.snapshot.options.instrument)} remaining.`, 'warning')
    }
    return this.getSnapshot()
  }

  resumeWorkingHedge(orderId: string): SessionSnapshot {
    const order = this.snapshot.workingHedges.find((item) => item.id === orderId)
    if (order?.status === 'paused') {
      order.status = 'working'
      order.nextClipAt = this.snapshot.elapsedSeconds + 0.25
      this.addEvent('market', 'Worked hedge resumed', `${formatInstrumentSize(order.remainingM, this.snapshot.options.instrument)} remaining.`, 'info')
    }
    return this.getSnapshot()
  }

  modifyWorkingHedge(orderId: string, clipSizeM: number, intervalSeconds: number): SessionSnapshot {
    const order = this.snapshot.workingHedges.find((item) => item.id === orderId)
    if (!order || (order.status !== 'working' && order.status !== 'paused')) return this.getSnapshot()
    order.clipSizeM = Math.max(this.snapshot.options.instrument.minimumSizeM, Math.min(order.remainingM, clipSizeM))
    order.intervalSeconds = Math.max(1, Math.min(30, intervalSeconds))
    this.addEvent('market', 'Worked hedge schedule amended', `${formatInstrumentSize(order.clipSizeM, this.snapshot.options.instrument)} clips every ${order.intervalSeconds.toFixed(0)}s.`, 'info')
    return this.getSnapshot()
  }

  crossWorkingHedge(orderId: string): SessionSnapshot {
    const order = this.snapshot.workingHedges.find((item) => item.id === orderId)
    if (!order || (order.status !== 'working' && order.status !== 'paused') || order.remainingM <= 0) return this.getSnapshot()
    const before = this.snapshot.trades.length
    this.hedgeMarket(order.side, order.remainingM, 'worked-hedge', 'immediate')
    const trade = this.snapshot.trades.length > before ? this.snapshot.trades[this.snapshot.trades.length - 1] : undefined
    if (trade) {
      const priorExecuted = order.executedM
      const nextExecuted = priorExecuted + trade.sizeM
      order.averageExecutionPrice = nextExecuted > 0 ? ((order.averageExecutionPrice * priorExecuted) + trade.price * trade.sizeM) / nextExecuted : 0
      order.executedM = nextExecuted
      order.executionCost += trade.executionCost
      order.marketImpactCost += trade.marketImpactCost ?? 0
      order.remainingM = Math.max(0, order.remainingM - trade.sizeM)
      order.status = order.remainingM <= 1e-9 ? 'completed' : 'paused'
      this.snapshot.metrics.workedHedgeVolumeM += trade.sizeM
      this.addEvent('market', 'Worked hedge crossed', `${formatInstrumentSize(trade.sizeM, this.snapshot.options.instrument)} executed immediately.`, 'warning')
    }
    return this.getSnapshot()
  }

  placePassiveOrder(side: TradeSide, price: number, sizeM: number): SessionSnapshot {
    if (this.snapshot.status !== 'running') return this.getSnapshot()
    if (!Number.isFinite(price) || !Number.isFinite(sizeM) || sizeM <= 0) return this.getSnapshot()

    const order: PassiveOrder = {
      id: `passive-${this.passiveCounter++}`,
      side,
      price,
      sizeM: Math.min(this.snapshot.options.instrument.maximumSizeM, sizeM),
      remainingM: Math.min(this.snapshot.options.instrument.maximumSizeM, sizeM),
      createdAt: this.snapshot.elapsedSeconds,
      queuePosition: this.flowRng.range(0.18, 0.95),
      status: 'working',
    }
    this.snapshot.passiveOrders.push(order)
    this.addEvent(
      'market',
      `Passive ${side} order working`,
      `${formatInstrumentSize(order.sizeM, this.snapshot.options.instrument)} at ${formatPrice(price, this.snapshot.options.instrument.priceDecimals)}.`,
      'info',
    )
    return this.getSnapshot()
  }

  cancelPassiveOrder(orderId: string): SessionSnapshot {
    const order = this.snapshot.passiveOrders.find((item) => item.id === orderId)
    if (order?.status === 'working') {
      order.status = 'cancelled'
      this.addEvent('market', 'Passive order cancelled', order.id, 'info')
    }
    return this.getSnapshot()
  }

  applyExternalNewsShock(
    event: Pick<ScheduledMarketEvent, 'id' | 'headline' | 'detail' | 'impactPips' | 'volatilityMultiplier' | 'liquidityMultiplier' | 'persistenceSeconds' | 'direction' | 'macroFactor'>,
    recordEvent = false,
  ): SessionSnapshot {
    if (this.snapshot.status !== 'running') return this.getSnapshot()
    triggerMarketEvent(
      this.marketState,
      {
        ...event,
        triggerAt: this.snapshot.elapsedSeconds,
        announced: true,
        triggered: true,
      },
      this.snapshot.options.instrument,
    )
    if (recordEvent) {
      this.addEvent(
        'news',
        event.headline,
        event.detail,
        'critical',
      )
    }
    return this.getSnapshot()
  }

  applyExternalFactorImpulse(impactPips: number): SessionSnapshot {
    if (this.snapshot.status !== 'running' || !Number.isFinite(impactPips)) return this.getSnapshot()
    addExternalImpulse(this.marketState, Math.max(-2.5, Math.min(2.5, impactPips)))
    return this.getSnapshot()
  }

  finishEarly(): SessionSnapshot {
    if (this.snapshot.status === 'running' || this.snapshot.status === 'paused') {
      this.finish('Session ended by trader')
    }
    return this.getSnapshot()
  }

  getSnapshot(): SessionSnapshot {
    return {
      ...this.snapshot,
      options: {
        ...this.snapshot.options,
        instrument: { ...this.snapshot.options.instrument },
      },
      market: cloneMarket(this.snapshot.market),
      priceHistory: [...this.snapshot.priceHistory],
      position: { ...this.snapshot.position },
      activeRfq: this.snapshot.activeRfq ? { ...this.snapshot.activeRfq } : undefined,
      pendingQuote: this.snapshot.pendingQuote
        ? {
            ...this.snapshot.pendingQuote,
            marketAtSubmission: cloneMarket(this.snapshot.pendingQuote.marketAtSubmission),
          }
        : undefined,
      quoteHistory: this.snapshot.quoteHistory.map((record) => ({
        ...record,
        rfq: { ...record.rfq },
        submission: record.submission
          ? {
              ...record.submission,
              marketAtSubmission: cloneMarket(record.submission.marketAtSubmission),
            }
          : undefined,
        outcome: record.outcome ? { ...record.outcome } : undefined,
      })),
      trades: this.snapshot.trades.map((trade) => ({ ...trade })),
      passiveOrders: this.snapshot.passiveOrders.map((order) => ({ ...order })),
      workingHedges: this.snapshot.workingHedges.map((order) => ({ ...order })),
      events: this.snapshot.events.map((event) => ({ ...event })),
      clients: this.snapshot.clients.map((client) => ({ ...client })),
      metrics: { ...this.snapshot.metrics },
      score: this.snapshot.score
        ? { ...this.snapshot.score, feedback: [...this.snapshot.score.feedback] }
        : undefined,
    }
  }

  getResolvedScenario(): ScenarioPlan['scenario'] {
    return this.plan.scenario
  }

  getStatus(): SessionSnapshot['status'] {
    return this.snapshot.status
  }

  private processRegimeTransitions(): void {
    while (
      this.transitionIndex < this.plan.regimeTransitions.length &&
      this.snapshot.elapsedSeconds >= this.plan.regimeTransitions[this.transitionIndex].at
    ) {
      const transition = this.plan.regimeTransitions[this.transitionIndex]
      applyRegimeTransition(this.marketState, transition)
      this.addEvent(
        'market',
        `Market regime: ${transition.regime.replace(/-/g, ' ')}`,
        'Volatility, drift and available depth have changed.',
        transition.regime === 'volatile' || transition.regime === 'illiquid'
          ? 'warning'
          : 'info',
      )
      this.transitionIndex += 1
    }
  }

  private processScheduledEvents(): void {
    for (const event of this.plan.events) {
      if (this.snapshot.options.sharedNewsMode && event.macroFactor !== 'company') continue
      if (
        event.announceAt !== undefined &&
        !event.announced &&
        this.snapshot.elapsedSeconds >= event.announceAt
      ) {
        event.announced = true
        const seconds = Math.max(0, Math.round(event.triggerAt - this.snapshot.elapsedSeconds))
        this.addEvent(
          'news',
          `${event.headline} in ${formatCountdown(seconds)}`,
          event.consensus !== undefined ? `${event.detail} · consensus ${formatReleaseValue(event.consensus, event.releaseUnit)}.` : event.detail,
          'warning',
        )
      }

      if (!event.triggered && this.snapshot.elapsedSeconds >= event.triggerAt) {
        event.triggered = true
        triggerMarketEvent(
          this.marketState,
          event,
          this.snapshot.options.instrument,
        )
        const releaseHeadline = event.releaseName && event.actual !== undefined && event.consensus !== undefined
          ? `${event.releaseName} ${formatReleaseValue(event.actual, event.releaseUnit)} vs ${formatReleaseValue(event.consensus, event.releaseUnit)} expected`
          : event.announceAt === undefined ? event.headline : `${event.headline.replace(' due', '')} surprises materially`
        const surpriseDetail = event.surpriseZ !== undefined ? ` · ${event.surpriseZ > 0 ? '+' : ''}${event.surpriseZ.toFixed(1)}σ surprise` : ''
        this.addEvent(
          'news',
          releaseHeadline,
          `${this.snapshot.options.instrument.symbol} ${event.direction > 0 ? 'jumps higher' : 'sells off'} as the market reprices${surpriseDetail}.`,
          'critical',
        )
      }
    }
  }

  private processPendingQuote(): void {
    const rfq = this.snapshot.activeRfq
    const submission = this.snapshot.pendingQuote
    const decisionAt = this.snapshot.pendingDecisionAt
    if (!rfq || !submission || decisionAt === undefined) return
    if (this.snapshot.elapsedSeconds < decisionAt) return

    const client = this.findClient(rfq.clientId)
    const outcome = resolveQuote(
      rfq,
      client,
      submission,
      this.snapshot.market,
      this.plan,
      this.snapshot.options.instrument,
      this.flowRng,
    )

    const status = outcome.accepted ? 'traded' : 'rejected'
    this.updateQuoteRecord(rfq.id, {
      rfq: { ...rfq, status },
      submission,
      outcome,
    })

    if (outcome.accepted && outcome.side && outcome.price !== undefined) {
      const trade: Trade = {
        id: `trade-${this.tradeCounter++}`,
        timestamp: this.snapshot.elapsedSeconds,
        instrument: this.snapshot.options.instrument.symbol,
        side: outcome.side,
        price: outcome.price,
        sizeM: outcome.sizeM,
        source: 'client',
        clientName: rfq.clientName,
        rfqId: rfq.id,
        commission: outcome.commission,
        executionCost: 0,
        stale: outcome.stale,
        referenceMid: this.snapshot.market.mid,
        clientPriceEdgePnl: (outcome.side === 'buy' ? this.snapshot.market.mid - outcome.price : outcome.price - this.snapshot.market.mid) * outcome.sizeM * this.snapshot.options.instrument.pnlMultiplier,
      }
      this.recordTrade(trade)
      this.snapshot.metrics.quotesAccepted += 1
      this.snapshot.metrics.clientTrades += 1
      if (outcome.stale) this.snapshot.metrics.staleQuotes += 1
      this.pendingMarkouts.push({
        tradeId: trade.id,
        dueAt: this.snapshot.elapsedSeconds + 5,
      })
      const impulse = estimateAdverseSelectionImpulsePips(
        outcome,
        client,
        this.flowRng,
      )
      addExternalImpulse(this.marketState, impulse)
      this.addEvent(
        'client',
        `${rfq.clientName} ${outcome.side === 'sell' ? 'buys from your offer' : 'sells to your bid'}`,
        `${formatInstrumentSize(outcome.sizeM, this.snapshot.options.instrument)} at ${formatPrice(outcome.price, this.snapshot.options.instrument.priceDecimals)} · commission ${formatInstrumentMoney(outcome.commission, this.snapshot.options.instrument)}.`,
        outcome.stale ? 'warning' : 'positive',
      )
    } else {
      this.addEvent(
        'client',
        `${rfq.clientName} declines`,
        outcome.reason,
        'info',
      )
    }

    this.snapshot.activeRfq = undefined
    this.snapshot.pendingQuote = undefined
    this.snapshot.pendingDecisionAt = undefined
    this.nextRfqAt =
      this.snapshot.elapsedSeconds +
      nextRfqDelaySeconds(
        this.plan,
        this.snapshot.options.difficulty,
        this.flowRng,
      )
  }

  private processRfqExpiry(): void {
    const rfq = this.snapshot.activeRfq
    if (!rfq || this.snapshot.pendingQuote) return
    if (this.snapshot.elapsedSeconds < rfq.expiresAt) return

    this.snapshot.metrics.rfqsExpired += 1
    this.updateQuoteRecord(rfq.id, {
      rfq: { ...rfq, status: 'expired' },
    })
    this.addEvent(
      'client',
      `${rfq.clientName} RFQ expired`,
      'No price was returned before the client deadline.',
      'warning',
    )
    this.snapshot.activeRfq = undefined
    this.nextRfqAt =
      this.snapshot.elapsedSeconds +
      nextRfqDelaySeconds(
        this.plan,
        this.snapshot.options.difficulty,
        this.flowRng,
      )
  }

  private spawnRfqIfDue(): void {
    if (
      this.snapshot.activeRfq ||
      this.snapshot.pendingQuote ||
      this.snapshot.elapsedSeconds < this.nextRfqAt ||
      this.snapshot.remainingSeconds < 3
    ) {
      return
    }

    const rfq = createRfq(
      this.snapshot.elapsedSeconds,
      this.snapshot.market,
      this.snapshot.clients,
      this.plan,
      this.snapshot.options.difficulty,
      this.snapshot.options.instrument,
      this.flowRng,
    )
    this.snapshot.activeRfq = rfq
    this.snapshot.metrics.rfqsReceived += 1
    this.snapshot.quoteHistory.push({
      id: `quote-${rfq.id}`,
      rfq,
    })
    const requestHeadline =
      rfq.kind === 'two-way'
        ? `${rfq.clientName} requests a two-way price`
        : rfq.kind === 'limit-interest'
          ? `${rfq.clientName} shows a ${rfq.requestedSide === 'buy' ? 'buy' : 'sell'} limit`
          : `${rfq.clientName} requests ${rfq.requestedSide === 'buy' ? 'an offer' : 'a bid'}`
    const requestDetail =
      rfq.kind === 'limit-interest'
        ? `${formatInstrumentSize(rfq.sizeM, this.snapshot.options.instrument)} · limit ${rfq.limitPrice?.toFixed(this.snapshot.options.instrument.priceDecimals)}.`
        : `${formatInstrumentSize(rfq.sizeM, this.snapshot.options.instrument)}.`
    this.addEvent(
      'client',
      requestHeadline,
      requestDetail,
      'info',
    )
  }

  private processWorkingHedges(): void {
    for (const order of this.snapshot.workingHedges) {
      if (order.status !== 'working' || order.nextClipAt > this.snapshot.elapsedSeconds) continue

      if (order.strategy === 'liquidity-sensitive') {
        const topSize = order.side === 'buy'
          ? this.snapshot.market.orderBook[0]?.askSizeM ?? 0
          : this.snapshot.market.orderBook[0]?.bidSizeM ?? 0
        if (this.snapshot.market.liquidity < 0.42 || topSize < Math.min(order.clipSizeM, order.remainingM) * 0.45) {
          order.nextClipAt = this.snapshot.elapsedSeconds + 1
          continue
        }
      }

      const beforeTrades = this.snapshot.trades.length
      const clip = Math.min(order.clipSizeM, order.remainingM)
      this.hedgeMarket(order.side, clip, 'worked-hedge', order.strategy)
      if (this.snapshot.trades.length > beforeTrades) {
        const trade = this.snapshot.trades[this.snapshot.trades.length - 1]
        const priorExecuted = order.executedM
        const nextExecuted = priorExecuted + trade.sizeM
        order.averageExecutionPrice = nextExecuted > 0 ? ((order.averageExecutionPrice * priorExecuted) + trade.price * trade.sizeM) / nextExecuted : 0
        order.executedM = nextExecuted
        order.executionCost += trade.executionCost
        order.marketImpactCost += trade.marketImpactCost ?? 0
        order.remainingM = Math.max(0, order.remainingM - trade.sizeM)
        this.snapshot.metrics.workedHedgeVolumeM += trade.sizeM
      }
      if (order.remainingM <= 1e-9) {
        order.status = 'completed'
        this.addEvent('market', 'Worked hedge complete', `${formatInstrumentSize(order.totalSizeM, this.snapshot.options.instrument)} executed.`, 'positive')
      } else {
        order.nextClipAt = this.snapshot.elapsedSeconds + order.intervalSeconds
      }
    }
  }

  private processPassiveOrders(dt: number): void {
    for (const order of this.snapshot.passiveOrders) {
      if (order.status !== 'working') continue
      const marketable =
        order.side === 'buy'
          ? this.snapshot.market.ask <= order.price
          : this.snapshot.market.bid >= order.price
      const nearTouch =
        order.side === 'buy'
          ? this.snapshot.market.bid <= order.price
          : this.snapshot.market.ask >= order.price
      const baseProbability = marketable
        ? 0.8
        : nearTouch
          ? 0.12 * this.snapshot.market.liquidity
          : 0
      const queueAdjusted = baseProbability * (1 - order.queuePosition * 0.55)
      if (!this.flowRng.chance(1 - Math.exp(-queueAdjusted * dt))) continue

      const fillFraction = marketable ? 1 : this.flowRng.range(0.35, 0.8)
      const fillSize = Math.min(order.remainingM, Math.max(0.5, order.remainingM * fillFraction))
      const trade: Trade = {
        id: `trade-${this.tradeCounter++}`,
        timestamp: this.snapshot.elapsedSeconds,
        instrument: this.snapshot.options.instrument.symbol,
        side: order.side,
        price: order.price,
        sizeM: fillSize,
        source: 'passive-hedge',
        commission: 0,
        executionCost: 0,
      }
      this.recordTrade(trade)
      this.snapshot.metrics.hedgeTrades += 1
      order.remainingM = Math.max(0, order.remainingM - fillSize)
      if (order.remainingM <= 0.01) order.status = 'filled'
      this.addEvent(
        'market',
        `Passive ${order.side} filled`,
        `${formatInstrumentSize(fillSize, this.snapshot.options.instrument)} at ${formatPrice(order.price, this.snapshot.options.instrument.priceDecimals)}.`,
        'positive',
      )
    }
  }

  private processMarkouts(): void {
    const due = this.pendingMarkouts.filter(
      (item) => item.dueAt <= this.snapshot.elapsedSeconds,
    )
    if (due.length === 0) return

    for (const item of due) {
      const trade = this.snapshot.trades.find((candidate) => candidate.id === item.tradeId)
      if (!trade) continue
      const signedQuantity = trade.side === 'buy' ? trade.sizeM : -trade.sizeM
      const markout =
        (this.snapshot.market.mid - trade.price) * signedQuantity * this.snapshot.options.instrument.pnlMultiplier
      trade.markoutPnl = markout
      this.snapshot.metrics.adverseSelectionPnl += markout
    }
    this.pendingMarkouts = this.pendingMarkouts.filter(
      (item) => item.dueAt > this.snapshot.elapsedSeconds,
    )
  }

  private updateRiskMetrics(dt: number): void {
    const absInventory = Math.abs(this.snapshot.position.quantityM)
    this.snapshot.metrics.maximumInventoryM = Math.max(
      this.snapshot.metrics.maximumInventoryM,
      absInventory,
    )
    this.snapshot.metrics.inventorySeconds += absInventory
    this.snapshot.metrics.inventorySamples += 1

    const aboveSoft = absInventory > this.snapshot.softLimitM
    if (aboveSoft && !this.wasAboveSoftLimit) {
      this.snapshot.metrics.softLimitBreaches += 1
      this.addEvent(
        'risk',
        'Soft inventory limit breached',
        `${formatInstrumentSize(absInventory, this.snapshot.options.instrument)} versus ${formatInstrumentSize(this.snapshot.softLimitM, this.snapshot.options.instrument)} soft limit.`,
        'warning',
      )
    }
    this.wasAboveSoftLimit = aboveSoft

    const aboveHard = absInventory > this.snapshot.hardLimitM
    if (aboveHard && !this.wasAboveHardLimit) {
      this.snapshot.metrics.hardLimitBreaches += 1
      this.addEvent(
        'risk',
        'Hard inventory limit breached',
        'DealerSim has forced a full market liquidation.',
        'critical',
      )
      const liquidationSide: TradeSide =
        this.snapshot.position.quantityM > 0 ? 'sell' : 'buy'
      this.snapshot.metrics.forcedLiquidations += 1
      this.hedgeMarket(
        liquidationSide,
        Math.abs(this.snapshot.position.quantityM),
        'forced-liquidation',
      )
      // Forced liquidation mutates the position inside the risk pass. Keep the
      // displayed equity synchronised immediately rather than waiting for the
      // next market tick.
      this.snapshot.currentEquity = netTradingPnl(this.snapshot.position)
    }
    this.wasAboveHardLimit = aboveHard

    const equity = netTradingPnl(this.snapshot.position)
    this.snapshot.metrics.peakEquity = Math.max(
      this.snapshot.metrics.peakEquity,
      equity,
    )
    const drawdown = this.snapshot.metrics.peakEquity - equity
    this.snapshot.metrics.maximumDrawdown = Math.max(
      this.snapshot.metrics.maximumDrawdown,
      drawdown,
    )

    void dt
  }

  private samplePrice(): void {
    if (this.snapshot.elapsedSeconds - this.lastPriceSampleAt < 0.5) return
    this.lastPriceSampleAt = this.snapshot.elapsedSeconds
    const point = toPricePoint(this.snapshot.market)
    this.snapshot.priceHistory.push(point)
    if (this.snapshot.priceHistory.length > 2200) {
      this.snapshot.priceHistory.splice(0, this.snapshot.priceHistory.length - 2200)
    }
  }

  private recordTrade(trade: Trade): void {
    const oldQuantity = this.snapshot.position.quantityM
    const signedQuantity = trade.side === 'buy' ? trade.sizeM : -trade.sizeM
    if (trade.source === 'client') {
      this.snapshot.metrics.grossClientVolumeM += trade.sizeM
      this.snapshot.metrics.clientPriceEdgePnl += trade.clientPriceEdgePnl ?? 0
      const clientWasBuying = trade.side === 'sell'
      if (clientWasBuying) this.snapshot.metrics.clientBuyVolumeM += trade.sizeM
      else this.snapshot.metrics.clientSellVolumeM += trade.sizeM
      if (oldQuantity !== 0 && Math.sign(oldQuantity) !== Math.sign(signedQuantity)) {
        const internalised = Math.min(Math.abs(oldQuantity), trade.sizeM)
        trade.internalisedSizeM = internalised
        this.snapshot.metrics.internalisedVolumeM += internalised
      }
      const client = trade.rfqId ? this.snapshot.clients.find((item) => item.id === this.snapshot.quoteHistory.find((record) => record.rfq.id === trade.rfqId)?.rfq.clientId) : undefined
      if (client) {
        const clientDirection = clientWasBuying ? 1 : -1
        client.directionalBias = Math.max(-0.9, Math.min(0.9, client.directionalBias * 0.78 + clientDirection * (0.16 + client.persistence * 0.18)))
        for (const peer of this.snapshot.clients) {
          if (peer.id !== client.id && peer.type === client.type) peer.directionalBias = Math.max(-0.9, Math.min(0.9, peer.directionalBias * 0.96 + clientDirection * 0.025 * client.persistence))
        }
      }
    } else {
      if (trade.source === 'interdealer-hedge') this.snapshot.metrics.interdealerHedgeVolumeM += trade.sizeM
      else this.snapshot.metrics.exchangeHedgeVolumeM += trade.sizeM
      this.snapshot.metrics.marketImpactCost += trade.marketImpactCost ?? 0
      this.snapshot.metrics.exchangeSlippageCost += trade.exchangeSlippageCost ?? 0
    }

    this.snapshot.position = applyTrade(
      this.snapshot.position,
      trade,
      this.snapshot.market.mid,
      this.snapshot.options.instrument,
    )
    this.snapshot.trades.push(trade)
    if (this.snapshot.trades.length > 500) {
      this.snapshot.trades.splice(0, this.snapshot.trades.length - 500)
    }
  }

  private finish(reason: string): void {
    this.snapshot.status = 'finished'
    this.snapshot.activeRfq = undefined
    this.snapshot.pendingQuote = undefined
    this.snapshot.pendingDecisionAt = undefined
    this.snapshot.position = markPosition(
      this.snapshot.position,
      this.snapshot.market.mid,
      this.snapshot.options.instrument,
    )
    this.snapshot.currentEquity = netTradingPnl(this.snapshot.position)
    this.addEvent('system', reason, 'Session analytics are ready.', 'positive')
    this.snapshot.score = computeScore(this.snapshot)
  }

  private findClient(clientId: string): ClientProfile {
    const client = this.snapshot.clients.find((item) => item.id === clientId)
    if (!client) throw new Error(`Unknown client ${clientId}`)
    return client
  }

  private addEvent(
    category: EventItem['category'],
    headline: string,
    detail: string,
    severity: EventItem['severity'],
  ): void {
    this.snapshot.events.unshift({
      id: `event-${this.eventCounter++}`,
      timestamp: this.snapshot.elapsedSeconds,
      headline,
      detail,
      severity,
      category,
    })
    if (this.snapshot.events.length > 160) {
      this.snapshot.events.length = 160
    }
  }

  private updateQuoteRecord(
    rfqId: string,
    update: Partial<QuoteRecord>,
  ): void {
    const index = this.snapshot.quoteHistory.findIndex(
      (record) => record.rfq.id === rfqId,
    )
    if (index >= 0) {
      this.snapshot.quoteHistory[index] = {
        ...this.snapshot.quoteHistory[index],
        ...update,
      }
    } else if (update.rfq) {
      this.snapshot.quoteHistory.push({
        id: `quote-${rfqId}`,
        rfq: update.rfq,
        submission: update.submission,
        outcome: update.outcome,
      })
    }
    if (this.snapshot.quoteHistory.length > 300) {
      this.snapshot.quoteHistory.splice(
        0,
        this.snapshot.quoteHistory.length - 300,
      )
    }
  }
}

function createEmptyMetrics(): SessionMetrics {
  return {
    rfqsReceived: 0,
    quotesSubmitted: 0,
    quotesAccepted: 0,
    rfqsExpired: 0,
    rfqsPassed: 0,
    staleQuotes: 0,
    fatFingerFlags: 0,
    clientTrades: 0,
    hedgeTrades: 0,
    forcedLiquidations: 0,
    softLimitBreaches: 0,
    hardLimitBreaches: 0,
    maximumInventoryM: 0,
    inventorySeconds: 0,
    inventorySamples: 0,
    adverseSelectionPnl: 0,
    totalQuotedSpreadPips: 0,
    quoteSpreadSamples: 0,
    totalResponseTime: 0,
    responseSamples: 0,
    peakEquity: 0,
    maximumDrawdown: 0,
    startEquity: 0,
    grossClientVolumeM: 0,
    exchangeHedgeVolumeM: 0,
    interdealerHedgeVolumeM: 0,
    internalisedVolumeM: 0,
    workedHedgeVolumeM: 0,
    marketImpactCost: 0,
    clientBuyVolumeM: 0,
    clientSellVolumeM: 0,
    clientPriceEdgePnl: 0,
    exchangeSlippageCost: 0,
  }
}

function toPricePoint(market: SessionSnapshot['market']): PricePoint {
  return {
    t: market.timestamp,
    mid: market.mid,
    bid: market.bid,
    ask: market.ask,
  }
}

function cloneMarket(market: SessionSnapshot['market']): SessionSnapshot['market'] {
  return {
    ...market,
    orderBook: market.orderBook.map((level) => ({ ...level })),
  }
}

function formatReleaseValue(value: number, unit?: string): string {
  if (unit === 'k') return `${Math.round(value)}k`
  if (unit === 'm bbl') return `${value >= 0 ? '+' : ''}${value.toFixed(1)}m bbl`
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'σ') return `${value.toFixed(1)}σ`
  return value.toFixed(1)
}

function formatPrice(value: number, decimals: number): string {
  return value.toFixed(decimals)
}

function formatInstrumentMoney(value: number, instrument: SessionOptions['instrument']): string {
  const symbol =
    instrument.quoteCurrency === 'EUR'
      ? '€'
      : instrument.quoteCurrency === 'GBP'
        ? '£'
        : instrument.quoteCurrency === 'JPY'
          ? '¥'
          : '$'
  const sign = value < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(value).toLocaleString('en-GB', {
    maximumFractionDigits: 0,
  })}`
}

function formatInstrumentSize(sizeM: number, instrument: SessionOptions['instrument']): string {
  return `${instrument.sizePrefix}${sizeM.toLocaleString('en-GB', {
    maximumFractionDigits: instrument.sizeStepM < 1 ? 1 : 0,
  })}${instrument.sizeSuffix}`
}

function formatCountdown(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}
