import type { MultiSessionSnapshot } from '../types'
import { formatInstrumentMoney, formatInstrumentSize, formatMoney, formatPercent, titleCase } from '../lib/format'
import { downloadText } from '../lib/download'

interface MultiReviewScreenProps {
  snapshot: MultiSessionSnapshot
  onReplay: () => void
  onNewSession: () => void
  onOpenMethodology: () => void
}

export function MultiReviewScreen({ snapshot, onReplay, onNewSession, onOpenMethodology }: MultiReviewScreenProps) {
  const score = snapshot.score
  if (!score) return null
  const acceptanceRate = snapshot.portfolio.quotesSubmitted > 0
    ? snapshot.portfolio.quotesAccepted / snapshot.portfolio.quotesSubmitted
    : 0
  const attribution = snapshot.attribution
  const attributionReconciled = attribution
    ? attribution.commission + attribution.clientPriceEdge + attribution.exchangeSlippage + attribution.marketImpact + attribution.inventoryAndTiming
    : snapshot.portfolio.totalPnl
  const reconciliationResidual = snapshot.portfolio.totalPnl - attributionReconciled
  const exportReport = () => {
    const lines = [
      '# DealerSim Cross-Asset Dealer Desk Report', '',
      `Desk: ${snapshot.options.instruments.map((instrument) => instrument.symbol).join(' + ')}`,
      `Scenario: ${titleCase(snapshot.options.scenario)}`,
      `Difficulty: ${titleCase(snapshot.options.difficulty)}`,
      `Seed: ${snapshot.options.seed}`, '',
      '## Portfolio performance',
      `- Overall score: ${score.overall.toFixed(1)} / 100 (${score.rating})`,
      `- P&L: ${formatMoney(snapshot.portfolio.totalPnl)}`,
      `- Commission: ${formatMoney(snapshot.portfolio.totalCommission)}`,
      `- Quote acceptance: ${formatPercent(acceptanceRate)}`,
      `- Peak gross risk: ${formatPercent(snapshot.portfolio.peakGrossRiskUtilisation)}`,
      `- RFQs missed: ${snapshot.portfolio.rfqsExpired}`, '',
      '## Desk legs',
      ...snapshot.legs.map((leg) => `- ${leg.options.instrument.symbol}: score ${leg.score?.overall.toFixed(1) ?? 'n/a'}, P&L ${formatInstrumentMoney(leg.currentEquity, leg.options.instrument)}, max inventory ${formatInstrumentSize(leg.metrics.maximumInventoryM, leg.options.instrument)}`), '',
      '## Coaching review',
      ...score.feedback.map((item) => `- ${item}`), '',
      '_Synthetic educational simulation. Not live market data or investment advice._',
    ]
    downloadText(`dealersim-cross-asset-report-${snapshot.options.seed}.md`, lines.join('\n'), 'text/markdown')
  }

  return (
    <main className="review-shell multi-review-shell">
      <header className="review-header">
        <div>
          <p className="eyebrow">CROSS-ASSET SESSION REVIEW</p>
          <h1>{snapshot.options.instruments.map((instrument) => instrument.symbol).join(' + ')}</h1>
          <p>{titleCase(snapshot.options.scenario)} · {titleCase(snapshot.options.difficulty)} · seed {snapshot.options.seed}</p>
        </div>
        <div className="review-actions">
          <button className="button button-ghost" type="button" onClick={exportReport}>Desk report</button>
          <button className="button button-ghost" type="button" onClick={onOpenMethodology}>Methodology</button>
          <button className="button button-ghost" type="button" onClick={onReplay}>Replay seed</button>
          <button className="button button-primary" type="button" onClick={onNewSession}>New session</button>
        </div>
      </header>

      <section className="review-score-grid">
        <article className="score-hero">
          <span>Portfolio score</span>
          <strong>{score.overall.toFixed(1)}</strong>
          <em>{score.rating}</em>
        </article>
        <article><span>Portfolio P&amp;L</span><strong className={snapshot.portfolio.totalPnl >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.portfolio.totalPnl)}</strong></article>
        <article><span>Commission (USD eq.)</span><strong>{formatMoney(snapshot.portfolio.totalCommission)}</strong></article>
        <article><span>Acceptance</span><strong>{formatPercent(acceptanceRate)}</strong></article>
        <article><span>Peak gross risk</span><strong>{formatPercent(snapshot.portfolio.peakGrossRiskUtilisation)}</strong></article>
        <article><span>RFQs missed</span><strong>{snapshot.portfolio.rfqsExpired}</strong></article>
      </section>

      <section className="multi-review-leg-grid">
        {snapshot.legs.map((leg) => {
          const instrument = leg.options.instrument
          return (
            <article className="multi-review-leg" key={instrument.id}>
              <div className="section-heading compact"><div><p className="eyebrow">{instrument.symbol}</p><h2>{instrument.displayName}</h2></div><strong>{leg.score?.overall.toFixed(1) ?? '—'}</strong></div>
              <div className="multi-review-leg-metrics">
                <div><span>P&amp;L</span><strong className={leg.currentEquity >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(leg.currentEquity, instrument)}</strong></div>
                <div><span>Commission</span><strong>{formatInstrumentMoney(leg.position.grossCommission, instrument)}</strong></div>
                <div><span>Max inventory</span><strong>{formatInstrumentSize(leg.metrics.maximumInventoryM, instrument)}</strong></div>
                <div><span>Internalised</span><strong>{formatInstrumentSize(leg.metrics.internalisedVolumeM, instrument)}</strong></div>
                <div><span>Interdealer</span><strong>{formatInstrumentSize(leg.metrics.interdealerHedgeVolumeM, instrument)}</strong></div>
                <div><span>RFQs</span><strong>{leg.metrics.rfqsReceived}</strong></div>
                <div><span>Expired</span><strong>{leg.metrics.rfqsExpired}</strong></div>
              </div>
            </article>
          )
        })}
      </section>

      {snapshot.attribution && (
        <section className="review-attribution-section reconciliation-panel">
          <div className="section-heading compact"><div><p className="eyebrow">CONTROL CHECK</p><h2>Portfolio P&amp;L reconciliation</h2></div><span className={`status-chip ${Math.abs(reconciliationResidual) < 0.01 ? 'status-live' : 'status-warning'}`}>{Math.abs(reconciliationResidual) < 0.01 ? 'Reconciled' : 'Check required'}</span></div>
          <div className="reconciliation-grid multi-reconciliation-grid">
            <div><span>Client commission</span><strong className="positive">{formatMoney(snapshot.attribution.commission)}</strong></div>
            <div><span>Client price edge</span><strong className={snapshot.attribution.clientPriceEdge >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.clientPriceEdge)}</strong></div>
            <div><span>Exchange slippage</span><strong className="negative">{formatMoney(snapshot.attribution.exchangeSlippage)}</strong></div>
            <div><span>Market impact</span><strong className="negative">{formatMoney(snapshot.attribution.marketImpact)}</strong></div>
            <div><span>Inventory &amp; timing</span><strong className={snapshot.attribution.inventoryAndTiming >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.inventoryAndTiming)}</strong></div>
            <div className="reconciliation-total"><span>= Portfolio P&amp;L</span><strong className={snapshot.portfolio.totalPnl >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.portfolio.totalPnl)}</strong></div>
          </div>
          <p className="review-note">Residual: <strong className={Math.abs(reconciliationResidual) < 0.01 ? 'positive' : 'negative'}>{formatMoney(reconciliationResidual, 2)}</strong>. Cross-market values are converted to synthetic USD-equivalent reporting using the methodology assumptions.</p>
        </section>
      )}

      {snapshot.attribution && (
        <section className="review-attribution-section">
          <div className="section-heading compact"><div><p className="eyebrow">P&amp;L ATTRIBUTION</p><h2>Where the desk made and lost money</h2></div><span className="status-chip">{(snapshot.attribution.internalisationRate * 100).toFixed(0)}% internalised</span></div>
          <div className="attribution-grid">
            {[
              ['Client commission', snapshot.attribution.commission],
              ['Client price edge', snapshot.attribution.clientPriceEdge],
              ['Exchange slippage', snapshot.attribution.exchangeSlippage],
              ['Market impact', snapshot.attribution.marketImpact],
              ['Inventory & timing', snapshot.attribution.inventoryAndTiming],
              ['Net P&L', snapshot.attribution.netPnl],
            ].map(([label, value]) => (
              <div key={label as string}><span>{label}</span><strong className={Number(value) >= 0 ? 'positive' : 'negative'}>{formatMoney(Number(value))}</strong></div>
            ))}
          </div>
          <div className="attribution-diagnostics">
            <span>Adverse-selection markout: <strong className={snapshot.attribution.adverseSelectionDiagnostic >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.adverseSelectionDiagnostic)}</strong></span>
            <span>Estimated exchange impact avoided through matching: <strong className="positive">{formatMoney(snapshot.attribution.impactAvoidedEstimate)}</strong></span>
          </div>
        </section>
      )}

      <section className="review-calendar-section">
        <div className="section-heading compact"><div><p className="eyebrow">MACRO TAPE</p><h2>Released data during the session</h2></div></div>
        <div className="review-calendar-grid">
          {snapshot.calendar.map((event) => <div key={event.id}><strong>{event.name}</strong><span>{event.status === 'released' ? `${formatCalendarValue(event.actual ?? event.consensus, event.unit)} vs ${formatCalendarValue(event.consensus, event.unit)} expected` : 'Not released before session end'}</span><em>{event.surpriseZ !== undefined && event.status === 'released' ? `${event.surpriseZ > 0 ? '+' : ''}${event.surpriseZ.toFixed(1)}σ` : '—'}</em></div>)}
        </div>
      </section>

      <section className="review-feedback-grid">
        <article>
          <p className="eyebrow">PORTFOLIO COACH</p>
          <h2>Attention and risk feedback</h2>
          <ul>{score.feedback.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article>
          <p className="eyebrow">SCORE BREAKDOWN</p>
          <div className="score-bars">
            {[
              ['P&L', score.pnl],
              ['Commission', score.commission],
              ['Inventory', score.inventory],
              ['Quote quality', score.quoteQuality],
              ['Adverse selection', score.adverseSelection],
              ['Execution', score.execution],
            ].map(([label, value]) => (
              <div className="score-bar-row" key={label as string}><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{Number(value).toFixed(0)}</strong></div>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

function formatCalendarValue(value: number, unit: string): string { if (unit === 'k') return `${Math.round(value)}k`; if (unit === 'm bbl') return `${value >= 0 ? '+' : ''}${value.toFixed(1)}m bbl`; return `${value.toFixed(1)}${unit.startsWith('%') ? '%' : ` ${unit}`}` }
