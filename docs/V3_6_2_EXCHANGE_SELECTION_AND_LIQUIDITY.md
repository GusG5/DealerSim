# DealerSim v3.6.2 — Exchange Selection & Size-Adjusted Liquidity

## Why this change exists

A multi-market dealer should be able to receive and price an RFQ in one product while independently monitoring or hedging another product. In v3.6.1, the selected client ticket and selected exchange market shared one UI state, so a newly arriving RFQ could silently move the exchange order book and hedge controls to a different instrument.

v3.6.2 separates those decisions.

## Client ticket versus exchange market

- The **RFQ queue / active ticket** controls which client request is being priced.
- The new **EXCHANGE / HEDGE MARKET** selector controls which order book, inventory-execution panel and chart are active.
- A new RFQ can draw attention to its client ticket, but it cannot change the exchange market without an explicit user click.

This permits realistic workflows such as pricing an APEX client RFQ while continuing to monitor or hedge ES.

## What should widen when size increases?

DealerSim deliberately distinguishes between:

1. **Displayed top-of-book bid/offer** — what the market is currently quoting before the user's trade.
2. **Size-adjusted executable bid/offer** — the VWAP available for the user's requested quantity after walking visible/reserve depth.
3. **Post-trade market state** — the temporary spread widening, depth withdrawal, imbalance and persistent impact caused after aggressive liquidity is actually consumed.

Entering a larger order does **not** mechanically widen L1 before execution. Instead, the live execution panel now makes the size-adjusted SELL and BUY VWAPs prominent and shows how many levels would be swept.

After a large aggressive trade is executed, spread pressure is stronger than in v3.6.1 and decays as liquidity replenishes. This preserves the correct cause-and-effect relationship while making the training feedback easier to see.
