#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS_FILE="$SCRIPT_DIR/.pids"

# Kill saved PIDs and their child processes
if [ -f "$PIDS_FILE" ]; then
  while read -r PID; do
    if kill -0 "$PID" 2>/dev/null; then
      # Kill entire process tree (works on Windows/MSYS)
      taskkill //F //T //PID "$PID" 2>/dev/null && echo "Stopped process tree $PID" || kill "$PID" 2>/dev/null
    else
      echo "Process $PID already stopped"
    fi
  done < "$PIDS_FILE"
  rm -f "$PIDS_FILE"
fi

# Kill any orphaned node processes on our ports (3001, 5173-5200)
CLEANED=0
for PORT in 3001 $(seq 5173 5200); do
  PIDS=$(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $5}' | sort -u)
  for PID in $PIDS; do
    [ -z "$PID" ] && continue
    taskkill //F //T //PID "$PID" 2>/dev/null && CLEANED=$((CLEANED + 1))
  done
done

if [ "$CLEANED" -gt 0 ]; then
  echo "Cleaned up $CLEANED orphaned process(es) on app ports."
fi

echo "App stopped."
