import { useMemo, useState } from 'react'
import { estimateBlockExecution } from '../engine/accounting'
import type {
  InstrumentConfig,
  PassiveOrder,
  SessionSnapshot,
  TradeSide,
  WorkingHedge,
  WorkingHedgeStrategy,
} from '../types'
import {
  formatInstrumentMoney,
  formatInstrumentSize,
  formatPrice,
  quoteUnitLabel,
  sizeUnitLabel,
} from '../lib/format'

interface HedgePanelProps {
  snapshot: SessionSnapshot
  onMarketHedge: (side: TradeSide, sizeM: number) => void
  onInterdealerHedge: (side: TradeSide, sizeM: number) => void
  onStartWorkingHedge: (
    side: TradeSide,
    sizeM: number,
    strategy: WorkingHedgeStrategy,
    clipSizeM: number,
    intervalSeconds: number,
  ) => void
  onCancelWorkingHedge: (orderId: string) => void
  onPauseWorkingHedge: (orderId: string) => void
  onResumeWorkingHedge: (orderId: string) => void
  onModifyWorkingHedge: (orderId: string, clipSizeM: number, intervalSeconds: number) => void
  onCrossWorkingHedge: (orderId: string) => void
  onPassiveOrder: (side: TradeSide, price: number, sizeM: number) => void
  onCancelPassive: (orderId: string) => void
}

export function HedgePanel({
  snapshot,
  onMarketHedge,
  onInterdealerHedge,
  onStartWorkingHedge,
  onCancelWorkingHedge,
  onPauseWorkingHedge,
  onResumeWorkingHedge,
  onModifyWorkingHedge,
  onCrossWorkingHedge,
  onPassiveOrder,
  onCancelPassive,
}: HedgePanelProps) {
  const instrument = snapshot.options.instrument
  const [size, setSize] = useState(String(instrument.defaultSizeM))
  const [clipSize, setClipSize] = useState(String(Math.max(instrument.minimumSizeM, Math.min(5, instrument.defaultSizeM))))
  const [interval, setInterval] = useState('5')
  const [strategy, setStrategy] = useState<WorkingHedgeStrategy>('twap')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [passivePrice, setPassivePrice] = useState(() =>
    formatPrice(snapshot.market.mid, instrument.priceDecimals),
  )

  const workingOrders = snapshot.passiveOrders.filter((order) => order.status === 'working')
  const workingHedges = snapshot.workingHedges.filter((order) => order.status === 'working' || order.status === 'paused')
  const numericSize = Number(size)
  const numericClip = Number(clipSize)
  const numericInterval = Number(interval)
  const numericPrice = Number(passivePrice)
  const position = snapshot.position.quantityM
  const flattenSide: TradeSide = position > 0 ? 'sell' : 'buy'
  const defaultWorkSize = Math.abs(position) || numericSize
  const internalisationRate = snapshot.metrics.grossClientVolumeM > 0
    ? snapshot.metrics.internalisedVolumeM / snapshot.metrics.grossClientVolumeM
    : 0

  const executionEstimates = useMemo(() => {
    if (!Number.isFinite(numericSize) || numericSize <= 0) return undefined
    const buy = estimateBlockExecution(
      'buy',
      numericSize,
      snapshot.market.orderBook,
      snapshot.market,
      instrument,
    )
    const sell = estimateBlockExecution(
      'sell',
      numericSize,
      snapshot.market.orderBook,
      snapshot.market,
      instrument,
    )
    return { buy, sell }
  }, [instrument, numericSize, snapshot.market])

  const executionEstimate = executionEstimates
    ? executionEstimates[position === 0 ? 'sell' : flattenSide]
    : undefined
  const executableSpreadPips = executionEstimates
    ? Math.max(0, (executionEstimates.buy.directVwap - executionEstimates.sell.directVwap) / instrument.pipSize)
    : undefined
  const impactAdjustedSpreadPips = executionEstimates
    ? Math.max(0, (executionEstimates.buy.impactAdjustedPrice - executionEstimates.sell.impactAdjustedPrice) / instrument.pipSize)
    : undefined

  const executeMarket = (side: TradeSide, requestedSize = numericSize) => {
    if (Number.isFinite(requestedSize) && requestedSize > 0) {
      onMarketHedge(side, requestedSize)
    }
  }

  const startWorked = (
    selectedStrategy: WorkingHedgeStrategy,
    requestedSize = defaultWorkSize,
    requestedClip = Math.max(instrument.minimumSizeM, Math.min(5, requestedSize)),
    requestedInterval = selectedStrategy === 'twap' ? 5 : 2,
  ) => {
    if (position === 0) return
    onStartWorkingHedge(
      flattenSide,
      requestedSize,
      selectedStrategy,
      requestedClip,
      requestedInterval,
    )
  }

  const placePassive = (side: TradeSide) => {
    if (Number.isFinite(numericSize) && numericSize > 0 && Number.isFinite(numericPrice)) {
      onPassiveOrder(side, numericPrice, numericSize)
    }
  }

  return (
    <div className="hedge-panel">
      <div className="panel-title-row">
        <div>
          <span className="panel-kicker">INVENTORY EXECUTION</span>
          <strong>Internalise, sweep or work the residual</strong>
        </div>
        <span className="status-chip">{workingOrders.length + workingHedges.length} working</span>
      </div>

      <div className="execution-metrics-row">
        <div>
          <span>Client volume</span>
          <strong>{formatInstrumentSize(snapshot.metrics.grossClientVolumeM, instrument)}</strong>
        </div>
        <div>
          <span>Internalised</span>
          <strong className="commission">{formatInstrumentSize(snapshot.metrics.internalisedVolumeM, instrument)}</strong>
        </div>
        <div>
          <span>Internalisation rate</span>
          <strong>{(internalisationRate * 100).toFixed(0)}%</strong>
        </div>
        <div>
          <span>Exchange / interdealer</span>
          <strong>{formatInstrumentSize(snapshot.metrics.exchangeHedgeVolumeM, instrument)} / {formatInstrumentSize(snapshot.metrics.interdealerHedgeVolumeM, instrument)}</strong>
        </div>
      </div>

      <div className="hedge-size-row">
        <label>
          <span>Execution size ({sizeUnitLabel(instrument)})</span>
          <input
            type="number"
            min={instrument.minimumSizeM}
            max={instrument.maximumSizeM}
            step={instrument.sizeStepM}
            value={size}
            onChange={(event) => setSize(event.target.value)}
          />
        </label>
        <button
          className="button button-ghost"
          type="button"
          disabled={position === 0}
          onClick={() => setSize(String(Math.abs(position)))}
        >
          Load residual {position ? formatInstrumentSize(Math.abs(position), instrument) : ''}
        </button>
      </div>

      {executionEstimates && executableSpreadPips !== undefined && (
        <div className="size-adjusted-executable-quote">
          <div className="executable-sell">
            <span>SELL {formatInstrumentSize(numericSize, instrument)}</span>
            <strong>{formatPrice(executionEstimates.sell.directVwap, instrument.priceDecimals)}</strong>
            <small>{executionEstimates.sell.levelsConsumed} level{executionEstimates.sell.levelsConsumed === 1 ? '' : 's'} swept</small>
          </div>
          <div className="executable-top">
            <span>TOP MARKET</span>
            <strong>{formatPrice(snapshot.market.bid, instrument.priceDecimals)} / {formatPrice(snapshot.market.ask, instrument.priceDecimals)}</strong>
            <small>{snapshot.market.spreadPips.toFixed(1)} {quoteUnitLabel(instrument)}</small>
          </div>
          <div className="executable-buy">
            <span>BUY {formatInstrumentSize(numericSize, instrument)}</span>
            <strong>{formatPrice(executionEstimates.buy.directVwap, instrument.priceDecimals)}</strong>
            <small>{executionEstimates.buy.levelsConsumed} level{executionEstimates.buy.levelsConsumed === 1 ? '' : 's'} swept</small>
          </div>
        </div>
      )}

      {executionEstimates && executableSpreadPips !== undefined && (
        <div className="size-adjusted-market-strip">
          <div>
            <span>Top-of-book spread</span>
            <strong>{snapshot.market.spreadPips.toFixed(1)} {quoteUnitLabel(instrument)}</strong>
          </div>
          <div>
            <span>{formatInstrumentSize(numericSize, instrument)} executable spread</span>
            <strong>{executableSpreadPips.toFixed(1)} {quoteUnitLabel(instrument)}</strong>
          </div>
          {snapshot.options.difficulty === 'learning' && impactAdjustedSpreadPips !== undefined && (
            <div>
              <span>Est. all-in spread incl. impact</span>
              <strong>{impactAdjustedSpreadPips.toFixed(1)} {quoteUnitLabel(instrument)}</strong>
            </div>
          )}
        </div>
      )}

      {snapshot.options.difficulty === 'learning' && executionEstimate && (
        <div className="execution-estimate-card">
          <div>
            <span>{executionEstimate.side === 'buy' ? 'Buy' : 'Sell'} VWAP</span>
            <strong>{formatPrice(executionEstimate.directVwap, instrument.priceDecimals)}</strong>
          </div>
          <div>
            <span>Temporary impact</span>
            <strong>{executionEstimate.temporaryImpactPips.toFixed(1)} {quoteUnitLabel(instrument)}</strong>
          </div>
          <div>
            <span>Book participation</span>
            <strong>{(executionEstimate.participationRate * 100).toFixed(0)}%</strong>
          </div>
          <div>
            <span>Levels consumed</span>
            <strong>{executionEstimate.levelsConsumed}</strong>
          </div>
          <div>
            <span>Estimated all-in cost</span>
            <strong className="negative">{formatInstrumentMoney(executionEstimate.implementationShortfall, instrument)}</strong>
          </div>
          <details className="learning-detail"><summary>Estimate assumptions</summary><p>Top-of-book is the first available price only. The executable spread widens with size, while temporary impact rises with participation. Reserve/iceberg liquidity is uncertain; current model estimate is ~{(snapshot.market.hiddenLiquidityShare * 100).toFixed(0)}% of displayed top-level depth.</p></details>
        </div>
      )}

      {snapshot.options.difficulty === 'learning' && snapshot.market.recentParticipation > 0.03 && (
        <div className="execution-footprint-strip">
          <span><b>Your recent footprint</b></span>
          <span>Impact <strong>{snapshot.market.recentImpactPips.toFixed(1)} {quoteUnitLabel(instrument)}</strong></span>
          <span>Spread pressure <strong>+{snapshot.market.spreadPressurePips.toFixed(1)}</strong></span>
          <span>Liquidity <strong>{snapshot.market.liquidityRegime}</strong></span>
          <span>Pattern leakage <strong>{snapshot.market.informationLeakageRisk > 0.6 ? 'high' : snapshot.market.informationLeakageRisk > 0.25 ? 'moderate' : 'low'}</strong></span>
          <span>Est. recovery <strong>~{snapshot.market.expectedRecoverySeconds.toFixed(0)}s</strong></span>
        </div>
      )}

      <div className="quick-execution-grid">
        <button
          type="button"
          className="execution-choice urgent"
          disabled={position === 0}
          onClick={() => executeMarket(flattenSide, Math.abs(position))}
        >
          <strong>Full hedge now</strong>
          <span>Lowest inventory risk, highest immediate impact</span>
        </button>
        <button
          type="button"
          className="execution-choice"
          disabled={position === 0}
          onClick={() => executeMarket(flattenSide, Math.max(instrument.minimumSizeM, Math.abs(position) * 0.5))}
        >
          <strong>Hedge 50% now</strong>
          <span>Reduce exposure, leave room for matching flow</span>
        </button>
        <button
          type="button"
          className="execution-choice interdealer"
          disabled={position === 0}
          onClick={() => onInterdealerHedge(flattenSide, Math.abs(position))}
        >
          <strong>Interdealer block</strong>
          <span>Deeper block liquidity, limited capacity and variable quote quality</span>
        </button>
        <button
          type="button"
          className="execution-choice"
          disabled={position === 0}
          onClick={() => startWorked('twap')}
        >
          <strong>Work evenly</strong>
          <span>Break the residual into timed clips</span>
        </button>
        <button
          type="button"
          className="execution-choice"
          disabled={position === 0}
          onClick={() => startWorked('liquidity-sensitive')}
        >
          <strong>Liquidity-sensitive</strong>
          <span>Pause when depth is thin and trade when it replenishes</span>
        </button>
      </div>

      <button className="advanced-toggle" type="button" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? 'Hide advanced controls' : 'Show advanced execution controls'}
      </button>

      {showAdvanced && (
        <div className="advanced-execution-panel">
          <label>
            <span>Strategy</span>
            <select value={strategy} onChange={(event) => setStrategy(event.target.value as WorkingHedgeStrategy)}>
              <option value="twap">Work evenly</option>
              <option value="liquidity-sensitive">Liquidity-sensitive</option>
            </select>
          </label>
          <label>
            <span>Clip size</span>
            <input
              type="number"
              min={instrument.minimumSizeM}
              step={instrument.sizeStepM}
              value={clipSize}
              onChange={(event) => setClipSize(event.target.value)}
            />
          </label>
          <label>
            <span>Interval (seconds)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (
                position !== 0 &&
                Number.isFinite(numericSize) && numericSize > 0 &&
                Number.isFinite(numericClip) && numericClip > 0 &&
                Number.isFinite(numericInterval) && numericInterval > 0
              ) {
                onStartWorkingHedge(flattenSide, numericSize, strategy, numericClip, numericInterval)
              }
            }}
            disabled={position === 0}
          >
            Start advanced schedule
          </button>
        </div>
      )}

      <div className="market-hedge-buttons">
        <button className="hedge-buy" type="button" onClick={() => executeMarket('buy')}>
          <span>BUY {Number.isFinite(numericSize) && numericSize > 0 ? formatInstrumentSize(numericSize, instrument) : ''} MARKET</span>
          <strong>{formatPrice(executionEstimates?.buy.directVwap ?? snapshot.market.ask, instrument.priceDecimals)}</strong>
          <small>top {formatPrice(snapshot.market.ask, instrument.priceDecimals)}</small>
        </button>
        <button className="hedge-sell" type="button" onClick={() => executeMarket('sell')}>
          <span>SELL {Number.isFinite(numericSize) && numericSize > 0 ? formatInstrumentSize(numericSize, instrument) : ''} MARKET</span>
          <strong>{formatPrice(executionEstimates?.sell.directVwap ?? snapshot.market.bid, instrument.priceDecimals)}</strong>
          <small>top {formatPrice(snapshot.market.bid, instrument.priceDecimals)}</small>
        </button>
      </div>

      <div className="passive-entry">
        <label>
          <span>Passive price</span>
          <input
            inputMode="decimal"
            value={passivePrice}
            onChange={(event) => setPassivePrice(event.target.value)}
          />
        </label>
        <div>
          <button type="button" onClick={() => placePassive('buy')}>Work bid</button>
          <button type="button" onClick={() => placePassive('sell')}>Work offer</button>
        </div>
      </div>

      {(workingHedges.length > 0 || workingOrders.length > 0) && (
        <div className="working-orders">
          {workingHedges.map((order) => (
            <WorkingHedgeRow
              key={order.id}
              order={order}
              instrument={instrument}
              onCancel={onCancelWorkingHedge}
              onPause={onPauseWorkingHedge}
              onResume={onResumeWorkingHedge}
              onModify={onModifyWorkingHedge}
              onCross={onCrossWorkingHedge}
            />
          ))}
          {workingOrders.map((order) => (
            <WorkingOrder key={order.id} order={order} instrument={instrument} onCancel={onCancelPassive} />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkingHedgeRow({
  order,
  instrument,
  onCancel,
  onPause,
  onResume,
  onModify,
  onCross,
}: {
  order: WorkingHedge
  instrument: InstrumentConfig
  onCancel: (orderId: string) => void
  onPause: (orderId: string) => void
  onResume: (orderId: string) => void
  onModify: (orderId: string, clipSizeM: number, intervalSeconds: number) => void
  onCross: (orderId: string) => void
}) {
  const progress = order.totalSizeM > 0 ? order.executedM / order.totalSizeM : 0
  const fasterInterval = Math.max(1, order.intervalSeconds - 2)
  const slowerInterval = Math.min(30, order.intervalSeconds + 2)
  const largerClip = Math.min(order.remainingM, Math.max(instrument.minimumSizeM, order.clipSizeM + instrument.sizeStepM * Math.max(1, Math.round(order.clipSizeM * 0.35 / instrument.sizeStepM))))
  const smallerClip = Math.max(instrument.minimumSizeM, order.clipSizeM - instrument.sizeStepM * Math.max(1, Math.round(order.clipSizeM * 0.3 / instrument.sizeStepM)))
  return (
    <div className="working-hedge-card">
      <div className="working-hedge-head">
        <div><span className={order.side === 'buy' ? 'positive' : 'negative'}>{order.side.toUpperCase()}</span><strong>{formatInstrumentSize(order.remainingM, instrument)} remaining</strong></div>
        <span className={`status-chip${order.status === 'paused' ? ' warning' : ''}`}>{order.status}</span>
      </div>
      <div className="working-hedge-progress"><i style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
      <div className="working-hedge-stats">
        <div><span>Executed</span><strong>{formatInstrumentSize(order.executedM, instrument)}</strong></div>
        <div><span>Avg hedge</span><strong>{order.executedM > 0 ? formatPrice(order.averageExecutionPrice, instrument.priceDecimals) : '—'}</strong></div>
        <div><span>Clip / interval</span><strong>{formatInstrumentSize(order.clipSizeM, instrument)} / {order.intervalSeconds.toFixed(0)}s</strong></div>
        <div><span>Impact cost</span><strong className="negative">{formatInstrumentMoney(order.marketImpactCost, instrument)}</strong></div>
      </div>
      <div className="working-hedge-actions">
        {order.status === 'working'
          ? <button type="button" onClick={() => onPause(order.id)}>Pause</button>
          : <button type="button" onClick={() => onResume(order.id)}>Resume</button>}
        <button type="button" onClick={() => onModify(order.id, largerClip, fasterInterval)}>Accelerate</button>
        <button type="button" onClick={() => onModify(order.id, smallerClip, slowerInterval)}>Slow down</button>
        <button type="button" className="danger" onClick={() => onCross(order.id)}>Cross remaining</button>
        <button type="button" onClick={() => onCancel(order.id)}>Cancel</button>
      </div>
    </div>
  )
}

function WorkingOrder({
  order,
  instrument,
  onCancel,
}: {
  order: PassiveOrder
  instrument: InstrumentConfig
  onCancel: (orderId: string) => void
}) {
  return (
    <div className="working-order-row">
      <span className={order.side === 'buy' ? 'positive' : 'negative'}>{order.side.toUpperCase()}</span>
      <strong>{formatInstrumentSize(order.remainingM, instrument)}</strong>
      <span>@ {formatPrice(order.price, instrument.priceDecimals)}</span>
      <button type="button" onClick={() => onCancel(order.id)}>Cancel</button>
    </div>
  )
}
