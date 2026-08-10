export interface BuySideInstrumentMeta {
  transactionCostBps: number
  contractMultiplier: number
  commissionPerUnit: number
  minimumCommission: number
  quantityStep: number
  unitLabel: string
  unitPlural: string
}

export type BuySideCommissionVenue = 'direct-market' | 'dealer-rfq' | 'worked-order' | 'auction'

export function notionalFromNativeQuantity(asset: BuySideInstrumentMeta, price: number, quantity: number): number {
  return Math.abs(quantity) * Math.max(0, price) * asset.contractMultiplier
}

export function nativeQuantityFromNotional(asset: BuySideInstrumentMeta, price: number, notional: number): number {
  const unitValue = Math.max(0.000001, Math.abs(price) * asset.contractMultiplier)
  return Math.abs(notional) / unitValue
}

export function roundNativeQuantity(asset: BuySideInstrumentMeta, quantity: number): number {
  const step = Math.max(0.000001, asset.quantityStep)
  return Math.max(0, Math.round(Math.abs(quantity) / step) * step)
}

export function commissionForNotional(asset: BuySideInstrumentMeta, price: number, notional: number, venue: BuySideCommissionVenue): number {
  if (venue === 'dealer-rfq' || notional <= 0) return 0
  const quantity = nativeQuantityFromNotional(asset, price, notional)
  const routeMultiplier = venue === 'worked-order' ? 1.15 : venue === 'auction' ? 0.90 : 1
  return Math.max(asset.minimumCommission, quantity * asset.commissionPerUnit * routeMultiplier)
}

export function topOfBookQuote(
  asset: BuySideInstrumentMeta,
  mid: number,
  liquidityMultiplier = 1,
  volatilityMultiplier = 1,
): { bid: number; offer: number; halfSpreadBps: number } {
  const liquidity = Math.max(0.65, liquidityMultiplier)
  const volatility = Math.max(0.75, volatilityMultiplier)
  const halfSpreadBps = Math.max(0.04, asset.transactionCostBps * 0.52 * Math.sqrt(liquidity) * (0.96 + 0.08 * volatility))
  const half = mid * halfSpreadBps / 10_000
  return { bid: mid - half, offer: mid + half, halfSpreadBps }
}

export function formatNativeQuantity(asset: BuySideInstrumentMeta, quantity: number): string {
  const step = asset.quantityStep
  const digits = step >= 1 ? 0 : Math.min(3, Math.ceil(Math.abs(Math.log10(step))))
  return Math.abs(quantity).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
