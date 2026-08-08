import { useMemo, useState } from 'react'
import {
  DIFFICULTY_PROFILES,
  EQUITY_INSTRUMENTS,
  EUR_USD,
  MACRO_FUTURES,
  SCENARIO_PROFILES,
  getInstrument,
  getInstrumentTrainingProfile,
} from '../engine/config'
import type {
  Difficulty,
  InstrumentId,
  MultiSessionOptions,
  ScenarioFamily,
  SessionMode,
  SessionOptions,
  SessionSummary,
} from '../types'
import { formatInstrumentMoney, formatMoney, formatPercent, titleCase } from '../lib/format'

interface SessionSetupProps {
  summaries: SessionSummary[]
  onStart: (options: SessionOptions) => void
  onStartMulti: (options: MultiSessionOptions) => void
  onOpenTutorial: () => void
  onOpenMethodology: () => void
  onOpenProgress: () => void
  onClearHistory: () => void
  onOpenMacro: () => void
}

const scenarios: ScenarioFamily[] = [
  'random',
  'balanced',
  'one-way',
  'fast-market',
  'illiquid',
  'news-shock',
  'toxic-flow',
]

const multiMarketChoices = [...EQUITY_INSTRUMENTS, ...MACRO_FUTURES]
const pairPresets: { label: string; detail: string; first: InstrumentId; second: InstrumentId }[] = [
  { label: 'MEGA + ES', detail: 'Mega-cap flow against the broad equity index.', first: 'mega-equity', second: 'sp500' },
  { label: 'FGBL + ES', detail: 'Rates versus equities around shared macro releases.', first: 'bund', second: 'sp500' },
  { label: 'BRN + ES', detail: 'Energy shocks, risk sentiment and competing RFQs.', first: 'brent', second: 'sp500' },
  { label: 'APEX + MEGA', detail: 'Two equity books with different liquidity and impact.', first: 'apex-equity', second: 'mega-equity' },
  { label: 'LUMA + ORBX', detail: 'Thin-liquidity desk: cancellation risk, market impact and slower replenishment.', first: 'luma-equity', second: 'orbx-equity' },
]

const triplePresets: { label: string; detail: string; first: InstrumentId; second: InstrumentId; third: InstrumentId }[] = [
  { label: 'MEGA + NOVA + ES', detail: 'Equity desk: two single stocks plus the index hedge.', first: 'mega-equity', second: 'nova-equity', third: 'sp500' },
  { label: 'FGBL + ES + BRN', detail: 'Macro desk: rates, equities and crude around shared releases.', first: 'bund', second: 'sp500', third: 'brent' },
  { label: 'APEX + MEGA + NOVA', detail: 'Three equity books with different liquidity and impact.', first: 'apex-equity', second: 'mega-equity', third: 'nova-equity' },
  { label: 'MEGA + LUMA + ORBX', detail: 'Liquidity spectrum: deep mega-cap through stressed event-driven equity.', first: 'mega-equity', second: 'luma-equity', third: 'orbx-equity' },
]

export function SessionSetup({
  summaries,
  onStart,
  onStartMulti,
  onOpenTutorial,
  onOpenMethodology,
  onOpenProgress,
  onClearHistory,
  onOpenMacro,
}: SessionSetupProps) {
  const [mode, setMode] = useState<SessionMode>('single')
  const [instrumentId, setInstrumentId] = useState<InstrumentId>('apex-equity')
  const [secondInstrumentId, setSecondInstrumentId] = useState<InstrumentId>('sp500')
  const [thirdInstrumentId, setThirdInstrumentId] = useState<InstrumentId>('brent')
  const [scenario, setScenario] = useState<ScenarioFamily>('random')
  const [difficulty, setDifficulty] = useState<Difficulty>('standard')
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 900_000_000) + 100_000_000)

  const bestScore = useMemo(
    () => summaries.reduce((best, item) => Math.max(best, item.score), 0),
    [summaries],
  )

  const safeSecondInstrumentId = instrumentId === secondInstrumentId
    ? multiMarketChoices.find((instrument) => instrument.id !== instrumentId)?.id ?? 'sp500'
    : secondInstrumentId
  const safeThirdInstrumentId = [instrumentId, safeSecondInstrumentId].includes(thirdInstrumentId)
    ? multiMarketChoices.find((instrument) => ![instrumentId, safeSecondInstrumentId].includes(instrument.id))?.id ?? 'brent'
    : thirdInstrumentId

  const start = () => {
    const cleanSeed = Math.max(1, Math.floor(seed || Date.now()))
    const effectiveScenario: ScenarioFamily = difficulty === 'assessment' ? 'random' : scenario
    if (mode === 'dual' || mode === 'triple') {
      onStartMulti({
        seed: cleanSeed,
        scenario: effectiveScenario,
        difficulty,
        durationSeconds: 15 * 60,
        instruments: mode === 'triple'
          ? [getInstrument(instrumentId), getInstrument(safeSecondInstrumentId), getInstrument(safeThirdInstrumentId)]
          : [getInstrument(instrumentId), getInstrument(safeSecondInstrumentId)],
        coachingMode: difficulty === 'learning' ? 'assisted' : 'none',
      })
      return
    }
    onStart({
      seed: cleanSeed,
      scenario: effectiveScenario,
      difficulty,
      durationSeconds: 15 * 60,
      instrument: getInstrument(instrumentId),
      coachingMode: difficulty === 'learning' ? 'assisted' : 'none',
    })
  }

  const generateDrill = () => {
    const pool = [...EQUITY_INSTRUMENTS, ...MACRO_FUTURES]
    const nextInstrument = pool[Math.floor(Math.random() * pool.length)]
    const nextScenario = scenarios[Math.floor(Math.random() * scenarios.length)]
    const nextDifficulty = (['standard', 'advanced', 'assessment'] as Difficulty[])[Math.floor(Math.random() * 3)]
    setInstrumentId(nextInstrument.id)
    setScenario(nextScenario)
    setDifficulty(nextDifficulty)
    setSeed(Math.floor(Math.random() * 900_000_000) + 100_000_000)
  }

  const startDemo = () => {
    onStart({
      seed: 350_501,
      scenario: 'news-shock',
      difficulty: 'learning',
      durationSeconds: 5 * 60,
      instrument: getInstrument('mega-equity'),
      coachingMode: 'assisted',
    })
  }

  const applyPreset = (first: InstrumentId, second: InstrumentId) => {
    setMode('dual')
    setInstrumentId(first)
    setSecondInstrumentId(second)
  }
  const applyTriplePreset = (first: InstrumentId, second: InstrumentId, third: InstrumentId) => {
    setMode('triple')
    setInstrumentId(first)
    setSecondInstrumentId(second)
    setThirdInstrumentId(third)
  }

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark">DS</span>
            <div>
              <p className="eyebrow">SINGLE-PLAYER DEALER TRAINING</p>
              <h1>DealerSim</h1>
            </div>
          </div>
          <p className="landing-copy">
            Price institutional blocks, internalise client flow and manage exchange execution across synthetic dealer markets.
          </p>
        </div>
        <div className="header-actions">
          <button className="button button-primary buyside-entry-button" type="button" onClick={onOpenMacro}>Global Macro</button>
          <button className="button button-ghost demo-button" type="button" onClick={startDemo}>5-min Demo</button>
          <button className="button button-ghost" type="button" onClick={onOpenTutorial}>Interactive tutorial</button>
          <button className="button button-ghost" type="button" onClick={onOpenProgress}>Progress</button>
          <button className="button button-ghost" type="button" onClick={onOpenMethodology}>Methodology</button>
        </div>
      </header>

      <section className="landing-metrics" aria-label="Progress summary">
        <article className="landing-metric"><span>Sessions</span><strong>{summaries.length}</strong></article>
        <article className="landing-metric"><span>Best score</span><strong>{bestScore ? bestScore.toFixed(1) : '—'}</strong></article>
        <article className="landing-metric">
          <span>{mode === 'single' ? 'Primary market' : 'Active desk'}</span>
          <strong>{mode === 'triple' ? `${getInstrument(instrumentId).symbol} + ${getInstrument(safeSecondInstrumentId).symbol} + ${getInstrument(safeThirdInstrumentId).symbol}` : mode === 'dual' ? `${getInstrument(instrumentId).symbol} + ${getInstrument(safeSecondInstrumentId).symbol}` : getInstrument(instrumentId).symbol}</strong>
        </article>
        <article className="landing-metric"><span>Session length</span><strong>15:00</strong></article>
      </section>

      <div className="landing-grid">
        <section className="setup-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SESSION CONFIGURATION</p>
              <h2>Scenario builder</h2>
            </div>
            <span className="status-chip status-live">Synthetic market</span>
          </div>

          <div className="session-mode-toggle" role="group" aria-label="Session mode">
            <button type="button" className={mode === 'single' ? 'selected' : ''} onClick={() => setMode('single')}>
              <strong>Single market</strong><span>Full-depth block market making</span>
            </button>
            <button type="button" className={mode === 'dual' ? 'selected' : ''} onClick={() => { setMode('dual'); if (!multiMarketChoices.some((instrument) => instrument.id === instrumentId)) setInstrumentId('mega-equity') }}>
              <strong>Dual market</strong><span>Two live books, overlapping RFQs and shared macro news</span>
            </button>
            <button type="button" className={mode === 'triple' ? 'selected' : ''} onClick={() => { setMode('triple'); if (!multiMarketChoices.some((instrument) => instrument.id === instrumentId)) setInstrumentId('mega-equity') }}>
              <strong>Three-market desk</strong><span>Three live books, shared factors and competing attention</span>
            </button>
          </div>

          {mode === 'single' ? (
            <>
              <div className="instrument-section-label">
                <span>Equity block markets</span>
                <small>Same core mechanics, materially different liquidity, volatility and market impact.</small>
              </div>
              <div className="instrument-grid instrument-grid-equities">
                {EQUITY_INSTRUMENTS.map((instrument) => {
                  const profile = instrument.equityProfile
                  const selected = instrumentId === instrument.id
                  return (
                    <button className={`instrument-card instrument-card-profile${selected ? ' selected' : ''}`} type="button" key={instrument.id} onClick={() => setInstrumentId(instrument.id)}>
                      <div className="instrument-card-title"><strong>{instrument.symbol}</strong><em>${instrument.initialPrice.toFixed(2)}</em></div>
                      <span>{profile?.archetype ?? 'Equity block market'}</span>
                      <small>{profile?.description}</small>
                      <div className="instrument-profile-chips"><b>Liq {profile?.liquidityLabel}</b><b>Vol {profile?.volatilityLabel}</b><b>Impact {profile?.impactLabel}</b></div>
                      <div className="instrument-rfq-range">Typical RFQ {profile?.typicalRfqMinM}–{profile?.typicalRfqMaxM}k shares</div>
                    </button>
                  )
                })}
              </div>

              <div className="instrument-section-label macro-section-label">
                <span>Macro futures</span>
                <small>Rates, crude oil and equity-index futures with contract-specific depth, tick value and news sensitivity.</small>
              </div>
              <div className="instrument-grid instrument-grid-macro">
                {MACRO_FUTURES.map((instrument) => {
                  const profile = getInstrumentTrainingProfile(instrument)
                  const selected = instrumentId === instrument.id
                  return (
                    <button className={`instrument-card instrument-card-profile macro-instrument-card${selected ? ' selected' : ''}`} type="button" key={instrument.id} onClick={() => setInstrumentId(instrument.id)}>
                      <div className="instrument-card-title"><strong>{instrument.symbol}</strong><em>{instrument.initialPrice.toFixed(instrument.priceDecimals)}</em></div>
                      <span>{profile?.archetype}</span>
                      <small>{profile?.marketFocus}</small>
                      <div className="instrument-profile-chips"><b>Liq {profile?.liquidityLabel}</b><b>Vol {profile?.volatilityLabel}</b><b>Impact {profile?.impactLabel}</b></div>
                      <div className="instrument-rfq-range">Typical RFQ {profile?.typicalRfqMinM}–{profile?.typicalRfqMaxM} contracts</div>
                    </button>
                  )
                })}
              </div>

              <div className="legacy-market-row">
                <button className={`instrument-card legacy-instrument-card${instrumentId === EUR_USD.id ? ' selected' : ''}`} type="button" onClick={() => setInstrumentId(EUR_USD.id)}>
                  <strong>EUR/USD</strong>
                  <small>Legacy FX mode retained for comparison. DealerSim prioritises equity and macro futures market making.</small>
                </button>
                <div className="next-market-note"><span>v1.0 cross-asset</span><strong>Dual + three-market desks</strong><small>Shared factors, macro expectations and interactive worked orders.</small></div>
              </div>
            </>
          ) : (
            <div className="dual-market-setup">
              <div className="instrument-section-label">
                <span>{mode === 'triple' ? 'Three-market cross-asset desk' : 'Simultaneous desk'}</span>
                <small>{mode === 'triple' ? 'Three books run continuously with common macro factors, persistent client flow and overlapping RFQs.' : 'Both books run continuously. RFQs can overlap and one shared macro headline can move both markets differently.'}</small>
              </div>
              <div className="dual-preset-grid">
                {(mode === 'triple' ? triplePresets : pairPresets).map((preset) => {
                  const selected = mode === 'triple'
                    ? instrumentId === preset.first && safeSecondInstrumentId === preset.second && safeThirdInstrumentId === (preset as typeof triplePresets[number]).third
                    : instrumentId === preset.first && safeSecondInstrumentId === preset.second
                  return (
                    <button type="button" className={`dual-preset-card${selected ? ' selected' : ''}`} key={preset.label} onClick={() => mode === 'triple' ? applyTriplePreset(preset.first, preset.second, (preset as typeof triplePresets[number]).third) : applyPreset(preset.first, preset.second)}>
                      <strong>{preset.label}</strong><span>{preset.detail}</span>
                    </button>
                  )
                })}
              </div>
              <div className="dual-select-grid" style={{ gridTemplateColumns: mode === 'triple' ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))' }}>
                <label>
                  <span>Market A</span>
                  <select value={instrumentId} onChange={(event) => setInstrumentId(event.target.value as InstrumentId)}>
                    {multiMarketChoices.map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.symbol} — {instrument.displayName}</option>)}
                  </select>
                </label>
                <label>
                  <span>Market B</span>
                  <select value={safeSecondInstrumentId} onChange={(event) => setSecondInstrumentId(event.target.value as InstrumentId)}>
                    {multiMarketChoices.filter((instrument) => instrument.id !== instrumentId).map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.symbol} — {instrument.displayName}</option>)}
                  </select>
                </label>
                {mode === 'triple' && (
                  <label>
                    <span>Market C</span>
                    <select value={safeThirdInstrumentId} onChange={(event) => setThirdInstrumentId(event.target.value as InstrumentId)}>
                      {multiMarketChoices.filter((instrument) => ![instrumentId, safeSecondInstrumentId].includes(instrument.id)).map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.symbol} — {instrument.displayName}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <div className="dual-market-explainer">
                <div><span>RFQs</span><strong>Can overlap</strong></div>
                <div><span>News</span><strong>Shared macro tape</strong></div>
                <div><span>Risk</span><strong>Portfolio-normalised</strong></div>
                <div><span>Execution</span><strong>Per-market books</strong></div>
              </div>
            </div>
          )}

          <div className="scenario-grid">
            {scenarios.map((item) => {
              const selected = difficulty === 'assessment' ? item === 'random' : scenario === item
              const label = item === 'random' ? 'Unknown Market' : SCENARIO_PROFILES[item].label
              const description = item === 'random'
                ? 'The regime is hidden. Interpret volatility, liquidity and client flow as the session develops.'
                : SCENARIO_PROFILES[item].description
              return (
                <button disabled={difficulty === 'assessment' && item !== 'random'} className={`scenario-card${selected ? ' selected' : ''}${difficulty === 'assessment' && item !== 'random' ? ' assessment-locked' : ''}`} type="button" key={item} onClick={() => difficulty !== 'assessment' && setScenario(item)}>
                  <span>{label}</span><small>{difficulty === 'assessment' && item !== 'random' ? 'Hidden in Assessment.' : description}</small>
                </button>
              )
            })}
          </div>

          <div className="scenario-builder-actions"><button className="button button-ghost" type="button" onClick={generateDrill}>Generate random drill</button><span>Randomises instrument, regime, difficulty and seed. You can still edit every field before starting.</span></div><div className="setup-controls">
            <label>
              <span>Difficulty</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
                {Object.entries(DIFFICULTY_PROFILES).map(([value, profile]) => <option value={value} key={value}>{profile.label}</option>)}
              </select>
            </label>
            <label>
              <span>Scenario seed</span>
              <div className="seed-control">
                <input type="number" min={1} value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
                <button type="button" className="button button-small button-ghost" onClick={() => setSeed(Math.floor(Math.random() * 900_000_000) + 100_000_000)}>Randomise</button>
              </div>
            </label>
          </div>

          <div className="difficulty-note">
            <strong>{DIFFICULTY_PROFILES[difficulty].label}</strong>
            <span>RFQ windows {DIFFICULTY_PROFILES[difficulty].rfqTimeMin}–{DIFFICULTY_PROFILES[difficulty].rfqTimeMax}s · client identity {DIFFICULTY_PROFILES[difficulty].showClientType} · market speed ×{DIFFICULTY_PROFILES[difficulty].marketSpeedMultiplier.toFixed(2)}</span>
          </div>
          {difficulty === 'assessment' && <div className="assessment-note"><strong>Assessment protocol</strong><span>Unknown scenario is mandatory. Pause is disabled on the live desk and Learning coaching is removed. You are assessed on pricing, flow capture, inventory, adverse selection and execution discipline.</span></div>}

          {mode !== 'single' && difficulty === 'learning' && (
            <div className="cross-asset-learning-primer">
              <div><span>1 · Release</span><strong>Compare actual with consensus</strong><small>The surprise drives the shared factor shock.</small></div>
              <div><span>2 · Propagation</span><strong>Watch each market react differently</strong><small>Factor loadings create correlation, not lockstep movement.</small></div>
              <div><span>3 · Desk</span><strong>Manage RFQs, flow and portfolio risk together</strong><small>Other market clocks keep running while one ticket is active.</small></div>
            </div>
          )}

          <button className="button button-primary start-button" type="button" onClick={start}>
            Start 15-minute {mode === 'triple' ? 'three-market' : mode === 'dual' ? 'dual-market' : ''} session
          </button>
          <p className="disclaimer">Educational simulation only. Prices, counterparties and news events are entirely synthetic.</p>
        </section>

        <aside className="history-panel">
          <div className="section-heading compact">
            <div><p className="eyebrow">LOCAL PROGRESS</p><h2>Recent sessions</h2></div>
            <div className="history-heading-actions"><button className="text-button" type="button" onClick={onOpenProgress}>Dashboard</button>{summaries.length > 0 && <button className="text-button" type="button" onClick={onClearHistory}>Clear</button>}</div>
          </div>
          {summaries.length === 0 ? (
            <div className="empty-history"><strong>No completed sessions yet</strong><p>Results will be saved locally in this browser after each session.</p></div>
          ) : (
            <div className="history-list">
              {summaries.slice(0, 8).map((summary) => (
                <article className="history-row" key={summary.id}>
                  <div><strong>{summary.score.toFixed(1)}</strong><span>{summary.rating}</span></div>
                  <div><span>{titleCase(summary.scenario)}</span><small>{summary.instrumentSymbol} · {titleCase(summary.difficulty)} · seed {summary.seed}</small></div>
                  <div className={summary.netPnl >= 0 ? 'positive' : 'negative'}>
                    <strong>{summary.instrumentId === 'multi' ? formatMoney(summary.netPnl) : formatInstrumentMoney(summary.netPnl, getInstrument(summary.instrumentId))}</strong>
                    <small>{formatPercent(summary.acceptanceRate)} accepted</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
