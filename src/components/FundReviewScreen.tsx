import { FUND_ASSETS, FUND_DEALERS, FUND_SCENARIOS } from '../engine/fund'
import type { FundSessionSnapshot, FundSessionSummary } from '../engine/fund-types'
import { formatMoney, formatPercent } from '../lib/format'
import { downloadText } from '../lib/download'
import { FundDecisionReplay } from './FundDecisionReplay'

interface Props { snapshot: FundSessionSnapshot; priorAttempts: FundSessionSummary[]; onReplay: () => void; onNewSession: () => void }

export function FundReviewScreen({ snapshot, priorAttempts, onReplay, onNewSession }: Props) {
  const score = snapshot.score
  if (!score) return null
  const totalReturn = snapshot.nav / snapshot.options.initialNav - 1
  const benchmarkReturn = snapshot.benchmarkNav / snapshot.options.initialNav - 1
  const alpha = snapshot.options.mandate === 'long-only' ? totalReturn - benchmarkReturn : snapshot.attribution.alphaPnl / snapshot.options.initialNav
  const factorRows = Object.entries(snapshot.attribution.byFactor)
  const prior = priorAttempts.length > 1 ? priorAttempts[1] : undefined
  const q = snapshot.executionQuality
  const venueRows = ['direct-market', 'dealer-rfq', 'worked-order', 'auction'].map((venue) => {
    const trades = snapshot.trades.filter((trade) => trade.executionVenue === venue)
    const notional = trades.reduce((sum, trade) => sum + trade.tradedNotional, 0)
    const is = trades.reduce((sum, trade) => sum + trade.implementationShortfall, 0)
    const timing = trades.reduce((sum, trade) => sum + trade.timingCost, 0)
    return { venue, count: trades.length, notional, isBps: notional ? is / notional * 10000 : 0, timingBps: notional ? timing / notional * 10000 : 0 }
  })
  const dealerRows = FUND_DEALERS.map((dealer) => snapshot.dealerRelationships[dealer.id]).sort((a, b) => b.relationshipScore - a.relationshipScore)
  const theses = snapshot.theses.slice(-6).reverse()
  const exportReport = () => {
    const lines = [
      '# DealerSim Equity Fund Desk Report',
      '',
      `Mandate: ${snapshot.options.mandate === 'long-short' ? 'Long / Short Equity Hedge Fund' : 'Long-Only Equity Asset Management'}`,
      `Scenario: ${FUND_SCENARIOS[snapshot.resolvedScenario].label}`,
      `Difficulty: ${snapshot.options.difficulty}`,
      `Seed: ${snapshot.options.seed}`,
      '',
      '## Performance',
      `- Process score: ${score.overall.toFixed(1)} / 100 (${score.rating})`,
      `- Total return: ${formatPercent(totalReturn, 2)}`,
      `- ${snapshot.options.mandate === 'long-only' ? 'Benchmark return' : 'ES return'}: ${formatPercent(benchmarkReturn, 2)}`,
      `- ${snapshot.options.mandate === 'long-only' ? 'Active alpha' : 'Beta-adjusted alpha'}: ${formatPercent(alpha, 2)}`,
      `- Maximum drawdown: ${formatPercent(Math.abs(snapshot.maxDrawdown), 2)}`,
      '',
      '## Risk & execution',
      `- Peak gross exposure: ${formatPercent(snapshot.peakGrossExposure)}`,
      `- Peak beta exposure: ${snapshot.peakBetaExposure.toFixed(2)}`,
      `- Implementation shortfall: ${q.totalNotional ? `${q.implementationShortfallBps.toFixed(1)}bp` : 'n/a'}`,
      `- Trading + borrow costs: ${formatMoney(snapshot.transactionCosts + snapshot.borrowCosts)}`,
      `- Dealer savings vs direct: ${formatMoney(snapshot.dealerSavings)}`,
      '',
      '## Skill scorecard',
      `- Alpha / selection: ${score.alpha.toFixed(1)}`,
      `- Risk control: ${score.risk.toFixed(1)}`,
      `- Sizing: ${score.sizing.toFixed(1)}`,
      `- Execution: ${score.execution.toFixed(1)}`,
      `- Thesis discipline: ${score.thesis.toFixed(1)}`,
      `- Efficiency: ${score.efficiency.toFixed(1)}`,
      '',
      '## Asset P&L',
      ...FUND_ASSETS.map((asset) => `- ${asset.symbol}: ${formatMoney(snapshot.attribution.byAsset[asset.id])}`),
      '',
      '_Synthetic educational simulation. Not live market data or investment advice._',
    ]
    downloadText(`dealersim-fund-report-${snapshot.options.seed}.md`, lines.join('\n'), 'text/markdown')
  }

  return <main className="fund-review-shell">
    <header className="review-hero fund-review-hero"><div><p className="eyebrow">BUY-SIDE SESSION REVIEW</p><h1>{snapshot.options.mandate === 'long-short' ? 'Long / Short Equity Fund' : 'Long-Only Equity PM'}</h1><p>{FUND_SCENARIOS[snapshot.resolvedScenario].label} · seed {snapshot.options.seed}</p></div><div className="review-score"><span>Process score</span><strong>{score.overall.toFixed(1)}</strong><b>{score.rating}</b><button className="button button-ghost button-small" type="button" onClick={exportReport}>Desk report</button></div></header>

    <section className="fund-review-metrics">
      <article><span>Total return</span><strong className={totalReturn >= 0 ? 'positive' : 'negative'}>{formatPercent(totalReturn, 2)}</strong></article>
      <article><span>{snapshot.options.mandate === 'long-only' ? 'Benchmark' : 'ES return'}</span><strong>{formatPercent(benchmarkReturn, 2)}</strong></article>
      <article><span>{snapshot.options.mandate === 'long-only' ? 'Active alpha' : 'Beta-adjusted alpha'}</span><strong className={alpha >= 0 ? 'positive' : 'negative'}>{formatPercent(alpha, 2)}</strong></article>
      <article><span>Max drawdown</span><strong>{formatPercent(Math.abs(snapshot.maxDrawdown), 2)}</strong></article>
      <article><span>Peak gross</span><strong>{formatPercent(snapshot.peakGrossExposure)}</strong></article>
      <article><span>Implementation shortfall</span><strong className={q.implementationShortfallBps <= 0 ? 'positive' : q.implementationShortfallBps > 6 ? 'negative' : ''}>{q.totalNotional ? `${q.implementationShortfallBps.toFixed(1)}bp` : '—'}</strong></article>
      <article><span>Trading + borrow</span><strong>{formatMoney(snapshot.transactionCosts + snapshot.borrowCosts)}</strong></article>
      <article><span>Dealer savings</span><strong className={snapshot.dealerSavings >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.dealerSavings)}</strong></article>
    </section>

    {prior && <section className="replay-comparison"><div><p className="eyebrow">SAME-SEED REPLAY</p><h2>Attempt comparison</h2><p>Same synthetic path, different decisions. Use replay to isolate process improvements.</p></div><div className="replay-comparison-metrics"><span><small>Previous score</small><strong>{prior.score.toFixed(1)}</strong></span><span><small>Current score</small><strong>{score.overall.toFixed(1)}</strong></span><span><small>Score change</small><strong className={score.overall >= prior.score ? 'positive' : 'negative'}>{score.overall >= prior.score ? '+' : ''}{(score.overall - prior.score).toFixed(1)}</strong></span><span><small>Return change</small><strong className={totalReturn >= prior.returnPct ? 'positive' : 'negative'}>{formatPercent(totalReturn - prior.returnPct, 2)}</strong></span></div></section>}

    <FundDecisionReplay snapshot={snapshot} />

    <div className="fund-review-grid fund-review-grid-expanded">
      {snapshot.options.preMarketPlan && <section className="review-panel premarket-plan-review"><div className="section-heading compact"><div><p className="eyebrow">MORNING PLAN</p><h2>Opening view → closing book</h2></div></div><div className="premarket-plan-table">{FUND_ASSETS.map((asset) => { const plan = snapshot.options.preMarketPlan?.[asset.id]; if (!plan) return null; const finalWeight = snapshot.nav ? snapshot.positions[asset.id].units * snapshot.prices[asset.id] / snapshot.nav : 0; const delta = finalWeight - plan.plannedWeight; return <div key={asset.id}><span><b>{asset.symbol}</b><small>{plan.view.replaceAll('-', ' ')} · risk: {plan.keyRisk || 'not recorded'}</small></span><span><small>Open</small><strong>{formatPercent(plan.plannedWeight, 1)}</strong></span><span><small>Close</small><strong>{formatPercent(finalWeight, 1)}</strong></span><span><small>Change</small><strong className={Math.abs(delta) > .015 ? 'amber' : ''}>{delta >= 0 ? '+' : ''}{formatPercent(delta, 1)}</strong></span></div> })}</div></section>}

      <section className="review-panel"><div className="section-heading compact"><div><p className="eyebrow">ASSET ATTRIBUTION</p><h2>Where P&amp;L came from</h2></div></div><div className="fund-review-table">{FUND_ASSETS.map((asset) => <div key={asset.id}><span><b>{asset.symbol}</b><small>{asset.sector}</small></span><strong className={snapshot.attribution.byAsset[asset.id] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byAsset[asset.id])}</strong></div>)}</div></section>

      <section className="review-panel"><div className="section-heading compact"><div><p className="eyebrow">FACTOR ATTRIBUTION</p><h2>Beta versus differentiated alpha</h2></div></div><div className="fund-review-table">{factorRows.map(([factor, pnl]) => <div key={factor}><span>{factor.replaceAll('-', ' ')}</span><strong className={pnl >= 0 ? 'positive' : 'negative'}>{formatMoney(pnl)}</strong></div>)}<div><span><b>Estimated beta P&amp;L</b></span><strong>{formatMoney(snapshot.attribution.betaPnl)}</strong></div><div><span><b>Residual alpha P&amp;L</b></span><strong className={snapshot.attribution.alphaPnl >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.alphaPnl)}</strong></div></div></section>

      <section className="review-panel"><div className="section-heading compact"><div><p className="eyebrow">EXECUTION QUALITY</p><h2>Arrival price → fill</h2></div></div><div className="fund-review-table">{venueRows.map((row) => <div key={row.venue}><span><b>{venueLabel(row.venue)}</b><small>{row.count} fills · {formatMoney(row.notional)}</small></span><strong className={row.isBps <= 0 ? 'positive' : row.isBps > 6 ? 'negative' : ''}>{row.count ? `${row.isBps.toFixed(1)}bp IS` : '—'}</strong></div>)}<div><span><b>Timing cost</b><small>market move while working / RFQing</small></span><strong className={q.timingCostBps <= 0 ? 'positive' : 'negative'}>{q.totalNotional ? `${q.timingCostBps.toFixed(1)}bp` : '—'}</strong></div><div><span><b>Market impact / spread</b><small>fill price versus contemporaneous mid</small></span><strong>{q.totalNotional ? `${q.marketImpactBps.toFixed(1)}bp` : '—'}</strong></div><div><span><b>Dealer improvement</b><small>versus direct synthetic benchmark</small></span><strong className={q.dealerSavingBps >= 0 ? 'positive' : 'negative'}>{q.dealerNotional ? `${q.dealerSavingBps.toFixed(1)}bp` : '—'}</strong></div></div></section>

      <section className="review-panel"><div className="section-heading compact"><div><p className="eyebrow">DEALER NETWORK</p><h2>Counterparty performance</h2></div></div><div className="fund-review-table">{dealerRows.map((dealer) => <div key={dealer.dealerId}><span><b>{dealer.dealerName}</b><small>{dealer.specialties.map((id) => id.replace('-fund','').toUpperCase()).join(' · ')}</small></span><strong>{dealer.relationshipScore.toFixed(0)}/100 <small>{dealer.rfqs ? `${(dealer.rfqFillRate * 100).toFixed(0)}% fills` : 'new'}</small></strong></div>)}</div></section>

      <section className="review-panel"><div className="section-heading compact"><div><p className="eyebrow">THESIS REVIEW</p><h2>Did the reason for the trade work?</h2></div></div>{theses.length ? <div className="thesis-review-list">{theses.map((thesis) => { const asset = FUND_ASSETS.find((item) => item.id === thesis.assetId)!; const outcome = thesis.outcomeReturn ?? 0; return <article key={thesis.id}><div><strong>{asset.symbol} · {thesis.tag.replaceAll('-',' ')}</strong><span>{thesis.targetWeight >= thesis.previousWeight ? 'Long / add' : 'Short / reduce'} · conviction {thesis.conviction}/5</span></div><b className={outcome > .005 ? 'positive' : outcome < -.005 ? 'negative' : ''}>{formatPercent(outcome, 2)}</b><p>{thesisComment(outcome, thesis.invalidation)}</p></article> })}</div> : <div className="progress-empty"><strong>No theses recorded.</strong><p>Use thesis recording for conviction positions you want reviewed rather than routine hedges.</p></div>}</section>

      <section className="review-panel"><div className="section-heading compact"><div><p className="eyebrow">PROCESS</p><h2>Skill components</h2></div></div><div className="score-component-list">{[['Alpha', score.alpha], ['Risk', score.risk], ['Sizing', score.sizing], ['Execution', score.execution], ['Thesis', score.thesis], ['Efficiency', score.efficiency]].map(([name, value]) => <div key={String(name)}><span>{name}</span><div><i style={{ width: `${Number(value)}%` }} /></div><strong>{Number(value).toFixed(0)}</strong></div>)}</div><div className="fund-coaching-box"><strong>Process diagnosis</strong><p>{processDiagnosis(snapshot)}</p><p>Dealer fills: {snapshot.dealerTrades}. Recorded theses: {snapshot.theses.length}. Turnover: {formatPercent(snapshot.turnover)}. Correlation regime ended <b>{snapshot.marketContext.correlationRegime.replace('-',' ')}</b>.</p></div></section>
    </div>

    <div className="review-actions"><button className="button button-ghost" onClick={onReplay}>Replay same seed</button><button className="button button-primary" onClick={onNewSession}>New buy-side session</button></div>
  </main>
}

function venueLabel(value: string) { return value === 'direct-market' ? 'Direct market' : value === 'dealer-rfq' ? 'Dealer RFQ' : value === 'auction' ? 'Opening / closing auction' : 'Worked order' }
function thesisComment(outcome: number, invalidation: string) { if (outcome > .01) return `The directional thesis worked. ${invalidation ? `Original invalidation: ${invalidation}` : 'Consider whether the position size matched your conviction.'}`; if (outcome < -.01) return `The trade moved materially against the thesis. ${invalidation ? `Revisit whether “${invalidation}” was reached early enough.` : 'No invalidation condition was recorded, which makes disciplined reassessment harder.'}`; return invalidation ? `Outcome was mixed / unresolved. Invalidation was: ${invalidation}` : 'Outcome was mixed and no explicit invalidation was recorded.' }
function processDiagnosis(snapshot: FundSessionSnapshot) { const q = snapshot.executionQuality; if (snapshot.options.mandate === 'long-short' && snapshot.peakBetaExposure > .55) return 'A large share of risk came from broad market beta. Consider whether ES hedging could isolate the stock-selection views more cleanly.'; if (q.totalNotional && q.implementationShortfallBps > 7) return 'Execution leakage was high. Compare dealer RFQs and liquidity-sensitive working against immediately crossing large blocks.'; if (snapshot.peakConcentration > .22) return 'Concentration became a major risk driver. Strong conviction is useful, but the portfolio became dependent on a small number of outcomes.'; if (snapshot.theses.length === 0) return 'Risk was controlled, but there is little recorded evidence of why conviction positions were taken. Record theses selectively so the review can distinguish process from outcome.'; return 'The book was reasonably controlled. Focus the replay on whether the same views can be expressed with lower execution leakage, cleaner factor exposures or better sizing.' }
