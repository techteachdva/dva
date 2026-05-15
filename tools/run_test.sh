#!/usr/bin/env bash
# Run automated Physix gameplay test inside WSL with xvfb.
# Place this script in the project root (or tools/) and run from WSL or Git Bash.
#
# Examples:
#   ./tools/run_test.sh
#   ./tools/run_test.sh world_1/level_1_2 45
#   ./tools/run_test.sh world_5/level_5_3 90 /tmp/physix_5_3.log

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || pwd)"
WSL_PROJECT="/mnt/c${PROJECT_ROOT#C:}"
WSL_PROJECT="${WSL_PROJECT//\\//}"

LEVEL_PATH="res://scenes/levels/world_1/level_1_1.tscn"
DURATION="60"
LOG_FILE="/tmp/physix_bot.log"

if [ $# -ge 1 ]; then
    LEVEL_PATH="res://scenes/levels/$1.tscn"
fi
if [ $# -ge 2 ]; then
    DURATION="$2"
fi
if [ $# -ge 3 ]; then
    LOG_FILE="$3"
fi

GODOT="godot"
if command -v godot &>/dev/null; then
    GODOT="godot"
elif [ -f "/usr/local/bin/godot" ]; then
    GODOT="/usr/local/bin/godot"
fi

echo "[Physix Test] Level: $LEVEL_PATH"
echo "[Physix Test] Duration: ${DURATION}s"
echo "[Physix Test] Log: $LOG_FILE"

wsl --exec bash -c "
    export DISPLAY=:99
    xvfb-run --auto-servernum \
        $GODOT --path '$WSL_PROJECT' \
        --scene res://tools/test_runner.tscn \
        --level=$LEVEL_PATH --duration=$DURATION --bot-log=$LOG_FILE
"

echo "[Physix Test] Done. Log: $LOG_FILE"
