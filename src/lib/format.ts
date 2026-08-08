import type { InstrumentConfig } from '../types'

export function formatPrice(value: number, decimals = 5): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '—'
}

export function formatMoney(value: number, digits = 0): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}


export function formatInstrumentMoney(
  value: number,
  instrument: InstrumentConfig,
  digits = 0,
): string {
  const symbol =
    instrument.quoteCurrency === 'EUR'
      ? '€'
      : instrument.quoteCurrency === 'GBP'
        ? '£'
        : instrument.quoteCurrency === 'JPY'
          ? '¥'
          : '$'
  const sign = value < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function formatSize(value: number): string {
  return `€${value.toLocaleString('en-GB', {
    maximumFractionDigits: 1,
  })}m`
}

export function formatInstrumentSize(value: number, instrument: InstrumentConfig): string {
  return `${instrument.sizePrefix}${value.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: instrument.sizeStepM < 1 ? 1 : 0,
  })}${instrument.sizeSuffix}`
}


export function formatInstrumentNotional(
  size: number,
  price: number,
  instrument: InstrumentConfig,
): string {
  const notional = size * instrument.unitsPerSize * price
  return formatInstrumentMoney(notional, instrument)
}

export function quoteUnitLabel(instrument: InstrumentConfig): string {
  return instrument.marketStructure === 'central-limit-order-book' ? 'ticks' : 'pips'
}

export function sizeUnitLabel(instrument: InstrumentConfig): string {
  if (instrument.assetClass === 'single-stock-equity') return 'thousand shares'
  if (instrument.assetClass === 'fx') return 'millions'
  return 'contracts'
}
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(clamped / 60)
  const remainder = clamped % 60
  return `${minutes.toString().padStart(2, '0')}:${remainder
    .toString()
    .padStart(2, '0')}`
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function titleCase(value: string): string {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
