import { useMemo, useState } from 'react'
import { MACRO_ASSETS, MACRO_ASSET_MAP } from '../engine/macro'
import { commissionForNotional, formatNativeQuantity, nativeQuantityFromNotional, notionalFromNativeQuantity, roundNativeQuantity, topOfBookQuote } from '../engine/buy-side-market'
import type { MacroAssetId, MacroSessionSnapshot, MacroTradeIntent, ThesisHorizon, ThesisTag } from '../engine/macro-types'
import { formatMoney, formatPercent } from '../lib/format'

interface Props {
  snapshot: MacroSessionSnapshot
  feedback: string
  onExecuteTarget: (intent: MacroTradeIntent) => { accepted: boolean; reason: string } | undefined
  onRequestDealerQuotes: (intent: MacroTradeIntent, dealerCount: number) => { accepted: boolean; reason: string } | undefined
  onAcceptDealerQuote: (quoteId: string, fillFraction?: number) => { accepted: boolean; reason: string } | undefined
  onCancelDealerRfq: () => { accepted: boolean; reason: string } | undefined
  onAdvanceDay: () => void
  onAdvanceToNextEvent: () => void
  onFinish: () => void
}

const thesisTags: ThesisTag[] = ['growth', 'inflation', 'policy', 'valuation', 'momentum', 'catalyst', 'relative-value', 'positioning', 'risk-hedge']
function weightOf(snapshot: MacroSessionSnapshot, assetId: MacroAssetId): number { return snapshot.nav === 0 ? 0 : snapshot.positions[assetId].units * snapshot.prices[assetId] / snapshot.nav }
function signedPercent(value: number, digits = 1): string { return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%` }
function priceText(assetId: MacroAssetId, value: number): string { return value.toFixed(MACRO_ASSET_MAP[assetId].priceDecimals) }

export function MacroTradingTerminal({ snapshot, feedback, onExecuteTarget, onRequestDealerQuotes, onAcceptDealerQuote, onCancelDealerRfq, onAdvanceDay, onAdvanceToNextEvent, onFinish }: Props) {
  const [selectedAssetId, setSelectedAssetId] = useState<MacroAssetId>('es-macro')
  const [sizingMode, setSizingMode] = useState<'quantity' | 'target'>('quantity')
  const [tradeQuantityInput, setTradeQuantityInput] = useState('25')
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy')
  const [targetPct, setTargetPct] = useState(0)
  const [tag, setTag] = useState<ThesisTag>('growth')
  const [horizon, setHorizon] = useState<ThesisHorizon>('weeks')
  const [conviction, setConviction] = useState(3)
  const [invalidation, setInvalidation] = useState('')

  const selected = MACRO_ASSET_MAP[selectedAssetId]
  const mid = snapshot.prices[selectedAssetId]
  const marketQuote = topOfBookQuote(selected, mid)
  const currentWeight = weightOf(snapshot, selectedAssetId)
  const enteredQuantity = roundNativeQuantity(selected, Math.max(0, Number(tradeQuantityInput) || 0))
  const enteredNotional = notionalFromNativeQuantity(selected, mid, enteredQuantity)
  const quantityTargetPct = (currentWeight + (tradeDirection === 'buy' ? 1 : -1) * enteredNotional / Math.max(1, snapshot.nav)) * 100
  const effectiveTargetPct = sizingMode === 'quantity' ? quantityTargetPct : targetPct
  const deltaWeight = effectiveTargetPct / 100 - currentWeight
  const targetNotional = Math.abs(deltaWeight) * snapshot.nav
  const targetQuantity = nativeQuantityFromNotional(selected, mid, targetNotional)
  const executionSide: 'buy' | 'sell' = deltaWeight >= 0 ? 'buy' : 'sell'
  const estimatedCommission = targetNotional > 0 ? commissionForNotional(selected, executionSide === 'buy' ? marketQuote.offer : marketQuote.bid, targetNotional, 'direct-market') : 0
  const estimatedMarketCost = targetNotional * selected.transactionCostBps / 10_000
  const estimatedCost = estimatedMarketCost + estimatedCommission
  const nextEvents = snapshot.calendar.filter((event) => !event.revealed && event.day > snapshot.day).slice(0, 4)
  const recentPoints = snapshot.history.slice(-20)
  const navReturn = snapshot.nav / snapshot.options.initialNav - 1
  const estimatedTurnover = Math.abs(deltaWeight)
  const targetWithinLimit = Math.abs(effectiveTargetPct) <= selected.maxAbsWeight * 100 + 1e-9
  const canTrade = Math.abs(deltaWeight) >= 0.001 && targetWithinLimit && (Math.abs(effectiveTargetPct) < 0.01 || invalidation.trim().length >= 8)

  const chartPath = useMemo(() => {
    const series = [{ day: 0, price: selected.initialPrice }, ...snapshot.history.map((point) => ({ day: point.day, price: point.prices[selectedAssetId] }))]
    if (series.length < 2) return ''
    const min = Math.min(...series.map((point) => point.price)); const max = Math.max(...series.map((point) => point.price)); const span = Math.max(max - min, selected.initialPrice * 0.002)
    return series.map((point, index) => { const x = series.length === 1 ? 0 : index / (series.length - 1) * 100; const y = 88 - (point.price - min) / span * 76; return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}` }).join(' ')
  }, [selected.initialPrice, selectedAssetId, snapshot.history])

  const applyTemplate = () => {
    const template: Record<ThesisTag, string> = {
      growth: 'Growth data moves against the thesis for two consecutive releases.', inflation: 'Inflation surprises reverse and rates pricing moves against the thesis.', policy: 'Central-bank pricing shifts materially against the expected policy path.', valuation: 'The valuation gap closes or the fundamental anchor changes.', momentum: 'Price momentum breaks and fails to recover after the next catalyst.', catalyst: 'The expected catalyst does not occur or produces the opposite market response.', 'relative-value': 'The spread relationship breaks beyond the level justified by the thesis.', positioning: 'Flow and positioning evidence reverses rather than extending.', 'risk-hedge': 'The underlying risk being hedged falls materially or the hedge correlation breaks.',
    }
    setInvalidation(template[tag])
  }
  const buildIntent = (): MacroTradeIntent => ({ assetId: selectedAssetId, targetWeight: effectiveTargetPct / 100, tag, horizon, conviction, invalidation })
  const submit = () => { void onExecuteTarget(buildIntent()) }
  const requestDealerQuotes = (dealerCount: number) => { void onRequestDealerQuotes(buildIntent(), dealerCount) }
  const chooseAsset = (assetId: MacroAssetId) => { setSelectedAssetId(assetId); setTargetPct(Number((weightOf(snapshot, assetId) * 100).toFixed(1))); setTradeQuantityInput('25') }
  const switchSizingMode = (mode: 'quantity' | 'target') => {
    if (mode === sizingMode) return
    if (mode === 'target') setTargetPct(Number(effectiveTargetPct.toFixed(1)))
    else {
      const asset = MACRO_ASSET_MAP[selectedAssetId]; const qty = nativeQuantityFromNotional(asset, snapshot.prices[selectedAssetId], Math.abs(deltaWeight) * snapshot.nav)
      setTradeDirection(deltaWeight < 0 ? 'sell' : 'buy'); setTradeQuantityInput(qty >= asset.quantityStep ? String(roundNativeQuantity(asset, qty)) : '')
    }
    setSizingMode(mode)
  }

  return <main className="macro-terminal-shell">
    <header className="macro-terminal-header">
      <div className="macro-terminal-brand"><span className="brand-mark macro-brand-mark compact">GM</span><div><p className="eyebrow">GLOBAL MACRO FUND</p><strong>DealerSim Buy-Side</strong></div></div>
      <div className="macro-header-stat"><span>Day</span><strong>{snapshot.day} / {snapshot.options.days}</strong></div><div className="macro-header-stat"><span>NAV</span><strong>{formatMoney(snapshot.nav)}</strong></div><div className={`macro-header-stat ${navReturn >= 0 ? 'positive' : 'negative'}`}><span>Return</span><strong>{signedPercent(navReturn)}</strong></div><div className={`macro-header-stat ${snapshot.maxDrawdown > -0.05 ? '' : 'warning'}`}><span>Max DD</span><strong>{formatPercent(snapshot.maxDrawdown, 1)}</strong></div><div className="macro-header-stat"><span>Gross / Net</span><strong>{formatPercent(snapshot.risk.grossExposure)} / {signedPercent(snapshot.risk.netExposure, 0)}</strong></div><div className="macro-header-stat"><span>Cash</span><strong>{formatPercent(snapshot.risk.cashWeight)}</strong></div>
      <div className="macro-terminal-actions"><button className="button button-small button-ghost" type="button" onClick={onAdvanceDay}>Advance 1 day</button><button className="button button-small button-primary" type="button" onClick={onAdvanceToNextEvent}>Next event</button><button className="button button-small button-danger" type="button" onClick={onFinish}>Finish</button></div>
    </header>

    <section className="macro-context-strip decision-context-strip">
      <article className="macro-context-panel macro-calendar-panel"><div className="panel-heading-inline"><span>Next catalysts</span><small>Consensus known · actual revealed on release</small></div><div className="macro-calendar-row">{nextEvents.length === 0 ? <span className="muted-line">No scheduled releases remaining.</span> : nextEvents.slice(0, 3).map((event) => <div key={event.id}><b>D{event.day}</b><span>{event.title}</span><strong>{event.consensus}{event.unit ? ` ${event.unit}` : ''}</strong></div>)}</div></article>
      <article className="macro-context-panel"><div className="panel-heading-inline"><span>Book risk</span><small>Only decision-critical exposures</small></div><div className="factor-chip-row"><span>Gross <b>{formatPercent(snapshot.risk.grossExposure)}</b></span><span>Net <b>{signedPercent(snapshot.risk.netExposure, 0)}</b></span><span>Risk util <b>{formatPercent(snapshot.risk.riskUtilisation)}</b></span><span>Cash <b>{formatPercent(snapshot.risk.cashWeight)}</b></span></div></article>
      <article className="macro-context-panel"><div className="panel-heading-inline"><span>Allocation state</span><small>Strategic PM live view</small></div><strong>{snapshot.risk.grossExposure < 0.05 ? 'Mostly cash' : snapshot.risk.netExposure >= 0 ? 'Net long risk' : 'Net short risk'}</strong><p>Day {snapshot.day} of {snapshot.options.days} · next decision should be driven by catalysts, positioning and execution cost.</p></article>
    </section>

    <div className="macro-terminal-grid">
      <section className="macro-panel macro-watch-panel">
        <div className="macro-panel-title"><div><p className="eyebrow">MARKET WATCH</p><h2>Cross-asset prices</h2></div><span>Executable bid / offer</span></div>
        <div className="macro-watch-table"><div className="macro-watch-head"><span>Asset</span><span>Bid</span><span>Offer</span><span>1D</span><span>Weight</span><span>P&amp;L</span></div>{MACRO_ASSETS.map((asset) => {
          const daily = snapshot.previousPrices[asset.id] ? snapshot.prices[asset.id] / snapshot.previousPrices[asset.id] - 1 : 0; const weight = weightOf(snapshot, asset.id); const quote = topOfBookQuote(asset, snapshot.prices[asset.id])
          return <button type="button" key={asset.id} className={`macro-watch-row${selectedAssetId === asset.id ? ' selected' : ''}`} onClick={() => chooseAsset(asset.id)}><span><b>{asset.symbol}</b><small>{asset.displayName}</small></span><strong>{priceText(asset.id, quote.bid)}</strong><strong>{priceText(asset.id, quote.offer)}</strong><em className={daily >= 0 ? 'positive' : 'negative'}>{signedPercent(daily)}</em><em className={weight >= 0 ? 'positive' : 'negative'}>{signedPercent(weight)}</em><em className={snapshot.attribution.byAsset[asset.id] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byAsset[asset.id])}</em></button>
        })}</div>

        <div className="macro-trade-ticket">
          <div className="panel-heading-inline"><span>Trade ticket · {selected.symbol}</span><small>Quantity first · target weight optional</small></div>
          <div className="buy-side-market-quote"><div className="bid"><span>BID · SELL</span><strong>{priceText(selectedAssetId, marketQuote.bid)}</strong></div><div className="mid"><span>MID</span><strong>{priceText(selectedAssetId, mid)}</strong><small>{(marketQuote.halfSpreadBps * 2).toFixed(2)}bp spread</small></div><div className="offer"><span>OFFER · BUY</span><strong>{priceText(selectedAssetId, marketQuote.offer)}</strong></div></div>
          <div className="macro-target-readout"><div><span>Current</span><strong>{signedPercent(currentWeight)}</strong></div><div><span>Trade qty</span><strong>{formatNativeQuantity(selected, sizingMode === 'quantity' ? enteredQuantity : targetQuantity)} {selected.unitPlural}</strong></div><div><span>Notional</span><strong>{formatMoney(targetNotional)}</strong></div><div><span>Est. costs</span><strong>{formatMoney(estimatedCost)}</strong><small>{formatMoney(estimatedCommission)} commission</small></div></div>
          <div className="live-sizing-tabs"><button type="button" className={sizingMode === 'quantity' ? 'selected' : ''} onClick={() => switchSizingMode('quantity')}>Quantity</button><button type="button" className={sizingMode === 'target' ? 'selected' : ''} onClick={() => switchSizingMode('target')}>Target weight</button></div>
          {sizingMode === 'quantity' ? <div className="live-notional-sizing"><div className="live-direction-toggle"><button type="button" className={tradeDirection === 'buy' ? 'buy selected' : 'buy'} onClick={() => setTradeDirection('buy')}>BUY</button><button type="button" className={tradeDirection === 'sell' ? 'sell selected' : 'sell'} onClick={() => setTradeDirection('sell')}>SELL</button></div><label className="live-notional-input buy-side-quantity-input"><span>Quantity ({selected.unitPlural})</span><div><input type="number" min="0" step={selected.quantityStep} value={tradeQuantityInput} onChange={(event) => setTradeQuantityInput(event.target.value)} /><em>{selected.unitPlural}</em></div></label><div className="live-quick-notional">{[10, 25, 50, 100].map((value) => <button type="button" key={value} onClick={() => setTradeQuantityInput(String(value))}>{value}</button>)}</div></div> : <div className="live-target-sizing"><label className="live-target-input"><span>Target NAV weight</span><div><input type="number" step="0.5" value={targetPct} onChange={(event) => setTargetPct(Number(event.target.value))} /><em>%</em></div></label><input className="macro-weight-slider" type="range" min={-selected.maxAbsWeight * 100} max={selected.maxAbsWeight * 100} step="1" value={targetPct} onChange={(event) => setTargetPct(Number(event.target.value))} /><div className="macro-quick-weights"><button type="button" onClick={() => setTargetPct(-10)}>−10%</button><button type="button" onClick={() => setTargetPct(-5)}>−5%</button><button type="button" onClick={() => setTargetPct(0)}>Flat</button><button type="button" onClick={() => setTargetPct(5)}>+5%</button><button type="button" onClick={() => setTargetPct(10)}>+10%</button></div><p className="fund-target-preview">Required execution ≈ <strong>{executionSide.toUpperCase()} {formatNativeQuantity(selected, targetQuantity)} {selected.unitPlural}</strong></p></div>}
          {!targetWithinLimit && <p className="live-sizing-warning">Target exceeds the {selected.symbol} position limit of ±{(selected.maxAbsWeight * 100).toFixed(0)}% NAV.</p>}
          <p className="fund-target-preview">Resulting target <strong>{signedPercent(effectiveTargetPct / 100)}</strong> · turnover {formatPercent(estimatedTurnover, 1)}</p>
          <div className="macro-thesis-grid"><label><span>Thesis</span><select value={tag} onChange={(event) => setTag(event.target.value as ThesisTag)}>{thesisTags.map((item) => <option key={item} value={item}>{item.replaceAll('-', ' ')}</option>)}</select></label><label><span>Horizon</span><select value={horizon} onChange={(event) => setHorizon(event.target.value as ThesisHorizon)}><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option></select></label><label><span>Conviction</span><select value={conviction} onChange={(event) => setConviction(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label></div>
          <label className="macro-invalidation"><span>What invalidates this view?</span><div><input value={invalidation} onChange={(event) => setInvalidation(event.target.value)} placeholder="State the condition that makes you reassess" /><button type="button" onClick={applyTemplate}>Template</button></div></label>
          {feedback && <p className="macro-ticket-feedback">{feedback}</p>}
          {!snapshot.activeDealerRfq && <div className="macro-execution-choice"><div className="panel-heading-inline"><span>Execution route</span><small>Exchange vs firm dealer liquidity</small></div><div className="macro-execution-buttons"><button className="button button-primary" type="button" disabled={!canTrade} onClick={submit}>{executionSide === 'buy' ? 'BUY' : 'SELL'} direct market</button><button className="button button-ghost" type="button" disabled={!canTrade} onClick={() => requestDealerQuotes(3)}>RFQ 3 dealers</button><button className="button button-ghost" type="button" disabled={!canTrade} onClick={() => requestDealerQuotes(5)}>RFQ 5 dealers</button></div><p className="macro-execution-hint">The market quote shows the top executable bid/offer. Large orders can fill worse than top-of-book. Direct execution pays explicit commission; dealer RFQ economics are embedded in the dealer spread.</p></div>}
          {snapshot.activeDealerRfq && (() => {
            const rfq = snapshot.activeDealerRfq; const rfqAsset = MACRO_ASSET_MAP[rfq.assetId]; const requestedQty = nativeQuantityFromNotional(rfqAsset, snapshot.prices[rfq.assetId], rfq.requestedNotional)
            return <div className="macro-dealer-rfq"><div className="macro-dealer-rfq-head"><div><span>LIVE DEALER RFQ · {rfqAsset.symbol}</span><strong>{rfq.side.toUpperCase()} {formatNativeQuantity(rfqAsset, requestedQty)} {rfqAsset.unitPlural} block</strong></div><button type="button" onClick={onCancelDealerRfq}>Cancel</button></div><div className="macro-direct-benchmark"><span>Direct-market benchmark</span><strong>{rfq.directBenchmarkPrice.toFixed(rfqAsset.priceDecimals)}</strong><small>est. all-in {formatMoney(rfq.directCost)}</small></div><div className="macro-dealer-quote-list">{rfq.quotes.map((quote) => {
              const executable = rfq.side === 'buy' ? quote.offer : quote.bid; const improvement = rfq.side === 'buy' ? rfq.directBenchmarkPrice - executable : executable - rfq.directBenchmarkPrice; const directCommission = commissionForNotional(rfqAsset, rfq.directBenchmarkPrice, rfq.requestedNotional, 'direct-market'); const saving = improvement * rfq.requestedUnits + directCommission; const alignedAxe = (rfq.side === 'buy' && quote.axe === 'sell') || (rfq.side === 'sell' && quote.axe === 'buy'); const capacityQty = nativeQuantityFromNotional(rfqAsset, snapshot.prices[rfq.assetId], Math.min(quote.maxNotional, rfq.requestedNotional))
              return <article key={quote.id} className={`macro-dealer-quote${alignedAxe ? ' aligned-axe' : ''}`}><div className="macro-dealer-name"><b>{quote.dealerName}</b><span>{quote.colour} · firm {formatNativeQuantity(rfqAsset, capacityQty)} {rfqAsset.unitPlural}</span></div><div className="macro-dealer-two-way"><span>{quote.bid.toFixed(rfqAsset.priceDecimals)}</span><i>/</i><span>{quote.offer.toFixed(rfqAsset.priceDecimals)}</span></div><div className="macro-dealer-edge"><strong className={saving >= 0 ? 'positive' : 'negative'}>{saving >= 0 ? '+' : ''}{formatMoney(saving)}</strong><small>vs direct</small></div><div className="macro-dealer-trade-actions"><button type="button" onClick={() => onAcceptDealerQuote(quote.id, 0.5)}>50%</button><button type="button" onClick={() => onAcceptDealerQuote(quote.id, 1)}>Full</button></div></article>
            })}</div>{snapshot.options.difficulty === 'learning' && <p className="macro-dealer-learning">Dealer axes are useful colour, not a free signal. A dealer axed to the opposite side of your trade may price more aggressively because your flow helps their inventory.</p>}</div>
          })()}
        </div>
      </section>

      <section className="macro-panel macro-portfolio-panel">
        <div className="macro-panel-title"><div><p className="eyebrow">PORTFOLIO</p><h2>{selected.symbol} path &amp; risk</h2></div><span>{selected.assetClass}</span></div>
        <div className="macro-price-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${selected.symbol} synthetic price path`}><line x1="0" y1="88" x2="100" y2="88" /><path d={chartPath} /></svg><div className="macro-chart-labels"><span>D0</span><strong>{priceText(selectedAssetId, snapshot.prices[selectedAssetId])}</strong><span>D{snapshot.day}</span></div></div>
        <div className="macro-risk-cards"><div><span>Risk utilisation</span><strong>{formatPercent(snapshot.risk.riskUtilisation)}</strong></div><div><span>Turnover</span><strong>{formatPercent(snapshot.turnover)}</strong></div><div><span>Commissions</span><strong>{formatMoney(snapshot.commissions)}</strong></div><div><span>Trading costs</span><strong>{formatMoney(snapshot.transactionCosts)}</strong></div></div>
        <div className="macro-position-table"><div className="macro-position-head buy-side-position-head"><span>Position</span><span>Qty</span><span>Weight</span><span>Notional</span><span>Asset P&amp;L</span></div>{MACRO_ASSETS.filter((asset) => Math.abs(weightOf(snapshot, asset.id)) > 0.001).map((asset) => { const weight = weightOf(snapshot, asset.id); const pnl = snapshot.attribution.byAsset[asset.id]; const qty = Math.abs(snapshot.positions[asset.id].units / asset.contractMultiplier); return <div className="macro-position-row buy-side-position-row" key={asset.id}><span><b>{asset.symbol}</b><small>{asset.displayName}</small></span><span>{snapshot.positions[asset.id].units < 0 ? '−' : ''}{formatNativeQuantity(asset, qty)}</span><strong className={weight >= 0 ? 'positive' : 'negative'}>{signedPercent(weight)}</strong><span>{formatMoney(weight * snapshot.nav)}</span><span className={pnl >= 0 ? 'positive' : 'negative'}>{formatMoney(pnl)}</span></div>})}{snapshot.risk.grossExposure < 0.001 && <div className="macro-empty-position">Portfolio is currently all cash.</div>}</div>
      </section>

      <section className="macro-panel macro-tape-panel live-news-column"><div className="macro-panel-title"><div><p className="eyebrow">LIVE INFORMATION</p><h2>News &amp; catalysts</h2></div><span>Newest first</span></div><div className="macro-news-tape prominent-live-news">{snapshot.headlines.slice(0, 14).map((item) => <article key={item.id} className={`macro-headline ${item.severity}`}><div><span>D{item.day}</span><strong>{item.title}</strong></div><p>{item.detail}</p></article>)}</div><p className="live-review-handoff">Full thesis history, factor decomposition and attribution are reviewed after the session.</p></section>
    </div>

    <footer className="macro-status-strip"><span>Mandate: absolute-return Global Macro</span><span>Gross limit 150%</span><span>Hard DD 10%</span><span>Commissions {formatMoney(snapshot.commissions)}</span><span>Dealer fills {snapshot.dealerTrades}</span><span>Dealer vs direct {snapshot.dealerSavings >= 0 ? '+' : ''}{formatMoney(snapshot.dealerSavings)}</span>{recentPoints.length > 0 && <span>Last day {signedPercent(snapshot.history.at(-1)?.nav ? snapshot.history.at(-1)!.nav / (snapshot.history.at(-2)?.nav ?? snapshot.options.initialNav) - 1 : 0)}</span>}</footer>
  </main>
}
