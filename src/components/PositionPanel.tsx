import type { SessionSnapshot } from '../types'
import { formatInstrumentMoney, formatInstrumentSize, formatPrice } from '../lib/format'

interface PositionPanelProps {
  snapshot: SessionSnapshot
}

export function PositionPanel({ snapshot }: PositionPanelProps) {
  const { position, softLimitM, hardLimitM } = snapshot
  const utilisation = Math.abs(position.quantityM) / Math.max(1, hardLimitM)
  const netPnl = snapshot.currentEquity
  const inventoryTiming = netPnl - position.grossCommission - snapshot.metrics.clientPriceEdgePnl + snapshot.metrics.exchangeSlippageCost + snapshot.metrics.marketImpactCost
  const inventoryClass =
    Math.abs(position.quantityM) > hardLimitM
      ? 'critical'
      : Math.abs(position.quantityM) > softLimitM
        ? 'warning'
        : position.quantityM > 0
          ? 'positive'
          : position.quantityM < 0
            ? 'negative'
            : ''

  return (
    <div className="position-panel">
      <div className="panel-title-row">
        <div>
          <span className="panel-kicker">POSITION &amp; RISK</span>
          <strong>{snapshot.options.instrument.symbol} inventory</strong>
        </div>
        <span className={`status-chip ${inventoryClass ? `status-${inventoryClass}` : ''}`}>
          {position.quantityM > 0 ? 'Long' : position.quantityM < 0 ? 'Short' : 'Flat'}
        </span>
      </div>
      <div className="position-table">
        <div>
          <span>Net position</span>
          <strong className={inventoryClass}>{formatInstrumentSize(position.quantityM, snapshot.options.instrument)}</strong>
        </div>
        <div>
          <span>Average price</span>
          <strong>{position.averagePrice ? formatPrice(position.averagePrice, snapshot.options.instrument.priceDecimals) : '—'}</strong>
        </div>
        <div>
          <span>Realised</span>
          <strong className={position.realisedPnl >= 0 ? 'positive' : 'negative'}>
            {formatInstrumentMoney(position.realisedPnl, snapshot.options.instrument)}
          </strong>
        </div>
        <div>
          <span>Unrealised</span>
          <strong className={position.unrealisedPnl >= 0 ? 'positive' : 'negative'}>
            {formatInstrumentMoney(position.unrealisedPnl, snapshot.options.instrument)}
          </strong>
        </div>
        <div>
          <span>Commission</span>
          <strong className="commission">{formatInstrumentMoney(position.grossCommission, snapshot.options.instrument)}</strong>
        </div>
        <div>
          <span>Net P&amp;L</span>
          <strong className={netPnl >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(netPnl, snapshot.options.instrument)}</strong>
        </div>
      </div>
      <div className="dealer-pnl-explain"><span><small>Commission</small><strong className="positive">{formatInstrumentMoney(position.grossCommission, snapshot.options.instrument)}</strong></span><span><small>Client price edge</small><strong className={snapshot.metrics.clientPriceEdgePnl >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(snapshot.metrics.clientPriceEdgePnl, snapshot.options.instrument)}</strong></span><span><small>Exchange slippage</small><strong className="negative">-{formatInstrumentMoney(snapshot.metrics.exchangeSlippageCost, snapshot.options.instrument)}</strong></span><span><small>Market impact</small><strong className="negative">-{formatInstrumentMoney(snapshot.metrics.marketImpactCost, snapshot.options.instrument)}</strong></span><span><small>Inventory / timing</small><strong className={inventoryTiming >= 0 ? 'positive' : 'negative'}>{formatInstrumentMoney(inventoryTiming, snapshot.options.instrument)}</strong></span><span><small>Phase</small><strong>{snapshot.marketPhase.replace('-', ' ')}</strong></span></div>
      <div className="risk-meter">
        <div className="risk-meter-labels">
          <span>Inventory utilisation</span>
          <strong>{Math.round(utilisation * 100)}%</strong>
        </div>
        <div className="risk-track">
          <span
            className={`risk-fill${utilisation > 1 ? ' critical' : utilisation > softLimitM / hardLimitM ? ' warning' : ''}`}
            style={{ width: `${Math.min(100, utilisation * 100)}%` }}
          />
          <i style={{ left: `${(softLimitM / hardLimitM) * 100}%` }} />
        </div>
        <div className="risk-limits">
          <span>Soft {formatInstrumentSize(softLimitM, snapshot.options.instrument)}</span>
          <span>Hard {formatInstrumentSize(hardLimitM, snapshot.options.instrument)}</span>
        </div>
      </div>
    </div>
  )
}
