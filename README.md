# Cross Strategy Research Dashboard

Public dashboard repository for the three-family cross-strategy research program.

## Repository

- https://github.com/galbbb2772/cross-strategy-dashboard

## Current V2 scope

- **304 base structures**
- **7,696 weight scenarios**
- Full historical window for the 304 base structures: **2019-10-30 to 2026-03-31**
- **1,612 daily NAV observations per base structure**
- Latest base Phase classification: **84 PASS_1X_CASH / 220 REQUIRES_FINANCING**
- Latest weight Phase classification: **1,923 PASS / 5,719 financing / 54 pending**

## Views

1. **304 Historical Curves** — search any base structure and open its complete daily NAV history plus CAGR, cumulative return, MaxDD, Sharpe and stability score.
2. **Risk / Execution** — 5% / 10% drawdown events, lag/recovery/occupancy, Phase coverage, 15/25bps costs, capital utilization, conflict days and financing evidence.
3. **Top10 Rankings** — historical return, structural stability, weight robustness, financing return, CAGR, Sharpe, lowest drawdown, 15bps and 25bps cost-stressed rankings.
4. **Forward OOS** — prospective paper Forward feed kept separate from historical combination research.
5. **304 Registry** — searchable full base-structure table.

Execution metrics are shown only where transaction-level evidence exists. Missing capital-utilization/conflict values remain explicitly marked as pending evidence rather than filled with proxies.

The public dashboard exports research outputs only; it does not publish private strategy-generation logic.
