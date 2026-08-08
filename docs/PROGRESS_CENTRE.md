# DealerSim Progress Centre

DealerSim v3.5 treats repeated simulation as a training programme rather than a collection of isolated sessions. The Progress Centre combines locally stored sell-side and buy-side session history into one analytics surface.

## Headline measures

For the selected mode, difficulty and scenario filters, the centre reports:

- current 5-session raw-score average;
- current 10-session raw-score average;
- previous 10-session average and change;
- all-time average;
- best raw score;
- a difficulty-adjusted 10-session training index.

Raw scores remain the primary performance measure. The difficulty-adjusted index is only a comparison aid so that progress toward Advanced/Assessment is not obscured by the removal of coaching. The current offsets are deliberately modest: Learning -8, Standard 0, Advanced +4 and Assessment +8.

## Skill trends

The centre maps each desk's native score components into comparable training skills while retaining desk-specific economics.

- Dealer: quote/commercial quality, risk/adverse selection, inventory/sizing, execution and P&L.
- Global Macro: return/selection, risk, sizing, execution efficiency and thesis/adaptability.
- Equity HF/AM: alpha/selection, risk, sizing, execution, thesis discipline and efficiency.

The latest ten sessions are compared with the prior ten where sufficient history exists.

## Regime diagnostics

Scores can be filtered and grouped by scenario so weak environments become visible. This is intended to answer questions such as whether the user performs well in normal flow but poorly in toxic-flow or short-squeeze regimes.

The recommendation engine combines the weakest recent skill with the weakest recent scenario to suggest a next drill. It is intentionally heuristic rather than an opaque ML model.

## Milestones

Milestones are practice markers, not game achievements. Examples include completing a first block of sessions, maintaining a 70+ Assessment average, producing positive HF alpha across a sample and completing repeated sessions without severe risk failures.

## Relationship analytics

The same surface displays:

- sell-side client franchise memory: relationship score, RFQs, fills, volume and commission;
- buy-side dealer/counterparty memory: relationship score, RFQ/fill history and execution savings.

These memories are stored in local browser storage only.

## Export

The Progress Centre can export:

- CSV session history for external analysis;
- a Markdown training report summarising averages, skill trends, recommended drills and milestones.

Each major session-review screen can also export a Markdown desk report for that individual simulation.

## Limitations

Scores are synthetic training measures, not predictions of real trading performance or recruiting outcomes. Difficulty adjustment is a display convention, not a statistical normalisation. Scenario and relationship mechanics are intentionally bounded so that persistent memory does not create an easy scoring exploit.
