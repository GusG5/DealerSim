# DealerSim v3.4 — Desk Realism & Assessment

## Purpose

v3.4 deepens the existing Dealer, Global Macro and Equity Fund workflows rather than adding another career mode. The objective is to make liquidity, information arrival, portfolio risk and evaluation change through the session in ways that force different decisions at different times.

All markets, companies, counterparties, prices and scenarios remain synthetic. Historical references are structural analogues only; DealerSim does not replay historical prices or reproduce proprietary desk systems.

## 1. Time-of-day market conditions

### Dealer desk

The dealer engine now overlays a time-of-day liquidity/volatility cycle on top of the existing scenario, news and endogenous market-impact states:

- Opening flow: higher volatility, less stable liquidity.
- Morning liquidity: deeper books and lower execution friction.
- Midday: thinner displayed liquidity and lower background volatility.
- Event window: liquidity withdrawal and elevated volatility around scheduled releases.
- Closing flow: deeper volume but faster price movement.

The time-of-day overlay feeds the actual synthetic order book rather than being a cosmetic label. Displayed depth, spread generation and random price volatility respond to it.

### Continuous buy-side

Global Macro and Equity Fund sessions use the same principle. Direct-market estimates, worked-order costs and dealer benchmarks are conditioned on the current market phase. The terminal displays the phase plus the current execution-cost and volatility multipliers.

## 2. Institutional-style risk and stress

Continuous Global Macro adds:

- gross/net/cash/concentration/factor risk;
- a duration DV01 proxy for TY/Bund exposure;
- ES beta proxy and USD factor exposure;
- four synthetic instantaneous stress tests: hawkish rates, growth/risk-off, energy shock and broad USD rally;
- PM/risk-manager messages when risk utilisation, concentration or stress loss becomes material.

Equity HF/AM adds:

- gross/net/beta and factor risk;
- sector gross/net look-through;
- synthetic shocks for risk-off, rates, growth unwind and crowded-short squeeze;
- dynamic PM/risk oversight.

These are educational risk proxies, not regulatory or production VaR models.

## 3. Earnings and information sequence

The equity calendar can now represent a multi-stage information chain rather than a single headline:

1. analyst revision / setup;
2. earnings release with prior, consensus and actual values for revenue, EPS, gross margin and guidance;
3. management demand commentary;
4. CFO investment/margin commentary;
5. guidance follow-through.

Consensus is visible before the event; actual values remain hidden until release. A headline EPS beat can therefore coexist with a margin miss or guidance cut, allowing the initial stock reaction to reverse as the information set develops.

## 4. Sales and dealer market colour

Live Macro and Equity Fund terminals receive synthetic sales-trader/dealer colour such as real-money buying, macro-fund selling, dealer axes or fragile event liquidity. Colour is intentionally imperfect and may be stale or inventory-influenced.

Learning mode exposes an approximate reliability estimate. Standard, Advanced and Assessment do not.

## 5. P&L explain

Dealer mode now shows live components for commission, client price edge, exchange slippage, estimated market impact and residual inventory/timing P&L.

Equity Fund mode shows beta P&L, residual alpha, execution cost and borrow cost. Live Macro shows factor-level contribution plus idiosyncratic P&L and transaction costs.

## 6. Assessment protocol

Assessment is now a distinct protocol rather than simply the noisiest difficulty:

- scenario is forced to Unknown/Random;
- continuous-mode pause is hidden;
- Learning regime/reliability readouts remain unavailable;
- one-click beta hedge is removed from Equity HF Assessment so the user must size ES manually;
- event-reasoning prompts encourage the user to articulate what changed, which exposure matters and what would invalidate the response;
- final score/review remains the main evaluation surface.

Dealer Assessment still grades quote quality, client-flow capture, inventory, adverse selection and execution discipline. Buy-side Assessment grades portfolio return/alpha quality, risk, sizing, execution, thesis process and adaptability according to each mandate.

## 7. Historical-inspired structures

Scenario selection now explicitly explains the economic structure it resembles—for example inflation repricing, commodity-supply shock, crisis deleveraging, growth rotation or crowded-short squeeze. These are educational analogues only. The seed creates a fresh synthetic path and no historical price series is embedded.

## Validation

v3.4 extends deterministic engine verification to assert that:

- dealer sessions begin in opening conditions and progress through time-of-day states;
- opening dealer liquidity is lower and volatility higher than the normal baseline;
- Equity Fund and Live Macro initialise stress and PM/risk diagnostics;
- buy-side market-phase multipliers remain active during the session.

The existing scripted calibration lab continues to test 384 seeded dealer/fund policy runs for simple exploit strategies.
