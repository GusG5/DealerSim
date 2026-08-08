# DealerSim v3.1 — Simulation Quality

DealerSim v3.1 is a quality-focused release. It does not add a new career mode or asset class. The objective is to make the existing Dealer, Global Macro, Long/Short Equity and Long-Only PM workflows more useful for deliberate practice and easier to audit.

## 1. Automated strategy / exploit testing

A new deterministic calibration lab runs simple scripted strategies across liquid APEX, illiquid ORBX and the equity-fund engine. The purpose is not to prove that the simulator is an empirical model of a real desk. It is to identify obvious gameable incentives before they reach the user.

The standard v3.1 calibration pass uses 32 seeds per policy, or 384 scripted sessions in total. Policies include:

- Dealer: tight quoting while warehousing inventory
- Dealer: immediate market hedging
- Dealer: defensive wider quoting plus immediate hedging
- Dealer: passive / natural-offset oriented behaviour
- Fund: remain entirely in cash
- Fund: concentrated long exposure
- Fund: diversified long-only exposure
- Fund: beta-heavy long/short exposure

Warnings are raised when a deliberately simplistic policy receives an implausibly strong average process score. During development this test exposed an all-cash scoring exploit; the fund score now applies an inactivity penalty when the mandate is barely used.

Run the lab with:

`npm run calibrate`

## 2. Coherent event chains

Equity-fund scenarios now contain linked catalyst sequences rather than isolated headlines. A typical company chain is:

1. Analyst / estimate revision
2. Primary earnings catalyst
3. Guidance follow-through

Macro chains link inflation information with a later policy response. Short-squeeze scenarios can add a positioning / borrow unwind stage.

Long dealer sessions also contain a second stage tied to the scheduled macro catalyst. The initial move can extend through follow-on flow or partially reverse as positioning clears. This prevents the training rule from becoming “headline arrives, price moves once, event is over.”

## 3. Research information for HF / AM

Long/Short and Long-Only modes now expose a compact synthetic research snapshot for the selected asset:

- Forward P/E
- Earnings revisions
- Consensus growth
- Short interest
- Momentum
- Beta-adjusted sector-relative performance
- Quality score
- Crowding
- Borrow cost
- Next catalyst / chain stage

The information is deliberately incomplete and noisy. It is intended to give the user competing evidence to interpret rather than a deterministic buy/sell signal.

## 4. Decision audit and replay

Dealer and equity-fund reviews now include a time-slider replay.

Dealer replay reconstructs:

- Market price
- Inventory
- Client quotes
- Client executions
- Hedge decisions

Fund replay reconstructs:

- NAV and benchmark
- Drawdown
- Portfolio weights implied by prior decisions
- Upcoming catalyst
- Trade, RFQ, dealer-fill, locate, worked-order, hedge, catalyst and risk audit entries

The audit trail is intentionally rules-based and stored from the simulation itself rather than generated retrospectively from vague commentary.

## 5. Performance analytics

Progress dashboards now support more granular diagnosis.

Dealer dashboard:

- Desk mode
- Difficulty
- Instrument
- Scenario / regime
- Skill components
- Acceptance / stale quote behaviour
- Instrument and scenario breakdowns

Buy-side dashboard:

- Buy-side mode
- Difficulty
- Scenario / regime
- Alpha / return quality
- Risk control
- Position sizing
- Execution
- Thesis discipline
- Efficiency
- Instrument P&L where available
- Dealer network performance

The intent is to make “recent 10 sessions versus previous sessions” and regime-specific weaknesses visible rather than reducing progress to one headline score.

## 6. Validation boundary

DealerSim remains a synthetic educational model. The calibration lab tests internal incentives and consistency; it does not claim that its coefficients estimate a particular bank, hedge fund, exchange or live market. Market-impact, acceptance, client-behaviour and factor parameters are deliberately transparent training assumptions.

A strategy passing the exploit lab means only that the tested simple policies do not obviously dominate the simulated objective. It is not evidence of real-world profitability.
