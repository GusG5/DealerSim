import { useMemo, useState } from 'react'
import { BENCHMARK_WEIGHTS, FUND_ASSETS, FUND_ASSET_MAP, FUND_SCENARIOS, createFundPremarketBriefing } from '../engine/fund'
import type { FundAssetId, FundLocate, FundPreMarketPlanItem, FundPreMarketView, FundSessionOptions, FundStartingPortfolio } from '../engine/fund-types'
import { formatPercent, formatTime } from '../lib/format'

interface Props {
  options: FundSessionOptions
  onOpenMarket: (options: FundSessionOptions) => void
  onBack: () => void
}

const STOCKS = FUND_ASSETS.filter((asset) => asset.id !== 'es-fund')
const allIds = FUND_ASSETS.map((asset) => asset.id)

function emptyWeights(): Record<FundAssetId, number> {
  return Object.fromEntries(allIds.map((id) => [id, 0])) as Record<FundAssetId, number>
}

function benchmarkWeights(): Record<FundAssetId, number> {
  return { ...BENCHMARK_WEIGHTS }
}

function equalWeights(): Record<FundAssetId, number> {
  const weight = 1 / STOCKS.length
  return Object.fromEntries(FUND_ASSETS.map((asset) => [asset.id, asset.id === 'es-fund' ? 0 : weight])) as Record<FundAssetId, number>
}

function defaultRisk(assetId: FundAssetId): string {
  if (assetId === 'nova-fund') return 'Rates / crowding'
  if (assetId === 'orbx-fund') return 'Binary catalyst / squeeze'
  if (assetId === 'luma-fund') return 'Liquidity / revisions'
  if (assetId === 'mega-fund') return 'Valuation / duration'
  if (assetId === 'heli-fund') return 'Regulation / defensives rotation'
  if (assetId === 'apex-fund') return 'Cyclical growth'
  return 'Residual market beta'
}

function autoView(mandate: FundSessionOptions['mandate'], assetId: FundAssetId, weight: number): FundPreMarketView {
  if (assetId === 'es-fund') return Math.abs(weight) > .005 ? 'hedge' : 'flat'
  if (mandate === 'long-short') return weight > .005 ? 'long' : weight < -.005 ? 'short' : 'flat'
  const benchmark = BENCHMARK_WEIGHTS[assetId]
  return weight > benchmark + .01 ? 'overweight' : weight < benchmark - .01 ? 'underweight' : 'neutral'
}

function weightRecordToInputs(weights: Record<FundAssetId, number>): Record<FundAssetId, string> {
  return Object.fromEntries(allIds.map((id) => [id, (weights[id] * 100).toFixed(1)])) as Record<FundAssetId, string>
}

export function FundPremarketSetup({ options, onOpenMarket, onBack }: Props) {
  const briefing = useMemo(() => createFundPremarketBriefing(options), [options])
  const defaultPreset: FundStartingPortfolio = options.mandate === 'long-only' ? 'benchmark' : 'model-book'
  const modelWeights = useMemo(() => {
    const weights = emptyWeights()
    weights['mega-fund'] = .15
    weights['heli-fund'] = .10
    weights['apex-fund'] = .08
    weights['nova-fund'] = -Math.min(.08, briefing.companies['nova-fund'].borrowCapacityWeight * .82)
    weights['luma-fund'] = -Math.min(.04, briefing.companies['luma-fund'].borrowCapacityWeight * .82)
    weights['orbx-fund'] = -Math.min(.025, briefing.companies['orbx-fund'].borrowCapacityWeight * .82)
    return weights
  }, [briefing])
  const initialWeights = options.mandate === 'long-only' ? benchmarkWeights() : modelWeights
  const [preset, setPreset] = useState<FundStartingPortfolio>(defaultPreset)
  const [weightInputs, setWeightInputs] = useState<Record<FundAssetId, string>>(() => weightRecordToInputs(initialWeights))
  const [selectedId, setSelectedId] = useState<FundAssetId>('mega-fund')
  const [views, setViews] = useState<Record<FundAssetId, FundPreMarketView>>(() => Object.fromEntries(allIds.map((id) => [id, autoView(options.mandate, id, initialWeights[id])])) as Record<FundAssetId, FundPreMarketView>)
  const [risks, setRisks] = useState<Record<FundAssetId, string>>(() => Object.fromEntries(allIds.map((id) => [id, defaultRisk(id)])) as Record<FundAssetId, string>)

  const weights = useMemo(() => Object.fromEntries(allIds.map((id) => [id, (Number(weightInputs[id]) || 0) / 100])) as Record<FundAssetId, number>, [weightInputs])
  const gross = FUND_ASSETS.reduce((sum, asset) => sum + Math.abs(weights[asset.id]), 0)
  const net = FUND_ASSETS.reduce((sum, asset) => sum + weights[asset.id], 0)
  const cash = 1 - net
  const beta = FUND_ASSETS.reduce((sum, asset) => sum + weights[asset.id] * asset.beta, 0)

  const errors = useMemo(() => {
    const items: string[] = []
    for (const asset of FUND_ASSETS) {
      const weight = weights[asset.id]
      if (options.mandate === 'long-only' && weight < -.0001) items.push(`${asset.symbol}: long-only portfolios cannot start short.`)
      if (Math.abs(weight) > asset.maxAbsWeight + .0005) items.push(`${asset.symbol}: ${(Math.abs(weight) * 100).toFixed(1)}% exceeds the ${(asset.maxAbsWeight * 100).toFixed(0)}% position limit.`)
      if (options.mandate === 'long-short' && asset.id !== 'es-fund' && weight < 0) {
        const capacity = briefing.companies[asset.id].borrowCapacityWeight
        if (Math.abs(weight) > capacity + .0005) items.push(`${asset.symbol}: requested short exceeds pre-market borrow capacity of ${(capacity * 100).toFixed(1)}% NAV.`)
      }
    }
    if (options.mandate === 'long-only' && net > 1.0005) items.push(`Portfolio totals ${(net * 100).toFixed(1)}%; long-only invested weight cannot exceed 100%.`)
    if (options.mandate === 'long-short' && gross > 2.0005) items.push(`Gross exposure ${(gross * 100).toFixed(0)}% exceeds the 200% mandate limit.`)
    if (options.mandate === 'long-short' && Math.abs(net) > .8505) items.push(`Net exposure ${(net * 100).toFixed(0)}% exceeds the ±85% mandate limit.`)
    return items
  }, [briefing, gross, net, options.mandate, weights])

  const applyPreset = (next: FundStartingPortfolio) => {
    setPreset(next)
    let nextWeights = emptyWeights()
    if (next === 'benchmark') nextWeights = benchmarkWeights()
    else if (next === 'equal-weight') nextWeights = equalWeights()
    else if (next === 'model-book') nextWeights = modelWeights
    setWeightInputs(weightRecordToInputs(nextWeights))
    setViews(Object.fromEntries(allIds.map((id) => [id, autoView(options.mandate, id, nextWeights[id])])) as Record<FundAssetId, FundPreMarketView>)
  }

  const updateWeight = (assetId: FundAssetId, value: string) => {
    setPreset('custom')
    setWeightInputs((current) => ({ ...current, [assetId]: value }))
    const numeric = (Number(value) || 0) / 100
    setViews((current) => ({ ...current, [assetId]: autoView(options.mandate, assetId, numeric) }))
  }

  const openMarket = () => {
    if (errors.length) return
    const locates: Partial<Record<FundAssetId, FundLocate>> = {}
    for (const asset of FUND_ASSETS) {
      const weight = weights[asset.id]
      if (asset.id !== 'es-fund' && weight < 0) {
        const company = briefing.companies[asset.id]
        locates[asset.id] = { assetId: asset.id, requestedWeight: weight, approvedShortWeight: company.borrowCapacityWeight, borrowRatePct: company.indicativeBorrowRatePct, status: 'approved', timestamp: 0 }
      }
    }
    const plan = Object.fromEntries(allIds.map((id) => [id, { view: views[id], plannedWeight: weights[id], keyRisk: risks[id] } satisfies FundPreMarketPlanItem])) as Record<FundAssetId, FundPreMarketPlanItem>
    onOpenMarket({ ...options, startingPortfolio: preset, initialWeights: weights, initialLocates: locates, preMarketPlan: plan, preMarketBriefing: briefing })
  }

  const selected = FUND_ASSET_MAP[selectedId]
  const company = briefing.companies[selectedId]
  const research = company.research
  const nextCatalyst = company.knownCatalyst
  const viewOptions: FundPreMarketView[] = options.mandate === 'long-short' ? ['long', 'flat', 'short', 'hedge'] : ['overweight', 'neutral', 'underweight']

  return <main className="premarket-shell">
    <header className="premarket-header">
      <div><p className="eyebrow">PRE-MARKET · MARKETS FROZEN</p><h1>{options.mandate === 'long-short' ? 'Hedge Fund Morning Meeting' : 'Asset Management Morning Briefing'}</h1><p>Review the information set, inherit or build the opening portfolio, then start the live clock. No transaction cost is charged on starting holdings.</p></div>
      <div className="premarket-header-actions"><button className="button button-ghost" onClick={onBack}>Back</button><span className="status-chip status-warning">Clock not started</span></div>
    </header>

    <section className="premarket-overview">
      {briefing.marketOverview.map((line) => <article key={line}><span>OVERNIGHT</span><strong>{line}</strong></article>)}
      {options.difficulty === 'learning' && <article className="learning-brief"><span>LEARNING READ</span><strong>{FUND_SCENARIOS[briefing.resolvedScenario].label}</strong><small>The underlying regime is hidden in Standard, Advanced and Assessment.</small></article>}
    </section>

    <div className="premarket-grid">
      <section className="premarket-panel premarket-research-panel">
        <div className="section-heading"><div><p className="eyebrow">COMPANY INFORMATION</p><h2>Morning research pack</h2></div><span className="status-chip">Known before open</span></div>
        <div className="premarket-company-tabs">{FUND_ASSETS.map((asset) => <button key={asset.id} className={selectedId === asset.id ? 'selected' : ''} onClick={() => setSelectedId(asset.id)}><b>{asset.symbol}</b><small>{companyLabel(asset.id)}</small></button>)}</div>
        <article className="company-brief-card">
          <div className="company-brief-title"><div><strong>{selected.symbol}</strong><span>{selected.displayName} · {selected.sector}</span></div><b className={company.preMarketChangePct >= 0 ? 'positive' : 'negative'}>{company.preMarketChangePct >= 0 ? '+' : ''}{company.preMarketChangePct.toFixed(1)}% pre-market</b></div>
          <p>{company.overnightHeadline}</p>
          <div className="company-stat-grid">
            <span><small>Prev close</small><strong>{company.previousClose.toFixed(selected.priceDecimals)}</strong></span>
            <span><small>Forward P/E</small><strong>{research.forwardPe ? `${research.forwardPe.toFixed(1)}x` : 'n/m'}</strong></span>
            <span><small>EPS revisions</small><strong className={research.earningsRevisionPct >= 0 ? 'positive' : 'negative'}>{research.earningsRevisionPct >= 0 ? '+' : ''}{research.earningsRevisionPct.toFixed(1)}%</strong></span>
            <span><small>Consensus growth</small><strong>{research.consensusGrowthPct.toFixed(1)}%</strong></span>
            <span><small>20d momentum</small><strong className={research.momentumPct >= 0 ? 'positive' : 'negative'}>{research.momentumPct >= 0 ? '+' : ''}{research.momentumPct.toFixed(1)}%</strong></span>
            <span><small>Beta-rel relative</small><strong className={research.sectorRelativePct >= 0 ? 'positive' : 'negative'}>{research.sectorRelativePct >= 0 ? '+' : ''}{research.sectorRelativePct.toFixed(1)}%</strong></span>
            <span><small>Short interest</small><strong>{research.shortInterestPct.toFixed(1)}%</strong></span>
            <span><small>Quality</small><strong>{research.qualityScore}/100</strong></span>
            <span><small>Crowding</small><strong>{research.crowding > .2 ? 'Short-heavy' : research.crowding < -.2 ? 'Long-heavy' : 'Balanced'}</strong></span>
            <span><small>Borrow</small><strong>{selectedId === 'es-fund' ? 'n/a' : `${company.indicativeBorrowRatePct.toFixed(1)}%`}</strong></span>
            <span><small>Borrow capacity</small><strong>{selectedId === 'es-fund' ? 'Index future' : formatPercent(company.borrowCapacityWeight, 1)}</strong></span>
            <span><small>Benchmark wt</small><strong>{formatPercent(company.benchmarkWeight, 1)}</strong></span>
          </div>
          <div className="known-catalyst"><span>KNOWN CATALYST</span>{nextCatalyst ? <><strong>{nextCatalyst.title}</strong><small>Due about {formatTime(nextCatalyst.releaseAtSeconds)} after open · outcome unknown</small><p>{nextCatalyst.detail}</p>{nextCatalyst.earningsMetrics?.length ? <div className="premarket-earnings-grid"><div><b>Metric</b><b>Prior</b><b>Consensus</b></div>{nextCatalyst.earningsMetrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><span>{metric.prior}{metric.unit}</span><strong>{metric.consensus}{metric.unit}</strong></div>)}</div> : null}</> : <><strong>No scheduled single-name catalyst</strong><small>Unscheduled news can still arrive.</small></>}</div>
        </article>
      </section>

      <section className="premarket-panel premarket-book-panel">
        <div className="section-heading"><div><p className="eyebrow">OPENING BOOK</p><h2>Choose what you inherit</h2></div><span className="status-chip">$100m NAV</span></div>
        <div className="portfolio-preset-grid">
          {options.mandate === 'long-only' ? <>
            <button className={preset === 'benchmark' ? 'selected' : ''} onClick={() => applyPreset('benchmark')}><strong>Start at benchmark</strong><small>Default · active decisions begin from neutral weights.</small></button>
            <button className={preset === 'equal-weight' ? 'selected' : ''} onClick={() => applyPreset('equal-weight')}><strong>Equal weight</strong><small>{(100 / STOCKS.length).toFixed(1)}% in each stock, no ES hedge.</small></button>
            <button className={preset === 'custom' ? 'selected' : ''} onClick={() => applyPreset('custom')}><strong>Build my portfolio</strong><small>Type every opening weight yourself.</small></button>
          </> : <>
            <button className={preset === 'model-book' ? 'selected' : ''} onClick={() => applyPreset('model-book')}><strong>Inherit model book</strong><small>Balanced starter long/short book with borrow already checked.</small></button>
            <button className={preset === 'flat' ? 'selected' : ''} onClick={() => applyPreset('flat')}><strong>Start flat</strong><small>100% cash and build the book after the open.</small></button>
            <button className={preset === 'custom' ? 'selected' : ''} onClick={() => applyPreset('custom')}><strong>Build my book</strong><small>Set longs, shorts and optional ES hedge before open.</small></button>
          </>}
        </div>

        <div className="opening-book-head"><span>Asset</span><span>Start wt</span><span>Initial view</span><span>Key risk</span><span>Borrow</span></div>
        <div className="opening-book-rows">{FUND_ASSETS.map((asset) => {
          const w = weights[asset.id]
          const companyBrief = briefing.companies[asset.id]
          const borrowOk = asset.id === 'es-fund' || w >= 0 || Math.abs(w) <= companyBrief.borrowCapacityWeight + .0005
          return <div key={asset.id} className={!borrowOk ? 'row-error' : ''}>
            <span><b>{asset.symbol}</b><small>{asset.sector}</small></span>
            <label><input type="number" step="0.5" value={weightInputs[asset.id]} onChange={(event) => updateWeight(asset.id, event.target.value)} /><i>%</i></label>
            <select value={views[asset.id]} onChange={(event) => setViews((current) => ({ ...current, [asset.id]: event.target.value as FundPreMarketView }))}>{viewOptions.concat(asset.id === 'es-fund' && !viewOptions.includes('hedge') ? ['hedge'] : []).filter((v, i, arr) => arr.indexOf(v) === i).map((view) => <option key={view} value={view}>{view.replace('-', ' ')}</option>)}</select>
            <input className="risk-input" value={risks[asset.id]} onChange={(event) => setRisks((current) => ({ ...current, [asset.id]: event.target.value }))} />
            <span className={borrowOk ? '' : 'negative'}>{asset.id === 'es-fund' ? 'n/a' : w < 0 ? borrowOk ? `Located ${(companyBrief.borrowCapacityWeight * 100).toFixed(1)}%` : `Max ${(companyBrief.borrowCapacityWeight * 100).toFixed(1)}%` : `${companyBrief.indicativeBorrowRatePct.toFixed(1)}%`}</span>
          </div>
        })}</div>

        <div className="opening-risk-strip"><span><small>Gross</small><strong>{formatPercent(gross, 1)}</strong></span><span><small>Net</small><strong>{formatPercent(net, 1)}</strong></span><span><small>Cash</small><strong>{formatPercent(cash, 1)}</strong></span><span><small>Beta</small><strong>{beta >= 0 ? '+' : ''}{beta.toFixed(2)}</strong></span></div>
        {errors.length > 0 && <div className="premarket-errors"><strong>Opening book needs attention</strong>{errors.slice(0, 5).map((error) => <p key={error}>{error}</p>)}</div>}
        <div className="premarket-open-actions"><div><strong>Opening holdings are inherited, not executed.</strong><span>Transaction cost and turnover start only after you press Open Market.</span></div><button className="button button-primary" disabled={errors.length > 0} onClick={openMarket}>Open market · {formatTime(options.durationSeconds)}</button></div>
      </section>
    </div>
  </main>
}

function companyLabel(id: FundAssetId): string {
  if (id === 'es-fund') return 'hedge'
  const asset = FUND_ASSET_MAP[id]
  return asset.hardToBorrow ? 'HTB' : asset.sector
}
