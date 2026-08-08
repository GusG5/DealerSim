import type { SessionSnapshot } from '../types'
import { formatPrice, formatTime, quoteUnitLabel, titleCase } from '../lib/format'

interface TerminalHeaderProps {
  snapshot: SessionSnapshot
  resolvedScenario?: string
  muted: boolean
  onToggleMute: () => void
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  onFullscreen: () => void
}

export function TerminalHeader({
  snapshot,
  resolvedScenario,
  muted,
  onToggleMute,
  onPause,
  onResume,
  onFinish,
  onFullscreen,
}: TerminalHeaderProps) {
  const movePips = snapshot.priceHistory.length > 1
    ? (snapshot.market.mid - snapshot.priceHistory[0].mid) / snapshot.options.instrument.pipSize
    : 0

  return (
    <header className="terminal-header">
      <div className="terminal-brand">
        <span className="brand-mark small">DS</span>
        <div>
          <strong>DealerSim</strong>
          <span>{snapshot.options.instrument.symbol} DEALER TERMINAL</span>
        </div>
      </div>
      <div className="terminal-market-strip">
        <div>
          <span>{snapshot.options.instrument.symbol}</span>
          <strong>{formatPrice(snapshot.market.mid, snapshot.options.instrument.priceDecimals)}</strong>
        </div>
        <div>
          <span>Session move</span>
          <strong className={movePips >= 0 ? 'positive' : 'negative'}>
            {movePips >= 0 ? '+' : ''}{movePips.toFixed(1)} {quoteUnitLabel(snapshot.options.instrument)}
          </strong>
        </div>
        <div>
          <span>Spread</span>
          <strong>{snapshot.market.spreadPips.toFixed(1)} {quoteUnitLabel(snapshot.options.instrument)}</strong>
        </div>
        <div>
          <span>Market phase</span>
          <strong>{titleCase(snapshot.marketPhase.replace('-', ' '))}</strong>
        </div>
        <div>
          <span>Regime</span>
          <strong>{titleCase(snapshot.market.regime)}</strong>
        </div>
        <div>
          <span>Scenario</span>
          <strong>{snapshot.options.scenario === 'random' ? 'Unknown' : titleCase(resolvedScenario ?? snapshot.options.scenario)}</strong>
        </div>
        <div className="terminal-clock">
          <span>Time remaining</span>
          <strong>{formatTime(snapshot.remainingSeconds)}</strong>
        </div>
      </div>
      <div className="terminal-controls">
        <button type="button" onClick={onToggleMute} title={muted ? 'Enable sounds' : 'Mute sounds'}>
          {muted ? 'Sound off' : 'Sound on'}
        </button>
        <button type="button" onClick={onFullscreen}>Full screen</button>
        {snapshot.options.difficulty !== 'assessment' && (snapshot.status === 'paused' ? (
          <button type="button" onClick={onResume}>Resume</button>
        ) : (
          <button type="button" onClick={onPause}>Pause</button>
        ))}
        <button className="end-session" type="button" onClick={onFinish}>End</button>
      </div>
    </header>
  )
}
