import type {
  ClientProfile,
  ClientType,
  Difficulty,
  InstrumentConfig,
  MarketSnapshot,
  QuoteOutcome,
  QuoteSubmission,
  Rfq,
  RfqKind,
  ScenarioFamily,
  TradeSide,
} from '../types'
import {
  CLIENT_NAMES,
  CLIENT_TYPE_LABELS,
  DIFFICULTY_PROFILES,
  EQUITY_CLIENT_NAMES,
  EQUITY_CLIENT_TYPE_LABELS,
  FUTURES_CLIENT_NAMES,
  FUTURES_CLIENT_TYPE_LABELS,
  getInstrumentTrainingProfile,
} from './config'
import { estimateBlockExecution } from './accounting'
import { SeededRandom } from './random'
import type { ScenarioPlan } from './market'

const CLIENT_TYPES: readonly ClientType[] = [
  'corporate',
  'asset-manager',
  'hedge-fund',
  'fast-money',
  'retail-aggregator',
]

const CLIENT_BASES: Record<
  ClientType,
  Omit<ClientProfile, 'id' | 'name' | 'visibleLabel'>
> = {
  corporate: {
    type: 'corporate',
    urgency: 0.56,
    priceSensitivity: 0.48,
    toxicity: 0.18,
    directionalBias: 0.34,
    persistence: 0.72,
    commissionPerMillion: 23,
    typicalSizeM: 12,
    sizeDispersion: 0.42,
  },
  'asset-manager': {
    type: 'asset-manager',
    urgency: 0.5,
    priceSensitivity: 0.6,
    toxicity: 0.32,
    directionalBias: 0.27,
    persistence: 0.78,
    commissionPerMillion: 20,
    typicalSizeM: 9,
    sizeDispersion: 0.38,
  },
  'hedge-fund': {
    type: 'hedge-fund',
    urgency: 0.66,
    priceSensitivity: 0.82,
    toxicity: 0.72,
    directionalBias: 0.12,
    persistence: 0.42,
    commissionPerMillion: 17,
    typicalSizeM: 7,
    sizeDispersion: 0.52,
  },
  'fast-money': {
    type: 'fast-money',
    urgency: 0.86,
    priceSensitivity: 0.9,
    toxicity: 0.88,
    directionalBias: 0.08,
    persistence: 0.34,
    commissionPerMillion: 15,
    typicalSizeM: 5,
    sizeDispersion: 0.6,
  },
  'retail-aggregator': {
    type: 'retail-aggregator',
    urgency: 0.72,
    priceSensitivity: 0.55,
    toxicity: 0.12,
    directionalBias: 0.03,
    persistence: 0.2,
    commissionPerMillion: 28,
    typicalSizeM: 3,
    sizeDispersion: 0.35,
  },
}

export function createClientBook(
  difficulty: Difficulty,
  scenario: Exclude<ScenarioFamily, 'random'>,
  instrument: InstrumentConfig,
  rng: SeededRandom,
  clientMemory?: Record<string, { relationshipScore: number }>,
): ClientProfile[] {
  const visibility = DIFFICULTY_PROFILES[difficulty].showClientType
  const clients: ClientProfile[] = []
  let clientCounter = 1

  for (const type of CLIENT_TYPES) {
    const numberToCreate = type === 'retail-aggregator' ? 2 : 3
    for (let index = 0; index < numberToCreate; index += 1) {
      const base = CLIENT_BASES[type]
      const toxicityBoost =
        scenario === 'toxic-flow' && (type === 'hedge-fund' || type === 'fast-money')
          ? 0.14
          : 0
      const trainingProfile = getInstrumentTrainingProfile(instrument)
      const isEquity = instrument.assetClass === 'single-stock-equity'
      const isFutures = instrument.assetClass === 'rates' || instrument.assetClass === 'commodities' || instrument.assetClass === 'equity-index'
      const names = isEquity ? EQUITY_CLIENT_NAMES : isFutures ? FUTURES_CLIENT_NAMES : CLIENT_NAMES
      const fullLabels = isEquity ? EQUITY_CLIENT_TYPE_LABELS : isFutures ? FUTURES_CLIENT_TYPE_LABELS : CLIENT_TYPE_LABELS
      const typeSizeMultiplier: Record<ClientType, number> = {
        corporate: 1.15,
        'asset-manager': 1.0,
        'hedge-fund': 0.82,
        'fast-money': 0.68,
        'retail-aggregator': 0.45,
      }
      const profileMid = trainingProfile
        ? (trainingProfile.typicalRfqMinM + trainingProfile.typicalRfqMaxM) / 2
        : base.typicalSizeM * (instrument.defaultSizeM / 5)
      const clientName = names[type][index % names[type].length]
      const franchiseScore = clientMemory?.[clientName]?.relationshipScore ?? 50
      const profile: ClientProfile = {
        ...base,
        id: `client-${clientCounter}`,
        name: clientName,
        franchiseScore,
        visibleLabel:
          visibility === 'full'
            ? fullLabels[type]
            : visibility === 'partial'
              ? type === 'corporate' || type === 'asset-manager'
                ? 'Real Money'
                : type === 'retail-aggregator'
                  ? 'Aggregator'
                  : 'Fast Account'
              : 'Institutional Client',
        urgency: clamp01(base.urgency + rng.normal(0, 0.05)),
        priceSensitivity: clamp01(base.priceSensitivity + rng.normal(0, 0.06)),
        toxicity: clamp01(base.toxicity + toxicityBoost + rng.normal(0, 0.05)),
        directionalBias: clamp(base.directionalBias + rng.normal(0, 0.1), -0.8, 0.8),
        persistence: clamp01(base.persistence + rng.normal(0, 0.05)),
        commissionPerMillion: Math.max(2, (base.commissionPerMillion + rng.normal(0, 2.2)) * instrument.commissionMultiplier),
        typicalSizeM: Math.max(
          instrument.minimumSizeM,
          profileMid * typeSizeMultiplier[type] * rng.range(0.82, 1.18),
        ),
        sizeDispersion: Math.max(0.15, base.sizeDispersion * rng.range(0.82, 1.12)),
      }
      clients.push(profile)
      clientCounter += 1
    }
  }

  return clients
}

export function nextRfqDelaySeconds(
  plan: ScenarioPlan,
  difficulty: Difficulty,
  rng: SeededRandom,
): number {
  const base = rng.range(4.8, 11.5) / Math.max(0.45, plan.rfqIntensity)
  const difficultySpeed = difficulty === 'learning' ? 1.22 : difficulty === 'assessment' ? 0.78 : 1
  return Math.max(2.5, base * difficultySpeed * rng.range(0.78, 1.25))
}

export function createRfq(
  elapsedSeconds: number,
  market: MarketSnapshot,
  clients: ClientProfile[],
  plan: ScenarioPlan,
  difficulty: Difficulty,
  instrument: InstrumentConfig,
  rng: SeededRandom,
): Rfq {
  const profile = DIFFICULTY_PROFILES[difficulty]
  const client = chooseClient(clients, plan, rng)
  const kind = chooseRfqKind(rng)
  const requestedSide = kind === 'two-way' ? undefined : inferClientSide(client, plan.flowBias, rng)
  const limitPrice = kind === 'limit-interest' && requestedSide
    ? requestedSide === 'buy'
      ? market.ask + rng.range(-0.25, 1.15) * instrument.pipSize
      : market.bid - rng.range(-0.25, 1.15) * instrument.pipSize
    : undefined
  const sizeMultiplier = profile.sizeMultiplier
  const rawSize = client.typicalSizeM * sizeMultiplier * Math.exp(rng.normal(0, client.sizeDispersion))
  let roundedSize = roundSize(rawSize, instrument, rng)
  const controlFlag = difficulty !== 'learning' && rng.chance(difficulty === 'assessment' ? 0.055 : 0.035)
    ? (rng.chance(.7) ? 'size-anomaly' as const : 'market-check' as const)
    : undefined
  if (controlFlag === 'size-anomaly') roundedSize = Math.min(instrument.maximumSizeM, Math.max(roundedSize, roundedSize * rng.range(2.2, 3.8)))
  const controlNote = controlFlag === 'size-anomaly'
    ? "Order size is materially outside this client's normal pattern. Clarify or pass before committing capital."
    : controlFlag === 'market-check'
      ? 'Request arrived during an unstable market move. Reconfirm the live market before transmitting a price.'
      : undefined
  const urgencyAdjustment = clamp(1.08 - client.urgency * 0.15, 0.94, 1.05)
  const timeToQuote = rng.range(profile.rfqTimeMin, profile.rfqTimeMax) * urgencyAdjustment

  return {
    id: `rfq-${Math.floor(elapsedSeconds * 1000)}-${rng.int(100, 999)}`,
    clientId: client.id,
    clientName: client.name,
    clientType: client.type,
    clientLabel: client.visibleLabel,
    kind,
    requestedSide,
    limitPrice,
    sizeM: roundedSize,
    createdAt: elapsedSeconds,
    expiresAt: elapsedSeconds + timeToQuote,
    status: 'open',
    controlFlag,
    controlNote,
  }
}

export function resolveQuote(
  rfq: Rfq,
  client: ClientProfile,
  submission: QuoteSubmission,
  marketAtDecision: MarketSnapshot,
  plan: ScenarioPlan,
  instrument: InstrumentConfig,
  rng: SeededRandom,
): QuoteOutcome {
  const clientSide = rfq.requestedSide ?? inferClientSide(client, plan.flowBias, rng)
  const responseTime = Math.max(0, submission.submittedAt - rfq.createdAt)
  const quotePrice = clientSide === 'buy' ? submission.ask : submission.bid

  if (quotePrice === undefined || !Number.isFinite(quotePrice)) {
    return {
      rfqId: rfq.id,
      clientId: client.id,
      accepted: false,
      sizeM: rfq.sizeM,
      commission: 0,
      stale: false,
      adverseSelectionRisk: client.toxicity,
      competitivenessPips: -99,
      responseTimeSeconds: responseTime,
      reason: clientSide === 'buy' ? 'No offer submitted' : 'No bid submitted',
    }
  }

  if (
    rfq.kind === 'limit-interest' &&
    rfq.limitPrice !== undefined &&
    ((clientSide === 'buy' && quotePrice > rfq.limitPrice) ||
      (clientSide === 'sell' && quotePrice < rfq.limitPrice))
  ) {
    return {
      rfqId: rfq.id,
      clientId: client.id,
      accepted: false,
      sizeM: rfq.sizeM,
      commission: 0,
      stale: false,
      adverseSelectionRisk: client.toxicity,
      competitivenessPips: -99,
      responseTimeSeconds: responseTime,
      reason: clientSide === 'buy' ? 'Offer exceeded the client limit' : 'Bid was below the client limit',
    }
  }

  const blockBenchmark = estimateBlockExecution(
    clientSide,
    rfq.sizeM,
    marketAtDecision.orderBook,
    marketAtDecision,
    instrument,
  )
  const marketReference = instrument.marketStructure === 'central-limit-order-book'
    ? blockBenchmark.impactAdjustedPrice
    : clientSide === 'buy'
      ? marketAtDecision.ask
      : marketAtDecision.bid
  const favourablePips =
    clientSide === 'buy'
      ? (marketReference - quotePrice) / instrument.pipSize
      : (quotePrice - marketReference) / instrument.pipSize

  const isTwoWay = rfq.kind === 'two-way'
  const submittedMid =
    isTwoWay && submission.bid !== undefined && submission.ask !== undefined
      ? (submission.bid + submission.ask) / 2
      : submission.marketAtSubmission.mid
  const submittedSpreadPips =
    isTwoWay && submission.bid !== undefined && submission.ask !== undefined
      ? (submission.ask - submission.bid) / instrument.pipSize
      : 0
  const marketMoveAgainstDealerPips =
    clientSide === 'buy'
      ? (marketAtDecision.mid - submittedMid) / instrument.pipSize
      : (submittedMid - marketAtDecision.mid) / instrument.pipSize

  const urgencyBoost = client.urgency * 0.85
  const priceScore = favourablePips * (0.9 + client.priceSensitivity * 1.4)
  const executableSpreadPips = instrument.marketStructure === 'central-limit-order-book'
    ? Math.max(
        marketAtDecision.spreadPips,
        (estimateBlockExecution('buy', rfq.sizeM, marketAtDecision.orderBook, marketAtDecision, instrument).impactAdjustedPrice -
          estimateBlockExecution('sell', rfq.sizeM, marketAtDecision.orderBook, marketAtDecision, instrument).impactAdjustedPrice) / instrument.pipSize,
      )
    : marketAtDecision.spreadPips
  const widthPenalty = isTwoWay
    ? Math.max(0, submittedSpreadPips - executableSpreadPips * 1.15) * client.priceSensitivity * 0.48
    : 0
  const latePenalty = Math.max(0, responseTime - 3.5) * 0.055 * (0.7 + client.urgency)
  const selectiveTradingBoost =
    client.toxicity * Math.max(0, marketMoveAgainstDealerPips) * 0.72 * plan.toxicityMultiplier
  const relationshipBoost = (((client.franchiseScore ?? 50) - 50) / 50) * 0.18
  const score = -0.2 + urgencyBoost + priceScore + selectiveTradingBoost + relationshipBoost - widthPenalty - latePenalty
  const probability = logistic(score)
  const accepted = rng.chance(probability)

  // A deliberately competitive block quote is not automatically "stale".
  // Staleness requires the market to move against the dealer after submission
  // while the old quote remains materially through the current top of book.
  const staleThresholdPips = Math.max(0.55, marketAtDecision.spreadPips * 0.45)
  const quoteThroughCurrentMarketPips =
    clientSide === 'buy'
      ? (marketAtDecision.ask - quotePrice) / instrument.pipSize
      : (quotePrice - marketAtDecision.bid) / instrument.pipSize
  const stale =
    marketMoveAgainstDealerPips > staleThresholdPips &&
    quoteThroughCurrentMarketPips > Math.max(0.25, staleThresholdPips * 0.5)

  return {
    rfqId: rfq.id,
    clientId: client.id,
    accepted,
    side: accepted ? (clientSide === 'buy' ? 'sell' : 'buy') : undefined,
    price: accepted ? quotePrice : undefined,
    sizeM: rfq.sizeM,
    commission: accepted ? rfq.sizeM * client.commissionPerMillion : 0,
    stale,
    adverseSelectionRisk: client.toxicity * plan.toxicityMultiplier,
    competitivenessPips: favourablePips,
    responseTimeSeconds: responseTime,
    reason: accepted
      ? stale
        ? 'Client traded on a price that became stale as the market moved'
        : isTwoWay
          ? 'Client accepted the two-way quote'
          : clientSide === 'buy'
            ? 'Client accepted your offer'
            : 'Client accepted your bid'
      : favourablePips < -1.5
        ? clientSide === 'buy'
          ? 'Offer was not competitive versus the full-block alternative'
          : 'Bid was not competitive versus the full-block alternative'
        : 'Client declined the quote',
  }
}

export function estimateAdverseSelectionImpulsePips(
  outcome: QuoteOutcome,
  client: ClientProfile,
  rng: SeededRandom,
): number {
  if (!outcome.accepted || !outcome.side) return 0
  const clientDirection = outcome.side === 'sell' ? 1 : -1
  const toxicity = clamp01(client.toxicity * outcome.adverseSelectionRisk)
  const expectedMagnitude = 0.35 + toxicity * 2.4 + (outcome.stale ? 1.1 : 0)
  return clientDirection * Math.max(0, rng.normal(expectedMagnitude, 0.65))
}

function chooseClient(
  clients: ClientProfile[],
  plan: ScenarioPlan,
  rng: SeededRandom,
): ClientProfile {
  return rng.weighted(
    clients.map((client) => ({
      item: client,
      weight:
        1 +
        (plan.scenario === 'toxic-flow' ? client.toxicity * 1.7 : 0) +
        (plan.scenario === 'one-way' ? client.persistence * 0.9 : 0) +
        (plan.scenario === 'illiquid' && client.type === 'corporate' ? 0.6 : 0) +
        (((client.franchiseScore ?? 50) - 50) / 50) * 0.75,
    })),
  )
}

function chooseRfqKind(rng: SeededRandom): RfqKind {
  return rng.weighted<RfqKind>([
    { item: 'two-way', weight: 75 },
    { item: 'directional', weight: 20 },
    { item: 'limit-interest', weight: 5 },
  ])
}

function inferClientSide(
  client: ClientProfile,
  scenarioFlowBias: number,
  rng: SeededRandom,
): TradeSide {
  const combinedBias = clamp(
    scenarioFlowBias * (0.7 + client.persistence * 0.5) + client.directionalBias,
    -0.92,
    0.92,
  )
  const buyProbability = 0.5 + combinedBias * 0.42
  return rng.chance(buyProbability) ? 'buy' : 'sell'
}

function roundSize(
  rawSize: number,
  instrument: InstrumentConfig,
  rng: SeededRandom,
): number {
  const profile = getInstrumentTrainingProfile(instrument)
  const allowOutlier = Boolean(profile) && rng.chance(0.14)
  const typicalMin = profile && !allowOutlier ? profile.typicalRfqMinM : instrument.minimumSizeM
  const typicalMax = profile && !allowOutlier
    ? profile.typicalRfqMaxM
    : Math.min(
        instrument.maximumSizeM,
        profile ? profile.typicalRfqMaxM * 1.75 : 30 * Math.max(1, instrument.defaultSizeM / 5),
      )
  const clamped = clamp(rawSize, typicalMin, typicalMax)
  const step = instrument.sizeStepM
  if (rng.chance(0.32)) return Math.round(clamped / step) * step

  const profileAnchors = profile
    ? [profile.typicalRfqMinM, instrument.defaultSizeM, (profile.typicalRfqMinM + profile.typicalRfqMaxM) / 2, profile.typicalRfqMaxM]
    : []
  const multipliers = [0.2, 0.4, 0.6, 1, 1.5, 2, 2.5, 3, 4, 5, 6]
  const common = (profile
    ? profileAnchors
    : multipliers.map((value) => instrument.defaultSizeM * value))
    .map((value) => Math.max(typicalMin, Math.min(typicalMax, value)))
    .map((value) => Math.round(value / step) * step)
  return common.reduce((best, candidate) =>
    Math.abs(candidate - clamped) < Math.abs(best - clamped) ? candidate : best,
  )
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
