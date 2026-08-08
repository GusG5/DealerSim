import type {
  BlockExecutionEstimate,
  InstrumentConfig,
  MarketSnapshot,
  OrderBookLevel,
  PositionState,
  Trade,
  TradeSide,
} from '../types'

export function emptyPosition(): PositionState {
  return {
    quantityM: 0,
    averagePrice: 0,
    realisedPnl: 0,
    unrealisedPnl: 0,
    grossCommission: 0,
    hedgeCosts: 0,
    turnoverM: 0,
  }
}

export function applyTrade(
  position: PositionState,
  trade: Trade,
  markPrice: number,
  instrument: InstrumentConfig,
): PositionState {
  const signedQuantity = trade.side === 'buy' ? trade.sizeM : -trade.sizeM
  const oldQuantity = position.quantityM
  const newQuantity = oldQuantity + signedQuantity
  let averagePrice = position.averagePrice
  let realisedPnl = position.realisedPnl

  const sameDirection = oldQuantity === 0 || Math.sign(oldQuantity) === Math.sign(signedQuantity)

  if (sameDirection) {
    const oldAbs = Math.abs(oldQuantity)
    const addedAbs = Math.abs(signedQuantity)
    averagePrice = oldAbs + addedAbs === 0
      ? 0
      : (position.averagePrice * oldAbs + trade.price * addedAbs) / (oldAbs + addedAbs)
  } else {
    const closedSize = Math.min(Math.abs(oldQuantity), Math.abs(signedQuantity))
    if (oldQuantity > 0) {
      realisedPnl += (trade.price - position.averagePrice) * closedSize * instrument.pnlMultiplier
    } else {
      realisedPnl += (position.averagePrice - trade.price) * closedSize * instrument.pnlMultiplier
    }

    if (newQuantity === 0) {
      averagePrice = 0
    } else if (Math.sign(newQuantity) !== Math.sign(oldQuantity)) {
      averagePrice = trade.price
    }
  }

  const next: PositionState = {
    quantityM: newQuantity,
    averagePrice,
    realisedPnl,
    unrealisedPnl: 0,
    grossCommission: position.grossCommission + trade.commission,
    hedgeCosts: position.hedgeCosts + trade.executionCost,
    turnoverM: position.turnoverM + trade.sizeM,
  }

  next.unrealisedPnl = calculateUnrealisedPnl(next, markPrice, instrument)
  return next
}

export function calculateUnrealisedPnl(
  position: PositionState,
  markPrice: number,
  instrument: InstrumentConfig,
): number {
  if (position.quantityM === 0 || position.averagePrice === 0) return 0
  return (markPrice - position.averagePrice) * position.quantityM * instrument.pnlMultiplier
}

export function markPosition(
  position: PositionState,
  markPrice: number,
  instrument: InstrumentConfig,
): PositionState {
  return {
    ...position,
    unrealisedPnl: calculateUnrealisedPnl(position, markPrice, instrument),
  }
}

export function netTradingPnl(position: PositionState): number {
  return position.realisedPnl + position.unrealisedPnl + position.grossCommission - position.hedgeCosts
}

export interface BookExecution {
  averagePrice: number
  filledM: number
  unfilledM: number
  executionCost: number
  levelsConsumed: number
  hiddenLiquidityUsedM: number
}

export function executeAgainstBook(
  side: TradeSide,
  requestedSizeM: number,
  orderBook: OrderBookLevel[],
  market: MarketSnapshot,
  instrument: InstrumentConfig,
): BookExecution {
  let remaining = Math.max(0, requestedSizeM)
  let notionalPrice = 0
  let filled = 0
  let levelsConsumed = 0
  let hiddenLiquidityUsedM = 0

  for (const level of orderBook) {
    if (remaining <= 1e-9) break
    const displayedAvailable = side === 'buy' ? level.askSizeM : level.bidSizeM
    // A central book can contain reserve/iceberg liquidity that is not displayed.
    // The snapshot exposes only a noisy training estimate; actual fills can therefore
    // be better than the visible book alone would imply.
    const hiddenMultiplier = market.hiddenLiquidityShare > 0 ? 1 + market.hiddenLiquidityShare * (level.level <= 2 ? 1 : 0.55) : 1
    const available = displayedAvailable * hiddenMultiplier
    const price = side === 'buy' ? level.ask : level.bid
    const quantity = Math.min(remaining, available)
    if (quantity <= 0) continue
    filled += quantity
    hiddenLiquidityUsedM += Math.max(0, quantity - displayedAvailable)
    notionalPrice += quantity * price
    remaining -= quantity
    levelsConsumed += 1
  }

  if (remaining > 1e-9 && orderBook.length > 0) {
    const last = orderBook[orderBook.length - 1]
    const previous = orderBook[Math.max(0, orderBook.length - 2)]
    const levelSpacing = side === 'buy'
      ? Math.max(market.ask - market.bid, last.ask - previous.ask)
      : Math.max(market.ask - market.bid, previous.bid - last.bid)
    const lastDisplayedSize = side === 'buy' ? last.askSizeM : last.bidSizeM
    const impactMultiplier = 1 + Math.min(2, remaining / Math.max(1, lastDisplayedSize)) * 0.45
    const fallbackPrice = side === 'buy'
      ? last.ask + levelSpacing * impactMultiplier
      : last.bid - levelSpacing * impactMultiplier
    filled += remaining
    notionalPrice += remaining * fallbackPrice
    remaining = 0
    levelsConsumed += 1
  }

  const averagePrice = filled > 0 ? notionalPrice / filled : market.mid
  const referencePrice = side === 'buy' ? market.ask : market.bid
  const slippagePerUnit = side === 'buy'
    ? Math.max(0, averagePrice - referencePrice)
    : Math.max(0, referencePrice - averagePrice)
  const executionCost = slippagePerUnit * filled * instrument.pnlMultiplier

  return {
    averagePrice,
    filledM: filled,
    unfilledM: Math.max(0, requestedSizeM - filled),
    executionCost,
    levelsConsumed,
    hiddenLiquidityUsedM,
  }
}

export function estimateBlockExecution(
  side: TradeSide,
  requestedSizeM: number,
  orderBook: OrderBookLevel[],
  market: MarketSnapshot,
  instrument: InstrumentConfig,
): BlockExecutionEstimate {
  const execution = executeAgainstBook(side, requestedSizeM, orderBook, market, instrument)
  const displayedDepthM = orderBook.reduce(
    (total, level) => total + (side === 'buy' ? level.askSizeM : level.bidSizeM),
    0,
  )
  // Participation is measured against displayed depth rather than clamped at 100%.
  // A block larger than the visible book should therefore create more impact than
  // a block equal to displayed depth, while the cap avoids runaway synthetic moves.
  const participation = requestedSizeM / Math.max(instrument.minimumSizeM, displayedDepthM)
  const effectiveParticipation = Math.min(4, Math.max(0, participation))
  const liquidityPenalty = 1 / Math.max(0.18, market.liquidity)
  const volatilityPenalty = 1 + Math.min(2, market.volatility * 0.22)
  const temporaryImpactPips = instrument.marketStructure === 'central-limit-order-book'
    ? instrument.impactCoefficientPips * Math.sqrt(effectiveParticipation) * liquidityPenalty * volatilityPenalty
    : instrument.impactCoefficientPips * Math.max(0, participation - 0.35) * liquidityPenalty
  const signedImpact = temporaryImpactPips * instrument.pipSize * (side === 'buy' ? 1 : -1)
  const impactAdjustedPrice = execution.averagePrice + signedImpact
  const topOfBookPrice = side === 'buy' ? market.ask : market.bid
  const slippagePips = side === 'buy'
    ? (execution.averagePrice - topOfBookPrice) / instrument.pipSize
    : (topOfBookPrice - execution.averagePrice) / instrument.pipSize
  const implementationShortfall = Math.abs(impactAdjustedPrice - market.mid) * requestedSizeM * instrument.pnlMultiplier
  const hiddenLiquidityUsedM = execution.hiddenLiquidityUsedM

  return {
    side,
    requestedSizeM,
    directVwap: execution.averagePrice,
    impactAdjustedPrice,
    topOfBookPrice,
    temporaryImpactPips,
    slippagePips,
    levelsConsumed: execution.levelsConsumed,
    displayedDepthM,
    implementationShortfall,
    participationRate: participation,
    hiddenLiquidityUsedM,
  }
}

export function visibleDepthForSide(
  side: TradeSide,
  orderBook: OrderBookLevel[],
): number {
  return orderBook.reduce(
    (total, level) => total + (side === 'buy' ? level.askSizeM : level.bidSizeM),
    0,
  )
}
