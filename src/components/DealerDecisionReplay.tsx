import { useMemo, useState } from 'react'
import type { SessionSnapshot } from '../types'
import { formatInstrumentMoney, formatInstrumentSize, formatTime } from '../lib/format'

export function DealerDecisionReplay({ snapshot }: { snapshot: SessionSnapshot }) {
  const [cursor, setCursor] = useState(snapshot.options.durationSeconds)
  const point = useMemo(() => snapshot.priceHistory.reduce((best, item) => Math.abs(item.t - cursor) < Math.abs(best.t - cursor) ? item : best, snapshot.priceHistory[0]), [cursor, snapshot.priceHistory])
  const quotes = snapshot.quoteHistory.filter((item) => (item.submission?.submittedAt ?? item.rfq.createdAt) <= cursor).slice(-4).reverse()
  const trades = snapshot.trades.filter((item) => item.timestamp <= cursor).slice(-4).reverse()
  const inventory = snapshot.trades.filter((item) => item.timestamp <= cursor).reduce((qty, trade) => qty + (trade.side === 'buy' ? trade.sizeM : -trade.sizeM), 0)
  return <section className="review-panel decision-replay-panel">
    <div className="section-heading compact"><div><p className="eyebrow">DECISION REPLAY</p><h2>Quotes, trades and market state</h2></div><strong>{formatTime(cursor)}</strong></div>
    <input className="decision-replay-range" aria-label="Dealer session replay time" type="range" min="0" max={snapshot.options.durationSeconds} step="1" value={cursor} onChange={(event) => setCursor(Number(event.target.value))} />
    <div className="decision-replay-snapshot">
      <div><span>Mid</span><strong>{(point?.mid ?? snapshot.market.mid).toFixed(snapshot.options.instrument.priceDecimals)}</strong></div>
      <div><span>Inventory from fills</span><strong>{formatInstrumentSize(inventory, snapshot.options.instrument)}</strong></div>
      <div><span>Trades so far</span><strong>{snapshot.trades.filter((item) => item.timestamp <= cursor).length}</strong></div>
      <div><span>Quotes so far</span><strong>{snapshot.quoteHistory.filter((item) => (item.submission?.submittedAt ?? item.rfq.createdAt) <= cursor).length}</strong></div>
    </div>
    <div className="decision-replay-grid">
      <div className="decision-replay-events"><b>Recent quote decisions</b>{quotes.length ? quotes.map((record) => <article key={record.id}><time>{formatTime(record.submission?.submittedAt ?? record.rfq.createdAt)}</time><div><strong>{record.rfq.clientName ?? record.rfq.clientId} · {record.rfq.sizeM.toFixed(0)} size</strong><p>{record.outcome ? `${record.outcome.accepted ? 'accepted' : 'rejected'}${record.outcome.stale ? ' · stale' : ''}${record.outcome.reason ? ` · ${record.outcome.reason}` : ''}` : 'Quote pending / passed'}</p></div></article>) : <span>No quote decisions yet.</span>}</div>
      <div className="decision-replay-events"><b>Recent executions</b>{trades.length ? trades.map((trade) => <article key={trade.id}><time>{formatTime(trade.timestamp)}</time><div><strong>{trade.side.toUpperCase()} {formatInstrumentSize(trade.sizeM, snapshot.options.instrument)}</strong><p>{trade.source} at {trade.price.toFixed(snapshot.options.instrument.priceDecimals)} · commission {formatInstrumentMoney(trade.commission, snapshot.options.instrument)}</p></div></article>) : <span>No executions yet.</span>}</div>
    </div>
  </section>
}
