import { useMemo, useState } from 'react'
import { FUND_ASSETS, FUND_ASSET_MAP, FUND_SCENARIOS } from '../engine/fund'
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

type SizingMode = 'notional' | 'weight'
const thesisTags: FundThesisTag[] = ['earnings', 'valuation', 'catalyst', 'quality', 'momentum', 'relative-value', 'short-thesis', 'risk-hedge']
const horizons: FundHorizon[] = ['intraday', 'days', 'weeks']

function weightOf(snapshot: FundSessionSnapshot, assetId: FundAssetId): number {
  return snapshot.nav ? snapshot.positions[assetId].units * snapshot.prices[assetId] / snapshot.nav : 0
}
function signed(value: number, digits = 1): string { return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%` }
function clock(seconds: number): string { return formatTime(Math.max(0, seconds)) }
function priceText(id: FundAssetId, value: number): string { return value.toFixed(FUND_ASSET_MAP[id].priceDecimals) }
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
  const [sizingMode, setSizingMode] = useState<SizingMode>('notional')
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy')
  const [tradeNotionalM, setTradeNotionalM] = useState('5')
  const [targetWeightInput, setTargetWeightInput] = useState('5')
  const [recordThesis, setRecordThesis] = useState(false)
  const [tag, setTag] = useState<FundThesisTag>('earnings')
  const [horizon, setHorizon] = useState<FundHorizon>('days')
  const [conviction, setConviction] = useState(3)
  const [invalidation, setInvalidation] = useState('')
  const [workDuration, setWorkDuration] = useState(45)
  const [dealerCustomFillM, setDealerCustomFillM] = useState<Record<string, string>>({})
  const [eventReflection, setEventReflection] = useState('')
  const [reflectionCount, setReflectionCount] = useState(0)

  const asset = FUND_ASSET_MAP[selectedId]
  const research = snapshot.research[selectedId]
  const currentWeight = weightOf(snapshot, selectedId)
  const notionalM = Math.max(0, Number(tradeNotionalM) || 0)
  const targetFromNotional = currentWeight + (tradeDirection === 'buy' ? 1 : -1) * notionalM * 1_000_000 / Math.max(1, snapshot.nav)
  const rawTarget = sizingMode === 'notional' ? targetFromNotional : (Number(targetWeightInput) || 0) / 100
  const targetWeight = snapshot.options.mandate === 'long-only' ? Math.max(0, rawTarget) : rawTarget
  const targetDelta = targetWeight - currentWeight
  const canTrade = Math.abs(targetDelta) > .0001
  const requiresLocate = snapshot.options.mandate === 'long-short' && selectedId !== 'es-fund' && targetWeight < 0
  const locate = snapshot.locates[selectedId]
  const locateSufficient = !requiresLocate || Boolean(locate && locate.status !== 'rejected' && locate.approvedShortWeight + .0005 >= Math.abs(targetWeight))
  const intent: FundTradeIntent = { assetId: selectedId, targetWeight, recordThesis, tag, horizon, conviction, invalidation }
  const sessionReturn = snapshot.nav / snapshot.options.initialNav - 1
  const benchmarkReturn = snapshot.benchmarkNav / snapshot.options.initialNav - 1
  const alphaReturn = snapshot.options.mandate === 'long-only' ? sessionReturn - benchmarkReturn : snapshot.attribution.alphaPnl / snapshot.options.initialNav
  const activeWorking = snapshot.workingOrders.filter((order) => order.status === 'working' || order.status === 'paused')
  const upcoming = snapshot.calendar.filter((event) => !event.revealed).slice(0, 4)
  const sectorExposure = Object.entries(FUND_ASSETS.filter((item) => item.id !== 'es-fund').reduce<Record<string, { gross: number; net: number }>>((acc, item) => { const w = weightOf(snapshot, item.id); const current = acc[item.sector] ?? { gross: 0, net: 0 }; current.gross += Math.abs(w); current.net += w; acc[item.sector] = current; return acc }, {})).sort((a, b) => b[1].gross - a[1].gross)
  const selectedEarnings = snapshot.calendar.find((event) => event.assetId === selectedId && event.type === 'earnings')
  const reflectionHeadline = snapshot.headlines.find((item) => item.severity === 'critical' || item.severity === 'warning') ?? snapshot.headlines[0]
  const history = snapshot.history.map((point) => point.prices[selectedId])
  const chartPath = useMemo(() => {
    if (history.length < 2) return ''
    const min = Math.min(...history); const max = Math.max(...history); const range = Math.max(.0001, max - min)
    return history.map((value, index) => `${index === 0 ? 'M' : 'L'} ${(index / (history.length - 1) * 100).toFixed(2)} ${(88 - (value - min) / range * 68).toFixed(2)}`).join(' ')
  }, [history])

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

    <section className="fund-context-strip">
      <div><b>MARKET MICROSTRUCTURE</b><span><strong>{phaseText(snapshot.marketPhase)}</strong></span><span>Execution cost {snapshot.liquidityCostMultiplier.toFixed(2)}x</span><span>Volatility {snapshot.volatilityMultiplier.toFixed(2)}x</span></div>
      <div><b>CATALYST CALENDAR</b>{upcoming.map((event) => <span key={event.id}><strong>{clock(event.releaseAtSeconds - snapshot.elapsedSeconds)}</strong> {event.assetId ? FUND_ASSET_MAP[event.assetId].symbol : 'MACRO'} {event.title}</span>)}</div>
      <div><b>FACTOR RISK</b>{Object.entries(snapshot.risk.factorExposure).map(([key, value]) => <span key={key} className={Math.abs(value) > .25 ? 'risk-hot' : ''}>{key} {value >= 0 ? '+' : ''}{value.toFixed(2)}</span>)}</div>
      {snapshot.options.difficulty === 'learning' && <div><b>LEARNING REGIME</b><span>{FUND_SCENARIOS[snapshot.resolvedScenario].label}</span><span>{snapshot.marketContext.correlationRegime.replace('-', ' ')}</span><span>{asset.symbol} crowding {snapshot.marketContext.crowding[selectedId] > .15 ? 'short-heavy' : snapshot.marketContext.crowding[selectedId] < -.15 ? 'long-heavy' : 'balanced'}</span></div>}
    </section>

    <div className="fund-terminal-grid">
      <section className="fund-panel fund-trade-column">
        <div className="fund-panel-title"><div><p className="eyebrow">MARKET WATCH</p><h2>Single-name &amp; hedge universe</h2></div><span>Click to trade</span></div>
        <div className="fund-watch-head"><span>Asset</span><span>Price</span><span>Move</span><span>Weight</span><span>P&amp;L</span></div>
        <div className="fund-watch-list">{FUND_ASSETS.map((item) => {
          const move = snapshot.previousPrices[item.id] ? snapshot.prices[item.id] / snapshot.previousPrices[item.id] - 1 : 0
          const weight = weightOf(snapshot, item.id); const pnl = snapshot.attribution.byAsset[item.id]
          return <button key={item.id} className={selectedId === item.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}><span><b>{item.symbol}</b><small>{item.sector}{item.hardToBorrow ? ' · HTB' : ''}</small></span><strong>{priceText(item.id, snapshot.prices[item.id])}</strong><span className={move >= 0 ? 'positive' : 'negative'}>{signed(move, 2)}</span><span className={weight >= 0 ? 'positive' : 'negative'}>{signed(weight)}</span><span className={pnl >= 0 ? 'positive' : 'negative'}>{formatMoney(pnl)}</span></button>
        })}</div>

        <div className="fund-ticket">
          <div className="panel-heading-inline"><span>TRADE · {asset.symbol}</span><small>{asset.displayName}</small></div>
          <div className="fund-ticket-metrics"><div><span>Current</span><strong>{signed(currentWeight)}</strong></div><div><span>Beta</span><strong>{asset.beta.toFixed(2)}</strong></div><div><span>Borrow</span><strong>{selectedId === 'es-fund' ? 'n/a' : `${(locate?.borrowRatePct ?? asset.borrowRatePct).toFixed(1)}%`}</strong></div><div><span>Max position</span><strong>{formatPercent(asset.maxAbsWeight)}</strong></div></div>
          <div className="sizing-mode-toggle"><button className={sizingMode === 'notional' ? 'active' : ''} onClick={() => setSizingMode('notional')}>Trade amount</button><button className={sizingMode === 'weight' ? 'active' : ''} onClick={() => setSizingMode('weight')}>Target weight</button></div>
          {sizingMode === 'notional' ? <>
            <div className="fund-direction-row"><button className={tradeDirection === 'buy' ? 'buy active' : 'buy'} onClick={() => setTradeDirection('buy')}>BUY / COVER</button><button className={tradeDirection === 'sell' ? 'sell active' : 'sell'} onClick={() => setTradeDirection('sell')}>{snapshot.options.mandate === 'long-only' ? 'SELL / REDUCE' : 'SELL / SHORT'}</button></div>
            <label className="fund-notional-input"><span>Trade notional</span><div><b>$</b><input type="number" min="0" step="0.25" value={tradeNotionalM} onChange={(event) => setTradeNotionalM(event.target.value)} /><em>m</em></div></label>
            <div className="fund-quick-buttons">{[1, 2.5, 5, 10].map((value) => <button key={value} onClick={() => setTradeNotionalM(String(value))}>${value}m</button>)}</div>
            <p className="fund-target-preview">Resulting target: <strong>{signed(targetWeight)}</strong> · delta {signed(targetDelta)}</p>
          </> : <>
            <label className="fund-weight-input"><span>Target NAV weight</span><div><input type="number" step="0.5" value={targetWeightInput} onChange={(event) => setTargetWeightInput(event.target.value)} /><em>%</em></div></label>
            <div className="fund-quick-buttons">{(snapshot.options.mandate === 'long-short' ? [-15, -10, -5, 0, 5, 10, 15] : [0, 2.5, 5, 10, 15, 20]).map((value) => <button key={value} onClick={() => setTargetWeightInput(String(value))}>{value === 0 ? 'Flat' : `${value > 0 ? '+' : ''}${value}%`}</button>)}</div>
          </>}

          {requiresLocate && <div className={`fund-locate-box ${locate?.status ?? 'none'}`}><div><span>SHORT LOCATE</span><strong>{locate ? `${locate.status.toUpperCase()} · ${(locate.approvedShortWeight * 100).toFixed(1)}% NAV` : 'REQUIRED'}</strong><small>{asset.hardToBorrow ? 'Hard-to-borrow security. Capacity and rate can change.' : 'Borrow required before establishing the short.'}</small></div><button type="button" onClick={() => props.onRequestLocate(selectedId, targetWeight)}>Request locate</button></div>}

          <label className="fund-thesis-switch"><input type="checkbox" checked={recordThesis} onChange={(event) => setRecordThesis(event.target.checked)} /><span>Record thesis with this trade</span></label>
          {recordThesis && <div className="fund-thesis-fields"><select value={tag} onChange={(event) => setTag(event.target.value as FundThesisTag)}>{thesisTags.map((item) => <option key={item}>{item}</option>)}</select><select value={horizon} onChange={(event) => setHorizon(event.target.value as FundHorizon)}>{horizons.map((item) => <option key={item}>{item}</option>)}</select><select value={conviction} onChange={(event) => setConviction(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item} / 5</option>)}</select><input value={invalidation} onChange={(event) => setInvalidation(event.target.value)} placeholder="What invalidates the view?" /></div>}

          {props.feedback && <div className="fund-feedback">{props.feedback}</div>}
          <div className="fund-execution-routes"><button disabled={!canTrade || !locateSufficient} className="primary" onClick={submitDirect}>Direct market</button>{(snapshot.marketPhase === 'opening-auction' || snapshot.marketPhase === 'closing-auction') && selectedId !== 'es-fund' && <button disabled={!canTrade || !locateSufficient} className="auction-route" onClick={submitAuction}>{snapshot.marketPhase === 'opening-auction' ? 'Opening auction' : 'MOC / closing auction'}</button>}<button disabled={!canTrade || !locateSufficient} onClick={() => requestQuotes(3)}>RFQ 3 dealers</button><button disabled={!canTrade || !locateSufficient} onClick={() => requestQuotes(5)}>RFQ 5 dealers</button><button disabled={!canTrade || !locateSufficient} onClick={() => startWorked('liquidity-sensitive')}>Work order</button></div>
          <div className="fund-work-row"><span>Work duration</span><select value={workDuration} onChange={(event) => setWorkDuration(Number(event.target.value))}><option value={30}>30 sec</option><option value={45}>45 sec</option><option value={60}>60 sec</option><option value={90}>90 sec</option></select><button disabled={!canTrade || !locateSufficient} onClick={() => startWorked('twap')}>TWAP</button>{snapshot.options.mandate === 'long-short' && !assessment && <button className="beta-hedge" onClick={props.onHedgeBeta}>Hedge portfolio beta with ES</button>}</div>
          {assessment && snapshot.options.mandate === 'long-short' && <p className="assessment-note">Assessment: no one-click beta hedge. Use the ES ticket manually if you want to neutralise market beta.</p>}
        </div>
      </section>

      <section className="fund-panel fund-portfolio-column">
        <div className="fund-panel-title"><div><p className="eyebrow">PORTFOLIO</p><h2>{asset.symbol} path &amp; institutional risk</h2></div><span>{asset.sector}</span></div>
        <div className="fund-price-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="88" x2="100" y2="88" /><path d={chartPath} /></svg><div><span>Start</span><strong>{priceText(selectedId, snapshot.prices[selectedId])}</strong><span>Now</span></div></div>
        <div className="fund-risk-cards"><div><span>Risk util.</span><strong>{formatPercent(snapshot.risk.riskUtilisation)}</strong></div><div><span>Concentration</span><strong>{formatPercent(snapshot.risk.concentration)}</strong></div><div><span>Turnover</span><strong>{formatPercent(snapshot.turnover)}</strong></div><div><span>Exec IS</span><strong>{snapshot.executionQuality.totalNotional ? `${snapshot.executionQuality.implementationShortfallBps.toFixed(1)}bp` : '—'}</strong></div><div><span>Borrow costs</span><strong>{formatMoney(snapshot.borrowCosts)}</strong></div></div>
        <div className="fund-position-table"><div className="fund-position-head"><span>Position</span><span>Weight</span><span>Beta contrib.</span><span>P&amp;L</span></div>{FUND_ASSETS.filter((item) => Math.abs(weightOf(snapshot, item.id)) > .001).map((item) => { const weight = weightOf(snapshot, item.id); return <div className="fund-position-row" key={item.id}><span><b>{item.symbol}</b><small>{item.sector}</small></span><strong className={weight >= 0 ? 'positive' : 'negative'}>{signed(weight)}</strong><span>{(weight * item.beta) >= 0 ? '+' : ''}{(weight * item.beta).toFixed(2)}</span><span className={snapshot.attribution.byAsset[item.id] >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.byAsset[item.id])}</span></div>})}{snapshot.risk.grossExposure < .001 && <div className="fund-empty-position">Portfolio is currently all cash.</div>}</div>
        <div className="fund-factor-bars">{Object.entries(snapshot.risk.factorExposure).map(([factor, value]) => <div key={factor}><span>{factor}</span><div><i className={value >= 0 ? 'positive-bar' : 'negative-bar'} style={{ width: `${Math.min(100, Math.abs(value) / .8 * 100)}%` }} /></div><strong>{value >= 0 ? '+' : ''}{value.toFixed(2)}</strong></div>)}</div>

        <div className="desk-risk-section"><div className="panel-heading-inline"><span>STRESS TESTS</span><small>Instant synthetic shocks</small></div><div className="stress-test-grid">{snapshot.stressTests.map((stress) => <article key={stress.id}><span>{stress.label}</span><strong className={stress.pnl >= 0 ? 'positive' : 'negative'}>{formatMoney(stress.pnl)}</strong><small>{signed(stress.pnlPct, 2)} NAV</small><p>{stress.detail}</p></article>)}</div></div>

        <div className="sector-risk-panel"><div className="panel-heading-inline"><span>SECTOR GROSS / NET</span><small>Look-through concentration</small></div><div className="sector-risk-grid">{sectorExposure.slice(0, 6).map(([sector, exposure]) => <span key={sector}><small>{sector}</small><strong>{formatPercent(exposure.gross, 0)} / {signed(exposure.net, 0)}</strong></span>)}</div></div><div className="pnl-explain-panel"><div className="panel-heading-inline"><span>P&amp;L EXPLAIN</span><small>What is driving today?</small></div><div className="pnl-explain-grid"><span><small>Market beta</small><strong className={snapshot.attribution.betaPnl >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.betaPnl)}</strong></span><span><small>Residual alpha</small><strong className={snapshot.attribution.alphaPnl >= 0 ? 'positive' : 'negative'}>{formatMoney(snapshot.attribution.alphaPnl)}</strong></span><span><small>Execution costs</small><strong className="negative">-{formatMoney(snapshot.transactionCosts)}</strong></span><span><small>Borrow costs</small><strong className="negative">-{formatMoney(snapshot.borrowCosts)}</strong></span></div></div>
      </section>

      <section className="fund-panel fund-info-column">
        <div className="fund-research-panel">
          <div className="fund-panel-title"><div><p className="eyebrow">RESEARCH SNAPSHOT</p><h2>{asset.symbol} evidence set</h2></div><span>{snapshot.marketContext.correlationRegime.replace('-', ' ')}</span></div>
          <div className="fund-research-grid">
            <div><span>Forward P/E</span><strong>{research.forwardPe > 0 ? `${research.forwardPe.toFixed(1)}x` : 'n/m'}</strong></div>
            <div><span>EPS revisions</span><strong className={research.earningsRevisionPct >= 0 ? 'positive' : 'negative'}>{research.earningsRevisionPct >= 0 ? '+' : ''}{research.earningsRevisionPct.toFixed(1)}%</strong></div>
            <div><span>Consensus growth</span><strong>{research.consensusGrowthPct.toFixed(1)}%</strong></div>
            <div><span>Short interest</span><strong className={research.shortInterestPct > 12 ? 'amber' : ''}>{research.shortInterestPct.toFixed(1)}%</strong></div>
            <div><span>Momentum</span><strong className={research.momentumPct >= 0 ? 'positive' : 'negative'}>{research.momentumPct >= 0 ? '+' : ''}{research.momentumPct.toFixed(1)}%</strong></div>
            <div><span>Beta-adjusted rel.</span><strong className={research.sectorRelativePct >= 0 ? 'positive' : 'negative'}>{research.sectorRelativePct >= 0 ? '+' : ''}{research.sectorRelativePct.toFixed(1)}%</strong></div>
            <div><span>Quality</span><strong>{research.qualityScore.toFixed(0)}/100</strong></div>
            <div><span>Crowding</span><strong>{research.crowding > .2 ? 'Short-heavy' : research.crowding < -.2 ? 'Long-heavy' : 'Balanced'}</strong></div>
          </div>
          {snapshot.calendar.find((event) => !event.revealed && event.assetId === selectedId) && (() => { const event = snapshot.calendar.find((item) => !item.revealed && item.assetId === selectedId)!; return <p className="fund-research-next"><b>Next catalyst:</b> {event.title} in {clock(event.releaseAtSeconds - snapshot.elapsedSeconds)}{event.stageLabel ? ` · ${event.stageLabel}` : ''}</p> })()}
          {selectedEarnings?.earningsMetrics?.length ? <div className="earnings-table"><div className="earnings-head"><span>{selectedEarnings.revealed ? 'EARNINGS RELEASE' : 'EARNINGS CONSENSUS'}</span><small>{selectedEarnings.revealed ? 'Actual vs consensus' : `Due in ${clock(selectedEarnings.releaseAtSeconds - snapshot.elapsedSeconds)}`}</small></div><div className="earnings-row earnings-labels"><span>Metric</span><span>Prior</span><span>Consensus</span><span>{selectedEarnings.revealed ? 'Actual' : 'Actual'}</span></div>{selectedEarnings.earningsMetrics.map((metric) => <div className="earnings-row" key={metric.label}><span>{metric.label}</span><span>{metric.prior}{metric.unit}</span><span>{metric.consensus}{metric.unit}</span><strong className={selectedEarnings.revealed ? (metric.actual >= metric.consensus ? 'positive' : 'negative') : 'earnings-hidden'}>{selectedEarnings.revealed ? `${metric.actual}${metric.unit}` : 'HIDDEN'}</strong></div>)}</div> : null}
        </div>

        <div className="risk-manager-panel"><div className="panel-heading-inline"><span>PM / RISK OVERSIGHT</span><small>{snapshot.riskManagerMessages.length} checks</small></div>{snapshot.riskManagerMessages.slice(0, 4).map((message) => <article key={message.id} className={message.severity}><div><strong>{message.title}</strong><span>{clock(message.timestamp)}</span></div><p>{message.detail}</p></article>)}</div>

        <div className="sales-colour-panel"><div className="panel-heading-inline"><span>SALES / DEALER COLOUR</span><small>Information, not truth</small></div>{snapshot.salesColour.length === 0 ? <p className="muted-line">No fresh sales-trader colour. Dealer messages appear as institutional flow develops.</p> : snapshot.salesColour.slice(0, 5).map((colour) => <article key={colour.id}><div><strong>{colour.dealerName} · {FUND_ASSET_MAP[colour.assetId].symbol}</strong><span>{colour.bias}</span></div><p>{colour.message}</p>{snapshot.options.difficulty === 'learning' && <small>Learning estimate: reliability {(colour.reliability * 100).toFixed(0)}%</small>}</article>)}</div>
        {(snapshot.options.difficulty === 'advanced' || assessment) && reflectionHeadline && <div className="decision-reflection-panel"><div className="panel-heading-inline"><span>EVENT REASONING</span><small>{reflectionCount} recorded</small></div><strong>{reflectionHeadline.title}</strong><p>What changed, which exposure is most affected, and what would invalidate your current response?</p><textarea value={eventReflection} onChange={(event) => setEventReflection(event.target.value)} placeholder="State the market implication in 1–3 sentences…" /><button disabled={eventReflection.trim().length < 8} onClick={() => { setReflectionCount((count) => count + 1); setEventReflection('') }}>Record reflection</button></div>}

        <div className="fund-info-news"><div className="fund-panel-title"><div><p className="eyebrow">INFORMATION SET</p><h2>News &amp; catalysts</h2></div><span>Newest first</span></div><div className="fund-news-list">{snapshot.headlines.slice(0, 10).map((item) => <article key={item.id} className={item.severity}><div><span>{clock(item.timestamp)}</span><strong>{item.assetId ? FUND_ASSET_MAP[item.assetId].symbol : 'MACRO'} · {item.title}</strong></div><p>{item.detail}</p></article>)}</div></div>

        {snapshot.activeDealerRfq && (() => { const rfq = snapshot.activeDealerRfq; const rfqAsset = FUND_ASSET_MAP[rfq.assetId]; return <div className="fund-dealer-rfq"><div className="panel-heading-inline"><span>LIVE DEALER RFQ · {rfqAsset.symbol}</span><button onClick={props.onCancelDealerRfq}>Cancel</button></div><p>{rfq.side.toUpperCase()} ${(rfq.requestedNotional / 1_000_000).toFixed(2)}m · direct benchmark {rfq.directBenchmarkPrice.toFixed(rfqAsset.priceDecimals)}</p>{rfq.quotes.map((quote) => { const executable = rfq.side === 'buy' ? quote.offer : quote.bid; const maxFraction = Math.min(1, quote.maxNotional / rfq.requestedNotional); const capacityM = quote.maxNotional / 1_000_000; const customM = Number(dealerCustomFillM[quote.id] ?? ''); const customFraction = customM > 0 ? Math.min(maxFraction, customM * 1_000_000 / rfq.requestedNotional) : 0; const fill = (fraction: number) => { const actual = Math.min(fraction, maxFraction); const result = props.onAcceptDealerQuote(quote.id, actual); if (result?.accepted && sizingMode === 'notional') { const remaining = rfq.requestedNotional * Math.max(0, 1 - actual) / 1_000_000; setTradeDirection(rfq.side); setTradeNotionalM(remaining >= .05 ? remaining.toFixed(2) : '') } }; const relationship = snapshot.dealerRelationships[quote.dealerId]; return <article key={quote.id} className="fund-dealer-quote"><div><b>{quote.dealerName}</b><span>{quote.colour}</span></div><strong>{quote.bid.toFixed(rfqAsset.priceDecimals)} / {quote.offer.toFixed(rfqAsset.priceDecimals)}</strong><small>Firm ${capacityM.toFixed(2)}m · executable {executable.toFixed(rfqAsset.priceDecimals)} · relationship {relationship.relationshipScore.toFixed(0)}/100</small><div className="fund-dealer-fill-row"><button onClick={() => fill(.25)}>25%</button><button onClick={() => fill(.5)}>50%</button><button onClick={() => fill(.75)}>75%</button><button className="primary" onClick={() => fill(maxFraction)}>Fill max</button></div><div className="fund-custom-fill"><input type="number" min="0" step=".25" placeholder={capacityM.toFixed(2)} value={dealerCustomFillM[quote.id] ?? ''} onChange={(event) => setDealerCustomFillM((current) => ({ ...current, [quote.id]: event.target.value }))} /><span>$m</span><button disabled={!customFraction} onClick={() => fill(customFraction)}>Custom</button></div></article>})}</div> })()}

        <div className="fund-working-panel"><div className="panel-heading-inline"><span>Working orders</span><small>{activeWorking.length} active</small></div>{activeWorking.length === 0 ? <p className="muted-line">No live worked execution.</p> : activeWorking.map((order) => <article key={order.id} className="fund-working-order"><div><b>{FUND_ASSET_MAP[order.assetId].symbol} · {order.side.toUpperCase()}</b><span>{order.style}</span></div><div className="fund-work-progress"><i style={{ width: `${Math.min(100, order.executedNotional / Math.max(1, order.totalNotional) * 100)}%` }} /></div><p>{formatMoney(order.executedNotional)} done · {formatMoney(order.remainingNotional)} left</p><footer>{order.status === 'paused' ? <button onClick={() => props.onResumeWorkingOrder(order.id)}>Resume</button> : <button onClick={() => props.onPauseWorkingOrder(order.id)}>Pause</button>}<button onClick={() => props.onCrossWorkingOrder(order.id)}>Cross rest</button><button onClick={() => props.onCancelWorkingOrder(order.id)}>Cancel</button></footer></article>)}</div>

        <div className="fund-journal"><div className="panel-heading-inline"><span>Thesis journal</span><small>{snapshot.theses.length} recorded</small></div>{snapshot.theses.length === 0 ? <p className="muted-line">Optional rationales for conviction positions appear here.</p> : snapshot.theses.slice().reverse().slice(0, 6).map((thesis) => <article key={thesis.id}><div><b>{FUND_ASSET_MAP[thesis.assetId].symbol}</b><span>{thesis.targetWeight >= thesis.previousWeight ? 'LONGER' : 'SHORTER'} {formatPercent(Math.abs(thesis.targetWeight))}</span></div><strong>{thesis.tag} · {thesis.conviction}/5</strong><p>{thesis.invalidation || 'No invalidation recorded.'}</p></article>)}</div>
      </section>
    </div>

    <footer className="fund-status-strip"><span>{snapshot.options.mandate === 'long-short' ? 'Long/Short Equity HF' : 'Long-Only Equity PM'}</span><span>{assessment ? 'ASSESSMENT MODE' : `Scenario ${FUND_SCENARIOS[snapshot.resolvedScenario].label}`}</span><span>{phaseText(snapshot.marketPhase)}</span><span>Gross limit {snapshot.options.mandate === 'long-short' ? '200%' : '100%'}</span><span>Dealer fills {snapshot.dealerTrades}</span><span>Dealer vs direct {snapshot.dealerSavings >= 0 ? '+' : ''}{formatMoney(snapshot.dealerSavings)}</span><span>Trading costs {formatMoney(snapshot.transactionCosts)}</span><span>Borrow {formatMoney(snapshot.borrowCosts)}</span></footer>
  </main>
}
