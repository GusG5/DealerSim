import { describe, expect, it } from 'vitest'
import { MacroPortfolioEngine } from './macro'

const baseOptions = {
  seed: 20260807,
  scenario: 'inflation-resurgence' as const,
  difficulty: 'learning' as const,
  days: 30,
  initialNav: 100_000_000,
}

const thesis = {
  tag: 'inflation' as const,
  horizon: 'weeks' as const,
  conviction: 4,
  invalidation: 'Inflation surprises reverse and hawkish policy pricing unwinds.',
}

describe('Global Macro portfolio engine', () => {
  it('is deterministic for the same seed and decisions', () => {
    const a = new MacroPortfolioEngine(baseOptions)
    const b = new MacroPortfolioEngine(baseOptions)
    a.executeTarget({ ...thesis, assetId: 'es-macro', targetWeight: -0.1 })
    b.executeTarget({ ...thesis, assetId: 'es-macro', targetWeight: -0.1 })
    for (let day = 0; day < 30; day += 1) {
      a.advanceDay()
      b.advanceDay()
    }
    expect(a.snapshot().nav).toBe(b.snapshot().nav)
  })

  it('enforces the gross exposure mandate', () => {
    const engine = new MacroPortfolioEngine(baseOptions)
    expect(engine.executeTarget({ ...thesis, assetId: 'es-macro', targetWeight: 0.35 }).accepted).toBe(true)
    expect(engine.executeTarget({ ...thesis, assetId: 'ty-macro', targetWeight: 0.35 }).accepted).toBe(true)
    expect(engine.executeTarget({ ...thesis, assetId: 'fgbl-macro', targetWeight: 0.30 }).accepted).toBe(true)
    expect(engine.executeTarget({ ...thesis, assetId: 'brn-macro', targetWeight: 0.25 }).accepted).toBe(true)
    expect(engine.executeTarget({ ...thesis, assetId: 'gold-macro', targetWeight: 0.25 }).accepted).toBe(false)
  })

  it('reconciles factor attribution to total portfolio pnl', () => {
    const engine = new MacroPortfolioEngine(baseOptions)
    engine.executeTarget({ ...thesis, assetId: 'ty-macro', targetWeight: -0.12 })
    engine.executeTarget({ ...thesis, assetId: 'gold-macro', targetWeight: 0.08 })
    for (let day = 0; day < 30; day += 1) engine.advanceDay()
    const snapshot = engine.snapshot()
    const attribution = Object.values(snapshot.attribution.byFactor).reduce((sum, value) => sum + value, 0)
    expect(attribution).toBeCloseTo(snapshot.nav - snapshot.options.initialNav, 4)
  })

  it('records every meaningful position change as a thesis-linked trade', () => {
    const engine = new MacroPortfolioEngine(baseOptions)
    const result = engine.executeTarget({ ...thesis, assetId: 'brn-macro', targetWeight: 0.1 })
    expect(result.accepted).toBe(true)
    const snapshot = engine.snapshot()
    expect(snapshot.trades).toHaveLength(1)
    expect(snapshot.theses).toHaveLength(1)
    expect(snapshot.trades[0].thesisId).toBe(snapshot.theses[0].id)
  })
})

describe('Global Macro dealer RFQ execution', () => {
  it('generates deterministic firm dealer quotes for the same seed and request', () => {
    const a = new MacroPortfolioEngine(baseOptions)
    const b = new MacroPortfolioEngine(baseOptions)
    const intent = { ...thesis, assetId: 'es-macro' as const, targetWeight: 0.12 }
    expect(a.requestDealerQuotes(intent, 3).accepted).toBe(true)
    expect(b.requestDealerQuotes(intent, 3).accepted).toBe(true)
    expect(a.snapshot().activeDealerRfq?.quotes).toEqual(b.snapshot().activeDealerRfq?.quotes)
  })

  it('executes a selected dealer quote and records dealer-vs-direct economics', () => {
    const engine = new MacroPortfolioEngine(baseOptions)
    const intent = { ...thesis, assetId: 'gold-macro' as const, targetWeight: 0.10 }
    expect(engine.requestDealerQuotes(intent, 5).accepted).toBe(true)
    const rfq = engine.snapshot().activeDealerRfq
    expect(rfq).toBeDefined()
    expect(rfq?.quotes).toHaveLength(5)
    const best = [...(rfq?.quotes ?? [])].sort((a, b) => a.offer - b.offer)[0]
    expect(engine.acceptDealerQuote(best.id).accepted).toBe(true)
    const snapshot = engine.snapshot()
    expect(snapshot.activeDealerRfq).toBeUndefined()
    expect(snapshot.dealerTrades).toBe(1)
    expect(snapshot.dealerRfqs[0].status).toBe('executed')
    expect(snapshot.trades[0].executionVenue).toBe('dealer-rfq')
    expect(snapshot.trades[0].dealerName).toBe(best.dealerName)
    expect(snapshot.theses).toHaveLength(1)
  })

  it('expires live dealer quotes when the portfolio advances to a new day', () => {
    const engine = new MacroPortfolioEngine(baseOptions)
    expect(engine.requestDealerQuotes({ ...thesis, assetId: 'ty-macro', targetWeight: -0.08 }, 3).accepted).toBe(true)
    engine.advanceDay()
    const snapshot = engine.snapshot()
    expect(snapshot.activeDealerRfq).toBeUndefined()
    expect(snapshot.dealerRfqs[0].status).toBe('expired')
  })
})

describe('Global Macro dealer RFQ split execution', () => {
  it('allows a partial dealer fill so the residual target can be re-RFQd', () => {
    const engine = new MacroPortfolioEngine(baseOptions)
    const intent = { ...thesis, assetId: 'es-macro' as const, targetWeight: 0.20 }
    expect(engine.requestDealerQuotes(intent, 3).accepted).toBe(true)
    const rfq = engine.snapshot().activeDealerRfq!
    const quote = rfq.quotes[0]
    expect(engine.acceptDealerQuote(quote.id, 0.5).accepted).toBe(true)
    const afterHalf = engine.snapshot()
    const currentWeight = afterHalf.positions['es-macro'].units * afterHalf.prices['es-macro'] / afterHalf.nav
    expect(currentWeight).toBeGreaterThan(0.08)
    expect(currentWeight).toBeLessThan(0.12)
    expect(afterHalf.dealerRfqs[0].filledNotional).toBeCloseTo(rfq.requestedNotional * 0.5, 2)
    expect(engine.requestDealerQuotes(intent, 3).accepted).toBe(true)
  })
})
