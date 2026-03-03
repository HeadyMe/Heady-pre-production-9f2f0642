#!/bin/bash
# Heady Stop All — Gracefully stop all Heady apps
echo "Stopping all Heady apps..."

for pidfile in /tmp/heady-*.pid; do
    [ -f "$pidfile" ] || continue
    PID=$(cat "$pidfile")
    NAME=$(basename "$pidfile" .pid)
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        echo "  Stopped $NAME (PID=$PID)"
    fi
    rm -f "$pidfile"
done

echo "All Heady apps stopped."
