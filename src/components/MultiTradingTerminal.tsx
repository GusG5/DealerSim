import { useEffect, useMemo, useState } from 'react'
import type { MultiSessionSnapshot, TradeSide, WorkingHedgeStrategy } from '../types'
import { EventFeed } from './EventFeed'
import { DeskContextBar } from './DeskContextBar'
import { HedgePanel } from './HedgePanel'
import { MultiPortfolioPanel } from './MultiPortfolioPanel'
import { MultiRfqQueue } from './MultiRfqQueue'
import { MultiTerminalHeader } from './MultiTerminalHeader'
import { MultiTradeBlotter } from './MultiTradeBlotter'
import { OrderBook } from './OrderBook'
import { PriceChart } from './PriceChart'
import { RfqTicket } from './RfqTicket'

interface MultiTradingTerminalProps {
  snapshot: MultiSessionSnapshot
  muted: boolean
  onToggleMute: () => void
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  onSubmitQuote: (instrumentId: string, bid?: number, ask?: number) => void
  onPassRfq: (instrumentId: string) => void
  onMarketHedge: (instrumentId: string, side: TradeSide, sizeM: number) => void
  onInterdealerHedge: (instrumentId: string, side: TradeSide, sizeM: number) => void
  onStartWorkingHedge: (
    instrumentId: string,
    side: TradeSide,
    sizeM: number,
    strategy: WorkingHedgeStrategy,
    clipSizeM: number,
    intervalSeconds: number,
  ) => void
  onCancelWorkingHedge: (instrumentId: string, orderId: string) => void
  onPauseWorkingHedge: (instrumentId: string, orderId: string) => void
  onResumeWorkingHedge: (instrumentId: string, orderId: string) => void
  onModifyWorkingHedge: (instrumentId: string, orderId: string, clipSizeM: number, intervalSeconds: number) => void
  onCrossWorkingHedge: (instrumentId: string, orderId: string) => void
  onPassiveOrder: (instrumentId: string, side: TradeSide, price: number, sizeM: number) => void
  onCancelPassive: (instrumentId: string, orderId: string) => void
}

export function MultiTradingTerminal({
  snapshot,
  muted,
  onToggleMute,
  onPause,
  onResume,
  onFinish,
  onSubmitQuote,
  onPassRfq,
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
}: MultiTradingTerminalProps) {
  // Client attention and exchange execution are intentionally independent.
  // Incoming RFQs can pull the active client ticket without silently changing
  // the market the dealer is viewing / hedging on the exchange.
  const [selectedTicketInstrumentId, setSelectedTicketInstrumentId] = useState(snapshot.legs[0].options.instrument.id)
  const [selectedExchangeInstrumentId, setSelectedExchangeInstrumentId] = useState(snapshot.legs[0].options.instrument.id)

  useEffect(() => {
    const selectedTicket = snapshot.legs.find((leg) => leg.options.instrument.id === selectedTicketInstrumentId)
    const otherWithRfq = snapshot.legs.find((leg) => leg.activeRfq && leg.options.instrument.id !== selectedTicketInstrumentId)
    if (!selectedTicket?.activeRfq && otherWithRfq?.activeRfq) {
      setSelectedTicketInstrumentId(otherWithRfq.options.instrument.id)
    }
  }, [selectedTicketInstrumentId, snapshot.legs])

  const selectedTicketLeg = useMemo(
    () => snapshot.legs.find((leg) => leg.options.instrument.id === selectedTicketInstrumentId) ?? snapshot.legs[0],
    [selectedTicketInstrumentId, snapshot.legs],
  )
  const selectedExchangeLeg = useMemo(
    () => snapshot.legs.find((leg) => leg.options.instrument.id === selectedExchangeInstrumentId) ?? snapshot.legs[0],
    [selectedExchangeInstrumentId, snapshot.legs],
  )
  const ticketInstrumentId = selectedTicketLeg.options.instrument.id
  const exchangeInstrumentId = selectedExchangeLeg.options.instrument.id

  const onFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen()
    else void document.exitFullscreen()
  }

  return (
    <main className="multi-terminal-shell">
      <MultiTerminalHeader
        snapshot={snapshot}
        selectedInstrumentId={exchangeInstrumentId}
        muted={muted}
        onSelectInstrument={setSelectedExchangeInstrumentId}
        onToggleMute={onToggleMute}
        onPause={onPause}
        onResume={onResume}
        onFinish={onFinish}
        onFullscreen={onFullscreen}
      />

      <DeskContextBar snapshot={snapshot} />

      <section className="multi-terminal-upper-grid">
        <div className="terminal-panel"><EventFeed events={snapshot.events} /></div>
        <div className="terminal-panel"><MultiPortfolioPanel snapshot={snapshot} /></div>
        <div className="terminal-panel"><MultiRfqQueue snapshot={snapshot} selectedInstrumentId={ticketInstrumentId} onSelectInstrument={setSelectedTicketInstrumentId} /></div>
      </section>

      <section className="multi-terminal-workspace">
        <div className="terminal-column multi-client-column">
          <div className="multi-selected-market-banner">
            <span>ACTIVE TICKET</span>
            <strong>{selectedTicketLeg.options.instrument.symbol}</strong>
            <small>{selectedTicketLeg.options.instrument.displayName}</small>
          </div>
          <div className="terminal-panel prominent multi-rfq-panel">
            <RfqTicket
              key={`rfq-${ticketInstrumentId}`}
              snapshot={selectedTicketLeg}
              onSubmit={(bid, ask) => onSubmitQuote(ticketInstrumentId, bid, ask)}
              onPass={() => onPassRfq(ticketInstrumentId)}
            />
          </div>
        </div>

        <div className="terminal-column multi-execution-column">
          <div className="multi-exchange-selector">
            <div><span>EXCHANGE / HEDGE MARKET</span><small>Choose explicitly — RFQs do not change this</small></div>
            <div className="multi-exchange-selector-buttons" style={{ gridTemplateColumns: `repeat(${snapshot.legs.length}, minmax(0, 1fr))` }}>
              {snapshot.legs.map((leg) => {
                const instrument = leg.options.instrument
                return (
                  <button
                    type="button"
                    key={instrument.id}
                    className={instrument.id === exchangeInstrumentId ? 'selected' : ''}
                    onClick={() => setSelectedExchangeInstrumentId(instrument.id)}
                  >
                    <strong>{instrument.symbol}</strong>
                    <span>{leg.position.quantityM === 0 ? 'flat' : `${leg.position.quantityM > 0 ? '+' : ''}${leg.position.quantityM.toFixed(0)} ${instrument.sizeSuffix}`}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="terminal-panel book-terminal-panel">
            <OrderBook market={selectedExchangeLeg.market} instrument={selectedExchangeLeg.options.instrument} activeRfq={selectedExchangeLeg.activeRfq} />
          </div>
          <div className="terminal-panel grow hedge-terminal-panel">
            <HedgePanel
              key={`hedge-${exchangeInstrumentId}`}
              snapshot={selectedExchangeLeg}
              onMarketHedge={(side, sizeM) => onMarketHedge(exchangeInstrumentId, side, sizeM)}
              onInterdealerHedge={(side, sizeM) => onInterdealerHedge(exchangeInstrumentId, side, sizeM)}
              onStartWorkingHedge={(side, sizeM, strategy, clipSizeM, intervalSeconds) =>
                onStartWorkingHedge(exchangeInstrumentId, side, sizeM, strategy, clipSizeM, intervalSeconds)}
              onCancelWorkingHedge={(orderId) => onCancelWorkingHedge(exchangeInstrumentId, orderId)}
              onPauseWorkingHedge={(orderId) => onPauseWorkingHedge(exchangeInstrumentId, orderId)}
              onResumeWorkingHedge={(orderId) => onResumeWorkingHedge(exchangeInstrumentId, orderId)}
              onModifyWorkingHedge={(orderId, clipSizeM, intervalSeconds) => onModifyWorkingHedge(exchangeInstrumentId, orderId, clipSizeM, intervalSeconds)}
              onCrossWorkingHedge={(orderId) => onCrossWorkingHedge(exchangeInstrumentId, orderId)}
              onPassiveOrder={(side, price, sizeM) => onPassiveOrder(exchangeInstrumentId, side, price, sizeM)}
              onCancelPassive={(orderId) => onCancelPassive(exchangeInstrumentId, orderId)}
            />
          </div>
        </div>

        <div className="terminal-column multi-chart-column">
          <div className="multi-chart-selector" style={{ gridTemplateColumns: `repeat(${snapshot.legs.length}, minmax(0, 1fr))` }}>
            {snapshot.legs.map((leg) => {
              const instrument = leg.options.instrument
              return (
                <button type="button" key={instrument.id} className={instrument.id === exchangeInstrumentId ? 'selected' : ''} onClick={() => setSelectedExchangeInstrumentId(instrument.id)}>
                  <strong>{instrument.symbol}</strong><span>{leg.market.regime.replace(/-/g, ' ')}</span>
                </button>
              )
            })}
          </div>
          <div className="terminal-panel chart-panel">
            <PriceChart history={selectedExchangeLeg.priceHistory} trades={selectedExchangeLeg.trades} instrument={selectedExchangeLeg.options.instrument} />
          </div>
          <div className="terminal-panel grow"><MultiTradeBlotter snapshot={snapshot} /></div>
        </div>
      </section>

      {snapshot.status === 'paused' && (
        <div className="pause-overlay"><div><span className="brand-mark">DS</span><h2>Cross-asset desk paused</h2><p>All market clocks and client deadlines are frozen.</p><button className="button button-primary" type="button" onClick={onResume}>Resume trading</button></div></div>
      )}
    </main>
  )
}
