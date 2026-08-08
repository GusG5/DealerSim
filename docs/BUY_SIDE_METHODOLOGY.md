# DealerSim v3.4 — Buy-Side Methodology

## Objective

DealerSim now separates two Global Macro training problems that should not be conflated:

1. **Global Macro Trader** — continuous markets, live P&L and tactical portfolio decisions under time pressure.
2. **Strategic Portfolio Manager** — a 30-day decision-paced mandate for slower asset allocation, thesis development and event-to-event rebalancing.

Both are educational simulations. They do not reproduce the proprietary portfolio, risk or execution systems of an asset manager or hedge fund.

## Shared asset universe

The buy-side universe contains six synthetic exposures:

- ES — S&P 500 future
- TY — US 10Y Treasury future
- FGBL — Euro-Bund future
- BRN — Brent crude future
- XAU — gold
- EUR/USD — synthetic FX exposure

Positions are represented as NAV weights so cross-asset risk can be compared without forcing the user to convert futures multipliers, margin and FX notionals manually.

## Global Macro Trader — continuous mode

The default live session lasts 25 minutes; 15- and 40-minute versions are also available. All six markets evolve continuously. The user can add, reduce, hedge or flatten a position at any point while scheduled release clocks and dealer quotes keep running.

A $100m synthetic NAV is marked continuously. Gross exposure, net exposure, cash, concentration, drawdown and factor exposure update as the portfolio changes.

The mode compresses several macro catalysts into a practice session. It is not intended to represent a literal 25-minute real-world market window.

## Strategic Portfolio Manager — decision-paced mode

The original buy-side engine remains available as a 30-day path. The user advances one day or to the next event and rebalances around scheduled macro information. It is better suited to medium-horizon allocation and explicit thesis discipline than the live mode.

## Cross-asset factor model

Both modes use six common factors plus idiosyncratic noise:

- Growth
- Inflation
- Policy tightening/easing
- Risk sentiment
- Energy
- USD

Each asset has signed factor loadings. Markets therefore share macro drivers without moving in lockstep. Learning mode exposes more of the simulated regime; harder modes require inference from price action and news.

## Expectations and macro releases

Scheduled releases show consensus before they occur. Actual outcomes are generated from the seed, scenario and surprise distribution. The market shock is driven primarily by actual versus consensus, not the headline level alone.

In continuous mode release clocks count down automatically. In Strategic PM mode releases occur when the simulated day reaches the event date.

## Pre-market briefing and opening book

Continuous Global Macro now begins with prices frozen. The user receives an overnight cross-asset briefing and the known macro calendar/consensus, then chooses an example portfolio, a flat book or a custom opening portfolio. The live clock begins only after **Open Market**. Future release outcomes remain hidden.

## Portfolio accounting and risk

Strategic PM retains its original cash-start convention. Continuous Global Macro can instead inherit the pre-market opening book at the opening mark. Inherited holdings generate no transaction cost, market impact or turnover because they represent positions already owned when the simulated trading session begins. Subsequent target-weight trades convert the desired market value into synthetic exposure units at the execution price; cash and NAV then evolve normally.

Shared controls include:

- Maximum gross exposure: 150%
- Instrument-specific maximum absolute weights: 25–35%
- Hard drawdown stop: 10%
- Concentration and factor-risk controls that can reject a trade before the gross limit is reached

## Execution routes

### Direct market

The position changes immediately at a synthetic executable price. Larger changes carry higher basis-point execution cost.

### Dealer RFQ

The user can request firm two-way prices from three or five fictional dealers. Dealer competitiveness varies with product strength, requested size and a synthetic inventory axe. The user chooses a counterparty and can split a block.

In live mode individual quotes expire after seconds while prices continue moving. In Strategic PM mode quotes expire when the simulated day advances.

### Worked execution

Continuous mode adds TWAP and liquidity-sensitive worked orders. Residual risk remains exposed while the order is incomplete. Liquidity-sensitive execution carries lower expected execution cost than immediate crossing, while predictable TWAP provides a simpler schedule. Orders can be paused, resumed, cancelled or crossed immediately.

## Thesis journal

Strategic PM mode uses explicit rationale, horizon, conviction and invalidation as a central part of the workflow.

Live mode makes journalling optional. This prevents routine hedges and tactical resizing from turning the terminal into a form-filling exercise. The user can still record important positions for post-session review.

## Attribution

Portfolio P&L is tracked by asset and decomposed into factor contributions, idiosyncratic residual and transaction costs. Reviews also show execution-route usage and dealer-vs-direct savings. The accounting is designed to reconcile to portfolio P&L up to rounding.

## Scoring

Live and strategic modes remain process-oriented. Scores consider:

- Return quality
- Drawdown and risk control
- Position sizing
- Thesis discipline
- Transaction efficiency
- Adaptability and factor concentration

Raw P&L alone should not dominate a poorly controlled mandate.

## Desk realism in v3.4

Continuous Macro and Equity Fund sessions now include a compressed time-of-day cycle, event-window liquidity withdrawal, synthetic stress tests, PM/risk oversight and imperfect sales/dealer market colour. Equity catalysts can reveal multiple earnings metrics before subsequent management commentary. Assessment sessions force the hidden/unknown scenario and remove pause/coaching conveniences. These additions are pedagogical abstractions rather than production risk or execution models.

## Limitations

The buy-side engine abstracts:

- Futures margin and exact contract mechanics
- Carry and roll
- Options and convexity
- Financing, borrow and collateral
- Prime-broker constraints
- Real dealer balance sheets and information barriers
- Institutional VaR / stress systems
- Empirical calibration to named securities

All factor loadings, volatilities, dealer axes and execution costs are synthetic training assumptions.

## v2.5 extension — equity funds

The buy-side platform now also contains continuous Long/Short Equity Hedge Fund and Long-Only Equity PM modes. These use a separate equity factor/catalyst engine with market, growth, value, quality, rates and momentum exposures; synthetic securities-borrow locates and borrow costs; ES beta hedging; dealer RFQs; and benchmark-relative or beta-adjusted alpha review. Full assumptions are documented in `EQUITY_FUND_METHODOLOGY.md`.
