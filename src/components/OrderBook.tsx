import { useMemo, useState } from 'react'
import { estimateBlockExecution } from '../engine/accounting'
import type { InstrumentConfig, MarketSnapshot, Rfq } from '../types'
import { formatInstrumentSize, formatPrice, quoteUnitLabel } from '../lib/format'

interface OrderBookProps {
  market: MarketSnapshot
  instrument: InstrumentConfig
  activeRfq?: Rfq
}

export function OrderBook({ market, instrument, activeRfq }: OrderBookProps) {
  const allLevels = market.orderBook.slice(0, instrument.displayedDepthLevels)
  const defaultVisibleCount = Math.min(5, allLevels.length)
  const [expanded, setExpanded] = useState(false)
  const levels = expanded ? allLevels : allLevels.slice(0, defaultVisibleCount)
  const hiddenCount = Math.max(0, allLevels.length - levels.length)
  const unitLabel = quoteUnitLabel(instrument)

  const blockBenchmark = useMemo(() => {
    if (!activeRfq || instrument.marketStructure !== 'central-limit-order-book') return undefined
    const buy = estimateBlockExecution('buy', activeRfq.sizeM, market.orderBook, market, instrument)
    const sell = estimateBlockExecution('sell', activeRfq.sizeM, market.orderBook, market, instrument)
    return {
      buy,
      sell,
      effectiveSpread: (buy.impactAdjustedPrice - sell.impactAdjustedPrice) / instrument.pipSize,
    }
  }, [activeRfq, instrument, market])

  return (
    <div className="order-book compact-order-book">
      <div className="panel-title-row compact-book-title">
        <div>
          <span className="panel-kicker">EXCHANGE MARKET</span>
          <strong>{instrument.symbol} displayed depth</strong>
        </div>
        <div className="book-title-actions">
          {allLevels.length > defaultVisibleCount && (
            <button className="book-expand-button" type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show 5' : `+${allLevels.length - defaultVisibleCount} levels`}
            </button>
          )}
          <span className={`status-chip liquidity-${market.liquidityRegime}`}>{market.liquidityRegime}</span>
          <span className="status-chip status-live">{market.participantCount} participants</span>
        </div>
      </div>

      <div className="book-summary-strip compact-book-summary">
        <div>
          <span>Displayed depth</span>
          <strong>{formatInstrumentSize(market.displayedDepthM, instrument)}</strong>
        </div>
        <div>
          <span>{activeRfq ? 'Client block' : 'Top spread'}</span>
          <strong>{activeRfq ? formatInstrumentSize(activeRfq.sizeM, instrument) : `${market.spreadPips.toFixed(1)} ${unitLabel}`}</strong>
        </div>
        <div>
          <span>{blockBenchmark ? 'Full-block spread' : 'Visible levels'}</span>
          <strong>{blockBenchmark ? `${blockBenchmark.effectiveSpread.toFixed(1)} ${unitLabel}` : `${levels.length}/${allLevels.length}`}</strong>
        </div>
      </div>


      {instrument.marketStructure === 'central-limit-order-book' && (
        <div className="microstructure-readout">
          <span>Book imbalance <strong>{market.bookImbalance >= 0 ? '+' : ''}{(market.bookImbalance * 100).toFixed(0)}%</strong></span>
          <span>Recovery <strong>~{market.expectedRecoverySeconds.toFixed(0)}s</strong></span>
          {activeRfq && <span>Block / visible depth <strong>{((activeRfq.sizeM / Math.max(instrument.minimumSizeM, market.displayedDepthM * 0.5)) * 100).toFixed(0)}%</strong></span>}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>{bookSizeHeader(instrument, 'Bid')}</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>{bookSizeHeader(instrument, 'Ask')}</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level) => {
            const bidConsumed = Boolean(blockBenchmark && level.level <= blockBenchmark.sell.levelsConsumed)
            const askConsumed = Boolean(blockBenchmark && level.level <= blockBenchmark.buy.levelsConsumed)
            return (
              <tr key={level.level} className={level.level === 1 ? 'top-level' : ''}>
                <td className={bidConsumed ? 'depth-consumed bid-consumed' : ''}>{formatBookSize(level.bidSizeM, instrument)}</td>
                <td className={`book-bid${bidConsumed ? ' depth-consumed bid-consumed' : ''}`}>{formatPrice(level.bid, instrument.priceDecimals)}</td>
                <td className={`book-ask${askConsumed ? ' depth-consumed ask-consumed' : ''}`}>{formatPrice(level.ask, instrument.priceDecimals)}</td>
                <td className={askConsumed ? 'depth-consumed ask-consumed' : ''}>{formatBookSize(level.askSizeM, instrument)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {blockBenchmark && (
        <div className="book-consumption-line">
          <span>Current block:</span>
          <strong>sell sweeps {blockBenchmark.sell.levelsConsumed} · buy sweeps {blockBenchmark.buy.levelsConsumed} levels</strong>
        </div>
      )}

      {hiddenCount > 0 && !expanded && (
        <button className="book-bottom-expand" type="button" onClick={() => setExpanded(true)}>
          Show {hiddenCount} deeper levels
        </button>
      )}
    </div>
  )
}

function bookSizeHeader(instrument: InstrumentConfig, side: 'Bid' | 'Ask'): string {
  if (instrument.assetClass === 'single-stock-equity') return `${side} size (k)`
  if (instrument.assetClass === 'fx') return `${side} size (m)`
  return `${side} size`
}

function formatBookSize(value: number, instrument: InstrumentConfig): string {
  if (instrument.assetClass === 'single-stock-equity') return value.toFixed(0)
  if (instrument.assetClass === 'fx') return value.toFixed(instrument.sizeStepM < 1 ? 1 : 0)
  return value.toFixed(0)
}
