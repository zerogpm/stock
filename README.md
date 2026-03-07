# Stock Analysis Dashboard

<a href="https://www.buymeacoffee.com/zerog" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40"></a>

Search any stock, see valuation charts, key metrics, and get AI-powered analysis from Claude.

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
  Backend:  http://localhost:3001
  Frontend: http://localhost:5173

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

## Troubleshooting

**Nothing loads / errors in browser**
- Make sure both servers are running: `./stop.sh` then `./start.sh`

**AI analysis not working**
- Check your `.env` file has `ANTHROPIC_API_KEY=sk-ant-...` (your actual key)

**start.sh won't run**
- Windows: use Git Bash, not Command Prompt or PowerShell
- Mac/Linux: run `chmod +x start.sh stop.sh setup.sh` first
