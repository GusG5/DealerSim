import { useEffect, useMemo, useRef, useState } from 'react'
import { estimateBlockExecution } from '../engine/accounting'
import type { SessionSnapshot, TradeSide } from '../types'
import {
  formatInstrumentNotional,
  formatInstrumentSize,
  formatPrice,
  quoteUnitLabel,
} from '../lib/format'

interface RfqTicketProps {
  snapshot: SessionSnapshot
  onSubmit: (bid?: number, ask?: number) => void
  onPass: () => void
}

interface LoadedMarketReference {
  bid: number
  ask: number
  loadedAt: number
}

export function RfqTicket({ snapshot, onSubmit, onPass }: RfqTicketProps) {
  const rfq = snapshot.activeRfq
  const instrument = snapshot.options.instrument
  const [bidText, setBidText] = useState('')
  const [askText, setAskText] = useState('')
  const [loadedMarket, setLoadedMarket] = useState<LoadedMarketReference | undefined>(undefined)
  const previousRfqRef = useRef<string | undefined>(undefined)
  const decimals = instrument.priceDecimals
  const tickSize = instrument.pipSize
  const smallIncrement = instrument.marketStructure === 'central-limit-order-book' ? tickSize : tickSize / 10
  const largeIncrement = instrument.marketStructure === 'central-limit-order-book' ? tickSize * 5 : tickSize
  const unitLabel = quoteUnitLabel(instrument)
  const isOneWay = Boolean(rfq && rfq.kind !== 'two-way' && rfq.requestedSide)
  const clientWantsBuy = rfq?.requestedSide === 'buy'

  useEffect(() => {
    if (rfq?.id !== previousRfqRef.current) {
      previousRfqRef.current = rfq?.id
      setBidText('')
      setAskText('')
      setLoadedMarket(undefined)
    }
  }, [rfq?.id])

  const blockBenchmark = useMemo(() => {
    if (!rfq || instrument.marketStructure !== 'central-limit-order-book') return undefined
    const buy = estimateBlockExecution('buy', rfq.sizeM, snapshot.market.orderBook, snapshot.market, instrument)
    const sell = estimateBlockExecution('sell', rfq.sizeM, snapshot.market.orderBook, snapshot.market, instrument)
    return {
      buy,
      sell,
      effectiveSpread: (buy.impactAdjustedPrice - sell.impactAdjustedPrice) / tickSize,
    }
  }, [instrument, rfq, snapshot.market, tickSize])

  const loadMarket = () => {
    if (isOneWay) {
      if (clientWantsBuy) {
        setBidText('')
        setAskText(formatPrice(snapshot.market.ask, decimals))
      } else {
        setBidText(formatPrice(snapshot.market.bid, decimals))
        setAskText('')
      }
    } else {
      setBidText(formatPrice(snapshot.market.bid, decimals))
      setAskText(formatPrice(snapshot.market.ask, decimals))
    }
    setLoadedMarket({ bid: snapshot.market.bid, ask: snapshot.market.ask, loadedAt: snapshot.elapsedSeconds })
  }

  const currentOrMarket = (text: string, fallback: number): number => {
    const parsed = Number(text)
    return text.trim() && Number.isFinite(parsed) ? parsed : fallback
  }

  const shiftQuote = (steps: number) => {
    if (isOneWay) {
      if (clientWantsBuy) {
        setAskText(formatPrice(currentOrMarket(askText, snapshot.market.ask) + steps * smallIncrement, decimals))
      } else {
        setBidText(formatPrice(currentOrMarket(bidText, snapshot.market.bid) + steps * smallIncrement, decimals))
      }
      return
    }
    const bid = currentOrMarket(bidText, snapshot.market.bid)
    const ask = currentOrMarket(askText, snapshot.market.ask)
    setBidText(formatPrice(bid + steps * smallIncrement, decimals))
    setAskText(formatPrice(ask + steps * smallIncrement, decimals))
  }

  const widen = (steps: number) => {
    if (isOneWay) return
    const bid = currentOrMarket(bidText, snapshot.market.bid)
    const ask = currentOrMarket(askText, snapshot.market.ask)
    setBidText(formatPrice(bid - steps * smallIncrement, decimals))
    setAskText(formatPrice(ask + steps * smallIncrement, decimals))
  }

  const adjustOneWayCommerciality = (moreCompetitive: boolean) => {
    if (!isOneWay) return
    const direction = moreCompetitive
      ? clientWantsBuy ? -1 : 1
      : clientWantsBuy ? 1 : -1
    shiftQuote(direction)
  }

  const adjustSide = (side: TradeSide, direction: -1 | 1, large: boolean) => {
    const increment = large ? largeIncrement : smallIncrement
    if (side === 'buy') {
      setBidText(formatPrice(currentOrMarket(bidText, snapshot.market.bid) + direction * increment, decimals))
    } else {
      setAskText(formatPrice(currentOrMarket(askText, snapshot.market.ask) + direction * increment, decimals))
    }
  }

  const submit = () => {
    if (!rfq || snapshot.pendingQuote) return
    const parsedBidValue = bidText.trim() ? Number(bidText) : undefined
    const parsedAskValue = askText.trim() ? Number(askText) : undefined
    const bid = parsedBidValue !== undefined && Number.isFinite(parsedBidValue) ? parsedBidValue : undefined
    const ask = parsedAskValue !== undefined && Number.isFinite(parsedAskValue) ? parsedAskValue : undefined

    if (rfq.kind === 'two-way') {
      if (bid === undefined || ask === undefined) return
      onSubmit(bid, ask)
      return
    }
    if (rfq.requestedSide === 'buy') {
      if (ask === undefined) return
      onSubmit(undefined, ask)
      return
    }
    if (rfq.requestedSide === 'sell') {
      if (bid === undefined) return
      onSubmit(bid, undefined)
    }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!rfq || snapshot.pendingQuote) return
      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onPass()
        return
      }
      if (event.key.toLowerCase() === 'm' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        loadMarket()
        return
      }
      if (!event.altKey) return
      if (isOneWay) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          adjustOneWayCommerciality(true)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          adjustOneWayCommerciality(false)
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          shiftQuote(1)
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          shiftQuote(-1)
        }
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        shiftQuote(1)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        shiftQuote(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        widen(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        widen(-1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const timeRemaining = rfq ? Math.max(0, rfq.expiresAt - snapshot.elapsedSeconds) : 0
  const totalWindow = rfq ? Math.max(0.1, rfq.expiresAt - rfq.createdAt) : 1
  const timerProgress = (timeRemaining / totalWindow) * 100
  const timerCriticalAt = Math.max(2.5, totalWindow * 0.14)
  const timerWarningAt = Math.max(5, totalWindow * 0.3)
  const parsedBid = bidText.trim() ? Number(bidText) : undefined
  const parsedAsk = askText.trim() ? Number(askText) : undefined
  const quoteSpread = useMemo(() => {
    if (isOneWay || !Number.isFinite(parsedBid) || !Number.isFinite(parsedAsk)) return undefined
    return ((parsedAsk as number) - (parsedBid as number)) / tickSize
  }, [isOneWay, parsedAsk, parsedBid, tickSize])
  const bidVsMarket = Number.isFinite(parsedBid) ? ((parsedBid as number) - snapshot.market.bid) / tickSize : undefined
  const askVsMarket = Number.isFinite(parsedAsk) ? ((parsedAsk as number) - snapshot.market.ask) / tickSize : undefined
  const referenceAge = loadedMarket ? Math.max(0, snapshot.elapsedSeconds - loadedMarket.loadedAt) : undefined
  const referenceMove = loadedMarket ? (snapshot.market.mid - (loadedMarket.bid + loadedMarket.ask) / 2) / tickSize : undefined
  const learningPrompt = getLearningPrompt(snapshot)
  const suggestedQuote = rfq && (snapshot.options.difficulty === 'learning' || snapshot.options.coachingMode === 'assisted')
    ? getSuggestedQuote(snapshot)
    : undefined
  const canSubmit = Boolean(
    rfq &&
    !snapshot.pendingQuote &&
    (rfq.kind === 'two-way'
      ? Number.isFinite(parsedBid) && Number.isFinite(parsedAsk)
      : rfq.requestedSide === 'buy'
        ? Number.isFinite(parsedAsk)
        : Number.isFinite(parsedBid)),
  )

  return (
    <div className={`rfq-ticket${rfq ? ' active' : ''}`}>
      <div className="panel-title-row">
        <div>
          <span className="panel-kicker">CLIENT RFQ</span>
          <strong>{rfq ? rfq.clientName : 'Waiting for client flow'}</strong>
        </div>
        {rfq && (
          <span className={`rfq-timer${timeRemaining < timerCriticalAt ? ' critical' : timeRemaining < timerWarningAt ? ' warning' : ''}`}>
            {timeRemaining.toFixed(1)}s
          </span>
        )}
      </div>

      {rfq ? (
        <>
          <div className="rfq-progress"><span style={{ width: `${Math.max(0, Math.min(100, timerProgress))}%` }} /></div>
          {rfq.controlFlag && <div className="control-check-banner"><strong>CONTROL CHECK</strong><span>{rfq.controlNote}</span><small>Pricing this RFQ without resolving the check counts as a control failure. Passing represents clarification / escalation.</small></div>}
          <div className="rfq-identity">
            <div><span>Client classification</span><strong>{rfq.clientLabel}</strong></div>
            <div>
              <span>Request</span>
              <strong>
                {rfq.kind === 'two-way'
                  ? 'Two-way block price'
                  : rfq.kind === 'limit-interest'
                    ? `${rfq.requestedSide === 'buy' ? 'Buy' : 'Sell'} limit ${rfq.limitPrice?.toFixed(decimals)}`
                    : rfq.requestedSide === 'buy' ? 'Offer only' : 'Bid only'}
              </strong>
            </div>
            <div>
              <span>Block size</span>
              <strong>{formatInstrumentSize(rfq.sizeM, instrument)}</strong>
              <small className="rfq-notional">{formatInstrumentNotional(rfq.sizeM, snapshot.market.mid, instrument)} notional</small>
            </div>
          </div>

          {learningPrompt && <div className="learning-prompt">{learningPrompt}</div>}

          {blockBenchmark && snapshot.options.difficulty === 'learning' && (
            isOneWay ? (
              <div className="block-benchmark-card one-way-benchmark-card">
                <div>
                  <span>{clientWantsBuy ? 'Top offer' : 'Top bid'}</span>
                  <strong>{formatPrice(clientWantsBuy ? snapshot.market.ask : snapshot.market.bid, decimals)}</strong>
                </div>
                <div>
                  <span>Direct VWAP</span>
                  <strong>{formatPrice(clientWantsBuy ? blockBenchmark.buy.directVwap : blockBenchmark.sell.directVwap, decimals)}</strong>
                </div>
                <div>
                  <span>Impact-adjusted alternative</span>
                  <strong>{formatPrice(clientWantsBuy ? blockBenchmark.buy.impactAdjustedPrice : blockBenchmark.sell.impactAdjustedPrice, decimals)}</strong>
                </div>
                <div>
                  <span>Depth / impact</span>
                  <strong>{clientWantsBuy ? blockBenchmark.buy.levelsConsumed : blockBenchmark.sell.levelsConsumed} lvls · {(clientWantsBuy ? blockBenchmark.buy.temporaryImpactPips : blockBenchmark.sell.temporaryImpactPips).toFixed(1)} {unitLabel}</strong>
                </div>
                <details className="learning-detail"><summary>Why this benchmark?</summary><p>This is a one-way request. Compare the single firm price you show with the client’s cost of executing the whole block in that direction, including book sweep and market impact.</p></details>
              </div>
            ) : (
              <div className="block-benchmark-card">
                <div>
                  <span>Displayed spread</span>
                  <strong>{snapshot.market.spreadPips.toFixed(1)} {unitLabel}</strong>
                </div>
                <div>
                  <span>Full-block spread</span>
                  <strong>{blockBenchmark.effectiveSpread.toFixed(1)} {unitLabel}</strong>
                </div>
                <div>
                  <span>Buy block alternative</span>
                  <strong>{formatPrice(blockBenchmark.buy.impactAdjustedPrice, decimals)}</strong>
                </div>
                <div>
                  <span>Sell block alternative</span>
                  <strong>{formatPrice(blockBenchmark.sell.impactAdjustedPrice, decimals)}</strong>
                </div>
                <details className="learning-detail"><summary>Why this benchmark?</summary><p>The client compares your firm block price with the VWAP and impact of executing the entire order through the exchange, not only the best bid and offer.</p></details>
              </div>
            )
          )}

          {suggestedQuote && (
            suggestedQuote.mode === 'one-way' ? (
              <div className="suggested-quote-card one-way-suggestion">
                <div>
                  <span>Suggested dealer {suggestedQuote.clientSide === 'buy' ? 'offer' : 'bid'}</span>
                  <strong>{formatPrice(suggestedQuote.priceLow, decimals)}–{formatPrice(suggestedQuote.priceHigh, decimals)}</strong>
                </div>
                <div>
                  <span>Client exchange alternative</span>
                  <strong>{formatPrice(suggestedQuote.exchangeAlternative, decimals)}</strong>
                </div>
                <div>
                  <span>Price improvement</span>
                  <strong>{suggestedQuote.improvementLow.toFixed(1)}–{suggestedQuote.improvementHigh.toFixed(1)} {unitLabel}</strong>
                </div>
                <div>
                  <span>Inventory effect</span>
                  <strong className={suggestedQuote.inventoryEffect === 'Helpful' ? 'positive' : suggestedQuote.inventoryEffect === 'Adverse' ? 'negative' : ''}>{suggestedQuote.inventoryEffect}</strong>
                </div>
                <details className="learning-detail"><summary>Why this range?</summary><p>{suggestedQuote.reason}</p></details>
              </div>
            ) : (
              <div className="suggested-quote-card">
                <div>
                  <span>Suggested client spread</span>
                  <strong>{suggestedQuote.low.toFixed(1)}–{suggestedQuote.high.toFixed(1)} {unitLabel}</strong>
                </div>
                <div>
                  <span>Suggested centre skew</span>
                  <strong className={suggestedQuote.skewPips < 0 ? 'negative' : suggestedQuote.skewPips > 0 ? 'positive' : ''}>
                    {suggestedQuote.skewPips === 0 ? 'Neutral' : `${suggestedQuote.skewPips > 0 ? '+' : ''}${suggestedQuote.skewPips.toFixed(1)} ${unitLabel}`}
                  </strong>
                </div>
                <details className="learning-detail"><summary>Why this range?</summary><p>{suggestedQuote.reason}</p></details>
              </div>
            )
          )}

          {isOneWay ? (
            <div className="quote-entry-grid one-way-quote-entry">
              <div className="one-way-direction-card">
                <span>Client direction</span>
                <strong>{clientWantsBuy ? 'BUYER · OFFER REQUESTED' : 'SELLER · BID REQUESTED'}</strong>
                <small>{rfq.kind === 'limit-interest' ? `Limit ${formatPrice(rfq.limitPrice ?? 0, decimals)} · ` : ''}Only the requested side is transmitted to the client.</small>
              </div>
              <label>
                <span>Your {clientWantsBuy ? 'offer' : 'bid'}</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={clientWantsBuy ? askText : bidText}
                  onChange={(event) => clientWantsBuy ? setAskText(event.target.value) : setBidText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                      event.preventDefault()
                      event.stopPropagation()
                      adjustSide(clientWantsBuy ? 'sell' : 'buy', event.key === 'ArrowUp' ? 1 : -1, event.shiftKey)
                    }
                  }}
                  placeholder={formatPrice(clientWantsBuy ? snapshot.market.ask : snapshot.market.bid, decimals)}
                  disabled={Boolean(snapshot.pendingQuote)}
                />
                <small>
                  Market {formatPrice(clientWantsBuy ? snapshot.market.ask : snapshot.market.bid, decimals)}
                  {clientWantsBuy
                    ? askVsMarket !== undefined && <> · {formatUnitDelta(askVsMarket)}</>
                    : bidVsMarket !== undefined && <> · {formatUnitDelta(bidVsMarket)}</>}
                </small>
              </label>
            </div>
          ) : (
            <div className="quote-entry-grid">
              <label>
                <span>Your bid</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={bidText}
                  onChange={(event) => setBidText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                      event.preventDefault()
                      event.stopPropagation()
                      adjustSide('buy', event.key === 'ArrowUp' ? 1 : -1, event.shiftKey)
                    }
                  }}
                  placeholder={formatPrice(snapshot.market.bid, decimals)}
                  disabled={Boolean(snapshot.pendingQuote)}
                />
                <small>Market {formatPrice(snapshot.market.bid, decimals)}{bidVsMarket !== undefined && <> · {formatUnitDelta(bidVsMarket)}</>}</small>
              </label>
              <div className="quote-mid-column">
                <span>Quoted spread</span>
                <strong className={quoteSpread !== undefined && quoteSpread < 0 ? 'negative' : ''}>
                  {quoteSpread === undefined ? '—' : `${quoteSpread.toFixed(1)} ${unitLabel}`}
                </strong>
                <small>Displayed {snapshot.market.spreadPips.toFixed(1)} {unitLabel}</small>
              </div>
              <label>
                <span>Your offer</span>
                <input
                  inputMode="decimal"
                  value={askText}
                  onChange={(event) => setAskText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                      event.preventDefault()
                      event.stopPropagation()
                      adjustSide('sell', event.key === 'ArrowUp' ? 1 : -1, event.shiftKey)
                    }
                  }}
                  placeholder={formatPrice(snapshot.market.ask, decimals)}
                  disabled={Boolean(snapshot.pendingQuote)}
                />
                <small>Market {formatPrice(snapshot.market.ask, decimals)}{askVsMarket !== undefined && <> · {formatUnitDelta(askVsMarket)}</>}</small>
              </label>
            </div>
          )}

          <div className={`quote-reference-bar${loadedMarket ? '' : ' empty'}`}>
            {loadedMarket ? (
              <>
                <span>
                  Loaded {isOneWay
                    ? formatPrice(clientWantsBuy ? loadedMarket.ask : loadedMarket.bid, decimals)
                    : `${formatPrice(loadedMarket.bid, decimals)} / ${formatPrice(loadedMarket.ask, decimals)}`}
                </span>
                <strong>{referenceAge?.toFixed(1)}s old</strong>
                <span className={Math.abs(referenceMove ?? 0) >= 1 ? 'warning' : ''}>Market {formatUnitDelta(referenceMove ?? 0)} since load</span>
              </>
            ) : (
              <span>Press <kbd>M</kbd> or Load Market to pull the current exchange reference into the ticket.</span>
            )}
          </div>

          {isOneWay ? (
            <div className="quote-tools one-way-tools">
              <button className="market-load-button" type="button" onClick={loadMarket} disabled={Boolean(snapshot.pendingQuote)}>Load Market <kbd>M</kbd></button>
              <button type="button" onClick={() => adjustOneWayCommerciality(true)} disabled={Boolean(snapshot.pendingQuote)}>More competitive <kbd>Alt←</kbd></button>
              <button type="button" onClick={() => adjustOneWayCommerciality(false)} disabled={Boolean(snapshot.pendingQuote)}>More edge <kbd>Alt→</kbd></button>
            </div>
          ) : (
            <div className="quote-tools">
              <button className="market-load-button" type="button" onClick={loadMarket} disabled={Boolean(snapshot.pendingQuote)}>Load Market <kbd>M</kbd></button>
              <button type="button" onClick={() => shiftQuote(-1)} disabled={Boolean(snapshot.pendingQuote)}>Shift −1 {instrument.marketStructure === 'central-limit-order-book' ? 'tick' : 'pipette'} <kbd>Alt↓</kbd></button>
              <button type="button" onClick={() => shiftQuote(1)} disabled={Boolean(snapshot.pendingQuote)}>Shift +1 {instrument.marketStructure === 'central-limit-order-book' ? 'tick' : 'pipette'} <kbd>Alt↑</kbd></button>
              <button type="button" onClick={() => widen(1)} disabled={Boolean(snapshot.pendingQuote)}>Widen <kbd>Alt→</kbd></button>
              <button type="button" onClick={() => widen(-1)} disabled={Boolean(snapshot.pendingQuote)}>Tighten <kbd>Alt←</kbd></button>
            </div>
          )}

          <div className="quote-keyboard-hint">
            {isOneWay
              ? `↑/↓ moves the requested price by one ${instrument.marketStructure === 'central-limit-order-book' ? 'tick' : 'pipette'}; Alt← improves the client price and Alt→ keeps more dealer edge.`
              : `Focus a side and use ↑/↓ for one ${instrument.marketStructure === 'central-limit-order-book' ? 'tick' : 'pipette'}; hold Shift for a larger adjustment.`}
          </div>

          <div className="rfq-actions">
            <button className="button button-danger" type="button" onClick={onPass} disabled={Boolean(snapshot.pendingQuote)}>Pass <kbd>Esc</kbd></button>
            <button className="button button-primary" type="button" onClick={submit} disabled={!canSubmit}>
              {snapshot.pendingQuote ? 'Client deciding…' : isOneWay ? <>Send {clientWantsBuy ? 'offer' : 'bid'} <kbd>Enter</kbd></> : <>Send quote <kbd>Enter</kbd></>}
            </button>
          </div>
        </>
      ) : (
        <div className="rfq-waiting rfq-waiting-active">
          <div className="rfq-waiting-status">
            <span className="pulse-ring" />
            <div><strong>Monitoring client channels</strong><p>Use the quiet period to review inventory and working hedges.</p></div>
          </div>
          {snapshot.quoteHistory.length > 0 && (
            <div className="rfq-waiting-recent">
              <span className="panel-kicker">RECENT CLIENT FLOW</span>
              {snapshot.quoteHistory.slice(-3).reverse().map((record) => (
                <div key={record.id}>
                  <strong>{record.rfq.clientName}</strong>
                  <span>{formatInstrumentSize(record.rfq.sizeM, instrument)}</span>
                  <em>{record.outcome?.accepted ? 'Traded' : record.rfq.status === 'expired' ? 'Expired' : record.rfq.status === 'rejected' ? 'Passed / declined' : 'Quoted'}</em>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatUnitDelta(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}`
}

function getLearningPrompt(snapshot: SessionSnapshot): string | undefined {
  if (snapshot.options.difficulty !== 'learning' && snapshot.options.coachingMode !== 'assisted') return undefined
  const position = snapshot.position.quantityM
  const symbol = snapshot.options.instrument.symbol
  const rfq = snapshot.activeRfq

  if (rfq && rfq.kind !== 'two-way' && rfq.requestedSide) {
    const inventoryHelpful =
      (rfq.requestedSide === 'buy' && position > snapshot.softLimitM * 0.2) ||
      (rfq.requestedSide === 'sell' && position < -snapshot.softLimitM * 0.2)
    const inventoryAdverse =
      (rfq.requestedSide === 'buy' && position < -snapshot.softLimitM * 0.2) ||
      (rfq.requestedSide === 'sell' && position > snapshot.softLimitM * 0.2)

    if (inventoryHelpful) {
      return `This one-way request can reduce your ${position > 0 ? 'long' : 'short'} ${symbol} inventory. You can afford to be more competitive on the requested ${rfq.requestedSide === 'buy' ? 'offer' : 'bid'}.`
    }
    if (inventoryAdverse) {
      return `This one-way request would increase your ${position > 0 ? 'long' : 'short'} ${symbol} risk. Keep more dealer edge, hedge deliberately, or pass if the economics are poor.`
    }
    if (snapshot.options.instrument.marketStructure === 'central-limit-order-book') {
      return `Only price the requested ${rfq.requestedSide === 'buy' ? 'offer' : 'bid'}. Benchmark it against the client’s full-block execution cost in that direction.`
    }
    return `Only the requested ${rfq.requestedSide === 'buy' ? 'offer' : 'bid'} matters. Re-anchor to the live market before sending it.`
  }

  if (position > snapshot.softLimitM * 0.55) {
    return `You are materially long ${symbol}. Shift both prices lower to attract a buyer who can internalise part of your inventory.`
  }
  if (position < -snapshot.softLimitM * 0.55) {
    return `You are materially short ${symbol}. Shift both prices higher to attract a seller who can internalise part of your inventory.`
  }
  if (snapshot.market.volatility > 0.55) {
    return 'Volatility is elevated. Re-check the live market and depth immediately before submitting.'
  }
  if (snapshot.options.instrument.marketStructure === 'central-limit-order-book') {
    return 'Compare your firm block quote with the client’s full-size exchange VWAP and impact, not only the displayed spread.'
  }
  return 'Load the live market, then adjust spread and skew for client quality, size and inventory.'
}

interface TwoWaySuggestedQuote {
  mode: 'two-way'
  low: number
  high: number
  skewPips: number
  reason: string
}

interface OneWaySuggestedQuote {
  mode: 'one-way'
  clientSide: TradeSide
  priceLow: number
  priceHigh: number
  exchangeAlternative: number
  improvementLow: number
  improvementHigh: number
  inventoryEffect: 'Helpful' | 'Neutral' | 'Adverse'
  reason: string
}

type SuggestedQuote = TwoWaySuggestedQuote | OneWaySuggestedQuote

function getSuggestedQuote(snapshot: SessionSnapshot): SuggestedQuote {
  const rfq = snapshot.activeRfq
  if (!rfq) {
    return {
      mode: 'two-way',
      low: snapshot.market.spreadPips,
      high: snapshot.market.spreadPips + 0.4,
      skewPips: 0,
      reason: 'No active RFQ.',
    }
  }

  const instrument = snapshot.options.instrument

  if (rfq.kind !== 'two-way' && rfq.requestedSide) {
    const clientSide = rfq.requestedSide
    const isClientBuy = clientSide === 'buy'
    const topPrice = isClientBuy ? snapshot.market.ask : snapshot.market.bid
    const block = instrument.marketStructure === 'central-limit-order-book'
      ? estimateBlockExecution(clientSide, rfq.sizeM, snapshot.market.orderBook, snapshot.market, instrument)
      : undefined
    const exchangeAlternative = block?.impactAdjustedPrice ?? topPrice
    const rawRoomPips = isClientBuy
      ? (exchangeAlternative - topPrice) / instrument.pipSize
      : (topPrice - exchangeAlternative) / instrument.pipSize
    const roomPips = Math.max(0, rawRoomPips)

    const captureRatio = rfq.clientType === 'fast-money'
      ? 0.72
      : rfq.clientType === 'hedge-fund'
        ? 0.64
        : rfq.clientType === 'asset-manager'
          ? 0.5
          : rfq.clientType === 'corporate'
            ? 0.44
            : 0.38

    const inventoryRatio = clamp(snapshot.position.quantityM / Math.max(1, snapshot.hardLimitM), -1, 1)
    const inventoryHelpful = (isClientBuy && inventoryRatio > 0.08) || (!isClientBuy && inventoryRatio < -0.08)
    const inventoryAdverse = (isClientBuy && inventoryRatio < -0.08) || (!isClientBuy && inventoryRatio > 0.08)
    const inventoryEffect: OneWaySuggestedQuote['inventoryEffect'] = inventoryHelpful ? 'Helpful' : inventoryAdverse ? 'Adverse' : 'Neutral'
    const riskPremiumPips =
      Math.max(0, snapshot.market.volatility - 0.3) * 0.65 +
      Math.max(0, 0.6 - snapshot.market.liquidity) * 1.0
    const inventoryAdjustment = inventoryHelpful
      ? -Math.min(1.1, Math.abs(inventoryRatio) * 1.3)
      : inventoryAdverse
        ? Math.min(1.2, Math.abs(inventoryRatio) * 1.4)
        : 0

    // The dealer captures part of the client's block-execution cost advantage.
    // Leave at least a small improvement versus direct execution when there is room.
    const maximumCapturePips = roomPips > 0.2 ? Math.max(0, roomPips - 0.2) : 0.4
    const targetCapturePips = clamp(roomPips * captureRatio + riskPremiumPips + inventoryAdjustment, -0.5, maximumCapturePips)
    const halfRange = roomPips >= 4 ? 0.6 : roomPips >= 2 ? 0.45 : 0.3
    let captureLow = clamp(targetCapturePips - halfRange, -0.6, maximumCapturePips)
    let captureHigh = clamp(targetCapturePips + halfRange, -0.4, maximumCapturePips)

    let priceA = isClientBuy
      ? topPrice + captureLow * instrument.pipSize
      : topPrice - captureHigh * instrument.pipSize
    let priceB = isClientBuy
      ? topPrice + captureHigh * instrument.pipSize
      : topPrice - captureLow * instrument.pipSize

    if (rfq.kind === 'limit-interest' && rfq.limitPrice !== undefined) {
      if (isClientBuy) {
        priceA = Math.min(priceA, rfq.limitPrice)
        priceB = Math.min(priceB, rfq.limitPrice)
      } else {
        priceA = Math.max(priceA, rfq.limitPrice)
        priceB = Math.max(priceB, rfq.limitPrice)
      }
    }

    const priceLow = Math.min(priceA, priceB)
    const priceHigh = Math.max(priceA, priceB)
    const improvementA = isClientBuy
      ? (exchangeAlternative - priceLow) / instrument.pipSize
      : (priceLow - exchangeAlternative) / instrument.pipSize
    const improvementB = isClientBuy
      ? (exchangeAlternative - priceHigh) / instrument.pipSize
      : (priceHigh - exchangeAlternative) / instrument.pipSize

    const improvementLow = Math.max(0, Math.min(improvementA, improvementB))
    const improvementHigh = Math.max(0, Math.max(improvementA, improvementB))
    const benchmarkDescription = block
      ? `Direct execution of the whole block is estimated around ${formatPrice(exchangeAlternative, instrument.priceDecimals)} after sweeping ${block.levelsConsumed} level${block.levelsConsumed === 1 ? '' : 's'} and allowing for temporary impact.`
      : `The live market reference is ${formatPrice(topPrice, instrument.priceDecimals)}.`

    return {
      mode: 'one-way',
      clientSide,
      priceLow,
      priceHigh,
      exchangeAlternative,
      improvementLow,
      improvementHigh,
      inventoryEffect,
      reason: `${benchmarkDescription} The suggested range shares the block-liquidity advantage with the client while adjusting dealer edge for toxicity, volatility, liquidity and whether the flow helps your inventory.`,
    }
  }

  let target: number
  let benchmarkText: string

  if (instrument.marketStructure === 'central-limit-order-book') {
    const buy = estimateBlockExecution('buy', rfq.sizeM, snapshot.market.orderBook, snapshot.market, instrument)
    const sell = estimateBlockExecution('sell', rfq.sizeM, snapshot.market.orderBook, snapshot.market, instrument)
    const executableSpread = Math.max(snapshot.market.spreadPips, (buy.impactAdjustedPrice - sell.impactAdjustedPrice) / instrument.pipSize)
    const captureRatio = rfq.clientType === 'fast-money'
      ? 0.92
      : rfq.clientType === 'hedge-fund'
        ? 0.84
        : rfq.clientType === 'asset-manager'
          ? 0.72
          : rfq.clientType === 'corporate'
            ? 0.68
            : 0.62
    const riskPremium = Math.max(0, snapshot.market.volatility - 0.3) * 0.7 + Math.max(0, 0.6 - snapshot.market.liquidity) * 1.2
    target = Math.max(snapshot.market.spreadPips, executableSpread * captureRatio + riskPremium)
    benchmarkText = `The full block would cost roughly ${executableSpread.toFixed(1)} ticks across exchange depth and impact. The guide leaves the client a price improvement while retaining room to manage the residual.`
  } else {
    const clientAdjustment = rfq.clientType === 'fast-money' ? 0.45 : rfq.clientType === 'hedge-fund' ? 0.3 : rfq.clientType === 'retail-aggregator' ? -0.1 : 0.05
    const sizeRatio = rfq.sizeM / Math.max(1, instrument.defaultSizeM)
    target = snapshot.market.spreadPips + 0.4 + clientAdjustment + Math.min(0.6, Math.max(0, sizeRatio - 1) * 0.12)
    benchmarkText = 'The guide balances client competitiveness against expected hedge cost and toxicity.'
  }

  const inventoryRatio = snapshot.position.quantityM / Math.max(1, snapshot.hardLimitM)
  const skewPips = Math.abs(inventoryRatio) < 0.08 ? 0 : Math.max(-2, Math.min(2, -inventoryRatio * 2.4))
  return {
    mode: 'two-way',
    low: Math.max(snapshot.market.spreadPips, target * 0.9),
    high: target * 1.08,
    skewPips,
    reason: benchmarkText,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
