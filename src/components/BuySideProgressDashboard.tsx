import { useMemo, useState } from 'react'
import { FUND_ASSETS, FUND_DEALERS } from '../engine/fund'
import type { FundDealerRelationshipMemory, FundSessionSummary } from '../engine/fund-types'
import type { MacroSessionSummary } from '../engine/macro-types'
import { formatMoney, formatPercent } from '../lib/format'

type Mode = 'all' | 'live' | 'strategic' | 'long-short' | 'long-only'

interface Props {
  macroSummaries: MacroSessionSummary[]
  fundSummaries: FundSessionSummary[]
  dealerRelationships: Record<string, FundDealerRelationshipMemory>
  onClose: () => void
  onClearHistory: () => void
}

type Row = {
  id: string
  completedAt: string
  mode: Exclude<Mode, 'all'>
  score: number
  rating: string
  returnPct: number
  drawdown: number
  costs: number
  dealerSavings: number
  seed: number
  scenario: string
  executionBps?: number
  difficulty: string
  alphaSkill?: number
  riskSkill?: number
  sizingSkill?: number
  executionSkill?: number
  thesisSkill?: number
  efficiencySkill?: number
}

export function BuySideProgressDashboard({ macroSummaries, fundSummaries, dealerRelationships, onClose, onClearHistory }: Props) {
  const [mode, setMode] = useState<Mode>('all')
  const [difficulty, setDifficulty] = useState('all')
  const [scenario, setScenario] = useState('all')
  const rows = useMemo<Row[]>(() => [
    ...macroSummaries.map((item) => ({ id: item.id, completedAt: item.completedAt, mode: item.mode === 'live' ? 'live' as const : 'strategic' as const, score: item.score, rating: item.rating, returnPct: item.returnPct, drawdown: item.maxDrawdown, costs: item.transactionCosts, dealerSavings: item.dealerSavings ?? 0, seed: item.seed, scenario: item.scenario, difficulty: item.difficulty, alphaSkill: item.returnScore, riskSkill: item.riskScore, sizingSkill: item.sizingScore, executionSkill: item.efficiencyScore, thesisSkill: item.thesisScore, efficiencySkill: item.adaptabilityScore })),
    ...fundSummaries.map((item) => ({ id: item.id, completedAt: item.completedAt, mode: item.mandate, score: item.score, rating: item.rating, returnPct: item.returnPct, drawdown: item.maxDrawdown, costs: item.transactionCosts + item.borrowCosts, dealerSavings: item.dealerSavings ?? 0, seed: item.seed, scenario: item.resolvedScenario ?? item.scenario, difficulty: item.difficulty, executionBps: item.implementationShortfallBps, alphaSkill: item.alphaScore, riskSkill: item.riskScore, sizingSkill: item.sizingScore, executionSkill: item.executionScore, thesisSkill: item.thesisScore, efficiencySkill: item.efficiencyScore })),
  ].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt)), [fundSummaries, macroSummaries])
  const filtered = rows.filter((item) => (mode === 'all' || item.mode === mode) && (difficulty === 'all' || item.difficulty === difficulty) && (scenario === 'all' || item.scenario === scenario))
  const scenarioOptions = [...new Set(rows.map((item) => item.scenario))].sort()
  const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const avgScore = average(filtered.map((item) => item.score))
  const avgReturn = average(filtered.map((item) => item.returnPct))
  const avgDd = average(filtered.map((item) => Math.abs(item.drawdown)))
  const avgCost = average(filtered.map((item) => item.costs))
  const totalDealerSavings = filtered.reduce((sum, item) => sum + item.dealerSavings, 0)
  const recent = filtered.slice(-16)
  const skillRows = [
    ['Alpha / return', average(filtered.map((item) => item.alphaSkill ?? 0).filter((value) => value > 0))],
    ['Risk', average(filtered.map((item) => item.riskSkill ?? 0).filter((value) => value > 0))],
    ['Sizing', average(filtered.map((item) => item.sizingSkill ?? 0).filter((value) => value > 0))],
    ['Execution', average(filtered.map((item) => item.executionSkill ?? 0).filter((value) => value > 0))],
    ['Thesis', average(filtered.map((item) => item.thesisSkill ?? 0).filter((value) => value > 0))],
    ['Efficiency', average(filtered.map((item) => item.efficiencySkill ?? 0).filter((value) => value > 0))],
  ] as const
  const byScenario = [...new Set(filtered.map((item) => item.scenario))].map((name) => {
    const group = filtered.filter((item) => item.scenario === name)
    return { name, sessions: group.length, score: average(group.map((item) => item.score)), returnPct: average(group.map((item) => item.returnPct)), drawdown: average(group.map((item) => Math.abs(item.drawdown))) }
  }).sort((a, b) => b.sessions - a.sessions || b.score - a.score)
  const eligibleFundSummaries = fundSummaries.filter((item) => (mode === 'all' || mode === item.mandate) && (difficulty === 'all' || item.difficulty === difficulty) && (scenario === 'all' || (item.resolvedScenario ?? item.scenario) === scenario))
  const byAsset = FUND_ASSETS.map((asset) => {
    const values = eligibleFundSummaries.map((item) => item.assetPnl?.[asset.id]).filter((value): value is number => typeof value === 'number')
    const positive = values.filter((value) => value > 0).length
    return { symbol: asset.symbol, sessions: values.length, averagePnl: average(values), hitRate: values.length ? positive / values.length : 0 }
  }).filter((item) => item.sessions > 0).sort((a, b) => b.sessions - a.sessions || b.averagePnl - a.averagePnl)
  const relationshipRows = FUND_DEALERS.map((dealer) => {
    const memory = dealerRelationships[dealer.id]
    return { ...dealer, score: memory?.relationshipScore ?? 50, rfqs: memory?.rfqs ?? 0, fills: memory?.fills ?? 0, notional: memory?.executedNotional ?? 0, savings: memory?.cumulativeSavings ?? 0 }
  }).sort((a, b) => b.score - a.score)

  const exportCsv = () => {
    const header = ['completed_at','mode','score','rating','return_pct','max_drawdown','costs','dealer_savings','execution_shortfall_bps','seed','scenario']
    const data = filtered.map((item) => [item.completedAt,item.mode,item.score,item.rating,item.returnPct,item.drawdown,item.costs,item.dealerSavings,item.executionBps ?? '',item.seed,item.scenario])
    const csv = [header, ...data].map((row) => row.map(csvEscape).join(',')).join('\n')
    download('dealersim-buy-side-progress.csv', csv)
  }

  return <div className="progress-overlay" role="dialog" aria-modal="true" aria-label="Buy-side progress dashboard">
    <main className="progress-dashboard buy-side-progress-dashboard">
      <header className="progress-header"><div><p className="eyebrow">BUY-SIDE PERFORMANCE HISTORY</p><h1>Portfolio progress</h1><p>Compare macro, long/short and long-only sessions. Dealer relationships persist locally across fund sessions.</p></div><div className="progress-actions">{filtered.length > 0 && <button className="button button-ghost" onClick={exportCsv}>Export</button>}<button className="button button-ghost" onClick={onClose}>Close</button></div></header>
      <section className="progress-filters"><label><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value as Mode)}><option value="all">All buy-side modes</option><option value="live">Live macro</option><option value="strategic">Strategic PM</option><option value="long-short">Long / short HF</option><option value="long-only">Long-only PM</option></select></label><label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All difficulties</option><option value="learning">Learning</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="assessment">Assessment</option></select></label><label><span>Scenario / regime</span><select value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="all">All scenarios</option>{scenarioOptions.map((item) => <option key={item} value={item}>{item.replaceAll('-', ' ')}</option>)}</select></label></section>
      <section className="progress-metrics"><Metric label="Sessions" value={String(filtered.length)} detail={`${rows.length} stored locally`} /><Metric label="Average score" value={filtered.length ? avgScore.toFixed(1) : '—'} detail="process score" /><Metric label="Average return" value={filtered.length ? formatPercent(avgReturn, 2) : '—'} tone={avgReturn > 0 ? 'positive' : avgReturn < 0 ? 'negative' : ''} detail="not risk-adjusted" /><Metric label="Average max DD" value={filtered.length ? formatPercent(avgDd, 2) : '—'} detail="absolute drawdown" /><Metric label="Avg execution costs" value={filtered.length ? formatMoney(avgCost) : '—'} detail="trading + borrow where relevant" /><Metric label="Dealer savings" value={filtered.length ? formatMoney(totalDealerSavings) : '—'} tone={totalDealerSavings > 0 ? 'positive' : totalDealerSavings < 0 ? 'negative' : ''} detail="versus synthetic direct benchmark" /></section>
      <div className="progress-main-grid">
        <section className="progress-panel progress-trend-panel"><div className="section-heading compact"><div><p className="eyebrow">SCORE TREND</p><h2>Recent comparable sessions</h2></div></div><BuySideTrend rows={recent} /></section>
        <section className="progress-panel"><div className="section-heading compact"><div><p className="eyebrow">SKILL PROFILE</p><h2>Process by skill</h2></div></div><div className="progress-skill-list">{skillRows.map(([label, value]) => <div className="progress-skill-row" key={label}><span>{label}</span><div><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div><strong>{value ? value.toFixed(0) : '—'}</strong></div>)}</div></section>
        <section className="progress-panel progress-table-panel"><div className="section-heading compact"><div><p className="eyebrow">REGIME BREAKDOWN</p><h2>Performance by scenario</h2></div></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Scenario</th><th>Sessions</th><th>Avg score</th><th>Avg return</th><th>Avg DD</th></tr></thead><tbody>{byScenario.map((row) => <tr key={row.name}><td>{row.name.replaceAll('-', ' ')}</td><td>{row.sessions}</td><td>{row.score.toFixed(1)}</td><td className={row.returnPct >= 0 ? 'positive' : 'negative'}>{formatPercent(row.returnPct, 2)}</td><td>{formatPercent(row.drawdown, 2)}</td></tr>)}</tbody></table></div></section>
        {byAsset.length > 0 && <section className="progress-panel progress-table-panel"><div className="section-heading compact"><div><p className="eyebrow">INSTRUMENT BREAKDOWN</p><h2>Fund P&amp;L by asset</h2></div></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Asset</th><th>Sessions</th><th>Avg P&amp;L</th><th>Positive sessions</th></tr></thead><tbody>{byAsset.map((row) => <tr key={row.symbol}><td>{row.symbol}</td><td>{row.sessions}</td><td className={row.averagePnl >= 0 ? 'positive' : 'negative'}>{formatMoney(row.averagePnl)}</td><td>{formatPercent(row.hitRate)}</td></tr>)}</tbody></table></div></section>}
        <section className="progress-panel"><div className="section-heading compact"><div><p className="eyebrow">DEALER NETWORK</p><h2>Persistent counterparty relationships</h2></div></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Dealer</th><th>Relationship</th><th>RFQs</th><th>Fill rate</th><th>Avg saving</th><th>Specialties</th></tr></thead><tbody>{relationshipRows.map((dealer) => <tr key={dealer.id}><td>{dealer.name}</td><td>{dealer.score.toFixed(0)}/100</td><td>{dealer.rfqs}</td><td>{formatPercent(dealer.rfqs ? dealer.fills / dealer.rfqs : 0)}</td><td>{dealer.notional > 0 ? `${(dealer.savings / dealer.notional * 10000).toFixed(1)}bp` : '—'}</td><td>{dealer.specialties.map((id) => id.replace('-fund','').toUpperCase()).join(', ')}</td></tr>)}</tbody></table></div><p className="progress-note">Repeated successful execution modestly improves future pricing; product specialists tend to show more capacity and tighter quotes.</p></section>
        <section className="progress-panel progress-table-panel"><div className="section-heading compact"><div><p className="eyebrow">SESSION LOG</p><h2>Recent buy-side runs</h2></div><button className="text-button" onClick={onClearHistory}>Clear history</button></div><div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Mode</th><th>Score</th><th>Return</th><th>DD</th><th>Costs</th><th>Exec IS</th><th>Seed</th></tr></thead><tbody>{[...filtered].reverse().slice(0, 20).map((item) => <tr key={item.id}><td>{modeLabel(item.mode)}<small className="table-subline">{item.scenario.replaceAll('-',' ')}</small></td><td>{item.score.toFixed(1)}<small className="table-subline">{item.rating}</small></td><td className={item.returnPct >= 0 ? 'positive' : 'negative'}>{formatPercent(item.returnPct, 2)}</td><td>{formatPercent(Math.abs(item.drawdown), 2)}</td><td>{formatMoney(item.costs)}</td><td>{item.executionBps === undefined ? '—' : `${item.executionBps.toFixed(1)}bp`}</td><td>{item.seed}</td></tr>)}</tbody></table></div></section>
      </div>
    </main>
  </div>
}

function Metric({ label, value, detail, tone = '' }: { label: string; value: string; detail: string; tone?: string }) { return <article><span>{label}</span><strong className={tone}>{value}</strong><small>{detail}</small></article> }
function modeLabel(mode: Exclude<Mode, 'all'>) { return mode === 'live' ? 'Live macro' : mode === 'strategic' ? 'Strategic PM' : mode === 'long-short' ? 'Long/Short HF' : 'Long-only PM' }
function csvEscape(value: string | number) { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text }
function download(filename: string, body: string) { const blob = new Blob([body], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

function BuySideTrend({ rows }: { rows: Row[] }) {
  if (!rows.length) return <div className="progress-empty-chart">Complete a buy-side session to build a trend.</div>
  const w = 760, h = 210, px = 34, py = 24
  const lo = Math.max(0, Math.min(...rows.map((r) => r.score), 50) - 5), hi = Math.min(100, Math.max(...rows.map((r) => r.score), 85) + 5), range = Math.max(1, hi - lo)
  const x = (i: number) => rows.length === 1 ? w / 2 : px + i * (w - 2 * px) / (rows.length - 1)
  const y = (v: number) => h - py - (v - lo) / range * (h - 2 * py)
  return <div className="progress-trend-chart"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Buy-side score trend"><polyline points={rows.map((r, i) => `${x(i)},${y(r.score)}`).join(' ')} className="trend-line" />{rows.map((r, i) => <circle key={r.id} cx={x(i)} cy={y(r.score)} r={i === rows.length - 1 ? 5 : 3.2} className={i === rows.length - 1 ? 'trend-dot latest' : 'trend-dot'}><title>{`${modeLabel(r.mode)} · ${r.score.toFixed(1)} · seed ${r.seed}`}</title></circle>)}</svg></div>
}
