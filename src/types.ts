export type ScenarioFamily =
  | 'balanced'
  | 'one-way'
  | 'fast-market'
  | 'illiquid'
  | 'news-shock'
  | 'toxic-flow'
  | 'random'

export type Difficulty = 'learning' | 'standard' | 'advanced' | 'assessment'
export type InstrumentId =
  | 'apex-equity'
  | 'mega-equity'
  | 'nova-equity'
  | 'heli-equity'
  | 'luma-equity'
  | 'orbx-equity'
  | 'eur-usd'
  | 'bund'
  | 'brent'
  | 'sp500'
export type AssetClass = 'single-stock-equity' | 'fx' | 'rates' | 'commodities' | 'equity-index'
export type MacroFactor = 'inflation' | 'growth' | 'policy' | 'risk' | 'energy' | 'company'
export type CoachingMode = 'none' | 'assisted'
export type SessionMode = 'single' | 'dual' | 'triple'
export type TradeSide = 'buy' | 'sell'
export type ClientType =
  | 'corporate'
  | 'asset-manager'
  | 'hedge-fund'
  | 'fast-money'
  | 'retail-aggregator'

export type RfqKind = 'two-way' | 'directional' | 'limit-interest'
export type MarketRegime = 'calm' | 'trending' | 'mean-reverting' | 'volatile' | 'illiquid' | 'post-news'
export type DealerMarketPhase = 'opening' | 'morning' | 'midday' | 'event-window' | 'closing'
export type SessionStatus = 'ready' | 'running' | 'paused' | 'finished'
export type EventSeverity = 'info' | 'positive' | 'warning' | 'critical'
export type TradeSource = 'client' | 'market-hedge' | 'interdealer-hedge' | 'worked-hedge' | 'passive-hedge' | 'forced-liquidation'


export type MarketProfileLevel = 'Low' | 'Moderate' | 'High' | 'Very high'
export type EquityProfileLevel = MarketProfileLevel

export interface InstrumentTrainingProfile {
  archetype: string
  marketFocus: string
  description: string
  typicalRfqMinM: number
  typicalRfqMaxM: number
  liquidityLabel: MarketProfileLevel
  volatilityLabel: MarketProfileLevel
  impactLabel: MarketProfileLevel
  scheduledHeadlines: readonly {
    headline: string
    detail: string
    factor: MacroFactor
  }[]
  surpriseHeadlines: readonly {
    headline: string
    detail: string
    factor: MacroFactor
  }[]
}

export interface EquityTrainingProfile {
  archetype: string
  sector: string
  description: string
  typicalRfqMinM: number
  typicalRfqMaxM: number
  liquidityLabel: EquityProfileLevel
  volatilityLabel: EquityProfileLevel
  impactLabel: EquityProfileLevel
  scheduledCompanyHeadlines: readonly {
    headline: string
    detail: string
    factor: MacroFactor
  }[]
  surpriseCompanyHeadlines: readonly {
    headline: string
    detail: string
    factor: MacroFactor
  }[]
}

export interface InstrumentConfig {
  id: InstrumentId
  assetClass: AssetClass
  symbol: string
  displayName: string
  baseCurrency: string
  quoteCurrency: string
  initialPrice: number
  pipSize: number
  priceDecimals: number
  defaultSizeM: number
  minimumSizeM: number
  maximumSizeM: number
  sizeStepM: number
  sizePrefix: string
  sizeSuffix: string
  pnlMultiplier: number
  commissionMultiplier: number
  positionLimitScale: number
  eventSensitivity: Record<MacroFactor, number>
  marketStructure: 'dealer-otc' | 'central-limit-order-book'
  unitsPerSize: number
  orderBookLevels: number
  displayedDepthLevels: number
  depthScale: number
  spreadScale: number
  impactCoefficientPips: number
  impactRecoverySeconds: number
  volatilityScale: number
  microstructure?: {
    cancellationSensitivity: number
    hiddenLiquidityShare: number
    spreadElasticity: number
    imbalanceSensitivity: number
    leakageSensitivity: number
  }
  trainingProfile?: InstrumentTrainingProfile
  equityProfile?: EquityTrainingProfile
}

export interface OrderBookLevel {
  level: number
  bid: number
  bidSizeM: number
  ask: number
  askSizeM: number
}

export interface MarketSnapshot {
  timestamp: number
  mid: number
  bid: number
  ask: number
  spreadPips: number
  volatility: number
  liquidity: number
  regime: MarketRegime
  orderBook: OrderBookLevel[]
  participantCount: number
  displayedDepthM: number
  liquidityRegime: 'deep' | 'normal' | 'thin' | 'stressed'
  bookImbalance: number
  hiddenLiquidityShare: number
  cancellationPressure: number
  recentParticipation: number
  spreadPressurePips: number
  recentImpactPips: number
  expectedRecoverySeconds: number
  informationLeakageRisk: number
}

export interface PricePoint {
  t: number
  mid: number
  bid: number
  ask: number
}

export interface ClientProfile {
  id: string
  name: string
  type: ClientType
  visibleLabel: string
  urgency: number
  priceSensitivity: number
  toxicity: number
  directionalBias: number
  persistence: number
  commissionPerMillion: number
  typicalSizeM: number
  sizeDispersion: number
  franchiseScore?: number
}

export interface Rfq {
  id: string
  clientId: string
  clientName: string
  clientType: ClientType
  clientLabel: string
  kind: RfqKind
  requestedSide?: TradeSide
  limitPrice?: number
  sizeM: number
  createdAt: number
  expiresAt: number
  status: 'open' | 'quoted' | 'traded' | 'rejected' | 'expired'
  controlFlag?: 'size-anomaly' | 'market-check'
  controlNote?: string
}

export interface QuoteSubmission {
  rfqId: string
  bid?: number
  ask?: number
  submittedAt: number
  marketAtSubmission: MarketSnapshot
}

export interface QuoteOutcome {
  rfqId: string
  clientId: string
  accepted: boolean
  side?: TradeSide
  price?: number
  sizeM: number
  commission: number
  stale: boolean
  adverseSelectionRisk: number
  competitivenessPips: number
  responseTimeSeconds: number
  reason: string
}

export interface Trade {
  id: string
  timestamp: number
  instrument: string
  side: TradeSide
  price: number
  sizeM: number
  source: TradeSource
  clientName?: string
  rfqId?: string
  commission: number
  executionCost: number
  stale?: boolean
  markoutPnl?: number
  temporaryImpactPips?: number
  marketImpactCost?: number
  executionStrategy?: 'immediate' | 'twap' | 'liquidity-sensitive' | 'passive'
  referenceMid?: number
  clientPriceEdgePnl?: number
  exchangeSlippageCost?: number
  internalisedSizeM?: number
}

export interface PositionState {
  quantityM: number
  averagePrice: number
  realisedPnl: number
  unrealisedPnl: number
  grossCommission: number
  hedgeCosts: number
  turnoverM: number
}

export interface PassiveOrder {
  id: string
  side: TradeSide
  price: number
  sizeM: number
  remainingM: number
  createdAt: number
  queuePosition: number
  status: 'working' | 'filled' | 'cancelled'
}

export type WorkingHedgeStrategy = 'twap' | 'liquidity-sensitive'

export interface WorkingHedge {
  id: string
  side: TradeSide
  strategy: WorkingHedgeStrategy
  totalSizeM: number
  remainingM: number
  clipSizeM: number
  intervalSeconds: number
  createdAt: number
  nextClipAt: number
  status: 'working' | 'paused' | 'completed' | 'cancelled'
  executedM: number
  averageExecutionPrice: number
  executionCost: number
  marketImpactCost: number
}

export interface BlockExecutionEstimate {
  side: TradeSide
  requestedSizeM: number
  directVwap: number
  impactAdjustedPrice: number
  topOfBookPrice: number
  temporaryImpactPips: number
  slippagePips: number
  levelsConsumed: number
  displayedDepthM: number
  implementationShortfall: number
  participationRate: number
  hiddenLiquidityUsedM: number
}

export interface EventItem {
  id: string
  timestamp: number
  headline: string
  detail?: string
  severity: EventSeverity
  category: 'market' | 'client' | 'risk' | 'system' | 'news'
}

export interface ScheduledMarketEvent {
  id: string
  announceAt?: number
  triggerAt: number
  headline: string
  detail: string
  impactPips: number
  volatilityMultiplier: number
  liquidityMultiplier: number
  persistenceSeconds: number
  direction: -1 | 1
  macroFactor: MacroFactor
  releaseName?: string
  consensus?: number
  actual?: number
  releaseUnit?: string
  surpriseZ?: number
  announced: boolean
  triggered: boolean
}

export interface QuoteRecord {
  id: string
  rfq: Rfq
  submission?: QuoteSubmission
  outcome?: QuoteOutcome
}

export interface SessionMetrics {
  rfqsReceived: number
  quotesSubmitted: number
  quotesAccepted: number
  rfqsExpired: number
  rfqsPassed: number
  staleQuotes: number
  fatFingerFlags: number
  clientTrades: number
  hedgeTrades: number
  forcedLiquidations: number
  softLimitBreaches: number
  hardLimitBreaches: number
  maximumInventoryM: number
  inventorySeconds: number
  inventorySamples: number
  adverseSelectionPnl: number
  totalQuotedSpreadPips: number
  quoteSpreadSamples: number
  totalResponseTime: number
  responseSamples: number
  peakEquity: number
  maximumDrawdown: number
  startEquity: number
  grossClientVolumeM: number
  exchangeHedgeVolumeM: number
  interdealerHedgeVolumeM: number
  internalisedVolumeM: number
  workedHedgeVolumeM: number
  marketImpactCost: number
  clientBuyVolumeM: number
  clientSellVolumeM: number
  clientPriceEdgePnl: number
  exchangeSlippageCost: number
}

export interface MacroCalendarEvent {
  id: string
  name: string
  factor: MacroFactor
  announceAt: number
  triggerAt: number
  consensus: number
  actual?: number
  unit: string
  surpriseZ?: number
  status: 'upcoming' | 'released'
  detail: string
}

export interface FactorStateSnapshot {
  inflation: number
  growth: number
  policy: number
  risk: number
  energy: number
}

export interface ClientFlowSignal {
  instrumentId: InstrumentId
  symbol: string
  buyVolumeM: number
  sellVolumeM: number
  netVolumeM: number
  bias: 'buying' | 'selling' | 'balanced'
  strength: number
  dominantClientLabel?: string
  dominantClientBias?: 'buying' | 'selling'
  dominantClientNetM?: number
}

export interface PnlAttribution {
  commission: number
  clientPriceEdge: number
  exchangeSlippage: number
  marketImpact: number
  inventoryAndTiming: number
  adverseSelectionDiagnostic: number
  netPnl: number
  internalisationRate: number
  impactAvoidedEstimate: number
}


export interface ScoreBreakdown {
  overall: number
  rating: string
  pnl: number
  commission: number
  inventory: number
  quoteQuality: number
  adverseSelection: number
  execution: number
  feedback: string[]
}

export interface SessionOptions {
  seed: number
  scenario: ScenarioFamily
  difficulty: Difficulty
  durationSeconds: number
  instrument: InstrumentConfig
  coachingMode?: CoachingMode
  sharedNewsMode?: boolean
  clientMemory?: Record<string, { relationshipScore: number }>
}

export interface MultiSessionOptions {
  seed: number
  scenario: ScenarioFamily
  difficulty: Difficulty
  durationSeconds: number
  instruments: InstrumentConfig[]
  coachingMode?: CoachingMode
  clientMemory?: Record<string, { relationshipScore: number }>
}

export interface PortfolioSnapshot {
  totalPnl: number
  totalCommission: number
  grossRiskUtilisation: number
  concentration: number
  peakGrossRiskUtilisation: number
  rfqsReceived: number
  quotesSubmitted: number
  quotesAccepted: number
  rfqsExpired: number
}

export interface MultiSessionSnapshot {
  status: SessionStatus
  options: MultiSessionOptions
  elapsedSeconds: number
  remainingSeconds: number
  legs: SessionSnapshot[]
  events: EventItem[]
  calendar: MacroCalendarEvent[]
  factors: FactorStateSnapshot
  flowSignals: ClientFlowSignal[]
  portfolio: PortfolioSnapshot
  attribution?: PnlAttribution
  score?: ScoreBreakdown
}

export interface SessionSnapshot {
  status: SessionStatus
  options: SessionOptions
  elapsedSeconds: number
  remainingSeconds: number
  market: MarketSnapshot
  priceHistory: PricePoint[]
  position: PositionState
  activeRfq?: Rfq
  pendingQuote?: QuoteSubmission
  pendingDecisionAt?: number
  quoteHistory: QuoteRecord[]
  trades: Trade[]
  passiveOrders: PassiveOrder[]
  workingHedges: WorkingHedge[]
  events: EventItem[]
  clients: ClientProfile[]
  metrics: SessionMetrics
  softLimitM: number
  hardLimitM: number
  currentEquity: number
  marketPhase: DealerMarketPhase
  timeLiquidityMultiplier: number
  timeVolatilityMultiplier: number
  score?: ScoreBreakdown
}

export interface SessionSummary {
  id: string
  completedAt: string
  seed: number
  scenario: ScenarioFamily
  difficulty: Difficulty
  instrumentId: InstrumentId | 'multi'
  instrumentSymbol: string
  score: number
  rating: string
  netPnl: number
  grossCommission: number
  maximumInventoryM: number
  acceptanceRate: number
  staleQuoteRate: number
  // v1.2+ fields are optional so existing locally stored sessions remain compatible.
  sessionMode?: SessionMode
  durationSeconds?: number
  averageCommission?: number
  internalisationRate?: number
  marketImpactCost?: number
  maximumDrawdown?: number
  rfqsExpired?: number
  quotesSubmitted?: number
  grossClientVolumeM?: number
  pnlCurrency?: string
  pnlScore?: number
  commissionScore?: number
  inventoryScore?: number
  quoteQualityScore?: number
  adverseSelectionScore?: number
  executionScore?: number
}
