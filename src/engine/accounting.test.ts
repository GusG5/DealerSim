import { describe, expect, it } from 'vitest'
import type { Trade } from '../types'
import { applyTrade, emptyPosition, estimateBlockExecution, executeAgainstBook, netTradingPnl } from './accounting'
import { APEX_EQUITY, EUR_USD } from './config'

const baseTrade: Trade = {
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

describe('position accounting', () => {
  it('realises P&L when reducing a long position', () => {
    let position = applyTrade(emptyPosition(), baseTrade, 1.1, EUR_USD)
    position = applyTrade(
      position,
      { ...baseTrade, id: 't2', side: 'sell', sizeM: 4, price: 1.101, commission: 100 },
      1.101,
      EUR_USD,
    )
    expect(position.quantityM).toBe(6)
    expect(position.realisedPnl).toBeCloseTo(4000)
    expect(position.grossCommission).toBe(300)
    expect(netTradingPnl(position)).toBeGreaterThan(4300)
  })

  it('sets a new average price after reversing a position', () => {
    let position = applyTrade(emptyPosition(), baseTrade, 1.1, EUR_USD)
    position = applyTrade(
      position,
      { ...baseTrade, id: 't2', side: 'sell', sizeM: 15, price: 1.099 },
      1.099,
      EUR_USD,
    )
    expect(position.quantityM).toBe(-5)
    expect(position.averagePrice).toBe(1.099)
    expect(position.realisedPnl).toBeCloseTo(-10000)
  })
})

describe('order-book execution', () => {
  it('consumes multiple levels for a large hedge', () => {
    const market = {
      timestamp: 0,
      mid: 1.1,
      bid: 1.0999,
      ask: 1.1001,
      spreadPips: 2,
      volatility: 0.2,
      liquidity: 0.7,
      regime: 'calm' as const,
      participantCount: 42,
      displayedDepthM: 16,
      liquidityRegime: 'normal' as const,
      bookImbalance: 0,
      hiddenLiquidityShare: 0,
      cancellationPressure: 0,
      recentParticipation: 0,
      spreadPressurePips: 0,
      recentImpactPips: 0,
      expectedRecoverySeconds: 10,
      informationLeakageRisk: 0,
      orderBook: [
        { level: 1, bid: 1.0999, ask: 1.1001, bidSizeM: 3, askSizeM: 3 },
        { level: 2, bid: 1.0998, ask: 1.1002, bidSizeM: 5, askSizeM: 5 },
        { level: 3, bid: 1.0997, ask: 1.1003, bidSizeM: 8, askSizeM: 8 },
      ],
    }
    const execution = executeAgainstBook('buy', 10, market.orderBook, market, EUR_USD)
    expect(execution.filledM).toBe(10)
    expect(execution.levelsConsumed).toBe(3)
    expect(execution.averagePrice).toBeGreaterThan(market.ask)
    expect(execution.executionCost).toBeGreaterThan(0)
  })
})


describe('equity block execution', () => {
  const market = {
    timestamp: 0,
    mid: 250,
    bid: 249.99,
    ask: 250,
    spreadPips: 1,
    volatility: 0.8,
    liquidity: 0.8,
    regime: 'calm' as const,
    participantCount: 41,
    displayedDepthM: 41,
    liquidityRegime: 'normal' as const,
    bookImbalance: 0,
    hiddenLiquidityShare: 0,
    cancellationPressure: 0,
    recentParticipation: 0,
    spreadPressurePips: 0,
    recentImpactPips: 0,
    expectedRecoverySeconds: 10,
    informationLeakageRisk: 0,
    orderBook: [
      { level: 1, bid: 249.99, ask: 250, bidSizeM: 2, askSizeM: 2 },
      { level: 2, bid: 249.98, ask: 250.01, bidSizeM: 3, askSizeM: 3 },
      { level: 3, bid: 249.97, ask: 250.02, bidSizeM: 4, askSizeM: 4 },
      { level: 4, bid: 249.96, ask: 250.03, bidSizeM: 5, askSizeM: 5 },
      { level: 5, bid: 249.95, ask: 250.04, bidSizeM: 6, askSizeM: 6 },
    ],
  }

  it('makes the whole-block alternative wider than top-of-book', () => {
    const buy = estimateBlockExecution('buy', 15, market.orderBook, market, APEX_EQUITY)
    const sell = estimateBlockExecution('sell', 15, market.orderBook, market, APEX_EQUITY)
    const wholeBlockSpreadTicks = (buy.impactAdjustedPrice - sell.impactAdjustedPrice) / APEX_EQUITY.pipSize
    expect(buy.levelsConsumed).toBeGreaterThan(1)
    expect(sell.levelsConsumed).toBeGreaterThan(1)
    expect(wholeBlockSpreadTicks).toBeGreaterThan(market.spreadPips)
  })

  it('charges more impact for a larger aggressive order', () => {
    const small = estimateBlockExecution('buy', 3, market.orderBook, market, APEX_EQUITY)
    const large = estimateBlockExecution('buy', 18, market.orderBook, market, APEX_EQUITY)
    expect(large.temporaryImpactPips).toBeGreaterThan(small.temporaryImpactPips)
    expect(large.implementationShortfall).toBeGreaterThan(small.implementationShortfall)
  })
})
