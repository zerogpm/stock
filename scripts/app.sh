#!/bin/bash
# Unified local development script for Stock Analysis Dashboard.
#
# Usage:
#   bash scripts/app.sh --start     Start all services
#   bash scripts/app.sh --stop      Stop all services
#   bash scripts/app.sh --restart   Restart all services
#
# Starts/stops: DynamoDB Local (Docker), backend API (Express),
# and frontend (Vite). Tables and seed data are created automatically on start.
#
# Prerequisites: Docker running, .env with ANTHROPIC_API_KEY.
#
# Windows note: DynamoDB runs in-memory mode (Docker volume permissions
# issue) — data is lost on container restart. Profiles are re-seeded on start.

set -e

# ── Shared setup ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OS_NAME="$(uname -s)"
IS_WINDOWS=false
COMPOSE_FILE="backend/local/docker-compose.yml"
STORAGE_MODE="persistent storage"

if [[ "$OS_NAME" == MINGW* || "$OS_NAME" == MSYS* || "$OS_NAME" == CYGWIN* || "$OS_NAME" == Windows_NT ]]; then
  IS_WINDOWS=true
  COMPOSE_FILE="backend/local/docker-compose.windows.yml"
  STORAGE_MODE="in-memory mode"
fi

cd "$PROJECT_ROOT"

# ── Stop ──────────────────────────────────────────────────────────────
do_stop() {
  echo "=== Stopping local development services ==="

  # Stop Docker containers
  echo "Stopping DynamoDB Local..."
  docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true

  # Kill processes by port
  PORTS=(3001 5173)

  if [ "$IS_WINDOWS" = true ]; then
    echo "Stopping backend and frontend (Windows)..."
    for port in "${PORTS[@]}"; do
      pid=$(netstat -ano 2>/dev/null \
        | grep ":$port " \
        | grep "LISTENING" \
        | awk '{print $5}' | head -1)
      if [[ -n "$pid" ]]; then
        taskkill //F //PID "$pid" 2>/dev/null || true
        echo "  Killed process on port $port (PID: $pid)"
      fi
    done
  else
    echo "Stopping backend and frontend (Unix)..."
    npx kill-port "${PORTS[@]}" 2>/dev/null || true
  fi

  # Clean up PID file
  rm -f .local-pids

  echo "All services stopped."
}

# ── Start ─────────────────────────────────────────────────────────────
do_start() {
  echo "=== Stock Analysis Dashboard - Local Development ==="

  # Check prerequisites
  if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
  fi

  if [ ! -f ".env" ]; then
    echo "Error: .env file not found in project root"
    echo "Create it with: ANTHROPIC_API_KEY=your-key"
    exit 1
  fi

  if ! grep -q "ANTHROPIC_API_KEY" .env; then
    echo "Error: ANTHROPIC_API_KEY not found in .env"
    exit 1
  fi

  # Kill any existing processes on our ports (clean slate)
  echo "Cleaning up old processes..."
  if [ "$IS_WINDOWS" = true ]; then
    for port in 3001 5173; do
      pid=$(netstat -ano 2>/dev/null | grep ":$port " | grep "LISTENING" | awk '{print $5}' | head -1)
      if [ -n "$pid" ]; then
        taskkill //F //PID "$pid" 2>/dev/null || true
      fi
    done
  else
    npx kill-port 3001 5173 2>/dev/null || true
  fi

  # Step 1: Start DynamoDB Local
  echo "[1/5] Starting DynamoDB Local ($STORAGE_MODE)..."
  docker compose -f "$COMPOSE_FILE" up -d

  # Step 2: Health check DynamoDB (use 127.0.0.1 to avoid IPv6 issues on Windows)
  echo "[2/5] Waiting for DynamoDB Local..."
  for i in {1..30}; do
    if curl -s http://127.0.0.1:8000 > /dev/null 2>&1; then
      echo "  DynamoDB Local is ready"
      break
    fi
    if [ $i -eq 30 ]; then
      echo "Error: DynamoDB Local failed to start"
      exit 1
    fi
    sleep 1
  done

  # Step 3: Create tables and seed data
  echo "[3/5] Setting up tables and seeding profiles..."
  node backend/local/create-tables.js
  node backend/local/seed-profiles.js

  # Step 4: Start backend
  echo "[4/5] Starting backend server..."
  (cd backend && npm run dev) &
  BACKEND_PID=$!

  # Health check: Backend
  echo "  Waiting for backend..."
  for i in {1..30}; do
    if curl -s http://localhost:3001/api/profiles > /dev/null 2>&1; then
      echo "  Backend is ready at http://localhost:3001"
      break
    fi
    if [ $i -eq 30 ]; then
      echo "Warning: Backend health check timed out (may still be starting)"
    fi
    sleep 1
  done

  # Step 5: Start frontend
  echo "[5/5] Starting frontend..."
  (cd frontend && npx vite --port 5173 --strictPort) &
  FRONTEND_PID=$!

  # Brief wait for frontend to start
  sleep 3
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "  Frontend is ready at http://localhost:5173"
  else
    echo "  Frontend starting... (may take a moment)"
  fi

  # Save PIDs for stop
  echo "$BACKEND_PID $FRONTEND_PID" > .local-pids

  echo ""
  echo "=== All services started ==="
  echo "  Frontend:  http://localhost:5173"
  echo "  Backend:   http://localhost:3001"
  echo "  DynamoDB:  http://127.0.0.1:8000"
  echo ""
  echo "Run 'bash scripts/app.sh --stop' to stop all services"
}

# ── Argument parsing ──────────────────────────────────────────────────
case "${1}" in
  --start)
    do_start
    ;;
  --stop)
    do_stop
    ;;
  --restart)
    do_stop
    echo ""
    do_start
    ;;
  *)
    echo "Usage: bash scripts/app.sh [--start | --stop | --restart]"
    echo ""
    echo "  --start    Start DynamoDB, backend, and frontend"
    echo "  --stop     Stop all services"
    echo "  --restart  Stop then start all services"
    exit 1
    ;;
esac
