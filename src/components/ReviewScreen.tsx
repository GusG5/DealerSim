import type { CSSProperties } from 'react'
import type { SessionSnapshot } from '../types'
import { formatInstrumentMoney, formatInstrumentSize, formatPercent, titleCase } from '../lib/format'
import { PriceChart } from './PriceChart'
import { DealerDecisionReplay } from './DealerDecisionReplay'

interface ReviewScreenProps {
  snapshot: SessionSnapshot
  resolvedScenario?: string
  onReplay: () => void
  onNewSession: () => void
  onOpenMethodology: () => void
}

export function ReviewScreen({
  snapshot,
  resolvedScenario,
  onReplay,
  onNewSession,
  onOpenMethodology,
}: ReviewScreenProps) {
  const score = snapshot.score
  if (!score) return null

  const metrics = snapshot.metrics
  const acceptanceRate = metrics.quotesSubmitted > 0 ? metrics.quotesAccepted / metrics.quotesSubmitted : 0
  const responseRate = metrics.rfqsReceived > 0 ? metrics.quotesSubmitted / metrics.rfqsReceived : 0
  const staleRate = metrics.quotesSubmitted > 0 ? metrics.staleQuotes / metrics.quotesSubmitted : 0
  const averageCommission = metrics.clientTrades > 0 ? snapshot.position.grossCommission / metrics.clientTrades : 0
  const netPnl = snapshot.currentEquity
  const tradingPnlBeforeCosts = snapshot.position.realisedPnl + snapshot.position.unrealisedPnl
  const reconciledNetPnl = tradingPnlBeforeCosts + snapshot.position.grossCommission - snapshot.position.hedgeCosts
  const reconciliationResidual = netPnl - reconciledNetPnl
  const internalisationRate = metrics.grossClientVolumeM > 0 ? metrics.internalisedVolumeM / metrics.grossClientVolumeM : 0
  const averageImpactCostPerExchangeUnit = metrics.exchangeHedgeVolumeM > 0 ? metrics.marketImpactCost / metrics.exchangeHedgeVolumeM : snapshot.options.instrument.impactCoefficientPips * snapshot.options.instrument.pipSize * snapshot.options.instrument.pnlMultiplier
  const impactAvoidedEstimate = Math.max(0, averageImpactCostPerExchangeUnit * metrics.internalisedVolumeM)
  const breakdown = [
    ['Risk-adjusted P&L', score.pnl, 25],
    ['Commission & flow', score.commission, 25],
    ['Inventory management', score.inventory, 20],
    ['Quote quality', score.quoteQuality, 10],
    ['Adverse selection', score.adverseSelection, 10],
    ['Execution discipline', score.execution, 10],
  ] as const

  const exportJson = () => {
    downloadBlob(
      `dealersim-${snapshot.options.seed}.json`,
      JSON.stringify(snapshot, null, 2),
      'application/json',
    )
  }

  const exportCsv = () => {
    const rows = [
      ['metric', 'value'],
      ['seed', snapshot.options.seed],
      ['scenario', resolvedScenario ?? snapshot.options.scenario],
      ['difficulty', snapshot.options.difficulty],
      ['instrument', snapshot.options.instrument.symbol],
      ['asset_class', snapshot.options.instrument.assetClass],
      ['score', score.overall],
      ['rating', score.rating],
      ['pnl_currency', snapshot.options.instrument.quoteCurrency],
      ['net_pnl', netPnl],
      ['gross_commission', snapshot.position.grossCommission],
      ['average_commission', averageCommission],
      ['realised_pnl', snapshot.position.realisedPnl],
      ['unrealised_pnl', snapshot.position.unrealisedPnl],
      ['hedge_costs', snapshot.position.hedgeCosts],
      ['max_drawdown', metrics.maximumDrawdown],
      ['max_inventory_m', metrics.maximumInventoryM],
      ['rfqs_received', metrics.rfqsReceived],
      ['quotes_submitted', metrics.quotesSubmitted],
      ['acceptance_rate', acceptanceRate],
      ['response_rate', responseRate],
      ['stale_quote_rate', staleRate],
      ['gross_client_volume', metrics.grossClientVolumeM],
      ['internalised_volume', metrics.internalisedVolumeM],
      ['internalisation_rate', internalisationRate],
      ['estimated_market_impact_avoided', impactAvoidedEstimate],
      ['exchange_hedge_volume', metrics.exchangeHedgeVolumeM],
      ['worked_hedge_volume', metrics.workedHedgeVolumeM],
      ['market_impact_cost', metrics.marketImpactCost],
      ['exchange_slippage_cost', metrics.exchangeSlippageCost],
      ['client_price_edge_pnl', metrics.clientPriceEdgePnl],
      ['client_buy_volume', metrics.clientBuyVolumeM],
      ['client_sell_volume', metrics.clientSellVolumeM],
    ]
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
    downloadBlob(`dealersim-${snapshot.options.seed}.csv`, csv, 'text/csv')
  }

  const exportReport = () => {
    const lines = [
      '# DealerSim Dealer Desk Report',
      '',
      `Instrument: ${snapshot.options.instrument.symbol}`,
      `Scenario: ${titleCase(resolvedScenario ?? snapshot.options.scenario)}`,
      `Difficulty: ${titleCase(snapshot.options.difficulty)}`,
      `Seed: ${snapshot.options.seed}`,
      '',
      '## Performance',
      `- Overall score: ${score.overall.toFixed(1)} / 100 (${score.rating})`,
      `- Net P&L: ${formatInstrumentMoney(netPnl, snapshot.options.instrument)}`,
      `- Gross commission: ${formatInstrumentMoney(snapshot.position.grossCommission, snapshot.options.instrument)}`,
      `- Maximum drawdown: ${formatInstrumentMoney(metrics.maximumDrawdown, snapshot.options.instrument)}`,
      '',
      '## Flow & risk',
      `- RFQs received: ${metrics.rfqsReceived}`,
      `- Quote acceptance: ${formatPercent(acceptanceRate)}`,
      `- Stale quote rate: ${formatPercent(staleRate)}`,
      `- Internalisation rate: ${formatPercent(internalisationRate)}`,
      `- Maximum inventory: ${formatInstrumentSize(metrics.maximumInventoryM, snapshot.options.instrument)}`,
      '',
      '## Execution',
      `- Exchange hedge volume: ${formatInstrumentSize(metrics.exchangeHedgeVolumeM, snapshot.options.instrument)}`,
      `- Worked hedge volume: ${formatInstrumentSize(metrics.workedHedgeVolumeM, snapshot.options.instrument)}`,
      `- Market impact cost: ${formatInstrumentMoney(metrics.marketImpactCost, snapshot.options.instrument)}`,
      `- Estimated impact avoided through matching: ${formatInstrumentMoney(impactAvoidedEstimate, snapshot.options.instrument)}`,
      '',
      '## Skill scorecard',
      ...breakdown.map(([label, value]) => `- ${label}: ${value.toFixed(1)} / 100`),
      '',
      '## Decision review',
      ...score.feedback.map((item) => `- ${item}`),
      '',
      '_Synthetic educational simulation. Not live market data or investment advice._',
    ]
    downloadBlob(`dealersim-dealer-report-${snapshot.options.seed}.md`, lines.join('\n'), 'text/markdown')
  }

  return (
    <main className="review-shell">
      <header className="review-header">
        <div className="brand-lockup">
          <span className="brand-mark">DS</span>
          <div>
            <p className="eyebrow">SESSION REVIEW</p>
            <h1>{score.rating}</h1>
            <p>
              {snapshot.options.instrument.symbol} · {titleCase(resolvedScenario ?? snapshot.options.scenario)} · {titleCase(snapshot.options.difficulty)} · seed {snapshot.options.seed}
            </p>
          </div>
        </div>
        <div className="review-actions">
          <button className="button button-ghost" type="button" onClick={exportCsv}>Export CSV</button>
          <button className="button button-ghost" type="button" onClick={exportJson}>Export JSON</button>
          <button className="button button-ghost" type="button" onClick={exportReport}>Desk report</button>
          <button className="button button-ghost" type="button" onClick={onOpenMethodology}>Methodology</button>
        </div>
      </header>

      <section className="score-hero">
        <div className="score-dial" style={{ '--score': `${score.overall * 3.6}deg` } as CSSProperties}>
          <div>
            <strong>{score.overall.toFixed(1)}</strong>
            <span>out of 100</span>
          </div>
        </div>
        <div className="score-summary">
          <p className="eyebrow">DESK ASSESSMENT</p>
          <h2>{score.rating}</h2>
          <p>
            DealerSim separates commercial activity from risk control: strong commission cannot fully offset stale pricing, uncontrolled inventory or forced liquidation.
          </p>
          <div className="score-buttons">
            <button className="button button-primary" type="button" onClick={onReplay}>Replay same seed</button>
            <button className="button button-ghost" type="button" onClick={onNewSession}>Configure new session</button>
          </div>
        </div>
      </section>

      <section className="review-metric-grid">
        <Metric label="Net P&L" value={formatInstrumentMoney(netPnl, snapshot.options.instrument)} tone={netPnl >= 0 ? 'positive' : 'negative'} />
        <Metric label="Gross commission" value={formatInstrumentMoney(snapshot.position.grossCommission, snapshot.options.instrument)} tone="commission" />
        <Metric label="Average commission" value={formatInstrumentMoney(averageCommission, snapshot.options.instrument)} />
        <Metric label="Hedge costs" value={formatInstrumentMoney(snapshot.position.hedgeCosts, snapshot.options.instrument)} tone="negative" />
        <Metric label="Maximum inventory" value={formatInstrumentSize(metrics.maximumInventoryM, snapshot.options.instrument)} />
        <Metric label="Maximum drawdown" value={formatInstrumentMoney(metrics.maximumDrawdown, snapshot.options.instrument)} tone="negative" />
        <Metric label="Quote acceptance" value={formatPercent(acceptanceRate)} />
        <Metric label="Stale quote rate" value={formatPercent(staleRate)} tone={staleRate > 0.18 ? 'negative' : 'positive'} />
        <Metric label="Internalisation rate" value={formatPercent(internalisationRate)} tone={internalisationRate > 0.35 ? 'positive' : ''} />
        <Metric label="Worked hedge volume" value={formatInstrumentSize(metrics.workedHedgeVolumeM, snapshot.options.instrument)} />
        <Metric label="Exchange hedge volume" value={formatInstrumentSize(metrics.exchangeHedgeVolumeM, snapshot.options.instrument)} />
        <Metric label="Market impact cost" value={formatInstrumentMoney(metrics.marketImpactCost, snapshot.options.instrument)} tone="negative" />
        <Metric label="Impact avoided via matching" value={formatInstrumentMoney(impactAvoidedEstimate, snapshot.options.instrument)} tone="positive" />
      </section>

      <div className="review-grid">
        <section className="review-panel score-breakdown-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">WEIGHTED SCORE</p>
              <h2>Performance breakdown</h2>
            </div>
          </div>
          <div className="score-breakdown-list">
            {breakdown.map(([label, value, weight]) => (
              <div className="score-breakdown-row" key={label}>
                <div>
                  <span>{label}</span>
                  <small>{weight}% weight</small>
                </div>
                <div className="score-bar"><span style={{ width: `${value}%` }} /></div>
                <strong>{value.toFixed(1)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="review-panel feedback-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">COACHING OUTPUT</p>
              <h2>Decision review</h2>
            </div>
          </div>
          <ol>
            {score.feedback.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </section>
      </div>

      <section className="review-panel replay-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">SESSION REPLAY</p>
            <h2>Price path and execution markers</h2>
          </div>
          <div className="replay-stats">
            <span>{metrics.clientTrades} client trades</span>
            <span>{metrics.hedgeTrades} hedges</span>
            <span>{metrics.softLimitBreaches} soft-limit breaches</span>
          </div>
        </div>
        <PriceChart history={snapshot.priceHistory} trades={snapshot.trades} instrument={snapshot.options.instrument} />
      </section>

      <DealerDecisionReplay snapshot={snapshot} />

      <section className="review-panel reconciliation-panel">
        <div className="section-heading compact">
          <div><p className="eyebrow">CONTROL CHECK</p><h2>P&amp;L reconciliation</h2></div>
          <span className={`status-chip ${Math.abs(reconciliationResidual) < 0.01 ? 'status-live' : 'status-warning'}`}>{Math.abs(reconciliationResidual) < 0.01 ? 'Reconciled' : 'Check required'}</span>
        </div>
        <div className="reconciliation-grid">
          <div><span>Realised + unrealised</span><strong className={tradingPnlBeforeCosts >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(tradingPnlBeforeCosts, snapshot.options.instrument)}</strong></div>
          <div><span>+ Client commission</span><strong className="positive">{formatInstrumentMoney(snapshot.position.grossCommission, snapshot.options.instrument)}</strong></div>
          <div><span>− Hedge execution costs</span><strong className="negative">{formatInstrumentMoney(snapshot.position.hedgeCosts, snapshot.options.instrument)}</strong></div>
          <div className="reconciliation-total"><span>= Reported net P&amp;L</span><strong className={netPnl >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(netPnl, snapshot.options.instrument)}</strong></div>
        </div>
        <p className="review-note">Accounting residual: <strong className={Math.abs(reconciliationResidual) < 0.01 ? 'positive' : 'negative'}>{formatInstrumentMoney(reconciliationResidual, snapshot.options.instrument, 2)}</strong>. The five-second markout remains a diagnostic and is not double-counted in net P&amp;L.</p>
      </section>

      <section className="review-panel attribution-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">P&amp;L ATTRIBUTION</p>
            <h2>Where the result came from</h2>
          </div>
        </div>
        <div className="attribution-grid">
          <Attribution label="Client price edge" value={metrics.clientPriceEdgePnl} instrument={snapshot.options.instrument} />
          <Attribution label="Gross commission" value={snapshot.position.grossCommission} instrument={snapshot.options.instrument} positiveOnly />
          <Attribution label="Exchange slippage" value={-metrics.exchangeSlippageCost} instrument={snapshot.options.instrument} />
          <Attribution label="Estimated market impact" value={-metrics.marketImpactCost} instrument={snapshot.options.instrument} />
          <Attribution label="Inventory / timing residual" value={netPnl - snapshot.position.grossCommission - metrics.clientPriceEdgePnl + metrics.exchangeSlippageCost + metrics.marketImpactCost} instrument={snapshot.options.instrument} />
          <Attribution label="Five-second client markout" value={metrics.adverseSelectionPnl} instrument={snapshot.options.instrument} />
        </div>
        <p className="review-note">Estimated exchange impact avoided through internal matching: <strong className="positive">{formatInstrumentMoney(impactAvoidedEstimate, snapshot.options.instrument)}</strong>. This is a training estimate based on the session&apos;s observed impact cost per exchange unit.</p>
      </section>
    </main>
  )
}

function Metric({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <article className="review-metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </article>
  )
}

function Attribution({ label, value, instrument, positiveOnly = false }: { label: string; value: number; instrument: SessionSnapshot['options']['instrument']; positiveOnly?: boolean }) {
  return (
    <div className="attribution-row">
      <span>{label}</span>
      <strong className={positiveOnly || value >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(value, instrument)}</strong>
    </div>
  )
}

function downloadBlob(filename: string, body: string, type: string): void {
  const blob = new Blob([body], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function csvEscape(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}
