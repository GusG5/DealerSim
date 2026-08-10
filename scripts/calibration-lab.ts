import { APEX_EQUITY, ORBX_EQUITY } from '../src/engine/config'
import { EquityFundEngine } from '../src/engine/fund'
import { DealerSimEngine } from '../src/engine/session'
import type { FundAssetId, FundTradeIntent } from '../src/engine/fund-types'
import type { InstrumentConfig, Rfq, SessionSnapshot } from '../src/types'

type DealerPolicy = 'immediate-hedge' | 'min-clip-market' | 'worked-hedge' | 'warehouse-interdealer'
type FundPolicy = 'always-market' | 'min-clip-split' | 'always-rfq' | 'always-twap'

type Run = { score: number; ret: number; costBps: number }
type Result = { name: string; scores: number[]; returns: number[]; costsBps: number[]; warnings: string[] }

function mean(values: number[]): number { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 }

function quoteFor(snapshot: SessionSnapshot, rfq: Rfq, width: number): { bid?: number; ask?: number } {
  const mid = snapshot.market.mid
  const half = snapshot.options.instrument.pipSize * width / 2
  if (rfq.kind === 'two-way') return { bid: mid - half, ask: mid + half }
  if (rfq.requestedSide === 'buy') return { ask: mid + half }
  return { bid: mid - half }
}

function dealerExecutionCostBps(snapshot: SessionSnapshot): number {
  const hedgedM = snapshot.metrics.exchangeHedgeVolumeM + snapshot.metrics.interdealerHedgeVolumeM
  if (hedgedM <= 0) return 0
  const notionalScale = Math.max(1, hedgedM * snapshot.market.mid * snapshot.options.instrument.pnlMultiplier)
  return (snapshot.metrics.marketImpactCost + snapshot.metrics.exchangeSlippageCost) / notionalScale * 10_000
}

function runDealer(seed: number, instrument: InstrumentConfig, policy: DealerPolicy): Run {
  const engine = new DealerSimEngine({ seed, scenario: 'random', difficulty: 'standard', durationSeconds: 120, instrument })
  engine.start()
  let lastRfq = ''
  while (engine.getStatus() === 'running') {
    engine.tick(.25, false)
    const s = engine.getSnapshot()
    const rfq = s.activeRfq
    if (rfq && rfq.id !== lastRfq && !s.pendingQuote) {
      lastRfq = rfq.id
      const width = policy === 'warehouse-interdealer' ? .88 : policy === 'worked-hedge' ? 1.15 : 1.05
      const quote = quoteFor(s, rfq, width)
      engine.submitQuote(quote.bid, quote.ask)
    }

    const after = engine.getSnapshot()
    const absPosition = Math.abs(after.position.quantityM)
    if (absPosition < after.options.instrument.minimumSizeM) continue
    const side = after.position.quantityM > 0 ? 'sell' : 'buy'

    if (policy === 'immediate-hedge') {
      engine.hedgeMarket(side, absPosition)
    } else if (policy === 'min-clip-market') {
      engine.hedgeMarket(side, Math.min(absPosition, after.options.instrument.minimumSizeM))
    } else if (policy === 'worked-hedge') {
      const active = after.workingHedges.some((order) => order.status === 'working' || order.status === 'paused')
      if (!active && absPosition >= after.softLimitM * .28) {
        engine.startWorkingHedge(
          side,
          absPosition,
          'liquidity-sensitive',
          Math.max(after.options.instrument.minimumSizeM, after.softLimitM * .14),
          3,
        )
      }
    } else if (absPosition >= after.softLimitM * .72) {
      engine.hedgeInterdealer(side, absPosition)
    }
  }
  const final = engine.getSnapshot()
  return { score: final.score?.overall ?? 0, ret: final.currentEquity, costBps: dealerExecutionCostBps(final) }
}

function fundWeight(engine: EquityFundEngine, assetId: FundAssetId): number {
  const s = engine.snapshot()
  return s.nav === 0 ? 0 : s.positions[assetId].units * s.prices[assetId] / s.nav
}

function tradeIntent(targetWeight: number): FundTradeIntent {
  return { assetId: 'mega-fund', targetWeight, recordThesis: false }
}

function executeFundRoute(engine: EquityFundEngine, policy: FundPolicy, targetWeight: number): void {
  if (policy === 'always-market') {
    engine.executeTarget(tradeIntent(targetWeight))
    return
  }

  if (policy === 'min-clip-split') {
    for (let clip = 0; clip < 40; clip += 1) {
      const current = fundWeight(engine, 'mega-fund')
      const gap = targetWeight - current
      if (Math.abs(gap) < .001) break
      const step = Math.min(.01, Math.abs(gap)) * Math.sign(gap)
      const result = engine.executeTarget(tradeIntent(current + step))
      if (!result.accepted) break
    }
    return
  }

  if (policy === 'always-rfq') {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = fundWeight(engine, 'mega-fund')
      if (Math.abs(targetWeight - current) < .001) break
      const requested = engine.requestDealerQuotes(tradeIntent(targetWeight), 5)
      if (!requested.accepted) break
      const rfq = engine.snapshot().activeDealerRfq
      if (!rfq || rfq.quotes.length === 0) break
      const best = [...rfq.quotes].sort((a, b) => rfq.side === 'buy' ? a.offer - b.offer : b.bid - a.bid)[0]
      const fill = engine.acceptDealerQuote(best.id, 1)
      if (!fill.accepted) break
    }
    return
  }

  engine.startWorkingOrder(tradeIntent(targetWeight), 'twap', 30)
}

function runFund(seed: number, policy: FundPolicy): Run {
  const engine = new EquityFundEngine({ seed, mandate: 'long-only', scenario: 'random', difficulty: 'standard', durationSeconds: 120, initialNav: 100_000_000 })
  executeFundRoute(engine, policy, .22)
  let secondDone = false
  let thirdDone = false
  while (engine.snapshot().status === 'running') {
    engine.tick(.5)
    const elapsed = engine.snapshot().elapsedSeconds
    if (!secondDone && elapsed >= 50) { executeFundRoute(engine, policy, .05); secondDone = true }
    if (!thirdDone && elapsed >= 85) { executeFundRoute(engine, policy, .20); thirdDone = true }
  }
  const final = engine.snapshot()
  return {
    score: final.score?.overall ?? 0,
    ret: final.nav / final.options.initialNav - 1,
    costBps: final.executionQuality.implementationShortfallBps,
  }
}

function evaluate(name: string, values: Run[], warningRules: Array<(score: number, ret: number, costBps: number) => string | undefined>): Result {
  const result: Result = { name, scores: values.map((x) => x.score), returns: values.map((x) => x.ret), costsBps: values.map((x) => x.costBps), warnings: [] }
  const avgScore = mean(result.scores), avgReturn = mean(result.returns), avgCostBps = mean(result.costsBps)
  for (const rule of warningRules) { const warning = rule(avgScore, avgReturn, avgCostBps); if (warning) result.warnings.push(warning) }
  return result
}

function addDominanceWarnings(results: Result[], prefix: string, maxWinShare = .72): void {
  const candidates = results.filter((result) => result.name.startsWith(prefix))
  if (candidates.length < 2) return
  const runCount = Math.min(...candidates.map((result) => result.scores.length))
  const wins = new Map(candidates.map((result) => [result.name, 0]))
  for (let index = 0; index < runCount; index += 1) {
    const bestScore = Math.max(...candidates.map((result) => result.scores[index]))
    const winners = candidates.filter((result) => Math.abs(result.scores[index] - bestScore) < 1e-9)
    for (const winner of winners) wins.set(winner.name, (wins.get(winner.name) ?? 0) + 1 / winners.length)
  }
  for (const result of candidates) {
    const share = (wins.get(result.name) ?? 0) / Math.max(1, runCount)
    if (share > maxWinShare) result.warnings.push(`Policy wins ${(share * 100).toFixed(0)}% of matched seeds; investigate route dominance.`)
  }
}

export function runCalibrationLab(): Result[] {
  const seeds = Array.from({ length: 32 }, (_, index) => 3101 + index * 37)
  const results: Result[] = []
  for (const instrument of [APEX_EQUITY, ORBX_EQUITY]) {
    for (const policy of ['immediate-hedge', 'min-clip-market', 'worked-hedge', 'warehouse-interdealer'] as DealerPolicy[]) {
      const runs = seeds.map((seed) => runDealer(seed, instrument, policy))
      results.push(evaluate(`dealer:${instrument.symbol}:${policy}`, runs, [
        (score) => score > 88 ? 'Simple scripted dealer policy scores above 88 on average; investigate dominance.' : undefined,
      ]))
    }
  }
  for (const policy of ['always-market', 'min-clip-split', 'always-rfq', 'always-twap'] as FundPolicy[]) {
    const runs = seeds.map((seed) => runFund(seed + 9000, policy))
    results.push(evaluate(`fund:${policy}`, runs, [
      (_score, _ret, costBps) => policy === 'min-clip-split' && costBps < 1.2 ? 'Minimum-clip splitting is too cheap; repeated child-order leakage is not binding.' : undefined,
      (score) => score > 90 ? 'Single execution route scores above 90 on average; investigate dominance.' : undefined,
    ]))
  }

  addDominanceWarnings(results, 'dealer:APEX:', .72)
  addDominanceWarnings(results, 'dealer:ORBX:', .72)
  addDominanceWarnings(results, 'fund:', .72)
  return results
}
