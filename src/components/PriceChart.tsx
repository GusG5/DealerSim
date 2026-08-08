import { useMemo } from 'react'
import type { InstrumentConfig, PricePoint, Trade } from '../types'
import { formatPrice } from '../lib/format'

interface PriceChartProps {
  history: PricePoint[]
  trades?: Trade[]
  instrument: InstrumentConfig
  compact?: boolean
}

export function PriceChart({ history, trades = [], instrument, compact = false }: PriceChartProps) {
  const data = useMemo(() => history.slice(compact ? -180 : -500), [history, compact])
  const chart = useMemo(() => buildChart(data, instrument.pipSize), [data, instrument.pipSize])

  if (data.length < 2 || !chart) {
    return <div className="chart-empty">Waiting for market data…</div>
  }

  const latest = data[data.length - 1]
  const first = data[0]
  const directionClass = latest.mid >= first.mid ? 'positive' : 'negative'
  const relevantTrades = trades.filter(
    (trade) => trade.timestamp >= first.t && trade.timestamp <= latest.t,
  )

  return (
    <div className={`price-chart${compact ? ' compact' : ''}`}>
      <div className="chart-toolbar">
        <div>
          <span>{instrument.symbol}</span>
          <strong className={directionClass}>{formatPrice(latest.mid, instrument.priceDecimals)}</strong>
        </div>
        <div className="chart-legend">
          <span><i className="legend-line" /> Mid</span>
          <span><i className="legend-dot client" /> Client</span>
          <span><i className="legend-dot hedge" /> Hedge</span>
        </div>
      </div>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label={`${instrument.symbol} simulated price chart`}
      >
        <defs>
          <linearGradient id="priceArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {chart.gridY.map((y) => (
          <line key={y} x1="0" x2={chart.width} y1={y} y2={y} className="chart-grid-line" />
        ))}
        <path d={chart.areaPath} fill="url(#priceArea)" />
        <path d={chart.linePath} className="chart-price-line" />
        {relevantTrades.slice(-35).map((trade) => {
          const point = projectTrade(trade, chart, first.t, latest.t)
          return (
            <g key={trade.id} transform={`translate(${point.x} ${point.y})`}>
              <circle
                r="3.2"
                className={trade.source === 'client' ? 'chart-trade-client' : 'chart-trade-hedge'}
              />
              <title>
                {trade.source} {trade.side} {trade.sizeM} units at {formatPrice(trade.price, instrument.priceDecimals)}
              </title>
            </g>
          )
        })}
        <line
          x1="0"
          x2={chart.width}
          y1={chart.lastY}
          y2={chart.lastY}
          className="chart-last-line"
        />
        <text x={chart.width - 4} y={Math.max(12, chart.lastY - 5)} textAnchor="end" className="chart-last-label">
          {formatPrice(latest.mid, instrument.priceDecimals)}
        </text>
      </svg>
      <div className="chart-axis-labels">
        <span>{formatPrice(chart.max, instrument.priceDecimals)}</span>
        <span>{formatPrice(chart.min, instrument.priceDecimals)}</span>
      </div>
    </div>
  )
}

interface ChartGeometry {
  width: number
  height: number
  min: number
  max: number
  linePath: string
  areaPath: string
  lastY: number
  gridY: number[]
}

function buildChart(data: PricePoint[], priceIncrement: number): ChartGeometry | null {
  if (data.length < 2) return null
  const width = 720
  const height = 250
  const values = data.map((point) => point.mid)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const padding = Math.max((rawMax - rawMin) * 0.15, priceIncrement * 1.2)
  const min = rawMin - padding
  const max = rawMax + padding
  const span = Math.max(max - min, priceIncrement * 0.1)

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((point.mid - min) / span) * height
    return { x, y }
  })
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`
  return {
    width,
    height,
    min,
    max,
    linePath,
    areaPath,
    lastY: points[points.length - 1].y,
    gridY: [0.25, 0.5, 0.75].map((fraction) => height * fraction),
  }
}

function projectTrade(
  trade: Trade,
  chart: ChartGeometry,
  startTime: number,
  endTime: number,
): { x: number; y: number } {
  const timeSpan = Math.max(0.01, endTime - startTime)
  const x = ((trade.timestamp - startTime) / timeSpan) * chart.width
  const y = chart.height - ((trade.price - chart.min) / Math.max(Number.EPSILON, chart.max - chart.min)) * chart.height
  return {
    x: Math.max(0, Math.min(chart.width, x)),
    y: Math.max(0, Math.min(chart.height, y)),
  }
}
