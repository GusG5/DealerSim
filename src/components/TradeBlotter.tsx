import type { InstrumentConfig, Trade } from '../types'
import { formatInstrumentMoney, formatInstrumentSize, formatPrice, formatTime } from '../lib/format'

interface TradeBlotterProps {
  trades: Trade[]
  instrument: InstrumentConfig
}

export function TradeBlotter({ trades, instrument }: TradeBlotterProps) {
  return (
    <div className="trade-blotter">
      <div className="panel-title-row">
        <div>
          <span className="panel-kicker">TRADE BLOTTER</span>
          <strong>{trades.length} executions</strong>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Source</th>
              <th>Side</th>
              <th>Size</th>
              <th>Price</th>
              <th>Comm.</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">No trades yet</td>
              </tr>
            ) : (
              [...trades].reverse().slice(0, 20).map((trade) => (
                <tr key={trade.id} className={trade.stale ? 'stale-trade' : ''}>
                  <td>{formatTime(trade.timestamp)}</td>
                  <td>{sourceLabel(trade.source)}</td>
                  <td className={trade.side === 'buy' ? 'positive' : 'negative'}>
                    {trade.side.toUpperCase()}
                  </td>
                  <td>{formatInstrumentSize(trade.sizeM, instrument)}</td>
                  <td>{formatPrice(trade.price, instrument.priceDecimals)}</td>
                  <td className="commission">{trade.commission ? formatInstrumentMoney(trade.commission, instrument) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function sourceLabel(source: Trade['source']): string {
  switch (source) {
    case 'client':
      return 'Client'
    case 'market-hedge':
      return 'Market'
    case 'interdealer-hedge':
      return 'Interdealer'
    case 'worked-hedge':
      return 'Worked'
    case 'passive-hedge':
      return 'Passive'
    case 'forced-liquidation':
      return 'Forced'
  }
}
