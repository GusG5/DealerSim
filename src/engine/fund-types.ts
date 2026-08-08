import type { Difficulty } from '../types'

export type FundMandate = 'long-short' | 'long-only'
export type FundScenario = 'earnings-season' | 'growth-rotation' | 'value-rotation' | 'risk-off' | 'short-squeeze' | 'stock-pickers' | 'random'
export type FundAssetId = 'apex-fund' | 'mega-fund' | 'nova-fund' | 'heli-fund' | 'luma-fund' | 'orbx-fund' | 'es-fund'
export type FundSector = 'Industrials' | 'Technology' | 'Healthcare' | 'Biotech' | 'Index'
export type FundFactor = 'market' | 'growth' | 'value' | 'quality' | 'rates' | 'momentum'
export type FundThesisTag = 'earnings' | 'valuation' | 'catalyst' | 'quality' | 'momentum' | 'relative-value' | 'short-thesis' | 'risk-hedge'
export type FundHorizon = 'intraday' | 'days' | 'weeks'
export type FundWorkingStyle = 'twap' | 'liquidity-sensitive'
export type FundExecutionVenue = 'direct-market' | 'dealer-rfq' | 'worked-order' | 'auction'
export type FundAuditType = 'trade' | 'rfq' | 'dealer-fill' | 'locate' | 'worked-order' | 'hedge' | 'catalyst' | 'risk' | 'colour' | 'oversight'
export type FundStartingPortfolio = 'benchmark' | 'equal-weight' | 'custom' | 'flat' | 'model-book'
export type FundPreMarketView = 'overweight' | 'neutral' | 'underweight' | 'long' | 'short' | 'flat' | 'hedge'
export type FundMarketPhase = 'opening-auction' | 'morning-liquidity' | 'midday' | 'event-window' | 'closing-auction'

export interface FundStressResult {
  id: string
  label: string
  detail: string
  pnl: number
  pnlPct: number
}

export interface FundSalesColour {
  id: string
  timestamp: number
  dealerId: string
  dealerName: string
  assetId: FundAssetId
  message: string
  bias: 'buying' | 'selling' | 'two-way'
  reliability: number
  expiresAtSeconds: number
}

export interface FundRiskManagerMessage {
  id: string
  timestamp: number
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
}

export interface FundEarningsMetric {
  label: string
  consensus: number
  actual: number
  prior: number
  unit: string
}

export interface FundPreMarketPlanItem {
  view: FundPreMarketView
  plannedWeight: number
  keyRisk: string
}

export interface FundPreMarketCompanyBrief {
  assetId: FundAssetId
  previousClose: number
  preMarketChangePct: number
  overnightHeadline: string
  benchmarkWeight: number
  borrowCapacityWeight: number
  indicativeBorrowRatePct: number
  research: FundResearchSnapshot
  knownCatalyst?: Pick<FundCatalystEvent, 'id' | 'title' | 'type' | 'releaseAtSeconds' | 'detail' | 'earningsMetrics'>
}

export interface FundPreMarketBriefing {
  resolvedScenario: Exclude<FundScenario, 'random'>
  marketOverview: string[]
  companies: Record<FundAssetId, FundPreMarketCompanyBrief>
}

export interface FundDealerRelationshipMemory {
  dealerId: string
  dealerName: string
  relationshipScore: number
  rfqs: number
  fills: number
  executedNotional: number
  cumulativeSavings: number
  lastUsedAt?: string
}

export interface FundAssetConfig {
  id: FundAssetId
  symbol: string
  displayName: string
  sector: FundSector
  initialPrice: number
  priceDecimals: number
  annualVolatility: number
  transactionCostBps: number
  maxAbsWeight: number
  beta: number
  borrowRatePct: number
  maxShortWeight: number
  hardToBorrow: boolean
  description: string
  factorLoadings: Record<FundFactor, number>
  eventSensitivity: number
}

export interface FundSessionOptions {
  seed: number
  mandate: FundMandate
  scenario: FundScenario
  difficulty: Difficulty
  durationSeconds: number
  initialNav: number
  dealerMemory?: Record<string, FundDealerRelationshipMemory>
  startingPortfolio?: FundStartingPortfolio
  initialWeights?: Partial<Record<FundAssetId, number>>
  initialLocates?: Partial<Record<FundAssetId, FundLocate>>
  preMarketPlan?: Partial<Record<FundAssetId, FundPreMarketPlanItem>>
  preMarketBriefing?: FundPreMarketBriefing
}

export interface FundPosition {
  assetId: FundAssetId
  units: number
  lastTradePrice: number
}

export interface FundThesis {
  id: string
  timestamp: number
  assetId: FundAssetId
  previousWeight: number
  targetWeight: number
  tag: FundThesisTag
  horizon: FundHorizon
  conviction: number
  invalidation: string
  entryPrice: number
  outcomeReturn?: number
}

export interface FundTradeIntent {
  assetId: FundAssetId
  targetWeight: number
  tag?: FundThesisTag
  horizon?: FundHorizon
  conviction?: number
  invalidation?: string
  recordThesis?: boolean
}

export interface FundTrade {
  id: string
  timestamp: number
  assetId: FundAssetId
  price: number
  previousWeight: number
  targetWeight: number
  tradedNotional: number
  transactionCost: number
  executionVenue: FundExecutionVenue
  benchmarkPrice: number
  executionSlippage: number
  arrivalPrice: number
  implementationShortfall: number
  implementationShortfallBps: number
  timingCost: number
  timingCostBps: number
  marketImpactCost: number
  marketImpactBps: number
  dealerName?: string
  thesisId?: string
}

export interface FundDealerQuote {
  id: string
  dealerId: string
  dealerName: string
  bid: number
  offer: number
  maxNotional: number
  axe: 'buy' | 'sell' | 'neutral'
  colour: string
  expiresAtSeconds: number
}

export interface FundDealerRfq {
  id: string
  timestamp: number
  assetId: FundAssetId
  side: 'buy' | 'sell'
  currentWeight: number
  targetWeight: number
  requestedNotional: number
  requestedUnits: number
  directBenchmarkPrice: number
  directCost: number
  arrivalPrice: number
  quotes: FundDealerQuote[]
  intent: FundTradeIntent
  status: 'open' | 'executed' | 'cancelled' | 'expired'
  filledNotional?: number
  selectedQuoteId?: string
  dealerName?: string
  savingsVsDirect?: number
}

export interface FundLocate {
  assetId: FundAssetId
  requestedWeight: number
  approvedShortWeight: number
  borrowRatePct: number
  status: 'approved' | 'partial' | 'rejected'
  timestamp: number
}

export interface FundWorkingOrder {
  id: string
  assetId: FundAssetId
  side: 'buy' | 'sell'
  style: FundWorkingStyle
  startedAtSeconds: number
  targetWeight: number
  startingWeight: number
  totalNotional: number
  remainingNotional: number
  executedNotional: number
  averageExecutionPrice: number
  durationSeconds: number
  nextSliceAtSeconds: number
  arrivalPrice: number
  status: 'working' | 'paused' | 'completed' | 'cancelled'
  intent: FundTradeIntent
  thesisId?: string
}

export interface FundCatalystEvent {
  id: string
  assetId?: FundAssetId
  title: string
  type: 'earnings' | 'guidance' | 'analyst' | 'macro' | 'mna' | 'regulatory' | 'squeeze' | 'commentary'
  releaseAtSeconds: number
  consensus?: number
  actual?: number
  unit?: string
  revealed: boolean
  detail: string
  chainId?: string
  stage?: number
  stageLabel?: string
  earningsMetrics?: FundEarningsMetric[]
  managementCommentary?: string
}

export interface FundHeadline {
  id: string
  timestamp: number
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  assetId?: FundAssetId
}


export interface FundDealerRelationship extends FundDealerRelationshipMemory {
  specialties: FundAssetId[]
  rfqFillRate: number
  averageSavingBps: number
}

export type FundCorrelationRegime = 'normal' | 'dispersion' | 'factor-squeeze'

export interface FundMarketContext {
  correlationRegime: FundCorrelationRegime
  crowding: Record<FundAssetId, number>
}

export interface FundExecutionQuality {
  totalNotional: number
  implementationShortfall: number
  implementationShortfallBps: number
  timingCost: number
  timingCostBps: number
  marketImpactCost: number
  marketImpactBps: number
  directNotional: number
  dealerNotional: number
  workedNotional: number
  auctionNotional: number
  dealerSavingBps: number
}


export interface FundResearchSnapshot {
  assetId: FundAssetId
  forwardPe: number
  earningsRevisionPct: number
  consensusGrowthPct: number
  shortInterestPct: number
  momentumPct: number
  sectorRelativePct: number
  priorMomentumPct: number
  priorSectorRelativePct: number
  qualityScore: number
  crowding: number
  borrowRatePct: number
  lastUpdatedSeconds: number
}

export interface FundDecisionAuditEntry {
  id: string
  timestamp: number
  type: FundAuditType
  assetId?: FundAssetId
  title: string
  detail: string
  refId?: string
  severity?: 'info' | 'warning' | 'critical'
}

export interface FundRiskSnapshot {
  grossExposure: number
  netExposure: number
  cashWeight: number
  concentration: number
  betaExposure: number
  sectorExposure: Record<FundSector, number>
  factorExposure: Record<FundFactor, number>
  riskUtilisation: number
}

export interface FundAttribution {
  byAsset: Record<FundAssetId, number>
  byFactor: Record<FundFactor | 'idiosyncratic' | 'transaction-costs' | 'borrow-costs', number>
  betaPnl: number
  alphaPnl: number
}

export interface FundHistoryPoint {
  elapsedSeconds: number
  nav: number
  benchmarkNav: number
  drawdown: number
  prices: Record<FundAssetId, number>
}

export interface FundScore {
  overall: number
  rating: string
  alpha: number
  risk: number
  sizing: number
  execution: number
  thesis: number
  efficiency: number
}

export interface FundSessionSnapshot {
  options: FundSessionOptions
  resolvedScenario: Exclude<FundScenario, 'random'>
  elapsedSeconds: number
  status: 'running' | 'paused' | 'finished'
  nav: number
  benchmarkNav: number
  cash: number
  peakNav: number
  maxDrawdown: number
  prices: Record<FundAssetId, number>
  previousPrices: Record<FundAssetId, number>
  positions: Record<FundAssetId, FundPosition>
  headlines: FundHeadline[]
  calendar: FundCatalystEvent[]
  trades: FundTrade[]
  theses: FundThesis[]
  locates: Partial<Record<FundAssetId, FundLocate>>
  activeDealerRfq?: FundDealerRfq
  dealerRfqs: FundDealerRfq[]
  dealerTrades: number
  dealerSavings: number
  dealerRelationships: Record<string, FundDealerRelationship>
  executionQuality: FundExecutionQuality
  workingOrders: FundWorkingOrder[]
  borrowCosts: number
  transactionCosts: number
  turnover: number
  peakGrossExposure: number
  peakConcentration: number
  peakRiskUtilisation: number
  peakBetaExposure: number
  risk: FundRiskSnapshot
  attribution: FundAttribution
  factorPulse: Record<FundFactor, number>
  marketContext: FundMarketContext
  marketPhase: FundMarketPhase
  liquidityCostMultiplier: number
  volatilityMultiplier: number
  stressTests: FundStressResult[]
  salesColour: FundSalesColour[]
  riskManagerMessages: FundRiskManagerMessage[]
  research: Record<FundAssetId, FundResearchSnapshot>
  auditTrail: FundDecisionAuditEntry[]
  history: FundHistoryPoint[]
  score?: FundScore
}

export interface FundSessionSummary {
  id: string
  completedAt: string
  mandate: FundMandate
  seed: number
  scenario: FundScenario
  difficulty: Difficulty
  startingPortfolio?: FundStartingPortfolio
  returnPct: number
  benchmarkReturnPct: number
  alphaPct: number
  score: number
  rating: string
  maxDrawdown: number
  turnover: number
  peakGrossExposure: number
  peakBetaExposure: number
  transactionCosts: number
  borrowCosts: number
  dealerTrades: number
  dealerSavings: number
  implementationShortfallBps: number
  timingCostBps: number
  marketImpactBps: number
  dealerFillRate: number
  alphaScore?: number
  riskScore?: number
  sizingScore?: number
  executionScore?: number
  thesisScore?: number
  efficiencyScore?: number
  resolvedScenario?: Exclude<FundScenario, 'random'>
  correlationRegime?: FundCorrelationRegime
  bestAssetSymbol?: string
  worstAssetSymbol?: string
  assetPnl?: Partial<Record<FundAssetId, number>>
}
