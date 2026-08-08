import { describe, expect, it } from 'vitest'
import type { ScenarioFamily } from '../types'
import { EUR_USD } from './config'
import { createScenarioPlan } from './market'
import { SeededRandom } from './random'

const scenarios: Exclude<ScenarioFamily, 'random'>[] = [
  'balanced',
  'one-way',
  'fast-market',
  'illiquid',
  'news-shock',
  'toxic-flow',
]

describe('scenario news coverage', () => {
  it.each(scenarios)('includes a scheduled macro event in %s', (scenario) => {
    const plan = createScenarioPlan(scenario, 'standard', 900, EUR_USD, new SeededRandom(1200 + scenarios.indexOf(scenario)))
    expect(plan.events.length).toBeGreaterThan(0)
    expect(plan.events.some((event) => event.announceAt !== undefined)).toBe(true)
  })

  it('makes the dedicated news scenario materially larger than a balanced session for a fixed seed', () => {
    const balanced = createScenarioPlan('balanced', 'standard', 900, EUR_USD, new SeededRandom(77))
    const news = createScenarioPlan('news-shock', 'standard', 900, EUR_USD, new SeededRandom(77))
    expect(news.events[0].impactPips).toBeGreaterThan(balanced.events[0].impactPips)
  })
})
