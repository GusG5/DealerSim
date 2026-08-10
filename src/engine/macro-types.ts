import type { Difficulty } from '../types'

export type MacroScenarioFamily =
  | 'soft-landing'
  | 'inflation-resurgence'
  | 'recession'
  | 'policy-error'
  | 'commodity-shock'
  | 'risk-off'
  | 'random'

export type MacroAssetId = 'es-macro' | 'ty-macro' | 'fgbl-macro' | 'brn-macro' | 'gold-macro' | 'eurusd-macro'
export type MacroAssetClass = 'equity-index' | 'rates' | 'commodities' | 'fx'
export type PortfolioFactor = 'growth' | 'inflation' | 'policy' | 'risk' | 'energy' | 'usd'
export type ThesisTag = 'growth' | 'inflation' | 'policy' | 'valuation' | 'momentum' | 'catalyst' | 'relative-value' | 'positioning' | 'risk-hedge'
export type ThesisHorizon = 'days' | 'weeks' | 'months'
export type MacroExecutionVenue = 'direct-market' | 'dealer-rfq'
export type DealerAxeSide = 'buy' | 'sell' | 'neutral'

export interface MacroAssetConfig {
  id: MacroAssetId
  symbol: string
  displayName: string
  assetClass: MacroAssetClass
  initialPrice: number
  priceDecimals: number
  annualVolatility: number
  transactionCostBps: number
  unitLabel: string
  unitPlural: string
  contractMultiplier: number
  commissionPerUnit: number
  minimumCommission: number
  quantityStep: number
  maxAbsWeight: number
  description: string
  factorLoadings: Record<PortfolioFactor, number>
}

export interface MacroEventTemplate {
  id: string
  title: string
  factor: PortfolioFactor
  unit: string
  consensus: number
  surpriseStd: number
  factorShockPerStd: number
  higherMeansPositiveFactor: boolean
  detail: string
}

export interface MacroCalendarEvent extends MacroEventTemplate {
  day: number
  actual?: number
  surpriseZ?: number
  factorShock?: number
  revealed: boolean
  scheduled: boolean
}

export interface MacroHeadline {
  id: string
  day: number
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  factor?: PortfolioFactor
}

export interface MacroPosition {
  assetId: MacroAssetId
  units: number
  lastTradePrice: number
}

export interface MacroThesis {
  id: string
  day: number
  assetId: MacroAssetId
  targetWeight: number
  previousWeight: number
  tag: ThesisTag
  horizon: ThesisHorizon
  conviction: number
  invalidation: string
  entryPrice: number
  closedDay?: number
  outcomeReturn?: number
}

export interface MacroTradeIntent {
  assetId: MacroAssetId
  targetWeight: number
  tag: ThesisTag
  horizon: ThesisHorizon
  conviction: number
  invalidation: string
}


export interface MacroDealerQuote {
  id: string
  dealerId: string
  dealerName: string
  bid: number
  offer: number
  maxNotional: number
  axe: DealerAxeSide
  axeStrength: number
  colour: string
  spreadBps: number
  expiresDay: number
}

export interface MacroDealerRfq {
  id: string
  day: number
  assetId: MacroAssetId
  side: 'buy' | 'sell'
  currentWeight: number
  targetWeight: number
  requestedNotional: number
  requestedUnits: number
  intent: MacroTradeIntent
  directBenchmarkPrice: number
  directCost: number
  quotes: MacroDealerQuote[]
  status: 'open' | 'executed' | 'cancelled' | 'expired'
  selectedQuoteId?: string
  executionPrice?: number
  dealerName?: string
  dealerCost?: number
  savingsVsDirect?: number
  filledNotional?: number
}

export interface MacroTrade {
  id: string
  day: number
  assetId: MacroAssetId
  price: number
  previousWeight: number
  targetWeight: number
  tradedNotional: number
  transactionCost: number
  commission: number
  marketCost: number
  thesisId: string
  executionVenue: MacroExecutionVenue
  benchmarkPrice: number
  executionSlippage: number
  dealerName?: string
}

export interface MacroDailyPoint {
  day: number
  nav: number
  drawdown: number
  prices: Record<MacroAssetId, number>
  dailyReturns: Record<MacroAssetId, number>
  factorShocks: Record<PortfolioFactor, number>
}

export interface MacroAttribution {
  byAsset: Record<MacroAssetId, number>
  byFactor: Record<PortfolioFactor | 'idiosyncratic' | 'transaction-costs', number>
}

export interface MacroRiskSnapshot {
  grossExposure: number
  netExposure: number
  cashWeight: number
  concentration: number
  factorExposure: Record<PortfolioFactor, number>
  riskUtilisation: number
}

export interface MacroScore {
  overall: number
  rating: string
  return: number
  risk: number
  sizing: number
  thesis: number
  efficiency: number
  adaptability: number
}

export interface MacroSessionOptions {
  seed: number
  scenario: MacroScenarioFamily
  difficulty: Difficulty
  days: number
  initialNav: number
}

export interface MacroSessionSnapshot {
  options: MacroSessionOptions
  resolvedScenario: Exclude<MacroScenarioFamily, 'random'>
  day: number
  status: 'running' | 'finished'
  nav: number
  cash: number
  peakNav: number
  maxDrawdown: number
  prices: Record<MacroAssetId, number>
  previousPrices: Record<MacroAssetId, number>
  positions: Record<MacroAssetId, MacroPosition>
  calendar: MacroCalendarEvent[]
  headlines: MacroHeadline[]
  trades: MacroTrade[]
  theses: MacroThesis[]
  history: MacroDailyPoint[]
  attribution: MacroAttribution
  risk: MacroRiskSnapshot
  peakGrossExposure: number
  peakRiskUtilisation: number
  peakConcentration: number
  turnover: number
  transactionCosts: number
  commissions: number
  activeDealerRfq?: MacroDealerRfq
  dealerRfqs: MacroDealerRfq[]
  dealerTrades: number
  dealerSavings: number
  score?: MacroScore
}

export interface MacroSessionSummary {
  id: string
  mode?: 'strategic' | 'live'
  durationSeconds?: number
  completedAt: string
  seed: number
  scenario: MacroScenarioFamily
  difficulty: Difficulty
  startingPortfolio?: string
  returnPct: number
  score: number
  rating: string
  maxDrawdown: number
  turnover: number
  grossExposure: number
  transactionCosts: number
  commissions?: number
  dealerTrades?: number
  dealerSavings?: number
  returnScore?: number
  riskScore?: number
  sizingScore?: number
  thesisScore?: number
  efficiencyScore?: number
  adaptabilityScore?: number
}
