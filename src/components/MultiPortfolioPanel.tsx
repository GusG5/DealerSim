import type { MultiSessionSnapshot } from '../types'
import { formatInstrumentMoney, formatInstrumentSize, formatMoney } from '../lib/format'

export function MultiPortfolioPanel({ snapshot }: { snapshot: MultiSessionSnapshot }) {
  return (
    <div className="multi-portfolio-panel">
      <div className="panel-title-row">
        <div><span className="panel-kicker">PORTFOLIO RISK</span><strong>Normalised across active books</strong></div>
        <span className={`status-chip${snapshot.portfolio.grossRiskUtilisation > 0.8 ? ' status-warning' : ''}`}>{(snapshot.portfolio.grossRiskUtilisation * 100).toFixed(0)}% gross</span>
      </div>
      <div className="multi-portfolio-leg-grid">
        {snapshot.legs.map((leg) => {
          const instrument = leg.options.instrument
          const utilisation = Math.abs(leg.position.quantityM) / Math.max(1, leg.hardLimitM)
          return (
            <div className="multi-portfolio-leg" key={instrument.id}>
              <div><strong>{instrument.symbol}</strong><span>{formatInstrumentSize(leg.position.quantityM, instrument)}</span></div>
              <div><span>P&amp;L</span><strong className={leg.currentEquity >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(leg.currentEquity, instrument)}</strong></div>
              <div><span>Commission</span><strong className="commission">{formatInstrumentMoney(leg.position.grossCommission, instrument)}</strong></div>
              <div><span>Risk</span><strong>{(utilisation * 100).toFixed(0)}%</strong></div>
              <div className="multi-risk-bar"><span style={{ width: `${Math.min(100, utilisation * 100)}%` }} /></div>
            </div>
          )
        })}
      </div>
      <div className="multi-portfolio-summary">
        <div><span>Total commission (USD eq.)</span><strong>{formatMoney(snapshot.portfolio.totalCommission)}</strong></div>
        <div><span>Peak gross risk</span><strong>{(snapshot.portfolio.peakGrossRiskUtilisation * 100).toFixed(0)}%</strong></div>
        <div><span>RFQs missed</span><strong>{snapshot.portfolio.rfqsExpired}</strong></div>
      </div>
    </div>
  )
}
