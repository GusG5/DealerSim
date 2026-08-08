import { useMemo, useState } from 'react'
import type { Difficulty, SessionMode, SessionSummary } from '../types'
import { formatPercent, titleCase } from '../lib/format'

interface ProgressDashboardProps {
  summaries: SessionSummary[]
  onClose: () => void
  onClearHistory: () => void
}

type ModeFilter = 'all' | SessionMode

type DifficultyFilter = 'all' | Difficulty

export function ProgressDashboard({ summaries, onClose, onClearHistory }: ProgressDashboardProps) {
  const [mode, setMode] = useState<ModeFilter>('all')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all')
  const [instrument, setInstrument] = useState('all')
  const [scenario, setScenario] = useState('all')

  const instrumentOptions = useMemo(() => [...new Set(summaries.map((item) => item.instrumentSymbol))].sort(), [summaries])
  const scenarioOptions = useMemo(() => [...new Set(summaries.map((item) => item.scenario))].sort(), [summaries])

  const filtered = useMemo(() => summaries.filter((item) => {
    const resolvedMode = item.sessionMode ?? (item.instrumentId === 'multi' ? 'dual' : 'single')
    if (mode !== 'all' && resolvedMode !== mode) return false
    if (difficulty !== 'all' && item.difficulty !== difficulty) return false
    if (instrument !== 'all' && item.instrumentSymbol !== instrument) return false
    if (scenario !== 'all' && item.scenario !== scenario) return false
    return true
  }), [difficulty, instrument, mode, scenario, summaries])

  const chronological = [...filtered].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
  const recent = chronological.slice(-24)
  const avgScore = average(filtered.map((item) => item.score))
  const bestScore = filtered.length ? Math.max(...filtered.map((item) => item.score)) : 0
  const avgAcceptance = average(filtered.map((item) => item.acceptanceRate))
  const avgStale = average(filtered.map((item) => item.staleQuoteRate))
  const recentFive = average(chronological.slice(-5).map((item) => item.score))
  const priorFive = average(chronological.slice(-10, -5).map((item) => item.score))
  const scoreDelta = priorFive > 0 ? recentFive - priorFive : 0

  const breakdown = [
    ['P&L', averageDefined(filtered.map((item) => item.pnlScore))],
    ['Commission', averageDefined(filtered.map((item) => item.commissionScore))],
    ['Inventory', averageDefined(filtered.map((item) => item.inventoryScore))],
    ['Quote quality', averageDefined(filtered.map((item) => item.quoteQualityScore))],
    ['Adverse selection', averageDefined(filtered.map((item) => item.adverseSelectionScore))],
    ['Execution', averageDefined(filtered.map((item) => item.executionScore))],
  ] as const

  const byInstrument = useMemo(() => {
    const groups = new Map<string, SessionSummary[]>()
    for (const item of filtered) groups.set(item.instrumentSymbol, [...(groups.get(item.instrumentSymbol) ?? []), item])
    return [...groups.entries()]
      .map(([symbol, items]) => ({
        symbol,
        sessions: items.length,
        averageScore: average(items.map((item) => item.score)),
        bestScore: Math.max(...items.map((item) => item.score)),
        acceptance: average(items.map((item) => item.acceptanceRate)),
        stale: average(items.map((item) => item.staleQuoteRate)),
      }))
      .sort((a, b) => b.sessions - a.sessions || b.averageScore - a.averageScore)
  }, [filtered])

  const byScenario = useMemo(() => {
    const groups = new Map<string, SessionSummary[]>()
    for (const item of filtered) groups.set(item.scenario, [...(groups.get(item.scenario) ?? []), item])
    return [...groups.entries()].map(([name, items]) => ({ name, sessions: items.length, averageScore: average(items.map((item) => item.score)), acceptance: average(items.map((item) => item.acceptanceRate)), stale: average(items.map((item) => item.staleQuoteRate)) })).sort((a, b) => b.sessions - a.sessions || b.averageScore - a.averageScore)
  }, [filtered])

  const exportHistory = () => {
    const header = ['completed_at', 'mode', 'instrument', 'scenario', 'difficulty', 'seed', 'score', 'rating', 'acceptance_rate', 'stale_quote_rate', 'commission', 'net_pnl', 'internalisation_rate', 'market_impact_cost']
    const rows = filtered.map((item) => [
      item.completedAt,
      item.sessionMode ?? (item.instrumentId === 'multi' ? 'dual' : 'single'),
      item.instrumentSymbol,
      item.scenario,
      item.difficulty,
      item.seed,
      item.score,
      item.rating,
      item.acceptanceRate,
      item.staleQuoteRate,
      item.grossCommission,
      item.netPnl,
      item.internalisationRate ?? '',
      item.marketImpactCost ?? '',
    ])
    const body = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
    downloadBlob('dealersim-progress.csv', body, 'text/csv')
  }

  return (
    <div className="progress-overlay" role="dialog" aria-modal="true" aria-label="DealerSim progress dashboard">
      <main className="progress-dashboard">
        <header className="progress-header">
          <div>
            <p className="eyebrow">DEALER PERFORMANCE HISTORY</p>
            <h1>Progress dashboard</h1>
            <p>Local session history only. Use filters to compare like-for-like market environments.</p>
          </div>
          <div className="progress-actions">
            {filtered.length > 0 && <button className="button button-ghost" type="button" onClick={exportHistory}>Export history</button>}
            <button className="button button-ghost" type="button" onClick={onClose}>Close</button>
          </div>
        </header>

        <section className="progress-filters">
          <label><span>Desk mode</span><select value={mode} onChange={(event) => setMode(event.target.value as ModeFilter)}><option value="all">All modes</option><option value="single">Single</option><option value="dual">Dual</option><option value="triple">Three-market</option></select></label>
          <label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyFilter)}><option value="all">All difficulties</option><option value="learning">Learning</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="assessment">Assessment</option></select></label>
          <label><span>Instrument / desk</span><select value={instrument} onChange={(event) => setInstrument(event.target.value)}><option value="all">All instruments</option>{instrumentOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <label><span>Scenario / regime</span><select value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="all">All scenarios</option>{scenarioOptions.map((item) => <option value={item} key={item}>{titleCase(item)}</option>)}</select></label>
        </section>

        <section className="progress-metrics">
          <ProgressMetric label="Sessions" value={String(filtered.length)} detail={`${summaries.length} stored locally`} />
          <ProgressMetric label="Average score" value={filtered.length ? avgScore.toFixed(1) : '—'} detail={filtered.length ? `Best ${bestScore.toFixed(1)}` : 'Complete a session first'} />
          <ProgressMetric label="Recent trend" value={chronological.length >= 5 ? `${scoreDelta >= 0 ? '+' : ''}${scoreDelta.toFixed(1)}` : '—'} tone={scoreDelta > 0.5 ? 'positive' : scoreDelta < -0.5 ? 'negative' : ''} detail={chronological.length >= 10 ? 'last 5 vs previous 5' : 'needs 10 comparable sessions'} />
          <ProgressMetric label="Quote acceptance" value={filtered.length ? formatPercent(avgAcceptance) : '—'} detail="mean submitted quote acceptance" />
          <ProgressMetric label="Stale quote rate" value={filtered.length ? formatPercent(avgStale) : '—'} tone={avgStale > 0.18 ? 'negative' : avgStale < 0.08 && filtered.length ? 'positive' : ''} detail="lower is generally better" />
        </section>

        {filtered.length === 0 ? (
          <section className="progress-empty"><strong>No sessions match these filters.</strong><p>Change the filters or complete another DealerSim session.</p></section>
        ) : (
          <div className="progress-main-grid">
            <section className="progress-panel progress-trend-panel">
              <div className="section-heading compact"><div><p className="eyebrow">SCORE TREND</p><h2>Last {recent.length} comparable sessions</h2></div></div>
              <ScoreTrend sessions={recent} />
            </section>

            <section className="progress-panel">
              <div className="section-heading compact"><div><p className="eyebrow">SKILL PROFILE</p><h2>Average weighted components</h2></div></div>
              <div className="progress-skill-list">
                {breakdown.map(([label, value]) => <div className="progress-skill-row" key={label}><span>{label}</span><div><i style={{ width: `${value ?? 0}%` }} /></div><strong>{value === undefined ? '—' : value.toFixed(0)}</strong></div>)}
              </div>
              <p className="progress-note">Component history is available for sessions completed on v1.2 or later. Older locally stored sessions remain visible in the headline trend.</p>
            </section>

            <section className="progress-panel progress-table-panel">
              <div className="section-heading compact"><div><p className="eyebrow">MARKET BREAKDOWN</p><h2>Performance by instrument / desk</h2></div></div>
              <div className="progress-table-wrap">
                <table className="progress-table"><thead><tr><th>Market</th><th>Sessions</th><th>Avg score</th><th>Best</th><th>Acceptance</th><th>Stale</th></tr></thead><tbody>{byInstrument.map((row) => <tr key={row.symbol}><td>{row.symbol}</td><td>{row.sessions}</td><td>{row.averageScore.toFixed(1)}</td><td>{row.bestScore.toFixed(1)}</td><td>{formatPercent(row.acceptance)}</td><td>{formatPercent(row.stale)}</td></tr>)}</tbody></table>
              </div>
            </section>

            <section className="progress-panel progress-table-panel">
              <div className="section-heading compact"><div><p className="eyebrow">REGIME BREAKDOWN</p><h2>Performance by scenario</h2></div></div>
              <div className="progress-table-wrap"><table className="progress-table"><thead><tr><th>Scenario</th><th>Sessions</th><th>Avg score</th><th>Acceptance</th><th>Stale</th></tr></thead><tbody>{byScenario.map((row) => <tr key={row.name}><td>{titleCase(row.name)}</td><td>{row.sessions}</td><td>{row.averageScore.toFixed(1)}</td><td>{formatPercent(row.acceptance)}</td><td>{formatPercent(row.stale)}</td></tr>)}</tbody></table></div>
            </section>

            <section className="progress-panel progress-history-panel">
              <div className="section-heading compact"><div><p className="eyebrow">SESSION LOG</p><h2>Recent comparable runs</h2></div><button className="text-button" type="button" onClick={onClearHistory}>Clear all</button></div>
              <div className="progress-session-list">
                {[...filtered].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)).slice(0, 18).map((item) => <article key={item.id}><div><strong>{item.score.toFixed(1)}</strong><span>{item.rating}</span></div><div><strong>{item.instrumentSymbol}</strong><span>{titleCase(item.scenario)} · {titleCase(item.difficulty)}</span></div><div><strong>{formatPercent(item.acceptanceRate)}</strong><span>accepted · {formatPercent(item.staleQuoteRate)} stale</span></div><time>{formatDate(item.completedAt)}</time></article>)}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function ProgressMetric({ label, value, detail, tone = '' }: { label: string; value: string; detail: string; tone?: string }) {
  return <article><span>{label}</span><strong className={tone}>{value}</strong><small>{detail}</small></article>
}

function ScoreTrend({ sessions }: { sessions: SessionSummary[] }) {
  if (sessions.length === 0) return <div className="progress-empty-chart">No comparable sessions.</div>
  const width = 760
  const height = 210
  const padX = 34
  const padY = 24
  const minScore = Math.max(0, Math.min(...sessions.map((item) => item.score), 50) - 5)
  const maxScore = Math.min(100, Math.max(...sessions.map((item) => item.score), 85) + 5)
  const range = Math.max(1, maxScore - minScore)
  const x = (index: number) => sessions.length === 1 ? width / 2 : padX + index * (width - padX * 2) / (sessions.length - 1)
  const y = (score: number) => height - padY - (score - minScore) / range * (height - padY * 2)
  const points = sessions.map((item, index) => `${x(index)},${y(item.score)}`).join(' ')
  const latest = sessions[sessions.length - 1]

  return (
    <div className="progress-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="DealerSim score trend">
        {[60, 75, 85].filter((level) => level >= minScore && level <= maxScore).map((level) => <g key={level}><line x1={padX} x2={width - padX} y1={y(level)} y2={y(level)} className="trend-guide" /><text x={4} y={y(level) + 4}>{level}</text></g>)}
        <polyline points={points} className="trend-line" />
        {sessions.map((item, index) => <circle key={item.id} cx={x(index)} cy={y(item.score)} r={index === sessions.length - 1 ? 5 : 3.2} className={index === sessions.length - 1 ? 'trend-dot latest' : 'trend-dot'}><title>{`${item.instrumentSymbol} · ${item.score.toFixed(1)} · ${formatDate(item.completedAt)}`}</title></circle>)}
      </svg>
      <div className="trend-caption"><span>Oldest</span><strong>Latest {latest.score.toFixed(1)} · {latest.instrumentSymbol}</strong><span>Newest</span></div>
    </div>
  )
}

function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function averageDefined(values: Array<number | undefined>): number | undefined { const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)); return clean.length ? average(clean) : undefined }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function csvEscape(value: string | number): string { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text }
function downloadBlob(filename: string, body: string, type: string): void { const blob = new Blob([body], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }
