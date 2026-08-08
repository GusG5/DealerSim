import type { InstrumentId, MultiSessionSnapshot } from '../types'
import { formatInstrumentSize } from '../lib/format'

interface MultiRfqQueueProps {
  snapshot: MultiSessionSnapshot
  selectedInstrumentId: string
  onSelectInstrument: (instrumentId: InstrumentId) => void
}

export function MultiRfqQueue({ snapshot, selectedInstrumentId, onSelectInstrument }: MultiRfqQueueProps) {
  return (
    <div className="multi-rfq-queue">
      <div className="panel-title-row">
        <div><span className="panel-kicker">RFQ QUEUE</span><strong>Competing client requests</strong></div>
        <span className="status-chip">{snapshot.legs.filter((leg) => leg.activeRfq).length} live</span>
      </div>
      <div className="multi-rfq-queue-list">
        {snapshot.legs.map((leg) => {
          const rfq = leg.activeRfq
          const instrument = leg.options.instrument
          const selected = selectedInstrumentId === instrument.id
          const remaining = rfq ? Math.max(0, rfq.expiresAt - leg.elapsedSeconds) : undefined
          return (
            <button
              type="button"
              key={instrument.id}
              className={`multi-rfq-queue-row${selected ? ' selected' : ''}${rfq ? ' live' : ''}`}
              onClick={() => onSelectInstrument(instrument.id)}
            >
              <div><strong>{instrument.symbol}</strong><span>{rfq ? rfq.clientName : 'No live RFQ'}</span></div>
              <div>
                <span>{rfq ? formatInstrumentSize(rfq.sizeM, instrument) : 'Monitoring'}</span>
                <small>
                  {rfq
                    ? rfq.kind === 'two-way'
                      ? 'Two-way'
                      : rfq.kind === 'limit-interest'
                        ? `${rfq.requestedSide === 'buy' ? 'Buy' : 'Sell'} limit`
                        : rfq.requestedSide === 'buy'
                          ? 'Offer only'
                          : 'Bid only'
                    : instrument.displayName}
                </small>
              </div>
              <em className={remaining !== undefined && remaining < 5 ? 'critical' : ''}>{remaining !== undefined ? `${remaining.toFixed(1)}s` : '—'}</em>
            </button>
          )
        })}
      </div>
      <p className="multi-rfq-attention-note">RFQ clocks run simultaneously. Handling one market does not pause the rest of the desk.</p>
    </div>
  )
}
