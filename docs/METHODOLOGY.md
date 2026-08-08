# DealerSim Technical Methodology

DealerSim is an educational simulation. The formulas below are deliberately transparent so the user can understand what the model is training and where it simplifies real market microstructure.

## 1. Deterministic simulation

Every session is seeded. Market noise, RFQ timing, client selection, news outcomes and macro surprises are generated from deterministic pseudo-random streams. Replaying the same seed with the same actions reproduces the same path.

## 2. Single-instrument price process

For each short time step, the synthetic mid-price combines:

- Mean reversion toward an anchor
- Regime-dependent drift
- Gaussian market noise
- Persistent post-news drift
- Temporary execution/factor impulses

Conceptually:

`ΔP = mean_reversion + drift + volatility × ε + news_impulse + external_factor_impulse`

The volatility and liquidity parameters change by regime and instrument.

## 3. Synthetic central limit order book

Exchange-traded instruments generate multiple levels around the current mid-price. Spread and depth depend on:

- Instrument profile
- Current liquidity
- Current volatility
- Temporary liquidity depletion after aggressive execution

Equity markets show five levels by default in the terminal but the engine can maintain eight levels internally.

## 4. Full-block execution benchmark

For a requested client size `Q`, DealerSim consumes displayed exchange liquidity level-by-level:

`VWAP = Σ(price_i × quantity_i) / Q`

If `Q` exceeds displayed depth, residual size is filled using an extrapolated impact price beyond the deepest visible level.

The block benchmark then adds a temporary-impact estimate to the exchange VWAP.

## 5. Temporary market impact

For central-order-book products, impact increases with order participation and worsens when liquidity is low or volatility is high. Participation is measured against displayed depth and can exceed 100% when the requested block is larger than the visible book (with a cap to prevent runaway synthetic moves).

The implemented form is proportional to:

`impact ∝ impact_coefficient × sqrt(participation) × liquidity_penalty × volatility_penalty`

Aggressive execution then:

- Moves the simulated mid-price immediately
- Adds a decaying residual price impulse
- Depletes displayed liquidity

The instrument-specific recovery parameter controls how quickly price impact and depth depletion decay.

## 6. Client acceptance and RFQ type

The client evaluates a dealer quote against the estimated **full-block** exchange alternative, not the best displayed quote alone.

Two-way RFQs require both a bid and an offer. Quote width, centre/skew, response time and client characteristics all influence acceptance.

Directional RFQs are different: a client who asks for an offer receives only an offer, while a client who asks for a bid receives only a bid. The unused side is neither transmitted nor used in the acceptance calculation. Limit-interest requests use the same one-way logic but additionally enforce the client's stated limit.

Acceptance probability combines:

- Dealer price improvement versus the relevant full-block benchmark
- Client urgency
- Client price sensitivity
- Quote width for two-way RFQs only
- Response time
- Client toxicity / selective trading behaviour
- Inventory-aware commercial guidance in Learning mode

A deliberately aggressive block quote is not automatically classified as stale. Staleness requires the market to move against the dealer after submission while the old client price remains materially through the current market.

The final client decision is probabilistic rather than deterministic.

## 7. Persistent client flow

Each fictional counterparty has persistent parameters for size, urgency, toxicity and directional bias.

When a client trade executes, its future directional bias is updated toward the observed direction. Similar client types receive a much smaller update. This creates runs of real-money or fast-money flow without making the next trade predictable.

## 8. Internalisation

If a new client trade moves inventory toward zero, the overlapping quantity is recorded as internalised.

Example:

- Dealer is long 10k shares.
- New client buys 6k shares from the dealer.
- 6k is recorded as internalised.
- Only the residual 4k remains exposed.

No artificial internalisation button is required; it occurs naturally through client trading.

## 9. Worked execution

A residual hedge can be executed:

- Immediately
- In fixed-time clips
- Only when liquidity is sufficient
- Passively at a chosen price

Live worked schedules expose total size, executed size, remaining size, average execution price, clip size, interval and impact cost. The user can pause, resume, accelerate, slow or cross the residual.

## 10. Cross-asset factor model

Multi-market sessions share latent factors:

- Inflation
- Growth
- Policy
- Risk sentiment
- Energy

Each factor follows a mean-reverting stochastic process. Instrument `j` receives a factor impulse approximately proportional to:

`factor_move_j = Σ(beta_j,k × factor_k)`

The `beta` coefficients differ by asset and equity archetype. Idiosyncratic market noise remains active, so observed correlation is imperfect.

## 11. Macro releases

Scheduled releases have a consensus and actual outcome. DealerSim calculates a standardised surprise:

`surprise_z = (actual - consensus) / assumed_release_volatility`

The surprise changes the relevant latent factor and triggers an additional instrument-specific event shock. Positioning noise perturbs the response coefficient, especially for instruments with weak direct exposure to that factor, so secondary-market reactions are not perfectly deterministic.

## 12. P&L accounting

The review separates:

- Client commission
- Client price edge versus contemporaneous mid
- Exchange slippage
- Estimated market impact
- Residual inventory/timing contribution

The first five displayed attribution components reconcile to reported net P&L. The short-horizon adverse-selection markout is shown separately as a diagnostic because it overlaps with later inventory P&L.

## 13. Scoring

The score uses:

- Risk-adjusted P&L — 25%
- Commission and client flow — 25%
- Inventory management — 20%
- Quote quality — 10%
- Adverse-selection control — 10%
- Execution discipline — 10%

Multi-market sessions additionally penalise excessive missed RFQs, portfolio concentration and aggregate risk.

## 14. Important limitations

DealerSim does not model:

- Real venue fragmentation
- Hidden / iceberg liquidity
- Exact exchange queue position
- Short borrow constraints
- Bank capital or balance-sheet charges
- Real client tiering or relationship pricing
- Smart-order routers
- Real execution algorithms
- Actual security-specific factor betas

The simulator should therefore be interpreted as a training environment for market-making trade-offs, not an empirical market-impact model.
