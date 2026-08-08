import { useMemo, useState } from 'react'
import { estimateBlockExecution } from '../engine/accounting'
import { APEX_EQUITY } from '../engine/config'
import type { MarketSnapshot, OrderBookLevel } from '../types'
import {
  formatInstrumentMoney,
  formatInstrumentNotional,
  formatInstrumentSize,
  formatPrice,
} from '../lib/format'

interface InteractiveTutorialProps {
  onExit: () => void
  onComplete: () => void
  onStartCoachedPractice: () => void
}

const instrument = APEX_EQUITY
const baseBook: OrderBookLevel[] = [2, 3, 4, 5, 6, 7, 8, 9].map((size, index) => ({
  level: index + 1,
  bid: 249.99 - index * 0.01,
  ask: 250.00 + index * 0.01,
  bidSizeM: size,
  askSizeM: size,
}))

const tutorialMarket: MarketSnapshot = {
  timestamp: 0,
  mid: 249.995,
  bid: 249.99,
  ask: 250.00,
  spreadPips: 1,
  volatility: 0.32,
  liquidity: 0.82,
  regime: 'calm',
  orderBook: baseBook,
  participantCount: 41,
  displayedDepthM: baseBook.reduce((sum, level) => sum + level.bidSizeM + level.askSizeM, 0),
  liquidityRegime: 'normal',
  bookImbalance: 0,
  hiddenLiquidityShare: 0.12,
  cancellationPressure: 0,
  recentParticipation: 0,
  spreadPressurePips: 0,
  recentImpactPips: 0,
  expectedRecoverySeconds: 18,
  informationLeakageRisk: 0,
}

const steps = [
  {
    title: 'Read the exchange book',
    instruction: 'The displayed market is only the first small slice of available liquidity. Read the depth before pricing the 15k-share block.',
    why: 'A one-tick top-of-book spread does not mean the full 15k can trade at those prices.',
  },
  {
    title: 'Compare the client alternative',
    instruction: 'Review the full-block exchange VWAP and market-impact estimate.',
    why: 'The client compares your firm quote with the cost of sweeping the book, not just the best bid and offer.',
  },
  {
    title: 'Load the live market',
    instruction: 'Load the current bid and offer into the ticket.',
    why: 'A real dealer starts from live executable prices, then chooses the commercial spread and inventory skew.',
  },
  {
    title: 'Price the block competitively',
    instruction: 'Use Widen until your quote is 4–5 ticks wide, then send it.',
    why: 'That is wider than the one-tick displayed spread but tighter than the client’s full-block exchange cost.',
  },
  {
    title: 'Use client flow to internalise',
    instruction: 'The first client sells 15k shares to you. Match 8k against a later client buyer instead of immediately hedging everything.',
    why: 'Internalisation avoids crossing the spread and reduces the exchange footprint of both client trades.',
  },
  {
    title: 'Work the residual',
    instruction: 'Break the remaining 7k-share long into smaller clips rather than sweeping the book in one order.',
    why: 'Smaller clips reduce temporary impact but leave you exposed while the hedge is incomplete.',
  },
  {
    title: 'React to news and thinner depth',
    instruction: 'Release the company headline, refresh the market and widen your quote.',
    why: 'News raises adverse-selection risk and reduces the amount of liquidity available at each level.',
  },
  {
    title: 'Tutorial complete',
    instruction: 'You have priced a block, internalised client flow and worked the residual through the exchange.',
    why: 'The core skill is balancing client competitiveness, commission, inventory risk and market impact.',
  },
]

export function InteractiveTutorial({
  onExit,
  onComplete,
  onStartCoachedPractice,
}: InteractiveTutorialProps) {
  const [step, setStep] = useState(0)
  const [marketBid, setMarketBid] = useState(249.99)
  const [marketAsk, setMarketAsk] = useState(250.00)
  const [bid, setBid] = useState<number | undefined>(undefined)
  const [ask, setAsk] = useState<number | undefined>(undefined)
  const [position, setPosition] = useState(0)
  const [commission, setCommission] = useState(0)
  const [internalised, setInternalised] = useState(0)
  const [worked, setWorked] = useState(0)
  const [newsReleased, setNewsReleased] = useState(false)
  const [message, setMessage] = useState('Begin by reading the visible depth on both sides of the exchange book.')

  const liveMarket = useMemo<MarketSnapshot>(() => ({
    ...tutorialMarket,
    bid: marketBid,
    ask: marketAsk,
    mid: (marketBid + marketAsk) / 2,
    spreadPips: (marketAsk - marketBid) / instrument.pipSize,
    liquidity: newsReleased ? 0.42 : 0.82,
    regime: newsReleased ? 'post-news' : 'calm',
    orderBook: baseBook.map((level) => ({
      ...level,
      bid: marketBid - (level.level - 1) * 0.01,
      ask: marketAsk + (level.level - 1) * 0.01,
      bidSizeM: newsReleased ? Math.max(1, level.bidSizeM * 0.48) : level.bidSizeM,
      askSizeM: newsReleased ? Math.max(1, level.askSizeM * 0.48) : level.askSizeM,
    })),
  }), [marketAsk, marketBid, newsReleased])

  const buyBenchmark = useMemo(
    () => estimateBlockExecution('buy', 15, liveMarket.orderBook, liveMarket, instrument),
    [liveMarket],
  )
  const sellBenchmark = useMemo(
    () => estimateBlockExecution('sell', 15, liveMarket.orderBook, liveMarket, instrument),
    [liveMarket],
  )
  const fullBlockSpread = (buyBenchmark.impactAdjustedPrice - sellBenchmark.impactAdjustedPrice) / instrument.pipSize
  const quoteSpread = bid !== undefined && ask !== undefined ? (ask - bid) / instrument.pipSize : undefined
  const current = steps[step]

  const loadMarket = () => {
    setBid(marketBid)
    setAsk(marketAsk)
    setMessage('Market loaded. The ticket is now a reference, not the final client price.')
  }

  const widen = () => {
    if (bid === undefined || ask === undefined) return
    setBid(Number((bid - 0.01).toFixed(2)))
    setAsk(Number((ask + 0.01).toFixed(2)))
  }

  const tighten = () => {
    if (bid === undefined || ask === undefined || ask - bid <= 0.02) return
    setBid(Number((bid + 0.01).toFixed(2)))
    setAsk(Number((ask - 0.01).toFixed(2)))
  }

  const sendQuote = () => {
    if (step !== 3 || quoteSpread === undefined || quoteSpread < 4 || quoteSpread > 5.1 || bid === undefined) return
    setPosition(15)
    setCommission(1_050)
    setMessage(`Client sells 15k shares to your bid at ${formatPrice(bid, 2)}. You are now long 15k shares.`)
    setStep(4)
  }

  const matchClientFlow = () => {
    if (step !== 4 || position !== 15) return
    setPosition(7)
    setInternalised(8)
    setCommission(1_610)
    setMessage('A second client buys 8k shares from your inventory. Only 7k shares now need an exchange hedge.')
    setStep(5)
  }

  const workResidual = () => {
    if (step !== 5 || position !== 7) return
    setPosition(0)
    setWorked(7)
    setMessage('The 7k-share residual was worked in 2k/2k/2k/1k clips as depth replenished. Inventory is flat.')
    setStep(6)
  }

  const releaseNews = () => {
    if (step !== 6 || newsReleased) return
    setNewsReleased(true)
    setMarketBid(247.82)
    setMarketAsk(247.86)
    setBid(undefined)
    setAsk(undefined)
    setMessage('APEX cuts guidance. The stock gaps lower, the spread widens to four ticks and displayed depth roughly halves.')
  }

  const canContinue =
    step === 0 ||
    step === 1 ||
    (step === 2 && bid !== undefined && ask !== undefined) ||
    (step === 3 && quoteSpread !== undefined && quoteSpread >= 4 && quoteSpread <= 5.1) ||
    (step === 6 && newsReleased) ||
    step === 7

  const next = () => {
    if (!canContinue) return
    if (step === 3) {
      sendQuote()
      return
    }
    if (step === 6) {
      setStep(7)
      onComplete()
      return
    }
    setStep((value) => Math.min(7, value + 1))
    if (step === 0) setMessage('The 15k block consumes several levels and creates temporary impact.')
    if (step === 1) setMessage('Now load the live exchange market into the client ticket.')
    if (step === 2) setMessage('Add a 4–5 tick client spread. This improves on the client’s full-block exchange alternative.')
  }

  const completeAndPractice = () => {
    onComplete()
    onStartCoachedPractice()
  }

  return (
    <main className="tutorial-shell">
      <header className="tutorial-terminal-header">
        <div className="terminal-brand">
          <span className="brand-mark small">DS</span>
          <div>
            <strong>DealerSim Equity Block Tutorial</strong>
            <span>APEX · MARKET PAUSES BETWEEN LESSONS</span>
          </div>
        </div>
        <div className="tutorial-header-actions">
          <span>Step {step + 1} / {steps.length}</span>
          <button type="button" onClick={onExit}>Exit tutorial</button>
        </div>
      </header>

      <div className="tutorial-progress-track">
        {steps.map((item, index) => <span key={item.title} className={index <= step ? 'active' : ''} />)}
      </div>

      <section className="tutorial-workspace">
        <div className="tutorial-market-stack">
          <article className={`terminal-panel tutorial-panel${step <= 1 || step === 6 ? ' tutorial-focus' : ''}`}>
            <div className="panel-title-row">
              <div><span className="panel-kicker">EXCHANGE MARKET</span><strong>APEX eight-level depth</strong></div>
              <span className={newsReleased ? 'status-chip status-warning' : 'status-chip status-live'}>{newsReleased ? 'Post-news' : '41 participants'}</span>
            </div>
            <div className="tutorial-market-price">
              <div><span>Bid</span><strong className="positive">{formatPrice(marketBid, 2)}</strong></div>
              <div><span>Spread</span><strong>{liveMarket.spreadPips.toFixed(0)} tick{liveMarket.spreadPips === 1 ? '' : 's'}</strong></div>
              <div><span>Offer</span><strong className="negative">{formatPrice(marketAsk, 2)}</strong></div>
            </div>
            <table className="tutorial-depth-table">
              <tbody>
                {liveMarket.orderBook.slice(0, 6).map((level) => (
                  <tr key={level.level}>
                    <td>{formatInstrumentSize(level.bidSizeM, instrument)}</td>
                    <td>{formatPrice(level.bid, 2)}</td>
                    <td>{formatPrice(level.ask, 2)}</td>
                    <td>{formatInstrumentSize(level.askSizeM, instrument)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className={`terminal-panel tutorial-panel${step === 1 ? ' tutorial-focus' : ''}`}>
            <div className="panel-title-row">
              <div><span className="panel-kicker">BLOCK BENCHMARK</span><strong>15k-share direct exchange alternative</strong></div>
            </div>
            <div className="tutorial-position-grid block-guide-grid">
              <div><span>Displayed spread</span><strong>1 tick</strong></div>
              <div><span>Full-block spread</span><strong>{fullBlockSpread.toFixed(1)} ticks</strong></div>
              <div><span>Buy alternative</span><strong>{formatPrice(buyBenchmark.impactAdjustedPrice, 2)}</strong></div>
              <div><span>Sell alternative</span><strong>{formatPrice(sellBenchmark.impactAdjustedPrice, 2)}</strong></div>
              <div><span>Estimated buy impact</span><strong>{buyBenchmark.temporaryImpactPips.toFixed(1)} ticks</strong></div>
              <div><span>Block notional</span><strong>{formatInstrumentNotional(15, liveMarket.mid, instrument)}</strong></div>
            </div>
          </article>

          <article className={`terminal-panel tutorial-panel${step === 4 || step === 5 ? ' tutorial-focus' : ''}`}>
            <div className="panel-title-row">
              <div><span className="panel-kicker">POSITION & EXECUTION</span><strong>APEX dealer inventory</strong></div>
              <span className={position > 0 ? 'status-chip status-positive' : 'status-chip'}>{position > 0 ? 'Long' : 'Flat'}</span>
            </div>
            <div className="tutorial-position-grid">
              <div><span>Net position</span><strong>{formatInstrumentSize(position, instrument)}</strong></div>
              <div><span>Commission</span><strong className="commission">{formatInstrumentMoney(commission, instrument)}</strong></div>
              <div><span>Internalised</span><strong>{formatInstrumentSize(internalised, instrument)}</strong></div>
              <div><span>Worked on exchange</span><strong>{formatInstrumentSize(worked, instrument)}</strong></div>
            </div>
            {step === 4 && <button className="button button-primary tutorial-hedge-button" type="button" onClick={matchClientFlow}>Accept offsetting 8k client buy</button>}
            {step === 5 && <button className="button button-primary tutorial-hedge-button" type="button" onClick={workResidual}>Work remaining 7k in clips</button>}
          </article>

          <article className={`terminal-panel tutorial-panel${step === 6 ? ' tutorial-focus' : ''}`}>
            <div className="panel-title-row"><div><span className="panel-kicker">NEWS & EVENTS</span><strong>Company tape</strong></div></div>
            <div className={newsReleased ? 'tutorial-news critical-news' : 'tutorial-news'}>
              <strong>{newsReleased ? 'APEX CUTS FULL-YEAR GUIDANCE' : 'APEX investor update due'}</strong>
              <span>{newsReleased ? 'Price gaps lower and exchange depth falls.' : 'A company-specific release can dominate normal order-flow signals.'}</span>
            </div>
            <button className="button button-ghost" type="button" onClick={releaseNews} disabled={step !== 6 || newsReleased}>Release company headline</button>
          </article>
        </div>

        <article className={`terminal-panel tutorial-quote-panel${step >= 2 && step <= 3 ? ' tutorial-focus' : ''}`}>
          <div className="panel-title-row">
            <div><span className="panel-kicker">CLIENT RFQ</span><strong>Alderstone Equity · Asset Manager</strong></div>
            <span className="rfq-timer">PAUSED</span>
          </div>
          <div className="tutorial-rfq-summary">
            <div><span>Request</span><strong>Two-way block price</strong></div>
            <div><span>Size</span><strong>15k shares</strong></div>
            <div><span>Suggested spread</span><strong>4–5 ticks</strong></div>
          </div>
          <div className="quote-entry-grid tutorial-quote-grid">
            <label><span>Your bid</span><input value={bid === undefined ? '' : formatPrice(bid, 2)} readOnly placeholder={formatPrice(marketBid, 2)} /></label>
            <div className="quote-mid-column"><span>Quoted spread</span><strong>{quoteSpread === undefined ? '—' : `${quoteSpread.toFixed(1)} ticks`}</strong><small>Full-block exchange {fullBlockSpread.toFixed(1)} ticks</small></div>
            <label><span>Your offer</span><input value={ask === undefined ? '' : formatPrice(ask, 2)} readOnly placeholder={formatPrice(marketAsk, 2)} /></label>
          </div>
          <div className="quote-tools tutorial-quote-tools">
            <button className="market-load-button" type="button" onClick={loadMarket} disabled={step < 2 || step > 3}>Load / Refresh Market</button>
            <button type="button" onClick={widen} disabled={bid === undefined || step !== 3}>Widen 2 ticks</button>
            <button type="button" onClick={tighten} disabled={bid === undefined || step !== 3}>Tighten 2 ticks</button>
          </div>
          <div className="tutorial-block-callout">
            <strong>Key distinction</strong>
            <span>Your dealer quote can be wider than the one-tick top of book and still be tighter than the client’s full-block executable spread.</span>
          </div>
        </article>

        <aside className="tutorial-coach-card">
          <p className="eyebrow">LIVE DEALER COACH</p>
          <h1>{current.title}</h1>
          <p className="tutorial-instruction">{current.instruction}</p>
          <div className="tutorial-suggestion">
            <span>Pricing guide</span>
            <strong>{step <= 1 ? `Client exchange alternative: ${fullBlockSpread.toFixed(1)} ticks` : step <= 3 ? 'Suggested dealer spread: 4–5 ticks' : step === 4 ? 'Internalise before hedging' : step === 5 ? '2k-share clips' : 'Widen and refresh after news'}</strong>
          </div>
          <div className="tutorial-why"><span>Why it matters</span><p>{current.why}</p></div>
          <div className="tutorial-message" aria-live="polite">{message}</div>

          {step < 7 ? (
            <button className="button button-primary tutorial-next" type="button" onClick={next} disabled={!canContinue}>
              {step === 0 ? 'Begin tutorial' : step === 3 ? 'Send client quote' : step === 6 ? 'Complete tutorial' : 'Confirm and continue'}
            </button>
          ) : (
            <div className="tutorial-complete-actions">
              <button className="button button-primary" type="button" onClick={completeAndPractice}>Start 3-minute coached practice</button>
              <button className="button button-ghost" type="button" onClick={onExit}>Return to session setup</button>
            </div>
          )}
          {!canContinue && step > 0 && step < 7 && <small className="tutorial-gate-hint">Complete the highlighted action to continue.</small>}
        </aside>
      </section>
    </main>
  )
}
