#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Stock Analysis Dashboard Setup ==="
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed."
  echo "Install it from https://nodejs.org and try again."
  exit 1
fi
echo "Node.js $(node --version) found"

# 2. Install backend dependencies
echo ""
echo "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend" && npm install

# 3. Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend" && npm install

# 4. Set up .env if missing
echo ""
if [ -f "$SCRIPT_DIR/.env" ]; then
  echo "Existing .env found — skipping API key setup."
else
  echo "No .env file found. Let's set one up."
  echo ""
  read -p "Enter your Anthropic API key: " API_KEY
  if [ -z "$API_KEY" ]; then
    echo "Warning: No API key provided. AI analysis won't work until you add it to .env"
    API_KEY="your-api-key-here"
  fi
  cat > "$SCRIPT_DIR/.env" << EOF
ANTHROPIC_API_KEY=$API_KEY
PORT=3001
EOF
  echo ".env file created."
fi

# 5. Done
echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start the app:  ./start.sh"
echo "To stop the app:   ./stop.sh"
