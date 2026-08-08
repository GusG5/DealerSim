import { useMemo, useState } from 'react'
import { FUND_ASSETS, FUND_SCENARIOS } from '../engine/fund'
import { MACRO_ASSETS, MACRO_SCENARIOS } from '../engine/macro'
import type { FundMandate, FundScenario, FundSessionOptions, FundSessionSummary } from '../engine/fund-types'
import type { LiveMacroSessionOptions } from '../engine/live-macro-types'
import type { MacroScenarioFamily, MacroSessionOptions, MacroSessionSummary } from '../engine/macro-types'
import type { Difficulty } from '../types'
import { formatMoney, formatPercent } from '../lib/format'

interface Props {
  summaries: MacroSessionSummary[]
  fundSummaries: FundSessionSummary[]
  onStart: (options: MacroSessionOptions) => void
  onStartLive: (options: LiveMacroSessionOptions) => void
  onStartFund: (options: FundSessionOptions) => void
  onBackDealer: () => void
  onOpenTutorial: () => void
  onOpenLiveTutorial: () => void
  onOpenFundTutorial: (mandate: FundMandate) => void
  onOpenMethodology: () => void
  onOpenProgress: () => void
}

type BuySideMode = 'live' | 'strategic' | 'long-short' | 'long-only'
const macroScenarios: MacroScenarioFamily[] = ['random', 'soft-landing', 'inflation-resurgence', 'recession', 'policy-error', 'commodity-shock', 'risk-off']
const fundScenarios: FundScenario[] = ['random', 'earnings-season', 'growth-rotation', 'value-rotation', 'risk-off', 'short-squeeze', 'stock-pickers']

const macroHistoricalContext: Record<Exclude<MacroScenarioFamily, 'random'>, string> = {
  'soft-landing': 'Disinflation-with-growth episodes: falling inflation pressure alongside resilient activity and easing rate expectations.',
  'inflation-resurgence': '2022-style inflation repricing: duration pressure, tighter policy expectations and equity multiple compression.',
  recession: 'Growth-scare episodes: risk assets weaken while markets progressively price policy easing and safe-haven duration.',
  'policy-error': 'Restrictive-policy stress episodes: weakening growth collides with a central bank that remains tighter for longer.',
  'commodity-shock': 'Energy-supply shocks: crude rises, inflation expectations firm and cross-asset risk appetite deteriorates.',
  'risk-off': 'Crisis-style deleveraging: unstable correlations, safe-haven demand and rapidly changing liquidity conditions.',
}
const fundHistoricalContext: Record<Exclude<FundScenario, 'random'>, string> = {
  'earnings-season': 'Earnings-season tape: headline beats/misses are followed by margins, guidance and management commentary that can reverse the first move.',
  'growth-rotation': 'Rising-yield growth unwind: expensive/high-duration equities derate while defensive and cash-generative names prove more resilient.',
  'value-rotation': 'Reflation/value rotation: factor leadership shifts even when the broad index move is modest.',
  'risk-off': 'Equity deleveraging episode: correlations rise, liquidity worsens and hidden beta dominates apparently diversified books.',
  'short-squeeze': 'Crowded-short squeeze structure: borrow, positioning and a positive catalyst interact non-linearly.',
  'stock-pickers': 'Dispersion regime: the index is relatively quiet while earnings and company catalysts create single-name alpha opportunities.',
}

const difficultyCopy: Record<Difficulty, string> = {
  learning: 'Shows hidden regime/factor interpretation and richer risk diagnostics.',
  standard: 'Full market and portfolio information without hidden scenario readout.',
  advanced: 'More idiosyncratic noise, tighter execution and less interpretive guidance.',
  assessment: 'Highest noise and no coaching. Your process must carry the session.',
}

export function MacroSessionSetup({ summaries, fundSummaries, onStart, onStartLive, onStartFund, onBackDealer, onOpenTutorial, onOpenLiveTutorial, onOpenFundTutorial, onOpenMethodology, onOpenProgress }: Props) {
  const [mode, setMode] = useState<BuySideMode>('live')
  const [macroScenario, setMacroScenario] = useState<MacroScenarioFamily>('random')
  const [fundScenario, setFundScenario] = useState<FundScenario>('random')
  const [difficulty, setDifficulty] = useState<Difficulty>('standard')
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 900_000_000) + 100_000_000)
  const [durationSeconds, setDurationSeconds] = useState(25 * 60)
  const isFund = mode === 'long-short' || mode === 'long-only'
  const best = useMemo(() => [...summaries.map((item) => item.score), ...fundSummaries.map((item) => item.score)].reduce((value, score) => Math.max(value, score), 0), [fundSummaries, summaries])
  const liveSummaries = summaries.filter((item) => item.mode === 'live')
  const strategicSummaries = summaries.filter((item) => item.mode !== 'live')
  const modeFundSummaries = fundSummaries.filter((item) => item.mandate === mode)

  const start = () => {
    const common = { seed: Math.max(1, Math.floor(seed || Date.now())), difficulty, initialNav: 100_000_000 }
    const effectiveMacroScenario: MacroScenarioFamily = difficulty === 'assessment' ? 'random' : macroScenario
    const effectiveFundScenario: FundScenario = difficulty === 'assessment' ? 'random' : fundScenario
    if (mode === 'live') onStartLive({ ...common, scenario: effectiveMacroScenario, durationSeconds })
    else if (mode === 'strategic') onStart({ ...common, scenario: effectiveMacroScenario, days: 30 })
    else onStartFund({ ...common, mandate: mode, scenario: effectiveFundScenario, durationSeconds })
  }

  const generateDrill = () => {
    const nextDifficulty = (['standard', 'advanced', 'assessment'] as Difficulty[])[Math.floor(Math.random() * 3)]
    setDifficulty(nextDifficulty)
    if (isFund) setFundScenario(fundScenarios[Math.floor(Math.random() * fundScenarios.length)])
    else setMacroScenario(macroScenarios[Math.floor(Math.random() * macroScenarios.length)])
    if (mode !== 'strategic') setDurationSeconds([15 * 60, 25 * 60, 40 * 60][Math.floor(Math.random() * 3)])
    setSeed(Math.floor(Math.random() * 900_000_000) + 100_000_000)
  }

  const startDemo = () => {
    const common = { seed: 350_601, difficulty: 'learning' as Difficulty, initialNav: 100_000_000 }
    if (mode === 'live') onStartLive({ ...common, scenario: 'inflation-resurgence', durationSeconds: 5 * 60 })
    else if (mode === 'strategic') onStart({ ...common, scenario: 'policy-error', days: 10 })
    else onStartFund({ ...common, mandate: mode, scenario: mode === 'long-short' ? 'earnings-season' : 'stock-pickers', durationSeconds: 5 * 60 })
  }

  const tutorialAction = () => {
    if (mode === 'live') onOpenLiveTutorial()
    else if (mode === 'strategic') onOpenTutorial()
    else onOpenFundTutorial(mode)
  }
  const completed = mode === 'live' ? liveSummaries.length : mode === 'strategic' ? strategicSummaries.length : modeFundSummaries.length
  const sessionLabel = mode === 'strategic' ? '30 days' : `${Math.round(durationSeconds / 60)} min`

  return <main className="macro-landing-shell">
    <header className="landing-header macro-landing-header"><div><div className="brand-lockup"><span className="brand-mark macro-brand-mark">BS</span><div><p className="eyebrow">BUY-SIDE PORTFOLIO LAB</p><h1>DealerSim · Buy-Side</h1></div></div><p className="landing-copy">Choose between continuous macro trading, strategic asset allocation, long/short equity and benchmark-relative long-only portfolio management.</p></div><div className="header-actions"><button className="button button-ghost demo-button" type="button" onClick={startDemo}>5-min Demo</button><button className="button button-ghost" type="button" onClick={tutorialAction}>{mode === 'long-short' ? 'HF tutorial' : mode === 'long-only' ? 'AM tutorial' : mode === 'live' ? 'Live trader tutorial' : 'Strategic PM tutorial'}</button><button className="button button-ghost" type="button" onClick={onOpenProgress}>Progress</button><button className="button button-ghost" type="button" onClick={onOpenMethodology}>Methodology</button><button className="button button-ghost" type="button" onClick={onBackDealer}>Back to dealer desk</button></div></header>

    <section className="buy-side-mode-grid buy-side-mode-grid-four">
      <button type="button" className={`buy-side-mode-card${mode === 'live' ? ' selected' : ''}`} onClick={() => setMode('live')}><span className="mode-badge">MACRO HF / AM</span><strong>Global Macro Trader</strong><p>Continuous cross-asset trading with dealer RFQs, worked orders, macro releases and real-time factor risk.</p><footer><b>Live markets</b><b>Dealer RFQs</b><b>Cross-asset</b></footer></button>
      <button type="button" className={`buy-side-mode-card${mode === 'long-short' ? ' selected' : ''}`} onClick={() => setMode('long-short')}><span className="mode-badge fund-mode-badge">HEDGE FUND</span><strong>Long / Short Equity</strong><p>Run a single-name book, source borrow, manage beta, trade catalysts and separate alpha from broad market exposure.</p><footer><b>Short locates</b><b>Beta hedge</b><b>Catalysts</b></footer></button>
      <button type="button" className={`buy-side-mode-card${mode === 'long-only' ? ' selected' : ''}`} onClick={() => setMode('long-only')}><span className="mode-badge long-only-badge">ASSET MANAGEMENT</span><strong>Long-Only Equity PM</strong><p>Build active weights against a benchmark while controlling concentration, turnover, factor risk and execution costs.</p><footer><b>Benchmark alpha</b><b>Active weights</b><b>Block execution</b></footer></button>
      <button type="button" className={`buy-side-mode-card${mode === 'strategic' ? ' selected' : ''}`} onClick={() => setMode('strategic')}><span className="mode-badge muted">STRATEGIC</span><strong>Strategic Portfolio Manager</strong><p>Decision-paced 30-day macro mandate for slower allocation, thesis development and event-driven rebalancing.</p><footer><b>30-day path</b><b>Event steps</b><b>Allocation focus</b></footer></button>
    </section>

    <section className="landing-metrics macro-landing-metrics"><article className="landing-metric"><span>Mandate NAV</span><strong>$100m</strong></article><article className="landing-metric"><span>{mode === 'strategic' ? 'Horizon' : 'Session'}</span><strong>{sessionLabel}</strong></article><article className="landing-metric"><span>Gross limit</span><strong>{mode === 'long-short' ? '200%' : mode === 'long-only' ? '100%' : '150%'}</strong></article><article className="landing-metric"><span>Hard drawdown</span><strong>{isFund ? '12%' : '10%'}</strong></article><article className="landing-metric"><span>Completed</span><strong>{completed}</strong></article><article className="landing-metric"><span>Best score</span><strong>{best ? best.toFixed(1) : '—'}</strong></article></section>

    <div className="macro-setup-grid"><section className="setup-panel macro-setup-panel"><div className="section-heading"><div><p className="eyebrow">{mode === 'long-short' ? 'EQUITY HEDGE FUND' : mode === 'long-only' ? 'LONG-ONLY ASSET MANAGEMENT' : mode === 'live' ? 'LIVE GLOBAL MACRO' : 'STRATEGIC MACRO MANDATE'}</p><h2>Scenario builder</h2></div><span className="status-chip status-live">Synthetic portfolio</span></div>
      <div className="macro-scenario-grid">{(isFund ? fundScenarios : macroScenarios).map((item) => {
        const copy = isFund ? (item === 'random' ? { label: 'Unknown equity regime', description: 'Infer factor leadership, crowding and catalyst conditions from live markets.' } : FUND_SCENARIOS[item as Exclude<FundScenario, 'random'>]) : (item === 'random' ? { label: 'Unknown regime', description: 'Infer the macro path from releases, price action and cross-asset behaviour.' } : MACRO_SCENARIOS[item as Exclude<MacroScenarioFamily, 'random'>])
        const selected = difficulty === 'assessment' ? item === 'random' : (isFund ? fundScenario === item : macroScenario === item)
        return <button key={item} type="button" disabled={difficulty === 'assessment' && item !== 'random'} className={`scenario-card${selected ? ' selected' : ''}${difficulty === 'assessment' && item !== 'random' ? ' assessment-locked' : ''}`} onClick={() => difficulty !== 'assessment' && (isFund ? setFundScenario(item as FundScenario) : setMacroScenario(item as MacroScenarioFamily))}><span>{copy.label}</span><small>{difficulty === 'assessment' && item !== 'random' ? 'Hidden in Assessment.' : copy.description}</small></button>
      })}</div>
      <div className="historical-scenario-note"><strong>Historical-inspired structure</strong><span>{difficulty === 'assessment' ? 'Hidden in Assessment. The scenario is selected randomly and must be inferred from prices, releases and flow.' : isFund ? (fundScenario === 'random' ? 'Unknown equity episode. The engine draws from the scenario families below without replaying historical prices.' : fundHistoricalContext[fundScenario]) : (macroScenario === 'random' ? 'Unknown macro episode. The engine draws from the scenario families below without replaying historical prices.' : macroHistoricalContext[macroScenario])}</span><small>Synthetic analogue only — no historical prices or proprietary data are reproduced.</small></div>

      <div className="instrument-section-label macro-universe-label"><span>Tradeable universe</span><small>{isFund ? 'Single-name positions use target NAV weights; ES is available as a beta hedge.' : 'Cross-asset positions are expressed as portfolio weights so risk is comparable.'}</small></div>
      <div className="macro-universe-grid">{(isFund ? FUND_ASSETS : MACRO_ASSETS).map((asset) => <article key={asset.id} className="macro-universe-card"><div><strong>{asset.symbol}</strong><span>{asset.displayName}</span></div><small>{asset.description}</small><footer>{'annualVolatility' in asset && <b>Vol {(asset.annualVolatility * 100).toFixed(0)}%</b>}<b>Max {formatPercent(asset.maxAbsWeight)}</b>{isFund && 'borrowRatePct' in asset ? <b>{asset.id === 'es-fund' ? 'Index hedge' : `Borrow ${asset.borrowRatePct.toFixed(1)}%`}</b> : 'transactionCostBps' in asset ? <b>TC {asset.transactionCostBps.toFixed(2)}bp</b> : null}</footer></article>)}</div>

      <div className="scenario-builder-actions"><button className="button button-ghost" type="button" onClick={generateDrill}>Generate random drill</button><span>Creates a fresh synthetic drill from the selected desk. Outcomes remain hidden until the session develops.</span></div><div className="setup-controls macro-setup-controls"><label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}><option value="learning">Learning</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="assessment">Assessment</option></select></label>{mode !== 'strategic' && <label><span>Live session length</span><select value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))}><option value={15 * 60}>15 minutes</option><option value={25 * 60}>25 minutes</option><option value={40 * 60}>40 minutes</option></select></label>}<label><span>Scenario seed</span><div className="seed-control"><input type="number" min={1} value={seed} onChange={(event) => setSeed(Number(event.target.value))} /><button type="button" className="button button-small button-ghost" onClick={() => setSeed(Math.floor(Math.random() * 900_000_000) + 100_000_000)}>Randomise</button></div></label></div>
      <div className="difficulty-note"><strong>{difficulty[0].toUpperCase() + difficulty.slice(1)}</strong><span>{difficultyCopy[difficulty]}</span></div>
      {difficulty === 'assessment' && <div className="assessment-note"><strong>Assessment protocol</strong><span>Scenario is forced to Unknown. No pause in continuous modes, hidden regime/reliability estimates remain unavailable, and convenience hedges are removed where appropriate. Final score and review are shown only after you finish.</span></div>}
      <button className="button button-primary start-button" type="button" onClick={start}>{mode === 'long-short' ? 'Continue to HF morning meeting' : mode === 'long-only' ? 'Continue to AM morning briefing' : mode === 'live' ? 'Continue to macro pre-market' : 'Start 30-day strategic mandate'}</button><p className="disclaimer">Educational simulation only. Prices, catalysts, counterparties, borrow and portfolio returns are synthetic.</p></section>

      <aside className="history-panel macro-history-panel"><div className="section-heading compact"><div><p className="eyebrow">BUY-SIDE HISTORY</p><h2>Recent sessions</h2></div></div>{summaries.length + fundSummaries.length === 0 ? <div className="empty-history"><strong>No buy-side sessions yet</strong><p>Completed sessions will be stored locally in this browser.</p></div> : <div className="history-list">{[...fundSummaries.map((summary) => ({ id: summary.id, score: summary.score, rating: summary.rating, label: summary.mandate === 'long-short' ? 'equity HF' : 'long-only PM', scenario: summary.scenario, difficulty: summary.difficulty, seed: summary.seed, ret: summary.returnPct, dd: summary.maxDrawdown, costs: summary.transactionCosts + summary.borrowCosts })), ...summaries.map((summary) => ({ id: summary.id, score: summary.score, rating: summary.rating, label: summary.mode === 'live' ? 'live macro' : 'strategic PM', scenario: summary.scenario, difficulty: summary.difficulty, seed: summary.seed, ret: summary.returnPct, dd: summary.maxDrawdown, costs: summary.transactionCosts }))].slice(0, 10).map((summary) => <article className="history-row macro-history-row" key={summary.id}><div><strong>{summary.score.toFixed(1)}</strong><span>{summary.rating}</span></div><div><span>{summary.label} · {summary.scenario.replaceAll('-', ' ')}</span><small>{summary.difficulty} · seed {summary.seed}</small></div><div className={summary.ret >= 0 ? 'positive' : 'negative'}><strong>{formatPercent(summary.ret, 1)}</strong><small>DD {formatPercent(Math.abs(summary.dd), 1)} · costs {formatMoney(summary.costs)}</small></div></article>)}</div>}</aside>
    </div>
  </main>
}
