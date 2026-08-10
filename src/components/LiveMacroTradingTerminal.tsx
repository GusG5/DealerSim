import { useMemo, useState } from 'react'
import { MACRO_ASSETS, MACRO_ASSET_MAP } from '../engine/macro'
import { commissionForNotional, formatNativeQuantity, nativeQuantityFromNotional, notionalFromNativeQuantity, roundNativeQuantity, topOfBookQuote } from '../engine/buy-side-market'
import type { LiveMacroSessionSnapshot, LiveMacroTradeIntent, LiveMacroWorkingStyle } from '../engine/live-macro-types'
import type { MacroAssetId, ThesisHorizon, ThesisTag } from '../engine/macro-types'
import { formatMoney, formatPercent } from '../lib/format'

interface Props {
  snapshot: LiveMacroSessionSnapshot
  feedback: string
  onExecuteTarget: (intent: LiveMacroTradeIntent) => { accepted: boolean; reason: string } | undefined
  onRequestDealerQuotes: (intent: LiveMacroTradeIntent, dealerCount: number) => { accepted: boolean; reason: string } | undefined
  onAcceptDealerQuote: (quoteId: string, fillFraction?: number) => { accepted: boolean; reason: string } | undefined
  onCancelDealerRfq: () => { accepted: boolean; reason: string } | undefined
  onStartWorkingOrder: (intent: LiveMacroTradeIntent, style: LiveMacroWorkingStyle, durationSeconds: number) => { accepted: boolean; reason: string } | undefined
  onPauseWorkingOrder: (orderId: string) => void
  onResumeWorkingOrder: (orderId: string) => void
  onCancelWorkingOrder: (orderId: string) => void
  onCrossWorkingOrder: (orderId: string) => { accepted: boolean; reason: string } | undefined
  onPause: () => void
  onResume: () => void
  onFinish: () => void
}

const thesisTags: ThesisTag[] = ['growth', 'inflation', 'policy', 'valuation', 'momentum', 'catalyst', 'relative-value', 'positioning', 'risk-hedge']
function weightOf(snapshot: LiveMacroSessionSnapshot, assetId: MacroAssetId): number {
  return snapshot.nav === 0 ? 0 : snapshot.positions[assetId].units * snapshot.prices[assetId] / snapshot.nav
}
function signedPercent(value: number, digits = 1): string { return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%` }
function priceText(assetId: MacroAssetId, value: number): string { return value.toFixed(MACRO_ASSET_MAP[assetId].priceDecimals) }
function clock(seconds: number): string { const safe = Math.max(0, Math.ceil(seconds)); const mins = Math.floor(safe / 60); return `${mins}:${String(safe % 60).padStart(2, '0')}` }
function phaseText(phase: LiveMacroSessionSnapshot['marketPhase']): string {
  if (phase === 'opening') return 'OPENING'
  if (phase === 'morning') return 'MORNING LIQUIDITY'
  if (phase === 'midday') return 'MIDDAY / THIN'
  if (phase === 'event-window') return 'EVENT WINDOW'
  return 'CLOSING FLOW'
}

export function LiveMacroTradingTerminal(props: Props) {
  const { snapshot, feedback } = props
  const assessment = snapshot.options.difficulty === 'assessment'
  const [selectedAssetId, setSelectedAssetId] = useState<MacroAssetId>('es-macro')
  const [sizingMode, setSizingMode] = useState<'quantity' | 'target'>('quantity')
  const [targetPct, setTargetPct] = useState(0)
  const [tradeQuantityInput, setTradeQuantityInput] = useState('25')
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy')
  const [dealerCustomQty, setDealerCustomQty] = useState<Record<string, string>>({})
  const [recordThesis, setRecordThesis] = useState(false)
  const [tag, setTag] = useState<ThesisTag>('growth')
  const [horizon, setHorizon] = useState<ThesisHorizon>('days')
  const [conviction, setConviction] = useState(3)
  const [invalidation, setInvalidation] = useState('')
  const [workDuration, setWorkDuration] = useState(45)

  const selected = MACRO_ASSET_MAP[selectedAssetId]
  const mid = snapshot.prices[selectedAssetId]
  const marketQuote = topOfBookQuote(selected, mid, snapshot.liquidityCostMultiplier, snapshot.volatilityMultiplier)
  const currentWeight = weightOf(snapshot, selectedAssetId)
  const remaining = snapshot.options.durationSeconds - snapshot.elapsedSeconds
  const navReturn = snapshot.nav / snapshot.options.initialNav - 1
  const enteredQuantity = roundNativeQuantity(selected, Math.max(0, Number(tradeQuantityInput) || 0))
  const enteredNotional = notionalFromNativeQuantity(selected, mid, enteredQuantity)
  const signedEnteredNotional = enteredNotional * (tradeDirection === 'buy' ? 1 : -1)
  const quantityTargetPct = (currentWeight + signedEnteredNotional / Math.max(1, snapshot.nav)) * 100
  const effectiveTargetPct = sizingMode === 'quantity' ? quantityTargetPct : targetPct
  const deltaWeight = effectiveTargetPct / 100 - currentWeight
  const targetLimitPct = selected.maxAbsWeight * 100
  const targetWithinLimit = Math.abs(effectiveTargetPct) <= targetLimitPct + 1e-9
  const targetNotional = snapshot.nav * Math.abs(deltaWeight)
  const targetQuantity = nativeQuantityFromNotional(selected, mid, targetNotional)
  const executionSide: 'buy' | 'sell' = deltaWeight >= 0 ? 'buy' : 'sell'
  const estimatedCommission = targetNotional > 0 ? commissionForNotional(selected, executionSide === 'buy' ? marketQuote.offer : marketQuote.bid, targetNotional, 'direct-market') : 0
  const estimatedMarketCost = targetNotional * selected.transactionCostBps * snapshot.liquidityCostMultiplier / 10_000
  const estimatedCost = estimatedMarketCost + estimatedCommission
  const canTrade = Math.abs(deltaWeight) >= 0.001 && targetWithinLimit
  const upcoming = snapshot.calendar.filter((event) => !event.revealed && event.releaseAtSeconds > snapshot.elapsedSeconds).slice(0, 4)
  const activeWorking = snapshot.workingOrders.filter((order) => order.status === 'working' || order.status === 'paused')
  const tyNotional = weightOf(snapshot, 'ty-macro') * snapshot.nav
  const bundNotional = weightOf(snapshot, 'fgbl-macro') * snapshot.nav
  const durationDv01Proxy = tyNotional * 0.00082 + bundNotional * 0.00076
  const equityBetaProxy = weightOf(snapshot, 'es-macro')
  const usdRiskProxy = snapshot.risk.factorExposure.usd

  const chartPath = useMemo(() => {
    const series = snapshot.history.map((point) => ({ t: point.elapsedSeconds, price: point.prices[selectedAssetId] }))
    if (series.length < 2) return ''
    const min = Math.min(...series.map((point) => point.price)); const max = Math.max(...series.map((point) => point.price)); const span = Math.max(max - min, selected.initialPrice * 0.0015)
    return series.map((point, index) => { const x = index / (series.length - 1) * 100; const y = 88 - (point.price - min) / span * 76; return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}` }).join(' ')
  }, [selected.initialPrice, selectedAssetId, snapshot.history])

  const buildIntent = (): LiveMacroTradeIntent => ({ assetId: selectedAssetId, targetWeight: effectiveTargetPct / 100, recordThesis, tag, horizon, conviction, invalidation })
  const resetEnteredQuantity = () => { if (sizingMode === 'quantity') setTradeQuantityInput('') }
  const executeDirect = () => { const result = props.onExecuteTarget(buildIntent()); if (result?.accepted) resetEnteredQuantity() }
  const startWorked = (style: LiveMacroWorkingStyle) => { const result = props.onStartWorkingOrder(buildIntent(), style, workDuration); if (result?.accepted) resetEnteredQuantity() }
  const chooseAsset = (assetId: MacroAssetId) => { setSelectedAssetId(assetId); setTargetPct(Number((weightOf(snapshot, assetId) * 100).toFixed(1))); setTradeQuantityInput('25'); setDealerCustomQty({}) }
  const switchSizingMode = (mode: 'quantity' | 'target') => {
    if (mode === sizingMode) return
    if (mode === 'target') setTargetPct(Number(effectiveTargetPct.toFixed(1)))
    else {
      const asset = MACRO_ASSET_MAP[selectedAssetId]
      const qty = nativeQuantityFromNotional(asset, snapshot.prices[selectedAssetId], Math.abs(deltaWeight) * snapshot.nav)
      setTradeDirection(deltaWeight < 0 ? 'sell' : 'buy')
      setTradeQuantityInput(qty >= asset.quantityStep ? String(roundNativeQuantity(asset, qty)) : '')
    }
    setSizingMode(mode)
  }

  return <main className="live-macro-shell">
    <header className="live-macro-header">
      <div className="macro-terminal-brand"><span className="brand-mark macro-brand-mark compact">GM</span><div><p className="eyebrow">GLOBAL MACRO TRADER{assessment ? ' · ASSESSMENT' : ''}</p><strong>DealerSim Buy-Side · Live</strong></div></div>
      <div className="macro-header-stat"><span>Time remaining</span><strong className="live-clock">{clock(remaining)}</strong></div>
      <div className="macro-header-stat"><span>Market phase</span><strong className={snapshot.marketPhase === 'event-window' ? 'amber' : ''}>{phaseText(snapshot.marketPhase)}</strong></div><div className="macro-header-stat"><span>NAV</span><strong>{formatMoney(snapshot.nav)}</strong></div>
      <div className={`macro-header-stat ${navReturn >= 0 ? 'positive' : 'negative'}`}><span>Return</span><strong>{signedPercent(navReturn)}</strong></div>
      <div className="macro-header-stat"><span>Max DD</span><strong>{formatPercent(snapshot.maxDrawdown, 1)}</strong></div>
      <div className="macro-header-stat"><span>Gross / Net</span><strong>{formatPercent(snapshot.risk.grossExposure)} / {signedPercent(snapshot.risk.netExposure, 0)}</strong></div>
      <div className="macro-header-stat"><span>Cash</span><strong>{formatPercent(snapshot.risk.cashWeight)}</strong></div>
      <div className="macro-terminal-actions">{!assessment && <button className="button button-small button-ghost" type="button" onClick={snapshot.status === 'paused' ? props.onResume : props.onPause}>{snapshot.status === 'paused' ? 'Resume' : 'Pause'}</button>}<button className="button button-small button-danger" type="button" onClick={props.onFinish}>Finish</button></div>
    </header>

    <section className="live-macro-context decision-context-strip">
      <article className="macro-context-panel"><div className="panel-heading-inline"><span>Next events</span><small>Consensus known · clocks live</small></div><div className="live-calendar-row">{upcoming.length === 0 ? <span className="muted-line">No scheduled releases remaining.</span> : upcoming.slice(0, 3).map((event) => <div key={event.id}><b>{clock(event.releaseAtSeconds - snapshot.elapsedSeconds)}</b><span>{event.title}</span><strong>{event.consensus}{event.unit ? ` ${event.unit}` : ''}</strong></div>)}</div></article>
      <article className="macro-context-panel"><div className="panel-heading-inline"><span>Book risk</span><small>Compact live measures</small></div><div className="factor-chip-row"><span>DV01 <b>{formatMoney(durationDv01Proxy)}/bp</b></span><span>ES beta <b>{equityBetaProxy >= 0 ? '+' : ''}{equityBetaProxy.toFixed(2)}</b></span><span>USD <b>{usdRiskProxy >= 0 ? '+' : ''}{usdRiskProxy.toFixed(2)}</b></span><span>Risk util. <b>{formatPercent(snapshot.risk.riskUtilisation)}</b></span></div></article>
      <article className="macro-context-panel desk-phase-panel"><div className="panel-heading-inline"><span>Market now</span><small>Time-of-day conditions</small></div><strong>{phaseText(snapshot.marketPhase)}</strong><div className="desk-phase-metrics"><span>Execution <b>{snapshot.liquidityCostMultiplier.toFixed(2)}x</b></span><span>Volatility <b>{snapshot.volatilityMultiplier.toFixed(2)}x</b></span></div></article>
    </section>

    <div className="live-macro-grid">
      <section className="macro-panel live-watch-column">
        <div className="macro-panel-title"><div><p className="eyebrow">MARKET WATCH</p><h2>Cross-asset live markets</h2></div><span>Executable bid / offer</span></div>
        <div className="macro-watch-table live-watch-table">
          <div className="macro-watch-head"><span>Asset</span><span>Bid</span><span>Offer</span><span>Move</span><span>Weight</span><span>P&amp;L</span></div>
          {MACRO_ASSETS.map((asset) => {
            const previous = snapshot.previousPrices[asset.id]; const move = previous ? snapshot.prices[asset.id] / previous - 1 : 0; const weight = weightOf(snapshot, asset.id)
            const quote = topOfBookQuote(asset, snapshot.prices[asset.id], snapshot.liquidityCostMultiplier, snapshot.volatilityMultiplier)
            return <button type="button" key={asset.id} className={`macro-watch-row${selectedAssetId === asset.id ? ' selected' : ''}`} onClick={() => chooseAsset(asset.id)}><span><b>{asset.symbol}</b><small>{asset.displayName}</small></span><strong>{priceText(asset.id, quote.bid)}</strong><strong>{priceText(asset.id, quote.offer)}</strong><em className={move >= 0 ? 'positive' : 'negative'}>{signedPercent(move, 2)}</em><em className={weight >= 0 ? 'positive' : 'negative'}>{signedPercent(weight)}</em><em className={snapshot.attribution.byAsset[asset.id] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byAsset[asset.id])}</em></button>
          })}
        </div>

        <div className="macro-trade-ticket live-trade-ticket">
          <div className="panel-heading-inline"><span>Trade · {selected.symbol}</span><small>Quantity first · target weight optional</small></div>
          <div className="buy-side-market-quote">
            <div className="bid"><span>BID · SELL</span><strong>{priceText(selectedAssetId, marketQuote.bid)}</strong></div>
            <div className="mid"><span>MID</span><strong>{priceText(selectedAssetId, mid)}</strong><small>{(marketQuote.halfSpreadBps * 2).toFixed(2)}bp spread</small></div>
            <div className="offer"><span>OFFER · BUY</span><strong>{priceText(selectedAssetId, marketQuote.offer)}</strong></div>
          </div>
          <div className="macro-target-readout"><div><span>Current</span><strong>{signedPercent(currentWeight)}</strong></div><div><span>Trade qty</span><strong>{formatNativeQuantity(selected, sizingMode === 'quantity' ? enteredQuantity : targetQuantity)} {selected.unitPlural}</strong></div><div><span>Notional</span><strong>{formatMoney(targetNotional)}</strong></div><div><span>Est. costs</span><strong>{formatMoney(estimatedCost)}</strong><small>{formatMoney(estimatedCommission)} commission</small></div></div>

          <div className="live-sizing-tabs" role="group" aria-label="Trade sizing method"><button type="button" className={sizingMode === 'quantity' ? 'selected' : ''} onClick={() => switchSizingMode('quantity')}>Quantity</button><button type="button" className={sizingMode === 'target' ? 'selected' : ''} onClick={() => switchSizingMode('target')}>Target weight</button></div>
          {sizingMode === 'quantity' ? <div className="live-notional-sizing">
            <div className="live-direction-toggle" role="group" aria-label="Trade direction"><button type="button" className={tradeDirection === 'buy' ? 'buy selected' : 'buy'} onClick={() => setTradeDirection('buy')}>BUY</button><button type="button" className={tradeDirection === 'sell' ? 'sell selected' : 'sell'} onClick={() => setTradeDirection('sell')}>SELL</button></div>
            <label className="live-notional-input buy-side-quantity-input"><span>Quantity ({selected.unitPlural})</span><div><input type="number" min="0" step={selected.quantityStep} inputMode="decimal" value={tradeQuantityInput} onChange={(event) => setTradeQuantityInput(event.target.value)} placeholder="25" /><em>{selected.unitPlural}</em></div></label>
            <div className="live-quick-notional">{[10, 25, 50, 100].map((value) => <button type="button" key={value} onClick={() => setTradeQuantityInput(String(value))}>{value}</button>)}</div>
          </div> : <div className="live-target-sizing">
            <label className="live-target-input"><span>Target weight</span><div><input type="number" min={-targetLimitPct} max={targetLimitPct} step="0.1" value={targetPct} onChange={(event) => setTargetPct(Number(event.target.value))} /><em>% NAV</em></div></label>
            <input className="macro-weight-slider" type="range" min={-targetLimitPct} max={targetLimitPct} step="0.5" value={targetPct} onChange={(event) => setTargetPct(Number(event.target.value))} />
            <div className="macro-quick-weights"><button type="button" onClick={() => setTargetPct(-10)}>−10%</button><button type="button" onClick={() => setTargetPct(-5)}>−5%</button><button type="button" onClick={() => setTargetPct(0)}>Flat</button><button type="button" onClick={() => setTargetPct(5)}>+5%</button><button type="button" onClick={() => setTargetPct(10)}>+10%</button></div>
            <p className="fund-target-preview">Required execution ≈ <strong>{executionSide.toUpperCase()} {formatNativeQuantity(selected, targetQuantity)} {selected.unitPlural}</strong></p>
          </div>}
          {!targetWithinLimit && <p className="live-sizing-warning">Target exceeds the {selected.symbol} position limit of ±{targetLimitPct.toFixed(0)}% NAV.</p>}

          <div className="live-thesis-toggle"><label><input type="checkbox" checked={recordThesis} onChange={(event) => setRecordThesis(event.target.checked)} /> Record thesis with this trade</label><small>Optional in live mode. Use it for positions you want reviewed later.</small></div>
          {recordThesis && <div className="live-thesis-fields"><div className="macro-thesis-grid"><label><span>Thesis</span><select value={tag} onChange={(event) => setTag(event.target.value as ThesisTag)}>{thesisTags.map((item) => <option key={item} value={item}>{item.replaceAll('-', ' ')}</option>)}</select></label><label><span>Horizon</span><select value={horizon} onChange={(event) => setHorizon(event.target.value as ThesisHorizon)}><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option></select></label><label><span>Conviction</span><select value={conviction} onChange={(event) => setConviction(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label></div><label className="macro-invalidation"><span>Invalidation</span><div><input value={invalidation} onChange={(event) => setInvalidation(event.target.value)} placeholder="What makes you reassess?" /></div></label></div>}

          {feedback && <p className="macro-ticket-feedback">{feedback}</p>}
          {!snapshot.activeDealerRfq && <div className="live-execution-routes"><button className="button button-primary" type="button" disabled={!canTrade} onClick={executeDirect}>{executionSide === 'buy' ? 'BUY' : 'SELL'} direct market</button><button className="button button-ghost" type="button" disabled={!canTrade} onClick={() => props.onRequestDealerQuotes(buildIntent(), 3)}>RFQ 3 dealers</button><button className="button button-ghost" type="button" disabled={!canTrade} onClick={() => props.onRequestDealerQuotes(buildIntent(), 5)}>RFQ 5 dealers</button><button className="button button-ghost" type="button" disabled={!canTrade} onClick={() => startWorked('liquidity-sensitive')}>Work order</button></div>}
          <div className="live-work-duration"><span>Work duration</span><select value={workDuration} onChange={(event) => setWorkDuration(Number(event.target.value))}><option value={30}>30 sec</option><option value={45}>45 sec</option><option value={60}>60 sec</option><option value={90}>90 sec</option></select><button type="button" disabled={!canTrade} onClick={() => startWorked('twap')}>TWAP</button></div>

          {snapshot.activeDealerRfq && (() => {
            const rfq = snapshot.activeDealerRfq; const asset = MACRO_ASSET_MAP[rfq.assetId]; const expiry = Math.max(...rfq.quotes.map((quote) => quote.expiresAtSeconds)) - snapshot.elapsedSeconds
            const requestedQty = nativeQuantityFromNotional(asset, snapshot.prices[rfq.assetId], rfq.requestedNotional)
            return <div className="macro-dealer-rfq live-dealer-rfq">
              <div className="macro-dealer-rfq-head"><div><span>LIVE DEALER RFQ · {asset.symbol}</span><strong>{rfq.side.toUpperCase()} {formatNativeQuantity(asset, requestedQty)} {asset.unitPlural} · {clock(expiry)}</strong></div><button type="button" onClick={props.onCancelDealerRfq}>Cancel</button></div>
              <div className="macro-direct-benchmark"><span>Direct benchmark</span><strong>{rfq.directBenchmarkPrice.toFixed(asset.priceDecimals)}</strong><small>est. all-in {formatMoney(rfq.directCost)}</small></div>
              <div className="macro-dealer-quote-list">{rfq.quotes.map((quote) => {
                const executable = rfq.side === 'buy' ? quote.offer : quote.bid; const improvement = rfq.side === 'buy' ? rfq.directBenchmarkPrice - executable : executable - rfq.directBenchmarkPrice
                const maxFraction = Math.min(1, quote.maxNotional / Math.max(1, rfq.requestedNotional)); const directCommission = commissionForNotional(asset, rfq.directBenchmarkPrice, rfq.requestedNotional, 'direct-market'); const saving = improvement * rfq.requestedUnits * maxFraction + directCommission * maxFraction
                const capacityQty = nativeQuantityFromNotional(asset, snapshot.prices[rfq.assetId], Math.min(quote.maxNotional, rfq.requestedNotional))
                const customQty = Number(dealerCustomQty[quote.id] ?? ''); const customFraction = Number.isFinite(customQty) && customQty > 0 ? Math.min(maxFraction, customQty / Math.max(.000001, requestedQty)) : 0
                const handleFill = (requestedFraction: number) => { const actualFraction = Math.min(requestedFraction, maxFraction); const result = props.onAcceptDealerQuote(quote.id, actualFraction); if (result?.accepted && sizingMode === 'quantity') { const remainingQty = requestedQty * Math.max(0, 1 - actualFraction); setTradeDirection(rfq.side); setTradeQuantityInput(remainingQty >= asset.quantityStep ? String(roundNativeQuantity(asset, remainingQty)) : '') } }
                return <article key={quote.id} className="macro-dealer-quote live-dealer-quote-card"><div className="macro-dealer-name"><b>{quote.dealerName}</b><span>{quote.colour}</span></div><div className="macro-dealer-two-way"><span>{quote.bid.toFixed(asset.priceDecimals)}</span><i>/</i><span>{quote.offer.toFixed(asset.priceDecimals)}</span></div><div className="macro-dealer-edge"><strong className={saving >= 0 ? 'positive' : 'negative'}>{saving >= 0 ? '+' : ''}{formatMoney(saving)}</strong><small>vs direct</small></div><div className="macro-dealer-capacity"><span>Firm capacity</span><strong>{formatNativeQuantity(asset, capacityQty)} {asset.unitPlural}</strong></div><div className="macro-dealer-trade-actions live-dealer-fill-actions"><button type="button" onClick={() => handleFill(.25)}>Fill 25%</button><button type="button" onClick={() => handleFill(.5)}>Fill 50%</button><button type="button" onClick={() => handleFill(.75)}>Fill 75%</button><button className="primary-fill" type="button" onClick={() => handleFill(1)}>{maxFraction >= .995 ? 'FILL FULL' : `FILL MAX ${Math.round(maxFraction * 100)}%`}</button></div><div className="macro-dealer-custom-fill"><label><span>Custom fill</span><div><input type="number" min="0" step={asset.quantityStep} inputMode="decimal" value={dealerCustomQty[quote.id] ?? ''} onChange={(event) => setDealerCustomQty((current) => ({ ...current, [quote.id]: event.target.value }))} placeholder={formatNativeQuantity(asset, capacityQty)} /><em>{asset.unitPlural}</em></div></label><button type="button" disabled={!customFraction} onClick={() => handleFill(customFraction)}>Fill custom</button></div></article>
              })}</div>
            </div>
          })()}
        </div>
      </section>

      <section className="macro-panel live-portfolio-column live-decision-portfolio">
        <div className="macro-panel-title"><div><p className="eyebrow">PORTFOLIO</p><h2>{selected.symbol} live path &amp; positions</h2></div><span>{selected.assetClass}</span></div>
        <div className="macro-price-chart live-price-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="88" x2="100" y2="88" /><path d={chartPath} /></svg><div className="macro-chart-labels"><span>Start</span><strong>{priceText(selectedAssetId, snapshot.prices[selectedAssetId])}</strong><span>Now</span></div></div>
        <div className="macro-risk-cards compact-live-risk"><div><span>Risk util.</span><strong>{formatPercent(snapshot.risk.riskUtilisation)}</strong></div><div><span>Gross / net</span><strong>{formatPercent(snapshot.risk.grossExposure, 0)} / {signedPercent(snapshot.risk.netExposure, 0)}</strong></div><div><span>DV01 proxy</span><strong className={durationDv01Proxy >= 0 ? 'positive' : 'negative'}>{formatMoney(durationDv01Proxy)}/bp</strong></div><div><span>Commissions</span><strong>{formatMoney(snapshot.commissions)}</strong></div><div><span>Trading costs</span><strong>{formatMoney(snapshot.transactionCosts)}</strong></div></div>
        <div className="macro-position-table live-position-table"><div className="macro-position-head buy-side-position-head"><span>Position</span><span>Qty</span><span>Weight</span><span>Notional</span><span>Asset P&amp;L</span></div>{MACRO_ASSETS.filter((asset) => Math.abs(weightOf(snapshot, asset.id)) > .001).map((asset) => { const weight = weightOf(snapshot, asset.id); const qty = Math.abs(snapshot.positions[asset.id].units / asset.contractMultiplier); return <div className="macro-position-row buy-side-position-row" key={asset.id}><span><b>{asset.symbol}</b><small>{asset.displayName}</small></span><span>{snapshot.positions[asset.id].units < 0 ? '−' : ''}{formatNativeQuantity(asset, qty)}</span><strong className={weight >= 0 ? 'positive' : 'negative'}>{signedPercent(weight)}</strong><span>{formatMoney(weight * snapshot.nav)}</span><span className={snapshot.attribution.byAsset[asset.id] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byAsset[asset.id])}</span></div>})}{snapshot.risk.grossExposure < .001 && <div className="macro-empty-position">Portfolio is currently all cash.</div>}</div>
        <div className="live-risk-message-strip">{snapshot.riskManagerMessages.slice(0, 2).map((message) => <article key={message.id} className={message.severity}><strong>{message.title}</strong><span>{message.detail}</span></article>)}</div>
      </section>

      <section className="macro-panel live-information-column live-news-column">
        <div className="live-info-top prominent-live-news"><div className="macro-panel-title"><div><p className="eyebrow">LIVE INFORMATION</p><h2>News tape</h2></div><span>Newest first</span></div><div className="macro-news-tape">{snapshot.headlines.slice(0, 16).map((item) => <article key={item.id} className={`macro-headline ${item.severity}`}><div><span>{clock(item.timestamp)}</span><strong>{item.title}</strong></div><p>{item.detail}</p></article>)}</div></div>
        <div className="sales-colour-panel"><div className="panel-heading-inline"><span>SALES / DEALER COLOUR</span><small>Information, not truth</small></div>{snapshot.marketColour.length === 0 ? <p className="muted-line">No fresh market colour.</p> : snapshot.marketColour.slice(0, 4).map((colour) => <article key={colour.id}><div><strong>{colour.source} · {MACRO_ASSET_MAP[colour.assetId].symbol}</strong><span>{clock(Math.max(0, colour.expiresAtSeconds - snapshot.elapsedSeconds))}</span></div><p>{colour.message}</p></article>)}</div>
        <div className="live-working-panel"><div className="panel-heading-inline"><span>Working orders</span><small>{activeWorking.length} active</small></div>{activeWorking.length === 0 ? <p className="muted-line">No live worked execution.</p> : activeWorking.map((order) => <article key={order.id} className="live-working-order"><div><b>{MACRO_ASSET_MAP[order.assetId].symbol} · {order.side.toUpperCase()}</b><span>{order.style.replace('-', ' ')}</span></div><div className="live-work-progress"><i style={{ width: `${Math.min(100, order.totalNotional ? order.executedNotional / order.totalNotional * 100 : 0)}%` }} /></div><p>{formatMoney(order.executedNotional)} done · {formatMoney(order.remainingNotional)} left · avg {order.averageExecutionPrice ? order.averageExecutionPrice.toFixed(MACRO_ASSET_MAP[order.assetId].priceDecimals) : '—'}</p><footer>{order.status === 'paused' ? <button onClick={() => props.onResumeWorkingOrder(order.id)}>Resume</button> : <button onClick={() => props.onPauseWorkingOrder(order.id)}>Pause</button>}<button onClick={() => props.onCrossWorkingOrder(order.id)}>Cross rest</button><button onClick={() => props.onCancelWorkingOrder(order.id)}>Cancel</button></footer></article>)}</div>
      </section>
    </div>

    <footer className="macro-status-strip"><span>Mode: continuous Global Macro Trader</span><span>{assessment ? 'ASSESSMENT MODE' : phaseText(snapshot.marketPhase)}</span><span>Gross limit 150%</span><span>Hard DD 10%</span><span>Dealer fills {snapshot.dealerTrades}</span><span>Dealer vs direct {snapshot.dealerSavings >= 0 ? '+' : ''}{formatMoney(snapshot.dealerSavings)}</span><span>Commissions {formatMoney(snapshot.commissions)}</span><span>Trades {snapshot.trades.length}</span></footer>
  </main>
}
