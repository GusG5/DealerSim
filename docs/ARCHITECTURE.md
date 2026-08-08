# DealerSim Architecture

## Application layer

`App.tsx` coordinates setup, tutorial, single-market sessions, cross-asset sessions and review screens.

## Single-market engine

`DealerSimEngine` owns one instrument and is responsible for:

- Market evolution
- Order-book generation
- RFQ lifecycle
- Client acceptance
- Inventory accounting
- Passive and worked orders
- Execution impact
- Risk limits
- Scoring

## Cross-asset engine

`MultiDealerSimEngine` owns two or three `DealerSimEngine` instances and adds:

- Shared macro calendar
- Latent cross-asset factors
- Instrument-specific event responses
- Portfolio-normalised risk
- Consolidated events
- Cross-market client-flow signals
- Portfolio score
- Portfolio P&L attribution

The individual engines remain independent enough to preserve instrument-specific microstructure while the desk engine injects common macro information.

## UI architecture

The trading terminal is organised around decision priority:

1. Client RFQ
2. Exchange depth
3. Inventory execution
4. Price/chart context
5. Trade and RFQ history
6. News, macro calendar, factor pulse and portfolio risk

Multi-market mode uses one enlarged active ticket rather than duplicating the whole terminal for every instrument. Unselected instruments remain live in the background.

## State and persistence

Live simulation state is in memory. Completed-session summaries and settings are stored locally in the browser. There is no server-side state or authentication.

## v2.0 buy-side architecture

The Global Macro mode is intentionally separated from the dealer simulation engine.

- `src/engine/macro-types.ts` — buy-side portfolio, event, factor, thesis and attribution types.
- `src/engine/macro.ts` — seeded macro factor engine, portfolio accounting, mandate controls, calendar, attribution and scoring.
- `src/hooks/useMacroSim.ts` — React controller around the deterministic portfolio engine.
- `src/components/MacroSessionSetup.tsx` — mandate/scenario setup and local macro history.
- `src/components/MacroTradingTerminal.tsx` — full-screen portfolio construction and risk interface.
- `src/components/MacroReviewScreen.tsx` — return, drawdown, factor attribution and thesis review.
- `src/components/MacroTutorial.tsx` — interactive buy-side onboarding.
- `src/components/MacroMethodologyModal.tsx` — in-app model documentation.

Dealer and buy-side histories use separate localStorage keys. The engines share the seeded random-number utility but not dealer RFQ/order-book state.


## v2.1 dealer RFQ execution layer

The buy-side engine now separates portfolio intent from execution venue. `MacroPortfolioEngine.requestDealerQuotes()` creates deterministic firm quotes from a fictional dealer panel using product expertise, requested size and inventory axes. `acceptDealerQuote()` executes the selected side into the same portfolio accounting path as direct execution, preserving a single source of truth for NAV, risk, turnover, thesis records and transaction-cost attribution. Live quotes expire when the simulated day advances.

## v2.2 live buy-side architecture

The buy-side surface now has two separate engines:

- `MacroPortfolioEngine` — decision-paced Strategic Portfolio Manager, advanced by simulated days.
- `LiveMacroEngine` — continuous Global Macro Trader, advanced by real-time ticks from `useLiveMacroSim`.

Both reuse the same macro asset registry and scenario/factor definitions. The live engine owns second-based event scheduling, continuously marked portfolio risk, second-expiry dealer RFQs and worked-order state. This separation prevents the strategic engine from accumulating real-time timing logic and keeps both workflows independently testable.

## v2.5 shared buy-side equity architecture

The buy-side surface now includes a separate `EquityFundEngine` alongside the strategic and live macro engines. It owns continuous single-name prices, catalyst releases, portfolio accounting, factor/sector/beta risk, synthetic securities-borrow locates, dealer RFQs, worked orders, borrow costs and fund-specific scoring. `useFundSim` exposes the engine to the React surface, while `FundTradingTerminal`, `FundReviewScreen` and `FundTutorial` provide the long/short and long-only workflows. The same engine is configured by `mandate: 'long-short' | 'long-only'` so both modes share accounting and execution while applying different constraints and scoring objectives.
