import type { MultiSessionSnapshot } from '../types'
import { formatInstrumentMoney, formatInstrumentSize, formatPrice, formatTime } from '../lib/format'

export function MultiTradeBlotter({ snapshot }: { snapshot: MultiSessionSnapshot }) {
  const trades = snapshot.legs
    .flatMap((leg) => leg.trades.map((trade) => ({ trade, instrument: leg.options.instrument })))
    .sort((a, b) => b.trade.timestamp - a.trade.timestamp)
    .slice(0, 18)

  return (
    <div className="trade-blotter">
      <div className="panel-title-row"><div><span className="panel-kicker">DESK BLOTTER</span><strong>{trades.length} recent executions</strong></div></div>
      <table>
        <thead><tr><th>Time</th><th>Mkt</th><th>Source</th><th>Side</th><th>Size</th><th>Price</th><th>Comm.</th></tr></thead>
        <tbody>
          {trades.length === 0 ? (
            <tr><td colSpan={7} className="empty-table-cell">No trades yet</td></tr>
          ) : trades.map(({ trade, instrument }) => (
            <tr key={`${instrument.id}-${trade.id}`}>
              <td>{formatTime(trade.timestamp)}</td>
              <td><strong>{instrument.symbol}</strong></td>
              <td>{trade.source.replace(/-/g, ' ')}</td>
              <td className={trade.side === 'buy' ? 'positive' : 'negative'}>{trade.side.toUpperCase()}</td>
              <td>{formatInstrumentSize(trade.sizeM, instrument)}</td>
              <td>{formatPrice(trade.price, instrument.priceDecimals)}</td>
              <td>{trade.commission ? formatInstrumentMoney(trade.commission, instrument) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
