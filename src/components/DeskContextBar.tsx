import type { MultiSessionSnapshot } from '../types'
import { formatInstrumentSize } from '../lib/format'

export function DeskContextBar({ snapshot }: { snapshot: MultiSessionSnapshot }) {
  const upcoming = snapshot.calendar
    .filter((event) => event.status === 'upcoming')
    .sort((a, b) => a.triggerAt - b.triggerAt)
    .slice(0, 2)
  const released = snapshot.calendar.filter((event) => event.status === 'released').slice(-1)[0]
  const factorEntries = Object.entries(snapshot.factors)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
  return (
    <section className="desk-context-bar">
      <div className="desk-context-section calendar-strip">
        <span className="panel-kicker">MACRO CALENDAR</span>
        {upcoming.length > 0 ? upcoming.map((event) => (
          <div className="calendar-chip" key={event.id}>
            <strong>{event.name}</strong>
            <span>cons. {formatConsensus(event.consensus, event.unit)}</span>
            <em>T−{formatCountdown(Math.max(0, event.triggerAt - snapshot.elapsedSeconds))}</em>
          </div>
        )) : released ? <div className="calendar-chip released"><strong>{released.name}</strong><span>{formatConsensus(released.actual ?? released.consensus, released.unit)} vs {formatConsensus(released.consensus, released.unit)}</span><em>released</em></div> : <span className="muted">No scheduled release pending</span>}
      </div>
      <div className="desk-context-section factor-strip">
        <span className="panel-kicker">FACTOR PULSE</span>
        {snapshot.options.difficulty === 'learning' ? factorEntries.map(([factor, value]) => <div className="factor-chip" key={factor}><span>{factor}</span><strong className={value > 0.08 ? 'positive' : value < -0.08 ? 'negative' : ''}>{value > 0 ? '+' : ''}{value.toFixed(2)}</strong></div>) : <div className="factor-chip factor-hidden"><span>latent factors hidden</span><strong>Infer from tape</strong></div>}
      </div>
      <div className="desk-context-section flow-strip">
        <span className="panel-kicker">CLIENT FLOW · LAST 3M</span>
        {snapshot.flowSignals.map((signal) => {
          const leg = snapshot.legs.find((item) => item.options.instrument.id === signal.instrumentId)
          if (!leg) return null
          return <div className="flow-chip" key={signal.instrumentId}><strong>{signal.symbol}</strong><span className={signal.bias === 'buying' ? 'positive' : signal.bias === 'selling' ? 'negative' : ''}>{signal.bias}</span><em>{signal.dominantClientLabel && signal.dominantClientNetM ? `${signal.dominantClientLabel} ${signal.dominantClientBias} ${formatInstrumentSize(signal.dominantClientNetM, leg.options.instrument)}` : `${formatInstrumentSize(Math.abs(signal.netVolumeM), leg.options.instrument)} net`}</em></div>
        })}
      </div>
    </section>
  )
}

function formatCountdown(seconds: number): string {
  const rounded = Math.ceil(seconds)
  if (rounded >= 60) return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
  return `${rounded}s`
}

function formatConsensus(value: number, unit: string): string {
  if (unit === 'k') return `${Math.round(value)}k`
  if (unit === 'm bbl') return `${value >= 0 ? '+' : ''}${value.toFixed(1)}m`
  return `${value.toFixed(1)}${unit.startsWith('%') ? '%' : ` ${unit}`}`
}
