# DealerSim Equity Fund Methodology — v3.4

## Purpose

The Equity Fund modes extend DealerSim from dealer market making and global macro into continuous buy-side equity portfolio management. They are educational simulations rather than models of any named fund, security, prime broker or execution venue.

## Long / Short Equity Hedge Fund

The hedge-fund mode runs a synthetic $100m portfolio with a 200% gross-exposure limit, ±85% net-exposure limit, instrument concentration limits and a 12% hard drawdown stop. The objective is not simply to maximise raw P&L. The review separates estimated broad-market beta P&L from residual alpha and scores risk control, position sizing, thesis discipline and execution.

The tradeable single-name universe is APEX, MEGA, NOVA, HELI, LUMA and ORBX. ES is included as a liquid index hedge. Securities span liquid large-cap, defensive, high-growth, less-liquid mid-cap and event-driven/hard-to-borrow profiles.

## Pre-market briefing and opening book

Continuous equity sessions now begin with prices frozen. The user reviews a synthetic morning research pack and chooses the portfolio inherited at the opening mark. Long-Only PM defaults to the benchmark but also supports equal-weight and custom books. Long/Short HF supports a model book, flat start or custom long/short book; opening shorts are checked against deterministic synthetic borrow capacity and carry the required locate into the live engine. Opening holdings are treated as pre-existing positions, so they generate no transaction cost, market impact or turnover. Only changes made after **Open Market** are scored as executions.

## Securities borrow and short locates

Single-name shorts require a synthetic locate. Locate capacity and annualised borrow rate depend on the instrument and a seeded crowding draw. Hard-to-borrow names may receive partial or rejected locates. Borrow costs accrue against short notional through a compressed 20-trading-day equivalent horizon. ES futures do not require a securities-borrow locate in the simulation.

## Long-Only Equity PM

Long-only mode uses the same continuous price, catalyst and execution engine but prohibits negative single-name weights. The portfolio is compared with a synthetic six-stock benchmark. Scoring therefore focuses on active alpha, drawdown, concentration, turnover and implementation rather than absolute return alone.

## Factor and catalyst model

Returns combine market, growth, value, quality, rates and momentum factors with asset-specific loadings and idiosyncratic noise. Scheduled company catalysts include earnings, guidance, analyst revisions, strategic events and regulatory headlines. Macro releases can rotate factor leadership. The exact loadings and event responses are training assumptions.

## Execution

Portfolio changes can be executed through the synthetic direct market, via firm quotes requested from three or five fictional dealers, or as worked orders. Dealer pricing depends on block size and a synthetic inventory axe. Dealer quotes expire in real time. Worked orders can use TWAP or liquidity-sensitive scheduling and leave market risk while the order remains incomplete.

## Beta hedging

Long/short mode provides an ES beta-hedge action. It estimates the beta contributed by current single-name weights and trades ES toward the opposite beta exposure, subject to portfolio limits. This is an educational approximation of portfolio beta management rather than a full covariance-based hedge model.

## Attribution and scoring

Review screens report asset P&L, factor P&L, transaction costs, borrow costs, estimated beta P&L and residual alpha P&L. Long-only alpha is benchmark-relative. Long/short alpha is approximated after subtracting estimated market-beta P&L.

## Limitations

The model does not reproduce real securities-lending markets, locate recalls, financing spreads, margin, corporate actions, dividends, tax, options, real-world factor models, portfolio VaR or proprietary risk systems. All prices, companies, counterparties and outcomes are synthetic.

## v3.0 additions

### Execution quality

Equity HF/AM trades are benchmarked from the synthetic arrival mid. DealerSim decomposes the signed cost of implementation into timing and contemporaneous execution impact/spread. The review reports implementation shortfall in basis points of executed notional. This is an educational TCA-style decomposition, not a real broker/exchange analytics model.

### Persistent dealer relationships

Dealer counterparties now retain local RFQ/fill history between equity-fund sessions. Each dealer also has a small synthetic product-speciality set. A stronger relationship can modestly improve future pricing/capacity, but current axes, liquidity and seeded variation remain more important. This prevents relationship history from becoming a guaranteed routing rule.

### Crowding and correlation regimes

The fund engine maintains a latent crowding signal by stock and a correlation regime: normal, dispersion or factor-squeeze. In Learning mode the selected stock's crowding interpretation is surfaced. In harder modes it remains hidden. Crowding can amplify positive catalysts in heavily shorted hard-to-borrow names and changes the probability/severity of squeeze behaviour.

### Same-seed replay

A finished fund session can be replayed with the same seed. This preserves the synthetic market/catalyst path while allowing different portfolio and execution decisions. The review compares the current attempt with the previous same-seed attempt where local history is available.


## v3.4 desk realism

The continuous equity tape now carries time-of-day liquidity/volatility states, a multi-stage earnings information sequence, synthetic stress testing, PM/risk oversight, sector gross/net diagnostics and imperfect sales/dealer colour. Advanced and Assessment modes also surface event-reasoning prompts. Assessment forces an unknown scenario and removes the one-click beta hedge so ES sizing must be performed manually.
