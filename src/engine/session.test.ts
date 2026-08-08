import { describe, expect, it } from 'vitest'
import { EUR_USD } from './config'
import { DealerSimEngine } from './session'

const options = {
  seed: 20260806,
  scenario: 'balanced' as const,
  difficulty: 'standard' as const,
  durationSeconds: 45,
  instrument: EUR_USD,
}

describe('DealerSimEngine', () => {
  it('is deterministic for a fixed seed', () => {
    const a = new DealerSimEngine(options)
    const b = new DealerSimEngine(options)
    a.start()
    b.start()
    for (let index = 0; index < 120; index += 1) {
      a.tick(0.25)
      b.tick(0.25)
    }
    expect(a.getSnapshot().market.mid).toBe(b.getSnapshot().market.mid)
    expect(a.getSnapshot().activeRfq?.sizeM).toBe(b.getSnapshot().activeRfq?.sizeM)
  })

  it('generates RFQs and completes with a score', () => {
    const engine = new DealerSimEngine(options)
    engine.start()
    for (let index = 0; index < 300; index += 1) {
      const snapshot = engine.tick(0.2)
      if (snapshot.activeRfq && !snapshot.pendingQuote) {
        engine.submitQuote(snapshot.market.bid, snapshot.market.ask)
      }
    }
    const finalSnapshot = engine.getSnapshot()
    expect(finalSnapshot.status).toBe('finished')
    expect(finalSnapshot.metrics.rfqsReceived).toBeGreaterThan(0)
    expect(finalSnapshot.score?.overall).toBeGreaterThanOrEqual(0)
    expect(finalSnapshot.score?.overall).toBeLessThanOrEqual(100)
  })
})
