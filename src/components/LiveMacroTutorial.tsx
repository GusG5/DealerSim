import { useState } from 'react'

interface Props { onExit: () => void; onStartPractice: () => void }

const steps = [
  {
    title: 'You run a live macro book',
    body: 'The market does not wait for you to advance a day. ES, Treasuries, Bunds, Brent, gold and EUR/USD move continuously while scheduled releases count down.',
    bullets: ['25-minute default session', '$100m synthetic NAV', '150% gross limit', '10% hard drawdown stop'],
  },
  {
    title: 'Express the view as portfolio risk',
    body: 'Select an asset and size the trade either by typing the dollar notional you want to buy or sell, or by setting a target NAV weight. The terminal always shows the resulting portfolio weight before execution.',
    bullets: ['Type an exact $m trade amount for fast execution', 'Switch to target-weight mode when you want precise portfolio construction', 'Watch gross/net exposure and factor concentration before sending'],
  },
  {
    title: 'Choose how to execute',
    body: 'For a meaningful reallocation you can cross the direct market, ask 3–5 dealers for firm block liquidity, or work the order over time while prices continue moving. Dealer quotes now support 25%, 50%, 75%, maximum and exact custom-dollar fills.',
    bullets: ['Direct: certainty, immediate cost', 'Dealer RFQ: choose the counterparty and exact block amount to fill', 'Work order: lower expected cost, but market risk while unfilled'],
  },
  {
    title: 'News is about the surprise',
    body: 'Scheduled releases show consensus before they hit. Actual data arrives against that expectation and propagates through cross-asset factors. The same shock affects assets differently.',
    bullets: ['CPI can reprice rates, equities, gold and FX together', 'Energy shocks transmit most strongly into Brent', 'Relationships remain noisy rather than deterministic'],
  },
  {
    title: 'Journal the trades that matter',
    body: 'Unlike Strategic PM mode, live trading does not force a thesis form for every resize. Turn on thesis recording when you want a major position assessed against an explicit rationale and invalidation condition.',
    bullets: ['Fast hedges can stay unjournalled', 'Record high-conviction views', 'Review P&L by asset, factor and execution route afterwards'],
  },
]

export function LiveMacroTutorial({ onExit, onStartPractice }: Props) {
  const [step, setStep] = useState(0)
  const item = steps[step]
  return <main className="macro-tutorial-shell"><section className="macro-tutorial-card"><header><div><p className="eyebrow">GLOBAL MACRO TRADER</p><h1>Live trading tutorial</h1></div><button className="button button-ghost" type="button" onClick={onExit}>Exit tutorial</button></header><div className="macro-tutorial-progress"><span style={{ width: `${(step + 1) / steps.length * 100}%` }} /></div><div className="macro-tutorial-body"><p className="eyebrow">STEP {step + 1} / {steps.length}</p><h2>{item.title}</h2><p>{item.body}</p><div className="macro-tutorial-checklist">{item.bullets.map((bullet, index) => <div key={bullet}><b>{index + 1}</b><span>{bullet}</span></div>)}</div></div><footer><button className="button button-ghost" type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button>{step < steps.length - 1 ? <button className="button button-primary" type="button" onClick={() => setStep((value) => value + 1)}>Next</button> : <button className="button button-primary" type="button" onClick={onStartPractice}>Start guided live session</button>}</footer></section></main>
}
