import type { SessionSnapshot, TradeSide, WorkingHedgeStrategy } from '../types'
import { EventFeed } from './EventFeed'
import { HedgePanel } from './HedgePanel'
import { MarketWatch } from './MarketWatch'
import { OrderBook } from './OrderBook'
import { PositionPanel } from './PositionPanel'
import { PriceChart } from './PriceChart'
import { QuoteHistory } from './QuoteHistory'
import { RfqTicket } from './RfqTicket'
import { TerminalHeader } from './TerminalHeader'
import { TradeBlotter } from './TradeBlotter'

interface TradingTerminalProps {
  snapshot: SessionSnapshot
  resolvedScenario?: string
  muted: boolean
  onToggleMute: () => void
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  onSubmitQuote: (bid?: number, ask?: number) => void
  onPassRfq: () => void
  onMarketHedge: (side: TradeSide, sizeM: number) => void
  onStartWorkingHedge: (side: TradeSide, sizeM: number, strategy: WorkingHedgeStrategy, clipSizeM: number, intervalSeconds: number) => void
  onCancelWorkingHedge: (orderId: string) => void
  onPauseWorkingHedge: (orderId: string) => void
  onResumeWorkingHedge: (orderId: string) => void
  onModifyWorkingHedge: (orderId: string, clipSizeM: number, intervalSeconds: number) => void
  onCrossWorkingHedge: (orderId: string) => void
  onPassiveOrder: (side: TradeSide, price: number, sizeM: number) => void
  onCancelPassive: (orderId: string) => void
}

export function TradingTerminal({
  snapshot,
  resolvedScenario,
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
}: TradingTerminalProps) {
  const onFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen()
    } else {
      void document.exitFullscreen()
    }
  }

  return (
    <main className="terminal-shell">
      <TerminalHeader
        snapshot={snapshot}
        resolvedScenario={resolvedScenario}
        muted={muted}
        onToggleMute={onToggleMute}
        onPause={onPause}
        onResume={onResume}
        onFinish={onFinish}
        onFullscreen={onFullscreen}
      />

      <section className="terminal-upper-grid">
        <div className="terminal-panel"><MarketWatch snapshot={snapshot} /></div>
        <div className="terminal-panel"><EventFeed events={snapshot.events} /></div>
        <div className="terminal-panel"><PositionPanel snapshot={snapshot} /></div>
        <div className="terminal-panel"><QuoteHistory records={snapshot.quoteHistory} instrument={snapshot.options.instrument} /></div>
      </section>

      <section className="terminal-lower-grid terminal-lower-grid-v043">
        <div className="terminal-column client-column">
          <div className="terminal-panel prominent">
            <RfqTicket snapshot={snapshot} onSubmit={onSubmitQuote} onPass={onPassRfq} />
          </div>
        </div>

        <div className="terminal-column execution-column">
          <div className="terminal-panel book-terminal-panel">
            <OrderBook
              market={snapshot.market}
              instrument={snapshot.options.instrument}
              activeRfq={snapshot.activeRfq}
            />
          </div>
          <div className="terminal-panel grow hedge-terminal-panel">
            <HedgePanel
              snapshot={snapshot}
              onMarketHedge={onMarketHedge}
              onStartWorkingHedge={onStartWorkingHedge}
              onCancelWorkingHedge={onCancelWorkingHedge}
              onPauseWorkingHedge={onPauseWorkingHedge}
              onResumeWorkingHedge={onResumeWorkingHedge}
              onModifyWorkingHedge={onModifyWorkingHedge}
              onCrossWorkingHedge={onCrossWorkingHedge}
              onPassiveOrder={onPassiveOrder}
              onCancelPassive={onCancelPassive}
            />
          </div>
        </div>

        <div className="terminal-column chart-column">
          <div className="terminal-panel chart-panel">
            <PriceChart history={snapshot.priceHistory} trades={snapshot.trades} instrument={snapshot.options.instrument} />
          </div>
          <div className="terminal-panel grow"><TradeBlotter trades={snapshot.trades} instrument={snapshot.options.instrument} /></div>
        </div>
      </section>

      {snapshot.status === 'paused' && (
        <div className="pause-overlay">
          <div>
            <span className="brand-mark">DS</span>
            <h2>Session paused</h2>
            <p>Market time and client deadlines are frozen.</p>
            <button className="button button-primary" type="button" onClick={onResume}>Resume trading</button>
          </div>
        </div>
      )}
    </main>
  )
}
