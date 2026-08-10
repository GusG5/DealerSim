# DealerSim v3.6 — Decision-Time UI & Execution Redesign

## Design objective

v3.6 applies one information-architecture rule across the buy side:

> **Rich research before the session → sparse decision-focused terminal during the session → detailed analytics and scoring after the session.**

The change is intentionally both a UX simplification and an economic tightening. The live screen should make the user decide what is happening, what they own, what changed, what risk they have and how to execute. Research packs, full factor decomposition, stress grids, scorecards and detailed attribution remain available at the stages where they are actually useful.

## Buy-side live architecture

### Continuous Global Macro

Pre-market retains the overnight briefing, event calendar, factor context, scenarios and opening-book construction. The live terminal now prioritises prices/charting, positions with weight and notional, a compact risk strip, the next catalysts, a larger news tape, dealer colour and the execution ticket. Full factor decomposition, stress analytics, P&L explain, reflection prompts and scoring are deferred to review.

### Long/Short Equity HF

Pre-market retains company research, catalysts, valuation/revisions, short interest, crowding, borrow and opening-book construction. The shared Fund live terminal now prioritises positions, actual notionals and weights, charting, gross/net/beta/concentration, live news, dealer colour, locates and execution. Research snapshots, sector/factor diagnostics, stress cards and decision review are deferred to post-session analytics.

### Long-Only Asset Management

The same Fund terminal is used with mandate-specific constraints. Benchmark-relative research and opening active weights remain pre-market; live trading is centred on holdings, active decision-making, compact benchmark/book risk, news and execution. Relative attribution, factor/style analysis, turnover and scoring remain review tasks.

### Strategic Portfolio Manager

This mode is deliberately lower-frequency, so the rebalance ticket still requires a thesis and invalidation condition. The live allocation screen is otherwise simplified to catalysts, book risk, allocation state, positions, execution and news. Thesis history, factor decomposition and attribution are reviewed after the session rather than competing for attention during a rebalance.

## Execution-economics changes

v3.6 does not simply multiply every spread by a constant. It changes the shape and state-dependence of execution cost.

- Normal displayed spreads are modestly more punitive in training conditions.
- Usable displayed depth is lower at the top of book.
- Block impact grows convexly with participation, illiquidity and volatility.
- Repeated same-direction aggressive child orders build a decaying execution-memory state and therefore worsen subsequent costs.
- Persistent synthetic impact can move the post-trade mid; attribution explicitly reconciles that self-induced mark effect.
- Worked orders reduce immediate footprint but retain timing/market risk while waiting.
- Dealer RFQs can improve block economics but remain finite, uncertain and occasionally worse than the direct alternative.

The intended lesson is **execution cost versus market risk**, not “always split” or “always wait”.

## Sell-side interdealer block route

Dealer mode now exposes a separate interdealer block hedge route. It is designed for residual inventory that may be inefficient to dump directly into the displayed market.

The route provides:

- deeper block capacity than the visible top of book, but not unlimited capacity;
- quote quality that varies with liquidity and seeded dealer conditions;
- occasional stale or wrong-way pricing;
- lower visible-market footprint than an equivalent immediate exchange hedge;
- rising information leakage and capacity withdrawal when the user repeatedly shops the same risk.

This means the trainee can choose among internalising, waiting, working, crossing the exchange or seeking interdealer liquidity. No route is intended to be mechanically correct in all states.

## Anti-exploit execution memory

A series of rapid minimum-size child orders is treated as persistent flow. Same-direction pressure decays with time rather than resetting after every click, so ten immediate clips can be at least as expensive as one appropriately calibrated larger order. Waiting can allow pressure to decay, but doing so exposes the user to market movement and event risk.

This deliberately rewards judgement about clip size, timing, urgency and venue rather than button-level gaming.

## Calibration standard

The 384-session deterministic lab remains 32 seeds × 12 policies, but the policies now explicitly attack execution-route incentives.

### Dealer policies

For each of two synthetic dealer instruments:

1. always immediate hedge;
2. repeated minimum-clip market hedge;
3. worked/liquidity-sensitive hedge;
4. warehouse inventory and use interdealer block liquidity.

### Fund policies

All four policies follow the same target-weight path so implementation quality is comparable:

1. always direct market;
2. repeated minimum-clip direct split;
3. always dealer RFQ;
4. always TWAP/worked execution.

The harness checks process-score thresholds, suspiciously cheap splitting and matched-seed route dominance. A policy winning more than 72% of matched seeds is flagged.

## Final v3.6 calibration result

**384 scripted sessions, 0 warnings.**

Matched-seed route win shares:

| Family | Policy | Win share |
| --- | --- | ---: |
| APEX dealer | Immediate hedge | 0.0% |
| APEX dealer | Minimum-clip market | 15.6% |
| APEX dealer | Worked hedge | 56.3% |
| APEX dealer | Warehouse/interdealer | 28.1% |
| ORBX dealer | Immediate hedge | 6.3% |
| ORBX dealer | Minimum-clip market | 25.0% |
| ORBX dealer | Worked hedge | 50.0% |
| ORBX dealer | Warehouse/interdealer | 18.8% |
| Equity fund | Direct market | 6.3% |
| Equity fund | Minimum-clip split | 15.6% |
| Equity fund | Dealer RFQ | 28.1% |
| Equity fund | TWAP/worked | 50.0% |

These shares are not claims about real-world venue performance. They are a regression control showing that the training environment does not have an obvious universal execution button across the tested regimes.

## Verification note

The uploaded v3.5.4 archive contained Windows-native Node/Vite dependencies. In the Linux verification environment, the normal Vitest/Vite executable therefore cannot load its native Rolldown binary, and dependency reinstallation is unavailable offline. The TypeScript project compiles cleanly with the available compiler. The existing test files were also compiled and run against a minimal local Vitest-compatible assertion shim: **37/37 existing assertions passed**, including deterministic engine verification and the 384-session calibration suite.

Server-rendered structural QA confirmed that the modified live Fund, continuous Macro and Strategic PM terminals contain the intended news/position/risk hierarchy and no longer render live stress, journal or score sections. The same realistic snapshots were rasterised with system Chromium through Playwright at 1600×1000 and visually inspected, together with the sell-side HedgePanel containing the interdealer route. No clipping, overlap or broken information hierarchy was found in those representative states. Because the supplied archive's Windows-native Vite/Rolldown dependency cannot launch the full interactive dev build in the Linux QA container, a final interactive browser smoke test on a normal local install remains sensible. Updated v3.6 Macro, Equity Fund and Strategic PM screenshots are stored under `docs/images/`.
