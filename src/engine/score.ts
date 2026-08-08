import type { ScoreBreakdown, SessionSnapshot } from '../types'
import { estimateBlockExecution, netTradingPnl } from './accounting'

export function computeScore(snapshot: SessionSnapshot): ScoreBreakdown {
  const { position, metrics, hardLimitM } = snapshot
  const netPnl = netTradingPnl(position)
  const durationMinutes = Math.max(1, snapshot.elapsedSeconds / 60)
  const quoteCount = Math.max(1, metrics.quotesSubmitted)
  const rfqCount = Math.max(1, metrics.rfqsReceived)
  const acceptanceRate = metrics.quotesAccepted / quoteCount
  const responseRate = metrics.quotesSubmitted / rfqCount
  const staleRate = metrics.staleQuotes / quoteCount
  const averageInventory =
    metrics.inventorySamples > 0
      ? metrics.inventorySeconds / metrics.inventorySamples
      : 0
  const maxInventoryUtilisation = metrics.maximumInventoryM / Math.max(1, hardLimitM)
  const averageInventoryUtilisation = averageInventory / Math.max(1, hardLimitM)
  const averageSpread =
    metrics.quoteSpreadSamples > 0
      ? metrics.totalQuotedSpreadPips / metrics.quoteSpreadSamples
      : 0
  const averageResponseTime =
    metrics.responseSamples > 0
      ? metrics.totalResponseTime / metrics.responseSamples
      : 0
  const internalisationRate = metrics.grossClientVolumeM > 0
    ? metrics.internalisedVolumeM / metrics.grossClientVolumeM
    : 0
  const workedHedgeShare = metrics.exchangeHedgeVolumeM > 0
    ? metrics.workedHedgeVolumeM / metrics.exchangeHedgeVolumeM
    : 0
  const impactToCommission = position.grossCommission > 0
    ? metrics.marketImpactCost / position.grossCommission
    : metrics.marketImpactCost > 0 ? 1 : 0

  const pnlScore = clamp(
    54 + Math.tanh(netPnl / 7000) * 34 - Math.min(24, metrics.maximumDrawdown / 900),
    0,
    100,
  )

  const targetCommissionPerMinute = 540
  const commissionPace = position.grossCommission / durationMinutes
  const commissionRetention = position.grossCommission > 0
    ? clamp((netPnl + position.hedgeCosts) / position.grossCommission, -1, 1.5)
    : 0
  const commissionScore = clamp(
    (commissionPace / targetCommissionPerMinute) * 70 +
      clamp((commissionRetention + 0.2) / 1.2, 0, 1) * 30,
    0,
    100,
  )

  const inventoryScore = clamp(
    100 -
      maxInventoryUtilisation * 48 -
      averageInventoryUtilisation * 30 -
      metrics.softLimitBreaches * 4 -
      metrics.hardLimitBreaches * 18 -
      metrics.forcedLiquidations * 14,
    0,
    100,
  )

  const acceptanceTargetScore = acceptanceRate <= 0.72
    ? clamp(acceptanceRate / 0.52, 0, 1)
    : clamp(1 - (acceptanceRate - 0.72) / 0.28, 0, 1)
  // Score quote width against the market and block-execution conditions that
  // actually existed when each two-way quote was submitted. This avoids using
  // the end-of-session spread as a proxy for fifteen minutes of different RFQs.
  const spreadDisciplineSamples = snapshot.quoteHistory.flatMap((record) => {
    if (record.rfq.kind !== 'two-way' || !record.submission || record.submission.bid === undefined || record.submission.ask === undefined) return []
    const submittedSpread = (record.submission.ask - record.submission.bid) / snapshot.options.instrument.pipSize
    const market = record.submission.marketAtSubmission
    let targetSpread: number
    if (snapshot.options.instrument.marketStructure === 'central-limit-order-book') {
      const buy = estimateBlockExecution('buy', record.rfq.sizeM, market.orderBook, market, snapshot.options.instrument)
      const sell = estimateBlockExecution('sell', record.rfq.sizeM, market.orderBook, market, snapshot.options.instrument)
      const executableSpread = Math.max(market.spreadPips, (buy.impactAdjustedPrice - sell.impactAdjustedPrice) / snapshot.options.instrument.pipSize)
      const captureRatio = record.rfq.clientType === 'fast-money' ? 0.92 : record.rfq.clientType === 'hedge-fund' ? 0.84 : record.rfq.clientType === 'asset-manager' ? 0.72 : record.rfq.clientType === 'corporate' ? 0.68 : 0.62
      const riskPremium = Math.max(0, market.volatility - 0.3) * 0.7 + Math.max(0, 0.6 - market.liquidity) * 1.2
      targetSpread = Math.max(market.spreadPips, executableSpread * captureRatio + riskPremium)
    } else {
      targetSpread = market.spreadPips * 1.65
    }
    const tolerance = snapshot.options.instrument.marketStructure === 'central-limit-order-book' ? Math.max(2, targetSpread * 0.65) : Math.max(1.5, targetSpread * 0.7)
    return [clamp(1 - Math.abs(submittedSpread - targetSpread) / tolerance, 0, 1)]
  })
  const spreadDiscipline = spreadDisciplineSamples.length > 0
    ? spreadDisciplineSamples.reduce((sum, value) => sum + value, 0) / spreadDisciplineSamples.length
    : metrics.quoteSpreadSamples === 0 ? 1 : clamp(1 - Math.abs(averageSpread - snapshot.market.spreadPips * 1.65) / 4, 0, 1)
  const quoteQualityScore = clamp(
    responseRate * 44 + acceptanceTargetScore * 36 + spreadDiscipline * 20,
    0,
    100,
  )

  const adverseLossPenalty = Math.max(0, -metrics.adverseSelectionPnl) / 95
  const adverseSelectionScore = clamp(
    100 - staleRate * 92 - adverseLossPenalty - Math.max(0, acceptanceRate - 0.78) * 80,
    0,
    100,
  )

  const blockExecutionAdjustment = snapshot.options.instrument.marketStructure === 'central-limit-order-book'
    ? internalisationRate * 18 + Math.min(12, workedHedgeShare * 12) - Math.min(34, impactToCommission * 24)
    : 0
  const executionScore = clamp(
    88 +
      blockExecutionAdjustment -
      staleRate * 55 -
      metrics.fatFingerFlags * 11 -
      metrics.rfqsExpired * 2.5 -
      metrics.forcedLiquidations * 20 -
      Math.max(0, averageResponseTime - 5) * 4,
    0,
    100,
  )

  const overall = round1(
    pnlScore * 0.25 +
      commissionScore * 0.25 +
      inventoryScore * 0.2 +
      quoteQualityScore * 0.1 +
      adverseSelectionScore * 0.1 +
      executionScore * 0.1,
  )

  return {
    overall,
    rating: ratingFor(overall, snapshot),
    pnl: round1(pnlScore),
    commission: round1(commissionScore),
    inventory: round1(inventoryScore),
    quoteQuality: round1(quoteQualityScore),
    adverseSelection: round1(adverseSelectionScore),
    execution: round1(executionScore),
    feedback: buildFeedback({
      snapshot,
      netPnl,
      acceptanceRate,
      responseRate,
      staleRate,
      averageInventory,
      maxInventoryUtilisation,
      averageSpread,
      averageResponseTime,
      commissionPace,
      internalisationRate,
      workedHedgeShare,
      impactToCommission,
      scores: {
        pnlScore,
        commissionScore,
        inventoryScore,
        quoteQualityScore,
        adverseSelectionScore,
        executionScore,
      },
    }),
  }
}

interface FeedbackInputs {
  snapshot: SessionSnapshot
  netPnl: number
  acceptanceRate: number
  responseRate: number
  staleRate: number
  averageInventory: number
  maxInventoryUtilisation: number
  averageSpread: number
  averageResponseTime: number
  commissionPace: number
  internalisationRate: number
  workedHedgeShare: number
  impactToCommission: number
  scores: {
    pnlScore: number
    commissionScore: number
    inventoryScore: number
    quoteQualityScore: number
    adverseSelectionScore: number
    executionScore: number
  }
}

function buildFeedback(input: FeedbackInputs): string[] {
  const feedback: string[] = []
  const { snapshot, scores } = input

  if (scores.commissionScore >= 75 && scores.inventoryScore >= 68) {
    feedback.push('You maintained strong client coverage while keeping inventory risk broadly controlled.')
  } else if (input.commissionPace < 300) {
    feedback.push('Commission generation was low. You may have quoted too defensively or passed too much flow.')
  } else if (scores.commissionScore >= 70 && input.netPnl < 0) {
    feedback.push('Strong gross commission was not retained after inventory losses and hedging costs.')
  }

  if (input.staleRate > 0.2) {
    feedback.push('Too many clients traded on stale prices. Re-anchor your quote immediately before submitting in fast markets.')
  } else if (input.staleRate < 0.08 && snapshot.metrics.quotesSubmitted >= 8) {
    feedback.push('Stale-quote control was strong; your prices generally remained aligned with the live market.')
  }

  if (input.maxInventoryUtilisation > 0.82) {
    feedback.push('Inventory approached the hard limit. Skew quotes earlier instead of relying on a late market hedge.')
  } else if (input.averageInventory < snapshot.softLimitM * 0.35 && snapshot.metrics.clientTrades >= 5) {
    feedback.push('Inventory stayed well contained without materially suppressing client activity.')
  }

  if (snapshot.options.instrument.marketStructure === 'central-limit-order-book') {
    if (input.internalisationRate >= 0.32 && snapshot.metrics.clientTrades >= 4) {
      feedback.push('You internalised a meaningful share of client flow, reducing exchange impact and preserving commission.')
    } else if (snapshot.metrics.grossClientVolumeM >= snapshot.options.instrument.defaultSizeM * 4) {
      feedback.push('Internalisation was low. Hold manageable inventory for longer so opposite client flow can offset more risk before using the exchange.')
    }

    if (input.impactToCommission > 0.45) {
      feedback.push('Market impact consumed too much commission. Use smaller clips or liquidity-sensitive execution instead of sweeping the book.')
    } else if (input.workedHedgeShare > 0.3 && snapshot.metrics.exchangeHedgeVolumeM > 0) {
      feedback.push('You worked a useful share of the hedge rather than crossing the full block immediately.')
    }
  }

  if (snapshot.position.hedgeCosts > snapshot.position.grossCommission * 0.42) {
    feedback.push('Hedging consumed a large share of commission. Allow more natural offsetting flow when conditions permit.')
  }

  if (input.acceptanceRate < 0.28 && snapshot.metrics.quotesSubmitted >= 6) {
    feedback.push('Acceptance was low. Your spreads or skew were likely too defensive relative to client urgency.')
  } else if (input.acceptanceRate > 0.78) {
    feedback.push('Acceptance was unusually high. Check whether tight or stale quotes exposed you to informed flow.')
  }

  if (input.averageResponseTime > 6.5) {
    feedback.push('Quote response times were slow. Use the live market and keyboard controls to reduce decision latency.')
  }

  if (snapshot.metrics.hardLimitBreaches > 0 || snapshot.metrics.forcedLiquidations > 0) {
    feedback.push('A hard risk breach triggered forced action. Profits earned beyond the limit do not offset the control failure.')
  }

  if (scores.pnlScore >= 75 && scores.adverseSelectionScore >= 70) {
    feedback.push('P&L quality was good: returns were not driven solely by being picked off or carrying uncontrolled direction.')
  }

  if (feedback.length < 3) {
    feedback.push('Review the replay around your largest inventory swing and compare the cost of hedging with the next client flow.')
  }

  return feedback.slice(0, 5)
}

function ratingFor(score: number, snapshot: SessionSnapshot): string {
  if (snapshot.metrics.forcedLiquidations > 0 && score < 72) return 'Excessive Inventory Risk'
  if (score >= 86) return 'Strong Dealer Performance'
  if (score >= 74) return 'Controlled and Commercial'
  if (score >= 62) return 'Inconsistent but Viable'
  if (score >= 48) return 'Overtrading or Too Defensive'
  return 'Material Risk-Control Weaknesses'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
