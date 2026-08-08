# DealerSim v3.0 Calibration & Control Report

## Purpose

This document records the control philosophy used to keep DealerSim useful as an educational simulation. It is not a claim that the synthetic parameters reproduce any specific bank, exchange, hedge fund, asset manager or proprietary training platform.

The target is **economic coherence**: a user should face plausible trade-offs between price, size, liquidity, risk, execution speed and information rather than discover a single mechanical strategy that always wins.

## Automated controls

`VERIFY_DEALERSIM.bat` runs the deterministic engine verification before the normal test/build sequence. The v3.0 engine checks include:

- instrument-specific depth, volatility, RFQ-size and market-impact ordering;
- block VWAP and implementation-shortfall growth as size consumes more depth;
- endogenous spread/cancellation/replenishment behaviour in less-liquid dealer markets;
- overlapping RFQs and portfolio risk in multi-market dealer mode;
- expectation-based cross-asset macro releases and factor propagation;
- one-way versus two-way RFQ pricing logic and client-limit enforcement;
- forced-liquidation and P&L-accounting reconciliation;
- long/short borrow-locate enforcement and long-only short rejection;
- dealer RFQ reproducibility, partial fills and quote expiry;
- equity-fund execution benchmarking and implementation-shortfall recording;
- persistent dealer relationship memory when prior history is supplied;
- a control that dealer RFQs can occasionally price worse than the direct benchmark, preventing RFQ from becoming a dominant route;
- lower risk scores for materially more concentrated / higher-gross portfolios.

## Execution calibration

For equity HF/AM, each completed trade now records:

- **Arrival price:** synthetic mid when the execution decision began.
- **Execution price:** actual synthetic fill.
- **Implementation shortfall:** signed cost from arrival to fill.
- **Timing cost:** price movement between arrival and the contemporaneous market at execution.
- **Market impact / spread cost:** execution price versus contemporaneous mid.
- **Direct benchmark:** synthetic immediate-execution alternative for dealer-comparison purposes.

The decomposition is deliberately simplified. It is intended to teach the distinction between investment decision quality and implementation quality, not to reproduce an institutional transaction-cost-analysis stack.

## Dealer-route calibration

Dealer quotes depend on:

- product liquidity and estimated direct execution cost;
- dealer-specific baseline competitiveness;
- whether the dealer has a favourable or wrong-way axe;
- product speciality;
- firm capacity;
- a small persistent relationship adjustment;
- seeded randomness.

A dealer RFQ therefore **can** improve the block price, but it is not guaranteed to do so. Users still need to compare quotes against the direct alternative and decide whether to split, work, wait or cross.

## Persistent relationships

Fund-mode dealer history is stored locally in the browser. Successful fills and useful pricing can gradually improve a relationship score; repeated RFQs without fills do not automatically create an advantage. The relationship effect is intentionally modest so historical routing does not overpower current market conditions or dealer axes.

## Scenario diversity

Equity fund scenarios combine:

- common market/growth/value/quality/rates/momentum factors;
- company-specific volatility;
- scheduled and surprise catalysts;
- latent crowding;
- correlation regimes (normal, dispersion, factor-squeeze);
- hard-to-borrow / squeeze mechanics.

This means identical headline types can create different realised paths depending on the state of the market and the seed.

## Known simplifications

DealerSim does not model a consolidated real exchange, full venue fragmentation, queue priority, actual securities-lending plumbing, prime-broker margin, options greeks, real VaR, real portfolio covariance estimation, financing haircuts, corporate actions, real dealer balance sheets or live market data.

These omissions are intentional. Where a feature is represented, the UI and documentation should describe it as synthetic or estimated rather than institutional ground truth.
