import { useMemo, useState } from 'react'
import { FUND_ASSET_MAP } from '../engine/fund'
import type { FundSessionSnapshot } from '../engine/fund-types'
import { formatMoney, formatTime } from '../lib/format'

export function FundDecisionReplay({ snapshot }: { snapshot: FundSessionSnapshot }) {
  const [cursor, setCursor] = useState(snapshot.options.durationSeconds)
  const point = useMemo(() => {
    return snapshot.history.reduce((best, item) => Math.abs(item.elapsedSeconds - cursor) < Math.abs(best.elapsedSeconds - cursor) ? item : best, snapshot.history[0])
  }, [cursor, snapshot.history])
  const nearby = snapshot.auditTrail
    .filter((item) => item.timestamp <= cursor + 0.01)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 6)
  const nextEvent = snapshot.calendar.filter((item) => item.releaseAtSeconds > cursor).sort((a, b) => a.releaseAtSeconds - b.releaseAtSeconds)[0]
  const activeWeights = Object.keys(snapshot.positions).map((id) => {
    const assetId = id as keyof typeof snapshot.positions
    const latestTrade = snapshot.trades.filter((trade) => trade.assetId === assetId && trade.timestamp <= cursor).sort((a, b) => b.timestamp - a.timestamp)[0]
    return { id: assetId, weight: latestTrade?.targetWeight ?? 0 }
  }).filter((item) => Math.abs(item.weight) > .005).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 4)

  return <section className="review-panel decision-replay-panel">
    <div className="section-heading compact"><div><p className="eyebrow">DECISION REPLAY</p><h2>Scrub the session timeline</h2></div><strong>{formatTime(cursor)}</strong></div>
    <input className="decision-replay-range" aria-label="Session replay time" type="range" min="0" max={snapshot.options.durationSeconds} step="1" value={cursor} onChange={(event) => setCursor(Number(event.target.value))} />
    <div className="decision-replay-snapshot">
      <div><span>NAV</span><strong>{formatMoney(point.nav)}</strong></div>
      <div><span>Benchmark</span><strong>{formatMoney(point.benchmarkNav)}</strong></div>
      <div><span>Drawdown</span><strong>{(Math.abs(point.drawdown) * 100).toFixed(2)}%</strong></div>
      <div><span>Next catalyst</span><strong>{nextEvent ? `${nextEvent.assetId ? FUND_ASSET_MAP[nextEvent.assetId].symbol : 'MACRO'} · ${formatTime(nextEvent.releaseAtSeconds - cursor)}` : 'None'}</strong></div>
    </div>
    <div className="decision-replay-grid">
      <div className="decision-replay-positions"><b>Largest positions at this point</b>{activeWeights.length ? activeWeights.map((item) => <span key={item.id}><strong>{FUND_ASSET_MAP[item.id].symbol}</strong>{item.weight >= 0 ? '+' : ''}{(item.weight * 100).toFixed(1)}%</span>) : <span>All cash / negligible positions.</span>}</div>
      <div className="decision-replay-events"><b>Latest decisions &amp; information</b>{nearby.length ? nearby.map((item) => <article key={item.id} className={item.severity ?? 'info'}><time>{formatTime(item.timestamp)}</time><div><strong>{item.title}</strong><p>{item.detail}</p></div></article>) : <span>No decisions yet.</span>}</div>
    </div>
  </section>
}
