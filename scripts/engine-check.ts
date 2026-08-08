import { APEX_EQUITY, BRENT_FUTURE, BUND_FUTURE, DIFFICULTY_PROFILES, EQUITY_INSTRUMENTS, EUR_USD, INSTRUMENTS, LUMA_EQUITY, MACRO_FUTURES, MEGA_EQUITY, NOVA_EQUITY, ORBX_EQUITY, SP500_FUTURE, getInstrumentTrainingProfile } from '../src/engine/config'
import { emptyPosition, applyTrade, estimateBlockExecution, netTradingPnl } from '../src/engine/accounting'
import { DealerSimEngine } from '../src/engine/session'
import { MultiDealerSimEngine } from '../src/engine/multi-session'
import { applyAggressiveExecutionImpact, createMarketState, createOrderBook, createScenarioPlan, toMarketSnapshot } from '../src/engine/market'
import { createClientBook, createRfq, resolveQuote } from '../src/engine/rfq'
import { SeededRandom } from '../src/engine/random'
import { MacroPortfolioEngine } from '../src/engine/macro'
import { EquityFundEngine } from '../src/engine/fund'
import { LiveMacroEngine } from '../src/engine/live-macro'
import type { ClientProfile, QuoteSubmission, Rfq, ScenarioFamily, Trade } from '../src/types'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function accountingChecks(): void {
  let position = emptyPosition()
  const buy: Trade = {
    id: 't1',
    timestamp: 0,
    instrument: 'EUR/USD',
    side: 'buy',
    price: 1.1,
    sizeM: 10,
    source: 'client',
    commission: 200,
    executionCost: 0,
  }
  position = applyTrade(position, buy, 1.1, EUR_USD)
  assert(position.quantityM === 10, 'Buy should create a long position')
  assert(position.averagePrice === 1.1, 'Average price should equal the opening trade')

  const sell: Trade = {
    ...buy,
    id: 't2',
    side: 'sell',
    price: 1.101,
    sizeM: 4,
    commission: 100,
  }
  position = applyTrade(position, sell, 1.101, EUR_USD)
  assert(position.quantityM === 6, 'Partial sale should reduce the long position')
  assert(Math.abs(position.realisedPnl - 4000) < 0.001, 'Realised P&L should be calculated in quote currency')
  assert(netTradingPnl(position) > 4300, 'Commission and P&L should both contribute to equity')
}

function instrumentArchitectureCheck(): void {
  const instruments = Object.values(INSTRUMENTS)
  for (const [index, instrument] of instruments.entries()) {
    const engine = new DealerSimEngine({
      seed: 9100 + index,
      scenario: 'balanced',
      difficulty: 'learning',
      durationSeconds: 8,
      instrument,
    })
    engine.start()
    for (let tick = 0; tick < 40; tick += 1) engine.tick(0.2)
    const snapshot = engine.getSnapshot()
    assert(snapshot.options.instrument.id === instrument.id, `${instrument.symbol} should retain its instrument configuration`)
    assert(snapshot.market.orderBook.length === instrument.orderBookLevels, `${instrument.symbol} should generate configured depth levels`)
  }

  const opening: Trade = {
    id: 'bund-open',
    timestamp: 0,
    instrument: BUND_FUTURE.symbol,
    side: 'buy',
    price: 132.5,
    sizeM: 10,
    source: 'client',
    commission: 0,
    executionCost: 0,
  }
  let bundPosition = applyTrade(emptyPosition(), opening, 132.5, BUND_FUTURE)
  bundPosition = applyTrade(
    bundPosition,
    { ...opening, id: 'bund-close', side: 'sell', price: 132.51 },
    132.51,
    BUND_FUTURE,
  )
  assert(Math.abs(bundPosition.realisedPnl - 100) < 0.001, 'Bund tick-value accounting should use the instrument multiplier')
}


function equityBlockCheck(): void {
  const engine = new DealerSimEngine({
    seed: 40404,
    scenario: 'balanced',
    difficulty: 'learning',
    durationSeconds: 45,
    instrument: APEX_EQUITY,
  })
  engine.start()
  for (let index = 0; index < 20; index += 1) engine.tick(0.2)
  let snapshot = engine.getSnapshot()
  assert(snapshot.market.orderBook.length === 8, 'APEX should expose eight order-book levels')
  assert(snapshot.market.participantCount >= 28, 'APEX should show a populated market')

  const small = estimateBlockExecution('buy', 3, snapshot.market.orderBook, snapshot.market, APEX_EQUITY)
  const large = estimateBlockExecution('buy', 18, snapshot.market.orderBook, snapshot.market, APEX_EQUITY)
  const oversized = estimateBlockExecution('buy', Math.min(APEX_EQUITY.maximumSizeM, snapshot.market.displayedDepthM * 1.5), snapshot.market.orderBook, snapshot.market, APEX_EQUITY)
  assert(large.levelsConsumed >= small.levelsConsumed, 'A larger block should consume at least as much depth')
  assert(large.implementationShortfall > small.implementationShortfall, 'A larger block should carry greater implementation shortfall')
  assert(oversized.temporaryImpactPips > large.temporaryImpactPips, 'A block larger than displayed depth should create more temporary impact than an ordinary block')

  engine.hedgeMarket('buy', 18)
  const afterSweep = engine.getSnapshot()
  assert(afterSweep.metrics.marketImpactCost > 0, 'An aggressive APEX hedge should record market-impact cost')

  engine.startWorkingHedge('sell', 8, 'twap', 2, 1)
  for (let index = 0; index < 35; index += 1) engine.tick(0.2)
  snapshot = engine.getSnapshot()
  assert(snapshot.metrics.workedHedgeVolumeM > 0, 'A worked hedge should execute clips over time')
}


function multiEquityCalibrationCheck(): void {
  assert(EQUITY_INSTRUMENTS.length === 6, 'Six individually selectable equity markets should be configured')
  assert(MEGA_EQUITY.depthScale > APEX_EQUITY.depthScale, 'MEGA should have deeper displayed liquidity than APEX')
  assert(NOVA_EQUITY.depthScale < APEX_EQUITY.depthScale, 'NOVA should have thinner displayed liquidity than APEX')
  assert(NOVA_EQUITY.impactCoefficientPips > APEX_EQUITY.impactCoefficientPips, 'NOVA should carry higher market impact')
  assert(MEGA_EQUITY.impactCoefficientPips < APEX_EQUITY.impactCoefficientPips, 'MEGA should carry lower market impact')
  assert(NOVA_EQUITY.volatilityScale > MEGA_EQUITY.volatilityScale, 'NOVA should be more volatile than MEGA')
  assert(LUMA_EQUITY.depthScale < NOVA_EQUITY.depthScale, 'LUMA should be thinner than NOVA')
  assert(ORBX_EQUITY.depthScale < LUMA_EQUITY.depthScale, 'ORBX should be the shallowest equity book')
  assert(LUMA_EQUITY.impactCoefficientPips > NOVA_EQUITY.impactCoefficientPips, 'LUMA should carry stronger block impact than NOVA')
  assert(ORBX_EQUITY.impactCoefficientPips > LUMA_EQUITY.impactCoefficientPips, 'ORBX should carry the strongest equity market impact')
  assert(ORBX_EQUITY.impactRecoverySeconds > LUMA_EQUITY.impactRecoverySeconds, 'ORBX liquidity should recover more slowly than LUMA')

  for (const [index, instrument] of EQUITY_INSTRUMENTS.entries()) {
    const profile = instrument.equityProfile
    assert(profile !== undefined, `${instrument.symbol} should have an equity training profile`)
    assert(profile.typicalRfqMaxM > profile.typicalRfqMinM, `${instrument.symbol} should have a valid RFQ range`)
    assert(profile.scheduledCompanyHeadlines.length >= 2, `${instrument.symbol} should have company-specific scheduled news`)
    assert(profile.surpriseCompanyHeadlines.length >= 2, `${instrument.symbol} should have company-specific surprise news`)

    const rng = new SeededRandom(55000 + index)
    const plan = createScenarioPlan('balanced', 'standard', 900, instrument, rng)
    const state = createMarketState(instrument, plan, 'standard', rng)
    const book = createOrderBook(state, instrument, rng)
    const market = toMarketSnapshot(state, instrument, book)
    const clients = createClientBook('standard', 'balanced', instrument, rng)
    let inTypicalRange = 0
    const sampleSize = 40
    for (let n = 0; n < sampleSize; n += 1) {
      const rfq = createRfq(n * 20, market, clients, plan, 'standard', instrument, rng)
      if (rfq.sizeM >= profile.typicalRfqMinM && rfq.sizeM <= profile.typicalRfqMaxM) inTypicalRange += 1
    }
    assert(inTypicalRange >= 30, `${instrument.symbol} should keep most RFQs inside its stated typical range`)
  }
}


function macroFuturesCalibrationCheck(): void {
  assert(MACRO_FUTURES.length === 3, 'Rates, commodities and equity-index futures should all be selectable')
  assert(BUND_FUTURE.unitsPerSize === 1_000, 'Bund notional should use the €1,000 price-point contract convention')
  assert(BRENT_FUTURE.unitsPerSize === 1_000, 'Brent should represent 1,000 barrels per contract')
  assert(SP500_FUTURE.unitsPerSize === 50, 'ES should use the $50 index-point contract multiplier for notional')
  assert(BUND_FUTURE.depthScale > BRENT_FUTURE.depthScale, 'Bund should be deeper than Brent in the training calibration')
  assert(BRENT_FUTURE.impactCoefficientPips > BUND_FUTURE.impactCoefficientPips, 'Brent should carry more execution impact than Bund')
  assert(SP500_FUTURE.impactRecoverySeconds < BRENT_FUTURE.impactRecoverySeconds, 'ES liquidity should replenish faster than Brent in normal conditions')

  {
    const rng = new SeededRandom(76111)
    const plan = createScenarioPlan('balanced', 'learning', 900, SP500_FUTURE, rng)
    const state = createMarketState(SP500_FUTURE, plan, 'learning', rng)
    const book = createOrderBook(state, SP500_FUTURE, rng)
    const market = toMarketSnapshot(state, SP500_FUTURE, book)
    const smallBuy = estimateBlockExecution('buy', 20, book, market, SP500_FUTURE)
    const smallSell = estimateBlockExecution('sell', 20, book, market, SP500_FUTURE)
    const largeBuy = estimateBlockExecution('buy', 200, book, market, SP500_FUTURE)
    const largeSell = estimateBlockExecution('sell', 200, book, market, SP500_FUTURE)
    const smallSpread = (smallBuy.directVwap - smallSell.directVwap) / SP500_FUTURE.pipSize
    const largeSpread = (largeBuy.directVwap - largeSell.directVwap) / SP500_FUTURE.pipSize
    assert(largeSpread > smallSpread, 'The executable ES spread should widen as requested market size consumes more depth')
  }

  for (const [index, instrument] of MACRO_FUTURES.entries()) {
    const profile = getInstrumentTrainingProfile(instrument)
    assert(profile !== undefined, `${instrument.symbol} should have a training profile`)
    assert(profile.scheduledHeadlines.length >= 3, `${instrument.symbol} should have instrument-specific scheduled news`)
    assert(profile.surpriseHeadlines.length >= 3, `${instrument.symbol} should have instrument-specific surprise news`)

    const rng = new SeededRandom(76000 + index)
    const plan = createScenarioPlan('balanced', 'standard', 900, instrument, rng)
    const state = createMarketState(instrument, plan, 'standard', rng)
    const book = createOrderBook(state, instrument, rng)
    const market = toMarketSnapshot(state, instrument, book)
    const clients = createClientBook('standard', 'balanced', instrument, rng)
    let inTypicalRange = 0
    const sampleSize = 40
    for (let n = 0; n < sampleSize; n += 1) {
      const rfq = createRfq(n * 20, market, clients, plan, 'standard', instrument, rng)
      if (rfq.sizeM >= profile.typicalRfqMinM && rfq.sizeM <= profile.typicalRfqMaxM) inTypicalRange += 1
    }
    assert(inTypicalRange >= 30, `${instrument.symbol} should keep most RFQs inside its stated contract range`)
    assert(plan.events.some((event) => event.announceAt !== undefined), `${instrument.symbol} should always include scheduled news`)
  }
}


function liquidityMicrostructureCheck(): void {
  const rng = new SeededRandom(111100)
  const plan = createScenarioPlan('balanced', 'learning', 900, ORBX_EQUITY, rng)
  const state = createMarketState(ORBX_EQUITY, plan, 'learning', rng)
  let book = createOrderBook(state, ORBX_EQUITY, rng)
  let market = toMarketSnapshot(state, ORBX_EQUITY, book)
  const openingSpread = market.spreadPips
  const visibleSideDepth = book.reduce((total, level) => total + level.bidSizeM, 0)
  const size = Math.min(ORBX_EQUITY.maximumSizeM, Math.max(ORBX_EQUITY.minimumSizeM, visibleSideDepth * 0.9))
  const estimate = estimateBlockExecution('sell', size, book, market, ORBX_EQUITY)
  assert(estimate.participationRate > 0.4, 'Large ORBX hedge should represent meaningful book participation')
  assert(market.hiddenLiquidityShare > 0, 'Central-book snapshot should include uncertain hidden-liquidity capacity')

  const engine = new DealerSimEngine({ seed: 111101, scenario: 'balanced', difficulty: 'learning', durationSeconds: 120, instrument: ORBX_EQUITY })
  engine.start()
  const before = engine.getSnapshot().market
  const aggressiveSize = Math.min(ORBX_EQUITY.maximumSizeM, before.orderBook.reduce((total, level) => total + level.bidSizeM, 0) * 0.85)
  engine.hedgeMarket('sell', aggressiveSize)
  engine.tick(0.2)
  const after = engine.getSnapshot().market
  assert(after.spreadPips >= before.spreadPips, 'Aggressive ORBX execution should not tighten the displayed spread immediately')
  assert(after.cancellationPressure > 0, 'Aggressive execution should cause simulated liquidity-provider cancellations')
  assert(after.recentParticipation > 0, 'Market should remember recent aggressive participation')
  assert(after.bookImbalance < 0, 'Aggressive selling should leave the book ask-heavy / bid-light')
  assert(after.liquidityRegime === 'thin' || after.liquidityRegime === 'stressed', 'Large ORBX execution should push liquidity into a thin or stressed regime')

  const beforeRecoverySpread = after.spreadPips
  for (let i = 0; i < 400; i += 1) engine.tick(0.2)
  const recovered = engine.getSnapshot().market
  assert(recovered.cancellationPressure < after.cancellationPressure, 'Cancellation pressure should decay as liquidity providers return')
  assert(recovered.spreadPressurePips < after.spreadPressurePips, 'Execution-driven spread pressure should decay over time')
  assert(recovered.spreadPips <= Math.max(beforeRecoverySpread, openingSpread + 4), 'Spread should broadly recover after the impact window')


  const leakRng = new SeededRandom(111102)
  const leakPlan = createScenarioPlan('balanced', 'learning', 900, LUMA_EQUITY, leakRng)
  const twapState = createMarketState(LUMA_EQUITY, leakPlan, 'learning', leakRng)
  const smartState = createMarketState(LUMA_EQUITY, leakPlan, 'learning', new SeededRandom(111102))
  for (let n = 0; n < 4; n += 1) {
    twapState.elapsed = n * 4
    smartState.elapsed = n * 4
    applyAggressiveExecutionImpact(twapState, 'sell', 2.2, 0.35, LUMA_EQUITY, 'twap')
    applyAggressiveExecutionImpact(smartState, 'sell', 2.2, 0.35, LUMA_EQUITY, 'liquidity-sensitive')
  }
  assert(twapState.repetitiveFlowPressure > smartState.repetitiveFlowPressure, 'Predictable TWAP clips should leak more information than liquidity-sensitive execution')
  assert(twapState.spreadPressurePips > smartState.spreadPressurePips, 'Pattern leakage should make later TWAP footprint more expensive')
}

function determinismCheck(): void {
  const options = {
    seed: 20260806,
    scenario: 'balanced' as const,
    difficulty: 'standard' as const,
    durationSeconds: 60,
    instrument: EUR_USD,
  }
  const a = new DealerSimEngine(options)
  const b = new DealerSimEngine(options)
  a.start()
  b.start()
  for (let index = 0; index < 100; index += 1) {
    a.tick(0.25)
    b.tick(0.25)
  }
  const snapshotA = a.getSnapshot()
  const snapshotB = b.getSnapshot()
  assert(snapshotA.market.mid === snapshotB.market.mid, 'Same seed must produce the same market path')
  assert(snapshotA.activeRfq?.sizeM === snapshotB.activeRfq?.sizeM, 'Same seed must produce the same RFQ flow')
}


function timingCalibrationCheck(): void {
  assert(DIFFICULTY_PROFILES.learning.rfqTimeMin === 20, 'Learning RFQs should allow at least 20 seconds before client urgency adjustment')
  assert(DIFFICULTY_PROFILES.standard.rfqTimeMin === 14, 'Standard RFQs should allow at least 14 seconds before client urgency adjustment')
  assert(DIFFICULTY_PROFILES.advanced.rfqTimeMin === 9, 'Advanced RFQs should retain meaningful time pressure')
  assert(DIFFICULTY_PROFILES.assessment.rfqTimeMin === 6, 'Assessment RFQs should remain the fastest mode')
}

function newsCoverageCheck(): void {
  const scenarios: Exclude<ScenarioFamily, 'random'>[] = [
    'balanced',
    'one-way',
    'fast-market',
    'illiquid',
    'news-shock',
    'toxic-flow',
  ]

  for (const [index, scenario] of scenarios.entries()) {
    const plan = createScenarioPlan(scenario, 'standard', 900, EUR_USD, new SeededRandom(8800 + index))
    assert(plan.events.length >= 1, `${scenario} should include at least one news or market event`)
    assert(
      plan.events.some((event) => event.announceAt !== undefined),
      `${scenario} should include a scheduled macro-calendar event`,
    )
  }
}


function dualMarketCheck(): void {
  const engine = new MultiDealerSimEngine({
    seed: 707070,
    scenario: 'balanced',
    difficulty: 'standard',
    durationSeconds: 180,
    instruments: [MEGA_EQUITY, SP500_FUTURE],
  })
  engine.start()
  let sawOverlap = false
  for (let index = 0; index < 920; index += 1) {
    const snapshot = engine.tick(0.2)
    if (snapshot.legs.every((leg) => Boolean(leg.activeRfq))) sawOverlap = true
    for (const leg of snapshot.legs) {
      if (leg.activeRfq && !leg.pendingQuote) {
        engine.submitQuote(leg.options.instrument.id, leg.market.bid, leg.market.ask)
      }
    }
    if (snapshot.status === 'finished') break
  }
  const finalSnapshot = engine.getSnapshot()
  assert(finalSnapshot.legs.length === 2, 'Dual-market mode should maintain two live instrument legs')
  assert(finalSnapshot.status === 'finished', 'Dual-market session should finish at the configured duration')
  assert(finalSnapshot.events.some((event) => event.category === 'news' && event.severity === 'critical'), 'Dual-market mode should trigger shared macro news')
  assert(finalSnapshot.score !== undefined, 'Dual-market session should produce a portfolio score')
  assert(finalSnapshot.portfolio.rfqsReceived > 0, 'Dual-market mode should receive RFQs across the desk')
  assert(finalSnapshot.portfolio.peakGrossRiskUtilisation >= 0, 'Dual-market portfolio risk should be tracked')
  assert(sawOverlap, 'Dual-market mode should produce overlapping RFQ windows for the verification seed')
}

function crossAssetFactorAndTripleDeskCheck(): void {
  const engine = new MultiDealerSimEngine({
    seed: 808080,
    scenario: 'news-shock',
    difficulty: 'standard',
    durationSeconds: 120,
    instruments: [MEGA_EQUITY, NOVA_EQUITY, SP500_FUTURE],
  })
  engine.start()
  let sawReleasedCalendar = false
  let sawFactorMovement = false
  for (let index = 0; index < 700; index += 1) {
    const snapshot = engine.tick(0.2)
    if (snapshot.calendar.some((event) => event.status === 'released')) sawReleasedCalendar = true
    if (Object.values(snapshot.factors).some((value) => Math.abs(value) > 0.02)) sawFactorMovement = true
    for (const leg of snapshot.legs) {
      if (leg.activeRfq && !leg.pendingQuote) engine.submitQuote(leg.options.instrument.id, leg.market.bid, leg.market.ask)
    }
    if (snapshot.status === 'finished') break
  }
  const finalSnapshot = engine.getSnapshot()
  assert(finalSnapshot.legs.length === 3, 'Three-market mode should maintain three live instrument legs')
  assert(sawReleasedCalendar, 'Three-market mode should release expectation-based macro data')
  assert(sawFactorMovement, 'Shared latent factors should evolve during the session')
  assert(finalSnapshot.flowSignals.length === 3, 'Client-flow signals should be available for every active market')
  assert(finalSnapshot.attribution !== undefined, 'Finished cross-asset sessions should produce P&L attribution')
  if (finalSnapshot.attribution) {
    const attributed = finalSnapshot.attribution.commission + finalSnapshot.attribution.clientPriceEdge + finalSnapshot.attribution.exchangeSlippage + finalSnapshot.attribution.marketImpact + finalSnapshot.attribution.inventoryAndTiming
    assert(Math.abs(attributed - finalSnapshot.attribution.netPnl) < 0.01, 'P&L attribution components should reconcile to net P&L')
  }
  assert(finalSnapshot.score !== undefined, 'Finished cross-asset sessions should produce a portfolio score')
}

function workedOrderControlCheck(): void {
  const engine = new DealerSimEngine({
    seed: 909090,
    scenario: 'balanced',
    difficulty: 'learning',
    durationSeconds: 90,
    instrument: APEX_EQUITY,
  })
  engine.start()
  engine.hedgeMarket('buy', 12)
  engine.startWorkingHedge('sell', 10, 'twap', 2, 5)
  let snapshot = engine.getSnapshot()
  const orderId = snapshot.workingHedges[0]?.id
  assert(Boolean(orderId), 'Worked hedge should be created')
  if (!orderId) return
  engine.pauseWorkingHedge(orderId)
  snapshot = engine.getSnapshot()
  assert(snapshot.workingHedges[0].status === 'paused', 'Worked hedge should pause')
  engine.modifyWorkingHedge(orderId, 3, 2)
  engine.resumeWorkingHedge(orderId)
  for (let index = 0; index < 20; index += 1) engine.tick(0.2)
  snapshot = engine.getSnapshot()
  assert(snapshot.workingHedges[0].executedM > 0, 'Resumed worked hedge should execute clips')
  engine.crossWorkingHedge(orderId)
  snapshot = engine.getSnapshot()
  assert(snapshot.workingHedges[0].status === 'completed' || snapshot.workingHedges[0].remainingM < 0.01, 'Cross remaining should finish the worked hedge')
}


function directionalRfqRealismCheck(): void {
  const instrument = APEX_EQUITY
  const rng = new SeededRandom(101010)
  const plan = createScenarioPlan('balanced', 'standard', 900, instrument, rng)
  const state = createMarketState(instrument, plan, 'standard', rng)
  const book = createOrderBook(state, instrument, rng)
  const market = toMarketSnapshot(state, instrument, book)
  const client: ClientProfile = {
    id: 'directional-client',
    name: 'Audit Capital',
    type: 'asset-manager',
    visibleLabel: 'Asset Manager',
    urgency: 0.55,
    priceSensitivity: 0.65,
    toxicity: 0.25,
    directionalBias: 0,
    persistence: 0.6,
    commissionPerMillion: 20,
    typicalSizeM: 10,
    sizeDispersion: 0.3,
  }
  const rfq: Rfq = {
    id: 'directional-buy',
    clientId: client.id,
    clientName: client.name,
    clientType: client.type,
    clientLabel: client.visibleLabel,
    kind: 'directional',
    requestedSide: 'buy',
    sizeM: 12,
    createdAt: 0,
    expiresAt: 20,
    status: 'open',
  }
  const offer = market.ask + instrument.pipSize
  const baseSubmission: QuoteSubmission = {
    rfqId: rfq.id,
    ask: offer,
    submittedAt: 2,
    marketAtSubmission: market,
  }
  const pollutedSubmission: QuoteSubmission = {
    ...baseSubmission,
    bid: market.bid - 50 * instrument.pipSize,
  }
  const cleanOutcome = resolveQuote(rfq, client, baseSubmission, market, plan, instrument, new SeededRandom(2020))
  const pollutedOutcome = resolveQuote(rfq, client, pollutedSubmission, market, plan, instrument, new SeededRandom(2020))
  assert(cleanOutcome.accepted === pollutedOutcome.accepted, 'Irrelevant bid must not change an offer-only RFQ outcome')
  assert(Math.abs(cleanOutcome.competitivenessPips - pollutedOutcome.competitivenessPips) < 1e-9, 'Directional competitiveness must depend only on the requested side')

  const aggressiveButFresh = resolveQuote(
    rfq,
    client,
    { ...baseSubmission, ask: market.ask - instrument.pipSize },
    market,
    plan,
    instrument,
    new SeededRandom(3030),
  )
  assert(!aggressiveButFresh.stale, 'A deliberately competitive fresh block offer must not be labelled stale without an adverse market move')

  const limitRfq: Rfq = {
    ...rfq,
    id: 'limit-buy',
    kind: 'limit-interest',
    limitPrice: market.ask,
  }
  const overLimit = resolveQuote(
    limitRfq,
    client,
    { ...baseSubmission, rfqId: limitRfq.id, ask: market.ask + instrument.pipSize },
    market,
    plan,
    instrument,
    new SeededRandom(4040),
  )
  assert(!overLimit.accepted && overLimit.reason.includes('limit'), 'Buy-limit interest must reject an offer above the client limit')
}


function dealerQaControlCheck(): void {
  const engine = new DealerSimEngine({
    seed: 1212001,
    scenario: 'balanced',
    difficulty: 'standard',
    durationSeconds: 90,
    instrument: APEX_EQUITY,
  })
  engine.start()
  let snapshot = engine.getSnapshot()
  const oversized = Math.min(APEX_EQUITY.maximumSizeM, snapshot.hardLimitM * 1.15)
  engine.hedgeMarket('buy', oversized)
  engine.tick(0.2)
  snapshot = engine.getSnapshot()
  assert(snapshot.metrics.hardLimitBreaches >= 1, 'Crossing the hard inventory limit should be detected')
  assert(snapshot.metrics.forcedLiquidations >= 1, 'A hard-limit breach should trigger forced liquidation')
  assert(Math.abs(snapshot.position.quantityM) < APEX_EQUITY.minimumSizeM + 1e-6, 'Forced liquidation should flatten the dealer inventory')

  const identity = snapshot.position.realisedPnl + snapshot.position.unrealisedPnl + snapshot.position.grossCommission - snapshot.position.hedgeCosts
  assert(Math.abs(identity - snapshot.currentEquity) < 0.01, 'Displayed net P&L should reconcile to realised + unrealised + commission - hedge costs')
}

function quoteAcceptanceCalibrationCheck(): void {
  const instrument = LUMA_EQUITY
  const rng = new SeededRandom(1212002)
  const plan = createScenarioPlan('balanced', 'standard', 900, instrument, rng)
  const state = createMarketState(instrument, plan, 'standard', rng)
  const book = createOrderBook(state, instrument, rng)
  const market = toMarketSnapshot(state, instrument, book)
  const client: ClientProfile = {
    id: 'calibration-client',
    name: 'Calibration Asset Management',
    type: 'asset-manager',
    visibleLabel: 'Asset Manager',
    urgency: 0.58,
    priceSensitivity: 0.68,
    toxicity: 0.28,
    directionalBias: 0,
    persistence: 0.7,
    commissionPerMillion: 20,
    typicalSizeM: 10,
    sizeDispersion: 0.3,
  }
  const rfq: Rfq = {
    id: 'calibration-rfq',
    clientId: client.id,
    clientName: client.name,
    clientType: client.type,
    clientLabel: client.visibleLabel,
    kind: 'directional',
    requestedSide: 'buy',
    sizeM: Math.min(12, instrument.maximumSizeM),
    createdAt: 0,
    expiresAt: 20,
    status: 'open',
  }
  const benchmark = estimateBlockExecution('buy', rfq.sizeM, book, market, instrument)
  const competitiveOffer = benchmark.impactAdjustedPrice - instrument.pipSize * 1.5
  const defensiveOffer = benchmark.impactAdjustedPrice + instrument.pipSize * 6
  let competitiveWins = 0
  let defensiveWins = 0
  for (let seed = 1; seed <= 180; seed += 1) {
    const base: QuoteSubmission = { rfqId: rfq.id, submittedAt: 2, marketAtSubmission: market }
    if (resolveQuote(rfq, client, { ...base, ask: competitiveOffer }, market, plan, instrument, new SeededRandom(seed)).accepted) competitiveWins += 1
    if (resolveQuote(rfq, client, { ...base, ask: defensiveOffer }, market, plan, instrument, new SeededRandom(seed)).accepted) defensiveWins += 1
  }
  assert(competitiveWins > defensiveWins + 20, 'Client acceptance should materially reward a more competitive block offer')
  assert(competitiveWins < 180, 'Even a competitive quote should not create guaranteed client acceptance')
}


function globalMacroPortfolioCheck(): void {
  const options = {
    seed: 220020,
    scenario: 'inflation-resurgence' as const,
    difficulty: 'learning' as const,
    days: 30,
    initialNav: 100_000_000,
  }
  const a = new MacroPortfolioEngine(options)
  const b = new MacroPortfolioEngine(options)
  const intent = {
    assetId: 'es-macro' as const,
    targetWeight: -0.10,
    tag: 'inflation' as const,
    horizon: 'weeks' as const,
    conviction: 4,
    invalidation: 'Inflation normalises and policy pricing reverses materially.',
  }
  assert(a.executeTarget(intent).accepted, 'Global Macro engine should accept a mandate-compliant target weight')
  assert(b.executeTarget(intent).accepted, 'Deterministic comparison engine should accept the same trade')
  assert(a.executeTarget({ ...intent, assetId: 'ty-macro', targetWeight: -0.08 }).accepted, 'Global Macro engine should support cross-asset positions')
  assert(b.executeTarget({ ...intent, assetId: 'ty-macro', targetWeight: -0.08 }).accepted, 'Comparison engine should support the same cross-asset position')
  for (let day = 0; day < 30; day += 1) {
    a.advanceDay()
    b.advanceDay()
  }
  const sa = a.snapshot()
  const sb = b.snapshot()
  assert(sa.status === 'finished', 'Global Macro mandate should finish after the configured horizon')
  assert(sa.history.length === 30, 'Global Macro engine should generate one portfolio point per simulated day')
  assert(sa.calendar.every((event) => event.revealed), 'All scheduled events inside the 30-day horizon should be released')
  assert(sa.nav === sb.nav, 'Global Macro price path should be deterministic for the same seed and decisions')
  assert(sa.score !== undefined, 'Finished Global Macro mandate should produce a process score')
  assert(sa.trades.length === 2 && sa.theses.length === 2, 'Trades should be tied to explicit thesis records')
  assert(sa.risk.grossExposure <= 1.55, 'Portfolio gross exposure should remain inside the mandate hard limit')
  const factorPnl = Object.values(sa.attribution.byFactor).reduce((sum, value) => sum + value, 0)
  const totalPnl = sa.nav - sa.options.initialNav
  assert(Math.abs(factorPnl - totalPnl) < 0.05, 'Global Macro factor attribution should reconcile to total P&L')

  const riskTest = new MacroPortfolioEngine({ ...options, seed: 330030 })
  const overSized = riskTest.executeTarget({ ...intent, assetId: 'es-macro', targetWeight: 0.35 })
  assert(overSized.accepted, 'A single position at its configured maximum should be permitted')
  const second = riskTest.executeTarget({ ...intent, assetId: 'ty-macro', targetWeight: 0.35 })
  assert(second.accepted, 'Diversified gross exposure below the mandate limit should be permitted')
  const third = riskTest.executeTarget({ ...intent, assetId: 'fgbl-macro', targetWeight: 0.30 })
  assert(third.accepted, 'A third cross-asset position should be permitted while portfolio risk remains controlled')
  const fourth = riskTest.executeTarget({ ...intent, assetId: 'brn-macro', targetWeight: 0.25 })
  assert(fourth.accepted, 'Portfolio should permit additional exposure until the gross mandate is approached')
  const breach = riskTest.executeTarget({ ...intent, assetId: 'gold-macro', targetWeight: 0.25 })
  assert(!breach.accepted, 'Global Macro engine should reject a trade that breaches the 150% gross mandate')
}


function buySideDealerRfqCheck(): void {
  const options = {
    seed: 440040,
    scenario: 'soft-landing' as const,
    difficulty: 'learning' as const,
    days: 30,
    initialNav: 100_000_000,
  }
  const intent = {
    assetId: 'gold-macro' as const,
    targetWeight: 0.12,
    tag: 'risk-hedge' as const,
    horizon: 'weeks' as const,
    conviction: 4,
    invalidation: 'Risk sentiment normalises and real yields move materially higher.',
  }
  const a = new MacroPortfolioEngine(options)
  const b = new MacroPortfolioEngine(options)
  assert(a.requestDealerQuotes(intent, 5).accepted, 'Buy-side portfolio should be able to request dealer block liquidity')
  assert(b.requestDealerQuotes(intent, 5).accepted, 'Identical buy-side RFQ should be accepted on the comparison engine')
  const arfq = a.snapshot().activeDealerRfq
  const brfq = b.snapshot().activeDealerRfq
  assert(arfq !== undefined && brfq !== undefined, 'Dealer RFQ should expose firm quotes')
  assert(arfq.quotes.length === 5, 'Five-dealer RFQ should return five firm quote cards')
  assert(JSON.stringify(arfq.quotes) === JSON.stringify(brfq.quotes), 'Dealer RFQ quotes should be deterministic for the same seed and request')
  const best = [...arfq.quotes].sort((x, y) => x.offer - y.offer)[0]
  assert(a.acceptDealerQuote(best.id).accepted, 'Portfolio should be able to execute a selected dealer quote')
  const after = a.snapshot()
  assert(after.dealerTrades === 1, 'Dealer execution count should increment')
  assert(after.trades[0].executionVenue === 'dealer-rfq', 'Trade blotter should record dealer RFQ as the execution venue')
  assert(after.trades[0].dealerName === best.dealerName, 'Dealer name should persist into trade history')
  assert(after.dealerRfqs[0].status === 'executed', 'Completed RFQ should be preserved in execution history')
  assert(after.theses.length === 1, 'Dealer-executed portfolio changes should still require a thesis record')

  const split = new MacroPortfolioEngine({ ...options, seed: 440042 })
  assert(split.requestDealerQuotes({ ...intent, assetId: 'es-macro', targetWeight: 0.20 }, 3).accepted, 'Split execution test should receive dealer quotes')
  const splitRfq = split.snapshot().activeDealerRfq!
  assert(split.acceptDealerQuote(splitRfq.quotes[0].id, 0.5).accepted, 'Portfolio should be able to execute half a block with one dealer')
  assert((split.snapshot().dealerRfqs[0].filledNotional ?? 0) > 0, 'Partial dealer fill should persist filled notional')
  assert(split.requestDealerQuotes({ ...intent, assetId: 'es-macro', targetWeight: 0.20 }, 3).accepted, 'Residual target should be re-RFQable to another dealer')

  const expiry = new MacroPortfolioEngine({ ...options, seed: 440041 })
  assert(expiry.requestDealerQuotes({ ...intent, assetId: 'ty-macro', targetWeight: -0.08 }, 3).accepted, 'Rates RFQ should be requestable')
  expiry.advanceDay()
  assert(expiry.snapshot().activeDealerRfq === undefined, 'Dealer quotes should expire when the simulated day advances')
  assert(expiry.snapshot().dealerRfqs[0].status === 'expired', 'Expired dealer RFQ should be recorded for review')
}

function liveMacroTradingCheck(): void {
  const options = {
    seed: 551122,
    scenario: 'inflation-resurgence' as const,
    difficulty: 'learning' as const,
    durationSeconds: 180,
    initialNav: 100_000_000,
  }
  const a = new LiveMacroEngine(options)
  const b = new LiveMacroEngine(options)
  const intent = {
    assetId: 'ty-macro' as const,
    targetWeight: -0.10,
    recordThesis: true,
    tag: 'inflation' as const,
    horizon: 'days' as const,
    conviction: 4,
    invalidation: 'Inflation surprise reverses and duration reprices higher.',
  }
  assert(a.executeTarget(intent).accepted, 'Live macro trader should be able to put on risk immediately')
  assert(b.executeTarget(intent).accepted, 'Comparison live macro engine should accept identical initial risk')
  assert(a.requestDealerQuotes({ ...intent, assetId: 'gold-macro', targetWeight: 0.08, recordThesis: false }, 3).accepted, 'Live macro mode should request dealer liquidity while markets run')
  const rfq = a.snapshot().activeDealerRfq
  assert(rfq !== undefined && rfq.quotes.length === 3, 'Live macro RFQ should return three firm quotes')
  for (let i = 0; i < 80; i += 1) a.tick(0.25)
  assert(a.snapshot().activeDealerRfq === undefined, 'Live dealer quotes should expire in real time rather than waiting for a day step')
  assert(a.startWorkingOrder({ ...intent, assetId: 'es-macro', targetWeight: 0.12, recordThesis: false }, 'liquidity-sensitive', 30).accepted, 'Live macro mode should support worked execution')
  for (let i = 0; i < 720; i += 1) {
    a.tick(0.25)
    b.tick(0.25)
  }
  const sa = a.snapshot()
  assert(sa.status === 'finished', 'Live macro session should finish when its real-time clock reaches zero')
  assert(sa.calendar.some((event) => event.revealed), 'Scheduled macro events should release automatically during a live session')
  assert(sa.history.length > 20, 'Live macro price/NAV history should be sampled continuously')
  assert(sa.workingOrders.some((order) => order.executedNotional > 0), 'Worked macro order should execute clips while the market moves')
  assert(sa.score !== undefined, 'Finished live macro session should produce a score')
  assert(sa.theses.length >= 1, 'Optional live thesis journalling should persist when enabled')
  const factorPnl = Object.values(sa.attribution.byFactor).reduce((sum, value) => sum + value, 0)
  const totalPnl = sa.nav - sa.options.initialNav
  assert(Math.abs(factorPnl - totalPnl) < 50, 'Live macro attribution should reconcile closely to total P&L')

  const customFillEngine = new LiveMacroEngine({ ...options, seed: 551124, durationSeconds: 60 })
  assert(customFillEngine.requestDealerQuotes({ ...intent, assetId: 'es-macro', targetWeight: 0.10, recordThesis: false }, 3).accepted, 'Live macro custom-fill check should receive dealer quotes')
  const customRfq = customFillEngine.snapshot().activeDealerRfq!
  const customQuote = customRfq.quotes[0]
  const requestedFraction = 0.37
  const maxFraction = Math.min(1, customQuote.maxNotional / customRfq.requestedNotional)
  const expectedFraction = Math.min(requestedFraction, maxFraction)
  assert(customFillEngine.acceptDealerQuote(customQuote.id, requestedFraction).accepted, 'Live macro dealer RFQ should accept an arbitrary custom fill fraction')
  const filled = customFillEngine.snapshot().dealerRfqs[0].filledNotional ?? 0
  assert(Math.abs(filled - customRfq.requestedNotional * expectedFraction) < 0.01, 'Custom dealer fill should preserve the requested partial notional subject to firm capacity')

  const d1 = new LiveMacroEngine({ ...options, seed: 551123, durationSeconds: 60 })
  const d2 = new LiveMacroEngine({ ...options, seed: 551123, durationSeconds: 60 })
  for (let i = 0; i < 240; i += 1) { d1.tick(0.25); d2.tick(0.25) }
  assert(d1.snapshot().prices['es-macro'] === d2.snapshot().prices['es-macro'], 'Live macro market path should be deterministic for the same seed and actions')
}


function equityFundCheck(): void {
  const options = {
    seed: 662211,
    mandate: 'long-short' as const,
    scenario: 'earnings-season' as const,
    difficulty: 'learning' as const,
    durationSeconds: 120,
    initialNav: 100_000_000,
  }
  const engine = new EquityFundEngine(options)
  const opening = engine.snapshot()
  assert(opening.research['mega-fund'] !== undefined, 'Equity fund should expose a research snapshot for each tradeable asset')
  const chainCounts = new Map<string, number>()
  for (const event of opening.calendar) if (event.chainId) chainCounts.set(event.chainId, (chainCounts.get(event.chainId) ?? 0) + 1)
  assert([...chainCounts.values()].some((count) => count >= 3), 'Equity fund scenario should include at least one coherent multi-stage catalyst chain')
  assert(opening.auditTrail.length > 0, 'Equity fund should initialise a decision audit trail')
  assert(engine.executeTarget({ assetId: 'mega-fund', targetWeight: 0.10, recordThesis: true, tag: 'earnings', horizon: 'days', conviction: 4, invalidation: 'Forward guidance misses expectations.' }).accepted, 'Equity HF should establish a long position immediately')
  assert(engine.snapshot().auditTrail.some((entry) => entry.type === 'trade' && entry.assetId === 'mega-fund'), 'Equity fund trade decisions should be captured in the replay audit trail')
  const shortBeforeLocate = engine.executeTarget({ assetId: 'nova-fund', targetWeight: -0.06, recordThesis: false })
  assert(!shortBeforeLocate.accepted, 'Single-name short should require a borrow locate')
  const locate = engine.requestLocate('nova-fund', -0.06)
  assert(locate.accepted || engine.snapshot().locates['nova-fund']?.status === 'rejected', 'Locate request should return an explicit borrow outcome')
  const locateState = engine.snapshot().locates['nova-fund']
  if (locateState && locateState.status !== 'rejected' && locateState.approvedShortWeight >= 0.03) {
    assert(engine.executeTarget({ assetId: 'nova-fund', targetWeight: -Math.min(0.05, locateState.approvedShortWeight), recordThesis: true, tag: 'short-thesis', horizon: 'days', conviction: 3, invalidation: 'Growth reaccelerates and estimate revisions turn positive.' }).accepted, 'Approved locate should permit a single-name short')
  }
  assert(engine.requestDealerQuotes({ assetId: 'luma-fund', targetWeight: 0.06, recordThesis: false }, 3).accepted, 'Equity fund should request competing dealer block liquidity')
  const rfq = engine.snapshot().activeDealerRfq
  assert(rfq !== undefined && rfq.quotes.length === 3, 'Equity fund RFQ should return requested dealer count')
  if (rfq) assert(engine.acceptDealerQuote(rfq.quotes[0].id, 0.5).accepted, 'Equity fund should support partial dealer fills')
  assert(engine.startWorkingOrder({ assetId: 'apex-fund', targetWeight: 0.08, recordThesis: false }, 'liquidity-sensitive', 30).accepted, 'Equity fund should support worked execution')
  for (let i = 0; i < 560; i += 1) engine.tick(0.25)
  const finalState = engine.snapshot()
  assert(finalState.status === 'finished', 'Equity fund session should finish at configured duration')
  assert(finalState.score !== undefined, 'Finished equity fund session should produce a process score')
  assert(finalState.history.length > 15, 'Equity fund should maintain continuous NAV and price history')
  assert(finalState.calendar.some((event) => event.revealed), 'Equity fund should release company and macro catalysts automatically')
  assert(finalState.auditTrail.some((entry) => entry.type === 'catalyst'), 'Released catalysts should be captured in the decision audit trail')
  assert(finalState.research['mega-fund'].lastUpdatedSeconds > 0, 'Research snapshots should refresh as the live session evolves')
  assert(finalState.workingOrders.some((order) => order.executedNotional > 0), 'Equity fund worked order should execute clips')
  assert(finalState.risk.grossExposure <= 2.01, 'Long/short fund should respect 200% gross limit')

  const longOnly = new EquityFundEngine({ ...options, seed: 662212, mandate: 'long-only', scenario: 'stock-pickers' })
  assert(!longOnly.executeTarget({ assetId: 'apex-fund', targetWeight: -0.05 }).accepted, 'Long-only mandate must reject short positions')
  assert(longOnly.executeTarget({ assetId: 'apex-fund', targetWeight: 0.15 }).accepted, 'Long-only mandate should accept ordinary active long positions')
  for (let i = 0; i < 560; i += 1) longOnly.tick(0.25)
  const longOnlyFinal = longOnly.snapshot()
  assert(longOnlyFinal.benchmarkNav > 0, 'Long-only mode should maintain a benchmark NAV')
  assert(longOnlyFinal.score !== undefined, 'Long-only mandate should produce a score')
}



function equityFundCalibrationAndRelationshipCheck(): void {
  const baseOptions = { seed: 773301, mandate: 'long-short' as const, scenario: 'stock-pickers' as const, difficulty: 'learning' as const, durationSeconds: 90, initialNav: 100_000_000 }
  const direct = new EquityFundEngine(baseOptions)
  assert(direct.executeTarget({ assetId: 'luma-fund', targetWeight: 0.08, recordThesis: false }).accepted, 'Calibration direct LUMA block should execute')
  const directQ = direct.snapshot().executionQuality
  assert(directQ.totalNotional > 0 && directQ.implementationShortfallBps > 0, 'Direct fund execution should record positive implementation shortfall')

  const dealer = new EquityFundEngine({ ...baseOptions, seed: 773302 })
  assert(dealer.requestDealerQuotes({ assetId: 'luma-fund', targetWeight: 0.08, recordThesis: false }, 5).accepted, 'Calibration dealer RFQ should open')
  const rfq = dealer.snapshot().activeDealerRfq!
  const best = [...rfq.quotes].sort((a, b) => a.offer - b.offer)[0]
  assert(dealer.acceptDealerQuote(best.id).accepted, 'Best dealer quote should execute')
  const dealerState = dealer.snapshot()
  assert(dealerState.executionQuality.dealerNotional > 0, 'Dealer execution should be separately benchmarked')
  assert(dealerState.executionQuality.implementationShortfallBps < directQ.implementationShortfallBps * 1.25, 'Competitive dealer liquidity should not be systematically much worse than immediate direct execution')
  assert(Object.values(dealerState.dealerRelationships).some((item) => item.fills > 0), 'Dealer relationship memory should update after a fill')

  let sawDealerPremium = false
  for (let seed = 773310; seed < 773340 && !sawDealerPremium; seed += 1) {
    const probe = new EquityFundEngine({ ...baseOptions, seed })
    probe.requestDealerQuotes({ assetId: 'luma-fund', targetWeight: 0.08, recordThesis: false }, 5)
    const live = probe.snapshot().activeDealerRfq!
    sawDealerPremium = live.quotes.some((quote) => quote.offer > live.directBenchmarkPrice)
  }
  assert(sawDealerPremium, 'Dealer RFQs should sometimes be worse than direct execution so RFQ is not a dominant strategy')

  const relationshipMemory = Object.fromEntries(Object.values(dealerState.dealerRelationships).map((item) => [item.dealerId, { dealerId: item.dealerId, dealerName: item.dealerName, relationshipScore: item.relationshipScore, rfqs: item.rfqs, fills: item.fills, executedNotional: item.executedNotional, cumulativeSavings: item.cumulativeSavings }]))
  const repeat = new EquityFundEngine({ ...baseOptions, seed: 773303, dealerMemory: relationshipMemory })
  assert(Object.values(repeat.snapshot().dealerRelationships).some((item) => item.fills > 0), 'Dealer relationship state should persist into a later session when memory is supplied')

  const controlled = new EquityFundEngine({ ...baseOptions, seed: 773304 })
  controlled.executeTarget({ assetId: 'mega-fund', targetWeight: 0.12, recordThesis: false })
  controlled.tick(.25); controlled.finish()
  const levered = new EquityFundEngine({ ...baseOptions, seed: 773305 })
  levered.executeTarget({ assetId: 'mega-fund', targetWeight: 0.25, recordThesis: false })
  levered.executeTarget({ assetId: 'apex-fund', targetWeight: 0.22, recordThesis: false })
  levered.executeTarget({ assetId: 'heli-fund', targetWeight: 0.20, recordThesis: false })
  levered.tick(.25); levered.finish()
  assert((levered.snapshot().score?.risk ?? 100) < (controlled.snapshot().score?.risk ?? 0), 'Concentrated / higher-gross books should receive a weaker risk score')
}


function deskRealismAndAssessmentCheck(): void {
  const dealer = new DealerSimEngine({ seed: 340001, scenario: 'balanced', difficulty: 'assessment', durationSeconds: 120, instrument: APEX_EQUITY })
  dealer.start()
  const opening = dealer.getSnapshot()
  assert(opening.marketPhase === 'opening', 'Dealer session should start in opening-flow conditions')
  assert(opening.timeLiquidityMultiplier < 1 && opening.timeVolatilityMultiplier > 1, 'Dealer opening should be less liquid and more volatile than normal')
  for (let i = 0; i < 380; i += 1) dealer.tick(.2, false)
  const later = dealer.getSnapshot()
  assert(later.marketPhase !== 'opening', 'Dealer time-of-day phase should evolve during the session')

  const fund = new EquityFundEngine({ seed: 340002, scenario: 'earnings-season', difficulty: 'advanced', durationSeconds: 180, initialNav: 100_000_000, mandate: 'long-short' })
  const fundOpen = fund.snapshot()
  assert(fundOpen.stressTests.length >= 4, 'Equity fund should expose institutional stress tests at the open')
  assert(fundOpen.riskManagerMessages.length > 0, 'Equity fund should initialise PM/risk oversight')
  for (let i = 0; i < 200; i += 1) fund.tick(.25)
  const fundLive = fund.snapshot()
  assert(fundLive.liquidityCostMultiplier > 0 && fundLive.volatilityMultiplier > 0, 'Equity fund should maintain time-of-day liquidity and volatility multipliers')

  const macro = new LiveMacroEngine({ seed: 340003, scenario: 'inflation-resurgence', difficulty: 'advanced', durationSeconds: 180, initialNav: 100_000_000 })
  const macroOpen = macro.snapshot()
  assert(macroOpen.stressTests.length >= 4, 'Live macro should expose cross-asset stress tests')
  assert(macroOpen.riskManagerMessages.length > 0, 'Live macro should initialise PM/risk oversight')
  for (let i = 0; i < 200; i += 1) macro.tick(.25)
  const macroLive = macro.snapshot()
  assert(macroLive.marketPhase !== 'opening' || macroLive.elapsedSeconds < 30, 'Live macro market phase should evolve with session time')
}


function deskFranchiseAuctionAndControlCheck(): void {
  const first = new DealerSimEngine({ seed: 350001, scenario: 'balanced', difficulty: 'standard', durationSeconds: 60, instrument: APEX_EQUITY })
  const clientName = first.getSnapshot().clients[0].name
  const relationship = new DealerSimEngine({ seed: 350001, scenario: 'balanced', difficulty: 'standard', durationSeconds: 60, instrument: APEX_EQUITY, clientMemory: { [clientName]: { relationshipScore: 91 } } })
  const remembered = relationship.getSnapshot().clients.find((client) => client.name === clientName)
  assert(remembered?.franchiseScore === 91, 'Sell-side client franchise memory should load into later sessions')

  const auction = new EquityFundEngine({ seed: 350002, scenario: 'stock-pickers', difficulty: 'standard', durationSeconds: 120, initialNav: 100_000_000, mandate: 'long-only' })
  assert(auction.snapshot().marketPhase === 'opening-auction', 'Equity fund should begin in the opening auction window')
  assert(auction.executeAuction({ assetId: 'mega-fund', targetWeight: 0.08, recordThesis: false }).accepted, 'Opening auction should accept eligible single-name execution')
  assert(auction.snapshot().executionQuality.auctionNotional > 0, 'Auction fills should be separately tracked in execution quality')
  for (let i = 0; i < 80; i += 1) auction.tick(.25)
  assert(auction.snapshot().marketPhase !== 'opening-auction', 'Opening auction window should end as simulated time advances')
  assert(!auction.executeAuction({ assetId: 'apex-fund', targetWeight: 0.05, recordThesis: false }).accepted, 'Auction route should reject execution outside opening/closing auction windows')

  let flaggedSeed = 0
  let flaggedTicks = 0
  for (let seed = 350010; seed < 350160 && !flaggedSeed; seed += 1) {
    const probe = new DealerSimEngine({ seed, scenario: 'fast-market', difficulty: 'assessment', durationSeconds: 90, instrument: APEX_EQUITY })
    probe.start()
    for (let tick = 0; tick < 360; tick += 1) {
      const state = probe.tick(.25, false)
      if (state.activeRfq?.controlFlag) { flaggedSeed = seed; flaggedTicks = tick + 1; break }
      if (state.activeRfq) probe.passRfq()
    }
  }
  assert(flaggedSeed > 0, 'Assessment dealer sessions should occasionally generate a control-check RFQ')
  const safe = new DealerSimEngine({ seed: flaggedSeed, scenario: 'fast-market', difficulty: 'assessment', durationSeconds: 90, instrument: APEX_EQUITY })
  safe.start()
  for (let tick = 0; tick < flaggedTicks; tick += 1) {
    const state = safe.tick(.25, false)
    if (tick + 1 < flaggedTicks && state.activeRfq) safe.passRfq()
  }
  const beforePass = safe.getSnapshot().metrics.fatFingerFlags
  assert(Boolean(safe.getSnapshot().activeRfq?.controlFlag), 'Replayed control-check seed should reproduce the flagged RFQ')
  safe.passRfq()
  assert(safe.getSnapshot().metrics.fatFingerFlags === beforePass, 'Clarifying/passing a flagged RFQ should not count as a control failure')

  const unsafe = new DealerSimEngine({ seed: flaggedSeed, scenario: 'fast-market', difficulty: 'assessment', durationSeconds: 90, instrument: APEX_EQUITY })
  unsafe.start()
  for (let tick = 0; tick < flaggedTicks; tick += 1) {
    const state = unsafe.tick(.25, false)
    if (tick + 1 < flaggedTicks && state.activeRfq) unsafe.passRfq()
  }
  const flagged = unsafe.getSnapshot().activeRfq
  assert(Boolean(flagged?.controlFlag), 'Control failure probe should reach the same flagged RFQ')
  const market = unsafe.getSnapshot().market
  unsafe.submitQuote(market.bid, market.ask)
  assert(unsafe.getSnapshot().metrics.fatFingerFlags > beforePass, 'Pricing an unresolved control-check RFQ should count as a control-discipline failure')
}

function sessionCheck(): void {
  const engine = new DealerSimEngine({
    seed: 42,
    scenario: 'news-shock',
    difficulty: 'standard',
    durationSeconds: 30,
    instrument: EUR_USD,
  })
  engine.start()
  for (let index = 0; index < 180; index += 1) {
    const snapshot = engine.tick(0.25)
    if (snapshot.activeRfq && !snapshot.pendingQuote) {
      const width = snapshot.market.spreadPips * snapshot.options.instrument.pipSize
      engine.submitQuote(snapshot.market.mid - width, snapshot.market.mid + width)
    }
  }
  const finalSnapshot = engine.getSnapshot()
  assert(finalSnapshot.status === 'finished', 'Session should finish at the configured duration')
  assert(finalSnapshot.score !== undefined, 'Finished session should have a score')
  assert(finalSnapshot.priceHistory.length > 10, 'Price history should be sampled throughout the session')
  assert(finalSnapshot.metrics.rfqsReceived > 0, 'Session should generate client RFQs')
}

accountingChecks()
instrumentArchitectureCheck()
equityBlockCheck()
multiEquityCalibrationCheck()
liquidityMicrostructureCheck()
macroFuturesCalibrationCheck()
determinismCheck()
timingCalibrationCheck()
newsCoverageCheck()
dualMarketCheck()
crossAssetFactorAndTripleDeskCheck()
workedOrderControlCheck()
directionalRfqRealismCheck()
dealerQaControlCheck()
quoteAcceptanceCalibrationCheck()
globalMacroPortfolioCheck()
buySideDealerRfqCheck()
liveMacroTradingCheck()
equityFundCheck()
equityFundCalibrationAndRelationshipCheck()
deskRealismAndAssessmentCheck()
deskFranchiseAuctionAndControlCheck()
sessionCheck()
console.log('DealerSim dealer + Macro + Equity HF/AM engine verification passed')
