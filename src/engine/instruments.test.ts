import { describe, expect, it } from 'vitest'
import type { Trade } from '../types'
import { applyTrade, emptyPosition } from './accounting'
import { APEX_EQUITY, BRENT_FUTURE, BUND_FUTURE, EQUITY_INSTRUMENTS, INSTRUMENTS, LUMA_EQUITY, MACRO_FUTURES, MEGA_EQUITY, NOVA_EQUITY, ORBX_EQUITY, SP500_FUTURE, getInstrumentTrainingProfile } from './config'
import { DealerSimEngine } from './session'

describe('instrument registry', () => {
  it.each(Object.values(INSTRUMENTS))('runs the engine for $symbol', (instrument) => {
    const engine = new DealerSimEngine({
      seed: 9123,
      scenario: 'balanced',
      difficulty: 'learning',
      durationSeconds: 10,
      instrument,
    })
    engine.start()
    for (let index = 0; index < 50; index += 1) engine.tick(0.2)
    const snapshot = engine.getSnapshot()
    expect(snapshot.options.instrument.id).toBe(instrument.id)
    expect(snapshot.market.orderBook).toHaveLength(instrument.orderBookLevels)
  })

  it('keeps the six equity markets economically distinct', () => {
    expect(EQUITY_INSTRUMENTS).toHaveLength(6)
    expect(MEGA_EQUITY.depthScale).toBeGreaterThan(APEX_EQUITY.depthScale)
    expect(MEGA_EQUITY.impactCoefficientPips).toBeLessThan(APEX_EQUITY.impactCoefficientPips)
    expect(NOVA_EQUITY.depthScale).toBeLessThan(APEX_EQUITY.depthScale)
    expect(NOVA_EQUITY.impactCoefficientPips).toBeGreaterThan(APEX_EQUITY.impactCoefficientPips)
    expect(NOVA_EQUITY.volatilityScale).toBeGreaterThan(MEGA_EQUITY.volatilityScale)
    expect(LUMA_EQUITY.depthScale).toBeLessThan(NOVA_EQUITY.depthScale)
    expect(ORBX_EQUITY.depthScale).toBeLessThan(LUMA_EQUITY.depthScale)
    expect(ORBX_EQUITY.impactCoefficientPips).toBeGreaterThan(LUMA_EQUITY.impactCoefficientPips)
  })


  it('configures three economically distinct macro futures markets', () => {
    expect(MACRO_FUTURES).toHaveLength(3)
    expect(BUND_FUTURE.unitsPerSize).toBe(1_000)
    expect(BRENT_FUTURE.unitsPerSize).toBe(1_000)
    expect(SP500_FUTURE.unitsPerSize).toBe(50)
    expect(BUND_FUTURE.depthScale).toBeGreaterThan(BRENT_FUTURE.depthScale)
    expect(BRENT_FUTURE.impactCoefficientPips).toBeGreaterThan(BUND_FUTURE.impactCoefficientPips)
    expect(SP500_FUTURE.impactRecoverySeconds).toBeLessThan(BRENT_FUTURE.impactRecoverySeconds)
    for (const instrument of MACRO_FUTURES) {
      const profile = getInstrumentTrainingProfile(instrument)
      expect(profile).toBeDefined()
      expect(profile?.scheduledHeadlines.length).toBeGreaterThanOrEqual(3)
      expect(profile?.surpriseHeadlines.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('uses futures contract multipliers rather than FX notional accounting', () => {
    const opening: Trade = {
      id: 'open',
      timestamp: 0,
      instrument: BUND_FUTURE.symbol,
      side: 'buy',
      price: 132.5,
      sizeM: 10,
      source: 'client',
      commission: 0,
      executionCost: 0,
    }
    let position = applyTrade(emptyPosition(), opening, 132.5, BUND_FUTURE)
    position = applyTrade(
      position,
      { ...opening, id: 'close', side: 'sell', price: 132.51 },
      132.51,
      BUND_FUTURE,
    )
    expect(position.realisedPnl).toBeCloseTo(100)
  })
})
