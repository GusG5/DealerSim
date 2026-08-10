# DealerSim v3.6 — Calibration Lab

## Purpose

The calibration lab is a deterministic regression suite for simulator incentives. It asks a practical question: can a fixed, unsophisticated strategy exploit the scoring or execution rules and become a universal answer?

The standard pass uses **32 seeds × 12 policies = 384 scripted sessions**.

## v3.6 policy set

The v3.6 suite targets execution-route exploits directly.

### Dealer — APEX and ORBX

For each instrument the harness runs:

- **Immediate hedge:** remove inventory through immediate market execution.
- **Minimum-clip market:** repeatedly use small aggressive clips.
- **Worked hedge:** use liquidity-sensitive worked execution once inventory reaches a defined threshold.
- **Warehouse/interdealer:** tolerate more inventory and seek finite-capacity interdealer block liquidity.

### Equity fund

All policies follow the same target-weight path and vary only execution behaviour:

- **Always market**
- **Minimum-clip split**
- **Always RFQ**
- **Always TWAP**

This makes the route comparison meaningful while still allowing market timing to matter.

## Anti-exploit checks

The lab flags:

- implausibly high process scores from mechanical policies;
- minimum-clip splitting that is suspiciously cheap;
- route dominance when one policy wins more than **72%** of matched-seed comparisons.

The route-dominance control is deliberately regime-sensitive. The objective is not equal win rates. A good route can win more often in the tested distribution; it simply should not become a universal button.

## Final v3.6 run

| Policy | Average score | Average result | Realised IS / cost | Status |
| --- | ---: | ---: | ---: | --- |
| APEX immediate hedge | 52.0 | -40,434.44 | 9.30 bp | OK |
| APEX minimum-clip market | 53.3 | -112,115.58 | 1.36 bp | OK |
| APEX worked hedge | 63.1 | -8,474.54 | 7.50 bp | OK |
| APEX warehouse/interdealer | 63.9 | -23,905.45 | 7.18 bp | OK |
| ORBX immediate hedge | 50.5 | -81,150.79 | 118.14 bp | OK |
| ORBX minimum-clip market | 50.3 | -153,654.50 | 22.51 bp | OK |
| ORBX worked hedge | 51.7 | -39,708.11 | 131.49 bp | OK |
| ORBX warehouse/interdealer | 51.7 | -92,580.04 | 127.82 bp | OK |
| Fund always market | 65.4 | -0.81% | 17.71 bp | OK |
| Fund minimum-clip split | 66.2 | +0.04% | 12.67 bp | OK |
| Fund always RFQ | 68.1 | +0.24% | 8.98 bp | OK |
| Fund always TWAP | 70.5 | +0.29% | -51.32 bp | OK |

Warnings: **0**.

For the fund policies, the cost column is realised implementation shortfall relative to arrival rather than a fixed fee. It can therefore be negative when market movement while a worked order is waiting is favourable. That is intentional: it preserves the execution-cost-versus-market-risk trade-off.

## Matched-seed win shares

| Family | Immediate / market | Min-clip | Worked / RFQ | Interdealer / TWAP |
| --- | ---: | ---: | ---: | ---: |
| APEX dealer | 0.0% | 15.6% | 56.3% | 28.1% |
| ORBX dealer | 6.3% | 25.0% | 50.0% | 18.8% |
| Equity fund | 6.3% | 15.6% | 28.1% | 50.0% |

No route approaches the 72% dominance warning threshold.

## Interpretation

The calibration is an exploit test, not evidence that DealerSim reproduces empirical market-impact curves or real dealer economics. Absolute P&L and implementation shortfall are synthetic. The useful result is that urgency, inventory, liquidity, venue and timing create different winners across matched scenarios rather than one mechanical execution rule dominating.

The lab should be extended whenever a new venue, execution mechanic or scoring component is introduced.
