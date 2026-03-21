#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS_FILE="$SCRIPT_DIR/.pids"

if [ -f "$PIDS_FILE" ]; then
  echo "App appears to be running already. Run ./stop.sh first."
  exit 1
fi

# Detect OS for compose file
OS_NAME="$(uname -s)"
if [[ "$OS_NAME" == MINGW* || "$OS_NAME" == MSYS* || "$OS_NAME" == CYGWIN* || "$OS_NAME" == Windows_NT ]]; then
  COMPOSE_FILE="backend/local/docker-compose.windows.yml"
  STORAGE_MODE="in-memory mode"
else
  COMPOSE_FILE="backend/local/docker-compose.yml"
  STORAGE_MODE="persistent storage"
fi

# Step 1: Start DynamoDB Local
echo "[1/5] Starting DynamoDB Local ($STORAGE_MODE)..."
docker compose -f "$SCRIPT_DIR/$COMPOSE_FILE" up -d

# Step 2: Wait for DynamoDB
echo "[2/5] Waiting for DynamoDB Local..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8000 > /dev/null 2>&1; then
    echo "  DynamoDB Local is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Error: DynamoDB Local failed to start"
    exit 1
  fi
  sleep 1
done

# Step 3: Create tables and seed data
echo "[3/5] Setting up tables and seeding profiles..."
cd "$SCRIPT_DIR"
node backend/local/create-tables.js
node backend/local/seed-profiles.js

# Step 4: Start backend
echo "[4/5] Starting backend..."
cd "$SCRIPT_DIR/backend"
node server.js &
BACKEND_PID=$!

# Step 5: Start frontend
echo "[5/5] Starting frontend..."
cd "$SCRIPT_DIR/frontend"
npx vite --host &
FRONTEND_PID=$!

# Save PIDs
echo "$BACKEND_PID" > "$PIDS_FILE"
echo "$FRONTEND_PID" >> "$PIDS_FILE"

# Detect LAN IP
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$LAN_IP" ] && LAN_IP=$(ipconfig 2>/dev/null | grep -m1 'IPv4' | awk -F': ' '{print $2}' | tr -d '\r')
[ -z "$LAN_IP" ] && LAN_IP="localhost"

echo ""
echo "Stock Analysis Dashboard started!"
echo "  Backend:  http://$LAN_IP:3001  (PID: $BACKEND_PID)"
echo "  Frontend: http://$LAN_IP:5173  (PID: $FRONTEND_PID)"
echo "  DynamoDB: http://127.0.0.1:8000"
echo ""
echo "Open the Frontend URL on your phone (same Wi-Fi) to test."
echo "Run ./stop.sh to stop both servers."
