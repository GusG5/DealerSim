import { useMemo, useState } from 'react'
import { createLiveMacroPremarketBriefing } from '../engine/live-macro'
import { MACRO_ASSETS, MACRO_SCENARIOS } from '../engine/macro'
import type { LiveMacroPreMarketPlanItem, LiveMacroPreMarketView, LiveMacroSessionOptions, LiveMacroStartingPortfolio } from '../engine/live-macro-types'
import type { MacroAssetId, PortfolioFactor } from '../engine/macro-types'
import { formatPercent, formatTime } from '../lib/format'

interface Props {
  options: LiveMacroSessionOptions
  onOpenMarket: (options: LiveMacroSessionOptions) => void
  onBack: () => void
}

const ids = MACRO_ASSETS.map((asset) => asset.id)
const FACTORS: PortfolioFactor[] = ['growth', 'inflation', 'policy', 'risk', 'energy', 'usd']

function emptyWeights(): Record<MacroAssetId, number> {
  return Object.fromEntries(ids.map((id) => [id, 0])) as Record<MacroAssetId, number>
}
function exampleWeights(): Record<MacroAssetId, number> {
  return { 'es-macro': -.04, 'ty-macro': -.10, 'fgbl-macro': -.05, 'brn-macro': .05, 'gold-macro': .08, 'eurusd-macro': .03 }
}
function inputs(weights: Record<MacroAssetId, number>) {
  return Object.fromEntries(ids.map((id) => [id, (weights[id] * 100).toFixed(1)])) as Record<MacroAssetId, string>
}
function autoView(weight: number): LiveMacroPreMarketView { return weight > .005 ? 'long' : weight < -.005 ? 'short' : 'neutral' }
function defaultRisk(id: MacroAssetId): string {
  if (id === 'es-macro') return 'Growth / rates shock'
  if (id === 'ty-macro' || id === 'fgbl-macro') return 'Inflation / policy repricing'
  if (id === 'brn-macro') return 'Supply / demand shock'
  if (id === 'gold-macro') return 'Real yields / USD'
  return 'Relative policy / USD'
}

export function LiveMacroPremarketSetup({ options, onOpenMarket, onBack }: Props) {
  const briefing = useMemo(() => createLiveMacroPremarketBriefing(options), [options])
  const initial = exampleWeights()
  const [preset, setPreset] = useState<LiveMacroStartingPortfolio>('example')
  const [weightInputs, setWeightInputs] = useState<Record<MacroAssetId, string>>(() => inputs(initial))
  const [views, setViews] = useState<Record<MacroAssetId, LiveMacroPreMarketView>>(() => Object.fromEntries(ids.map((id) => [id, autoView(initial[id])])) as Record<MacroAssetId, LiveMacroPreMarketView>)
  const [risks, setRisks] = useState<Record<MacroAssetId, string>>(() => Object.fromEntries(ids.map((id) => [id, defaultRisk(id)])) as Record<MacroAssetId, string>)

  const weights = useMemo(() => Object.fromEntries(ids.map((id) => [id, (Number(weightInputs[id]) || 0) / 100])) as Record<MacroAssetId, number>, [weightInputs])
  const gross = MACRO_ASSETS.reduce((sum, asset) => sum + Math.abs(weights[asset.id]), 0)
  const net = MACRO_ASSETS.reduce((sum, asset) => sum + weights[asset.id], 0)
  const concentration = Math.max(...MACRO_ASSETS.map((asset) => Math.abs(weights[asset.id])))
  const factorExposure = Object.fromEntries(FACTORS.map((factor) => [factor, MACRO_ASSETS.reduce((sum, asset) => sum + weights[asset.id] * asset.factorLoadings[factor], 0)])) as Record<PortfolioFactor, number>
  const factorUtil = Math.max(...FACTORS.map((factor) => Math.abs(factorExposure[factor]) / .75))
  const riskUtil = Math.max(gross / 1.5, concentration / .35, factorUtil)
  const errors = MACRO_ASSETS.flatMap((asset) => Math.abs(weights[asset.id]) > asset.maxAbsWeight + .0005 ? [`${asset.symbol}: ${(Math.abs(weights[asset.id]) * 100).toFixed(1)}% exceeds the ${(asset.maxAbsWeight * 100).toFixed(0)}% position limit.`] : [])
  if (gross > 1.5005) errors.push(`Gross exposure ${(gross * 100).toFixed(0)}% exceeds the 150% mandate limit.`)
  if (riskUtil > 1.28) errors.push(`Starting factor/concentration risk is too high (${riskUtil.toFixed(2)}x risk utilisation).`)

  const applyPreset = (next: LiveMacroStartingPortfolio) => {
    setPreset(next)
    const nextWeights = next === 'example' ? exampleWeights() : emptyWeights()
    setWeightInputs(inputs(nextWeights))
    setViews(Object.fromEntries(ids.map((id) => [id, autoView(nextWeights[id])])) as Record<MacroAssetId, LiveMacroPreMarketView>)
  }
  const updateWeight = (id: MacroAssetId, value: string) => {
    setPreset('custom')
    setWeightInputs((current) => ({ ...current, [id]: value }))
    setViews((current) => ({ ...current, [id]: autoView((Number(value) || 0) / 100) }))
  }
  const open = () => {
    if (errors.length) return
    const plan = Object.fromEntries(ids.map((id) => [id, { view: views[id], plannedWeight: weights[id], keyRisk: risks[id] } satisfies LiveMacroPreMarketPlanItem])) as Record<MacroAssetId, LiveMacroPreMarketPlanItem>
    onOpenMarket({ ...options, startingPortfolio: preset, initialWeights: weights, preMarketPlan: plan, preMarketBriefing: briefing })
  }

  return <main className="premarket-shell macro-premarket-shell">
    <header className="premarket-header"><div><p className="eyebrow">GLOBAL MACRO · PRE-MARKET</p><h1>Morning Macro Briefing</h1><p>Markets are frozen. Review the overnight tape and event calendar, set the book you already own, then start continuous trading.</p></div><div className="premarket-header-actions"><button className="button button-ghost" onClick={onBack}>Back</button><span className="status-chip status-warning">Clock not started</span></div></header>

    <section className="premarket-overview">{briefing.marketOverview.map((line) => <article key={line}><span>OVERNIGHT</span><strong>{line}</strong></article>)}{options.difficulty === 'learning' && <article className="learning-brief"><span>LEARNING READ</span><strong>{MACRO_SCENARIOS[briefing.resolvedScenario].label}</strong><small>Hidden at higher difficulties.</small></article>}</section>

    <div className="premarket-grid macro-premarket-grid">
      <section className="premarket-panel">
        <div className="section-heading"><div><p className="eyebrow">CROSS-ASSET TAPE</p><h2>What you know before the open</h2></div></div>
        <div className="macro-premarket-tape">{MACRO_ASSETS.map((asset) => { const item = briefing.assets[asset.id]; return <article key={asset.id}><div><b>{asset.symbol}</b><span>{asset.displayName}</span></div><strong className={item.overnightChangePct >= 0 ? 'positive' : 'negative'}>{item.overnightChangePct >= 0 ? '+' : ''}{item.overnightChangePct.toFixed(2)}%</strong><p>{item.marketColour}</p><footer><span>Prev {item.previousClose.toFixed(asset.priceDecimals)}</span><span>Max {formatPercent(asset.maxAbsWeight, 0)}</span></footer></article> })}</div>
        <div className="known-calendar"><div className="panel-heading-inline"><span>KNOWN EVENT CALENDAR</span><small>Actual outcomes remain hidden</small></div>{briefing.calendar.slice(0, 6).map((event) => <div key={event.id}><span><b>{formatTime(event.releaseAtSeconds)}</b>{event.title}</span><strong>{event.consensus}{event.unit ? ` ${event.unit}` : ''}</strong><small>{event.detail}</small></div>)}</div>
      </section>

      <section className="premarket-panel premarket-book-panel">
        <div className="section-heading"><div><p className="eyebrow">OPENING MACRO BOOK</p><h2>Set inherited positions</h2></div><span className="status-chip">$100m NAV</span></div>
        <div className="portfolio-preset-grid"><button className={preset === 'example' ? 'selected' : ''} onClick={() => applyPreset('example')}><strong>Example portfolio</strong><small>Moderate cross-asset positions to manage from the opening bell.</small></button><button className={preset === 'flat' ? 'selected' : ''} onClick={() => applyPreset('flat')}><strong>Start flat</strong><small>100% cash.</small></button><button className={preset === 'custom' ? 'selected' : ''} onClick={() => applyPreset('custom')}><strong>Build my portfolio</strong><small>Choose every starting weight.</small></button></div>
        <div className="opening-book-head macro-opening-book-head"><span>Asset</span><span>Start wt</span><span>View</span><span>Key risk</span></div>
        <div className="opening-book-rows macro-opening-book-rows">{MACRO_ASSETS.map((asset) => <div key={asset.id}><span><b>{asset.symbol}</b><small>{asset.assetClass}</small></span><label><input type="number" step="0.5" value={weightInputs[asset.id]} onChange={(event) => updateWeight(asset.id, event.target.value)} /><i>%</i></label><select value={views[asset.id]} onChange={(event) => setViews((current) => ({ ...current, [asset.id]: event.target.value as LiveMacroPreMarketView }))}><option value="long">long</option><option value="neutral">neutral</option><option value="short">short</option><option value="hedge">hedge</option></select><input className="risk-input" value={risks[asset.id]} onChange={(event) => setRisks((current) => ({ ...current, [asset.id]: event.target.value }))} /></div>)}</div>
        <div className="opening-risk-strip"><span><small>Gross</small><strong>{formatPercent(gross, 1)}</strong></span><span><small>Net</small><strong>{formatPercent(net, 1)}</strong></span><span><small>Cash</small><strong>{formatPercent(1 - net, 1)}</strong></span><span><small>Risk use</small><strong>{riskUtil.toFixed(2)}x</strong></span></div>
        <div className="factor-preview"><span>Starting factor exposure</span>{FACTORS.map((factor) => <b key={factor} className={Math.abs(factorExposure[factor]) > .3 ? 'risk-hot' : ''}>{factor} {factorExposure[factor] >= 0 ? '+' : ''}{factorExposure[factor].toFixed(2)}</b>)}</div>
        {errors.length > 0 && <div className="premarket-errors"><strong>Opening book needs attention</strong>{errors.map((error) => <p key={error}>{error}</p>)}</div>}
        <div className="premarket-open-actions"><div><strong>Starting holdings are inherited at the opening mark.</strong><span>No transaction cost or turnover is charged until the live session begins.</span></div><button className="button button-primary" disabled={errors.length > 0} onClick={open}>Open market · {formatTime(options.durationSeconds)}</button></div>
      </section>
    </div>
  </main>
}
