#!/usr/bin/env bash
# Run the bot across every Physix level and collect results.
# Run from Git Bash or WSL.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || pwd)"
WSL_PROJECT="/mnt/c${PROJECT_ROOT#C:}"
WSL_PROJECT="${WSL_PROJECT//\\//}"

GODOT="godot"
if command -v godot &>/dev/null; then
    GODOT="godot"
elif [ -f "/usr/local/bin/godot" ]; then
    GODOT="/usr/local/bin/godot"
fi

# Use a shared path accessible from both WSL and Windows
RESULTS_DIR="/mnt/c/tmp/physix_results"
mkdir -p "$RESULTS_DIR"

DURATION="35"

LEVELS=(
    "world_1/level_1_1"
    "world_1/level_1_2"
    "world_1/level_1_3"
    "world_1/level_1_4"
    "world_1/level_1_5"
    "world_1/level_1_6"
    "world_2/level_2_1"
    "world_2/level_2_2"
    "world_2/level_2_3"
    "world_2/level_2_4"
    "world_2/level_2_5"
    "world_2/level_2_6"
    "world_3/level_3_1"
    "world_3/level_3_2"
    "world_3/level_3_3"
    "world_3/level_3_4"
    "world_3/level_3_5"
    "world_3/level_3_6"
    "world_4/level_4_1"
    "world_4/level_4_2"
    "world_4/level_4_3"
    "world_4/level_4_4"
    "world_4/level_4_5"
    "world_4/level_4_6"
    "world_5/level_5_1"
    "world_5/level_5_2"
    "world_5/level_5_3"
    "world_5/level_5_4"
    "world_5/level_5_5"
    "world_5/level_5_6"
    "world_6/level_6_1"
    "world_6/level_6_2"
    "world_6/level_6_3"
    "world_6/level_6_4"
    "world_6/level_6_5"
    "world_6/level_6_6"
    "bonus/bonus_1"
    "bonus/bonus_2"
    "bonus/bonus_3"
    "bonus/bonus_4"
    "bonus/bonus_5"
    "bonus/bonus_6"
)

SUMMARY="$RESULTS_DIR/summary.txt"
> "$SUMMARY"

for lvl in "${LEVELS[@]}"; do
    NAME="$(basename "$lvl")"
    LOG="$RESULTS_DIR/${NAME}.log"
    echo "=========================================="
    echo "Testing $NAME ..."
    echo "=========================================="

    # Run inside WSL so logs land in the same filesystem
    wsl --exec bash -c "
        export DISPLAY=:99
        xvfb-run --auto-servernum \
            $GODOT --path '$WSL_PROJECT' \
            --scene res://tools/test_runner.tscn \
            --level=res://scenes/levels/$lvl.tscn \
            --duration=$DURATION \
            --bot-log='$LOG'
    " || true

    # Extract result from log
    if [ -f "$LOG" ]; then
        RESULT="$(grep 'BOT_FINISH' '$LOG' | tail -n1 || true)"
        if [ -n "$RESULT" ]; then
            echo "$NAME: $RESULT" >> "$SUMMARY"
        else
            echo "$NAME: NO_FINISH_EVENT" >> "$SUMMARY"
        fi
    else
        echo "$NAME: NO_LOG" >> "$SUMMARY"
    fi
    echo ""
done

echo "=========================================="
echo "ALL TESTS COMPLETE"
echo "=========================================="
cat "$SUMMARY"
echo "Results saved to: $SUMMARY"
