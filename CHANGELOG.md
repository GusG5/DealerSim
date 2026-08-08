## 3.5.4 - Public calibration timeout

- Increased the Vitest timeout for the 384-session calibration suite to 60 seconds.
- Prevents a successful 30+ second calibration pass from being reported as failed by Vitest's 5-second default timeout.
- No simulation economics, scoring, or calibration thresholds changed.


## 3.5.3 - Public verification compatibility

- Moved deterministic engine verification and the 384-session calibration lab onto the existing Vitest/Vite TypeScript pipeline.
- Removed the separate `tsconfig.engine.json` CommonJS compilation harness, which was incompatible with TypeScript 7 after removal of legacy `moduleResolution=node10`.
- Keeps verification cross-platform on Windows/macOS/Linux without spawning TypeScript command shims directly.

# DealerSim Changelog

## v3.5.3 — Public build compatibility

- Fixed React 19 / TypeScript 7 `useRef` initialisation errors exposed by a clean local build.
- Added Vite client type declarations so CSS side-effect imports compile correctly.
- Removed an unused macro import caught by strict `noUnusedLocals`.
- Made `verify:engine` and `calibrate` invoke the TypeScript CLI cross-platform, avoiding Windows `spawnSync EINVAL` on newer Node versions.
- Retains the v3.5.1 storage-schema hardening and public README work.

# Changelog

## 3.5.1 — Public-release hardening

- Added explicit browser-storage schema versioning before React mounts.
- Incompatible legacy session/history and relationship data now reset safely instead of being passed into current UI components.
- Added validation and recovery for corrupted or partially incompatible persisted records.
- Added a one-time in-app notice when DealerSim resets incompatible browser data.
- Reworked the README into a recruiter-facing public project overview with transparent AI-assisted development attribution, screenshots, methodology links, limitations and local-run instructions.
- Added public screenshot assets under `docs/images/`.
- Expanded `.gitignore` for environment files and local IDE artefacts.

## 3.5.0 — Desk, franchise & progress centre

- Added a unified cross-mode Progress Centre with rolling 5/10-session averages, all-time/best scores, raw and difficulty-adjusted trends, skill deltas, scenario diagnostics, milestones and recommended training drills.
- Added local persistent sell-side client franchise memory for relationship score, RFQs, fills, volume, commission and stale-trade history.
- Added modest relationship effects to future synthetic client selection and quote acceptance.
- Added occasional flagged control-check RFQs for unusual size and unstable-market verification; unresolved pricing counts as a control-discipline failure.
- Added explicit opening/closing auction execution for equity HF/AM single-name trades and separate auction execution attribution.
- Added deterministic 5-minute showcase sessions on sell-side and buy-side setups.
- Added one-click random drill generation to the Dealer and Buy-Side scenario builders.
- Added Markdown desk-report export to Dealer, multi-market Dealer, live/strategic Global Macro and Equity Fund session reviews.
- Added unified progress CSV and Markdown training-report exports.
- Extended deterministic verification for client-franchise memory, auction route gating and control-event discipline.
- Re-ran the 384-session exploit calibration lab with zero warnings.

## 3.4.0 — Desk realism & assessment

- Added dealer time-of-day market phases that directly alter volatility, displayed liquidity and spread conditions.
- Added time-of-day execution/volatility conditions to continuous Global Macro and Equity Fund modes.
- Added synthetic portfolio stress tests, PM/risk oversight, duration DV01/beta/USD proxies and equity sector gross/net diagnostics.
- Added richer earnings releases with prior/consensus/actual metrics and sequenced management/CFO commentary.
- Added imperfect sales/dealer market colour with reliability hidden outside Learning.
- Expanded live P&L explain across Dealer, Macro and Equity Fund terminals.
- Strengthened Assessment: unknown scenario enforced, live pause hidden and selected convenience tools removed.
- Added Advanced/Assessment event-reasoning prompts and historical-inspired scenario context.
- Extended deterministic desk-realism checks; 384-session exploit calibration remains warning-free.

## 3.2.0 — Morning briefing & opening books

- Added a frozen pre-market stage before continuous Global Macro, Long/Short HF and Long-Only PM sessions.
- Added deterministic company morning research packs and overnight cross-asset macro briefings.
- Added Long-Only opening presets for benchmark, equal-weight and custom portfolios.
- Added Long/Short HF opening presets for model book, flat book and custom long/short books with pre-market locate validation.
- Added Global Macro opening presets for example, flat and custom portfolios.
- Treats all selected opening holdings as inherited positions with zero opening execution cost and zero turnover.
- Added optional pre-market views/key risks and opening-versus-closing book comparison in session reviews.
- Carries prior momentum into the live equity research signal instead of resetting it at the opening tick.
- Extended deterministic regression tests for briefing reproducibility, inherited-book accounting and pre-market short locates.

## 3.1.0 — Simulation quality, replay & research

- Added a deterministic scripted-strategy calibration lab using 32 seeds per policy / 384 standard regression sessions.
- Fixed an all-cash equity-fund scoring exploit by penalising extreme inactivity.
- Added coherent company catalyst chains and macro follow-through/reversal stages.
- Added live synthetic HF/AM research snapshots for valuation, estimates, short interest, momentum, relative performance, quality, crowding and borrow.
- Added decision-audit storage for fund trades, locates, dealer RFQs/fills, worked orders, hedges, catalysts and risk events.
- Added dealer and fund time-slider replay panels to post-session reviews.
- Expanded dealer progress analytics with scenario/regime filtering and breakdowns.
- Expanded buy-side progress analytics with scenario/regime filtering, skill profiles and instrument P&L.
- Persisted richer fund history including scenario, correlation regime and asset-level attribution.
- Added simulation-quality and calibration documentation.

## 3.0.0 — Training depth & portfolio release

- Added persistent equity-fund dealer relationships and product specialties.
- Added equity HF/AM arrival-price, implementation-shortfall, timing-cost and market-impact execution analytics.
- Added buy-side progress dashboard across macro, long/short and long-only modes.
- Added same-seed fund replay comparison.
- Rebuilt HF/AM tutorials as action-gated interactive exercises.
- Added dynamic correlation/crowding context to the equity fund engine.
- Expanded thesis-outcome coaching and counterparty review.
- Recalibrated fund execution scoring around implementation shortfall.
- Added calibration controls for dealer-route non-dominance, dealer-memory persistence and risk-score sensitivity.
- Declared a major feature freeze: subsequent changes should prioritise calibration, defects and UX rather than more modes.

## v2.2.1 — Manual sizing & dealer fill controls

- Added a live buy-side sizing switch between **Trade amount** and **Target weight**.
- Trade amount mode accepts an exact dollar notional in millions with explicit BUY/SELL direction and quick $1m/$2.5m/$5m/$10m presets.
- Target-weight mode now includes a direct numeric percentage input alongside the slider, so the slider is no longer required for precise portfolio sizing.
- The trade ticket shows the resulting target weight, delta notional and direct execution estimate before submission, with explicit instrument-limit warnings.
- Enlarged direct/RFQ/work execution controls for faster use under time pressure.
- Rebuilt live dealer quote cards with larger **25% / 50% / 75% / Fill Full/Max** actions.
- Added exact custom dealer fill sizing in $m and firm-capacity display for each counterparty.
- Partial dealer fills leave the residual notional preloaded in Trade amount mode for a follow-up RFQ or alternate execution route.
- Updated the live Global Macro tutorial to cover typed sizing and custom dealer fills.

## v2.2.0 — Continuous Global Macro Trader

- Added a new continuous buy-side Global Macro Trader mode while preserving the existing 30-day Strategic Portfolio Manager mode.
- Live sessions run for 15, 25 or 40 minutes with all six macro markets moving continuously.
- Scheduled macro releases now count down and hit automatically; actual-versus-consensus surprises propagate across assets in real time.
- Added live target-weight portfolio trading, continuously marked NAV, gross/net exposure, factor risk and hard drawdown controls.
- Added three execution routes for buy-side risk: direct market, firm dealer RFQs and worked execution.
- Live dealer quotes expire after seconds while prices continue moving; blocks can be split across dealers.
- Added TWAP and liquidity-sensitive worked orders with pause, resume, cancel and cross-the-remainder controls.
- Made thesis journalling optional in live mode so tactical hedges do not interrupt trading flow.
- Added a dedicated live-macro tutorial, real-time terminal, execution monitor and post-session review.
- Added a buy-side mode selector separating Global Macro Trader from Strategic Portfolio Manager.
- Added deterministic engine checks for live market progression, real-time dealer-quote expiry, worked execution, event releases and P&L attribution.

## v2.1.0 — Buy-Side Dealer RFQ Execution

- Added firm buy-side dealer RFQs to Global Macro mode.
- Request quotes from 3 or 5 fictional dealers before executing a target-weight change.
- Dealer quotes include two-way prices, firm block size, product-specific competitiveness and inventory axes.
- Added direct-market benchmark comparison and estimated dealer savings/premium.
- Dealer axes can improve or worsen pricing depending on whether the user's flow helps the dealer's inventory.
- Quotes expire when the simulated trading day advances.
- Added dealer RFQ execution history, dealer-vs-direct review metrics and tutorial coverage.
- Direct-market trades and dealer trades now record execution venue, benchmark price and execution slippage.

## 2.0.0 — Global Macro Buy-Side Engine

- Added a completely separate buy-side Global Macro surface alongside the dealer simulator.
- Added a $100m, 30-day synthetic portfolio mandate with long/short target-weight construction.
- Added ES, US 10Y Treasury, Euro-Bund, Brent, gold and EUR/USD macro exposures.
- Added gross/net exposure, cash, concentration, factor-risk and drawdown controls, including a 150% gross limit and 10% hard drawdown stop.
- Added six common portfolio factors: growth, inflation, policy, risk sentiment, energy and USD.
- Added seeded soft-landing, inflation-resurgence, recession, policy-error, commodity-shock, risk-off and hidden-regime paths.
- Added an expectation-based macro calendar with consensus, actual outcomes and standardised surprises.
- Added a thesis journal requiring rationale, horizon, conviction and invalidation conditions for meaningful position changes.
- Added transaction costs, turnover accounting and mandate-aware trade rejection.
- Added asset-level and factor-level P&L attribution with reconciliation to portfolio P&L.
- Added Global Macro process scoring across return, risk, sizing, thesis discipline, efficiency and adaptability.
- Added a decision-paced full-screen Global Macro terminal, 30-day review, local history, interactive tutorial and dedicated methodology panel.
- Added deterministic engine verification and Vitest coverage for the buy-side portfolio engine.

## 1.2.0 — Dealer Completion, QA & Progress

- Added a dedicated local progress dashboard with mode, difficulty and instrument/desk filters.
- Added score-trend visualisation, recent-versus-prior performance comparison, acceptance/stale-rate tracking and per-market breakdowns.
- Added storage of weighted score components, internalisation, market impact, drawdown and session-mode metadata for new completed sessions while preserving compatibility with older local history.
- Added CSV export of filtered progress history.
- Added exact single-market P&L reconciliation: realised + unrealised + commission − hedge execution costs = reported net P&L.
- Added cross-asset portfolio attribution reconciliation with explicit residual control check.
- Fixed a hard-limit risk-control edge case where forced liquidation updated the position inside the risk pass but displayed equity could remain stale until the next market tick.
- Rebuilt quote-width scoring so each two-way quote is assessed against its own submission-time full-block executable market, client type, volatility and liquidity rather than the market spread at session end.
- Expanded deterministic QA for forced liquidation, accounting identity and competitive-versus-defensive client pricing.
- Declared the major dealer feature set functionally complete pending user calibration; subsequent major development can move to the buy-side portfolio engine.

## 1.1.0 — Market Microstructure & Liquidity

- Added LUMA, a synthetic less-liquid mid-cap equity with 5–15k-share typical RFQs, wider normal spreads, shallow depth and slow replenishment.
- Added ORBX, an event-driven small/mid-cap stress market with unstable liquidity, high cancellation sensitivity and very large block impact.
- Expanded the selectable equity universe from four to six instruments and added LUMA + ORBX and MEGA + LUMA + ORBX desk presets.
- Made aggressive participation alter the subsequent market through temporary mid-price displacement, liquidity depletion, liquidity-provider cancellations and endogenous spread pressure.
- Added dynamic bid/offer book imbalance that weakly affects short-horizon price pressure and asymmetrically changes displayed depth.
- Added reserve / iceberg liquidity behind displayed depth, allowing realised fills to differ from the visible book while keeping the hidden amount uncertain.
- Added repetitive-flow / information-leakage mechanics for worked orders; predictable same-direction clips increase later footprint, while liquidity-sensitive schedules carry a smaller penalty.
- Added deep / normal / thin / stressed liquidity states, recovery-time estimates and Learning-mode execution-footprint diagnostics.
- Added book-participation and hidden-liquidity diagnostics to Learning-mode block estimates.
- Added estimated exchange impact avoided through client matching to the single-market review and CSV export.
- Expanded deterministic engine verification for thin-market calibration, spread pressure, cancellations, imbalance and liquidity recovery.

## 1.0.2 - Size-aware executable market

- Market-execution prices now react immediately to the selected order size.
- The Buy Market and Sell Market buttons display the size-weighted book VWAP rather than only top-of-book.
- Added a live size-adjusted executable spread alongside the unchanged top-of-book spread.
- Learning mode also shows an impact-adjusted all-in spread estimate.
- Clarified that changing intended size does not move the market before execution; executing a large order can then deplete depth, move the mid and widen the subsequent displayed spread.

## v1.0.1 — RFQ realism and execution audit

- Rebuilt directional RFQs so offer-only and bid-only requests use a true single-side ticket rather than a muted two-way ticket.
- Directional and limit-interest RFQs now transmit only the side requested by the client; malformed one-way submissions are ignored rather than scored as valid quotes.
- Added side-specific Learning guidance showing the client's full-block exchange alternative, suggested dealer bid/offer, expected price improvement and inventory effect.
- Added one-way commercial controls: Load Market, More Competitive and More Edge, with direction-aware keyboard behaviour.
- Removed two-way spread penalties from directional RFQ acceptance logic.
- Changed stale-quote detection so an intentionally competitive block quote is not labelled stale unless the market actually moves against the dealer after submission.
- Corrected one-way quote-quality scoring so sessions are not penalised for having no two-way spread sample.
- Fixed duplicated units in event messages such as `11k shares SHARES` / `60 contracts CONTRACTS`.
- Improved RFQ event wording and the multi-market queue to distinguish two-way, offer-only, bid-only and limit-interest requests.
- Corrected market-impact participation so blocks larger than displayed depth create progressively more temporary impact rather than flattening at 100% of visible depth.
- Expanded deterministic verification for one-way RFQs, limit-price enforcement, stale-quote classification and oversized-block impact.

## v1.0.0 — Cross-Asset Desk

- Added three-market simultaneous desk mode.
- Added shared latent inflation, growth, policy, risk and energy factors.
- Added continuous imperfect cross-asset co-movement.
- Added expectation-versus-actual macro calendar with standardised surprises.
- Added persistent client-flow feedback and recent-flow signals.
- Added pause/resume/accelerate/slow/cross controls for worked hedge schedules.
- Added executed-size, average-price and impact-cost tracking for working hedges.
- Added cross-asset P&L attribution: commission, client price edge, exchange slippage, market impact and inventory/timing residual.
- Added macro-release review and estimated impact avoided through internalisation.
- Generalised the multi-session engine from exactly two to two-or-three instruments.
- Added equity-desk and macro-desk three-market presets.
- Updated single-market scheduled macro releases to show actual versus consensus outcomes.
- Updated methodology and portfolio documentation for v1.0.
- Hid numeric latent-factor state outside Learning mode so harder modes require inference from news, prices and flow.
- Added a concise cross-asset Learning primer and corrected two-versus-three market setup spacing.
- Updated the Windows verification script to run deterministic engine checks before tests and the production build.

## v0.9.0 — Three-Market Desk

- Generalised multi-market UI and portfolio controls for a third live instrument.
- Added MEGA + NOVA + ES, FGBL + ES + BRN, and APEX + MEGA + NOVA presets.
- Updated RFQ queue, header cards and portfolio panels for variable desk size.

## v0.8.0 — Market Behaviour Upgrade

- Added shared cross-asset factor engine.
- Added expectation-based macro calendar.
- Added persistent client flow.
- Added interactive working-order management.
- Added richer P&L attribution and coaching diagnostics.

## 0.7.0 — Dual-market desk

- Added simultaneous two-instrument trading with both markets running continuously.
- Added overlapping RFQs with independent deadlines; focusing one ticket does not pause the other market.
- Added preset dual-market desks for MEGA + ES, FGBL + ES, BRN + ES and APEX + MEGA, plus custom two-market selection.
- Added a consolidated RFQ queue and active-market switching.
- Added shared macro news scheduling so CPI, growth, policy, energy and risk headlines can move both active books with asset-specific response directions and sensitivities.
- Retained equity company-specific headlines while suppressing duplicate generic macro events inside each leg.
- Added portfolio-normalised gross risk, concentration, combined commission and USD-equivalent P&L reporting.
- Added a consolidated dual-market trade blotter and portfolio review score.
- Added attention penalties for excessive RFQ expiries and concentration penalties for overloaded portfolio risk.
- Added recent-client-flow content to the idle RFQ panel instead of leaving a large blank area.
- Compacted Learning explanations behind expandable details.
- Compacted order-book size columns so units live in the table header rather than repeating on every row.
- Expanded deterministic engine verification to cover overlapping RFQs, shared news, portfolio risk and dual-market scoring.

## 0.6.0 — Cross-asset single-market expansion

- Added individually selectable Euro-Bund (FGBL), Brent crude (BRN) and E-mini S&P 500 (ES) futures alongside the four equity block markets.
- Added contract-specific notional multipliers and tick-value accounting: Bund uses €10 per 0.01 tick per contract, Brent represents 1,000 barrels per contract, and ES uses the $50 index-point multiplier.
- Calibrated distinct futures depth, spread, volatility, replenishment, market-impact and inventory-limit profiles rather than reusing the equity parameters.
- Added dedicated typical RFQ ranges and futures client books for rates, commodities and index markets.
- Added instrument-specific scheduled and surprise news pools: ECB/inflation for Bund, inventories/OPEC+/geopolitics for Brent, and CPI/FOMC/risk-flow events for ES.
- Rebuilt the session selector with a dedicated Macro Futures section and updated the market watch for rates, commodities and index futures.
- Generalised quote units so all central-limit-order-book products are shown in ticks while EUR/USD retains pips.
- Fixed the abbreviated equity size text throughout the live terminal: `k sh` is now rendered as `k shares`, including RFQ size, depth and execution panels.
- Corrected futures notional display so contract blocks show economically meaningful notional values rather than price × contract count only.
- Expanded deterministic engine verification for futures RFQ ranges, news coverage, relative depth/impact and contract multipliers.

## 0.5.0 — Multi-equity market profiles

- Added four individually selectable synthetic single-stock markets: APEX, MEGA, NOVA and HELI.
- Gave each equity a distinct liquidity, volatility, spread, market-impact and replenishment profile rather than simply changing the ticker.
- Calibrated most client RFQs to instrument-specific block ranges centred on the 5–20k-share style used in the equity simulations, while retaining occasional larger outliers.
- Added company-specific scheduled and surprise news pools for each equity alongside the macro news already present in every scenario.
- Added instrument-specific volatility scaling and participant/depth calibration so MEGA feels deeper, NOVA feels thinner and more reactive, HELI feels steadier until company news, and APEX remains the balanced reference market.
- Rebuilt the session selector around the four equity archetypes with visible liquidity, volatility, impact and typical-RFQ labels.
- Activated the four-equity market watch while retaining EUR/USD as a secondary legacy mode.
- Expanded deterministic engine verification to test all equity profiles, RFQ ranges and relative market-impact calibration.

## 0.4.3 — Compact depth and execution-first layout

- Reworked the live lower terminal into three functional columns: client RFQ, exchange depth + inventory execution, and chart + blotter.
- Reduced the exchange book to five visible levels by default with an explicit +3-level expansion control.
- Kept all eight simulated depth levels in the engine; the change is presentation-only.
- Added current-block depth highlighting so the bid and ask levels a client order would consume are visible at a glance.
- Added a compact full-block spread benchmark directly above the book when an RFQ is active.
- Reallocated horizontal space from the order book to inventory execution and hedging controls.
- Fixed the RFQ block-size/notional collision and the Learning-mode execution-estimate paragraph wrapping into a narrow grid cell.

## 0.4.2

- Fixed the interactive tutorial so the entire tutorial terminal is constrained to one browser viewport.
- Corrected the four-panel left tutorial stack, which previously declared only three grid rows and created an oversized implicit row.
- Added compact height-specific tutorial styling for laptop displays while keeping all core tutorial information visible.
- Prevented tutorial panels from expanding the page; any future overflow is contained within the terminal layout.

## 0.4.1 — One-screen terminal layout

- Locked the live trading terminal to the browser viewport to remove whole-page scrolling
- Split exchange depth and inventory execution into separate columns on normal desktop widths
- Added a three-column stacked fallback for narrower laptop widths
- Removed fixed lower-grid minimum heights that forced the terminal beyond the viewport
- Added compact-height styling for headers, RFQ inputs and execution controls
- Kept overflow local to dense panels such as the order book or hedge controls rather than the page itself

## 0.4.0 — Equity block pricing and market impact

- Made APEX, a fictional liquid US large-cap, the primary selectable market while retaining EUR/USD as a secondary mode
- Added an eight-level equity order book with roughly forty participants and regime-dependent displayed depth
- Added full-block VWAP, depth-consumption, temporary-impact and implementation-shortfall estimates
- Changed equity client acceptance to compare dealer quotes with the full-size exchange alternative rather than top-of-book alone
- Added temporary market displacement, depth depletion and dynamic liquidity replenishment after aggressive hedges
- Added full, partial, evenly worked, liquidity-sensitive and passive execution choices
- Added advanced hedge controls for total size, clip size and interval
- Added explicit client-flow internalisation and analytics for internalisation rate, exchange hedge volume, worked volume and impact cost
- Rebuilt the tutorial around a 15k-share block, 8k internalisation and a worked 7k residual
- Restricted detailed execution-cost estimates to Learning mode
- Updated scoring and feedback to reflect internalisation, worked hedging and market impact

## 0.3.0 — Interactive tutorial and instrument architecture

- Replaced the static tutorial primer with an eight-step guided terminal tutorial
- Added action-gated lessons for loading the market, selecting a client spread, inventory skew, partial hedging, stale-reference refresh and post-news widening
- Added explicit suggested spread and centre-skew ranges with explanations in the tutorial
- Added assisted pricing guidance to Learning mode and the three-minute coached practice launched from the tutorial
- Added a central instrument registry covering EUR/USD, Euro-Bund futures, Brent futures and E-mini S&P futures
- Refactored P&L, slippage, size formatting, limits, price precision, commission and event sensitivity to use instrument configuration rather than FX constants
- Added alternative-instrument engine verification, including Bund tick-value accounting
- Kept EUR/USD as the only selectable instrument while preparing the engine and UI for the v0.4 multi-asset selection release

## 0.2.0 — Quote workflow and news calibration

- Recalibrated RFQ windows to 20–25 seconds in Learning, 14–18 in Standard, 9–13 in Advanced and 6–10 in Assessment
- Added a Load Market button and `M` hotkey for current top-of-book prices
- Added keyboard controls for individual sides, whole-quote shifts, widening and tightening
- Added live quote-versus-market deltas, loaded-reference age and market-move tracking
- Preserved stale-price risk by keeping loaded quotes fixed as the market moves
- Added a scheduled macro-calendar event to every scenario family
- Retained the News Shock family as the highest-impact, most persistent event regime
- Expanded engine verification for timing calibration and scenario news coverage

## 0.1.0 — Initial functional build

- Added deterministic EUR/USD market engine with regimes and shocks
- Added persistent client book and RFQ acceptance model
- Added inventory, commission, P&L and execution accounting
- Added three-level order book, market hedging and passive orders
- Added soft and hard risk limits with forced liquidation
- Added 15-minute React trading terminal
- Added tutorial, methodology and local progress history
- Added weighted score, coaching feedback, replay and exports
- Added engine verification and Vitest test suite

## 2.5.0 — Equity Hedge Fund & Long-Only Asset Management

- Added continuous Long / Short Equity Hedge Fund mode.
- Added continuous benchmark-relative Long-Only Equity PM mode.
- Added six synthetic single-name equities plus ES portfolio hedge.
- Added market/growth/value/quality/rates/momentum factor framework and company catalyst calendar.
- Added explicit single-name short locates, hard-to-borrow capacity and annualised borrow costs.
- Added gross/net exposure, beta, sector exposure and factor-risk monitoring.
- Added one-click ES beta hedge for long/short books.
- Reused direct-market, dealer-RFQ and worked-order execution across equity fund modes.
- Added arbitrary notional and target-weight sizing, partial dealer fills and residual re-RFQ workflow.
- Added equity fund tutorials, session history and dedicated post-session attribution/scoring.
- Expanded Buy-Side landing page into Global Macro Trader, Long/Short Equity, Long-Only Equity PM and Strategic Portfolio Manager.
