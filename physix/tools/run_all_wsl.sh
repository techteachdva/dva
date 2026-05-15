#!/usr/bin/env bash
set -euo pipefail

cd "/mnt/c/Users/phili/OneDrive/Desktop/Physix"
RESULTS_DIR="/mnt/c/tmp/physix_results"
mkdir -p "$RESULTS_DIR"
DURATION=45
GODOT=/usr/local/bin/godot

test_level() {
    local lvl="$1"
    local NAME
    NAME="$(basename "$lvl")"
    local LOG="$RESULTS_DIR/${NAME}.log"
    echo "Testing $NAME ..."
    export DISPLAY=:99
    xvfb-run --auto-servernum "$GODOT" --path "/mnt/c/Users/phili/OneDrive/Desktop/Physix" --scene res://tools/test_runner.tscn --level=res://scenes/levels/$lvl.tscn --duration=$DURATION --bot-log="$LOG" >/dev/null 2>&1 || true
    if [ -f "$LOG" ]; then
        RESULT="$(grep "BOT_FINISH" "$LOG" | tail -n1 || true)"
        if [ -n "$RESULT" ]; then
            echo "$NAME: $RESULT"
        else
            echo "$NAME: NO_FINISH_EVENT"
        fi
    else
        echo "$NAME: NO_LOG"
    fi
}

LEVELS=(
    world_1/level_1_1 world_1/level_1_2 world_1/level_1_3 world_1/level_1_4 world_1/level_1_5 world_1/level_1_6
    world_2/level_2_1 world_2/level_2_2 world_2/level_2_3 world_2/level_2_4 world_2/level_2_5 world_2/level_2_6
    world_3/level_3_1 world_3/level_3_2 world_3/level_3_3 world_3/level_3_4 world_3/level_3_5 world_3/level_3_6
    world_4/level_4_1 world_4/level_4_2 world_4/level_4_3 world_4/level_4_4 world_4/level_4_5 world_4/level_4_6
    world_5/level_5_1 world_5/level_5_2 world_5/level_5_3 world_5/level_5_4 world_5/level_5_5 world_5/level_5_6
    world_6/level_6_1 world_6/level_6_2 world_6/level_6_3 world_6/level_6_4 world_6/level_6_5 world_6/level_6_6
    bonus/bonus_1 bonus/bonus_2 bonus/bonus_3 bonus/bonus_4 bonus/bonus_5 bonus/bonus_6
)

for lvl in "${LEVELS[@]}"; do
    test_level "$lvl"
done
