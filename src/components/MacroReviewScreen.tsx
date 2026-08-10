import { MACRO_ASSETS, MACRO_ASSET_MAP, MACRO_SCENARIOS } from '../engine/macro'
import type { MacroSessionSnapshot, PortfolioFactor } from '../engine/macro-types'
import { formatMoney, formatPercent } from '../lib/format'
import { downloadText } from '../lib/download'

interface Props { snapshot: MacroSessionSnapshot; onReplay: () => void; onNewSession: () => void }
const factors: PortfolioFactor[] = ['growth', 'inflation', 'policy', 'risk', 'energy', 'usd']

function coaching(snapshot: MacroSessionSnapshot): string[] {
  const result: string[] = []
  const totalReturn = snapshot.nav / snapshot.options.initialNav - 1
  if (snapshot.maxDrawdown < -0.07) result.push('Drawdown control was weak. Reduce gross exposure earlier when the path moves materially against the portfolio.')
  else result.push('Drawdown remained inside the mandate. Risk sizing did not overwhelm the portfolio path.')
  if (snapshot.turnover > 2.0) result.push('Turnover was high. More of the gross return was surrendered to repeated repositioning and transaction costs.')
  else result.push('Turnover was controlled relative to the 30-day horizon.')
  if (snapshot.dealerTrades > 0) result.push(`You executed ${snapshot.dealerTrades} block${snapshot.dealerTrades === 1 ? '' : 's'} through dealer RFQs, with estimated ${snapshot.dealerSavings >= 0 ? 'savings' : 'premium'} of ${formatMoney(Math.abs(snapshot.dealerSavings))} versus the direct-market benchmark.`)
  else result.push('No dealer RFQs were used. For larger reallocations, compare direct execution with dealer block liquidity rather than assuming the screen price is always cheapest.')
  const dominant = factors.reduce((best, factor) => Math.abs(snapshot.risk.factorExposure[factor]) > Math.abs(snapshot.risk.factorExposure[best]) ? factor : best, 'growth' as PortfolioFactor)
  if (Math.abs(snapshot.risk.factorExposure[dominant]) > 0.55) result.push(`The closing book remained heavily concentrated in ${dominant} risk. Check whether that concentration was intentional or simply accumulated through several positions.`)
  const thesisHit = snapshot.theses.length ? snapshot.theses.filter((item) => (item.outcomeReturn ?? 0) > 0).length / snapshot.theses.length : 0
  result.push(snapshot.theses.length === 0 ? 'No theses were recorded. The buy-side mode is most useful when positions are tied to explicit invalidation conditions.' : `Thesis hit rate was ${(thesisHit * 100).toFixed(0)}%. Review losing theses for whether the view, timing or sizing was the main error.`)
  if (totalReturn > 0 && snapshot.maxDrawdown > -0.04) result.push('The portfolio generated positive absolute return without relying on a large drawdown budget.')
  return result
}

export function MacroReviewScreen({ snapshot, onReplay, onNewSession }: Props) {
  if (!snapshot.score) return null
  const totalReturn = snapshot.nav / snapshot.options.initialNav - 1
  const totalPnl = snapshot.nav - snapshot.options.initialNav
  const assetRows = [...MACRO_ASSETS].sort((a, b) => Math.abs(snapshot.attribution.byAsset[b.id]) - Math.abs(snapshot.attribution.byAsset[a.id]))
  const factorRows = [...factors, 'idiosyncratic', 'transaction-costs'] as const
  const reconciliation = factorRows.reduce((sum, key) => sum + snapshot.attribution.byFactor[key], 0)
  const tips = coaching(snapshot)
  const exportReport = () => {
    const lines = [
      '# DealerSim Strategic Global Macro Report', '',
      `Scenario: ${MACRO_SCENARIOS[snapshot.resolvedScenario].label}`,
      `Difficulty: ${snapshot.options.difficulty}`,
      `Seed: ${snapshot.options.seed}`, '',
      '## Performance',
      `- Overall score: ${snapshot.score!.overall.toFixed(1)} / 100 (${snapshot.score!.rating})`,
      `- Return: ${formatPercent(totalReturn, 2)}`,
      `- P&L: ${formatMoney(totalPnl)}`,
      `- Maximum drawdown: ${formatPercent(Math.abs(snapshot.maxDrawdown), 2)}`,
      `- Turnover: ${formatPercent(snapshot.turnover, 0)}`,
      `- Transaction costs (incl. commissions): ${formatMoney(snapshot.transactionCosts)}`,
      `- Explicit commissions: ${formatMoney(snapshot.commissions)}`,
      `- Dealer savings vs direct: ${formatMoney(snapshot.dealerSavings)}`, '',
      '## Factor P&L',
      ...factorRows.map((factor) => `- ${factor === 'usd' ? 'USD' : factor.replaceAll('-', ' ')}: ${formatMoney(snapshot.attribution.byFactor[factor])}`), '',
      '## Coaching review',
      ...tips.map((tip) => `- ${tip}`), '',
      '_Synthetic educational simulation. Not live market data or investment advice._',
    ]
    downloadText(`dealersim-strategic-macro-report-${snapshot.options.seed}.md`, lines.join('\n'), 'text/markdown')
  }

  return <main className="macro-review-shell">
    <header className="macro-review-header"><div><p className="eyebrow">GLOBAL MACRO · SESSION REVIEW</p><h1>{snapshot.score.rating}</h1><p>{MACRO_SCENARIOS[snapshot.resolvedScenario].label} · 30-day synthetic mandate · seed {snapshot.options.seed}</p></div><div className="macro-review-actions"><button className="button button-ghost" type="button" onClick={exportReport}>Desk report</button><button className="button button-ghost" type="button" onClick={onReplay}>Replay seed</button><button className="button button-primary" type="button" onClick={onNewSession}>New mandate</button></div></header>
    <section className="macro-review-score-grid"><article><span>Overall score</span><strong>{snapshot.score.overall.toFixed(1)}</strong></article><article className={totalReturn >= 0 ? 'positive' : 'negative'}><span>Return</span><strong>{formatPercent(totalReturn, 2)}</strong><small>{formatMoney(totalPnl)} P&amp;L</small></article><article><span>Max drawdown</span><strong>{formatPercent(snapshot.maxDrawdown, 2)}</strong></article><article><span>Turnover</span><strong>{formatPercent(snapshot.turnover, 0)}</strong></article><article><span>Transaction costs</span><strong>{formatMoney(snapshot.transactionCosts)}</strong><small>{formatMoney(snapshot.commissions)} commissions</small></article><article className={snapshot.dealerSavings >= 0 ? 'positive' : 'negative'}><span>Dealer RFQ vs direct</span><strong>{snapshot.dealerSavings >= 0 ? '+' : '−'}{formatMoney(Math.abs(snapshot.dealerSavings))}</strong><small>{snapshot.dealerTrades} dealer fills</small></article></section>

    <div className="macro-review-grid">
      <section className="macro-review-panel"><div className="section-heading compact"><div><p className="eyebrow">SCORECARD</p><h2>Process quality</h2></div></div><div className="macro-score-bars">{([['Return', snapshot.score.return], ['Risk', snapshot.score.risk], ['Sizing', snapshot.score.sizing], ['Thesis', snapshot.score.thesis], ['Efficiency', snapshot.score.efficiency], ['Adaptability', snapshot.score.adaptability]] as const).map(([label, value]) => <div key={label}><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value.toFixed(0)}</strong></div>)}</div><div className="macro-coaching-list">{tips.map((tip, index) => <p key={index}>{tip}</p>)}</div></section>

      <section className="macro-review-panel"><div className="section-heading compact"><div><p className="eyebrow">P&amp;L ATTRIBUTION</p><h2>By asset</h2></div></div><div className="macro-attribution-table">{assetRows.map((asset) => <div key={asset.id}><span><b>{asset.symbol}</b><small>{asset.displayName}</small></span><strong className={snapshot.attribution.byAsset[asset.id] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byAsset[asset.id])}</strong></div>)}</div></section>

      <section className="macro-review-panel"><div className="section-heading compact"><div><p className="eyebrow">P&amp;L ATTRIBUTION</p><h2>By factor</h2></div></div><div className="macro-attribution-table factor-attribution">{factorRows.map((factor) => <div key={factor}><span><b>{factor === 'usd' ? 'USD' : factor.replaceAll('-', ' ')}</b></span><strong className={snapshot.attribution.byFactor[factor] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byFactor[factor])}</strong></div>)}<div className="reconciliation-row"><span><b>Reconciled P&amp;L</b><small>Factor + idiosyncratic + costs</small></span><strong className={Math.abs(reconciliation - totalPnl) < 10 ? 'positive' : 'warning'}>{formatMoney(reconciliation)} · residual {formatMoney(totalPnl - reconciliation)}</strong></div></div></section>

      <section className="macro-review-panel"><div className="section-heading compact"><div><p className="eyebrow">EXECUTION</p><h2>Dealer RFQ history</h2></div></div>{snapshot.dealerRfqs.length === 0 ? <p className="muted-line">No dealer RFQs requested.</p> : <div className="macro-attribution-table">{snapshot.dealerRfqs.slice(0, 10).map((rfq) => <div key={rfq.id}><span><b>D{rfq.day} · {MACRO_ASSET_MAP[rfq.assetId].symbol} · {rfq.status}</b><small>{rfq.side.toUpperCase()} {formatMoney(rfq.filledNotional ?? rfq.requestedNotional)}{rfq.filledNotional && rfq.filledNotional < rfq.requestedNotional ? ` of ${formatMoney(rfq.requestedNotional)}` : ''}{rfq.dealerName ? ` · ${rfq.dealerName}` : ''}</small></span><strong className={(rfq.savingsVsDirect ?? 0) >= 0 ? 'positive' : 'negative'}>{rfq.status === 'executed' ? `${(rfq.savingsVsDirect ?? 0) >= 0 ? '+' : '−'}${formatMoney(Math.abs(rfq.savingsVsDirect ?? 0))}` : '—'}</strong></div>)}</div>}</section>

      <section className="macro-review-panel macro-thesis-review"><div className="section-heading compact"><div><p className="eyebrow">THESIS JOURNAL</p><h2>What actually worked?</h2></div></div>{snapshot.theses.length === 0 ? <p className="muted-line">No recorded theses.</p> : <div className="macro-thesis-review-list">{snapshot.theses.slice().reverse().map((thesis) => { const asset = MACRO_ASSET_MAP[thesis.assetId]; const good = (thesis.outcomeReturn ?? 0) > 0; return <article key={thesis.id}><div><b>D{thesis.day} · {asset.symbol}</b><span className={good ? 'positive' : 'negative'}>{good ? 'Worked' : 'Did not work'} · {formatPercent(thesis.outcomeReturn ?? 0, 1)}</span></div><strong>{thesis.tag.replaceAll('-', ' ')} · target {formatPercent(thesis.targetWeight)}</strong><p>Invalidation: {thesis.invalidation || 'Not recorded'}</p></article> })}</div>}</section>
    </div>
  </main>
}
