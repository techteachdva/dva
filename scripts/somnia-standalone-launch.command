#!/bin/bash
cd "$(dirname "$0")"
PORT=8765
URL="http://localhost:$PORT/"

if command -v python3 >/dev/null 2>&1; then
  echo ""
  echo "Somnia local server"
  echo "  $URL"
  echo ""
  echo "Leave this window open while you play. Press Ctrl+C to stop."
  echo ""
  (sleep 1 && open "$URL") &
  exec python3 -m http.server "$PORT"
fi

echo "Python 3 is required to run Somnia locally on macOS."
echo "Or upload the zip to itch.io and play in the browser."
read -n 1 -s -r -p "Press any key to close…"
