import type { Difficulty } from '../types'
import type {
  MacroAssetId,
  MacroAttribution,
  MacroPosition,
  MacroRiskSnapshot,
  MacroScenarioFamily,
  MacroScore,
  PortfolioFactor,
  ThesisHorizon,
  ThesisTag,
} from './macro-types'

export type LiveMacroExecutionVenue = 'direct-market' | 'dealer-rfq' | 'worked-order'
export type LiveMacroWorkingStyle = 'twap' | 'liquidity-sensitive'
export type LiveMacroStartingPortfolio = 'flat' | 'example' | 'custom'
export type LiveMacroPreMarketView = 'long' | 'short' | 'neutral' | 'hedge'
export type LiveMacroMarketPhase = 'opening' | 'morning' | 'midday' | 'event-window' | 'closing'

export interface LiveMacroStressResult {
  id: string
  label: string
  detail: string
  pnl: number
  pnlPct: number
}

export interface LiveMacroRiskManagerMessage {
  id: string
  timestamp: number
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
}

export interface LiveMacroMarketColour {
  id: string
  timestamp: number
  source: string
  assetId: MacroAssetId
  message: string
  expiresAtSeconds: number
  reliability: number
}

export interface LiveMacroPreMarketPlanItem {
  view: LiveMacroPreMarketView
  plannedWeight: number
  keyRisk: string
}

export interface LiveMacroPreMarketAssetBrief {
  assetId: MacroAssetId
  previousClose: number
  overnightChangePct: number
  marketColour: string
}

export interface LiveMacroPreMarketBriefing {
  resolvedScenario: Exclude<MacroScenarioFamily, 'random'>
  marketOverview: string[]
  assets: Record<MacroAssetId, LiveMacroPreMarketAssetBrief>
  calendar: Pick<LiveMacroCalendarEvent, 'id' | 'title' | 'factor' | 'unit' | 'consensus' | 'releaseAtSeconds' | 'detail'>[]
}

export interface LiveMacroSessionOptions {
  seed: number
  scenario: MacroScenarioFamily
  difficulty: Difficulty
  durationSeconds: number
  initialNav: number
  startingPortfolio?: LiveMacroStartingPortfolio
  initialWeights?: Partial<Record<MacroAssetId, number>>
  preMarketPlan?: Partial<Record<MacroAssetId, LiveMacroPreMarketPlanItem>>
  preMarketBriefing?: LiveMacroPreMarketBriefing
}

export interface LiveMacroCalendarEvent {
  id: string
  title: string
  factor: PortfolioFactor
  unit: string
  consensus: number
  releaseAtSeconds: number
  actual?: number
  surpriseZ?: number
  revealed: boolean
  detail: string
}

export interface LiveMacroHeadline {
  id: string
  timestamp: number
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  factor?: PortfolioFactor
}

export interface LiveMacroTradeIntent {
  assetId: MacroAssetId
  targetWeight: number
  tag?: ThesisTag
  horizon?: ThesisHorizon
  conviction?: number
  invalidation?: string
  recordThesis?: boolean
}

export interface LiveMacroThesis {
  id: string
  timestamp: number
  assetId: MacroAssetId
  targetWeight: number
  previousWeight: number
  tag: ThesisTag
  horizon: ThesisHorizon
  conviction: number
  invalidation: string
  entryPrice: number
  closedTimestamp?: number
  outcomeReturn?: number
}

export interface LiveMacroTrade {
  id: string
  timestamp: number
  assetId: MacroAssetId
  price: number
  previousWeight: number
  targetWeight: number
  tradedNotional: number
  transactionCost: number
  executionVenue: LiveMacroExecutionVenue
  benchmarkPrice: number
  executionSlippage: number
  dealerName?: string
  thesisId?: string
}

export interface LiveMacroDealerQuote {
  id: string
  dealerId: string
  dealerName: string
  bid: number
  offer: number
  maxNotional: number
  axe: 'buy' | 'sell' | 'neutral'
  axeStrength: number
  colour: string
  expiresAtSeconds: number
}

export interface LiveMacroDealerRfq {
  id: string
  timestamp: number
  assetId: MacroAssetId
  side: 'buy' | 'sell'
  currentWeight: number
  targetWeight: number
  requestedNotional: number
  requestedUnits: number
  intent: LiveMacroTradeIntent
  directBenchmarkPrice: number
  directCost: number
  quotes: LiveMacroDealerQuote[]
  status: 'open' | 'executed' | 'cancelled' | 'expired'
  selectedQuoteId?: string
  executionPrice?: number
  dealerName?: string
  dealerCost?: number
  savingsVsDirect?: number
  filledNotional?: number
}

export interface LiveMacroWorkingOrder {
  id: string
  assetId: MacroAssetId
  side: 'buy' | 'sell'
  style: LiveMacroWorkingStyle
  startedAtSeconds: number
  targetWeight: number
  startingWeight: number
  totalNotional: number
  remainingNotional: number
  executedNotional: number
  averageExecutionPrice: number
  durationSeconds: number
  nextSliceAtSeconds: number
  status: 'working' | 'paused' | 'completed' | 'cancelled'
  intent: LiveMacroTradeIntent
  thesisId?: string
}

export interface LiveMacroHistoryPoint {
  elapsedSeconds: number
  nav: number
  drawdown: number
  prices: Record<MacroAssetId, number>
}

export interface LiveMacroSessionSnapshot {
  options: LiveMacroSessionOptions
  resolvedScenario: Exclude<MacroScenarioFamily, 'random'>
  elapsedSeconds: number
  status: 'running' | 'paused' | 'finished'
  nav: number
  cash: number
  peakNav: number
  maxDrawdown: number
  prices: Record<MacroAssetId, number>
  previousPrices: Record<MacroAssetId, number>
  positions: Record<MacroAssetId, MacroPosition>
  calendar: LiveMacroCalendarEvent[]
  headlines: LiveMacroHeadline[]
  trades: LiveMacroTrade[]
  theses: LiveMacroThesis[]
  history: LiveMacroHistoryPoint[]
  attribution: MacroAttribution
  risk: MacroRiskSnapshot
  peakGrossExposure: number
  peakRiskUtilisation: number
  peakConcentration: number
  turnover: number
  transactionCosts: number
  activeDealerRfq?: LiveMacroDealerRfq
  dealerRfqs: LiveMacroDealerRfq[]
  dealerTrades: number
  dealerSavings: number
  workingOrders: LiveMacroWorkingOrder[]
  factorPulse: Record<PortfolioFactor, number>
  marketPhase: LiveMacroMarketPhase
  liquidityCostMultiplier: number
  volatilityMultiplier: number
  stressTests: LiveMacroStressResult[]
  riskManagerMessages: LiveMacroRiskManagerMessage[]
  marketColour: LiveMacroMarketColour[]
  score?: MacroScore
}
