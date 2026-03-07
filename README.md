# Stock Analysis Dashboard

Search any stock, see valuation charts, key metrics, and get AI-powered analysis from Claude.

## First Time Setup

You need two things before starting:

1. **Node.js** — [Download here](https://nodejs.org/) (pick the LTS version, click Next through the installer)
2. **Anthropic API key** — Sign up at [console.anthropic.com](https://console.anthropic.com/), go to API Keys, create one

**Windows users:** Use Git Bash for all commands below (it comes with [Git for Windows](https://git-scm.com/downloads)). Do NOT use Command Prompt or PowerShell.

Then run:

```bash
git clone <your-repo-url>
cd stocks
bash setup.sh
```

The setup script will:
- Install all dependencies for you
- Ask for your API key and save it

When it's done, start the app:

```bash
./start.sh
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Updating

When there's a new version:

```bash
git pull
bash setup.sh
./start.sh
```

That's it. The setup script handles everything.

## Stopping

```bash
./stop.sh
```

## Troubleshooting

**Nothing loads / errors in browser**
- Make sure both servers are running: `./stop.sh` then `./start.sh`

**AI analysis not working**
- Check your `.env` file has `ANTHROPIC_API_KEY=sk-ant-...` (your actual key)

**start.sh won't run**
- Windows: use Git Bash, not Command Prompt or PowerShell
- Mac/Linux: run `chmod +x start.sh stop.sh setup.sh` first
