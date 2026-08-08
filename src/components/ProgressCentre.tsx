import { useMemo, useState } from 'react'
import type { FundDealerRelationshipMemory, FundSessionSummary } from '../engine/fund-types'
import type { MacroSessionSummary } from '../engine/macro-types'
import type { DealerClientRelationshipMemory } from '../lib/storage'
import type { Difficulty, SessionSummary } from '../types'
import { formatMoney, formatPercent, titleCase } from '../lib/format'

type Scope = 'all' | 'dealer' | 'live-macro' | 'strategic' | 'long-short' | 'long-only'
type SkillKey = 'commercial' | 'risk' | 'sizing' | 'execution' | 'thesis' | 'selection'

type ProgressRow = {
  id: string
  completedAt: string
  scope: Exclude<Scope, 'all'>
  difficulty: Difficulty
  scenario: string
  label: string
  score: number
  adjustedScore: number
  rating: string
  pnlOrReturn: number
  pnlIsPercent: boolean
  skills: Partial<Record<SkillKey, number>>
  seed: number
}

interface Props {
  dealerSummaries: SessionSummary[]
  macroSummaries: MacroSessionSummary[]
  fundSummaries: FundSessionSummary[]
  fundDealerRelationships: Record<string, FundDealerRelationshipMemory>
  clientRelationships: Record<string, DealerClientRelationshipMemory>
  onClose: () => void
  onClearAll: () => void
}

const difficultyAdjustment: Record<Difficulty, number> = {
  learning: -8,
  standard: 0,
  advanced: 4,
  assessment: 8,
}

const skillLabels: Record<SkillKey, string> = {
  commercial: 'Commercial / quote quality',
  risk: 'Risk control',
  sizing: 'Sizing / inventory',
  execution: 'Execution',
  thesis: 'Thesis / adaptability',
  selection: 'Alpha / selection',
}

export function ProgressCentre({ dealerSummaries, macroSummaries, fundSummaries, fundDealerRelationships, clientRelationships, onClose, onClearAll }: Props) {
  const [scope, setScope] = useState<Scope>('all')
  const [difficulty, setDifficulty] = useState<'all' | Difficulty>('all')
  const [scenario, setScenario] = useState('all')

  const rows = useMemo<ProgressRow[]>(() => {
    const dealerRows: ProgressRow[] = dealerSummaries.map((item) => ({
      id: item.id,
      completedAt: item.completedAt,
      scope: 'dealer',
      difficulty: item.difficulty,
      scenario: item.scenario,
      label: item.instrumentSymbol,
      score: item.score,
      adjustedScore: adjusted(item.score, item.difficulty),
      rating: item.rating,
      pnlOrReturn: item.netPnl,
      pnlIsPercent: false,
      seed: item.seed,
      skills: {
        commercial: averageDefined([item.quoteQualityScore, item.commissionScore]),
        risk: averageDefined([item.adverseSelectionScore, item.executionScore]),
        sizing: item.inventoryScore,
        execution: item.executionScore,
        selection: item.pnlScore,
      },
    }))
    const macroRows: ProgressRow[] = macroSummaries.map((item) => ({
      id: item.id,
      completedAt: item.completedAt,
      scope: item.mode === 'live' ? 'live-macro' : 'strategic',
      difficulty: item.difficulty,
      scenario: item.scenario,
      label: item.mode === 'live' ? 'Global Macro' : 'Strategic PM',
      score: item.score,
      adjustedScore: adjusted(item.score, item.difficulty),
      rating: item.rating,
      pnlOrReturn: item.returnPct,
      pnlIsPercent: true,
      seed: item.seed,
      skills: {
        selection: item.returnScore,
        risk: item.riskScore,
        sizing: item.sizingScore,
        execution: item.efficiencyScore,
        thesis: averageDefined([item.thesisScore, item.adaptabilityScore]),
      },
    }))
    const fundRows: ProgressRow[] = fundSummaries.map((item) => ({
      id: item.id,
      completedAt: item.completedAt,
      scope: item.mandate,
      difficulty: item.difficulty,
      scenario: item.resolvedScenario ?? item.scenario,
      label: item.mandate === 'long-short' ? 'Long/Short HF' : 'Long-Only PM',
      score: item.score,
      adjustedScore: adjusted(item.score, item.difficulty),
      rating: item.rating,
      pnlOrReturn: item.returnPct,
      pnlIsPercent: true,
      seed: item.seed,
      skills: {
        selection: item.alphaScore,
        risk: item.riskScore,
        sizing: item.sizingScore,
        execution: item.executionScore,
        thesis: item.thesisScore,
        commercial: item.efficiencyScore,
      },
    }))
    return [...dealerRows, ...macroRows, ...fundRows].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
  }, [dealerSummaries, fundSummaries, macroSummaries])

  const filtered = rows.filter((row) => (scope === 'all' || row.scope === scope) && (difficulty === 'all' || row.difficulty === difficulty) && (scenario === 'all' || row.scenario === scenario))
  const scenarios = [...new Set(rows.filter((row) => scope === 'all' || row.scope === scope).map((row) => row.scenario))].sort()
  const recent5 = filtered.slice(-5)
  const recent10 = filtered.slice(-10)
  const prior10 = filtered.slice(-20, -10)
  const avg5 = average(recent5.map((row) => row.score))
  const avg10 = average(recent10.map((row) => row.score))
  const avgAll = average(filtered.map((row) => row.score))
  const adjusted10 = average(recent10.map((row) => row.adjustedScore))
  const prior10Avg = average(prior10.map((row) => row.score))
  const improvement = prior10.length ? avg10 - prior10Avg : 0
  const best = filtered.length ? Math.max(...filtered.map((row) => row.score)) : 0
  const latest = filtered.at(-1)

  const skillKeys = (Object.keys(skillLabels) as SkillKey[]).filter((key) => filtered.some((row) => typeof row.skills[key] === 'number'))
  const skillRows = skillKeys.map((key) => {
    const current = averageDefined(recent10.map((row) => row.skills[key]))
    const prior = averageDefined(prior10.map((row) => row.skills[key]))
    return { key, label: skillLabels[key], current, prior, delta: current !== undefined && prior !== undefined ? current - prior : undefined }
  }).sort((a, b) => (a.current ?? 999) - (b.current ?? 999))
  const weakest = skillRows.find((row) => row.current !== undefined)

  const byDifficulty = (['learning', 'standard', 'advanced', 'assessment'] as Difficulty[]).map((level) => {
    const group = filtered.filter((row) => row.difficulty === level)
    return { level, sessions: group.length, raw: average(group.map((row) => row.score)), adjusted: average(group.map((row) => row.adjustedScore)) }
  }).filter((row) => row.sessions)

  const byScenario = [...new Set(filtered.map((row) => row.scenario))].map((name) => {
    const group = filtered.filter((row) => row.scenario === name)
    return { name, sessions: group.length, score: average(group.map((row) => row.score)), adjusted: average(group.map((row) => row.adjustedScore)) }
  }).sort((a, b) => a.score - b.score)

  const recommendation = trainingRecommendation(scope, weakest?.key, byScenario[0]?.name, filtered.length)
  const milestones = buildMilestones(rows)
  const clientRows = Object.values(clientRelationships).sort((a, b) => b.relationshipScore - a.relationshipScore).slice(0, 8)
  const fundDealerRows = Object.values(fundDealerRelationships).sort((a, b) => b.relationshipScore - a.relationshipScore).slice(0, 6)

  const exportCsv = () => {
    const header = ['completed_at','mode','difficulty','scenario','raw_score','difficulty_adjusted','rating','seed']
    const body = filtered.map((row) => [row.completedAt,row.scope,row.difficulty,row.scenario,row.score,row.adjustedScore,row.rating,row.seed])
    download('dealersim-progress-centre.csv', [header, ...body].map((r) => r.map(csvEscape).join(',')).join('\n'), 'text/csv')
  }
  const exportReport = () => {
    const lines = [
      '# DealerSim Training Progress Report',
      '',
      `Generated: ${new Date().toLocaleString('en-GB')}`,
      `Scope: ${scopeLabel(scope)}`,
      `Sessions: ${filtered.length}`,
      `Current 5-session average: ${recent5.length ? avg5.toFixed(1) : 'n/a'}`,
      `Current 10-session average: ${recent10.length ? avg10.toFixed(1) : 'n/a'}`,
      `All-time average: ${filtered.length ? avgAll.toFixed(1) : 'n/a'}`,
      `Difficulty-adjusted 10-session index: ${recent10.length ? adjusted10.toFixed(1) : 'n/a'}`,
      `Best raw score: ${filtered.length ? best.toFixed(1) : 'n/a'}`,
      `10-session change: ${prior10.length ? `${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}` : 'n/a'}`,
      '',
      '## Skill profile',
      ...skillRows.map((row) => `- ${row.label}: ${row.current === undefined ? 'n/a' : row.current.toFixed(1)}${row.delta === undefined ? '' : ` (${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(1)} vs prior 10)`}`),
      '',
      '## Recommended next drill',
      `- ${recommendation.title}: ${recommendation.detail}`,
      '',
      '## Milestones',
      ...milestones.map((item) => `- ${item.done ? '[x]' : '[ ]'} ${item.label}`),
    ]
    download('dealersim-training-report.md', lines.join('\n'), 'text/markdown')
  }

  return <div className="progress-overlay progress-centre-overlay" role="dialog" aria-modal="true" aria-label="DealerSim Progress Centre">
    <main className="progress-dashboard progress-centre">
      <header className="progress-header"><div><p className="eyebrow">DEALERSIM TRAINING ANALYTICS</p><h1>Progress Centre</h1><p>Rolling averages, skill trends and recommended drills across sell-side and buy-side simulations.</p></div><div className="progress-actions">{filtered.length > 0 && <><button className="button button-ghost" onClick={exportCsv}>Export CSV</button><button className="button button-ghost" onClick={exportReport}>Training report</button></>}<button className="button button-ghost" onClick={onClose}>Close</button></div></header>

      <nav className="progress-scope-tabs" aria-label="Training mode filter">{(['all','dealer','live-macro','long-short','long-only','strategic'] as Scope[]).map((item) => <button key={item} className={scope === item ? 'active' : ''} onClick={() => { setScope(item); setScenario('all') }}>{scopeLabel(item)}</button>)}</nav>

      <section className="progress-filters progress-centre-filters"><label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as 'all' | Difficulty)}><option value="all">All difficulties</option><option value="learning">Learning</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="assessment">Assessment</option></select></label><label><span>Scenario / regime</span><select value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="all">All scenarios</option>{scenarios.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label></section>

      <section className="progress-metrics progress-centre-metrics">
        <Metric label="5-session average" value={recent5.length ? avg5.toFixed(1) : '—'} detail={`${recent5.length}/5 comparable`} />
        <Metric label="10-session average" value={recent10.length ? avg10.toFixed(1) : '—'} detail={prior10.length ? `${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)} vs prior 10` : 'build 20 comparable sessions'} tone={improvement > .5 ? 'positive' : improvement < -.5 ? 'negative' : ''} />
        <Metric label="Difficulty-adjusted" value={recent10.length ? adjusted10.toFixed(1) : '—'} detail="training index · raw score remains primary" />
        <Metric label="All-time average" value={filtered.length ? avgAll.toFixed(1) : '—'} detail={`${filtered.length} sessions`} />
        <Metric label="Best score" value={filtered.length ? best.toFixed(1) : '—'} detail={latest ? `latest ${latest.score.toFixed(1)}` : 'no sessions'} />
      </section>

      {filtered.length === 0 ? <section className="progress-empty"><strong>No comparable sessions yet.</strong><p>Complete a session in this mode or broaden the filters.</p></section> : <div className="progress-main-grid progress-centre-grid">
        <section className="progress-panel progress-trend-panel progress-centre-trend"><div className="section-heading compact"><div><p className="eyebrow">PERFORMANCE OVER TIME</p><h2>Raw score + 5-session rolling average</h2></div></div><RollingTrend rows={filtered.slice(-40)} /></section>

        <section className="progress-panel training-recommendation"><div className="section-heading compact"><div><p className="eyebrow">NEXT BEST DRILL</p><h2>{recommendation.title}</h2></div></div><p>{recommendation.detail}</p>{weakest?.current !== undefined && <div className="recommendation-stat"><span>Current weakest skill</span><strong>{weakest.label} · {weakest.current.toFixed(0)}</strong></div>}<small>Recommendation is heuristic and uses locally stored session history, not a predictive assessment of job performance.</small></section>

        <section className="progress-panel"><div className="section-heading compact"><div><p className="eyebrow">SKILL TREND</p><h2>Current 10 vs previous 10</h2></div></div><div className="progress-skill-list">{skillRows.map((row) => <div className="progress-skill-row skill-trend-row" key={row.key}><span>{row.label}</span><div><i style={{ width: `${Math.max(0, Math.min(100, row.current ?? 0))}%` }} /></div><strong>{row.current === undefined ? '—' : row.current.toFixed(0)}</strong><em className={row.delta === undefined ? '' : row.delta >= 0 ? 'positive' : 'negative'}>{row.delta === undefined ? '—' : `${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(1)}`}</em></div>)}</div></section>

        <section className="progress-panel progress-table-panel"><div className="section-heading compact"><div><p className="eyebrow">DIFFICULTY LADDER</p><h2>Raw vs adjusted</h2></div></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Difficulty</th><th>Sessions</th><th>Raw</th><th>Adjusted index</th></tr></thead><tbody>{byDifficulty.map((row) => <tr key={row.level}><td>{titleCase(row.level)}</td><td>{row.sessions}</td><td>{row.raw.toFixed(1)}</td><td>{row.adjusted.toFixed(1)}</td></tr>)}</tbody></table></div><p className="progress-note">Adjustment is intentionally modest: Learning −8, Standard 0, Advanced +4, Assessment +8. It is a training comparison aid, not an official score.</p></section>

        <section className="progress-panel progress-table-panel"><div className="section-heading compact"><div><p className="eyebrow">REGIME DIAGNOSTIC</p><h2>Where performance breaks down</h2></div></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Scenario</th><th>Sessions</th><th>Avg raw</th><th>Adjusted</th></tr></thead><tbody>{byScenario.map((row) => <tr key={row.name}><td>{titleCase(row.name)}</td><td>{row.sessions}</td><td>{row.score.toFixed(1)}</td><td>{row.adjusted.toFixed(1)}</td></tr>)}</tbody></table></div></section>

        <section className="progress-panel milestone-panel"><div className="section-heading compact"><div><p className="eyebrow">TRAINING MILESTONES</p><h2>Evidence of consistency</h2></div></div><div className="milestone-list">{milestones.map((item) => <article key={item.label} className={item.done ? 'done' : ''}><span>{item.done ? '✓' : '○'}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></article>)}</div></section>

        {clientRows.length > 0 && <section className="progress-panel progress-table-panel"><div className="section-heading compact"><div><p className="eyebrow">SELL-SIDE FRANCHISE</p><h2>Persistent client relationships</h2></div></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Client</th><th>Relationship</th><th>RFQs</th><th>Fill rate</th><th>Volume</th><th>Commission</th></tr></thead><tbody>{clientRows.map((item) => <tr key={item.clientName}><td>{item.clientName}</td><td>{item.relationshipScore.toFixed(0)}/100</td><td>{item.rfqs}</td><td>{formatPercent(item.rfqs ? item.fills / item.rfqs : 0)}</td><td>{item.volumeM.toFixed(1)}m</td><td>{formatMoney(item.commission)}</td></tr>)}</tbody></table></div><p className="progress-note">Strong service modestly increases the probability of future RFQs from that synthetic client; poor/stale execution can erode the relationship.</p></section>}

        {fundDealerRows.length > 0 && <section className="progress-panel progress-table-panel"><div className="section-heading compact"><div><p className="eyebrow">BUY-SIDE COUNTERPARTIES</p><h2>Dealer network memory</h2></div></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Dealer</th><th>Relationship</th><th>RFQs</th><th>Fill rate</th><th>Executed</th><th>Savings</th></tr></thead><tbody>{fundDealerRows.map((item) => <tr key={item.dealerId}><td>{item.dealerName}</td><td>{item.relationshipScore.toFixed(0)}/100</td><td>{item.rfqs}</td><td>{formatPercent(item.rfqs ? item.fills / item.rfqs : 0)}</td><td>{formatMoney(item.executedNotional)}</td><td className={item.cumulativeSavings >= 0 ? 'positive' : 'negative'}>{formatMoney(item.cumulativeSavings)}</td></tr>)}</tbody></table></div></section>}

        <section className="progress-panel progress-table-panel progress-history-panel"><div className="section-heading compact"><div><p className="eyebrow">SESSION LOG</p><h2>Latest comparable runs</h2></div><button className="text-button" onClick={onClearAll}>Clear all history</button></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Date</th><th>Mode</th><th>Scenario</th><th>Difficulty</th><th>Score</th><th>Adj.</th><th>P&amp;L / return</th></tr></thead><tbody>{[...filtered].reverse().slice(0, 24).map((row) => <tr key={row.id}><td>{formatDate(row.completedAt)}</td><td>{scopeLabel(row.scope)}<small className="table-subline">{row.label}</small></td><td>{titleCase(row.scenario)}</td><td>{titleCase(row.difficulty)}</td><td>{row.score.toFixed(1)}</td><td>{row.adjustedScore.toFixed(1)}</td><td className={row.pnlOrReturn >= 0 ? 'positive' : 'negative'}>{row.pnlIsPercent ? formatPercent(row.pnlOrReturn, 2) : formatMoney(row.pnlOrReturn)}</td></tr>)}</tbody></table></div></section>
      </div>}
    </main>
  </div>
}

function Metric({ label, value, detail, tone = '' }: { label: string; value: string; detail: string; tone?: string }) { return <article><span>{label}</span><strong className={tone}>{value}</strong><small>{detail}</small></article> }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function averageDefined(values: Array<number | undefined>): number | undefined { const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)); return clean.length ? average(clean) : undefined }
function adjusted(score: number, difficulty: Difficulty) { return Math.max(0, Math.min(100, score + difficultyAdjustment[difficulty])) }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function scopeLabel(scope: Scope) { return scope === 'all' ? 'All training' : scope === 'dealer' ? 'S&T Dealer' : scope === 'live-macro' ? 'Global Macro' : scope === 'strategic' ? 'Strategic PM' : scope === 'long-short' ? 'Long/Short HF' : 'Long-Only AM' }
function csvEscape(value: string | number) { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text }
function download(filename: string, body: string, type: string) { const blob = new Blob([body], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

function RollingTrend({ rows }: { rows: ProgressRow[] }) {
  if (!rows.length) return <div className="progress-empty-chart">Complete a session to build the trend.</div>
  const w = 920, h = 250, px = 40, py = 28
  const roll = rows.map((_, index) => average(rows.slice(Math.max(0, index - 4), index + 1).map((row) => row.score)))
  const values = [...rows.map((row) => row.score), ...roll]
  const lo = Math.max(0, Math.min(...values, 45) - 5), hi = Math.min(100, Math.max(...values, 88) + 5), range = Math.max(1, hi - lo)
  const x = (i: number) => rows.length === 1 ? w / 2 : px + i * (w - 2 * px) / (rows.length - 1)
  const y = (v: number) => h - py - (v - lo) / range * (h - 2 * py)
  return <div className="progress-trend-chart progress-rolling-chart"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Session score and rolling average trend">{[60,70,80,90].filter((level) => level >= lo && level <= hi).map((level) => <g key={level}><line x1={px} x2={w-px} y1={y(level)} y2={y(level)} className="trend-guide"/><text x={4} y={y(level)+4}>{level}</text></g>)}<polyline points={rows.map((row,i) => `${x(i)},${y(row.score)}`).join(' ')} className="trend-line raw-trend-line"/><polyline points={roll.map((value,i) => `${x(i)},${y(value)}`).join(' ')} className="trend-line rolling-average-line"/>{rows.map((row,i) => <circle key={row.id} cx={x(i)} cy={y(row.score)} r={i === rows.length-1 ? 4.5 : 2.6} className="trend-dot"><title>{`${scopeLabel(row.scope)} · ${row.score.toFixed(1)} · ${titleCase(row.difficulty)}`}</title></circle>)}</svg><div className="trend-legend"><span><i className="legend-raw"/>Raw score</span><span><i className="legend-roll"/>5-session rolling average</span></div></div>
}

function buildMilestones(rows: ProgressRow[]) {
  const assessments = rows.filter((row) => row.difficulty === 'assessment')
  const hf = rows.filter((row) => row.scope === 'long-short')
  const dealer = rows.filter((row) => row.scope === 'dealer')
  return [
    { label: 'First 10 sessions', detail: `${Math.min(rows.length, 10)}/10 completed`, done: rows.length >= 10 },
    { label: '50 total sessions', detail: `${Math.min(rows.length, 50)}/50 completed`, done: rows.length >= 50 },
    { label: '70+ Assessment average', detail: assessments.length ? `${average(assessments.slice(-10).map((row) => row.score)).toFixed(1)} recent average` : 'No Assessment sessions yet', done: assessments.length >= 5 && average(assessments.slice(-10).map((row) => row.score)) >= 70 },
    { label: '75+ Dealer consistency', detail: dealer.length ? `${average(dealer.slice(-10).map((row) => row.score)).toFixed(1)} recent average` : 'No dealer sessions yet', done: dealer.length >= 10 && average(dealer.slice(-10).map((row) => row.score)) >= 75 },
    { label: 'Positive HF process streak', detail: 'Five consecutive HF scores ≥70', done: hf.length >= 5 && hf.slice(-5).every((row) => row.score >= 70) },
  ]
}

function trainingRecommendation(scope: Scope, weakest: SkillKey | undefined, weakestScenario: string | undefined, sessions: number) {
  if (sessions < 3) return { title: 'Build a baseline', detail: 'Complete at least three comparable sessions before using the recommendation engine. Keep the mode and difficulty constant initially.' }
  const difficulty = sessions >= 10 ? 'Advanced' : 'Standard'
  if (scope === 'dealer') {
    if (weakest === 'risk') return { title: `Toxic Flow · ${difficulty}`, detail: 'Your risk/adverse-selection component is weakest. Practise identifying informed flow and reducing stale exposure rather than maximising raw acceptance.' }
    if (weakest === 'sizing') return { title: `One-Way Flow · ${difficulty}`, detail: 'Inventory management is the current constraint. Practise partial hedging, internalisation and deliberate risk reduction.' }
    if (weakest === 'execution') return { title: `Illiquid Market · ${difficulty}`, detail: 'Execution is lagging. Practise working residual risk in clips and comparing immediate impact with patient execution.' }
    return { title: `${titleCase(weakestScenario ?? 'fast-market')} · ${difficulty}`, detail: 'Your lowest-scoring regime is the best next comparable drill. Repeat it with the same difficulty but a new seed.' }
  }
  if (scope === 'long-short') {
    if (weakest === 'risk') return { title: `Short Squeeze · ${difficulty}`, detail: 'Risk control is the weakest component. Focus on beta, crowding, locate/borrow constraints and invalidation discipline.' }
    if (weakest === 'selection') return { title: `Stock Pickers · ${difficulty}`, detail: 'Alpha generation is lagging. Use the morning research pack to build differentiated longs/shorts while keeping beta controlled.' }
    return { title: `${titleCase(weakestScenario ?? 'earnings-season')} · ${difficulty}`, detail: 'Repeat the weakest regime and explicitly compare your morning plan with post-catalyst position changes.' }
  }
  if (scope === 'long-only') return { title: `Stock Pickers · ${difficulty}`, detail: 'Practise benchmark-relative active weights, concentration control and execution rather than simply maximising absolute return.' }
  if (scope === 'live-macro' || scope === 'strategic') return { title: `Inflation Resurgence · ${difficulty}`, detail: 'Practise translating one macro surprise across rates, equities, FX, commodities and portfolio factor exposures.' }
  return { title: 'Assessment rotation', detail: 'Rotate one Dealer, one Global Macro and one Long/Short Assessment session. Compare 10-session averages rather than isolated P&L.' }
}
