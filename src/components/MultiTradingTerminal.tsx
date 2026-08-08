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
  onStartWorkingHedge,
  onCancelWorkingHedge,
  onPauseWorkingHedge,
  onResumeWorkingHedge,
  onModifyWorkingHedge,
  onCrossWorkingHedge,
  onPassiveOrder,
  onCancelPassive,
}: MultiTradingTerminalProps) {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(snapshot.legs[0].options.instrument.id)

  useEffect(() => {
    const selected = snapshot.legs.find((leg) => leg.options.instrument.id === selectedInstrumentId)
    const otherWithRfq = snapshot.legs.find((leg) => leg.activeRfq && leg.options.instrument.id !== selectedInstrumentId)
    if (!selected?.activeRfq && otherWithRfq?.activeRfq) {
      setSelectedInstrumentId(otherWithRfq.options.instrument.id)
    }
  }, [selectedInstrumentId, snapshot.legs])

  const selectedLeg = useMemo(
    () => snapshot.legs.find((leg) => leg.options.instrument.id === selectedInstrumentId) ?? snapshot.legs[0],
    [selectedInstrumentId, snapshot.legs],
  )
  const instrumentId = selectedLeg.options.instrument.id

  const onFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen()
    else void document.exitFullscreen()
  }

  return (
    <main className="multi-terminal-shell">
      <MultiTerminalHeader
        snapshot={snapshot}
        selectedInstrumentId={instrumentId}
        muted={muted}
        onSelectInstrument={setSelectedInstrumentId}
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
        <div className="terminal-panel"><MultiRfqQueue snapshot={snapshot} selectedInstrumentId={instrumentId} onSelectInstrument={setSelectedInstrumentId} /></div>
      </section>

      <section className="multi-terminal-workspace">
        <div className="terminal-column multi-client-column">
          <div className="multi-selected-market-banner">
            <span>ACTIVE TICKET</span>
            <strong>{selectedLeg.options.instrument.symbol}</strong>
            <small>{selectedLeg.options.instrument.displayName}</small>
          </div>
          <div className="terminal-panel prominent multi-rfq-panel">
            <RfqTicket
              key={`rfq-${instrumentId}`}
              snapshot={selectedLeg}
              onSubmit={(bid, ask) => onSubmitQuote(instrumentId, bid, ask)}
              onPass={() => onPassRfq(instrumentId)}
            />
          </div>
        </div>

        <div className="terminal-column multi-execution-column">
          <div className="terminal-panel book-terminal-panel">
            <OrderBook market={selectedLeg.market} instrument={selectedLeg.options.instrument} activeRfq={selectedLeg.activeRfq} />
          </div>
          <div className="terminal-panel grow hedge-terminal-panel">
            <HedgePanel
              key={`hedge-${instrumentId}`}
              snapshot={selectedLeg}
              onMarketHedge={(side, sizeM) => onMarketHedge(instrumentId, side, sizeM)}
              onStartWorkingHedge={(side, sizeM, strategy, clipSizeM, intervalSeconds) =>
                onStartWorkingHedge(instrumentId, side, sizeM, strategy, clipSizeM, intervalSeconds)}
              onCancelWorkingHedge={(orderId) => onCancelWorkingHedge(instrumentId, orderId)}
              onPauseWorkingHedge={(orderId) => onPauseWorkingHedge(instrumentId, orderId)}
              onResumeWorkingHedge={(orderId) => onResumeWorkingHedge(instrumentId, orderId)}
              onModifyWorkingHedge={(orderId, clipSizeM, intervalSeconds) => onModifyWorkingHedge(instrumentId, orderId, clipSizeM, intervalSeconds)}
              onCrossWorkingHedge={(orderId) => onCrossWorkingHedge(instrumentId, orderId)}
              onPassiveOrder={(side, price, sizeM) => onPassiveOrder(instrumentId, side, price, sizeM)}
              onCancelPassive={(orderId) => onCancelPassive(instrumentId, orderId)}
            />
          </div>
        </div>

        <div className="terminal-column multi-chart-column">
          <div className="multi-chart-selector" style={{ gridTemplateColumns: `repeat(${snapshot.legs.length}, minmax(0, 1fr))` }}>
            {snapshot.legs.map((leg) => {
              const instrument = leg.options.instrument
              return (
                <button type="button" key={instrument.id} className={instrument.id === instrumentId ? 'selected' : ''} onClick={() => setSelectedInstrumentId(instrument.id)}>
                  <strong>{instrument.symbol}</strong><span>{leg.market.regime.replace(/-/g, ' ')}</span>
                </button>
              )
            })}
          </div>
          <div className="terminal-panel chart-panel">
            <PriceChart history={selectedLeg.priceHistory} trades={selectedLeg.trades} instrument={selectedLeg.options.instrument} />
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
