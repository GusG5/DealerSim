# DealerSim Pre-Market Workflow

## Why a pre-market stage exists

A continuous buy-side exercise is more realistic when the user starts with context and an existing or deliberately selected book. Beginning every session at 100% cash overweights opening execution and understates the real problem of managing inherited risk as new information arrives.

## Information timing

DealerSim separates information into three buckets.

### Known before the open

Examples include valuation, consensus growth, prior momentum, short interest, quality, crowding, benchmark weights, indicative borrow conditions, factor sensitivities and scheduled catalysts.

### Overnight / pre-market

The morning pack can include synthetic sector moves, analyst or company colour, cross-asset moves and a pre-market price indication. These influence the decision set but are not presented as a recommended trade.

### Unknown future information

Actual earnings outcomes, guidance surprises, regulatory decisions, macro releases and unscheduled headlines remain hidden until the live session reaches them.

## Equity opening books

### Long-Only PM

The default is the synthetic benchmark portfolio. Equal weight and fully custom opening portfolios are also available. A custom portfolio must satisfy long-only, cash, concentration and total-weight constraints before the market can open.

### Long/Short HF

The user can inherit a model book, start flat or create a custom long/short book. Pre-market shorts require available synthetic borrow capacity. The system creates the corresponding opening locate so the live engine does not incorrectly treat an inherited short as an unlocated trade.

## Macro opening books

The live macro mode supports an example portfolio, a flat book or a custom cross-asset book. Gross exposure, net exposure, cash, concentration and factor-risk utilisation are visible before the clock starts.

## Accounting convention

The opening portfolio is an inherited state, not an execution event. No spread, commission, market impact or turnover is charged for creating it. This prevents the portfolio-construction screen from becoming an artificial batch trade. Only changes made after the open are evaluated as executions.

## Review convention

Where an initial view is recorded, the review displays the user's opening view/key risk beside opening and closing weights. This creates an auditable link between pre-market thinking and live decisions without forcing a long written thesis for every position.
