import { APEX_EQUITY, ORBX_EQUITY } from '../src/engine/config'
import { EquityFundEngine } from '../src/engine/fund'
import { DealerSimEngine } from '../src/engine/session'
import type { InstrumentConfig, Rfq, SessionSnapshot } from '../src/types'

type DealerPolicy = 'tight-warehouse' | 'market-hedge' | 'defensive-hedge' | 'passive'
type FundPolicy = 'cash' | 'concentrated-long' | 'balanced-long-only' | 'beta-heavy-ls'

type Result = { name: string; scores: number[]; returns: number[]; warnings: string[] }

function mean(values: number[]): number { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 }

function quoteFor(snapshot: SessionSnapshot, rfq: Rfq, width: number): { bid?: number; ask?: number } {
  const mid = snapshot.market.mid
  const half = snapshot.options.instrument.pipSize * width / 2
  if (rfq.kind === 'two-way') return { bid: mid - half, ask: mid + half }
  if (rfq.requestedSide === 'buy') return { ask: mid + half }
  return { bid: mid - half }
}

function runDealer(seed: number, instrument: InstrumentConfig, policy: DealerPolicy): { score: number; ret: number } {
  const engine = new DealerSimEngine({ seed, scenario: 'random', difficulty: 'standard', durationSeconds: 120, instrument })
  engine.start()
  let lastRfq = ''
  while (engine.getStatus() === 'running') {
    engine.tick(.25, false)
    const s = engine.getSnapshot()
    const rfq = s.activeRfq
    if (rfq && rfq.id !== lastRfq && !s.pendingQuote) {
      lastRfq = rfq.id
      const width = policy === 'tight-warehouse' ? .65 : policy === 'defensive-hedge' ? 2.2 : policy === 'market-hedge' ? 1.05 : 1.25
      const quote = quoteFor(s, rfq, width)
      engine.submitQuote(quote.bid, quote.ask)
    }
    const after = engine.getSnapshot()
    if ((policy === 'market-hedge' || policy === 'defensive-hedge') && Math.abs(after.position.quantityM) >= Math.max(after.options.instrument.minimumSizeM, after.softLimitM * .25)) {
      engine.hedgeMarket(after.position.quantityM > 0 ? 'sell' : 'buy', Math.abs(after.position.quantityM))
    }
  }
  const final = engine.getSnapshot()
  return { score: final.score?.overall ?? 0, ret: final.currentEquity }
}

function runFund(seed: number, policy: FundPolicy): { score: number; ret: number } {
  const mandate = policy === 'beta-heavy-ls' ? 'long-short' as const : 'long-only' as const
  const engine = new EquityFundEngine({ seed, mandate, scenario: 'random', difficulty: 'standard', durationSeconds: 120, initialNav: 100_000_000 })
  if (policy === 'concentrated-long') engine.executeTarget({ assetId: 'mega-fund', targetWeight: .25 })
  if (policy === 'balanced-long-only') {
    engine.executeTarget({ assetId: 'apex-fund', targetWeight: .15 })
    engine.executeTarget({ assetId: 'mega-fund', targetWeight: .20 })
    engine.executeTarget({ assetId: 'heli-fund', targetWeight: .15 })
    engine.executeTarget({ assetId: 'luma-fund', targetWeight: .10 })
  }
  if (policy === 'beta-heavy-ls') {
    engine.executeTarget({ assetId: 'mega-fund', targetWeight: .25 })
    engine.executeTarget({ assetId: 'apex-fund', targetWeight: .20 })
    engine.executeTarget({ assetId: 'es-fund', targetWeight: .40 })
  }
  while (engine.snapshot().status === 'running') engine.tick(.5)
  const final = engine.snapshot()
  return { score: final.score?.overall ?? 0, ret: final.nav / final.options.initialNav - 1 }
}

function evaluate(name: string, values: Array<{ score: number; ret: number }>, warningRules: Array<(score: number, ret: number) => string | undefined>): Result {
  const result: Result = { name, scores: values.map((x) => x.score), returns: values.map((x) => x.ret), warnings: [] }
  const avgScore = mean(result.scores), avgReturn = mean(result.returns)
  for (const rule of warningRules) { const warning = rule(avgScore, avgReturn); if (warning) result.warnings.push(warning) }
  return result
}

export function runCalibrationLab(): Result[] {
  const seeds = Array.from({ length: 32 }, (_, index) => 3101 + index * 37)
  const results: Result[] = []
  for (const instrument of [APEX_EQUITY, ORBX_EQUITY]) {
    for (const policy of ['tight-warehouse', 'market-hedge', 'defensive-hedge', 'passive'] as DealerPolicy[]) {
      const runs = seeds.map((seed) => runDealer(seed, instrument, policy))
      results.push(evaluate(`dealer:${instrument.symbol}:${policy}`, runs, [
        (score) => score > 88 ? 'Simple scripted dealer policy scores above 88 on average; investigate dominance.' : undefined,
      ]))
    }
  }
  for (const policy of ['cash', 'concentrated-long', 'balanced-long-only', 'beta-heavy-ls'] as FundPolicy[]) {
    const runs = seeds.map((seed) => runFund(seed + 9000, policy))
    results.push(evaluate(`fund:${policy}`, runs, [
      (score) => policy === 'cash' && score > 72 ? 'All-cash policy is scoring too highly.' : undefined,
      (score) => policy === 'beta-heavy-ls' && score > 82 ? 'Unhedged beta-heavy fund policy is scoring too highly.' : undefined,
    ]))
  }
  return results
}
