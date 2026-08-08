import type {
  InstrumentConfig,
  MacroFactor,
  MarketRegime,
  MarketSnapshot,
  OrderBookLevel,
  ScenarioFamily,
  ScheduledMarketEvent,
} from '../types'
import { DIFFICULTY_PROFILES, SCENARIO_PROFILES, getInstrumentTrainingProfile } from './config'
import { SeededRandom } from './random'
import type { Difficulty } from '../types'

export interface MarketModelState {
  elapsed: number
  mid: number
  anchor: number
  driftPipsPerSecond: number
  volatilityPipsPerSqrtSecond: number
  meanReversion: number
  baseSpreadPips: number
  liquidity: number
  regime: MarketRegime
  shockDriftPipsPerSecond: number
  shockRemainingSeconds: number
  volatilityMultiplier: number
  liquidityMultiplier: number
  timeVolatilityMultiplier: number
  timeLiquidityMultiplier: number
  externalImpulsePips: number
  executionLiquidityDepletion: number
  cancellationPressure: number
  spreadPressurePips: number
  bookImbalance: number
  recentParticipation: number
  recentImpactPips: number
  repetitiveFlowPressure: number
  lastAggressiveSide?: 'buy' | 'sell'
  lastAggressiveAt: number
}

export interface ScenarioPlan {
  scenario: Exclude<ScenarioFamily, 'random'>
  flowBias: number
  rfqIntensity: number
  toxicityMultiplier: number
  softLimitM: number
  hardLimitM: number
  events: ScheduledMarketEvent[]
  regimeTransitions: Array<{
    at: number
    regime: MarketRegime
    volatilityMultiplier: number
    driftAdjustment: number
    liquidityMultiplier: number
  }>
}


function microstructureProfile(instrument: InstrumentConfig): NonNullable<InstrumentConfig['microstructure']> {
  if (instrument.microstructure) return instrument.microstructure
  if (instrument.id === 'mega-equity' || instrument.id === 'sp500') {
    return { cancellationSensitivity: 0.55, hiddenLiquidityShare: 0.2, spreadElasticity: 0.45, imbalanceSensitivity: 0.7, leakageSensitivity: 0.55 }
  }
  if (instrument.assetClass === 'single-stock-equity') {
    return { cancellationSensitivity: 0.9, hiddenLiquidityShare: 0.14, spreadElasticity: 0.9, imbalanceSensitivity: 1, leakageSensitivity: 0.95 }
  }
  return { cancellationSensitivity: 0.65, hiddenLiquidityShare: 0.12, spreadElasticity: 0.6, imbalanceSensitivity: 0.7, leakageSensitivity: 0.65 }
}

function liquidityRegime(effectiveLiquidity: number): MarketSnapshot['liquidityRegime'] {
  if (effectiveLiquidity >= 0.88) return 'deep'
  if (effectiveLiquidity >= 0.58) return 'normal'
  if (effectiveLiquidity >= 0.3) return 'thin'
  return 'stressed'
}

const SCENARIO_CHOICES: readonly Exclude<ScenarioFamily, 'random'>[] = [
  'balanced',
  'one-way',
  'fast-market',
  'illiquid',
  'news-shock',
  'toxic-flow',
]

export function resolveScenario(
  scenario: ScenarioFamily,
  rng: SeededRandom,
): Exclude<ScenarioFamily, 'random'> {
  return scenario === 'random' ? rng.pick(SCENARIO_CHOICES) : scenario
}

export function createScenarioPlan(
  scenarioInput: ScenarioFamily,
  difficulty: Difficulty,
  durationSeconds: number,
  instrument: InstrumentConfig,
  rng: SeededRandom,
): ScenarioPlan {
  const scenario = resolveScenario(scenarioInput, rng)
  const profile = SCENARIO_PROFILES[scenario]
  const difficultyProfile = DIFFICULTY_PROFILES[difficulty]
  const events: ScheduledMarketEvent[] = []

  const makeEvent = (
    id: string,
    triggerAt: number,
    headline: string,
    detail: string,
    impactPips: number,
    volatilityMultiplier: number,
    liquidityMultiplier: number,
    persistenceSeconds: number,
    announced: boolean,
    macroFactor: MacroFactor,
  ): ScheduledMarketEvent => ({
    id,
    announceAt: announced
      ? Math.max(4, triggerAt - difficultyProfile.eventWarningSeconds)
      : undefined,
    triggerAt,
    headline,
    detail,
    impactPips: Math.abs(impactPips) * instrument.eventSensitivity[macroFactor],
    volatilityMultiplier,
    liquidityMultiplier,
    persistenceSeconds,
    direction: rng.chance(0.5) ? 1 : -1,
    macroFactor,
    announced: false,
    triggered: false,
  })

  const trainingProfile = getInstrumentTrainingProfile(instrument)
  const profileScheduled = trainingProfile?.scheduledHeadlines.map(
    (item): [string, string, MacroFactor] => [item.headline, item.detail, item.factor],
  ) ?? []
  const genericMacro: readonly [string, string, MacroFactor][] = [
    ['US inflation data due', 'CPI may materially change rates, risk appetite and cross-asset positioning.', 'inflation'],
    ['US payrolls due', 'Labour-market data may shift growth and policy expectations.', 'growth'],
    ['Central-bank policy decision due', 'Policy guidance may reprice the relevant curve and risk assets.', 'policy'],
    ['Global growth data due', 'Activity data may alter the near-term demand and risk outlook.', 'growth'],
  ]
  const scheduledHeadlines: readonly [string, string, MacroFactor][] = profileScheduled.length
    ? [...profileScheduled, ...genericMacro]
    : genericMacro
  const [scheduledHeadline, scheduledDetail, scheduledFactor] = rng.pick(scheduledHeadlines)
  const scheduledTrigger = rng.range(durationSeconds * 0.28, durationSeconds * 0.76)

  const scheduledImpact =
    scenario === 'news-shock'
      ? rng.range(8, 22)
      : scenario === 'fast-market'
        ? rng.range(5, 12)
        : scenario === 'illiquid'
          ? rng.range(4, 9)
          : scenario === 'one-way'
            ? rng.range(4, 10)
            : rng.range(3, 8)
  const scheduledVolatility =
    scenario === 'news-shock'
      ? 2.6
      : scenario === 'fast-market'
        ? 2.15
        : scenario === 'illiquid'
          ? 1.75
          : rng.range(1.45, 1.9)
  const scheduledLiquidity =
    scenario === 'news-shock'
      ? 0.48
      : scenario === 'illiquid'
        ? 0.44
        : scenario === 'fast-market'
          ? 0.58
          : rng.range(0.66, 0.82)

  // Every scenario includes a live macro calendar. The dedicated News Shock
  // family makes the release larger and more persistent rather than being the
  // only environment in which news exists.
  const scheduledEvent = makeEvent(
    `scheduled-macro-${scenario}`,
    scheduledTrigger,
    scheduledHeadline,
    scheduledDetail,
    scheduledImpact,
    scheduledVolatility,
    scheduledLiquidity,
    scenario === 'news-shock' ? 55 : rng.range(24, 42),
    true,
    scheduledFactor,
  )
  const release = createSyntheticRelease(scheduledFactor, rng)
  scheduledEvent.releaseName = release.name
  scheduledEvent.consensus = release.consensus
  scheduledEvent.actual = release.actual
  scheduledEvent.releaseUnit = release.unit
  scheduledEvent.surpriseZ = release.surpriseZ
  scheduledEvent.direction = release.surpriseZ >= 0 ? 1 : -1
  events.push(scheduledEvent)

  // Longer practice sessions contain a second stage tied to the same macro
  // catalyst. The first reaction can either extend as flow follows the data or
  // partially reverse as positioning clears, so the user cannot treat the
  // headline as a one-tick deterministic shock.
  if (durationSeconds >= 600) {
    const followThrough = rng.chance(scenario === 'news-shock' ? 0.72 : 0.62)
    const followTrigger = Math.min(durationSeconds * 0.94, scheduledTrigger + rng.range(75, 145))
    const factorLabel: Record<MacroFactor, string> = {
      inflation: 'inflation', growth: 'growth', policy: 'policy', risk: 'risk', energy: 'energy', company: 'company',
    }
    const linked = makeEvent(
      `scheduled-follow-through-${scenario}`,
      followTrigger,
      followThrough
        ? `${factorLabel[scheduledFactor]} repricing extends after the release`
        : `${factorLabel[scheduledFactor]} move fades as positioning clears`,
      followThrough
        ? 'Follow-on flow reinforces the initial catalyst. Liquidity and client behaviour can remain one-sided even after the headline is known.'
        : 'The initial reaction partially reverses as crowded positioning is reduced and liquidity returns. Reassess rather than anchoring to the first move.',
      scheduledImpact * rng.range(0.32, 0.58),
      rng.range(1.2, 1.65),
      rng.range(0.68, 0.88),
      rng.range(24, 42),
      false,
      scheduledFactor,
    )
    linked.direction = followThrough ? scheduledEvent.direction : (scheduledEvent.direction * -1) as 1 | -1
    events.push(linked)
  }

  const surpriseProbability =
    scenario === 'fast-market' || scenario === 'toxic-flow'
      ? 0.72
      : scenario === 'news-shock'
        ? 0.4
        : 0.46
  if (rng.chance(surpriseProbability)) {
    let surpriseTrigger = rng.range(durationSeconds * 0.18, durationSeconds * 0.88)
    if (Math.abs(surpriseTrigger - scheduledTrigger) < 75) {
      surpriseTrigger = Math.min(durationSeconds * 0.92, surpriseTrigger + 95)
    }
    const profileSurprises: readonly [string, string, MacroFactor][] =
      trainingProfile?.surpriseHeadlines.map(
        (item): [string, string, MacroFactor] => [item.headline, item.detail, item.factor],
      ) ?? []
    const surpriseHeadlines: readonly [string, string, MacroFactor][] = [
      ...profileSurprises,
      ['Large block hits the exchange', 'Aggressive execution consumes displayed depth and shifts short-term price discovery.', 'risk'],
      ['Unexpected policy headline', 'A surprise policy report hits the market without advance warning.', 'policy'],
      ['Geopolitical headline hits risk sentiment', 'Broader risk markets react to an unexpected development.', 'risk'],
    ]
    const [surpriseHeadline, surpriseDetail, surpriseFactor] = rng.pick(surpriseHeadlines)
    events.push(
      makeEvent(
        `unscheduled-headline-${scenario}`,
        surpriseTrigger,
        surpriseHeadline,
        surpriseDetail,
        scenario === 'fast-market' ? rng.range(6, 14) : rng.range(3, 10),
        scenario === 'fast-market' ? 2.1 : rng.range(1.45, 1.9),
        scenario === 'illiquid' ? 0.46 : rng.range(0.58, 0.76),
        rng.range(24, 40),
        false,
        surpriseFactor,
      ),
    )
  }

  if (durationSeconds >= 600 && rng.chance(0.5)) {
    const trigger = rng.range(durationSeconds * 0.7, durationSeconds * 0.9)
    events.push(
      makeEvent(
        'late-liquidity-event',
        trigger,
        'Liquidity vacuum triggers a price gap',
        'Top-of-book depth falls sharply and the market gaps before stabilising.',
        rng.range(2, 6),
        1.3,
        0.52,
        45,
        false,
        'risk',
      ),
    )
  }

  const transitions: ScenarioPlan['regimeTransitions'] = []
  const transitionCount = durationSeconds >= 600 ? rng.int(2, 4) : rng.int(1, 2)
  for (let index = 0; index < transitionCount; index += 1) {
    const at = durationSeconds * ((index + 1) / (transitionCount + 1)) + rng.range(-30, 30)
    const regime = rng.weighted<MarketRegime>([
      { item: 'calm', weight: scenario === 'balanced' ? 3 : 1 },
      { item: 'trending', weight: scenario === 'one-way' ? 4 : 1.5 },
      { item: 'mean-reverting', weight: 1.5 },
      { item: 'volatile', weight: scenario === 'fast-market' ? 4 : 1.4 },
      { item: 'illiquid', weight: scenario === 'illiquid' ? 4 : 1.2 },
    ])
    transitions.push({
      at: Math.max(30, Math.min(durationSeconds - 30, at)),
      regime,
      volatilityMultiplier:
        regime === 'volatile' ? rng.range(1.5, 2.1) : regime === 'calm' ? rng.range(0.65, 0.9) : rng.range(0.9, 1.35),
      driftAdjustment:
        regime === 'trending' ? rng.range(0.015, 0.045) * (rng.chance(0.5) ? 1 : -1) : rng.range(-0.008, 0.008),
      liquidityMultiplier:
        regime === 'illiquid' ? rng.range(0.42, 0.68) : regime === 'calm' ? rng.range(1.05, 1.25) : rng.range(0.78, 1.08),
    })
  }

  transitions.sort((a, b) => a.at - b.at)
  events.sort((a, b) => a.triggerAt - b.triggerAt)

  return {
    scenario,
    flowBias: profile.flowBias * (rng.chance(0.5) ? 1 : -1),
    rfqIntensity: profile.rfqIntensity,
    toxicityMultiplier: profile.toxicityMultiplier * difficultyProfile.toxicityMultiplier,
    softLimitM: profile.softLimitM * instrument.positionLimitScale,
    hardLimitM: profile.hardLimitM * instrument.positionLimitScale,
    events,
    regimeTransitions: transitions,
  }
}

function createSyntheticRelease(factor: MacroFactor, rng: SeededRandom): { name: string; consensus: number; actual: number; unit: string; surpriseZ: number } {
  const surpriseZ = Math.max(-2.8, Math.min(2.8, rng.normal(0, 1)))
  if (factor === 'inflation') {
    const consensus = Math.round(rng.range(2.6, 3.6) * 10) / 10
    return { name: 'Inflation', consensus, actual: Math.round((consensus + surpriseZ * 0.18) * 10) / 10, unit: '%', surpriseZ }
  }
  if (factor === 'growth') {
    const consensus = Math.round(rng.range(120, 220))
    return { name: 'Growth / payrolls', consensus, actual: Math.round(consensus + surpriseZ * 55), unit: 'k', surpriseZ }
  }
  if (factor === 'policy') {
    const consensus = rng.pick([2, 2.25, 2.5, 3, 3.25, 4])
    return { name: 'Policy rate', consensus, actual: Math.round((consensus + surpriseZ * 0.15) * 4) / 4, unit: '%', surpriseZ }
  }
  if (factor === 'energy') {
    const consensus = Math.round(rng.range(-2.5, 2.5) * 10) / 10
    return { name: 'Crude inventories', consensus, actual: Math.round((consensus + surpriseZ * 2.2) * 10) / 10, unit: 'm bbl', surpriseZ }
  }
  const consensus = 0
  return { name: 'Risk indicator', consensus, actual: Math.round(surpriseZ * 10) / 10, unit: 'σ', surpriseZ }
}

export function createMarketState(
  instrument: InstrumentConfig,
  plan: ScenarioPlan,
  difficulty: Difficulty,
  rng: SeededRandom,
): MarketModelState {
  const profile = SCENARIO_PROFILES[plan.scenario]
  const difficultyProfile = DIFFICULTY_PROFILES[difficulty]
  const initialOffsetPips = rng.normal(0, 1.2)

  return {
    elapsed: 0,
    mid: instrument.initialPrice + initialOffsetPips * instrument.pipSize,
    anchor: instrument.initialPrice,
    driftPipsPerSecond: profile.driftPipsPerSecond * (rng.chance(0.5) ? 1 : -1),
    volatilityPipsPerSqrtSecond:
      profile.volatilityPipsPerSqrtSecond * difficultyProfile.marketSpeedMultiplier * instrument.volatilityScale,
    meanReversion: profile.meanReversion,
    baseSpreadPips: profile.spreadPips * instrument.spreadScale,
    liquidity: profile.liquidity,
    regime:
      plan.scenario === 'illiquid'
        ? 'illiquid'
        : plan.scenario === 'fast-market'
          ? 'volatile'
          : plan.scenario === 'one-way'
            ? 'trending'
            : 'calm',
    shockDriftPipsPerSecond: 0,
    shockRemainingSeconds: 0,
    volatilityMultiplier: 1,
    liquidityMultiplier: 1,
    timeVolatilityMultiplier: 1,
    timeLiquidityMultiplier: 1,
    externalImpulsePips: 0,
    executionLiquidityDepletion: 0,
    cancellationPressure: 0,
    spreadPressurePips: 0,
    bookImbalance: 0,
    recentParticipation: 0,
    recentImpactPips: 0,
    repetitiveFlowPressure: 0,
    lastAggressiveAt: -999,
  }
}

export function applyRegimeTransition(
  state: MarketModelState,
  transition: ScenarioPlan['regimeTransitions'][number],
): void {
  state.regime = transition.regime
  state.volatilityMultiplier = transition.volatilityMultiplier
  state.liquidityMultiplier = transition.liquidityMultiplier
  state.driftPipsPerSecond += transition.driftAdjustment
}

export function triggerMarketEvent(
  state: MarketModelState,
  event: ScheduledMarketEvent,
  instrument: InstrumentConfig,
): void {
  const signedImpact = event.impactPips * event.direction
  state.mid += signedImpact * 0.42 * instrument.pipSize
  state.shockDriftPipsPerSecond =
    (signedImpact * 0.58) / Math.max(5, event.persistenceSeconds * 0.45)
  state.shockRemainingSeconds = event.persistenceSeconds
  state.volatilityMultiplier = Math.max(state.volatilityMultiplier, event.volatilityMultiplier)
  state.liquidityMultiplier = Math.min(state.liquidityMultiplier, event.liquidityMultiplier)
  state.regime = 'post-news'
}

export function addExternalImpulse(state: MarketModelState, impulsePips: number): void {
  state.externalImpulsePips += impulsePips
}

export function applyAggressiveExecutionImpact(
  state: MarketModelState,
  side: 'buy' | 'sell',
  temporaryImpactPips: number,
  participation: number,
  instrument: InstrumentConfig,
  executionStrategy: 'immediate' | 'twap' | 'liquidity-sensitive' | 'passive' = 'immediate',
): void {
  const direction = side === 'buy' ? 1 : -1
  const profile = microstructureProfile(instrument)
  const bookParticipation = Math.max(0, participation)
  const rapidRepeat = state.lastAggressiveSide === side && state.elapsed - state.lastAggressiveAt <= 12
  if (rapidRepeat) {
    state.repetitiveFlowPressure = Math.min(2.5, state.repetitiveFlowPressure + (executionStrategy === 'liquidity-sensitive' ? 0.12 : 0.34) * profile.leakageSensitivity)
  } else {
    state.repetitiveFlowPressure *= 0.65
  }
  const leakageMultiplier = 1 + state.repetitiveFlowPressure * 0.28
  const strategyMultiplier = executionStrategy === 'liquidity-sensitive' ? 0.72 : executionStrategy === 'twap' ? 0.9 : 1
  const adjustedImpact = Math.max(0, temporaryImpactPips) * leakageMultiplier * strategyMultiplier
  const immediateShare = instrument.id === 'sp500' || instrument.id === 'mega-equity' ? 0.26 : 0.38
  state.mid += direction * adjustedImpact * immediateShare * instrument.pipSize
  state.externalImpulsePips += direction * adjustedImpact * (1 - immediateShare)

  const depletionAdd = Math.min(0.72, Math.sqrt(bookParticipation) * 0.3 * profile.cancellationSensitivity * strategyMultiplier)
  state.executionLiquidityDepletion = Math.min(0.9, state.executionLiquidityDepletion + depletionAdd)
  state.cancellationPressure = Math.min(0.92, state.cancellationPressure + Math.min(0.65, bookParticipation * 0.2 * profile.cancellationSensitivity))
  state.spreadPressurePips = Math.min(
    18,
    state.spreadPressurePips + adjustedImpact * profile.spreadElasticity * (0.32 + Math.min(1.2, bookParticipation) * 0.45),
  )
  const imbalanceShock = direction * Math.min(0.78, Math.sqrt(bookParticipation) * 0.32 * profile.imbalanceSensitivity)
  state.bookImbalance = Math.max(-0.85, Math.min(0.85, state.bookImbalance + imbalanceShock))
  state.recentParticipation = Math.max(state.recentParticipation, bookParticipation)
  state.recentImpactPips = Math.max(state.recentImpactPips, adjustedImpact)
  state.lastAggressiveSide = side
  state.lastAggressiveAt = state.elapsed
}

export function stepMarket(
  state: MarketModelState,
  dtSeconds: number,
  instrument: InstrumentConfig,
  rng: SeededRandom,
): void {
  const dt = Math.max(0, Math.min(2, dtSeconds))
  state.elapsed += dt

  const anchorDistancePips = (state.anchor - state.mid) / instrument.pipSize
  const meanReversionPips = anchorDistancePips * state.meanReversion * dt
  const randomPips =
    rng.normal() *
    state.volatilityPipsPerSqrtSecond *
    state.volatilityMultiplier *
    state.timeVolatilityMultiplier *
    Math.sqrt(Math.max(dt, 0.001))
  const driftPips = state.driftPipsPerSecond * dt
  const shockPips = state.shockRemainingSeconds > 0 ? state.shockDriftPipsPerSecond * dt : 0
  const impulsePips = state.externalImpulsePips * dt * 2.4
  const imbalancePips = state.bookImbalance * 0.045 * microstructureProfile(instrument).imbalanceSensitivity * dt

  state.mid += (meanReversionPips + randomPips + driftPips + shockPips + impulsePips + imbalancePips) * instrument.pipSize
  state.externalImpulsePips *= Math.exp(-dt * (2.4 / Math.max(0.5, instrument.impactRecoverySeconds / 10)))
  state.executionLiquidityDepletion *= Math.exp(-dt / Math.max(4, instrument.impactRecoverySeconds))
  state.cancellationPressure *= Math.exp(-dt / Math.max(5, instrument.impactRecoverySeconds * 0.72))
  state.spreadPressurePips *= Math.exp(-dt / Math.max(4, instrument.impactRecoverySeconds * 0.55))
  state.bookImbalance *= Math.exp(-dt / Math.max(6, instrument.impactRecoverySeconds * 0.8))
  state.recentParticipation *= Math.exp(-dt / Math.max(4, instrument.impactRecoverySeconds * 0.45))
  state.recentImpactPips *= Math.exp(-dt / Math.max(4, instrument.impactRecoverySeconds * 0.5))
  state.repetitiveFlowPressure *= Math.exp(-dt / Math.max(8, instrument.impactRecoverySeconds * 0.8))

  if (state.shockRemainingSeconds > 0) {
    state.shockRemainingSeconds = Math.max(0, state.shockRemainingSeconds - dt)
    if (state.shockRemainingSeconds === 0) {
      state.shockDriftPipsPerSecond = 0
      state.volatilityMultiplier = Math.max(1, state.volatilityMultiplier * 0.72)
      state.liquidityMultiplier = Math.min(1, state.liquidityMultiplier * 1.35)
      if (state.regime === 'post-news') state.regime = 'volatile'
    }
  }

  const floor = instrument.initialPrice * 0.75
  const ceiling = instrument.initialPrice * 1.25
  state.mid = Math.max(floor, Math.min(ceiling, state.mid))
}

export function createOrderBook(
  state: MarketModelState,
  instrument: InstrumentConfig,
  rng: SeededRandom,
): OrderBookLevel[] {
  const effectiveLiquidity = Math.max(
    0.08,
    Math.min(1.25, state.liquidity * state.liquidityMultiplier * state.timeLiquidityMultiplier * (1 - state.executionLiquidityDepletion) * (1 - state.cancellationPressure * 0.55)),
  )
  const spreadNoise = rng.range(0.92, 1.12)
  const rawSpreadPips =
    state.baseSpreadPips * spreadNoise * (1 / Math.sqrt(effectiveLiquidity)) * Math.max(1, state.volatilityMultiplier * state.timeVolatilityMultiplier * 0.34) + state.spreadPressurePips
  const spreadPips = instrument.marketStructure === 'central-limit-order-book'
    ? Math.max(1, Math.round(rawSpreadPips))
    : rawSpreadPips
  const levels: OrderBookLevel[] = []
  const topBid = instrument.marketStructure === 'central-limit-order-book'
    ? Math.floor((state.mid - instrument.pipSize * spreadPips * 0.5) / instrument.pipSize) * instrument.pipSize
    : state.mid - spreadPips * instrument.pipSize * 0.5
  const topAsk = instrument.marketStructure === 'central-limit-order-book'
    ? topBid + spreadPips * instrument.pipSize
    : state.mid + spreadPips * instrument.pipSize * 0.5

  for (let level = 1; level <= instrument.orderBookLevels; level += 1) {
    const distanceSteps = level - 1
    const depthCurve = instrument.assetClass === 'single-stock-equity'
      ? 2.1 + level * 0.72
      : 3.5 + level * 3.5
    const sizeBase = depthCurve * effectiveLiquidity * instrument.depthScale * (instrument.defaultSizeM / 5)
    const imbalance = Math.max(-0.8, Math.min(0.8, state.bookImbalance))
    const cancellationNoise = 1 - Math.min(0.7, state.cancellationPressure * rng.range(0.45, 0.9))
    const bidSizeM = Math.max(instrument.minimumSizeM, sizeBase * rng.range(0.72, 1.32) * cancellationNoise * (1 + imbalance * 0.48))
    const askSizeM = Math.max(instrument.minimumSizeM, sizeBase * rng.range(0.72, 1.32) * cancellationNoise * (1 - imbalance * 0.48))
    const stepPips = instrument.marketStructure === 'central-limit-order-book'
      ? 1
      : 0.45 + (1 - effectiveLiquidity) * 0.75
    levels.push({
      level,
      bid: topBid - distanceSteps * stepPips * instrument.pipSize,
      ask: topAsk + distanceSteps * stepPips * instrument.pipSize,
      bidSizeM,
      askSizeM,
    })
  }

  return levels
}

export function toMarketSnapshot(
  state: MarketModelState,
  instrument: InstrumentConfig,
  orderBook: OrderBookLevel[],
): MarketSnapshot {
  const top = orderBook[0]
  const displayedDepthM = orderBook.reduce(
    (total, level) => total + level.bidSizeM + level.askSizeM,
    0,
  )
  const participantCount = instrument.assetClass === 'single-stock-equity'
    ? Math.max(18, Math.round(35 + state.liquidity * 8 + (instrument.depthScale - 1) * 9 - state.executionLiquidityDepletion * 12 - state.cancellationPressure * 18))
    : Math.max(12, Math.round(18 + state.liquidity * 10))
  const effectiveLiquidity = Math.max(0, Math.min(1, state.liquidity * state.liquidityMultiplier * state.timeLiquidityMultiplier * (1 - state.executionLiquidityDepletion) * (1 - state.cancellationPressure * 0.55)))
  const profile = microstructureProfile(instrument)
  const hiddenLiquidityShare = instrument.marketStructure === 'central-limit-order-book'
    ? Math.max(0, Math.min(0.35, profile.hiddenLiquidityShare * (0.72 + 0.28 * Math.sin(state.elapsed * 0.17 + instrument.initialPrice)) * (0.7 + effectiveLiquidity * 0.3)))
    : 0
  return {
    timestamp: state.elapsed,
    mid: state.mid,
    bid: top.bid,
    ask: top.ask,
    spreadPips: (top.ask - top.bid) / instrument.pipSize,
    volatility: state.volatilityPipsPerSqrtSecond * state.volatilityMultiplier * state.timeVolatilityMultiplier,
    liquidity: effectiveLiquidity,
    regime: state.regime,
    orderBook,
    participantCount,
    displayedDepthM,
    liquidityRegime: liquidityRegime(effectiveLiquidity),
    bookImbalance: state.bookImbalance,
    hiddenLiquidityShare,
    cancellationPressure: state.cancellationPressure,
    recentParticipation: state.recentParticipation,
    spreadPressurePips: state.spreadPressurePips,
    recentImpactPips: state.recentImpactPips,
    expectedRecoverySeconds: Math.max(4, instrument.impactRecoverySeconds * (0.7 + state.executionLiquidityDepletion + state.cancellationPressure)),
    informationLeakageRisk: Math.max(0, Math.min(1, state.repetitiveFlowPressure / 2.5)),
  }
}
