import type { InstrumentId, MultiSessionSnapshot } from '../types'
import { formatInstrumentMoney, formatMoney, formatPrice, formatTime } from '../lib/format'

interface MultiTerminalHeaderProps {
  snapshot: MultiSessionSnapshot
  selectedInstrumentId: string
  muted: boolean
  onSelectInstrument: (instrumentId: InstrumentId) => void
  onToggleMute: () => void
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  onFullscreen: () => void
}

export function MultiTerminalHeader({
  snapshot,
  selectedInstrumentId,
  muted,
  onSelectInstrument,
  onToggleMute,
  onPause,
  onResume,
  onFinish,
  onFullscreen,
}: MultiTerminalHeaderProps) {
  return (
    <header className="multi-terminal-header">
      <div className="multi-terminal-brand">
        <span className="brand-mark">DS</span>
        <div><strong>DealerSim</strong><span>{snapshot.legs.length === 3 ? 'THREE-MARKET DESK' : 'DUAL-MARKET DESK'}</span></div>
      </div>

      <div className="multi-market-header-cards" style={{ gridTemplateColumns: `repeat(${snapshot.legs.length}, minmax(0, 1fr))` }}>
        {snapshot.legs.map((leg) => {
          const instrument = leg.options.instrument
          const selected = instrument.id === selectedInstrumentId
          return (
            <button
              type="button"
              className={`multi-market-header-card${selected ? ' selected' : ''}`}
              key={instrument.id}
              onClick={() => onSelectInstrument(instrument.id)}
            >
              <span>{instrument.symbol}</span>
              <strong>{formatPrice(leg.market.mid, instrument.priceDecimals)}</strong>
              <small className={leg.currentEquity >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(leg.currentEquity, instrument)} P&amp;L</small>
              <small>{leg.marketPhase.replace('-', ' ')} · liq {leg.timeLiquidityMultiplier.toFixed(2)}x</small>
              {leg.activeRfq && <em>RFQ {Math.max(0, leg.activeRfq.expiresAt - leg.elapsedSeconds).toFixed(1)}s</em>}
            </button>
          )
        })}
      </div>

      <div className="multi-portfolio-header-metrics">
        <div><span>Portfolio P&amp;L</span><strong className={snapshot.portfolio.totalPnl >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.portfolio.totalPnl)}</strong></div>
        <div><span>Gross risk</span><strong>{(snapshot.portfolio.grossRiskUtilisation * 100).toFixed(0)}%</strong></div>
        <div className="terminal-clock"><span>Time remaining</span><strong>{formatTime(snapshot.remainingSeconds)}</strong></div>
      </div>

      <div className="terminal-controls multi-terminal-controls">
        <button type="button" onClick={onToggleMute}>{muted ? 'Sound off' : 'Sound on'}</button>
        <button type="button" onClick={onFullscreen}>Full screen</button>
        {snapshot.options.difficulty !== 'assessment' && (snapshot.status === 'paused'
          ? <button type="button" onClick={onResume}>Resume</button>
          : <button type="button" onClick={onPause}>Pause</button>)}
        <button className="end-session" type="button" onClick={onFinish}>End</button>
      </div>
    </header>
  )
}
