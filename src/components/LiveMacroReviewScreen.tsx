import { MACRO_ASSETS, MACRO_ASSET_MAP, MACRO_SCENARIOS } from '../engine/macro'
import type { LiveMacroSessionSnapshot } from '../engine/live-macro-types'
import type { PortfolioFactor } from '../engine/macro-types'
import { formatMoney, formatPercent } from '../lib/format'
import { downloadText } from '../lib/download'

interface Props { snapshot: LiveMacroSessionSnapshot; onReplay: () => void; onNewSession: () => void }
const factors: PortfolioFactor[] = ['growth', 'inflation', 'policy', 'risk', 'energy', 'usd']

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

function coaching(snapshot: LiveMacroSessionSnapshot): string[] {
  const result: string[] = []
  if (snapshot.maxDrawdown < -0.07) result.push('Drawdown control was weak. Reduce or hedge gross exposure sooner when a live thesis moves materially against you.')
  else result.push('Drawdown stayed inside the mandate while markets moved continuously.')
  if (snapshot.turnover > 2.5) result.push('Turnover was high for a live macro session. Repeated resizing surrendered too much P&L to execution costs.')
  else result.push('Turnover was reasonably controlled relative to the live session horizon.')
  if (snapshot.dealerTrades > 0) result.push(`Dealer RFQs produced ${snapshot.dealerSavings >= 0 ? 'estimated savings' : 'an estimated premium'} of ${formatMoney(Math.abs(snapshot.dealerSavings))} versus direct execution.`)
  else result.push('You never used dealer block liquidity. Compare RFQs with direct execution for larger reallocations rather than treating the screen as the only venue.')
  const completedWork = snapshot.workingOrders.filter((order) => order.status === 'completed')
  if (completedWork.length > 0) result.push(`${completedWork.length} worked order${completedWork.length === 1 ? '' : 's'} completed. Compare their cost with your direct-market trades and whether market risk while working was worth it.`)
  if (snapshot.theses.length === 0) result.push('No theses were journalled. Live mode does not force journalling, but recording major positions improves post-session review.')
  return result
}

export function LiveMacroReviewScreen({ snapshot, onReplay, onNewSession }: Props) {
  if (!snapshot.score) return null
  const totalReturn = snapshot.nav / snapshot.options.initialNav - 1
  const totalPnl = snapshot.nav - snapshot.options.initialNav
  const assetRows = [...MACRO_ASSETS].sort((a, b) => Math.abs(snapshot.attribution.byAsset[b.id]) - Math.abs(snapshot.attribution.byAsset[a.id]))
  const factorRows = [...factors, 'idiosyncratic', 'transaction-costs'] as const
  const reconciliation = factorRows.reduce((sum, key) => sum + snapshot.attribution.byFactor[key], 0)
  const tips = coaching(snapshot)
  const directTrades = snapshot.trades.filter((trade) => trade.executionVenue === 'direct-market').length
  const workedTrades = snapshot.trades.filter((trade) => trade.executionVenue === 'worked-order').length
  const exportReport = () => {
    const lines = [
      '# DealerSim Global Macro Trader Report', '',
      `Scenario: ${MACRO_SCENARIOS[snapshot.resolvedScenario].label}`,
      `Difficulty: ${snapshot.options.difficulty}`,
      `Seed: ${snapshot.options.seed}`,
      `Session length: ${Math.round(snapshot.options.durationSeconds / 60)} minutes`, '',
      '## Performance',
      `- Overall score: ${snapshot.score!.overall.toFixed(1)} / 100 (${snapshot.score!.rating})`,
      `- Return: ${formatPercent(totalReturn, 2)}`,
      `- P&L: ${formatMoney(totalPnl)}`,
      `- Maximum drawdown: ${formatPercent(Math.abs(snapshot.maxDrawdown), 2)}`,
      `- Peak gross exposure: ${formatPercent(snapshot.peakGrossExposure)}`, '',
      '## Execution',
      `- Direct market fills: ${directTrades}`,
      `- Worked fills: ${workedTrades}`,
      `- Dealer fills: ${snapshot.dealerTrades}`,
      `- Dealer savings vs direct: ${formatMoney(snapshot.dealerSavings)}`,
      `- Transaction costs (incl. commissions): ${formatMoney(snapshot.transactionCosts)}`,
      `- Explicit commissions: ${formatMoney(snapshot.commissions)}`, '',
      '## Factor P&L',
      ...factorRows.map((factor) => `- ${factor === 'usd' ? 'USD' : factor.replaceAll('-', ' ')}: ${formatMoney(snapshot.attribution.byFactor[factor])}`), '',
      '## Coaching review',
      ...tips.map((tip) => `- ${tip}`), '',
      '_Synthetic educational simulation. Not live market data or investment advice._',
    ]
    downloadText(`dealersim-live-macro-report-${snapshot.options.seed}.md`, lines.join('\n'), 'text/markdown')
  }

  return <main className="macro-review-shell">
    <header className="macro-review-header"><div><p className="eyebrow">GLOBAL MACRO TRADER · LIVE REVIEW</p><h1>{snapshot.score.rating}</h1><p>{MACRO_SCENARIOS[snapshot.resolvedScenario].label} · {Math.round(snapshot.options.durationSeconds / 60)}-minute live mandate · seed {snapshot.options.seed}</p></div><div className="macro-review-actions"><button className="button button-ghost" type="button" onClick={exportReport}>Desk report</button><button className="button button-ghost" type="button" onClick={onReplay}>Replay seed</button><button className="button button-primary" type="button" onClick={onNewSession}>New buy-side session</button></div></header>
    <section className="macro-review-score-grid"><article><span>Overall score</span><strong>{snapshot.score.overall.toFixed(1)}</strong></article><article className={totalReturn >= 0 ? 'positive' : 'negative'}><span>Return</span><strong>{formatPercent(totalReturn, 2)}</strong><small>{formatMoney(totalPnl)} P&amp;L</small></article><article><span>Max drawdown</span><strong>{formatPercent(snapshot.maxDrawdown, 2)}</strong></article><article><span>Turnover</span><strong>{formatPercent(snapshot.turnover, 0)}</strong></article><article><span>Transaction costs</span><strong>{formatMoney(snapshot.transactionCosts)}</strong><small>{formatMoney(snapshot.commissions)} commissions</small></article><article className={snapshot.dealerSavings >= 0 ? 'positive' : 'negative'}><span>Dealer RFQ vs direct</span><strong>{snapshot.dealerSavings >= 0 ? '+' : '−'}{formatMoney(Math.abs(snapshot.dealerSavings))}</strong><small>{snapshot.dealerTrades} dealer fills</small></article></section>

    {snapshot.options.preMarketPlan && <section className="macro-review-panel macro-morning-plan"><div className="section-heading compact"><div><p className="eyebrow">MORNING PLAN</p><h2>Opening macro view → closing book</h2></div></div><div className="premarket-plan-table">{MACRO_ASSETS.map((asset) => { const plan = snapshot.options.preMarketPlan?.[asset.id]; if (!plan) return null; const finalWeight = snapshot.nav ? snapshot.positions[asset.id].units * snapshot.prices[asset.id] / snapshot.nav : 0; const delta = finalWeight - plan.plannedWeight; return <div key={asset.id}><span><b>{asset.symbol}</b><small>{plan.view} · risk: {plan.keyRisk || 'not recorded'}</small></span><span><small>Open</small><strong>{formatPercent(plan.plannedWeight, 1)}</strong></span><span><small>Close</small><strong>{formatPercent(finalWeight, 1)}</strong></span><span><small>Change</small><strong>{delta >= 0 ? '+' : ''}{formatPercent(delta, 1)}</strong></span></div> })}</div></section>}

    <div className="macro-review-grid">
      <section className="macro-review-panel"><div className="section-heading compact"><div><p className="eyebrow">SCORECARD</p><h2>Live process quality</h2></div></div><div className="macro-score-bars">{([['Return', snapshot.score.return], ['Risk', snapshot.score.risk], ['Sizing', snapshot.score.sizing], ['Thesis', snapshot.score.thesis], ['Efficiency', snapshot.score.efficiency], ['Adaptability', snapshot.score.adaptability]] as const).map(([label, value]) => <div key={label}><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value.toFixed(0)}</strong></div>)}</div><div className="macro-coaching-list">{tips.map((tip, index) => <p key={index}>{tip}</p>)}</div></section>

      <section className="macro-review-panel"><div className="section-heading compact"><div><p className="eyebrow">P&amp;L ATTRIBUTION</p><h2>By asset</h2></div></div><div className="macro-attribution-table">{assetRows.map((asset) => <div key={asset.id}><span><b>{asset.symbol}</b><small>{asset.displayName}</small></span><strong className={snapshot.attribution.byAsset[asset.id] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byAsset[asset.id])}</strong></div>)}</div></section>

      <section className="macro-review-panel"><div className="section-heading compact"><div><p className="eyebrow">P&amp;L ATTRIBUTION</p><h2>By factor</h2></div></div><div className="macro-attribution-table factor-attribution">{factorRows.map((factor) => <div key={factor}><span><b>{factor === 'usd' ? 'USD' : factor.replaceAll('-', ' ')}</b></span><strong className={snapshot.attribution.byFactor[factor] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byFactor[factor])}</strong></div>)}<div className="reconciliation-row"><span><b>Reconciled P&amp;L</b><small>Factor + idiosyncratic + costs</small></span><strong className={Math.abs(reconciliation - totalPnl) < 25 ? 'positive' : 'warning'}>{formatMoney(reconciliation)} · residual {formatMoney(totalPnl - reconciliation)}</strong></div></div></section>

      <section className="macro-review-panel"><div className="section-heading compact"><div><p className="eyebrow">EXECUTION</p><h2>How you got the risk on</h2></div></div><div className="macro-attribution-table"><div><span><b>Direct market</b><small>Immediate execution</small></span><strong>{directTrades}</strong></div><div><span><b>Worked clips</b><small>TWAP / liquidity-sensitive fills</small></span><strong>{workedTrades}</strong></div><div><span><b>Dealer fills</b><small>Firm RFQ blocks</small></span><strong>{snapshot.dealerTrades}</strong></div>{snapshot.dealerRfqs.slice(0, 8).map((rfq) => <div key={rfq.id}><span><b>{clock(rfq.timestamp)} · {MACRO_ASSET_MAP[rfq.assetId].symbol} · {rfq.status}</b><small>{rfq.side.toUpperCase()} {formatMoney(rfq.filledNotional ?? rfq.requestedNotional)}{rfq.dealerName ? ` · ${rfq.dealerName}` : ''}</small></span><strong className={(rfq.savingsVsDirect ?? 0) >= 0 ? 'positive' : 'negative'}>{rfq.status === 'executed' ? `${(rfq.savingsVsDirect ?? 0) >= 0 ? '+' : '−'}${formatMoney(Math.abs(rfq.savingsVsDirect ?? 0))}` : '—'}</strong></div>)}</div></section>

      <section className="macro-review-panel macro-thesis-review"><div className="section-heading compact"><div><p className="eyebrow">THESIS JOURNAL</p><h2>Major positions you chose to document</h2></div></div>{snapshot.theses.length === 0 ? <p className="muted-line">No recorded theses. This is allowed in live mode.</p> : <div className="macro-thesis-review-list">{snapshot.theses.slice().reverse().map((thesis) => { const asset = MACRO_ASSET_MAP[thesis.assetId]; const good = (thesis.outcomeReturn ?? 0) > 0; return <article key={thesis.id}><div><b>{clock(thesis.timestamp)} · {asset.symbol}</b><span className={good ? 'positive' : 'negative'}>{good ? 'Worked' : 'Did not work'} · {formatPercent(thesis.outcomeReturn ?? 0, 1)}</span></div><strong>{thesis.tag.replaceAll('-', ' ')} · target {formatPercent(thesis.targetWeight)}</strong><p>Invalidation: {thesis.invalidation || 'Not recorded'}</p></article>})}</div>}</section>
    </div>
  </main>
}
