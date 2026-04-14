#!/usr/bin/env bash
# GhostGrid — start backend + frontend in a tmux session
# Usage: ./start.sh
#   Stop: ./start.sh stop   OR   tmux kill-session -t ghostgrid

SESSION="ghostgrid"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$1" = "stop" ]; then
    tmux kill-session -t "$SESSION" 2>/dev/null && echo "GhostGrid stopped." || echo "No running session found."
    exit 0
fi

# If already running, just attach
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "GhostGrid already running — attaching..."
    tmux attach-session -t "$SESSION"
    exit 0
fi

# Create session with backend in top pane
tmux new-session -d -s "$SESSION" -x 220 -y 50 -n "ghostgrid"
tmux send-keys -t "$SESSION" "cd '$DIR/backend' && uvicorn main:app --host 0.0.0.0 --port 8000 --reload" Enter

# Split horizontally, frontend in bottom pane
tmux split-window -v -t "$SESSION"
tmux send-keys -t "$SESSION" "cd '$DIR/frontend' && npm run dev" Enter

# Focus top pane and attach
tmux select-pane -t "$SESSION:0.0"
tmux attach-session -t "$SESSION"
