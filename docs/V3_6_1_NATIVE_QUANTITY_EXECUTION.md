# DealerSim v3.6.1 — Native-Quantity Buy-Side Execution

## Objective

Make buy-side execution use the same market language as the sell-side desk without turning the buy-side screen into an order-book simulator. Portfolio construction can still begin with target weights, but execution is expressed in native quantity against a visible bid/offer.

## Live workflow

1. Select an asset and observe the synthetic top-of-book **bid / mid / offer**.
2. Enter native quantity: shares, futures contracts or FX lots.
3. DealerSim calculates approximate notional and resulting portfolio weight automatically.
4. Choose buy/sell and an execution route.
5. For dealer RFQ, the same native quantity is sent to dealers; each dealer returns a firm two-way spread and finite capacity.
6. Partial dealer fills and residual quantity remain visible in native units.

Target-weight mode remains available for PM-style sizing. A chosen target is converted into the quantity required to move from the current position to that target.

## Cost model

Direct market, worked/TWAP and auction fills now pay an explicit synthetic brokerage/exchange commission in addition to spread, depth and impact costs. Commission schedules are deliberately simple training parameters, not claims about any specific broker or venue.

Dealer RFQs have **zero separate explicit commission** in the engine. Their economics are represented by the dealer's quoted bid/offer, avoiding double-counting the dealer spread and a second commission charge.

Trade history records:

- `marketCost` — spread / impact component versus contemporaneous mid;
- `commission` — explicit route commission;
- `transactionCost` — total of the two.

NAV, P&L attribution, execution-quality metrics and post-session reports use the total cost.

## Regression controls

Deterministic verification now asserts that direct Global Macro, continuous Macro and Equity Fund executions charge commission, while dealer-RFQ fills do not receive a separate commission. The existing 384-session exploit calibration remains the route-dominance control.
