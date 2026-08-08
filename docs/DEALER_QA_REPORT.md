# DealerSim Dealer QA Report — v1.2.0

## Scope

v1.2 is the completion checkpoint for the sell-side dealer simulator. The purpose of this audit is to find accounting, risk-control and calibration defects before building the separate buy-side portfolio engine.

## Automated control checks

The deterministic engine verifier now covers:

- Core long/short position accounting and futures contract multipliers
- All configured instruments and order-book depth generation
- Equity block VWAP and oversized-block impact
- Relative liquidity/impact calibration across MEGA, APEX, NOVA, LUMA and ORBX
- Macro-futures depth, contract notional and size-aware executable spreads
- Dynamic spread pressure, cancellations, book imbalance, hidden liquidity and recovery
- Deterministic scenario reproduction from seed
- RFQ timing by difficulty
- Scheduled news coverage across every scenario family
- Dual-market overlapping RFQs and shared news
- Three-market factor propagation and portfolio attribution
- Worked-order pause/resume/modify/cross controls
- Directional and limit RFQ correctness
- Hard-limit detection and forced liquidation
- Same-tick P&L synchronisation after forced liquidation
- Single-market P&L accounting identity
- Client acceptance materially favouring a competitive block quote over a defensive quote without becoming guaranteed

## P&L control identities

### Single market

Reported net P&L must equal:

`realised P&L + unrealised P&L + gross client commission - hedge execution costs`

The five-second client markout is a diagnostic of adverse selection. It is not added to or subtracted from net P&L a second time.

### Cross-asset desk

Portfolio attribution must reconcile:

`commission + client price edge + exchange slippage + market impact + inventory/timing = portfolio net P&L`

Cross-currency desk results use the synthetic FX conversion assumptions documented in the methodology.

## Calibration changes in v1.2

Two-way quote-width scoring now references each RFQ's own submission-time market. For central-order-book products, DealerSim reconstructs the full-block buy/sell alternative for that requested size and then adjusts the target dealer width for client type, volatility and liquidity.

This replaces the older shortcut that compared average quoted width with the market spread visible at the end of the session.

## Known abstraction limits

DealerSim remains a training model rather than a bank or exchange replica. In particular:

- Synthetic liquidity providers are stylised rather than venue-specific agents.
- Hidden liquidity, cancellation behaviour and market impact are calibrated heuristics.
- Cross-asset FX conversion for portfolio reporting is fixed within a session.
- Client acceptance is probabilistic and designed for training incentives rather than empirical estimation from proprietary RFQ data.

The remaining validation task is behavioural: complete repeated 15-minute sessions and flag any strategy that appears to dominate regardless of instrument, liquidity regime or client mix.
