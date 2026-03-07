#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS_FILE="$SCRIPT_DIR/.pids"

if [ -f "$PIDS_FILE" ]; then
  echo "App appears to be running already. Run ./stop.sh first."
  exit 1
fi

# Start backend
cd "$SCRIPT_DIR/backend"
node server.js &
BACKEND_PID=$!

# Start frontend
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
echo ""
echo "Open the Frontend URL on your phone (same Wi-Fi) to test."
echo "Run ./stop.sh to stop both servers."
