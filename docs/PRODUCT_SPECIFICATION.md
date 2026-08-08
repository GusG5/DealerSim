# DealerSim Product Specification — v1.2.0

## Objective

Create a standalone, single-player market-making training simulator that is fun enough for repeat practice, financially coherent enough to teach useful dealer decisions, and polished enough to discuss as a markets-focused portfolio project.

## Fixed product decisions

- Standalone React/TypeScript application
- Single-player only
- Desktop/laptop only
- 15-minute standard sessions
- Continuous trading with regime changes and market events
- Synthetic data only
- No login, backend or live market feed
- Local browser persistence
- Private source code initially
- Institutional dark-terminal visual style

## Primary markets

Single-stock equities:

- APEX — balanced liquid large-cap
- MEGA — very liquid mega-cap
- NOVA — volatile high-beta growth stock
- HELI — defensive large-cap
- LUMA — less-liquid mid-cap with slower replenishment and higher impact
- ORBX — event-driven small/mid-cap with unstable depth and severe stress behaviour

Macro futures:

- FGBL — Euro-Bund
- BRN — Brent crude
- ES — E-mini S&P 500

EUR/USD is retained as a secondary legacy comparison mode.

## v1.2 dealer completion rules

- Completed sessions persist richer practice metadata locally, including score components, internalisation, market impact, drawdown and desk mode.
- The progress dashboard compares like-for-like sessions without aggregating incompatible P&L currencies into a misleading headline number.
- Single-market P&L must reconcile exactly to realised + unrealised + client commission − hedge execution costs.
- Cross-asset P&L attribution must reconcile to portfolio USD-equivalent P&L with adverse-selection markout treated only as a diagnostic.
- Quote-quality scoring uses the full-block executable market, client type, volatility and liquidity at each quote submission time. It must not infer fifteen minutes of quote quality from the final market spread.
- Hard-limit forced liquidation must synchronise position, risk metrics and displayed equity within the same simulation tick.

## v1.1 microstructure rules

- Displayed top-of-book spread and full-size executable spread are separate concepts.
- Aggressive market participation changes the subsequent market, not just the current trade VWAP.
- Large participation creates temporary mid-price impact, same-side depth depletion, quote cancellations and spread pressure.
- The magnitude and decay of that footprint are instrument-specific. MEGA and ES replenish quickly; LUMA and especially ORBX recover slowly.
- The order book carries a dynamic imbalance state. Buy pressure tends to leave bids relatively heavier than offers; sell pressure does the opposite. The imbalance only weakly influences the next price move and is not deterministic.
- A changing reserve / iceberg-liquidity component sits behind displayed depth. Learning mode can show an uncertain estimate; harder modes require inference from realised fills.
- Repetitive worked-order clips create information leakage. Predictable TWAP flow raises later cancellation and impact risk; liquidity-sensitive schedules reduce this penalty.
- Liquidity is classified dynamically as deep, normal, thin or stressed.
- Internalisation is explicitly valued through estimated exchange impact avoided as well as reduced exchange hedge volume.

## Modes

### Single market

One active instrument with detailed depth, client ticket, execution controls and replay.

### Dual market

Two independently live books with overlapping RFQs, shared macro news and portfolio risk.

### Three-market desk

Three live instruments with one macro calendar, shared latent factors, one consolidated RFQ queue and aggregate risk constraints.

## RFQ realism rules

- Two-way RFQs require both a bid and an offer.
- Directional RFQs are true one-way requests: client buy interest requires only a dealer offer; client sell interest requires only a dealer bid.
- Limit-interest requests use the same one-way ticket and enforce the client limit.
- One-way acceptance is judged against the relevant full-block exchange alternative without applying a meaningless two-way spread penalty.
- A competitive quote is not classified as stale unless the market subsequently moves against the dealer and leaves the quote materially through the current market.
- Learning mode may show side-specific suggested prices, client price improvement and inventory effect; harder modes require the user to infer these.

## Core trading loop

1. Observe market, depth, news, client-flow signals and inventory.
2. Receive an institutional RFQ.
3. Price the requested block before the deadline.
4. Client accepts or rejects based on full-block alternative, urgency, toxicity and price sensitivity.
5. Inventory, commission and P&L update.
6. Decide whether to internalise future flow, hedge immediately, work the order or post passively.
7. Manage scheduled macro releases, surprise headlines and changing liquidity.
8. Review score, P&L attribution, macro outcomes and execution decisions.

## Block benchmark

For central-order-book products, the client benchmark is calculated from:

- Full requested quantity
- Visible depth by level
- VWAP from sweeping the book
- Temporary market-impact estimate
- Current liquidity and volatility

Client acceptance uses this whole-block executable alternative rather than top-of-book alone.

## Market impact

Aggressive execution:

- Sweeps successive depth levels
- Adds slippage
- Creates temporary price displacement
- Depletes displayed liquidity
- Increases the cost of immediately following clips

Impact and depth depletion recover according to instrument-specific replenishment speeds.

## Cross-asset factor model

Two- and three-market desks share continuously evolving latent factors:

- Inflation
- Growth
- Policy
- Risk sentiment
- Energy

Each instrument has a signed loading to these factors. Company-specific and idiosyncratic noise remain separate. This produces correlation without deterministic lockstep movement. Learning mode may expose the model factor pulse; Standard, Advanced and Assessment modes hide the latent values and require inference from observable market information.

## Macro calendar

Scheduled events have:

- Consensus expectation
- Actual result
- Surprise magnitude in standard deviations
- Factor classification
- Instrument-specific sensitivity

Typical templates include CPI, payrolls, policy decisions, retail sales and crude inventories.

## Client-flow persistence

Client counterparties have persistent urgency, toxicity, size and directional tendencies. Executed client flow updates that client's directional bias and weakly influences similar client categories. Multi-market dashboards show recent net client flow by instrument.

## Execution choices

- Immediate full hedge
- Immediate partial hedge
- Passive order
- Even/TWAP-style worked hedge
- Liquidity-sensitive worked hedge
- Manual total size, clip and interval

Live worked orders can be paused, resumed, accelerated, slowed, crossed or cancelled.

## Scenarios

- Balanced Flow
- One-Way Flow
- Fast Market
- Illiquid Market
- News Shock
- Toxic Flow
- Unknown Market

Scenarios parameterise rather than script price paths, liquidity, toxicity, RFQ intensity, event severity and regime transitions.

## Scoring

- Risk-adjusted P&L: 25%
- Commission and client flow: 25%
- Inventory management: 20%
- Quote quality: 10%
- Adverse-selection control: 10%
- Execution discipline: 10%

Cross-asset scoring adds attention and concentration penalties.

## Review analytics

- Per-instrument and portfolio P&L
- Commission
- Client price edge
- Exchange slippage
- Market impact
- Inventory/timing residual
- Adverse-selection markout
- Internalisation rate
- Estimated impact avoided
- Maximum inventory / portfolio risk
- RFQs missed
- Macro release outcomes
- Replay charts and execution markers

## Explicit limitations

DealerSim is not intended to reproduce a bank pricing stack, venue microstructure or proprietary simulation exactly. Hidden liquidity, fragmented execution, queue priority, borrowing, capital charges and real smart-order-routing algorithms are simplified.

# v2.0 Global Macro buy-side mode

## Product objective

Global Macro is a distinct buy-side training surface inside DealerSim. The user is a portfolio manager rather than a liquidity provider. The mode removes incoming client RFQs, client commission and dealer-inventory objectives and replaces them with portfolio construction, macro thesis formation, hedging, drawdown control and attribution. Buy-side execution can still use outbound dealer RFQs to request firm block liquidity.

## Mandate

- Starting NAV: $100m
- Simulation horizon: 30 trading days
- Objective: positive absolute return with controlled drawdown and coherent thesis process
- Gross exposure hard limit: 150%
- Hard drawdown stop: 10%
- Instrument max absolute weight: 25–35%
- Decision pacing: user advances one day or jumps to the next scheduled event

## Tradeable universe

- ES — S&P 500 future
- TY — US 10Y Treasury future
- FGBL — Euro-Bund future
- BRN — Brent crude future
- XAU — Gold
- EUR/USD — FX exposure

## Core workflow

1. Read the macro calendar and market path.
2. Compare actual releases with consensus.
3. Form a thesis using growth, inflation, policy, valuation, momentum, catalyst, relative value, positioning or risk-hedge reasoning.
4. Choose a target portfolio weight.
5. Record horizon, conviction and invalidation condition.
6. Execute the target and incur transaction cost.
7. Monitor gross/net exposure, factor risk, concentration and drawdown.
8. Advance through the market path and update the portfolio when the thesis changes.
9. Review asset attribution, factor attribution, thesis outcomes and process score.

## Scoring

- Return quality: 30%
- Risk control: 25%
- Position sizing: 15%
- Thesis discipline: 15%
- Transaction efficiency: 10%
- Adaptability / factor concentration: 5%

## Training modes

Learning mode exposes the resolved scenario and explains factor relationships. Standard hides the underlying scenario but retains institutional-style risk diagnostics. Advanced and Assessment increase idiosyncratic noise and remove interpretive coaching.

## Future extensions

The shared buy-side architecture is intended to support later long-only benchmark-relative asset management and long/short equity hedge-fund modes without reusing dealer-specific RFQ mechanics.


# v2.1 Buy-side dealer RFQ execution

Global Macro target-weight changes can be routed directly to the synthetic market or sent as a firm RFQ to three or five fictional dealers. Each dealer returns a two-way block price, firm size and synthetic inventory axe. The user executes the relevant bid or offer, and DealerSim records the actual execution cost and estimated saving/premium versus the direct-market benchmark. Quotes expire when the simulated day advances. The user may fill the full request or a 50% clip, then re-RFQ the residual to simulate splitting a block across counterparties.

## v2.2 buy-side live mode

Global Macro Trader is the primary tactical buy-side experience. It runs continuously for 15, 25 or 40 minutes, with a 25-minute default. The user initiates portfolio trades rather than responding to client RFQs. Execution routes are direct market, dealer RFQ and worked execution. Scheduled macro events release automatically against visible consensus expectations. Strategic Portfolio Manager remains available as a separate 30-day decision-paced workflow.

## v2.5 equity hedge fund and asset-management modes

DealerSim adds two continuous equity buy-side mandates. Long/Short Equity models stock selection, short borrow, gross/net exposure, beta hedging and company catalysts under a 200% gross limit. Long-Only Equity PM uses the same market and execution engine but prohibits negative weights and measures alpha versus a synthetic equity benchmark. Both support manual notional or target-weight sizing, dealer RFQs, partial fills, worked execution, optional thesis journalling and post-session attribution.
