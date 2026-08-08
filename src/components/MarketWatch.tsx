import {
  BUND_FUTURE,
  BRENT_FUTURE,
  EQUITY_INSTRUMENTS,
  SP500_FUTURE,
  getInstrumentTrainingProfile,
} from '../engine/config'
import type { SessionSnapshot } from '../types'
import { formatPrice, quoteUnitLabel } from '../lib/format'

interface MarketWatchProps {
  snapshot: SessionSnapshot
}

export function MarketWatch({ snapshot }: MarketWatchProps) {
  const instrument = snapshot.options.instrument
  const start = snapshot.priceHistory[0]?.mid ?? snapshot.market.mid
  const move = (snapshot.market.mid - start) / instrument.pipSize
  const profile = getInstrumentTrainingProfile(instrument)
  const equityWatch = instrument.assetClass === 'single-stock-equity'
    ? [instrument, ...EQUITY_INSTRUMENTS.filter((item) => item.id !== instrument.id)].slice(0, 4)
    : []

  const rows = instrument.assetClass === 'single-stock-equity'
    ? equityWatch.map((item) => {
        const active = item.id === instrument.id
        return {
          symbol: item.symbol,
          price: formatPrice(active ? snapshot.market.mid : item.initialPrice, item.priceDecimals),
          change: active ? `${move >= 0 ? '+' : ''}${move.toFixed(1)}t` : 'ready',
          active,
        }
      })
    : instrument.assetClass === 'rates'
      ? futuresRows(instrument.symbol, snapshot.market.mid, move, instrument.priceDecimals, [
          ['FGBL', BUND_FUTURE.initialPrice],
          ['FGBM', 116.42],
          ['FGBS', 106.18],
        ])
      : instrument.assetClass === 'commodities'
        ? futuresRows(instrument.symbol, snapshot.market.mid, move, instrument.priceDecimals, [
            ['BRN', BRENT_FUTURE.initialPrice],
            ['WTI', 75.84],
            ['GO', 702.5],
          ])
        : instrument.assetClass === 'equity-index'
          ? futuresRows(instrument.symbol, snapshot.market.mid, move, instrument.priceDecimals, [
              ['ES', SP500_FUTURE.initialPrice],
              ['NQ', 19180],
              ['FESX', 4925],
            ])
          : [
              { symbol: instrument.symbol, price: formatPrice(snapshot.market.mid, instrument.priceDecimals), change: `${move >= 0 ? '+' : ''}${move.toFixed(1)}p`, active: true },
              { symbol: 'GBP/USD', price: '1.27420', change: '—', active: false },
              { symbol: 'USD/JPY', price: '146.820', change: '—', active: false },
            ]

  return (
    <div className="market-watch">
      <div className="asset-tabs cross-asset-tabs">
        <button className={instrument.assetClass === 'single-stock-equity' ? 'active' : ''} type="button">1. Equity</button>
        <button className={instrument.assetClass === 'rates' ? 'active' : ''} type="button">2. Rates</button>
        <button className={instrument.assetClass === 'commodities' ? 'active' : ''} type="button">3. Commodity</button>
        <button className={instrument.assetClass === 'equity-index' ? 'active' : ''} type="button">4. Index</button>
        <button type="button" disabled>5. Multi</button>
      </div>
      <table>
        <thead>
          <tr><th>Security</th><th>Reference</th><th>Move</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className={row.active ? 'active-row' : 'disabled-row'}>
              <td>{row.symbol}</td>
              <td>{row.price}</td>
              <td className={row.active ? (row.change.startsWith('-') ? 'negative' : 'positive') : ''}>{row.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="market-watch-note">
        {instrument.marketStructure === 'central-limit-order-book'
          ? `${snapshot.market.participantCount} simulated background participants · moves shown in ${quoteUnitLabel(instrument)}${instrument.assetClass === 'single-stock-equity' && EQUITY_INSTRUMENTS.length > equityWatch.length ? ` · ${equityWatch.length}/${EQUITY_INSTRUMENTS.length} equity profiles shown` : ''}.`
          : 'Legacy FX mode remains available, while DealerSim primarily focuses on exchange-traded block execution.'}
      </p>
      {profile && (
        <p className="market-watch-profile">
          {profile.archetype} · liquidity {profile.liquidityLabel.toLowerCase()} · impact {profile.impactLabel.toLowerCase()}.
        </p>
      )}
    </div>
  )
}

function futuresRows(
  activeSymbol: string,
  activePrice: number,
  move: number,
  decimals: number,
  references: Array<[string, number]>,
) {
  return references.map(([symbol, reference]) => {
    const active = symbol === activeSymbol
    return {
      symbol,
      price: formatPrice(active ? activePrice : reference, decimals),
      change: active ? `${move >= 0 ? '+' : ''}${move.toFixed(1)}t` : 'ready',
      active,
    }
  })
}
