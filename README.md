# Stock Analysis Dashboard

<a href="https://buymeacoffee.com/jiansu" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40"></a>

Search any stock, see valuation charts, key metrics, and get AI-powered analysis from Claude.

## Features

- **Search with Autocomplete** — real-time symbol suggestions with keyboard navigation as you type
- **Recent Stocks** — quick-access history of your last 5 searches, persisted across sessions
- **Watchlist** — star any stock to save it; appears in the sidebar for one-click access, persisted across sessions
- **Sidebar Navigation** — collapsible sidebar with section links (Chart, Metrics, Dividends, News, AI Analysis) that highlight as you scroll; slides out as a drawer on mobile
- **Dark / Light Theme** — one-click toggle, remembers your preference
- **Stock Header** — current price, daily change, market cap, sector/industry, and US or Canadian stock indicator
- **Multi-Asset Support** — specialized metrics, charts, and AI prompts for each asset type:
  - **Stocks** — P/E-based fair value analysis with sector-aware baselines
  - **ETFs** — expense ratio, top holdings, sector weightings, and 7 sub-category classifiers (Broad Market, Dividend Growth, Growth, Income, Sector, International, Thematic)
  - **REITs** — FFO-based metrics, dividend sustainability, P/B as NAV proxy
  - **Banks** — triple-model valuation (P/E + P/B + Dividend Discount Model), ROE analysis
- **FastGraphs-Style Valuation Chart** — fair value lines (sector P/E and historical average P/E), annual EPS bars, dual Y-axes
- **Technical Analysis Mode** — switch to 50-day and 200-day Simple Moving Average overlay
- **Date Range Selector** — 1M, 3M, 6M, YTD, 1Y, 2Y, 5Y, 10Y, ALL
- **Toggleable Chart Series** — click any legend item to show or hide individual lines
- **Key Metrics Grid** — 10-11 metric cards that adapt per asset type, with color-coded warnings for high debt, payout ratios, etc.
- **AI-Powered Analysis (Claude)** — streaming analysis with structured output:
  - Verdict badge (Undervalued, Overvalued, Fair Value, and more)
  - Action badge (Strong Buy through Strong Sell)
  - Confidence indicator (High / Medium / Low)
  - Computed fair value banner with discount or premium percentage
  - Risk flags and catalysts
  - Price forecast sliders for 3-month, 6-month, and 12-month horizons (bear / base / bull scenarios)
  - Expandable calculation breakdown table
- **Investment Calculator (Backtest)** — drag on the chart to select a period, enter an investment amount, and see total return, annualized return, dividend income, and share count; toggle Reinvest Dividends (DRIP) to compare compounded vs cash dividend outcomes
- **Walk-Me-Through Tour** — interactive guided tour that walks you through the Investment Calculator step by step; auto-starts on first load, restartable from the sidebar
- **Drag-to-Zoom** — click and drag on the chart to zoom into any date range; double-click or press Reset Zoom to restore the full view
- **Analyst Price Targets** — purple overlay band showing Wall Street consensus target range (low/mean/high) with analyst count
- **Projected Fair Value** — forward-looking dashed lines for both sector P/E and historical average P/E, plus projected EPS bars based on forward guidance
- **Period Price Change** — stock header dynamically shows price change for the selected date range (1M, 3M, YTD, 5Y, etc.) instead of only daily change
- **Dividend History** — letter grade (A+ through F), consecutive increase streak, dividend CAGR, and 10-year annual history table
- **News Feed** — three most recent headlines with publisher and relative timestamp
- **LAN Access** — `start.sh` detects your local IP and prints a URL so you can open the app on your phone or tablet (same Wi-Fi)

## Before You Start

You need two things installed:

1. **Node.js** — [Download here](https://nodejs.org/) (pick the LTS version, click Next through the installer)
2. **Anthropic API key** — Sign up at [console.anthropic.com](https://console.anthropic.com/), go to API Keys, create one

**Windows users:** Use Git Bash for all commands below (it comes with [Git for Windows](https://git-scm.com/downloads)). Do NOT use Command Prompt or PowerShell.

## First Time Setup

Clone the repo, then run `setup.sh`. This single script does everything for you — it installs all the dependencies (backend and frontend), and asks for your Anthropic API key so the AI analysis feature works. You only need to do this once.

```
$ git clone <your-repo-url>
$ cd stocks

$ bash setup.sh

=== Stock Analysis Dashboard Setup ===

Node.js v22.x.x found

Installing backend dependencies...
added 150 packages in 5s

Installing frontend dependencies...
added 230 packages in 8s

No .env file found. Let's set one up.

Enter your Anthropic API key: sk-ant-xxxxx-your-key-here

.env file created.

=== Setup complete! ===

To start the app:  ./start.sh
To stop the app:   ./stop.sh
```

Now start it:

```
$ ./start.sh

Stock Analysis Dashboard started!
  Backend:  http://192.168.1.x:3001  (PID: 12345)
  Frontend: http://192.168.1.x:5173  (PID: 12346)

Open the Frontend URL on your phone (same Wi-Fi) to test.
Run ./stop.sh to stop both servers.
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Done!

## Updating

When there's a new version, three commands:

```
$ git pull
Already up to date.   (or shows updated files)

$ bash setup.sh

=== Stock Analysis Dashboard Setup ===

Node.js v22.x.x found

Installing backend dependencies...
up to date in 1s

Installing frontend dependencies...
up to date in 1s

Existing .env found — skipping API key setup.

=== Setup complete! ===

$ ./start.sh
```

Your API key is kept. Only dependencies get updated.

## Stopping

```
$ ./stop.sh

Stopped process 12345
Stopped process 12346
App stopped.
```

## Restarting

```
$ ./restart.sh
```

Equivalent to `./stop.sh` then `./start.sh`.

## Troubleshooting

**Nothing loads / errors in browser**
- Make sure both servers are running: `./stop.sh` then `./start.sh`

**AI analysis not working**
- Check your `.env` file has `ANTHROPIC_API_KEY=sk-ant-...` (your actual key)

**start.sh won't run**
- Windows: use Git Bash, not Command Prompt or PowerShell
- Mac/Linux: run `chmod +x start.sh stop.sh setup.sh restart.sh` first
