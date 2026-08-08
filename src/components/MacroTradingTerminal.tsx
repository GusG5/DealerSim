import { useMemo, useState } from 'react'
import { MACRO_ASSETS, MACRO_ASSET_MAP, MACRO_SCENARIOS } from '../engine/macro'
import type { MacroAssetId, MacroSessionSnapshot, MacroTradeIntent, PortfolioFactor, ThesisHorizon, ThesisTag } from '../engine/macro-types'
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
const factors: PortfolioFactor[] = ['growth', 'inflation', 'policy', 'risk', 'energy', 'usd']

function weightOf(snapshot: MacroSessionSnapshot, assetId: MacroAssetId): number {
  return snapshot.nav === 0 ? 0 : snapshot.positions[assetId].units * snapshot.prices[assetId] / snapshot.nav
}

function signedPercent(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`
}

function priceText(assetId: MacroAssetId, value: number): string {
  return value.toFixed(MACRO_ASSET_MAP[assetId].priceDecimals)
}

function factorLabel(factor: PortfolioFactor): string {
  return factor === 'usd' ? 'USD' : factor.charAt(0).toUpperCase() + factor.slice(1)
}

export function MacroTradingTerminal({ snapshot, feedback, onExecuteTarget, onRequestDealerQuotes, onAcceptDealerQuote, onCancelDealerRfq, onAdvanceDay, onAdvanceToNextEvent, onFinish }: Props) {
  const [selectedAssetId, setSelectedAssetId] = useState<MacroAssetId>('es-macro')
  const currentWeight = weightOf(snapshot, selectedAssetId)
  const [targetPct, setTargetPct] = useState(0)
  const [tag, setTag] = useState<ThesisTag>('growth')
  const [horizon, setHorizon] = useState<ThesisHorizon>('weeks')
  const [conviction, setConviction] = useState(3)
  const [invalidation, setInvalidation] = useState('')
  const selected = MACRO_ASSET_MAP[selectedAssetId]
  const nextEvents = snapshot.calendar.filter((event) => !event.revealed && event.day > snapshot.day).slice(0, 4)
  const recentPoints = snapshot.history.slice(-20)
  const navReturn = snapshot.nav / snapshot.options.initialNav - 1
  const estimatedTurnover = Math.abs(targetPct / 100 - currentWeight)
  const estimatedCost = snapshot.nav * estimatedTurnover * selected.transactionCostBps / 10_000
  const canTrade = Math.abs(targetPct / 100 - currentWeight) >= 0.001 && (Math.abs(targetPct) < 0.01 || invalidation.trim().length >= 8)

  const chartPath = useMemo(() => {
    const series = [{ day: 0, price: selected.initialPrice }, ...snapshot.history.map((point) => ({ day: point.day, price: point.prices[selectedAssetId] }))]
    if (series.length < 2) return ''
    const min = Math.min(...series.map((point) => point.price))
    const max = Math.max(...series.map((point) => point.price))
    const span = Math.max(max - min, selected.initialPrice * 0.002)
    return series.map((point, index) => {
      const x = series.length === 1 ? 0 : index / (series.length - 1) * 100
      const y = 88 - (point.price - min) / span * 76
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    }).join(' ')
  }, [selected.initialPrice, selectedAssetId, snapshot.history])

  const applyTemplate = () => {
    const template: Record<ThesisTag, string> = {
      growth: 'Growth data moves against the thesis for two consecutive releases.',
      inflation: 'Inflation surprises reverse and rates pricing moves against the thesis.',
      policy: 'Central-bank pricing shifts materially against the expected policy path.',
      valuation: 'The valuation gap closes or the fundamental anchor changes.',
      momentum: 'Price momentum breaks and fails to recover after the next catalyst.',
      catalyst: 'The expected catalyst does not occur or produces the opposite market response.',
      'relative-value': 'The spread relationship breaks beyond the level justified by the thesis.',
      positioning: 'Flow and positioning evidence reverses rather than extending.',
      'risk-hedge': 'The underlying risk being hedged falls materially or the hedge correlation breaks.',
    }
    setInvalidation(template[tag])
  }

  const buildIntent = (): MacroTradeIntent => ({ assetId: selectedAssetId, targetWeight: targetPct / 100, tag, horizon, conviction, invalidation })

  const submit = () => {
    const result = onExecuteTarget(buildIntent())
    void result
  }

  const requestDealerQuotes = (dealerCount: number) => {
    const result = onRequestDealerQuotes(buildIntent(), dealerCount)
    void result
  }

  return <main className="macro-terminal-shell">
    <header className="macro-terminal-header">
      <div className="macro-terminal-brand"><span className="brand-mark macro-brand-mark compact">GM</span><div><p className="eyebrow">GLOBAL MACRO FUND</p><strong>DealerSim Buy-Side</strong></div></div>
      <div className="macro-header-stat"><span>Day</span><strong>{snapshot.day} / {snapshot.options.days}</strong></div>
      <div className="macro-header-stat"><span>NAV</span><strong>{formatMoney(snapshot.nav)}</strong></div>
      <div className={`macro-header-stat ${navReturn >= 0 ? 'positive' : 'negative'}`}><span>Return</span><strong>{signedPercent(navReturn)}</strong></div>
      <div className={`macro-header-stat ${snapshot.maxDrawdown > -0.05 ? '' : 'warning'}`}><span>Max DD</span><strong>{formatPercent(snapshot.maxDrawdown, 1)}</strong></div>
      <div className="macro-header-stat"><span>Gross / Net</span><strong>{formatPercent(snapshot.risk.grossExposure)} / {signedPercent(snapshot.risk.netExposure, 0)}</strong></div>
      <div className="macro-header-stat"><span>Cash</span><strong>{formatPercent(snapshot.risk.cashWeight)}</strong></div>
      <div className="macro-terminal-actions"><button className="button button-small button-ghost" type="button" onClick={onAdvanceDay}>Advance 1 day</button><button className="button button-small button-primary" type="button" onClick={onAdvanceToNextEvent}>Next event</button><button className="button button-small button-danger" type="button" onClick={onFinish}>Finish</button></div>
    </header>

    <section className="macro-context-strip">
      <article className="macro-context-panel macro-calendar-panel"><div className="panel-heading-inline"><span>Macro calendar</span><small>Consensus known · actual revealed on release</small></div><div className="macro-calendar-row">{nextEvents.length === 0 ? <span className="muted-line">No scheduled releases remaining.</span> : nextEvents.map((event) => <div key={event.id}><b>D{event.day}</b><span>{event.title}</span><strong>{event.consensus}{event.unit ? ` ${event.unit}` : ''}</strong></div>)}</div></article>
      <article className="macro-context-panel"><div className="panel-heading-inline"><span>Portfolio factor risk</span><small>Position exposure, not a forecast</small></div><div className="factor-chip-row">{factors.map((factor) => <span key={factor} className={snapshot.risk.factorExposure[factor] >= 0 ? 'factor-long' : 'factor-short'}>{factorLabel(factor)} <b>{snapshot.risk.factorExposure[factor] >= 0 ? '+' : ''}{snapshot.risk.factorExposure[factor].toFixed(2)}</b></span>)}</div></article>
      {snapshot.options.difficulty === 'learning' && <article className="macro-context-panel learning-factor-panel"><div className="panel-heading-inline"><span>Learning pulse</span><small>Hidden outside Learning</small></div><strong>{MACRO_SCENARIOS[snapshot.resolvedScenario].label}</strong><p>{MACRO_SCENARIOS[snapshot.resolvedScenario].description}</p></article>}
    </section>

    <div className="macro-terminal-grid">
      <section className="macro-panel macro-watch-panel">
        <div className="macro-panel-title"><div><p className="eyebrow">MARKET WATCH</p><h2>Cross-asset prices</h2></div><span>Click to trade</span></div>
        <div className="macro-watch-table">
          <div className="macro-watch-head"><span>Asset</span><span>Price</span><span>1D</span><span>Weight</span><span>P&amp;L</span></div>
          {MACRO_ASSETS.map((asset) => {
            const daily = snapshot.previousPrices[asset.id] ? snapshot.prices[asset.id] / snapshot.previousPrices[asset.id] - 1 : 0
            const weight = weightOf(snapshot, asset.id)
            return <button type="button" key={asset.id} className={`macro-watch-row${selectedAssetId === asset.id ? ' selected' : ''}`} onClick={() => { setSelectedAssetId(asset.id); setTargetPct(Number((weight * 100).toFixed(1))) }}><span><b>{asset.symbol}</b><small>{asset.displayName}</small></span><strong>{priceText(asset.id, snapshot.prices[asset.id])}</strong><em className={daily >= 0 ? 'positive' : 'negative'}>{signedPercent(daily)}</em><em className={weight >= 0 ? 'positive' : 'negative'}>{signedPercent(weight)}</em><em className={snapshot.attribution.byAsset[asset.id] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byAsset[asset.id])}</em></button>
          })}
        </div>

        <div className="macro-trade-ticket">
          <div className="panel-heading-inline"><span>Trade ticket · {selected.symbol}</span><small>Target NAV weight</small></div>
          <div className="macro-target-readout"><div><span>Current</span><strong>{signedPercent(currentWeight)}</strong></div><div><span>Target</span><strong>{targetPct >= 0 ? '+' : ''}{targetPct.toFixed(1)}%</strong></div><div><span>Turnover</span><strong>{formatPercent(estimatedTurnover, 1)}</strong></div><div><span>Est. cost</span><strong>{formatMoney(estimatedCost)}</strong></div></div>
          <input className="macro-weight-slider" type="range" min={-selected.maxAbsWeight * 100} max={selected.maxAbsWeight * 100} step="1" value={targetPct} onChange={(event) => setTargetPct(Number(event.target.value))} />
          <div className="macro-quick-weights"><button type="button" onClick={() => setTargetPct(-10)}>−10%</button><button type="button" onClick={() => setTargetPct(-5)}>−5%</button><button type="button" onClick={() => setTargetPct(0)}>Flat</button><button type="button" onClick={() => setTargetPct(5)}>+5%</button><button type="button" onClick={() => setTargetPct(10)}>+10%</button></div>
          <div className="macro-thesis-grid"><label><span>Thesis</span><select value={tag} onChange={(event) => setTag(event.target.value as ThesisTag)}>{thesisTags.map((item) => <option key={item} value={item}>{item.replaceAll('-', ' ')}</option>)}</select></label><label><span>Horizon</span><select value={horizon} onChange={(event) => setHorizon(event.target.value as ThesisHorizon)}><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option></select></label><label><span>Conviction</span><select value={conviction} onChange={(event) => setConviction(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label></div>
          <label className="macro-invalidation"><span>What invalidates this view?</span><div><input value={invalidation} onChange={(event) => setInvalidation(event.target.value)} placeholder="State the condition that makes you reassess" /><button type="button" onClick={applyTemplate}>Template</button></div></label>
          {feedback && <p className="macro-ticket-feedback">{feedback}</p>}
          {!snapshot.activeDealerRfq && <div className="macro-execution-choice">
            <div className="panel-heading-inline"><span>Execution route</span><small>Compare market vs dealer liquidity</small></div>
            <div className="macro-execution-buttons">
              <button className="button button-primary" type="button" disabled={!canTrade} onClick={submit}>Direct market</button>
              <button className="button button-ghost" type="button" disabled={!canTrade} onClick={() => requestDealerQuotes(3)}>RFQ 3 dealers</button>
              <button className="button button-ghost" type="button" disabled={!canTrade} onClick={() => requestDealerQuotes(5)}>RFQ 5 dealers</button>
            </div>
            <p className="macro-execution-hint">Direct execution pays the synthetic market cost immediately. Dealer RFQ asks for firm block liquidity and may be better or worse depending on axes, product strength and size.</p>
          </div>}
          {snapshot.activeDealerRfq && (() => {
            const rfq = snapshot.activeDealerRfq
            const rfqAsset = MACRO_ASSET_MAP[rfq.assetId]
            return <div className="macro-dealer-rfq">
              <div className="macro-dealer-rfq-head"><div><span>LIVE DEALER RFQ · {rfqAsset.symbol}</span><strong>{rfq.side.toUpperCase()} ${(rfq.requestedNotional / 1_000_000).toFixed(1)}m block</strong></div><button type="button" onClick={onCancelDealerRfq}>Cancel</button></div>
              <div className="macro-direct-benchmark"><span>Direct-market benchmark</span><strong>{rfq.directBenchmarkPrice.toFixed(rfqAsset.priceDecimals)}</strong><small>est. cost {formatMoney(rfq.directCost)}</small></div>
              <div className="macro-dealer-quote-list">
                {rfq.quotes.map((quote) => {
                  const executable = rfq.side === 'buy' ? quote.offer : quote.bid
                  const improvement = rfq.side === 'buy' ? rfq.directBenchmarkPrice - executable : executable - rfq.directBenchmarkPrice
                  const saving = improvement * rfq.requestedUnits
                  const alignedAxe = (rfq.side === 'buy' && quote.axe === 'sell') || (rfq.side === 'sell' && quote.axe === 'buy')
                  return <article key={quote.id} className={`macro-dealer-quote${alignedAxe ? ' aligned-axe' : ''}`}>
                    <div className="macro-dealer-name"><b>{quote.dealerName}</b><span>{quote.colour} · firm ${(quote.maxNotional / 1_000_000).toFixed(0)}m</span></div>
                    <div className="macro-dealer-two-way"><span>{quote.bid.toFixed(rfqAsset.priceDecimals)}</span><i>/</i><span>{quote.offer.toFixed(rfqAsset.priceDecimals)}</span></div>
                    <div className="macro-dealer-edge"><strong className={saving >= 0 ? 'positive' : 'negative'}>{saving >= 0 ? '+' : ''}{formatMoney(saving)}</strong><small>vs direct</small></div>
                    <div className="macro-dealer-trade-actions"><button type="button" onClick={() => onAcceptDealerQuote(quote.id, 0.5)}>50%</button><button type="button" onClick={() => onAcceptDealerQuote(quote.id, 1)}>Full</button></div>
                  </article>
                })}
              </div>
              {snapshot.options.difficulty === 'learning' && <p className="macro-dealer-learning">Dealer axes are useful colour, not a free signal. A dealer axed to the opposite side of your trade may price more aggressively because your flow helps their inventory.</p>}
            </div>
          })()}
        </div>
      </section>

      <section className="macro-panel macro-portfolio-panel">
        <div className="macro-panel-title"><div><p className="eyebrow">PORTFOLIO</p><h2>{selected.symbol} path &amp; risk</h2></div><span>{selected.assetClass}</span></div>
        <div className="macro-price-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${selected.symbol} synthetic price path`}><line x1="0" y1="88" x2="100" y2="88" /><path d={chartPath} /></svg><div className="macro-chart-labels"><span>D0</span><strong>{priceText(selectedAssetId, snapshot.prices[selectedAssetId])}</strong><span>D{snapshot.day}</span></div></div>
        <div className="macro-risk-cards"><div><span>Risk utilisation</span><strong>{formatPercent(snapshot.risk.riskUtilisation)}</strong></div><div><span>Concentration</span><strong>{formatPercent(snapshot.risk.concentration)}</strong></div><div><span>Turnover</span><strong>{formatPercent(snapshot.turnover)}</strong></div><div><span>Trading costs</span><strong>{formatMoney(snapshot.transactionCosts)}</strong></div></div>
        <div className="macro-position-table"><div className="macro-position-head"><span>Position</span><span>Weight</span><span>Notional</span><span>Factor cue</span></div>{MACRO_ASSETS.filter((asset) => Math.abs(weightOf(snapshot, asset.id)) > 0.001).map((asset) => { const weight = weightOf(snapshot, asset.id); const primary = factors.reduce((best, factor) => Math.abs(asset.factorLoadings[factor]) > Math.abs(asset.factorLoadings[best]) ? factor : best, 'growth' as PortfolioFactor); return <div className="macro-position-row" key={asset.id}><span><b>{asset.symbol}</b><small>{asset.displayName}</small></span><strong className={weight >= 0 ? 'positive' : 'negative'}>{signedPercent(weight)}</strong><span>{formatMoney(weight * snapshot.nav)}</span><span>{factorLabel(primary)}</span></div>})}{snapshot.risk.grossExposure < 0.001 && <div className="macro-empty-position">Portfolio is currently all cash.</div>}</div>
        <div className="macro-factor-bars">{factors.map((factor) => { const value = snapshot.risk.factorExposure[factor]; return <div key={factor}><span>{factorLabel(factor)}</span><div><i className={value >= 0 ? 'positive-bar' : 'negative-bar'} style={{ width: `${Math.min(100, Math.abs(value) / 0.75 * 100)}%` }} /></div><strong>{value >= 0 ? '+' : ''}{value.toFixed(2)}</strong></div>})}</div>
      </section>

      <section className="macro-panel macro-tape-panel">
        <div className="macro-panel-title"><div><p className="eyebrow">INFORMATION SET</p><h2>News &amp; thesis journal</h2></div><span>Newest first</span></div>
        <div className="macro-news-tape">{snapshot.headlines.slice(0, 9).map((item) => <article key={item.id} className={`macro-headline ${item.severity}`}><div><span>D{item.day}</span><strong>{item.title}</strong></div><p>{item.detail}</p></article>)}</div>
        <div className="macro-journal"><div className="panel-heading-inline"><span>Thesis journal</span><small>{snapshot.theses.length} recorded</small></div>{snapshot.theses.length === 0 ? <p className="muted-line">Your trade rationale and invalidation conditions appear here.</p> : snapshot.theses.slice().reverse().slice(0, 8).map((thesis) => <article key={thesis.id}><div><b>D{thesis.day} · {MACRO_ASSET_MAP[thesis.assetId].symbol}</b><span>{thesis.targetWeight >= 0 ? 'LONG' : 'SHORT'} {formatPercent(Math.abs(thesis.targetWeight))}</span></div><strong>{thesis.tag.replaceAll('-', ' ')} · conviction {thesis.conviction}/5</strong><p>{thesis.invalidation || 'No invalidation recorded.'}</p></article>)}</div>
      </section>
    </div>

    <footer className="macro-status-strip"><span>Mandate: absolute-return Global Macro</span><span>Gross limit 150%</span><span>Hard DD 10%</span><span>Cash benchmark 0%</span><span>Seed {snapshot.options.seed}</span><span>{snapshot.options.difficulty}</span><span>Dealer fills {snapshot.dealerTrades}</span><span>Dealer vs direct {snapshot.dealerSavings >= 0 ? '+' : ''}{formatMoney(snapshot.dealerSavings)}</span>{recentPoints.length > 0 && <span>Last day {signedPercent(snapshot.history.at(-1)?.nav ? snapshot.history.at(-1)!.nav / (snapshot.history.at(-2)?.nav ?? snapshot.options.initialNav) - 1 : 0)}</span>}</footer>
  </main>
}
