import { useMemo, useState } from 'react'
import { FUND_ASSETS, FUND_ASSET_MAP, FUND_SCENARIOS } from '../engine/fund'
import { commissionForNotional, formatNativeQuantity, nativeQuantityFromNotional, notionalFromNativeQuantity, roundNativeQuantity, topOfBookQuote } from '../engine/buy-side-market'
import type { FundAssetId, FundSessionSnapshot, FundThesisTag, FundHorizon, FundTradeIntent, FundWorkingStyle } from '../engine/fund-types'
import { formatMoney, formatPercent, formatTime } from '../lib/format'

interface Props {
  snapshot: FundSessionSnapshot
  feedback: string
  onExecuteTarget: (intent: FundTradeIntent) => { accepted: boolean; reason: string } | undefined
  onExecuteAuction: (intent: FundTradeIntent) => { accepted: boolean; reason: string } | undefined
  onRequestLocate: (assetId: FundAssetId, targetWeight: number) => { accepted: boolean; reason: string } | undefined
  onRequestDealerQuotes: (intent: FundTradeIntent, dealerCount: number) => { accepted: boolean; reason: string } | undefined
  onAcceptDealerQuote: (quoteId: string, fillFraction?: number) => { accepted: boolean; reason: string } | undefined
  onCancelDealerRfq: () => unknown
  onStartWorkingOrder: (intent: FundTradeIntent, style: FundWorkingStyle, durationSeconds: number) => unknown
  onPauseWorkingOrder: (id: string) => void
  onResumeWorkingOrder: (id: string) => void
  onCancelWorkingOrder: (id: string) => void
  onCrossWorkingOrder: (id: string) => unknown
  onHedgeBeta: () => unknown
  onPause: () => void
  onResume: () => void
  onFinish: () => void
}

type SizingMode = 'quantity' | 'weight'
const thesisTags: FundThesisTag[] = ['earnings', 'valuation', 'catalyst', 'quality', 'momentum', 'relative-value', 'short-thesis', 'risk-hedge']
const horizons: FundHorizon[] = ['intraday', 'days', 'weeks']

function weightOf(snapshot: FundSessionSnapshot, assetId: FundAssetId): number {
  return snapshot.nav ? snapshot.positions[assetId].units * snapshot.prices[assetId] / snapshot.nav : 0
}
function signed(value: number, digits = 1): string { return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%` }
function clock(seconds: number): string { return formatTime(Math.max(0, seconds)) }
function priceText(id: FundAssetId, value: number): string { return value.toFixed(FUND_ASSET_MAP[id].priceDecimals) }
function defaultQuantity(id: FundAssetId): string { return id === 'es-fund' ? '25' : '10000' }
function quickQuantities(id: FundAssetId): number[] { return id === 'es-fund' ? [5, 10, 25, 50] : [1000, 5000, 10000, 25000] }
function phaseText(phase: FundSessionSnapshot['marketPhase']): string {
  if (phase === 'opening-auction') return 'OPENING AUCTION'
  if (phase === 'morning-liquidity') return 'MORNING LIQUIDITY'
  if (phase === 'midday') return 'MIDDAY / THIN'
  if (phase === 'event-window') return 'EVENT WINDOW'
  return 'CLOSING AUCTION'
}

export function FundTradingTerminal(props: Props) {
  const { snapshot } = props
  const assessment = snapshot.options.difficulty === 'assessment'
  const [selectedId, setSelectedId] = useState<FundAssetId>('mega-fund')
  const [sizingMode, setSizingMode] = useState<SizingMode>('quantity')
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy')
  const [tradeQuantityInput, setTradeQuantityInput] = useState(defaultQuantity('mega-fund'))
  const [targetWeightInput, setTargetWeightInput] = useState('5')
  const [recordThesis, setRecordThesis] = useState(false)
  const [tag, setTag] = useState<FundThesisTag>('earnings')
  const [horizon, setHorizon] = useState<FundHorizon>('days')
  const [conviction, setConviction] = useState(3)
  const [invalidation, setInvalidation] = useState('')
  const [workDuration, setWorkDuration] = useState(45)
  const [dealerCustomQty, setDealerCustomQty] = useState<Record<string, string>>({})

  const asset = FUND_ASSET_MAP[selectedId]
  const mid = snapshot.prices[selectedId]
  const marketQuote = topOfBookQuote(asset, mid, snapshot.liquidityCostMultiplier, snapshot.volatilityMultiplier)
  const currentWeight = weightOf(snapshot, selectedId)
  const enteredQuantity = roundNativeQuantity(asset, Math.max(0, Number(tradeQuantityInput) || 0))
  const quantityNotional = notionalFromNativeQuantity(asset, mid, enteredQuantity)
  const targetFromQuantity = currentWeight + (tradeDirection === 'buy' ? 1 : -1) * quantityNotional / Math.max(1, snapshot.nav)
  const rawTarget = sizingMode === 'quantity' ? targetFromQuantity : (Number(targetWeightInput) || 0) / 100
  const targetWeight = snapshot.options.mandate === 'long-only' ? Math.max(0, rawTarget) : rawTarget
  const targetDelta = targetWeight - currentWeight
  const targetNotional = Math.abs(targetDelta) * snapshot.nav
  const targetQuantity = nativeQuantityFromNotional(asset, mid, targetNotional)
  const canTrade = Math.abs(targetDelta) > .0001
  const requiresLocate = snapshot.options.mandate === 'long-short' && selectedId !== 'es-fund' && targetWeight < 0
  const locate = snapshot.locates[selectedId]
  const locateSufficient = !requiresLocate || Boolean(locate && locate.status !== 'rejected' && locate.approvedShortWeight + .0005 >= Math.abs(targetWeight))
  const intent: FundTradeIntent = { assetId: selectedId, targetWeight, recordThesis, tag, horizon, conviction, invalidation }
  const executionSide: 'buy' | 'sell' = targetDelta >= 0 ? 'buy' : 'sell'
  const directReferencePrice = executionSide === 'buy' ? marketQuote.offer : marketQuote.bid
  const estimatedCommission = canTrade ? commissionForNotional(asset, directReferencePrice, targetNotional, 'direct-market') : 0
  const sessionReturn = snapshot.nav / snapshot.options.initialNav - 1
  const benchmarkReturn = snapshot.benchmarkNav / snapshot.options.initialNav - 1
  const alphaReturn = snapshot.options.mandate === 'long-only' ? sessionReturn - benchmarkReturn : snapshot.attribution.alphaPnl / snapshot.options.initialNav
  const activeWorking = snapshot.workingOrders.filter((order) => order.status === 'working' || order.status === 'paused')
  const upcoming = snapshot.calendar.filter((event) => !event.revealed).slice(0, 4)
  const history = snapshot.history.map((point) => point.prices[selectedId])
  const chartPath = useMemo(() => {
    if (history.length < 2) return ''
    const min = Math.min(...history); const max = Math.max(...history); const range = Math.max(.0001, max - min)
    return history.map((value, index) => `${index === 0 ? 'M' : 'L'} ${(index / (history.length - 1) * 100).toFixed(2)} ${(88 - (value - min) / range * 68).toFixed(2)}`).join(' ')
  }, [history])

  const chooseAsset = (id: FundAssetId) => {
    setSelectedId(id)
    setTradeQuantityInput(defaultQuantity(id))
    setDealerCustomQty({})
    setTargetWeightInput((weightOf(snapshot, id) * 100).toFixed(1))
  }
  const submitDirect = () => props.onExecuteTarget(intent)
  const submitAuction = () => props.onExecuteAuction(intent)
  const requestQuotes = (count: number) => props.onRequestDealerQuotes(intent, count)
  const startWorked = (style: FundWorkingStyle) => props.onStartWorkingOrder(intent, style, workDuration)

  return <main className="fund-terminal-shell">
    <header className="fund-live-header">
      <div className="fund-brand"><span className="brand-mark fund-brand-mark">HF</span><div><p className="eyebrow">{snapshot.options.mandate === 'long-short' ? 'LONG / SHORT EQUITY FUND' : 'LONG-ONLY EQUITY PM'}{assessment ? ' · ASSESSMENT' : ''}</p><strong>DealerSim Buy-Side · Equity</strong></div></div>
      <div><span>Time remaining</span><strong className="amber">{formatTime(snapshot.options.durationSeconds - snapshot.elapsedSeconds)}</strong></div>
      <div><span>Market phase</span><strong className={snapshot.marketPhase === 'event-window' ? 'amber' : ''}>{phaseText(snapshot.marketPhase)}</strong></div>
      <div><span>NAV</span><strong>{formatMoney(snapshot.nav)}</strong></div>
      <div><span>Return</span><strong className={sessionReturn >= 0 ? 'positive' : 'negative'}>{signed(sessionReturn)}</strong></div>
      <div><span>{snapshot.options.mandate === 'long-only' ? 'Alpha vs benchmark' : 'Beta-adjusted alpha'}</span><strong className={alphaReturn >= 0 ? 'positive' : 'negative'}>{signed(alphaReturn)}</strong></div>
      <div><span>Gross / Net</span><strong>{formatPercent(snapshot.risk.grossExposure)} / {signed(snapshot.risk.netExposure, 0)}</strong></div>
      <div><span>Beta</span><strong>{snapshot.risk.betaExposure >= 0 ? '+' : ''}{snapshot.risk.betaExposure.toFixed(2)}</strong></div>
      <div className="fund-header-actions">{!assessment && (snapshot.status === 'paused' ? <button onClick={props.onResume}>Resume</button> : <button onClick={props.onPause}>Pause</button>)}<button className="danger" onClick={props.onFinish}>Finish</button></div>
    </header>

    <section className="fund-context-strip decision-context-strip">
      <div><b>MARKET NOW</b><span><strong>{phaseText(snapshot.marketPhase)}</strong></span><span>Execution {snapshot.liquidityCostMultiplier.toFixed(2)}x</span><span>Vol {snapshot.volatilityMultiplier.toFixed(2)}x</span></div>
      <div><b>NEXT CATALYSTS</b>{upcoming.slice(0, 3).map((event) => <span key={event.id}><strong>{clock(event.releaseAtSeconds - snapshot.elapsedSeconds)}</strong> {event.assetId ? FUND_ASSET_MAP[event.assetId].symbol : 'MACRO'} {event.title}</span>)}</div>
      <div><b>BOOK RISK</b><span>Gross <strong>{formatPercent(snapshot.risk.grossExposure, 0)}</strong></span><span>Net <strong>{signed(snapshot.risk.netExposure, 0)}</strong></span><span>Beta <strong>{snapshot.risk.betaExposure >= 0 ? '+' : ''}{snapshot.risk.betaExposure.toFixed(2)}</strong></span><span>Largest <strong>{formatPercent(snapshot.risk.concentration, 0)}</strong></span></div>
    </section>

    <div className="fund-terminal-grid">
      <section className="fund-panel fund-trade-column">
        <div className="fund-panel-title"><div><p className="eyebrow">MARKET WATCH</p><h2>Single-name &amp; hedge universe</h2></div><span>Executable market</span></div>
        <div className="fund-watch-head"><span>Asset</span><span>Bid</span><span>Offer</span><span>Move</span><span>Weight</span><span>P&amp;L</span></div>
        <div className="fund-watch-list">{FUND_ASSETS.map((item) => {
          const move = snapshot.previousPrices[item.id] ? snapshot.prices[item.id] / snapshot.previousPrices[item.id] - 1 : 0
          const weight = weightOf(snapshot, item.id); const pnl = snapshot.attribution.byAsset[item.id]
          const quote = topOfBookQuote(item, snapshot.prices[item.id], snapshot.liquidityCostMultiplier, snapshot.volatilityMultiplier)
          return <button key={item.id} className={selectedId === item.id ? 'selected' : ''} onClick={() => chooseAsset(item.id)}><span><b>{item.symbol}</b><small>{item.sector}{item.hardToBorrow ? ' · HTB' : ''}</small></span><strong>{priceText(item.id, quote.bid)}</strong><strong>{priceText(item.id, quote.offer)}</strong><span className={move >= 0 ? 'positive' : 'negative'}>{signed(move, 2)}</span><span className={weight >= 0 ? 'positive' : 'negative'}>{signed(weight)}</span><span className={pnl >= 0 ? 'positive' : 'negative'}>{formatMoney(pnl)}</span></button>
        })}</div>

        <div className="fund-ticket">
          <div className="panel-heading-inline"><span>TRADE · {asset.symbol}</span><small>{asset.displayName}</small></div>
          <div className="buy-side-market-quote">
            <div className="bid"><span>BID · SELL</span><strong>{priceText(selectedId, marketQuote.bid)}</strong></div>
            <div className="mid"><span>MID</span><strong>{priceText(selectedId, mid)}</strong><small>{(marketQuote.halfSpreadBps * 2).toFixed(2)}bp spread</small></div>
            <div className="offer"><span>OFFER · BUY</span><strong>{priceText(selectedId, marketQuote.offer)}</strong></div>
          </div>
          <div className="fund-ticket-metrics"><div><span>Current</span><strong>{signed(currentWeight)}</strong></div><div><span>Trade qty</span><strong>{formatNativeQuantity(asset, sizingMode === 'quantity' ? enteredQuantity : targetQuantity)} {asset.unitPlural}</strong></div><div><span>Notional</span><strong>{formatMoney(targetNotional)}</strong></div><div><span>Est. commission</span><strong>{formatMoney(estimatedCommission)}</strong></div></div>
          <div className="sizing-mode-toggle"><button className={sizingMode === 'quantity' ? 'active' : ''} onClick={() => setSizingMode('quantity')}>Quantity</button><button className={sizingMode === 'weight' ? 'active' : ''} onClick={() => setSizingMode('weight')}>Target weight</button></div>
          {sizingMode === 'quantity' ? <>
            <div className="fund-direction-row"><button className={tradeDirection === 'buy' ? 'buy active' : 'buy'} onClick={() => setTradeDirection('buy')}>BUY / COVER</button><button className={tradeDirection === 'sell' ? 'sell active' : 'sell'} onClick={() => setTradeDirection('sell')}>{snapshot.options.mandate === 'long-only' ? 'SELL / REDUCE' : 'SELL / SHORT'}</button></div>
            <label className="fund-notional-input buy-side-quantity-input"><span>Quantity ({asset.unitPlural})</span><div><input type="number" min="0" step={asset.quantityStep} value={tradeQuantityInput} onChange={(event) => setTradeQuantityInput(event.target.value)} /><em>{asset.unitPlural}</em></div></label>
            <div className="fund-quick-buttons">{quickQuantities(selectedId).map((value) => <button key={value} onClick={() => setTradeQuantityInput(String(value))}>{value.toLocaleString('en-GB')}</button>)}</div>
            <p className="fund-target-preview">Notional <strong>{formatMoney(quantityNotional)}</strong> · resulting target <strong>{signed(targetWeight)}</strong></p>
          </> : <>
            <label className="fund-weight-input"><span>Target NAV weight</span><div><input type="number" step="0.5" value={targetWeightInput} onChange={(event) => setTargetWeightInput(event.target.value)} /><em>%</em></div></label>
            <div className="fund-quick-buttons">{(snapshot.options.mandate === 'long-short' ? [-15, -10, -5, 0, 5, 10, 15] : [0, 2.5, 5, 10, 15, 20]).map((value) => <button key={value} onClick={() => setTargetWeightInput(String(value))}>{value === 0 ? 'Flat' : `${value > 0 ? '+' : ''}${value}%`}</button>)}</div>
            <p className="fund-target-preview">Required execution ≈ <strong>{executionSide.toUpperCase()} {formatNativeQuantity(asset, targetQuantity)} {asset.unitPlural}</strong> · {formatMoney(targetNotional)}</p>
          </>}

          {requiresLocate && <div className={`fund-locate-box ${locate?.status ?? 'none'}`}><div><span>SHORT LOCATE</span><strong>{locate ? `${locate.status.toUpperCase()} · ${(locate.approvedShortWeight * 100).toFixed(1)}% NAV` : 'REQUIRED'}</strong><small>{asset.hardToBorrow ? 'Hard-to-borrow security. Capacity and rate can change.' : 'Borrow required before establishing the short.'}</small></div><button type="button" onClick={() => props.onRequestLocate(selectedId, targetWeight)}>Request locate</button></div>}

          <label className="fund-thesis-switch"><input type="checkbox" checked={recordThesis} onChange={(event) => setRecordThesis(event.target.checked)} /><span>Record thesis with this trade</span></label>
          {recordThesis && <div className="fund-thesis-fields"><select value={tag} onChange={(event) => setTag(event.target.value as FundThesisTag)}>{thesisTags.map((item) => <option key={item}>{item}</option>)}</select><select value={horizon} onChange={(event) => setHorizon(event.target.value as FundHorizon)}>{horizons.map((item) => <option key={item}>{item}</option>)}</select><select value={conviction} onChange={(event) => setConviction(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item} / 5</option>)}</select><input value={invalidation} onChange={(event) => setInvalidation(event.target.value)} placeholder="What invalidates the view?" /></div>}

          {props.feedback && <div className="fund-feedback">{props.feedback}</div>}
          <div className="fund-execution-routes"><button disabled={!canTrade || !locateSufficient} className="primary" onClick={submitDirect}>{executionSide === 'buy' ? 'BUY' : 'SELL'} direct market</button>{(snapshot.marketPhase === 'opening-auction' || snapshot.marketPhase === 'closing-auction') && selectedId !== 'es-fund' && <button disabled={!canTrade || !locateSufficient} className="auction-route" onClick={submitAuction}>{snapshot.marketPhase === 'opening-auction' ? 'Opening auction' : 'MOC / closing auction'}</button>}<button disabled={!canTrade || !locateSufficient} onClick={() => requestQuotes(3)}>RFQ 3 dealers</button><button disabled={!canTrade || !locateSufficient} onClick={() => requestQuotes(5)}>RFQ 5 dealers</button><button disabled={!canTrade || !locateSufficient} onClick={() => startWorked('liquidity-sensitive')}>Work order</button></div>
          <div className="fund-work-row"><span>Work duration</span><select value={workDuration} onChange={(event) => setWorkDuration(Number(event.target.value))}><option value={30}>30 sec</option><option value={45}>45 sec</option><option value={60}>60 sec</option><option value={90}>90 sec</option></select><button disabled={!canTrade || !locateSufficient} onClick={() => startWorked('twap')}>TWAP</button>{snapshot.options.mandate === 'long-short' && !assessment && <button className="beta-hedge" onClick={props.onHedgeBeta}>Hedge portfolio beta with ES</button>}</div>
          {assessment && snapshot.options.mandate === 'long-short' && <p className="assessment-note">Assessment: no one-click beta hedge. Use the ES ticket manually if you want to neutralise market beta.</p>}
        </div>
      </section>

      <section className="fund-panel fund-portfolio-column live-decision-portfolio">
        <div className="fund-panel-title"><div><p className="eyebrow">PORTFOLIO</p><h2>{asset.symbol} price &amp; live book</h2></div><span>{asset.sector}</span></div>
        <div className="fund-price-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="88" x2="100" y2="88" /><path d={chartPath} /></svg><div><span>Start</span><strong>{priceText(selectedId, snapshot.prices[selectedId])}</strong><span>Now</span></div></div>
        <div className="fund-risk-cards compact-live-risk"><div><span>Risk util.</span><strong>{formatPercent(snapshot.risk.riskUtilisation)}</strong></div><div><span>Concentration</span><strong>{formatPercent(snapshot.risk.concentration)}</strong></div><div><span>Gross / net</span><strong>{formatPercent(snapshot.risk.grossExposure, 0)} / {signed(snapshot.risk.netExposure, 0)}</strong></div><div><span>Commissions</span><strong>{formatMoney(snapshot.commissions)}</strong></div><div><span>Trading costs</span><strong>{formatMoney(snapshot.transactionCosts)}</strong></div></div>
        <div className="fund-position-table live-position-table"><div className="fund-position-head buy-side-position-head"><span>Position</span><span>Qty</span><span>Weight</span><span>Notional</span><span>Beta</span></div>{FUND_ASSETS.filter((item) => Math.abs(weightOf(snapshot, item.id)) > .001).map((item) => { const weight = weightOf(snapshot, item.id); const qty = Math.abs(snapshot.positions[item.id].units / item.contractMultiplier); return <div className="fund-position-row buy-side-position-row" key={item.id}><span><b>{item.symbol}</b><small>{item.sector}</small></span><span>{snapshot.positions[item.id].units < 0 ? '−' : ''}{formatNativeQuantity(item, qty)}</span><strong className={weight >= 0 ? 'positive' : 'negative'}>{signed(weight)}</strong><span>{formatMoney(weight * snapshot.nav)}</span><span>{(weight * item.beta) >= 0 ? '+' : ''}{(weight * item.beta).toFixed(2)}</span></div>})}{snapshot.risk.grossExposure < .001 && <div className="fund-empty-position">Portfolio is currently all cash.</div>}</div>
        <div className="live-risk-message-strip">{snapshot.riskManagerMessages.slice(0, 2).map((message) => <article key={message.id} className={message.severity}><strong>{message.title}</strong><span>{message.detail}</span></article>)}</div>
      </section>

      <section className="fund-panel fund-info-column live-news-column">
        <div className="fund-info-news prominent-live-news"><div className="fund-panel-title"><div><p className="eyebrow">LIVE INFORMATION</p><h2>News &amp; catalysts</h2></div><span>Newest first</span></div><div className="fund-news-list">{snapshot.headlines.slice(0, 14).map((item) => <article key={item.id} className={item.severity}><div><span>{clock(item.timestamp)}</span><strong>{item.assetId ? FUND_ASSET_MAP[item.assetId].symbol : 'MACRO'} · {item.title}</strong></div><p>{item.detail}</p></article>)}</div></div>

        {snapshot.activeDealerRfq && (() => {
          const rfq = snapshot.activeDealerRfq
          const rfqAsset = FUND_ASSET_MAP[rfq.assetId]
          const requestedQty = nativeQuantityFromNotional(rfqAsset, rfq.arrivalPrice, rfq.requestedNotional)
          return <div className="fund-dealer-rfq"><div className="panel-heading-inline"><span>LIVE DEALER RFQ · {rfqAsset.symbol}</span><button onClick={props.onCancelDealerRfq}>Cancel</button></div><p>{rfq.side.toUpperCase()} {formatNativeQuantity(rfqAsset, requestedQty)} {rfqAsset.unitPlural} · {formatMoney(rfq.requestedNotional)} · direct {rfq.directBenchmarkPrice.toFixed(rfqAsset.priceDecimals)}</p>{rfq.quotes.map((quote) => {
            const executable = rfq.side === 'buy' ? quote.offer : quote.bid
            const maxFraction = Math.min(1, quote.maxNotional / rfq.requestedNotional)
            const capacityQty = nativeQuantityFromNotional(rfqAsset, rfq.arrivalPrice, Math.min(quote.maxNotional, rfq.requestedNotional))
            const customQty = Number(dealerCustomQty[quote.id] ?? '')
            const customFraction = customQty > 0 ? Math.min(maxFraction, customQty / Math.max(0.000001, requestedQty)) : 0
            const fill = (fraction: number) => {
              const actual = Math.min(fraction, maxFraction)
              const result = props.onAcceptDealerQuote(quote.id, actual)
              if (result?.accepted && sizingMode === 'quantity') {
                const remainingQty = requestedQty * Math.max(0, 1 - actual)
                setTradeDirection(rfq.side)
                setTradeQuantityInput(remainingQty >= rfqAsset.quantityStep ? String(roundNativeQuantity(rfqAsset, remainingQty)) : '')
              }
            }
            const relationship = snapshot.dealerRelationships[quote.dealerId]
            return <article key={quote.id} className="fund-dealer-quote"><div><b>{quote.dealerName}</b><span>{quote.colour}</span></div><strong>{quote.bid.toFixed(rfqAsset.priceDecimals)} / {quote.offer.toFixed(rfqAsset.priceDecimals)}</strong><small>Firm {formatNativeQuantity(rfqAsset, capacityQty)} {rfqAsset.unitPlural} · executable {executable.toFixed(rfqAsset.priceDecimals)} · relationship {relationship.relationshipScore.toFixed(0)}/100</small><div className="fund-dealer-fill-row"><button onClick={() => fill(.25)}>25%</button><button onClick={() => fill(.5)}>50%</button><button onClick={() => fill(.75)}>75%</button><button className="primary" onClick={() => fill(maxFraction)}>Fill max</button></div><div className="fund-custom-fill"><input type="number" min="0" step={rfqAsset.quantityStep} placeholder={formatNativeQuantity(rfqAsset, capacityQty)} value={dealerCustomQty[quote.id] ?? ''} onChange={(event) => setDealerCustomQty((current) => ({ ...current, [quote.id]: event.target.value }))} /><span>{rfqAsset.unitPlural}</span><button disabled={!customFraction} onClick={() => fill(customFraction)}>Custom</button></div></article>
          })}</div>
        })()}

        <div className="sales-colour-panel"><div className="panel-heading-inline"><span>SALES / DEALER COLOUR</span><small>Information, not truth</small></div>{snapshot.salesColour.length === 0 ? <p className="muted-line">No fresh sales-trader colour.</p> : snapshot.salesColour.slice(0, 4).map((colour) => <article key={colour.id}><div><strong>{colour.dealerName} · {FUND_ASSET_MAP[colour.assetId].symbol}</strong><span>{colour.bias}</span></div><p>{colour.message}</p></article>)}</div>

        <div className="fund-working-panel"><div className="panel-heading-inline"><span>Working orders</span><small>{activeWorking.length} active</small></div>{activeWorking.length === 0 ? <p className="muted-line">No live worked execution.</p> : activeWorking.map((order) => <article key={order.id} className="fund-working-order"><div><b>{FUND_ASSET_MAP[order.assetId].symbol} · {order.side.toUpperCase()}</b><span>{order.style}</span></div><div className="fund-work-progress"><i style={{ width: `${Math.min(100, order.executedNotional / Math.max(1, order.totalNotional) * 100)}%` }} /></div><p>{formatMoney(order.executedNotional)} done · {formatMoney(order.remainingNotional)} left</p><footer>{order.status === 'paused' ? <button onClick={() => props.onResumeWorkingOrder(order.id)}>Resume</button> : <button onClick={() => props.onPauseWorkingOrder(order.id)}>Pause</button>}<button onClick={() => props.onCrossWorkingOrder(order.id)}>Cross rest</button><button onClick={() => props.onCancelWorkingOrder(order.id)}>Cancel</button></footer></article>)}</div>
      </section>
    </div>

    <footer className="fund-status-strip"><span>{snapshot.options.mandate === 'long-short' ? 'Long/Short Equity HF' : 'Long-Only Equity PM'}</span><span>{assessment ? 'ASSESSMENT MODE' : `Scenario ${FUND_SCENARIOS[snapshot.resolvedScenario].label}`}</span><span>{phaseText(snapshot.marketPhase)}</span><span>Gross limit {snapshot.options.mandate === 'long-short' ? '200%' : '100%'}</span><span>Dealer fills {snapshot.dealerTrades}</span><span>Dealer vs direct {snapshot.dealerSavings >= 0 ? '+' : ''}{formatMoney(snapshot.dealerSavings)}</span><span>Commissions {formatMoney(snapshot.commissions)}</span><span>Trading costs {formatMoney(snapshot.transactionCosts)}</span><span>Borrow {formatMoney(snapshot.borrowCosts)}</span></footer>
  </main>
}
