import type { InstrumentConfig, QuoteRecord } from '../types'
import { formatInstrumentSize, formatPrice, formatTime } from '../lib/format'

interface QuoteHistoryProps {
  records: QuoteRecord[]
  instrument: InstrumentConfig
}

export function QuoteHistory({ records, instrument }: QuoteHistoryProps) {
  return (
    <div className="quote-history">
      <div className="panel-title-row">
        <div>
          <span className="panel-kicker">MY QUOTES</span>
          <strong>RFQ history</strong>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Size</th>
              <th>Bid</th>
              <th>Ask</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">No RFQs yet</td>
              </tr>
            ) : (
              [...records].reverse().slice(0, 14).map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.rfq.clientName}</strong>
                    <small>{formatTime(record.rfq.createdAt)}</small>
                  </td>
                  <td>{formatInstrumentSize(record.rfq.sizeM, instrument)}</td>
                  <td>{record.submission?.bid ? formatPrice(record.submission.bid, instrument.priceDecimals) : '—'}</td>
                  <td>{record.submission?.ask ? formatPrice(record.submission.ask, instrument.priceDecimals) : '—'}</td>
                  <td>
                    <span className={`quote-outcome outcome-${outcomeClass(record)}`}>
                      {outcomeLabel(record)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function outcomeLabel(record: QuoteRecord): string {
  if (record.outcome?.accepted) return record.outcome.stale ? 'Traded · stale' : 'Traded'
  if (record.outcome) return 'Declined'
  if (record.rfq.status === 'expired') return 'Expired'
  if (record.rfq.status === 'rejected') return 'Passed'
  if (record.rfq.status === 'quoted') return 'Pending'
  return 'Open'
}

function outcomeClass(record: QuoteRecord): string {
  if (record.outcome?.accepted) return record.outcome.stale ? 'warning' : 'positive'
  if (record.outcome) return 'neutral'
  if (record.rfq.status === 'expired' || record.rfq.status === 'rejected') return 'negative'
  return 'pending'
}
