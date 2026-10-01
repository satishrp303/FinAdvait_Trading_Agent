# NiftyDesk — Indian equity paper-trading prototype

A working React / TypeScript app with a server-enforced paper-trading engine and durable SQLite (Cloudflare D1) storage. It ships with ₹1,00,000 virtual capital, 12 illustrative NSE stocks, and a deterministic simulated session dated 28 September 2026. Prices are synthetic, not historical observations or investment recommendations. No live-money orders or credentials are supported.

## Run locally

Install **Node.js 24 LTS** (includes npm). On Windows, double-click `START-WINDOWS.cmd`, or use these commands from this folder:

```sh
npm ci
npm run build
npm run db:local
npm start
```

Open the local address printed by the server, usually `http://127.0.0.1:8787`. Database initialization is repeatable and uses Wrangler’s migration journal. Local records live in `.wrangler/state`; keep that directory to retain your journal. Local mode uses one paper account and binds only to loopback. Stop the server with Ctrl+C.

For source editing, `npm run dev` runs the development server. If that server has a bundler memory issue on Windows, use the build/start sequence above. The production preview does not require that development optimizer.

## Try the full flow

1. Open **Stock scanner**, select RELIANCE, and choose **Review paper trade**.
2. Inspect quantity, estimated fill, stop, target, committed risk, and fees. Choose **Approve paper trade** to create a virtual position.
3. Select **Next 15 min** to advance the deterministic market by one completed candle. The scanner and P&L update, and protective exits run.
4. Check **Positions** to close manually, or continue until a stop/target is touched. The session closes all remaining positions at 15:30 IST.
5. Open **Trade journal** for net results, exit reasons, activity, and CSV export. Reloading preserves the account.
6. In **Settings**, adjust risk within ₹500–₹750, choose 2 or 3 positions, and select a 1.5R or 2R gross target. Reset starts the same demo again and clears its journal after confirmation.

## Rules and controls

- Completed 15-minute bars; BUY requires close > session VWAP, EMA9 > EMA21, close > the previous 20 candle highs, and relative volume ≥1.5 versus the previous 20 volumes.
- WAIT means the trend rules pass but breakout/volume confirmation is missing. NO TRADE means the trend rules fail. Invalid or insufficient market data fails closed.
- Stop is the lower of the last four candle lows and 0.6% below the current close. Target is 1.5R or 2R from the raw signal close. Execution costs reduce the achieved reward:risk.
- Default per-trade budget is ₹600. Quantity floors to whole shares and includes adverse entry/stop slippage and estimated fees. It is also capped by available cash and remaining daily risk.
- Daily reserve = max(0, −realized net P&L) + all open planned stop losses. The ₹1,500 budget cannot be expanded by profitable realized trades.
- Long-only, cash-funded, no leverage, no averaging, and no duplicate open symbol. At most 3 simultaneous positions (or 2 if selected).
- Net P&L at or below −₹1,500 triggers a latched session lock and liquidates remaining paper positions. Normal stop gaps can exceed a planned loss or the daily threshold.
- AUTO MODE OFF means all entries require approval. Stop, target, loss protection, and end-of-session exits still run when the simulation advances. The app does not run a background live market loop.
- Reviews reserve no funds. Approval rechecks the server state and exact revision, then commits through a database compare-and-swap. Concurrent or stale approvals cannot produce duplicate fills.
- Simulation uses 0.05% adverse slippage and an illustrative 0.04% fee on each side. These are not Zerodha’s statutory or contractual charge schedule. Portfolio equity is marked value less estimated exit fees; P&L includes entry fees.
- Both stop and target touched in one candle: stop wins. A gap below the stop uses the worse opening price. Positions are not evaluated against the already completed entry candle.

## Architecture

| File | Role |
|---|---|
| `app/desk.tsx` | Six dashboard views, approval dialog, settings, CSV export |
| `app/globals.css` | Responsive interface and theme |
| `lib/engine.ts` | Pure strategy, accounting, risk, paper execution, demo market adapter |
| `app/api/desk/route.ts` | Server-side validation, identity, persistence, atomic revision checks |
| `db/schema.ts`, `drizzle/` | Database schema and versioned migrations |
| `tests/engine.test.mjs` | Risk, accounting, signal, and execution tests |

Hosted Sites use platform-authenticated user IDs as database owners and are initially owner-private. Do not expose the Worker directly behind a proxy that accepts user-supplied authentication headers. Self-hosted remote use needs a trusted authentication boundary; local loopback is the only unauthenticated fallback.

The optional `read_paper_desk` browser tool only reads the saved virtual account and scanner. It cannot approve trades.

## Adding Zerodha next

`MarketDataProvider` is the candle-data seam; `PaperBroker` and `KiteExecutionDisabled` define the execution boundary. Keep live execution disabled while adding authentic data. Do not replace the paper engine with a direct browser call to Kite.

Implement the Kite login callback and token exchange on the server, with secrets and access tokens stored outside the browser. Reconcile order updates, partial fills, rejection, cancellation, and broker positions before considering live trading. This prototype does not implement those production requirements, market-calendar management, or exchange tick-size validation.

Primary integration references:

- [Kite authentication and token exchange](https://kite.trade/docs/connect/v3/user/)
- [Kite backend application requirements](https://kite.trade/docs/connect/v3/apps/)
- [Historical candles](https://kite.trade/docs/connect/v3/historical/)
- [WebSocket market data](https://kite.trade/docs/connect/v3/websocket/)
- [Orders and their lifecycle](https://kite.trade/docs/connect/v3/orders/)

## Verify

```sh
npm test
npx tsc --noEmit
npm run build
```

This is an educational working prototype, not a profitability claim, live trading service, or strategy backtest. The 12-symbol example universe is not an up-to-date NIFTY 50 constituent feed.
