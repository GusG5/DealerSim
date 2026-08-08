interface MethodologyModalProps {
  onClose: () => void
}

export function MethodologyModal({ onClose }: MethodologyModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card methodology-modal" role="dialog" aria-modal="true" aria-labelledby="methodology-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">MODEL DOCUMENTATION</p>
            <h2 id="methodology-title">DealerSim methodology</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close methodology">×</button>
        </div>
        <div className="methodology-content">
          <section>
            <h3>Purpose</h3>
            <p>
              DealerSim is a deterministic educational market-making simulator. It trains institutional block pricing, client-flow internalisation, inventory warehousing, staged exchange execution and cross-asset attention management. It uses synthetic markets, clients and releases and is not connected to any bank, exchange, live data service or proprietary trading simulator.
            </p>
          </section>
          <section>
            <h3>Price process and order books</h3>
            <p>
              Each instrument has a seeded stochastic price process with drift, mean reversion, changing volatility, liquidity regimes and event shocks. Exchange-traded products use synthetic multi-level central limit order books. Depth, spread, volatility, replenishment speed, cancellation sensitivity, hidden-liquidity assumptions, market impact, tick value and risk limits differ by instrument. LUMA and ORBX deliberately extend the equity spectrum into thinner mid-cap and event-driven liquidity.
            </p>
          </section>
          <section>
            <h3>Cross-asset factor engine</h3>
            <p>
              Two- and three-market desks share latent inflation, growth, policy, risk and energy factors. These factors evolve continuously and create imperfect co-movement across the active books. Instrument loadings are signed and deliberately different: for example, a positive inflation shock is normally negative for duration and growth equities, while a positive energy-supply-tightness shock is strongest in Brent. Idiosyncratic noise remains large enough that relationships are not deterministic.
            </p>
          </section>
          <section>
            <h3>Macro calendar and expectations</h3>
            <p>
              Cross-asset sessions publish a synthetic macro calendar before releases. Each event has a consensus, an actual outcome and a standardised surprise. The market reacts primarily to the surprise rather than the level alone. CPI, payrolls, policy decisions and crude inventories are examples. Single-market sessions also use expectation-versus-actual releases for scheduled macro events where applicable.
            </p>
          </section>
          <section>
            <h3>Full-block client benchmark</h3>
            <p>
              A client quote is compared with the estimated cost of executing the full requested block directly, not merely the top-of-book spread. The benchmark sweeps displayed levels, calculates VWAP and adds temporary impact. A dealer quote can therefore be wider than the displayed one-tick spread while still improving materially on the client&apos;s whole-order alternative.
            </p>
          </section>
          <section>
            <h3>Market impact and replenishment</h3>
            <p>
              Aggressive exchange hedges consume successive levels, incur slippage, displace the simulated mid-price, trigger liquidity-provider cancellations and create temporary spread pressure. The book can move through deep, normal, thin and stressed states. Price impact, cancellations and depth depletion decay as liquidity providers return, with recovery materially slower in LUMA and ORBX than in MEGA or ES.
            </p>
          </section>
          <section>
            <h3>Book imbalance, reserve liquidity and information leakage</h3>
            <p>
              Aggressive one-sided flow changes the simulated balance of bid and offer depth, which weakly influences subsequent short-horizon price movement. Some executable liquidity is modelled as reserve or iceberg depth that is not displayed, so visible depth is informative but incomplete. Repeated same-direction worked clips also create pattern leakage: predictable execution causes other liquidity providers to retreat, increasing later impact. Liquidity-sensitive schedules reduce, but do not eliminate, this effect.
            </p>
          </section>
          <section>
            <h3>Persistent client flow and adverse selection</h3>
            <p>
              Fictional counterparties differ in urgency, price sensitivity, size, persistence, commission and toxicity. Executed client flow feeds back into that client&apos;s directional tendency and, more weakly, into similar client types. This creates persistent flow without making direction certain. Informed clients are more likely to trade on favourable or stale prices and are evaluated with a short-horizon markout.
            </p>
          </section>
          <section>
            <h3>Internalisation and interactive worked orders</h3>
            <p>
              Opposite client trades naturally reduce existing inventory and are recorded as internalised volume. Residual exposure can be swept, partially hedged, posted passively or worked in timed or liquidity-sensitive clips. Active worked orders can be paused, resumed, accelerated, slowed or crossed immediately, making hedge management an ongoing decision rather than a one-click action.
            </p>
          </section>
          <section>
            <h3>P&amp;L attribution and score</h3>
            <p>
              Reviews separate client commission, client price edge, exchange slippage, estimated market impact and the residual inventory/timing contribution. Adverse-selection markout is displayed as a diagnostic. The core score weights risk-adjusted P&amp;L 25%, commission and client flow 25%, inventory management 20%, quote quality 10%, adverse-selection control 10% and execution discipline 10%. Multi-market scoring also penalises missed RFQs, concentration and excessive aggregate risk.
            </p>
          </section>
          <section>
            <h3>Limitations</h3>
            <p>
              DealerSim uses a simplified reserve-liquidity model and still abstracts fragmented venues, exact queue priority, borrowing constraints, capital charges, compliance controls, cross-venue smart routing and production execution algorithms. Factor loadings and impact functions are training abstractions rather than estimates of any named security. The objective is coherent economic trade-offs, not tick-for-tick market replication.
            </p>
          </section>
        </div>
        <div className="modal-actions methodology-actions">
          <span>Dealer engine v1.2 · included inside DealerSim v2.0 alongside the separate Global Macro buy-side mode</span>
          <button className="button button-primary" type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  )
}
